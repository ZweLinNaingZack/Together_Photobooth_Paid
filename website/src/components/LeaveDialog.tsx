import { useEffect, useRef } from 'react';
import { useT } from '../i18n';
import { Rich } from '../i18n/Rich';


export function LeaveDialog({ open, count, onCancel, onConfirm, duo = false }: { open: boolean; count: number; onCancel: () => void; onConfirm: () => void; duo?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const t = useT();
  useEffect(() => {
    const element = dialog.current;
    if (open && element && !element.open) { element.showModal(); keep.current?.focus(); }
    if (!open && element?.open) element.close();
  }, [open]);
  return <dialog ref={dialog} className="leave-dialog" role="alertdialog" aria-modal="true" aria-labelledby="leave-title" aria-describedby="leave-description" onCancel={event => { event.preventDefault(); onCancel(); }}>
    <button className="dialog-close" aria-label={t('leave.keep')} onClick={onCancel}>×</button>
    <div className="leave-emblem" aria-hidden="true">♡</div>
    <div className="eyebrow">{t('leave.eyebrow')}</div>
    <h2 id="leave-title"><Rich text={t(duo ? 'leave.duoTitle' : 'leave.title')} /></h2>
    <p id="leave-description">{duo ? t('leave.duoText') : t(count === 1 ? 'leave.textOne' : 'leave.text', { n: count })}</p>
    <div className="leave-actions"><button ref={keep} className="primary" onClick={onCancel}>{duo ? t('leave.stay') : t('leave.keep')}</button><button className="outline-button" onClick={onConfirm}>{duo ? t('leave.duoConfirm') : t('leave.confirm')}</button></div>
    <p className="leave-footnote">{t('leave.footnote')}</p>
  </dialog>;
}
