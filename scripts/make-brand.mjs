import {Resvg} from '@resvg/resvg-js';
import {readFile,writeFile} from 'node:fs/promises';
const svg=await readFile(new URL('../assets/logo.svg',import.meta.url),'utf8');
const images=[];
for(const size of [16,24,32,48,64,128,256]){
 const png=new Resvg(svg,{fitTo:{mode:'width',value:size}}).render().asPng();images.push({size,png});
 if(size===256)await writeFile(new URL('../assets/icon.png',import.meta.url),png);
}
const head=Buffer.alloc(6+16*images.length);head.writeUInt16LE(1,2);head.writeUInt16LE(images.length,4);let offset=head.length;
images.forEach(({size,png},i)=>{const p=6+i*16;head[p]=head[p+1]=size===256?0:size;head.writeUInt16LE(1,p+4);head.writeUInt16LE(32,p+6);head.writeUInt32LE(png.length,p+8);head.writeUInt32LE(offset,p+12);offset+=png.length;});
await writeFile(new URL('../assets/icon.ico',import.meta.url),Buffer.concat([head,...images.map(x=>x.png)]));
const sidebar=`<svg xmlns="http://www.w3.org/2000/svg" width="164" height="314" viewBox="0 0 164 314"><rect width="164" height="314" fill="#080D0B"/><path d="M0 42H164M0 272H164" stroke="#315747"/><g transform="translate(23 65) scale(.46)">${svg.replace(/<\/?svg[^>]*>/g,'')}</g><text x="82" y="210" text-anchor="middle" font-family="Segoe UI" font-size="17" fill="#e8f1fa">Proteonator</text><text x="82" y="232" text-anchor="middle" font-family="Segoe UI" font-size="10" fill="#65e1d0">MOLECULAR EXPLORER</text><text x="82" y="292" text-anchor="middle" font-family="Segoe UI" font-size="11" fill="#a1b4c9">1.2</text></svg>`;
const rendered=new Resvg(sidebar).render(),width=rendered.width,height=rendered.height,pixels=rendered.pixels,stride=Math.ceil(width*3/4)*4,bmp=Buffer.alloc(54+stride*height);bmp.write('BM');bmp.writeUInt32LE(bmp.length,2);bmp.writeUInt32LE(54,10);bmp.writeUInt32LE(40,14);bmp.writeInt32LE(width,18);bmp.writeInt32LE(height,22);bmp.writeUInt16LE(1,26);bmp.writeUInt16LE(24,28);bmp.writeUInt32LE(stride*height,34);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4,j=54+(height-1-y)*stride+x*3;bmp[j]=pixels[i+2];bmp[j+1]=pixels[i+1];bmp[j+2]=pixels[i];}await writeFile(new URL('../assets/installer-sidebar.bmp',import.meta.url),bmp);
