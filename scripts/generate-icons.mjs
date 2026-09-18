/**
 * Draws every launcher asset from the same geometry the board uses, so the icon and the
 * game are made of the same material. Run `npm run icons` after changing a token colour.
 *
 * The mark is three lanes on a descending stagger: Emerald filled to the brim, Vermilion
 * two deep, Sky holding one. That is the whole game in one glyph - colour being gathered
 * lane by lane - and it reads as a diagonal from the top left, the direction an eye
 * already travels.
 *
 * Three hues, not two: an earlier pass used a full green lane beside a single amber disc
 * and read unmistakably as a traffic light. Spreading the palette across the wheel and
 * breaking the symmetry removes the association entirely.
 *
 * No dependencies. Shapes are rasterised from signed distance fields (one-pixel
 * antialiasing band) rather than supersampled, so a 1024px sheet costs 16MB, not 500MB.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

// Mirrors src/design/tokens.ts. Both mirror DESIGN.md.
const BOARD = '#17161A';
const EMERALD = { fill: '#009E73', shade: '#007355' };
const VERMILION = { fill: '#D55E00', shade: '#A34700' };
const SKY = { fill: '#1A6FB5', shade: '#0E4E84' };
/** Recess (26% black) composited onto the board - a well cut INTO the felt. */
const LANE_FILL = '#111013';
/** The lane's printed edge: ink at 13% over that recess. Structure, never decoration. */
const LANE_EDGE = '#2D2D2F';

// ---------------------------------------------------------------- canvas

const hex = (s) => {
  const n = parseInt(s.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const canvas = (w, h) => ({ w, h, px: new Float32Array(w * h * 4) });

/** Straight-alpha source-over, restricted to the shape's bounding box. */
function paint(c, box, sdf, colour, alpha = 1) {
  const [r, g, b] = typeof colour === 'string' ? hex(colour) : colour;
  const x0 = Math.max(0, Math.floor(box[0]));
  const y0 = Math.max(0, Math.floor(box[1]));
  const x1 = Math.min(c.w, Math.ceil(box[2]));
  const y1 = Math.min(c.h, Math.ceil(box[3]));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const sa = sdf(x + 0.5, y + 0.5) * alpha;
      if (sa <= 0) continue;
      const i = (y * c.w + x) * 4;
      const da = c.px[i + 3];
      const oa = sa + da * (1 - sa);
      if (oa <= 0) continue;
      for (let k = 0; k < 3; k++) {
        const sc = k === 0 ? r : k === 1 ? g : b;
        c.px[i + k] = (sc * sa + c.px[i + k] * da * (1 - sa)) / oa;
      }
      c.px[i + 3] = oa;
    }
  }
}

const cov = (d) => Math.min(1, Math.max(0, 0.5 - d));

const circleSdf = (cx, cy, r) => (x, y) => Math.hypot(x - cx, y - cy) - r;

const roundRectSdf = (x, y, w, h, r) => (px, py) => {
  const qx = Math.abs(px - (x + w / 2)) - (w / 2 - r);
  const qy = Math.abs(py - (y + h / 2)) - (h / 2 - r);
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
};

// ---------------------------------------------------------------- the mark

/**
 * Proportions are expressed as multiples of a lane's width so the mark is resolution
 * independent: one number (`markW`) sets every other dimension.
 */
const LANE_PAD = 0.075; // felt visible around a disc inside its lane
const DISC = 1 - 2 * LANE_PAD; // 0.85
const SLOT_GAP = 0.09; // discs must read as separate pieces, not one poured bar
const LANE_GAP = 0.24;
const DEPTH = 3; // slots per lane
const LANE_H = 2 * LANE_PAD + DEPTH * DISC + (DEPTH - 1) * SLOT_GAP; // 2.88
/** How full each lane is, left to right. The stagger is the mark. */
const LANES = [
  { held: 3, colour: EMERALD },
  { held: 2, colour: VERMILION },
  { held: 1, colour: SKY },
];
const MARK_RATIO = (LANES.length + (LANES.length - 1) * LANE_GAP) / LANE_H;
/** A token is a flat fill with a 2px inset rim at 54pt: 3.7% of its diameter. */
const RIM = 0.037;

