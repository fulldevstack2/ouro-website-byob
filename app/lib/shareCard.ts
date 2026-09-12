import { tracePoints, traceStep, type Family } from "~/lib/guilloche";
import { qrEncode, type QrMatrix } from "~/lib/qr";
import { site } from "~/content/site";

/* ────────────────────────────────────────────────────────────────────────────
   The share card: one wallet's airdrops, as an image someone can post.

   Painted straight onto a canvas rather than built as DOM and screenshotted, for three reasons.
   What is on screen in the dialog IS the file that gets saved, pixel for pixel, so there is no
   second rendering path to keep in step. It needs no library (the alternatives all inline the page's
   CSS and re-implement layout). And the guilloché is already canvas work, so the plate that makes
   this look like an Ouro document comes from the same maths as the one on the home page.

   The design follows the site: the warm ground, a white sheet on it, the wordmark in the display
   serif, figures in mono, bronze for the accents, and the engraved plate as a watermark. Colours are
   written out here rather than read from CSS custom properties, because the card must come out the
   same whatever page painted it, and because a canvas cannot resolve a var() anyway. They mirror
   app/styles/tokens/colors.css; change them there and here together.

   WHAT THE CODE OPENS. This wallet's own portfolio page, /portfolio/?address=…, which is the point
   of the card: whoever scans it sees every payout the wallet has received, read from the chain in
   front of them. That is an owner's decision of 2026-09-11 and it reverses the earlier one, so the
   address IS on the card, printed beside the code as well as encoded in it. A card that quietly
   carried an address it did not name would be the worse of the two.

   WHAT IS STILL NOT ON IT BY DEFAULT. The wallet balance, the QR and the printed wallet address are
   each offered behind a toggle in the dialog rather than assumed — a holder may want the figures
   without handing out a scannable link. Vault deposits and claimable vault rewards print when the
   portfolio has them (otherwise a card that only says "short of the line" looks empty). And the
   "at the current rate" projection stays off entirely, because a figure the monitor currently
   overstates has no business on an image that travels without the page's caveats.
   ──────────────────────────────────────────────────────────────────────────── */

/** 4:5. The tallest shape X shows without cropping, and it is not cropped anywhere else either. */
export const SHARE_CARD = { width: 1080, height: 1350 } as const;

const INK = "#1B1710";
const SECONDARY = "#5C5447";
const MUTED = "#756C5E";
const FAINT = "#7A7163";
const PAPER = "#FFFFFF";
const GROUND = "#EEEBE5";
const TINT = "#F6F3ED";
const HAIRLINE = "#E2DBCF";
const BRONZE = "#86641F";
const BRONZE_DEEP = "#6A4E19";
const GREEN_INK = "#0C2C1D";
const TONES = {
  positive: { bg: "#EEF5F0", line: "#D8EADD", ink: "#175435" },
  caution: { bg: "#FBF5E4", line: "#F4E8CC", ink: "#7A5200" },
  negative: { bg: "#FAEFEC", line: "#F5DDD7", ink: "#8F3120" },
} as const;

const SERIF = `"Source Serif 4", Georgia, "Times New Roman", serif`;
const SANS = `"Public Sans", -apple-system, "Segoe UI", Helvetica, sans-serif`;
const MONO = `"JetBrains Mono", "SF Mono", Menlo, monospace`;

/** Every face the card sets, so they can be waited for before the first paint. */
export const SHARE_CARD_FONTS = [
  `600 54px ${SERIF}`,
  `italic 400 24px ${SERIF}`,
  `400 27px ${SANS}`,
  `600 30px ${SANS}`,
  `700 150px ${MONO}`,
  `400 19px ${MONO}`,
  `500 25px ${MONO}`,
  `600 30px ${MONO}`,
];

export interface ShareCardRow {
  label: string;
  value: string;
}

export interface ShareCardData {
  /** Over the figure, in tracked caps. */
  kicker: string;
  /** The figure itself, already formatted. */
  hero: string;
  /** One line under it, saying what the figure is. */
  sub: string;
  badge?: { text: string; tone: keyof typeof TONES };
  /** When the figures were read, top right. A running total on an undated card is a claim with no date on it. */
  stamp: string;
  /** Up to four; the block packs from the top, so a hidden Holding row does not leave a blank slot. */
  rows: ShareCardRow[];
  /** Under the rows, in two lines at most. What the figure does and does not claim. */
  footnote: string;
  /** The panel along the foot: what a reader should do, what the code opens, and the URL it encodes. */
  cta: {
    caps: string;
    line: string;
    /** Site origin without scheme, e.g. "ourolayer.com". */
    site: string;
    /** Short wallet address printed on the card (toggleable in the dialog). */
    address: string;
    href: string;
  };
}

