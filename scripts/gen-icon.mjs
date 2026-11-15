/**
 * Generates the AcidMade app icon (a beaker mark on the acid gradient) as PNG
 * files, with no image dependencies. Run `npm run icon` after changing it.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const SIZES = [16, 32, 48, 64, 128, 256, 512, 1024];

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let k = 0; k < 8; k += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[n] = value;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0;
    pixels.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function insideTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNegative && hasPositive);
}

function roundedSquare(x, y, size) {
  const radius = size * 0.22;
  const inset = size * 0.04;
  const min = inset;
  const max = size - inset;
  const cx = Math.min(Math.max(x, min + radius), max - radius);
  const cy = Math.min(Math.max(y, min + radius), max - radius);
  return Math.hypot(x - cx, y - cy) <= radius;
}

function beaker(x, y, size) {
  const s = size / 1024;
  const neckLeft = 438 * s;
  const neckRight = 586 * s;
  const neckTop = 214 * s;
  const shoulder = 420 * s;

  const inNeck =
    x >= neckLeft && x <= neckRight && y >= neckTop && y <= shoulder;

  const bodyTop = shoulder;
  const bodyBottom = 806 * s;
  const topHalf = (neckRight - neckLeft) / 2;
  const bottomHalf = 268 * s;
  const center = (neckLeft + neckRight) / 2;

  let half = 0;
  const inBody = y >= bodyTop && y <= bodyBottom;
  if (inBody) {
    const t = (y - bodyTop) / (bodyBottom - bodyTop);
    half = topHalf + (bottomHalf - topHalf) * t;
  }

  if (!inNeck && !inBody) return false;
  if (inBody && Math.abs(x - center) > half) return false;

  // Fill line: a slot that stops short of the glass walls.
  const liquidTop = 628 * s;
  const liquidBottom = 668 * s;
  const slot = y >= liquidTop && y <= liquidBottom && Math.abs(x - center) < half * 0.8;

  return !slot;
}

function draw(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const samples = 3;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let plate = 0;
      let mark = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = x + (sx + 0.5) / samples;
          const py = y + (sy + 0.5) / samples;
          if (!roundedSquare(px, py, size)) continue;
          plate += 1;
          if (beaker(px, py, size)) mark += 1;
        }
      }
      const total = samples * samples;
      if (plate === 0) continue;

      const coverage = plate / total;
      const markRatio = mark / total;
      const t = (x / size) * 0.55 + (y / size) * 0.45;
      const r = Math.round(204 - 78 * t);
      const g = Math.round(255 - 42 * t);
      const b = Math.round(0 + 40 * t);

      const ink = 10 + 2 * t;
      const mix = Math.min(1, markRatio / Math.max(coverage, 0.0001));
      const blend = (light, dark) => Math.round(light * (1 - mix) + dark * mix);

      const offset = (y * size + x) * 4;
      pixels[offset] = blend(r, ink);
      pixels[offset + 1] = blend(g, ink + 2);
      pixels[offset + 2] = blend(b, ink);
      pixels[offset + 3] = Math.round(255 * coverage);
    }
  }

  return encodePng(size, pixels);
}

mkdirSync(path.join(root, "build", "icons"), { recursive: true });
for (const size of SIZES) {
  const buffer = draw(size);
  writeFileSync(path.join(root, "build", "icons", size + "x" + size + ".png"), buffer);
  if (size === 1024) writeFileSync(path.join(root, "build", "icon.png"), buffer);
}
console.log("[acidmade] wrote build/icon.png and " + SIZES.length + " icon sizes");
