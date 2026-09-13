/**
 * One uniform row per project, composed from the endpoints ouro-monitor serves today.
 *
 * ── The seam ──
 * `ProjectRow` is deliberately the shape `GET /v1/projects` will return (scope §7.2). Until that
 * endpoint exists this file builds it on the client out of four separate requests, because the
 * monitor's current surface is not uniform: `/v1/summary` carries INDEX and HOOD10 in one shape,
 * while $OURO answers on its own routes under different names, and its all-time total is not served
 * at all — it has to be summed out of its cycles.
 *
 * That asymmetry is the argument for the endpoint, and having written this file is the cheapest
 * possible proof of it. When `/v1/projects` ships, `useProjects()` becomes one `useMonitor` call and
 * everything below `ProjectRow` is deleted. Nothing else in the app should change, which is the test
 * that the shape was right.
 */
import {
  useMonitor,
  type OuroCycle,
  type OuroYield,
  type Summary,
  type TokenSummary,
} from "@ouro/monitor-client";

import { cadenceStats, type CadenceStats } from "~/lib/cadence";
import { EMPTY_MARKET, useMarkets, type TokenMarket } from "~/lib/dexscreener";
import { PROJECTS, type Project, type SortKey } from "~/registry";

/** What every project page and the comparison table read. The future `/v1/projects` row. */
export interface ProjectRow {
  project: Project;

  priceUsd: number | null;
  marketCapUsd: number | null;
  /**
   * 24h volume across every pool the token trades in, and how much of it paid the tax.
   *
   * From DexScreener rather than the indexer — see lib/dexscreener.ts. It covers all three projects
   * uniformly (the indexer does not carry $OURO's), needs no source adapter for a new project, and
   * agreed with the indexer to a fraction of a percent when checked.
   */
  volume: TokenMarket;

  paidAllTimeUsd: number | null;
  /**
   * True when `paidAllTimeUsd` is a sum over a page that came back FULL, so older cycles may exist
   * beyond it and the total is a floor rather than a total. The page must say so when set.
   */
  paidAllTimeTruncated: boolean;
  /**
   * How many of this project's closed payout cycles carry a USD value at all.
   *
   * The monitor already refuses to value a single cycle whose legs it cannot price — it publishes a
   * dash rather than the sum of the priced legs. The same discipline has to survive aggregation,
   * because a project total silently drops the unpriced cycles to zero. HOOD10 makes the case: 4 of
   * its 43 periods are priced, so its all-time total of $34,247 covers 2,930 of 33,715 recipient
   * payouts — under a tenth of what it has actually paid, presented as the whole of it.
   *
   * INDEX and $OURO are fully priced, so for them these are equal and nothing is shown.
   */
  pricedPeriods: number | null;
  closedPeriods: number | null;
  /** The same ratio, restricted to the window the APR is measured over. */
  aprWindowPriced: number | null;
  aprWindowTotal: number | null;
  paid24hUsd: number | null;
  /** Distinct assets the last cycle paid out, for the "tokens paid" cell. */
  assets: { address: string; symbol: string | null }[] | null;

  holdersAboveLine: number | null;
  recipientsLast: number | null;

  /** What one dividend line earns per day. Needs no token price: cycles allocate pro-rata. */
  ratePerLineUsdPerDay: number | null;
  aprPct: number | null;
  /** The window the rate rests on. Never render `aprPct` without it. */
  aprBasisDays: number | null;
  /** Total history behind that window, which is the other half of the same caveat. */
  aprHistoryDays: number | null;

  /**
   * How often this project actually pays, measured from its own cycles.
   *
   * The configured cadence describes the schedule; this describes the behaviour, and for every
   * project here they differ substantially. See lib/cadence.ts for why the page reports the
   * distribution instead of a status badge.
   */
  cadence: CadenceStats;
}

/**
 * A paid total, or null when the zero is ours rather than the project's.
 *
 * `{ epochs: 4, paid_usd: 0 }` means four payout cycles were indexed and none could be valued —
 * unknown, not nothing. `{ epochs: 0, paid_usd: 0 }` means no cycle happened in the window, which
 * is a real zero and safe to show.
 */
function unvaluedZero(indexedTo: number | null, sum: { epochs?: number; paid_usd?: number | null } | undefined): number | null {
  if (indexedTo === null || !sum) return null;
  const usd = sum.paid_usd ?? null;
  if (usd === null) return null;
  if (usd === 0 && (sum.epochs ?? 0) > 0) return null;
  return usd;
}

/** Pricing coverage over all closed cycles, and over the APR's own window. */
function pricingCoverage(cycles: OuroCycle[] | null, now: number, basisDays: number | null) {
  const closed = (cycles ?? []).filter((c) => c.status === "closed");
  if (closed.length === 0) return { pricedPeriods: null, closedPeriods: null, aprWindowPriced: null, aprWindowTotal: null };
  const cut = now - (basisDays ?? 7) * 86_400;
  const inWindow = closed.filter((c) => (c.endTs ?? 0) >= cut);
  return {
    pricedPeriods: closed.filter((c) => c.paidUsd !== null).length,
    closedPeriods: closed.length,
    aprWindowPriced: inWindow.filter((c) => c.paidUsd !== null).length,
    aprWindowTotal: inWindow.length,
  };
}

