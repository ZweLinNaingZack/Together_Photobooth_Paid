import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

export function BoothDialog({ open, title, children, cancelLabel, confirmLabel, onCancel, onConfirm, busy = false, error = '' }: {
  open: boolean; title: string; children: ReactNode; cancelLabel: string; confirmLabel: string;
  onCancel: () => void; onConfirm: () => void; busy?: boolean; error?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) { dialog.showModal(); cancel.current?.focus(); }
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} className="leave-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-body`} aria-busy={busy} onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <div className="leave-emblem" aria-hidden="true">♡</div>
    <h2 id={`${id}-title`}>{title}</h2>
    <div id={`${id}-body`} className="booth-dialog-copy">{children}</div>
    {error && <p role="alert" className="room-error">{error}</p>}
    <div className="leave-actions"><button ref={cancel} className="outline-button" disabled={busy} onClick={onCancel}>{cancelLabel}</button><button className="primary" disabled={busy} onClick={onConfirm}>{busy ? 'Confirming…' : confirmLabel}</button></div>
  </dialog>;
}
