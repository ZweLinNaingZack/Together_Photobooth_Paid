import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';

interface Props { actionLabel?: string; shots: string[]; count: number; retake: number | null; disabled?: boolean; onMove: (from: number, to: number) => void; onRetake: (index: number) => void }
export function PhotoTray({ shots, count, retake, disabled = false, onMove, onRetake, actionLabel = 'Retake' }: Props) {
  const [status, setStatus] = useState('');
  const [dragging, setDragging] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const pointer = useRef<{ id: number; from: number } | null>(null);
  const tray = useRef<HTMLDivElement>(null);
  function reorder(from: number, to: number) {
    if (disabled || from === to || !shots[from] || !shots[to]) return;
    onMove(from, to);
    setStatus(`Photo ${from + 1} moved to position ${to + 1}.`);
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
  return <div className="photo-review" ref={tray}><div className="review-heading"><strong>Your photos</strong><span>{shots.filter(Boolean).length} / {count}</span></div><p>Drag photos to reorder, or use Earlier and Later. {actionLabel} only the one you want to change.</p><div className="review-photos">
    {Array.from({ length: count }, (_, i) => <article key={i} className={`review-photo ${retake === i ? 'selected-retake' : ''} ${dragging === i ? 'dragging' : ''} ${target === i ? 'drop-target' : ''}`} data-shot={i} draggable={!!shots[i] && !disabled}
      onDragStart={e => { setDragging(i); e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move'; }}
      onDragOver={e => { if (dragging !== null && shots[i]) { e.preventDefault(); setTarget(i); } }}
      onDrop={e => { e.preventDefault(); if (dragging !== null) reorder(dragging, i); setDragging(null); setTarget(null); }} onDragEnd={() => { setDragging(null); setTarget(null); }}>
      <div className="review-image">{shots[i] ? <img src={shots[i]} alt={`Photo ${i + 1}`} draggable={false} /> : <span>{i + 1}</span>}<b>{i + 1}</b></div>
      {shots[i] ? <><div className="reorder-controls"><button disabled={disabled || i === 0} aria-label={`Move photo ${i + 1} earlier`} onClick={() => reorder(i, i - 1)}>Earlier</button>
        <button className="drag-handle" disabled={disabled} aria-label={`Drag photo ${i + 1} to reorder`}
          onPointerDown={e => { if (e.pointerType === 'mouse' || disabled) return; pointer.current = { id: e.pointerId, from: i }; e.currentTarget.setPointerCapture(e.pointerId); setDragging(i); }}
          onPointerMove={e => { if (pointer.current) { e.preventDefault(); setTarget(targetAt(e)); } }} onPointerUp={finish} onPointerCancel={finish}>⠿</button>
        <button disabled={disabled || i === count - 1 || !shots[i + 1]} aria-label={`Move photo ${i + 1} later`} onClick={() => reorder(i, i + 1)}>Later</button></div><button className="retake-button" disabled={disabled} onClick={() => onRetake(i)}>{actionLabel} photo {i + 1}</button></> : <span className="empty-photo-label">Waiting for a moment</span>}
    </article>)}
  </div><p id="order-status" className="session-note" role="status">{status}</p></div>;
}
