import {electronExecutable,systemPath,softwareGraphicsArgs,computeName,resourcesForExecutable} from './native-environment.mjs';
import {_electron as electron} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'work/integrated-chemistry');await mkdir(out,{recursive:true});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
if(process.env.PROTEONATOR_EXE){env.PATH=systemPath;delete env.PROTEONATOR_PYTHON;delete env.PYTHONPATH;delete env.PYTHONHOME;}
const app=await electron.launch({chromiumSandbox:true,executablePath:process.env.PROTEONATOR_EXE??electronExecutable,args:[...softwareGraphicsArgs,...(process.env.PROTEONATOR_EXE?[]:[root]),'--proview-verify-hidden','--force-renderer-accessibility','--user-data-dir='+path.join(out,'profile-'+Date.now())],env});
const report={status:'running',checks:[],errors:[],packaged:!!process.env.PROTEONATOR_EXE};let page;
const sha=text=>createHash('sha256').update(text).digest('hex');
const idle=()=>page.waitForFunction(()=>!document.querySelector('[aria-busy=true]'),{},{timeout:180000});
const cmd=async id=>{await page.locator('[data-command='+id+']:visible').first().click();await idle();};
const check=async(name,fn)=>{await fn();report.checks.push(name);console.log('PASS',name);};
const saveAt=async file=>app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},file);
const openAt=async file=>app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},file);
const save=async name=>{const file=path.join(out,name+'.proteonator');await saveAt(file);await cmd('save');return JSON.parse(await readFile(file,'utf8'));};
try{
 page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(e.stack));page.on('dialog',d=>d.accept());
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Proteonator is ready'),{},{timeout:60000});
 await page.locator('#example').selectOption('1CRN');await idle();
 await check('Reviewed sequence correspondence constructs only the retained substitution',async()=>{
  await page.locator('[data-workspace=sequence]').click();await page.locator('#seq-input').fill('>Reviewed crambin S11A hypothesis\nTTCCPSIVARANFNVCRLPGTPEAICATYTGCIIIPGATCPGDYAN');await page.locator('#seq-import-text').click();await idle();
  await page.locator('[data-sequence-tab=construct]').click();await page.locator('#seq-map-propose').click();await idle();
  const mismatches=page.locator('#seq-map-review tbody tr').filter({hasText:'Mismatch'});assert.equal(await mismatches.count(),1);await mismatches.locator('input').check();
  await page.locator('#seq-map-confirm').check();await page.locator('#seq-map-accept').click();await idle();
  await page.locator('#seq-map-mutate').click();await idle();const p=await save('mapped-mutation');assert.equal(p.sequence.mappings[0].reviewed,true);assert.deepEqual(p.scenarios.at(-1).edits,[{residue:'A/11',modification:'mutation:ALA'}]);assert.match(p.scenarios.at(-1).result.text,/ALA/);assert.equal(p.source.sha256,sha(await readFile(path.join(root,'fixtures/structures/1CRN.pdb'),'utf8')));
 });
 await check('Sequence-bound domains retain coordinates and reject a mismatched source',async()=>{
  await page.locator('[data-workspace=sequence]').click();await page.locator('[data-sequence-tab=features]').click();const p=await save('before-features'),r=p.sequence.records[0],f={format:'proteonator-sequence-features',recordId:r.id,sequenceSha256:sha(r.sequence),features:[{type:'domain',name:'Reviewed synthetic region',start:2,end:9,strand:1,source:'Test fixture, not a biological domain assignment',evidence:'Supplied reference coordinates'}]};const file=path.join(out,'features.json');await writeFile(file,JSON.stringify(f));await openAt(file);await page.locator('#feature-import').click();await idle();assert.match(await page.locator('#sequence-feature-list').innerText(),/Reviewed synthetic region/);const good=await save('features');assert.equal(good.sequence.records[0].features.at(-1).start,2);await writeFile(file,JSON.stringify({...f,sequenceSha256:'0'.repeat(64)}));await page.locator('#feature-import').click();await idle();assert.match(await page.locator('#status').innerText(),/hash.*changed/i);assert.equal((await save('features-after-reject')).sequence.records[0].features.length,good.sequence.records[0].features.length);
 });
 await check('Confidence profiles bind exact coordinates and become stale after chemistry changes',async()=>{
  await page.locator('[data-workspace=molecule]').click();const p=await save('before-confidence'),scenario=p.scenarios.find(s=>s.id===p.scene.activeId),evidence={format:'proteonator-residue-evidence',version:'1',coordinateSha256:scenario.result.hash,sourceSha256:p.source.sha256,model:p.scene.model,assembly:p.scene.assembly,metric:'pLDDT',source:'Synthetic validation fixture; not predicted confidence',method:'Known test values',units:'0-100',values:[{residue:'A/11',value:80,note:'Fixture'}]};const file=path.join(out,'confidence.json');await writeFile(file,JSON.stringify(evidence));await cmd('residue-evidence');await openAt(file);await page.locator('#evidence-import').click();await idle();assert.match(await page.locator('#evidence-workbench').innerText(),/matches current state/);const a=await new AxeBuilder({page}).setLegacyMode().withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(a.violations.map(v=>v.id),[]);await page.getByRole('button',{name:'Close',exact:true}).click();await cmd('undo');await cmd('residue-evidence');assert.match(await page.locator('#evidence-workbench').innerText(),/stale coordinate state/);assert.equal(await page.locator('#evidence-workbench table button').first().isDisabled(),true);await page.getByRole('button',{name:'Close',exact:true}).click();
 });
 await check('Molecular terminal amide persists its actual C–N bond and chemistry on reopen',async()=>{
  await page.locator('#residue-search').fill('A/46');await page.locator('#sequence button').first().click();await page.locator('[data-tab=ptm]').click();await page.locator('#tab-ptm details').first().locator('summary').click();await cmd('construct-terminal-amide');const p=await save('amide');const scenario=p.scenarios.find(s=>s.id===p.scene.activeId);assert.deepEqual(scenario.edits,[{residue:'A/46',modification:'terminal-amide'}]);assert.match(scenario.result.text,/NT/);assert.equal(p.scene.calculationSettings.forcefield,'charmm36.xml');await page.locator('#ph').fill('6.5');await page.locator('#ph').blur();await save('amide');await openAt(path.join(out,'amide.proteonator'));await cmd('open-project');assert.match(await page.locator('#status').innerText(),/Project reopened/);assert.equal(await page.locator('#evidence').innerText(),'Constructed chemistry');assert.equal(await page.locator('#forcefield').inputValue(),'charmm36.xml');assert.equal(await page.locator('#ph').inputValue(),'6.5');
 });
 await check('Hydroxyproline is a distinct constructed scenario with a retained source',async()=>{
  await page.locator('#forcefield').selectOption('charmm36_2024.xml');await page.locator('#residue-search').fill('PRO');await page.locator('#sequence button').first().click();assert.equal(await page.locator('#modification').inputValue(),'hydroxyproline');await cmd('apply-ptm');assert.equal(await page.locator('#forcefield').inputValue(),'charmm36.xml');const p=await save('hydroxyproline');assert.equal(p.scenarios.find(s=>s.id===p.scene.activeId).edits.some(e=>e.modification==='hydroxyproline'),true);assert.equal(p.source.name,'1CRN.pdb');await openAt(path.join(out,'hydroxyproline.proteonator'));await cmd('open-project');assert.match(await page.locator('#status').innerText(),/Project reopened/);
 });
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=String(e.stack);console.error(e);process.exitCode=1;if(page)report.lastStatus=await page.locator('#status').innerText();}
finally{await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy())).catch(()=>{});await app.close().catch(()=>{});await writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,checks:report.checks.length,lastStatus:report.lastStatus}));}
