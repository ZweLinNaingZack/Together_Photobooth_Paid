import { useEffect, useRef } from 'react';
import { useT } from '../i18n';
import { Rich } from '../i18n/Rich';

/** The "how it works" popup shown when the booth opens. */
export function Instructions({ open, onDismiss, onContinue }: { open: boolean; onDismiss: () => void; onContinue: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const t = useT();
  useEffect(() => { const d = dialogRef.current; if (open && !d?.open) d?.showModal(); if (!open && d?.open) d.close(); }, [open]);
  return <dialog ref={dialogRef} onCancel={onDismiss} id="instructions" aria-labelledby="instructions-title">
    <button className="dialog-close" onClick={onDismiss} aria-label={t('intro.close')}>×</button>
    <div className="eyebrow">{t('intro.eyebrow')}</div>
    <h2 id="instructions-title"><Rich text={t('intro.title')} /></h2>
    <p className="intro-copy">{t('intro.lead')}</p>
    <ol className="instruction-list">
      {([1, 2, 3] as const).map(n => <li key={n}><span>0{n}</span><div><strong>{t(`intro.step${n}.title`)}</strong><p>{t(`intro.step${n}.text`)}</p></div></li>)}
    </ol>
    <p className="dialog-note">{t('intro.note')}</p>
    <button className="primary" id="instructions-continue" onClick={onContinue}>{t('intro.start')}</button>
  </dialog>;
}
