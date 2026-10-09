import { useEffect, useRef, useState } from 'react';
import { roomRequest } from './rooms';
import type { RoomSession } from './rooms';
import { createCameraTransport } from './cameraTransport.mjs';
import { connectionRetry } from './connectionRetry.mjs';
import { supabase } from '../auth/client';
import {recordDiagnostic} from './diagnostics.js';
import {validatePeerPhotos} from './peerPhoto.js';
import {createPreviewQuality,recoveryDelay,videoSample,selectedVideoRoute} from './liveQuality.js';
import {transferProgress,ackWatch} from './transferProgress.js';

export type DuoEvent = { type: string; [key: string]: unknown };
type Signal = { type: string; session: string; id?: string; generation?: number; to?: string; restart?: boolean; description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
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
    let control: RTCDataChannel | null = null;
    const channelsOpen=()=>channel?.readyState==='open'&&control?.readyState==='open';
    let channel: RTCDataChannel | null = null, session = '', guestId = '';
    let config: RtcConfig | null = null;
    let transport: ReturnType<typeof createCameraTransport> | null = null;
    let transportName = 'Preparing connection', receiving = Promise.resolve();
    let guestGeneration = 0, offerGeneration = 0, negotiationGeneration = 0;
    let candidates: { session: string; candidate: RTCIceCandidateInit }[] = [];
    const localId = crypto.randomUUID(), auth = { code: room.code, token: room.token };
    const incoming = new Map<string, { size: number; data: string; updated: number }>();
    const acknowledgments = new Map<string, { resolve: () => void; reject: (error: Error) => void }>();
    let outgoing = Promise.resolve();
    let recoveryTimer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    let connectedAfter: number | null = null;
    let quality=createPreviewQuality(),previousStats=new Map(),statsBusy=false,parametersBusy=false;
    let qualityStatus='Waiting for negotiation',healthySince=0;
    // While a photo is sending, the live video steps aside so the photo gets the bandwidth.
    let transferring=0,reapply=false;
    async function applyQuality(active: RTCPeerConnection){
      if(stopped||pc!==active||active.signalingState!=='stable')return;
      if(parametersBusy){reapply=true;return;}   // run again once the current update finishes
      parametersBusy=true;
      try{
        for(const sender of active.getSenders())if(sender.track?.kind==='video'){
          const params=sender.getParameters();if(!params.encodings?.length)continue;
          const p=quality.profile;
          params.degradationPreference='maintain-framerate';
          const bitrate=transferring?Math.min(p.bitrate,250000):p.bitrate,fps=transferring?Math.min(p.fps,15):p.fps;
          params.encodings=params.encodings.map(e=>({...e,maxBitrate:bitrate,maxFramerate:fps,scaleResolutionDownBy:Math.max(1,(sender.track!.getSettings().width||1280)/p.width)}));
          await sender.setParameters(params);
          if(pc===active)qualityStatus=p.name;
        }
      }catch{if(pc===active)qualityStatus='Browser-managed (preview controls unavailable)';}
      finally{parametersBusy=false;if(reapply){reapply=false;void applyQuality(active);}}
    }
    // Last resort: rebuild the whole connection. There is no retry limit while the booth is open;
    // after a few attempts the status line says so, without a popup that would pause the capture.
    const recover = (delay = recoveryDelay(automaticRetries.current)) => {
      if (stopped || recoveryTimer) return;
      recoveryTimer = setTimeout(() => {
        recoveryTimer = undefined;
        if (stopped || pc?.connectionState === 'connected' && channelsOpen()) return;
        automaticRetries.current++;
        recordDiagnostic('camera_retry');
        setAttempt(value => value + 1);
      }, delay);
    };
    // Gentle recovery first. Phones often drop for a few seconds and come back on their own,
    // so: wait 4 s → the creator asks for a new network path (ICE restart), keeping the cameras
    // and photo channel open → only rebuild everything if still down after 15 s.
    let restartTimer: ReturnType<typeof setTimeout> | undefined, escalateTimer: ReturnType<typeof setTimeout> | undefined;
    let restarting = false, handledRestart = 0, iceRestarts = 0;
    function clearRecovery() { clearTimeout(restartTimer); clearTimeout(escalateTimer); restartTimer = escalateTimer = undefined; }
    async function restartIce(force = false) {
      const active = pc;
      if (stopped || !active || room!.role !== 'host' || !guestId || active.signalingState !== 'stable' || (!force && active.connectionState === 'connected')) return;
      iceRestarts++; recordDiagnostic('camera_ice_restart');
      setPhase('Finding a new network path between your cameras…');
      negotiationGeneration = Date.now(); restarting = true;
      await active.setLocalDescription(await active.createOffer({ iceRestart: true }));
      if (!stopped && pc === active) void signal({ type: 'offer', session, to: guestId, restart: true, description: { type: 'offer', sdp: active.localDescription!.sdp } }).catch(report);
    }
    function beginRecovery(urgent: boolean) {
      if (stopped) return;
      setPhase(automaticRetries.current >= 3 ? `Still reconnecting your cameras (attempt ${automaticRetries.current + 1}). Keep both pages open.` : 'Connection interrupted. Reconnecting your cameras…');
      if (room!.role === 'host' && !restartTimer) restartTimer = setTimeout(() => { restartTimer = undefined; void restartIce().catch(() => {}); }, urgent ? 0 : 4000);
      if (!escalateTimer) escalateTimer = setTimeout(() => { escalateTimer = undefined; if (!stopped && !(pc?.connectionState === 'connected' && channelsOpen())) recover(0); }, 15000);
    }
    setRemote(null); setConnected(false); setError('');
    const report = (e: unknown) => { if (!stopped) {const reference=recordDiagnostic('camera_failed',Date.now()-startedAt);setError(`${e instanceof Error ? e.message : 'Camera connection interrupted. Try reconnecting.'} Support reference: ${reference}.`);} };
    setPhase(room.role === 'host' ? 'Waiting for your person’s camera to connect' : 'Contacting your creator’s camera');
    const signal = (message: Signal) => transport?.send({ ...message, generation: message.type === 'hello' ? startedAt : negotiationGeneration, id: crypto.randomUUID() }) ?? Promise.resolve();
    function closePeer() {
      channel?.close(); control?.close(); control=null; pc?.close(); channel = null; pc = null; incoming.clear();
      for (const waiter of acknowledgments.values()) waiter.reject(new Error('Camera connection closed.'));
      acknowledgments.clear(); setRemote(null); setConnected(false);
    }
    function attach(next: RTCDataChannel) {
      if(next.label==='together-control')control=next;else channel=next;
      next.onopen = () => { if (!stopped && channelsOpen()) { connectedAfter = Date.now() - startedAt; recordDiagnostic('camera_connected',connectedAfter);setConnected(true); setError(''); setPhase('Your cameras are connected'); } };
      next.onclose = () => { if (!stopped && (channel === next || control === next)) { setConnected(false); setPhase('Reconnecting your cameras');recover(); } };
      next.onmessage = event => {
        if (stopped || (channel !== next && control !== next) || typeof event.data !== 'string' || event.data.length > 16000) return;
        try {
          const message = JSON.parse(event.data);
          for(const [id,item] of incoming)if(Date.now()-item.updated>30000)incoming.delete(id);
          if(message.type==='cancel'){incoming.delete(message.id);return;}
          if (message.type === 'ack') { acknowledgments.get(message.id)?.resolve(); acknowledgments.delete(message.id); return; }
          if (message.type === 'begin' && typeof message.id === 'string' && Number.isInteger(message.size) && message.size > 0 && message.size <= 6000000 && incoming.size < 4) incoming.set(message.id, { size: message.size, data: '', updated: Date.now() });
          if (message.type === 'part') {
            const item = incoming.get(message.id);
            if (!item || typeof message.data !== 'string') return;
            item.data += message.data;
            item.updated=Date.now();
            if (item.data.length > item.size) { incoming.delete(message.id); return; }
            if (item.data.length === item.size) {
              incoming.delete(message.id);
              const payload = JSON.parse(item.data);
              if (payload && typeof payload.type === 'string') { validatePeerPhotos(payload); listener.current(payload); }
              next.send(JSON.stringify({ type: 'ack', id: message.id }));
            }
          }
        } catch { report(new Error('Could not receive your shared photo. Please retake it.')); }
      };
    }
    sender.current = event => {
      const data=JSON.stringify(event),small=data.length<12000&&!['capture-original','shot','photos'].includes(event.type);
      const task = (small?Promise.resolve():outgoing).then(async () => {
        const active = small?control:channel, id = crypto.randomUUID();
        if (stopped || active?.readyState !== 'open') throw new Error('Wait for both cameras to connect.');
        if (data.length > 6000000) throw new Error('This photo is too large to share. Please try again.');
        const progress=transferProgress();
        if(!small){transferring++;if(pc)void applyQuality(pc);}
        try {
        active.send(JSON.stringify({ type: 'begin', id, size: data.length }));
        for (let offset = 0; offset < data.length; offset += 12000) {
          progress.check(active.bufferedAmount);
          // Keep up to ~1 MB queued: a 32 KB window capped relayed links at ~100–200 KB/s.
          while (active.bufferedAmount > 1048576) {
            if (stopped || active.readyState !== 'open') throw new Error('Camera connection closed.');
            progress.check(active.bufferedAmount);
            await new Promise(resolve => setTimeout(resolve, 40));
          }
          if (stopped || active.readyState !== 'open') throw new Error('Camera connection closed.');
          // Register before sending the final chunk, so even a fast ACK is seen.
          if (offset + 12000 >= data.length) {
            await new Promise<void>((resolve, reject) => {
              // Fail only if nothing has left this phone for 20 s, not after a fixed 20 s:
              // up to 1 MB may still be queued when the last chunk is added.
              const watch = ackWatch();
              const timer = setInterval(() => {
                if (active.readyState !== 'open') { clearInterval(timer); acknowledgments.delete(id); reject(new Error('Camera connection closed.')); return; }
                if (watch.expired(active.bufferedAmount)) { clearInterval(timer); acknowledgments.delete(id); reject(new Error('Your person did not receive the photo. Please reconnect and retake it.')); }
              }, 1000);
              acknowledgments.set(id, { resolve: () => { clearInterval(timer); resolve(); }, reject: e => { clearInterval(timer); reject(e); } });
              try { active.send(JSON.stringify({ type: 'part', id, data: data.slice(offset, offset + 12000) })); }
              catch (e) { clearInterval(timer); acknowledgments.delete(id); reject(e); }
            });
          } else active.send(JSON.stringify({ type: 'part', id, data: data.slice(offset, offset + 12000) }));
          progress.sent(active.bufferedAmount);
        }
        } catch(error) {
          if(active.readyState==='open')try{active.send(JSON.stringify({type:'cancel',id}));}catch{/* Peer may close during cleanup. */}
          throw error;
        } finally { if(!small){transferring--;if(pc)void applyQuality(pc);} }
      });
      // The capture manager owns photo retry UI. A slow photo is not a failed camera.
      if(!small)outgoing = task.catch(()=>{});
      return task;
    };
    function createPeer(id: string) {
      closePeer(); session = id; negotiationGeneration = Date.now(); restarting = false;
      quality=createPreviewQuality();previousStats=new Map();healthySince=0;
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
        void applyQuality(next);
      };
      next.ontrack = event => { if (!stopped && pc === next) setRemote(event.streams[0] || new MediaStream([event.track])); };
      next.onicecandidate = event => { if (!stopped && pc === next && event.candidate) void signal({ type: 'candidate', session: id, candidate: event.candidate.toJSON() }).catch(report); };
      next.onconnectionstatechange = () => {
        if (stopped || pc !== next) return;
        if (next.connectionState === 'failed' || next.connectionState === 'disconnected') { healthySince=0;setConnected(false);beginRecovery(next.connectionState === 'failed'); }
        if (next.connectionState === 'connected' && channelsOpen()) { clearRecovery();clearTimeout(recoveryTimer);recoveryTimer=undefined;restarting=false;setConnected(true); setError('');setPhase('Your cameras are connected'); }
      };
      next.oniceconnectionstatechange = () => {
        if (stopped || pc !== next) return;
        if (next.iceConnectionState === 'checking') setPhase('Camera details exchanged. Checking the network connection');
        // Handled by the recovery steps above; a popup here would pause the capture while it is still fixing itself.
        if (next.iceConnectionState === 'failed') { setConnected(false); beginRecovery(true); }
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
        void signal({ type: 'offer', session, to: guestId, restart: restarting, description: { type: 'offer', sdp: pc.localDescription!.sdp } }).catch(report);
      } else if (message.type === 'offer' && room!.role === 'guest' && message.to === localId && message.session === session && message.restart && pc && message.description?.type === 'offer') {
        // ICE restart from the creator: same connection, new network path. Cameras and the photo channel stay open.
        const generation = message.generation || 0;
        if (generation === handledRestart && pc.localDescription?.type === 'answer') { void signal({ type: 'answer', session, description: { type: 'answer', sdp: pc.localDescription.sdp } }).catch(report); return; }
        handledRestart = generation; iceRestarts++;
        negotiationGeneration = generation || negotiationGeneration;
        await pc.setRemoteDescription(message.description);
        await pc.setLocalDescription(await pc.createAnswer());
        if (!stopped) void signal({ type: 'answer', session, description: { type: 'answer', sdp: pc.localDescription!.sdp } }).catch(report);
      } else if (message.type === 'offer' && room!.role === 'guest' && message.to === localId && message.session === session && pc?.localDescription?.type === 'answer') {
        void signal({ type: 'answer', session, description: { type: 'answer', sdp: pc.localDescription.sdp } }).catch(report);
      } else if (message.type === 'hello' && room!.role === 'host' && (guestId !== message.session || !pc?.localDescription)) {
        guestId = message.session;
        const next = createPeer(crypto.randomUUID()); attach(next.createDataChannel('together')); attach(next.createDataChannel('together-control'));
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
        await pc.setRemoteDescription(message.description); restarting = false;
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
      if(statsBusy)return;statsBusy=true;
      void active.getStats().then(stats => {
        if (stopped || pc !== active) return;
        const sample=videoSample(stats,previousStats);previousStats=sample.next;
        if(active.connectionState==='connected'&&channelsOpen()){
          healthySince ||= Date.now();
          if(Date.now()-healthySince>30000)automaticRetries.current=0;
          if(quality.sample(sample,Date.now()))void applyQuality(active);
        }else healthySince=0;
        let receivedFrames = 0, localCandidates = 0, remoteCandidates = 0;
        const {route,roundTrip}=selectedVideoRoute(stats);
        stats.forEach(report => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') receivedFrames += report.framesDecoded || 0;
          if (report.type === 'local-candidate') localCandidates++;
          if (report.type === 'remote-candidate') remoteCandidates++;
        });
        // Intentionally exclude tokens, room codes, SDP, addresses and photos.
        setDiagnostics(`Role: ${room.role}\nTransport: ${transportName}\nConnection time: ${((connectedAfter ?? Date.now() - startedAt) / 1000).toFixed(1)} seconds\nAutomatic retries: ${automaticRetries.current}\nNetwork path refreshes: ${iceRestarts}\nSignaling: ${active.signalingState}\nNetwork: ${active.iceConnectionState}\nConnection: ${active.connectionState}\nPhoto channel: ${channel?.readyState || 'not created'}\nLocal routes: ${localCandidates}\nRemote routes: ${remoteCandidates}\nSelected route: ${route}\nNetwork round trip: ${roundTrip}\nPreview mode: ${qualityStatus}\nSending: ${sample.sent}\nReceiving: ${sample.received}\nRemote packet loss: ${sample.loss===undefined ? 'Unavailable' : (sample.loss*100).toFixed(1)+'%'}\nVideo frames received: ${receivedFrames}\nRelay configured: ${config?.relayConfigured ? 'yes' : 'no'}`);
      }).catch(() => {}).finally(()=>{statsBusy=false;});
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
      if (!stopped && (pc?.connectionState !== 'connected' || !channelsOpen())) {
        if (pc?.connectionState === 'connected') setError(current => current || 'The photo controls could not connect. Refresh both devices to use the latest booth version, then reconnect.');
        else setPhase('The camera handshake is taking longer than expected. Retrying; keep both camera pages open.');
        if (config) recover();
      }
    }, 25000);
    const hide = () => { stopped = true; clearRecovery(); transport?.close(); clearTimeout(recoveryTimer); clearInterval(helloTimer); clearInterval(statsTimer); closePeer(); };
    const online=()=>{if(!stopped&&pc?.connectionState!=='connected'){automaticRetries.current=0;beginRecovery(true);}};
    // Switching between Wi-Fi and mobile data changes the network path: refresh it right away.
    // The old path can still look "connected" for a few seconds, so the creator refreshes it immediately.
    const networkChanged=()=>{if(!stopped&&room.role==='host'&&pc&&pc.connectionState!=='new')void restartIce(true).catch(()=>{});};
    const connection=(navigator as Navigator & {connection?:EventTarget}).connection;
    window.addEventListener('pagehide', hide);
    window.addEventListener('online',online);
    connection?.addEventListener('change',networkChanged);
    return () => { stopped = true; clearRecovery(); connection?.removeEventListener('change',networkChanged); transport?.close(); clearTimeout(recoveryTimer); clearTimeout(timeout); clearInterval(helloTimer); clearInterval(statsTimer); closePeer(); window.removeEventListener('pagehide', hide);window.removeEventListener('online',online); };
  }, [room?.token, stream, attempt]);
  return { remote, connected, error, phase, diagnostics, reconnect: () => { automaticRetries.current = 0; setAttempt(value => value + 1); }, send: (event: DuoEvent) => sender.current(event) };
}
