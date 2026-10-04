// Coordinates use each source artwork's pixel space, before cropping/scaling.
export const musicTitles = {
  'music-player-a': { x: 50, y: 1260, w: 500, h: 55, size: 42 },
  'music-player-b': { x: 50, y: 1260, w: 500, h: 55, size: 42 },
  'music-player-d': { x: 50, y: 1260, w: 1100, h: 55, size: 42 },
  'music-player-g': { x: 75, y: 742, w: 1650, h: 58, size: 48 },
  'music-player-c': { x: 58, y: 1920, w: 1580, h: 80, size: 72 },
  'music-player-e': { x: 58, y: 1920, w: 1580, h: 80, size: 72 },
  'music-player-k': { x: 1610, y: 995, w: 860, h: 80, size: 70 },
};
export function trackTitle(value) {
  return Array.from((value || '').trim()).slice(0, 60).join('') || 'Our little moment';
}
export function drawMusicTitle(ctx, art, design, key, value, scale, subtitle) {
  const region = musicTitles[key];
  if (!region) return;
  const { x, y, w, h } = region, [cx, cy] = design.crop;
  ctx.save();
  ctx.translate(-cx * scale, -cy * scale);
  ctx.scale(scale, scale);
  // Reuse the clean background immediately above the baked-in title. This
  // preserves the artwork's horizontal gradient without a solid-color patch.
  ctx.drawImage(art, x, y - 8, w, 2, x, y, w, h);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const title = trackTitle(value);
  let size = region.size;
  ctx.font = `700 ${size}px "DM Sans", sans-serif`;
  while (ctx.measureText(title).width > w && size > 16) ctx.font = `700 ${--size}px "DM Sans", sans-serif`;
  ctx.fillText(title, x, y + h / 2, w);
  const raster = ['music-player-c','music-player-e','music-player-k'].includes(key);
  const sy = key === 'music-player-k' ? 1080 : raster ? 2012 : key === 'music-player-g' ? 806 : 1320;
  const sh = raster ? 64 : 42;
  ctx.drawImage(art, x, sy + sh + 4, w, 2, x, sy, w, sh);
  ctx.fillStyle = '#999';
  const artist = Array.from((subtitle || '').trim()).slice(0,60).join('') || 'Together';
  size = Math.round(region.size * .7);
  ctx.font = `400 ${size}px "DM Sans", sans-serif`;
  while(ctx.measureText(artist).width > w && size > 12) ctx.font = `400 ${--size}px "DM Sans", sans-serif`;
  ctx.fillText(artist, x, sy + sh / 2, w);
  ctx.restore();
}
