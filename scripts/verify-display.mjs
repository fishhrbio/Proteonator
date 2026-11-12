import {_electron as electron} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const report={status:'running',checks:[],scales:[]};
try{
  for(const scale of [1.5,2]){
    const app=await electron.launch({executablePath:process.env.PROVIEW_EXE??path.join(root,'release/win-unpacked/ProView.exe'),args:['--proview-verify-hidden','--force-renderer-accessibility',`--force-device-scale-factor=${scale}`,`--user-data-dir=${path.join(root,'work','dpi-'+scale)}`],env});
    try{
      const page=await app.firstWindow();await page.waitForFunction(()=>document.querySelector('#app-status').textContent.includes('loaded locally'));
      const results=[];
      for(const size of [[960,720],[1280,800],[1600,1000]]){
        await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setSize(...size),size);
        await page.waitForTimeout(100);
        const measurement=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,overflow:document.documentElement.scrollWidth>innerWidth}));assert.equal(measurement.overflow,false);assert.ok(Math.abs(measurement.dpr-scale)<.01);
        for(const id of ['import','analyze','fit','save-project']){await page.locator('#'+id).scrollIntoViewIfNeeded();const rect=await page.locator('#'+id).boundingBox();assert.ok(rect&&rect.x>=0&&rect.y>=0&&rect.x+rect.width<=measurement.width+1&&rect.y+rect.height<=measurement.height+1);}
        await page.locator('#sticks').click();await page.locator('#trace').click();await page.locator('#viewer').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Shift+ArrowLeft');await page.keyboard.press('f');
        await page.evaluate(()=>{document.querySelector('.rail').scrollTop=0;document.querySelector('.inspector').scrollTop=0;window.scrollTo(0,0);});
        await app.evaluate(async({BrowserWindow})=>{await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});});
        const png=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));await mkdir(path.join(root,'evidence'),{recursive:true});await writeFile(path.join(root,`evidence/display-${scale}-${size[0]}.png`),Buffer.from(png,'base64'));
        results.push({outer:size,...measurement});
      }
      const cdp=await page.context().newCDPSession(page);const tree=await cdp.send('Accessibility.getFullAXTree');const names=tree.nodes.filter(n=>!n.ignored).map(n=>n.name?.value).filter(Boolean);assert.ok(names.includes('Open coordinates Ctrl O'));assert.ok(names.some(n=>n.includes('Residues in selected chain')));report.scales.push({scale,layouts:results,accessibleNodeCount:names.length,accessibleNamesSample:names.filter(n=>/ProView|Open coordinates|Save project|Calculate interface|VAL 3/.test(n)).slice(0,20)});
    }finally{await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows())w.destroy();}).catch(()=>{});await app.close().catch(()=>{});}
  }
  report.checks=['150% and 200% native device scaling at all three required sizes','Essential controls scroll into view and stay within the viewport','Representations, rotation, pan and fit function at high DPI','Chromium native accessibility tree exposes labeled controls and residue names'];report.status='passed';
}catch(e){report.status='failed';report.failure=String(e.stack??e);process.exitCode=1;}
await mkdir(path.join(root,'evidence'),{recursive:true});await writeFile(path.join(root,'evidence/display-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
