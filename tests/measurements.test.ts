import test from 'node:test';
import assert from 'node:assert/strict';
import {measurePositions} from '../src/engine/measurements';
test('Cartesian measurements have analytic values and a documented torsion sign',()=>{
 assert.deepEqual(measurePositions([[0,0,0],[3,4,0]]),{kind:'distance',unit:'Å',value:5});
 assert.equal(measurePositions([[1,0,0],[0,0,0],[0,1,0]]).value,90);
 assert.equal(measurePositions([[1,0,0],[0,0,0],[0,1,0],[0,1,1]]).value,-90);
 assert.equal(measurePositions([[11,-5,2],[10,-5,2],[10,-4,2],[10,-4,3]]).value,-90);
 assert.throws(()=>measurePositions([[0,0,0],[0,0,0],[1,1,1]]),/distinct/);assert.throws(()=>measurePositions([[0,0,0],[1,0,0],[2,0,0],[3,0,0]]),/collinear/);assert.throws(()=>measurePositions([[NaN,0,0],[1,0,0]]),/finite/);
});
