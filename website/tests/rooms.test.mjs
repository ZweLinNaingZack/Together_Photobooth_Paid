import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRoomService, roomMiddleware } from '../server/rooms.mjs';
const settings = { layout: 'A', template: 'film-negative', source: 'camera' };
const auth = room => ({ code: room.code, token: room.token });
test('creator settings travel with invitation; both must independently be ready', () => {
  const service = createRoomService(), host = service.run('create', { settings });
  assert.throws(() => service.run('state', { code: host.code }), /no longer connected/);
  assert.match(host.code, /^[A-Z2-9]{6}$/); assert.equal(host.invite.length, 48);
  assert.equal(host.bothReady, false);
  assert.equal(service.run('ready', { ...auth(host), ready: true }).bothReady, false);
  const guest = service.run('join', { code: host.code.toLowerCase() });
  assert.deepEqual(guest.settings, settings); assert.notEqual(guest.token, host.token); assert.equal(guest.invite, undefined);
  assert.equal(service.run('ready', { ...auth(guest), ready: true }).bothReady, false);
  assert.equal(service.run('ready', { ...auth(host), ready: true }).bothReady, true);
  assert.equal(service.run('ready', { ...auth(guest), ready: false }).bothReady, false);
  assert.equal(service.run('state', auth(host)).token, undefined);
});
test('rooms reject extra guests, wrong credentials, and invalid selections', () => {
  const service = createRoomService(), host = service.run('create', { settings });
  service.run('join', { invite: host.invite });
  assert.throws(() => service.run('join', { code: host.code }), /two people/);
  assert.throws(() => service.run('state', { code: host.code, token: 'wrong' }), /no longer connected/);
  assert.throws(() => service.run('create', { settings: { ...settings, layout: 'F' } }), /valid layout/);
  assert.throws(() => service.run('create', { settings: { ...settings, layout: 'B' } }), /valid layout/);
  assert.throws(() => service.run('join', { code: 'BAD123' }), /not found/);
});
test('leaving, stale presence, and expiry reset readiness or close rooms', () => {
  let time = 1000; const service = createRoomService({ now: () => time });
  const host = service.run('create', { settings }), guest = service.run('join', { code: host.code });
  service.run('ready', { ...auth(host), ready: true }); service.run('ready', { ...auth(guest), ready: true });
  time += 16000;
  assert.equal(service.run('state', auth(host)).bothReady, false);
  service.run('leave', auth(guest));
  assert.equal(service.run('state', auth(host)).guest.online, false);
  const replacement = service.run('join', { code: host.code }); assert.equal(replacement.role, 'guest');
  service.run('leave', auth(host)); assert.throws(() => service.run('state', auth(replacement)), /ended or expired/);
  const expired = service.run('create', { settings }); time += 45 * 60000;
  assert.throws(() => service.run('join', { code: expired.code }), /expired/);
});
test('repeated code guessing is rate limited', () => {
  const service = createRoomService();
  for (let i = 0; i < 20; i++) assert.throws(() => service.run('join', { code: 'BAD' }), /not found/);
  assert.throws(() => service.run('join', { code: 'BAD' }), /Too many attempts/);
});
test('HTTP API connects two clients and rejects cross-origin mutations', async () => {
  const handler = roomMiddleware();
  const server = http.createServer((req, res) => handler(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const post = async (action, body, requestOrigin = origin) => {
    const response = await fetch(`${origin}/api/rooms/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: requestOrigin }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  };
  try {
    const host = await post('create', { settings }); assert.equal(host.status, 200);
    const guest = await post('join', { invite: host.data.invite }); assert.equal(guest.status, 200);
    await post('ready', { ...auth(host.data), ready: true });
    assert.equal((await post('ready', { ...auth(guest.data), ready: true })).data.bothReady, true);
    assert.equal((await post('leave', auth(host.data), 'https://another-site.example')).status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
