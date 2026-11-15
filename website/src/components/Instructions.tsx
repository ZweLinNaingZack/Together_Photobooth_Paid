import { useEffect, useRef } from 'react';
import { formatLongDate, useT } from '../i18n';
import { useFreeMode } from '../auth/freeMode';
import { Rich } from '../i18n/Rich';
import { Icon } from './Icon';

/** The "how it works" popup shown when the booth opens. */
export function Instructions({ open, onDismiss, onContinue }: { open: boolean; onDismiss: () => void; onContinue: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const t = useT();
  const { free, until } = useFreeMode();   // step 3 mentions points unless the booth is free
  useEffect(() => { const d = dialogRef.current; if (open && !d?.open) d?.showModal(); if (!open && d?.open) d.close(); }, [open]);
  return <dialog ref={dialogRef} onCancel={onDismiss} id="instructions" aria-labelledby="instructions-title">
    <button className="dialog-close" onClick={onDismiss} aria-label={t('intro.close')}><Icon name="x" size={20} /></button>
    <div className="eyebrow">{t('intro.eyebrow')}</div>
    <h2 id="instructions-title"><Rich text={t('intro.title')} /></h2>
    <p className="intro-copy">{t('intro.lead')}</p>
    <ol className="instruction-list">
      {([1, 2, 3] as const).map(n => <li key={n}><span>0{n}</span><div><strong>{t(`intro.step${n}.title`)}</strong><p>{free && n === 3 ? t('intro.step3.text.free', { date: until ? formatLongDate(until) : '' }) : t(`intro.step${n}.text`)}</p></div></li>)}
    </ol>
    <p className="dialog-note">{t('intro.note')}</p>
    <button className="primary" id="instructions-continue" onClick={onContinue}>{t('intro.start')}</button>
  </dialog>;
}
