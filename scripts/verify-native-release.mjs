import {spawn} from 'node:child_process';import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'work/native-result');await mkdir(out,{recursive:true});
const groups={molecular:'studio,workspace-tools,analysis-tools,studio-extended,completion,faults',sequence:'sequence,new-workflows,integrated-chemistry,media,studio-physics,migration,project-startup,runtime',desktop:'studio-desktop'};
const startedAt=new Date().toISOString();
async function group(name){return await new Promise(resolve=>{const child=spawn(process.execPath,[path.join(root,'scripts/verify-release.mjs')],{cwd:root,env:{...process.env,PROTEONATOR_VERIFY_LABEL:'native-'+name,PROTEONATOR_VERIFY_SUITES:groups[name]},windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.pipe(process.stdout);child.stderr.pipe(process.stderr);child.on('error',e=>{console.error(e);resolve(-1);});child.on('close',resolve);});}
const exits=await Promise.all([group('molecular'),group('sequence')]);
if(exits.every(code=>code===0))exits.push(await group('desktop'));
const report={status:exits.length===3&&exits.every(code=>code===0)?'passed':'failed',startedAt,finishedAt:new Date().toISOString(),groups:[],suites:[]};
for(const name of Object.keys(groups)){
 try{const dir=path.join(root,'work/native-'+name),r=JSON.parse(await readFile(path.join(dir,'result.json'),'utf8'));report.groups.push({name,status:r.status});report.suites.push(...r.suites);for(const s of r.suites)for(const ext of ['json','log'])await copyFile(path.join(dir,s.name+'.'+ext),path.join(out,s.name+'.'+ext));}catch(e){report.status='failed';report.groups.push({name,error:String(e)});}
}
const names=report.suites.map(s=>s.name);if(names.length!==15||new Set(names).size!==15||report.suites.some(s=>s.status!=='passed'||s.exitCode!==0))report.status='failed';
report.checks=report.suites.reduce((n,s)=>n+(s.checks??0),0);await writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(report.status!=='passed')process.exitCode=1;
