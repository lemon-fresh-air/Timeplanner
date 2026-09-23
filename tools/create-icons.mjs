import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';

function crc32(data) {
  let value = 0xffffffff;
  for (const byte of data) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
  }
  return (value ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function makeIcon(size) {
  const data = Buffer.alloc((size * 4 + 1) * size);
  const put = (x, y, color) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const offset = y * (size * 4 + 1) + 1 + x * 4;
    data.set(color, offset);
  };
  const fillRoundRect = (x, y, width, height, radius, color) => {
    for (let py = y; py < y + height; py += 1) for (let px = x; px < x + width; px += 1) {
      const dx = Math.max(x + radius - px, 0, px - (x + width - radius - 1));
      const dy = Math.max(y + radius - py, 0, py - (y + height - radius - 1));
      if (dx * dx + dy * dy <= radius * radius) put(px, py, color);
    }
  };
  const circle = (cx, cy, radius, color) => {
    for (let py = cy - radius; py <= cy + radius; py += 1) for (let px = cx - radius; px <= cx + radius; px += 1) {
      if ((px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2) put(px, py, color);
    }
  };
  const bg = [242, 241, 237, 255], ink = [23, 22, 15, 255], accent = [38, 130, 113, 255], light = [255, 255, 255, 255];
  for (let y = 0; y < size; y += 1) { data[y * (size * 4 + 1)] = 0; for (let x = 0; x < size; x += 1) put(x, y, bg); }
  const card = Math.round(size * 0.15), cardSize = size - card * 2, r = Math.round(size * 0.12);
  fillRoundRect(card, card, cardSize, cardSize, r, ink);
  fillRoundRect(card + Math.round(size * .07), card + Math.round(size * .20), cardSize - Math.round(size * .14), Math.round(size * .08), Math.round(size * .04), light);
  circle(Math.round(size * .67), Math.round(size * .67), Math.round(size * .20), accent);
  const cx = Math.round(size * .67), cy = Math.round(size * .67), width = Math.max(3, Math.round(size * .035));
  for (let i = 0; i < Math.round(size * .11); i += 1) for (let w = -width; w <= width; w += 1) { put(cx + w, cy - i, light); put(cx + i, cy + w, light); }
  const raw = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', Buffer.from([size >>> 24, size >>> 16, size >>> 8, size, size >>> 24, size >>> 16, size >>> 8, size, 8, 6, 0, 0, 0])), chunk('IDAT', deflateSync(data)), chunk('IEND', Buffer.alloc(0))]);
  return raw;
}

await mkdir('icons', { recursive: true });
await Promise.all([192, 512].map((size) => writeFile(`icons/icon-${size}.png`, makeIcon(size))));
console.log('Created PWA icons.');
