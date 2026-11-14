import {Resvg} from '@resvg/resvg-js';import {readFile,writeFile} from 'node:fs/promises';
const svg=await readFile(new URL('../assets/logo.svg',import.meta.url),'utf8');
const chunks=[];
for(const [size,type]of [[16,'icp4'],[32,'icp5'],[64,'icp6'],[128,'ic07'],[256,'ic08'],[512,'ic09'],[1024,'ic10']]){
 const png=new Resvg(svg,{fitTo:{mode:'width',value:size}}).render().asPng();const header=Buffer.alloc(8);header.write(type);header.writeUInt32BE(8+png.length,4);chunks.push(header,png);
 if(size===512||size===1024)await writeFile(new URL('../assets/icon-'+size+'.png',import.meta.url),png);
}
const body=Buffer.concat(chunks),header=Buffer.alloc(8);header.write('icns');header.writeUInt32BE(body.length+8,4);await writeFile(new URL('../assets/icon.icns',import.meta.url),Buffer.concat([header,body]));
