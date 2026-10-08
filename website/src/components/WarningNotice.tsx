import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/** Acknowledged errors stay dismissed until the message changes or clears. */
export function WarningNotice({ children, title = 'A little attention needed' }: { children: ReactNode; title?: string }) {
  const ref = useRef<HTMLDialogElement>(null), body = useRef<HTMLDivElement>(null);
  const [dismissed, setDismissed] = useState('');
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const message = body.current?.textContent?.trim() || '';
    if (!message) setDismissed('');
    function show() {
      // Duo keeps capture mounted for its data connection while editing. A
      // modal inside that hidden screen still makes the whole document inert.
      if (!dialog || !dialog.isConnected || dialog.closest('[hidden], [inert]') || !message || message === dismissed) { if (dialog?.open) dialog.close(); return; }
      // Let an existing confirmation finish before presenting another dialog.
      if (!dialog.open && !document.querySelector('dialog[open]')) dialog.showModal();
    }
    show();
    const observer = new MutationObserver(show);
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open', 'hidden', 'inert'], childList: true });
    return () => observer.disconnect();
  }, [children, dismissed]);
  function dismiss() { setDismissed(body.current?.textContent?.trim() || ''); ref.current?.close(); }
  return <dialog ref={ref} className="leave-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-body`} onCancel={e => { e.preventDefault(); dismiss(); }}>
    <div className="leave-emblem" aria-hidden="true">♡</div><h2 id={`${id}-title`}>{title}</h2>
    <div ref={body} id={`${id}-body`} className="booth-dialog-copy">{children}</div>
    <div className="leave-actions"><button type="button" className="primary" onClick={dismiss}>Got it</button></div>
  </dialog>;
}