/** What the share dialog can hide on the painted card. Defaults keep today's behaviour. */
export interface ShareCardOptions {
  showQr?: boolean;
  showAddress?: boolean;
}

/* ── the sheet ────────────────────────────────────────────────────────────── */

const MARGIN = 40;
const PAD = 64;
const SHEET = { x: MARGIN, y: MARGIN, w: SHARE_CARD.width - MARGIN * 2, h: SHARE_CARD.height - MARGIN * 2, r: 28 };
const LEFT = SHEET.x + PAD;
const RIGHT = SHEET.x + SHEET.w - PAD;
const CONTENT = RIGHT - LEFT;
/** The figure and its line stop here, short of the plate watermark on the right. */
const TEXT_WIDTH = 590;

const HEADER_BASE = 152;
/** The two right-hand lines straddle the wordmark's baseline rather than sitting on it. */
const HEADER_META = 138;
const HEADER_STAMP = 172;
const HEADER_RULE = 200;
const KICKER_BASE = 282;
const HERO_BASE = 432;
const SUB_BASE = 494;
const BADGE_TOP = 532;
const BADGE_H = 52;
/** At most four rows (optional wallet balance plus three). Pack from the top so a hidden row does not leave a blank slot. */
const ROW_H = 84;
const ROWS_TOP = BADGE_TOP + BADGE_H + 40;
const ROWS_MAX = 4;
const FOOTNOTE_BASE = ROWS_TOP + ROWS_MAX * ROW_H + 52;
const FOOTNOTE_LEAD = 32;
/** The plate is banded between the header rule and the figures, the way a certificate panels its engraving. */
const PLATE_BAND_BOTTOM = 600;
const BAND_TOP = 1070;
/** The code carries a whole URL and an address now, so it is denser: bigger, or it stops scanning. */
const QR_BOX = 216;

/**
 * Paint the card. The context must be 1080 by 1350 device pixels and the fonts already loaded
 * (SHARE_CARD_FONTS); a face that is not in yet falls back to a system one and the card comes out
 * looking like a different product.
 */
export function drawShareCard(ctx: CanvasRenderingContext2D, data: ShareCardData, options: ShareCardOptions = {}): void {
  const showQr = options.showQr !== false;
  const showAddress = options.showAddress !== false;

  ctx.save();
  ctx.clearRect(0, 0, SHARE_CARD.width, SHARE_CARD.height);

  // The ground the sheet sits on, the same warm grey as the page.
  ctx.fillStyle = GROUND;
  ctx.fillRect(0, 0, SHARE_CARD.width, SHARE_CARD.height);

  // The sheet.
  roundRect(ctx, SHEET.x, SHEET.y, SHEET.w, SHEET.h, SHEET.r);
  ctx.fillStyle = PAPER;
  ctx.fill();

  // Everything else is inside it, so a bled ornament stops at the edge.
  ctx.save();
  roundRect(ctx, SHEET.x, SHEET.y, SHEET.w, SHEET.h, SHEET.r);
  ctx.clip();

  plate(ctx, 1002, 436, 300);
  header(ctx, data.stamp);
  figure(ctx, data);
  rows(ctx, data.rows);
  footnote(ctx, data.footnote);
  band(ctx, data.cta, { showQr, showAddress });

  ctx.restore();

  // The sheet's own hairline, drawn last so nothing inside overlaps it.
  roundRect(ctx, SHEET.x + 0.75, SHEET.y + 0.75, SHEET.w - 1.5, SHEET.h - 1.5, SHEET.r);
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();
}

