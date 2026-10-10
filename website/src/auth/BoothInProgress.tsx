import { useEffect, useState } from 'react';
import { supabase } from './client';
import { readActiveSession, readDraft } from '../booth/recoveryStore.js';
import { formatTime, useT } from '../i18n';

type Found = { kind: 'editing' } | { kind: 'booth'; heldUntil?: string };

/**
 * Account page card that leads back to an unfinished booth. It checks this device's saved
 * copies first, then the server (migration 019) for a booth started elsewhere or not saved here.
 * Opening #booth runs the booth's own recovery, which reconnects or shows the booth popup.
 */
export function BoothInProgress({ userId }: { userId: string }) {
  const [found, setFound] = useState<Found | null>(null);
  const t = useT();
  useEffect(() => {
    let active = true;
    void (async () => {
      const [draft, record] = await Promise.all([readDraft(userId).catch(() => null), readActiveSession(userId).catch(() => null)]);
      if (!active) return;
      if (draft?.editingApproved) { setFound({ kind: 'editing' }); return; }
      if (record) { setFound({ kind: 'booth' }); return; }
      const { data } = await supabase?.rpc('together_active_session') ?? { data: null };
      if (active && data?.session_id) setFound({ kind: 'booth', heldUntil: data.expires_at ? formatTime(data.expires_at) : undefined });
    })().catch(() => {});
    return () => { active = false; };
  }, [userId]);
  if (!found) return null;
  return <section className="dashboard-card booth-progress-card" aria-labelledby="booth-progress-title">
    <div>
      <h2 id="booth-progress-title">{t(found.kind === 'editing' ? 'progress.editing.title' : 'progress.booth.title')}</h2>
      <p>{found.kind === 'editing' ? t('progress.editing.text')
        : found.heldUntil ? t('progress.booth.textHeld', { time: found.heldUntil }) : t('progress.booth.text')}</p>
    </div>
    <a className="primary" href="#booth">{t(found.kind === 'editing' ? 'progress.editing.button' : 'progress.booth.button')}</a>
  </section>;
}
