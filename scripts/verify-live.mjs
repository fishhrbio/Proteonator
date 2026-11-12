import {_electron as electron} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..'),work=path.join(root,'work/live');await mkdir(work,{recursive:true});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({executablePath:process.env.PROVIEW_EXE??path.join(root,'node_modules/electron/dist/electron.exe'),args:[...(process.env.PROVIEW_EXE?[]:[root]),'--proview-verify-hidden',`--user-data-dir=${path.join(work,'profile')}`],env});
const report={status:'running',url:'https://files.rcsb.org/download/1CRN.cif',startedAt:new Date().toISOString()};
try{
  const page=await app.firstWindow();await page.waitForFunction(()=>document.querySelector('#app-status').textContent.includes('loaded locally'));
  await page.locator('#accession').fill('1CRN');const start=performance.now();await page.locator('#retrieve').click();await page.waitForFunction(()=>document.querySelector('#app-status').textContent.includes('1CRN.cif loaded'),undefined,{timeout:20000});report.retrievalMs=performance.now()-start;
  assert.equal(await page.locator('#atom-count').innerText(),'327');assert.equal(await page.locator('#evidence-badge').innerText(),'Observed coordinates');
  const filename=path.join(work,'retrieved.proview');await app.evaluate(({dialog},filename)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:filename});},filename);await page.locator('#save-project').click();await page.waitForFunction(()=>document.querySelector('#app-status').textContent.includes('Saved portable project'));const saved=JSON.parse(await readFile(filename,'utf8'));
  report.source=saved.structures[0].source;assert.equal(report.source.kind,'remote-accession');assert.equal(report.source.sourceUrl,report.url);report.atomCount=saved.structures[0].atoms.length;report.status='passed';
}catch(e){report.status='failed';report.failure=String(e.stack??e);process.exitCode=1;}
finally{await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows())w.destroy();}).catch(()=>{});await app.close().catch(()=>{});report.finishedAt=new Date().toISOString();await mkdir(path.join(root,'evidence'),{recursive:true});await writeFile(path.join(root,'evidence/live-retrieval.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
