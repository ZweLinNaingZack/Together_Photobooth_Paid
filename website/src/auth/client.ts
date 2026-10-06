import { createClient } from '@supabase/supabase-js';
import { readEmailCallback, cleanEmailCallback } from './emailCallback.js';
// Remove the bearer token from browser history before any UI or third-party assets load.
export const incomingEmailLink = readEmailCallback(location.href);
if (incomingEmailLink) history.replaceState(history.state, '', cleanEmailCallback(location.href));
const env = (import.meta as ImportMeta & { env: Record<string, string> }).env;
const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
function publicKey(value: string) {
  if (value?.startsWith('sb_publishable_')) return true;
  try { return JSON.parse(atob(value.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon'; } catch { return false; }
}
export const supabase = url && publicKey(key) ? createClient(url, key, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
export const authRedirect = (recovery = false) => {
  const order = new URLSearchParams(location.search).get('order');
  const query = recovery ? '?recovery=1' : order && /^[0-9a-f-]{36}$/i.test(order) ? `?order=${encodeURIComponent(order)}` : '';
  return `${location.origin}${location.pathname}${query}${!recovery && query ? '#account/admin' : '#account'}`;
};
export async function googleAvailable(signal: AbortSignal) {
  if (!supabase) return false;
  const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, { headers: { apikey: key }, signal });
  return response.ok && Boolean((await response.json()).external?.google);
}
