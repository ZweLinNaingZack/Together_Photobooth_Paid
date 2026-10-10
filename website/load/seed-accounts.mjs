// Creates verified test accounts on the STAGING project and gives hosts test points.
// Usage (from website/):  node load/seed-accounts.mjs [pairs]      default 60 pairs (50 booths + 10 spare for the spike)
// Safe to run again: existing accounts are reused and points are only added once.
import { randomUUID } from 'node:crypto';
import { loadSettings, hostEmail, guestEmail, admin, listLoadTestUsers, inBatches } from './env.mjs';

const pairs = Number(process.argv[2] || 60);
if (!Number.isInteger(pairs) || pairs < 1 || pairs > 200) throw new Error('Pairs must be a whole number from 1 to 200.');
const settings = loadSettings();
const POINTS = 10000; // enough for 100 test sessions per host

console.log(`Seeding ${pairs} host/guest pairs on ${settings.supabase} …`);
const existing = new Map((await listLoadTestUsers(settings)).map(user => [user.email, user.id]));

const wanted = [];
for (let n = 1; n <= pairs; n++) wanted.push({ email: hostEmail(n), host: true }, { email: guestEmail(n), host: false });

let created = 0, topped = 0;
await inBatches(wanted, 8, async account => {
  let id = existing.get(account.email);
  if (!id) {
    // email_confirm: the booth requires a verified account, exactly like real users.
    const user = await admin(settings, '/auth/v1/admin/users', { method: 'POST', body: { email: account.email, password: settings.password, email_confirm: true, user_metadata: { loadtest: true } } });
    id = user.id; created++;
  }
  // The wallet row the app normally creates on first visit.
  await admin(settings, '/rest/v1/together_accounts', { method: 'POST', body: { user_id: id }, prefer: 'resolution=ignore-duplicates' });
  if (account.host) {
    const rows = await admin(settings, `/rest/v1/together_credit_ledger?user_id=eq.${id}&kind=eq.topup&select=id&limit=1`);
    if (!rows.length) {
      await admin(settings, '/rest/v1/together_credit_ledger', { method: 'POST', body: { user_id: id, points: POINTS, kind: 'topup', reference: randomUUID() } });
      topped++;
    }
  }
});
console.log(`Done. ${created} accounts created, ${wanted.length - created} reused, ${topped} hosts given ${POINTS} test points.`);
