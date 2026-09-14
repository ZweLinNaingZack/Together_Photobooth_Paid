import { useEffect, useRef, useState } from 'react';
import { layouts } from './core';
import { Heading } from './shared';
import { PhotoTray } from './PhotoTray';
import { importPhoto, validatePhotoSelection } from './importPhotos';
import type { CardState } from './types';

export function UploadScreen({ card, onPhotos, onMove, onBack, onNext, replacement, nextLabel = 'Review your photocard' }: { card: CardState; onPhotos: (photos: string[]) => void; onMove: (from: number, to: number) => void; onBack: () => void; onNext: () => void; replacement: number | null; nextLabel?: string }) {
  const count = layouts[card.layout].count, ready = card.shots.filter(Boolean).length;
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
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
    lock.current = true; setBusy(true); setMessage('Opening your photos…');
    try {
      validatePhotoSelection(files, target === null ? count - ready : 1);
      const next = [...card.shots];
      const slots = target === null ? Array.from({ length: count }, (_, i) => i).filter(i => !next[i]) : [target];
      // Commit the batch only after every selected image has decoded successfully.
      for (const [index, file] of files.entries()) { next[slots[index]] = await importPhoto(file); if (!alive.current) return; }
      onPhotos(next); setTarget(null); setMessage('Photos added. Arrange them in your favorite order.');
    } catch (error) { if (alive.current) setMessage(error instanceof Error ? error.message : 'Could not open these photos. Please try again.'); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  return <><Heading eyebrow="A FEW FAVORITES TO KEEP" title={<>Old photos. <em>New keepsake.</em></>} note={`${layouts[card.layout].name} · ${count} photo${count === 1 ? '' : 's'}. Add your favorites from your device.`} />
    <div className="upload-surface">
      <div className="upload-picker"><strong>{target === null ? `${ready} of ${count} photos ready` : `Replace photo ${target + 1}`}</strong><p>JPG, PNG or WebP · Up to 20 MB per photo.<br />Photos stay in this browser and are cropped to fill your frame.</p>
        <input ref={input} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple={target === null} disabled={busy || (target === null && ready === count)} aria-label={target === null ? 'Choose existing photos' : `Replace photo ${target + 1}`} onChange={e => { void select(Array.from(e.target.files || [])); e.target.value = ''; }} />
        <button className="primary" disabled={busy || (target === null && ready === count)} onClick={() => input.current?.click()}>{busy ? 'Opening photos…' : target === null ? 'Choose photos' : 'Choose replacement'}</button>
        {target !== null && <button className="text-button" disabled={busy} onClick={() => setTarget(null)}>Cancel replacement</button>}
      </div><p role="status" className="session-note">{message}</p>
      <PhotoTray shots={card.shots} count={count} retake={target} disabled={busy} onMove={onMove} onRetake={setTarget} actionLabel="Replace" />
      <div className="step-actions"><button className="text-button" disabled={busy} onClick={onBack}>Change design</button><button className="primary" disabled={busy || ready !== count || target !== null} onClick={onNext}>{nextLabel}</button></div>
    </div>
  </>;
}
