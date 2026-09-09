#!/usr/bin/env node
/**
 * Generate build/icon.png for electron-builder.
 *
 * electron-builder wants a square PNG of at least 512x512 in `buildResources`
 * and derives the .ico / .icns from it. The repo has no such asset:
 * client/logo.svg is a 14x14 white-stroke chevron (invisible on a light
 * installer background) and client/apple-touch-icon.png is 180x180. This
 * upscales the touch icon onto the brand background — replace build/icon.png
 * with a real 1024x1024 export whenever one exists and this script will leave
 * it alone (it only writes when the output is missing or older than the
 * source).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'build', 'icon.png');

const SOURCES = [
  path.join(root, 'build', 'icon-source.png'),   // hand-authored, if present
  path.join(root, 'client', 'apple-touch-icon.png'),
  path.join(root, 'client', 'public', 'apple-touch-icon.png'),
];

const src = SOURCES.find((p) => fs.existsSync(p));
if (!src) {
  console.error('[icons] No source image found. Looked in:\n  ' + SOURCES.join('\n  '));
  process.exit(1);
}

if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs) {
  console.log(`[icons] ${path.relative(root, out)} is up to date.`);
  process.exit(0);
}

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('[icons] sharp is not installed — run `npm install`.');
  process.exit(1);
}

const SIZE = 1024;
const PAD = Math.round(SIZE * 0.12);

fs.mkdirSync(path.dirname(out), { recursive: true });

const glyph = await sharp(src)
  .resize(SIZE - PAD * 2, SIZE - PAD * 2, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer();

await sharp({
  create: { width: SIZE, height: SIZE, channels: 4, background: { r: 250, g: 248, b: 245, alpha: 1 } },
})
  .composite([{ input: glyph, top: PAD, left: PAD }])
  .png()
  .toFile(out);

const { size } = fs.statSync(out);
console.log(`[icons] Wrote ${path.relative(root, out)} (${SIZE}x${SIZE}, ${(size / 1024).toFixed(0)} KB) from ${path.relative(root, src)}`);
