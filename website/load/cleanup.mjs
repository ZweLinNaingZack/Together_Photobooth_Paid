// Removes everything the load test created on the STAGING project: rooms, reservations,
// sessions, ledger rows, wallets, then the test accounts themselves (in that order,
// because the wallet tables block deleting a user that still has rows).
// Usage (from website/):  node load/cleanup.mjs
import { loadSettings, admin, listLoadTestUsers, inBatches } from './env.mjs';

const settings = loadSettings();
const users = await listLoadTestUsers(settings);
if (!users.length) { console.log('No load-test accounts found. Nothing to clean.'); process.exit(0); }
console.log(`Cleaning ${users.length} load-test accounts on ${settings.supabase} …`);

const ids = users.map(user => user.id);
for (let i = 0; i < ids.length; i += 50) {
  const list = ids.slice(i, i + 50).join(',');
  await admin(settings, `/rest/v1/together_rooms?data->host->>userId=in.(${list})`, { method: 'DELETE' });
  for (const table of ['together_reservations', 'together_sessions', 'together_credit_ledger', 'together_accounts'])
    await admin(settings, `/rest/v1/${table}?user_id=in.(${list})`, { method: 'DELETE' });
}
await admin(settings, '/rest/v1/together_trial_mailboxes?mailbox=like.load-*@example.com', { method: 'DELETE' });
await inBatches(users, 8, user => admin(settings, `/auth/v1/admin/users/${user.id}`, { method: 'DELETE' }));
console.log('Done. All load-test data removed.');
