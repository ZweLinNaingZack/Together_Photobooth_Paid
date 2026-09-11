import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { layouts } from './core';
import { captureSequence } from './capture';
import { useDuoPeer } from './useDuoPeer';
import type { DuoEvent } from './useDuoPeer';
import type { RoomSession } from './rooms';
import { Heading } from './shared';
import { PhotoTray } from './PhotoTray';
import type { CardState } from './types';
import { ScreenFlash, flashColors } from './ScreenFlash';
import type { FlashColor } from './ScreenFlash';

interface Props {
  room?: RoomSession | null; visible?: boolean;
  duoControl?: RefObject<((event: DuoEvent) => Promise<void>) | null>;
  onRemoteSession?: (index: number | null) => void;
  onSharedPhotos?: (shots: string[]) => void;
  card: CardState; retake: number | null; method: 'manual' | 'timer'; seconds: number;
  onMethod: (method: 'manual' | 'timer') => void; onSeconds: (seconds: number) => void;
  onShot: (index: number, shot: string) => void; onMove: (from: number, to: number) => void;
  onRetake: (index: number | null) => void; onBack: () => void; onNext: (wasCamera: boolean) => void;
  restoreCamera: boolean; interrupted: boolean;
  flash: boolean; flashColor: FlashColor; onFlashChange: (enabled: boolean) => void; onFlashColor: (color: FlashColor) => void;
  mirror: boolean; onMirrorChange: (mirrored: boolean) => void;
}
export function SessionScreen(props: Props) {
  const { card, retake, method, seconds } = props, layout = layouts[card.layout];
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [pending, setPending] = useState(false), [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState<number | string | null>(null);
  const [message, setMessage] = useState(''), [status, setStatus] = useState('');
  const video = useRef<HTMLVideoElement>(null), camera = useRef<MediaStream | null>(null);
  const requestId = useRef(0), requesting = useRef(false);
  const capture = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const view = useRef<HTMLDivElement>(null);
  const [flashLit, setFlashLit] = useState(false);
  const [remoteMirror, setRemoteMirror] = useState(true), [remoteBusy, setRemoteBusy] = useState(false);
  const [otherPaused, setOtherPaused] = useState(false);
  const [videoReady, setVideoReady] = useState(false), [remoteReady, setRemoteReady] = useState(false);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const duo = !!props.room, guest = props.room?.role === 'guest';
  const peer = useDuoPeer(props.room || null, stream, event => {
    if (event.type === 'mirror' && typeof event.value === 'boolean') setRemoteMirror(event.value);
    if (event.type === 'paused' && typeof event.value === 'boolean') { setOtherPaused(event.value); if (event.value) stopCapture(); }
    if (!guest) return;
    if (event.type === 'photos' && Array.isArray(event.shots) && event.shots.length <= layout.count && event.shots.every(shot => typeof shot === 'string' && (!shot || shot.startsWith('data:image/jpeg;base64,')))) props.onSharedPhotos?.(event.shots);
    if (event.type === 'busy' && typeof event.value === 'boolean') { setRemoteBusy(event.value); if (!event.value) { setCountdown(null); setFlashLit(false); } }
    if (event.type === 'countdown' && (event.value === null || typeof event.value === 'number' || event.value === '♡')) setCountdown(event.value as number | string | null);
    if (event.type === 'flash' && typeof event.value === 'boolean') setFlashLit(event.value);
    if (event.type === 'flashColor' && typeof event.value === 'string' && event.value in flashColors) props.onFlashColor(event.value as FlashColor);
    if (event.type === 'shot' && Number.isInteger(event.index) && Number(event.index) >= 0 && Number(event.index) < layout.count && typeof event.shot === 'string' && event.shot.startsWith('data:image/jpeg;base64,')) { props.onShot(Number(event.index), event.shot); props.onRetake(null); }
    if (event.type === 'move' && Number.isInteger(event.from) && Number.isInteger(event.to) && Number(event.from) >= 0 && Number(event.to) >= 0 && Number(event.from) < layout.count && Number(event.to) < layout.count) props.onMove(Number(event.from), Number(event.to));
    if (event.type === 'retake' && (event.index === null || Number.isInteger(event.index) && Number(event.index) >= 0 && Number(event.index) < layout.count)) props.onRemoteSession?.(event.index as number | null);
    if (event.type === 'edit') { props.onRetake(null); props.onNext(true); }
  });
  const share = (event: DuoEvent) => { if (duo && peer.connected) void peer.send(event).catch(() => {}); };
  const ready = card.shots.filter(Boolean).length, complete = ready === layout.count;
  const locked = busy || remoteBusy || pending || props.interrupted;
  const canCapture = !!stream && videoReady && (!duo || peer.connected && remoteReady && !otherPaused);

  function stopCamera() {
    requestId.current++; requesting.current = false;
    camera.current?.getTracks().forEach(track => track.stop()); camera.current = null;
    setStream(null); setPending(false); setVideoReady(false);
  }
  async function toggleCamera() {
    if (camera.current) { stopCamera(); setMessage(''); return; }
    if (requesting.current) return;
    requesting.current = true;
    const id = ++requestId.current;
    setPending(true); setMessage('Waiting for camera permission…');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Unavailable');
      const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      if (!alive.current || id !== requestId.current) { next.getTracks().forEach(track => track.stop()); return; }
      camera.current = next; setStream(next); setMessage('');
    } catch (error) {
      if (alive.current && id === requestId.current) setMessage(!window.isSecureContext ? 'Open the HTTPS invitation link to use your camera.' : error instanceof DOMException && error.name === 'NotAllowedError' ? 'Please allow camera access in your browser, then select Turn camera on.' : 'The camera isn’t available. Check that it’s connected and not in use, then try again.');
    } finally { if (alive.current && id === requestId.current) { requesting.current = false; setPending(false); } }
  }
  function stopCapture() {
    capture.current?.abort(); capture.current = null;
    setFlashLit(false);
    setBusy(false); setCountdown(null); setStatus('Countdown stopped. Your captured photos are saved.');
    if (!guest) share({ type: 'busy', value: false });
  }
  useEffect(() => {
    alive.current = true;
    const release = () => { capture.current?.abort(); requestId.current++; requesting.current = false; camera.current?.getTracks().forEach(track => track.stop()); camera.current = null; };
    const hide = () => { release(); setFlashLit(false); setStream(null); setPending(false); setBusy(false); setCountdown(null); };
    window.addEventListener('pagehide', hide);
    return () => { alive.current = false; release(); window.removeEventListener('pagehide', hide); };
  }, []);
  useEffect(() => { if (video.current) { video.current.srcObject = stream; void video.current.play().catch(() => {}); } }, [stream]);
  useEffect(() => { setRemoteReady(false); if (remoteVideo.current) { remoteVideo.current.srcObject = peer.remote; void remoteVideo.current.play().catch(() => {}); } }, [peer.remote]);
  useEffect(() => { void toggleCamera(); }, []);
  useEffect(() => { if (props.interrupted) stopCapture(); }, [props.interrupted]);
  useEffect(() => { share({ type: 'mirror', value: props.mirror }); }, [props.mirror, peer.connected]);
  useEffect(() => { if (!guest && peer.connected) share({ type: 'photos', shots: card.shots }); }, [peer.connected]);
  useEffect(() => { share({ type: 'paused', value: props.interrupted }); }, [props.interrupted, peer.connected]);
  useEffect(() => { if (duo && !peer.connected) { stopCapture(); setRemoteBusy(false); setRemoteReady(false); } else if (peer.connected) setRemoteReady((remoteVideo.current?.readyState || 0) >= 2); }, [peer.connected]);
  useEffect(() => { if (props.duoControl) props.duoControl.current = peer.send; return () => { if (props.duoControl) props.duoControl.current = null; }; });
  // Keep the data connection for shared retakes, but pause camera transmission in export.
  useEffect(() => { stream?.getVideoTracks().forEach(track => { track.enabled = props.visible !== false; }); }, [stream, props.visible]);

  async function takeShot() {
    const canvas = document.createElement('canvas'); canvas.width = 1440; canvas.height = 960;
    const ctx = canvas.getContext('2d')!;
    if (camera.current && canCapture) {
      const live = video.current;
      if (!live?.videoWidth) throw new Error('The camera is still warming up. Please try again.');
      if (duo) {
        const other = remoteVideo.current;
        if (!other?.videoWidth || other.readyState < 2) throw new Error('Wait for your person’s live camera.');
        const drawHalf = (source: HTMLVideoElement, x: number, mirrored: boolean) => {
          const scale = Math.max(720 / source.videoWidth, 960 / source.videoHeight), w = 720 / scale, h = 960 / scale;
          ctx.save(); ctx.translate(x + (mirrored ? 720 : 0), 0); if (mirrored) ctx.scale(-1, 1);
          ctx.drawImage(source, (source.videoWidth - w) / 2, (source.videoHeight - h) / 2, w, h, 0, 0, 720, 960); ctx.restore();
        };
        drawHalf(guest ? other : live, 0, guest ? remoteMirror : props.mirror);
        drawHalf(guest ? live : other, 720, guest ? props.mirror : remoteMirror);
      } else {
        canvas.height = Math.round(canvas.width * live.videoHeight / live.videoWidth);
        if (props.mirror) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
        ctx.drawImage(live, 0, 0, canvas.width, canvas.height);
      }
    } else throw new Error('Wait for the live camera before taking a photo.');
    return canvas.toDataURL('image/jpeg', .95);
  }
  async function start() {
    if (guest || !canCapture || capture.current || requesting.current || props.interrupted || (complete && retake === null)) return;
    const controller = new AbortController(); capture.current = controller;
    setBusy(true); setMessage('');
    try {
      if (duo) { await peer.send({ type: 'busy', value: true }); await peer.send({ type: 'flashColor', value: props.flashColor }); }
      await captureSequence({ shots: card.shots, count: layout.count, retake, method, seconds, signal: controller.signal, takeShot,
        flash: props.flash, onFlash: (lit: boolean) => { if (alive.current && capture.current === controller) { setFlashLit(lit); share({ type: 'flash', value: lit }); } },
        onShot: async (index: number, shot: string) => { if (duo) await peer.send({ type: 'shot', index, shot }); if (!controller.signal.aborted && alive.current) props.onShot(index, shot); }, onCountdown: (value: number | string | null) => { setCountdown(value); share({ type: 'countdown', value }); }, onTaking: (index: number) => setStatus(`Taking photo ${index + 1} of ${layout.count}`) });
      if (!controller.signal.aborted && alive.current) { props.onRetake(null); setStatus('Photo saved. Reorder, retake, or continue when you’re ready.'); }
    } catch (error) {
      if (!controller.signal.aborted && alive.current) setMessage(error instanceof Error ? error.message : 'Could not take the photo. Please try again.');
    } finally {
      share({ type: 'busy', value: false });
      if (capture.current === controller) { capture.current = null; if (alive.current) { setBusy(false); setCountdown(null); } }
    }
  }
  const defaultStatus = retake !== null ? `Retaking photo ${retake + 1}. Your other photos will stay exactly as they are.` : complete ? 'All photos are ready. Reorder, retake, or make your card yours.' : method === 'manual' ? 'One click takes one photo, with no countdown.' : `A ${seconds}-second countdown before each remaining photo.`;
  return <><Heading eyebrow="NOW, YOUR LITTLE MOMENT" title={<>A smile. A silly face. <em>You.</em></>} note={`${layout.name} · ${layout.note}. Your favorite moments, at your own pace.`} />
    <div className="session-surface"><div className="session-bar"><span>{duo ? 'Together · live cameras' : 'Your live camera'}</span><div className="session-tools"><button type="button" className={`mirror-toggle ${props.mirror ? 'enabled' : ''}`} aria-pressed={props.mirror} disabled={locked || !stream} onClick={() => props.onMirrorChange(!props.mirror)}>Mirror {props.mirror ? 'On' : 'Off'}</button><button className="text-button" id="camera-toggle" disabled={locked} onClick={toggleCamera}>{stream ? 'Turn camera off' : 'Turn camera on'}</button></div></div>
      <div className={`session-view ${duo ? 'duo-live-view' : 'solo-live-view'}`} ref={view}>
        <div className="camera-pane" style={{ order: guest ? 1 : 0 }}><video ref={video} id="live-camera" aria-label="Your live camera" className={props.mirror ? 'mirrored' : ''} autoPlay muted playsInline onPlaying={() => setVideoReady(true)} onEmptied={() => setVideoReady(false)} hidden={!stream} />{(!stream || !videoReady) && <div className="camera-placeholder"><span aria-hidden="true">◎</span><strong>{pending ? 'Opening your camera…' : 'Your camera is off'}</strong><p>{pending ? 'Allow camera access to join the moment.' : 'Turn your camera on to take your photos.'}</p></div>}<span className="camera-name">You</span></div>
        {duo && <div className="camera-pane" style={{ order: guest ? 0 : 1 }}><video ref={remoteVideo} aria-label="Your person’s live camera" className={remoteMirror ? 'mirrored' : ''} autoPlay muted playsInline onPlaying={() => setRemoteReady(true)} onEmptied={() => setRemoteReady(false)} hidden={!peer.remote} />{(!peer.remote || !peer.connected || !remoteReady) && <div className="camera-placeholder"><span aria-hidden="true">♡</span><strong>Waiting for your person…</strong><p>Both of you need to enter this page and allow camera access.</p></div>}<span className="camera-name">Your person</span></div>}
        <div id="shot-countdown" hidden={countdown === null} aria-live="assertive">{countdown}</div>
      </div>
      <ScreenFlash active={flashLit} color={props.flashColor} view={view} />
      <p id="camera-message" className="session-note" role="status">{message || (duo ? peer.connected ? 'Both cameras are connected. The creator takes each photo and shares it with both of you.' : `${peer.phase}. Your microphone stays off.` : 'Your photos stay in this browser tab.')}</p>
      {duo && peer.error && <div className="camera-connection-error" role="alert"><p>{peer.error}</p><button className="outline-button" disabled={locked || !stream} onClick={peer.reconnect}>Reconnect cameras</button></div>}
      {duo && !peer.connected && peer.diagnostics && <details className="connection-details"><summary>Connection details</summary><p>These details help troubleshoot the connection. They contain no photos or invitation codes.</p><pre>{peer.diagnostics}</pre></details>}
      {guest && <p className="session-note">Your creator controls the countdown, retakes, and photo order. Each shared photo appears below.</p>}
      <div className="capture-settings" hidden={guest}><fieldset disabled={locked}><legend>HOW SHALL WE TAKE THEM?</legend>{(['timer', 'manual'] as const).map(value => <label key={value}><input type="radio" name="capture-method" value={value} checked={method === value} onChange={() => { props.onMethod(value); setStatus(''); }} /> {value === 'timer' ? 'With a timer' : 'Manual click'}</label>)}</fieldset><label className="timer-setting" hidden={method === 'manual'}>COUNTDOWN<select id="timer-seconds" value={seconds} disabled={locked} onChange={e => { props.onSeconds(Number(e.target.value)); setStatus(''); }}>{[3, 5, 7].map(value => <option key={value} value={value}>{value} seconds</option>)}</select></label></div>
      <div className="flash-settings" hidden={guest}>
        <div className="flash-setting-heading"><div><strong>Screen flash</strong><p>A little light for your moment.</p></div><button type="button" className={`flash-toggle ${props.flash ? 'enabled' : ''}`} aria-pressed={props.flash} disabled={locked} onClick={() => props.onFlashChange(!props.flash)}>Flash {props.flash ? 'On' : 'Off'}</button></div>
        {props.flash && <fieldset className="flash-colors" disabled={locked}><legend>FLASH COLOR</legend>{Object.entries(flashColors).map(([key, value]) => <label key={key}><input type="radio" name="flash-color" value={key} checked={props.flashColor === key} onChange={() => props.onFlashColor(key as FlashColor)} /><span className="flash-color-dot" style={{ background: value.color }} aria-hidden="true" />{value.label}</label>)}</fieldset>}
        {props.flash && <p className="flash-note">Your screen lights up just before each photo. Keep your screen bright and your face close for more light.</p>}
      </div>
      <p id="session-status" aria-live="polite">{guest ? remoteBusy ? 'Your creator is taking your shared photos…' : complete ? 'Your photos are ready. Your creator can take you both to export.' : 'Ready when your creator is.' : busy ? status : retake !== null ? defaultStatus : status || defaultStatus}</p>
      <div className="session-buttons"><button className="text-button" disabled={locked} onClick={props.onBack}>{guest ? 'Leave session' : 'Change design'}</button>{retake !== null && !guest && <button className="text-button" disabled={locked} onClick={() => { props.onRetake(null); share({ type: 'retake', index: null }); setStatus(''); }}>Cancel retake</button>}<button className="primary" id="capture-session" hidden={guest} disabled={locked || !canCapture || (complete && retake === null)} onClick={start}>{retake !== null ? `Retake photo ${retake + 1}` : method === 'manual' ? 'Take a photo' : ready ? 'Continue countdown' : 'Start the countdown'} <span aria-hidden="true">◎</span></button><button className="outline-button" hidden={!busy} onClick={stopCapture}>Stop countdown</button><button className="secondary" hidden={guest} disabled={locked || !complete || retake !== null || (duo && !peer.connected)} onClick={async () => { try { if (duo) await peer.send({ type: 'edit' }); props.onNext(!!stream); } catch (e) { setMessage(e instanceof Error ? e.message : 'Please reconnect.'); } }}>Make it yours</button></div>
      <PhotoTray shots={card.shots} count={layout.count} retake={retake} disabled={locked || guest || (duo && !peer.connected)} onMove={props.onMove} onRetake={index => { props.onRetake(index); share({ type: 'retake', index }); }} />
    </div>
  </>;
}
