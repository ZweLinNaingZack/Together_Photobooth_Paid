import { WarningNotice } from '../components/WarningNotice';
import { BoothDialog } from '../components/BoothDialog';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { authRedirect, googleAvailable, supabase } from './client';
import { Wallet } from './Wallet';
import './account.css';
import { readBoothReturn } from './inviteReturn.js';
import { SecuritySettings } from './SecuritySettings';
import { useT } from '../i18n';

// Google-only test phase. Account.tsx retains the email flows for later use.
export function GoogleAccount({ page = 'overview' }: { page?: 'overview' | 'buy' | 'admin' }) {
  const { user, loading, error: callbackError } = useAuth();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const lock = useRef(false);
  const [signout, setSignout] = useState(false);
  const t = useT();
  useEffect(() => {
    const controller = new AbortController();
    setAvailable(null); setError('');
    googleAvailable(controller.signal).then(value => {
      if (!controller.signal.aborted) setAvailable(value);
    }).catch(() => {
      if (!controller.signal.aborted) { setAvailable(false); setError(t('google.checkFailed')); }
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
      setError(t('google.startFailed'));
    } finally { lock.current = false; setBusy(false); }
  }
  const returnTo = readBoothReturn() || '#booth';
  return <section className={`account-page ${user ? 'account-workspace' : ''}`} aria-labelledby="account-title">
    <div className="eyebrow">{t('account.eyebrow')}</div>
    <h1 id="account-title">{user ? page === 'buy' ? t('google.title.buy') : page === 'admin' ? 'Payment reviews.' : t('google.title.overview') : t('account.title.signin')}</h1>
    <p className="account-intro">{user ? user.email : t('google.intro')}</p>
    <div className="account-panel">
      {loading ? <p role="status">{t('nav.checkingAccount')}</p> : !supabase ? <WarningNotice>{t('account.notConfigured')}</WarningNotice> : user ? <>
        <Wallet key={user.id} userId={user.id} page={page} />
        {page === 'overview' && <SecuritySettings email={user.email || ''} />}
        <div className="account-footer-actions">
        <a className="primary" href={returnTo} onClick={() => { try { sessionStorage.removeItem('together-after-signin'); } catch { /* Optional hint. */ } }}>{t('common.takePhotos')}</a>
        <button className="signout-button" disabled={busy} onClick={() => setSignout(true)}>{t('account.signOut')}</button>
        <BoothDialog open={signout} title={t('google.signoutTitle')} cancelLabel={t('google.staySignedIn')} confirmLabel={t('account.signOut')} busy={busy} onCancel={() => setSignout(false)} onConfirm={async () => {
          if (lock.current) return; lock.current = true; setBusy(true); setError('');
          try { const { error } = await supabase!.auth.signOut({ scope: 'local' }); if (error) throw error; }
          catch { setError(t('account.signoutFailed')); }
          finally { lock.current = false; setBusy(false); setSignout(false); }
        }}><p>{t('google.signoutText')}</p></BoothDialog></div>
      </> : <>
        <button className="outline-button account-google" disabled={busy || available !== true} onClick={() => void signIn()}>
          {busy ? t('google.opening') : available === null ? t('google.checking') : t('account.google')}
        </button>
        <p>{t('google.newHere')}</p>
        <small>{t('google.testPhase')}</small>
        {available === false && <><p role="status">{t('google.unavailable')}</p><button className="text-button" disabled={busy} onClick={() => setRetry(n => n + 1)}>{t('common.tryAgain')}</button></>}
      </>}
      {(error || callbackError) && <WarningNotice>{error || callbackError}</WarningNotice>}
    </div>
    <a className="text-button" href="#">{t('common.backToTogether')}</a>
  </section>;
}
