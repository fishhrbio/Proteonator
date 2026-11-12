const error=(code:string,message:string,recovery:string)=>({code,message,recovery});
/** The only remote request is a user-selected public RCSB accession. */
export async function retrievePublicStructure(raw:unknown,fetcher:typeof fetch=fetch,timeoutMs=10000):Promise<{text:string;metadata:Record<string,unknown>}> {
  if(typeof raw!=='string'||!/^[A-Za-z0-9]{4}$/.test(raw)) throw error('INVALID_INPUT','Enter a four-character PDB accession.','Use letters and digits, such as 1CRN.');
  const accession=raw.toUpperCase(),url=`https://files.rcsb.org/download/${accession}.cif`,signal=AbortSignal.timeout(timeoutMs);
  try {
    const response=await fetcher(url,{signal,redirect:'error',cache:'no-store'});
    if(!response.ok) throw error('INVALID_INPUT',`RCSB returned HTTP ${response.status}.`,'Check the accession or open a local file.');
    if(Number(response.headers.get('content-length'))>5*1024*1024) {await response.body?.cancel();throw error('RESOURCE_LIMIT','Downloaded structure exceeds 5 MiB.','Use a smaller structure.');}
    const reader=response.body?.getReader();
    if(!reader) throw error('OFFLINE','RCSB returned no coordinate body.','Retry later or open a local file.');
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>5*1024*1024){await reader.cancel();throw error('RESOURCE_LIMIT','Downloaded structure exceeds 5 MiB.','Use a smaller structure.');}chunks.push(value);}
    let text:string;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(Buffer.concat(chunks));}catch{throw error('INVALID_INPUT','RCSB response is not valid UTF-8.','Open a valid local mmCIF file.');}
    return {text,metadata:{name:`${accession}.cif`,kind:'remote-accession',accession,sourceUrl:url,retrievedAt:new Date().toISOString(),evidenceClass:'observed-structure'}};
  } catch(e:any) {
    if(e?.recovery)throw e;
    throw error('OFFLINE',signal.aborted?'RCSB retrieval timed out.':'RCSB retrieval is unavailable.','Check the connection or open a local PDB/mmCIF file.');
  }
}
