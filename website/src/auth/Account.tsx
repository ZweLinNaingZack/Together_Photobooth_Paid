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
const emailFlows = (import.meta as ImportMeta & { env: Record<string,string> }).env.VITE_AUTH_EMAIL_FLOWS_ENABLED === 'true';
type Mode = 'signin' | 'signup' | 'reset';
export function Account({ page = 'overview' }: { page?: 'overview' | 'buy' | 'admin' }) {
  const { user, loading, recovery, finishRecovery, error: initialError, emailLink, verifyEmailLink } = useAuth();
  const [mode, setMode] = useState<Mode>('signin'), [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [google, setGoogle] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const lock = useRef(false);
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
    try { await task(); } catch { setError('We could not connect. Please check your connection and try again.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!supabase) return; const client = supabase;
    if (mode === 'signin' && !recovery && remaining) return;
    if ((recovery || mode === 'signup') && !strongPassword(password)) { setError('Please meet all five password requirements.'); return; }
    if (!recovery && !/^[^\s@]+@gmail\.com$/i.test(email.trim())) { setError('Please use a gmail.com address.'); return; }
    if (!recovery && mode !== 'signin' && !emailFlows) { setError('Email registration and reset emails are paused. Please continue with Google.'); return; }
    if (!recovery && (!captchaKey || !captchaToken)) { setError('Please complete the verification first.'); return; }
    await run(async () => {
      if (recovery && user) {
        const {data}=await client.auth.getSession();
        const response=await fetch('/api/password-account',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session?.access_token||''}`},body:JSON.stringify({operation:'update',password})});
        const result=await response.json();
        if (!response.ok) { setError(authErrorMessage({code:result.code,status:response.status})); return; }
        setPassword(''); finishRecovery(); setMessage('Your password has been updated.');
      } else if (mode === 'reset') {
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirect(true), captchaToken });
        if (error) { setError(authErrorMessage(error)); return; }
        setMessage('If an account exists for this email, you’ll receive a reset link. Use the newest email.');
      } else if (mode === 'signup') {
        const response=await fetch('/api/password-account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'signup',email:email.trim(),password,captchaToken})});
        const result=await response.json();
        setPassword('');
        if (!response.ok) { setError(authErrorMessage({code:result.code,status:response.status})); return; }
        setMessage('Check your email for a confirmation link. If you already have an account, use Sign in.');
      } else {
        const response = await fetch('/api/password-login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:email.trim(),password,captchaToken})});
        const result=await response.json(); setPassword('');
        if (response.status===429) { setNow(Date.now()); updateLock(Date.now()+Math.min(300,Math.max(1,Number(result.retryAfter)||300))*1000); setAttemptsRemaining(null); }
        else setAttemptsRemaining(Number.isInteger(result.attemptsRemaining)?result.attemptsRemaining:null);
        if (!response.ok) { setError(result.message || 'Sign-in could not be completed.'); return; }
        const {error}=await client.auth.setSession(result);
        if(error)setError(authErrorMessage(error)); else {updateLock(0);setAttemptsRemaining(null);}
      }
    });
    setCaptchaToken(''); setCaptchaAttempt(n => n+1);
  }
  const update = recovery && Boolean(user);
  if(emailLink)return <section className="account-page"><div className="account-panel"><h1>Confirm your email link.</h1><p>Continue to securely verify your email or open the password reset form.</p><button className="primary" disabled={busy||loading} onClick={()=>void run(verifyEmailLink)}>{busy?'Verifying…':'Verify and continue'}</button>{(error||initialError)&&<WarningNotice>{error||initialError}</WarningNotice>}<a className="text-button" href="/#account" onClick={e=>{e.preventDefault();location.replace('/#account');location.reload();}}>Back to sign in</a></div></section>;
  if (user && !update) return <GoogleAccount page={page} />;
  const returnTo = readBoothReturn() || '#booth';
  return <section className="account-page" aria-labelledby="account-title">
    <div className="eyebrow">YOUR LITTLE PLACE AT TOGETHER</div>
    <h1 id="account-title">{update ? 'A fresh password.' : user ? 'Welcome back.' : mode === 'signup' ? 'Make yourself at home.' : mode === 'reset' ? 'Let’s get you back in.' : 'A little closer.'}</h1>
    <p className="account-intro">{user ? 'Your account, ready for your next little moment.' : 'One account for the moments you’ll make.'}</p>
    <div className="account-panel">
      {loading ? <p role="status">Checking your account…</p> : !supabase ? <WarningNotice>Account sign-in is not configured yet. Please try again later.</WarningNotice> : user && !update ? <>
        <span className="eyebrow">SIGNED IN AS</span><p className="account-email">{user.email}</p>
        {page === 'overview' && <BoothInProgress key={`booth-${user.id}`} userId={user.id} />}
        <Wallet key={user.id} userId={user.id} />
        <a className="primary" href={returnTo} onClick={() => { try { sessionStorage.removeItem('together-after-signin'); } catch { /* Optional navigation hint. */ } }}>Take the photos now</a>
        <button className="text-button" disabled={busy} onClick={() => void run(async () => { const { error } = await supabase!.auth.signOut({ scope: 'local' }); if (error) setError('We couldn’t sign you out. Please try again.'); })}>Sign out</button>
      </> : <>
        {!update && mode !== 'reset' && <><button className="outline-button account-google" disabled={busy || !google} onClick={() => void run(async () => { const { error } = await supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: authRedirect() } }); if (error) setError('Google sign-in is unavailable. Please use email for now.'); })}>Continue with Google</button>{!google && <small>Google sign-in is coming soon. You can use email below.</small>}<div className="account-divider">or use your email</div></>}
        <form onSubmit={submit}><fieldset disabled={busy}>
          {!update && <label>Email address<input type="email" autoComplete="email" value={email} onChange={e => {setEmail(e.target.value);setAttemptsRemaining(null);}} required maxLength={254} /></label>}
          {(update || mode !== 'reset') && <div className="password-field"><label htmlFor="account-password">{update ? 'New password' : 'Password'}</label><div className="password-input"><input id="account-password" type={showPassword ? 'text' : 'password'} autoComplete={update || mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={update || mode === 'signup' ? 8 : 1} maxLength={128} /><button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-controls="account-password" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{showPassword && <path d="m3 3 18 18" />}</svg></button></div>{(update || mode === 'signup') && <ul className="password-requirements">{passwordRequirements.map(([label, check]) => <li key={String(label)} data-met={(check as (value:string)=>boolean)(password)}>{(check as (value:string)=>boolean)(password) ? "✓" : "○"} {String(label)}</li>)}</ul>}</div>}
          {!update && <Captcha key={`${mode}-${captchaAttempt}`} onToken={setCaptchaToken} />}
          {!emailFlows && !update && <p className="account-message">Gmail and password sign-in is available for confirmed accounts. New email registrations and password-reset emails are paused while we prepare email delivery. New here? Continue with Google above.</p>}
          {!update && mode === 'signin' && !remaining && attemptsRemaining !== null && <p role="status">{attemptsRemaining} sign-in attempt{attemptsRemaining === 1 ? '' : 's'} remaining.</p>}{!update && mode === 'signin' && remaining > 0 && <p role="status">Try again in {Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}.</p>}<button className="primary" type="submit" disabled={(!update && mode === 'signin' && remaining > 0) || !update && (!captchaToken || mode !== 'signin' && !emailFlows)}>{busy ? 'Just a moment…' : update ? 'Save new password' : mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}</button>
        </fieldset></form>
        {!update && emailFlows && <button className="text-button" disabled={busy || !captchaToken} onClick={() => void run(async () => {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter your email address above first.'); return; }
          if (!/^[^\s@]+@gmail\.com$/i.test(email.trim())) { setError('Please use a gmail.com address.'); return; }
          const token = captchaToken; setCaptchaToken(''); setCaptchaAttempt(n => n+1);
          const { error } = await supabase!.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: authRedirect(), captchaToken: token } });
          if (error) { setError(authErrorMessage(error)); return; }
          setMessage('If this email has an account awaiting confirmation, a new link has been requested. Open the newest email.');
        })}>Resend confirmation email</button>}
        {!update && <div className="account-links"><button className="text-button" disabled={busy} onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}</button>{mode === 'signin' && <button className="text-button" disabled={busy} onClick={() => switchMode('reset')}>Forgot your password?</button>}</div>}
      </>}
      {(error || (!message && initialError)) && <WarningNotice>{error || initialError}</WarningNotice>}
      {message && <p role="status" className="account-message">{message}</p>}
    </div><a className="text-button" href="#">Back to Together</a>
  </section>;
}
