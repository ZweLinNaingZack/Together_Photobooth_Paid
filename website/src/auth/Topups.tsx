import { BoothDialog } from '../components/BoothDialog';
import { useStepHistory } from '../components/useStepHistory';
import { WarningNotice } from '../components/WarningNotice';
import { useEffect, useRef, useState } from 'react';
import { supabase } from './client';

type Request = { id: string; user_id: string; points: number; amount_mmk: number; status: 'draft' | 'pending' | 'approved' | 'rejected'; created_at: string; review_note: string | null; customer_name?: string; customer_email?: string };
const receiptPath = (r: Request) => `${r.user_id}/${r.id}/receipt`;
function failure(error: { code?: string }) {
  if (error.code === 'PGRST202') return 'The order dashboard needs its database update. Please run the latest payment migration (010) and refresh.';
  if (error.code === '23505') return 'This bank transaction has already been credited. Please check the reference.';
  if (error.code === 'P0001') return 'The request could not be completed. Check its status and details, or try again later.';
  return 'We couldn’t complete that request. Refresh the payment history before retrying.';
}
export function Topups({ userId, admin, onCredit }: { userId: string; admin: boolean; onCredit: () => void }) {
  const [requests, setRequests] = useState<Request[]>([]), [queue, setQueue] = useState<Request[]>([]);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null), [receipt, setReceipt] = useState<{ id: string; url: string } | null>(null);
  const [review, setReview] = useState(''), [reference, setReference] = useState(''), [note, setNote] = useState(''), [verified, setVerified] = useState(false);
  const [points, setPoints] = useState(100);
  const [selecting, setSelecting] = useState(false);
  const [changeAmount, setChangeAmount] = useState<(() => void) | null>(null);
  const lock = useRef(false);
  async function refresh() {
    if (!admin) {
    const own = await supabase!.from('together_topups').select('id,user_id,points,amount_mmk,status,created_at,review_note').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
    if (own.error) { setReady(false); throw own.error; }
    setRequests(own.data as Request[]); setReady(true);
    } else {
      const pending = await supabase!.rpc('together_admin_orders');
      if (pending.error) throw pending.error;
      setQueue(pending.data as Request[]);
      setReady(true);
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
  function requestAmountChange(commit: () => void) {
    if (busy) return;
    if (open?.status === 'draft') setChangeAmount(() => () => { setPoints(open.points); setFile(null); commit(); });
  }
  useStepHistory('payment', !admin && ready, open && !selecting ? 'payment' : 'amount', (target, commit) => {
    if (target === 'amount') requestAmountChange(commit);
    else if (open) commit();
  }, target => setSelecting(target === 'amount'));
  return <div className="topups">
    <BoothDialog open={!!changeAmount} title="Change point amount?" cancelLabel="Keep this payment" confirmLabel="I haven’t paid — change amount" onCancel={() => setChangeAmount(null)} onConfirm={() => { const proceed=changeAmount; setChangeAmount(null); proceed?.(); }}><p>Only change the amount if you haven’t transferred the money yet. If you already paid, keep this order and submit your receipt.</p></BoothDialog>
    {!admin && <div className="purchase-grid"><section className="dashboard-card purchase-card">
    <h3>Keep making memories</h3>
    <p>7,000 MMK buys 100 points — enough for 1 session.</p>
    <p className="topup-notice">Payments are reviewed by a person. Points arrive after approval, which may take until the next day. You can close this page and return to My account to check.</p>
    {!ready ? <p>Payment requests aren’t available yet.</p> : !open || selecting ? <><div className="point-picker"><span className="eyebrow">CHOOSE YOUR POINTS</span><div className="point-stepper"><button type="button" className="outline-button" disabled={busy || points === 100} onClick={() => setPoints(p => Math.max(100, p - 100))}>− 100</button><output aria-live="polite"><strong>{points.toLocaleString()}</strong> points</output><button type="button" className="outline-button" disabled={busy || points >= 10000} onClick={() => setPoints(p => Math.min(10000, p + 100))}>+ 100</button></div><p aria-live="polite"><strong>{(points / 100 * 7000).toLocaleString()} MMK</strong> · {points / 100} {points === 100 ? 'session' : 'sessions'}</p></div><button className="primary" disabled={busy} onClick={() => void run(async () => {
      const { error } = await supabase!.rpc(open ? 'together_change_topup' : 'together_start_topup', open ? { request_id: open.id, requested_points: points } : { requested_points: points }); if (error) throw error;
      setFile(null); await refresh(); setSelecting(false);
    })}>Continue to payment</button></> : open.status === 'pending' ? <p role="status">Your {open.amount_mmk.toLocaleString()} MMK payment for {open.points.toLocaleString()} points is awaiting review. Please don’t transfer again for this request.</p> : <div className="topup-checkout">
      <button className="outline-button" disabled={busy} onClick={() => requestAmountChange(() => setSelecting(true))}>Back to point amount</button><h3>Pay with KBZPay</h3>
      <p>Transfer exactly <strong>{open.amount_mmk.toLocaleString()} MMK</strong> for {open.points.toLocaleString()} points using this QR, then upload your payment receipt below. If you already paid, continue with the receipt only.</p>
      <div className="checkout-columns"><div><img className="bank-qr" src="/kbzpay-payment.jpg" alt="KBZPay payment QR for Zwe Lin Naing" />
      <a href="/kbzpay-payment.jpg" download="Together-KBZPay.jpg">Save QR image</a>
      <p>Save the image and select it in KBZPay’s scanner. Enter {open.amount_mmk.toLocaleString()} MMK and check the recipient and amount before confirming.</p>
      </div><div className="receipt-upload"><label>Payment receipt<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => setFile(e.target.files?.[0] || null)} /></label>
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
      })}>{busy ? 'Please wait…' : file ? 'Upload and submit receipt' : 'Submit saved receipt'}</button></div></div>
    </div>}
    </section><section className="dashboard-card purchase-history"><h3>Your payment requests</h3>
    <button className="text-button" disabled={busy} onClick={() => void run(refresh)}>Refresh payment status</button>
    {requests.length === 0 && ready && <p>No payment requests yet.</p>}
    <ul className="payment-list">{requests.map(r => <li key={r.id}>
      <strong>{r.amount_mmk.toLocaleString()} MMK · {r.points.toLocaleString()} points · {r.status === 'draft' ? 'Awaiting receipt' : r.status === 'pending' ? 'Pending review' : r.status === 'approved' ? `Approved · ${r.points.toLocaleString()} points added` : 'Not approved'}</strong>
      <small>{new Date(r.created_at).toLocaleString()} · Request {r.id.slice(0,8)}</small>
      {r.review_note && <p>{r.review_note}</p>}
      <button className="text-button" disabled={busy} onClick={() => void run(() => view(r))}>View saved receipt</button>
    </li>)}</ul>
    </section></div>}
    {admin && <section className="admin-payments"><div className="section-heading"><div><h2>{queue.filter(r => r.status === 'pending').length} awaiting review</h2><p>Check the incoming payment in KBZPay before approving.</p></div><button className="outline-button" disabled={busy} onClick={() => void run(refresh)}>Refresh orders</button></div>
      {!ready && <p role="status">{busy ? 'Loading orders…' : 'Orders are unavailable. Please refresh.'}</p>}
      {queue.length === 0 && ready && <p className="dashboard-card">No submitted orders yet.</p>}
      {queue.length > 0 && <div className="admin-grid"><aside className="dashboard-card order-list" aria-label="Customer orders"><h3>Latest orders</h3>{queue.map(r => <button key={r.id} className="order-row" aria-pressed={review === r.id} disabled={busy} onClick={() => void run(async () => { setReceipt(null); setReview(r.id); setReference(''); setNote(''); setVerified(false); await view(r); })}><strong>{r.customer_name || 'Customer'}</strong><span>{r.customer_email || r.user_id}</span><span className={`order-status status-${r.status}`}>{r.status === 'pending' ? 'Awaiting review' : r.status}</span><small>{new Date(r.created_at).toLocaleString()} · {r.id.slice(0,8)}</small></button>)}</aside><div className="dashboard-card order-detail">
      {!review && <div className="empty-state"><h3>Select an order</h3><p>View the customer, receipt and transaction details here.</p></div>}
      {queue.filter(r => r.id === review).map(r => <div key={r.id} className="payment-review">
        <h3>{r.customer_name || 'Customer'}</h3><p className="customer-email">{r.customer_email || r.user_id}</p><p>{r.amount_mmk.toLocaleString()} MMK · {r.points} points · <strong>{r.status}</strong></p><small>Request {r.id}</small>
        <button className="text-button" disabled={busy} onClick={() => void run(() => view(r))}>Refresh receipt preview</button>
        {review === r.id && <>
          {receipt?.id === r.id && <img className="bank-qr" src={receipt.url} alt="Receipt being reviewed" />}
          {r.status === 'pending' ? <>
          <label>Actual bank transaction reference<input value={reference} maxLength={100} onChange={e => setReference(e.target.value)} disabled={busy} /></label>
          <label>Note to the user (required when rejecting)<input value={note} maxLength={500} onChange={e => setNote(e.target.value)} disabled={busy} /></label>
          <label className="payment-check"><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} disabled={busy} />I checked KBZPay and received {r.amount_mmk.toLocaleString()} MMK for this request.</label>
          <button className="primary" disabled={busy || !verified || reference.replace(/[^a-z0-9]/gi,'').length < 4} onClick={() => void run(async () => {
            const { error } = await supabase!.rpc('together_review_topup', { request_id: r.id, approve: true, transfer_reference: reference, note });
            if (error) throw error; setReview(''); setReceipt(null); await refresh(); onCredit();
          })}>Approve and add {r.points.toLocaleString()} points</button>
          <button className="text-button" disabled={busy || !note.trim()} onClick={() => void run(async () => {
            const { error } = await supabase!.rpc('together_review_topup', { request_id: r.id, approve: false, transfer_reference: '', note });
            if (error) throw error; setReview(''); setReceipt(null); await refresh();
          })}>Reject request</button>
          </> : <p>{r.review_note || 'This order has already been reviewed.'}</p>}
        </>}
      </div>)}</div></div>}
    </section>}
    {receipt && receipt.id !== review && <div className="receipt-view"><h3>Receipt · {receipt.id.slice(0,8)}</h3><img src={receipt.url} alt="Uploaded payment receipt" /><button className="text-button" onClick={() => setReceipt(null)}>Close receipt</button><small>This preview expires after five minutes. Open it again to refresh.</small></div>}
    {error && <WarningNotice>{error}</WarningNotice>}
  </div>;
}
