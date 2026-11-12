import {_electron as electron} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..'),work=path.join(root,'work/model-test');await mkdir(work,{recursive:true});
const body=(await readFile(path.join(root,'fixtures/structures/1BRS.pdb'),'utf8')).split(/\r?\n/).filter(l=>l.startsWith('ATOM')&&['A','D'].includes(l[21]));
const moved=body.map(l=>l.slice(0,46)+(Number(l.slice(46,54))+10).toFixed(3).padStart(8)+l.slice(54));
const filename=path.join(work,'two models é.pdb'),project=path.join(work,'model 42.proview');await writeFile(filename,`MODEL        7\n${body.join('\n')}\nENDMDL\nMODEL       42\n${moved.join('\n')}\nENDMDL\nEND\n`);
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({executablePath:process.env.PROVIEW_EXE??path.join(root,'release/win-unpacked/ProView.exe'),args:['--proview-verify-hidden',`--user-data-dir=${path.join(work,'profile')}`],env});const report={status:'running',checks:[]};
try{
 const page=await app.firstWindow();page.on('dialog',d=>{if(d.type()!=='beforeunload')void d.accept().catch(()=>{});});await page.waitForFunction(()=>document.querySelector('#app-status').textContent.includes('loaded locally'));
 await app.evaluate(({dialog},filename)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[filename]});},filename);await page.locator('#import').click();await page.waitForFunction(()=>document.querySelector('#app-status').textContent.includes('two models é.pdb loaded'));
 assert.equal(await page.locator('#model option').count(),2);await page.locator('#model').selectOption('model_2');await page.waitForFunction(()=>document.querySelector('#sequence button')?.dataset.residueKey.includes('model_2'));await page.locator('#sequence button').first().click();assert.match(await page.locator('#residue-position').innerText(),/model_2/);
 await page.locator('#analyze').click();await page.locator('#analysis-result').waitFor({state:'visible'});assert.equal(await page.locator('#contact-count').innerText(),'165');
 await app.evaluate(({dialog},filename)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:filename});},project);await page.locator('#save-project').click();await page.waitForFunction(()=>document.querySelector('#app-status').textContent.includes('Saved portable project'));const saved=JSON.parse(await readFile(project,'utf8'));assert.equal(saved.structures[0].selectedModelId,'model_2');assert.equal(saved.structures[0].models[1].sourceModelNumber,42);assert.equal(saved.analyses[0].modelId,'model_2');
 await app.evaluate(({dialog},filename)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[filename]});},project);await page.locator('#open-project').click();await page.waitForFunction(()=>document.querySelector('#app-status').textContent.includes('Project reopened offline'));assert.equal(await page.locator('#model').inputValue(),'model_2');assert.equal(await page.locator('#contact-count').innerText(),'165');report.checks=['Native import retains source models 7 and 42','Choosing model 42 updates residue identity and geometry selection','Portable project saves and reopens model 42, its selected residue and its 165 contacts'];report.status='passed';
}catch(e){report.status='failed';report.failure=String(e.stack??e);process.exitCode=1;}
finally{await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows())w.destroy();}).catch(()=>{});await app.close().catch(()=>{});await mkdir(path.join(root,'evidence'),{recursive:true});await writeFile(path.join(root,'evidence/model-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
