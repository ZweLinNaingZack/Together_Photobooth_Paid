// Remembers logins that Supabase Auth has already verified, so the room API does not
// call Supabase Auth on every check-in (the load test showed that chain of calls as the
// main slowdown). Each server instance keeps its own small in-memory cache.
//
// Safety:
// - Only successful, email-confirmed verifications are cached; failures always re-check.
// - An entry lives at most ttlMs (5 minutes) and never past the token's own expiry.
// - Tokens are stored as SHA-256 hashes, not in plain form.
import { createHash } from 'node:crypto';

/** Expiry (seconds since epoch) from a JWT payload. Only used to shorten the cache time. */
function tokenExpiry(jwt) {
  try { const exp = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8')).exp; return Number.isFinite(exp) ? exp : 0; }
  catch { return 0; }
}

export function createVerifiedUserCache({ ttlMs = 5 * 60 * 1000, max = 5000, now = Date.now } = {}) {
  const entries = new Map();
  return {
    /**
     * @param {string} jwt
     * @param {(jwt: string) => Promise<{ ok: boolean, userId?: string, unavailable?: boolean }>} lookup  asks Supabase Auth
     */
    async verify(jwt, lookup) {
      const key = createHash('sha256').update(jwt).digest('base64url');
      const time = now(), hit = entries.get(key);
      if (hit && hit.until > time) return hit.result;
      if (hit) entries.delete(key);
      const result = await lookup(jwt);
      if (result.ok) {
        const exp = tokenExpiry(jwt);
        const until = Math.min(time + ttlMs, exp ? exp * 1000 : time + ttlMs);
        if (until > time) {
          if (entries.size >= max) entries.delete(entries.keys().next().value); // drop the oldest
          entries.set(key, { until, result });
        }
      }
      return result;
    },
    get size() { return entries.size; },
  };
}
