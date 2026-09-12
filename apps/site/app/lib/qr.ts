/**
 * A QR code, just big enough for a short URL.
 *
 * The share card (lib/shareCard.ts) needs one thing a scanner can read: the site's address, printed
 * on an image someone posts. That is twenty-odd characters, which is the smallest job a QR code can
 * be given, so this encodes byte mode at error-correction level M for versions 1 to 6 (up to 106
 * characters) and nothing else. No alphanumeric or kanji modes, no ECI, no structured append, no
 * renderer: it returns the module matrix and the card paints it.
 *
 * Written here rather than installed because the alternative is a dependency in the client bundle
 * for one 21-character string, and because the encoder is small when it only has to do this much.
 * It is a faithful implementation of ISO/IEC 18004 for the part it covers, and the shape of it
 * follows Nayuki's reference generator, which is the clearest description of the placement rules in
 * public. Verified against the `qrcode` package's matrices for every mask, every version here and a
 * range of inputs (scripts/qr-check.mjs).
 */

/* ── GF(256) ──────────────────────────────────────────────────────────────
   The field QR codes do their Reed-Solomon arithmetic in: bytes, added with XOR and multiplied
   modulo x^8 + x^4 + x^3 + x^2 + 1 (0x11D). Log and antilog tables turn multiplication into an
   addition of exponents, which is the only reason this is fast enough to do on every draw. */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  // Doubled, so a sum of two exponents never needs a modulo.
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

const mul = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** The generator polynomial for `n` error-correction codewords: the product of (x - a^i), i < n. */
function generator(n: number): Uint8Array {
  let g = new Uint8Array([1]);
  for (let i = 0; i < n; i++) {
    const next = new Uint8Array(g.length + 1);
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j];
      next[j + 1] ^= mul(g[j], EXP[i]);
    }
    g = next;
  }
  return g;
}

/** The `n` error-correction codewords for one block: the remainder of the data divided by the generator. */
function remainder(data: Uint8Array, n: number): Uint8Array {
  const g = generator(n);
  const buf = new Uint8Array(data.length + n);
  buf.set(data);
  for (let i = 0; i < data.length; i++) {
    const factor = buf[i];
    if (factor === 0) continue;
    // g[0] is 1, so this step always clears buf[i] and walks the divisor along.
    for (let j = 0; j < g.length; j++) buf[i + j] ^= mul(g[j], factor);
  }
  return buf.slice(data.length);
}

/* ── the versions this covers ─────────────────────────────────────────────
   Level M only. `total` is every codeword in the symbol, `ecc` the error-correction codewords per
   block, `blocks` how many blocks the data is split into. Data codewords = total - ecc * blocks,
   and byte-mode capacity is two fewer than that (four bits of mode, eight of length). */

interface Version {
  total: number;
  ecc: number;
  blocks: number;
}

const VERSIONS: Version[] = [
  { total: 26, ecc: 10, blocks: 1 }, //  1 ·  14 characters
  { total: 44, ecc: 16, blocks: 1 }, //  2 ·  26
  { total: 70, ecc: 26, blocks: 1 }, //  3 ·  42
  { total: 100, ecc: 18, blocks: 2 }, // 4 ·  62
  { total: 134, ecc: 24, blocks: 2 }, // 5 ·  84
  { total: 172, ecc: 16, blocks: 4 }, // 6 · 106
];

/** Where the alignment patterns sit, by version. One extra centre past version 1, always at the far corner. */
const ALIGN = [0, 18, 22, 26, 30, 34];

const dataCodewords = (v: Version) => v.total - v.ecc * v.blocks;

/* ── the symbol ───────────────────────────────────────────────────────────── */

export interface QrMatrix {
  /** Modules per side, not counting the quiet zone the caller must leave around it. */
  size: number;
  /** One byte per module, row-major: 1 is dark. */
  modules: Uint8Array;
  /** 1 to 6. */
  version: number;
  /** Which of the eight masks was applied. */
  mask: number;
}

/**
 * Encode `text` as a QR code at error-correction level M.
 *
 * Throws when the text is longer than a version 6 symbol holds (106 bytes of UTF-8), which for this
 * card means someone has pointed it at a URL far longer than a site address. Pass `mask` to force
 * one of the eight mask patterns; left out, every mask is scored by the standard's four penalty
 * rules and the best one is used, which is what makes the finder patterns easy to lock onto.
 */
