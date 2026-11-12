import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,rm,mkdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {parseMmcif,parsePdb,alignStructures,parseProject,getActiveAtoms} from '../src/engine/index.js';
import {atomicWrite} from '../src/desktop/files.js';
import {retrievePublicStructure} from '../src/desktop/retrieval.js';
import {startWorker} from '../src/desktop/worker-runner.js';
import {pdbAtom} from './engine-helpers.js';

const fields=['group_PDB','id','type_symbol','label_atom_id','label_alt_id','label_comp_id','label_asym_id','label_seq_id','auth_seq_id','auth_asym_id','pdbx_PDB_ins_code','Cartn_x','Cartn_y','Cartn_z','occupancy','pdbx_PDB_model_num'];
const row="ATOM 1 C CA . ALA LABEL 1 -2 AUTH A 1.25 -2.5 3e1 1 1";
const cif=(rows:string[],headers=fields)=>`data_test\n_struct.title\n;A multi-line description\nloop_ is text here\n;\nloop_\n${headers.map(h=>'_atom_site.'+h).join('\n')}\n${rows.join('\n')}\n#\n`;
const meta={name:'adversarial.cif',kind:'synthetic-test' as const};
const temporaryRoot=path.resolve('work');await mkdir(temporaryRoot,{recursive:true});

