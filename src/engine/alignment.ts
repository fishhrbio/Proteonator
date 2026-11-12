import { AlignmentRequestSchema, AlignmentResultSchema, NormalizedStructureSchema, type AlignmentRequest, type AlignmentResult, type Atom, type NormalizedStructure } from '../contracts/index.js';
import { EngineError, invalidInput } from './errors.js';
import { getActiveAtoms } from './selection.js';

type V = [number, number, number];
const sub = (a: V, b: V): V => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const dot = (a: V, b: V) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a: V, b: V): V => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const norm = (a: V) => Math.sqrt(dot(a,a));
const pos = (a: Atom): V => [a.position.x,a.position.y,a.position.z];
const centroid = (v: V[]): V => v.reduce((s,p) => [s[0]+p[0]/v.length,s[1]+p[1]/v.length,s[2]+p[2]/v.length], [0,0,0]);

/** Largest eigenvector of a real symmetric 4x4 matrix by Jacobi rotations. */
function largestEigenvector(input: number[][]): [number,number,number,number] {
  const a=input.map(row=>[...row]), eigen=Array.from({length:4},(_,i)=>Array.from({length:4},(_,j)=>Number(i===j)));
  for(let sweep=0;sweep<80;sweep++) {
    let p=0,q=1,largest=0;
    for(let i=0;i<4;i++) for(let j=i+1;j<4;j++) if(Math.abs(a[i]![j]!)>largest){largest=Math.abs(a[i]![j]!);p=i;q=j;}
    if(largest<1e-12) break;
    const angle=.5*Math.atan2(2*a[p]![q]!,a[q]![q]!-a[p]![p]!);
    const c=Math.cos(angle),s=Math.sin(angle);
    for(let k=0;k<4;k++) if(k!==p&&k!==q){const ap=a[k]![p]!,aq=a[k]![q]!;a[k]![p]=a[p]![k]=c*ap-s*aq;a[k]![q]=a[q]![k]=s*ap+c*aq;}
    const app=a[p]![p]!,aqq=a[q]![q]!,apq=a[p]![q]!;
    a[p]![p]=c*c*app-2*c*s*apq+s*s*aqq;
    a[q]![q]=s*s*app+2*c*s*apq+c*c*aqq;
    a[p]![q]=a[q]![p]=0;
    for(let k=0;k<4;k++){const ep=eigen[k]![p]!,eq=eigen[k]![q]!;eigen[k]![p]=c*ep-s*eq;eigen[k]![q]=s*ep+c*eq;}
  }
  const index=[0,1,2,3].sort((i,j)=>a[j]![j]!-a[i]![i]!)[0]!;
  const v=[0,1,2,3].map(i=>eigen[i]![index]!) as [number,number,number,number];
  const length=Math.hypot(...v);
  return v.map(x=>x/length) as [number,number,number,number];
}