export function qrEncode(text: string, mask?: number): QrMatrix {
  const bytes = new TextEncoder().encode(text);
  const index = VERSIONS.findIndex((v) => bytes.length <= dataCodewords(v) - 2);
  if (index < 0) throw new Error(`qr: ${bytes.length} bytes is more than the largest supported symbol holds (${dataCodewords(VERSIONS[VERSIONS.length - 1]) - 2})`);
  const version = index + 1;
  const spec = VERSIONS[index];

  const codewords = interleave(payload(bytes, spec), spec);
  const size = version * 4 + 17;

  if (mask !== undefined) {
    const m = plot(version, size, codewords, mask);
    return { size, modules: m.modules, version, mask };
  }

  let best: { modules: Uint8Array; score: number; mask: number } | null = null;
  for (let candidate = 0; candidate < 8; candidate++) {
    const m = plot(version, size, codewords, candidate);
    const score = penalty(m.modules, size);
    if (!best || score < best.score) best = { modules: m.modules, score, mask: candidate };
  }
  return { size, modules: best!.modules, version, mask: best!.mask };
}

/** Mode, length, data, terminator and padding: the data codewords, before they are split into blocks. */
function payload(bytes: Uint8Array, spec: Version): Uint8Array {
  const capacity = dataCodewords(spec);
  const out = new Uint8Array(capacity);
  let bit = 0;
  const put = (value: number, width: number) => {
    for (let i = width - 1; i >= 0; i--) {
      if ((value >> i) & 1) out[bit >> 3] |= 0x80 >> (bit & 7);
      bit++;
    }
  };

  put(0b0100, 4); // byte mode
  put(bytes.length, 8); // the character count is eight bits wide below version 10
  for (const b of bytes) put(b, 8);
  // Terminator, then up to seven bits to the next byte boundary. Both are zeroes, which `out`
  // already holds, so only the cursor moves.
  bit = Math.min(bit + 4, capacity * 8);
  bit = (bit + 7) & ~7;
  // The standard's pad bytes, alternating, for whatever is left.
  for (let i = bit >> 3, pad = 0; i < capacity; i++, pad++) out[i] = pad % 2 === 0 ? 0xec : 0x11;
  return out;
}

/**
 * Split the data into blocks, add each block's error correction, and interleave both.
 *
 * A symbol's codewords are read one from each block in turn so that a scratch across the print
 * damages a little of every block rather than all of one. Blocks are equal length at every version
 * here, but the standard's uneven split is implemented anyway: the longer blocks come last, and the
 * interleave skips a short block once it is exhausted.
 */
function interleave(data: Uint8Array, spec: Version): Uint8Array {
  const short = Math.floor(data.length / spec.blocks);
  const long = data.length % spec.blocks; // how many blocks carry one extra codeword

  const blocks: Uint8Array[] = [];
  const checks: Uint8Array[] = [];
  for (let i = 0, at = 0; i < spec.blocks; i++) {
    const length = short + (i >= spec.blocks - long ? 1 : 0);
    const block = data.subarray(at, at + length);
    at += length;
    blocks.push(block);
    checks.push(remainder(block, spec.ecc));
  }

  const out = new Uint8Array(spec.total);
  let at = 0;
  for (let i = 0; i < short + (long > 0 ? 1 : 0); i++) for (const b of blocks) if (i < b.length) out[at++] = b[i];
  for (let i = 0; i < spec.ecc; i++) for (const c of checks) out[at++] = c[i];
  return out;
}

/* ── placement ────────────────────────────────────────────────────────────── */

interface Plot {
  modules: Uint8Array;
  /** 1 where a module belongs to a function pattern and must not carry data or be masked. */
  fixed: Uint8Array;
}

