import {_electron as electron} from 'playwright';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({executablePath:process.env.PROVIEW_EXE??path.join(root,'node_modules/electron/dist/electron.exe'),args:[...(process.env.PROVIEW_EXE?[]:[root]),'--proview-verify-hidden',`--user-data-dir=${path.join(root,'work/close-test')}`],env});
const report={status:'running',checks:[]};
try{
  const page=await app.firstWindow();await page.waitForFunction(()=>document.querySelector('#app-status').textContent.includes('loaded locally'));await page.locator('#sphere').click();
  await app.evaluate(({dialog,BrowserWindow})=>{global.closeCalls=[];dialog.showMessageBoxSync=(_window,options)=>{global.closeCalls.push(options);return 0;};BrowserWindow.getAllWindows()[0].close();});
  await page.waitForTimeout(200);report.prompt=await app.evaluate(()=>global.closeCalls[0]);assert.match(report.prompt.message,/unsaved changes/);assert.deepEqual(report.prompt.buttons,['Keep working','Discard changes']);assert.equal(report.prompt.defaultId,0);assert.equal((await app.windows()).length,1);report.checks.push('Keep working cancels close through the native process and preserves the loaded workspace');
  const exited=app.waitForEvent('close',{timeout:10000});await app.evaluate(({dialog,BrowserWindow})=>{dialog.showMessageBoxSync=()=>1;BrowserWindow.getAllWindows()[0].close();}).catch(e=>{if(!/closed|exited/i.test(e.message))throw e;});await exited;report.checks.push('Discard changes allows normal native window/process shutdown');report.status='passed';
}catch(e){report.status='failed';report.failure=String(e.stack??e);process.exitCode=1;}
finally{await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows())w.destroy();}).catch(()=>{});await app.close().catch(()=>{});await mkdir(path.join(root,'evidence'),{recursive:true});await writeFile(path.join(root,'evidence/close-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
