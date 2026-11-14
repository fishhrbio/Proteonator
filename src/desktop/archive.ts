import {createHash} from 'node:crypto';
const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc32=(data:Buffer)=>{let crc=0xffffffff;for(const byte of data)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;};
export function reviewArchive(input:{name:string;data:Buffer}[]){
 if(!input.length||input.length>99)throw new Error('A review bundle needs 1–99 files.');const names=new Set<string>();let total=0;
 for(const f of input){if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(f.name)||names.has(f.name.toLowerCase())||f.name.toLowerCase()==='manifest.json')throw new Error('Unsafe or duplicate bundle filename.');names.add(f.name.toLowerCase());total+=f.data.length;}
 if(total>200*1024*1024)throw new Error('Review bundle exceeds 200 MiB.');
 const files=[...input,{name:'manifest.json',data:Buffer.from(JSON.stringify({format:'proteonator-review-bundle',version:'1',files:input.map(f=>({name:f.name,bytes:f.data.length,sha256:createHash('sha256').update(f.data).digest('hex')}))},null,2))}],local:Buffer[]=[],central:Buffer[]=[];let offset=0;
 for(const file of files){const name=Buffer.from(file.name,'utf8'),crc=crc32(file.data),header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50,0);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt32LE(crc,14);header.writeUInt32LE(file.data.length,18);header.writeUInt32LE(file.data.length,22);header.writeUInt16LE(name.length,26);const entry=Buffer.alloc(46);entry.writeUInt32LE(0x02014b50,0);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);entry.writeUInt16LE(0x800,8);entry.writeUInt32LE(crc,16);entry.writeUInt32LE(file.data.length,20);entry.writeUInt32LE(file.data.length,24);entry.writeUInt16LE(name.length,28);entry.writeUInt32LE(offset,42);local.push(header,name,file.data);central.push(entry,name);offset+=header.length+name.length+file.data.length;}
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,directory,end]);
}
