import { BoothDialog } from '../components/BoothDialog';
import { useStepHistory } from '../components/useStepHistory';
import { WarningNotice } from '../components/WarningNotice';
import { useEffect, useRef, useState } from 'react';
import { supabase } from './client';
import { formatDateTime, num, t, useT } from '../i18n';
import { Rich } from '../i18n/Rich';

type Request = { id: string; user_id: string; points: number; amount_mmk: number; status: 'draft' | 'pending' | 'approved' | 'rejected'; created_at: string; review_note: string | null; payment_reference?: string; customer_name?: string; customer_email?: string };
const receiptPath = (r: Request) => `${r.user_id}/${r.id}/receipt`;
function failure(error: { code?: string }) {
  if (error.code === 'PGRST202') return 'The order dashboard needs its database update. Please run the latest payment migration (011) and refresh.';
  if (error.code === '23505') return t('topup.error.duplicate');
  if (error.code === 'P0001') return t('topup.error.failed');
  return t('topup.error.generic');
}
export function Topups({ userId, admin, onCredit }: { userId: string; admin: boolean; onCredit: () => void }) {
  const [requests, setRequests] = useState<Request[]>([]), [queue, setQueue] = useState<Request[]>([]);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null), [receipt, setReceipt] = useState<{ id: string; url: string } | null>(null);
  const [review, setReview] = useState(''), [note, setNote] = useState(''), [verified, setVerified] = useState(false);
  const [points, setPoints] = useState(100), [paymentReference, setPaymentReference] = useState('');
  const linkedOrder = new URLSearchParams(location.search).get('order');
  const orderId = linkedOrder && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(linkedOrder) ? linkedOrder : null;
  const [selecting, setSelecting] = useState(false);
  const [changeAmount, setChangeAmount] = useState<(() => void) | null>(null);
  const [decision,setDecision] = useState<'approve' | 'reject' | null>(null);
  const lock = useRef(false);
  useT();   // redraw when the language changes
  async function refresh() {
    if (!admin) {
    const own = await supabase!.from('together_topups').select('id,user_id,points,amount_mmk,payment_reference,status,created_at,review_note').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
    if (own.error) { setReady(false); throw own.error; }
    setRequests(own.data as Request[]); setReady(true);
    } else {
      const pending = await supabase!.rpc('together_admin_orders', { requested_id: orderId });
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
    if (error) { setReceipt(null); if (r.payment_reference) return; throw error; }
    setReceipt({ id: r.id, url: data.signedUrl });
  }
  useEffect(() => {
    if (!admin || !ready || !orderId || review === orderId) return;
    const item = queue.find(r => r.id === orderId);
    if (item) { setReview(item.id); setNote(''); setVerified(false); void run(() => view(item)); }
  }, [admin, ready, orderId, queue]);
  const open = requests.find(r => r.status === 'draft' || r.status === 'pending');
  function requestAmountChange(commit: () => void) {
    if (busy) return;
    if (open?.status === 'draft') setChangeAmount(() => () => { setPoints(open.points); setFile(null); commit(); });
  }
  useStepHistory('payment', !admin && ready, open && !selecting ? 'payment' : 'amount', (target, commit) => {
    if (target === 'amount') requestAmountChange(commit);
    else if (open) commit();
  }, target => setSelecting(target === 'amount'));
  async function resolveReview() {
    const item=queue.find(r=>r.id===review);
    if (!item || !decision) return;
    await run(async () => {
      const {error}=await supabase!.rpc('together_review_topup',{request_id:item.id,approve:decision==='approve',transfer_reference:null,note});
      if(error)throw error;
      setDecision(null);setReceipt(null);await refresh();onCredit();
    });
  }
  return <div className="topups">
    <BoothDialog open={!!decision} title={decision === 'approve' ? 'Approve this payment?' : 'Reject this payment?'} cancelLabel="Cancel" confirmLabel={decision === 'approve' ? 'Approve & credit points' : 'Confirm rejection'} busy={busy} error={error} onCancel={()=>{setDecision(null);setError('');}} onConfirm={()=>void resolveReview()}><p>{decision === 'approve' ? 'Confirm that the correct transfer was received. Points will be credited once and a confirmation email will be queued.' : 'No points will be credited. The customer will receive an email with your review note, if provided.'}</p></BoothDialog>
    <BoothDialog open={!!changeAmount} title={t('topup.change.title')} cancelLabel={t('topup.change.keep')} confirmLabel={t('topup.change.confirm')} onCancel={() => setChangeAmount(null)} onConfirm={() => { const proceed=changeAmount; setChangeAmount(null); proceed?.(); }}><p>{t('topup.change.text')}</p></BoothDialog>
    {!admin && <div className="purchase-grid"><section className="dashboard-card purchase-card">
    <h3>{t('topup.title')}</h3>
    <p>{t('topup.price')}</p>
    <p className="topup-notice">{t('topup.notice')}</p>
    {!ready ? <p>{t('topup.unavailable')}</p> : !open || selecting ? <><div className="point-picker"><span className="eyebrow">{t('topup.choose')}</span><div className="point-stepper"><button type="button" className="outline-button" disabled={busy || points === 100} onClick={() => setPoints(p => Math.max(100, p - 100))}>− 100</button><output aria-live="polite"><strong>{num(points)}</strong> {t('wallet.points')}</output><button type="button" className="outline-button" disabled={busy || points >= 10000} onClick={() => setPoints(p => Math.min(10000, p + 100))}>+ 100</button></div><p aria-live="polite"><strong>{num(points / 100 * 7000)} MMK</strong> · {t(points === 100 ? 'topup.session' : 'topup.sessions', { n: points / 100 })}</p></div><button className="primary" disabled={busy} onClick={() => void run(async () => {
      const { error } = await supabase!.rpc(open ? 'together_change_topup' : 'together_start_topup', open ? { request_id: open.id, requested_points: points } : { requested_points: points }); if (error) throw error;
      setFile(null); await refresh(); setSelecting(false);
    })}>{t('topup.continue')}</button></> : open.status === 'pending' ? <p role="status">{t('topup.pending', { amount: num(open.amount_mmk), points: num(open.points) })}</p> : <div className="topup-checkout">
      <button className="outline-button" disabled={busy} onClick={() => requestAmountChange(() => setSelecting(true))}>{t('topup.backToAmount')}</button><h3>{t('topup.payWith')}</h3>
      <p><Rich text={t('topup.transfer', { amount: num(open.amount_mmk), points: num(open.points) })} /></p>
      {/* Shown before paying so buyers know points can't be refunded for cash. */}
      <p className="topup-refund-note"><Rich text={t('topup.refundNote')} /></p>
      <div className="checkout-columns"><div><img className="bank-qr" src="/kbzpay-payment.jpg" alt={t('topup.qrAlt')} />
      <a href="/kbzpay-payment.jpg" download="Together-KBZPay.jpg">{t('topup.saveQr')}</a>
      <p>{t('topup.qrHelp', { amount: num(open.amount_mmk) })}</p>
      </div><div className="receipt-upload"><label>{t('topup.reference')}<input value={paymentReference} maxLength={100} disabled={busy} onChange={e => setPaymentReference(e.target.value)} /></label><label>{t('topup.receipt')}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => setFile(e.target.files?.[0] || null)} /></label>
      <small>{t('topup.receiptHelp')}</small>
      <button className="primary" disabled={busy} onClick={() => void run(async () => {
        if (file) {
          if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5242880 || file.size === 0) { setError(t('topup.receiptType')); return; }
          const { error } = await supabase!.storage.from('together-receipts').upload(receiptPath(open), file, { contentType: file.type, upsert: false });
          if (error) { setError(t('topup.uploadFailed')); return; }
          setFile(null);
        }
        const { error } = await supabase!.rpc('together_submit_topup', { request_id: open.id, payment_reference: paymentReference.trim() || null }); if (error) throw error;
        await refresh();
      })}>{busy ? t('topup.wait') : file ? t('topup.submitFile') : paymentReference.trim() ? t('topup.submitReference') : t('topup.submitSaved')}</button></div></div>
    </div>}
    </section><section className="dashboard-card purchase-history"><h3>{t('topup.history')}</h3>
    <button className="text-button" disabled={busy} onClick={() => void run(refresh)}>{t('topup.refresh')}</button>
    {requests.length === 0 && ready && <p>{t('topup.none')}</p>}
    <ul className="payment-list">{requests.map(r => <li key={r.id}>
      <strong>{num(r.amount_mmk)} MMK · {num(r.points)} {t('wallet.points')} · {r.status === 'draft' ? t('topup.status.draft') : r.status === 'pending' ? t('topup.status.pending') : r.status === 'approved' ? t('topup.status.approved', { points: num(r.points) }) : t('topup.status.rejected')}</strong>
      <small>{formatDateTime(r.created_at)} · {t('topup.request', { id: r.id.slice(0,8) })}</small>
      {r.review_note && <p>{r.review_note}</p>}
      <button className="text-button" disabled={busy} onClick={() => void run(() => view(r))}>{t('topup.viewReceipt')}</button>
    </li>)}</ul>
    </section></div>}
    {admin && <section className="admin-payments"><div className="section-heading"><div><h2>{queue.filter(r => r.status === 'pending').length} awaiting review</h2><p>Check the incoming payment in KBZPay before approving.</p></div><button className="outline-button" disabled={busy} onClick={() => void run(refresh)}>Refresh orders</button></div>
      {!ready && <p role="status">{busy ? 'Loading orders…' : 'Orders are unavailable. Please refresh.'}</p>}
      {queue.length === 0 && ready && <p className="dashboard-card">No submitted orders yet.</p>}
      {queue.length > 0 && <div className="admin-grid"><aside className="dashboard-card order-list" aria-label="Customer orders"><h3>Latest orders</h3>{queue.map(r => <button key={r.id} className="order-row" aria-pressed={review === r.id} disabled={busy} onClick={() => void run(async () => { setReceipt(null); setReview(r.id); setNote(''); setVerified(false); await view(r); })}><strong>{r.customer_name || 'Customer'}</strong><span>{r.customer_email || r.user_id}</span><span className={`order-status status-${r.status}`}>{r.status === 'pending' ? 'Awaiting review' : r.status}</span><small>{new Date(r.created_at).toLocaleString()} · {r.id.slice(0,8)}</small></button>)}</aside><div className="dashboard-card order-detail">
      {!review && <div className="empty-state"><h3>Select an order</h3><p>View the customer, receipt and transaction details here.</p></div>}
      {queue.filter(r => r.id === review).map(r => <div key={r.id} className="payment-review">
        <div className="review-customer"><h3>{r.customer_name || 'Customer'}</h3><p className="customer-email">{r.customer_email || r.user_id}</p><span className={`order-status status-${r.status}`}>{r.status === 'pending' ? 'Awaiting review' : r.status}</span></div>
        <dl className="review-summary"><div><dt>Amount</dt><dd>{r.amount_mmk.toLocaleString()} MMK</dd></div><div><dt>Points requested</dt><dd>{r.points.toLocaleString()}</dd></div><div><dt>Submitted</dt><dd>{new Date(r.created_at).toLocaleString()}</dd></div><div><dt>Order ID</dt><dd>{r.id}</dd></div></dl>
        {r.payment_reference && r.payment_reference !== 'See uploaded receipt' && <p>Customer reference: {r.payment_reference}</p>}
        <section className="review-receipt"><h4>Payment receipt</h4>
        <button className="text-button" disabled={busy} onClick={() => void run(() => view(r))}>Refresh receipt preview</button>
          {receipt?.id === r.id && <img className="bank-qr" src={receipt.url} alt="Receipt being reviewed" />}
          </section>{r.status === 'pending' ? <div className="review-decision"><h4>Review decision</h4>
          <label>Note to the user (optional)<textarea rows={3} value={note} maxLength={500} onChange={e => setNote(e.target.value)} disabled={busy} /></label>
          <label className="payment-check"><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} disabled={busy} />I checked KBZPay and received {r.amount_mmk.toLocaleString()} MMK for this request.</label>
          <div className="review-actions"><button className="primary" disabled={busy || !verified} onClick={()=>{setError('');setDecision('approve');}}>Approve and add {r.points.toLocaleString()} points</button>
          <button className="text-button" disabled={busy} onClick={()=>{setError('');setDecision('reject');}}>Reject request</button></div>
          </div> : <p>{r.review_note || 'This order has already been reviewed.'}</p>}
      </div>)}</div></div>}
    </section>}
    {receipt && receipt.id !== review && <div className="receipt-view"><h3>{t('topup.receiptTitle', { id: receipt.id.slice(0,8) })}</h3><img src={receipt.url} alt={t('topup.receiptAlt')} /><button className="text-button" onClick={() => setReceipt(null)}>{t('topup.closeReceipt')}</button><small>{t('topup.receiptExpires')}</small></div>}
    {error && !decision && <WarningNotice>{error}</WarningNotice>}
  </div>;
}
