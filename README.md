# ouro-web

pnpm workspace for the two public front ends and the code they share.

```
apps/site/          ourolayer.com — marketing, docs, Ledger, airdrops, vaults, portfolio
apps/analytics/     analytics.ourolayer.com — the airdrop meta on Robinhood Chain, all projects
packages/ds/        the Ouro design system: components, tokens, self-hosted faces
packages/monitor-client/   typed client for ouro-monitor's JSON API
```

`apps/site/README.md` is the site's own documentation and is unchanged by the split.

## Why a workspace

The analytics dashboard shares the site's design surface. Once that was decided, a separate repo
bought nothing and cost drift: two copies of the design system diverge, and the API response types
ARE the contract with the indexer, so a second copy of those is a second contract.

So both are apps in one repo over two shared packages, deployed as two independent Netlify sites.

## Getting started

```bash
pnpm install
pnpm dev              # apps/site        → http://localhost:5173
pnpm dev:analytics    # apps/analytics   → http://localhost:5174
pnpm typecheck        # every package and app
pnpm build            # both apps
```

Point either app at a local indexer with `MONITOR_API_URL=http://localhost:8787`. Both default to
the live monitor, so a fresh clone shows real data with no setup.

## Deploying

**Two Netlify sites, one repo.** Each app carries its own `netlify.toml`; what is not in the file is
the base directory, which is set per site in the Netlify UI:

| Site | Base directory | Publishes |
|---|---|---|
| ourolayer.com | `apps/site` | `apps/site/build/client` |
| analytics.ourolayer.com | `apps/analytics` | `apps/analytics/build/client` |

Netlify reads the `netlify.toml` at the base directory, and `pnpm install` run from there walks up to
the workspace root and installs the whole workspace — which is what the `@ouro/*` packages need in
order to resolve.

> **The site's base directory has to change from `/` to `apps/site` at the same time this merges**,
> or its build will look for a `package.json` that is no longer at the root.

## The shared packages

**`@ouro/ds`** — the components (`Badge`, `Button`, `Card`, `Stat`, `LedgerTable`, …), the tokens, and
the four self-hosted `woff2` faces. Consumed as TypeScript source: Vite compiles it through the
workspace symlink, so there is no build step and no `dist` to keep in step.

`styles.css` is faces + tokens; `tokens.css` is tokens alone. The faces are referenced by absolute
`/fonts/…` URL, so **each app serves its own copy in `public/fonts`**. They are duplicated on
purpose — ~100 KB of pinned subsets against a copy step that can silently not run.

**`@ouro/monitor-client`** — the response types, the `useMonitor()` poller and the formatters. It
declares `__MONITOR_API__` but cannot define it; every consuming app must `define` it in its own
`vite.config.ts`, because the two may legitimately point at different origins.

## The analytics app

Two ideas carry it, both in `apps/analytics/app/registry.ts`:

**The registry.** A project is a config entry, a source adapter in `ouro-monitor`, and a coverage
manifest. Adding the next tax-index token that launches should change that file and nothing else.
`LAUNCHPAD_FIXTURE` is a fourth entry kept un-shipped as the check on that claim.

**The coverage manifest.** The site ranks projects it does not run, on a domain one of them owns.
That only works if what each figure rests on is stated beside the figure — and the asymmetry does not
run one way. INDEX's tax is *estimated* because its hook emits nothing; Ouro's is measured; HOOD10's
will be *exact* once indexed. So every metric carries a state (`measured` / `estimated` /
`not_indexed`) with its reason, one component renders it identically for every project, and a blank
cell has a reason attached rather than reading as a verdict.

Three rules the rendering enforces:

- **A measured figure gets no mark.** The number is the statement; marking everything makes the marks
  invisible.
- **A missing figure is a dash with a reason, never a zero.** Zero is a claim about the project; a
  dash is a statement about our coverage.
- **Status is carried by shape and text, never hue alone.** The brand's green, amber and red fail
  colour-vision separation against each other (deutan ΔE 3.0 for the red/amber pair), so a traffic
  light here would be unreadable for some readers and meaningless in greyscale.

### Known, and deliberate

- **`lib/projects.ts` composes the comparison row from four requests.** `/v1/summary` carries INDEX
  and HOOD10 in one shape while $OURO answers on its own routes, and its all-time total is not served
  at all — it is summed from a `limit=200` page of its cycles, which is a ceiling rather than a
  guarantee. That asymmetry is the argument for `GET /v1/projects`; when that lands, `useProjects()`
  becomes one call and everything below `ProjectRow` is deleted. Nothing else should change.
- **$OURO's holders-above-the-line is measured from `/v1/ouro/holders`.** The full registry is
  polled on a slow cadence (same as the airdrops page) and only `counts.paid` is kept (above the
  line after policy exclusions). Prefer a count-only field on `/v1/projects` when that lands, so the
  dashboard does not download the list.
- **The prerendered HTML has no figures in it.** Every number is fetched in the browser, so a crawler
  or a link preview sees the table with dashes. Fixing it properly means build-time data, which wants
  `/v1/projects` first.
