import {app,BrowserWindow,dialog,ipcMain,Menu} from 'electron';
import {spawn,ChildProcess} from 'node:child_process';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {z} from 'zod';
import {atomicWrite} from './files';
const Source=z.object({name:z.string().max(512),text:z.string().max(32*1024*1024),format:z.enum(['pdb','mmcif']),sha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
const Edit=z.object({residue:z.string().max(128),modification:z.enum(['phosphoserine','phosphothreonine','phosphotyrosine','acetyllysine','monomethyllysine','dimethyllysine','trimethyllysine'])}).strict();
const Scenario=z.object({id:z.string().max(128),title:z.string().max(256),edits:z.array(Edit).max(32),result:z.object({text:z.string().max(64*1024*1024),format:z.literal('mmcif'),stage:z.enum(['constructed','locally-relaxed']),hash:z.string().regex(/^[a-f0-9]{64}$/),provenance:z.unknown().optional()}).nullable()}).strict();
const Project=z.object({format:z.literal('proteonator-project'),schemaVersion:z.literal('3.0.0'),source:Source,mobile:Source.nullable(),scenarios:z.array(Scenario).max(24),scene:z.record(z.string(),z.unknown()),context:z.unknown().nullable(),maps:z.array(z.object({name:z.string().max(512),format:z.enum(['cube','ccp4']),data:z.string().max(180*1024*1024),sha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict()).max(2).default([]),savedAt:z.iso.datetime()}).strict();
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
function validateProject(p:z.infer<typeof Project>){
 if(hash(p.source.text)!==p.source.sha256||p.mobile&&hash(p.mobile.text)!==p.mobile.sha256)throw new Error('Project source hash mismatch.');
 if(new Set(p.scenarios.map(s=>s.id)).size!==p.scenarios.length)throw new Error('Duplicate scenario identities.');
 const scene=p.scene;z.object({assembly:z.string().max(128).optional(),model:z.int().min(0).max(99999).optional(),mobileModel:z.int().min(0).max(99999).optional(),activeId:z.string().max(128).optional(),notes:z.array(z.object({residue:z.string().max(128).nullable(),text:z.string().max(3000)}).passthrough()).max(10000).optional(),savedSelections:z.array(z.object({name:z.string().max(128),residues:z.array(z.string().max(128)).max(100000)}).strict()).max(200).optional(),measurementRecords:z.array(z.array(z.string().max(256)).min(2).max(4)).max(100).optional(),alignmentPairs:z.array(z.array(z.string().max(256)).length(2)).max(25000).optional()}).passthrough().parse(scene);
 const representation=z.enum(['cartoon','backbone','ball-and-stick','line','spacefill','molecular-surface','carbohydrate']);
 z.object({representation:representation.optional(),coloring:z.enum(['chain-id','element-symbol','secondary-structure','hydrophobicity','uncertainty']).optional(),selectedResidue:z.string().max(128).optional(),labelResidues:z.array(z.string().max(128)).max(12).optional(),selectionResidues:z.array(z.string().max(128)).max(100000).optional(),clip:z.number().min(0).max(100).optional(),compareView:z.boolean().optional(),overlay:z.boolean().optional(),preparedControl:z.boolean().optional(),alignmentReviewed:z.boolean().optional(),displayState:z.record(z.string().max(512),z.object({hidden:z.boolean().optional(),type:representation.optional(),alpha:z.number().min(.1).max(1).optional()}).strict()).optional(),settings:z.object({theme:z.enum(['midnight','glass','pixel']).optional(),quality:z.enum(['auto','low','high']).optional(),leftWidth:z.number().min(175).max(330).optional(),rightWidth:z.number().min(260).max(440).optional(),opacity:z.number().min(10).max(100).optional(),lighting:z.enum(['standard','flat','soft']).optional(),hiddenTools:z.array(z.string().max(64)).max(64).optional(),shortcuts:z.record(z.string().max(64),z.string().max(64)).optional()}).passthrough().optional()}).passthrough().parse(scene);
 if(scene.activeId&&scene.activeId!=='source'&&!p.scenarios.some(s=>s.id===scene.activeId))throw new Error('Active scenario is missing.');
 for(const s of p.scenarios){if(new Set(s.edits.map(e=>e.residue)).size!==s.edits.length)throw new Error('Conflicting edits at one residue.');if(s.result){if(hash(s.result.text)!==s.result.hash)throw new Error('Scenario hash mismatch.');const provenance=s.result.provenance as any;if(provenance?.constructedState&&hash(provenance.constructedState.text)!==provenance.constructedState.sha256)throw new Error('Constructed-state hash mismatch.');if(s.result.stage==='locally-relaxed'&&(!provenance?.inputSha256||provenance.constructedState?.sha256!==provenance.inputSha256))throw new Error('Relaxation input provenance mismatch.');}}
 for(const map of p.maps){if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(map.data)||createHash('sha256').update(Buffer.from(map.data,'base64')).digest('hex')!==map.sha256)throw new Error('Density map hash mismatch.');}
 return p;
}
const running=new Map<string,ChildProcess>();
const cancelled=new Set<string>();
const root=()=>path.resolve(__dirname,'..');
async function compute(req:any){
 if(!['inspect','construct','compare','measure','relax','align','sequence-pairs'].includes(req.operation))throw new Error('Unsupported molecular operation.');
 if(JSON.stringify(req).length>180*1024*1024)throw new Error('Molecular request is too large.');
 if(req.operation==='construct')z.array(Edit).max(32).parse(req.edits);
 const id=typeof req.jobId==='string'?req.jobId:crypto.randomUUID();
 if(running.size>=2)throw new Error('Two local calculations are already running. Cancel or wait.');
 const cmd=app.isPackaged?path.join(process.resourcesPath,'compute','ProteonatorCompute.exe'):(process.env.PROTEONATOR_PYTHON??'python');
 return new Promise<any>((resolve,reject)=>{
  const child=spawn(cmd,app.isPackaged?[]:[path.join(root(),'compute/molecule.py')],{windowsHide:true,env:{...process.env,...(!app.isPackaged?{PYTHONPATH:path.join(root(),'compute-libs')}:{} )},stdio:['pipe','pipe','pipe']});running.set(id,child);
  let stdout='',stderr='',settled=false;const timeout=setTimeout(()=>{child.kill();finish(new Error('Molecular calculation exceeded its 300-second deadline.'));},300000);
  function finish(error:Error|null,value?:unknown){if(settled)return;settled=true;clearTimeout(timeout);running.delete(id);if(error)reject(error);else resolve(value);}
  child.stdout!.on('data',b=>{stdout+=b;if(stdout.length>200*1024*1024){child.kill();finish(new Error('Molecular output exceeded its limit.'));}});child.stderr!.on('data',b=>{stderr=(stderr+b).slice(-6000);});
  child.on('error',e=>finish(e));child.on('close',code=>{if(settled)return;if(cancelled.delete(id)){finish(new Error('Calculation cancelled. The previous molecular state was retained.'));return;}let reply;try{reply=JSON.parse(stdout);}catch{finish(new Error(stderr||'The molecular service did not return a result.'));return;}if(code!==0||!reply.ok)finish(new Error(reply.error??stderr??'Calculation failed.'));else finish(null,reply.value);});
  child.stdin!.on('error',e=>finish(e));child.stdin!.end(JSON.stringify(req));
 });
}
async function sourceFile(filename:string){
 if((await stat(filename)).size>32*1024*1024)throw new Error('Input exceeds 32 MiB.');
 const bytes=await readFile(filename);const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);return {name:path.basename(filename),text,format:['.cif','.mmcif'].includes(path.extname(filename).toLowerCase())?'mmcif':'pdb',sha256:hash(text)};
}
async function jsonFetch(url:string,limit=12*1024*1024){
 const response=await fetch(url,{signal:AbortSignal.timeout(15000),redirect:'error',headers:{Accept:'application/json'}});if(!response.ok)throw new Error(`Reference service returned HTTP ${response.status}.`);let size=0;const chunks=[];for await(const b of response.body!){size+=b.length;if(size>limit)throw new Error('Reference response is too large.');chunks.push(b);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export function registerStudio(win:()=>BrowserWindow|null){
 ipcMain.handle('proteonator:studio',async(event,raw)=>{
  const w=win();const url=new URL(event.senderFrame?.url??'about:blank');if(!w||event.sender.id!==w.webContents.id||event.senderFrame!==w.webContents.mainFrame||url.protocol!=='proteonator:'||url.hostname!=='app'||url.pathname!=='/index.html')return {ok:false,error:'Untrusted application request.'};
  try{
   const req=z.object({action:z.string(),data:z.unknown().optional()}).strict().parse(raw);const d:any=req.data;let value:any;
   if(req.action==='shortcuts'){const shortcuts=z.record(z.string(),z.string().regex(/^(CmdOrCtrl|Ctrl|Alt|Shift)(\+(CmdOrCtrl|Ctrl|Alt|Shift))*\+[A-Za-z0-9,]$/)).parse(d);studioMenu(w,shortcuts);value=true;}
   else if(req.action==='compute')value=await compute(d);
   else if(req.action==='cancel'){const p=running.get(String(d));if(p){cancelled.add(String(d));p.kill();}value=!!p;}
   else if(req.action==='example'){if(!['1BRS','1CRN','1CRN.cif','1UBQ','4HHB','1BNA','1HZH'].includes(d))throw new Error('Unknown example.');const f=path.join(root(),'fixtures/structures',d==='1CRN.cif'?d:d+'.pdb');value=await sourceFile(app.isPackaged?path.join(process.resourcesPath,'examples',path.basename(f)):f);}
   else if(req.action==='open-source'){const r=await dialog.showOpenDialog(w,{properties:['openFile'],filters:[{name:'Coordinates',extensions:['pdb','ent','cif','mmcif']}]});value=r.canceled?null:await sourceFile(r.filePaths[0]);}
   else if(req.action==='retrieve'){
    const accession=z.string().regex(/^[A-Za-z0-9]{4}$/).parse(d).toUpperCase();const r=await fetch(`https://files.rcsb.org/download/${accession}.cif`,{signal:AbortSignal.timeout(15000),redirect:'error'});if(!r.ok)throw new Error('Coordinate retrieval failed: HTTP '+r.status);let size=0;const chunks=[];for await(const b of r.body!){size+=b.length;if(size>32*1024*1024)throw new Error('Retrieved coordinates exceed 32 MiB.');chunks.push(b);}const text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));value={name:accession+'.cif',text,format:'mmcif',sha256:hash(text)};
   }else if(req.action==='save-project'){
    const project=validateProject(Project.parse(d));
    const r=await dialog.showSaveDialog(w,{defaultPath:'Proteonator.proteonator',filters:[{name:'Proteonator project',extensions:['proteonator']}]});if(r.canceled||!r.filePath)value=null;else{const f=r.filePath.endsWith('.proteonator')?r.filePath:r.filePath+'.proteonator';const json=JSON.stringify(project);if(Buffer.byteLength(json,'utf8')>200*1024*1024)throw new Error('Project exceeds 200 MiB. Export large density maps separately.');await atomicWrite(f,json);value=f;}
   }else if(req.action==='open-project'){
    const r=await dialog.showOpenDialog(w,{properties:['openFile'],filters:[{name:'Molecular project',extensions:['proteonator','proview','ptmw']}]});if(r.canceled)value=null;else{
     if((await stat(r.filePaths[0])).size>200*1024*1024)throw new Error('Project exceeds 200 MiB.');const parsed=JSON.parse((await readFile(r.filePaths[0],'utf8')).replace(/^\uFEFF/,''));
     if(parsed.format==='proteonator-project')value=validateProject(Project.parse(parsed));
     else {
      const {parseProject}=await import('../engine/project');const p=parseProject(JSON.stringify(parsed));const s=p.structures[0];const original=p.inputs.find(i=>i.sourceSha256===s.source.sha256)!;const moving=p.comparison?.structure;const mobile=moving?p.inputs.find(i=>i.sourceSha256===moving.source.sha256):null;
      const residueId=(key:string)=>{const r=s.residues.find(r=>r.key===key);const c=s.chains.find(c=>c.key===r?.chainKey);return r&&c?c.authAsymId+'/'+r.authSeqId+r.insertionCode:null;};
      const atomId=(structure:typeof s,key:string)=>{const a=structure.atoms.find(a=>a.key===key);const r=structure.residues.find(r=>r.key===a?.residueKey);const c=structure.chains.find(c=>c.key===r?.chainKey);return a&&r&&c?c.authAsymId+'/'+r.authSeqId+r.insertionCode+'/'+a.name:null;};
      value={format:'proteonator-project',schemaVersion:'3.0.0',source:{name:original.name,text:original.text,format:original.format,sha256:hash(original.text)},mobile:mobile?{name:mobile.name,text:mobile.text,format:mobile.format,sha256:hash(mobile.text)}:null,scenarios:[],maps:[],scene:{assembly:'source',model:s.models.findIndex(m=>m.id===s.selectedModelId),mobileModel:moving?.models.findIndex(m=>m.id===moving.selectedModelId)??0,selectedResidue:p.view.selection?.residueKeys[0]?residueId(p.view.selection.residueKeys[0]):'',notes:p.annotations.map(a=>({residue:residueId(a.residueKey),text:a.label+' · '+a.ptm,evidence:a.evidence})),legacyReports:p.analyses,representation:({sticks:'ball-and-stick',sphere:'spacefill',cartoon:'cartoon'} as const)[p.view.representation],alignmentPairs:p.comparison?.mapping.map(pair=>[atomId(s,pair.referenceAtomKey),atomId(moving!,pair.mobileAtomKey)])??[],alignmentReviewed:!!p.comparison?.result,compareView:!!mobile,settings:{reducedMotion:p.view.reducedMotion}},context:null,savedAt:new Date().toISOString()};
     }
     await compute({operation:'inspect',...value.source,model:value.scene.model??0,assembly:value.scene.assembly??'source'});if(value.mobile)await compute({operation:'inspect',...value.mobile,model:value.scene.mobileModel??0,assembly:'source'});
    }
   }else if(req.action==='export'){
    const {kind,content}=z.object({kind:z.enum(['coordinates','report','image']),content:z.string().max(100*1024*1024)}).strict().parse(d);const ext=kind==='coordinates'?'cif':kind==='report'?'json':'png';const r=await dialog.showSaveDialog(w,{defaultPath:'Proteonator-export.'+ext,filters:[{name:'Export',extensions:[ext]}]});if(r.canceled||!r.filePath)value=null;else{let bytes:string|Buffer=content;if(kind==='image'){if(!content.startsWith('data:image/png;base64,'))throw new Error('Invalid image.');bytes=Buffer.from(content.slice(22),'base64');if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error('Invalid PNG.');}await atomicWrite(r.filePath,bytes);value=r.filePath;}
   }else if(req.action==='context'){
    const {accession,pdb}=z.object({accession:z.string().regex(/^[A-Z0-9-]{6,16}$/),pdb:z.string().regex(/^[A-Z0-9]{4}$/).nullable()}).strict().parse(d);const protein=await jsonFetch(`https://rest.uniprot.org/uniprotkb/${accession}.json`);let mapping=null,mappingError=null;if(pdb){try{mapping=await jsonFetch(`https://www.ebi.ac.uk/pdbe/api/mappings/uniprot/${pdb.toLowerCase()}`);}catch(e:any){mappingError=e.message;}}const transcripts=[];for(const ref of (protein.uniProtKBCrossReferences??[]).filter((r:any)=>r.database==='Ensembl').slice(0,2)){const id=String(ref.id).split('.')[0];if(!/^ENS[A-Z]*T[0-9]+$/.test(id))continue;try{const detail=await jsonFetch('https://rest.ensembl.org/lookup/id/'+id+'?expand=1&content-type=application/json');transcripts.push({id,isoformId:ref.isoformId??null,detail});}catch(e:any){transcripts.push({id,error:e.message});}}value={protein,mapping,mappingError,transcripts,retrievedAt:new Date().toISOString(),source:'UniProt / PDBe SIFTS / Ensembl',accession,pdb};
   }else if(req.action==='open-map'){
    const r=await dialog.showOpenDialog(w,{properties:['openFile'],filters:[{name:'Density map',extensions:['ccp4','map','mrc','cube']} ]});if(r.canceled)value=null;else {const file=r.filePaths[0];if((await stat(file)).size>128*1024*1024)throw new Error('Map exceeds 128 MiB.');const bytes=await readFile(file);value={name:path.basename(file),format:path.extname(file).toLowerCase()==='.cube'?'cube':'ccp4',data:bytes.toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex')};}
   }else throw new Error('Unknown action.');return {ok:true,value};
  }catch(e:any){return {ok:false,error:e.message??String(e)};}
 });
 app.on('before-quit',()=>{for(const p of running.values())p.kill();});
}
export function studioMenu(w:BrowserWindow,shortcuts:Record<string,string>={}){
 const item=(label:string,id:string,accelerator?:string)=>({label,accelerator:shortcuts[id]||accelerator,click:()=>w.webContents.send('proteonator:command',id)});
 Menu.setApplicationMenu(Menu.buildFromTemplate([
  {label:'File',submenu:[item('Open coordinates…','open','CmdOrCtrl+O'),item('Open project…','open-project','CmdOrCtrl+Shift+O'),item('Save project…','save','CmdOrCtrl+S'),item('Export coordinates…','export-coordinates'),item('Export report…','export-report'),item('Export image…','export-image'),{type:'separator'},{role:'quit'}]},
  {label:'Edit',submenu:[item('Undo chemical edit','undo','CmdOrCtrl+Z'),item('Redo chemical edit','redo','CmdOrCtrl+Shift+Z'),{type:'separator'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
  {label:'View',submenu:[item('Fit structure','fit'),item('Settings…','settings','CmdOrCtrl+,'),item('Search commands…','commands','CmdOrCtrl+K'),{role:'togglefullscreen'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'}]},
  {label:'Select',submenu:[item('Toggle residue label','label-selection'),item('Clear selection','clear-selection'),item('Show selected neighborhood','neighbors')]},
  {label:'Measure',submenu:[item('Measure selected atoms','measure'),item('Clear measurements','clear-measures')]},
  {label:'PTM',submenu:[item('Construct selected modification','apply-ptm'),item('Relax local environment','relax'),item('New scenario','new-scenario')]},
  {label:'Analysis',submenu:[item('Compare environments','compare'),item('Open comparison coordinates…','open-mobile'),item('Open density map…','open-map')]},
  {label:'Help',submenu:[item('User guide','guide'),item('Quick tour','tour'),item('Scientific methods','methods')]}
 ]));w.setMenuBarVisibility(true);
}

