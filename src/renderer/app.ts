import type * as Mol from '3dmol';
import { NormalizedStructureSchema, GeometryResultSchema, AlignmentResultSchema, PtmAnnotationSchema, JobEventSchema,
  type DesktopBridge, type NormalizedStructure, type GeometryResult, type AlignmentResult, type AlignmentRequest, type Residue, type PtmAnnotation, type Project,
} from '../contracts';
import { getActiveAtoms } from '../engine/selection';
import { unwrapReply } from './desktop-client';

declare global { interface Window { proview: DesktopBridge; $3Dmol: typeof Mol } }
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const select = (id: string) => $<HTMLSelectElement>(id);
const button = (id: string) => $<HTMLButtonElement>(id);
const text = (id: string, value: string | number) => { $(id).textContent = String(value); };
const aa: Record<string, string> = { ALA:'A',ARG:'R',ASN:'N',ASP:'D',CYS:'C',GLN:'Q',GLU:'E',GLY:'G',HIS:'H',ILE:'I',LEU:'L',LYS:'K',MET:'M',PHE:'F',PRO:'P',SER:'S',THR:'T',TRP:'W',TYR:'Y',VAL:'V',SEC:'U',PYL:'O' };
let structure: NormalizedStructure | null = null;
let result: GeometryResult | null = null;
let selected: Residue | null = null;
let viewer: Mol.GLViewer;
let overlayModel:Mol.GLModel|null=null;
let representation: 'trace' | 'sticks' | 'sphere' = 'trace';
let jobId: string | null = null;
let loadBusy = false;
let visibleAtoms: ReturnType<typeof getActiveAtoms> = [];
let annotations: PtmAnnotation[] = [];
let mobile: NormalizedStructure | null = null;
let reviewedMapping: AlignmentRequest['atomCorrespondence'] | null = null;
let alignmentResult: AlignmentResult | null = null;
let dirty = false;
let resizeObserver: ResizeObserver;