/** An empty row: every figure null, so a project with no data renders dashes, never zeroes. */
function blankRow(project: Project): ProjectRow {
  return {
    project,
    priceUsd: null,
    marketCapUsd: null,
    volume: EMPTY_MARKET,
    paidAllTimeUsd: null,
    paidAllTimeTruncated: false,
    pricedPeriods: null,
    closedPeriods: null,
    aprWindowPriced: null,
    aprWindowTotal: null,
    paid24hUsd: null,
    assets: null,
    holdersAboveLine: null,
    recipientsLast: null,
    ratePerLineUsdPerDay: null,
    aprPct: null,
    aprBasisDays: null,
    aprHistoryDays: null,
    cadence: cadenceStats([], Math.floor(Date.now() / 1000)),
  };
}

/**
 * INDEX and HOOD10 both come out of `/v1/summary` already in one shape.
 *
 * `cycles` is that project's payout history, used only to measure its real cadence. HOOD10 has none
 * (never indexed), so its cadence stats come back empty and render as dashes — which is correct: we
 * cannot describe a rhythm we have not observed.
 */
function fromSummary(
  project: Project,
  t: TokenSummary | undefined,
  cycles: OuroCycle[] | null,
  now: number,
  volume: TokenMarket,
): ProjectRow {
  const row = {
    ...blankRow(project),
    volume,
    cadence: cadenceStats((cycles ?? []).map((c) => c.endTs ?? c.startTs), now),
    ...pricingCoverage(cycles, now, t?.yield?.basisDays ?? null),
  };
  if (!t) return row;
  const m = t.market;
  return {
    ...row,
    // Price and FDV come from `volume`'s payload, set on the row above — not from the indexer's
    // market row, so all three projects report the same quantity from the same source.
    priceUsd: volume.priceUsd,
    marketCapUsd: volume.fdvUsd,
    /**
     * Zero is a claim about the project; withhold it unless we can stand behind it.
     *
     * Two ways a zero arrives here and neither means "this project has paid nothing":
     *
     *  · `indexedTo === null` — the source has never synced, and the SQL sum over no rows is 0.
     *  · Epochs ARE indexed but carry no USD value. HOOD10 does exactly this: it marks payouts to
     *    GeckoTerminal daily closes, and the closes for its ten basket constituents at its 2026-08
     *    periods do not resolve, so `paid_usd` sums to 0 against real epochs that really paid —
     *    576, 602, 676 and 652 wallets in the first four. Rendering that as $0 would be a false
     *    statement about a live competitor.
     *
     * A project that genuinely paid nothing in a window has no epochs in it, which `epochs === 0`
     * already distinguishes.
     */
    paidAllTimeUsd: unvaluedZero(t.indexedTo, t.paid?.all),
    paid24hUsd: unvaluedZero(t.indexedTo, t.paid?.h24),
    assets: t.lastEpoch?.assets?.map((a) => ({ address: a.address, symbol: a.symbol })) ?? null,
    holdersAboveLine: t.holders?.aboveLine ?? null,
    recipientsLast: t.holders?.recipientsLast ?? null,
    ratePerLineUsdPerDay: t.yield?.perLineUsdPerDay ?? null,
    aprPct: t.yield?.aprPct ?? null,
    aprBasisDays: t.yield?.basisDays ?? null,
    aprHistoryDays: null,
  };
}

/**
 * $OURO, assembled from three routes.
 *
 * All-time paid is summed out of `/v1/ouro/epochs` because nothing serves it directly. `limit=200`
 * covers every cycle so far with room to spare, but it is a ceiling, not a guarantee — one more
 * reason the total belongs on the server. A cycle with any unpriced leg has `paidUsd === null`;
 * those are skipped rather than counted as zero, and `pricedCycles` says how many were counted.
 */
const OURO_CYCLE_PAGE = 200;