function header(ctx: CanvasRenderingContext2D, stamp: string): void {
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.font = `600 54px ${SERIF}`;
  ctx.fillText("Ouro", LEFT, HEADER_BASE);

  ctx.fillStyle = MUTED;
  ctx.font = `600 19px ${SANS}`;
  tracked(ctx, "$OURO · ROBINHOOD CHAIN", RIGHT, HEADER_META, 1.7, "right");

  ctx.fillStyle = FAINT;
  ctx.font = `400 19px ${MONO}`;
  ctx.textAlign = "right";
  ctx.fillText(stamp, RIGHT, HEADER_STAMP);
  ctx.textAlign = "left";

  rule(ctx, LEFT, HEADER_RULE, CONTENT);
}

function figure(ctx: CanvasRenderingContext2D, data: ShareCardData): void {
  ctx.textAlign = "left";
  ctx.fillStyle = BRONZE_DEEP;
  ctx.font = `600 23px ${SANS}`;
  tracked(ctx, data.kicker.toUpperCase(), LEFT, KICKER_BASE, 2.1);

  ctx.fillStyle = INK;
  ctx.font = fit(ctx, data.hero, TEXT_WIDTH, (size) => `700 ${size}px ${MONO}`, 150, 76);
  ctx.fillText(data.hero, LEFT, HERO_BASE);

  ctx.fillStyle = SECONDARY;
  ctx.font = fit(ctx, data.sub, TEXT_WIDTH, (size) => `400 ${size}px ${SANS}`, 27, 21);
  ctx.fillText(data.sub, LEFT, SUB_BASE);

  if (data.badge) badge(ctx, data.badge.text, TONES[data.badge.tone]);
}

function badge(ctx: CanvasRenderingContext2D, text: string, tone: (typeof TONES)[keyof typeof TONES]): void {
  const label = text.toUpperCase();
  ctx.font = `600 19px ${SANS}`;
  const spacing = 1.7;
  const dot = 11;
  const w = trackedWidth(ctx, label, spacing) + dot + 14 + 48;

  roundRect(ctx, LEFT, BADGE_TOP, w, BADGE_H, BADGE_H / 2);
  ctx.fillStyle = tone.bg;
  ctx.fill();
  ctx.strokeStyle = tone.line;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(LEFT + 24 + dot / 2, BADGE_TOP + BADGE_H / 2, dot / 2, 0, Math.PI * 2);
  ctx.fillStyle = tone.ink;
  ctx.fill();

  ctx.fillStyle = tone.ink;
  ctx.textAlign = "left";
  tracked(ctx, label, LEFT + 24 + dot + 14, BADGE_TOP + BADGE_H / 2 + 7, spacing);
}

/** The figures, as the site sets them: label left, value right, a hairline between. Pack from the top. */
function rows(ctx: CanvasRenderingContext2D, list: ShareCardRow[]): void {
  const top = ROWS_TOP;
  const bottom = top + list.length * ROW_H;
  rule(ctx, LEFT, top, CONTENT);

  list.forEach((row, i) => {
    const y = top + i * ROW_H;
    const base = y + ROW_H / 2 + 10;

    ctx.textAlign = "left";
    ctx.fillStyle = MUTED;
    ctx.font = `400 25px ${SANS}`;
    const labelWidth = ctx.measureText(row.label).width;

    ctx.textAlign = "right";
    ctx.fillStyle = INK;
    ctx.font = fit(ctx, row.value, CONTENT - labelWidth - 40, (size) => `600 ${size}px ${MONO}`, 30, 20);
    ctx.fillText(row.value, RIGHT, base);

    ctx.textAlign = "left";
    ctx.fillStyle = MUTED;
    ctx.font = `400 25px ${SANS}`;
    ctx.fillText(row.label, LEFT, base);

    if (i < list.length - 1) rule(ctx, LEFT, y + ROW_H, CONTENT);
  });

  rule(ctx, LEFT, bottom, CONTENT);
}

function footnote(ctx: CanvasRenderingContext2D, text: string): void {
  ctx.textAlign = "left";
  ctx.fillStyle = FAINT;
  ctx.font = `400 22px ${SANS}`;
  wrap(ctx, text, CONTENT, 2).forEach((line, i) => ctx.fillText(line, LEFT, FOOTNOTE_BASE + i * FOOTNOTE_LEAD));
}

