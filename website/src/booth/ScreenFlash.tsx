import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';
import { createPortal } from 'react-dom';

export const flashColors = { white: { label: 'White', color: '#ffffff' }, yellow: { label: 'Warm yellow', color: '#ffe59a' }, red: { label: 'Soft red', color: '#ff8b87' } };
export type FlashColor = keyof typeof flashColors;

// A transparent window keeps the camera visible; the surrounding screen emits light.
export function ScreenFlash({ active, color, view }: { active: boolean; color: FlashColor; view: RefObject<HTMLDivElement | null> }) {
  const [bounds, setBounds] = useState({ top: 0, left: 0, width: 0, height: 0 });
  useLayoutEffect(() => {
    if (!active) return;
    const measure = () => {
      const rect = view.current?.getBoundingClientRect();
      if (rect) setBounds({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [active, view]);
  return createPortal(<div className={`screen-flash ${active ? 'is-lit' : ''}`} aria-hidden="true" style={{ ...bounds, color: flashColors[color].color }} />, document.body);
}
