import {registerStudio,studioMenu,queueProjectOpen} from './studio';
import { app, BrowserWindow, dialog, ipcMain, protocol, session, shell } from 'electron';
import { readFile, stat, writeFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { atomicWrite } from './files';
import { retrievePublicStructure } from './retrieval';
import { startWorker } from './worker-runner';
import {
  GeometryRequestSchema, GeometryResultSchema, AlignmentRequestSchema, AlignmentResultSchema, NormalizedStructureSchema, JobEventSchema, AppErrorSchema, ProjectSchema, AnalysisExportSchema,
  type NormalizedStructure, type GeometryRequest, type JobEvent, type Project, type GeometryResult, type AlignmentResult,
} from '../contracts';

const ORIGIN = 'proteonator://app';
// A hidden native window lets automated checks coexist with the user's desktop.
if(process.platform==='win32')app.setAppUserModelId('org.robertwaite.proteonator');
const verificationMode = process.argv.includes('--proview-verify-hidden');
const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const MAX_ATOMS = 25000;
let win: BrowserWindow | null = null;
if(!verificationMode){if(!app.requestSingleInstanceLock()){app.quit();}app.on('second-instance',(_event,argv)=>{const file=argv.find(a=>!a.startsWith('--')&&/\.(proteonator|proview|ptmw)$/i.test(a));if(file)queueProjectOpen(path.resolve(file));if(win){if(win.isMinimized())win.restore();win.show();win.focus();if(file)win.webContents.send('proteonator:command','open-startup-project');}});}
let current: NormalizedStructure | null = null;
let comparison: NormalizedStructure | null = null;
let currentText: string | null = null;
let comparisonText: string | null = null;
let completedAlignment: AlignmentResult | null = null;
let currentProject: Project | null = null;
let completedResults: GeometryResult[] = [];
const workers = new Set<Worker>();
const jobs = new Map<string, { worker: Worker; abort: () => void }>();
let importing = false;
const appError = (code: string, message: string, recovery: string) => ({ code, message, recovery });
function normalizedError(error: any) {
  const parsed=AppErrorSchema.safeParse({code:error?.code,message:error?.message,recovery:error?.recovery,...(error?.details?{details:error.details}:{})});
  if(parsed.success) return parsed.data;
  if(error?.code==='ENOENT') return appError('INVALID_INPUT','The selected file no longer exists.','Choose an existing local PDB file.');
  if(error?.code==='EACCES'||error?.code==='EPERM') return appError('INVALID_INPUT','The selected location cannot be accessed.','Choose a readable input or a writable save folder.');
  return appError('INVALID_INPUT',error?.message??'The operation failed.','Check your input and try again.');
}

protocol.registerSchemesAsPrivileged([{ scheme: 'proteonator', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

function emit(event: JobEvent) {
  const checked = JobEventSchema.parse(event);
  if (win && !win.isDestroyed()) win.webContents.send('proview:job', checked);
}

function workerCall(payload:unknown,onWorker?:(worker:Worker,abort:()=>void)=>void):Promise<unknown>{
  return startWorker(path.join(__dirname,'analysis-worker.cjs'),payload,{
    onStart:(worker,abort)=>{workers.add(worker);onWorker?.(worker,abort);},
    onFinish:worker=>{workers.delete(worker);},
  });
}

async function readUtf8File(filename:string):Promise<string>{
  const bytes=await readFile(filename);
  try{return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{throw appError('INVALID_INPUT','The file is not valid UTF-8 text.','Save the PDB, mmCIF or project as UTF-8 and retry.');}
}

async function loadFile(filename: string, metadata: Record<string, unknown>) {
  if (importing || jobs.size) throw appError('INVALID_INPUT', 'Another operation is running.', 'Wait or cancel before loading another structure.');
  importing = true;
  try {
    const info = await stat(filename);
    if (info.size > MAX_INPUT_BYTES) throw appError('RESOURCE_LIMIT', 'This file exceeds the 5 MiB input limit.', 'Use a PDB or mmCIF file below 5 MiB.');
    const text = await readUtf8File(filename);
    if(Buffer.byteLength(text,'utf8')>MAX_INPUT_BYTES)throw appError('RESOURCE_LIMIT','Input grew beyond 5 MiB while reading.','Use a smaller file.');
    const format = ['.cif', '.mmcif'].includes(path.extname(filename).toLowerCase()) ? 'mmcif' : 'pdb';
    const parsed = NormalizedStructureSchema.parse(await workerCall({ operation: 'import', format, text, metadata }));
    if (parsed.atoms.length > MAX_ATOMS) throw appError('RESOURCE_LIMIT', 'This structure exceeds 25,000 recorded atoms.', 'Use a smaller PDB for this application.');
    current = parsed;
    currentText = text; currentProject = null; completedResults = []; comparison=null;comparisonText=null;completedAlignment=null;
    return parsed;
  } finally { importing = false; }
}

async function analyze(raw: unknown) {
  const request: GeometryRequest = GeometryRequestSchema.parse(raw);
  if (!current || request.structureId !== current.id) throw appError('INVALID_INPUT', 'The requested structure is not currently loaded.', 'Reload the structure and start a new calculation.');
  if (jobs.size || importing) throw appError('INVALID_INPUT', 'A local operation is already running.', 'Cancel it or wait for completion.');
  const base = { jobId: request.jobId, occurredAt: new Date().toISOString() };
  emit({ ...base, status: 'queued', progress: 0 });
  try {
    const result = GeometryResultSchema.parse(await workerCall({ operation: 'geometry', structure: current, request }, (worker, abort) => {
      jobs.set(request.jobId, { worker, abort });
      emit({ ...base, status: 'running', progress: 0, message: 'Computing actual coordinate distances locally.' });
    }));
    completedResults = [...completedResults.filter(r=>r.jobId!==result.jobId),result].slice(-20);
    emit({ ...base, occurredAt: new Date().toISOString(), status: 'completed', progress: 1 });
    return result;
  } catch (e: any) {
    if (e?.code === 'CANCELLED') emit({ ...base, occurredAt: new Date().toISOString(), status: 'cancelled', progress: 0 });
    // Failure detail travels through the typed reply; do not forge a schema-invalid JobEvent.
    else emit({ ...base, occurredAt: new Date().toISOString(), status: 'failed', progress: 0, error: normalizedError(e) } as JobEvent);
    throw e;
  } finally { jobs.delete(request.jobId); }
}

function handle(channel: string, handler: (argument: unknown) => Promise<unknown>) {
  ipcMain.handle(channel, async (event, argument) => {
    const senderUrl=new URL(event.senderFrame?.url??'about:blank');
    if (!win || event.sender.id !== win.webContents.id || event.senderFrame !== win.webContents.mainFrame || senderUrl.protocol!=='proteonator:' || senderUrl.hostname!=='app' || senderUrl.pathname!=='/index.html' || senderUrl.search) {
      return { ok: false, error: appError('INVALID_INPUT', 'Untrusted IPC sender.', 'Use the local application window.') };
    }
    try { return { ok: true, value: await handler(argument) }; }
    catch (e: any) {
      return { ok: false, error: normalizedError(e) };
    }
  });
}

async function atomicJson(filename:string,value:unknown){await atomicWrite(filename,JSON.stringify(value,null,2));}

app.whenReady().then(async () => {
  registerStudio(()=>win);
  const assets: Record<string, string> = {
    '/index.html': 'text/html', '/app.js': 'text/javascript', '/style.css': 'text/css', '/workbench.css':'text/css', '/3Dmol-min.js': 'text/javascript', '/icon.png':'image/png', '/logo.svg':'image/svg+xml', '/molstar.css':'text/css', '/molstar.js':'text/javascript', '/pixel.ttf':'font/ttf', '/painted-world.png':'image/png',
  };
  protocol.handle('proteonator', async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'app' || !(url.pathname in assets) || request.method !== 'GET') return new Response('Not found', { status: 404 });
    const bytes = await readFile(path.join(__dirname, 'renderer', url.pathname.slice(1)));
    return new Response(bytes, { headers: { 'Content-Type': assets[url.pathname], 'X-Content-Type-Options': 'nosniff' } });
  });
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  handle('proview:example', async id => {
    if (id !== '1CRN' && id !== '1BRS') throw appError('INVALID_INPUT', 'Unknown bundled example.', 'Choose 1CRN or 1BRS.');
    const fixture=app.isPackaged ? path.join(process.resourcesPath,'fixtures',`${id}.pdb`) : path.join(__dirname,'fixtures',`${id}.pdb`);
    return loadFile(fixture, { name: `${id}.pdb`, kind: 'bundled-fixture', accession: id, evidenceClass: 'observed-structure', sourceUrl: `https://files.rcsb.org/download/${id}.pdb` });
  });
  handle('proview:import', async () => {
    const answer = await dialog.showOpenDialog(win!, { properties: ['openFile'], filters: [{ name: 'PDB or mmCIF coordinates', extensions: ['pdb', 'ent', 'cif', 'mmcif'] }] });
    if (answer.canceled || !answer.filePaths[0]) return null;
    const file = answer.filePaths[0];
    if (!['.pdb', '.ent', '.cif', '.mmcif'].includes(path.extname(file).toLowerCase())) throw appError('UNSUPPORTED_FORMAT', 'Choose a PDB or mmCIF coordinate file.', 'Supported extensions are .pdb, .ent, .cif and .mmcif.');
    return loadFile(file, { name: path.basename(file), kind: 'local-file' });
  });
  handle('proview:retrieve', async raw => {
    if(importing||jobs.size) throw appError('INVALID_INPUT','A local operation is running.','Wait or cancel before retrieval.');
    importing=true;
    try {
      const {text,metadata}=await retrievePublicStructure(raw);
      const parsed=NormalizedStructureSchema.parse(await workerCall({operation:'import',format:'mmcif',text,metadata}));
      if(parsed.atoms.length>MAX_ATOMS) throw appError('RESOURCE_LIMIT','Structure exceeds 25,000 recorded atoms.','Use a smaller structure.');
      current=parsed;currentText=text;currentProject=null;completedResults=[];comparison=null;comparisonText=null;completedAlignment=null;
      return parsed;
    } finally {importing=false;}
  });
  handle('proview:analyze', analyze);
  handle('proview:comparison-import', async () => {
    if(importing||jobs.size) throw appError('INVALID_INPUT','A local operation is running.','Wait or cancel before loading a comparison.');
    if(!current) throw appError('INVALID_INPUT','Load a reference structure first.','Open coordinates before comparing.');
    const answer=await dialog.showOpenDialog(win!,{properties:['openFile'],filters:[{name:'PDB or mmCIF coordinates',extensions:['pdb','ent','cif','mmcif']}]});
    if(answer.canceled||!answer.filePaths[0])return null;
    const filename=answer.filePaths[0],extension=path.extname(filename).toLowerCase();
    if(!['.pdb','.ent','.cif','.mmcif'].includes(extension)) throw appError('UNSUPPORTED_FORMAT','Choose a PDB or mmCIF coordinate file.','Supported extensions are .pdb, .ent, .cif and .mmcif.');
    importing=true;
    try {
      const info=await stat(filename);if(info.size>MAX_INPUT_BYTES)throw appError('RESOURCE_LIMIT','Comparison exceeds 5 MiB.','Use a smaller structure.');
      const text=await readUtf8File(filename);
      if(Buffer.byteLength(text,'utf8')>MAX_INPUT_BYTES)throw appError('RESOURCE_LIMIT','Input exceeds 5 MiB.','Use a smaller file.');
      const format=['.cif','.mmcif'].includes(extension)?'mmcif':'pdb';
      const parsed=NormalizedStructureSchema.parse(await workerCall({operation:'import',format,text,metadata:{name:path.basename(filename),kind:'local-file'}}));
      if(parsed.atoms.length>MAX_ATOMS)throw appError('RESOURCE_LIMIT','Comparison exceeds 25,000 atoms.','Use a smaller structure.');
      comparison=parsed;comparisonText=text;completedAlignment=null;return parsed;
    } finally {importing=false;}
  });
  handle('proview:align', async raw => {
    const request=AlignmentRequestSchema.parse(raw);
    if(!current||!comparison||request.referenceStructureId!==current.id||request.mobileStructureId!==comparison.id) throw appError('INVALID_INPUT','Comparison sources are stale.','Reload both structures and review the mapping.');
    if(importing||jobs.size) throw appError('INVALID_INPUT','A local operation is running.','Wait or cancel it.');
    const base={jobId:request.jobId,occurredAt:new Date().toISOString()};
    emit({...base,status:'queued',progress:0});
    try {
      const result=AlignmentResultSchema.parse(await workerCall({operation:'alignment',reference:current,mobile:comparison,request},(worker,abort)=>{
        jobs.set(request.jobId,{worker,abort});emit({...base,status:'running',progress:0,message:'Fitting explicitly matched supplied atoms locally.'});
      }));
      completedAlignment=result;emit({...base,occurredAt:new Date().toISOString(),status:'completed',progress:1});return result;
    } catch(e:any) {
      if(e?.code==='CANCELLED')emit({...base,occurredAt:new Date().toISOString(),status:'cancelled',progress:0});
      else emit({...base,occurredAt:new Date().toISOString(),status:'failed',progress:0,error:normalizedError(e)} as JobEvent);
      throw e;
    } finally {jobs.delete(request.jobId);}
  });
  handle('proview:open-project', async () => {
    if(importing||jobs.size) throw appError('INVALID_INPUT','A local operation is running.','Wait or cancel before opening a project.');
    const answer=await dialog.showOpenDialog(win!,{properties:['openFile'],filters:[{name:'Proteonator project',extensions:['proview','ptmw']}]});
    if(answer.canceled||!answer.filePaths[0]) return null;
    const file=answer.filePaths[0];
    if(!['.proview','.ptmw'].includes(path.extname(file).toLowerCase())) throw appError('UNSUPPORTED_FORMAT','Choose a .proview project (or a legacy .ptmw file).','Use a Proteonator project file.');
    const info=await stat(file);
    if(info.size>50*1024*1024) throw appError('RESOURCE_LIMIT','Project exceeds 50 MiB.','Open a smaller project.');
    importing=true;
    try {
      const project=ProjectSchema.parse(await workerCall({operation:'project',text:await readUtf8File(file)}));
      if(project.structures.length!==1) throw appError('INVALID_INPUT','A project must contain one reference structure.','Use a single-structure project.');
      const source=project.inputs.find(i=>i.sourceSha256===project.structures[0]!.source.sha256);
      if(!source) throw appError('INVALID_INPUT','Embedded source is missing.','Repair the project from its original coordinates.');
      current=project.structures[0]!; currentText=source.text; currentProject=project; completedResults=[...project.analyses];comparison=project.comparison?.structure??null;
      comparisonText=comparison?project.inputs.find(i=>i.sourceSha256===comparison!.source.sha256)?.text??null:null;
      completedAlignment=project.comparison?.result??null;
      return project;
    } finally { importing=false; }
  });
  handle('proview:save-project', async raw => {
    if(!current||!currentText) throw appError('INVALID_INPUT','No structure is loaded.','Open coordinates first.');
    if(importing||jobs.size) throw appError('INVALID_INPUT','A local operation is running.','Wait or cancel before saving.');
    if(!raw||typeof raw!=='object') throw appError('INVALID_INPUT','Invalid project state.','Retry the save.');
    const state=raw as Record<string,any>;
    if(typeof state.title!=='string'||state.title.length<1||state.title.length>256||typeof state.selectedModelId!=='string'||!Array.isArray(state.annotations)||!Array.isArray(state.analyses)) throw appError('INVALID_INPUT','Invalid project state.','Retry the save.');
    if(!current.models.some(m=>m.id===state.selectedModelId)) throw appError('INVALID_INPUT','Selected model is unknown.','Choose a model in the current structure.');
    let savedComparison=null;
    if(state.comparison){
      if(!comparison||!comparisonText) throw appError('INVALID_INPUT','Comparison source is unavailable.','Reopen the mobile structure.');
      if(state.comparison.result && JSON.stringify(state.comparison.result)!==JSON.stringify(completedAlignment)) throw appError('INVALID_INPUT','Unknown alignment result.','Fit the reviewed mapping before saving.');
      savedComparison={structure:{...comparison,selectedModelId:state.comparison.selectedModelId},referenceChainKey:state.comparison.referenceChainKey,mobileChainKey:state.comparison.mobileChainKey,mapping:state.comparison.mapping,result:state.comparison.result};
    }
    const now=new Date().toISOString();
    const structure=NormalizedStructureSchema.parse({...current,selectedModelId:state.selectedModelId});
    const inputs=[{sourceSha256:structure.source.sha256,format:structure.source.format,name:structure.source.name,text:currentText}];
    if(savedComparison && !inputs.some(i=>i.sourceSha256===savedComparison.structure.source.sha256)) inputs.push({sourceSha256:savedComparison.structure.source.sha256,format:savedComparison.structure.source.format,name:savedComparison.structure.source.name,text:comparisonText!});
    const project=ProjectSchema.parse({schemaVersion:'2.0.0',format:'proview-project',id:currentProject?.id??`project_${randomUUID()}`,title:state.title,createdAt:currentProject?.createdAt??now,updatedAt:now,portability:'embedded-inputs-only',
      inputs,structures:[structure],annotations:state.annotations,modifications:[],analyses:state.analyses,view:state.view,comparison:savedComparison});
    if(project.analyses.some(a=>!completedResults.some(r=>JSON.stringify(r)===JSON.stringify(a)))) throw appError('INVALID_INPUT','Project contains an unknown analysis result.','Recalculate the analysis before saving.');
    // Run the full source and derived-state check off the UI thread before touching disk.
    await workerCall({operation:'project',text:JSON.stringify(project)});
    const answer=await dialog.showSaveDialog(win!,{defaultPath:`${structure.source.name.replace(/\.[^.]+$/,'')}.proview`,filters:[{name:'Proteonator project',extensions:['proview']}]});
    if(answer.canceled||!answer.filePath) return null;
    const filename=path.extname(answer.filePath).toLowerCase()==='.proview'?answer.filePath:`${answer.filePath}.proview`;
    await atomicJson(filename,project); currentProject=project;
    return {path:filename};
  });
  handle('proview:export-geometry', async raw => {
    const result=GeometryResultSchema.parse(raw);
    if(!current||result.structureId!==current.id||!completedResults.some(r=>JSON.stringify(r)===JSON.stringify(result))) throw appError('INVALID_INPUT','No matching completed result.','Calculate geometry before exporting.');
    const payload=AnalysisExportSchema.parse({schemaVersion:'1.0.0',format:'proview-geometry-export',exportedAt:new Date().toISOString(),coordinateUnit:'angstrom',result,source:current.source});
    const answer=await dialog.showSaveDialog(win!,{defaultPath:'Proteonator-geometry.json',filters:[{name:'JSON geometry',extensions:['json']}]});
    if(answer.canceled||!answer.filePath) return null;
    const filename=path.extname(answer.filePath).toLowerCase()==='.json'?answer.filePath:`${answer.filePath}.json`;
    await atomicJson(filename,payload);return {path:filename};
  });
  handle('proview:export-png', async raw => {
    if(!current) throw appError('INVALID_INPUT','No structure is loaded.','Open coordinates first.');
    if(typeof raw!=='string'||raw.length>24*1024*1024||!raw.startsWith('data:image/png;base64,')) throw appError('INVALID_INPUT','Invalid PNG image payload.','Retry image export.');
    const base64=raw.slice('data:image/png;base64,'.length);
    if(!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw appError('INVALID_INPUT','Invalid PNG encoding.','Retry image export.');
    const bytes=Buffer.from(base64,'base64');
    if(bytes.length<45||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.toString('ascii',12,16)!=='IHDR') throw appError('INVALID_INPUT','Invalid PNG header.','Retry image export.');
    const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
    if(width<256||height<256||width>8192||height>8192) throw appError('RESOURCE_LIMIT','PNG dimensions are outside the supported range.','Resize the viewer and retry.');
    const answer=await dialog.showSaveDialog(win!,{defaultPath:'Proteonator-view.png',filters:[{name:'PNG image',extensions:['png']}]});
    if(answer.canceled||!answer.filePath) return null;
    const filename=path.extname(answer.filePath).toLowerCase()==='.png'?answer.filePath:`${answer.filePath}.png`;
    await atomicWrite(filename,bytes);
    return {path:filename};
  });
  handle('proview:export-alignment',async raw=>{
    const result=AlignmentResultSchema.parse(raw);
    if(!current||!comparison||JSON.stringify(result)!==JSON.stringify(completedAlignment)) throw appError('INVALID_INPUT','No matching completed alignment.','Fit a reviewed mapping first.');
    const answer=await dialog.showSaveDialog(win!,{defaultPath:'Proteonator-alignment.json',filters:[{name:'JSON alignment',extensions:['json']}]});
    if(answer.canceled||!answer.filePath)return null;
    const filename=path.extname(answer.filePath).toLowerCase()==='.json'?answer.filePath:`${answer.filePath}.json`;
    await atomicJson(filename,{schemaVersion:'1.0.0',format:'proview-alignment-export',coordinateUnit:'angstrom',exportedAt:new Date().toISOString(),referenceSource:current.source,mobileSource:comparison.source,result});
    return {path:filename};
  });
  handle('proview:help',async()=>{
    const help=app.isPackaged?path.join(process.resourcesPath,'USER_GUIDE.html'):path.join(__dirname,'../docs/USER_GUIDE.html');
    const error=await shell.openPath(help);if(error)throw new Error(error);return true;
  });
  handle('proview:cancel', async jobId => {
    if (typeof jobId !== 'string') return false;
    const job = jobs.get(jobId);
    if (!job) return false;
    job.abort();
    return true;
  });
  win = new BrowserWindow({
    width: 1440, height: 940, minWidth: 760, minHeight: 600, show: false,
    backgroundColor: '#0b111b', title: 'Proteonator',
    icon:path.join(__dirname,'renderer/icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, backgroundThrottling: !verificationMode },
  });
  studioMenu(win);
  win.webContents.on('will-prevent-unload',event=>{
    const choice=dialog.showMessageBoxSync(win!,{type:'question',title:'Proteonator',message:'Close Proteonator and discard unsaved changes?',detail:'Choose Keep working to save your project before closing.',buttons:['Keep working','Discard changes'],defaultId:0,cancelId:0,noLink:true});
    if(choice===1)event.preventDefault();
  });
  win.webContents.on('will-attach-webview',event=>event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.once('ready-to-show', () => { if (!verificationMode) win?.show(); });
  await win.loadURL(`${ORIGIN}/index.html`);
});

app.on('before-quit', () => { for (const worker of workers) void worker.terminate(); workers.clear(); });
app.on('window-all-closed', () => app.quit());