/** The panel along the foot: the code, and what to do with it. */
function band(ctx: CanvasRenderingContext2D, cta: ShareCardData["cta"], opts: { showQr: boolean; showAddress: boolean }): void {
  const bottom = SHEET.y + SHEET.h;
  roundRect(ctx, SHEET.x, BAND_TOP, SHEET.w, bottom - BAND_TOP, SHEET.r, "bottom");
  ctx.fillStyle = TINT;
  ctx.fill();
  rule(ctx, SHEET.x, BAND_TOP, SHEET.w);

  const centre = (BAND_TOP + bottom) / 2;
  // A URL too long for the largest symbol this encodes leaves the panel as type alone rather than
  // taking the whole card down with it. The site's own origin is nowhere near that; a build pointed
  // at a much longer one is the case this survives.
  const code = opts.showQr ? safeQr(cta.href) : null;
  if (code) qr(ctx, code, LEFT, centre - QR_BOX / 2, QR_BOX);

  // Site tagline, bottom right of the card — same words as the home page.
  const tagline = site.tagline;
  ctx.font = `italic 400 24px ${SERIF}`;
  const tagW = ctx.measureText(tagline).width;
  const tagGap = 48;

  const x = code ? LEFT + QR_BOX + 44 : LEFT;
  const width = Math.max(120, RIGHT - x - tagW - tagGap);
  const foot = opts.showAddress ? `${cta.site} · ${cta.address}` : cta.site;

  ctx.textAlign = "left";
  if (opts.showQr) {
    ctx.fillStyle = BRONZE_DEEP;
    ctx.font = `600 19px ${SANS}`;
    tracked(ctx, cta.caps.toUpperCase(), x, centre - 42, 2.1);
  }

  ctx.fillStyle = INK;
  ctx.font = fit(ctx, cta.line, width, (size) => `600 ${size}px ${SANS}`, 30, 22);
  ctx.fillText(cta.line, x, opts.showQr ? centre + 10 : centre - 8);

  // Site (and optional address) shrink to fit rather than running off the card.
  ctx.fillStyle = BRONZE;
  ctx.font = fit(ctx, foot, width, (size) => `500 ${size}px ${MONO}`, 25, 16);
  ctx.fillText(foot, x, opts.showQr ? centre + 54 : centre + 36);

  ctx.textAlign = "right";
  ctx.fillStyle = SECONDARY;
  ctx.font = `italic 400 24px ${SERIF}`;
  ctx.fillText(tagline, RIGHT, bottom - 48);
  ctx.textAlign = "left";
}

/** The code, or null when the URL is longer than the encoder's largest symbol. */
function safeQr(href: string): QrMatrix | null {
  try {
    return qrEncode(href);
  } catch {
    return null;
  }
}

/* ── the plate ────────────────────────────────────────────────────────────── */

const PLATE_OUTER: Family = { n: 13, d: 0.22, scale: 0.95, hand: 1, traces: 13 };
const PLATE_INNER: Family = { n: 7, d: 0.3, scale: 0.52, hand: -1, traces: 9 };
const PLATE_RULES = [0.985, 0.955, 0.578, 0.558, 0.252, 0.232];
const PLATE_SAMPLES = 420;

/**
 * Ouro's guilloché, as the watermark on a banknote: the same two trace families as the home page's
 * plate, in one ink, faint enough to read type over. Drawn before everything else so it sits under
 * the figure, and clipped by the sheet, so at this size and position it bleeds off the right edge
 * the way an engraved ground does.
 */
