// Writes placeholder PNG icons (solid background, accent square) to public/icons.
// Replace with real artwork later; this only exists so the install check has icons.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'public', 'icons');

const BG = [0x11, 0x14, 0x18];
const FG = [0x5b, 0xd1, 0xa3];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

// size x size, accent square covering `inset` fraction on each side.
function png(size, inset) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const lo = Math.round(size * inset);
  const hi = size - lo;
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const on = x >= lo && x < hi && y >= lo && y < hi;
      const px = on ? FG : BG;
      raw[row + 1 + x * 3] = px[0];
      raw[row + 2 + x * 3] = px[1];
      raw[row + 3 + x * 3] = px[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'icon-192.png'), png(192, 0.25));
writeFileSync(join(outDir, 'icon-512.png'), png(512, 0.25));
writeFileSync(join(outDir, 'icon-512-maskable.png'), png(512, 0.35));
writeFileSync(join(outDir, 'apple-touch-icon.png'), png(180, 0.25));
console.log('icons written to', outDir);
