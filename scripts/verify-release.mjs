import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),label=process.env.PROTEONATOR_VERIFY_LABEL??'release-verification';if(!/^[a-z0-9-]{1,64}$/.test(label))throw new Error('Use a simple verification output label.');const out=path.join(root,'work',label);await mkdir(out,{recursive:true});
if(!process.env.PROTEONATOR_EXE)throw new Error('Set PROTEONATOR_EXE to the standalone application under test.');
const suites=[['studio','studio-verification'],['workspace-tools','tools-verification'],['analysis-tools','analysis-tools-verification'],['studio-extended','extended-verification'],['sequence','sequence-verification'],['new-workflows','workflow-verification'],['integrated-chemistry','integrated-chemistry'],['completion','completion-verification'],['faults','fault-verification'],['media','media-verification'],['studio-physics','physics-ui'],['studio-desktop','desktop-final'],['migration','migration'],['project-startup','project-startup-verification'],['runtime','runtime-verification']];
const selected=process.env.PROTEONATOR_VERIFY_SUITES?.split(',');
const report={status:'running',startedAt:new Date().toISOString(),executable:process.env.PROTEONATOR_EXE,sha256:createHash('sha256').update(await readFile(process.env.PROTEONATOR_EXE)).digest('hex'),suites:[]};
for(const [name,dir]of suites){
 if(selected&&!selected.includes(name))continue;
 const env={...process.env};if(name==='runtime')env.PROTEONATOR_COMPUTE_EXE=path.join(path.dirname(process.env.PROTEONATOR_EXE),'resources/compute/ProteonatorCompute.exe');
 const startedAt=new Date().toISOString(),script=path.join(root,'scripts/verify-'+name+'.mjs');let log='';
 const exitCode=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[script],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>{log+=d;process.stdout.write(d);});child.stderr.on('data',d=>{log+=d;process.stderr.write(d);});child.on('error',reject);child.on('close',resolve);});
 let result=null;try{const bytes=await readFile(path.join(root,'work',dir,'result.json'));result=JSON.parse(bytes);await writeFile(path.join(out,name+'.json'),bytes);}catch{}
 await writeFile(path.join(out,name+'.log'),log);report.suites.push({name,startedAt,finishedAt:new Date().toISOString(),exitCode,status:result?.status??'missing-result',checks:result?.checks?.length??null});
 await writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2));
 if(exitCode!==0||result?.status!=='passed'){report.status='failed';break;}
}
if(report.status==='running')report.status='passed';report.finishedAt=new Date().toISOString();await writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(report.status!=='passed')process.exitCode=1;
