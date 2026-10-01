import { useEffect, useRef, useState } from 'react';
import { layouts, move } from './core';
import { UploadScreen } from './UploadScreen';
import { PhotoTray } from './PhotoTray';
import { Heading } from './shared';
import { renderCard } from './renderCard';
import type { CardState } from './types';

// Each layout opening gets one left/right pair, just like a live Duo capture.
async function pairPhotos(photos: string[], count: number) {
  const pairs: string[] = [];
  for (let i = 0; i < count; i++) {
    const canvas = document.createElement('canvas'); canvas.width = 1440; canvas.height = 960;
    const ctx = canvas.getContext('2d')!;
    for (const [side, source] of [photos[count + i], photos[i]].entries()) {
      const image = new Image(); image.src = source; await image.decode();
      const scale = Math.max(720 / image.naturalWidth, 960 / image.naturalHeight);
      const w = 720 / scale, h = 960 / scale;
      ctx.drawImage(image, (image.naturalWidth - w) / 2, (image.naturalHeight - h) / 2, w, h, side * 720, 0, 720, 960);
    }
    pairs.push(canvas.toDataURL('image/jpeg', .95));
  }
  return pairs;
}

export function DuoUploadScreen({ card, photos, onPhotos, onBack, onNext }: {
  card: CardState; photos: string[]; onPhotos: (photos: string[]) => void;
  onBack: () => void; onNext: (shots: string[]) => void;
}) {
  const count = layouts[card.layout].count;
  const full = photos.filter(Boolean).length === count * 2;
  const [stage, setStage] = useState<'right' | 'left' | 'review'>(full ? 'review' : 'right');
  const [preview, setPreview] = useState(''), [pairs, setPairs] = useState<string[]>([]);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (stage === 'left' && !dialog.current?.open) dialog.current?.showModal();
    if (stage !== 'left') dialog.current?.close();
  }, [stage]);
  useEffect(() => {
    let cancelled = false;
    setPreview(''); setPairs([]); setError('');
    if (stage === 'review' && full) void (async () => {
      try {
        const shots = await pairPhotos(photos, count);
        const canvas = await renderCard({ ...card, shots });
        if (!cancelled) { setPairs(shots); setPreview(canvas.toDataURL('image/png')); }
      } catch { if (!cancelled) setError('Could not prepare your card. Please replace the affected photos.'); }
    })();
    return () => { cancelled = true; };
  }, [photos, card, count, stage, full]);
  function updateSide(side: 'right' | 'left', shots: string[]) {
    const next = Array.from({ length: count * 2 }, (_, i) => photos[i] || '');
    const offset = side === 'right' ? 0 : count;
    for (let i = 0; i < count; i++) next[offset + i] = shots[i] || '';
    onPhotos(next);
  }
  function upload(side: 'right' | 'left') {
    const shots = photos.slice(side === 'right' ? 0 : count, side === 'right' ? count : count * 2);
    return <><p className="duo-side-label">{side === 'right' ? '1 · Right side' : '2 · Left side'} — choose {count} photos</p>
      <UploadScreen key={side} card={{ ...card, shots }} replacement={null} nextLabel={side === 'right' ? 'Continue to left-side photos' : 'Preview both sides'}
        onPhotos={next => updateSide(side, next)} onMove={(from, to) => updateSide(side, move(shots, from, to))}
        onBack={side === 'right' ? onBack : () => setStage('right')}
        onNext={() => setStage(side === 'right' ? 'left' : 'review')} />
    </>;
  }
  return <>
    {stage === 'right' && upload('right')}
    <dialog ref={dialog} className="duo-upload-dialog" aria-label="Upload left-side photos" onCancel={event => { event.preventDefault(); setStage('right'); }}>
      {stage === 'left' && upload('left')}
    </dialog>
    {stage === 'review' && <>
      <Heading eyebrow="BOTH SIDES, ONE KEEPSAKE" title={<>Your photos. <em>Together.</em></>} note={`${count * 2} photos in ${count} side-by-side pairs. Drag photos within either side to change their order.`} />
      <div className="upload-surface">
        {preview ? <img className="duo-upload-preview" src={preview} alt="Your combined Duo photocard" /> : <p role="status">{error || 'Preparing your photocard…'}</p>}
        {(['right', 'left'] as const).map(side => {
          const offset = side === 'right' ? 0 : count;
          return <section key={side} aria-label={`${side} photos`}><h2>{side === 'right' ? 'Right side' : 'Left side'}</h2>
            <PhotoTray shots={photos.slice(offset, offset + count)} count={count} retake={null} actionLabel="Replace" onMove={(from, to) => updateSide(side, move(photos.slice(offset, offset + count), from, to))} onRetake={() => setStage(side)} />
          </section>;
        })}
        <div className="step-actions"><button className="text-button" onClick={onBack}>Change layout</button><button className="primary" disabled={!preview || pairs.length !== count} onClick={() => onNext(pairs)}>Continue to editing</button></div>
      </div>
    </>}
  </>;
}
