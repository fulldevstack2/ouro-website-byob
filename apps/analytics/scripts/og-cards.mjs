/**
 * Renders the Open Graph cards in public/og from scripts/og/card.html with headless Chrome.
 * Run after changing a page title/lede: `node scripts/og-cards.mjs` (needs Chrome installed).
 *
 * The cards for the two Ouro pages, which moved here from apps/site on 2026-09-15 along with this
 * script and its template. Same renderer and same design on both sites, so a card made here is the
 * card the page had before it moved. The comparison page has no card: it is not one page about one
 * thing, and a card that says "the airdrop meta" over Ouro's own wordmark would read as a claim
 * about the projects it reports on.
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

const CARDS = {
  ledger: { k: "Live proof", t: "The Ledger.", s: "What the Reserve owns, what it earned, and whether that beats simply holding." },
  airdrops: { k: "Live proof", t: "The airdrops.", s: "Every cycle the keeper has paid, and what is on its way. If the site and the chain disagree, the chain is right." },
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
