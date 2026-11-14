import test from 'node:test';
import assert from 'node:assert/strict';
import {assessTarget,assemble,makeProtein,cleave,trim,amidate,disulfide,composition,profile,translate,backTranslate,parseFasta,emptyWorkspace} from '../src/sequence/domain';
import {SequenceWorkspaceSchema} from '../src/sequence/contracts';

test('RNA back-translation preserves identity, exact alternatives and deterministic provenance',()=>{
 const a=backTranslate('MLKGS',{molecule:'rna',tableId:11,method:'seeded',seed:123,usage:null,usageSource:''});
 const b=backTranslate('MLKGS',{molecule:'rna',tableId:11,method:'seeded',seed:123,usage:null,usageSource:''});
 assert.deepEqual(a,b);assert.equal(a.possibleEncodings,'288');assert.equal(translate(a.nucleotides,'rna',11,'segment').protein,'MLKGS');assert.deepEqual(a.codons[1],['CUA','CUC','CUG','CUU','UUA','UUG']);assert.equal(a.status,'designed-coding-segment');
});
test('genetic-code and initiation semantics are explicit and contextual codes fail',()=>{
 assert.equal(translate('GTGAAATAA','dna',11,'complete-cds').protein,'MK');assert.equal(translate('GTGAAA','dna',11,'segment').protein,'VK');
 assert.equal(translate('UGA','rna',2,'segment').protein,'W');assert.equal(translate('UGA','rna',1,'segment').protein,'');
 assert.throws(()=>translate('ATGTAGAAA','dna',1,'segment'),/Internal stop/);assert.throws(()=>translate('ATGAAA','dna',11,'complete-cds'),/terminal stop/);assert.throws(()=>translate('ATG','dna',28,'segment'),/context/);assert.throws(()=>translate('AUN','rna',11,'segment'),/ambiguous/);
});
test('usage weights require provenance, preserve amino acids and do not select a zero weight',()=>{
 assert.throws(()=>backTranslate('K',{molecule:'dna',tableId:1,method:'usage',seed:0,usage:{AAA:1,AAG:0},usageSource:''}),/sourced/);
 const c=backTranslate('KKK',{molecule:'dna',tableId:1,method:'usage',seed:0,usage:{AAA:0,AAG:1},usageSource:'Explicit test table'});assert.equal(c.nucleotides,'AAGAAGAAG');
});
test('FASTA molecule types are declared, not guessed; unsupported sequence letters reject',()=>{
 assert.equal(parseFasta('>a\nACGU','rna')[0].sequence,'ACGU');assert.throws(()=>parseFasta('>a\nACGU','dna'),/alphabet/);assert.throws(()=>parseFasta('AX*','protein'),/Resolve/);assert.equal(parseFasta('>a\nACD\n>b\nMKK','protein').length,2);
});
test('construct cleavage retains native identities and trimming is not amidation',()=>{
 const modules=[{id:'tag',name:'Tag',role:'tag',sequence:'HHHHHH',source:'Test fixture'},{id:'target',name:'Target',role:'target',sequence:'CACACACPG',source:'Generic chemistry fixture'}];
 const encoded=assemble(modules),products=cleave(encoded,[6]);assert.deepEqual(products.map(s=>s.sequence),['HHHHHH','CACACACPG']);assert.equal(products[1].residueIds[0],'target:1');
 const stripped=trim(products[1],1,8);assert.equal(stripped.cTerm,'acid');const mature=amidate(products[1]);assert.equal(mature.sequence,'CACACACP');assert.equal(mature.cTerm,'amide');assert.equal(products[1].sequence,'CACACACPG');
});
test('elemental accounting verifies water, disulfide and terminal amide independently',()=>{
 const gly=composition(makeProtein('Glycine','G'));assert.deepEqual(gly.formula,{C:2,H:5,N:1,O:2,S:0});assert.ok(Math.abs(gly.neutralMonoisotopicDa-75.03202840472)<1e-9);
 const cys=makeProtein('Cysteine pair','CC'),oxidized=disulfide(cys,1,2);assert.equal(composition(cys).formula.H-composition(oxidized).formula.H,2);
 const precursor=makeProtein('Generic donor','PG'),amide=amidate(precursor);assert.deepEqual(composition(amide).formula,{C:5,H:10,N:2,O:1,S:0});assert.throws(()=>disulfide(oxidized,1,2),/already/);assert.throws(()=>cleave(oxidized,[1]),/linked/);
});
test('charge and hydropathy have independent known values and chemistry effects',()=>{
 // Independent reference: Biopython 1.86 IsoelectricPoint('INGAR').charge_at_pH(7).
 const s=makeProtein('Reference','INGAR'),p=profile(s,7,1);assert.ok(Math.abs(p.chargeAtPH-.7600916142893016)<1e-12);assert.ok(Math.abs(p.isoelectricPoint!-9.75)<.01);assert.equal(profile(makeProtein('Isoleucine','I'),7,1).meanHydropathy,4.5);
 const acid=makeProtein('Proline','P'),amide={...acid,cTerm:'amide' as const};assert.ok(profile(amide,7,1).chargeAtPH>profile(acid,7,1).chargeAtPH+.99);
});
test('portable sequence graphs reject orphan parents, cyclic graphs and mutated candidate sources',()=>{
 const w=emptyWorkspace(),p=makeProtein('Test','MK');w.states=[p];w.activeStateId=p.id;assert.equal(SequenceWorkspaceSchema.safeParse(w).success,true);
 const bad=structuredClone(w);bad.states[0].parentIds=['missing'];assert.equal(SequenceWorkspaceSchema.safeParse(bad).success,false);
 const r=trim(p,1,1);w.states.push(r);p.parentIds=[r.id];assert.equal(SequenceWorkspaceSchema.safeParse(w).success,false);
});
test('target sequence identity alone never certifies terminal chemistry or bond pairing',()=>{
 const acid=makeProtein('Target','CACACACP'),chemistry={nTerm:'free' as const,cTerm:'amide' as const,disulfides:[[1,7] as [number,number]]};assert.equal(assessTarget(acid,acid.sequence,chemistry).meetsDesign,false);
 const amide=amidate(makeProtein('Precursor',acid.sequence+'G'));assert.equal(assessTarget(amide,acid.sequence,chemistry).meetsDesign,false);assert.equal(assessTarget(disulfide(amide,1,7),acid.sequence,chemistry).meetsDesign,true);assert.equal(assessTarget(disulfide(amide,1,3),acid.sequence,chemistry).meetsDesign,false);assert.equal(assessTarget(acid,acid.sequence,{nTerm:'unspecified',cTerm:'unspecified',disulfides:null}).meetsDesign,null);
});
