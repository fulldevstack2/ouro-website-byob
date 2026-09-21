/**
 * Renders the Open Graph cards in public/og from scripts/og/card.html with headless Chrome.
 * Run after changing a page title/lede, or the card's palette: `node scripts/og-cards.mjs`.
 * Needs Chrome installed; point CHROME_PATH at the binary anywhere but a default macOS install.
 *
 * The cards for the two Ouro pages, which moved here from apps/site on 2026-09-15 along with this
 * script and its template. Same renderer and same design on both sites, so a card made here is the
 * card the page had before it moved. The comparison page has no card: it is not one page about one
 * thing, and a card that says "the airdrop meta" over Ouro's own wordmark would read as a claim
 * about the projects it reports on.
 *
 * ── Why the DevTools protocol and not `--screenshot=` ──
 * It used to be one `spawnSync` per card with `--screenshot`, and on 2026-09-21 that silently stopped
 * producing files: Chrome launched, sat in a credential-manager loop, hit the 12-second timeout and
 * was killed before it wrote anything. Nothing said so, because the check was `existsSync(file)` and
 * every card already existed from the previous run — so stale PNGs were reported "ok" and a
 * palette change looked like it had shipped when nothing on disk had changed.
 *
 * So: one browser for all the cards, driven over CDP, and the check is the bytes actually written
 * this run. A card that fails now says FAILED and the run exits non-zero.
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// fileURLToPath, not .pathname: on Windows the pathname is "/D:/WORK%20CODE/…", which join() turns into "D:D:…".
const root = fileURLToPath(new URL("..", import.meta.url));
const chrome = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// pathToFileURL, for the same reason one step on: a raw `file://` + Windows path leaves the spaces
// and backslashes in "D:\WORK CODE\…" unencoded, and Chrome resolves the template's relative
// @font-face URLs against whatever that parses to.
const template = pathToFileURL(join(root, "scripts", "og", "card.html")).href;
const out = join(root, "public", "og");
mkdirSync(out, { recursive: true });

const CARDS = {
  ledger: { k: "Live proof", t: "The Ledger.", s: "What the Reserve owns, what it earned, and whether that beats simply holding." },
  airdrops: { k: "Live proof", t: "The airdrops.", s: "Every cycle the keeper has paid, and what is on its way. If the site and the chain disagree, the chain is right." },
};

/** The Open Graph size every consumer crops from. */
const CARD = { width: 1200, height: 630 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), "og-chrome-"));
const port = Number(process.env.OG_CDP_PORT || 9222);

const browser = spawn(
  chrome,
  [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    "--disable-background-networking",
    "--disable-features=Translate,OptimizationHints",
    // The template's faces are ../../public/fonts/*.woff2, relative to a file:// page.
    "--allow-file-access-from-files",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

async function endpoint() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch {
      /* not listening yet */
    }
    await sleep(250);
  }
  throw new Error(`Chrome never opened its debugging port (${chrome})`);
}

const ws = new WebSocket(await endpoint());
await new Promise((res, rej) => {
  ws.addEventListener("open", res, { once: true });
  ws.addEventListener("error", rej, { once: true });
});

let seq = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  const waiter = msg.id && pending.get(msg.id);
  if (!waiter) return;
  pending.delete(msg.id);
  msg.error ? waiter.rej(new Error(JSON.stringify(msg.error))) : waiter.res(msg.result);
});
const send = (method, params = {}, sessionId) =>
  new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
const call = (method, params) => send(method, params, sessionId);

await call("Page.enable");
await call("Runtime.enable");
await call("Emulation.setDeviceMetricsOverride", { ...CARD, deviceScaleFactor: 1, mobile: false });

let failed = 0;
for (const [name, card] of Object.entries(CARDS)) {
  const file = join(out, `${name}.png`);
  try {
    await call("Page.navigate", { url: `${template}?${new URLSearchParams(card)}` });
    // The faces are the whole typographic identity of the card, so waiting on them is not optional:
    // a capture that lands first prints the fallback sans and looks like a different product.
    await call("Runtime.evaluate", { expression: "document.fonts.ready", awaitPromise: true });
    await sleep(250);
    const shot = await call("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
      clip: { x: 0, y: 0, ...CARD, scale: 1 },
    });
    const bytes = Buffer.from(shot.data, "base64");
    if (bytes.length < 1024) throw new Error(`only ${bytes.length} bytes came back`);
    writeFileSync(file, bytes);
    console.log(`${name}.png ok (${(bytes.length / 1024).toFixed(1)} kB)`);
  } catch (err) {
    failed++;
    console.log(`${name}.png FAILED (${err.message})`);
  }
}

ws.close();
browser.kill();
// Best effort, and deliberately after the cards are already on disk. Windows holds the profile
// directory until Chrome has fully exited, so a tidy-up that raced it used to throw EPERM and fail a
// run whose five cards had all been written. It is a temp directory; the OS can have it.
await sleep(400);
try {
  rmSync(profile, { recursive: true, force: true });
} catch {
  /* Chrome still letting go of it */
}
process.exit(failed ? 1 : 0);
