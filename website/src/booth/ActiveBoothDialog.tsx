import { useEffect, useId, useRef, useState } from 'react';
import { layouts } from './core';
import type { CardState } from './types';
import { tm, useT, type Key } from '../i18n';

/** What the popup needs to know about the unfinished booth. */
export interface ActiveBoothInfo {
  kind: 'solo-camera' | 'solo-upload' | 'duo-host' | 'duo-guest' | 'duo-upload' | 'solo-unknown' | 'duo-unknown';
  card?: CardState;          // known when this device saved the session
  photos?: string[];         // photos to show in the preview (duo upload shows the first side)
  saved?: number; total?: number;
  roomCode?: string;
  heldUntil?: string;        // already formatted time, e.g. "8:38 PM"
  lastSaved?: string;
  ended: boolean;            // the duo room has closed: it can only be released
  guest: boolean;            // guests are never charged
  hasSavedPhotos: boolean;   // closing deletes photos saved on this device
}

/** Dictionary key for each kind of booth, e.g. 'solo-camera' → "Solo, taking photos". */
const kindLabel = (kind: ActiveBoothInfo['kind']) => `activeBooth.kind.${kind}` as Key;

/** A small, tilted copy of the photo card in its real layout, with the saved photos in their slots. */
function CardMiniature({ card, photos }: { card: CardState; photos: string[] }) {
  const layout = layouts[card.layout];
  const ratio = layout.width / layout.height;
  // Tall 2x6 strips get a fixed height; wide cards get a fixed width, so every layout reads at a similar size.
  const size = ratio < 1 ? { height: 150, width: Math.round(150 * ratio) } : { width: 150, height: Math.round(150 / ratio) };
  return <div className="booth-miniature" style={size} aria-hidden="true">
    {layout.slots.map((slot, index) => <span key={index} className="booth-miniature-slot" style={{ left: `${slot.x * 100}%`, top: `${slot.y * 100}%`, width: `${slot.w * 100}%`, height: `${slot.h * 100}%` }}>
      {photos[index] && <img src={photos[index]} alt="" />}
    </span>)}
    <span className="booth-miniature-caption" style={{ left: `${layout.caption.x * 100}%`, top: `${layout.caption.y * 100}%`, width: `${layout.caption.w * 100}%`, height: `${layout.caption.h * 100}%` }} />
  </div>;
}

/**
 * Shown when an unfinished booth exists: on opening the booth, or when a new booth is refused.
 * The user must choose (Escape does nothing), so a saved session is never dropped by accident.
 * "Close it" asks for confirmation in the same popup instead of stacking a second one.
 */
export function ActiveBoothDialog({ open, info, continueAfterClose, busy, error, onResume, onClose }: {
  open: boolean; info: ActiveBoothInfo | null; continueAfterClose: boolean; busy: boolean; error?: string;
  onResume: () => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null), firstButton = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [confirming, setConfirming] = useState(false);
  const t = useT();
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) { setConfirming(false); dialog.showModal(); }
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  useEffect(() => () => { if (ref.current?.open) ref.current.close(); }, []);
  // Move focus to the main action whenever the view changes.
  useEffect(() => { if (open) firstButton.current?.focus(); }, [open, confirming, info?.ended]);
  if (!info) return <dialog ref={ref} className="leave-dialog active-booth-dialog" />;

  const closeLabel = t(continueAfterClose ? 'activeBooth.closeContinue' : 'activeBooth.closeNew');
  // Closing straight away is safe when nothing would be deleted; otherwise confirm first.
  const askToClose = () => { if (info.hasSavedPhotos) setConfirming(true); else onClose(); };

  let title: string, lead: string;
  if (confirming) {
    title = t('activeBooth.confirm.title');
    lead = `${info.hasSavedPhotos ? t('activeBooth.confirm.photos') + ' ' : ''}${t(info.guest ? 'activeBooth.confirm.guest' : 'activeBooth.confirm.host')}`;
  } else if (info.ended) {
    title = t('activeBooth.ended.title');
    lead = t('activeBooth.ended.text');
  } else {
    title = t('progress.booth.title');
    lead = t('activeBooth.open.text');
  }

  return <dialog ref={ref} className="leave-dialog active-booth-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-lead`} aria-busy={busy} onCancel={event => event.preventDefault()}>
    {info.card && !info.ended ? <CardMiniature card={info.card} photos={info.photos || []} /> : <div className="leave-emblem" aria-hidden="true">♡</div>}
    <h2 id={`${id}-title`}>{title}</h2>
    <p id={`${id}-lead`} className="active-booth-lead">{lead}</p>

    {!confirming && !info.ended && <dl className="active-booth-facts">
      <div><dt>{t('activeBooth.booth')}</dt><dd>{t(kindLabel(info.kind))}</dd></div>
      {info.roomCode && <div><dt>{t('activeBooth.roomCode')}</dt><dd className="active-booth-code">{info.roomCode}</dd></div>}
      <div><dt>{t('activeBooth.photos')}</dt><dd>{info.total ? t('activeBooth.photosSaved', { saved: info.saved || 0, total: info.total }) : t(info.kind === 'duo-guest' ? 'activeBooth.photosShared' : 'activeBooth.photosNone')}</dd></div>
      {info.heldUntil && <div><dt>{t('activeBooth.heldUntil')}</dt><dd>{info.heldUntil}</dd></div>}
      {!info.heldUntil && info.lastSaved && <div><dt>{t('activeBooth.lastSaved')}</dt><dd>{info.lastSaved}</dd></div>}
      <div><dt>{t('activeBooth.cost')}</dt><dd>{t(info.guest ? 'activeBooth.costGuest' : 'activeBooth.costHost')}</dd></div>
    </dl>}

    {error && <p role="alert" className="room-error">{tm(error)}</p>}

    <div className="active-booth-actions">
      {confirming ? <>
        <button ref={firstButton} className="primary" disabled={busy} onClick={onClose}>{busy ? t('activeBooth.closing') : t('activeBooth.yesClose')}</button>
        <button className="outline-button" disabled={busy} onClick={() => setConfirming(false)}>{t('activeBooth.keep')}</button>
      </> : info.ended ? <>
        <button ref={firstButton} className="primary" disabled={busy} onClick={onClose}>{busy ? t('activeBooth.releasing') : t(continueAfterClose ? 'activeBooth.releaseContinue' : 'activeBooth.release')}</button>
      </> : <>
        <button ref={firstButton} className="primary" disabled={busy} onClick={onResume}>{busy ? t('activeBooth.opening') : t('progress.booth.button')}</button>
        <button className="outline-button" disabled={busy} onClick={askToClose}>{closeLabel}</button>
      </>}
    </div>
  </dialog>;
}
