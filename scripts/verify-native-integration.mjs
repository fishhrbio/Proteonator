import {_electron as electron} from 'playwright';import assert from 'node:assert/strict';import {readFile,writeFile,mkdir} from 'node:fs/promises';import path from 'node:path';
import {systemPath,softwareGraphicsArgs,resourcesForExecutable} from './native-environment.mjs';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'work/native-package');await mkdir(out,{recursive:true});const executable=process.env.PROTEONATOR_EXE;if(!executable)throw new Error('Set the installed native executable.');
const env={...process.env,PATH:systemPath};for(const key of ['ELECTRON_RUN_AS_NODE','PROTEONATOR_PYTHON','PYTHONPATH','PYTHONHOME'])delete env[key];
const app=await electron.launch({executablePath:executable,chromiumSandbox:true,args:[...softwareGraphicsArgs,'--proview-verify-hidden','--user-data-dir='+path.join(out,'integration-profile')],env});const report={status:'running',checks:[],errors:[]};
try{
 const page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(e.stack));await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Proteonator is ready'),{},{timeout:90000});
 const info=await app.evaluate(({app,BrowserWindow})=>({version:app.getVersion(),platform:process.platform,arch:process.arch,resources:process.resourcesPath,userDataPath:app.getPath('userData'),noSandbox:app.commandLine.hasSwitch('no-sandbox'),preferences:BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences()}));
 assert.equal(info.version,'1.2.1');assert.equal(info.arch,process.env.PROTEONATOR_TARGET_ARCH??process.arch);assert.equal(info.resources,resourcesForExecutable(executable));assert.equal(info.noSandbox,false);assert.equal(info.preferences.sandbox,true);assert.equal(info.preferences.nodeIntegration,false);assert.equal(info.preferences.contextIsolation,true);report.nativeInfo=info;
 report.checks.push('Installed native version, architecture, resource path and sandbox settings match the release');
 if(process.platform==='darwin'){
  const labels=await app.evaluate(({Menu})=>Menu.getApplicationMenu().items.map(i=>i.label));assert.equal(labels[0],'Proteonator');
  const file=path.join(root,'fixtures/projects/proteonator-1.1.proteonator');await app.evaluate(({app},file)=>app.emit('open-file',{preventDefault(){}},file),file);await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Project reopened'),{},{timeout:90000});
  assert.ok(await page.locator('#edit-list .edit-card').count()>0);report.checks.push('macOS application menu and native document-open event restore the supplied project');
 }
 await app.evaluate(({shell})=>{globalThis.__nativeHelp='';shell.openPath=async p=>{globalThis.__nativeHelp=p;return '';};});
 await page.locator('[data-command=commands]').first().click();await page.locator('#command-query').fill('offline user guide');await page.getByRole('button',{name:'Open offline user guide',exact:true}).click();
 const help=await app.evaluate(()=>globalThis.__nativeHelp);assert.equal(help,path.join(info.resources,'USER_GUIDE.html'));assert.match(await readFile(help,'utf8'),/Proteonator/);report.checks.push('Native help command selects the installed offline guide');
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1600,1050));const image=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));await writeFile(path.join(out,'native-workspace.png'),Buffer.from(image,'base64'));
 await page.locator('[data-command=settings]').first().click();await page.locator('[data-theme-choice=glass]').click();await page.locator('#settings [aria-label="Close settings"]').click();
 const file=path.join(out,'native saved é.proteonator');await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},file);await page.locator('[data-command=save]:visible').first().click();await page.waitForFunction(()=>!document.querySelector('[aria-busy=true]'),{},{timeout:90000});assert.ok((await readFile(file)).length>1000);report.checks.push('Saved a real native project and theme preference for reinstall/uninstall retention checks');
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=String(e.stack);console.error(e);process.exitCode=1;}
finally{await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy())).catch(()=>{});await app.close().catch(()=>{});await writeFile(path.join(out,'integration-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
