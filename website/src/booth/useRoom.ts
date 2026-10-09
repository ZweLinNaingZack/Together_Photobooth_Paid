import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { leaveRoom, roomRequest, RoomRequestError } from './rooms';
import type { RoomSession, RoomSettings, RoomState } from './rooms';

/** Room credentials saved on this device so a refreshed page can reconnect to the same booth. */
export interface SavedRoom { code: string; token: string; role: 'host' | 'guest'; invite?: string }

// keepOnHide: when true at page departure (the session is saved for recovery), the room is
// NOT left. A host leaving deletes the room, which made refresh-and-resume impossible.
export function useRoom(keepOnHide?: RefObject<boolean>) {
  const [room, setRoom] = useState<RoomSession | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [ended, setEnded] = useState(false);
  const current = useRef<RoomSession | null>(null), generation = useRef(0), lock = useRef(false), revision = useRef(0);
  function save(value: RoomSession | null) { current.current = value; setRoom(value); }
  function end() { generation.current++; revision.current++; lock.current = false; if (current.current) leaveRoom(current.current); save(null); setBusy(false); setError(''); setEnded(false); }
  /** Forget the room in this tab only. The server keeps our seat until the room's own expiry rules apply. */
  function suspend() { generation.current++; revision.current++; lock.current = false; save(null); setBusy(false); setError(''); setEnded(false); }
  /**
   * Reconnect to a saved room with our own token. Uses 'state', not 'join', so the
   * partner's readiness and our seat are kept. Throws RoomRequestError (404/403) if the room is gone.
   */
  async function resume(saved: SavedRoom): Promise<RoomSession> {
    const id = ++generation.current; revision.current++; lock.current = true; setBusy(true); setError(''); setEnded(false);
    try {
      const next = await roomRequest<RoomState>('state', { code: saved.code, token: saved.token });
      if (id !== generation.current) throw new Error('This booth has ended.');
      const session: RoomSession = { ...next, token: saved.token, role: saved.role, ...(saved.invite && saved.role === 'host' ? { invite: saved.invite } : {}) };
      save(session); return session;
    } finally { if (id === generation.current) { lock.current = false; setBusy(false); } }
  }
  /**
   * Ask the server for this account's own open room seat (hosted rooms only). Used when this
   * device lost its saved copy. Returns null when there is none or the service cannot tell.
   */
  async function findMine(): Promise<SavedRoom | null> {
    try {
      const { room } = await roomRequest<{ room: SavedRoom | null }>('mine', {});
      return room && typeof room.code === 'string' && typeof room.token === 'string' && (room.role === 'host' || room.role === 'guest') ? room : null;
    } catch { return null; }
  }
  useEffect(() => {
    const hide = () => { if (keepOnHide?.current) suspend(); else end(); };
    window.addEventListener('pagehide', hide);
    return () => { generation.current++; if (current.current) leaveRoom(current.current); current.current = null; window.removeEventListener('pagehide', hide); };
  }, []);
  async function enter(action: 'create' | 'join', body: object) {
    if (lock.current) return null;
    lock.current = true; setBusy(true); setError(''); setEnded(false); const id = ++generation.current;
    try {
      const result = await roomRequest<RoomSession>(action, body);
      if (id !== generation.current) { leaveRoom(result); return null; }
      save(result); return result;
    } catch (e) { if (id === generation.current) setError(e instanceof Error ? e.message : 'Could not connect to the booth.'); return null; }
    finally { if (id === generation.current) { lock.current = false; setBusy(false); } }
  }
  useEffect(() => {
    if (!room) return;
    let stopped = false, timer: ReturnType<typeof setTimeout>;
    const session = room;
    async function poll() {
      const version = revision.current;
      if (!lock.current) {
        try {
          const next = await roomRequest<RoomState>('state', { code: session.code, token: session.token });
          if (!stopped && current.current?.token === session.token && version === revision.current) { save({ ...session, ...next }); setError(''); }
        } catch (e) { if (!stopped && version === revision.current && current.current?.token === session.token) {
          if (e instanceof RoomRequestError && [401,403,404].includes(e.status)) save({ ...current.current, bothReady: false });
          if (e instanceof RoomRequestError && e.status === 404) setEnded(true);
          setError(e instanceof Error ? e.message : 'Connection interrupted. Reconnecting…');
        } }
      }
      if (!stopped) timer = setTimeout(poll, 1500);
    }
    void poll(); return () => { stopped = true; clearTimeout(timer); };
  }, [room?.token]);
  async function update(ready?: boolean) {
    const session = current.current;
    if (!session || lock.current) return null;
    const id = generation.current; revision.current++; lock.current = true; setBusy(true);
    try {
      const next = await roomRequest<RoomState>(ready === undefined ? 'state' : 'ready', { code: session.code, token: session.token, ...(ready === undefined ? {} : { ready }) });
      if (id !== generation.current) return null;
      save({ ...session, ...next }); setError(''); return next;
    } catch (e) { if (id === generation.current) { setError(e instanceof Error ? e.message : 'Could not update readiness.'); } return null; }
    finally { if (id === generation.current) { lock.current = false; setBusy(false); } }
  }
  return { room, busy, error, ended, end, resume, findMine, create: (settings: RoomSettings) => enter('create', { settings }), join: (code: string, invite: string | null) => enter('join', invite ? { invite } : { code }), ready: (value: boolean) => update(value), check: () => update() };
}
