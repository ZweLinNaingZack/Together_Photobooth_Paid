import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layouts, filters, move, replaceShot, captureTargets, filterPixels } from '../src/booth/core.js';
import { captureSequence } from '../src/booth/capture.js';
import { cardDesigns } from '../src/booth/designs.ts';
import { renderCard, cardDimensions } from '../src/booth/renderCard.js';
import { musicTitles } from '../src/booth/musicTitle.js';

test('layout slots, capture counts and captions stay within their cards', () => {
  const separated = (a, b) => a.x + a.w <= b.x + 1e-9 || b.x + b.w <= a.x + 1e-9 || a.y + a.h <= b.y + 1e-9 || b.y + b.h <= a.y + 1e-9;
  for (const layout of Object.values(layouts)) {
    assert.equal(layout.count, layout.slots.length);
    for (const slot of layout.slots) {
      assert(slot.x >= 0 && slot.y >= 0 && slot.x + slot.w <= 1 && slot.y + slot.h <= 1);
      assert(separated(slot, layout.caption));
    }
    for (let a = 0; a < layout.count; a++) for (let b = a + 1; b < layout.count; b++) assert(separated(layout.slots[a], layout.slots[b]));
  }
});

test('photo order and targeted retakes preserve the other original photos', () => {
  const original = ['a', 'b', 'c', 'd'];
  assert.deepEqual(move(original, 3, 0), ['d', 'a', 'b', 'c']);
  assert.deepEqual(replaceShot(original, 1, 'replacement'), ['a', 'replacement', 'c', 'd']);
  assert.deepEqual(original, ['a', 'b', 'c', 'd']);
  assert.deepEqual(captureTargets(original, 4), []);
});

async function run({ seconds = 3, method = 'timer', retake = null, shots = ['kept'], count = 4, fail = false, cancel = false } = {}) {
  let now = 0, photos = [...shots];
  const times = [], controller = new AbortController();
  const promise = captureSequence({ shots, count, retake, method, seconds, signal: controller.signal,
    wait: async ms => { now += ms; if (cancel) controller.abort(); },
    takeShot: async () => { if (fail) throw new Error('Camera failed'); times.push(now); return `new-${times.length}`; },
    onShot: (index, photo) => { photos = replaceShot(photos, index, photo); }, onCountdown: () => {}, onTaking: () => {} });
  if (fail || cancel) await assert.rejects(promise); else await promise;
  return { photos, times };
}
for (const seconds of [3, 5, 7]) test(`${seconds}-second countdown runs before every remaining photo`, async () => {
  const result = await run({ seconds });
  assert.deepEqual(result.photos, ['kept', 'new-1', 'new-2', 'new-3']);
  assert.deepEqual(result.times, [seconds * 1000, seconds * 2000 + 500, seconds * 3000 + 1000]);
});
test('manual mode takes one photo immediately and full layouts take none', async () => {
  assert.deepEqual(await run({ method: 'manual' }), { photos: ['kept', 'new-1'], times: [0] });
  assert.deepEqual(await run({ shots: ['a', 'b', 'c', 'd'] }), { photos: ['a', 'b', 'c', 'd'], times: [] });
  for (const layout of Object.values(layouts)) assert.equal((await run({ shots: [], count: layout.count })).photos.length, layout.count);
});
test('failed/cancelled retakes leave every existing photo intact', async () => {
  const shots = ['a', 'b', 'c', 'd'];
  assert.deepEqual((await run({ shots, retake: 1 })).photos, ['a', 'new-1', 'c', 'd']);
  for (const options of [{ fail: true }, { cancel: true }]) assert.deepEqual((await run({ shots, retake: 1, ...options })).photos, shots);
});
test('leaving during an in-flight capture discards its late result', async () => {
  const controller = new AbortController(); let writes = 0;
  await assert.rejects(captureSequence({ shots: [], count: 1, retake: null, method: 'manual', seconds: 3, signal: controller.signal,
    takeShot: async () => { controller.abort(); return 'late-photo'; }, onShot: () => writes++, onCountdown: () => {}, onTaking: () => {} }));
  assert.equal(writes, 0);
});
test('twelve filters preserve alpha and vintage grain is repeatable', () => {
  assert.equal(Object.keys(filters).length, 12);
  const original = new Uint8ClampedArray(Array.from({ length: 200 }, () => [130, 110, 90, 255]).flat());
  for (const filter of Object.keys(filters)) {
    const pixels = original.slice(); filterPixels(pixels, filter, 17);
    if (filter === 'original') assert.deepEqual(pixels, original); else assert.notDeepEqual(pixels, original);
    for (let i = 3; i < pixels.length; i += 4) assert.equal(pixels[i], 255);
  }
  const a = original.slice(), b = original.slice(); filterPixels(a, 'vintage', 17); filterPixels(b, 'vintage', 17); assert.deepEqual(a, b);
});

test('all custom exports fill the canvas and draw the correct photo count', async () => {
  const previousDocument = globalThis.document, previousImage = globalThis.Image;
  const canvases = [];
  globalThis.Image = class { naturalWidth = 1440; naturalHeight = 960; set src(value) { this.source = value; queueMicrotask(() => this.onload()); } };
  globalThis.document = { fonts: { ready: Promise.resolve() }, createElement() {
    const calls = [], canvas = { width: 0, height: 0, calls, getContext: () => context };
    const context = { scale() {}, measureText: text => ({width:text.length*12}), fillText() {}, drawImage: (...args) => calls.push(args), fillRect() {}, save() {}, translate() {}, rotate() {}, restore() {}, beginPath() {}, roundRect() {}, clip() {}, moveTo() {}, lineTo() {}, closePath() {}, putImageData() {}, getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4).fill(255) }) };
    canvases.push(canvas); return canvas;
  } };
  try {
    assert.equal(Object.keys(cardDesigns).length, 71);
    assert(!cardDesigns['clapper-filmstrip']);
    for (const [template, design] of Object.entries(cardDesigns)) {
      const canvas = await renderCard({ layout: design.layout || 'A', template, shots: design.slots.map((_, i) => `photo${i}`), filter: 'original' });
      const expectedWidth = Math.max(layouts[design.layout || 'A'].width, Math.round(design.crop[2]));
      assert.equal(canvas.width, expectedWidth); assert.equal(canvas.height, Math.round(expectedWidth * design.crop[3] / design.crop[2]));
      assert.deepEqual(canvas.calls[0].slice(1), [...design.crop, 0, 0, canvas.width, canvas.height]);
      assert.equal(canvas.calls.length, design.slots.length + 1 + (musicTitles[template] ? 1 : 0), `${template} draws artwork, photos, and optional title background`);
      for (const call of canvas.calls.slice(1, design.slots.length + 1)) {
        const [, x, y, w, h] = call;
        assert(x >= 0 && y >= 0 && x + w <= canvas.width + 1 && y + h <= canvas.height + 1);
      }
    }
  } finally { globalThis.document = previousDocument; globalThis.Image = previousImage; }
});
