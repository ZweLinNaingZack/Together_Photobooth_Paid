import { useEffect, useState } from 'react';
import { supabase } from './client';
import { readActiveSession, readDraft } from '../booth/recoveryStore.js';

type Found = { kind: 'editing' } | { kind: 'booth'; heldUntil?: string };

/**
 * Account page card that leads back to an unfinished booth. It checks this device's saved
 * copies first, then the server (migration 019) for a booth started elsewhere or not saved here.
 * Opening #booth runs the booth's own recovery, which reconnects or shows the booth popup.
 */
export function BoothInProgress({ userId }: { userId: string }) {
  const [found, setFound] = useState<Found | null>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      const [draft, record] = await Promise.all([readDraft(userId).catch(() => null), readActiveSession(userId).catch(() => null)]);
      if (!active) return;
      if (draft?.editingApproved) { setFound({ kind: 'editing' }); return; }
      if (record) { setFound({ kind: 'booth' }); return; }
      const { data } = await supabase?.rpc('together_active_session') ?? { data: null };
      if (active && data?.session_id) setFound({ kind: 'booth', heldUntil: data.expires_at ? new Date(data.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined });
    })().catch(() => {});
    return () => { active = false; };
  }, [userId]);
  if (!found) return null;
  return <section className="dashboard-card booth-progress-card" aria-labelledby="booth-progress-title">
    <div>
      <h2 id="booth-progress-title">{found.kind === 'editing' ? 'Your photo card is waiting' : 'Your booth is still open'}</h2>
      <p>{found.kind === 'editing'
        ? 'It is saved on this device and already paid for. Go back to finish editing and download it.'
        : `Go back to pick up where you left off${found.heldUntil ? `. It is held for you until ${found.heldUntil}` : ''}. Nothing has been charged yet.`}</p>
    </div>
    <a className="primary" href="#booth">{found.kind === 'editing' ? 'Finish my photo card' : 'Go back to my booth'}</a>
  </section>;
}
