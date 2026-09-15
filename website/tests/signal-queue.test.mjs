import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSignalQueue } from '../src/booth/signaling.js';

test('ICE burst is serialized and answer precedes queued candidates', async () => {
  let active = 0, maximum = 0;
  const delivered = [];
  const queue = createSignalQueue(async message => {
    active++; maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 1));
    delivered.push(message); active--;
  });
  const burst = Array.from({length:32}, (_, id) => queue({type:'candidate', id}));
  burst.push(queue({type:'answer', id:'answer'}));
  await Promise.all(burst);
  assert.equal(maximum, 1);
  assert.equal(delivered[1].type, 'answer');
  assert.equal(new Set(delivered.map(message => message.id)).size, 33);
});

test('cancelling a camera discards its pending messages', async () => {
  let stopped = false, calls = 0;
  const queue = createSignalQueue(async () => { calls++; stopped = true; }, () => stopped);
  await Promise.all([queue({type:'candidate'}), queue({type:'offer'})]);
  assert.equal(calls, 1);
});
