import { useEffect, useRef } from 'react';

export function LeaveDialog({ open, count, onCancel, onConfirm, duo = false }: { open: boolean; count: number; onCancel: () => void; onConfirm: () => void; duo?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (open && element && !element.open) { element.showModal(); keep.current?.focus(); }
    if (!open && element?.open) element.close();
  }, [open]);
  return <dialog ref={dialog} className="leave-dialog" role="alertdialog" aria-modal="true" aria-labelledby="leave-title" aria-describedby="leave-description" onCancel={event => { event.preventDefault(); onCancel(); }}>
    <button className="dialog-close" aria-label="Keep my photos" onClick={onCancel}>×</button>
    <div className="leave-emblem" aria-hidden="true">♡</div>
    <div className="eyebrow">BEFORE YOU GO</div>
    <h2 id="leave-title">{duo ? 'Leave Photobooth?' : <>Leave these<br /><em>moments behind?</em></>}</h2>
    <p id="leave-description">{duo ? 'Are you sure you want to leave? Your current progress will be lost.' : <>You have {count} {count === 1 ? 'photo' : 'photos'} in this booth. Leaving will clear them, and you’ll need to take or upload them again.</>}</p>
    <div className="leave-actions"><button ref={keep} className="primary" onClick={onCancel}>{duo ? 'Cancel / Stay' : 'Keep my photos'}</button><button className="outline-button" onClick={onConfirm}>{duo ? 'Confirm & Leave' : 'Leave and delete'}</button></div>
    <p className="leave-footnote">Photos already saved to your device stay yours.</p>
  </dialog>;
}
