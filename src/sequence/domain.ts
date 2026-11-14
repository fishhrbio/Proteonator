import codeData from './genetic-codes.json';

export const AMINO_ACIDS = 'ACDEFGHIKLMNPQRSTVWY';
export type Molecule = 'protein' | 'dna' | 'rna';
export type Feature = {id:string;type:string;name:string;start:number;end:number;strand:1|-1;source:string;evidence:string};
export type SequenceRecord = {id:string;name:string;molecule:Molecule;sequence:string;origin:'imported'|'designed';source:string;sourceDocumentId?:string;features:Feature[]};
export type Module = {id:string;name:string;role:string;sequence:string;source:string};
export type ProcessingRule={reagent:string;pattern:string;cutOffset:number;version:string;source:string;evidence:string};
export type ProteinState = {
 id:string;name:string;sequence:string;residueIds:string[];parentIds:string[];
 operation:{kind:string;description:string;edit?:{mode:'replace'|'insert'|'delete';start:number;end:number;replacement:string};rule?:ProcessingRule;components?:Module[]};cTerm:'acid'|'amide';disulfides:[string,string][];
 evidence:{id:string;kind:string;status:'planned'|'observed'|'interpreted';description:string;source:string}[];
};
export type CodingCandidate = {id:string;name:string;proteinStateId:string;protein:string;nucleotides:string;molecule:'dna'|'rna';tableId:number;method:'deterministic'|'seeded'|'usage';seed:number;usageSource:string;usageTable:Record<string,number>|null;possibleEncodings:string;status:'designed-coding-segment';codons:string[][]};
export type StructureMapping={id:string;proteinStateId:string;sourceSha256:string;model:number;assembly:string;chain:string;method:string;settings:{match:number;mismatch:number;gap:number};reviewed:boolean;pairs:{proteinResidueId:string;position:number;structureResidue:string;expected:string;observed:string}[]};
export type SourceCoding={id:string;proteinStateId:string;sourceDocumentId:string;recordId:string;codingSequence:string;molecule:'dna'|'rna';strand:1|-1;tableId:number;semantics:'complete-cds'|'segment';location:string;codonPositions:number[][]};
export type TargetChemistry={nTerm:'free'|'unspecified';cTerm:'acid'|'amide'|'unspecified';disulfides:[number,number][]|null};
export type SequenceWorkspace = {documents:{id:string;name:string;text:string;format:string;sha256:string}[];records:SequenceRecord[];modules:Module[];states:ProteinState[];activeStateId:string|null;candidates:CodingCandidate[];codingSources:SourceCoding[];mappings:StructureMapping[];target:string;targetChemistry:TargetChemistry;notes:string;analyses:unknown[]};
export const emptyWorkspace = ():SequenceWorkspace=>({documents:[],records:[],modules:[],states:[],activeStateId:null,candidates:[],codingSources:[],mappings:[],target:'',targetChemistry:{nTerm:'unspecified',cTerm:'unspecified',disulfides:null},notes:'',analyses:[]});
export function assessTarget(state:ProteinState,target:string,chemistry:TargetChemistry){
 if(!target)return {sequenceMatches:null,chemistryMatches:null,fullySpecified:false,meetsDesign:null};
 const pairKey=([a,b]:number[])=>[Math.min(a,b),Math.max(a,b)].join(':'),actual=state.disulfides.map(pair=>pair.map(id=>state.residueIds.indexOf(id)+1)),disulfides=chemistry.disulfides===null?null:JSON.stringify(actual.map(pairKey).sort())===JSON.stringify(chemistry.disulfides.map(pairKey).sort()),terminal=chemistry.cTerm==='unspecified'?null:state.cTerm===chemistry.cTerm;
 const sequenceMatches=state.sequence===target,fullySpecified=chemistry.nTerm!=='unspecified'&&terminal!==null&&disulfides!==null,chemistryMatches=terminal===false||disulfides===false?false:fullySpecified?true:null;
 return {sequenceMatches,chemistryMatches,fullySpecified,meetsDesign:!sequenceMatches||chemistryMatches===false?false:fullySpecified?true:null};
}
export function normalize(sequence:string,molecule:Molecule):string {
 const s=sequence.replace(/\s/g,'').toUpperCase();
 if(!s.length||s.length>(molecule==='protein'?10000:300000))throw new Error('Sequence is empty or exceeds the supported length (10,000 residues / 300,000 nucleotides).');
 const valid=molecule==='protein'?/^[ACDEFGHIKLMNPQRSTVWY]+$/:molecule==='dna'?/^[ACGTRYSWKMBDHVN]+$/:/^[ACGURYSWKMBDHVN]+$/;
 if(!valid.test(s))throw new Error(molecule==='protein'?'Protein input must contain the 20 standard amino acids. Resolve ambiguous residues, modifications and terminal * explicitly.':'Sequence letters do not match the selected DNA/RNA alphabet.');
 return s;
}
export function parseFasta(text:string,molecule:Molecule):SequenceRecord[]{
 if(text.length>4*1024*1024)throw new Error('Sequence text exceeds 4 MiB.');
 const chunks=text.trim().startsWith('>')?text.trim().split(/^>/m).filter(Boolean):['Imported sequence\n'+text];
 if(chunks.length>100)throw new Error('At most 100 sequence records can be imported at once.');
 return chunks.map(c=>{const nl=c.indexOf('\n'),name=nl<0?'Imported sequence':c.slice(0,nl).trim();return {id:crypto.randomUUID(),name:name.slice(0,256),molecule,sequence:normalize(nl<0?c:c.slice(nl+1),molecule),origin:'imported',source:'Local sequence import',features:[]};});
}
export const geneticCodes=codeData.tables;
export function codeTable(id:number){const t=geneticCodes.find(t=>t.id===id);if(!t)throw new Error('Unsupported genetic-code table.');if(t.dualCoding.length)throw new Error('This genetic code has context-dependent stop/sense codons; contextual recoding is not supported.');return t;}
export function translate(sequence:string,molecule:'dna'|'rna',tableId:number,semantics:'segment'|'complete-cds'){
 const s=normalize(sequence,molecule).replace(/U/g,'T'),table=codeTable(tableId);
 if(s.length%3)throw new Error('Coding sequence length must be divisible by three.');
 if(/[^ACGT]/.test(s))throw new Error('Resolve ambiguous nucleotides before exact translation.');
 const codons=s.match(/.{3}/g)!;let protein='';
 for(let i=0;i<codons.length;i++){const codon=codons[i];if(table.stops.includes(codon)){if(i!==codons.length-1)throw new Error('Internal stop codon at codon '+(i+1)+'.');continue;}const aa=(table.forward as Record<string,string>)[codon];if(!aa)throw new Error('Codon assignment is unavailable.');protein+=semantics==='complete-cds'&&i===0?'M':aa;}
 if(semantics==='complete-cds'){
  if(!table.starts.includes(codons[0]))throw new Error('The selected genetic code does not recognize this initiation codon.');
  if(!table.stops.includes(codons.at(-1)!))throw new Error('A complete CDS requires a terminal stop codon.');
 }
 return {protein,codons:codons.map(c=>molecule==='rna'?c.replace(/T/g,'U'):c),hasTerminalStop:table.stops.includes(codons.at(-1)!)};
}
export function backTranslate(protein:string,options:{molecule:'dna'|'rna';tableId:number;method:'deterministic'|'seeded'|'usage';seed:number;usage:Record<string,number>|null;usageSource:string}){
 const sequence=normalize(protein,'protein'),table=codeTable(options.tableId);
 if(!Number.isInteger(options.seed)||options.seed<0||options.seed>0xffffffff)throw new Error('Seed must be an unsigned 32-bit integer.');
 if(options.method==='usage'&&(!options.usage||!options.usageSource.trim()))throw new Error('Supply a sourced codon-usage table.');
 let rng=options.seed>>>0;const random=()=>{rng=(Math.imul(1664525,rng)+1013904223)>>>0;return rng/4294967296;};
 let count=1n;const codons:string[][]=[],chosen:string[]=[];
 for(const aa of sequence){
  const choices=Object.entries(table.forward).filter(([,a])=>a===aa).map(([c])=>c).sort();
  if(!choices.length)throw new Error('No supported codon for residue '+aa+'.');
  count*=BigInt(choices.length);codons.push(choices.map(c=>options.molecule==='rna'?c.replace(/T/g,'U'):c));
  let selected=choices[0];
  if(options.method==='seeded')selected=choices[Math.floor(random()*choices.length)];
  if(options.method==='usage'){
   const weights=choices.map(c=>options.usage![c]??options.usage![c.replace(/T/g,'U')]);
   if(weights.some(w=>!Number.isFinite(w)||w<0)||weights.reduce((a,b)=>a+b,0)<=0)throw new Error('Usage table needs finite nonnegative weights and a positive total for every encoded amino acid.');
   let r=random()*weights.reduce((a,b)=>a+b,0);selected=choices.at(-1)!;for(let i=0;i<choices.length;i++){r-=weights[i];if(r<0){selected=choices[i];break;}}
  }
  chosen.push(options.molecule==='rna'?selected.replace(/T/g,'U'):selected);
 }
 const nucleotides=chosen.join('');if(translate(nucleotides,options.molecule,options.tableId,'segment').protein!==sequence)throw new Error('Back-translation did not preserve the input protein.');
 return {protein:sequence,nucleotides,codons,possibleEncodings:count.toString(),tableId:options.tableId,molecule:options.molecule,method:options.method,seed:options.seed,usageSource:options.usageSource,usageTable:options.usage?{...options.usage}:null,status:'designed-coding-segment' as const};
}
export function makeProtein(name:string,sequence:string):ProteinState{
 const s=normalize(sequence,'protein'),id=crypto.randomUUID();return {id,name:name.slice(0,256),sequence:s,residueIds:Array.from(s,(_,i)=>id+':'+(i+1)),parentIds:[],operation:{kind:'encoded',description:'Explicit protein sequence; chemical state is a design unless supported by attached evidence.'},cTerm:'acid',disulfides:[],evidence:[]};
}
export function sequenceVariant(source:ProteinState,name:string,mode:'replace'|'insert'|'delete',start:number,end:number,replacement:string):ProteinState{
 if(!['replace','insert','delete'].includes(mode)||!Number.isInteger(start)||start<1||start>source.sequence.length+(mode==='insert'?1:0))throw new Error('Choose a valid one-based variant position.');
 if(mode!=='insert'&&(!Number.isInteger(end)||end<start||end>source.sequence.length))throw new Error('Choose a valid inclusive source interval.');
 const inserted=mode==='delete'?'':normalize(replacement,'protein'),left=start-1,right=mode==='insert'?left:end;
 const sequence=source.sequence.slice(0,left)+inserted+source.sequence.slice(right);
 if(sequence===source.sequence)throw new Error('The variant must change the protein sequence.');
 const variant=makeProtein(name.trim()||source.name.slice(0,230)+' · variant',sequence);
 variant.parentIds=[source.id];variant.operation={kind:'sequence-variant',edit:{mode,start,end:mode==='insert'?start-1:end,replacement:inserted},description:`${mode} at source ${start}${mode==='insert'?' (before position)':('–'+end)}; ${right-left} removed, ${inserted.length} inserted. New residue identities; chemistry, nucleotide/structure mappings, profiles and experimental evidence require fresh review. Original records remain attached to ${source.name}.`};
 return variant;
}
export function assemble(modules:Module[]):ProteinState{
 if(!modules.length)throw new Error('Add at least one component.');
 if(new Set(modules.map(m=>m.id)).size!==modules.length)throw new Error('Duplicate module identity.');
 const result=makeProtein('Encoded construct',modules.map(m=>normalize(m.sequence,'protein')).join(''));
 result.residueIds=modules.flatMap(m=>Array.from(m.sequence,(_,i)=>m.id+':'+(i+1)));result.operation={kind:'assembled',description:modules.map(m=>m.name+' ['+m.role+']').join(' → ').slice(0,4000),components:structuredClone(modules)};return result;
}
function derived(state:ProteinState,name:string,kind:string,description:string):ProteinState{return {...structuredClone(state),id:crypto.randomUUID(),name:name.length>256?name.slice(0,220)+'…'+name.slice(-30):name,parentIds:[state.id],operation:{kind,description},evidence:[]};}
export function scanProcessingRule(sequence:string,rule:ProcessingRule){
 const pattern=rule.pattern.toUpperCase().replace(/\s/g,'');
 if(!rule.reagent.trim()||!rule.version.trim()||!rule.source.trim()||!pattern||pattern.length>40||!/^[ACDEFGHIKLMNPQRSTVWYX]+$/.test(pattern)||!Number.isInteger(rule.cutOffset)||rule.cutOffset<0||rule.cutOffset>pattern.length)throw new Error('Supply a named, sourced/versioned literal recognition rule (20 amino acids or X wildcard) and a cut offset within its motif.');
 const matches:{start:number;end:number;cutAfter:number;context:string}[]=[];
 for(let i=0;i<=sequence.length-pattern.length;i++)if(Array.from(pattern).every((letter,j)=>letter==='X'||letter===sequence[i+j]))matches.push({start:i+1,end:i+pattern.length,cutAfter:i+rule.cutOffset,context:sequence.slice(Math.max(0,i-4),Math.min(sequence.length,i+pattern.length+4))});
 return {pattern,matches,interpretation:'Literal motif matches under the supplied rule; not confirmed cleavage, accessibility, specificity or processing efficiency.'};
}
export function targetBoundary(sequence:string,target:string){
 if(!target)return {status:'unspecified',text:'No target sequence declared.'};const positions:number[]=[];for(let from=0;from<=sequence.length-target.length;){const index=sequence.indexOf(target,from);if(index<0)break;positions.push(index);from=index+1;}
 if(positions.length>1)return {status:'ambiguous',text:positions.length+' exact target occurrences; the target boundary requires review.'};
 if(!positions.length){const difference=Array.from(target).findIndex((aa,i)=>sequence[i]!==aa);return {status:'mismatch',text:'No exact target interval. First direct-position difference: '+(difference<0?'additional source residues':(difference+1))+'; use a reviewed sequence comparison for insertions/deletions.'};}
 const start=positions[0],extraN=sequence.slice(0,start),extraC=sequence.slice(start+target.length);return {status:extraN||extraC?'extensions':'exact',start:start+1,end:start+target.length,extraN,extraC,text:'Exact target at '+(start+1)+'–'+(start+target.length)+'; extra N-terminal residues '+(extraN||'none')+'; extra C-terminal residues '+(extraC||'none')+'. These are sequence boundaries, not evidence of processing.'};
}
export function cleave(state:ProteinState,cuts:number[],rule?:ProcessingRule):ProteinState[]{
 if(cuts.length>99)throw new Error('At most 99 cut boundaries per operation.');
 if(!cuts.length||cuts.some(n=>!Number.isInteger(n)||n<=0||n>=state.sequence.length)||new Set(cuts).size!==cuts.length)throw new Error('Cuts must be unique internal boundaries, after a numbered residue.');
 const recognition=rule?scanProcessingRule(state.sequence,rule):null;
 const positions=[0,...[...cuts].sort((a,b)=>a-b),state.sequence.length],fragments:ProteinState[]=[];
 for(let i=0;i<positions.length-1;i++){
  const a=positions[i],b=positions[i+1],r=derived(state,state.name+' · fragment '+(i+1),'virtual-cleavage',`Planned cut product: parent residues ${a+1}–${b}; cleavage is not experimentally confirmed.`);
  r.sequence=state.sequence.slice(a,b);r.residueIds=state.residueIds.slice(a,b);r.cTerm=b===state.sequence.length?state.cTerm:'acid';
  if(rule&&recognition){r.operation.rule={...structuredClone(rule),pattern:recognition.pattern};r.operation.description+=' Supplied '+rule.reagent+' rule '+rule.version+': '+recognition.matches.length+' literal matches; proposed cuts without a motif match: '+(cuts.filter(cut=>!recognition.matches.some(m=>m.cutAfter===cut)).join(', ')||'none')+'. Additional matches do not establish specificity.';}
  const ids=new Set(r.residueIds);if(state.disulfides.some(([x,y])=>ids.has(x)!==ids.has(y)))throw new Error('This cut leaves disulfide-linked fragments. Multi-chain connected products require explicit bond handling; no bond was silently removed.');
  r.disulfides=state.disulfides.filter(([x,y])=>ids.has(x)&&ids.has(y));fragments.push(r);
 }
 return fragments;
}
export function amidate(state:ProteinState):ProteinState{
 if(state.cTerm!=='acid'||!state.sequence.endsWith('G')||state.sequence.length<2)throw new Error('Glycine-donor amidation requires a free-acid glycine-extended precursor.');
 const last=state.residueIds.at(-1)!;if(state.disulfides.some(pair=>pair.includes(last)))throw new Error('The donor residue cannot participate in a disulfide.');
 const r=derived(state,state.name+' · amidated','glycine-donor-amidation','Planned donor-glycine removal and C-terminal amide formation; not proof of reaction success.');r.sequence=r.sequence.slice(0,-1);r.residueIds.pop();r.cTerm='amide';return r;
}
export function trim(state:ProteinState,start:number,end:number):ProteinState{
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end>state.sequence.length||start>end)throw new Error('Select a valid inclusive residue range.');
 const r=derived(state,state.name+' · selected peptide','trim',`Selected parent residues ${start}–${end}; trimming alone does not form an amide.`);r.sequence=state.sequence.slice(start-1,end);r.residueIds=state.residueIds.slice(start-1,end);r.cTerm=end===state.sequence.length?state.cTerm:'acid';
 const ids=new Set(r.residueIds);if(state.disulfides.some(([a,b])=>ids.has(a)!==ids.has(b)))throw new Error('The selected range cuts a disulfide connection.');r.disulfides=state.disulfides.filter(([a,b])=>ids.has(a)&&ids.has(b));return r;
}
export function disulfide(state:ProteinState,a:number,b:number):ProteinState{
 if(a===b||!Number.isInteger(a)||!Number.isInteger(b)||state.sequence[a-1]!=='C'||state.sequence[b-1]!=='C')throw new Error('Select two distinct cysteine positions.');
 const pair:[string,string]=[state.residueIds[a-1],state.residueIds[b-1]];if(state.disulfides.some(p=>p.some(id=>pair.includes(id))))throw new Error('A selected cysteine is already paired.');
 const r=derived(state,state.name+' · disulfide','disulfide',`Desired Cys${a}–Cys${b} bond; experimental identity requires evidence.`);r.disulfides.push(pair);return r;
}
type Formula=Record<'C'|'H'|'N'|'O'|'S',number>;
// Polymer-residue elemental formulas; each isolated chain adds H2O.
const formulas:Record<string,number[]>={A:[3,5,1,1,0],R:[6,12,4,1,0],N:[4,6,2,2,0],D:[4,5,1,3,0],C:[3,5,1,1,1],E:[5,7,1,3,0],Q:[5,8,2,2,0],G:[2,3,1,1,0],H:[6,7,3,1,0],I:[6,11,1,1,0],L:[6,11,1,1,0],K:[6,12,2,1,0],M:[5,9,1,1,1],F:[9,9,1,1,0],P:[5,7,1,1,0],S:[3,5,1,2,0],T:[4,7,1,2,0],W:[11,10,2,1,0],Y:[9,9,1,2,0],V:[5,9,1,1,0]};
const elements=['C','H','N','O','S'] as const;
const mono=[12,1.00782503223,14.00307400443,15.99491461957,31.9720711744];
const average=[12.011,1.008,14.007,15.999,32.06];
export function composition(state:ProteinState){
 normalize(state.sequence,'protein');if(state.residueIds.length!==state.sequence.length||new Set(state.residueIds).size!==state.residueIds.length)throw new Error('Residue identity map is inconsistent.');
 const counts=[0,2,0,1,0],paired=new Set<string>();
 for(const aa of state.sequence)formulas[aa].forEach((n,i)=>counts[i]+=n);
 for(const pair of state.disulfides){if(pair[0]===pair[1])throw new Error('Self disulfide.');for(const id of pair){const i=state.residueIds.indexOf(id);if(i<0||state.sequence[i]!=='C'||paired.has(id))throw new Error('Invalid disulfide identity.');paired.add(id);}counts[1]-=2;}
 if(state.cTerm==='amide'){counts[1]++;counts[2]++;counts[3]--;}
 const formula=Object.fromEntries(elements.map((e,i)=>[e,counts[i]])) as Formula;
 return {formula,formulaText:elements.map((e,i)=>counts[i]?e+(counts[i]===1?'':counts[i]):'').join(''),neutralMonoisotopicDa:counts.reduce((s,n,i)=>s+n*mono[i],0),averageDa:counts.reduce((s,n,i)=>s+n*average[i],0),convention:'Neutral molecule; free N terminus; explicit C terminus/disulfides. Average weights C12.011 H1.008 N14.007 O15.999 S32.06; monoisotopic most abundant isotope masses.'};
}
const kd:Record<string,number>={I:4.5,V:4.2,L:3.8,F:2.8,C:2.5,M:1.9,A:1.8,G:-.4,T:-.7,S:-.8,W:-.9,Y:-1.3,P:-1.6,H:-3.2,E:-3.5,Q:-3.5,D:-3.5,N:-3.5,K:-3.9,R:-4.5};
export function profile(state:ProteinState,pH:number,window:number){
 composition(state);if(!Number.isFinite(pH)||pH<0||pH>14||!Number.isInteger(window)||window<1||window>101)throw new Error('Supply pH 0–14 and a profile window of 1–101 residues.');
 const sequence=state.sequence,paired=new Set(state.disulfides.flat()),aaCounts=Object.fromEntries([...AMINO_ACIDS].map(a=>[a,[...sequence].filter(x=>x===a).length]));
 const charge=(ph:number)=>{
  const nPk:Record<string,number>={A:7.59,M:7,S:6.93,P:8.36,T:6.82,V:7.44,E:7.7},cPk:Record<string,number>={D:4.55,E:4.75};
  let q=1/(1+10**(ph-(nPk[sequence[0]]??7.5)));
  for(const [a,pka]of Object.entries({K:10,R:12,H:5.98}))q+=aaCounts[a]/(1+10**(ph-pka));
  for(const [a,pka]of Object.entries({D:4.05,E:4.45,C:9,Y:10})){const count=a==='C'?aaCounts.C-paired.size:aaCounts[a];q-=count/(1+10**(pka-ph));}
  if(state.cTerm==='acid')q-=1/(1+10**((cPk[sequence.at(-1)!]??3.55)-ph));return q;
 };
 let lo=0,hi=14;const bracketed=charge(lo)>=0&&charge(hi)<=0;for(let i=0;i<60&&bracketed;i++){const mid=(lo+hi)/2;if(charge(mid)>0)lo=mid;else hi=mid;}
 const half=Math.floor(window/2),hydropathy=Array.from(sequence,(_,i)=>{const start=Math.max(0,i-half),end=Math.min(sequence.length,i-half+window);return {position:i+1,value:[...sequence.slice(start,end)].reduce((s,a)=>s+kd[a],0)/(end-start)};});
 return {aaCounts,chargeAtPH:charge(pH),pH,isoelectricPoint:bracketed?(lo+hi)/2:null,meanHydropathy:[...sequence].reduce((s,a)=>s+kd[a],0)/sequence.length,hydropathy,window,method:'Kyte–Doolittle hydropathy; Bjellqvist sequence pKa model, excluding paired cysteines and amidated C-terminal acid. Estimates do not model conformation or expression.'};
}
export function toFasta(name:string,sequence:string){return '>'+name.replace(/[\r\n]/g,' ')+'\n'+(sequence.match(/.{1,70}/g)??[]).join('\n')+'\n';}
export function escapeHTML(s:string){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
export function csvValue(value:unknown){let s=String(value);if(typeof value==='string'&&/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
