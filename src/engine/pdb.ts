import { createHash } from 'node:crypto';
import { ImportMetadataSchema, NormalizedStructureSchema, type Atom, type Diagnostic, type ImportMetadata, type NormalizedStructure, type Residue } from '../contracts/index.js';
import { EngineError, invalidInput } from './errors.js';

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const MAX_IMPORT_ATOMS = 100_000;
export const CANONICAL_PROTEIN_RESIDUES = new Set('ALA ARG ASN ASP CYS GLN GLU GLY HIS ILE LEU LYS MET PHE PRO SER THR TRP TYR VAL SEC PYL'.split(' '));
const MODIFIED = new Set('MSE SEP TPO PTR HYP CSO CME KCX MLY M3L HIC FME PCA LLP'.split(' '));
const WATER = new Set(['HOH','WAT','DOD']);
const ELEMENTS = new Set('H HE LI BE B C N O F NE NA MG AL SI P S CL AR K CA SC TI V CR MN FE CO NI CU ZN GA GE AS SE BR KR RB SR Y ZR NB MO TC RU RH PD AG CD IN SN SB TE I XE CS BA LA CE PR ND PM SM EU GD TB DY HO ER TM YB LU HF TA W RE OS IR PT AU HG TL PB BI PO AT RN FR RA AC TH PA U NP PU AM CM BK CF ES FM MD NO LR RF DB SG BH HS MT DS RG CN NH FL MC LV TS OG D T'.split(' '));
const keyPart = (value: string) => value === '' ? '~' : encodeURIComponent(value).replace(/~/g,'%7E');
const numeric = (value: string, field: string, line: number, optional=false): number | null => {
  const trimmed=value.trim();
  if(optional && trimmed==='') return null;
  if(!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) invalidInput(`Invalid ${field} on PDB line ${line}`,{line,field});
  const n=Number(trimmed);
  if(!Number.isFinite(n)) invalidInput(`Non-finite ${field} on PDB line ${line}`,{line,field});
  return n;
};

