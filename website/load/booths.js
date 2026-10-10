// k6 load test: many duo booths at once against the STAGING site.
// Each virtual user (VU) runs ONE complete duo booth, playing both the host and the guest,
// with the same server calls and timing as the real app:
//   sign in → host creates room + reserves session → guest joins → both ready →
//   camera-relay credentials + connection messages → 1.5 s check-ins for HOLD seconds
//   → host confirms editing (charges test points) → both leave.
// Video is not simulated: it goes phone-to-phone and never reaches these servers.
//
// Usage (from website/):
//   k6 run -e BOOTHS=2 load/booths.js                   quick check
//   k6 run -e BOOTHS=50 load/booths.js                  the real test (ramps up over RAMP seconds)
//   k6 run -e BOOTHS=50 -e SPIKE=10 load/booths.js      plus 10 booths created at once mid-test
// Options: HOLD (seconds in the booth, default 600), RAMP (default 300), RTC=0 to skip relay credentials,
//          STATE_EVERY (check-in seconds once both are ready; default 4 like the app, 1.5 = old app).
import http from 'k6/http';
import { sleep } from 'k6';
import exec from 'k6/execution';
import { Counter, Rate } from 'k6/metrics';

// ---- settings (read from website/.env.loadtest; secrets stay on your computer) ----
function parseEnv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && !line.trim().startsWith('#')) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}
const file = parseEnv(open('../.env.loadtest'));
const SITE = (file.STAGING_SITE_URL || '').replace(/\/$/, '');
const SUPABASE = (file.STAGING_SUPABASE_URL || '').replace(/\/$/, '');
const KEY = file.STAGING_SUPABASE_PUBLISHABLE_KEY;
const PASSWORD = file.LOADTEST_PASSWORD;
const BOOTHS = Number(__ENV.BOOTHS || 2), SPIKE = Number(__ENV.SPIKE || 0);
const HOLD = Number(__ENV.HOLD || 600), RAMP = Number(__ENV.RAMP || (BOOTHS > 5 ? 300 : 10));
const RTC = __ENV.RTC !== '0';
const STATE_EVERY = Number(__ENV.STATE_EVERY || 4);
if (!SITE || !SUPABASE || !KEY || !PASSWORD) throw new Error('website/.env.loadtest is incomplete. See load/README.md.');
for (const [name, value] of [['STAGING_SITE_URL', SITE], ['STAGING_SUPABASE_URL', SUPABASE]])
  if (!/^https?:\/\//.test(value)) throw new Error(`${name} must start with https:// (for example https://your-staging-url.vercel.app).`);

// ---- what we measure ----
const boothsCompleted = new Rate('booths_completed');      // booths that reached "confirm editing" and left cleanly
const busyConflicts = new Counter('room_busy_conflicts');  // "The booth is busy updating" (database save conflicts)
const rateLimited = new Counter('rate_limited');           // 429 responses
const serverErrors = new Counter('server_errors');         // 5xx responses

const actions = ['sign_in', 'create', 'reserve', 'join', 'ready', 'state', 'rtc', 'signal', 'signals', 'complete', 'leave'];
const thresholds = {
  http_req_failed: ['rate<0.01'],          // under 1% failed requests
  booths_completed: ['rate>0.99'],         // nearly every booth finishes
  room_busy_conflicts: ['count<1'],
  'http_req_duration{name:state}': ['p(95)<1000'], // check-ins answered within 1 s for 95% of calls
};
for (const name of actions) if (!thresholds[`http_req_duration{name:${name}}`]) thresholds[`http_req_duration{name:${name}}`] = ['p(95)<5000']; // listed per action in the summary

const scenarios = {
  booths: { executor: 'per-vu-iterations', vus: BOOTHS, iterations: 1, maxDuration: `${RAMP + HOLD + 300}s`, gracefulStop: '60s' },
};
// Spike: extra booths created at the same moment, halfway through the hold.
if (SPIKE > 0) scenarios.spike = { executor: 'per-vu-iterations', vus: SPIKE, iterations: 1, startTime: `${RAMP + Math.round(HOLD / 2)}s`, maxDuration: `${HOLD + 300}s`, gracefulStop: '60s', env: { SPIKE_GROUP: '1' } };
export const options = { scenarios, thresholds, summaryTrendStats: ['avg', 'med', 'p(95)', 'max'], noConnectionReuse: false };

// ---- helpers ----
const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
const pad = n => String(n).padStart(3, '0');

function track(response) {
  if (response.status === 429) rateLimited.add(1);
  if (response.status >= 500) serverErrors.add(1);
  if (response.status === 409 && /busy updating/i.test(response.body || '')) busyConflicts.add(1);
  return response;
}
function signIn(email) {
  const response = track(http.post(`${SUPABASE}/auth/v1/token?grant_type=password`, JSON.stringify({ email, password: PASSWORD }), { headers: { apikey: KEY, 'Content-Type': 'application/json' }, tags: { name: 'sign_in' } }));
  if (response.status !== 200) throw new Error(`sign-in failed for ${email}: ${response.status} ${response.body}`);
  return response.json('access_token');
}
/** Room API on the staging site (same calls the app makes to /api/rooms/*). */
function room(jwt, action, body) {
  const response = track(http.post(`${SITE}/api/rooms/${action}`, JSON.stringify(body), { headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' }, tags: { name: action }, timeout: '30s' }));
  if (response.status !== 200) {
    if (response.status === 0) throw new Error(`${action}: could not reach ${SITE}. Check STAGING_SITE_URL in .env.loadtest.`);
    if (/<html/i.test(response.body || '')) throw new Error(`${action}: ${response.status}, got a web page instead of the booth API. Turn off Vercel Deployment Protection for the staging project (README step 7).`);
    throw new Error(`${action}: ${response.status} ${response.body}`);
  }
  return response.json();
}
/** Supabase database functions (reservation / charging), called directly like the app does. */
function rpc(jwt, fn, body, name) {
  const response = track(http.post(`${SUPABASE}/rest/v1/rpc/${fn}`, JSON.stringify(body), { headers: { apikey: KEY, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' }, tags: { name } }));
  if (response.status !== 200) throw new Error(`${name}: ${response.status} ${response.body}`);
  return response.json();
}
// A realistic-size connection message (offers carry ~3–5 KB of text).
const fakeSdp = 'v=0\r\n' + 'a=fake-line-for-load-testing\r\n'.repeat(120);

// ---- one booth ----
export default function () {
  // Booth number → test accounts load-host-NNN / load-guest-NNN. Spike booths use the accounts after the main ones.
  const n = (__ENV.SPIKE_GROUP ? BOOTHS : 0) + exec.scenario.iterationInTest + 1;
  // Spread booth starts across the ramp so load grows gradually.
  if (!__ENV.SPIKE_GROUP && BOOTHS > 1) sleep((RAMP * (n - 1)) / BOOTHS);
  let host, guest, hostJwt, guestJwt, sessionId = uuid(), completed = false;
  try {
    hostJwt = signIn(`load-host-${pad(n)}@example.com`);
    guestJwt = signIn(`load-guest-${pad(n)}@example.com`);

    // Host: create room, then reserve the session for it (the "Next" on the layout screen).
    host = room(hostJwt, 'create', { settings: { layout: 'A', source: 'camera', template: null } });
    const reserved = rpc(hostJwt, 'together_session_action', { request_id: sessionId, operation: 'reserve', room_code: host.code }, 'reserve');
    sessionId = reserved.session_id || sessionId;

    // Guest joins with the code; both get ready.
    sleep(2 + Math.random() * 3);
    guest = room(guestJwt, 'join', { code: host.code });
    room(hostJwt, 'ready', { code: host.code, token: host.token, ready: true });
    room(guestJwt, 'ready', { code: guest.code, token: guest.token, ready: true });
    let both = false;
    for (let i = 0; i < 20 && !both; i++) { both = room(hostJwt, 'state', { code: host.code, token: host.token }).bothReady; if (!both) sleep(1); }
    if (!both) throw new Error('both people never became ready');
    rpc(hostJwt, 'together_session_action', { request_id: sessionId, operation: 'reserve', room_code: host.code }, 'reserve'); // the app re-confirms on entering

    // Cameras connecting: relay credentials + a burst of connection messages, polled every 0.8 s.
    if (RTC) { room(hostJwt, 'rtc', { code: host.code, token: host.token }); room(guestJwt, 'rtc', { code: guest.code, token: guest.token }); }
    const hostSession = uuid(), guestSession = uuid();
    room(guestJwt, 'signal', { code: guest.code, token: guest.token, messages: [{ type: 'hello', session: guestSession, id: uuid() }] });
    room(hostJwt, 'signal', { code: host.code, token: host.token, messages: [{ type: 'offer', session: hostSession, to: guestSession, id: uuid(), description: { type: 'offer', sdp: fakeSdp } }] });
    room(guestJwt, 'signal', { code: guest.code, token: guest.token, messages: [{ type: 'answer', session: hostSession, id: uuid(), description: { type: 'answer', sdp: fakeSdp } }] });
    const candidates = () => Array.from({ length: 4 }, () => ({ type: 'candidate', session: hostSession, id: uuid(), candidate: { candidate: 'candidate:1 1 udp 2122260223 192.0.2.1 54400 typ host', sdpMid: '0', sdpMLineIndex: 0 } }));
    room(hostJwt, 'signal', { code: host.code, token: host.token, messages: candidates() });
    room(guestJwt, 'signal', { code: guest.code, token: guest.token, messages: candidates() });
    let hostCursor = 0, guestCursor = 0;
    for (let i = 0; i < 6; i++) {
      hostCursor = room(hostJwt, 'signals', { code: host.code, token: host.token, after: hostCursor }).cursor;
      guestCursor = room(guestJwt, 'signals', { code: guest.code, token: guest.token, after: guestCursor }).cursor;
      sleep(0.8);
    }

    // In the booth: each person checks in every STATE_EVERY seconds (the app uses 4 s once both
    // are ready; use -e STATE_EVERY=1.5 to reproduce the old app) and polls connection messages every 5 s.
    const end = Date.now() + HOLD * 1000;
    let nextState = 0, nextSignals = 0;
    while (Date.now() < end) {
      const now = Date.now();
      if (now >= nextState) {
        nextState = now + STATE_EVERY * 1000;
        room(hostJwt, 'state', { code: host.code, token: host.token });
        room(guestJwt, 'state', { code: guest.code, token: guest.token });
      }
      if (now >= nextSignals) {
        nextSignals = now + 5000;
        hostCursor = room(hostJwt, 'signals', { code: host.code, token: host.token, after: hostCursor }).cursor;
        guestCursor = room(guestJwt, 'signals', { code: guest.code, token: guest.token, after: guestCursor }).cursor;
      }
      sleep(Math.max(0.05, (Math.min(nextState, nextSignals) - Date.now()) / 1000));
    }

    // Host confirms editing: completes the session (charges 100 test points).
    const receipt = rpc(hostJwt, 'together_complete_session', { request_id: sessionId, room_code: host.code }, 'complete');
    if (!receipt || receipt.completed !== true) throw new Error('session was not completed');
    room(guestJwt, 'leave', { code: guest.code, token: guest.token });
    room(hostJwt, 'leave', { code: host.code, token: host.token });
    completed = true;
  } catch (error) {
    console.error(`booth ${n}: ${error.message}`);
    // Best effort: free the reservation and room so the next run starts clean.
    try { if (hostJwt) rpc(hostJwt, 'together_session_action', { request_id: sessionId, operation: 'release' }, 'leave'); } catch (ignored) { /* best effort */ }
    try { if (host && hostJwt) room(hostJwt, 'leave', { code: host.code, token: host.token }); } catch (ignored) { /* best effort */ }
  } finally {
    boothsCompleted.add(completed);
  }
}

// ---- readable summary at the end (also saved as JSON next to this script) ----
export function handleSummary(data) {
  const m = data.metrics, ms = v => (v === undefined ? '–' : `${Math.round(v)} ms`);
  const lines = ['', '=== Together Photobooth load test ===', `Booths: ${BOOTHS}${SPIKE ? ` + spike ${SPIKE}` : ''}, hold ${HOLD}s, ramp ${RAMP}s`, ''];
  const done = m.booths_completed?.values;
  lines.push(`Booths completed:        ${done ? `${Math.round(done.rate * 100)}% (${done.passes} of ${done.passes + done.fails})` : '–'}`);
  lines.push(`Failed requests:         ${m.http_req_failed ? `${(m.http_req_failed.values.rate * 100).toFixed(2)}%` : '–'}`);
  lines.push(`"Booth busy" conflicts:  ${m.room_busy_conflicts?.values.count ?? 0}`);
  lines.push(`Rate limited (429):      ${m.rate_limited?.values.count ?? 0}`);
  lines.push(`Server errors (5xx):     ${m.server_errors?.values.count ?? 0}`);
  lines.push(`Check-in every:          ${STATE_EVERY}s`);
  lines.push('', 'Response times by step (typical / slowest 5% / worst):');
  for (const name of actions) {
    const metric = m[`http_req_duration{name:${name}}`];
    if (metric && metric.values.count !== 0) lines.push(`  ${name.padEnd(9)} ${ms(metric.values.med).padStart(8)} / ${ms(metric.values['p(95)']).padStart(8)} / ${ms(metric.values.max).padStart(8)}`);
  }
  lines.push('', 'Goals:');
  for (const [name, metric] of Object.entries(m)) if (metric.thresholds && !/\{name:(?!state)/.test(name)) lines.push(`  ${Object.values(metric.thresholds).every(t => t.ok) ? 'PASS' : 'FAIL'}  ${name}`);
  lines.push('');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return { stdout: lines.join('\n'), [`load/results-${stamp}.json`]: JSON.stringify(data, null, 1) };
}
