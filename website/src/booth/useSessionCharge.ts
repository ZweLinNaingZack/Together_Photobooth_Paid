import { useRef, useState } from 'react';
import { supabase } from '../auth/client';

export function useSessionCharge() {
  const id = useRef(crypto.randomUUID());
  const pending = useRef<Promise<void> | null>(null);
  const settled = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [receipt, setReceipt] = useState('');
  function reset() {
    id.current = crypto.randomUUID(); pending.current = null; settled.current = false;
    setBusy(false); setError(''); setReceipt('');
  }
  function complete(roomCode: string | null = null): Promise<void> {
    if (settled.current) return Promise.resolve();
    if (pending.current) return pending.current;
    const requestId = id.current;
    setBusy(true); setError('');
    const task = (async () => {
      try {
        if (!supabase) throw new Error('Please sign in to complete your session.');
        const { data, error } = await supabase.rpc('together_complete_session', { request_id: requestId, room_code: roomCode });
        if (error) throw new Error(error.code === 'PGRST202' ? 'Session billing is not available yet. Please contact the administrator.' : error.code === 'P0001' || error.code === '42501' ? error.message : 'We could not confirm your session. Retry safely; you will not be charged twice.');
        if (!data) throw new Error('Could not confirm your session. Please retry.');
        if (id.current !== requestId) throw new Error('This session has ended.');
        settled.current = true;
        setReceipt(data.used_trial ? 'Your free session has been used. Retakes and downloads in this session are included.' : '100 points used. Retakes and downloads in this session are included.');
      } catch (e) {
        if (id.current === requestId) setError(e instanceof Error ? e.message : 'Could not confirm your session. Please retry.');
        throw e;
      } finally { if (id.current === requestId) { pending.current = null; setBusy(false); } }
    })();
    pending.current = task;
    return task;
  }
  return { complete, reset, busy, error, receipt };
}
