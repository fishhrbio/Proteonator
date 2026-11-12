import {_electron as electron} from 'playwright';
import {mkdir,copyFile,rename,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..'),work=path.join(root,'work/portability/moved folder é');await mkdir(work,{recursive:true});
const originalProject=path.join(root,'work/installed/portable é.proview'),moved=path.join(work,'moved.proview');await copyFile(originalProject,moved);
const originals=['fixtures/structures/1BRS.pdb','fixtures/synthetic/barnase-comparison.pdb'];const unavailable=[];
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;env.PATH=path.join(process.env.SystemRoot??'C:\\Windows','System32');
let app;const report={status:'running',checks:[]};
try{
  for(const filename of originals){const source=path.join(root,filename),temporary=source+'.unavailable-for-test';await rename(source,temporary);unavailable.push([source,temporary]);}
  app=await electron.launch({executablePath:process.env.PROVIEW_EXE??path.join(root,'release/win-unpacked/ProView.exe'),args:['--proview-verify-hidden',`--user-data-dir=${path.join(root,'work/portability/fresh-profile')}`],env});
  const page=await app.firstWindow();page.on('dialog',d=>d.accept());await page.waitForFunction(()=>document.querySelector('#app-status').textContent.includes('loaded locally'));
  await app.evaluate(()=>{global.fetch=async()=>{throw new Error('Offline portability test');};});
  await app.evaluate(({dialog},filename)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[filename]});},moved);
  await page.locator('#open-project').click();await page.waitForFunction(()=>document.querySelector('#app-status').textContent.includes('Project reopened offline'));
  await page.locator('#comparison-panel summary').click();
  assert.equal(await page.locator('#contact-count').innerText(),'165');assert.match(await page.locator('#alignment-output').innerText(),/108 Cα atoms/);
  const saved=JSON.parse(await readFile(moved,'utf8'));report.sourceHashes=saved.inputs.map(i=>i.sourceSha256);report.alignmentRmsdAngstrom=saved.comparison.result.rmsdAngstrom;
  report.checks=['Project moved to a different folder and reopened after a full process restart','Original external reference/mobile coordinate files temporarily unavailable','Network unavailable and developer runtimes excluded from app PATH','Embedded sources, 165 geometry contacts and 108-pair comparison restored'];report.status='passed';
}catch(e){report.status='failed';report.failure=String(e.stack??e);process.exitCode=1;}
finally{if(app){await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows())w.destroy();}).catch(()=>{});await app.close().catch(()=>{});}for(const [source,temporary] of unavailable)await rename(temporary,source);await mkdir(path.join(root,'evidence'),{recursive:true});await writeFile(path.join(root,'evidence/portability-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
