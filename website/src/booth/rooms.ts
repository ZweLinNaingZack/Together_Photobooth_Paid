import type { LayoutId } from './types';
import { supabase } from '../auth/client';
export interface RoomSettings { layout: LayoutId; template: string | null; source: 'camera' | 'upload' }
export interface RoomState { code: string; settings: RoomSettings; expiresAt: number; host: { online: boolean; ready: boolean }; guest: { online: boolean; ready: boolean }; bothReady: boolean }
export interface RoomSession extends RoomState { token: string; role: 'host' | 'guest'; invite?: string }
export async function roomRequest<T>(action: string, body: object): Promise<T> {
  const session = await supabase?.auth.getSession();
  const jwt = session?.data.session?.access_token;
  if (!jwt) throw new Error('Please sign in before entering a booth.');
  const response = await fetch(`/api/rooms/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
  let data; try { data = await response.json(); } catch { throw new Error('The room service is unavailable. Please try again.'); }
  if (!response.ok) throw new Error(data.error || 'Could not connect to the booth.');
  return data;
}
export function leaveRoom(room: RoomSession) {
  void supabase?.auth.getSession().then(({ data }) => {
    if (!data.session) return;
    return fetch('/api/rooms/leave', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ code: room.code, token: room.token }), keepalive: true });
  }).catch(() => {});
}