export function alignStructures(referenceRaw: NormalizedStructure, mobileRaw: NormalizedStructure, raw: AlignmentRequest): AlignmentResult {
  const request=AlignmentRequestSchema.parse(raw), reference=NormalizedStructureSchema.parse(referenceRaw), mobile=NormalizedStructureSchema.parse(mobileRaw);
  if(request.referenceStructureId!==reference.id||request.mobileStructureId!==mobile.id) invalidInput('Alignment structure IDs do not match supplied coordinates');
  if(new Set(request.atomCorrespondence.map(p=>p.referenceAtomKey)).size!==request.atomCorrespondence.length || new Set(request.atomCorrespondence.map(p=>p.mobileAtomKey)).size!==request.atomCorrespondence.length)
    throw new EngineError({code:'AMBIGUOUS_MAPPING',message:'Alignment atom correspondence is not one-to-one',recovery:'Select each atom at most once.'});
  const referenceAtoms=new Map(reference.atoms.map(a=>[a.key,a])), mobileAtoms=new Map(mobile.atoms.map(a=>[a.key,a]));
  const pairs=request.atomCorrespondence.map(pair=>{
    const r=referenceAtoms.get(pair.referenceAtomKey),m=mobileAtoms.get(pair.mobileAtomKey);
    if(!r||!m) invalidInput('Alignment correspondence refers to an unknown atom');
    return {r,m};
  });
  if(new Set(pairs.map(p=>p.r.modelId)).size!==1||new Set(pairs.map(p=>p.m.modelId)).size!==1) invalidInput('Alignment correspondence must use one model in each structure');
  const activeReference=new Set(getActiveAtoms(reference,pairs[0]!.r.modelId).map(a=>a.key)), activeMobile=new Set(getActiveAtoms(mobile,pairs[0]!.m.modelId).map(a=>a.key));
  if(pairs.some(p=>!activeReference.has(p.r.key)||!activeMobile.has(p.m.key))) invalidInput('Alignment mapping includes an inactive alternate conformer or zero-occupancy atom');
  const rPos=pairs.map(p=>pos(p.r)),mPos=pairs.map(p=>pos(p.m));
  const rc=centroid(rPos),mc=centroid(mPos),rCentered=rPos.map(p=>sub(p,rc)),mCentered=mPos.map(p=>sub(p,mc));
  const nonCollinear=(points:V[])=>{
    const pivot=points.reduce((best,p)=>norm(p)>norm(best)?p:best,[0,0,0] as V);
    const scale=norm(pivot);
    return Number.isFinite(scale) && scale>1e-10 && points.some(p=>norm(cross(pivot,p))>Math.max(1e-10,scale*scale*1e-10));
  };
  if(!nonCollinear(rCentered)||!nonCollinear(mCentered)) throw new EngineError({code:'AMBIGUOUS_MAPPING',message:'Alignment points are collinear or coincident',recovery:'Supply at least three non-collinear matched atoms.'});
  const h=Array.from({length:3},()=>[0,0,0]);
  for(let i=0;i<pairs.length;i++) for(let a=0;a<3;a++) for(let b=0;b<3;b++) h[a]![b]!+=mCentered[i]![a]!*rCentered[i]![b]!;
  const [[xx,xy,xz],[yx,yy,yz],[zx,zy,zz]]=h as [[number,number,number],[number,number,number],[number,number,number]];
  const k=[[xx+yy+zz,yz-zy,zx-xz,xy-yx],[yz-zy,xx-yy-zz,xy+yx,zx+xz],[zx-xz,xy+yx,-xx+yy-zz,yz+zy],[xy-yx,zx+xz,yz+zy,-xx-yy+zz]];
  const [w,x,y,z]=largestEigenvector(k);
  const rotation=[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)];
  const rotate=(p:V):V=>[dot(rotation.slice(0,3) as V,p),dot(rotation.slice(3,6) as V,p),dot(rotation.slice(6,9) as V,p)];
  const rotatedCenter=rotate(mc),t:V=sub(rc,rotatedCenter);
  const distances=pairs.map(p=>norm(sub(rotate(pos(p.m)).map((v,i)=>v+t[i]!) as V,pos(p.r))));
  const rmsd=Math.sqrt(distances.reduce((sum,d)=>sum+d*d,0)/distances.length);
  const byResidue=new Map<string,{referenceResidueKey:string;mobileResidueKey:string;distances:number[]}>();
  for(let i=0;i<pairs.length;i++){
    const p=pairs[i]!,key=`${p.r.residueKey}\0${p.m.residueKey}`;
    const entry=byResidue.get(key)??{referenceResidueKey:p.r.residueKey,mobileResidueKey:p.m.residueKey,distances:[]};
    entry.distances.push(distances[i]!);byResidue.set(key,entry);
  }
  return AlignmentResultSchema.parse({schemaVersion:'1.0.0',jobId:request.jobId,kind:'rigid-alignment',referenceStructureId:reference.id,mobileStructureId:mobile.id,
    referenceSourceSha256:reference.source.sha256,mobileSourceSha256:mobile.source.sha256,coordinateUnit:'angstrom',evidenceClass:'derived-geometry',method:'kabsch-no-reflection',engineVersion:'proview-alignment-1',computedAt:new Date().toISOString(),
    transformMobileToReference:{convention:'row-major;column-vector;p-display=R*p-source+t',coordinateUnit:'angstrom',rotation,translation:{x:t[0],y:t[1],z:t[2]}},
    matchedAtomCount:pairs.length,rmsdAngstrom:rmsd,atomCorrespondence:request.atomCorrespondence,
    residueDisplacements:[...byResidue.values()].map(e=>({referenceResidueKey:e.referenceResidueKey,mobileResidueKey:e.mobileResidueKey,matchedAtomCount:e.distances.length,rmsDisplacementAngstrom:Math.sqrt(e.distances.reduce((s,d)=>s+d*d,0)/e.distances.length)})),
    exclusions:[],limitations:['Alignment uses only explicit atom correspondence and supplied coordinates.','A fitted displacement does not establish a PTM effect or biological causality.']});
}