test('CIF quoting, multiline fields, exponents, author/label identities and insertion codes',()=>{
  const s=parseMmcif(cif([row.replace('AUTH',"'_chain'")]),meta);
  assert.deepEqual(s.atoms[0]!.position,{x:1.25,y:-2.5,z:30});
  assert.equal(s.chains[0]!.authAsymId,'_chain');assert.equal(s.residues[0]!.authSeqId,'-2');assert.equal(s.residues[0]!.insertionCode,'A');
  assert.equal(parseMmcif(cif([row.replace('AUTH',"'loop_'" )]),meta).chains[0]!.authAsymId,'loop_');
});
test('UTF-8 BOM preserves exact source hashing without shifting PDB coordinate columns',()=>{
  const text='\uFEFF'+pdbAtom({serial:1,x:1.234,y:-5.678,z:9.012});
  const s=parsePdb(text,{name:'bom.pdb',kind:'synthetic-test'});
  assert.deepEqual(s.atoms[0]!.position,{x:1.234,y:-5.678,z:9.012});
  assert.equal(s.source.sha256,createHash('sha256').update(Buffer.from(text,'utf8')).digest('hex'));
});
test('CIF malformed rows, duplicate fields, duplicate serials and multiple coordinate blocks reject',()=>{
  assert.throws(()=>parseMmcif(cif([row.split(' ').slice(0,-1).join(' ')]),meta),/Incomplete/);
  assert.throws(()=>parseMmcif(cif([row.replace('1.25', 'nan')]),meta),/Invalid x/);
  assert.throws(()=>parseMmcif(cif([row],fields.map(x=>x==='Cartn_y'?'Cartn_x':x)),meta),/Duplicate/);
  assert.throws(()=>parseMmcif(cif([row,row.replace('CA','N')]),meta),/Duplicate atom_site.id/);
  assert.throws(()=>parseMmcif(cif([row])+cif([row]),meta),/Multiple atom_site/);
  assert.throws(()=>parseMmcif(cif([row.replace('AUTH',"'unterminated")]),meta),/Unterminated/);
});
test('CIF alternate choice, shared blanks, zero occupancy and multiple models remain distinct',()=>{
  const rows=[row.replace('CA .','CA A').replace('3e1 1 1','3e1 0.3 1'),row.replace('ATOM 1','ATOM 2').replace('CA .','CA B').replace('3e1 1 1','3e1 0.7 1'),row.replace('ATOM 1','ATOM 3').replace('CA .','N .'),row.replace('ATOM 1','ATOM 4').replace('CA .','O .').replace('3e1 1 1','3e1 0 1'),row.replace(/1$/,'2')];
  const s=parseMmcif(cif(rows),meta);
  assert.equal(s.models.length,2);assert.equal(s.residues[0]!.preferredAltLoc,'B');assert.deepEqual(getActiveAtoms(s).map(a=>a.serial),['2','3']);
  assert.equal(getActiveAtoms(s,'model_2').length,1);
});
const source=(points:number[][],name:string)=>{const text=points.map(([x,y,z],i)=>pdbAtom({serial:i+1,name:'CA',seq:i+1,x,y,z})).join('\n');return {text,s:parsePdb(text,{name,kind:'synthetic-test'})};};
const a=source([[0,0,0],[1,0,0],[0,2,0],[0,0,3]],'reference.pdb'),b=source([[10,5,-3],[10,6,-3],[8,5,-3],[10,5,0]],'mobile.pdb');
const mapping=a.s.atoms.map((r,i)=>({referenceAtomKey:r.key,mobileAtomKey:b.s.atoms[i]!.key}));
const fit=alignStructures(a.s,b.s,{schemaVersion:'1.0.0',jobId:'saved_alignment',kind:'rigid-alignment',referenceStructureId:a.s.id,mobileStructureId:b.s.id,atomCorrespondence:mapping,method:'kabsch-no-reflection',atomPolicy:'explicit-correspondence-only'});
const project=()=>({schemaVersion:'2.0.0',format:'proview-project',id:'roundtrip',title:'Portable comparison',createdAt:'2026-11-11T00:00:00.000Z',updatedAt:'2026-11-11T00:00:00.000Z',portability:'embedded-inputs-only',inputs:[a,b].map(({s,text})=>({sourceSha256:s.source.sha256,format:'pdb',name:s.source.name,text})),structures:[a.s],annotations:[],modifications:[],analyses:[],comparison:{structure:b.s,referenceChainKey:a.s.chains[0]!.key,mobileChainKey:b.s.chains[0]!.key,mapping,result:fit},view:{selection:null,transforms:{},representation:'sphere',background:'#0c1521',reducedMotion:true,camera:null}});
test('portable comparison roundtrip revalidates both sources, mapping, fit and displacements',()=>{
  const out=parseProject(JSON.stringify(project()));assert.equal(out.comparison!.result!.rmsdAngstrom,fit.rmsdAngstrom);assert.equal(out.view.representation,'sphere');
  assert.throws(()=>parseProject(JSON.stringify({...project(),comparison:{...project().comparison,result:{...fit,rmsdAngstrom:2}}})),/Derived alignment disagrees/);
  assert.throws(()=>parseProject(JSON.stringify({...project(),comparison:{...project().comparison,mapping:[mapping[0],mapping[0],mapping[2]]}})),/one-to-one/);
  assert.throws(()=>parseProject(JSON.stringify({...project(),inputs:[project().inputs[0],{...project().inputs[1],text:b.text+'\nREMARK tampered'}]})),/hash mismatch/);
});
test('legacy geometry-only project migrates in memory; unknown project versions reject',()=>{
  const p=project();const old=JSON.stringify({...p,schemaVersion:'1.0.0',format:'ptm-desktop-project',inputs:[p.inputs[0]],comparison:undefined});
  const out=parseProject(old);assert.equal(out.schemaVersion,'2.0.0');assert.equal(out.comparison,null);assert.equal(JSON.parse(old).schemaVersion,'1.0.0');
  assert.throws(()=>parseProject(JSON.stringify({...p,schemaVersion:'99.0.0'})),/unsupported/);
});
test('portable project byte limit rejects before attempting to parse unbounded content',()=>{
  assert.throws(()=>parseProject(' '.repeat(50*1024*1024+1)),(e:any)=>e.code==='RESOURCE_LIMIT');
});
test('proper fit rejects collinear points and inactive conformers',()=>{
  const s=source([[0,0,0],[1,1,1],[2,2,2]],'line.pdb').s;
  assert.throws(()=>alignStructures(s,s,{schemaVersion:'1.0.0',jobId:'line',kind:'rigid-alignment',referenceStructureId:s.id,mobileStructureId:s.id,atomCorrespondence:s.atoms.map(a=>({referenceAtomKey:a.key,mobileAtomKey:a.key})),method:'kabsch-no-reflection',atomPolicy:'explicit-correspondence-only'}),/collinear/);
});
test('atomic write and rename failures preserve existing destination and clean temporary files',async()=>{
  const dir=await mkdtemp(path.join(temporaryRoot,'proview-write-'));
  try{
    const file=path.join(dir,'project é.proview');await writeFile(file,'original');
    for(const operation of ['writeFile','rename']){
      const fs=await import('node:fs/promises');const io={writeFile:fs.writeFile,rename:fs.rename,unlink:fs.unlink,...{[operation]:async()=>{throw Object.assign(new Error('simulated disk failure'),{code:'EACCES'});}}};
      await assert.rejects(atomicWrite(file,'replacement',io));assert.equal(await readFile(file,'utf8'),'original');assert.deepEqual(await readdir(dir),['project é.proview']);
    }
    await atomicWrite(file,'replacement');assert.equal(await readFile(file,'utf8'),'replacement');
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('retrieval is fixed-host, rejects invalid accession, HTTP errors, invalid encoding and oversize',async()=>{
  let called='';const fetcher=async(url:any)=>{called=String(url);return new Response('data_test');};
  assert.equal((await retrievePublicStructure('1crn',fetcher as any)).text,'data_test');assert.equal(called,'https://files.rcsb.org/download/1CRN.cif');
  await assert.rejects(retrievePublicStructure('../x',fetcher as any),(e:any)=>e.code==='INVALID_INPUT');
  await assert.rejects(retrievePublicStructure('1CRN',(async()=>new Response('',{status:404})) as any),(e:any)=>e.code==='INVALID_INPUT');
  await assert.rejects(retrievePublicStructure('1CRN',(async()=>new Response(new Uint8Array([255]))) as any),(e:any)=>e.code==='INVALID_INPUT');
  await assert.rejects(retrievePublicStructure('1CRN',(async()=>new Response('x',{headers:{'content-length':String(6*1024*1024)}})) as any),(e:any)=>e.code==='RESOURCE_LIMIT');
});
test('retrieval body timeout and offline failure are bounded and recoverable',async()=>{
  const keepAlive=setTimeout(()=>{},1000);
  try{
    const fetcher=async(_url:any,options:any)=>new Response(new ReadableStream({start(controller){options.signal.addEventListener('abort',()=>controller.error(new Error('timeout')),{once:true});}}));
    const start=performance.now();await assert.rejects(retrievePublicStructure('1CRN',fetcher as any,25),(e:any)=>e.code==='OFFLINE');assert.ok(performance.now()-start<1000);
    await assert.rejects(retrievePublicStructure('1CRN',(async()=>{throw new Error('offline');}) as any),(e:any)=>e.code==='OFFLINE');
  }finally{clearTimeout(keepAlive);}
});
test('worker exit, malformed message, timeout and cancellation settle once; next worker succeeds',async()=>{
  const dir=await mkdtemp(path.join(temporaryRoot,'proview-workers-'));
  try{
    const file=path.join(dir,'worker.cjs');
    await writeFile(file,"const {parentPort,workerData}=require('node:worker_threads');if(workerData==='exit')process.exit(7);else if(workerData==='wait')setTimeout(()=>{},10000);else if(workerData==='bad')parentPort.postMessage({oops:1});else parentPort.postMessage({ok:true,value:42});");
    for(const mode of ['exit','bad','wait'])await assert.rejects(startWorker(file,mode,{timeoutMs:mode==='wait'?30:5000}),(e:any)=>e.code==='COMPUTATION_FAILED');
    await assert.rejects(startWorker(file,'wait',{onStart:(_w,abort)=>abort()}),(e:any)=>e.code==='CANCELLED');
    assert.equal(await startWorker(file,'ok'),42);
  }finally{await rm(dir,{recursive:true,force:true});}
});
