import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureSequence } from '../src/booth/capture.js';

function options(overrides = {}) {
  return { shots: [], count: 1, retake: null, method: 'manual', seconds: 3,
    signal: new AbortController().signal, onTaking() {}, onCountdown() {}, onShot() {}, takeShot: async () => 'photo', ...overrides };
}
test('flash illuminates before capture and switches off afterward', async () => {
  const events = [];
  await captureSequence(options({ flash: true, onFlash: lit => events.push(lit), wait: async ms => events.push(ms), takeShot: async () => { events.push('capture'); return 'photo'; } }));
  assert.deepEqual(events, [true, 450, 'capture', false]);
});
test('flash off preserves immediate manual capture', async () => {
  let flashes = 0, waits = 0;
  await captureSequence(options({ onFlash: () => flashes++, wait: async () => waits++ }));
  assert.equal(flashes, 0); assert.equal(waits, 0);
});
test('cancelling during illumination clears flash without replacing a photo', async () => {
  const controller = new AbortController(), events = [];
  let writes = 0, captures = 0;
  await assert.rejects(captureSequence(options({ signal: controller.signal, flash: true, onFlash: lit => events.push(lit), wait: async () => controller.abort(), onShot: () => writes++, takeShot: async () => captures++ })));
  assert.deepEqual(events, [true, false]); assert.equal(writes, 0); assert.equal(captures, 0);
});
test('failed retake clears flash and never overwrites existing photos', async () => {
  const events = [];
  let writes = 0;
  await assert.rejects(captureSequence(options({ shots: ['a', 'b', 'c'], count: 3, retake: 1, flash: true, onFlash: lit => events.push(lit), wait: async () => {}, onShot: () => writes++, takeShot: async () => { throw Error('Camera unavailable'); } })));
  assert.deepEqual(events, [true, false]); assert.equal(writes, 0);
});
test('timer flashes once per photo after each countdown', async () => {
  let now = 0;
  const times = [], events = [];
  await captureSequence(options({ count: 3, method: 'timer', flash: true, onFlash: lit => events.push(lit), wait: async ms => { now += ms; }, takeShot: async () => { times.push(now); return 'photo'; } }));
  assert.deepEqual(times, [3450, 7400, 11350]);
  assert.deepEqual(events, [true, false, true, false, true, false]);
});
