import {_electron as electron} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({executablePath:process.env.PROVIEW_EXE??path.join(root,'release/win-unpacked/ProView.exe'),args:['--proview-verify-hidden',`--user-data-dir=${path.join(root,'work/lifecycle')}`],env});
const report={status:'running',startedAt:new Date().toISOString()};
try{
  const page=await app.firstWindow();await page.waitForFunction(()=>document.querySelector('#app-status').textContent.includes('loaded locally'));
  report.pid=app.process().pid;
  report.startedJob=await page.evaluate(async()=>{
    const b=window.proview,s=(await b.loadExample('1BRS')).value;const request={schemaVersion:'1.0.0',jobId:'quit_while_working',kind:'interface-geometry',structureId:s.id,modelId:s.selectedModelId,partnerAChainKeys:[s.chains.find(c=>c.authAsymId==='A').key],partnerBChainKeys:[s.chains.find(c=>c.authAsymId==='D').key],contactCutoffAngstrom:4,clashOverlapThresholdAngstrom:.4};
    return new Promise(resolve=>{const off=b.onJob(e=>{if(e.jobId===request.jobId&&e.status==='running'){off();resolve(e.status);}});b.analyze(request).then(()=>{});});
  });assert.equal(report.startedJob,'running');const start=performance.now();await app.close();report.quitMs=performance.now()-start;
  let alive=true;try{process.kill(report.pid,0);}catch{alive=false;}assert.equal(alive,false);report.processExited=true;report.status='passed';
}catch(e){report.status='failed';report.failure=String(e.stack??e);process.exitCode=1;await app.close().catch(()=>{});}
report.finishedAt=new Date().toISOString();await mkdir(path.join(root,'evidence'),{recursive:true});await writeFile(path.join(root,'evidence/lifecycle-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
