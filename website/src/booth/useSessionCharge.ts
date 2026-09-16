import { useEffect, useRef, useState } from 'react';
import { supabase } from '../auth/client';

export function useSessionCharge() {
  const id = useRef<string>(crypto.randomUUID());
  const pending = useRef<Promise<void> | null>(null);
  const reservePending = useRef<Promise<void> | null>(null), generation = useRef(0);
  const settled = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [receipt, setReceipt] = useState('');
  function reset() {
    void supabase?.rpc('together_session_action', { request_id: id.current, operation: 'release' }).then(() => {}, () => {});
    generation.current++; reservePending.current = null;
    id.current = crypto.randomUUID(); pending.current = null; settled.current = false;
    setBusy(false); setError(''); setReceipt('');
  }
  useEffect(() => () => { generation.current++; void supabase?.rpc('together_session_action', { request_id: id.current, operation: 'release' }).then(() => {}, () => {}); }, []);
  function reserve(roomCode: string | null = null): Promise<void> {
    if (settled.current) return Promise.resolve();
    if (reservePending.current) return reservePending.current;
    const version = generation.current;
    setBusy(true); setError('');
    const task = (async () => {
      try {
        if (!supabase) throw new Error('Please sign in first.');
        const { data, error } = await supabase.rpc('together_session_action', { request_id: id.current, operation: 'reserve', room_code: roomCode });
        if (error || !data) throw new Error(error?.code === 'P0001' || error?.code === '42501' ? error.message : 'Session authorization is unavailable. Please check the database setup and retry.');
        if (version !== generation.current) {
          if (!data.completed) void supabase.rpc('together_session_action', { request_id: data.session_id, operation: 'release' }).then(() => {}, () => {});
          throw new Error('This session has ended.');
        }
        id.current = data.session_id; settled.current = data.completed;
      } catch (e) { if (version === generation.current) setError(e instanceof Error ? e.message : 'Please retry authorization.'); throw e; }
      finally { if (version === generation.current) { reservePending.current = null; if (!pending.current) setBusy(false); } }
    })();
    reservePending.current = task; return task;
  }
  function complete(roomCode: string | null = null): Promise<void> {
    if (settled.current) return Promise.resolve();
    if (pending.current) return pending.current;
    const version = generation.current;
    setBusy(true); setError('');
    const task = (async () => {
      try {
        if (!supabase) throw new Error('Please sign in to complete your session.');
        await reserve(roomCode);
        if (version !== generation.current) throw new Error('This session has ended.');
        const { data, error } = await supabase.rpc('together_complete_session', { request_id: id.current, room_code: roomCode });
        if (error) throw new Error(error.code === 'PGRST202' ? 'Session billing is not available yet. Please contact the administrator.' : error.code === 'P0001' || error.code === '42501' ? error.message : 'We could not confirm your session. Retry safely; you will not be charged twice.');
        if (!data) throw new Error('Could not confirm your session. Please retry.');
        if (version !== generation.current) throw new Error('This session has ended.');
        settled.current = true;
        setReceipt(data.used_trial ? 'Your free session has been used. Retakes and downloads in this session are included.' : '100 points used. Retakes and downloads in this session are included.');
      } catch (e) {
        if (version === generation.current) setError(e instanceof Error ? e.message : 'Could not confirm your session. Please retry.');
        throw e;
      } finally { if (version === generation.current) { pending.current = null; setBusy(false); } }
    })();
    pending.current = task;
    return task;
  }
  return { complete, reserve, reset, busy, error, receipt };
}
