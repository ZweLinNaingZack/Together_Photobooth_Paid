import { WarningNotice } from '../components/WarningNotice';
import { BoothDialog } from '../components/BoothDialog';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { authRedirect, googleAvailable, supabase } from './client';
import { Wallet } from './Wallet';
import './account.css';
import { readBoothReturn } from './inviteReturn.js';
import { SecuritySettings } from './SecuritySettings';

// Google-only test phase. Account.tsx retains the email flows for later use.
export function GoogleAccount({ page = 'overview' }: { page?: 'overview' | 'buy' | 'admin' }) {
  const { user, loading, error: callbackError } = useAuth();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const lock = useRef(false);
  const [signout, setSignout] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setAvailable(null); setError('');
    googleAvailable(controller.signal).then(value => {
      if (!controller.signal.aborted) setAvailable(value);
    }).catch(() => {
      if (!controller.signal.aborted) { setAvailable(false); setError('We couldn’t check Google sign-in. Please try again.'); }
    });
    return () => controller.abort();
  }, [retry]);
  async function signIn() {
    if (lock.current || !supabase || !available) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google', options: { redirectTo: authRedirect(), queryParams: { prompt: 'select_account' } },
      });
      if (error) throw error;
    } catch {
      setError('Google sign-in could not start. Please try again.');
    } finally { lock.current = false; setBusy(false); }
  }
  const returnTo = readBoothReturn() || '#booth';
  return <section className={`account-page ${user ? 'account-workspace' : ''}`} aria-labelledby="account-title">
    <div className="eyebrow">YOUR LITTLE PLACE AT TOGETHER</div>
    <h1 id="account-title">{user ? page === 'buy' ? 'More moments await.' : page === 'admin' ? 'Payment reviews.' : 'Your little moments.' : 'A little closer.'}</h1>
    <p className="account-intro">{user ? user.email : 'Sign in with Google to start making memories.'}</p>
    <div className="account-panel">
      {loading ? <p role="status">Checking your account…</p> : !supabase ? <WarningNotice>Sign-in is not configured yet. Please try again later.</WarningNotice> : user ? <>
        <Wallet key={user.id} userId={user.id} page={page} />
        {page === 'overview' && <SecuritySettings email={user.email || ''} />}
        <div className="account-footer-actions">
        <a className="primary" href={returnTo} onClick={() => { try { sessionStorage.removeItem('together-after-signin'); } catch { /* Optional hint. */ } }}>Take the photos now</a>
        <button className="signout-button" disabled={busy} onClick={() => setSignout(true)}>Sign out</button>
        <BoothDialog open={signout} title="Sign out?" cancelLabel="Stay signed in" confirmLabel="Sign out" busy={busy} onCancel={() => setSignout(false)} onConfirm={async () => {
          if (lock.current) return; lock.current = true; setBusy(true); setError('');
          try { const { error } = await supabase!.auth.signOut({ scope: 'local' }); if (error) throw error; }
          catch { setError('We couldn’t sign you out. Please try again.'); }
          finally { lock.current = false; setBusy(false); setSignout(false); }
        }}><p>You can sign back in any time. Your points and payment requests will stay in your account.</p></BoothDialog></div>
      </> : <>
        <button className="outline-button account-google" disabled={busy || available !== true} onClick={() => void signIn()}>
          {busy ? 'Opening Google…' : available === null ? 'Checking Google sign-in…' : 'Continue with Google'}
        </button>
        <p>New here? Your account is created when you continue with Google.</p>
        <small>We’re using Google sign-in during this test phase.</small>
        {available === false && <><p role="status">Google sign-in is temporarily unavailable.</p><button className="text-button" disabled={busy} onClick={() => setRetry(n => n + 1)}>Try again</button></>}
      </>}
      {(error || callbackError) && <WarningNotice>{error || callbackError}</WarningNotice>}
    </div>
    <a className="text-button" href="#">Back to Together</a>
  </section>;
}
