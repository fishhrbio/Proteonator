/** Cartesian coordinates in angstroms; signed torsion follows atan2((b1×v)·w,v·w). */
export function measurePositions(positions:number[][]){
 if(![2,3,4].includes(positions.length)||positions.some(p=>p.length!==3||p.some(v=>!Number.isFinite(v))))throw new Error('Select two, three or four finite 3D positions.');
 const sub=(a:number[],b:number[])=>a.map((x,i)=>x-b[i]),dot=(a:number[],b:number[])=>a.reduce((s,x,i)=>s+x*b[i],0),norm=(a:number[])=>Math.hypot(...a);
 if(positions.length===2)return {kind:'distance',unit:'Å',value:norm(sub(positions[1],positions[0]))};
 if(positions.length===3){const a=sub(positions[0],positions[1]),b=sub(positions[2],positions[1]),den=norm(a)*norm(b);if(den<1e-12)throw new Error('Angle requires distinct points.');return {kind:'angle',unit:'°',value:Math.acos(Math.max(-1,Math.min(1,dot(a,b)/den)))*180/Math.PI};}
 const b0=sub(positions[0],positions[1]),b1=sub(positions[2],positions[1]),b2=sub(positions[3],positions[2]),length=norm(b1);if(length<1e-12)throw new Error('Torsion requires distinct points.');const u=b1.map(v=>v/length),v=b0.map((x,i)=>x-dot(b0,u)*u[i]),w=b2.map((x,i)=>x-dot(b2,u)*u[i]);if(Math.min(norm(v),norm(w))<1e-12)throw new Error('Torsion is undefined for collinear points.');const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];return {kind:'torsion',unit:'°',value:Math.atan2(dot(cross,w),dot(v,w))*180/Math.PI};
}
