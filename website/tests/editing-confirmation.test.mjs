import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditingConfirmation } from '../src/booth/editingConfirmation.mjs';

test('cancel never charges or releases navigation to the editor', async () => {
  let debits=0, state;
  const gate=createEditingConfirmation(async()=>{debits++;},value=>{state=value;});
  const result=gate.request();
  assert.equal(state.open,true); assert.equal(debits,0);
  gate.cancel(); assert.equal(await result,false); assert.equal(debits,0);
});
test('double confirmation debits once and editing waits for the committed result', async () => {
  let commit, debits=0, entered=false;
  const gate=createEditingConfirmation(()=>{debits++;return new Promise(resolve=>{commit=resolve;});},()=>{});
  const first=gate.request(); assert.equal(gate.request(),first);
  void first.then(approved=>{entered=approved;});
  const confirmation=gate.confirm(); await gate.confirm();
  gate.cancel(); // Cannot cancel a debit already in flight.
  assert.equal(debits,1); assert.equal(entered,false);
  commit(); await confirmation; await first;
  assert.equal(entered,true);
});
test('billing failure stays on capture and allows another explicit confirmation', async () => {
  let calls=0, state, entered=false;
  const gate=createEditingConfirmation(async()=>{if(++calls===1)throw new Error('Balance unavailable');},value=>{state=value;});
  const result=gate.request(); void result.then(value=>{entered=value;});
  await gate.confirm();
  assert.equal(entered,false); assert.equal(state.open,true); assert.match(state.error,/Balance/);
  await gate.confirm(); assert.equal(await result,true); assert.equal(calls,2);
});
test('leaving while a server response is pending cannot mount editing later', async () => {
  let commit;
  const gate=createEditingConfirmation(()=>new Promise(resolve=>{commit=resolve;}),()=>{});
  const result=gate.request(), confirmation=gate.confirm();
  gate.dispose(); commit(); await confirmation;
  assert.equal(await result,false);
});