function fail(error: any) {
  text('app-status', `${error?.code ?? 'ERROR'} · ${error?.message ?? error}`);
  text('job-status', `${error?.message ?? error} ${error?.recovery ?? ''}`);
}
function busyState() {
  button('validate-mapping').disabled = loadBusy || !!jobId || !mobile;
  button('export-alignment').disabled = loadBusy || !!jobId || !alignmentResult;
  button('export-png').disabled = loadBusy || !!jobId || !structure;
  button('import').disabled = loadBusy || !!jobId;
  button('retrieve').disabled = loadBusy || !!jobId;
  button('import-comparison').disabled = loadBusy || !!jobId || !structure;
  button('prepare-mapping').disabled = loadBusy || !!jobId || !mobile || !structure;
  button('align').disabled = loadBusy || !!jobId || !reviewedMapping || reviewedMapping.length<3 || !$<HTMLInputElement>('mapping-confirm').checked;
  button('open-project').disabled = loadBusy || !!jobId;
  button('save-project').disabled = loadBusy || !!jobId || !structure;
  button('export-geometry').disabled = loadBusy || !!jobId || !result;
  button('analyze').disabled = loadBusy || !!jobId || !structure;
  for (const id of ['example', 'model', 'partner-a', 'partner-b']) select(id).disabled = loadBusy || !!jobId;
  $('cancel').hidden = !jobId;
  if (structure && !jobId && !loadBusy) button('analyze').disabled = select('partner-a').value === select('partner-b').value || !select('partner-b').value;
}
function markDirty() { dirty = true; text('app-status', 'Unsaved changes · save a portable project to keep them'); }
function resetResult() {
  result = null;
  $('analysis-result').hidden = true;
  $('analysis-empty').hidden = false;
  text('analysis-state', 'No result yet');
}
function updateAnnotation() {
  const annotation = annotations.find(a => a.residueKey === selected?.key);
  $<HTMLInputElement>('annotation-label').value = annotation?.label ?? 'Candidate site';
  if(annotation) select('ptm-type').value = annotation.ptm;
  text('annotation-status', annotation ? `${annotation.label} · annotation only. Coordinates unchanged.` : 'No annotation on this residue.');
  button('remove-annotation').disabled = !annotation;
}
function chooseResidue(key: string, scroll = true) {
  if (!structure) return;
  selected = structure.residues.find(r => r.key === key) ?? null;
  if (!selected) return;
  $('residue-empty').hidden = true;
  $('residue-details').hidden = false;
  const chain = structure.chains.find(c => c.key === selected!.chainKey)!;
  text('residue-name', selected.name);
  text('residue-position', `Chain ${chain.authAsymId || '(blank)'} · ${selected.authSeqId}${selected.insertionCode} · ${selected.modelId}`);
  text('residue-atoms', getActiveAtoms(structure).filter(a => a.residueKey === selected!.key).length);
  text('residue-alt', selected.preferredAltLoc || 'Shared / blank');
  text('residue-class', selected.classification);
  text('selection-caption', `${selected.name} ${selected.authSeqId}${selected.insertionCode} · chain ${chain.authAsymId || '(blank)'}`);
  text('app-status', `Selected ${selected.name} ${selected.authSeqId}${selected.insertionCode} in chain ${chain.authAsymId || '(blank)'}`);
  if (select('sequence-chain').value !== selected.chainKey) {
    select('sequence-chain').value = selected.chainKey;
    renderSequence();
  }
  for (const el of $('sequence').querySelectorAll<HTMLButtonElement>('button')) {
    const active = el.dataset.residueKey === selected.key;
    el.setAttribute('aria-pressed', String(active));
    if (active && scroll) el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  }
  updateAnnotation();
  applyStyle();
}
function renderSequence() {
  $('sequence').replaceChildren();
  if (!structure) return;
  let first=true;
  for (const r of structure.residues.filter(r => r.chainKey === select('sequence-chain').value && r.classification === 'protein')) {
    const b = document.createElement('button');
    b.tabIndex=(selected?.chainKey===r.chainKey?selected.key===r.key:first)?0:-1;first=false;
    b.dataset.residueKey = r.key;
    b.setAttribute('aria-pressed', String(selected?.key === r.key));
    b.setAttribute('aria-label', `${aa[r.name]??'X'}${r.authSeqId}${r.insertionCode} · ${r.name} ${r.authSeqId}${r.insertionCode}`);
    b.title = `${r.name} ${r.authSeqId}${r.insertionCode}`;
    b.append(document.createTextNode(aa[r.name] ?? 'X'));
    const number = document.createElement('small'); number.textContent = `${r.authSeqId}${r.insertionCode}`; b.append(number);
    b.addEventListener('click', () => chooseResidue(r.key, false));
    b.addEventListener('keydown', e => {
      if (['ArrowRight','ArrowLeft','Home','End'].includes(e.key)) {
        e.preventDefault();
        const target=(e.key==='Home'?$('sequence').firstElementChild:e.key==='End'?$('sequence').lastElementChild:e.key === 'ArrowRight' ? b.nextElementSibling : b.previousElementSibling) as HTMLButtonElement|null;
        if(target){for(const item of $('sequence').querySelectorAll<HTMLButtonElement>('button'))item.tabIndex=item===target?0:-1;target.focus();}
      }
    });
    $('sequence').append(b);
  }
}
function chainColor(atom: Mol.AtomSpec) {
  return atom.chain === select('partner-a').value ? '#64ddca' : '#7eafff';
}
function applyStyle() {
  if (!viewer || !structure) return;
  if (representation === 'sphere') viewer.setStyle({model:0}, {sphere:{scale:.8,colorfunc:chainColor}});
  else if (representation === 'trace') viewer.setStyle({model:0}, { cartoon: { style: 'trace', thickness: .45, colorfunc: chainColor } });
  else viewer.setStyle({model:0}, { stick: { radius: .11, colorfunc: (a: Mol.AtomSpec) => a.elem === 'C' ? chainColor(a) : (a.elem === 'O' ? '#ef7278' : a.elem === 'N' ? '#8aabff' : a.elem === 'S' ? '#ffd28b' : '#d9e7ee') } });
  if (selected) viewer.addStyle({model:0, properties: { residueKey: selected.key } }, { stick: { color: '#ffd28b', radius: .19 }, sphere: { color: '#ffd28b', scale: .23 } });
  overlayModel?.setStyle({},representation==='sphere'?{sphere:{scale:.7,color:'#ffb86b'}}:representation==='sticks'?{stick:{radius:.08,color:'#ffb86b'}}:{cartoon:{style:'trace',thickness:.35,color:'#ffb86b'}});
  viewer.render();
}
function renderMolecule() {
  if (!structure || !viewer) return;
  viewer.removeAllModels(); viewer.removeAllShapes(); viewer.removeAllLabels();
  overlayModel=null;
  const partnerKeys = new Set([select('partner-a').value, select('partner-b').value].filter(Boolean));
  const residueMap = new Map(structure.residues.map(r => [r.key, r]));
  visibleAtoms = getActiveAtoms(structure).filter(a => partnerKeys.has(a.chainKey) && residueMap.get(a.residueKey)?.classification === 'protein');
  const residueIndex = new Map(structure.residues.map((r, i) => [r.key, i + 1]));
  const atoms: Mol.AtomSpec[] = visibleAtoms.map((a, i) => ({
    ...a.position, index: i, serial: i + 1, elem: a.element ?? 'C', atom: a.name,
    resn: residueMap.get(a.residueKey)!.name, resi: residueIndex.get(a.residueKey)!, chain: a.chainKey,
    hetflag: false, ss: 'c', bonds: [], bondOrder: [],
    properties: { atomKey: a.key, residueKey: a.residueKey },
  }));
  const model = viewer.addModel(); model.addAtoms(atoms);
  // Inferred display bonds ONLY. The engine uses normalized explicit topology instead.
  model.assignBonds();
  viewer.setClickable({}, true, (atom: Mol.AtomSpec) => {
    if (typeof atom.properties?.residueKey === 'string') chooseResidue(atom.properties.residueKey);
  });
  drawOverlay();applyStyle(); viewer.zoomTo(); viewer.rotate(18, 'y'); viewer.render();
  text('visible-count', `${visibleAtoms.length.toLocaleString()} visible protein atoms · selected partners`);
}
function fillChains() {
  if(!structure) return;
  const proteinChainKeys = new Set(structure.residues.filter(r => r.modelId === structure!.selectedModelId && r.classification === 'protein').map(r => r.chainKey));
  const chains = structure.chains.filter(c => proteinChainKeys.has(c.key));
  text('chain-count', chains.length);
  const options = chains.map(c => { const option = document.createElement('option'); option.value = c.key; option.textContent = `${c.authAsymId || '∅'}${c.labelAsymId && c.labelAsymId !== c.authAsymId ? ` [${c.labelAsymId}]` : ''}${c.segmentIndex ? ` · segment ${c.segmentIndex}` : ''}`; return option; });
  for (const id of ['partner-a', 'partner-b', 'sequence-chain']) select(id).replaceChildren(...options.map(o => o.cloneNode(true)));
  select('reference-chain').replaceChildren(...options.map(o=>o.cloneNode(true)));
  if (chains.length > 1) select('partner-b').value = (chains.find(c => c.authAsymId === 'D') ?? chains[1]!).key;
  return chains.length;
}
function applyStructure(raw: NormalizedStructure) {
  structure = NormalizedStructureSchema.parse(raw); selected = null; annotations = [];mobile=null;reviewedMapping=null;alignmentResult=null;$<HTMLTextAreaElement>('mapping-editor').value='';
  select('mobile-model').replaceChildren();select('mobile-chain').replaceChildren();text('mapping-summary','Load a mobile structure to prepare a mapping.');text('alignment-output','');$<HTMLInputElement>('mapping-confirm').checked=false;
  const accession = structure.source.accession ?? structure.source.name;
  const title = accession === '1BRS' ? 'Barnase · barstar' : accession === '1CRN' ? 'Crambin' : structure.source.name;
  text('structure-title', accession); text('structure-subtitle', title); text('view-title', title);
  text('atom-count', structure.atoms.length.toLocaleString());
  select('model').replaceChildren(...structure.models.map(m=>{const o=document.createElement('option');o.value=m.id;o.textContent=`Model ${m.sourceModelNumber}`;return o;}));
  select('model').value=structure.selectedModelId;
  const chainCount=fillChains() ?? 0;
  text('evidence-badge', ({'observed-structure':'Observed coordinates','supplied-coordinates':'Supplied coordinates','synthetic-fixture':'Synthetic fixture','model-based-prediction':'Supplied coordinates'})[structure.evidenceClass]);
  $('residue-empty').hidden = false; $('residue-details').hidden = true;
  $('diagnostics').replaceChildren();
  for (const d of structure.diagnostics) { const li = document.createElement('li'); li.textContent = `${d.code}: ${d.message}`; $('diagnostics').append(li); }
  text('diagnostic-count', `(${structure.diagnostics.length})`);
  resetResult(); renderSequence(); renderMolecule(); busyState();
  text('selection-caption', 'Select a residue to inspect');
  text('job-status', chainCount > 1 ? 'Ready · two partners selected' : 'Choose a model with two protein chains for partner analysis.');
  text('app-status', `${structure.source.name} loaded locally · ${structure.atoms.length.toLocaleString()} recorded atoms`);
  dirty = false;
}
function showResult(value: GeometryResult) {
  result=GeometryResultSchema.parse(value);
  text('minimum-distance', result.minimumDistance.distanceAngstrom.toFixed(3));
  text('contact-count', result.summary.contactCount.toLocaleString());
  text('residue-contact-count', result.summary.contactResiduePairCount.toLocaleString());
  text('clash-count', result.summary.clashCandidateCount.toLocaleString());
  text('analysis-state', 'Computed locally');
  text('analysis-method', `${result.summary.evaluatedPairCount.toLocaleString()} atom pairs evaluated. Geometric candidates only; incomplete bond topology.`);
  text('result-provenance', JSON.stringify({ ...result.provenance, diagnostics: result.diagnostics }, null, 2));
  $('analysis-empty').hidden = true; $('analysis-result').hidden = false; busyState();
}
function viewState() {
  const raw=viewer.getView();
  const camera=raw.length===8&&raw.every((n:unknown)=>typeof n==='number'&&Number.isFinite(n)) ? raw as number[] : null;
  return {selection:selected&&structure?{structureId:structure.id,modelId:structure.selectedModelId,residueKeys:[selected.key],atomKeys:[]}:null,transforms:{},representation:representation==='trace'?'cartoon' as const:representation,
    partnerAChainKey:select('partner-a').value||null,partnerBChainKey:select('partner-b').value||null,slab:{near:-Number($<HTMLInputElement>('clip').value),far:Number($<HTMLInputElement>('clip').value)},comparisonVisible:$<HTMLInputElement>('show-overlay').checked,
    background:'#0c1521',reducedMotion:$<HTMLInputElement>('motion').checked,camera};
}
function restoreProject(project: Project) {
  applyStructure(project.structures[0]!);
  annotations=[...project.annotations];
  representation=project.view.representation==='cartoon'?'trace':project.view.representation;
  if(project.view.partnerAChainKey)select('partner-a').value=project.view.partnerAChainKey;
  if(project.view.partnerBChainKey)select('partner-b').value=project.view.partnerBChainKey;
  $<HTMLInputElement>('show-overlay').checked=project.view.comparisonVisible;
  $<HTMLInputElement>('clip').value=String(project.view.slab.far);updateClip(false);
  if(project.comparison){
    const c=project.comparison;mobile=c.structure;fillMobileModels();select('mobile-model').value=mobile.selectedModelId;fillMobileChains();
    select('reference-chain').value=c.referenceChainKey;select('mobile-chain').value=c.mobileChainKey;reviewedMapping=c.mapping;alignmentResult=c.result;
    mappingToEditor();reviewEditedMapping(false);alignmentResult=c.result;
    if(c.result)showAlignment(c.result);
  }
  renderMolecule();
  button('trace').setAttribute('aria-pressed',String(representation==='trace'));
  button('sticks').setAttribute('aria-pressed',String(representation==='sticks'));button('sphere').setAttribute('aria-pressed',String(representation==='sphere'));
  $<HTMLInputElement>('motion').checked=project.view.reducedMotion;
  applyStyle();
  if(project.view.selection?.residueKeys[0]) chooseResidue(project.view.selection.residueKeys[0]);
  if(project.view.camera) { viewer.setView(project.view.camera); viewer.render(); }
  if(project.analyses.length) showResult(project.analyses.at(-1)!);
  busyState();
  dirty=false; text('app-status',`Project reopened offline · ${project.title}`);
}
async function loadExample() {
  if(!confirmReplace())return;
  loadBusy = true; busyState(); text('job-status', 'Reading and normalizing coordinates locally…');
  try { applyStructure(unwrapReply(await window.proview.loadExample(select('example').value as '1CRN' | '1BRS'))); }
  catch (e) { fail(e); }
  finally { loadBusy = false; busyState(); }
}
function showClosest() {
  if (!structure || !result) return;
  const pair = result.minimumDistance;
  const a = structure.atoms.find(x => x.key === pair.atomAKey)!;
  const b = structure.atoms.find(x => x.key === pair.atomBKey)!;
  chooseResidue(a.residueKey);
  viewer.removeAllShapes(); viewer.removeAllLabels();
  viewer.addCylinder({ start: a.position, end: b.position, radius: .07, color: '#ffd28b', fromCap: 1, toCap: 1 });
  viewer.addLabel(`${pair.distanceAngstrom.toFixed(3)} Å`, { position: { x: (a.position.x+b.position.x)/2, y: (a.position.y+b.position.y)/2, z: (a.position.z+b.position.z)/2 }, fontSize: 13, fontColor: '#ffd28b', backgroundColor: '#172233', backgroundOpacity: .9 });
  viewer.zoomTo({ properties: { residueKey: [a.residueKey, b.residueKey] } }); viewer.render();
}
async function analyze() {
  if (!structure) return;
  resetResult(); jobId = `job_${crypto.randomUUID()}`; busyState();
  try {
    const completed = GeometryResultSchema.parse(unwrapReply(await window.proview.analyze({
      schemaVersion: '1.0.0', jobId, kind: 'interface-geometry', structureId: structure.id, modelId: structure.selectedModelId,
      partnerAChainKeys: [select('partner-a').value], partnerBChainKeys: [select('partner-b').value], contactCutoffAngstrom: 4, clashOverlapThresholdAngstrom: .4,
    })));
    showResult(completed); markDirty();
  } catch (e) { fail(e); }
  finally { jobId = null; busyState(); }
}
function focusSelection() {
  if (!selected) return;
  viewer.zoomTo({ properties: { residueKey: selected.key } }, $<HTMLInputElement>('motion').checked ? 0 : 250); viewer.render();
}
async function exportPng() {
  if(!structure) return;
  try {
    const image=new Image(); image.src=viewer.pngURI(); await image.decode();
    const canvas=document.createElement('canvas');canvas.width=Math.max(1100,image.naturalWidth);const captionScale=Math.max(1,canvas.width/1100);canvas.height=image.naturalHeight+Math.ceil(156*captionScale);
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas export is unavailable');
    ctx.fillStyle='#0c1521';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,(canvas.width-image.naturalWidth)/2,0);
    ctx.save();ctx.scale(captionScale,captionScale);const base=image.naturalHeight/captionScale,captionWidth=canvas.width/captionScale-32;ctx.fillStyle='#edf3fa';ctx.font='bold 16px Segoe UI, sans-serif';
    ctx.fillText(`ProView · ${structure.source.name} · ${structure.evidenceClass}`,16,base+24,captionWidth);
    ctx.font='12px Segoe UI, sans-serif';ctx.fillStyle='#bfd0df';
    ctx.fillText(`Source SHA-256: ${structure.source.sha256}`,16,base+47,captionWidth);
    ctx.fillText(result?`Geometry: ${result.provenance.method}; ${result.provenance.engineVersion}; model ${result.modelId}; Å`:'View of supplied source coordinates; no geometry calculation included',16,base+69,captionWidth);
    ctx.fillText('Static coordinates and annotations do not establish PTM effects or binding affinity.',16,base+91,captionWidth);
    ctx.fillText(alignmentResult?`Comparison: ${mobile?.source.name}; ${alignmentResult.matchedAtomCount} matched Cα atoms; fitted RMSD ${alignmentResult.rmsdAngstrom.toFixed(4)} Å`:'Comparison: none',16,base+113,captionWidth);
    ctx.fillText('ProView 1.0 · Display bonds are inferred; scientific calculations use source coordinates.',16,base+135,captionWidth);ctx.restore();
    const saved=unwrapReply(await window.proview.exportPng(canvas.toDataURL('image/png')));
    if(saved)text('app-status',`Exported captioned PNG · ${saved.path}`);
  } catch(e) {fail(e);}
}
function invalidateMapping() {
  const hadAlignment=alignmentResult!==null;
  reviewedMapping=null;alignmentResult=null;$<HTMLInputElement>('mapping-confirm').checked=false;
  text('mapping-summary',mobile?'Choose chain/model and review the proposed Cα pairs.':'Load a mobile structure to prepare a mapping.');
  text('alignment-output','');
  // Text input can emit a separate event for every pasted line. Rebuild only
  // when an existing fit must be removed, retaining the user's camera.
  if(hadAlignment&&viewer&&structure){const camera=viewer.getView();renderMolecule();viewer.setView(camera);}
  busyState();
}
function fillMobileChains() {
  if(!mobile)return;
  const modelId=select('mobile-model').value;
  const chainKeys=new Set(mobile.residues.filter(r=>r.modelId===modelId&&r.classification==='protein').map(r=>r.chainKey));
  select('mobile-chain').replaceChildren(...mobile.chains.filter(c=>chainKeys.has(c.key)).map(c=>{
    const o=document.createElement('option');o.value=c.key;o.textContent=`${c.authAsymId||'∅'}${c.labelAsymId&&c.labelAsymId!==c.authAsymId?` [${c.labelAsymId}]`:''}`;return o;
  }));
  invalidateMapping();
}

