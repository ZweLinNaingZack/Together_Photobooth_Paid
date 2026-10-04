import { useEffect, useRef } from 'react';

export function SignInDialog({ onDismiss, onSignIn }: { onDismiss: () => void; onSignIn: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  return <dialog ref={dialog} className="leave-dialog" aria-labelledby="signin-required-title" aria-describedby="signin-required-description" onCancel={event => { event.preventDefault(); onDismiss(); }}>
    <button className="dialog-close" aria-label="Back to home" onClick={onDismiss}>×</button>
    <div className="eyebrow">A LITTLE HELLO FIRST</div>
    <h2 id="signin-required-title">Your memories.<br /><em>Your little account.</em></h2>
    <p id="signin-required-description">Please sign in before entering the photobooth. Your invitation will be waiting when you return.</p>
    <div className="leave-actions"><a className="primary" href="#account" onClick={onSignIn}>Sign in or create account</a><button className="outline-button" onClick={onDismiss}>Back to home</button></div>
  </dialog>;
}
