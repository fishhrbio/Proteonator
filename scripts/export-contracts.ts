import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { contractSchemas } from '../src/contracts/index.js';
import { parsePdb, runGeometry, parseProject } from '../src/engine/index.js';
import { pdbAtom, requestFor } from '../tests/engine-helpers.js';

const base=path.resolve(import.meta.dirname,'..');
const output=path.join(base,'schemas');
await mkdir(output,{recursive:true});
for(const [name,schema] of Object.entries(contractSchemas)) {
  const json=z.toJSONSchema(schema,{target:'draft-2020-12'});
  await writeFile(path.join(output,`${name}.schema.json`),JSON.stringify({...json,title:name,$comment:'TypeScript Zod refinements remain authoritative for semantic cross-reference validation.'},null,2)+'\n');
}
const time='2026-11-11T00:00:00.000Z';
const text=[pdbAtom({serial:1}),pdbAtom({serial:2,chain:'B',x:3,y:4}),'END',''].join('\n');
const metadata={name:'analytic-3-4-5.pdb',kind:'synthetic-test' as const};
const s=parsePdb(text,metadata),request=requestFor(s),result=runGeometry(s,request);
const stableResult={...result,provenance:{...result.provenance,computedAt:time}};
const selection={structureId:s.id,modelId:s.selectedModelId,residueKeys:[s.residues[0]!.key],atomKeys:[]};
const transform={convention:'row-major;column-vector;p-display=R*p-source+t',coordinateUnit:'angstrom',rotation:[1,0,0,0,1,0,0,0,1],translation:{x:0,y:0,z:0}};
const view={selection,transforms:{},representation:'cartoon',background:'#0c1521',reducedMotion:true,camera:null};
const annotation={schemaVersion:'1.0.0',id:'annotation_example',kind:'annotation',structureId:s.id,residueKey:s.residues[0]!.key,ptm:'other',label:'User note; not a predicted site',createdAt:time,evidence:{kind:'user-annotation'},coordinatesChanged:false};
const project={schemaVersion:'2.0.0',format:'proview-project',id:'project_example',title:'Synthetic contract demonstration',createdAt:time,updatedAt:time,portability:'embedded-inputs-only',inputs:[{sourceSha256:s.source.sha256,format:'pdb',name:metadata.name,text}],structures:[s],annotations:[annotation],modifications:[],analyses:[stableResult],comparison:null,view};
parseProject(JSON.stringify(project));
const examples:{schema:keyof typeof contractSchemas;value:unknown}[]=[
  {schema:'ImportMetadata',value:metadata},
  {schema:'ImportRequest',value:{schemaVersion:'1.0.0',jobId:'import_example',format:'pdb',text,metadata}},
  {schema:'NormalizedStructure',value:s}, {schema:'PtmAnnotation',value:annotation},
  {schema:'GeometryRequest',value:request},{schema:'GeometryResult',value:stableResult},
  {schema:'RendererSelection',value:selection},{schema:'RigidTransform',value:transform},{schema:'RendererState',value:view},
  {schema:'Project',value:project},
  {schema:'ProjectMigrationPolicy',value:{currentVersion:'2.0.0',acceptedVersions:['1.0.0','2.0.0'],unknownVersionBehavior:'reject-without-modifying-file',migrationsImplemented:true}},
  {schema:'AnalysisExport',value:{schemaVersion:'1.0.0',format:'proview-geometry-export',exportedAt:time,coordinateUnit:'angstrom',result:stableResult,source:s.source}},
  {schema:'ImageExportRequest',value:{schemaVersion:'1.0.0',kind:'image-export',format:'png',width:1440,height:900,includeProvenanceCaption:true,view}},
  {schema:'CancelRequest',value:{jobId:request.jobId}},
  {schema:'CoordinateModificationRequest',value:{schemaVersion:'1.0.0',jobId:'unsupported_example',kind:'construct-ptm',structureId:s.id,residueKey:s.residues[0]!.key,chemistry:'phosphorylation'}},
  {schema:'ExternalAdapterConfiguration',value:{schemaVersion:'1.0.0',id:'disabled_adapter',enabled:false,kind:'structure-prediction',endpoint:'https://example.invalid',credentialReference:null,availability:'not-configured',requiresPerRunUploadConsent:true}},
];
for(const status of ['queued','running','completed','cancelled','failed'] as const) examples.push({schema:'JobEvent',value:{jobId:request.jobId,occurredAt:time,status,progress:status==='completed'?1:0,...(status==='failed'?{error:{code:'COMPUTATION_FAILED',message:'Example failure',recovery:'Review inputs.'}}:{})}});
for(const code of ['INVALID_INPUT','UNSUPPORTED_CHEMISTRY','MISSING_COORDINATES','AMBIGUOUS_MAPPING','OPTIONAL_SERVICE_MISSING','OFFLINE'] as const) examples.push({schema:'AppError',value:{code,message:`Example ${code} response`,recovery:'Use the supported local inspection workflow.'}});
for(const entry of examples) contractSchemas[entry.schema].parse(entry.value);
await writeFile(path.join(output,'examples.json'),JSON.stringify(examples,null,2)+'\n');
// Confirm serialized files can be read back, not only generated in memory.
JSON.parse(await readFile(path.join(output,'examples.json'),'utf8'));
console.log(JSON.stringify({schemas:Object.keys(contractSchemas).length,validatedExamples:examples.length,semanticValidator:'src/contracts/index.ts'},null,2));
