import { WarningNotice } from '../components/WarningNotice';
import { useEffect, useRef, useState } from 'react';
import { layouts, move } from './core';
import { UploadScreen } from './UploadScreen';
import { PhotoTray } from './PhotoTray';
import { Heading } from './shared';
import { renderCard } from './renderCard';
import type { CardState } from './types';
import { useT } from '../i18n';
import { Rich } from '../i18n/Rich';

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
  const t = useT();
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
      } catch { if (!cancelled) setError(t('duoUpload.prepareFailed')); }
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
    return <><p className="duo-side-label">{t(side === 'right' ? 'duoUpload.rightStep' : 'duoUpload.leftStep', { n: count })}</p>
      <UploadScreen key={side} card={{ ...card, shots }} replacement={null} nextLabel={t(side === 'right' ? 'duoUpload.toLeft' : 'duoUpload.preview')}
        onPhotos={next => updateSide(side, next)} onMove={(from, to) => updateSide(side, move(shots, from, to))}
        onBack={side === 'right' ? onBack : () => setStage('right')}
        onNext={() => setStage(side === 'right' ? 'left' : 'review')} />
    </>;
  }
  return <>
    {stage === 'right' && upload('right')}
    <dialog ref={dialog} className="duo-upload-dialog" aria-label={t('duoUpload.leftLabel')} onCancel={event => { event.preventDefault(); setStage('right'); }}>
      {stage === 'left' && upload('left')}
    </dialog>
    {stage === 'review' && <>
      <Heading eyebrow={t('duoUpload.eyebrow')} title={<Rich text={t('duoUpload.title')} />} note={t('duoUpload.note', { total: count * 2, n: count })} />
      <div className="upload-surface">
        {preview ? <img className="duo-upload-preview" src={preview} alt={t('duoUpload.alt')} /> : <p role="status">{error ? t('duoUpload.previewFailed') : t('edit.preparingCard')}</p>}
        <WarningNotice>{error}</WarningNotice>
        {(['right', 'left'] as const).map(side => {
          const offset = side === 'right' ? 0 : count;
          return <section key={side} aria-label={t(side === 'right' ? 'duoUpload.right' : 'duoUpload.left')}><h2>{t(side === 'right' ? 'duoUpload.right' : 'duoUpload.left')}</h2>
            <PhotoTray shots={photos.slice(offset, offset + count)} count={count} retake={null} actionLabel={t('tray.replace')} onMove={(from, to) => updateSide(side, move(photos.slice(offset, offset + count), from, to))} onRetake={() => setStage(side)} />
          </section>;
        })}
        <div className="step-actions"><button className="text-button" onClick={onBack}>{t('upload.changeLayout')}</button><button className="primary" disabled={!preview || pairs.length !== count} onClick={() => onNext(pairs)}>{t('session.toEditing')}</button></div>
      </div>
    </>}
  </>;
}
