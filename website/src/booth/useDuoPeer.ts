import { useEffect, useRef, useState } from 'react';
import { roomRequest } from './rooms';
import type { RoomSession } from './rooms';
import { createSignalQueue } from './signaling';
import { connectionRetry } from './connectionRetry.mjs';

export type DuoEvent = { type: string; [key: string]: unknown };
type Signal = { type: string; session: string; id?: string; to?: string; description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };

// Signaling uses the room API; camera tracks and photos use encrypted WebRTC.
export function useDuoPeer(room: RoomSession | null, stream: MediaStream | null, onEvent: (event: DuoEvent) => void) {
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [connected, setConnected] = useState(false), [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState('Waiting for camera access');
  const [diagnostics, setDiagnostics] = useState('');
  const listener = useRef(onEvent); listener.current = onEvent;
  const sender = useRef<(event: DuoEvent) => Promise<void>>(async () => { throw new Error('Your person is not connected yet.'); });
  useEffect(() => {
    if (!room || !stream) return;
    let stopped = false, cursor = 0, timer: ReturnType<typeof setTimeout>, pc: RTCPeerConnection | null = null;
    let channel: RTCDataChannel | null = null, session = '', guestId = '';
    let config: { iceServers: RTCIceServer[]; relayConfigured: boolean } | null = null;
    let candidates: { session: string; candidate: RTCIceCandidateInit }[] = [];
    const localId = crypto.randomUUID(), auth = { code: room.code, token: room.token };
    const incoming = new Map<string, { size: number; data: string }>();
    const acknowledgments = new Map<string, { resolve: () => void; reject: (error: Error) => void }>();
    let outgoing = Promise.resolve();
    setRemote(null); setConnected(false); setError('');
    const report = (e: unknown) => { if (!stopped) setError(e instanceof Error ? e.message : 'Camera connection interrupted. Try reconnecting.'); };
    setPhase(room.role === 'host' ? 'Waiting for your person’s camera to connect' : 'Contacting your creator’s camera');
    const enqueueSignal = createSignalQueue((payload: Signal) => roomRequest('signal', { ...auth, message: payload }), () => stopped);
    const signal = (message: Signal) => enqueueSignal({ ...message, id: crypto.randomUUID() });
    function closePeer() {
      channel?.close(); pc?.close(); channel = null; pc = null; incoming.clear();
      for (const waiter of acknowledgments.values()) waiter.reject(new Error('Camera connection closed.'));
      acknowledgments.clear(); setRemote(null); setConnected(false);
    }
    function attach(next: RTCDataChannel) {
      channel = next;
      next.onopen = () => { if (!stopped && channel === next) { setConnected(true); setError(''); setPhase('Your cameras are connected'); } };
      next.onclose = () => { if (!stopped && channel === next) { setConnected(false); setError('Your person’s camera connection closed. Reconnect to continue.'); } };
      next.onmessage = event => {
        if (stopped || channel !== next || typeof event.data !== 'string' || event.data.length > 16000) return;
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'ack') { acknowledgments.get(message.id)?.resolve(); acknowledgments.delete(message.id); return; }
          if (message.type === 'begin' && typeof message.id === 'string' && Number.isInteger(message.size) && message.size > 0 && message.size <= 6000000 && incoming.size < 2) incoming.set(message.id, { size: message.size, data: '' });
          if (message.type === 'part') {
            const item = incoming.get(message.id);
            if (!item || typeof message.data !== 'string') return;
            item.data += message.data;
            if (item.data.length > item.size) { incoming.delete(message.id); return; }
            if (item.data.length === item.size) {
              incoming.delete(message.id);
              const payload = JSON.parse(item.data);
              if (payload && typeof payload.type === 'string') listener.current(payload);
              next.send(JSON.stringify({ type: 'ack', id: message.id }));
            }
          }
        } catch { report(new Error('Could not receive your shared photo. Please retake it.')); }
      };
    }
    sender.current = event => {
      const task = outgoing.then(async () => {
        const active = channel, data = JSON.stringify(event), id = crypto.randomUUID();
        if (stopped || active?.readyState !== 'open') throw new Error('Wait for both cameras to connect.');
        if (data.length > 6000000) throw new Error('This photo is too large to share. Please try again.');
        const deadline = Date.now() + 20000;
        active.send(JSON.stringify({ type: 'begin', id, size: data.length }));
        for (let offset = 0; offset < data.length; offset += 12000) {
          while (active.bufferedAmount > 256000) {
            if (stopped || active.readyState !== 'open' || Date.now() > deadline) throw new Error('Photo sharing paused. Reconnect and retake this photo.');
            await new Promise(resolve => setTimeout(resolve, 40));
          }
          if (stopped || active.readyState !== 'open') throw new Error('Camera connection closed.');
          // Register before sending the final chunk, so even a fast ACK is seen.
          if (offset + 12000 >= data.length) {
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => { acknowledgments.delete(id); reject(new Error('Your person did not receive the photo. Please reconnect and retake it.')); }, 20000);
              acknowledgments.set(id, { resolve: () => { clearTimeout(timeout); resolve(); }, reject: e => { clearTimeout(timeout); reject(e); } });
              try { active.send(JSON.stringify({ type: 'part', id, data: data.slice(offset, offset + 12000) })); }
              catch (e) { clearTimeout(timeout); acknowledgments.delete(id); reject(e); }
            });
          } else active.send(JSON.stringify({ type: 'part', id, data: data.slice(offset, offset + 12000) }));
        }
      });
      outgoing = task.catch(report);
      return task;
    };
    function createPeer(id: string) {
      closePeer(); session = id;
      setPhase('Finding a route between your cameras');
      if (!config) throw new Error('Camera connection settings are still loading.');
      const next = new RTCPeerConnection({ iceServers: config.iceServers }); pc = next;
      stream!.getTracks().forEach(track => next.addTrack(track, stream!));
      next.ontrack = event => { if (!stopped && pc === next) setRemote(event.streams[0] || new MediaStream([event.track])); };
      next.onicecandidate = event => { if (!stopped && pc === next && event.candidate) void signal({ type: 'candidate', session: id, candidate: event.candidate.toJSON() }).catch(report); };
      next.onconnectionstatechange = () => {
        if (stopped || pc !== next) return;
        if (next.connectionState === 'failed' || next.connectionState === 'disconnected') { setConnected(false); setError(config?.relayConfigured ? 'The camera connection was interrupted. Try reconnecting your cameras.' : 'The cameras could not connect directly. This booth still needs a TURN relay for networks that block direct connections.'); }
        if (next.connectionState === 'connected' && channel?.readyState === 'open') { setConnected(true); setError(''); }
      };
      next.oniceconnectionstatechange = () => {
        if (stopped || pc !== next) return;
        if (next.iceConnectionState === 'checking') setPhase('Camera details exchanged. Checking the network connection');
        if (next.iceConnectionState === 'failed') { setConnected(false); setPhase('The camera connection failed'); setError(config?.relayConfigured ? 'The network could not reach the other camera, even with the relay. Try reconnecting and check Connection details below.' : 'Your cameras are on, but the network could not connect them directly. This booth needs a TURN relay to connect across networks that block video.'); }
      };
      next.ondatachannel = event => attach(event.channel);
      return next;
    }
    async function receive(message: Signal) {
      if (message.type === 'hello' && room!.role === 'host' && guestId === message.session && pc?.signalingState === 'have-local-offer') {
        await signal({ type: 'offer', session, to: guestId, description: { type: 'offer', sdp: pc.localDescription!.sdp } });
      } else if (message.type === 'offer' && room!.role === 'guest' && message.to === localId && message.session === session && pc?.localDescription?.type === 'answer') {
        await signal({ type: 'answer', session, description: { type: 'answer', sdp: pc.localDescription.sdp } });
      } else if (message.type === 'hello' && room!.role === 'host' && (guestId !== message.session || !pc?.localDescription)) {
        guestId = message.session;
        const next = createPeer(crypto.randomUUID()); attach(next.createDataChannel('together'));
        await next.setLocalDescription(await next.createOffer());
        if (!stopped) await signal({ type: 'offer', session, to: guestId, description: { type: 'offer', sdp: next.localDescription!.sdp } });
      } else if (message.type === 'offer' && room!.role === 'guest' && message.to === localId && message.session !== session && message.description?.type === 'offer') {
        const next = createPeer(message.session);
        await next.setRemoteDescription(message.description);
        for (const item of candidates.filter(item => item.session === session)) { try { await next.addIceCandidate(item.candidate); } catch (e) { report(e); } }
        candidates = [];
        await next.setLocalDescription(await next.createAnswer());
        if (!stopped) await signal({ type: 'answer', session, description: { type: 'answer', sdp: next.localDescription!.sdp } });
      } else if (message.type === 'answer' && room!.role === 'host' && message.session === session && pc?.signalingState === 'have-local-offer' && message.description?.type === 'answer') {
        await pc.setRemoteDescription(message.description);
        for (const item of candidates.filter(item => item.session === session)) { try { await pc.addIceCandidate(item.candidate); } catch (e) { report(e); } }
        candidates = [];
      } else if (message.type === 'candidate' && message.candidate) {
        if (message.session === session && pc?.remoteDescription) await pc.addIceCandidate(message.candidate);
        else if (candidates.length < 128) candidates.push({ session: message.session, candidate: message.candidate });
      }
    }
    async function poll() {
      try {
        const result = await roomRequest<{ cursor: number; messages: { id: number; message: Signal }[] }>('signals', { ...auth, after: cursor });
        if (stopped) return;
        for (const item of result.messages) {
          if (stopped) return;
          // A bad or obsolete candidate must not block all later offers/answers.
          try { await receive(item.message); } catch (e) { report(e); }
          cursor = item.id;
        }
        cursor = result.cursor;
      } catch (e) { report(e); }
      if (!stopped) timer = setTimeout(poll, 800);
    }
    const announce = () => { if (!stopped && config && room.role === 'guest') void signal({ type: 'hello', session: localId }).catch(report); };
    const helloTimer = setInterval(announce, 10000);
    const statsTimer = setInterval(() => {
      const active = pc;
      if (!active || stopped) { if (!stopped) setDiagnostics(`Role: ${room.role}\nSignaling: waiting for the other camera\nRelay configured: ${config ? config.relayConfigured ? 'yes' : 'no' : 'settings unavailable'}`); return; }
      void active.getStats().then(stats => {
        if (stopped || pc !== active) return;
        let receivedFrames = 0, localCandidates = 0, remoteCandidates = 0;
        stats.forEach(report => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') receivedFrames += report.framesDecoded || 0;
          if (report.type === 'local-candidate') localCandidates++;
          if (report.type === 'remote-candidate') remoteCandidates++;
        });
        // Intentionally exclude tokens, room codes, SDP, addresses and photos.
        setDiagnostics(`Role: ${room.role}\nSignaling: ${active.signalingState}\nNetwork: ${active.iceConnectionState}\nConnection: ${active.connectionState}\nPhoto channel: ${channel?.readyState || 'not created'}\nLocal routes: ${localCandidates}\nRemote routes: ${remoteCandidates}\nVideo frames received: ${receivedFrames}\nRelay configured: ${config?.relayConfigured ? 'yes' : 'no'}`);
      }).catch(() => {});
    }, 2000);
    void connectionRetry(() => roomRequest<{ iceServers: RTCIceServer[]; relayConfigured: boolean }>('rtc', auth), () => stopped).then(result => {
      if (stopped || !result) return;
      config = result; announce(); void poll();
    }).catch(report);
    const timeout = setTimeout(() => { if (!stopped && pc?.connectionState !== 'connected') setError(current => current || (pc?.remoteDescription ? 'Both cameras exchanged their connection details, but the network has not connected them. Try Reconnect cameras. If this continues, open Connection details below so we can identify the blocked step.' : 'Camera connection details have not arrived yet. Keep both photo pages open and try Reconnect cameras.')); }, 25000);
    const hide = () => { stopped = true; clearTimeout(timer); clearInterval(helloTimer); clearInterval(statsTimer); closePeer(); };
    window.addEventListener('pagehide', hide);
    return () => { stopped = true; clearTimeout(timer); clearTimeout(timeout); clearInterval(helloTimer); clearInterval(statsTimer); closePeer(); window.removeEventListener('pagehide', hide); };
  }, [room?.token, stream, attempt]);
  return { remote, connected, error, phase, diagnostics, reconnect: () => setAttempt(value => value + 1), send: (event: DuoEvent) => sender.current(event) };
}