function plate(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
  ctx.save();
  // Banded: it must not run under the stamp above it or the figures below, and a plate that stops
  // at a rule reads as an engraved panel rather than as an ornament nobody thought to move.
  ctx.beginPath();
  ctx.rect(SHEET.x, HEADER_RULE + 1, SHEET.w, PLATE_BAND_BOTTOM - HEADER_RULE - 1);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.scale(radius, radius);
  ctx.lineJoin = "round";

  const shade = (i: number, n: number, lo: number, hi: number) => lo + (hi - lo) * (0.5 + 0.5 * Math.cos((Math.PI * 2 * i) / n));

  const spin = (f: Family, colour: string, lo: number, hi: number) => {
    const base = tracePoints(f, PLATE_SAMPLES);
    const step = traceStep(f);
    ctx.lineWidth = 1.7 / radius;
    for (let i = 0; i < f.traces; i++) {
      const a = i * step;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      ctx.beginPath();
      for (let k = 0; k <= PLATE_SAMPLES; k++) {
        const x = base[k * 2];
        const y = base[k * 2 + 1];
        const rx = x * ca - y * sa;
        const ry = x * sa + y * ca;
        if (k === 0) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      }
      ctx.closePath();
      ctx.strokeStyle = rgba(colour, shade(i, f.traces, lo, hi));
      ctx.stroke();
    }
  };

  spin(PLATE_OUTER, BRONZE, 0.06, 0.2);
  spin(PLATE_INNER, GREEN_INK, 0.05, 0.15);

  for (const r of PLATE_RULES) {
    ctx.lineWidth = 1.6 / radius;
    ctx.strokeStyle = rgba(BRONZE_DEEP, 0.14);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

/* ── the code ─────────────────────────────────────────────────────────────── */

/** The standard's four-module light margin, so a scanner can find the symbol's edge. */
const QUIET = 4;

/** The QR, on its own white plate: the band behind it is tinted, and a code needs a light ground. */
function qr(ctx: CanvasRenderingContext2D, code: QrMatrix, x: number, y: number, box: number): void {
  roundRect(ctx, x, y, box, box, 10);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const span = code.size + QUIET * 2;
  const unit = box / span;
  ctx.fillStyle = INK;
  for (let row = 0; row < code.size; row++) {
    for (let col = 0; col < code.size; col++) {
      if (!code.modules[row * code.size + col]) continue;
      // Rounded to whole pixels, and drawn a hair wide, so neighbouring modules meet rather than
      // leaving a seam of background that a camera reads as a light module.
      const mx = Math.round(x + (QUIET + col) * unit);
      const my = Math.round(y + (QUIET + row) * unit);
      ctx.fillRect(mx, my, Math.ceil(unit), Math.ceil(unit));
    }
  }
}

/* ── drawing helpers ──────────────────────────────────────────────────────── */

function rule(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + 0.5);
  ctx.lineTo(x + w, y + 0.5);
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** A rounded rectangle path. `corners` rounds only one end, for the panel that meets the sheet's foot. */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, corners: "all" | "bottom" = "all"): void {
  const top = corners === "all" ? r : 0;
  ctx.beginPath();
  ctx.moveTo(x + top, y);
  ctx.lineTo(x + w - top, y);
  ctx.arcTo(x + w, y, x + w, y + top, top);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + top);
  ctx.arcTo(x, y, x + top, y, top);
  ctx.closePath();
}

/**
 * Tracked capitals, letter by letter.
 *
 * The site's micro label is 11px caps at 0.09em of tracking, and it is the one piece of the design
 * a canvas cannot simply ask for: `ctx.letterSpacing` is recent and not everywhere, and a card that
 * silently loses its tracking on one browser is a different card. Measuring each glyph is exact
 * everywhere, and there are only a few short strings of it.
 */
function tracked(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, align: "left" | "right" = "left"): void {
  let cursor = align === "right" ? x - trackedWidth(ctx, text, spacing) : x;
  const was = ctx.textAlign;
  ctx.textAlign = "left";
  for (const ch of text) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + spacing;
  }
  ctx.textAlign = was;
}

function trackedWidth(ctx: CanvasRenderingContext2D, text: string, spacing: number): number {
  let w = 0;
  let n = 0;
  for (const ch of text) {
    w += ctx.measureText(ch).width;
    n++;
  }
  return w + spacing * Math.max(0, n - 1);
}

/** The largest size from `start` down to `min` at which the text fits `maxWidth`. Returns the font string. */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, build: (size: number) => string, start: number, min: number): string {
  let size = start;
  let font = build(size);
  while (size > min) {
    ctx.font = font;
    if (ctx.measureText(text).width <= maxWidth) return font;
    size -= 2;
    font = build(size);
  }
  ctx.font = font;
  return font;
}

/** Greedy word wrap to at most `maxLines`; the last line is clipped with an ellipsis if it has to be. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line === "" ? word : `${line} ${word}`;
    if (ctx.measureText(next).width <= maxWidth || line === "") {
      line = next;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line !== "") lines.push(line);
  const last = lines.length - 1;
  if (last >= 0) {
    while (lines[last].length > 1 && ctx.measureText(lines[last]).width > maxWidth) lines[last] = `${lines[last].slice(0, -2).trimEnd()}…`;
  }
  return lines;
}

function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