function caIndex(s:NormalizedStructure,modelId:string,chainKey:string){
  const residues=new Map(s.residues.map(r=>[r.key,r]));
  const out=new Map<string,{atomKey:string;residue:Residue}>();
  for(const a of getActiveAtoms(s,modelId).filter(a=>a.chainKey===chainKey&&a.name==='CA')){
    const r=residues.get(a.residueKey)!;if(r.classification!=='protein')continue;
    const key=r.authSeqId+r.insertionCode;
    if(out.has(key))throw new Error(`Ambiguous residue ${key}; select a chain with unique residue identities.`);
    out.set(key,{atomKey:a.key,residue:r});
  }
  return out;
}
function mappingToEditor(){
  if(!structure||!mobile)return;
  const a=new Map(structure.atoms.map(a=>[a.key,a.residueKey])),b=new Map(mobile.atoms.map(a=>[a.key,a.residueKey]));
  const ra=new Map(structure.residues.map(r=>[r.key,r])),rb=new Map(mobile.residues.map(r=>[r.key,r]));
  $<HTMLTextAreaElement>('mapping-editor').value=(reviewedMapping??[]).map(p=>{const r=ra.get(a.get(p.referenceAtomKey)!)!,m=rb.get(b.get(p.mobileAtomKey)!)!;return `${r.authSeqId}${r.insertionCode} ${m.authSeqId}${m.insertionCode}`;}).join('\n');
}
function prepareMapping(){
  if(!structure||!mobile)return;
  try{
    const a=caIndex(structure,structure.selectedModelId,select('reference-chain').value),b=caIndex(mobile,select('mobile-model').value,select('mobile-chain').value);
    reviewedMapping=[...a].filter(([k,v])=>b.has(k)&&b.get(k)!.residue.name===v.residue.name).map(([k,v])=>({referenceAtomKey:v.atomKey,mobileAtomKey:b.get(k)!.atomKey}));
    mappingToEditor();reviewEditedMapping();
  }catch(e){invalidateMapping();fail(e);}
}
function reviewEditedMapping(changed=true){
  if(!structure||!mobile)return;
  try{
    const a=caIndex(structure,structure.selectedModelId,select('reference-chain').value),b=caIndex(mobile,select('mobile-model').value,select('mobile-chain').value);
    const lines=$<HTMLTextAreaElement>('mapping-editor').value.trim().split(/\r?\n/).filter(l=>l.trim());
    if(lines.length<3||lines.length>25000)throw new Error('Enter between 3 and 25,000 explicit residue pairs.');
    const pairs=lines.map((line,i)=>{
      const cols=line.trim().split(/\s+/);if(cols.length!==2)throw new Error(`Mapping line ${i+1}: enter exactly two residue identifiers.`);
      const r=a.get(cols[0]!),m=b.get(cols[1]!);if(!r||!m)throw new Error(`Mapping line ${i+1}: residue Cα is missing or inactive in the selected chain/model.`);
      return {referenceAtomKey:r.atomKey,mobileAtomKey:m.atomKey,r:r.residue,m:m.residue};
    });
    if(new Set(pairs.map(p=>p.referenceAtomKey)).size!==pairs.length||new Set(pairs.map(p=>p.mobileAtomKey)).size!==pairs.length)throw new Error('Mapping must be one-to-one; a residue appears more than once.');
    reviewedMapping=pairs.map(({referenceAtomKey,mobileAtomKey})=>({referenceAtomKey,mobileAtomKey}));alignmentResult=null;
    text('mapping-summary',[`${pairs.length} one-to-one Cα pairs; ${a.size-pairs.length} unmatched reference, ${b.size-pairs.length} unmatched mobile.`,
      `Reference: ${structure.source.name}, model ${structure.selectedModelId}, chain ${select('reference-chain').selectedOptions[0]?.text}`,
      `Mobile: ${mobile.source.name}, model ${select('mobile-model').value}, chain ${select('mobile-chain').selectedOptions[0]?.text}`,
      ...pairs.map(p=>`${p.r.name} ${p.r.authSeqId}${p.r.insertionCode} ↔ ${p.m.name} ${p.m.authSeqId}${p.m.insertionCode}${p.r.name!==p.m.name?' · RESIDUE DIFFERENCE: review intentionally':''}`)].join('\n'));
    $<HTMLInputElement>('mapping-confirm').checked=false;text('alignment-output','');renderMolecule();if(changed)markDirty();busyState();
  }catch(e){invalidateMapping();fail(e);}
}
function showAlignment(fit:AlignmentResult){
  alignmentResult=fit;
  text('alignment-output',[`Proper rigid fit · ${fit.matchedAtomCount} Cα atoms · RMSD ${fit.rmsdAngstrom.toFixed(4)} Å`,
    'Reference: teal/blue · fitted mobile: orange · amber connectors: fitted displacement (drawn at true scale)',
    'Fitted residue displacements (Å):',...fit.residueDisplacements.map(x=>`${x.referenceResidueKey} ↔ ${x.mobileResidueKey}: ${x.rmsDisplacementAngstrom.toFixed(4)}`),...fit.limitations].join('\n'));
}
function drawOverlay(){
  if(!mobile||!alignmentResult||!$<HTMLInputElement>('show-overlay').checked)return;
  const fit=alignmentResult,t=fit.transformMobileToReference,rm=t.rotation;
  const transform=(p:{x:number;y:number;z:number})=>({x:rm[0]!*p.x+rm[1]!*p.y+rm[2]!*p.z+t.translation.x,y:rm[3]!*p.x+rm[4]!*p.y+rm[5]!*p.z+t.translation.y,z:rm[6]!*p.x+rm[7]!*p.y+rm[8]!*p.z+t.translation.z});
  const residues=new Map(mobile.residues.map((r,i)=>[r.key,{r,i}]));
  const active=getActiveAtoms(mobile,select('mobile-model').value).filter(a=>a.chainKey===select('mobile-chain').value&&residues.get(a.residueKey)!.r.classification==='protein');
  const model=viewer.addModel();overlayModel=model;model.addAtoms(active.map((a,i)=>({...transform(a.position),index:i,serial:i+1,elem:a.element??'C',atom:a.name,resn:residues.get(a.residueKey)!.r.name,resi:residues.get(a.residueKey)!.i+1,chain:a.chainKey,hetflag:false,ss:'c',bonds:[],bondOrder:[],properties:{mobile:true}})));model.assignBonds();
  const ra=new Map(structure!.atoms.map(a=>[a.key,a])),ma=new Map(mobile.atoms.map(a=>[a.key,a]));
  let drawn=0;
  for(const p of fit.atomCorrespondence){
    const start=ra.get(p.referenceAtomKey)!.position,end=transform(ma.get(p.mobileAtomKey)!.position);
    if(Math.hypot(start.x-end.x,start.y-end.y,start.z-end.z)>1e-5){viewer.addCylinder({start,end,radius:.045,color:'#ffd28b',fromCap:1,toCap:1});drawn++;}
    if(drawn===500)break;
  }
}
async function runAlignment(){
  if(!structure||!mobile||!reviewedMapping||!$<HTMLInputElement>('mapping-confirm').checked)return;
  jobId=`align_${crypto.randomUUID()}`;busyState();
  try{
    mobile=NormalizedStructureSchema.parse({...mobile,selectedModelId:select('mobile-model').value});
    const fit=AlignmentResultSchema.parse(unwrapReply(await window.proview.align({schemaVersion:'1.0.0',jobId,kind:'rigid-alignment',referenceStructureId:structure.id,mobileStructureId:mobile.id,atomCorrespondence:reviewedMapping,method:'kabsch-no-reflection',atomPolicy:'explicit-correspondence-only'})));
    showAlignment(fit);renderMolecule();markDirty();text('app-status','Supplied structures aligned locally · save a project to keep both sources and the fit');
  }catch(e){fail(e);}finally{jobId=null;busyState();}
}
function fillMobileModels(){
  if(!mobile)return;
  select('mobile-model').replaceChildren(...mobile.models.map(m=>{const o=document.createElement('option');o.value=m.id;o.textContent=`Model ${m.sourceModelNumber}`;return o;}));
}
function updateClip(changed=true){
  const depth=Number($<HTMLInputElement>('clip').value);viewer.setSlab(-depth,depth);viewer.render();text('clip-value',`${depth} Å`);if(changed)markDirty();
}
function confirmReplace(){return !dirty||window.confirm('Discard unsaved changes and open another structure or project?');}

