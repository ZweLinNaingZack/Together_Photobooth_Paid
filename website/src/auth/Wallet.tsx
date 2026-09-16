import { useEffect, useState } from 'react';
import { supabase } from './client';
import { Topups } from './Topups';

type WalletData = { points: number; trial_available: boolean; is_admin: boolean; history: { id: string; points: number; kind: string; created_at: string }[] };
export function Wallet({ userId }: { userId: string }) {
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
  }, [userId, attempt]);
  return <section className="wallet-panel" aria-label="Your points">
    <h2>Your little moments</h2>
    {error ? <><p role="alert">{error}</p><button className="text-button" onClick={() => setAttempt(n => n + 1)}>Try again</button></> : !wallet ? <p role="status">Loading your points…</p> : <>
      <p className="wallet-balance">{wallet.points.toLocaleString()} <span>points</span></p>
      <p>{wallet.trial_available ? '1 free session available' : 'Your free session has been used'}</p>
      <p>One session · 100 points</p>
      <p>7,000 MMK · 100 points · 1 session</p>
      <button className="text-button" onClick={() => setAttempt(n => n + 1)}>Refresh balance</button>
      {wallet.is_admin && <p>Administrator account</p>}
      <h3>Recent point activity</h3>
      {wallet.history.length === 0 ? <p>No point activity yet.</p> : <ul>{wallet.history.map(entry => <li key={entry.id}>
        {entry.kind === 'topup' ? 'Points added' : entry.kind === 'refund' ? 'Session refund' : 'Photobooth session'} · {entry.points > 0 ? '+' : ''}{entry.points} points
        <small> · {new Date(entry.created_at).toLocaleDateString()}</small>
      </li>)}</ul>}
      <Topups userId={userId} admin={wallet.is_admin} onCredit={() => setAttempt(n => n + 1)} />
    </>}
  </section>;
}
