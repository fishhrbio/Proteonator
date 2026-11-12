import { GeometryRequestSchema, GeometryResultSchema, NormalizedStructureSchema, type Atom, type AtomPairDistance, type Cancellation, type ClashCandidate, type GeometryRequest, type GeometryResult, type NormalizedStructure } from '../contracts/index.js';
import { EngineError, invalidInput } from './errors.js';
import { getActiveAtoms } from './selection.js';

/** Bondi 1964 subset, in angstroms. No radius is invented for other elements. */
export const VDW_RADII_ANGSTROM: Readonly<Record<string,number>>=Object.freeze({C:1.70,N:1.55,O:1.52,S:1.80,P:1.80});
export const MAX_GEOMETRY_PAIRS=25_000_000;
export const MAX_OUTPUT_PAIRS=100_000;
export const OVERLAP_NUMERICAL_TOLERANCE_ANGSTROM=1e-12;
const checkpoint=(c?:Cancellation)=>{
  if(c?.isCancelled()) throw new EngineError({code:'CANCELLED',message:'Geometry calculation cancelled',recovery:'Run the analysis again when ready.'});
};
const pair=(a:Atom,b:Atom,distanceAngstrom:number):AtomPairDistance=>({atomAKey:a.key,atomBKey:b.key,residueAKey:a.residueKey,residueBKey:b.residueKey,distanceAngstrom});

