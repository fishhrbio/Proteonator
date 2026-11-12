import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parsePdb,getActiveAtoms,runGeometry} from '../src/engine/index.js';
import {requestFor} from '../tests/engine-helpers.js';
const base=path.resolve(import.meta.dirname,'..');
const results=[];
for(const filename of ['structures/1CRN.pdb','structures/1BRS.pdb','synthetic/crambin-grid-48.pdb']){
  const text=readFileSync(path.join(base,'fixtures',filename),'utf8');
  const synthetic=filename.startsWith('synthetic/');
  const runs=[];
  for(let i=0;i<4;i++){
    const start=performance.now();
    const s=parsePdb(text,{name:filename,kind:synthetic?'synthetic-test':'bundled-fixture',evidenceClass:synthetic?'synthetic-fixture':'observed-structure'});
    const importMs=performance.now()-start;
    const analyzeStart=performance.now();
    const r=filename.includes('1BRS')?runGeometry(s,requestFor(s,'A','D')):null;
    if(i>0) runs.push({importMs,analysisMs:r?performance.now()-analyzeStart:null,rssBytes:process.memoryUsage().rss,sourceAtomCount:s.atoms.length,activeAtomCount:getActiveAtoms(s).length,evaluatedPairCount:r?.summary.evaluatedPairCount??null});
  }
  results.push({fixture:filename,interpretation:synthetic?'Artificial copies for parser load only; not an observed assembly':'Source coordinate fixture',warmupRuns:1,measuredRuns:runs});
}
const report={measuredAt:new Date().toISOString(),environment:{platform:os.platform(),release:os.release(),arch:os.arch(),node:process.version,cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,totalMemoryBytes:os.totalmem()},scope:'Engine import and geometry only; RSS snapshots are not peak memory; no rendering/FPS claim',results};
mkdirSync(path.join(base,'evidence'),{recursive:true});
writeFileSync(path.join(base,'evidence/engine-benchmark.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
