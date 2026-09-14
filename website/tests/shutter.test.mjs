import test from 'node:test';
import assert from 'node:assert/strict';
import { captureSequence } from '../src/booth/capture.js';

for (const method of ['manual', 'timer']) {
  test(`${method} shows a shutter only after a successful capture, even with screen flash off`, async () => {
    const events = [];
    await captureSequence({ shots: [], count: 3, retake: null, method, seconds: 3,
      signal: new AbortController().signal, flash: false, wait: async () => {},
      takeShot: async () => { events.push('capture'); return 'photo'; },
      onShutter: () => events.push('shutter'), onShot: () => events.push('save'),
      onCountdown: () => {}, onTaking: () => {},
    });
    assert.deepEqual(events, Array.from({ length: method === 'manual' ? 1 : 3 }, () => ['capture', 'shutter', 'save']).flat());
  });
}
test('failed capture does not flash a successful shutter', async () => {
  let flashed = false;
  await assert.rejects(captureSequence({ shots: [], count: 1, method: 'manual', seconds: 3,
    signal: new AbortController().signal, takeShot: async () => { throw new Error('camera unavailable'); },
    onShutter: () => { flashed = true; }, onShot: () => {}, onCountdown: () => {}, onTaking: () => {},
  }));
  assert.equal(flashed, false);
});
