/**
 * Renders the Open Graph cards in public/og from scripts/og/card.html with headless Chrome.
 * Run after changing a page title/lede: `node scripts/og-cards.mjs` (needs Chrome installed).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not .pathname: on Windows the pathname is "/D:/WORK%20CODE/…", which join() turns into "D:D:…".
const root = fileURLToPath(new URL("..", import.meta.url));
const chrome = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const template = `file://${join(root, "scripts", "og", "card.html")}`;
const out = join(root, "public", "og");
mkdirSync(out, { recursive: true });

// ledger and airdrops are NOT here: those pages moved to apps/analytics on 2026-09-15 and their cards
// went with them (apps/analytics/scripts/og-cards.mjs, same template, same renderer).
const CARDS = {
  home: { k: "Robinhood Chain · 4663", t: "Liquidity that pays its holders.", s: "Every $OURO trade buys protocol-owned liquidity in the top Robinhood Chain tokens. The fees those pools earn are airdropped to holders every two hours." },
  monitor: { k: "Live proof · upstream", t: "The dividend monitor.", s: "INDEX and HOOD10 payouts, tax, eligibility and operator actions, read from Robinhood Chain. Nothing reported by hand." },
  vaults: { k: "For holders under the line", t: "The vaults.", s: "Pool your $OURO with others, clear the 100,000 line together, and get paid in OURO, ETH or dollars." },
  portfolio: { k: "Your wallet", t: "The portfolio.", s: "Your $OURO, every airdrop it has received, and what it holds now." },
  docs: { k: "Documentation", t: "How Ouro works.", s: "The tax, the Loop, the Reserve, the airdrop, the parameters, what Ouro cannot do, the risks and every address." },
};

for (const [name, c] of Object.entries(CARDS)) {
  const profile = join(root, "node_modules", ".cache", `og-chrome-${name}`);
  rmSync(profile, { recursive: true, force: true });
  const url = `${template}?${new URLSearchParams(c)}`;
  const file = join(out, `${name}.png`);
  const r = spawnSync(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars", `--user-data-dir=${profile}`, "--virtual-time-budget=4000", "--window-size=1200,630", `--screenshot=${file}`, url], { timeout: 12000, stdio: "ignore" });
  // Chrome often keeps running after writing the screenshot; the timeout above ends it.
  console.log(`${name}.png ${existsSync(file) ? "ok" : "FAILED"}${r.error && !existsSync(file) ? " (" + r.error.message + ")" : ""}`);
  rmSync(profile, { recursive: true, force: true });
}
