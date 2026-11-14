import {_electron as electron} from 'playwright';import assert from 'node:assert/strict';import {copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import path from 'node:path';
import {softwareGraphicsArgs,systemPath} from './native-environment.mjs';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'work/native-document');await mkdir(out,{recursive:true});
const executable=process.env.PROTEONATOR_EXE;if(!executable||!['darwin','linux'].includes(process.platform))throw new Error('Use an installed Mac or Linux package.');
const file=path.join(out,'system open é.proteonator');await copyFile(path.join(root,'fixtures/projects/proteonator-1.1.proteonator'),file);
const original=createHash('sha256').update(await readFile(file)).digest('hex');
const env={...process.env,PATH:systemPath};for(const key of ['ELECTRON_RUN_AS_NODE','PYTHONPATH','PYTHONHOME','PROTEONATOR_PYTHON'])delete env[key];
const profile=path.join(out,'config');if(process.platform==='linux')env.XDG_CONFIG_HOME=profile;
const app=await electron.launch({executablePath:executable,chromiumSandbox:true,args:[...softwareGraphicsArgs,'--proview-verify-hidden',...(process.platform==='darwin'?['--user-data-dir='+profile]:[])],env});
const report={status:'running',platform:process.platform,checks:[],errors:[]};
try{
 const page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(e.stack));await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Proteonator is ready'),{},{timeout:90000});
 const options={env,timeout:30000,encoding:'utf8'};
 if(process.platform==='darwin'){
  const bundle=path.resolve(path.dirname(executable),'../..');
  execFileSync('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister',['-f',bundle],options);
  execFileSync('/usr/bin/open',[file],{...options,stdio:'ignore'});report.launchMethod='LaunchServices open of the registered project extension';
 }else{
  const mime=execFileSync('/usr/bin/xdg-mime',['query','filetype',file],options).trim();assert.equal(mime,'application/x-proteonator-project');
  const association=execFileSync('/usr/bin/xdg-mime',['query','default',mime],options).trim();assert.equal(association,'proteonator.desktop');
  execFileSync('/usr/bin/gio',['open',file],{...options,stdio:'ignore'});report.launchMethod='GIO open using the installed MIME and desktop-file association';
 }
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Project reopened'),{},{timeout:90000});
 assert.ok(await page.locator('#edit-list .edit-card').count()>0);assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),original);
 assert.deepEqual(report.errors,[]);report.checks.push('Operating-system document opening restores the existing application and leaves the original Unicode project unchanged');report.status='passed';
}catch(e){report.status='failed';report.failure=String(e.stack);process.exitCode=1;console.error(e);}
finally{await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy())).catch(()=>{});await app.close().catch(()=>{});await writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
