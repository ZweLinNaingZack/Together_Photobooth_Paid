const stun = [{ urls: 'stun:stun.cloudflare.com:3478' }];
const unavailable = () => Object.assign(new Error('The camera relay could not be configured. Please check the server’s TURN settings and reconnect.'), { status: 503 });

export function createTurnProvider({ env = process.env, fetchImpl = fetch } = {}) {
  return async () => {
    const key = env.TURN_KEY_ID?.trim(), secret = env.TURN_KEY_API_TOKEN?.trim();
    if (!key && !secret) return { iceServers: stun, relayConfigured: false };
    if (!key || !secret || !/^[a-zA-Z0-9_-]+$/.test(key)) throw unavailable();
    try {
      const response = await fetchImpl(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(key)}/credentials/generate-ice-servers`, {
        method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
        // A booth lasts at most 45 minutes. Credentials last one hour.
        body: JSON.stringify({ ttl: 3600 }), signal: AbortSignal.timeout(7000),
      });
      if (!response.ok) throw unavailable();
      const data = await response.json();
      if (!Array.isArray(data.iceServers)) throw unavailable();
      const iceServers = data.iceServers.flatMap(server => {
        const urls = (Array.isArray(server.urls) ? server.urls : [server.urls]).filter(url => typeof url === 'string' && /^(stun|turn|turns):/.test(url) && !/:53(?:\?|$)/.test(url));
        if (!urls.length) return [];
        if (urls.some(url => /^turns?:/.test(url))) {
          if (typeof server.username !== 'string' || typeof server.credential !== 'string') throw unavailable();
          return [{ urls, username: server.username, credential: server.credential }];
        }
        return [{ urls }];
      });
      if (!iceServers.some(server => server.urls.some(url => /^turns?:/.test(url)))) throw unavailable();
      return { iceServers, relayConfigured: true };
    } catch { throw unavailable(); }
  };
}
