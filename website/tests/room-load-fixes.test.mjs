import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVerifiedUserCache } from '../server/auth-cache.mjs';
import { createHostedRoomService, SEEN_REFRESH_MS } from '../server/hosted-rooms.mjs';

const jwtWithExp = exp => `x.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.y`;

test('a verified login is checked with Supabase Auth once, then reused', async () => {
  let time = 0, lookups = 0;
  const cache = createVerifiedUserCache({ now: () => time });
  const lookup = async () => { lookups++; return { ok: true, userId: 'u1' }; };
  const token = jwtWithExp(10_000);
  for (let i = 0; i < 20; i++) assert.equal((await cache.verify(token, lookup)).userId, 'u1');
  assert.equal(lookups, 1);
  time = 5 * 60 * 1000 + 1; await cache.verify(token, lookup);
  assert.equal(lookups, 2, 're-checked after 5 minutes');
});
test('failed or expired logins are never reused', async () => {
  let time = 0, lookups = 0;
  const cache = createVerifiedUserCache({ now: () => time });
  const refuse = async () => { lookups++; return { ok: false }; };
  await cache.verify('bad.token.x', refuse); await cache.verify('bad.token.x', refuse);
  assert.equal(lookups, 2, 'failures always re-check');
  const ok = async () => { lookups++; return { ok: true, userId: 'u' }; };
  const shortLived = jwtWithExp(30); // expires at 30 s
  await cache.verify(shortLived, ok); time = 31_000; await cache.verify(shortLived, ok);
  assert.equal(lookups, 4, 'never kept past the token expiry');
});

function memoryStore() {
  const rows = new Map(), counts = { save: 0, limit: 0 };
  return {
    counts,
    async limit() { counts.limit++; return true; },
    async load(body) { const row = typeof body.invite === 'string' ? [...rows.values()].find(r => r.data.invite === body.invite) : rows.get(String(body.code || '').toUpperCase()); return row && structuredClone(row); },
    async save(code, version, data) {
      counts.save++;
      const row = rows.get(code);
      if ((row?.version || 0) !== version) return false;
      if (data === null) rows.delete(code); else rows.set(code, { data: structuredClone(data), version: version + 1 });
      return true;
    },
  };
}

test('check-ins mostly read: they save at most every few seconds and skip the rate-limit write', async () => {
  let time = 1_000_000;
  const store = memoryStore();
  const run = (action, body, user) => createHostedRoomService({ store, now: () => time, rtcConfig: async () => ({ iceServers: [], relayConfigured: false }) }).run(action, body, user);
  const host = await run('create', { settings: { layout: 'A', source: 'camera', template: null } }, 'host');
  const guest = await run('join', { invite: host.invite }, 'guest');
  const before = { ...store.counts };
  // 10 minutes of check-ins every 4 s from both people.
  for (let t = 0; t < 600_000; t += 4000) {
    time += 4000;
    const h = await run('state', { code: host.code, token: host.token }, 'host');
    const g = await run('state', { code: guest.code, token: guest.token }, 'guest');
    assert.equal(h.guest.online, true, `guest stays online for the host at ${t} ms`);
    assert.equal(g.host.online, true, `host stays online for the guest at ${t} ms`);
  }
  const checkIns = 2 * 150, saves = store.counts.save - before.save;
  assert.equal(store.counts.limit, before.limit, 'no rate-limit writes for check-ins');
  assert.ok(saves <= checkIns / 2 + 2, `at most every other check-in saves (saved ${saves} of ${checkIns})`);
  assert.ok(SEEN_REFRESH_MS < 15000 / 2, 'refresh is well inside the 15 s online window');
});
test('someone who stops checking in still goes offline', async () => {
  let time = 1_000_000;
  const store = memoryStore();
  const run = (action, body, user) => createHostedRoomService({ store, now: () => time, rtcConfig: async () => ({ iceServers: [], relayConfigured: false }) }).run(action, body, user);
  const host = await run('create', { settings: { layout: 'A', source: 'camera', template: null } }, 'host');
  const guest = await run('join', { invite: host.invite }, 'guest');
  time += 4000; await run('state', { code: guest.code, token: guest.token }, 'guest');
  time += 16000; // guest gone for 16 s
  assert.equal((await run('state', { code: host.code, token: host.token }, 'host')).guest.online, false);
});
test('ready and other changes still save immediately and are still rate limited', async () => {
  let time = 1_000_000;
  const store = memoryStore();
  const run = (action, body, user) => createHostedRoomService({ store, now: () => time, rtcConfig: async () => ({ iceServers: [], relayConfigured: false }) }).run(action, body, user);
  const host = await run('create', { settings: { layout: 'A', source: 'camera', template: null } }, 'host');
  const guest = await run('join', { invite: host.invite }, 'guest');
  const limits = store.counts.limit;
  time += 500; await run('ready', { code: host.code, token: host.token, ready: true }, 'host');
  time += 500; const state = await run('ready', { code: guest.code, token: guest.token, ready: true }, 'guest');
  assert.equal(state.bothReady, true);
  assert.equal(store.counts.limit, limits + 2);
});
