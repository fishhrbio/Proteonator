import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { contractSchemas, NormalizedStructureSchema, GeometryRequestSchema, PtmAnnotationSchema, RigidTransformSchema, JobEventSchema, ProjectSchema } from '../src/contracts/index.js';
import { EngineError, parsePdb, parseProject, runGeometry } from '../src/engine/index.js';
import { pdbAtom, requestFor } from './engine-helpers.js';
const text=[pdbAtom({serial:1}),pdbAtom({serial:2,chain:'B',x:4}),'END',''].join('\n');
const s=parsePdb(text,{name:'contract.pdb',kind:'synthetic-test'});
const view={selection:null,transforms:{},representation:'cartoon',background:'#09121c',reducedMotion:false,camera:null};
const project=()=>({schemaVersion:'2.0.0',format:'proview-project',id:'project_1',title:'Contract sample',createdAt:'2026-11-11T00:00:00.000Z',updatedAt:'2026-11-11T00:00:00.000Z',portability:'embedded-inputs-only',inputs:[{sourceSha256:s.source.sha256,format:'pdb',name:'contract.pdb',text}],structures:[s],annotations:[],modifications:[],analyses:[],comparison:null,view});
test('every contract exports to actual draft 2020-12 JSON Schema',()=>{
  for(const [name,schema] of Object.entries(contractSchemas)){
    const exported=z.toJSONSchema(schema,{target:'draft-2020-12'});assert.equal(exported.$schema,'https://json-schema.org/draft/2020-12/schema',name);assert.ok(JSON.stringify(exported).length>50,name);
  }
});
test('schemas reject wrong units, unsupported thresholds, extra fields and invalid identifiers',()=>{
  assert.equal(NormalizedStructureSchema.safeParse({...s,coordinateUnit:'nanometer'}).success,false);
  assert.equal(NormalizedStructureSchema.safeParse({...s,id:'bad id'}).success,false);
  assert.equal(GeometryRequestSchema.safeParse({...requestFor(s),contactCutoffAngstrom:5}).success,false);
  assert.equal(GeometryRequestSchema.safeParse({...requestFor(s),coordinateUnit:'nanometer'}).success,false);
  assert.equal(GeometryRequestSchema.safeParse({...requestFor(s),jobId:''}).success,false);
  assert.equal(GeometryRequestSchema.safeParse({...requestFor(s),partnerAChainKeys:[s.chains[0]!.key,s.chains[0]!.key]}).success,false);
});
test('cross-reference validation rejects orphan atoms, duplicate keys and invalid models',()=>{
  assert.equal(NormalizedStructureSchema.safeParse({...s,atoms:[{...s.atoms[0]!,residueKey:'missing'},s.atoms[1]!]}).success,false);
  assert.equal(NormalizedStructureSchema.safeParse({...s,atoms:[s.atoms[0]!,s.atoms[0]!]}).success,false);
  assert.equal(NormalizedStructureSchema.safeParse({...s,selectedModelId:'missing'}).success,false);
});
test('annotation contract cannot claim coordinates changed',()=>{
  const annotation={schemaVersion:'1.0.0',id:'ann_1',kind:'annotation',structureId:s.id,residueKey:s.residues[0]!.key,ptm:'phosphorylation',label:'Annotated',createdAt:'2026-11-11T00:00:00.000Z',evidence:{kind:'user-annotation'},coordinatesChanged:false};
  assert.equal(PtmAnnotationSchema.safeParse(annotation).success,true);assert.equal(PtmAnnotationSchema.safeParse({...annotation,coordinatesChanged:true}).success,false);
});
test('transforms prohibit scale, reflection and unit substitution',()=>{
  const t={convention:'row-major;column-vector;p-display=R*p-source+t',coordinateUnit:'angstrom',rotation:[1,0,0,0,1,0,0,0,1],translation:{x:1,y:2,z:3}};
  assert.equal(RigidTransformSchema.safeParse(t).success,true);
  assert.equal(RigidTransformSchema.safeParse({...t,rotation:[-1,0,0,0,1,0,0,0,1]}).success,false);
  assert.equal(RigidTransformSchema.safeParse({...t,rotation:[2,0,0,0,2,0,0,0,2]}).success,false);
});
test('job terminal states and failed error envelopes validate strictly',()=>{
  const base={jobId:'job_1',occurredAt:'2026-11-11T00:00:00.000Z'};
  assert.equal(JobEventSchema.safeParse({...base,status:'completed',progress:1}).success,true);
  assert.equal(JobEventSchema.safeParse({...base,status:'completed',progress:0.9}).success,false);
  assert.equal(JobEventSchema.safeParse({...base,status:'failed',progress:0.5}).success,false);
});
test('portable project validates hashes and rejects future versions without mutation',()=>{
  const valid=project();assert.equal(ProjectSchema.safeParse(valid).success,true);assert.equal(parseProject(JSON.stringify(valid)).title,'Contract sample');
  const future=JSON.stringify({...valid,schemaVersion:'3.0.0'});assert.throws(()=>parseProject(future),(e:unknown)=>e instanceof EngineError&&e.code==='UNSUPPORTED_PROJECT_VERSION');
  const corrupted={...valid,inputs:[{...valid.inputs[0]!,text:text+'REMARK corrupted\n'}]};assert.throws(()=>parseProject(JSON.stringify(corrupted)),/hash mismatch/);
  const unbacked={...valid,inputs:[{...valid.inputs[0]!,sourceSha256:'0'.repeat(64)}]};assert.equal(ProjectSchema.safeParse(unbacked).success,false);
  const changedCoordinates={...valid,structures:[{...s,atoms:[{...s.atoms[0]!,position:{x:9,y:0,z:0}},s.atoms[1]!]}]};
  assert.throws(()=>parseProject(JSON.stringify(changedCoordinates)),/disagree with embedded source/);
  const geometry=runGeometry(s,requestFor(s));
  const changedGeometry={...valid,analyses:[{...geometry,minimumDistance:{...geometry.minimumDistance,distanceAngstrom:3}}]};
  assert.throws(()=>parseProject(JSON.stringify(changedGeometry)),/Derived geometry disagrees/);
});