async function init() {
  try {
    viewer = window.$3Dmol.createViewer($('viewer'), { backgroundColor: '#0c1521', antialias: true });
    viewer.setBackgroundColor('#0c1521', 0);
    resizeObserver = new ResizeObserver(() => { viewer.resize(); viewer.render(); }); resizeObserver.observe($('viewer'));
  } catch (e) {
    $('viewer-error').hidden = false;
    text('viewer-error', 'The 3D view could not initialize. Check graphics acceleration and the system GPU driver. Analysis remains local.');
    fail(e); return;
  }
  window.proview.onJob(raw => {
    const event = JobEventSchema.parse(raw);
    if (event.jobId === jobId) text('job-status', `${event.status.charAt(0).toUpperCase()+event.status.slice(1)}${event.message ? ` · ${event.message}` : ''}`);
  });
  select('example').addEventListener('change', loadExample);
  button('help').addEventListener('click',async()=>{try{unwrapReply(await window.proview.openHelp());text('app-status','Opened local ProView user guide');}catch(e){fail(e);}});
  button('import').addEventListener('click', async () => {
    if(!confirmReplace())return;
    loadBusy = true; busyState();
    try { const imported = unwrapReply(await window.proview.importLocal()); if (imported) applyStructure(imported); }
    catch (e) { fail(e); } finally { loadBusy = false; busyState(); }
  });
  button('import-comparison').addEventListener('click',async()=>{
    loadBusy=true;busyState();
    try{const imported=unwrapReply(await window.proview.importComparison());if(imported){mobile=NormalizedStructureSchema.parse(imported);
      fillMobileModels();
      fillMobileChains();text('app-status',`Loaded mobile structure ${mobile.source.name} · source coordinates unchanged`);}}
    catch(e){fail(e);}finally{loadBusy=false;busyState();}
  });
  select('mobile-model').addEventListener('change',fillMobileChains);
  for(const id of ['mobile-chain','reference-chain'])select(id).addEventListener('change',invalidateMapping);
  button('validate-mapping').addEventListener('click',()=>reviewEditedMapping());
  $<HTMLTextAreaElement>('mapping-editor').addEventListener('input',()=>{invalidateMapping();markDirty();});
  button('export-alignment').addEventListener('click',async()=>{if(!alignmentResult)return;try{const saved=unwrapReply(await window.proview.exportAlignment(alignmentResult));if(saved)text('app-status',`Exported alignment with provenance · ${saved.path}`);}catch(e){fail(e);}});
  button('prepare-mapping').addEventListener('click',prepareMapping);
  $<HTMLInputElement>('mapping-confirm').addEventListener('change',busyState);
  button('align').addEventListener('click',runAlignment);
  button('retrieve').addEventListener('click',async()=>{
    if(!confirmReplace())return;
    loadBusy=true;busyState();text('job-status','Retrieving an explicitly requested public mmCIF…');
    try{applyStructure(unwrapReply(await window.proview.retrieveAccession($<HTMLInputElement>('accession').value.trim())));}
    catch(e){fail(e);}finally{loadBusy=false;busyState();}
  });
  button('open-project').addEventListener('click', async()=>{
    if(!confirmReplace())return;
    loadBusy=true;busyState();
    try {const project=unwrapReply(await window.proview.openProject());if(project) restoreProject(project);}
    catch(e){fail(e);}finally{loadBusy=false;busyState();}
  });
  button('save-project').addEventListener('click',async()=>{
    if(!structure) return;
    loadBusy=true;busyState();text('app-status','Saving portable project…');
    try {const saved=unwrapReply(await window.proview.saveProject({title:structure.source.name,selectedModelId:structure.selectedModelId,annotations,analyses:result?[result]:[],comparison:mobile?{selectedModelId:select('mobile-model').value,referenceChainKey:select('reference-chain').value,mobileChainKey:select('mobile-chain').value,mapping:reviewedMapping??[],result:alignmentResult}:null,view:viewState()}));
      if(saved){dirty=false;text('app-status',`Saved portable project · ${saved.path}`);}}
    catch(e){fail(e);}finally{loadBusy=false;busyState();}
  });
  button('export-geometry').addEventListener('click',async()=>{if(!result)return;try{const saved=unwrapReply(await window.proview.exportGeometry(result));if(saved)text('app-status',`Exported geometry with provenance · ${saved.path}`);}catch(e){fail(e);}});
  button('export-png').addEventListener('click',exportPng);
  select('model').addEventListener('change',()=>{
    if(!structure)return;
    structure=NormalizedStructureSchema.parse({...structure,selectedModelId:select('model').value});selected=null;resetResult();
    $('residue-empty').hidden=false;$('residue-details').hidden=true;fillChains();invalidateMapping();renderSequence();renderMolecule();busyState();markDirty();
  });
  for (const id of ['partner-a','partner-b']) select(id).addEventListener('change', () => { resetResult(); selected = null; $('residue-empty').hidden = false; $('residue-details').hidden = true; select('sequence-chain').value = select('partner-a').value; renderSequence(); renderMolecule(); busyState(); text('job-status','Partner selection updated. Recalculate geometry.'); });
  select('sequence-chain').addEventListener('change', renderSequence);
  for (const style of ['trace','sticks','sphere'] as const) button(style).addEventListener('click', () => { representation = style; button('trace').setAttribute('aria-pressed', String(style === 'trace')); button('sticks').setAttribute('aria-pressed', String(style === 'sticks'));button('sphere').setAttribute('aria-pressed',String(style==='sphere')); applyStyle(); markDirty(); });
  button('fit').addEventListener('click', () => { viewer.zoomTo(); viewer.render(); });
  button('focus').addEventListener('click', focusSelection);
  button('analyze').addEventListener('click', analyze);
  button('cancel').addEventListener('click', async () => { try { if (jobId) unwrapReply(await window.proview.cancel(jobId)); } catch(e) { fail(e); } });
  button('show-closest').addEventListener('click', showClosest);
  button('annotate').addEventListener('click', () => {
    if (!selected || !structure) return;
    const ptm = select('ptm-type').value as PtmAnnotation['ptm'];
    const previous=annotations.find(a=>a.residueKey===selected!.key);
    if(!$<HTMLInputElement>('annotation-label').value.trim()){fail(new Error('Enter an annotation label.'));return;}
    const annotation = PtmAnnotationSchema.parse({ schemaVersion:'1.0.0', id:previous?.id??`annotation_${crypto.randomUUID()}`, kind:'annotation', structureId:structure.id, residueKey:selected.key, ptm, label:$<HTMLInputElement>('annotation-label').value.trim(), createdAt:previous?.createdAt??new Date().toISOString(), evidence:{kind:'user-annotation'}, coordinatesChanged:false });
    annotations = [...annotations.filter(a=>a.residueKey!==selected!.key),annotation]; updateAnnotation();markDirty();
  });
  button('remove-annotation').addEventListener('click',()=>{if(!selected)return;annotations=annotations.filter(a=>a.residueKey!==selected!.key);updateAnnotation();markDirty();});
  $<HTMLInputElement>('clip').addEventListener('input',()=>updateClip());
  $<HTMLInputElement>('show-overlay').addEventListener('change',()=>{const view=viewer.getView();renderMolecule();viewer.setView(view);viewer.render();markDirty();});
  $<HTMLInputElement>('motion').addEventListener('change',markDirty);
  $('viewer').addEventListener('keydown',e=>{
    const rotations:Record<string,[number,string]>={ArrowLeft:[-10,'y'],ArrowRight:[10,'y'],ArrowUp:[-10,'x'],ArrowDown:[10,'x']};
    if(rotations[e.key]){e.preventDefault();const [angle,axis]=rotations[e.key]!;if(e.shiftKey)viewer.translate(axis==='y'?angle:0,axis==='x'?angle:0);else viewer.rotate(angle,axis as 'x'|'y');viewer.render();markDirty();}
    if(['+','=','-'].includes(e.key)){e.preventDefault();viewer.zoom(e.key==='-'?.9:1.1);viewer.render();markDirty();}
  });
  $('viewer').addEventListener('pointerup',()=>{if(structure)dirty=true;});
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=false as any;}});
  document.addEventListener('keydown', e => {
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();button('save-project').click();return;}
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') { e.preventDefault(); button('import').click(); }
    if (['INPUT','SELECT','TEXTAREA','BUTTON'].includes((e.target as HTMLElement).tagName)) return;
    if (e.key.toLowerCase() === 'f') button('fit').click();
    if (e.key === 'Enter') focusSelection();
    if (e.key === 'Escape' && jobId) button('cancel').click();
  });
  await loadExample();
}
void init();
