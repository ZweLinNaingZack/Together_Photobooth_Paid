import { useState } from 'react';
import { Heading } from './shared';
export function JoinRoom({ invite, busy, error, onJoin, onBack }: { invite: string | null; busy: boolean; error: string; onJoin: (code: string) => void; onBack: () => void }) {
  const [code, setCode] = useState('');
  return <><Heading eyebrow="YOUR INVITATION TOGETHER" title={<>There’s a place <em>for you.</em></>} note={invite ? 'Your invitation is ready. Join your person’s booth below.' : 'Enter the six-character party code your person shared with you.'} />
    <form className="join-room" onSubmit={e => { e.preventDefault(); onJoin(code); }}>
      {!invite && <><label htmlFor="party-code">PARTY CODE</label><input id="party-code" value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} placeholder="ABC234" maxLength={6} autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={busy} required /></>}
      <p className="session-note">Your person’s layout and design come with the invitation.</p><p role="alert" className="room-error">{error}</p><button className="primary" disabled={busy || (!invite && code.length !== 6)}>{busy ? 'Joining your person…' : 'Join the booth'}</button><button type="button" className="text-button" disabled={busy} onClick={onBack}>Back to Duo</button>
    </form></>;
}
