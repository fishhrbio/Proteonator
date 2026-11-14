import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseRNAEvidence} from '../src/sequence/rna-evidence';
test('Infernal imports preserve direction, thresholds and truncation without inventing an RNA class',()=>{
 const t='# fixture based on Infernal format 1 columns\nsequence - tRNA RF00005 cm 1 71 88 18 - 5\' 1 .5 0 39.2 1e-8 ! supplied description';
 assert.deepEqual(parseRNAEvidence(t,'cmsearch','sequence',100).map(h=>[h.start,h.end,h.strand,h.score,h.evalue,h.truncation,h.inclusion]),[[18,88,-1,39.2,1e-8,"5'",'Meets recorded inclusion threshold']]);
 assert.deepEqual(parseRNAEvidence(t,'cmsearch','other',100),[]);
 assert.throws(()=>parseRNAEvidence(t,'cmsearch','sequence',70),/invalid coordinates/);
 assert.throws(()=>parseRNAEvidence(t.replace('88 18 -','88 18 +'),'cmsearch','sequence',100),/strand/);
});
test('tRNAscan evidence is a prediction and does not identify historical translating tRNA molecules',()=>{
 const hits=parseRNAEvidence('Sequence tRNA Bounds Type\nName # Begin End\n-----\nseq 1 90 12 Ala TGC 0 0 56.7 possible_pseudo','trnascan','seq',100);
 assert.equal(hits[0].strand,-1);assert.equal(hits[0].family,'tRNA-Ala');assert.match(hits[0].role!,/Predicted/);assert.match(hits[0].note!,/possible_pseudo/);
 assert.deepEqual(parseRNAEvidence('# no hits','cmscan','seq',100),[]);
 assert.throws(()=>parseRNAEvidence('broken output','cmscan','seq',100),/Expected Infernal/);
});
