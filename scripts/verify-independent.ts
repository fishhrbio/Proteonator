import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {parsePdb,parseMmcif,alignStructures} from '../src/engine/index.js';
import {pdbAtom} from '../tests/engine-helpers.js';
const root=path.resolve(import.meta.dirname,'..');
const python=process.env.PROVIEW_PYTHON??'python';
const oracle=(input:unknown)=>JSON.parse(execFileSync(python,[path.join(root,'scripts/reference_independent.py')],{input:JSON.stringify(input),encoding:'utf8',maxBuffer:20*1024*1024}));
const report:any={status:'running',parser:[],alignments:[]};
for(const filename of ['structures/1CRN.cif','structures/1CRN.pdb','structures/1BRS.pdb','synthetic/insertion-alternates.pdb','synthetic/barnase-comparison.pdb']){
  const absolute=path.join(root,'fixtures',filename),text=readFileSync(absolute,'utf8');
  const s=filename.endsWith('.cif')?parseMmcif(text,{name:filename,kind:'synthetic-test'}):parsePdb(text,{name:filename,kind:'synthetic-test'});
  const independent=oracle({operation:'parse',filename:absolute});
  const residues=new Map(s.residues.map(r=>[r.key,r])),chains=new Map(s.chains.map(c=>[c.key,c])),models=new Map(s.models.map(m=>[m.id,m]));
  const independentAtoms=new Map(independent.atoms.map((a:any)=>[`${a.model}:${a.serial}`,a]));
  assert.equal(s.atoms.length,independent.atoms.length);
  let maxError=0;
  for(let i=0;i<s.atoms.length;i++){
    const a=s.atoms[i]!,r=residues.get(a.residueKey)!,b:any=independentAtoms.get(`${models.get(a.modelId)!.sourceModelNumber}:${Number(a.serial)}`);assert.ok(b);
    assert.deepEqual({model:models.get(a.modelId)!.sourceModelNumber,chain:chains.get(a.chainKey)!.authAsymId,seq:r.authSeqId,ins:r.insertionCode,residue:r.name,name:a.name,alt:a.altLoc},{model:b.model,chain:b.chain,seq:b.seq,ins:b.ins,residue:b.residue,name:b.name,alt:b.alt});
    for(const axis of ['x','y','z'] as const)maxError=Math.max(maxError,Math.abs(a.position[axis]-b.position[axis]));
    if(a.occupancy!==null)assert.ok(Math.abs(a.occupancy-b.occupancy)<1e-6);
  }
  assert.ok(maxError<1e-12);report.parser.push({fixture:filename,atoms:s.atoms.length,maxCoordinateErrorAngstrom:maxError,gemmi:independent.gemmi});
}
let randomState=7727;const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
for(const mode of ['rigid','perturbed','reflection']){
  const points=Array.from({length:120},()=>[random()*40-20,random()*40-20,random()*40-20]);
  const mobile=points.map(([x,y,z],i)=>[.6*x!-.8*y!+13,.8*x!+.6*y!-7,(mode==='reflection'?-z!:z!)+9].map((v,j)=>v+(mode==='perturbed'?Math.sin(i+j)*.3:0)));
  const toStructure=(values:number[][])=>parsePdb(values.map(([x,y,z],i)=>pdbAtom({serial:i+1,name:'CA',seq:i+1,x,y,z})).join('\n'),{name:mode+'.pdb',kind:'synthetic-test'});
  const r=toStructure(points),m=toStructure(mobile);
  const fit=alignStructures(r,m,{schemaVersion:'1.0.0',jobId:'oracle_'+mode,kind:'rigid-alignment',referenceStructureId:r.id,mobileStructureId:m.id,atomCorrespondence:r.atoms.map((a,i)=>({referenceAtomKey:a.key,mobileAtomKey:m.atoms[i]!.key})),method:'kabsch-no-reflection',atomPolicy:'explicit-correspondence-only'});
  const independent=oracle({operation:'fit',reference:r.atoms.map(a=>Object.values(a.position)),mobile:m.atoms.map(a=>Object.values(a.position))});
  const rmsdError=Math.abs(fit.rmsdAngstrom-independent.rmsd),rotationError=Math.max(...fit.transformMobileToReference.rotation.map((v,i)=>Math.abs(v-independent.rotation[i]))),translationError=Math.max(...Object.values(fit.transformMobileToReference.translation).map((v,i)=>Math.abs(v-independent.translation[i])));
  assert.ok(rmsdError<1e-10&&rotationError<1e-10&&translationError<1e-10);
  const maxDisplacementError=Math.max(...fit.residueDisplacements.map((d,i)=>Math.abs(d.rmsDisplacementAngstrom-independent.distances[i])));assert.ok(maxDisplacementError<1e-10);
  report.alignments.push({case:mode,atoms:120,rmsdAngstrom:fit.rmsdAngstrom,rmsdErrorAngstrom:rmsdError,rotationError,translationErrorAngstrom:translationError,maxDisplacementErrorAngstrom:maxDisplacementError,independentDeterminant:independent.determinant,numpy:independent.numpy});
}
report.status='passed';report.verifiedAt=new Date().toISOString();mkdirSync(path.join(root,'evidence'),{recursive:true});writeFileSync(path.join(root,'evidence/independent-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