/** Conservative fixed-column PDB importer. All valid atom records are retained, including unused models/altlocs. */
export function parsePdb(text: string, metadata: ImportMetadata): NormalizedStructure {
  const meta=ImportMetadataSchema.safeParse(metadata);
  if(!meta.success) invalidInput(`Invalid import metadata: ${meta.error.issues[0]?.message}`);
  if(typeof text!=='string' || text.trim()==='') invalidInput('Structure text is empty');
  const bytes=Buffer.byteLength(text,'utf8');
  if(bytes>MAX_IMPORT_BYTES) throw new EngineError({code:'RESOURCE_LIMIT',message:'PDB exceeds the 10 MiB input limit',recovery:'Use a smaller structure or a selected biological unit.',details:{bytes,limitBytes:MAX_IMPORT_BYTES}});
  const sha256=createHash('sha256').update(text,'utf8').digest('hex');
  const id=`str_${sha256.slice(0,24)}`;
  const models: {id:string;sourceModelNumber:number}[]=[];
  const chains: {key:string;modelId:string;authAsymId:string;labelAsymId:null;segmentIndex:number}[]=[];
  const residues: Residue[]=[]; const atoms: Atom[]=[];
  const residueMap=new Map<string,Residue>(), chainMap=new Map<string,typeof chains[number]>();
  const segmentByChain=new Map<string,number>();
  const identitySet=new Set<string>(), serialMap=new Map<string,Atom>();
  const diagnostics: Diagnostic[]=[];
  const diagnosticCounts=new Map<string,{severity:'info'|'warning';message:string;count:number;line:number}>();
  const diag=(code:string,message:string,line:number,severity:'info'|'warning'='warning')=>{
    const previous=diagnosticCounts.get(code);
    if(previous) previous.count++;
    else diagnosticCounts.set(code,{severity,message,count:1,line});
  };
  let currentModel:string|null=null, explicitModels=false, modelOpen=false, lastChain='';
  const pendingConect:{modelId:string|null;serials:string[];line:number}[]=[];
  const lines=text.split(/\r?\n/);
  // Preserve the BOM in the source/hash; it is not part of PDB's fixed columns.
  if(lines[0]?.startsWith('\uFEFF'))lines[0]=lines[0].slice(1);
  const seenModelNumbers=new Set<number>();
  for(let i=0;i<lines.length;i++){
    const line=lines[i]!, sourceLine=i+1, record=line.slice(0,6).trim();
    if(record==='MODEL'){
      if(modelOpen || (!explicitModels && atoms.length>0)) invalidInput(`Inconsistent MODEL nesting on line ${sourceLine}`,{line:sourceLine});
      const raw=line.slice(10,14).trim();
      if(!/^\d+$/.test(raw)) invalidInput(`Invalid MODEL number on line ${sourceLine}`,{line:sourceLine});
      const sourceModelNumber=Number(raw);
      if(seenModelNumbers.has(sourceModelNumber)) throw new EngineError({code:'AMBIGUOUS_MAPPING',message:'Duplicate MODEL number',recovery:'Give every model a unique source number.',details:{line:sourceLine,sourceModelNumber}});
      seenModelNumbers.add(sourceModelNumber); explicitModels=true; modelOpen=true;
      currentModel=`model_${models.length+1}`; models.push({id:currentModel,sourceModelNumber}); continue;
    }
    if(record==='ENDMDL'){
      if(!explicitModels || !modelOpen) invalidInput(`ENDMDL without an open MODEL on line ${sourceLine}`,{line:sourceLine});
      modelOpen=false; currentModel=null; continue;
    }
    if(record==='TER'){
      const chain=line.length>=22 ? line.slice(21,22).trim() : lastChain;
      const model=currentModel ?? (!explicitModels ? 'model_1' : null);
      if(model){ const sk=`${model}\0${chain}`; segmentByChain.set(sk,(segmentByChain.get(sk)??0)+1); }
      continue;
    }
    if(record==='CONECT'){
      const serials=[];
      for(let start=6;start<line.length;start+=5){ const token=line.slice(start,start+5).trim(); if(token) serials.push(token); }
      if(serials.length>1) pendingConect.push({modelId:currentModel,serials,line:sourceLine});
      continue;
    }
    if(record==='LINK'||record==='SSBOND') { diag('UNMODELED_COVALENT_LINKS',`${record} connectivity is retained only in the source file; this importer does not translate it to a complete bond graph.`,sourceLine); continue; }
    if(record==='MODRES') { diag('MODIFIED_RESIDUE_METADATA','MODRES metadata requires the chemical component interpretation; affected coordinates remain retained.',sourceLine); continue; }
    if(record==='SEQRES') { diag('SEQUENCE_NOT_RECONSTRUCTED','SEQRES is not reconciled to missing coordinates; absent residues are not invented.',sourceLine,'info'); continue; }
    if(record==='REMARK' && /^\s*(465|470)\b/.test(line.slice(6))) { diag('MISSING_COORDINATE_METADATA','REMARK 465/470 indicates missing-coordinate metadata; source is preserved, and no missing atom or residue is constructed.',sourceLine); continue; }
    if(record!=='ATOM'&&record!=='HETATM') continue;
    if(atoms.length>=MAX_IMPORT_ATOMS) throw new EngineError({code:'RESOURCE_LIMIT',message:'PDB exceeds the 100,000 atom limit',recovery:'Use a smaller structure or selected model.'});
    if(line.length<54) invalidInput(`Truncated coordinate record on line ${sourceLine}`,{line:sourceLine});
    if(explicitModels&&!modelOpen) invalidInput(`Coordinate outside MODEL block on line ${sourceLine}`,{line:sourceLine});
    if(!currentModel){ currentModel='model_1'; models.push({id:currentModel,sourceModelNumber:1}); }
    const modelId=currentModel;
    const serial=line.slice(6,11).trim(), name=line.slice(12,16).trim(), altLoc=line.slice(16,17).trim(), residueName=line.slice(17,20).trim();
    const authAsymId=line.slice(21,22).trim(), authSeqId=line.slice(22,26).trim(), insertionCode=line.slice(26,27).trim();
    if(!/^\d+$/.test(serial)) invalidInput(`Unsupported or invalid atom serial on line ${sourceLine}; hybrid-36 is not implemented`,{line:sourceLine});
    if(!/^-?\d+$/.test(authSeqId)||!name||!residueName) invalidInput(`Missing or invalid atom/residue identity on line ${sourceLine}`,{line:sourceLine});
    if(serialMap.has(`${modelId}\0${serial}`)) throw new EngineError({code:'AMBIGUOUS_MAPPING',message:`Duplicate atom serial ${serial} in ${modelId}`,recovery:'Use distinct atom serials within each model before importing.',details:{line:sourceLine}});
    const segmentIndex=segmentByChain.get(`${modelId}\0${authAsymId}`)??0;
    const chainKey=`${id}/${modelId}/chain/${keyPart(authAsymId)}/segment/${segmentIndex}`;
    if(!chainMap.has(chainKey)){ const chain={key:chainKey,modelId,authAsymId,labelAsymId:null,segmentIndex}; chains.push(chain); chainMap.set(chainKey,chain); }
    const residueKey=`${chainKey}/residue/${keyPart(authSeqId)}/ins/${keyPart(insertionCode)}/name/${keyPart(residueName)}`;
    const classification: Residue['classification']=WATER.has(residueName) ? 'water' : record==='ATOM'&&CANONICAL_PROTEIN_RESIDUES.has(residueName) ? 'protein' : MODIFIED.has(residueName) ? 'modified-residue' : record==='HETATM' ? 'ligand' : 'unknown';
    if(!residueMap.has(residueKey)){
      const residue={key:residueKey,chainKey,modelId,authSeqId,labelSeqId:null,insertionCode,name:residueName,classification,preferredAltLoc:''};
      residueMap.set(residueKey,residue); residues.push(residue);
      if(classification==='modified-residue'||classification==='unknown') diag('UNSUPPORTED_RESIDUE_CHEMISTRY','Modified or unclassified residue coordinates are retained but excluded from canonical-protein geometry.',sourceLine);
    }
    const identity=`${residueKey}\0${name}\0${altLoc}`;
    if(identitySet.has(identity)) throw new EngineError({code:'AMBIGUOUS_MAPPING',message:'Duplicate atom name and altLoc within one residue',recovery:'Resolve duplicate coordinate records; distinct serials do not resolve ambiguous atom identity.',details:{line:sourceLine}});
    identitySet.add(identity);
    const occupancy=numeric(line.slice(54,60),'occupancy',sourceLine,true);
    if(occupancy!==null&&(occupancy<0||occupancy>1)) invalidInput(`Occupancy must lie between zero and one on line ${sourceLine}`,{line:sourceLine});
    if(occupancy===null) diag('MISSING_OCCUPANCY','Missing occupancy is retained as null and treated as 1 only for conformer selection.',sourceLine);
    if(occupancy===0) diag('ZERO_OCCUPANCY','Zero-occupancy coordinates are retained but excluded from the active coordinate set.',sourceLine);
    const sourceElement=line.slice(76,78).trim();
    let element: string|null=sourceElement.toUpperCase()||null;
    if(element&&!ELEMENTS.has(element)){ diag('UNKNOWN_ELEMENT','Unknown element labels are retained as source text; these atoms are excluded from heavy-atom geometry.',sourceLine); element=null; }
    if(!element&&!sourceElement&&record==='ATOM'&&CANONICAL_PROTEIN_RESIDUES.has(residueName)){
      const inferred=name.replace(/^\d+/,'')[0]?.toUpperCase();
      if(inferred&&['C','N','O','S','P','H','D'].includes(inferred)){element=inferred;diag('INFERRED_ELEMENT','Missing element inferred conservatively from canonical-protein atom name; source field stays empty.',sourceLine);}
    }
    if(!element) diag('MISSING_ELEMENT','Atoms without a supported, identifiable element remain visible but are excluded from heavy-atom geometry.',sourceLine);
    const atom:Atom={key:`${residueKey}/atom/${keyPart(name)}/alt/${keyPart(altLoc)}/serial/${keyPart(serial)}`,residueKey,chainKey,modelId,serial,name,element,sourceElement,
      position:{x:numeric(line.slice(30,38),'x',sourceLine)!,y:numeric(line.slice(38,46),'y',sourceLine)!,z:numeric(line.slice(46,54),'z',sourceLine)!},
      altLoc,occupancy,bFactor:numeric(line.slice(60,66),'B-factor',sourceLine,true),recordType:record,sourceLine};
    atoms.push(atom);serialMap.set(`${modelId}\0${serial}`,atom);lastChain=authAsymId;
  }
  if(atoms.length===0) throw new EngineError({code:'MISSING_COORDINATES',message:'No ATOM or HETATM coordinates found',recovery:'Import a coordinate-bearing PDB file. FASTA sequences do not provide coordinates.'});
  if(modelOpen) diag('UNTERMINATED_MODEL','Final MODEL has no ENDMDL; its complete coordinate records were retained.',lines.length);
  const atomsByResidue=new Map<string,Atom[]>();
  for(const a of atoms){const list=atomsByResidue.get(a.residueKey)??[];list.push(a);atomsByResidue.set(a.residueKey,list);}
  const selectedResidues=residues.map(r=>{
    const labels=new Map<string,{sum:number;count:number}>();
    for(const a of atomsByResidue.get(r.key)??[]) if(a.altLoc){const score=labels.get(a.altLoc)??{sum:0,count:0};score.sum+=a.occupancy??1;score.count++;labels.set(a.altLoc,score);}
    const ordered=[...labels.entries()].sort(([a,sa],[b,sb])=>sb.sum/sb.count-sa.sum/sa.count || (a==='A'?-1:b==='A'?1:a.localeCompare(b,'en')));
    if(labels.size) diag('ALTERNATE_CONFORMERS','All alternate records are retained; active coordinates use residue mean occupancy, A then lexical ties, and shared blank atoms.',atomsByResidue.get(r.key)![0]!.sourceLine,'info');
    return {...r,preferredAltLoc:ordered[0]?.[0]??''};
  });
  const bonds: {atomAKey:string;atomBKey:string;source:'pdb-conect';order:'unknown'}[]=[];
  const bondSet=new Set<string>();
  for(const c of pendingConect){
    for(const model of c.modelId ? models.filter(m=>m.id===c.modelId):models){
      const a=serialMap.get(`${model.id}\0${c.serials[0]}`);
      for(const target of c.serials.slice(1)){
        const b=serialMap.get(`${model.id}\0${target}`);
        if(!a||!b){diag('UNRESOLVED_CONECT','A CONECT serial could not be resolved for a model; no bond was guessed.',c.line);continue;}
        if(a.key===b.key) {diag('SELF_CONECT','Self-referencing CONECT ignored.',c.line);continue;}
        const [atomAKey,atomBKey]=[a.key,b.key].sort() as [string,string];
        const signature=`${atomAKey}\0${atomBKey}`;
        if(!bondSet.has(signature)){bondSet.add(signature);bonds.push({atomAKey,atomBKey,source:'pdb-conect',order:'unknown'});}
      }
    }
  }
  if(models.length>1) diagnostics.push({code:'MULTIPLE_MODELS',severity:'info',message:'All models retained; first encountered model is selected. Analysis never mixes models.',count:models.length});
  diagnostics.push({code:'INCOMPLETE_TOPOLOGY',severity:'warning',message:'CONECT is an incomplete covalent graph. Steric overlaps are geometric candidates, not validated clashes.'});
  for(const [code,d] of diagnosticCounts) diagnostics.push({code,...d});
  return NormalizedStructureSchema.parse({schemaVersion:'1.0.0',id,coordinateUnit:'angstrom',evidenceClass:meta.data.evidenceClass??(meta.data.kind==='synthetic-test'?'synthetic-fixture':'supplied-coordinates'),
    source:{...meta.data,format:'pdb',sha256},models,selectedModelId:models[0]!.id,chains,residues:selectedResidues,atoms,bonds,
    topology:{completeness:bonds.length?'partial':'unknown',source:bonds.length?'pdb-conect':'none'},
    altLocPolicy:'residue-mean-occupancy;tie-A-then-lexical;shared-blank-wins;zero-occupancy-excluded',diagnostics});
}
