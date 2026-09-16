import { useEffect, useRef, useState } from 'react';
import { supabase } from './client';

type Request = { id: string; user_id: string; points: number; status: 'draft' | 'pending' | 'approved' | 'rejected'; created_at: string; review_note: string | null };
const receiptPath = (r: Request) => `${r.user_id}/${r.id}/receipt`;
function failure(error: { code?: string }) {
  if (error.code === '23505') return 'This bank transaction has already been credited. Please check the reference.';
  if (error.code === 'P0001') return 'The request could not be completed. Check its status and details, or try again later.';
  return 'We couldn’t complete that request. Refresh the payment history before retrying.';
}
export function Topups({ userId, admin, onCredit }: { userId: string; admin: boolean; onCredit: () => void }) {
  const [requests, setRequests] = useState<Request[]>([]), [queue, setQueue] = useState<Request[]>([]);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null), [receipt, setReceipt] = useState<{ id: string; url: string } | null>(null);
  const [review, setReview] = useState(''), [reference, setReference] = useState(''), [note, setNote] = useState(''), [verified, setVerified] = useState(false);
  const lock = useRef(false);
  async function refresh() {
    const own = await supabase!.from('together_topups').select('id,user_id,points,status,created_at,review_note').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
    if (own.error) { setReady(false); throw own.error; }
    setRequests(own.data as Request[]); setReady(true);
    if (admin) {
      const pending = await supabase!.from('together_topups').select('id,user_id,points,status,created_at,review_note').eq('status', 'pending').order('created_at').limit(50);
      if (pending.error) throw pending.error;
      setQueue(pending.data as Request[]);
    }
  }
  async function run(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await work(); } catch (e) { setError(failure(e as { code?: string })); }
    finally { lock.current = false; setBusy(false); }
  }
  useEffect(() => { void run(refresh); }, [userId, admin]);
  async function view(r: Request) {
    const { data, error } = await supabase!.storage.from('together-receipts').createSignedUrl(receiptPath(r), 300);
    if (error) throw error;
    setReceipt({ id: r.id, url: data.signedUrl });
  }
  const open = requests.find(r => r.status === 'draft' || r.status === 'pending');
  return <div className="topups">
    <h3>Keep making memories</h3>
    <p>7,000 MMK buys 100 points — enough for 1 session.</p>
    <p className="topup-notice">Payments are reviewed by a person. Points arrive after approval, which may take until the next day. You can close this page and return to My account to check.</p>
    {!ready ? <p>Payment requests aren’t available yet.</p> : !open ? <button className="primary" disabled={busy} onClick={() => void run(async () => {
      const { error } = await supabase!.rpc('together_start_topup'); if (error) throw error;
      setFile(null); await refresh();
    })}>Buy 100 points</button> : open.status === 'pending' ? <p role="status">Your 7,000 MMK payment is awaiting review. Please don’t transfer again for this request.</p> : <div className="topup-checkout">
      <h3>Pay with KBZPay</h3>
      <p>Transfer exactly <strong>7,000 MMK</strong> using this QR, then upload your payment receipt below. If you already paid, continue with the receipt only.</p>
      <img className="bank-qr" src="/kbzpay-topup.png" alt="KBZPay payment QR for 7,000 MMK" />
      <a href="/kbzpay-topup.png" download="Together-KBZPay.png">Save QR image</a>
      <p>On your phone, save the image and select it in KBZPay’s scanner if supported.</p>
      <label>Payment receipt<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => setFile(e.target.files?.[0] || null)} /></label>
      <small>JPG, PNG or WebP, up to 5 MB. Receipts are visible only to you and the administrator. Once uploaded, a receipt cannot be replaced.</small>
      <button className="primary" disabled={busy} onClick={() => void run(async () => {
        if (file) {
          if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5242880 || file.size === 0) { setError('Choose a JPG, PNG or WebP receipt up to 5 MB.'); return; }
          const { error } = await supabase!.storage.from('together-receipts').upload(receiptPath(open), file, { contentType: file.type, upsert: false });
          if (error) { setError('Upload was not completed, or a receipt is already saved. If you uploaded earlier, use “Submit saved receipt” below.'); return; }
          setFile(null);
        }
        const { error } = await supabase!.rpc('together_submit_topup', { request_id: open.id }); if (error) throw error;
        await refresh();
      })}>{busy ? 'Please wait…' : file ? 'Upload and submit receipt' : 'Submit saved receipt'}</button>
    </div>}
    <h3>Your payment requests</h3>
    <button className="text-button" disabled={busy} onClick={() => void run(refresh)}>Refresh payment status</button>
    {requests.length === 0 && ready && <p>No payment requests yet.</p>}
    <ul className="payment-list">{requests.map(r => <li key={r.id}>
      <strong>7,000 MMK · {r.status === 'draft' ? 'Awaiting receipt' : r.status === 'pending' ? 'Pending review' : r.status === 'approved' ? `Approved · ${r.points.toLocaleString()} points added` : 'Not approved'}</strong>
      <small>{new Date(r.created_at).toLocaleString()} · Request {r.id.slice(0,8)}</small>
      {r.review_note && <p>{r.review_note}</p>}
      <button className="text-button" disabled={busy} onClick={() => void run(() => view(r))}>View saved receipt</button>
    </li>)}</ul>
    {admin && <section className="admin-payments"><h3>Payment reviews</h3><p>Check the incoming payment in KBZPay before approving. A receipt image alone is not proof of payment.</p>
      {queue.length === 0 && ready && <p>No pending payments.</p>}
      {queue.map(r => <div key={r.id} className="payment-review">
        <p>7,000 MMK → 100 points</p><small>Request {r.id}<br />Account {r.user_id}</small>
        <button className="text-button" disabled={busy} onClick={() => void run(async () => { await view(r); setReview(r.id); setReference(''); setNote(''); setVerified(false); })}>Review receipt</button>
        {review === r.id && <>
          {receipt?.id === r.id && <img className="bank-qr" src={receipt.url} alt="Receipt being reviewed" />}
          <label>Actual bank transaction reference<input value={reference} maxLength={100} onChange={e => setReference(e.target.value)} disabled={busy} /></label>
          <label>Note to the user (required when rejecting)<input value={note} maxLength={500} onChange={e => setNote(e.target.value)} disabled={busy} /></label>
          <label className="payment-check"><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} disabled={busy} />I checked KBZPay and received 7,000 MMK for this request.</label>
          <button className="primary" disabled={busy || !verified || reference.replace(/[^a-z0-9]/gi,'').length < 4} onClick={() => void run(async () => {
            const { error } = await supabase!.rpc('together_review_topup', { request_id: r.id, approve: true, transfer_reference: reference, note });
            if (error) throw error; setReview(''); setReceipt(null); await refresh(); onCredit();
          })}>Approve and add 100 points</button>
          <button className="text-button" disabled={busy || !note.trim()} onClick={() => void run(async () => {
            const { error } = await supabase!.rpc('together_review_topup', { request_id: r.id, approve: false, transfer_reference: '', note });
            if (error) throw error; setReview(''); setReceipt(null); await refresh();
          })}>Reject request</button>
        </>}
      </div>)}
    </section>}
    {receipt && receipt.id !== review && <div className="receipt-view"><h3>Receipt · {receipt.id.slice(0,8)}</h3><img src={receipt.url} alt="Uploaded payment receipt" /><button className="text-button" onClick={() => setReceipt(null)}>Close receipt</button><small>This preview expires after five minutes. Open it again to refresh.</small></div>}
    {error && <p role="alert" className="account-error">{error}</p>}
  </div>;
}
