import { cardDesigns } from './designs.ts';

// Only artwork is retained here; private photos never enter this cache.
const frames = new Map<string, Promise<HTMLImageElement>>();
export const thumbnailUrl = (key: string) => `/frames/thumbs/${key}.webp`;
export function loadFrame(src: string) {
  let pending = frames.get(src);
  if (!pending) {
    pending = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => { frames.delete(src); reject(new Error('Frame could not load')); };
      image.src = src;
    });
    frames.set(src, pending);
    // Bound decoded artwork memory when switching between layouts.
    if (frames.size > 6) frames.delete(frames.keys().next().value!);
  }
  return pending;
}
export function prefetchFrames(layout: string) {
  let cancelled = false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (connection?.saveData || connection?.effectiveType?.includes('2g')) return () => {};
  const timer = window.setTimeout(async () => {
    const entries = Object.entries(cardDesigns).filter(([, d]) => (d.layout || 'A') === layout);
    // Warm only two likely choices, serially, without delaying capture or navigation.
    for (const [, design] of entries.slice(0, 2)) {
      if (cancelled) break;
      try { await loadFrame(design.src); } catch { /* Selection offers a retry. */ }
    }
  }, 1500);
  return () => { cancelled = true; window.clearTimeout(timer); };
}
