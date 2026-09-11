import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTurnProvider } from '../server/turn.mjs';
import { createRoomService } from '../server/rooms.mjs';
import { sendSignal } from '../src/booth/signaling.js';

test('missing TURN settings explicitly report direct-only mode without calling a provider', async () => {
  const provide = createTurnProvider({ env: {}, fetchImpl: () => { throw new Error('unexpected network'); } });
  const result = await provide();
  assert.equal(result.relayConfigured, false);
  assert.deepEqual(result.iceServers, [{ urls: 'stun:stun.cloudflare.com:3478' }]);
});

test('TURN master key stays server-side and browser receives only expiring credentials', async () => {
  const provide = createTurnProvider({ env: { TURN_KEY_ID: 'test-key-id', TURN_KEY_API_TOKEN: 'master-secret-for-test' }, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://rtc.live.cloudflare.com/v1/turn/keys/test-key-id/credentials/generate-ice-servers');
    assert.equal(options.headers.Authorization, 'Bearer master-secret-for-test');
    assert.equal(JSON.parse(options.body).ttl, 3600);
    return { ok: true, json: async () => ({ iceServers: [{ urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turn:turn.cloudflare.com:53?transport=udp', 'turns:turn.cloudflare.com:443?transport=tcp'], username: 'temporary-user', credential: 'temporary-password', extra: 'not-for-client' }] }) };
  } });
  const result = await provide();
  assert.equal(result.relayConfigured, true);
  assert.equal(result.iceServers[0].urls.length, 2);
  assert.equal(result.iceServers[0].credential, 'temporary-password');
  assert.ok(!JSON.stringify(result).includes('master-secret-for-test'));
  assert.ok(!JSON.stringify(result).includes('not-for-client'));
});

test('invalid TURN settings and provider failures never silently claim a working relay', async () => {
  await assert.rejects(createTurnProvider({ env: { TURN_KEY_ID: 'only-key' } })(), /relay could not/);
  const env = { TURN_KEY_ID: 'id', TURN_KEY_API_TOKEN: 'secret' };
  await assert.rejects(createTurnProvider({ env, fetchImpl: async () => ({ ok: false }) })(), /relay could not/);
  await assert.rejects(createTurnProvider({ env, fetchImpl: async () => ({ ok: true, json: async () => ({ iceServers: [{ urls: 'turn:example.com' }] }) }) })(), /relay could not/);
});

test('only ready authenticated room members can obtain credentials, cached per participant', async () => {
  let calls = 0;
  const service = createRoomService({ rtcConfig: async () => { calls++; return { iceServers: [], relayConfigured: true }; } });
  const host = service.run('create', { settings: { layout: 'A', template: null, source: 'camera' } });
  const auth = member => ({ code: member.code, token: member.token });
  assert.throws(() => service.run('rtc', { code: host.code, token: 'wrong' }), /no longer/);
  assert.throws(() => service.run('rtc', auth(host)), /Both people/);
  assert.equal(calls, 0);
  const guest = service.run('join', { code: host.code });
  service.run('ready', { ...auth(host), ready: true }); service.run('ready', { ...auth(guest), ready: true });
  await Promise.all([service.run('rtc', auth(host)), service.run('rtc', auth(host))]);
  assert.equal(calls, 1);
  await service.run('rtc', auth(guest)); assert.equal(calls, 2);
  service.run('leave', auth(guest));
  assert.throws(() => service.run('rtc', auth(guest)), /no longer/);
});

test('lost signaling response retries without duplicating the accepted message', async () => {
  const service = createRoomService();
  const host = service.run('create', { settings: { layout: 'A', template: null, source: 'camera' } }), guest = service.run('join', { code: host.code });
  const auth = member => ({ code: member.code, token: member.token });
  service.run('ready', { ...auth(host), ready: true }); service.run('ready', { ...auth(guest), ready: true });
  let calls = 0;
  await sendSignal(async message => { service.run('signal', { ...auth(guest), message }); if (++calls === 1) throw new Error('response lost'); }, { type: 'hello', session: 'session', id: 'same-id-on-retry' }, () => false, async () => {});
  assert.equal(calls, 2);
  assert.equal(service.run('signals', { ...auth(host), after: 0 }).messages.length, 1);
});

test('stopping a connection cancels pending signaling retries', async () => {
  let calls = 0, stopped = false;
  await sendSignal(async () => { calls++; throw new Error('offline'); }, {}, () => stopped, async () => { stopped = true; });
  assert.equal(calls, 1);
});
