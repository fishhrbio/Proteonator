import {_electron as electron} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..'),work=path.join(root,'work/benchmark');await mkdir(work,{recursive:true});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const executable=process.env.PROVIEW_EXE??path.join(root,'node_modules/electron/dist/electron.exe');
const app=await electron.launch({executablePath:executable,args:[...(process.env.PROVIEW_EXE?[]:[root]),'--proview-verify-hidden',`--user-data-dir=${path.join(work,'profile')}`],env});
const report={status:'running',environment:{platform:os.platform(),release:os.release(),arch:os.arch(),cpu:os.cpus()[0].model,logicalCpus:os.cpus().length,totalMemoryBytes:os.totalmem()},method:'One warm-up and three measured 5-second fixed-increment camera paths per fixture in a visible foreground window. Frame timing is requestAnimationFrame plus synchronous rendered keyboard rotation, not a monitor-presentation or GPU-throughput guarantee. Memory sampled every 50 ms from Electron process metrics; OS per-process high-water marks are also retained. Sampled aggregate peaks are lower bounds, not an exact simultaneous allocation peak.',fixtures:[],errors:[]};
let page;
try{
  page=await app.firstWindow();page.on('dialog',d=>d.accept());page.on('pageerror',e=>report.errors.push(e.message));await page.waitForFunction(()=>document.querySelector('#app-status').textContent.includes('loaded locally'));
  report.runtime=await app.evaluate(async({app,BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setAlwaysOnTop(true);w.show();w.focus();return {versions:process.versions,gpu:await app.getGPUInfo('complete')};});
  report.webgl=await page.evaluate(()=>{const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2')??canvas.getContext('webgl');if(!gl)return null;const ext=gl.getExtension('WEBGL_debug_renderer_info');return {version:gl.getParameter(gl.VERSION),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};});
  for(const filename of ['structures/1CRN.pdb','structures/1BRS.pdb','synthetic/crambin-grid-48.pdb']){
    if(process.env.PROVIEW_BENCH_LARGE==='1'&&!filename.includes('grid'))continue;
    const sample={fixture:filename,runs:[]};let full=path.join(root,'fixtures',filename);
    if(filename.includes('grid')){
      const original=await readFile(full,'utf8');let residue=0,previous='';
      const lines=original.split(/\r?\n/).filter(l=>l.startsWith('ATOM')).map(l=>{const identity=l.slice(21,27);if(identity!==previous){residue++;previous=identity;}return l.slice(0,21)+'A'+String(residue).padStart(4)+l.slice(26);});
      full=path.join(work,'synthetic-large-protein.pdb');await writeFile(full,'REMARK SYNTHETIC RENDER LOAD: source grid coordinates, one display chain\n'+lines.join('\n')+'\nEND\n');sample.renderFixtureNote='Same grid coordinates, consolidated into one synthetic display chain with unique residue numbers so all 15,696 atoms are rendered. This does not represent an observed polymer or assembly.';
    }
    await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},full);
    let peakAggregate=0;const highWater=new Map();
    async function memory(){const m=await app.evaluate(({app})=>app.getAppMetrics());const sum=m.reduce((s,p)=>s+p.memory.workingSetSize,0);peakAggregate=Math.max(peakAggregate,sum);for(const p of m)highWater.set(p.pid,{type:p.type,peakWorkingSetKiB:Math.max(highWater.get(p.pid)?.peakWorkingSetKiB??0,p.memory.peakWorkingSetSize)});return sum;}
    sample.beforeKiB=await memory();const start=performance.now();await page.locator('#import').click();await page.waitForFunction(()=>!document.querySelector('#import').disabled);assert.match(await page.locator('#app-status').innerText(),new RegExp(path.basename(full).replaceAll('.','\\.')+' loaded'));sample.importMs=performance.now()-start;sample.afterImportKiB=await memory();
    sample.recordedAtoms=Number((await page.locator('#atom-count').innerText()).replaceAll(',',''));sample.visibleProteinAtoms=Number((await page.locator('#visible-count').innerText()).split(' ')[0].replaceAll(',',''));
    // A public-API camera control is the repeatable path used by an ordinary keyboard user.
    for(let run=0;run<4;run++){
      let measuring=true;const sampler=(async()=>{while(measuring){await memory();await new Promise(r=>setTimeout(r,50));}})();
      const timing=await page.evaluate(duration=>new Promise(resolve=>{
        const frames=[];let start,last;
        const tick=t=>{if(start===undefined){start=t;last=t;}else{frames.push(t-last);last=t;}document.querySelector('#viewer').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));if(t-start<duration)requestAnimationFrame(tick);else{const sorted=frames.slice().sort((a,b)=>a-b);resolve({durationMs:t-start,frames:frames.length,fps:frames.length*1000/(t-start),medianFrameMs:sorted[Math.floor(sorted.length*.5)],p95FrameMs:sorted[Math.floor(sorted.length*.95)]});}};requestAnimationFrame(tick);
      }),run===0?1000:5000);
      measuring=false;await sampler;assert.ok(timing.frames>0);if(run>0)sample.runs.push(timing);
    }
    sample.afterKiB=await memory();sample.sampledAggregatePeakKiB=peakAggregate;sample.processHighWaterMarks=[...highWater.values()];report.fixtures.push(sample);console.log(JSON.stringify(sample));
  }
  report.status='passed';
}catch(e){report.status='failed';report.failure=String(e.stack??e);report.lastStatus=await page?.locator('#app-status').innerText().catch(()=>null);process.exitCode=1;}
finally{await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows())w.destroy();}).catch(()=>{});await app.close().catch(()=>{});await mkdir(path.join(root,'evidence'),{recursive:true});await writeFile(path.join(root,'evidence/desktop-performance.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,failure:report.failure}));}
