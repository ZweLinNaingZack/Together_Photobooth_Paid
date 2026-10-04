import { WarningNotice } from '../components/WarningNotice';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from './AuthProvider';
import { authRedirect, googleAvailable, supabase } from './client';
import './account.css';
import { authErrorMessage } from './errors';
import { Wallet } from './Wallet';
import { GoogleAccount } from './GoogleAccount';
import { Captcha, captchaKey } from './Captcha';
import { readBoothReturn } from './inviteReturn.js';
const emailFlows = (import.meta as ImportMeta & { env: Record<string,string> }).env.VITE_AUTH_EMAIL_FLOWS_ENABLED === 'true';
type Mode = 'signin' | 'signup' | 'reset';
export function Account({ page = 'overview' }: { page?: 'overview' | 'buy' | 'admin' }) {
  const { user, loading, recovery, finishRecovery, error: initialError } = useAuth();
  const [mode, setMode] = useState<Mode>('signin'), [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [google, setGoogle] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const lock = useRef(false);
  const [captchaToken, setCaptchaToken] = useState(''), [captchaAttempt, setCaptchaAttempt] = useState(0);
  useEffect(() => { const c = new AbortController(); googleAvailable(c.signal).then(setGoogle).catch(() => {}); return () => c.abort(); }, []);
  useEffect(() => { setPassword(''); }, [user?.id, recovery]);
  function switchMode(next: Mode) { setMode(next); setPassword(''); setMessage(''); setError(''); }
  async function run(task: () => Promise<void>) {
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setMessage('');
    try { await task(); } catch { setError('We could not connect. Please check your connection and try again.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!supabase) return; const client = supabase;
    if (!recovery && !/^[^\s@]+@gmail\.com$/i.test(email.trim())) { setError('Please use a gmail.com address.'); return; }
    if (!recovery && mode !== 'signin' && !emailFlows) { setError('Email registration and reset emails are paused. Please continue with Google.'); return; }
    if (!recovery && (!captchaKey || !captchaToken)) { setError('Please complete the verification first.'); return; }
    await run(async () => {
      if (recovery && user) {
        const { error } = await client.auth.updateUser({ password });
        if (error) { setError(authErrorMessage(error)); return; }
        setPassword(''); finishRecovery(); setMessage('Your password has been updated.');
      } else if (mode === 'reset') {
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirect(true), captchaToken });
        if (error) { setError(authErrorMessage(error)); return; }
        setMessage('If an account exists for this email, you’ll receive a reset link. Open it in this browser.');
      } else if (mode === 'signup') {
        const { error } = await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: authRedirect(), captchaToken } });
        setPassword('');
        if (error) { setError(authErrorMessage(error)); return; }
        setMessage('Check your email for a confirmation link and open it in this browser. If you already have an account, use Sign in.');
      } else {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password, options: { captchaToken } }); setPassword('');
        if (error) setError(authErrorMessage(error));
      }
    });
    setCaptchaToken(''); setCaptchaAttempt(n => n+1);
  }
  const update = recovery && Boolean(user);
  if (user && !update) return <GoogleAccount page={page} />;
  const returnTo = readBoothReturn() || '#booth';
  return <section className="account-page" aria-labelledby="account-title">
    <div className="eyebrow">YOUR LITTLE PLACE AT TOGETHER</div>
    <h1 id="account-title">{update ? 'A fresh password.' : user ? 'Welcome back.' : mode === 'signup' ? 'Make yourself at home.' : mode === 'reset' ? 'Let’s get you back in.' : 'A little closer.'}</h1>
    <p className="account-intro">{user ? 'Your account, ready for your next little moment.' : 'One account for the moments you’ll make.'}</p>
    <div className="account-panel">
      {loading ? <p role="status">Checking your account…</p> : !supabase ? <WarningNotice>Account sign-in is not configured yet. Please try again later.</WarningNotice> : user && !update ? <>
        <span className="eyebrow">SIGNED IN AS</span><p className="account-email">{user.email}</p>
        <Wallet key={user.id} userId={user.id} />
        <a className="primary" href={returnTo} onClick={() => { try { sessionStorage.removeItem('together-after-signin'); } catch { /* Optional navigation hint. */ } }}>Take the photos now</a>
        <button className="text-button" disabled={busy} onClick={() => void run(async () => { const { error } = await supabase!.auth.signOut({ scope: 'local' }); if (error) setError('We couldn’t sign you out. Please try again.'); })}>Sign out</button>
      </> : <>
        {!update && mode !== 'reset' && <><button className="outline-button account-google" disabled={busy || !google} onClick={() => void run(async () => { const { error } = await supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: authRedirect() } }); if (error) setError('Google sign-in is unavailable. Please use email for now.'); })}>Continue with Google</button>{!google && <small>Google sign-in is coming soon. You can use email below.</small>}<div className="account-divider">or use your email</div></>}
        <form onSubmit={submit}><fieldset disabled={busy}>
          {!update && <label>Email address<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} /></label>}
          {(update || mode !== 'reset') && <label>{update ? 'New password' : 'Password'}<input type="password" autoComplete={update || mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={update || mode === 'signup' ? 8 : 1} maxLength={128} />{(update || mode === 'signup') && <small>Use at least 8 characters.</small>}</label>}
          {!update && <Captcha key={`${mode}-${captchaAttempt}`} onToken={setCaptchaToken} />}
          {!emailFlows && !update && <p className="account-message">Gmail and password sign-in is available for confirmed accounts. New email registrations and password-reset emails are paused while we prepare email delivery. New here? Continue with Google above.</p>}
          <button className="primary" type="submit" disabled={!update && (!captchaToken || mode !== 'signin' && !emailFlows)}>{busy ? 'Just a moment…' : update ? 'Save new password' : mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}</button>
        </fieldset></form>
        {!update && emailFlows && <button className="text-button" disabled={busy || !captchaToken} onClick={() => void run(async () => {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter your email address above first.'); return; }
          if (!/^[^\s@]+@gmail\.com$/i.test(email.trim())) { setError('Please use a gmail.com address.'); return; }
          const token = captchaToken; setCaptchaToken(''); setCaptchaAttempt(n => n+1);
          const { error } = await supabase!.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: authRedirect(), captchaToken: token } });
          if (error) { setError(authErrorMessage(error)); return; }
          setMessage('If this email has an account awaiting confirmation, a new link has been requested. Open the newest email in this browser.');
        })}>Resend confirmation email</button>}
        {!update && <div className="account-links"><button className="text-button" disabled={busy} onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}</button>{mode === 'signin' && <button className="text-button" disabled={busy} onClick={() => switchMode('reset')}>Forgot your password?</button>}</div>}
      </>}
      {(error || (!message && initialError)) && <WarningNotice>{error || initialError}</WarningNotice>}
      {message && <p role="status" className="account-message">{message}</p>}
    </div><a className="text-button" href="#">Back to Together</a>
  </section>;
}
