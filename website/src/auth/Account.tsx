import { WarningNotice } from '../components/WarningNotice';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from './AuthProvider';
import { authRedirect, googleAvailable, incomingEmailLink, supabase } from './client';
import './account.css';
import { authErrorMessage } from './errors';
import { Wallet } from './Wallet';
import { BoothInProgress } from './BoothInProgress';
import { GoogleAccount } from './GoogleAccount';
import { Captcha, captchaKey } from './Captcha';
import { readBoothReturn } from './inviteReturn.js';
import { passwordRequirements, strongPassword } from './passwordPolicy.js';
import { readLoginLock, saveLoginLock } from './loginCountdown.js';
import { tm, useT, type Key } from '../i18n';
import { Rich } from '../i18n/Rich';
const emailFlows = (import.meta as ImportMeta & { env: Record<string,string> }).env.VITE_AUTH_EMAIL_FLOWS_ENABLED === 'true';
type Mode = 'signin' | 'signup' | 'reset';
export function Account({ page = 'overview' }: { page?: 'overview' | 'buy' | 'admin' }) {
  const { user, loading, recovery, finishRecovery, error: initialError, emailLink, verifyEmailLink } = useAuth();
  const [mode, setMode] = useState<Mode>('signin'), [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [google, setGoogle] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  // After a sign-up or reset email is sent, the form is replaced by a "Check your email" card
  // (at the top of the page, so it can't be missed). `sentTo` is the address it went to.
  const [sent, setSent] = useState<null | 'signup' | 'reset'>(null), [sentTo, setSentTo] = useState('');
  // True after signing in with an email that isn't confirmed yet: we then offer to resend the email.
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const lock = useRef(false);
  const t = useT();
  const [lockedUntil, setLockedUntil] = useState(()=>{try{return readLoginLock(localStorage);}catch{return 0;}}), [now, setNow] = useState(Date.now());
  const [attemptsRemaining,setAttemptsRemaining]=useState<number|null>(null);
  function updateLock(until:number){setLockedUntil(until);try{saveLoginLock(localStorage,until);}catch{/* Optional display cache. */}}
  useEffect(()=>{const sync=()=>{try{setLockedUntil(readLoginLock(localStorage));setNow(Date.now());}catch{/* Optional cache. */}};window.addEventListener('storage',sync);window.addEventListener('focus',sync);return()=>{window.removeEventListener('storage',sync);window.removeEventListener('focus',sync);};},[]);
  const remaining = Math.max(0, Math.ceil((lockedUntil-now)/1000));
  useEffect(() => { if (!lockedUntil) return; const id=setInterval(()=>setNow(Date.now()),1000); return ()=>clearInterval(id); }, [lockedUntil]);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(''), [captchaAttempt, setCaptchaAttempt] = useState(0);
  useEffect(() => { const c = new AbortController(); googleAvailable(c.signal).then(setGoogle).catch(() => {}); return () => c.abort(); }, []);
  useEffect(() => { setPassword(''); setShowPassword(false); }, [user?.id, recovery]);
  function switchMode(next: Mode) { setMode(next); setPassword(''); setShowPassword(false); setMessage(''); setError(''); setAttemptsRemaining(null); setSent(null); setNeedsConfirm(false); }
  /** Show the "Check your email" card and bring it into view. */
  function showSent(kind: 'signup' | 'reset') { setSent(kind); setSentTo(email.trim()); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  /** Send the sign-up confirmation email again (uses the current captcha token). */
  function resendConfirmation() {
    void run(async () => {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError(t('account.enterEmailFirst')); return; }
      if (!/^[^\s@]+@gmail\.com$/i.test(email.trim())) { setError(t('account.gmailOnly')); return; }
      const token = captchaToken; setCaptchaToken(''); setCaptchaAttempt(n => n+1);
      const { error } = await supabase!.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: authRedirect(), captchaToken: token } });
      if (error) { setError(authErrorMessage(error)); return; }
      setMessage(t('account.resendSent'));
    });
  }
  async function run(task: () => Promise<void>) {
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setMessage('');
    try { await task(); } catch { setError(t('account.connectError')); }
    finally { lock.current = false; setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!supabase) return; const client = supabase;
    if (mode === 'signin' && !recovery && remaining) return;
    if ((recovery || mode === 'signup') && !strongPassword(password)) { setError(t('account.passwordRules')); return; }
    if (!recovery && !/^[^\s@]+@gmail\.com$/i.test(email.trim())) { setError(t('account.gmailOnly')); return; }
    if (!recovery && mode !== 'signin' && !emailFlows) { setError(t('account.emailPaused')); return; }
    if (!recovery && (!captchaKey || !captchaToken)) { setError(t('account.captchaFirst')); return; }
    await run(async () => {
      if (recovery && user) {
        const {data}=await client.auth.getSession();
        const response=await fetch('/api/password-account',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session?.access_token||''}`},body:JSON.stringify({operation:'update',password})});
        const result=await response.json();
        if (!response.ok) { setError(authErrorMessage({code:result.code,status:response.status})); return; }
        setPassword(''); finishRecovery(); setMessage(t('account.passwordUpdated'));
      } else if (mode === 'reset') {
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirect(true), captchaToken });
        if (error) { setError(authErrorMessage(error)); return; }
        showSent('reset');
      } else if (mode === 'signup') {
        const response=await fetch('/api/password-account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'signup',email:email.trim(),password,captchaToken})});
        const result=await response.json();
        // Keep the typed password on errors (e.g. "already have an account", "too many tries")
        // so the person can switch to Sign in or retry without typing it again.
        if (!response.ok) { setError(authErrorMessage({code:result.code,status:response.status})); return; }
        setPassword('');
        showSent('signup');
      } else {
        const response = await fetch('/api/password-login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:email.trim(),password,captchaToken})});
        const result=await response.json(); setPassword('');
        if (response.status===429) { setNow(Date.now()); updateLock(Date.now()+Math.min(300,Math.max(1,Number(result.retryAfter)||300))*1000); setAttemptsRemaining(null); }
        else setAttemptsRemaining(Number.isInteger(result.attemptsRemaining)?result.attemptsRemaining:null);
        if (!response.ok) { setNeedsConfirm(result.code === 'email_not_confirmed'); setError(result.message ? tm(result.message) : t('account.signinFailed')); return; }
        const {error}=await client.auth.setSession(result);
        if(error)setError(authErrorMessage(error)); else {updateLock(0);setAttemptsRemaining(null);}
      }
    });
    setCaptchaToken(''); setCaptchaAttempt(n => n+1);
  }
  const update = recovery && Boolean(user);
  // Opened from an email link. The account is only confirmed when this button is tapped
  // (email apps that pre-open links to scan them can't use up the link by accident).
  // Sign-up and password-reset links get their own wording so people know what the tap does.
  const resetLink = incomingEmailLink?.type === 'recovery';
  if (emailLink) return <section className="account-page" aria-labelledby="account-title">
    <div className="eyebrow">{t('account.eyebrow')}</div>
    <div className="account-panel account-card-center">
      <MailIcon />
      <h1 id="account-title" className="account-card-title">{t(resetLink ? 'account.link.resetTitle' : 'account.link.title')}</h1>
      <p className="account-card-text">{t(resetLink ? 'account.link.resetText' : 'account.link.text')}</p>
      <button className="primary" disabled={busy || loading} onClick={() => void run(verifyEmailLink)}>{busy ? t('account.link.verifying') : t(resetLink ? 'account.link.resetVerify' : 'account.link.verify')}</button>
      {(error || initialError) && <WarningNotice>{error || initialError}</WarningNotice>}
      {/* Full reload: drops the used link from memory and starts the sign-in page fresh. */}
      <a className="text-button account-card-back" href="/#account" onClick={e => { e.preventDefault(); location.replace('/#account'); location.reload(); }}>{t('account.backToSignIn')}</a>
    </div>
  </section>;
  if (user && !update) return <GoogleAccount page={page} />;
  const returnTo = readBoothReturn() || '#booth';
  return <section className="account-page" aria-labelledby="account-title">
    <div className="eyebrow">{t('account.eyebrow')}</div>
    <h1 id="account-title">{t(update ? 'account.title.update' : user ? 'account.title.back' : mode === 'signup' ? 'account.title.signup' : mode === 'reset' ? 'account.title.reset' : 'account.title.signin')}</h1>
    <p className="account-intro">{t(user ? 'account.intro.user' : 'account.intro.guest')}</p>
    <div className="account-panel">
      {loading ? <p role="status">{t('nav.checkingAccount')}</p> : !supabase ? <WarningNotice>{t('account.notConfigured')}</WarningNotice> : user && !update ? <>
        <span className="eyebrow">{t('account.signedInAs')}</span><p className="account-email">{user.email}</p>
        {page === 'overview' && <BoothInProgress key={`booth-${user.id}`} userId={user.id} />}
        <Wallet key={user.id} userId={user.id} />
        <a className="primary" href={returnTo} onClick={() => { try { sessionStorage.removeItem('together-after-signin'); } catch { /* Optional navigation hint. */ } }}>{t('common.takePhotos')}</a>
        <button className="text-button" disabled={busy} onClick={() => void run(async () => { const { error } = await supabase!.auth.signOut({ scope: 'local' }); if (error) setError(t('account.signoutFailed')); })}>{t('account.signOut')}</button>
      </> : sent ? <div className="account-card-center">
        {/* "Check your email" card: replaces the form after a sign-up or reset email is sent. */}
        <MailIcon />
        <h2 className="account-card-title">{t('account.sent.title')}</h2>
        <p className="account-card-text"><Rich text={t(sent === 'signup' ? 'account.sent.signup' : 'account.sent.reset', { email: sentTo })} /></p>
        <p className="account-card-hint">{t('account.sent.spam')}</p>
        {sent === 'signup' && emailFlows && <div className="account-resend">
          <p>{t('account.resendHelp')}</p>
          <Captcha key={`sent-${captchaAttempt}`} onToken={setCaptchaToken} />
          <button type="button" className="outline-button" disabled={busy || !captchaToken} onClick={resendConfirmation}>{t('account.resendShort')}</button>
        </div>}
        {message && <p role="status" className="account-message">{message}</p>}
        <div className="account-switch">
          <button type="button" className="text-link" onClick={() => switchMode('signin')}>{t('account.backToSignIn')}</button>
          <button type="button" className="text-button" onClick={() => switchMode(sent === 'signup' ? 'signup' : 'reset')}>{t('account.sent.wrongEmail')}</button>
        </div>
      </div> : <>
        {!update && mode !== 'reset' && <>
          <button className="account-google" disabled={busy || !google} onClick={() => void run(async () => { const { error } = await supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: authRedirect() } }); if (error) setError(t('account.googleUnavailable')); })}><GoogleIcon />{t('account.google')}</button>
          {!google && <small>{t('account.googleSoon')}</small>}
          <div className="account-divider">{t('account.orEmail')}</div>
        </>}
        <form onSubmit={submit}><fieldset disabled={busy}>
          {!update && <label>{t('account.email')}<input type="email" autoComplete="email" value={email} onChange={e => {setEmail(e.target.value);setAttemptsRemaining(null);}} required maxLength={254} /></label>}
          {(update || mode !== 'reset') && <div className="password-field"><div className="password-label-row"><label htmlFor="account-password">{t(update ? 'account.newPassword' : 'account.password')}</label>
            {/* "Forgot your password?" sits next to the password label, where people look for it. */}
            {!update && mode === 'signin' && <button type="button" className="text-link" disabled={busy} onClick={() => switchMode('reset')}>{t('account.forgot')}</button>}</div><div className="password-input"><input id="account-password" type={showPassword ? 'text' : 'password'} autoComplete={update || mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={update || mode === 'signup' ? 8 : 1} maxLength={128} /><button type="button" className="password-toggle" aria-label={t(showPassword ? 'account.hidePassword' : 'account.showPassword')} aria-controls="account-password" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{showPassword && <path d="m3 3 18 18" />}</svg></button></div>{(update || mode === 'signup') && <ul className="password-requirements">{passwordRequirements.map(([label, check], i) => <li key={String(label)} data-met={(check as (value:string)=>boolean)(password)}>{(check as (value:string)=>boolean)(password) ? "✓" : "○"} {t(`password.rule${i + 1}` as Key)}</li>)}</ul>}</div>}
          {!update && <Captcha key={`${mode}-${captchaAttempt}`} onToken={setCaptchaToken} />}
          {!emailFlows && !update && <p className="account-message">{t('account.emailPausedNote')}</p>}
          {!update && mode === 'signin' && !remaining && attemptsRemaining !== null && <p role="status">{t(attemptsRemaining === 1 ? 'account.attemptLeft' : 'account.attemptsLeft', { n: attemptsRemaining })}</p>}{!update && mode === 'signin' && remaining > 0 && <p role="status">{t('account.tryAgainIn', { time: `${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}` })}</p>}<button className="primary" type="submit" disabled={(!update && mode === 'signin' && remaining > 0) || !update && (!captchaToken || mode !== 'signin' && !emailFlows)}>{busy ? t('account.justAMoment') : t(update ? 'account.savePassword' : mode === 'signup' ? 'account.createAccount' : mode === 'reset' ? 'account.sendReset' : 'account.signIn')}</button>
        </fieldset></form>
        {/* Signing in or creating an account means accepting the policies, so link them here. */}
        {!update && mode !== 'reset' && <p className="account-legal"><Rich text={t('account.agree')} /></p>}
        {/* Status messages sit right under the button, where the person is looking. */}
        {message && <p role="status" className="account-message">{message}</p>}
        {/* Bottom of the card: switch between sign in / create account, plus "resend" help when it's useful. */}
        {!update && <div className="account-switch">
          {mode === 'reset'
            ? <button type="button" className="text-link" disabled={busy} onClick={() => switchMode('signin')}>{t('account.backToSignIn')}</button>
            : <p>{t(mode === 'signin' ? 'account.newHere' : 'account.haveAccount')} <button type="button" className="text-link" disabled={busy} onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>{t(mode === 'signin' ? 'account.createLink' : 'account.signInLink')}</button></p>}
          {emailFlows && (mode === 'signup' || needsConfirm) && <p className="account-switch-small">{t('account.resendHelp')} <button type="button" className="text-link" disabled={busy || !captchaToken} onClick={resendConfirmation}>{t('account.resendShort')}</button></p>}
        </div>}
      </>}
      {/* Errors open as a pop-up dialog, so they're always seen wherever they come from. */}
      {(error || (!message && initialError)) && <WarningNotice>{error || initialError}</WarningNotice>}
    </div><a className="text-button" href="#">{t('common.backToTogether')}</a>
  </section>;
}

/** Envelope in a soft red circle: tops the "Check your email" and email-link cards. */
function MailIcon() {
  return <div className="account-card-icon" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6.5 8.5 6.5 8.5-6.5" /></svg></div>;
}

/** Google's coloured "G", so the Google button is recognised at a glance. */
function GoogleIcon() {
  return <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>;
}
