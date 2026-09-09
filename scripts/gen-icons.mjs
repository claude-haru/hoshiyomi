// SVG アイコンから PWA / iOS 用の PNG を生成する。
// 外部依存なし（node:zlib で PNG を手組み）。`npm run icons` で実行。
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
function mix(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

// アイコン描画（icon.svg のデザインを近似したラスタライズ）
function render(size, maskable) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = size * 0.5;
  const cy = size * 0.5;
  const bgInner = [42, 35, 80];
  const bgOuter = [18, 16, 42];
  const moonInner = [255, 247, 230];
  const moonOuter = [231, 201, 143];
  const ringColor = [183, 167, 255];
  const scale = maskable ? 0.78 : 1; // マスカブルはセーフエリア内に収める
  const corner = size * 0.22;
  const moonCx = size * 0.5;
  const moonCy = size * 0.49;
  const moonR = size * 0.18 * scale;
  const ringR = size * 0.258 * scale;
  const stars = [
    [0.234, 0.234, 0.010],
    [0.781, 0.293, 0.008],
    [0.293, 0.742, 0.008],
    [0.766, 0.727, 0.012],
    [0.5, 0.168, 0.007],
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // 背景（角丸矩形の外は透明）
      const inRoundRect =
        x >= 0 && y >= 0 && x < size && y < size &&
        roundRectInside(x, y, size, size, corner);
      let r = 0, g = 0, b = 0, a = 0;
      if (inRoundRect) {
        const dr = Math.hypot(x - cx, y - cy * 0.76) / (size * 0.75);
        const bg = mix(bgInner, bgOuter, Math.min(1, dr));
        r = bg[0]; g = bg[1]; b = bg[2]; a = 255;

        // 星
        for (const [sx, sy, sr] of stars) {
          const d = Math.hypot(x - sx * size, y - sy * size);
          const rad = sr * size + 1.5;
          if (d < rad) {
            const t = 1 - d / rad;
            r = lerp(r, 255, t); g = lerp(g, 255, t); b = lerp(b, 255, t);
          }
        }

        // リング
        const dRing = Math.hypot(x - moonCx, y - moonCy);
        if (Math.abs(dRing - ringR) < size * 0.012) {
          const t = 0.55 * (1 - Math.abs(dRing - ringR) / (size * 0.012));
          r = lerp(r, ringColor[0], t); g = lerp(g, ringColor[1], t); b = lerp(b, ringColor[2], t);
        }

        // 月
        const dMoon = Math.hypot(x - moonCx, y - moonCy);
        if (dMoon < moonR) {
          const t = Math.min(1, dMoon / moonR);
          const m = mix(moonInner, moonOuter, t);
          // 三日月の影
          const shadow = Math.hypot(x - (moonCx + moonR * 0.42), y - moonCy) < moonR * 0.98;
          const edge = Math.min(1, (moonR - dMoon) / (size * 0.01));
          if (shadow) {
            r = lerp(r, bgOuter[0], 0.82 * edge);
            g = lerp(g, bgOuter[1], 0.82 * edge);
            b = lerp(b, bgOuter[2], 0.82 * edge);
          } else {
            r = lerp(r, m[0], edge); g = lerp(g, m[1], edge); b = lerp(b, m[2], edge);
          }
        }
      }
      rgba[i] = clamp(r); rgba[i + 1] = clamp(g); rgba[i + 2] = clamp(b); rgba[i + 3] = clamp(a);
    }
  }
  return encodePng(size, size, rgba);
}
function clamp(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}
function roundRectInside(x, y, w, h, r) {
  if (x < r && y < r) return Math.hypot(r - x, r - y) <= r;
  if (x > w - r && y < r) return Math.hypot(x - (w - r), r - y) <= r;
  if (x < r && y > h - r) return Math.hypot(r - x, y - (h - r)) <= r;
  if (x > w - r && y > h - r) return Math.hypot(x - (w - r), y - (h - r)) <= r;
  return true;
}

const targets = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-180.png', 180, false],
  ['icon-maskable-512.png', 512, true],
];
for (const [name, size, maskable] of targets) {
  writeFileSync(join(outDir, name), render(size, maskable));
  console.log('generated', name);
}
