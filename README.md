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
  routes.ts                /  /vaults  /monitor  /ledger  /docs   (the design's views + the vaults + the dividend monitor)
  routes/{home,vaults,monitor,ledger,docs}.tsx   monitor reads ../ouro-monitor over HTTP (app/lib/monitorApi.ts, MONITOR_API_URL at build)
  components/ds/           the Ouro design system: Badge, Button, Callout, Card, Stat, LedgerTable,
                           TokenChip, Input, Select, Tabs (ported from _ds_bundle.js, typed)
  components/site/         chrome + layout primitives: SiteNav, SiteFooter, Container, Grid, SectionHead,
                           PageHeader, MicroLabel, NumberedRow, KVRow, HelpTip, LoopRing, CrankFeed,
                           HeroRing (the guilloché plate in the home hero)
  lib/guilloche.ts         the plate's maths: one lathe trace, its family's index step, an SVG path
  content/site.ts          name, tagline, X handle, chain, `auditPublished`, external links (TODOs)
  content/protocol.ts      protocol contract list (TBD until launch), canonical infra addresses, parameters
  content/vaults.ts        the six vaults (HOOD10 / INDEX × pays in itself / WETH / USDG): status, terms, addresses
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

## Before launch

- **The mechanics changed on 2026-08-31** (5% tax · 4% basket / 1% ops · fees 80% airdropped to holders in kind / 20% compounded into the Reserve · no staking · no burn).
  The site copy and `docs/DOCS.md` are updated; **the contracts in `../basket-flywheel` are not** — they still ship a 2.5% tax hard-capped at 3%, a `StakingVault`
  and a burn. See that repo's `CONTRACTS.md` → "The design has moved ahead of this code".
- `content/protocol.ts` → set the tax ceiling the hook will enforce, then state it in docs §10, §11 and the "Can the team rug?" FAQ (they currently say
  "the ceiling the hook sets at deploy" rather than a number).
- `content/site.ts` → fill `links.explorer` and `links.robinhoodChain` (currently `#`), confirm the X handle, flip `auditPublished` when the report is out.
- `content/protocol.ts` → set the seven protocol contract addresses (they render as "Publishes at launch" while `null`).
- `content/vaults.ts` → flip each vault's `status` (`in-build` → `awaiting-deploy`) and set its `address` as contracts ship; set `TERMS.appUrl` once the vault app is hosted.
- Ledger / crank feed / stats show a dash placeholder by design until the `Cranked` event exists; add the data layer where those values are rendered.
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
