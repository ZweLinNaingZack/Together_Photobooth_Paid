import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoomService } from '../server/rooms.mjs';
import { captureSequence } from '../src/booth/capture.js';
const settings = { layout: 'A', template: null, source: 'camera' };
const auth = room => ({ code: room.code, token: room.token });

test('signaling is private to room members and only returns the other participant’s messages', () => {
  const service = createRoomService();
  const host = service.run('create', { settings }), guest = service.run('join', { code: host.code });
  const stranger = service.run('create', { settings });
  const message = { type: 'hello', session: 'guest-camera' };
  assert.throws(() => service.run('signal', { ...auth(guest), message }), /Both people/);
  service.run('ready', { ...auth(host), ready: true }); service.run('ready', { ...auth(guest), ready: true });
  service.run('signal', { ...auth(guest), message });
  assert.deepEqual(service.run('signals', { ...auth(host), after: 0 }).messages, [{ id: 1, message }]);
  assert.deepEqual(service.run('signals', { ...auth(guest), after: 0 }).messages, []);
  assert.deepEqual(service.run('signals', { ...auth(host), after: 1 }).messages, []);
  assert.throws(() => service.run('signals', { code: host.code, token: stranger.token, after: 0 }), /no longer/);
  assert.throws(() => service.run('signals', { ...auth(host), after: -1 }), /cursor/);
  assert.throws(() => service.run('signal', { ...auth(host), message: { type: 'photo', session: 'x' } }), /Invalid/);
  assert.throws(() => service.run('signal', { ...auth(host), message: { type: 'offer', session: 'x', description: 'x'.repeat(25000) } }), /Invalid/);
  service.run('leave', auth(guest));
  assert.throws(() => service.run('signals', { ...auth(guest), after: 0 }), /no longer/);
  const replacement = service.run('join', { code: host.code });
  assert.deepEqual(service.run('signals', { ...auth(replacement), after: 0 }).messages, []);
});

test('old signaling expires instead of replaying a previous camera negotiation', () => {
  let time = 0; const service = createRoomService({ now: () => time });
  const host = service.run('create', { settings }), guest = service.run('join', { code: host.code });
  service.run('ready', { ...auth(host), ready: true }); service.run('ready', { ...auth(guest), ready: true });
  service.run('signal', { ...auth(guest), message: { type: 'hello', session: 'old' } });
  time = 40000; service.run('state', auth(host));
  time = 61000;
  assert.deepEqual(service.run('signals', { ...auth(host), after: 0 }).messages, []);
});

test('route batches deliver once and invalid batches do not partly write', () => {
  const service = createRoomService();
  const host = service.run('create', { settings }), guest = service.run('join', { code: host.code });
  service.run('ready', { ...auth(host), ready: true }); service.run('ready', { ...auth(guest), ready: true });
  const messages = Array.from({length:8}, (_,id) => ({id:String(id),type:'candidate',session:'camera',candidate:{candidate:'test'}}));
  service.run('signal', {...auth(host),messages});
  service.run('signal', {...auth(host),messages});
  assert.equal(service.run('signals',{...auth(guest),after:0}).messages.length,8);
  assert.throws(() => service.run('signal',{...auth(host),messages:[{id:'new',type:'hello',session:'camera'},null]}), /Invalid/);
  assert.throws(() => service.run('signal',{...auth(host),messages:[...messages,messages[0]]}), /Invalid/);
  assert.equal(service.run('signals',{...auth(guest),after:0}).messages.length,8);
});

test('capture waits for a shared photo to arrive before starting the next photo', async () => {
  const events = [];
  await captureSequence({ shots: [], count: 2, retake: null, method: 'timer', seconds: 0, signal: new AbortController().signal,
    takeShot: async () => { events.push('capture'); return 'image'; },
    onShot: async index => { await new Promise(resolve => setTimeout(resolve, 5)); events.push(`received ${index}`); },
    onCountdown: () => {}, onTaking: () => {}, wait: async () => {} });
  assert.deepEqual(events, ['capture', 'received 0', 'capture', 'received 1']);
});

test('failed photo transfer stops the sequence without capturing additional slots', async () => {
  let captures = 0;
  await assert.rejects(captureSequence({ shots: [], count: 3, retake: null, method: 'timer', seconds: 0, signal: new AbortController().signal,
    takeShot: async () => { captures++; return 'image'; }, onShot: async () => { throw new Error('disconnected'); },
    onCountdown: () => {}, onTaking: () => {}, wait: async () => {} }), /disconnected/);
  assert.equal(captures, 1);
});