function drawMark(c, markW, { mono = false } = {}) {
  const laneW = markW / (LANES.length + (LANES.length - 1) * LANE_GAP);
  const laneH = laneW * LANE_H;
  const d = laneW * DISC;
  const x0 = (c.w - markW) / 2;
  const y0 = (c.h - laneH) / 2;

  const disc = (cx, cy, colour) => {
    const rim = d * RIM;
    const outer = circleSdf(cx, cy, d / 2);
    const inner = circleSdf(cx, cy, d / 2 - rim);
    const box = [cx - d, cy - d, cx + d, cy + d];
    if (mono) {
      paint(c, box, (x, y) => cov(outer(x, y)), '#FFFFFF');
      return;
    }
    paint(c, box, (x, y) => cov(outer(x, y)), colour.shade);
    paint(c, box, (x, y) => cov(inner(x, y)), colour.fill);
  };

  LANES.forEach((lane, i) => {
    const lx = x0 + i * laneW * (1 + LANE_GAP);
    const sdf = roundRectSdf(lx, y0, laneW, laneH, laneW / 2);
    const box = [lx - 4, y0 - 4, lx + laneW + 4, y0 + laneH + 4];
    const edge = Math.max(1, laneW * 0.024);
    if (mono) {
      paint(c, box, (x, y) => cov(Math.abs(sdf(x, y)) - edge / 2), '#FFFFFF', 0.4);
    } else {
      paint(c, box, (x, y) => cov(sdf(x, y)), LANE_FILL);
      paint(c, box, (x, y) => cov(Math.abs(sdf(x, y)) - edge / 2), LANE_EDGE);
    }

    // Discs stack up from the base, the way they actually settle on the board.
    const cx = lx + laneW / 2;
    const base = y0 + laneH - laneW * LANE_PAD - d / 2;
    for (let k = 0; k < lane.held; k++) {
      disc(cx, base - k * (d + laneW * SLOT_GAP), lane.colour);
    }
  });
}

// ---------------------------------------------------------------- png

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(c) {
  const raw = Buffer.alloc(c.h * (c.w * 4 + 1));
  let p = 0;
  for (let y = 0; y < c.h; y++) {
    raw[p++] = 0; // filter: none. The art is flat, so filtering buys almost nothing.
    for (let x = 0; x < c.w; x++) {
      const i = (y * c.w + x) * 4;
      const a = c.px[i + 3];
      for (let k = 0; k < 3; k++) raw[p++] = Math.round(c.px[i + k] * 255);
      raw[p++] = Math.round(a * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(c.w, 0);
  ihdr.writeUInt32BE(c.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour with alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- assets

/**
 * `fraction` is the mark's width as a share of the canvas. Android's adaptive mask can
 * crop to a circle inscribed in the 108dp canvas, so its foreground stays well inside.
 */
const sheets = [
  { file: 'icon.png', size: 1024, fraction: 0.84, ground: BOARD },
  { file: 'splash-icon.png', size: 1024, fraction: 0.74, ground: null },
  { file: 'favicon.png', size: 256, fraction: 0.88, ground: BOARD },
  { file: 'android-icon-background.png', size: 1024, fraction: 0, ground: BOARD },
  { file: 'android-icon-foreground.png', size: 1024, fraction: 0.68, ground: null },
  { file: 'android-icon-monochrome.png', size: 1024, fraction: 0.68, ground: null, mono: true },
  // Android tints a notification icon by its alpha channel alone, and asks for 96x96.
  // Lane edges fall below a pixel at this size, which is the behaviour DESIGN.md already
  // describes: the discs carry the mark on their own once it is small.
  { file: 'notification-icon.png', size: 96, fraction: 0.9, ground: null, mono: true },
];

for (const s of sheets) {
  const c = canvas(s.size, s.size);
  if (s.ground) paint(c, [0, 0, s.size, s.size], () => 1, s.ground);
  if (s.fraction > 0) drawMark(c, s.size * s.fraction, { mono: s.mono });
  const png = encodePng(c);
  writeFileSync(join(ASSETS, s.file), png);
  console.log(`${s.file.padEnd(32)} ${s.size}x${s.size}  ${(png.length / 1024).toFixed(1)} kB`);
}

console.log(`\nmark aspect ${MARK_RATIO.toFixed(3)} (w/h)`);
