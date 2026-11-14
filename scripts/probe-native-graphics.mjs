import {_electron as electron} from 'playwright';import {appendFile,mkdir,writeFile} from 'node:fs/promises';import path from 'node:path';
import {electronExecutable,graphicsModes} from './native-environment.mjs';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'work/graphics-probe');await mkdir(out,{recursive:true});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const report={platform:process.platform,architecture:process.arch,status:'failed',candidates:[]};
const modes=process.platform==='darwin'?['native','metal','swiftshader-webgl','swiftshader','angle-gl','software-gl','swiftshader-vulkan']:['swiftshader-webgl','swiftshader','native'];
for(const mode of modes){
 let app;const entry={mode,stderr:''};
 try{
  const exe=process.env.PROTEONATOR_EXE;app=await electron.launch({executablePath:exe??electronExecutable,chromiumSandbox:true,args:[...(exe?['--proview-verify-hidden']:[path.join(root,'scripts/graphics-probe-main.cjs')]),...graphicsModes[mode],'--user-data-dir='+path.join(out,'profile-'+mode)],env,timeout:30000});
  app.process().stderr.on('data',b=>entry.stderr=(entry.stderr+b).slice(-6000));
  const page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');
  entry.context=await page.evaluate(()=>{const canvas=document.createElement('canvas');const gl=canvas.getContext('webgl2')??canvas.getContext('webgl');if(!gl)return null;const ext=gl.getExtension('WEBGL_debug_renderer_info');return {version:gl.getParameter(gl.VERSION),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};});
  entry.gpu=await app.evaluate(({app})=>app.getGPUFeatureStatus());
  if(entry.context){report.status='passed';report.selectedMode=mode;report.renderer=entry.context.renderer;}
 }catch(e){entry.error=String(e.stack);}
 finally{if(app){await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy())).catch(()=>{});await app.close().catch(()=>{});}report.candidates.push(entry);console.log(JSON.stringify(entry),{flush:true});}
 if(report.status==='passed')break;
}
await writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2));
if(report.status==='passed'&&process.env.GITHUB_ENV)await appendFile(process.env.GITHUB_ENV,'PROTEONATOR_VERIFY_GL_MODE='+report.selectedMode+'\nPROTEONATOR_VERIFY_SOFTWARE_GL='+(report.selectedMode.startsWith('swiftshader')?'1':'0')+'\n');
console.log(JSON.stringify({status:report.status,selectedMode:report.selectedMode,renderer:report.renderer}));if(report.status!=='passed')process.exitCode=1;
