import { WarningNotice } from '../components/WarningNotice';
import { useEffect, useState } from 'react';
import { supabase } from './client';
import { Topups } from './Topups';
import { formatDate, num, useT } from '../i18n';

type WalletData = { points: number; reserved_points?: number; trial_reserved?: boolean; trial_available: boolean; is_admin: boolean; history: { id: string; points: number; kind: string; created_at: string }[] };
export function Wallet({ userId, page = 'overview' }: { userId: string; page?: 'overview' | 'buy' | 'admin' }) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const t = useT();
  useEffect(() => {
    let active = true;
    setWallet(null); setError('');
    async function read() {
      try {
        if (!supabase) throw new Error();
        const { data, error } = await supabase.rpc('together_my_wallet');
        if (!active) return;
        if (error || !data) {
          setError(t(error?.code === 'PGRST202' ? 'wallet.notReady' : 'wallet.loadFailed'));
          return;
        }
        setWallet(data as WalletData);
      } catch { if (active) setError(t('wallet.connectFailed')); }
    }
    void read();
    return () => { active = false; };
  }, [userId, attempt, page]);
  return <section className="wallet-panel" aria-label={t('wallet.label')}>
    {error ? <><WarningNotice>{error}</WarningNotice><button className="text-button" onClick={() => setAttempt(n => n + 1)}>{t('common.tryAgain')}</button></> : !wallet ? <p role="status">{t('wallet.loading')}</p> : <>
      <nav className="account-tabs" aria-label={t('wallet.tabs')}><a href="#account" aria-current={page === 'overview' ? 'page' : undefined}>{t('wallet.overview')}</a><a href="#account/buy" aria-current={page === 'buy' ? 'page' : undefined}>{t('wallet.buy')}</a>{wallet.is_admin && <a href="#account/admin" aria-current={page === 'admin' ? 'page' : undefined}>Admin reviews</a>}</nav>
      {page === 'overview' && <div className="wallet-grid"><section className="dashboard-card balance-card"><span className="eyebrow">{t('wallet.balance')}</span><p className="wallet-balance">{num(wallet.points)} <span>{t('wallet.points')}</span></p><p>{t('wallet.perSession')}</p><a className="primary" href="#account/buy">{t('wallet.buy')}</a></section><section className="dashboard-card"><span className="eyebrow">{t('wallet.firstMemory')}</span><p className="wallet-balance">{wallet.trial_available ? '01' : '00'} <span>{t('wallet.freeSession')}</span></p>
      <p>{t(wallet.trial_reserved ? 'wallet.trialReserved' : wallet.trial_available ? 'wallet.trialAvailable' : 'wallet.trialUsed')}</p>
      {!!wallet.reserved_points && <p>{t('wallet.reserved', { n: num(wallet.reserved_points) })}</p>}
      <p>{t('wallet.trialFirst')}</p></section><section className="dashboard-card activity-card"><div className="section-heading"><h2>{t('wallet.activity')}</h2>
      <button className="text-button" onClick={() => setAttempt(n => n + 1)}>{t('wallet.refresh')}</button>
      </div>
      {wallet.history.length === 0 ? <p>{t('wallet.noActivity')}</p> : <ul>{wallet.history.map(entry => <li key={entry.id}>
        {t(entry.kind === 'topup' ? 'wallet.kind.topup' : entry.kind === 'refund' ? 'wallet.kind.refund' : 'wallet.kind.session')} · {entry.points > 0 ? '+' : ''}{num(entry.points)} {t('wallet.points')}
        <small> · {formatDate(entry.created_at)}</small>
      </li>)}</ul>}
      </section></div>}
      {page === 'buy' && <Topups key="buy" userId={userId} admin={false} onCredit={() => setAttempt(n => n + 1)} />}
      {page === 'admin' && (wallet.is_admin ? <Topups key="admin" userId={userId} admin onCredit={() => {}} /> : <WarningNotice>{t('wallet.adminOnly')}</WarningNotice>)}
    </>}
  </section>;
}