/** The whole symbol at one mask: function patterns, data, and the format information that names the mask. */
function plot(version: number, size: number, codewords: Uint8Array, mask: number): Plot {
  const modules = new Uint8Array(size * size);
  const fixed = new Uint8Array(size * size);
  const set = (row: number, col: number, dark: boolean) => {
    modules[row * size + col] = dark ? 1 : 0;
    fixed[row * size + col] = 1;
  };

  // Finders, with the light separator that rings each one.
  for (const [row, col] of [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ]) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const y = row + r;
        const x = col + c;
        if (y < 0 || y >= size || x < 0 || x >= size) continue;
        // Rings out from the centre: 0 and 1 are the core, 2 the light gap, 3 the border, and 4 the
        // separator that must stay light so the finder has clear air around it.
        const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
        set(y, x, ring <= 3 && ring !== 2);
      }
    }
  }

  // Alignment: one pattern at the far corner from version 2 up. The other three centres of the
  // (6, k) grid land on finders and are skipped.
  if (version >= 2) {
    const k = ALIGN[version - 1];
    for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) set(k + r, k + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);
  }

  // Timing: the dotted rule that tells a scanner the module pitch.
  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  // The format information's two copies, and the one module that is always dark.
  const format = formatBits(mask);
  for (let i = 0; i <= 5; i++) set(i, 8, ((format >> i) & 1) === 1);
  set(7, 8, ((format >> 6) & 1) === 1);
  set(8, 8, ((format >> 7) & 1) === 1);
  set(8, 7, ((format >> 8) & 1) === 1);
  for (let i = 9; i < 15; i++) set(8, 14 - i, ((format >> i) & 1) === 1);
  for (let i = 0; i < 8; i++) set(8, size - 1 - i, ((format >> i) & 1) === 1);
  for (let i = 8; i < 15; i++) set(size - 15 + i, 8, ((format >> i) & 1) === 1);
  set(size - 8, 8, true);

  // The data, in the standard's zigzag: two columns at a time from the bottom right, upward then
  // downward, skipping the vertical timing column. Each module is masked as it is placed.
  let bit = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const col = right - j;
        const upward = ((right + 1) & 2) === 0;
        const row = upward ? size - 1 - vert : vert;
        const at = row * size + col;
        if (fixed[at]) continue;
        let dark = bit < codewords.length * 8 ? ((codewords[bit >> 3] >> (7 - (bit & 7))) & 1) === 1 : false;
        bit++;
        if (masked(mask, row, col)) dark = !dark;
        modules[at] = dark ? 1 : 0;
      }
    }
  }

  return { modules, fixed };
}

/**
 * The fifteen bits that tell a scanner the error-correction level and the mask.
 *
 * Level M is `00`, then the three mask bits, then ten bits of BCH(15, 5) remainder under the
 * generator 0x537, and the lot is XORed with 0x5412 so an all-zero format is still readable.
 */
function formatBits(mask: number): number {
  const data = (0b00 << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) * 0x537);
  return ((data << 10) | (rem & 0x3ff)) ^ 0x5412;
}

/** The eight mask patterns, by row and column. True inverts the module. */
function masked(mask: number, row: number, col: number): boolean {
  switch (mask) {
    case 0:
      return (row + col) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return col % 3 === 0;
    case 3:
      return (row + col) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5:
      return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6:
      return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    default:
      return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
  }
}

/* ── choosing a mask ──────────────────────────────────────────────────────── */

const N1 = 3;
const N2 = 3;
const N3 = 40;
const N4 = 10;

/** The finder-like run a scanner must not meet in the data, and its mirror. */
const FINDER = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];

/**
 * The standard's four penalty rules, lower being better: long runs of one colour, solid two by two
 * blocks, anything that looks like a finder pattern, and an overall imbalance of dark to light.
 * They exist so the chosen mask leaves a symbol a camera can lock onto.
 */
function penalty(modules: Uint8Array, size: number): number {
  let score = 0;
  const at = (row: number, col: number) => modules[row * size + col];

  // Rules 1 and 3, along both axes.
  for (let axis = 0; axis < 2; axis++) {
    for (let a = 0; a < size; a++) {
      let run = 1;
      const read = (b: number) => (axis === 0 ? at(a, b) : at(b, a));
      for (let b = 1; b < size; b++) {
        if (read(b) === read(b - 1)) {
          run++;
          continue;
        }
        if (run >= 5) score += N1 + (run - 5);
        run = 1;
      }
      if (run >= 5) score += N1 + (run - 5);

      for (let b = 0; b + FINDER.length <= size; b++) {
        let hit = true;
        for (let k = 0; k < FINDER.length && hit; k++) hit = read(b + k) === FINDER[k];
        if (hit) score += N3;
        hit = true;
        for (let k = 0; k < FINDER.length && hit; k++) hit = read(b + k) === FINDER[FINDER.length - 1 - k];
        if (hit) score += N3;
      }
    }
  }

  // Rule 2: every two by two square of one colour.
  for (let row = 0; row + 1 < size; row++) {
    for (let col = 0; col + 1 < size; col++) {
      const v = at(row, col);
      if (v === at(row, col + 1) && v === at(row + 1, col) && v === at(row + 1, col + 1)) score += N2;
    }
  }

  // Rule 4: how far the proportion of dark modules strays from half, in steps of five points.
  let dark = 0;
  for (const m of modules) dark += m;
  const total = size * size;
  score += N4 * Math.floor(Math.abs((dark * 100) / total - 50) / 5);

  return score;
}
