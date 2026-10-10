import { WarningNotice } from '../components/WarningNotice';
import { useEffect,useRef,useState } from 'react';
import {prepareCamera,expirePreparedCamera} from './cameraQuality.js';
import {unlockCameraSound} from './cameraSounds.js';
import { Heading } from './shared';
import { layouts } from './core';
import { cardDesigns } from './designs';
import type { RoomSession } from './rooms';
import { useT } from '../i18n';
import { Rich } from '../i18n/Rich';
import { layoutName } from '../i18n/layouts';
export function WaitingRoom({ room, busy, error, mirror, onMirrorChange, onReady, onContinue, onLeave }: { room: RoomSession; busy: boolean; error: string; mirror: boolean; onMirrorChange: (mirror: boolean) => void; onReady: (ready: boolean) => void; onContinue: () => void; onLeave: () => void }) {
  const [copy, setCopy] = useState('');
  const [cameraBusy,setCameraBusy]=useState(false),[cameraError,setCameraError]=useState('');
  const localPreview=useRef<HTMLVideoElement>(null);
  const alive=useRef(true);
  const t=useT();
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;expirePreparedCamera();};},[]);
  async function ready(){
    unlockCameraSound();
    if(room[room.role].ready){onReady(false);return;}
    setCameraBusy(true);setCameraError('');
    try{if(room.settings.source==='camera'){const stream=await prepareCamera();if(!alive.current)return;if(localPreview.current){localPreview.current.srcObject=stream;await localPreview.current.play();}}if(alive.current)onReady(true);}
    catch{setCameraError(t('room.cameraError'));}
    finally{setCameraBusy(false);}
  }
  const invitation = `${window.location.origin}${window.location.pathname}#booth?invite=${room.invite || ''}`;
  async function copyText(text: string, copied: string) { try { await navigator.clipboard.writeText(text); setCopy(copied); } catch { setCopy(t('room.copyManual')); } }
  return <><Heading eyebrow={t('room.eyebrow')} title={<Rich text={t('room.title')} />} note={`${layoutName(layouts[room.settings.layout])} · ${room.settings.template ? cardDesigns[room.settings.template].name : t('room.framesLater')} · ${t(room.settings.source === 'upload' ? 'room.uploadPhotos' : 'room.cameraPhotos')}`} />
    <div className="waiting-room">
      {room.settings.source==='camera'&&<div className="waiting-camera"><div className="waiting-camera-toolbar"><strong>{t('room.preview')}</strong><button type="button" className={`mirror-toggle ${mirror?'enabled':''}`} aria-pressed={mirror} onClick={()=>onMirrorChange(!mirror)}>{t('session.mirror', { state: t(mirror ? 'common.on' : 'common.off') })}</button></div><video ref={localPreview} aria-label={t('room.cameraLabel')} className={mirror?'mirrored':''} autoPlay muted playsInline/><p className="session-note">{t('room.readyHelp')}</p><WarningNotice>{cameraError}</WarningNotice></div>}
      {room.role === 'host' && <div className="room-invitation"><span className="eyebrow">{t('room.inviteEyebrow')}</span><label htmlFor="room-code">{t('room.code')}</label><div className="room-copy-row"><input id="room-code" readOnly value={room.code} onFocus={e => e.target.select()} /><button className="outline-button" onClick={() => copyText(room.code, t('room.codeCopied'))}>{t('room.copyCode')}</button></div><label htmlFor="room-link">{t('room.link')}</label><div className="room-copy-row"><input id="room-link" readOnly value={invitation} onFocus={e => e.target.select()} /><button className="outline-button" onClick={() => copyText(invitation, t('room.linkCopied'))}>{t('room.copyLink')}</button></div><p role="status" className="session-note">{copy || t('room.inviteNote')}</p></div>}
      <div className="room-people">{(['host', 'guest'] as const).map(role => <div className="room-person" key={role}><span className="room-heart" aria-hidden="true">♡</span><strong>{t(role === room.role ? 'room.you' : 'room.yourPerson')}</strong><span>{t(!room[role].online ? 'room.waiting' : room[role].ready ? 'room.ready' : 'room.gettingReady')}</span></div>)}</div>
      <p className="session-note" role="status">{t(room.bothReady ? 'room.bothReady' : 'room.notYet')}</p><WarningNotice>{error}</WarningNotice>
      <div className="room-actions"><button className="outline-button" disabled={busy || cameraBusy || !!error} aria-pressed={room[room.role].ready} onClick={()=>void ready()}>{cameraBusy ? t('room.openingCamera') : room[room.role].ready ? t('room.notReady') : t('room.imReady')}</button><button className="primary" disabled={!room.bothReady || busy || !!error} onClick={onContinue}>{room.settings.source === 'upload' ? t('layout.continue') : t('room.enter')}</button></div>
      <p className="room-stage-note">{t(room.settings.source === 'camera' ? 'room.stageCamera' : 'room.stageUpload')}</p><button className="text-button" onClick={onLeave}>{t(room.role === 'host' ? 'room.end' : 'room.leave')}</button>
    </div></>;
}
