import { createSignalQueue } from './signaling.js';
const closingChannels = new WeakMap();

// WebSocket delivery is acknowledged by the other browser, not just the
// broadcast server. Missing ACKs fall back to the persisted room queue.
export function createCameraTransport({ client, topic, role, request, onMessage, onStatus = status => {}, onError = error => {}, connected = () => false, ackMs = 900 }) {
  let stopped = false, subscribed = false, channel = null, cursor = 0, pollTimer;
  const waiting = new Map(), seen = new Set();
  const fallback = createSignalQueue(messages => request('signal', { messages }), () => stopped, true);
  function valid(message) {
    return message && ['hello','offer','answer','candidate'].includes(message.type)
      && typeof message.id === 'string' && message.id.length <= 80
      && typeof message.session === 'string' && message.session.length <= 80
      && JSON.stringify(message).length <= 24000;
  }
  function deliver(message) {
    if (stopped || !valid(message) || seen.has(message.id)) return;
    seen.add(message.id);
    if (seen.size > 2048) seen.delete(seen.values().next().value);
    onMessage(message);
  }
  function broadcast(payload) {
    if (!subscribed || stopped) return Promise.reject(new Error('WebSocket unavailable'));
    return channel.send({ type: 'broadcast', event: 'camera', payload });
  }
  async function poll() {
    try {
      const result = await request('signals', { after: cursor });
      if (stopped) return;
      const latestHello = result.messages.filter(item => item.message.type === 'hello').at(-1);
      const latestOffers = new Map(result.messages.filter(item => item.message.type === 'offer').map(item => [item.message.to,item]));
      for (const item of result.messages) {
        if (item.message.type === 'hello' && item !== latestHello) continue;
        if (item.message.type === 'offer' && item !== latestOffers.get(item.message.to)) continue;
        deliver(item.message);
      }
      cursor = result.cursor;
    } catch (error) { if (!stopped && !subscribed) onError(error); }
    // Keep a slow fallback even with a healthy socket: the other browser may
    // have WebSockets blocked. Never start overlapping HTTP reads.
    if (!stopped) pollTimer = setTimeout(poll, connected() ? 5000 : 800);
  }
  if (client && topic) {
    void (async () => {
      // Supabase reuses same-topic channel objects. Wait for the previous
      // attempt's unsubscribe so retries never subscribe a closing object.
      await closingChannels.get(client)?.get(topic);
      if (stopped) return;
      await client.realtime.setAuth();
      if (stopped) return;
      channel = client.channel(topic, { config: { private: true, broadcast: { self: false } } });
      channel.on('broadcast', { event: 'camera' }, ({ payload }) => {
        if (stopped || !payload || payload.from === role || !['host','guest'].includes(payload.from)) return;
        if (payload.ack) { waiting.get(payload.ack)?.finish(); return; }
        if (!valid(payload.message)) return;
        void broadcast({ from: role, ack: payload.message.id }).catch(() => {});
        deliver(payload.message);
      });
      channel.subscribe((status, error) => {
        if (stopped) return;
        subscribed = status === 'SUBSCRIBED';
        const denied=/unauthorized|permissions|forbidden/i.test(error?.message||'');
        onStatus(subscribed ? 'Private WebSocket' : denied ? 'HTTP fallback (private channel access denied; check migration 008 and room authorization)' : 'HTTP fallback (WebSocket unavailable)');
      });
    })().catch(() => { if (!stopped) onStatus('HTTP fallback (WebSocket authorization failed)'); });
  } else onStatus('HTTP fallback');
  void poll();
  return {
    send(message) {
      if (stopped) return Promise.resolve();
      if (!subscribed) return fallback(message);
      return new Promise((resolve, reject) => {
        let timer, fallingBack = false;
        const finish = () => { clearTimeout(timer); waiting.delete(message.id); resolve(); };
        const useFallback = () => {
          if (fallingBack || !waiting.has(message.id)) return;
          fallingBack = true; clearTimeout(timer);
          void fallback(message).then(finish, error => {
            if (!waiting.has(message.id)) return;
            waiting.delete(message.id); reject(error);
          });
        };
        waiting.set(message.id, { finish });
        timer = setTimeout(useFallback, ackMs);
        void broadcast({ from: role, message }).then(status => {
          if (status !== 'ok') useFallback();
        }, useFallback);
      });
    },
    close() {
      if (stopped) return;
      stopped = true; subscribed = false; clearTimeout(pollTimer);
      for (const item of waiting.values()) item.finish();
      waiting.clear(); seen.clear();
      if (channel) {
        if (!closingChannels.has(client)) closingChannels.set(client,new Map());
        const closing = Promise.resolve().then(() => client.removeChannel(channel)).catch(() => {});
        closingChannels.get(client).set(topic,closing);
        void closing.then(() => {
          if (closingChannels.get(client)?.get(topic) === closing) closingChannels.get(client).delete(topic);
        });
      }
    },
  };
}
