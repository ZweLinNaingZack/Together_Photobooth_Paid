import {test} from 'node:test';
import assert from 'node:assert/strict';
import {connectionRetry} from '../src/booth/connectionRetry.mjs';
test('camera setup retries temporary errors and then succeeds',async()=>{
 let calls=0;
 const result=await connectionRetry(async()=>{if(++calls<3) throw Object.assign(new Error(),{status:503});return 'connected';},()=>false,async()=>{});
 assert.equal(result,'connected');assert.equal(calls,3);
});
test('camera setup never retries lost membership and stops on unmount',async()=>{
 let calls=0;
 await assert.rejects(()=>connectionRetry(async()=>{calls++;throw Object.assign(new Error('not a member'),{status:403});},()=>false,async()=>{}),/not a member/);
 assert.equal(calls,1);
 let stopped=false;
 const result=await connectionRetry(async()=>{calls++;throw new Error('network');},()=>stopped,async()=>{stopped=true;});
 assert.equal(result,null);assert.equal(calls,2);
});
