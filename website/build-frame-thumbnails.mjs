import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { templateCatalog } from './src/booth/templateCatalog.js';

// Run after adding artwork: node build-frame-thumbnails.mjs [sharp module path]
const sharp = createRequire(import.meta.url)(process.argv[2] || 'sharp');
const exports = {};
const source = await readFile(new URL('./src/booth/designs.ts', import.meta.url), 'utf8');
runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
  { exports, require: () => ({ templateCatalog }) });
const root = new URL('./public/', import.meta.url);
await mkdir(new URL('frames/thumbs/', root), { recursive: true });
let total = 0;
for (const [key, design] of Object.entries(exports.cardDesigns)) {
  const [left, top, width, height] = design.crop.map(Math.round);
  const info = await sharp(await readFile(new URL(design.src.slice(1), root)))
    .extract({ left, top, width, height }).resize({ width: 220, height: 260, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 76 }).toFile(fileURLToPath(new URL(`frames/thumbs/${key}.webp`, root)));
  total += info.size;
}
console.log(`${Object.keys(exports.cardDesigns).length} thumbnails: ${Math.round(total / 1024)} KiB total`);
