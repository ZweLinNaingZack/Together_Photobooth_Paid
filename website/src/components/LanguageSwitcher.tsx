import { useEffect, useRef, useState } from 'react';
import { LANGUAGES, setLang, useLang, useT } from '../i18n';

/**
 * The language button in the top bar. Opens a small menu with the three languages,
 * each written in its own language so people can spot theirs.
 * Closes on Escape, on picking a language, or when clicking anywhere else.
 */
export function LanguageSwitcher() {
  const lang = useLang(), t = useT();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null);
  const currentLang = LANGUAGES.find(item => item.code === lang)!;

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); button.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    // Put keyboard focus on the current language when the menu opens.
    box.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);

  async function choose(code: typeof lang) {
    setBusy(true);
    try { await setLang(code); } catch { /* offline: keep the current language */ }
    setBusy(false); setOpen(false); button.current?.focus();
  }

  return <div className="lang-switch" ref={box}>
    <button ref={button} type="button" className="lang-button" aria-haspopup="true" aria-expanded={open}
      aria-label={`${t('nav.language')}: ${currentLang.label}`} onClick={() => setOpen(value => !value)}>
      {/* Simple globe icon */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" /></svg>
      <span lang={currentLang.locale}>{currentLang.short}</span>
      <svg className="lang-caret" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
    </button>
    {open && <div className="lang-menu" role="menu" aria-label={t('nav.language')}>
      {LANGUAGES.map(item => <button key={item.code} type="button" role="menuitemradio" aria-checked={item.code === lang} disabled={busy}
        onClick={() => void choose(item.code)}>
        <span className="lang-name" lang={item.locale}>{item.label}</span>
        <small>{item.english}</small>
        {item.code === lang && <span className="lang-check" aria-hidden="true">✓</span>}
      </button>)}
    </div>}
  </div>;
}
