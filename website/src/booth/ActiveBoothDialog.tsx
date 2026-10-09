import { useEffect, useId, useRef, useState } from 'react';
import { layouts } from './core';
import type { CardState } from './types';

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

const kindLabel: Record<ActiveBoothInfo['kind'], string> = {
  'solo-camera': 'Solo, taking photos',
  'solo-upload': 'Solo, uploading photos',
  'duo-host': 'Duo, you created it',
  'duo-guest': 'Duo, you joined it',
  'duo-upload': 'Duo, uploading for both of you',
  'solo-unknown': 'Solo',
  'duo-unknown': 'Duo',
};

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
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) { setConfirming(false); dialog.showModal(); }
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  useEffect(() => () => { if (ref.current?.open) ref.current.close(); }, []);
  // Move focus to the main action whenever the view changes.
  useEffect(() => { if (open) firstButton.current?.focus(); }, [open, confirming, info?.ended]);
  if (!info) return <dialog ref={ref} className="leave-dialog active-booth-dialog" />;

  const closeLabel = continueAfterClose ? 'Close it and continue' : 'Close it and start new';
  // Closing straight away is safe when nothing would be deleted; otherwise confirm first.
  const askToClose = () => { if (info.hasSavedPhotos) setConfirming(true); else onClose(); };

  let title: string, lead: string;
  if (confirming) {
    title = 'Close this booth?';
    lead = `${info.hasSavedPhotos ? 'The photos saved for it on this device will be deleted. ' : ''}${info.guest ? 'Nothing is charged to you.' : 'Nothing has been charged for it.'}`;
  } else if (info.ended) {
    title = 'Your last booth has closed';
    lead = 'The duo room ended, but its hold is still stopping a new booth from starting. Release it to carry on. Nothing was charged.';
  } else {
    title = 'Your booth is still open';
    lead = 'Pick up where you left off, or close it to start a new one.';
  }

  return <dialog ref={ref} className="leave-dialog active-booth-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-lead`} aria-busy={busy} onCancel={event => event.preventDefault()}>
    {info.card && !info.ended ? <CardMiniature card={info.card} photos={info.photos || []} /> : <div className="leave-emblem" aria-hidden="true">♡</div>}
    <h2 id={`${id}-title`}>{title}</h2>
    <p id={`${id}-lead`} className="active-booth-lead">{lead}</p>

    {!confirming && !info.ended && <dl className="active-booth-facts">
      <div><dt>Booth</dt><dd>{kindLabel[info.kind]}</dd></div>
      {info.roomCode && <div><dt>Room code</dt><dd className="active-booth-code">{info.roomCode}</dd></div>}
      <div><dt>Photos</dt><dd>{info.total ? `${info.saved || 0} of ${info.total} saved on this device` : info.kind === 'duo-guest' ? 'Shared again when you reconnect' : 'Not saved on this device'}</dd></div>
      {info.heldUntil && <div><dt>Held until</dt><dd>{info.heldUntil}</dd></div>}
      {!info.heldUntil && info.lastSaved && <div><dt>Last saved</dt><dd>{info.lastSaved}</dd></div>}
      <div><dt>Cost</dt><dd>{info.guest ? 'Covered by your creator' : 'Nothing charged yet'}</dd></div>
    </dl>}

    {error && <p role="alert" className="room-error">{error}</p>}

    <div className="active-booth-actions">
      {confirming ? <>
        <button ref={firstButton} className="primary" disabled={busy} onClick={onClose}>{busy ? 'Closing…' : 'Yes, close it'}</button>
        <button className="outline-button" disabled={busy} onClick={() => setConfirming(false)}>Keep my booth</button>
      </> : info.ended ? <>
        <button ref={firstButton} className="primary" disabled={busy} onClick={onClose}>{busy ? 'Releasing…' : continueAfterClose ? 'Release it and continue' : 'Release it'}</button>
      </> : <>
        <button ref={firstButton} className="primary" disabled={busy} onClick={onResume}>{busy ? 'Opening your booth…' : 'Go back to my booth'}</button>
        <button className="outline-button" disabled={busy} onClick={askToClose}>{closeLabel}</button>
      </>}
    </div>
  </dialog>;
}
