import {_electron as electron} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,writeFile,readFile,copyFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const name=process.env.PROVIEW_TEST_NAME??'source';
const evidence=path.join(root,'evidence'),work=path.join(root,'work',name),screens=path.join(root,'docs/screenshots');
await Promise.all([mkdir(evidence,{recursive:true}),mkdir(work,{recursive:true}),mkdir(screens,{recursive:true})]);
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
if(process.env.PROVIEW_RUNTIME_ONLY==='1'){env.PATH=path.join(process.env.SystemRoot??'C:\\Windows','System32');delete env.PYTHONPATH;delete env.NODE_PATH;}
const executable=process.env.PROVIEW_EXE??path.join(root,'node_modules/electron/dist/electron.exe');
const report={name,status:'running',startedAt:new Date().toISOString(),environment:{platform:os.platform(),release:os.release(),arch:os.arch(),node:process.version,cpu:os.cpus()[0].model},executable,checks:[],errors:[],externalRequests:[],mainRequests:[]};
let application,page;
const check=async(title,run)=>{await run();report.checks.push(title);console.log(`PASS ${title}`);};
const status=async(fragment)=>page.waitForFunction(fragment=>document.querySelector('#app-status').textContent.includes(fragment),fragment,{timeout:30000});
const open=async(filename)=>application.evaluate(({dialog},filename)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[filename]});},filename);
const save=async(filename)=>application.evaluate(({dialog},filename)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:filename});},filename);
async function capture(filename){
  await application.evaluate(async({BrowserWindow})=>{await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const png=await application.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));
  await writeFile(filename,Buffer.from(png,'base64'));
}
try{
  const args=[...(process.env.PROVIEW_EXE?[]:[root]),'--proview-verify-hidden','--force-renderer-accessibility',`--force-device-scale-factor=${process.env.PROVIEW_SCALE??1}`,`--user-data-dir=${path.join(work,'profile')}`];
  application=await electron.launch({executablePath:executable,args,env,timeout:30000});
  page=await application.firstWindow();page.on('dialog',dialog=>{if(dialog.type()!=='beforeunload')void dialog.accept().catch(e=>{if(!/No dialog|closed/i.test(e.message))report.errors.push(e.message);});});page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))report.externalRequests.push(r.url());});
  await application.evaluate(({session})=>{
    global.proviewMainRequests=[];
    global.fetch=async url=>{global.proviewMainRequests.push(String(url));throw new Error('Verification: network is offline');};
    session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_details,callback)=>callback({cancel:true}));
  });
  await check('Standalone window loads bundled 1BRS offline',async()=>{await page.locator('#atom-count').filter({hasText:'5,153'}).waitFor();await status('loaded locally');assert.equal(await page.title(),'ProView');report.appVersion=await application.evaluate(({app})=>app.getVersion());assert.equal(report.appVersion,'1.0.0');});
  await check('Skip link retains trusted local IPC and unsafe resources/navigation are refused',async()=>{
    await page.locator('.skip-link').focus();await page.locator('.skip-link').click();assert.equal((await page.evaluate(()=>window.proview.cancel('absent'))).ok,true);
    const resources=await application.evaluate(async({net})=>Promise.all(['proview://app/not-allowed','proview://app/../main.cjs'].map(async url=>(await net.fetch(url)).status)));assert.deepEqual(resources,[404,404]);
    await page.evaluate(()=>window.open('https://example.com'));assert.equal((await application.windows()).length,1);
  });
  await check('Residue selection is linked to the identity inspector',async()=>{await page.locator('#sequence button').nth(5).click();assert.equal(await page.locator('#residue-details').isVisible(),true);assert.equal(await page.locator('#sequence button[aria-pressed=true]').count(),1);});
  await check('Annotation add, edit, empty-label recovery and remove',async()=>{
    await page.locator('#annotation-label').fill('');await page.locator('#annotate').click();await status('Enter an annotation label');
    await page.locator('#annotation-label').fill('Candidate site é');await page.locator('#annotate').click();assert.match(await page.locator('#annotation-status').innerText(),/Coordinates unchanged/);
    await page.locator('#annotation-label').fill('Reviewed candidate');await page.locator('#annotate').click();assert.match(await page.locator('#annotation-status').innerText(),/Reviewed candidate/);
    await page.locator('#remove-annotation').click();assert.match(await page.locator('#annotation-status').innerText(),/No annotation/);await page.locator('#annotate').click();
  });
  await check('Scientific geometry reaches the interface through the real worker',async()=>{
    await page.locator('#analyze').click();await page.locator('#analysis-result').waitFor({state:'visible'});
    report.geometry={minimumDistance:Number(await page.locator('#minimum-distance').innerText()),contacts:Number(await page.locator('#contact-count').innerText()),residuePairs:Number(await page.locator('#residue-contact-count').innerText()),overlaps:Number(await page.locator('#clash-count').innerText())};
    assert.deepEqual(report.geometry,{minimumDistance:2.497,contacts:165,residuePairs:36,overlaps:1});
  });
  await check('Closest-pair visualization, fit and three representations',async()=>{
    await page.locator('#show-closest').click();await page.locator('#fit').click();
    for(const style of ['sticks','sphere','trace']){await page.locator('#'+style).click();assert.equal(await page.locator('#'+style).getAttribute('aria-pressed'),'true');}
  });
  await check('Clipping, reduced motion and keyboard view controls',async()=>{
    await page.locator('#clip').fill('65');await page.locator('#clip').dispatchEvent('input');assert.equal(await page.locator('#clip-value').innerText(),'65 Å');
    await page.locator('#viewer').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('+');await page.keyboard.press('f');assert.equal(await page.locator('#motion').isChecked(),true);
    await page.locator('#sequence button').nth(5).focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#sequence button').nth(6).evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Enter');
    assert.equal(await page.locator('#sequence button[tabindex="0"]').count(),1);await page.keyboard.press('End');assert.equal(await page.locator('#sequence button').last().evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Home');assert.equal(await page.locator('#sequence button').first().evaluate(e=>e===document.activeElement),true);
  });
  await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1600,1000));
  await page.locator('#sequence button').nth(5).click();await page.locator('#viewer').focus();await page.keyboard.press('+');await page.keyboard.press('+');
  await page.evaluate(()=>{document.querySelector('.rail').scrollTop=0;document.querySelector('.inspector').scrollTop=0;});
  await capture(path.join(evidence,`${name}-interface.png`));
  if(name==='source')await copyFile(path.join(evidence,`${name}-interface.png`),path.join(screens,'interface.png'));
  await check('Automated WCAG 2.1 A/AA audit of main workspace',async()=>{
    const a11y=await new AxeBuilder({page}).setLegacyMode().withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    report.accessibility={engine:a11y.testEngine,violations:a11y.violations,incomplete:a11y.incomplete.map(x=>({id:x.id,impact:x.impact,nodes:x.nodes.map(n=>n.target)}))};
    assert.equal(a11y.violations.length,0,JSON.stringify(a11y.violations.map(x=>({id:x.id,targets:x.nodes.map(n=>n.target)}))));
  });
  const projectFile=path.join(work,'portable é.proview'),geometryFile=path.join(work,'geometry é.json'),pngFile=path.join(work,'export é.png'),alignmentFile=path.join(work,'alignment é.json');
  await check('Geometry JSON export contains real units, source hash and counts',async()=>{await save(geometryFile);await page.locator('#export-geometry').click();await status('Exported geometry');const out=JSON.parse(await readFile(geometryFile,'utf8'));assert.equal(out.coordinateUnit,'angstrom');assert.equal(out.result.summary.contactCount,165);assert.equal(out.source.sha256,out.result.provenance.sourceSha256);});
  await check('Mobile coordinates import through native-file IPC',async()=>{await page.locator('#comparison-panel summary').click();await open(path.join(root,'fixtures/synthetic/barnase-comparison.pdb'));await page.locator('#import-comparison').click();await status('Loaded mobile structure');});
  await check('Different numbering requires explicit review; duplicate and missing pairs reject',async()=>{
    await page.locator('#prepare-mapping').click();assert.equal(await page.locator('#align').isDisabled(),true);
    await page.locator('#mapping-editor').fill('3 103\n3 103\n4 104');await page.locator('#validate-mapping').click();await status('one-to-one');
    await page.locator('#mapping-editor').fill('3 103\n4 104\n999 1099');await page.locator('#validate-mapping').click();await status('missing or inactive');
    const pdb=await readFile(path.join(root,'fixtures/structures/1BRS.pdb'),'utf8');const nums=[...new Set(pdb.split(/\r?\n/).filter(l=>l.startsWith('ATOM')&&l[21]==='A'&&l.slice(12,16).trim()==='CA').map(l=>Number(l.slice(22,26))))];
    await page.locator('#mapping-editor').fill(nums.map(n=>`${n} ${n+100}`).join('\n'));await page.locator('#validate-mapping').click();assert.match(await page.locator('#mapping-summary').innerText(),/108 one-to-one Cα pairs/);assert.equal(await page.locator('#align').isDisabled(),true);
  });
  await check('Reviewed alignment computes nonzero fitted displacement and an overlay',async()=>{
    await page.locator('#mapping-confirm').check();await page.locator('#align').click();await page.waitForFunction(()=>document.querySelector('#alignment-output').textContent.includes('Proper rigid fit'));
    assert.match(await page.locator('#alignment-output').innerText(),/108 Cα atoms/);assert.doesNotMatch(await page.locator('#alignment-output').innerText(),/RMSD 0\.0000/);
    await page.locator('#show-overlay').uncheck();await page.locator('#show-overlay').check();
    await save(alignmentFile);await page.locator('#export-alignment').click();await status('Exported alignment');const out=JSON.parse(await readFile(alignmentFile,'utf8'));assert.equal(out.result.matchedAtomCount,108);assert.ok(out.result.rmsdAngstrom>0);report.alignment={rmsdAngstrom:out.result.rmsdAngstrom,matched:108,residues:out.result.residueDisplacements.length};
  });
  await page.locator('#viewer').scrollIntoViewIfNeeded();await capture(path.join(evidence,`${name}-alignment.png`));
  if(name==='source')await copyFile(path.join(evidence,`${name}-alignment.png`),path.join(screens,'alignment.png'));
  await check('Automated WCAG audit of expanded comparison controls',async()=>{const r=await new AxeBuilder({page}).setLegacyMode().withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();report.comparisonAccessibility=r.violations;assert.deepEqual(r.violations,[]);});
  await check('Captioned PNG export has a real viewport and readable caption region',async()=>{
    await save(pngFile);await page.locator('#export-png').click();await status('Exported captioned PNG');const bytes=await readFile(pngFile);assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert.ok(bytes.readUInt32BE(16)>=1100&&bytes.readUInt32BE(20)>=256);report.png={width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),sha256:createHash('sha256').update(bytes).digest('hex')};
    if(name==='source')await copyFile(pngFile,path.join(screens,'export.png'));
  });
  let saved;
  await check('Project save embeds two sources, annotation, geometry and alignment',async()=>{await save(projectFile);await page.locator('#save-project').click();await status('Saved portable project');saved=JSON.parse(await readFile(projectFile,'utf8'));assert.equal(saved.schemaVersion,'2.0.0');assert.equal(saved.inputs.length,2);assert.equal(saved.annotations.length,1);assert.equal(saved.analyses.length,1);assert.equal(saved.comparison.result.matchedAtomCount,108);assert.equal(saved.view.slab.far,65);assert.equal(saved.view.camera.length,8);});
  await check('Second save replaces an existing file safely',async()=>{await page.locator('#save-project').click();await status('Saved portable project');assert.equal(JSON.parse(await readFile(projectFile,'utf8')).id,saved.id);assert.equal((await readdir(work)).some(n=>n.endsWith('.tmp')),false);});
  await check('Save failure preserves loaded project and recovers on next save',async()=>{
    await save(path.join(work,'missing-folder','bad.proview'));await page.locator('#save-project').click();await status('INVALID_INPUT');assert.equal(await page.locator('#structure-title').innerText(),'1BRS');
    await save(projectFile);await page.locator('#save-project').click();await status('Saved portable project');
  });
  await check('Small example loads offline; single-chain interface is disabled',async()=>{await page.locator('#example').selectOption('1CRN');await page.locator('#atom-count').filter({hasText:'327'}).waitFor();assert.equal(await page.locator('#analyze').isDisabled(),true);});
  await check('Project reopen restores comparison, annotation, geometry, clipping and camera',async()=>{
    await open(projectFile);await page.locator('#open-project').click();await status('Project reopened offline');assert.equal(await page.locator('#structure-title').innerText(),'1BRS');assert.equal(await page.locator('#analysis-result').isVisible(),true);assert.match(await page.locator('#alignment-output').innerText(),/108 Cα atoms/);assert.equal(await page.locator('#clip-value').innerText(),'65 Å');
    await save(path.join(work,'reopened.proview'));await page.locator('#save-project').click();await status('Saved portable project');const reopened=JSON.parse(await readFile(path.join(work,'reopened.proview'),'utf8'));assert.deepEqual(reopened.comparison.result,saved.comparison.result);assert.deepEqual(reopened.annotations,saved.annotations);assert.deepEqual(reopened.view.camera,saved.view.camera);
  });
  await check('Tampered project is rejected without replacing the current workspace',async()=>{
    const file=path.join(work,'tampered.proview');await writeFile(file,JSON.stringify({...saved,comparison:{...saved.comparison,result:{...saved.comparison.result,rmsdAngstrom:8}}}));await open(file);await page.locator('#open-project').click();await status('Derived alignment disagrees');assert.equal(await page.locator('#structure-title').innerText(),'1BRS');
  });
  await check('Cancelled file dialogs leave the loaded workspace intact',async()=>{await application.evaluate(({dialog})=>{dialog.showOpenDialog=async()=>({canceled:true,filePaths:[]});dialog.showSaveDialog=async()=>({canceled:true});});await page.locator('#import').click();await page.waitForFunction(()=>!document.querySelector('#import').disabled);assert.equal(await page.locator('#structure-title').innerText(),'1BRS');await page.locator('#save-project').click();await page.waitForFunction(()=>!document.querySelector('#save-project').disabled);});
  await check('Local mmCIF imports with conservative source evidence',async()=>{await open(path.join(root,'fixtures/structures/1CRN.cif'));await page.locator('#import').click();await status('1CRN.cif loaded');assert.equal(await page.locator('#atom-count').innerText(),'327');assert.equal(await page.locator('#evidence-badge').innerText(),'Supplied coordinates');});
  await check('UTF-8 BOM source imports with exact embedded bytes and source hash',async()=>{
    const source='\uFEFF'+await readFile(path.join(root,'fixtures/structures/1CRN.pdb'),'utf8'),f=path.join(work,'BOM é.pdb'),project=path.join(work,'BOM é.proview');await writeFile(f,source,'utf8');await open(f);await page.locator('#import').click();await status('BOM é.pdb loaded');await save(project);await page.locator('#save-project').click();await status('Saved portable project');const savedBom=JSON.parse(await readFile(project,'utf8'));assert.equal(savedBom.inputs[0].text,source);assert.equal(savedBom.inputs[0].sourceSha256,createHash('sha256').update(Buffer.from(source,'utf8')).digest('hex'));
    await open(path.join(root,'fixtures/structures/1CRN.cif'));await page.locator('#import').click();await status('1CRN.cif loaded');
  });
  await check('Missing and malformed coordinate inputs preserve the current structure',async()=>{
    for(const filename of ['missing.pdb','malformed.pdb']){const f=path.join(work,filename);if(filename==='malformed.pdb')await writeFile(f,'ATOM invalid');await open(f);await page.locator('#import').click();await status('INVALID_INPUT');assert.equal(await page.locator('#structure-title').innerText(),'1CRN.cif');}
  });
  await check('Invalid UTF-8 source bytes reject without coordinate replacement',async()=>{const f=path.join(work,'invalid-encoding.pdb');await writeFile(f,Buffer.from([65,84,79,77,32,255]));await open(f);await page.locator('#import').click();await status('not valid UTF-8');assert.equal(await page.locator('#structure-title').innerText(),'1CRN.cif');});
  await check('5 MiB desktop limit rejects oversize without changing the workspace',async()=>{const f=path.join(work,'oversize.pdb');await writeFile(f,' '.repeat(5*1024*1024+1));await open(f);await page.locator('#import').click();await status('RESOURCE_LIMIT');assert.equal(await page.locator('#structure-title').innerText(),'1CRN.cif');});
  await check('25,000-atom desktop limit rejects a larger valid PDB and recovers',async()=>{
    const f=path.join(work,'too-many-atoms.pdb');const rows=Array.from({length:25001},(_,i)=>`ATOM  ${String(i+1).padStart(5)} ${[' N  ',' CA ',' O  '][i%3]} ALA A${String(Math.floor(i/3)+1).padStart(4)}    ${((i%200)*10).toFixed(3).padStart(8)}${(Math.floor(i/200)*10).toFixed(3).padStart(8)}${'0.000'.padStart(8)}  1.00 20.00           ${['N','C','O'][i%3]}  `);
    await writeFile(f,rows.join('\n')+'\nEND\n');await open(f);await page.locator('#import').click();await status('25,000');assert.equal(await page.locator('#structure-title').innerText(),'1CRN.cif');
  });
  await check('Insertion code and occupancy-selected conformer reach the inspector',async()=>{await open(path.join(root,'fixtures/synthetic/insertion-alternates.pdb'));await page.locator('#import').click();await status('insertion-alternates.pdb loaded');await page.getByRole('button',{name:/ALA 10A/}).click();assert.equal(await page.locator('#residue-alt').innerText(),'B');});
  await check('Malformed IPC, oversized mapping and stale requests reject',async()=>{
    const r=await page.evaluate(async()=>{
      const b=window.proview;return [await b.analyze(null),await b.align({schemaVersion:'1.0.0',jobId:'too_many',kind:'rigid-alignment',referenceStructureId:'a',mobileStructureId:'b',method:'kabsch-no-reflection',atomPolicy:'explicit-correspondence-only',atomCorrespondence:Array.from({length:25001},()=>({referenceAtomKey:'a',mobileAtomKey:'b'}))}),await b.exportPng('not a PNG'),await b.saveProject({}),await b.retrieveAccession('../x')].map(x=>x.ok);
    });assert.deepEqual(r,[false,false,false,false,false]);
  });
  await check('Offline retrieval gives a recoverable error and keeps local inputs usable',async()=>{await page.locator('#accession').fill('1CRN');await page.locator('#retrieve').click();await status('OFFLINE');assert.equal(await page.locator('#structure-title').innerText(),'insertion-alternates.pdb');});
  await check('Cancellation emits one terminal state and next job succeeds',async()=>{
    report.cancellation=await page.evaluate(async()=>{
      const b=window.proview;const s=(await b.loadExample('1BRS')).value;const request={schemaVersion:'1.0.0',jobId:'cancel_release',kind:'interface-geometry',structureId:s.id,modelId:s.selectedModelId,partnerAChainKeys:[s.chains.find(c=>c.authAsymId==='A').key],partnerBChainKeys:[s.chains.find(c=>c.authAsymId==='D').key],contactCutoffAngstrom:4,clashOverlapThresholdAngstrom:.4};
      const events=[];let cancellation;const off=b.onJob(e=>{if(e.jobId===request.jobId){events.push(e.status);if(e.status==='running')cancellation=b.cancel(e.jobId);}});const out=await b.analyze(request);if(cancellation)await cancellation;off();const next=await b.analyze({...request,jobId:'next_release'});return {code:out.error?.code,events,nextContacts:next.value?.summary.contactCount};
    });assert.equal(report.cancellation.code,'CANCELLED');assert.deepEqual(report.cancellation.events,['queued','running','cancelled']);assert.equal(report.cancellation.nextContacts,165);
  });
  await check('Renderer isolation and offline local help are intact',async()=>{
    const r=await page.evaluate(()=>({node:typeof window.require,bridge:Object.keys(window.proview)}));assert.equal(r.node,'undefined');assert.equal(r.bridge.includes('openHelp'),true);
    await application.evaluate(({shell})=>{shell.openPath=async filename=>{global.proviewHelpPath=filename;return '';};});await page.locator('#help').click();await status('Opened local ProView user guide');report.help=await application.evaluate(()=>global.proviewHelpPath);assert.match(report.help,/USER_GUIDE.html$/);assert.match(await readFile(report.help,'utf8'),/ProView user guide/);
  });
  await check('960×720, 1280×800 and 1600×1000 layouts remain accessible without page-width overflow',async()=>{
    report.layouts=[];for(const [width,height] of [[960,720],[1280,800],[1600,1000]]){await application.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setSize(...size),[width,height]);await page.waitForTimeout(100);const layout=await page.evaluate(()=>({width:innerWidth,height:innerHeight,devicePixelRatio,overflow:document.documentElement.scrollWidth>innerWidth}));assert.equal(layout.overflow,false);report.layouts.push({outer:[width,height],...layout});await capture(path.join(evidence,`${name}-${width}.png`));}
    await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(2));await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await capture(path.join(evidence,`${name}-zoom200.png`));await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1));
  });
  await check('Native close confirmation preserves unsaved work when cancelled',async()=>{
    await page.locator('#sphere').click();await application.evaluate(({dialog,BrowserWindow})=>{global.closeCalls=[];dialog.showMessageBoxSync=(_window,options)=>{global.closeCalls.push(options);return 0;};BrowserWindow.getAllWindows()[0].close();});await page.waitForTimeout(200);const prompt=await application.evaluate(()=>global.closeCalls[0]);assert.match(prompt.message,/unsaved changes/);assert.equal((await application.windows()).length,1);
  });
  await check('External navigation is blocked by the native window',async()=>{await page.evaluate(()=>{location.href='https://example.com';});await page.waitForTimeout(100);assert.match(await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.getURL()),/^proview:\/\/app\/index.html/);});
  await check('No renderer errors or background network activity',async()=>{report.mainRequests=await application.evaluate(()=>global.proviewMainRequests);assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);assert.deepEqual(report.mainRequests,['https://files.rcsb.org/download/1CRN.cif']);});
  report.runtime=await application.evaluate(({app})=>({versions:process.versions,metrics:app.getAppMetrics()}));
  await check('Discard changes closes the native window and application normally',async()=>{const exited=application.waitForEvent('close',{timeout:10000});await application.evaluate(({dialog,BrowserWindow})=>{dialog.showMessageBoxSync=()=>1;BrowserWindow.getAllWindows()[0].close();}).catch(e=>{if(!/closed|exited/i.test(e.message))throw e;});await exited;});report.status='passed';
}catch(error){report.status='failed';report.failure=String(error.stack??error);console.error(error);if(page){report.lastStatus=await page.locator('#app-status').innerText().catch(()=>null);await capture(path.join(evidence,`${name}-failure.png`)).catch(()=>{});}process.exitCode=1;}
finally{if(application){await application.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows())w.destroy();}).catch(()=>{});await application.close().catch(()=>{});}report.finishedAt=new Date().toISOString();await writeFile(path.join(evidence,`${name}-release.json`),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,checks:report.checks.length,failure:report.failure}));}
