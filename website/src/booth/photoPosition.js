export const clampOffset = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : .5;
export function coverCrop(iw, ih, w, h, offset = {}) {
  const scale = Math.max(w / iw, h / ih), sw = Math.min(iw, w / scale), sh = Math.min(ih, h / scale);
  return { x: (iw - sw) * clampOffset(offset.x), y: (ih - sh) * clampOffset(offset.y), w: sw, h: sh, scale };
}
export function panOffset(offset, dx, dy, iw, ih, w, h) {
  const { scale } = coverCrop(iw, ih, w, h);
  const extraX = iw * scale - w, extraY = ih * scale - h;
  return { x: extraX > .001 ? clampOffset(clampOffset(offset?.x) - dx / extraX) : clampOffset(offset?.x), y: extraY > .001 ? clampOffset(clampOffset(offset?.y) - dy / extraY) : clampOffset(offset?.y) };
}
export function reconcileOffsets(oldShots, offsets = [], newShots) {
  const used = new Set();
  return newShots.map(shot => {
    const index = oldShots.findIndex((old, i) => old === shot && !used.has(i));
    if (index < 0) return { x: .5, y: .5 };
    used.add(index); return offsets[index] || { x: .5, y: .5 };
  });
}
