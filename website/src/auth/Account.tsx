import { WarningNotice } from '../components/WarningNotice';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from './AuthProvider';
import { authRedirect, googleAvailable, supabase } from './client';
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
  function switchMode(next: Mode) { setMode(next); setPassword(''); setShowPassword(false); setMessage(''); setError(''); setAttemptsRemaining(null); }
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
        setMessage(t('account.resetSent'));
      } else if (mode === 'signup') {
        const response=await fetch('/api/password-account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'signup',email:email.trim(),password,captchaToken})});
        const result=await response.json();
        setPassword('');
        if (!response.ok) { setError(authErrorMessage({code:result.code,status:response.status})); return; }
        setMessage(t('account.signupSent'));
      } else {
        const response = await fetch('/api/password-login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:email.trim(),password,captchaToken})});
        const result=await response.json(); setPassword('');
        if (response.status===429) { setNow(Date.now()); updateLock(Date.now()+Math.min(300,Math.max(1,Number(result.retryAfter)||300))*1000); setAttemptsRemaining(null); }
        else setAttemptsRemaining(Number.isInteger(result.attemptsRemaining)?result.attemptsRemaining:null);
        if (!response.ok) { setError(result.message ? tm(result.message) : t('account.signinFailed')); return; }
        const {error}=await client.auth.setSession(result);
        if(error)setError(authErrorMessage(error)); else {updateLock(0);setAttemptsRemaining(null);}
      }
    });
    setCaptchaToken(''); setCaptchaAttempt(n => n+1);
  }
  const update = recovery && Boolean(user);
  if(emailLink)return <section className="account-page"><div className="account-panel"><h1>{t('account.link.title')}</h1><p>{t('account.link.text')}</p><button className="primary" disabled={busy||loading} onClick={()=>void run(verifyEmailLink)}>{busy?t('account.link.verifying'):t('account.link.verify')}</button>{(error||initialError)&&<WarningNotice>{error||initialError}</WarningNotice>}<a className="text-button" href="/#account" onClick={e=>{e.preventDefault();location.replace('/#account');location.reload();}}>{t('account.backToSignIn')}</a></div></section>;
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
      </> : <>
        {!update && mode !== 'reset' && <><button className="outline-button account-google" disabled={busy || !google} onClick={() => void run(async () => { const { error } = await supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: authRedirect() } }); if (error) setError(t('account.googleUnavailable')); })}>{t('account.google')}</button>{!google && <small>{t('account.googleSoon')}</small>}<div className="account-divider">{t('account.orEmail')}</div></>}
        <form onSubmit={submit}><fieldset disabled={busy}>
          {!update && <label>{t('account.email')}<input type="email" autoComplete="email" value={email} onChange={e => {setEmail(e.target.value);setAttemptsRemaining(null);}} required maxLength={254} /></label>}
          {(update || mode !== 'reset') && <div className="password-field"><label htmlFor="account-password">{t(update ? 'account.newPassword' : 'account.password')}</label><div className="password-input"><input id="account-password" type={showPassword ? 'text' : 'password'} autoComplete={update || mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={update || mode === 'signup' ? 8 : 1} maxLength={128} /><button type="button" className="password-toggle" aria-label={t(showPassword ? 'account.hidePassword' : 'account.showPassword')} aria-controls="account-password" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{showPassword && <path d="m3 3 18 18" />}</svg></button></div>{(update || mode === 'signup') && <ul className="password-requirements">{passwordRequirements.map(([label, check], i) => <li key={String(label)} data-met={(check as (value:string)=>boolean)(password)}>{(check as (value:string)=>boolean)(password) ? "✓" : "○"} {t(`password.rule${i + 1}` as Key)}</li>)}</ul>}</div>}
          {!update && <Captcha key={`${mode}-${captchaAttempt}`} onToken={setCaptchaToken} />}
          {!emailFlows && !update && <p className="account-message">{t('account.emailPausedNote')}</p>}
          {!update && mode === 'signin' && !remaining && attemptsRemaining !== null && <p role="status">{t(attemptsRemaining === 1 ? 'account.attemptLeft' : 'account.attemptsLeft', { n: attemptsRemaining })}</p>}{!update && mode === 'signin' && remaining > 0 && <p role="status">{t('account.tryAgainIn', { time: `${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}` })}</p>}<button className="primary" type="submit" disabled={(!update && mode === 'signin' && remaining > 0) || !update && (!captchaToken || mode !== 'signin' && !emailFlows)}>{busy ? t('account.justAMoment') : t(update ? 'account.savePassword' : mode === 'signup' ? 'account.createAccount' : mode === 'reset' ? 'account.sendReset' : 'account.signIn')}</button>
        </fieldset></form>
        {/* Signing in or creating an account means accepting the policies, so link them here. */}
        {!update && mode !== 'reset' && <p className="account-legal"><Rich text={t('account.agree')} /></p>}
        {!update && emailFlows && <button className="text-button" disabled={busy || !captchaToken} onClick={() => void run(async () => {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError(t('account.enterEmailFirst')); return; }
          if (!/^[^\s@]+@gmail\.com$/i.test(email.trim())) { setError(t('account.gmailOnly')); return; }
          const token = captchaToken; setCaptchaToken(''); setCaptchaAttempt(n => n+1);
          const { error } = await supabase!.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: authRedirect(), captchaToken: token } });
          if (error) { setError(authErrorMessage(error)); return; }
          setMessage(t('account.resendSent'));
        })}>{t('account.resend')}</button>}
        {!update && <div className="account-links"><button className="text-button" disabled={busy} onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>{t(mode === 'signin' ? 'account.toSignup' : 'account.toSignin')}</button>{mode === 'signin' && <button className="text-button" disabled={busy} onClick={() => switchMode('reset')}>{t('account.forgot')}</button>}</div>}
      </>}
      {(error || (!message && initialError)) && <WarningNotice>{error || initialError}</WarningNotice>}
      {message && <p role="status" className="account-message">{message}</p>}
    </div><a className="text-button" href="#">{t('common.backToTogether')}</a>
  </section>;
}
