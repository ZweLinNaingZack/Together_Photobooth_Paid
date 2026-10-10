import { WarningNotice } from '../components/WarningNotice';
import { useEffect, useRef, useState } from 'react';
import { layouts } from './core';
import { Heading } from './shared';
import { PhotoTray } from './PhotoTray';
import { importPhoto, validatePhotoSelection } from './importPhotos';
import type { CardState } from './types';
import { tm, useT } from '../i18n';
import { Rich } from '../i18n/Rich';
import { layoutName } from '../i18n/layouts';

export function UploadScreen({ card, onPhotos, onMove, onBack, onNext, replacement, nextLabel }: { card: CardState; onPhotos: (photos: string[]) => void; onMove: (from: number, to: number) => void; onBack: () => void; onNext: () => void; replacement: number | null; nextLabel?: string }) {
  const count = layouts[card.layout].count, ready = card.shots.filter(Boolean).length;
  const t = useT();
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [target, setTarget] = useState<number | null>(replacement);
  const input = useRef<HTMLInputElement>(null), alive = useRef(true), lock = useRef(false);
  useEffect(() => {
    alive.current = true;
    const leave = () => { alive.current = false; };
    window.addEventListener('pagehide', leave);
    return () => { alive.current = false; window.removeEventListener('pagehide', leave); };
  }, []);
  async function select(files: File[]) {
    if (!files.length || lock.current) return;
    lock.current = true; setBusy(true); setErrorMessage(''); setMessage(t('upload.opening'));
    try {
      validatePhotoSelection(files, target === null ? count - ready : 1);
      const next = [...card.shots];
      const slots = target === null ? Array.from({ length: count }, (_, i) => i).filter(i => !next[i]) : [target];
      // Commit the batch only after every selected image has decoded successfully.
      for (const [index, file] of files.entries()) { next[slots[index]] = await importPhoto(file); if (!alive.current) return; }
      onPhotos(next); setTarget(null); setMessage(t('upload.added'));
    } catch (error) { if (alive.current) { setMessage(''); setErrorMessage(error instanceof Error ? tm(error.message) : t('upload.failed')); } }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  return <><Heading eyebrow={t('upload.eyebrow')} title={<Rich text={t('upload.title')} />} note={t(count === 1 ? 'upload.noteOne' : 'upload.note', { layout: layoutName(layouts[card.layout]), n: count })} />
    <div className="upload-surface">
      <div className="upload-picker"><strong>{target === null ? t('upload.ready', { ready, n: count }) : t('upload.replaceN', { n: target + 1 })}</strong><p><Rich text={t('upload.help')} /></p>
        <input ref={input} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple={target === null} disabled={busy || (target === null && ready === count)} aria-label={target === null ? t('source.upload.action') : t('upload.replaceN', { n: target + 1 })} onChange={e => { void select(Array.from(e.target.files || [])); e.target.value = ''; }} />
        <button className="primary" disabled={busy || (target === null && ready === count)} onClick={() => input.current?.click()}>{busy ? t('upload.openingShort') : target === null ? t('upload.choose') : t('upload.chooseReplacement')}</button>
        {target !== null && <button className="text-button" disabled={busy} onClick={() => setTarget(null)}>{t('upload.cancelReplacement')}</button>}
      </div><p role="status" className="session-note">{message}</p><WarningNotice>{errorMessage}</WarningNotice>
      <PhotoTray shots={card.shots} count={count} retake={target} disabled={busy} onMove={onMove} onRetake={setTarget} actionLabel={t('tray.replace')} />
      <div className="step-actions"><button className="text-button" disabled={busy} onClick={onBack}>{t('upload.changeLayout')}</button><button className="primary" disabled={busy || ready !== count || target !== null} onClick={onNext}>{nextLabel ?? t('session.toEditing')}</button></div>
    </div>
  </>;
}
