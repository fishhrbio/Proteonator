export interface CameraPacket { timestamp: number; key: boolean; data: Uint8Array }
const MAX_BYTES=64*1024*1024;
function join(parts:Uint8Array[]):Uint8Array {const size=parts.reduce((n,p)=>n+p.length,0);if(size>MAX_BYTES)throw new Error('Camera movie exceeded 64 MiB.');const out=new Uint8Array(size);let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;}
function uint(value:number):Uint8Array {const a:number[]=[];do{a.unshift(value%256);value=Math.floor(value/256);}while(value);return new Uint8Array(a);}
function size(value:number):Uint8Array {let width=1;while(value>=2**(7*width)-1)width++;const out=new Uint8Array(width);for(let i=width-1;i>=0;i--){out[i]=value%256;value=Math.floor(value/256);}out[0]|=1<<(8-width);return out;}
function element(id:number,...parts:Uint8Array[]):Uint8Array {const data=join(parts);return join([uint(id),size(data.length),data]);}
const integer=(id:number,value:number)=>element(id,uint(value));
const text=(id:number,value:string)=>element(id,new TextEncoder().encode(value));
function float(id:number,value:number):Uint8Array {const data=new Uint8Array(8);new DataView(data.buffer).setFloat64(0,value);return element(id,data);}

// A bounded, video-only WebM. Each encoded packet keeps its explicit media timestamp;
// rendering speed cannot stretch the presentation timeline. No audio or input-file parsing.
export function cameraWebm(packets:CameraPacket[],codec:'vp9'|'vp8',seconds:number,width=1280,height=720,fps=12):Uint8Array {
 if(!Number.isInteger(seconds)||seconds<5||seconds>20||fps!==12||width!==1280||height!==720||!['vp9','vp8'].includes(codec))throw new Error('Unsupported camera movie settings.');
 if(packets.length!==seconds*fps||!packets[0]?.key)throw new Error('The movie encoder did not produce every expected frame.');
 let bytes=0;
 for(let i=0;i<packets.length;i++){const p=packets[i];if(!Number.isSafeInteger(p.timestamp)||p.timestamp!==Math.round(i*1e6/fps)||!p.data.length)throw new Error('The movie encoder returned an invalid frame timeline.');bytes+=p.data.length;if(bytes>MAX_BYTES)throw new Error('Camera movie exceeded 64 MiB.');}
 const header=element(0x1a45dfa3,integer(0x4286,1),integer(0x42f7,1),integer(0x42f2,4),integer(0x42f3,8),text(0x4282,'webm'),integer(0x4287,4),integer(0x4285,2));
 const info=element(0x1549a966,integer(0x2ad7b1,1000000),float(0x4489,seconds*1000),text(0x4d80,'Proteonator'),text(0x5741,'Proteonator'));
 const tracks=element(0x1654ae6b,element(0xae,integer(0xd7,1),integer(0x73c5,1),integer(0x83,1),integer(0x23e383,Math.round(1e9/fps)),text(0x86,codec==='vp9'?'V_VP9':'V_VP8'),element(0xe0,integer(0xb0,width),integer(0xba,height))));
 const clusters=packets.map(p=>element(0x1f43b675,integer(0xe7,Math.round(p.timestamp/1000)),element(0xa3,new Uint8Array([0x81,0,0,p.key?0x80:0]),p.data)));
 return join([header,element(0x18538067,info,tracks,...clusters)]);
}
