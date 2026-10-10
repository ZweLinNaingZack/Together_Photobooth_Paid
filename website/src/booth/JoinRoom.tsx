import { WarningNotice } from '../components/WarningNotice';
import { useState } from 'react';
import { Heading } from './shared';
import { useT } from '../i18n';
import { Rich } from '../i18n/Rich';

export function JoinRoom({ invite, busy, error, onJoin, onBack }: { invite: string | null; busy: boolean; error: string; onJoin: (code: string) => void; onBack: () => void }) {
  const [code, setCode] = useState('');
  const t = useT();
  return <><Heading eyebrow={t('join.eyebrow')} title={<Rich text={t('join.title')} />} note={t(invite ? 'join.note.invite' : 'join.note.code')} />
    <form className="join-room" onSubmit={e => { e.preventDefault(); onJoin(code); }}>
      {!invite && <><label htmlFor="party-code">{t('join.codeLabel')}</label><input id="party-code" value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} placeholder="ABC234" maxLength={6} autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={busy} required /></>}
      <p className="session-note">{t('join.layoutNote')}</p><WarningNotice>{error}</WarningNotice><button className="primary" disabled={busy || (!invite && code.length !== 6)}>{busy ? t('join.joining') : t('join.join')}</button><button type="button" className="text-button" disabled={busy} onClick={onBack}>{t('join.back')}</button>
    </form></>;
}
