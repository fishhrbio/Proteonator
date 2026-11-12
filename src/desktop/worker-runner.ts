import {Worker} from 'node:worker_threads';
export function startWorker(filename:string,payload:unknown,options:{timeoutMs?:number;onStart?:(worker:Worker,abort:()=>void)=>void;onFinish?:(worker:Worker)=>void}={}):Promise<unknown>{
  return new Promise((resolve,reject)=>{
    const worker=new Worker(filename,{workerData:payload,resourceLimits:{maxOldGenerationSizeMb:512}});
    let finished=false;
    const finish=(value:unknown,error=false)=>{
      if(finished)return;finished=true;clearTimeout(timeout);options.onFinish?.(worker);void worker.terminate();
      error?reject(value):resolve(value);
    };
    const fail=(message:string,code='COMPUTATION_FAILED')=>finish({code,message,recovery:'Retry with a smaller input or restart the calculation.'},true);
    const timeout=setTimeout(()=>fail('The worker exceeded the calculation time limit.'),options.timeoutMs??30000);
    worker.once('message',message=>message?.ok===true?finish(message.value):message?.ok===false&&message.error?finish(message.error,true):fail('The worker returned an invalid response.'));
    worker.once('error',()=>fail('The local worker failed.'));
    worker.once('exit',code=>{if(!finished)fail(`Worker exited before returning a result (${code}).`);});
    options.onStart?.(worker,()=>fail('The calculation was cancelled.','CANCELLED'));
  });
}
