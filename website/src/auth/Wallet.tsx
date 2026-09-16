import { useEffect, useState } from 'react';
import { supabase } from './client';
import { Topups } from './Topups';

type WalletData = { points: number; trial_available: boolean; is_admin: boolean; history: { id: string; points: number; kind: string; created_at: string }[] };
export function Wallet({ userId, page = 'overview' }: { userId: string; page?: 'overview' | 'buy' | 'admin' }) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setWallet(null); setError('');
    async function read() {
      try {
        if (!supabase) throw new Error();
        const { data, error } = await supabase.rpc('together_my_wallet');
        if (!active) return;
        if (error || !data) {
          setError(error?.code === 'PGRST202' ? 'Your wallet is not available yet. Please check back shortly.' : 'We couldn’t load your points. Please try again.');
          return;
        }
        setWallet(data as WalletData);
      } catch { if (active) setError('We couldn’t connect to your wallet. Please try again.'); }
    }
    void read();
    return () => { active = false; };
  }, [userId, attempt, page]);
  return <section className="wallet-panel" aria-label="Your points">
    {error ? <><p role="alert">{error}</p><button className="text-button" onClick={() => setAttempt(n => n + 1)}>Try again</button></> : !wallet ? <p role="status">Loading your points…</p> : <>
      <nav className="account-tabs" aria-label="Account pages"><a href="#account" aria-current={page === 'overview' ? 'page' : undefined}>Overview</a><a href="#account/buy" aria-current={page === 'buy' ? 'page' : undefined}>Buy points</a>{wallet.is_admin && <a href="#account/admin" aria-current={page === 'admin' ? 'page' : undefined}>Admin reviews</a>}</nav>
      {page === 'overview' && <div className="wallet-grid"><section className="dashboard-card balance-card"><span className="eyebrow">YOUR BALANCE</span><p className="wallet-balance">{wallet.points.toLocaleString()} <span>points</span></p><p>100 points for one session.</p><a className="primary" href="#account/buy">Buy points</a></section><section className="dashboard-card"><span className="eyebrow">YOUR FIRST MEMORY</span><p className="wallet-balance">{wallet.trial_available ? '01' : '00'} <span>free session</span></p>
      <p>{wallet.trial_available ? '1 free session available' : 'Your free session has been used'}</p>
      <p>Your free session is used before your points.</p></section><section className="dashboard-card activity-card"><div className="section-heading"><h2>Recent activity</h2>
      <button className="text-button" onClick={() => setAttempt(n => n + 1)}>Refresh balance</button>
      </div>
      {wallet.history.length === 0 ? <p>No point activity yet.</p> : <ul>{wallet.history.map(entry => <li key={entry.id}>
        {entry.kind === 'topup' ? 'Points added' : entry.kind === 'refund' ? 'Session refund' : 'Photobooth session'} · {entry.points > 0 ? '+' : ''}{entry.points} points
        <small> · {new Date(entry.created_at).toLocaleDateString()}</small>
      </li>)}</ul>}
      </section></div>}
      {page === 'buy' && <Topups key="buy" userId={userId} admin={false} onCredit={() => setAttempt(n => n + 1)} />}
      {page === 'admin' && (wallet.is_admin ? <Topups key="admin" userId={userId} admin onCredit={() => {}} /> : <p role="alert">This page is available to administrators only.</p>)}
    </>}
  </section>;
}
