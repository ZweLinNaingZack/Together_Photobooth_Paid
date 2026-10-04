import { WarningNotice } from '../components/WarningNotice';
import { useState } from 'react';
import { Heading } from './shared';
import { layouts } from './core';
import { cardDesigns } from './designs';
import type { RoomSession } from './rooms';
export function WaitingRoom({ room, busy, error, onReady, onContinue, onLeave }: { room: RoomSession; busy: boolean; error: string; onReady: (ready: boolean) => void; onContinue: () => void; onLeave: () => void }) {
  const [copy, setCopy] = useState('');
  const invitation = `${window.location.origin}${window.location.pathname}#booth?invite=${room.invite || ''}`;
  async function copyText(text: string, label: string) { try { await navigator.clipboard.writeText(text); setCopy(`${label} copied.`); } catch { setCopy('Select and copy the text below to share it.'); } }
  return <><Heading eyebrow="YOUR LITTLE MEETING PLACE" title={<>A moment worth <em>waiting for.</em></>} note={`${layouts[room.settings.layout].name} · ${room.settings.template ? cardDesigns[room.settings.template].name : 'Frames chosen after photos'} · ${room.settings.source === 'upload' ? 'Upload photos' : 'Camera photos'}`} />
    <div className="waiting-room">
      {room.role === 'host' && <div className="room-invitation"><span className="eyebrow">SEND A LITTLE INVITATION</span><label htmlFor="room-code">Party code</label><div className="room-copy-row"><input id="room-code" readOnly value={room.code} onFocus={e => e.target.select()} /><button className="outline-button" onClick={() => copyText(room.code, 'Code')}>Copy code</button></div><label htmlFor="room-link">Invitation link</label><div className="room-copy-row"><input id="room-link" readOnly value={invitation} onFocus={e => e.target.select()} /><button className="outline-button" onClick={() => copyText(invitation, 'Link')}>Copy link</button></div><p role="status" className="session-note">{copy || 'This invitation is for one person. The room expires after 45 minutes.'}</p></div>}
      <div className="room-people">{(['host', 'guest'] as const).map(role => <div className="room-person" key={role}><span className="room-heart" aria-hidden="true">♡</span><strong>{role === room.role ? 'You' : 'Your person'}</strong><span>{!room[role].online ? 'Waiting to join' : room[role].ready ? 'Ready for our moment' : 'Here · getting ready'}</span></div>)}</div>
      <p className="session-note" role="status">{room.bothReady ? 'You’re both ready. You can enter the photo session.' : 'Once you’re both here and ready, the photo session will unlock.'}</p><WarningNotice>{error}</WarningNotice>
      <div className="room-actions"><button className="outline-button" disabled={busy || !!error} aria-pressed={room[room.role].ready} onClick={() => onReady(!room[room.role].ready)}>{room[room.role].ready ? 'Not ready yet' : 'I’m ready'}</button><button className="primary" disabled={!room.bothReady || busy || !!error} onClick={onContinue}>{room.settings.source === 'upload' ? 'Continue to photos' : 'Enter photo session'}</button></div>
      <p className="room-stage-note">{room.settings.source === 'camera' ? 'Enter the photo session on both devices and allow camera access. You’ll see each other side by side. The creator controls the shutter; both of you receive the shared photos.' : 'Each person uploads photos in their own browser.'}</p><button className="text-button" onClick={onLeave}>{room.role === 'host' ? 'End this booth' : 'Leave this booth'}</button>
    </div></>;
}
