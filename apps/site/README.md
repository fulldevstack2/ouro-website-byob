# Ouro website

> **This app moved into a workspace.** It is now `apps/site` beside `apps/analytics`, over the shared
> `packages/ds` and `packages/monitor-client`. Paths in this file are relative to `apps/site` unless they
> start with `packages/`. See the workspace README at the repo root for the layout and the deploy change.

Marketing site + docs for **Ouro ($OURO)**, *liquidity that pays its holders*, on Robinhood Chain (4663).

Built from the Claude Design export in `../ouros-website-claude-design/` ("Ouro Site" design component + the
Ouro design system), and redesigned on 2026-09-14 against `../OURO REDESIGN BRIEF` (`Ouro Site.dc.html` is the
canvas, `_ds/` the design system it is set in, `github.md` the screen-to-file map). This repo is the React
implementation of that design.

## Stack

- [React Router 8](https://reactrouter.com/) in **framework mode** (the React docs' recommended way to start a new app), Vite, TypeScript, pnpm.
- **Static output.** `react-router.config.ts` sets `ssr: false` + `prerender: true`: every route is pre-rendered to HTML at build time and hydrates into a client-side app. No server to run.
- **No CSS framework.** Styling is the design system's CSS custom-property tokens plus small component-scoped inline styles, exactly as in the design export.
- **The 2026-09 redesign** is the brief's white-paper page: flat white ground, warm ink, hairline rules, one bronze
  accent, six low-text screens, and figures doing the persuading. `packages/ds` still carries the warm-grey ground the
  analytics dashboard was designed on; this app sets the surface tokens back to white in `styles/site.css` (section 1),
  for itself only. The hero's right column is now a card of three live figures read through ouro-monitor, and nothing
  on the site animates unprompted except numbers and the plate.
- **The plate** (`components/site/LoopPlate.tsx`) is the redesign's drawing of the Loop, in the slot beside the four
  steps. Guilloché — the engine-turned line work on a banknote or share certificate — engraved live on a canvas
  (`lib/guilloche.ts` is the pure maths). Two families of lathe traces turn against each other in two inks, one lit
  line laps the outer figure for ever, lighting each of the Loop's four steps as it reaches it, and dragging works the lathe
  (sideways turns the plate, up and down changes the depth of cut). It was the hero's in the first build of this site,
  briefly dropped in the redesign, and brought back here: the ouroboros is one closed line with no beginning and no
  end, which is what a guilloché figure is and what the four steps beside it describe. The four are named on the plate
  itself, one to a corner of the square it is inscribed in, each opposite the station that points at it. That is where
  they fit: the plate's own margin is about 27px and takes a numeral at most, whereas at the height a corner name sits
  the circle is not there at all, so the names cost the lace nothing at any width. A static SVG of the same figure
  is baked into the prerendered HTML, so the plate is on screen before hydration and with JS off; under
  `prefers-reduced-motion` it is a single still, and it sleeps off screen and in a hidden tab.

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
  routes.ts                /  /vaults  /monitor  /ledger  /airdrops  /portfolio  /docs
  routes/{home,vaults,monitor,ledger,docs}.tsx   /monitor and /ledger read ../ouro-monitor over HTTP
                           (@ouro/monitor-client, MONITOR_API_URL at build): /monitor = the upstream dividend
                           tokens the vaults farm (/v1/summary), /ledger = Ouro's own liquidity (/v1/reserve)
  routes/portfolio.tsx     the connected wallet's view (?address=0x… for another, unadvertised; see "The portfolio" below):
                           components/portfolio/ (PortfolioFrame = the layout the prerender writes, PortfolioLive =
                           the client-only wallet half, ShareCard = the share dialog), hooks/usePortfolio.ts
                           (ouro-monitor's /v1/portfolio/{address}, polled, and its paged /airdrops history),
                           lib/shareCard.ts (the card, painted on a canvas) + lib/qr.ts (its code)
                           (the design system itself now lives in packages/ds — see the workspace README)
  components/site/         chrome + layout primitives: SiteNav (with the price ticker, hooks/useOuroTicker.ts),
                           SiteFooter, Container, Grid, SectionHead, PageHeader, MicroLabel, NumberedRow, KVRow,
                           Pager, Bars, LoopPlate (the guilloché plate), SplitBar, AddressCell, TokenIcon, AirdropCalc
  components/wallet/       WalletProvider (wagmi + RainbowKit, client-only) and WalletButton (RainbowKit's
                           connect flow in the site's own buttons: connect, switch chain, address pill, disconnect)
  lib/guilloche.ts         the plate's maths, shared by the Loop and the share card: one lathe trace, its family's
                           index step, an SVG path
  lib/dexscreener.ts       DexScreener quote for the one figure the monitor lacks (the day's change) and price fallback
                           (the monitor client now lives in packages/monitor-client)
  content/site.ts          name, tagline, X handle, chain, `auditPublished`, external links (TODOs)
  content/protocol.ts      protocol contract list (TBD until launch), the Reserve's pools, canonical infra, parameters
  content/vaults.ts        the nine vaults (OURO / HOOD10 / INDEX × pays in itself / WETH / USDG): status, terms, addresses; the OURO three are live
  hooks/useClock.ts        the "HH:MM:SS UTC" ticker on the Ledger / crank feed
                           (design tokens now live in packages/ds/src/styles/tokens)
  styles/site.css          the design's <helmet> rules, hover states, layout + responsive collapse
  app.css                  imports the above
public/favicon.svg         placeholder (the brand has no logo; wordmark initial)
netlify.toml               static deploy; Netlify base directory must be set to apps/site
```

### How the design maps to code

| Claude Design                                   | Here                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| `<sc-if value="{{ isHome }}">` … four views     | four routes in `app/routes.ts`; nav uses `<NavLink>` (active state)   |
| `<x-import component-from-global-scope="…">`    | `import { Badge, Button, … } from "@ouro/ds"`                         |
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
window, so the basis is half the number. The same rate is the basis of the home page's calculator
(`components/site/AirdropCalc`), which shows what a holding of the reader's size would have collected, trailing,
never as a forecast. The eligible supply excludes what is never paid (below-line wallets, the pool, the vest), and
the keeper's `TAPER=3:30` means a typical wallet receives slightly *more* than strict pro-rata, so it is a floor
for most holders.

**Eligibility** — a paste-an-address check, run when the button is pressed. Deliberately no rich list: a
leaderboard of the largest wallets is a different page's job and not what a payout page is for. The check answers
*eligibility*, not payment history: the holders endpoint reports balance, the line and the exclusion policy, while
which wallets a given cycle paid lives in the indexer's `pushes` table and is not exposed per address. It says a
wallet is paid every cycle, and says nothing about any particular one — and for an address it has never seen it
says "not in the indexed set", not "not eligible", because only one of those is a fact about the wallet.

There is no countdown to the next payout, on purpose (docs §05, "What makes a cycle wait"). The header names the
keeper's next two-hour slot, which is when it wakes, not a promise that it pays. The one countdown on the site is
the portfolio's "Next payment · estimate" card, which counts down to ouro-monitor's per-wallet estimate and is
labelled as one.

## The portfolio (`/portfolio`)

The connected wallet's view of the same data the airdrops page shows for everyone, added 2026-09-10 after
theindex.finance's `#/portfolio`: its $OURO and what that is worth, its share of every cycle, every
airdrop it has received with the transaction that paid it, what it holds now, and what it has in the
three vaults. The page is always the connected wallet's. `/portfolio/?address=0x…` shows another
wallet instead. There is still **no lookup field**: one was built and removed on 2026-09-10 at the
owner's request, and the page is the connected wallet's unless a link says otherwise. But the URL itself
is no longer a secret. On 2026-09-11 the owner asked for the share card's QR to open it, which makes
showing another holder your portfolio the point of that feature rather than a leak in it. The address in
the link wins over the connected wallet, so everyone who opens such a link sees the same page, and a line
under the connect bar says whose wallet is on screen, because a page headed "Your portfolio" must not
print someone else's figures unlabelled.
The query string is read on the client only, in `PortfolioLive`, because the route is prerendered and
has no query string at build; an address that is not one is ignored.

**Where each figure comes from.** ouro-monitor's per-wallet API (its docs: `PORTFOLIO-API.md` in that repo; a
rendered copy sits at `../PORTFOLIO-API.html`). `hooks/usePortfolio.ts` → `usePortfolioSummary` polls
`GET /v1/portfolio/{address}` every thirty seconds; one payload carries the balance, the standing against
the line and the share of the payable supply from the monitor's holder snapshot; the lifetime airdrop value,
**valued at what each cycle paid the token out at** rather than at today's price; the projection at recent
cycles' average; the per-wallet next-payment estimate (`next`, the same shape as
`/v1/portfolio/{address}/next`), which is what the "Next payment · estimate" card counts down to rather than
the keeper's global slot, because a wallet just over the line is credited every cycle but paid only once what
it is owed covers the gas to send it; and the wallet's holdings and vault positions, which the monitor reads
live from the chain as it serves the request (`liveError` when that read failed, and the page says so). The
history is `/v1/portfolio/{address}/airdrops?limit=60`, paged by `before`: `useAirdropPayments` polls the
newest page every minute, fetches older pages as the reader turns towards them (one page ahead), and keeps
everything by transaction hash so a re-poll can only add. A null dollar figure from the monitor means
unknown, not zero, and prints as a dash. Until 2026-09-11 the page read the chain itself (a wagmi multicall
for the balances, one `eth_getLogs` over six million blocks for the history, matched to `/v1/ouro/epochs`
for prices); that code, and the second RPC list it needed, went when the monitor grew the endpoint. No
account and no sign-in: the page asks the monitor for one address and shows what comes back.

**The share card.** "Share" in the connect bar opens a dialog holding a 1080x1350 image of what the wallet
has been paid, to save, copy or hand to the phone's share sheet. It is painted straight onto a canvas
(`lib/shareCard.ts`), so what is on screen IS the file that gets saved and there is no second rendering
path to keep in step; it is set in the site's own faces, on the warm ground, with the home page's guilloché
banded across the figure as a watermark (the plate comes from the same `lib/guilloche.ts` maths). Three
The code opens that wallet's own `/portfolio/?address=…`, which is what the card is for: whoever scans
it sees every payout the wallet has received, read from the chain in front of them. The address is
therefore printed beside the code as well as encoded in it, because a card carrying an address it does
not name is the worse of the two. The card is offered for any wallet on screen, paid or not, so a holder
who has just crossed the line has something to post; an unpaid card says so plainly and swaps its
footnote. Two things are still off it. The balance, which is offered behind a toggle in the dialog,
defaulting to shown. And "at the current rate", because it is a projection and the monitor's is currently
about twice what a wallet's own payments come to, which has no business on an image that travels without
the page's caveats. The code is built by `lib/qr.ts`, ~250 lines of byte-mode level-M QR for versions 1 to 6
(the wallet URL is 83 characters, a version 5 symbol; an origin long enough to overflow version 6 leaves
the panel as type alone rather than throwing),
written rather than installed so one 21-character URL does not pull a dependency into the client bundle;
`node scripts/qr-check.mjs` proves it matches the `qrcode` package's matrices at every mask.

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
- **Fonts** are self-hosted Latin subsets in `public/fonts` (`packages/ds/src/styles/fonts.css`), preloaded from `root.tsx`; no
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
