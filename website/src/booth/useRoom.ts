import { useEffect, useRef, useState } from 'react';
import { leaveRoom, roomRequest } from './rooms';
import type { RoomSession, RoomSettings, RoomState } from './rooms';

export function useRoom() {
  const [room, setRoom] = useState<RoomSession | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const current = useRef<RoomSession | null>(null), generation = useRef(0), lock = useRef(false), revision = useRef(0);
  function save(value: RoomSession | null) { current.current = value; setRoom(value); }
  function end() { generation.current++; revision.current++; lock.current = false; if (current.current) leaveRoom(current.current); save(null); setBusy(false); setError(''); }
  useEffect(() => {
    const hide = () => end();
    window.addEventListener('pagehide', hide);
    return () => { generation.current++; if (current.current) leaveRoom(current.current); current.current = null; window.removeEventListener('pagehide', hide); };
  }, []);
  async function enter(action: 'create' | 'join', body: object) {
    if (lock.current) return null;
    lock.current = true; setBusy(true); setError(''); const id = ++generation.current;
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
        } catch (e) { if (!stopped && version === revision.current && current.current?.token === session.token) { save({ ...current.current, bothReady: false }); setError(e instanceof Error ? e.message : 'Connection interrupted. Reconnecting…'); } }
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
    } catch (e) { if (id === generation.current) { save({ ...session, bothReady: false }); setError(e instanceof Error ? e.message : 'Could not update readiness.'); } return null; }
    finally { if (id === generation.current) { lock.current = false; setBusy(false); } }
  }
  return { room, busy, error, end, create: (settings: RoomSettings) => enter('create', { settings }), join: (code: string, invite: string | null) => enter('join', invite ? { invite } : { code }), ready: (value: boolean) => update(value), check: () => update() };
}
