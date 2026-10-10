import { useEffect, useRef } from 'react';
import { useT } from '../i18n';
import { Rich } from '../i18n/Rich';


export function SignInDialog({ onDismiss, onSignIn }: { onDismiss: () => void; onSignIn: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const t = useT();
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  return <dialog ref={dialog} className="leave-dialog" aria-labelledby="signin-required-title" aria-describedby="signin-required-description" onCancel={event => { event.preventDefault(); onDismiss(); }}>
    <button className="dialog-close" aria-label={t('signinDialog.back')} onClick={onDismiss}>×</button>
    <div className="eyebrow">{t('signinDialog.eyebrow')}</div>
    <h2 id="signin-required-title"><Rich text={t('signinDialog.title')} /></h2>
    <p id="signin-required-description">{t('signinDialog.text')}</p>
    <div className="leave-actions"><a className="primary" href="#account" onClick={onSignIn}>{t('signinDialog.signIn')}</a><button className="outline-button" onClick={onDismiss}>{t('signinDialog.back')}</button></div>
  </dialog>;
}
