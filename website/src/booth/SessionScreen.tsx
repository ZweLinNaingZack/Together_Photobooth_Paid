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
import {cameraConstraints,takePreparedCamera,snapshot,combinePortraits,openFacingCamera,hasBackCamera,DUO_ORIGINAL} from './cameraQuality.js';
type Facing = 'user' | 'environment';
/** Which camera to open: a side (phones) or a specific device (computers with several webcams). */
type CameraChoice = { facing: Facing } | { deviceId: string };
import {createDuoCaptures} from './duoCaptures.mjs';
import {diagnosticReport} from './diagnostics.js';
import {unlockCameraSound,cameraSound} from './cameraSounds.js';
import { tm, useT, type Key } from '../i18n';
import { Rich } from '../i18n/Rich';
import { layoutName, layoutNote } from '../i18n/layouts';

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
  const t = useT();
  const waitingPermission = t('session.waitingPermission');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [pending, setPending] = useState(false), [busy, setBusy] = useState(false);
  const [devices,setDevices]=useState<MediaDeviceInfo[]>([]);
  // Phones get a simple Front / Back choice (front by default); "back" always opens the main lens.
  const [facing,setFacing]=useState<Facing>('user');
  const phoneCameras=hasBackCamera(devices);
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
    snapshot:()=>{if(latestCapture.current.props.interrupted||latestCapture.current.props.visible===false)throw Error('Camera session paused.');return snapshot(video.current,latestCapture.current.props.mirror,latestCapture.current.photoRatio/2,DUO_ORIGINAL.maxEdge,DUO_ORIGINAL.quality);},
    combine:combinePortraits,send:(event:DuoEvent)=>sendCapture.current(event),
    onPhoto:(index:number,photo:string)=>{if(alive.current){setPendingPreviews(current=>{const next={...current};delete next[index];return next;});latestCapture.current.props.onShot(index,photo);}},
    onPreview:(index:number,photo:string)=>{if(alive.current)setPendingPreviews(current=>({...current,[index]:photo}));},
    onPending:(count:number)=>{if(alive.current){setSyncCount(count);if(!count)setSyncError('');}},
    onError:(error:string)=>{if(alive.current)setSyncError(error);},
    onCaptured:()=>{if(alive.current){setShutter(value=>value+1);setFlashLit(false);if(latestCapture.current.sound)cameraSound('shutter');}}
  });sync.current=manager;return()=>{manager.dispose();if(sync.current===manager)sync.current=null;};},[duo,guest,layout.count]);
  const peer = useDuoPeer(props.room || null, stream, event => {
    sync.current?.receive(event);
    // The guest makes its own quick preview at the shutter moment, so it always has a fallback
    // if the creator's full photo is slow to arrive.
    if (event.type === 'capture-local' && guest && Number.isInteger(event.index)) void previewShot().then(photo => sync.current?.preview(Number(event.index), photo)).catch(() => {});
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
    if (event.type === 'edit') { commitPreviews(); props.onRetake(null); props.onNext(true); }
  });
  sendCapture.current=peer.send;
  const share = (event: DuoEvent) => { if (duo && peer.connected) void peer.send(event).catch(() => {}); };
  const ready = visibleShots.filter(Boolean).length, complete = ready === layout.count;
  const reviewLock = useRef(false);
  /**
   * Put the quick preview into any slot whose full photo has not arrived yet. The full photo
   * still replaces it automatically when it lands (this screen stays connected while editing).
   */
  function commitPreviews() {
    for (const [index, photo] of Object.entries(pendingPreviews)) if (!card.shots[Number(index)]) props.onShot(Number(index), photo);
  }
  async function review() {
    if (reviewLock.current) return;
    reviewLock.current = true; setBusy(true);
    try {
      if (sync.current?.pending()) {
        // Give slow photos a short moment, then carry on with previews instead of blocking editing.
        setStatus(t('session.finishing'));
        const deadline = Date.now() + 8000;
        while (sync.current?.pending() && Date.now() < deadline && alive.current) await new Promise(resolve => setTimeout(resolve, 250));
        if (!alive.current) return;
        if (sync.current?.pending()) {
          const missing = Array.from({ length: layout.count }, (_, index) => index).filter(index => !card.shots[index] && !pendingPreviews[index]);
          if (missing.length) { setSyncError(t('session.missing', { n: missing[0] + 1 })); return; }
          commitPreviews();
          setStatus(t('session.stillArriving'));
        }
      }
      if (!await props.beforeReview()) return;
      if (!alive.current) return;
      // Billing is committed at this point. A late disconnect must not strand
      // the creator's paid photos; notify the guest again on reconnection.
      if (duo && peer.connected) { try { await peer.send({ type: 'edit' }); } catch { /* The disconnect dialog handles the lost peer. */ } }
      props.onNext(!!stream);
    } catch (e) { if (alive.current) setMessage(e instanceof Error ? e.message : t('session.retry')); }
    finally { reviewLock.current = false; if (alive.current) setBusy(false); }
  }
  const locked = busy || remoteBusy || pending || props.interrupted;
  const canCapture = !!stream && videoReady && (!duo || !!props.room?.bothReady && peer.connected && remoteReady && !otherPaused);

  function stopCamera() {
    requestId.current++; requesting.current = false;
    camera.current?.getTracks().forEach(track => track.stop()); camera.current = null;
    setStream(null); setPending(false); setVideoReady(false);
  }
  async function toggleCamera(choice?: CameraChoice) {
    if (camera.current) { stopCamera(); setMessage(''); return; }
    if (requesting.current) return;
    requesting.current = true;
    const id = ++requestId.current;
    setPending(true); setMessage(waitingPermission);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Unavailable');
      const side = choice && 'facing' in choice ? choice.facing : facing;
      // The waiting room warms up the front camera; reuse it only when the front camera is wanted.
      const next = choice && 'deviceId' in choice
        ? await navigator.mediaDevices.getUserMedia({audio:false,video:{...cameraConstraints.video,facingMode:undefined,deviceId:{exact:choice.deviceId}}})
        : (side === 'user' && takePreparedCamera()) || await openFacingCamera(side);
      if (!alive.current || id !== requestId.current) { next.getTracks().forEach(track => track.stop()); return; }
      camera.current = next; setStream(next); setMessage('');
    } catch (error) {
      if (alive.current && id === requestId.current) setMessage(t(!window.isSecureContext ? 'session.needHttps' : error instanceof DOMException && error.name === 'NotAllowedError' ? 'session.allowCamera' : 'session.cameraUnavailable'));
    } finally { if (alive.current && id === requestId.current) { requesting.current = false; setPending(false); } }
  }
  function stopCapture() {
    capture.current?.abort(); capture.current = null;
    setFlashLit(false);
    setBusy(false); setCountdown(null); setStatus(t('session.stopped'));
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
  useEffect(() => { if (!guest && peer.connected) {void (async()=>{if(sync.current?.pending()){await sync.current.retry();return;}for(const [index,shot] of card.shots.entries())if(shot)await peer.send({type:'shot',index,shot});if(props.visible===false)await peer.send({type:'edit'});})().catch(()=>setStatus(t('session.earlierSafe')));} }, [peer.connected]);
  useEffect(() => { share({ type: 'paused', value: props.interrupted }); }, [props.interrupted, peer.connected]);
  useEffect(() => { if (duo && !peer.connected) { stopCapture(); setRemoteBusy(false); setRemoteReady(false); } else if (peer.connected) setRemoteReady((remoteVideo.current?.readyState || 0) >= 2); }, [peer.connected]);
  useEffect(() => { props.onPartnerConnection?.(stream ? peer.connected : null); }, [peer.connected, stream, props.onPartnerConnection]);
  useEffect(() => { if (props.duoControl) props.duoControl.current = peer.send; return () => { if (props.duoControl) props.duoControl.current = null; }; });
  // Keep the data connection for shared retakes, but pause camera transmission in export.
  useEffect(() => { stream?.getVideoTracks().forEach(track => { track.enabled = props.visible !== false; }); }, [stream, props.visible]);

  async function takeShot() {
    if(!camera.current||!canCapture)throw new Error(t('session.waitBoth'));
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
        onShot: async (index: number, shot: string) => { if (!controller.signal.aborted && alive.current){if(duo)sync.current?.preview(index,shot);else props.onShot(index,shot);} }, onCountdown: (value: number | string | null) => { setCountdown(value); share({ type: 'countdown', value }); }, onTaking: (index: number) => {captureIndex.current=index;setStatus(t('session.taking', { n: index + 1, total: layout.count }));} });
      if (!controller.signal.aborted && alive.current) { props.onRetake(null); setStatus(t('session.saved')); }
    } catch (error) {
      if (!controller.signal.aborted && alive.current) setMessage(error instanceof Error ? error.message : t('session.captureFailed'));
    } finally {
      share({ type: 'busy', value: false });
      if (capture.current === controller) { capture.current = null; if (alive.current) { setBusy(false); setCountdown(null); } }
    }
  }
  const defaultStatus = retake !== null ? t('session.retaking', { n: retake + 1 }) : complete ? t('session.allReady') : method === 'manual' ? t('session.manualHelp') : t('session.timerHelp', { n: seconds });
  return <><Heading eyebrow={t('session.eyebrow')} title={<Rich text={t('session.title')} />} note={`${layoutName(layout)} · ${layoutNote(layout)}. ${t('session.note')}`} />
    <div className="session-surface"><div className="session-bar"><span>{t(duo ? 'session.duoBar' : 'session.soloBar')}</span><div className="session-tools"><button className="mirror-toggle" aria-pressed={sound} onClick={()=>{unlockCameraSound();setSound(value=>!value);}}>{t('session.sound', { state: t(sound ? 'common.on' : 'common.off') })}</button><button type="button" className={`mirror-toggle ${props.mirror ? 'enabled' : ''}`} aria-pressed={props.mirror} disabled={locked || !stream} onClick={() => props.onMirrorChange(!props.mirror)}>{t('session.mirror', { state: t(props.mirror ? 'common.on' : 'common.off') })}</button><button className="text-button" id="camera-toggle" disabled={locked} onClick={()=>void toggleCamera()}>{t(stream ? 'session.cameraOff' : 'session.cameraOn')}</button></div></div>
      <div style={{aspectRatio:String(photoRatio),maxHeight:'none',maxWidth:`min(100%, ${photoRatio*55}svh)`,marginInline:'auto'}} className={`session-view ${duo ? 'duo-live-view' : 'solo-live-view'}`} ref={view}>
        <div className="camera-pane" style={{ order: guest ? 1 : 0 }}><video ref={video} id="live-camera" aria-label={t('session.soloBar')} className={props.mirror ? 'mirrored' : ''} autoPlay muted playsInline onPlaying={() => setVideoReady(true)} onEmptied={() => setVideoReady(false)} hidden={!stream} />{(!stream || !videoReady) && <div className="camera-placeholder"><span aria-hidden="true">◎</span><strong>{t(pending ? 'session.opening' : 'session.isOff')}</strong><p>{t(pending ? 'session.allowToJoin' : 'session.turnOn')}</p></div>}<span className="camera-name">{t('room.you')}</span></div>
        {duo && <div className="camera-pane" style={{ order: guest ? 0 : 1 }}><video ref={remoteVideo} aria-label={t('session.partnerCamera')} className={remoteMirror ? 'mirrored' : ''} autoPlay muted playsInline onPlaying={() => setRemoteReady(true)} onEmptied={() => setRemoteReady(false)} hidden={!peer.remote} />{(!peer.remote || !peer.connected || !remoteReady) && <div className="camera-placeholder"><span aria-hidden="true">♡</span><strong>{t('session.waitingPerson')}</strong><p>{t('session.bothEnter')}</p></div>}<span className="camera-name">{t('room.yourPerson')}</span></div>}
        {shutter > 0 && <div key={shutter} className="shutter-flash" aria-hidden="true" />}
        <div id="shot-countdown" hidden={countdown === null} aria-live="assertive">{countdown}</div>
      </div>
      <div className="capture-near-preview" hidden={guest}><button className="primary" id="capture-session" hidden={guest} disabled={locked || !canCapture || (complete && retake === null)} onClick={start}>{retake !== null ? t('session.retakeN', { n: retake + 1 }) : method === 'manual' ? t('session.takeOne') : ready ? t('session.continueCountdown') : t('session.startCountdown')} <span aria-hidden="true">◎</span></button><button className="outline-button capture-stop" hidden={!busy} onClick={stopCapture}>{t('session.stopCountdown')}</button></div>
      <ScreenFlash active={flashLit} color={props.flashColor} view={view} />
      <p id="camera-message" className="session-note" role="status">{message && message !== waitingPermission ? '' : message || (duo ? peer.connected ? t('session.bothConnected') : t('session.phase', { phase: tm(peer.phase) }) : t('session.staysHere'))}</p>
      <WarningNotice>{message !== waitingPermission ? message : ''}</WarningNotice>
      {duo && peer.error && <WarningNotice title={t('session.connectionTitle')}><p>{tm(peer.error)}</p><button className="outline-button" disabled={locked || !stream} onClick={peer.reconnect}>{t('session.reconnect')}</button></WarningNotice>}
      {duo && peer.diagnostics && <details className="connection-details"><summary>{t('session.details')}</summary><p>{t('session.detailsHelp')}</p><pre>{peer.diagnostics}</pre><button className="text-button" onClick={async()=>{try{await navigator.clipboard.writeText(peer.diagnostics+"\n"+diagnosticReport());setStatus(t('session.detailsCopied'));}catch{setStatus(t('session.detailsManual'));}}}>{t('session.copyDetails')}</button></details>}
      {guest && <p className="session-note">{t('session.guestNote')}</p>}
      <details className="camera-settings"><summary>{t('session.settings')}</summary>{phoneCameras
        ? <fieldset className="camera-facing" disabled={locked}><legend>{t('session.camera')}</legend>{(['user','environment'] as const).map(side => <label key={side}><input type="radio" name="camera-facing" value={side} checked={facing === side} onChange={() => { setFacing(side); props.onMirrorChange(side === 'user'); stopCamera(); void toggleCamera({ facing: side }); }} /> {t(side === 'user' ? 'session.front' : 'session.back')}</label>)}</fieldset>
        : devices.length>1&&<label className="camera-device">{t('session.camera')} <select disabled={locked} value={stream?.getVideoTracks()[0]?.getSettings().deviceId||''} onChange={e=>{stopCamera();void toggleCamera({deviceId:e.target.value});}}>{devices.map((device,i)=><option key={device.deviceId} value={device.deviceId}>{device.label||t('session.cameraN', { n: i + 1 })}</option>)}</select></label>}<div className="capture-settings" hidden={guest}><fieldset disabled={locked}><legend>{t('session.how')}</legend>{(['timer', 'manual'] as const).map(value => <label key={value}><input type="radio" name="capture-method" value={value} checked={method === value} onChange={() => { props.onMethod(value); setStatus(''); }} /> {t(value === 'timer' ? 'session.withTimer' : 'session.manual')}</label>)}</fieldset><label className="timer-setting" hidden={method === 'manual'}>{t('session.countdown')}<select id="timer-seconds" value={seconds} disabled={locked} onChange={e => { props.onSeconds(Number(e.target.value)); setStatus(''); }}>{[3, 5, 7].map(value => <option key={value} value={value}>{t('session.seconds', { n: value })}</option>)}</select></label></div>
      <div className="flash-settings" hidden={guest}>
        <div className="flash-setting-heading"><div><strong>{t('session.flash')}</strong><p>{t('session.flashHelp')}</p></div><button type="button" className={`flash-toggle ${props.flash ? 'enabled' : ''}`} aria-pressed={props.flash} disabled={locked} onClick={() => props.onFlashChange(!props.flash)}>{t('session.flashState', { state: t(props.flash ? 'common.on' : 'common.off') })}</button></div>
        {props.flash && <fieldset className="flash-colors" disabled={locked}><legend>{t('session.flashColor')}</legend>{Object.entries(flashColors).map(([key, value]) => <label key={key}><input type="radio" name="flash-color" value={key} checked={props.flashColor === key} onChange={() => props.onFlashColor(key as FlashColor)} /><span className="flash-color-dot" style={{ background: value.color }} aria-hidden="true" />{t(`flashColor.${key}` as Key)}</label>)}</fieldset>}
        {props.flash && <p className="flash-note">{t('session.flashNote')}</p>}
      </div>
      <p className="session-note">{t('session.faceInside')}</p></details><p id="session-status" aria-live="polite">{guest ? t(remoteBusy ? 'session.guestTaking' : complete ? 'session.guestReady' : 'session.guestWaiting') : busy ? status : retake !== null ? defaultStatus : status || defaultStatus}</p>
