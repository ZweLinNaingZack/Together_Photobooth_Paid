import { useEffect, useRef, useState } from 'react';
import { roomRequest } from './rooms';
import type { RoomSession } from './rooms';
import { createCameraTransport } from './cameraTransport.mjs';
import { connectionRetry } from './connectionRetry.mjs';
import { supabase } from '../auth/client';
import {recordDiagnostic} from './diagnostics.js';

export type DuoEvent = { type: string; [key: string]: unknown };
type Signal = { type: string; session: string; id?: string; generation?: number; to?: string; description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
type RtcConfig = { iceServers: RTCIceServer[]; relayConfigured: boolean; signalTopic?: string };

// Signaling uses the room API; camera tracks and photos use encrypted WebRTC.
export function useDuoPeer(room: RoomSession | null, stream: MediaStream | null, onEvent: (event: DuoEvent) => void) {
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [connected, setConnected] = useState(false), [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState('Waiting for camera access');
  const [diagnostics, setDiagnostics] = useState('');
  const listener = useRef(onEvent); listener.current = onEvent;
  const automaticRetries = useRef(0);
  const preparation = useRef<{ token: string; promise: Promise<RtcConfig | undefined> } | null>(null);
  // Fetch relay credentials while getUserMedia is asking permission/starting,
  // rather than adding the server round trips after the camera is available.
  useEffect(() => {
    if (!room) return;
    let cancelled = false;
    automaticRetries.current = 0;
    const entry = { token: room.token, promise: connectionRetry(() => roomRequest<RtcConfig>('rtc', { code: room.code, token: room.token }), () => cancelled) };
    preparation.current = entry;
    void entry.promise.catch(() => { if (preparation.current === entry) preparation.current = null; });
    return () => { cancelled = true; if (preparation.current === entry) preparation.current = null; };
  }, [room?.token]);
  const sender = useRef<(event: DuoEvent) => Promise<void>>(async () => { throw new Error('Your person is not connected yet.'); });
  useEffect(() => {
    if (!room || !stream) return;
    let stopped = false, pc: RTCPeerConnection | null = null;
    let channel: RTCDataChannel | null = null, session = '', guestId = '';
    let config: RtcConfig | null = null;
    let transport: ReturnType<typeof createCameraTransport> | null = null;
    let transportName = 'Preparing connection', receiving = Promise.resolve();
    let guestGeneration = 0, offerGeneration = 0, negotiationGeneration = 0;
    let candidates: { session: string; candidate: RTCIceCandidateInit }[] = [];
    const localId = crypto.randomUUID(), auth = { code: room.code, token: room.token };
    const incoming = new Map<string, { size: number; data: string }>();
    const acknowledgments = new Map<string, { resolve: () => void; reject: (error: Error) => void }>();
    let outgoing = Promise.resolve();
    let recoveryTimer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    let connectedAfter: number | null = null;
    const recover = () => {
      if (stopped || recoveryTimer || automaticRetries.current >= 2) return;
      recoveryTimer = setTimeout(() => {
        recoveryTimer = undefined;
        if (stopped || pc?.connectionState === 'connected' && channel?.readyState==='open') return;
        automaticRetries.current++;
        recordDiagnostic('camera_retry');
        setAttempt(value => value + 1);
      }, 3000);
    };
    setRemote(null); setConnected(false); setError('');
    const report = (e: unknown) => { if (!stopped) {const reference=recordDiagnostic('camera_failed',Date.now()-startedAt);setError(`${e instanceof Error ? e.message : 'Camera connection interrupted. Try reconnecting.'} Support reference: ${reference}.`);} };
    setPhase(room.role === 'host' ? 'Waiting for your person’s camera to connect' : 'Contacting your creator’s camera');
    const signal = (message: Signal) => transport?.send({ ...message, generation: message.type === 'hello' ? startedAt : negotiationGeneration, id: crypto.randomUUID() }) ?? Promise.resolve();
    function closePeer() {
      channel?.close(); pc?.close(); channel = null; pc = null; incoming.clear();
      for (const waiter of acknowledgments.values()) waiter.reject(new Error('Camera connection closed.'));
      acknowledgments.clear(); setRemote(null); setConnected(false);
    }
    function attach(next: RTCDataChannel) {
      channel = next;
      next.onopen = () => { if (!stopped && channel === next) { connectedAfter = Date.now() - startedAt; recordDiagnostic('camera_connected',connectedAfter);setConnected(true); setError(''); setPhase('Your cameras are connected'); } };
      next.onclose = () => { if (!stopped && channel === next) { setConnected(false); setPhase('Reconnecting your cameras');recover(); } };
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
      closePeer(); session = id; negotiationGeneration = Date.now();
      setPhase('Finding a route between your cameras');
      if (!config) throw new Error('Camera connection settings are still loading.');
      const next = new RTCPeerConnection({ iceServers: config.iceServers,
        // After a failed direct attempt, use the configured relay explicitly.
        iceTransportPolicy: automaticRetries.current > 0 && config.relayConfigured ? 'relay' : 'all',
      }); pc = next;
      stream!.getTracks().forEach(track => next.addTrack(track,stream!));
      // Apply after negotiation so the browser's negotiated encodings and
      // transceiver pairing are preserved on both the offer and answer sides.
      next.onsignalingstatechange=()=>{
        if(next.signalingState!=='stable'||!next.localDescription)return;
        for(const sender of next.getSenders())if(sender.track?.kind==='video'){
          const params=sender.getParameters();
          if(!params.encodings?.length)continue;
          params.encodings=params.encodings.map(encoding=>({...encoding,maxBitrate:700000,maxFramerate:24,scaleResolutionDownBy:Math.max(1,(sender.track!.getSettings().width||1280)/640)}));
          void sender.setParameters(params).catch(()=>{});
        }
      };
      next.ontrack = event => { if (!stopped && pc === next) setRemote(event.streams[0] || new MediaStream([event.track])); };
      next.onicecandidate = event => { if (!stopped && pc === next && event.candidate) void signal({ type: 'candidate', session: id, candidate: event.candidate.toJSON() }).catch(report); };
      next.onconnectionstatechange = () => {
        if (stopped || pc !== next) return;
        if (next.connectionState === 'failed' || next.connectionState === 'disconnected') { setConnected(false); setError(config?.relayConfigured ? 'The camera connection was interrupted. Try reconnecting your cameras.' : 'The cameras could not connect directly. This booth still needs a TURN relay for networks that block direct connections.'); }
        if (next.connectionState === 'failed' || next.connectionState === 'disconnected') recover();
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
      if (stopped) return;
      // HTTP fallback can arrive after newer WebSocket messages. An older
      // negotiation must never tear down the current peer.
      if (message.type === 'hello' && room!.role === 'host') {
        const generation = message.generation || 0;
        if (generation < guestGeneration) return;
        guestGeneration = generation;
      }
      if (message.type === 'offer' && room!.role === 'guest' && message.to === localId) {
        const generation = message.generation || 0;
        if (generation < offerGeneration) return;
        offerGeneration = generation;
      }
      if (message.type === 'hello' && room!.role === 'host' && guestId === message.session && pc?.signalingState === 'have-local-offer') {
        void signal({ type: 'offer', session, to: guestId, description: { type: 'offer', sdp: pc.localDescription!.sdp } }).catch(report);
      } else if (message.type === 'offer' && room!.role === 'guest' && message.to === localId && message.session === session && pc?.localDescription?.type === 'answer') {
        void signal({ type: 'answer', session, description: { type: 'answer', sdp: pc.localDescription.sdp } }).catch(report);
      } else if (message.type === 'hello' && room!.role === 'host' && (guestId !== message.session || !pc?.localDescription)) {
        guestId = message.session;
        const next = createPeer(crypto.randomUUID()); attach(next.createDataChannel('together'));
        await next.setLocalDescription(await next.createOffer());
        if (!stopped) void signal({ type: 'offer', session, to: guestId, description: { type: 'offer', sdp: next.localDescription!.sdp } }).catch(report);
      } else if (message.type === 'offer' && room!.role === 'guest' && message.to === localId && message.session !== session && message.description?.type === 'offer') {
        const next = createPeer(message.session);
        negotiationGeneration = message.generation || negotiationGeneration;
        await next.setRemoteDescription(message.description);
        for (const item of candidates.filter(item => item.session === session)) { try { await next.addIceCandidate(item.candidate); } catch (e) { report(e); } }
        candidates = [];
        await next.setLocalDescription(await next.createAnswer());
        if (!stopped) void signal({ type: 'answer', session, description: { type: 'answer', sdp: next.localDescription!.sdp } }).catch(report);
      } else if (message.type === 'answer' && room!.role === 'host' && message.session === session && pc?.signalingState === 'have-local-offer' && message.description?.type === 'answer') {
        await pc.setRemoteDescription(message.description);
        for (const item of candidates.filter(item => item.session === session)) { try { await pc.addIceCandidate(item.candidate); } catch (e) { report(e); } }
        candidates = [];
      } else if (message.type === 'candidate' && message.candidate) {
        if (typeof message.generation === 'number' && message.generation < negotiationGeneration) return;
        if (message.session === session && pc?.remoteDescription) await pc.addIceCandidate(message.candidate);
        else if (candidates.length < 128) candidates.push({ session: message.session, candidate: message.candidate });
      }
    }
    let announcing = false;
    const announce = () => {
      if (!stopped && config && room.role === 'guest' && pc?.connectionState !== 'connected' && !announcing) {
        announcing = true;
        void signal({ type: 'hello', session: localId }).catch(report).finally(() => { announcing = false; });
      }
    };
    const helloTimer = setInterval(announce, 2000);
    const statsTimer = setInterval(() => {
      const active = pc;
      if (!active || stopped) { if (!stopped) setDiagnostics(`Role: ${room.role}\nTransport: ${transportName}\nSignaling: waiting for the other camera\nRelay configured: ${config ? config.relayConfigured ? 'yes' : 'no' : 'settings unavailable'}`); return; }
      void active.getStats().then(stats => {
        if (stopped || pc !== active) return;
        let receivedFrames = 0, localCandidates = 0, remoteCandidates = 0;
        let route = 'Not selected', roundTrip = 'Not available';
        stats.forEach(report => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') receivedFrames += report.framesDecoded || 0;
          if (report.type === 'local-candidate') localCandidates++;
          if (report.type === 'remote-candidate') remoteCandidates++;
          if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated) {
            const local = stats.get(report.localCandidateId), other = stats.get(report.remoteCandidateId);
            route = `${local?.candidateType || '?'} → ${other?.candidateType || '?'} (${local?.protocol || '?'})`;
            if (typeof report.currentRoundTripTime === 'number') roundTrip = `${Math.round(report.currentRoundTripTime * 1000)} ms`;
          }
        });
        // Intentionally exclude tokens, room codes, SDP, addresses and photos.
        setDiagnostics(`Role: ${room.role}\nTransport: ${transportName}\nConnection time: ${((connectedAfter ?? Date.now() - startedAt) / 1000).toFixed(1)} seconds\nAutomatic retries: ${automaticRetries.current}\nSignaling: ${active.signalingState}\nNetwork: ${active.iceConnectionState}\nConnection: ${active.connectionState}\nPhoto channel: ${channel?.readyState || 'not created'}\nLocal routes: ${localCandidates}\nRemote routes: ${remoteCandidates}\nSelected route: ${route}\nNetwork round trip: ${roundTrip}\nVideo frames received: ${receivedFrames}\nRelay configured: ${config?.relayConfigured ? 'yes' : 'no'}`);
      }).catch(() => {});
    }, 2000);
    const configPromise = preparation.current?.token === room.token ? preparation.current.promise : connectionRetry(() => roomRequest<RtcConfig>('rtc', auth), () => stopped);
    void configPromise.then(result => {
      if (stopped || !result) return;
      config = result;
      transport = createCameraTransport({ client: supabase, topic: result.signalTopic, role: room.role,
        request: (action: string, body: object) => roomRequest(action, { ...auth, ...body }),
        onMessage: (message: Signal) => { receiving = receiving.then(() => receive(message)).catch(report); },
        onStatus: (status: string) => {
          transportName = status;
          // The first HTTP greeting may still be pending. Do not let that slow
          // request prevent immediate negotiation when the socket opens.
          if (status === 'Private WebSocket' && room.role === 'guest' && pc?.connectionState !== 'connected') void signal({type:'hello',session:localId}).catch(report);
        },
        onError: report, connected: () => pc?.connectionState === 'connected',
      });
      announce();
    }).catch(report);
    const timeout = setTimeout(() => {
      if (!stopped && pc?.connectionState !== 'connected') {
        setError(current => current || 'The camera handshake is taking longer than expected. Retrying the connection; keep both camera pages open.');
        if (config) recover();
      }
    }, 25000);
    const hide = () => { stopped = true; transport?.close(); clearTimeout(recoveryTimer); clearInterval(helloTimer); clearInterval(statsTimer); closePeer(); };
    const online=()=>{if(!stopped&&pc?.connectionState!=='connected'){automaticRetries.current=0;recover();}};
    window.addEventListener('pagehide', hide);
    window.addEventListener('online',online);
    return () => { stopped = true; transport?.close(); clearTimeout(recoveryTimer); clearTimeout(timeout); clearInterval(helloTimer); clearInterval(statsTimer); closePeer(); window.removeEventListener('pagehide', hide);window.removeEventListener('online',online); };
  }, [room?.token, stream, attempt]);
  return { remote, connected, error, phase, diagnostics, reconnect: () => { automaticRetries.current = 0; setAttempt(value => value + 1); }, send: (event: DuoEvent) => sender.current(event) };
}
