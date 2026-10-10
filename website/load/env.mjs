// Shared settings for the Node load-test helpers (seed + cleanup).
// Reads website/.env.loadtest and refuses to run against the production Supabase project.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const website = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Minimal KEY=value parser (ignores blank lines and # comments). */
export function parseEnv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && !line.trim().startsWith('#')) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

export function loadSettings() {
  const file = join(website, '.env.loadtest');
  if (!existsSync(file)) throw new Error('Missing website/.env.loadtest. See load/README.md, step 10.');
  const env = parseEnv(readFileSync(file, 'utf8'));
  for (const key of ['STAGING_SITE_URL', 'STAGING_SUPABASE_URL', 'STAGING_SUPABASE_PUBLISHABLE_KEY', 'STAGING_SUPABASE_SERVICE_ROLE_KEY', 'LOADTEST_PASSWORD'])
    if (!env[key]) throw new Error(`${key} is missing in website/.env.loadtest`);
  for (const key of ['STAGING_SITE_URL', 'STAGING_SUPABASE_URL'])
    if (!/^https?:\/\//.test(env[key])) throw new Error(`${key} must start with https:// (for example https://your-staging-url.vercel.app).`);
  if (env.LOADTEST_PASSWORD.length < 12) throw new Error('LOADTEST_PASSWORD must be at least 12 characters.');
  // Safety: never seed or delete accounts in the real project.
  const productionFile = join(website, '.env');
  if (existsSync(productionFile)) {
    const production = parseEnv(readFileSync(productionFile, 'utf8')).VITE_SUPABASE_URL;
    if (production && production.replace(/\/$/, '') === env.STAGING_SUPABASE_URL.replace(/\/$/, ''))
      throw new Error('STAGING_SUPABASE_URL is your PRODUCTION project (same as .env). Use the staging project.');
  }
  return {
    site: env.STAGING_SITE_URL.replace(/\/$/, ''),
    supabase: env.STAGING_SUPABASE_URL.replace(/\/$/, ''),
    publishable: env.STAGING_SUPABASE_PUBLISHABLE_KEY,
    service: env.STAGING_SUPABASE_SERVICE_ROLE_KEY,
    password: env.LOADTEST_PASSWORD,
  };
}

/** Test account emails. example.com addresses keep every account a separate mailbox (Gmail aliases would share one). */
export const hostEmail = n => `load-host-${String(n).padStart(3, '0')}@example.com`;
export const guestEmail = n => `load-guest-${String(n).padStart(3, '0')}@example.com`;
export const isLoadTestEmail = email => /^load-(host|guest)-\d{3}@example\.com$/.test(email || '');

/** Calls a Supabase endpoint with the service-role key (admin). Throws with the response text on failure. */
export async function admin(settings, path, { method = 'GET', body, prefer } = {}) {
  const response = await fetch(`${settings.supabase}${path}`, {
    method,
    headers: { apikey: settings.service, Authorization: `Bearer ${settings.service}`, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw Object.assign(new Error(`${method} ${path} → ${response.status}: ${text.slice(0, 300)}`), { status: response.status, text });
  return text ? JSON.parse(text) : null;
}

/** All load-test users in the project (admin API is paginated). */
export async function listLoadTestUsers(settings) {
  const users = [];
  for (let page = 1; page < 50; page++) {
    const data = await admin(settings, `/auth/v1/admin/users?page=${page}&per_page=1000`);
    const batch = data.users || [];
    users.push(...batch.filter(user => isLoadTestEmail(user.email)));
    if (batch.length < 1000) break;
  }
  return users;
}

/** Run async work with a small concurrency limit so the admin API is not flooded. */
export async function inBatches(items, size, work) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(work));
}
