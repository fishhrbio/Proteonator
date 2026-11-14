import {cameraWebm,type CameraPacket} from '../engine/camera-webm';

export async function encodeCameraMovie(canvas:HTMLCanvasElement,seconds:number,draw:(frame:number)=>Promise<void>,cancelled:()=>boolean):Promise<Blob> {
 if(!Number.isInteger(seconds)||seconds<5||seconds>20)throw new Error('Choose an integer duration from 5 to 20 seconds.');
 const packets:CameraPacket[]=[];let failure:Error|null=null;let bytes=0;
 let config:VideoEncoderConfig|undefined,codec:'vp9'|'vp8'='vp9';
 for(const candidate of ['vp09.00.10.08','vp8']){
  const proposed:VideoEncoderConfig={codec:candidate,width:1280,height:720,bitrate:3500000,framerate:12,latencyMode:'realtime',hardwareAcceleration:'prefer-software'};
  if((await VideoEncoder.isConfigSupported(proposed)).supported){config=proposed;codec=candidate==='vp8'?'vp8':'vp9';break;}
 }
 if(!config)throw new Error('A supported WebM encoder is unavailable in this runtime.');
 const encoder=new VideoEncoder({output:chunk=>{bytes+=chunk.byteLength;if(bytes>64*1024*1024){failure=new Error('Camera movie exceeded 64 MiB.');return;}const data=new Uint8Array(chunk.byteLength);chunk.copyTo(data);packets.push({timestamp:chunk.timestamp,key:chunk.type==='key',data});},error:error=>{failure=error;}});
 try{
  encoder.configure(config);
  for(let index=0;index<seconds*12;index++){
   if(cancelled())throw new Error('Camera presentation cancelled.');if(failure)throw failure;
   await draw(index);
   if(cancelled())throw new Error('Camera presentation cancelled.');
   const frame=new VideoFrame(canvas,{timestamp:Math.round(index*1e6/12),duration:Math.round((index+1)*1e6/12)-Math.round(index*1e6/12)});
   try{encoder.encode(frame,{keyFrame:index%24===0});}finally{frame.close();}
   if(encoder.encodeQueueSize>=4)await encoder.flush();
  }
  await encoder.flush();if(failure)throw failure;if(cancelled())throw new Error('Camera presentation cancelled.');
  const data=cameraWebm(packets,codec,seconds);return new Blob([data as Uint8Array<ArrayBuffer>],{type:'video/webm'});
 }finally{if(encoder.state!=='closed')encoder.close();}
}
