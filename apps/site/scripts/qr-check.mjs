/**
 * Checks app/lib/qr.ts against the `qrcode` package, which is already in the tree as a transitive
 * dependency of the wallet stack. It is NOT imported by the site: the encoder is ours so that one
 * short URL does not pull a dependency into the client bundle, and this is how we know ours is
 * right. (Because it is transitive, pnpm does not link it at the top level, so it is required from
 * its store path; if that ever moves, the path below is the only thing to fix.)
 *
 * Every input is encoded at every mask, and the two module matrices must agree exactly. Forcing the
 * mask is what makes the comparison meaningful: mask selection is a scoring heuristic where
 * implementations differ in the last decimal, while the matrix at a given mask is fixed by the
 * standard. The unforced path is then checked for reproducing whichever mask it says it chose.
 *
 * Needs a Node that strips TypeScript types on import (22.18+ / 24).
 *
 *   node scripts/qr-check.mjs
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { qrEncode } = await import("../app/lib/qr.ts");
const QRCode = require("../node_modules/.pnpm/qrcode@1.5.3/node_modules/qrcode");

const INPUTS = [
  "https://ourolayer.com",
  "https://ourolayer.com/",
  "https://ourolayer.com/portfolio/",
  "https://ourolayer.com/vaults/",
  "A",
  "0123456789",
  "ouro",
  "https://deploy-preview-12--loquacious-griffin-600837.netlify.app/",
  "x".repeat(14),
  "y".repeat(26),
  "z".repeat(42),
  "w".repeat(62),
  "v".repeat(84),
  "u".repeat(106),
  "£ and ± and é", // multi-byte UTF-8
];

let checked = 0;
let failed = 0;

for (const text of INPUTS) {
  for (let mask = 0; mask < 8; mask++) {
    const mine = qrEncode(text, mask);
    // Byte mode explicitly: `qrcode` picks the cheapest mode per run of characters, so "A" would go
    // out as alphanumeric and "600837" as numeric, and the matrices would differ over the mode
    // rather than over anything this is testing. Ours is byte mode only, by design.
    const theirs = QRCode.create([{ data: text, mode: "byte" }], { errorCorrectionLevel: "M", maskPattern: mask });
    const size = theirs.modules.size;
    const ref = theirs.modules.data;
    checked++;

    if (mine.size !== size) {
      console.error(`FAIL size ${mine.size} vs ${size} · mask ${mask} · ${text.slice(0, 32)}`);
      failed++;
      continue;
    }
    let diff = -1;
    for (let i = 0; i < ref.length; i++) {
      if (mine.modules[i] !== (ref[i] ? 1 : 0)) {
        diff = i;
        break;
      }
    }
    if (diff >= 0) {
      console.error(`FAIL module ${diff} (row ${Math.floor(diff / size)}, col ${diff % size}) · mask ${mask} · v${mine.version} · ${text.slice(0, 32)}`);
      failed++;
    }
  }

  // The unforced path must produce the same matrix as forcing the mask it says it chose.
  const auto = qrEncode(text);
  const forced = qrEncode(text, auto.mask);
  if (auto.modules.some((m, i) => m !== forced.modules[i])) {
    console.error(`FAIL auto-mask mismatch · ${text.slice(0, 32)}`);
    failed++;
  }
  checked++;
}

// Past the capacity of the largest version supported.
try {
  qrEncode("q".repeat(107));
  console.error("FAIL: 107 characters should not encode");
  failed++;
} catch {
  checked++;
}

const url = "https://ourolayer.com";
const auto = qrEncode(url);
console.log(`${url} -> version ${auto.version}, ${auto.size} modules, mask ${auto.mask}`);
console.log(failed === 0 ? `ok: ${checked} checks passed` : `${failed} of ${checked} checks FAILED`);
process.exit(failed === 0 ? 0 : 1);
