import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { useT } from '../i18n';

interface Props { actionLabel?: string; shots: string[]; count: number; retake: number | null; disabled?: boolean; onMove: (from: number, to: number) => void; onRetake: (index: number) => void }
export function PhotoTray({ shots, count, retake, disabled = false, onMove, onRetake, actionLabel }: Props) {
  const t = useT();
  const action = actionLabel ?? t('tray.retake');
  const [status, setStatus] = useState('');
  const [dragging, setDragging] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const pointer = useRef<{ id: number; from: number } | null>(null);
  const tray = useRef<HTMLDivElement>(null);
  function reorder(from: number, to: number) {
    if (disabled || from === to || !shots[from] || !shots[to]) return;
    onMove(from, to);
    setStatus(t('tray.moved', { from: from + 1, to: to + 1 }));
    requestAnimationFrame(() => tray.current?.querySelector<HTMLButtonElement>(`[data-shot="${to}"] .drag-handle`)?.focus({ preventScroll: true }));
  }
  function targetAt(e: PointerEvent) {
    const element = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-shot]');
    return element && tray.current?.contains(element) ? Number(element.dataset.shot) : null;
  }
  function finish(e: PointerEvent) {
    if (!pointer.current) return;
    const from = pointer.current.from, to = targetAt(e);
    pointer.current = null; setDragging(null); setTarget(null);
    if (e.type === 'pointerup' && to !== null) reorder(from, to);
  }
  return <div className="photo-review" ref={tray}><div className="review-heading"><strong>{t('tray.title')}</strong><span>{shots.filter(Boolean).length} / {count}</span></div><p>{t('tray.help', { action })}</p><div className="review-photos">
    {Array.from({ length: count }, (_, i) => <article key={i} className={`review-photo ${retake === i ? 'selected-retake' : ''} ${dragging === i ? 'dragging' : ''} ${target === i ? 'drop-target' : ''}`} data-shot={i} draggable={!!shots[i] && !disabled}
      onDragStart={e => { setDragging(i); e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move'; }}
      onDragOver={e => { if (dragging !== null && shots[i]) { e.preventDefault(); setTarget(i); } }}
      onDrop={e => { e.preventDefault(); if (dragging !== null) reorder(dragging, i); setDragging(null); setTarget(null); }} onDragEnd={() => { setDragging(null); setTarget(null); }}>
      <div className="review-image">{shots[i] ? <img src={shots[i]} alt={t('tray.photo', { n: i + 1 })} draggable={false} /> : <span>{i + 1}</span>}<b>{i + 1}</b></div>
      {shots[i] ? <><div className="reorder-controls"><button disabled={disabled || i === 0} aria-label={t('tray.earlierLabel', { n: i + 1 })} onClick={() => reorder(i, i - 1)}>{t('tray.earlier')}</button>
        <button className="drag-handle" disabled={disabled} aria-label={t('tray.dragLabel', { n: i + 1 })}
          onPointerDown={e => { if (e.pointerType === 'mouse' || disabled) return; pointer.current = { id: e.pointerId, from: i }; e.currentTarget.setPointerCapture(e.pointerId); setDragging(i); }}
          onPointerMove={e => { if (pointer.current) { e.preventDefault(); setTarget(targetAt(e)); } }} onPointerUp={finish} onPointerCancel={finish}>⠿</button>
        <button disabled={disabled || i === count - 1 || !shots[i + 1]} aria-label={t('tray.laterLabel', { n: i + 1 })} onClick={() => reorder(i, i + 1)}>{t('tray.later')}</button></div><button className="retake-button" disabled={disabled} onClick={() => onRetake(i)}>{t('tray.actionPhoto', { action, n: i + 1 })}</button></> : <span className="empty-photo-label">{t('tray.empty')}</span>}
    </article>)}
  </div><p id="order-status" className="session-note" role="status">{status}</p></div>;
}
