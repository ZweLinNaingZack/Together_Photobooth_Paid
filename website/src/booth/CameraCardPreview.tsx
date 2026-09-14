import { useEffect, useRef, useState } from 'react';
import { renderCard } from './renderCard';
import { cardDesigns } from './designs';
import type { CardState } from './types';

export function CameraCardPreview({ card, ready, capture, retake }: { card: CardState; ready: boolean; capture: () => Promise<string>; retake: number | null }) {
  const latest = useRef({ card, ready, capture, retake }); latest.current = { card, ready, capture, retake };
  const [preview, setPreview] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    let cancelled = false; let timer: ReturnType<typeof setTimeout>;
    async function update() {
      const { card, ready, capture, retake } = latest.current;
      try {
        if (card.template) {
          const design = cardDesigns[card.template];
          const shots = Array.from({ length: design.slots.length }, (_, i) => card.shots[i] || '');
          const index = retake ?? shots.findIndex(shot => !shot);
          if (ready && index >= 0) shots[index] = await capture();
          const canvas = await renderCard({ ...card, shots, preview: true });
          if (!cancelled) setPreview(canvas.toDataURL('image/jpeg', .8));
        }
      } catch { /* The camera may be warming up; keep the last frame until ready. */ }
      if (!cancelled) timer = setTimeout(update, 700);
    }
    void update();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open]);
  return <details className="camera-card-preview" onToggle={event => setOpen(event.currentTarget.open)}><summary>Preview your frame</summary>{preview && <img src={preview} alt="Selected frame with captured photos and the current camera pose" />}<p>The next photo appears in its frame. Your original captures stay unchanged.</p></details>;
}
