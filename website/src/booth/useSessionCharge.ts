import { useEffect, useRef, useState } from 'react';
import { reserveSession } from './reserveSession.mjs';
import { supabase } from '../auth/client';

export function useSessionCharge() {
  const id = useRef<string>(crypto.randomUUID());
  const pending = useRef<Promise<void> | null>(null);
  const reservePending = useRef<Promise<void> | null>(null), generation = useRef(0);
  const settled = useRef(false);
  const costRef = useRef<number | null>(null);
  const [cost, setCost] = useState<number | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [receipt, setReceipt] = useState('');
  function reset() {
    void supabase?.rpc('together_session_action', { request_id: id.current, operation: 'release' }).then(() => {}, () => {});
    generation.current++; reservePending.current = null;
    id.current = crypto.randomUUID(); pending.current = null; settled.current = false;
    setBusy(false); setError(''); setReceipt('');
    costRef.current = null; setCost(null);
  }
  async function resume(sessionId:string){
    const {data,error}=await supabase!.rpc('together_resume_session',{request_id:sessionId});
    if(error||!data?.completed)throw new Error('We could not verify this paid session. Your saved photos have been kept. Please try again.');
    id.current=data.session_id;settled.current=true;setReceipt('Resumed session. Editing and downloads are already covered.');setCost(data.used_trial?0:100);
  }
  /**
   * Re-attach this tab to a reservation made before a refresh/tab close.
   * Reserving with the SAME id is idempotent on the server: it returns the
   * existing hold, re-holds it if it expired (no charge), or reports it as
   * already paid. It never creates a second booth or a second charge.
   * For a duo host the room must still exist and belong to this user.
   */
  async function adopt(sessionId: string, roomCode: string | null = null) {
    generation.current++; reservePending.current = null; pending.current = null;
    id.current = sessionId; settled.current = false;
    setReceipt('');
    await reserve(roomCode);   // duo hosts pass their room code; the server checks it matches this reservation
    if (settled.current) setReceipt('Resumed session. Editing and downloads are already covered.');
  }
  /**
   * Drop the local id WITHOUT releasing the server reservation. Used when the
   * page is being left (refresh, tab close) so the booth can be resumed later.
   */
  function forget() {
    generation.current++; reservePending.current = null; pending.current = null;
    id.current = crypto.randomUUID(); settled.current = false;
    setBusy(false); setError(''); setReceipt('');
    costRef.current = null; setCost(null);
  }
  /** Ask the server for this user's unfinished reservation (migration 019). */
  async function findActive(): Promise<ActiveReservation | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('together_active_session');
    // A missing function (019 not run yet) or a network error just means "nothing to offer".
    if (error || !data || typeof data.session_id !== 'string') return null;
    return { sessionId: data.session_id, usedTrial: !!data.used_trial, duo: !!data.duo, expiresAt: data.expires_at, createdAt: data.created_at };
  }
  /** Close a specific unconfirmed reservation. Paid sessions are never affected by 'release'. */
  async function release(sessionId: string) {
    if (!supabase) throw new Error('Please sign in first.');
    const { error } = await supabase.rpc('together_session_action', { request_id: sessionId, operation: 'release' });
    if (error) throw new Error('We could not close that session. Please check your connection and try again.');
  }
  /** Hide an error once the UI shows a better, specific message for it. */
  function clearError() { setError(''); }
  useEffect(() => () => { generation.current++; void supabase?.rpc('together_session_action', { request_id: id.current, operation: 'release' }).then(() => {}, () => {}); }, []);
  function reserve(roomCode: string | null = null): Promise<void> {
    if (settled.current) return Promise.resolve();
    if (reservePending.current) return reservePending.current;
    const version = generation.current;
    setBusy(true); setError('');
    const task = (async () => {
      try {
        if (!supabase) throw new Error('Please sign in first.');
        const args = { request_id: id.current, operation: 'reserve', room_code: roomCode };
        const { data, error } = await reserveSession(() => supabase!.rpc('together_session_action', args), () => version === generation.current);
        if (error || !data) throw new Error(error?.code === 'P0001' || error?.code === '42501' ? error.message : 'We could not connect to confirm your session. Your photos are still here. Please try again.');
        if (version !== generation.current) {
          if (!data.completed) void supabase.rpc('together_session_action', { request_id: data.session_id, operation: 'release' }).then(() => {}, () => {});
          throw new Error('This session has ended.');
        }
        id.current = data.session_id; settled.current = data.completed;
        costRef.current = data.used_trial ? 0 : 100; setCost(costRef.current);
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
        const confirmedCost = costRef.current;
        await reserve(roomCode);
        if (!settled.current && confirmedCost !== costRef.current) throw new Error('Your session price changed. Please review the updated amount and confirm again.');
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
  return { complete, reserve, reset, resume, adopt, forget, findActive, release, clearError, sessionId:id.current, busy, error, receipt, cost };
}

/** An unfinished booth reservation as reported by the server. */
export interface ActiveReservation { sessionId: string; usedTrial: boolean; duo: boolean; expiresAt?: string; createdAt?: string }
