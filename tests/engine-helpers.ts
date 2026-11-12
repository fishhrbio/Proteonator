import type { GeometryRequest, NormalizedStructure } from '../src/contracts/index.js';

export type PdbAtomOptions={serial?:number;name?:string;residue?:string;chain?:string;seq?:number;ins?:string;alt?:string;occupancy?:number|null;element?:string;record?:'ATOM'|'HETATM';x?:number;y?:number;z?:number;bFactor?:number};
/** Builds fixed-column records only; numerical expectations in tests are independent of engine code. */
export function pdbAtom(o:PdbAtomOptions={}):string{
  const chars=Array<string>(80).fill(' ');
  const set=(offset:number,value:string)=>{for(let i=0;i<value.length;i++) chars[offset+i]=value[i]!;};
  const name=o.name??'CA';
  set(0,(o.record??'ATOM').padEnd(6));set(6,String(o.serial??1).padStart(5));
  set(12,name.length<4?` ${name.padEnd(3)}`:name);set(16,o.alt??'');set(17,(o.residue??'ALA').padStart(3));
  set(21,o.chain??'A');set(22,String(o.seq??1).padStart(4));set(26,o.ins??'');
  set(30,(o.x??0).toFixed(3).padStart(8));set(38,(o.y??0).toFixed(3).padStart(8));set(46,(o.z??0).toFixed(3).padStart(8));
  if(o.occupancy!==null) set(54,(o.occupancy??1).toFixed(2).padStart(6));
  set(60,(o.bFactor??20).toFixed(2).padStart(6));set(76,(o.element??'C').padStart(2));return chars.join('');
}
export function requestFor(s:NormalizedStructure,a='A',b='B'):GeometryRequest{
  const modelId=s.selectedModelId;
  return {schemaVersion:'1.0.0',jobId:'job_test',kind:'interface-geometry',structureId:s.id,modelId,
    partnerAChainKeys:s.chains.filter(c=>c.authAsymId===a&&c.modelId===modelId).map(c=>c.key),
    partnerBChainKeys:s.chains.filter(c=>c.authAsymId===b&&c.modelId===modelId).map(c=>c.key),contactCutoffAngstrom:4,clashOverlapThresholdAngstrom:0.4};
}
