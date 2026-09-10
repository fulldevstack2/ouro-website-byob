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

const CARDS = {
  home: { k: "Protocol owned liquidity · Robinhood Chain", t: "Own the fee generating layer of Robinhood Chain.", s: "A 5% trade tax: 2% airdropped to holders, 2% buying pools the protocol keeps, 1% ops. 80% of those pools' fees is airdropped too." },
  monitor: { k: "Live proof · upstream", t: "The dividend monitor.", s: "INDEX and HOOD10 payouts, tax, eligibility and operator actions, read from Robinhood Chain. Nothing reported by hand." },
  vaults: { k: "For HOOD10 and INDEX holders", t: "The vaults.", s: "Pool HOOD10 or INDEX, clear the dividend line together, and take the yield in your token, WETH or USDG." },
  ledger: { k: "Live proof", t: "The Ledger.", s: "Every position the treasury owns, what the pools have earned, and what the same tokens would have been worth simply held." },
  airdrops: { k: "Live proof", t: "The airdrops.", s: "Every payout Ouro has sent: what each cycle paid, to how many wallets, and what is already collected and waiting to go out." },
  portfolio: { k: "Your wallet", t: "Your portfolio.", s: "Your $OURO, every airdrop it has received with the transaction that paid it, what it holds now and your vault deposits." },
  docs: { k: "Documentation", t: "How Ouro works.", s: "The tax, the Loop, the Reserve, the airdrop, compounding, the Seal, governance and risks." },
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
