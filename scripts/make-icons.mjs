// Renders the app icons from public/icons/icon.svg (run: npm run icons). Uses sharp, which the toolchain already
// installs; the PNGs are committed, so this only runs when the artwork changes.
// - icon-192 / icon-512: rounded corners (the "any" purpose shows the icon as drawn)
// - icon-512-maskable and apple-touch-icon: full bleed; the platform cuts its own shape
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const full = readFileSync(join(dir, 'icon.svg'), 'utf8');
const BG = '<rect width="512" height="512" fill="url(#bg)"/>';
if (!full.includes(BG)) throw new Error('icon.svg: background rect not found');
const rounded = full.replace(BG, '<rect width="512" height="512" rx="112" fill="url(#bg)"/>');

const out = [
  ['icon-192.png', rounded, 192],
  ['icon-512.png', rounded, 512],
  ['icon-512-maskable.png', full, 512],
  ['apple-touch-icon.png', full, 180],
];
for (const [name, svg, size] of out) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(join(dir, name));
  console.log('wrote', name);
}
