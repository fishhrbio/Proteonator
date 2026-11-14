import {_electron as electron} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {systemPath,softwareGraphicsArgs,resourcesForExecutable} from './native-environment.mjs';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'work/offline-help');await mkdir(out,{recursive:true});
const exe=process.env.PROTEONATOR_EXE;if(!exe)throw new Error('Set the installed executable.');
const env={...process.env,PATH:systemPath};for(const key of ['ELECTRON_RUN_AS_NODE','PYTHONPATH','PYTHONHOME','PROTEONATOR_PYTHON'])delete env[key];
const app=await electron.launch({executablePath:exe,chromiumSandbox:true,args:[...softwareGraphicsArgs,'--proview-verify-hidden','--user-data-dir='+path.join(out,'profile-'+Date.now())],env});
const report={status:'running',checks:[],requests:[],errors:[]};
try{
 const page=await app.firstWindow();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Proteonator is ready'),{},{timeout:90000});
 for(const name of ['USER_GUIDE','SCIENCE']){
  const file=path.join(resourcesForExecutable(exe),name+'.html');assert.ok((await readFile(file)).length>1000);
  const next=app.waitForEvent('window');await app.evaluate(({BrowserWindow},file)=>{const w=new BrowserWindow({show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});void w.loadFile(file);},file);const help=await next;
  help.on('request',r=>{if(/^https?:/.test(r.url()))report.requests.push(r.url());});help.on('pageerror',e=>report.errors.push(e.message));await help.route(/^https?:/,r=>r.abort());await help.waitForLoadState('domcontentloaded');
  assert.match(await help.title(),/Proteonator/);assert.match(await help.locator('h1').innerText(),/Proteonator 1.2/);
  const a=await new AxeBuilder({page:help}).setLegacyMode().withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(a.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
  assert.equal(await help.locator('nav a').count(),2);report.checks.push('Installed '+name+' renders offline with local navigation and passes automated accessibility');await help.close();
 }
 assert.deepEqual(report.requests,[]);assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=String(e.stack);process.exitCode=1;console.error(e);}
finally{await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy())).catch(()=>{});await app.close().catch(()=>{});await writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
