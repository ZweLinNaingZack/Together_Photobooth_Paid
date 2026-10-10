import { t, type Key } from './index';

// Layout names and notes come from booth/core.js in English. These helpers show them
// in the current language without changing core.js (its ids are saved in people's drafts).

/** "Layout A" → "Layout A" / "Layout A" in Burmese or Vietnamese words; "Newspaper" is translated. */
export function layoutName(layout: { name: string }) {
  return layout.name === 'Newspaper' ? t('layout.newspaper') : t('layout.name', { id: layout.name.replace('Layout ', '') });
}

/** "2 × 6 in · 3 photos" in the current language. */
export function layoutNote(layout: { width: number; count: number }) {
  const size = layout.width === 600 ? '2 × 6' : layout.width === 1200 ? '4 × 6' : '6 × 4';
  return t(layout.count === 1 ? 'layout.noteOne' : 'layout.note', { size, n: layout.count });
}

/** The little description under each layout, e.g. "Three little moments". */
export function layoutLabel(id: string) {
  return t(`layout.label.${id}` as Key);
}