function fromOuro(
  project: Project,
  y: OuroYield | null,
  cycles: OuroCycle[] | null,
  now: number,
  volume: TokenMarket,
): ProjectRow {
  const row = {
    ...blankRow(project),
    volume,
    cadence: cadenceStats((cycles ?? []).map((c) => c.endTs ?? c.startTs), now),
    ...pricingCoverage(cycles, now, y?.basisDays ?? null),
  };
  const priced = cycles?.filter((c) => c.paidUsd !== null) ?? null;
  const allTime = priced && priced.length > 0 ? priced.reduce((sum, c) => sum + (c.paidUsd ?? 0), 0) : null;

  const dayAgo = Date.now() / 1000 - 86_400;
  const last24 = priced?.filter((c) => (c.endTs ?? 0) >= dayAgo) ?? null;
  const paid24h = last24 && last24.length > 0 ? last24.reduce((s, c) => s + (c.paidUsd ?? 0), 0) : null;

  const lastCycle = cycles?.[0] ?? null;
  return {
    ...row,
    priceUsd: volume.priceUsd,
    // A real fully diluted value now, rather than the eligible supply at spot standing in for one.
    marketCapUsd: volume.fdvUsd,
    paidAllTimeUsd: allTime,
    // A full page means there may be more behind it; 86 cycles today, but the guard is the point.
    paidAllTimeTruncated: (cycles?.length ?? 0) >= OURO_CYCLE_PAGE,
    paid24hUsd: paid24h,
    assets: lastCycle?.assets?.map((a) => ({ address: a.address, symbol: a.symbol })) ?? null,
    /**
     * NOT the recipient count.
     *
     * `/v1/summary` gives INDEX a true holders-above-the-line (4,088 as this was written). The
     * equivalent for $OURO lives on `/v1/ouro/holders`, which is the payout registry itself —
     * uncached by design, and not something a public dashboard should poll. Putting the last
     * cycle's recipient count here instead would have printed 315 under the same column header as
     * INDEX's 4,088: two different quantities, one label, and $OURO looking an order of magnitude
     * smaller than it is. `/v1/projects` should serve the count without the list.
     */
    holdersAboveLine: null,
    recipientsLast: lastCycle?.recipients ?? null,
    ratePerLineUsdPerDay: y?.perLineUsdPerDay ?? null,
    aprPct: y?.aprPct ?? null,
    aprBasisDays: y?.basisDays ?? null,
    aprHistoryDays: y?.historyDays ?? null,
  };
}

export interface ProjectsState {
  rows: ProjectRow[];
  loading: boolean;
  /** Set when any upstream request failed. The rows still render, with dashes where data is missing. */
  error: string | null;
  /** Newest upstream timestamp, for the "as of" line. */
  generatedAt: number | null;
  /** Whether the monitor origin is configured at all — a different state from "offline". */
  configured: boolean;
}

/**
 * Every project, in one call.
 *
 * Four requests today, one once `/v1/projects` lands. Each is separately cached and separately
 * recoverable: a failing $OURO yield leaves INDEX's row intact rather than emptying the page.
 */
export function useProjects(intervalMs = 30_000): ProjectsState {
  const summary = useMonitor<Summary>("/v1/summary", intervalMs);
  const ouroYield = useMonitor<OuroYield>("/v1/ouro/yield?days=7", intervalMs);
  const ouroCycles = useMonitor<{ epochs: OuroCycle[] }>("/v1/ouro/epochs?limit=200", intervalMs);
  /**
   * INDEX's own cycles, for its measured cadence. A fifth request purely to avoid describing a
   * project by a schedule it does not keep — and the first thing `/v1/projects` should fold in,
   * since the server can compute these percentiles once instead of every browser doing it.
   */
  const indexCycles = useMonitor<{ epochs: OuroCycle[] }>("/v1/index/epochs?limit=200", intervalMs);
  /** HOOD10's periods, live since its backfill was re-enabled on 2026-09-12. */
  const hood10Cycles = useMonitor<{ epochs: OuroCycle[] }>("/v1/hood10/epochs?limit=200", intervalMs);

  const polls = [summary, ouroYield, ouroCycles, indexCycles, hood10Cycles];
  const configured = !polls.some((p) => p.error === "not-configured");

  const markets = useMarkets(PROJECTS.map((p) => ({ token: p.token, canonicalPoolId: p.canonicalPoolId })));

  const now = Math.floor(Date.now() / 1000);
  const rows = PROJECTS.map((project) => {
    const market = markets[project.token.toLowerCase()] ?? EMPTY_MARKET;
    if (project.key === "ouro") {
      return fromOuro(project, ouroYield.data, ouroCycles.data?.epochs ?? null, now, market);
    }
    const cycles =
      project.key === "index"
        ? (indexCycles.data?.epochs ?? null)
        : project.key === "hood10"
          ? (hood10Cycles.data?.epochs ?? null)
          : null;
    return fromSummary(project, summary.data?.tokens?.[project.key as "index" | "hood10"], cycles, now, market);
  });

  return {
    rows,
    loading: polls.some((p) => p.loading),
    error: polls.find((p) => p.error && p.error !== "not-configured")?.error ?? null,
    generatedAt: summary.data?.generatedAt ?? ouroYield.data?.generatedAt ?? null,
    configured,
  };
}

/**
 * Sort, with nulls always last.
 *
 * A project with no data sinks to the bottom whichever column is chosen, rather than sorting as if
 * it were zero — which would put an unindexed project at the top of an ascending sort and read as a
 * claim about it.
 */
export function sortRows(rows: ProjectRow[], key: SortKey): ProjectRow[] {
  const value = (r: ProjectRow): number | string | null => {
    switch (key) {
      case "paidAllTime":
        return r.paidAllTimeUsd;
      case "marketCap":
        return r.marketCapUsd;
      case "apr":
        return r.aprPct;
      case "holders":
        return r.holdersAboveLine;
      case "symbol":
        return r.project.symbol;
    }
  };
  return [...rows].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    if (x === null && y === null) return a.project.symbol.localeCompare(b.project.symbol);
    if (x === null) return 1;
    if (y === null) return -1;
    if (typeof x === "string" || typeof y === "string") return String(x).localeCompare(String(y));
    return y - x;
  });
}
