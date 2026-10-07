import { WarningNotice } from '../components/WarningNotice';
import { CameraCardPreview } from './CameraCardPreview';
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
import {cameraConstraints,takePreparedCamera,snapshot,combinePortraits} from './cameraQuality.js';
import {createDuoCaptures} from './duoCaptures.mjs';
import {diagnosticReport} from './diagnostics.js';
import {unlockCameraSound,cameraSound} from './cameraSounds.js';

interface Props {
  beforeReview: () => Promise<boolean>;
  onPartnerConnection?: (connected: boolean | null) => void;
  onPartnerExit?: () => void;
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
  const [devices,setDevices]=useState<MediaDeviceInfo[]>([]);
  useEffect(()=>{if(stream)void navigator.mediaDevices.enumerateDevices().then(items=>setDevices(items.filter(d=>d.kind==='videoinput'))).catch(()=>{});},[stream]);
  const [countdown, setCountdown] = useState<number | string | null>(null);
  const [message, setMessage] = useState(''), [status, setStatus] = useState('');
  const video = useRef<HTMLVideoElement>(null), camera = useRef<MediaStream | null>(null);
  const requestId = useRef(0), requesting = useRef(false);
  const capture = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const view = useRef<HTMLDivElement>(null);
  const [shutter, setShutter] = useState(0);
  const [sound,setSound]=useState(true);
  useEffect(()=>{if(sound&&typeof countdown==='number'&&countdown>0)cameraSound(countdown);},[countdown]);
  useEffect(()=>{const unlock=()=>unlockCameraSound();window.addEventListener('pointerdown',unlock,{once:true});window.addEventListener('keydown',unlock,{once:true});return()=>{window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock);};},[]);
  const [flashLit, setFlashLit] = useState(false);
  const [remoteMirror, setRemoteMirror] = useState(true), [remoteBusy, setRemoteBusy] = useState(false);
  const [otherPaused, setOtherPaused] = useState(false);
  const [videoReady, setVideoReady] = useState(false), [remoteReady, setRemoteReady] = useState(false);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const duo = !!props.room, guest = props.room?.role === 'guest';
  const [syncCount,setSyncCount]=useState(0),[syncError,setSyncError]=useState('');
  const [pendingPreviews,setPendingPreviews]=useState<Record<number,string>>({});
  const visibleShots=[...card.shots];for(const [index,photo] of Object.entries(pendingPreviews))visibleShots[Number(index)]=photo;
  const slot=layout.slots[0],photoRatio=slot.w*layout.width/(slot.h*layout.height);
  const captureIndex=useRef(0),sendCapture=useRef<(event:DuoEvent)=>Promise<void>>(async()=>{});
  const latestCapture=useRef({props,sound,photoRatio});latestCapture.current={props,sound,photoRatio};
  const sync=useRef<ReturnType<typeof createDuoCaptures>|null>(null);
  useEffect(()=>{if(!duo)return;const manager=createDuoCaptures({guest,count:layout.count,
    snapshot:()=>{if(latestCapture.current.props.interrupted||latestCapture.current.props.visible===false)throw Error('Camera session paused.');return snapshot(video.current,latestCapture.current.props.mirror,latestCapture.current.photoRatio/2);},
    combine:combinePortraits,send:(event:DuoEvent)=>sendCapture.current(event),
    onPhoto:(index:number,photo:string)=>{if(alive.current){setPendingPreviews(current=>{const next={...current};delete next[index];return next;});latestCapture.current.props.onShot(index,photo);}},
    onPreview:(index:number,photo:string)=>{if(alive.current)setPendingPreviews(current=>({...current,[index]:photo}));},
    onPending:(count:number)=>{if(alive.current){setSyncCount(count);if(!count)setSyncError('');}},
    onError:(error:string)=>{if(alive.current)setSyncError(error);},
    onCaptured:()=>{if(alive.current){setShutter(value=>value+1);setFlashLit(false);if(latestCapture.current.sound)cameraSound('shutter');}}
  });sync.current=manager;return()=>{manager.dispose();if(sync.current===manager)sync.current=null;};},[duo,guest,layout.count]);
  const peer = useDuoPeer(props.room || null, stream, event => {
    sync.current?.receive(event);
    if (event.type === 'leave') props.onPartnerExit?.();
    if (event.type === 'mirror' && typeof event.value === 'boolean') setRemoteMirror(event.value);
    if (event.type === 'paused' && typeof event.value === 'boolean') { setOtherPaused(event.value); if (event.value) stopCapture(); }
    if (!guest) return;
    if (event.type === 'photos' && Array.isArray(event.shots) && event.shots.length <= layout.count && event.shots.every(shot => typeof shot === 'string' && (!shot || shot.startsWith('data:image/jpeg;base64,')))) props.onSharedPhotos?.(event.shots);
    if (event.type === 'busy' && typeof event.value === 'boolean') { setRemoteBusy(event.value); if (!event.value) { setCountdown(null); setFlashLit(false); } }
    if (event.type === 'countdown' && (event.value === null || typeof event.value === 'number' || event.value === '♡')) setCountdown(event.value as number | string | null);
    if (event.type === 'shutter') setShutter(value => value + 1);
    if (event.type === 'flash' && typeof event.value === 'boolean') setFlashLit(event.value);
    if (event.type === 'flashColor' && typeof event.value === 'string' && event.value in flashColors) props.onFlashColor(event.value as FlashColor);
    if (event.type === 'shot' && Number.isInteger(event.index) && Number(event.index) >= 0 && Number(event.index) < layout.count && typeof event.shot === 'string' && event.shot.startsWith('data:image/jpeg;base64,')) { props.onShot(Number(event.index), event.shot); props.onRetake(null); }
    if (event.type === 'move' && Number.isInteger(event.from) && Number.isInteger(event.to) && Number(event.from) >= 0 && Number(event.to) >= 0 && Number(event.from) < layout.count && Number(event.to) < layout.count) props.onMove(Number(event.from), Number(event.to));
    if (event.type === 'retake' && (event.index === null || Number.isInteger(event.index) && Number(event.index) >= 0 && Number(event.index) < layout.count)) props.onRemoteSession?.(event.index as number | null);
    if (event.type === 'edit') { props.onRetake(null); props.onNext(true); }
  });
  sendCapture.current=peer.send;
  const share = (event: DuoEvent) => { if (duo && peer.connected) void peer.send(event).catch(() => {}); };
  const ready = visibleShots.filter(Boolean).length, complete = ready === layout.count;
  const reviewLock = useRef(false);
  async function review() {
    if (reviewLock.current) return;
    if(sync.current?.pending()){setSyncError('Wait for the original photos to finish syncing before editing.');return;}
    reviewLock.current = true; setBusy(true);
    try {
      if (!await props.beforeReview()) return;
      if (!alive.current) return;
      // Billing is committed at this point. A late disconnect must not strand
      // the creator's paid photos; notify the guest again on reconnection.
      if (duo && peer.connected) { try { await peer.send({ type: 'edit' }); } catch { /* The disconnect dialog handles the lost peer. */ } }
      props.onNext(!!stream);
    } catch (e) { if (alive.current) setMessage(e instanceof Error ? e.message : 'Please retry.'); }
    finally { reviewLock.current = false; if (alive.current) setBusy(false); }
  }
  const locked = busy || remoteBusy || pending || props.interrupted;
  const canCapture = !!stream && videoReady && (!duo || !!props.room?.bothReady && peer.connected && remoteReady && !otherPaused);

  function stopCamera() {
    requestId.current++; requesting.current = false;
    camera.current?.getTracks().forEach(track => track.stop()); camera.current = null;
    setStream(null); setPending(false); setVideoReady(false);
  }
  async function toggleCamera(deviceId?:string) {
    if (camera.current) { stopCamera(); setMessage(''); return; }
    if (requesting.current) return;
    requesting.current = true;
    const id = ++requestId.current;
    setPending(true); setMessage('Waiting for camera permission…');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Unavailable');
      const next = takePreparedCamera() || await navigator.mediaDevices.getUserMedia(deviceId?{audio:false,video:{...cameraConstraints.video,facingMode:undefined,deviceId:{exact:deviceId}}}:cameraConstraints);
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
  useEffect(() => { if (duo && !props.room?.bothReady) stopCapture(); }, [duo, props.room?.bothReady]);
  useEffect(() => { share({ type: 'mirror', value: props.mirror }); }, [props.mirror, peer.connected]);
  useEffect(() => { if (!guest && peer.connected) {void (async()=>{if(sync.current?.pending()){await sync.current.retry();return;}for(const [index,shot] of card.shots.entries())if(shot)await peer.send({type:'shot',index,shot});if(props.visible===false)await peer.send({type:'edit'});})().catch(()=>setStatus('Your earlier photos are safe. Reconnect to finish sharing them.'));} }, [peer.connected]);
  useEffect(() => { share({ type: 'paused', value: props.interrupted }); }, [props.interrupted, peer.connected]);
  useEffect(() => { if (duo && !peer.connected) { stopCapture(); setRemoteBusy(false); setRemoteReady(false); } else if (peer.connected) setRemoteReady((remoteVideo.current?.readyState || 0) >= 2); }, [peer.connected]);
  useEffect(() => { props.onPartnerConnection?.(stream ? peer.connected : null); }, [peer.connected, stream, props.onPartnerConnection]);
  useEffect(() => { if (props.duoControl) props.duoControl.current = peer.send; return () => { if (props.duoControl) props.duoControl.current = null; }; });
  // Keep the data connection for shared retakes, but pause camera transmission in export.
  useEffect(() => { stream?.getVideoTracks().forEach(track => { track.enabled = props.visible !== false; }); }, [stream, props.visible]);

  async function takeShot() {
    if(!camera.current||!canCapture)throw new Error('Wait for both cameras to be ready.');
    if(duo){await sync.current!.capture(captureIndex.current);return previewShot();}
    const photo=snapshot(video.current,props.mirror);if(sound)cameraSound('shutter');return photo;
  }
  async function previewShot(){
    const local=snapshot(video.current,props.mirror,duo?photoRatio/2:null,640);
    if(!duo)return local;
    const other=snapshot(remoteVideo.current,remoteMirror,photoRatio/2,640);
    return guest?combinePortraits(other,local):combinePortraits(local,other);
  }
  async function start() {
    if(sound)unlockCameraSound();
    if (guest || !canCapture || capture.current || requesting.current || props.interrupted || (complete && retake === null)) return;
    const controller = new AbortController(); capture.current = controller;
    setBusy(true); setMessage('');
    try {
      if (duo) await Promise.all([peer.send({ type: 'busy', value: true }),peer.send({ type: 'flashColor', value: props.flashColor })]);
      await captureSequence({ shots: visibleShots, count: layout.count, retake, method, seconds, signal: controller.signal, takeShot,
        onShutter: () => { if(!duo)setShutter(value => value + 1); }, flash: props.flash, onFlash: (lit: boolean) => { if (alive.current && capture.current === controller) { setFlashLit(lit); share({ type: 'flash', value: lit }); } },
        onShot: async (index: number, shot: string) => { if (!controller.signal.aborted && alive.current){if(duo)sync.current?.preview(index,shot);else props.onShot(index,shot);} }, onCountdown: (value: number | string | null) => { setCountdown(value); share({ type: 'countdown', value }); }, onTaking: (index: number) => {captureIndex.current=index;setStatus(`Taking photo ${index + 1} of ${layout.count}`);} });
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
    <div className="session-surface"><div className="session-bar"><span>{duo ? 'Together · live cameras' : 'Your live camera'}</span><div className="session-tools"><button className="mirror-toggle" aria-pressed={sound} onClick={()=>{unlockCameraSound();setSound(value=>!value);}}>Sound {sound ? 'On' : 'Off'}</button><button type="button" className={`mirror-toggle ${props.mirror ? 'enabled' : ''}`} aria-pressed={props.mirror} disabled={locked || !stream} onClick={() => props.onMirrorChange(!props.mirror)}>Mirror {props.mirror ? 'On' : 'Off'}</button><button className="text-button" id="camera-toggle" disabled={locked} onClick={()=>void toggleCamera()}>{stream ? 'Turn camera off' : 'Turn camera on'}</button></div></div>
      <p className="session-note">Preview matches the first photo slot. Keep your face inside the edges; you can adjust each crop when editing.</p>{devices.length>1&&<label className="session-note">Camera <select disabled={locked} value={stream?.getVideoTracks()[0]?.getSettings().deviceId||''} onChange={e=>{stopCamera();void toggleCamera(e.target.value);}}>{devices.map((device,i)=><option key={device.deviceId} value={device.deviceId}>{device.label||`Camera ${i+1}`}</option>)}</select></label>}<div style={{aspectRatio:String(photoRatio),maxHeight:'none',maxWidth:`min(100%, ${photoRatio*55}svh)`,marginInline:'auto'}} className={`session-view ${duo ? 'duo-live-view' : 'solo-live-view'}`} ref={view}>
        <div className="camera-pane" style={{ order: guest ? 1 : 0 }}><video ref={video} id="live-camera" aria-label="Your live camera" className={props.mirror ? 'mirrored' : ''} autoPlay muted playsInline onPlaying={() => setVideoReady(true)} onEmptied={() => setVideoReady(false)} hidden={!stream} />{(!stream || !videoReady) && <div className="camera-placeholder"><span aria-hidden="true">◎</span><strong>{pending ? 'Opening your camera…' : 'Your camera is off'}</strong><p>{pending ? 'Allow camera access to join the moment.' : 'Turn your camera on to take your photos.'}</p></div>}<span className="camera-name">You</span></div>
        {duo && <div className="camera-pane" style={{ order: guest ? 0 : 1 }}><video ref={remoteVideo} aria-label="Your person’s live camera" className={remoteMirror ? 'mirrored' : ''} autoPlay muted playsInline onPlaying={() => setRemoteReady(true)} onEmptied={() => setRemoteReady(false)} hidden={!peer.remote} />{(!peer.remote || !peer.connected || !remoteReady) && <div className="camera-placeholder"><span aria-hidden="true">♡</span><strong>Waiting for your person…</strong><p>Both of you need to enter this page and allow camera access.</p></div>}<span className="camera-name">Your person</span></div>}
        {shutter > 0 && <div key={shutter} className="shutter-flash" aria-hidden="true" />}
        <div id="shot-countdown" hidden={countdown === null} aria-live="assertive">{countdown}</div>
      </div>
      <div className="capture-near-preview" hidden={guest}><button className="primary" id="capture-session" hidden={guest} disabled={locked || !canCapture || (complete && retake === null)} onClick={start}>{retake !== null ? `Retake photo ${retake + 1}` : method === 'manual' ? 'Take a photo' : ready ? 'Continue countdown' : 'Start the countdown'} <span aria-hidden="true">◎</span></button><button className="outline-button capture-stop" hidden={!busy} onClick={stopCapture}>Stop countdown</button></div>
      <ScreenFlash active={flashLit} color={props.flashColor} view={view} />
      <p id="camera-message" className="session-note" role="status">{message && message !== 'Waiting for camera permission…' ? '' : message || (duo ? peer.connected ? 'Both cameras are connected. The creator takes each photo and shares it with both of you.' : `${peer.phase}. Your microphone stays off.` : 'Your photos stay in this browser tab.')}</p>
      <WarningNotice>{message !== 'Waiting for camera permission…' ? message : ''}</WarningNotice>
      {duo && peer.error && <WarningNotice title="Camera connection"><p>{peer.error}</p><button className="outline-button" disabled={locked || !stream} onClick={peer.reconnect}>Reconnect cameras</button></WarningNotice>}
      {duo && peer.diagnostics && <details className="connection-details"><summary>Connection details</summary><p>These details help troubleshoot the connection. They contain no photos or invitation codes.</p><pre>{peer.diagnostics}</pre><button className="text-button" onClick={async()=>{try{await navigator.clipboard.writeText(peer.diagnostics+"\n"+diagnosticReport());setStatus("Support details copied. No photos or account details included.");}catch{setStatus("Select the connection details above to copy them.");}}}>Copy support details</button></details>}
      {guest && <p className="session-note">Your creator controls the countdown, retakes, and photo order. Each shared photo appears below.</p>}
      <div className="capture-settings" hidden={guest}><fieldset disabled={locked}><legend>HOW SHALL WE TAKE THEM?</legend>{(['timer', 'manual'] as const).map(value => <label key={value}><input type="radio" name="capture-method" value={value} checked={method === value} onChange={() => { props.onMethod(value); setStatus(''); }} /> {value === 'timer' ? 'With a timer' : 'Manual click'}</label>)}</fieldset><label className="timer-setting" hidden={method === 'manual'}>COUNTDOWN<select id="timer-seconds" value={seconds} disabled={locked} onChange={e => { props.onSeconds(Number(e.target.value)); setStatus(''); }}>{[3, 5, 7].map(value => <option key={value} value={value}>{value} seconds</option>)}</select></label></div>
      <div className="flash-settings" hidden={guest}>
        <div className="flash-setting-heading"><div><strong>Screen flash</strong><p>A little light for your moment.</p></div><button type="button" className={`flash-toggle ${props.flash ? 'enabled' : ''}`} aria-pressed={props.flash} disabled={locked} onClick={() => props.onFlashChange(!props.flash)}>Flash {props.flash ? 'On' : 'Off'}</button></div>
        {props.flash && <fieldset className="flash-colors" disabled={locked}><legend>FLASH COLOR</legend>{Object.entries(flashColors).map(([key, value]) => <label key={key}><input type="radio" name="flash-color" value={key} checked={props.flashColor === key} onChange={() => props.onFlashColor(key as FlashColor)} /><span className="flash-color-dot" style={{ background: value.color }} aria-hidden="true" />{value.label}</label>)}</fieldset>}
        {props.flash && <p className="flash-note">Your screen lights up just before each photo. Keep your screen bright and your face close for more light.</p>}
      </div>
      <p id="session-status" aria-live="polite">{guest ? remoteBusy ? 'Your creator is taking your shared photos…' : complete ? 'Your photos are ready. Your creator can take you both to export.' : 'Ready when your creator is.' : busy ? status : retake !== null ? defaultStatus : status || defaultStatus}</p>
<div className="session-buttons"><button className="text-button" disabled={locked} onClick={props.onBack}>{duo ? 'Leave session' : 'Change layout'}</button>{retake !== null && !guest && <button className="text-button" disabled={locked} onClick={() => { props.onRetake(null); share({ type: 'retake', index: null }); setStatus(''); }}>Cancel retake</button>}<button className="secondary" hidden={guest} disabled={locked || syncCount>0 || !complete || retake !== null} onClick={review}>Continue to editing</button></div>
      {card.template && <CameraCardPreview card={card} ready={canCapture && !locked} capture={previewShot} retake={retake} />}
      {duo&&syncCount>0&&<p className="session-note" role="status">Finishing {syncCount} high-quality photo{syncCount===1?'':'s'} in the background. You can take the next photo; editing unlocks when both copies are ready.</p>}
      <WarningNotice title="Photo sync">{syncError&&<><p>{syncError}</p><button className="outline-button" disabled={!peer.connected} onClick={()=>{setSyncError('');void sync.current?.retry();}}>Retry photo sync</button>{!guest&&<button className="text-button" disabled={!peer.connected||busy} onClick={()=>{props.onRetake(sync.current?.pendingIndex()??null);setSyncError('');}}>Retake unsynced photo</button>}</>}</WarningNotice>
      <PhotoTray shots={visibleShots} count={layout.count} retake={retake} disabled={locked || syncCount>0 || guest || (duo && !peer.connected)} onMove={props.onMove} onRetake={index => { props.onRetake(index); share({ type: 'retake', index }); }} />
    </div>
  </>;
}
