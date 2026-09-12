// Genera los iconos PNG de la PWA (public/icons/) sin dependencias externas:
// dibuja una portada de libro roja centrada (color de sello editorial de la
// marca) sobre fondo papel, dentro de la zona segura para iconos "maskable".
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PAPER = [251, 250, 246];
const STAMP = [163, 49, 31];
const INK = [23, 24, 28];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function pixelAt(x, y, size) {
  const cx = size / 2;
  const cy = size / 2;
  const bw = size * 0.58;
  const bh = size * 0.82;
  const left = cx - bw / 2;
  const right = cx + bw / 2;
  const top = cy - bh / 2;
  const bottom = cy + bh / 2;
  const spine = left + bw * 0.16;

  if (x >= left && x < right && y >= top && y < bottom) {
    if (x < spine) return INK;
    return STAMP;
  }
  return PAPER;
}

function buildPNG(size) {
  const rowSize = 1 + size * 3;
  const raw = Buffer.alloc(rowSize * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * rowSize;
    raw[rowStart] = 0; // filtro "None"
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixelAt(x, y, size);
      const off = rowStart + 1 + x * 3;
      raw[off] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // profundidad de bits
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

[192, 512].forEach((size) => {
  const png = buildPNG(size);
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), png);
  console.log(`Generado public/icons/icon-${size}.png (${png.length} bytes)`);
});
