import {writeFile,rename,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';

/** Replace the destination only after a complete successful write beside it. */
export async function atomicWrite(filename:string,bytes:string|Uint8Array,io={writeFile,rename,unlink}):Promise<void> {
  const temporary=path.join(path.dirname(filename),`.${path.basename(filename)}.${randomUUID()}.tmp`);
  try {
    await io.writeFile(temporary,bytes,{flag:'wx'});
    await io.rename(temporary,filename);
  } finally {await io.unlink(temporary).catch(()=>{});}
}
