export type RNAHit={start:number;end:number;strand:1|-1;score:number;family:string;role?:string;evalue?:number;inclusion?:string;truncation?:string;note?:string};
export function parseRNAEvidence(text:string,format:'cmsearch'|'cmscan'|'trnascan',recordName:string,length:number):RNAHit[]{
 if(text.length>4*1024*1024||!recordName||!Number.isInteger(length)||length<1)throw new Error('Invalid RNA evidence input.');
 const hits:RNAHit[]=[];
 for(const line of text.split(/\r?\n/)){
  const t=line.trim();if(!t||t.startsWith('#'))continue;const f=t.split(/\s+/);
  if(format==='trnascan'){
   if(/^(Sequence|Name|[-=]+)/.test(t))continue;
   if(f.length<9||!/^\d+$/.test(f[1]))throw new Error('Expected standard tRNAscan-SE tabular output.');
   if(f[0]!==recordName)continue;const from=Number(f[2]),to=Number(f[3]),score=Number(f[8]);
   hits.push({start:Math.min(from,to),end:Math.max(from,to),strand:from<=to?1:-1,score,family:'tRNA-'+f[4],role:'Predicted tRNA region',note:'Anticodon '+f[5]+'; intron '+f[6]+'–'+f[7]+(f.length>9?'; '+f.slice(9).join(' '):'')});
  }else{
   if(f.length<17||!['cm','hmm'].includes(f[4])||!['+','-'].includes(f[9])||!['!','?'].includes(f[16]))throw new Error('Expected Infernal tblout format 1 or 3; format 2 is not supported.');
   const sequenceName=format==='cmsearch'?f[0]:f[2];if(sequenceName!==recordName)continue;
   const from=Number(f[7]),to=Number(f[8]),score=Number(f[14]),evalue=Number(f[15]),strand=f[9]==='+'?1:-1;
   if((from<=to?1:-1)!==strand&&from!==to)throw new Error('Infernal coordinates disagree with the reported strand.');
   hits.push({start:Math.min(from,to),end:Math.max(from,to),strand,score,evalue,family:(format==='cmsearch'?f[2]:f[0])+' '+(format==='cmsearch'?f[3]:f[1]),inclusion:f[16]==='!'?'Meets recorded inclusion threshold':'Reporting threshold only',truncation:f[10],note:'Imported '+format+' evidence; scores are not calibrated probabilities.'});
  }
  if(hits.length>10000)throw new Error('RNA evidence exceeds 10,000 hits.');
 }
 for(const h of hits)if(!Number.isInteger(h.start)||!Number.isInteger(h.end)||h.start<1||h.end>length||!Number.isFinite(h.score)||h.evalue!==undefined&&(!Number.isFinite(h.evalue)||h.evalue<0))throw new Error('RNA evidence has invalid coordinates, score or E-value.');
 return hits;
}
