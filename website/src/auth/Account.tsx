import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from './AuthProvider';
import { authRedirect, googleAvailable, supabase } from './client';
import './account.css';
import { authErrorMessage } from './errors';
import { Wallet } from './Wallet';
type Mode = 'signin' | 'signup' | 'reset';
export function Account() {
  const { user, loading, recovery, finishRecovery, error: initialError } = useAuth();
  const [mode, setMode] = useState<Mode>('signin'), [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [google, setGoogle] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const lock = useRef(false);
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
    await run(async () => {
      if (recovery && user) {
        const { error } = await client.auth.updateUser({ password });
        if (error) { setError(authErrorMessage(error)); return; }
        setPassword(''); finishRecovery(); setMessage('Your password has been updated.');
      } else if (mode === 'reset') {
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirect(true) });
        if (error) { setError(authErrorMessage(error)); return; }
        setMessage('If an account exists for this email, you’ll receive a reset link. Open it in this browser.');
      } else if (mode === 'signup') {
        const { error } = await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: authRedirect() } });
        setPassword('');
        if (error) { setError(authErrorMessage(error)); return; }
        setMessage('Check your email for a confirmation link and open it in this browser. If you already have an account, use Sign in.');
      } else {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password }); setPassword('');
        if (error) setError(authErrorMessage(error));
      }
    });
  }
  const update = recovery && Boolean(user);
  return <section className="account-page" aria-labelledby="account-title">
    <div className="eyebrow">YOUR LITTLE PLACE AT TOGETHER</div>
    <h1 id="account-title">{update ? 'A fresh password.' : user ? 'Welcome back.' : mode === 'signup' ? 'Make yourself at home.' : mode === 'reset' ? 'Let’s get you back in.' : 'A little closer.'}</h1>
    <p className="account-intro">{user ? 'Your account, ready for your next little moment.' : 'One account for the moments you’ll make.'}</p>
    <div className="account-panel">
      {loading ? <p role="status">Checking your account…</p> : !supabase ? <p role="alert">Account sign-in is not configured yet. Please try again later.</p> : user && !update ? <>
        <span className="eyebrow">SIGNED IN AS</span><p className="account-email">{user.email}</p>
        <Wallet key={user.id} userId={user.id} />
        <a className="primary" href="#booth">Take the photos now</a>
        <button className="text-button" disabled={busy} onClick={() => void run(async () => { const { error } = await supabase!.auth.signOut({ scope: 'local' }); if (error) setError('We couldn’t sign you out. Please try again.'); })}>Sign out</button>
      </> : <>
        {!update && mode !== 'reset' && <><button className="outline-button account-google" disabled={busy || !google} onClick={() => void run(async () => { const { error } = await supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: authRedirect() } }); if (error) setError('Google sign-in is unavailable. Please use email for now.'); })}>Continue with Google</button>{!google && <small>Google sign-in is coming soon. You can use email below.</small>}<div className="account-divider">or use your email</div></>}
        <form onSubmit={submit}><fieldset disabled={busy}>
          {!update && <label>Email address<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} /></label>}
          {(update || mode !== 'reset') && <label>{update ? 'New password' : 'Password'}<input type="password" autoComplete={update || mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={update || mode === 'signup' ? 8 : 1} maxLength={128} />{(update || mode === 'signup') && <small>Use at least 8 characters.</small>}</label>}
          <button className="primary" type="submit">{busy ? 'Just a moment…' : update ? 'Save new password' : mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}</button>
        </fieldset></form>
        {!update && <button className="text-button" disabled={busy} onClick={() => void run(async () => {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter your email address above first.'); return; }
          const { error } = await supabase!.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: authRedirect() } });
          if (error) { setError(authErrorMessage(error)); return; }
          setMessage('If this email has an account awaiting confirmation, a new link has been requested. Open the newest email in this browser.');
        })}>Resend confirmation email</button>}
        {!update && <div className="account-links"><button className="text-button" disabled={busy} onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}</button>{mode === 'signin' && <button className="text-button" disabled={busy} onClick={() => switchMode('reset')}>Forgot your password?</button>}</div>}
      </>}
      {(error || (!message && initialError)) && <p role="alert" className="account-error">{error || initialError}</p>}
      {message && <p role="status" className="account-message">{message}</p>}
    </div><a className="text-button" href="#">Back to Together</a>
  </section>;
}
