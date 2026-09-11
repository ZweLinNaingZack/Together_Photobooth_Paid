import type { LayoutId } from './types';
export interface RoomSettings { layout: LayoutId; template: string | null; source: 'camera' | 'upload' }
export interface RoomState { code: string; settings: RoomSettings; expiresAt: number; host: { online: boolean; ready: boolean }; guest: { online: boolean; ready: boolean }; bothReady: boolean }
export interface RoomSession extends RoomState { token: string; role: 'host' | 'guest'; invite?: string }
export async function roomRequest<T>(action: string, body: object): Promise<T> {
  const response = await fetch(`/api/rooms/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
  let data; try { data = await response.json(); } catch { throw new Error('The room service is unavailable. Please try again.'); }
  if (!response.ok) throw new Error(data.error || 'Could not connect to the booth.');
  return data;
}
export function leaveRoom(room: RoomSession) {
  void fetch('/api/rooms/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: room.code, token: room.token }), keepalive: true }).catch(() => {});
}
