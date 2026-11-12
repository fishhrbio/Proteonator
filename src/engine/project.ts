import { createHash } from 'node:crypto';
import { PROJECT_VERSION, ProjectSchema, type Project } from '../contracts/index.js';
import { EngineError, invalidInput } from './errors.js';
import { parsePdb } from './pdb.js';
import { parseMmcif } from './mmcif.js';
import { runGeometry } from './geometry.js';
import { alignStructures } from './alignment.js';
import { getActiveAtoms } from './selection.js';
export const MAX_PROJECT_BYTES=50*1024*1024;
/** Re-derives normalized coordinates and geometry before a serialized project becomes trusted. */
export function parseProject(text:string):Project{
  if(Buffer.byteLength(text,'utf8')>MAX_PROJECT_BYTES) throw new EngineError({code:'RESOURCE_LIMIT',message:'Project exceeds the 50 MiB portable-project limit',recovery:'Create a smaller project with fewer embedded structures.'});
  let raw:unknown;
  try{raw=JSON.parse(text);}catch{invalidInput('Project file is not valid JSON');}
  const version=raw&&typeof raw==='object'&&'schemaVersion' in raw ? raw.schemaVersion : undefined;
  if(version==='1.0.0' && (raw as any).format==='ptm-desktop-project') {
    const legacy=raw as any;
    raw={...legacy,schemaVersion:PROJECT_VERSION,format:'proview-project',comparison:null,
      analyses:Array.isArray(legacy.analyses)?legacy.analyses.map((r:any)=>({...r,provenance:{...r.provenance,
        engineVersion:r.provenance?.engineVersion==='stage-a-geometry-1'?'proview-geometry-1':r.provenance?.engineVersion}})):legacy.analyses};
  } else if(version!==PROJECT_VERSION) throw new EngineError({code:'UNSUPPORTED_PROJECT_VERSION',message:`Project schema ${String(version)} is unsupported`,recovery:'Use the ProView version that created this project. The file has been left unchanged.'});
  const result=ProjectSchema.safeParse(raw);
  if(!result.success) invalidInput(`Invalid project: ${result.error.issues[0]?.message}`);
  if(new Set(result.data.inputs.map(i=>i.sourceSha256)).size!==result.data.inputs.length) invalidInput('Duplicate embedded source hash');
  for(const input of result.data.inputs){
    if(Buffer.byteLength(input.text,'utf8')>5*1024*1024) throw new EngineError({code:'RESOURCE_LIMIT',message:'Embedded source exceeds 5 MiB',recovery:'Use a smaller source input.'});
    if(createHash('sha256').update(input.text,'utf8').digest('hex')!==input.sourceSha256) invalidInput(`Embedded source hash mismatch: ${input.name}`);
  }
  const sources=[...result.data.structures,...(result.data.comparison?[result.data.comparison.structure]:[])];
  const revalidatedSources=new Map<string,typeof sources[number]>();
  for(const saved of sources){
    const input=result.data.inputs.find(i=>i.sourceSha256===saved.source.sha256&&i.format===saved.source.format);
    if(!input) invalidInput(`Missing source for ${saved.id}`);
    const {format,sha256,...metadata}=saved.source;
    const derived=format==='pdb'?parsePdb(input.text,metadata):parseMmcif(input.text,metadata);
    if(derived.atoms.length>25_000) throw new EngineError({code:'RESOURCE_LIMIT',message:'Embedded structure exceeds 25,000 atoms',recovery:'Use a smaller structure.'});
    const selected={...derived,selectedModelId:saved.selectedModelId};
    const comparable=(s:typeof selected)=>version==='1.0.0'?{...s,diagnostics:[]}:s;
    if(JSON.stringify(comparable(selected))!==JSON.stringify(comparable(saved))) invalidInput(`Normalized coordinates or identities disagree with embedded source: ${saved.id}`);
    revalidatedSources.set(saved.id,selected);
  }
  for(const saved of result.data.analyses){
    const structure=result.data.structures.find(s=>s.id===saved.structureId);
    if(!structure) invalidInput('Analysis references an unknown structure');
    const recalculated=runGeometry(structure,{schemaVersion:'1.0.0',jobId:saved.jobId,kind:'interface-geometry',structureId:saved.structureId,modelId:saved.modelId,
      partnerAChainKeys:saved.partnerAChainKeys,partnerBChainKeys:saved.partnerBChainKeys,contactCutoffAngstrom:4,clashOverlapThresholdAngstrom:0.4});
    const comparable=(value:typeof saved)=>({...value,provenance:{...value.provenance,computedAt:''}});
    if(JSON.stringify(comparable(recalculated))!==JSON.stringify(comparable(saved))) invalidInput(`Derived geometry disagrees with embedded source: ${saved.jobId}`);
  }
  const c=result.data.comparison;
  if(c){
    const reference=result.data.structures[0]!;
    const ra=new Set(getActiveAtoms(reference).map(a=>a.key)),ma=new Set(getActiveAtoms(c.structure).map(a=>a.key));
    if(c.mapping.some(p=>!ra.has(p.referenceAtomKey)||!ma.has(p.mobileAtomKey))) invalidInput('Comparison mapping includes an inactive alternate or model');
    if(c.result){
      const fit=alignStructures(reference,c.structure,{schemaVersion:'1.0.0',jobId:c.result.jobId,kind:'rigid-alignment',referenceStructureId:reference.id,mobileStructureId:c.structure.id,
        atomCorrespondence:c.mapping,method:'kabsch-no-reflection',atomPolicy:'explicit-correspondence-only'});
      if(JSON.stringify({...fit,computedAt:''})!==JSON.stringify({...c.result,computedAt:''})) invalidInput('Derived alignment disagrees with embedded sources');
    }
  }
  return version==='1.0.0'?ProjectSchema.parse({...result.data,structures:result.data.structures.map(s=>revalidatedSources.get(s.id)!)}):result.data;
}
