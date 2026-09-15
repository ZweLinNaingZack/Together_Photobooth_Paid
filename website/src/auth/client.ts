import { createClient } from '@supabase/supabase-js';
const env = (import.meta as ImportMeta & { env: Record<string, string> }).env;
const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
function publicKey(value: string) {
  if (value?.startsWith('sb_publishable_')) return true;
  try { return JSON.parse(atob(value.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon'; } catch { return false; }
}
export const supabase = url && publicKey(key) ? createClient(url, key, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
export const authRedirect = (recovery = false) => `${location.origin}${location.pathname}${recovery ? '?recovery=1' : ''}#account`;
export async function googleAvailable(signal: AbortSignal) {
  if (!supabase) return false;
  const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, { headers: { apikey: key }, signal });
  return response.ok && Boolean((await response.json()).external?.google);
}
