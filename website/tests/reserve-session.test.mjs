import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reserveSession} from '../src/booth/reserveSession.mjs';
test('temporary reservation failure retries once and returns success',async()=>{let calls=0;const result=await reserveSession(async()=>++calls===1?{error:{code:''},status:0}:{data:{session_id:'same'}},()=>true,async()=>{});assert.equal(calls,2);assert.equal(result.data.session_id,'same');});
test('business errors and missing migrations are not retried',async()=>{for(const code of ['P0001','42501','PGRST202']){let calls=0;await reserveSession(async()=>{calls++;return {error:{code},status:500}},()=>true,async()=>{});assert.equal(calls,1);}});
test('leaving cancels retry',async()=>{let calls=0;await assert.rejects(reserveSession(async()=>{calls++;return {error:{},status:503}},()=>false,async()=>{}),/ended/);assert.equal(calls,1);});