/** Direct Euclidean calculations over authoritative source coordinates; display transforms never enter analysis. */
export function runGeometry(structure:NormalizedStructure,request:GeometryRequest,cancellation?:Cancellation):GeometryResult{
  checkpoint(cancellation);
  const validatedStructure=NormalizedStructureSchema.safeParse(structure), validatedRequest=GeometryRequestSchema.safeParse(request);
  if(!validatedStructure.success) invalidInput(`Invalid normalized structure: ${validatedStructure.error.issues[0]?.message}`);
  if(!validatedRequest.success) invalidInput(`Invalid geometry request: ${validatedRequest.error.issues[0]?.message}`);
  const s=validatedStructure.data,r=validatedRequest.data;
  if(r.structureId!==s.id) invalidInput('Analysis request refers to a different structure');
  if(!s.models.some(m=>m.id===r.modelId)) invalidInput('Requested model does not exist');
  const validChains=new Set(s.chains.filter(c=>c.modelId===r.modelId).map(c=>c.key));
  for(const key of [...r.partnerAChainKeys,...r.partnerBChainKeys]) if(!validChains.has(key)) invalidInput(`Selected chain does not belong to the requested structure/model: ${key}`);
  const proteinResidues=new Set(s.residues.filter(x=>x.classification==='protein').map(x=>x.key));
  const eligible=getActiveAtoms(s,r.modelId).filter(a=>proteinResidues.has(a.residueKey)&&a.recordType==='ATOM'&&a.element!==null&&!['H','D','T'].includes(a.element));
  const setA=new Set(r.partnerAChainKeys),setB=new Set(r.partnerBChainKeys);
  const atomsA=eligible.filter(a=>setA.has(a.chainKey)),atomsB=eligible.filter(a=>setB.has(a.chainKey));
  if(!atomsA.length||!atomsB.length) throw new EngineError({code:'MISSING_COORDINATES',message:'Each partner must contain at least one active canonical-protein heavy atom',recovery:'Choose distinct protein chains in the same model. Waters, ligands, unsupported modified residues, unknown elements and zero-occupancy atoms are excluded.'});
  const pairCount=atomsA.length*atomsB.length;
  if(pairCount>MAX_GEOMETRY_PAIRS) throw new EngineError({code:'RESOURCE_LIMIT',message:'Selected partners exceed the pair limit',recovery:'Select smaller protein chains; the limit is 25 million atom pairs.',details:{pairCount,limit:MAX_GEOMETRY_PAIRS}});
  const activeKeys=new Set(getActiveAtoms(s,r.modelId).map(a=>a.key));
  const neighbors=new Map<string,Set<string>>();
  for(const b of s.bonds){
    if(!activeKeys.has(b.atomAKey)||!activeKeys.has(b.atomBKey)) continue;
    for(const [a,c] of [[b.atomAKey,b.atomBKey],[b.atomBKey,b.atomAKey]]){const set=neighbors.get(a!)??new Set<string>();set.add(c!);neighbors.set(a!,set);}
  }
  const excludedBondPairs=new Map<string,Set<string>>();
  for(const a of atomsA){
    const excluded=new Set(neighbors.get(a.key)??[]);
    for(const oneBond of neighbors.get(a.key)??[]) for(const twoBond of neighbors.get(oneBond)??[]) excluded.add(twoBond);
    excludedBondPairs.set(a.key,excluded);
  }
  const contacts:AtomPairDistance[]=[],clashCandidates:ClashCandidate[]=[];
  const residuePairs=new Set<string>();
  let minimumDistance:AtomPairDistance|undefined,knownBondExcludedPairCount=0,unknownRadiusPairCount=0,evaluated=0;
  for(const a of atomsA) for(const b of atomsB){
    if((evaluated++ & 4095)===0) checkpoint(cancellation);
    const dx=a.position.x-b.position.x,dy=a.position.y-b.position.y,dz=a.position.z-b.position.z;
    const d=Math.sqrt(dx*dx+dy*dy+dz*dz);
    if(!Number.isFinite(d)) invalidInput('Coordinate magnitude produced a non-finite distance');
    if(!minimumDistance||d<minimumDistance.distanceAngstrom) minimumDistance=pair(a,b,d);
    if(d<=r.contactCutoffAngstrom){contacts.push(pair(a,b,d));residuePairs.add(`${a.residueKey}\0${b.residueKey}`);}
    // Enforce the cap before either chemistry-exclusion branch can continue.
    if(contacts.length+clashCandidates.length>MAX_OUTPUT_PAIRS) throw new EngineError({code:'RESOURCE_LIMIT',message:'Geometry result exceeds the 100,000 pair-record output limit',recovery:'Select smaller partner groups. Results were not silently truncated.'});
    const radiusA=VDW_RADII_ANGSTROM[a.element!],radiusB=VDW_RADII_ANGSTROM[b.element!];
    if(radiusA===undefined||radiusB===undefined){unknownRadiusPairCount++;continue;}
    if(excludedBondPairs.get(a.key)!.has(b.key)){knownBondExcludedPairCount++;continue;}
    const overlap=radiusA+radiusB-d;
    // A tiny tolerance prevents binary floating-point noise from including a mathematical 0.4 A boundary.
    if(overlap-r.clashOverlapThresholdAngstrom>OVERLAP_NUMERICAL_TOLERANCE_ANGSTROM) clashCandidates.push({...pair(a,b,d),radiusAAngstrom:radiusA,radiusBAngstrom:radiusB,overlapAngstrom:overlap,interpretation:'geometric-candidate'});
    if(contacts.length+clashCandidates.length>MAX_OUTPUT_PAIRS) throw new EngineError({code:'RESOURCE_LIMIT',message:'Geometry result exceeds the 100,000 pair-record output limit',recovery:'Select smaller partner groups. Results were not silently truncated.'});
  }
  checkpoint(cancellation);
  return GeometryResultSchema.parse({schemaVersion:'1.0.0',kind:'interface-geometry',jobId:r.jobId,structureId:s.id,modelId:r.modelId,
    partnerAChainKeys:r.partnerAChainKeys,partnerBChainKeys:r.partnerBChainKeys,minimumDistance:minimumDistance!,contacts,clashCandidates,
    summary:{selectedAtomCountA:atomsA.length,selectedAtomCountB:atomsB.length,evaluatedPairCount:pairCount,contactCount:contacts.length,contactResiduePairCount:residuePairs.size,clashCandidateCount:clashCandidates.length,knownBondExcludedPairCount,unknownRadiusPairCount},
    provenance:{engineVersion:'proview-geometry-1',method:'cross-partner-euclidean-heavy-atom-pairs',computedAt:new Date().toISOString(),sourceSha256:s.source.sha256,structureId:s.id,modelId:r.modelId,coordinateUnit:'angstrom',evidenceClass:'derived-geometry',altLocPolicy:s.altLocPolicy,
      selectionPolicy:'canonical-protein-ATOM;known-heavy-elements;positive-or-missing-occupancy',contactCutoffAngstrom:4,clashOverlapThresholdAngstrom:0.4,radiiSet:'Bondi-1964-subset-C-N-O-S-P',bondExclusionPolicy:'exclude-explicit-CONECT-1-2-and-1-3-from-overlaps;contacts-include-all',topologyCompleteness:s.topology.completeness,clashInterpretation:'geometric-candidates-only',
      limitations:['This is static geometric evidence, not binding affinity, energy, PTM effect, or functional inhibition.','The PDB bond graph is incomplete; only explicit CONECT 1-2 and 1-3 neighbors are excluded from overlap candidates.','No hydrogen optimization, chemical typing, protonation, minimization, or MolProbity clashscore is performed.','Overlap comparisons use a 1e-12 angstrom floating-point boundary tolerance; no coordinate rounding precedes analysis.','Source coordinate evidence class: '+s.evidenceClass]},
    diagnostics:[{code:'GEOMETRIC_CANDIDATES_ONLY',severity:'warning',message:'Candidate overlaps require chemical-topology review before being described as clashes.'},...(unknownRadiusPairCount ? [{code:'UNSUPPORTED_VDW_RADIUS',severity:'warning' as const,message:'Pairs involving elements outside C/N/O/S/P were included in distances and contacts but excluded from overlap candidates.',count:unknownRadiusPairCount}] : [])]});
}
