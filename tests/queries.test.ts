import test from 'node:test';import assert from 'node:assert/strict';
import {queryResidues,combineSelection} from '../src/engine/queries';
test('selection queries preserve author insertion codes and separate assembly copies',()=>{
 const residues=[{id:'A/42',chain:'A',number:42,insertion:'',name:'SER',kind:'protein'},{id:'A/42A',chain:'A',number:42,insertion:'A',name:'SER',kind:'protein'},{id:'A1/42',chain:'A1',number:42,insertion:'',name:'SER',kind:'protein'},{id:'A/-2',chain:'A',number:-2,insertion:'',name:'GLY',kind:'protein'}];
 assert.deepEqual(queryResidues(residues,{chain:'A',range:'42',name:'',kind:''}),['A/42']);assert.deepEqual(queryResidues(residues,{chain:'A',range:'42:42',name:'',kind:''}),['A/42','A/42A']);assert.deepEqual(queryResidues(residues,{chain:'A',range:'-3:-1',name:'',kind:''}),['A/-2']);assert.throws(()=>queryResidues(residues,{chain:'',range:'30:10',name:'',kind:''}),/after/);
});
test('selection set operations cannot carry stale source identities',()=>{
 assert.deepEqual(combineSelection(['a','stale'],['b'],'union',['a','b','c']),['a','b']);assert.deepEqual(combineSelection(['a','b'],['b'],'subtract',['a','b','c']),['a']);assert.deepEqual(combineSelection(['a'],[],'invert',['a','b']),['b']);
});
