import test from 'node:test';
import assert from 'node:assert/strict';
import {unwrapReply} from '../src/renderer/desktop-client.js';
test('data envelopes preserve cancellation and actionable recovery in the renderer',()=>{
  assert.equal(unwrapReply({ok:true,value:42}),42);
  assert.throws(()=>unwrapReply({ok:false,error:{code:'CANCELLED',message:'Cancelled',recovery:'Run again'}}),
    (error:unknown)=>error instanceof Error && 'code' in error && error.code==='CANCELLED' && 'recovery' in error && error.recovery==='Run again');
});
