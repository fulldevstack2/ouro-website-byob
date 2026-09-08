# Ouro website

Marketing site + docs for **Ouro ($OURO)**, *own the fee generating layer of Robinhood Chain*, on Robinhood Chain (4663).

Built from the Claude Design export in `../ouros-website-claude-design/` ("Ouro Site" design component + the
Ouro design system). This repo is the React implementation of that design.

## Stack

- [React Router 8](https://reactrouter.com/) in **framework mode** (the React docs' recommended way to start a new app), Vite, TypeScript, pnpm.
- **Static output.** `react-router.config.ts` sets `ssr: false` + `prerender: true`: every route is pre-rendered to HTML at build time and hydrates into a client-side app. No server to run.
- **No CSS framework.** Styling is the design system's CSS custom-property tokens plus small component-scoped inline styles, exactly as in the design export.
- **Two deliberate departures from the export** (reviewer feedback, 2026-08-30): the page ground is a warm grey
  (`--page: #EEEBE5`, white `--paper` cards sit on it; see the note at the top of `styles/tokens/colors.css`), and the
  hero's right column is **Ouro's plate**, `components/site/HeroRing.tsx`: guilloché — the engine-turned line work on a
  banknote or share certificate — engraved live on a canvas (`lib/guilloche.ts` is the pure maths). Two families of lathe
  traces turn against each other in two inks, one lit line laps the outer figure for ever and lights the Loop's four
  stations as it passes, and dragging works the lathe (sideways turns the plate, up and down changes the depth of cut).
  A static SVG of the same figure is baked into the prerendered HTML, so the plate is on screen before hydration and with
  JS off; under `prefers-reduced-motion` it is a single still.

## Scripts

```bash
pnpm install
pnpm dev          # http://localhost:5173 with HMR
pnpm typecheck    # react-router typegen && tsc
pnpm build        # → build/client (static site)
pnpm preview      # serve build/client on http://localhost:4173
```

## Layout

```
app/
  root.tsx                 document shell: fonts, <SiteNav/> + <main/> + <SiteFooter/>, 404/error boundary
  routes.ts                /  /vaults  /monitor  /ledger  /docs   (the design's views + the vaults + the monitors)
  routes/{home,vaults,monitor,ledger,docs}.tsx   /monitor and /ledger read ../ouro-monitor over HTTP
                           (app/lib/monitorApi.ts, MONITOR_API_URL at build): /monitor = the upstream dividend
                           tokens the vaults farm (/v1/summary), /ledger = Ouro's own liquidity (/v1/reserve)
  components/ds/           the Ouro design system: Badge, Button, Callout, Card, Stat, LedgerTable,
                           TokenChip, Input, Select, Tabs (ported from _ds_bundle.js, typed)
  components/site/         chrome + layout primitives: SiteNav, SiteFooter, Container, Grid, SectionHead,
                           PageHeader, MicroLabel, NumberedRow, KVRow, HelpTip, LoopRing, CrankFeed,
                           HeroRing (the guilloché plate in the home hero)
  lib/guilloche.ts         the plate's maths: one lathe trace, its family's index step, an SVG path
  lib/monitorApi.ts        ouro-monitor client: useMonitor() poller, the response types, the formatters
  content/site.ts          name, tagline, X handle, chain, `auditPublished`, external links (TODOs)
  content/protocol.ts      protocol contract list (TBD until launch), the Reserve's pools, canonical infra, parameters
  content/vaults.ts        the nine vaults (OURO / HOOD10 / INDEX × pays in itself / WETH / USDG): status, terms, addresses; the OURO three are live
  hooks/useClock.ts        the "HH:MM:SS UTC" ticker on the Ledger / crank feed
  styles/tokens/*.css      design tokens, copied verbatim from the export
  styles/site.css          the design's <helmet> rules, hover states, layout + responsive collapse
  app.css                  imports the above
public/favicon.svg         placeholder (the brand has no logo; wordmark initial)
netlify.toml               static deploy: publish build/client, SPA fallback for unknown URLs
```

### How the design maps to code

| Claude Design                                   | Here                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| `<sc-if value="{{ isHome }}">` … four views     | four routes in `app/routes.ts`; nav uses `<NavLink>` (active state)   |
| `<x-import component-from-global-scope="…">`    | `import { Badge, Button, … } from "~/components/ds"`                  |
| `style-hover="…"`                               | `.nav-link:hover`, `.foot-link:hover`, `.toc-link:hover` in `site.css` |
| `DCLogic` state (`view`, `now`, `connected`)    | routes, `useClock()`, local `useState` in `routes/vaults.tsx`          |
| props `xHandle`, `auditPublished`               | `content/site.ts`                                                     |
| `addrRows` / `infraRows` / `paramRows`          | `content/protocol.ts`                                                 |
| `<helmet>` `<link>`s + `<style>`                | `root.tsx` `links()` (fonts) + `app.css` / `site.css`                  |

## The Ledger (`/ledger`)

The treasury page, live since 2026-09-04. It reads `ouro-monitor`'s `/v1/reserve` and `/v1/reserve/events`
and reports every protocol-owned Uniswap v3 position: what it holds marked to market, its range and whether
the price is inside it, the pool's fee tier **and the smaller share the LP actually keeps**, the cost basis
from the position's own event log, uncollected and already-collected fees, and the feed of every add,
withdrawal and collect.

**It leads with the net, not the fees, and that is deliberate.** A pool that earns fees can still lose to
simply holding the tokens — as the price moves it sells the winner and buys the loser. For a basket-token pool
the two are the same order of magnitude: the Reserve's first 1.2 days were $36.82 of fees against $19.54 of
divergence, a real net of +$17.28 (+0.41%). A fees-only headline would have read +0.87%. Both figures are on
the page, and the callout above the chart names the difference, so the page cannot flatter the strategy by
omission.

Nothing is estimated. If any token in the Reserve has no price the monitor trusts, every USD total shows a
dash and a callout says why, rather than a partial sum that reads like a complete one. Token amounts, ranges
and the in-range flag never depend on a price.

**Where the monitor's origin comes from.** `vite.config.ts` is the only place it is decided, and it defaults to
the live monitor (`https://ouro-monitor.onrender.com`), so `pnpm dev` and a plain `pnpm build` both show real
data with no setup. Vite inlines it at *build* time, so changing it needs a rebuild.

```bash
pnpm dev                                              # the live monitor
MONITOR_API_URL=http://localhost:8787 pnpm dev        # a monitor you are running locally
MONITOR_API_URL= pnpm dev                             # the "not configured" state, for checking it
```

It used to default to `http://localhost:8787` in dev and to the empty string in a local build. Both were wrong
in practice: forgetting the env var produced a page reporting "monitor offline", which looks exactly like a
production outage and sent us looking at Render instead of at the dev server. `netlify.toml` still sets the
variable explicitly, which is now belt-and-braces but documents intent at the deploy boundary. Keep
`CORS_ORIGINS` on the monitor's Render service in step with the origins that read it (it is `*` today).

## The airdrops (`/airdrops`)

The payout page, live since 2026-09-04, and deliberately separate from `/ledger`: the Ledger answers "is the
owned liquidity working?", this answers "when do I get paid, and was I paid?". Different data, different reader,
and putting both on one page buried the fees-vs-divergence headline.

**Historical.** Every cycle from the Airdropper's own `Airdropped` events: what it paid, to how many wallets, in
which tokens, and the transactions that did it. Value is what the assets were worth *when they were sent*, not
today. A cycle with any unpriced leg shows a dash rather than the value of the priced legs.

**On its way**, in three stages, none of which is a scheduled amount:

1. Tax still in the letscash hook, claimable only by the pool creator (who loses 6% of the gross on claiming).
2. Value already collected into the airdrop wallet, read from its balances, **with a day-by-day chart of the
   wallet's closing balance** (`/v1/ouro/queue`). **Not the next payout** — a collection streams over ~48 h and
   a wallet owed less than the gas waits, so it is the pool the next several cycles draw from. The keeper's own
   buffer (`stream.json`) is on a Render worker with no HTTP port, so it is unreachable; this is the honest
   chain-derived substitute.

   The chart lives in the page's main chart slot, as a tab beside "Paid to holders" rather than inside the
   narrow card — at a third of the width it was too small to read a sawtooth in, which is the only thing that
   chart is for. It *is* a sawtooth, not a climb: the wallet fills when a collection lands and drains as each
   cycle pays, so a flat or falling line is the wallet working. Each bar is that day's *closing* balance at
   *that day's* price, so the last bar need not match the live figure. A day the wallet ended empty draws no
   bar, which is what happened on its first day — everything in went straight back out.
3. LP fees the Reserve has accrued but not collected, against the $100 threshold.

**Yield** (`/v1/ouro/yield`) — what one dividend line costs to acquire, what it earns per day and per thirty
days, and the annualised rate. The rate is **published with its basis attached**, never bare: the monitor's
`caveat` names the actual history behind it ("Based on 1.6 days of payouts…") and the page renders it under the
number and again as a callout. The same payouts annualise to roughly a fifth of the figure over a seven-day
window, so the basis is half the number. The same rate also drives the home hero (`components/site/AprHeadline`),
which sits between the lede and the buttons and renders **no figure** until it has data — a hero is
prerendered, and a dash that becomes a large number is a flash of wrong information in the first thing anyone
sees. It does hold its own height while the request is in flight, because it is directly above the primary
call to action and appearing from nothing would shove the Buy button down under whatever the reader was about
to click. The reserved 85px was measured (with the request held open via CDP, 84px still moved the buttons a
pixel), and it is held only while loading: an unreachable or unconfigured monitor collapses the element rather
than leaving a permanent hole in the hero. The section also states the ways the figures are
inexact — the eligible supply excludes what is
never paid (below-line wallets, the pool, the vest), and the keeper's `TAPER=3:30` means a typical wallet
receives slightly *more* than strict pro-rata, so it is a floor for most holders. The wallet check shows the
same at per-address scale: its share of every cycle, and what the measured rate implies for a holding that size.

**Eligibility** — the line, the counts, the exclusion policy, and a paste-an-address check. Deliberately no rich
list: a leaderboard of the largest wallets is a different page's job and not what a payout page is for. The check answers *eligibility*, not payment history: the
holders endpoint reports balance, the line and the exclusion policy, while which wallets a given cycle paid
lives in the indexer's `pushes` table and is not exposed per address. It says a wallet is paid every cycle, and
says nothing about any particular one — and for an address it has never seen it says "not in the indexed set",
not "not eligible", because only one of those is a fact about the wallet.

There is no countdown to the next payout, on purpose — see `PayoutCadence`'s note and docs §06.

## Before launch

- **The mechanics changed on 2026-08-31** (5% tax · 4% basket / 1% ops · fees 80% airdropped to holders in kind / 20% compounded into the Reserve · no staking · no burn).
  The site copy and `docs/DOCS.md` are updated; **the contracts in `../basket-flywheel` are not** — they still ship a 2.5% tax hard-capped at 3%, a `StakingVault`
  and a burn. See that repo's `CONTRACTS.md` → "The design has moved ahead of this code".
- `content/protocol.ts` → set the tax ceiling the hook will enforce, then state it in docs §10, §11 and the "Can the team rug?" FAQ (they currently say
  "the ceiling the hook sets at deploy" rather than a number).
- `content/site.ts` → fill `links.explorer` and `links.robinhoodChain` (currently `#`), confirm the X handle, flip `auditPublished` when the report is out.
- `content/protocol.ts` → set the seven protocol contract addresses (they render as "Publishes at launch" while `null`).
- `content/vaults.ts` → flip each vault's `status` (`in-build` → `awaiting-deploy` → `live`) and set its `address` and `shareSymbol` as contracts ship; a `live` OURO vault gets a working panel on /vaults (deposit, withdraw, claim through the connected wallet: `components/vaults/VaultsLive.tsx` loaded client-side only, `components/vaults/VaultFrame.tsx` for the prerendered layout, `hooks/useVault.ts`, `lib/vaultChain.ts`).
- ~~Ledger / crank feed / stats show a dash placeholder~~ — **done 2026-09-04**: `/ledger` reads the chain through
  `ouro-monitor`'s `/v1/reserve`. It is out of the shelf and back in the nav. `/monitor` (INDEX / HOOD10) is still
  shelved in `content/site.ts`.
- Fonts are Google Fonts stand-ins (Source Serif 4 / Public Sans / JetBrains Mono) per the design-system readme.

## SEO and metadata

- Every route is pre-rendered, so crawlers get full HTML. `app/lib/meta.ts` → `pageMeta()` emits title, description,
  canonical, Open Graph, Twitter card and optional JSON-LD for each route (`home` also emits Organization/WebSite,
  `docs` a FAQPage).
- **Site URL.** Canonicals, OG URLs, robots.txt and sitemap.xml use `scripts/site-url.mjs`: `SITE_URL` env →
  Netlify's build-time `URL` (becomes the custom domain once one is attached) → the current Netlify subdomain.
  For a local build against the final domain: `SITE_URL=https://example.com pnpm build`.
- **Post-build** (`scripts/postbuild.mjs`): removes `build/server`, copies the SPA fallback to `404.html` (Netlify
  returns a real 404 status for unknown URLs), writes `robots.txt` and `sitemap.xml`.
- **Fonts** are self-hosted Latin subsets in `public/fonts` (`app/styles/fonts.css`), preloaded from `root.tsx`; no
  third-party CSS blocks the first paint.
- **Open Graph cards** live in `public/og`; regenerate after copy changes with `node scripts/og-cards.mjs`
  (renders `scripts/og/card.html` with headless Chrome).
- **Headers** (`public/_headers`): immutable caching for hashed assets and fonts, plus basic security headers.
- Internal links use trailing slashes (`/vaults/`), which is the URL form Netlify serves directories at, so direct
  loads skip a 301.

## Deploying

`pnpm build` writes a fully static site to **`build/client/`**: `index.html`, `ledger/index.html`, `docs/index.html`,
`vaults/index.html`, `__spa-fallback.html` + `404.html`, `robots.txt`,
`sitemap.xml` and `_headers`. (The post-build step deletes `build/server/`, which React Router only uses to pre-render.)

**Deploy `build/client`, not `build`.** Uploading the parent folder puts the site under `/client/` and the root 404s.

- Netlify drag-and-drop: drop the `build/client` folder. Unknown URLs get `404.html` (a real 404 status) and the app
  renders its own "Page not found"; pre-rendered pages are served as static files.
- Netlify CLI: `npx netlify-cli deploy --prod --dir=build/client`
- Git-connected Netlify site: `netlify.toml` already sets `command = "pnpm run build"` and `publish = "build/client"`.
- Any other static host: serve `build/client`; serve `404.html` (status 404) for unknown URLs.