<div className="session-buttons"><button className="text-button" disabled={locked} onClick={props.onBack}>{t(duo ? 'session.leave' : 'upload.changeLayout')}</button>{retake !== null && !guest && <button className="text-button" disabled={locked} onClick={() => { props.onRetake(null); share({ type: 'retake', index: null }); setStatus(''); }}>{t('session.cancelRetake')}</button>}<button className="secondary" hidden={guest} disabled={locked || !complete || retake !== null} onClick={review}>{t('session.toEditing')}</button></div>
      {card.template && <CameraCardPreview card={card} ready={canCapture && !locked} capture={previewShot} retake={retake} />}
      {duo&&syncCount>0&&<p className="session-note" role="status">{t(syncCount === 1 ? 'session.syncingOne' : 'session.syncing', { n: syncCount })}</p>}
      <WarningNotice title={t('session.syncTitle')}>{syncError&&<><p>{tm(syncError)}</p><button className="outline-button" disabled={!peer.connected} onClick={()=>{setSyncError('');void sync.current?.retry();}}>{t('session.retrySync')}</button>{!guest&&<button className="text-button" disabled={!peer.connected||busy} onClick={()=>{props.onRetake(sync.current?.pendingIndex()??null);setSyncError('');}}>{t('session.retakeUnsynced')}</button>}</>}</WarningNotice>
      <PhotoTray shots={visibleShots} count={layout.count} retake={retake} disabled={locked || syncCount>0 || guest || (duo && !peer.connected)} onMove={props.onMove} onRetake={index => { props.onRetake(index); share({ type: 'retake', index }); }} />
    </div>
  </>;
}
