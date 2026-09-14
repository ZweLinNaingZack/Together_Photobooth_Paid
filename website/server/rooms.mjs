import { templateCatalog } from '../src/booth/templateCatalog.js';
import { randomBytes, randomInt } from 'node:crypto';
import { createTurnProvider } from './turn.mjs';
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const token = () => randomBytes(24).toString('hex');
const layouts = new Set(['A','B','C','D','E','G','K','N']);
const templates = new Set(['breaking-news','catch-yours','endless-moments','film-negative','movie-time','nutrition-label','red-music-player','story-today','ticket-memories']);
function fail(message, status = 400) { return Object.assign(new Error(message), { status }); }
export function createRoomService({ now = Date.now, rtcConfig = createTurnProvider() } = {}) {
  const rooms = new Map(), limits = new Map();
  function state(room) {
    const hostOnline = now() - room.host.seen <= 15000, guestOnline = !!room.guest && now() - room.guest.seen <= 15000;
    if (!hostOnline) room.host.ready = false;
    if (!guestOnline && room.guest) room.guest.ready = false;
    return { code: room.code, settings: room.settings, expiresAt: room.expires, host: { online: hostOnline, ready: room.host.ready }, guest: { online: guestOnline, ready: !!room.guest?.ready && guestOnline }, bothReady: hostOnline && guestOnline && room.host.ready && room.guest.ready };
  }
  return { run(action, body = {}, address = 'local') {
    for (const [code, room] of rooms) if (room.expires <= now() || now() - room.host.seen > 60000) rooms.delete(code);
    for (const [key, bucket] of limits) if (bucket.until <= now()) limits.delete(key);
    if (action === 'create' || action === 'join') {
      const key = `${address}:${action}`, bucket = limits.get(key) || { count: 0, until: now() + 60000 };
      bucket.count++; limits.set(key, bucket);
      if (bucket.count > 20) throw fail('Too many attempts. Wait a minute and try again.', 429);
    }
    if (action === 'create') {
      const s = body.settings;
      if (!s || !layouts.has(s.layout) || !['camera','upload'].includes(s.source) || (s.template !== null && !(s.layout === 'A' && templates.has(s.template) || Object.hasOwn(templateCatalog, s.template) && templateCatalog[s.template].layout === s.layout))) throw fail('Please choose a valid layout and design first.');
      if (rooms.size >= 500) throw fail('All booths are busy. Please try again shortly.', 503);
      let code; do { code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join(''); } while (rooms.has(code));
      const room = { code, invite: token(), expires: now() + 45 * 60000, settings: { layout: s.layout, source: s.source, template: s.template }, host: { token: token(), ready: false, seen: now() }, guest: null, signals: [], signalId: 0 };
      rooms.set(code, room); return { ...state(room), token: room.host.token, invite: room.invite, role: 'host' };
    }
    if (action === 'join') {
      const room = typeof body.invite === 'string' ? [...rooms.values()].find(r => r.invite === body.invite) : rooms.get(String(body.code || '').trim().toUpperCase());
      if (!room) throw fail('That booth was not found or has expired. Check the code with your person.', 404);
      if (room.guest && now() - room.guest.seen <= 60000) throw fail('This booth already has two people.', 409);
      room.host.ready = false; room.signals = []; room.guest = { token: token(), ready: false, seen: now() };
      return { ...state(room), token: room.guest.token, role: 'guest' };
    }
    const room = rooms.get(body.code);
    if (!room) throw fail('This booth has ended or expired. Create or join another booth.', 404);
    const role = typeof body.token !== 'string' ? null : room.host.token === body.token ? 'host' : room.guest?.token === body.token ? 'guest' : null;
    if (!role) throw fail('You are no longer connected to this booth. Please join again.', 403);
    state(room); room[role].seen = now();
    if (action === 'rtc') {
      if (room.settings.source !== 'camera' || !state(room).bothReady) throw fail('Both people must be ready before connecting.', 409);
      const participant = room[role];
      if (participant.rtc) return participant.rtc;
      if (participant.rtcRetryAt > now()) throw fail('Please wait a moment before reconnecting the camera relay.', 429);
      participant.rtcRetryAt = now() + 10000;
      participant.rtc = Promise.resolve().then(rtcConfig).catch(error => { participant.rtc = null; throw error; });
      return participant.rtc;
    }
    // Only authenticated room members can exchange connection metadata. Photos
    // and video travel directly between browsers, never through this queue.
    if (action === 'signal') {
      const message = body.message;
      if (!room.guest || !room.host.ready || !room.guest.ready) throw fail('Both people must be ready before connecting.', 409);
      if (!message || !['hello', 'offer', 'answer', 'candidate'].includes(message.type) || typeof message.session !== 'string' || message.session.length > 80 || JSON.stringify(message).length > 24000) throw fail('Invalid camera connection message.');
      room.signals = room.signals.filter(s => now() - s.at < 60000);
      if (typeof message.id === 'string' && room.signals.some(s => s.from === role && s.message.id === message.id)) return { sent: true };
      if (room.signals.length >= 256) throw fail('Connection busy. Please reconnect in a moment.', 429);
      room.signals.push({ id: ++room.signalId, from: role, at: now(), message });
      return { sent: true };
    }
    if (action === 'signals') {
      if (!Number.isSafeInteger(body.after) || body.after < 0) throw fail('Invalid connection cursor.');
      room.signals = room.signals.filter(s => now() - s.at < 60000);
      return { cursor: room.signalId, messages: room.signals.filter(s => s.from !== role && s.id > body.after).map(({ id, message }) => ({ id, message })) };
    }
    if (action === 'leave') { if (role === 'host') rooms.delete(room.code); else { room.guest = null; room.host.ready = false; } return { left: true }; }
    if (action === 'ready') { if (typeof body.ready !== 'boolean') throw fail('Choose ready or not ready.'); room[role].ready = body.ready; }
    else if (action !== 'state') throw fail('Unknown room action.', 404);
    return state(room);
  } };
}
export function roomMiddleware(service = createRoomService()) {
  return async (req, res, next) => {
    const path = req.url?.split('?')[0];
    if (!path?.startsWith('/api/rooms/')) return next();
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'application/json');
    try {
      if (req.method !== 'POST') throw fail('Method not allowed.', 405);
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) throw fail('Request origin is not allowed.', 403);
      const maxBody = path === '/api/rooms/signal' ? 26000 : 4096;
      let raw = ''; for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > maxBody) throw fail('Request too large.', 413); }
      let body; try { body = JSON.parse(raw || '{}'); } catch { throw fail('Invalid request.'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail('Invalid request.');
      res.end(JSON.stringify(await service.run(path.slice('/api/rooms/'.length), body, req.socket.remoteAddress)));
    } catch (error) { res.statusCode = error.status || 500; res.end(JSON.stringify({ error: error.status ? error.message : 'The booth service is unavailable. Try again.' })); }
  };
}
