import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EngineError, parsePdb, getActiveAtoms, runGeometry, constructPtm, importStructure, annotatePtm } from '../src/engine/index.js';
import { pdbAtom, requestFor } from './engine-helpers.js';

const meta={name:'analytic.pdb',kind:'synthetic-test' as const};
const parse=(lines:string[])=>parsePdb([...lines,'END',''].join('\n'),meta);
const errorCode=(code:string)=>(e:unknown)=>e instanceof EngineError&&e.code===code;

test('3-4-5 distance is exact and independent of contact threshold',()=>{
  const s=parse([pdbAtom({serial:1}),pdbAtom({serial:2,chain:'B',x:3,y:4})]);
  const r=runGeometry(s,requestFor(s));
  assert.equal(r.minimumDistance.distanceAngstrom,5);assert.equal(r.contacts.length,0);assert.equal(r.clashCandidates.length,0);
  assert.equal(r.summary.evaluatedPairCount,1);assert.equal(r.provenance.clashInterpretation,'geometric-candidates-only');
});
test('contact cutoff is inclusive and overlap cutoff is strict',()=>{
  for(const [distance,contacts,clashes] of [[4,1,0],[4.001,0,0],[3,1,0],[2.999,1,1]] as const){
    const s=parse([pdbAtom({serial:1}),pdbAtom({serial:2,chain:'B',x:distance})]);
    const r=runGeometry(s,requestFor(s));assert.equal(r.contacts.length,contacts,`contact at ${distance}`);assert.equal(r.clashCandidates.length,clashes,`overlap at ${distance}`);
  }
});
test('explicit CONECT 1-2 exclusion affects overlaps, not contact reporting',()=>{
  const s=parse([pdbAtom({serial:1}),pdbAtom({serial:2,chain:'B',x:1.5}),'CONECT    1    2','CONECT    2    1']);
  const r=runGeometry(s,requestFor(s));assert.equal(s.bonds.length,1);assert.equal(s.topology.completeness,'partial');
  assert.equal(r.contacts.length,1);assert.equal(r.clashCandidates.length,0);assert.equal(r.summary.knownBondExcludedPairCount,1);
});
test('explicit 1-3 bond neighbors are excluded even through a nonprotein atom',()=>{
  const s=parse([pdbAtom({serial:1}),pdbAtom({serial:2,chain:'B',x:1.5}),pdbAtom({serial:3,chain:'L',record:'HETATM',residue:'LIG',x:5}),'CONECT    1    3','CONECT    3    2']);
  const r=runGeometry(s,requestFor(s));assert.equal(r.clashCandidates.length,0);assert.equal(r.summary.knownBondExcludedPairCount,1);
});
test('model numbers, insertion codes and repeated chain segments remain distinct',()=>{
  const s=parse(['MODEL        7',pdbAtom({serial:1,seq:10}),pdbAtom({serial:2,seq:10,ins:'A',x:1}),pdbAtom({serial:3,seq:10,ins:'B',x:2}),'ENDMDL','MODEL       42',pdbAtom({serial:1,seq:10,x:100}),'ENDMDL']);
  assert.deepEqual(s.models.map(x=>x.sourceModelNumber),[7,42]);assert.equal(s.residues.length,4);assert.equal(new Set(s.residues.map(x=>x.key)).size,4);
  assert.equal(getActiveAtoms(s).length,3);assert.equal(getActiveAtoms(s,'model_2')[0]!.position.x,100);
  const segmented=parse([pdbAtom({serial:1}),`TER                  A`,pdbAtom({serial:2})]);
  assert.equal(segmented.chains.length,2);assert.equal(new Set(segmented.residues.map(x=>x.key)).size,2);
});
test('alternate selection uses residue mean occupancy, blank precedence, no cross-label filling',()=>{
  const s=parse([
    pdbAtom({serial:1,name:'N'}),pdbAtom({serial:2,name:'CA',alt:'A',occupancy:0.4,x:10}),pdbAtom({serial:3,name:'CB',alt:'A',occupancy:0.4,x:11}),
    pdbAtom({serial:4,name:'CA',alt:'B',occupancy:0.7,x:20}),pdbAtom({serial:5,name:'CG',alt:'B',occupancy:0.7,x:21}),
    pdbAtom({serial:6,name:'CA',x:2}),pdbAtom({serial:7,name:'O',occupancy:0,x:100}),
  ]);
  assert.equal(s.atoms.length,7);assert.equal(s.residues[0]!.preferredAltLoc,'B');
  assert.deepEqual(getActiveAtoms(s).map(a=>a.serial),['1','5','6']);
  assert.ok(s.diagnostics.some(x=>x.code==='ALTERNATE_CONFORMERS'));
});
test('alternate ties prefer A and then lexical; missing occupancy is explicit',()=>{
  const s=parse([pdbAtom({serial:1,alt:'B',occupancy:0.5}),pdbAtom({serial:2,alt:'A',occupancy:0.5}),pdbAtom({serial:3,name:'N',occupancy:null})]);
  assert.equal(s.residues[0]!.preferredAltLoc,'A');assert.equal(s.atoms[2]!.occupancy,null);assert.ok(s.diagnostics.some(x=>x.code==='MISSING_OCCUPANCY'));
  const t=parse([pdbAtom({serial:1,alt:'C',occupancy:0.5}),pdbAtom({serial:2,alt:'B',occupancy:0.5})]);assert.equal(t.residues[0]!.preferredAltLoc,'B');
});
test('canonical protein heavy-atom filter excludes H, water, ligand, modified, unknown and zero occupancy',()=>{
  const s=parse([pdbAtom({serial:1}),pdbAtom({serial:2,chain:'B',x:4}),
    pdbAtom({serial:3,chain:'B',name:'H',element:'H',x:0.1}),pdbAtom({serial:4,chain:'B',seq:2,residue:'HOH',record:'HETATM',element:'O',x:0.2}),
    pdbAtom({serial:5,chain:'B',seq:3,residue:'MSE',record:'HETATM',element:'SE',x:0.3}),pdbAtom({serial:6,chain:'B',seq:4,residue:'LIG',record:'HETATM',x:0.4}),
    pdbAtom({serial:7,chain:'B',seq:5,element:'X',x:0.5}),pdbAtom({serial:8,chain:'B',seq:6,occupancy:0,x:0.6})]);
  const r=runGeometry(s,requestFor(s));assert.equal(r.summary.selectedAtomCountB,1);assert.equal(r.minimumDistance.distanceAngstrom,4);assert.equal(s.atoms.length,8);
});
test('known heavy elements without radius enter contacts but never fabricated overlap radii',()=>{
  const s=parse([pdbAtom({serial:1}),pdbAtom({serial:2,chain:'B',residue:'SEC',name:'SE',element:'SE',x:1})]);
  const r=runGeometry(s,requestFor(s));assert.equal(r.contacts.length,1);assert.equal(r.clashCandidates.length,0);assert.equal(r.summary.unknownRadiusPairCount,1);
});
test('blank protein element inference is diagnosed and CA remains carbon',()=>{
  const s=parse([pdbAtom({element:''})]);assert.equal(s.atoms[0]!.element,'C');assert.equal(s.atoms[0]!.sourceElement,'');assert.ok(s.diagnostics.some(x=>x.code==='INFERRED_ELEMENT'));
});
test('duplicates, malformed coordinates, empty sources and out-of-range occupancy fail visibly',()=>{
  assert.throws(()=>parse([pdbAtom(),pdbAtom()]),errorCode('AMBIGUOUS_MAPPING'));
  assert.throws(()=>parse([pdbAtom(),pdbAtom({serial:2})]),errorCode('AMBIGUOUS_MAPPING'));
  assert.throws(()=>parse(['ATOM      1']),errorCode('INVALID_INPUT'));
  assert.throws(()=>parse([pdbAtom({occupancy:1.1})]),errorCode('INVALID_INPUT'));
  assert.throws(()=>parse(['HEADER EMPTY']),errorCode('MISSING_COORDINATES'));
  const malformed=pdbAtom().slice(0,30)+'     NaN'+pdbAtom().slice(38);assert.throws(()=>parse([malformed]),errorCode('INVALID_INPUT'));
});
test('analysis refuses stale structure identifiers, overlapping partners and missing protein coordinates',()=>{
  const s=parse([pdbAtom({serial:1}),pdbAtom({serial:2,chain:'B',x:4})]);
  assert.throws(()=>runGeometry(s,{...requestFor(s),structureId:'other'}),errorCode('INVALID_INPUT'));
  assert.throws(()=>runGeometry(s,{...requestFor(s),partnerBChainKeys:requestFor(s).partnerAChainKeys}),errorCode('INVALID_INPUT'));
  const noProtein=parse([pdbAtom({serial:1}),pdbAtom({serial:2,chain:'B',record:'HETATM',residue:'HOH'})]);
  assert.throws(()=>runGeometry(noProtein,requestFor(noProtein)),errorCode('MISSING_COORDINATES'));
});
test('cancellation is checked before validation and within pair evaluation',()=>{
  const s=parse([pdbAtom({serial:1}),pdbAtom({serial:2,chain:'B',x:4})]);
  assert.throws(()=>runGeometry(s,requestFor(s),{isCancelled:()=>true}),errorCode('CANCELLED'));
  let checkpoints=0;assert.throws(()=>runGeometry(s,requestFor(s),{isCancelled:()=>++checkpoints>=2}),errorCode('CANCELLED'));assert.equal(checkpoints,2);
});
test('annotations preserve coordinates; PTM construction and unsupported imports fail honestly',()=>{
  const s=parse([pdbAtom()]),before=JSON.stringify(s.atoms);
  const annotation=annotatePtm(s,{schemaVersion:'1.0.0',id:'ann_1',kind:'annotation',structureId:s.id,residueKey:s.residues[0]!.key,ptm:'phosphorylation',label:'Candidate site',createdAt:'2026-11-11T00:00:00.000Z',evidence:{kind:'user-annotation'},coordinatesChanged:false});
  assert.equal(annotation.coordinatesChanged,false);assert.equal(JSON.stringify(s.atoms),before);
  assert.throws(()=>constructPtm({schemaVersion:'1.0.0',jobId:'job_ptm',kind:'construct-ptm',structureId:s.id,residueKey:s.residues[0]!.key,chemistry:'phosphorylation'}),errorCode('UNSUPPORTED_CHEMISTRY'));
  for(const format of ['mmcif','fasta'] as const) assert.throws(()=>importStructure({schemaVersion:'1.0.0',jobId:'job_import',format,text:'data_example',metadata:meta}),errorCode('MISSING_COORDINATES'));
});
test('deterministic keys preserve original chain/residue/atom provenance and default evidence is neutral',()=>{
  const text=pdbAtom({chain:'',seq:-2,ins:'A',alt:'B',occupancy:0.6})+'\n';
  const a=parsePdb(text,{name:'a.pdb',kind:'local-file'}),b=parsePdb(text,{name:'renamed.pdb',kind:'local-file'});
  assert.equal(a.id,b.id);assert.equal(a.atoms[0]!.key,b.atoms[0]!.key);assert.equal(a.chains[0]!.authAsymId,'');assert.equal(a.residues[0]!.authSeqId,'-2');
  assert.equal(a.residues[0]!.insertionCode,'A');assert.equal(a.atoms[0]!.altLoc,'B');assert.equal(a.evidenceClass,'supplied-coordinates');assert.ok(Object.isFrozen(a.atoms[0]!.position));
});
test('real 1CRN fixture imports 327 atoms and 46 residues without fabricated coordinates',()=>{
  const path=fileURLToPath(new URL('../fixtures/structures/1CRN.pdb',import.meta.url));
  const s=parsePdb(readFileSync(path,'utf8'),{name:'1CRN.pdb',kind:'bundled-fixture',accession:'1CRN',evidenceClass:'observed-structure'});
  assert.equal(s.atoms.length,327);assert.equal(s.residues.length,46);assert.equal(getActiveAtoms(s).length,327);assert.equal(s.evidenceClass,'observed-structure');
});
test('output cap also applies when every close pair lacks a supported radius',()=>{
  const records=[];
  for(let i=0;i<317;i++) records.push(pdbAtom({serial:i+1,seq:i+1,chain:'A'}));
  for(let i=0;i<317;i++) records.push(pdbAtom({serial:318+i,seq:i+1,chain:'B',residue:'SEC',name:'SE',element:'SE',x:1}));
  const s=parse(records);
  assert.throws(()=>runGeometry(s,requestFor(s)),errorCode('RESOURCE_LIMIT'));
});
