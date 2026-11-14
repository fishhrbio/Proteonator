export type QueryResidue={id:string;chain:string;number:number;insertion:string;name:string;kind:string};
export function queryResidues(residues:QueryResidue[],query:{chain:string;range:string;name:string;kind:string}){
 const rules=query.range.trim()?query.range.split(',').map(part=>{
  const token=part.trim(),range=/^(-?\d+)\s*:\s*(-?\d+)$/.exec(token)??/^(-?\d+)\s*-\s*(-?\d+)$/.exec(token);
  if(range){const a=Number(range[1]),b=Number(range[2]);if(a>b)throw new Error('Residue range starts after its end.');return (r:QueryResidue)=>r.number>=a&&r.number<=b;}
  const single=/^(-?\d+)([A-Za-z0-9]?)$/.exec(token);if(!single)throw new Error('Use author positions such as 42, 42A or ranges 1:20, separated by commas.');return (r:QueryResidue)=>r.number===Number(single[1])&&r.insertion===single[2];
 }):[];
 return residues.filter(r=>(!query.chain||r.chain===query.chain)&&(!query.name||r.name.toUpperCase().includes(query.name.toUpperCase()))&&(!query.kind||r.kind===query.kind)&&(!rules.length||rules.some(f=>f(r)))).map(r=>r.id);
}
export function combineSelection(current:string[],incoming:string[],operation:'set'|'union'|'subtract'|'intersect'|'invert',universe:string[]){
 const all=new Set(universe),a=new Set(current.filter(x=>all.has(x))),b=new Set(incoming.filter(x=>all.has(x)));
 if(operation==='set')return [...b];if(operation==='union')return [...new Set([...a,...b])];if(operation==='subtract')return [...a].filter(x=>!b.has(x));if(operation==='intersect')return [...a].filter(x=>b.has(x));return universe.filter(x=>!a.has(x));
}
