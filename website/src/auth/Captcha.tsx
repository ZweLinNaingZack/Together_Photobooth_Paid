import { useEffect, useRef, useState } from 'react';
type Turnstile = { render: (el: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void };
declare global { interface Window { turnstile?: Turnstile } }
let loader: Promise<void> | undefined;
function load() {
  if (window.turnstile) return Promise.resolve();
  return loader ||= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { script.remove(); loader = undefined; reject(new Error('Verification unavailable')); };
    document.head.appendChild(script);
  });
}
export const captchaKey = (import.meta as ImportMeta & { env: Record<string,string> }).env.VITE_TURNSTILE_SITE_KEY;
export function Captcha({ onToken }: { onToken: (token: string) => void }) {
  const element = useRef<HTMLDivElement>(null), callback = useRef(onToken);
  callback.current = onToken;
  const [error, setError] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false, widget: string | undefined;
    setError(false); callback.current('');
    if (captchaKey) void load().then(() => {
      if (cancelled || !element.current || !window.turnstile) return;
      widget = window.turnstile.render(element.current, { sitekey: captchaKey, theme: 'light', size: 'flexible', callback: (token: string) => callback.current(token), 'expired-callback': () => callback.current(''), 'error-callback': () => { callback.current(''); setError(true); } });
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; if (widget) window.turnstile?.remove(widget); };
  }, [attempt]);
  return <div className="account-captcha"><div ref={element} />{!captchaKey ? <p role="status">Password sign-in verification is being configured. Please use Google for now.</p> : error && <p role="alert">Verification could not load. <button type="button" className="text-button" onClick={() => setAttempt(n => n+1)}>Retry verification</button></p>}</div>;
}
