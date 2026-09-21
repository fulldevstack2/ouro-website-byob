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
  type OuroHolders,
  type OuroYield,
  type Reserve,
  type Summary,
  type TokenSummary,
} from "@ouro/monitor-client";

import { cadenceStats, type CadenceStats } from "~/lib/cadence";
import { EMPTY_MARKET, useMarkets, type TokenMarket } from "~/lib/dexscreener";
import { PROJECTS, type Project, type SortKey } from "~/registry";

/** Protocol-owned liquidity, and what the figure leaves out. */
export interface Treasury {
  /** Net asset value of the owned positions, marked to market. */
  navUsd: number | null;
  /** Positions behind that figure. */
  positions: number | null;
  /**
   * Positions held in venues the indexer does not read, which `navUsd` therefore excludes.
   *
   * `null` means a venue could not be read at all, which is a stronger caveat than a count: we
   * cannot say how much is missing. Zero means nothing is. The Ledger makes the same distinction in
   * its own NAV footnote, and a treasury figure that quietly omitted a venue would read as the
   * whole of it.
   */
  unreadVenuePositions: number | null;
}

const EMPTY_TREASURY: Treasury = { navUsd: null, positions: null, unreadVenuePositions: null };

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
  /**
   * Payout cycles this project has run, all time.
   *
   * Counted server-side for INDEX and HOOD10 (`paid.all.epochs`, 2,866 and 45), and from the cycle
   * page for $OURO, which has no server-side count — so that one is a floor and `cyclesTruncated`
   * says when the page came back full. It exists for the page total: "3,014 payout cycles" is the
   * single figure that says what the airdrop meta on this chain adds up to.
   */
  cyclesAllTime: number | null;
  cyclesTruncated: boolean;
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

  /**
   * Liquidity the protocol itself owns, marked to market.
   *
   * Nulls all the way down for a project that keeps none, which is INDEX and HOOD10 — the registry's
   * `none` coverage is what says so in the cell, because a null here cannot tell "keeps none" apart
   * from "not read yet" and the page must never let a reader confuse the two.
   */
  treasury: Treasury;
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
  const cut = now - (basisDays ?? 3) * 86_400;
  const inWindow = closed.filter((c) => (c.endTs ?? 0) >= cut);
  return {
    pricedPeriods: closed.filter((c) => c.paidUsd !== null).length,
    closedPeriods: closed.length,
    aprWindowPriced: inWindow.filter((c) => c.paidUsd !== null).length,
    aprWindowTotal: inWindow.length,
  };
}

/**
 * APR from paid USD and the Dex price the Matrix shows — same formula as ouro-monitor's
 * `impliedAprPct`, so the rate cell and the price cell use one spot.
 */
export function aprAtPrice(
  paidUsdPerDay: number | null | undefined,
  eligibleTokens: number | null | undefined,
  priceUsd: number | null | undefined,
): number | null {
  if (
    paidUsdPerDay == null ||
    eligibleTokens == null ||
    eligibleTokens <= 0 ||
    priceUsd == null ||
    priceUsd <= 0
  ) {
    return null;
  }
  return (paidUsdPerDay / (eligibleTokens * priceUsd)) * 365 * 100;
}

/** Closed-cycle end times only — open / paying epochs must not move "last paid". */
function closedCadence(cycles: OuroCycle[] | null, now: number): CadenceStats {
  const closed = (cycles ?? []).filter((c) => c.status === "closed");
  return cadenceStats(
    closed.map((c) => c.endTs ?? c.startTs),
    now,
  );
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
    cyclesAllTime: null,
    cyclesTruncated: false,
    assets: null,
    holdersAboveLine: null,
    recipientsLast: null,
    ratePerLineUsdPerDay: null,
    aprPct: null,
    aprBasisDays: null,
    aprHistoryDays: null,
    cadence: cadenceStats([], Math.floor(Date.now() / 1000)),
    treasury: EMPTY_TREASURY,
  };
}

/**
 * INDEX and HOOD10 both come out of `/v1/summary` already in one shape.
 *
 * `cycles` is that project's payout history, used only to measure its real cadence (closed only).
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
    cadence: closedCadence(cycles, now),
    ...pricingCoverage(cycles, now, t?.yield?.basisDays ?? null),
  };
  if (!t) return row;
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
     *  · Epochs ARE indexed but carry no USD value (a cycle with any unpriced leg). Rendering that
     *    sum as $0 would be a false statement about a live competitor.
     *
     * A project that genuinely paid nothing in a window has no epochs in it, which `epochs === 0`
     * already distinguishes.
     */
    paidAllTimeUsd: unvaluedZero(t.indexedTo, t.paid?.all),
    paid24hUsd: unvaluedZero(t.indexedTo, t.paid?.h24),
    cyclesAllTime: t.paid?.all?.epochs ?? null,
    assets: t.lastEpoch?.assets?.map((a) => ({ address: a.address, symbol: a.symbol })) ?? null,
    holdersAboveLine: t.holders?.aboveLine ?? null,
    recipientsLast: t.holders?.recipientsLast ?? null,
    ratePerLineUsdPerDay: t.yield?.perLineUsdPerDay ?? null,
    // Prefer APR at the Dex price the Matrix shows; fall back to the monitor's Gecko-based APR.
    aprPct: aprAtPrice(t.yield?.paidUsdPerDay, t.eligibleTokens, volume.priceUsd) ?? t.yield?.aprPct ?? null,
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
  /**
   * Wallets that share payouts: `/v1/ouro/holders` `counts.paid` (above the line after policy
   * exclusions). Matches the payable set yield/APR use — not `counts.eligible`, which still
   * includes Sablier and the PoolManager.
   */
  holdersAboveLine: number | null,
  /** The Reserve, for the one project on this page that owns liquidity. */
  reserve: Reserve | null,
): ProjectRow {
  const row = {
    ...blankRow(project),
    volume,
    cadence: closedCadence(cycles, now),
    ...pricingCoverage(cycles, now, y?.basisDays ?? null),
  };
  const priced = cycles?.filter((c) => c.paidUsd !== null) ?? null;
  const allTime = priced && priced.length > 0 ? priced.reduce((sum, c) => sum + (c.paidUsd ?? 0), 0) : null;

  const dayAgo = Date.now() / 1000 - 86_400;
  const last24 = priced?.filter((c) => (c.endTs ?? 0) >= dayAgo) ?? null;
  const paid24h = last24 && last24.length > 0 ? last24.reduce((s, c) => s + (c.paidUsd ?? 0), 0) : null;

  const lastClosed = (cycles ?? []).find((c) => c.status === "closed") ?? null;
  const lastCycle = lastClosed ?? cycles?.[0] ?? null;

  /**
   * A venue reporting zero is not news; a venue that could not be read is, because that is coverage
   * we cannot claim. One unreadable venue makes the whole exclusion unknown rather than a count,
   * which is why this collapses to null the moment any entry has none. Same rule as the Ledger's.
   */
  const unread = (reserve?.unindexed ?? []).filter((u) => u.count === null || u.count > 0);
  const unreadVenuePositions = unread.some((u) => u.count === null)
    ? null
    : unread.reduce((n, u) => n + (u.count ?? 0), 0);

  return {
    ...row,
    treasury: {
      // Null while the Reserve has never been synced, which the monitor already reports as null
      // totals rather than an empty treasury.
      navUsd: reserve?.totals.navUsd ?? null,
      positions: reserve?.totals.positions ?? null,
      unreadVenuePositions: reserve ? unreadVenuePositions : null,
    },
    priceUsd: volume.priceUsd,
    // A real fully diluted value now, rather than the eligible supply at spot standing in for one.
    marketCapUsd: volume.fdvUsd,
    paidAllTimeUsd: allTime,
    // A full page means there may be more behind it; 86 cycles today, but the guard is the point.
    paidAllTimeTruncated: (cycles?.length ?? 0) >= OURO_CYCLE_PAGE,
    paid24hUsd: paid24h,
    // No server-side count for $OURO, so this is the cycle page and carries the same floor
    // guard as the total above it.
    cyclesAllTime: cycles?.filter((c) => c.status === "closed").length ?? null,
    cyclesTruncated: (cycles?.length ?? 0) >= OURO_CYCLE_PAGE,
    assets: lastCycle?.assets?.map((a) => ({ address: a.address, symbol: a.symbol })) ?? null,
    holdersAboveLine,
    recipientsLast: lastCycle?.recipients ?? null,
    ratePerLineUsdPerDay: y?.perLineUsdPerDay ?? null,
    aprPct: aprAtPrice(y?.paidUsdPerDay, y?.eligibleTokens, volume.priceUsd) ?? y?.aprPct ?? null,
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
  const ouroYield = useMonitor<OuroYield>("/v1/ouro/yield?days=3", intervalMs);
  const ouroCycles = useMonitor<{ epochs: OuroCycle[] }>("/v1/ouro/epochs?limit=200", intervalMs);
  /**
   * INDEX's own cycles, for its measured cadence. A fifth request purely to avoid describing a
   * project by a schedule it does not keep — and the first thing `/v1/projects` should fold in,
   * since the server can compute these percentiles once instead of every browser doing it.
   */
  const indexCycles = useMonitor<{ epochs: OuroCycle[] }>("/v1/index/epochs?limit=200", intervalMs);
  /** HOOD10's periods, live since its backfill was re-enabled on 2026-09-12. */
  const hood10Cycles = useMonitor<{ epochs: OuroCycle[] }>("/v1/hood10/epochs?limit=200", intervalMs);
  /**
   * $OURO holders that share payouts (`counts.paid`). The payload is the payout registry (~180 KB,
   * uncached), so this polls on the same slow cadence as the airdrops page rather than every
   * `intervalMs`. Prefer a count-only field on `/v1/projects` or `/v1/summary` when those land.
   */
  const ouroHolders = useMonitor<OuroHolders>("/v1/ouro/holders?min=100000", 120_000);
  /**
   * The Reserve, for the protocol-owned liquidity row. `hours=1` because only `totals` and
   * `unindexed` are read here: the Ledger asks for 720 hours because it draws the history, and
   * pulling a month of snapshots to render one cell would be the expensive way to get one number.
   */
  const reserve = useMonitor<Reserve>("/v1/reserve?hours=1", 120_000);

  const polls = [summary, ouroYield, ouroCycles, indexCycles, hood10Cycles, ouroHolders, reserve];
  const configured = !polls.some((p) => p.error === "not-configured");

  const markets = useMarkets(PROJECTS.map((p) => ({ token: p.token, canonicalPoolId: p.canonicalPoolId })));

  const now = Math.floor(Date.now() / 1000);
  const rows = PROJECTS.map((project) => {
    const market = markets[project.token.toLowerCase()] ?? EMPTY_MARKET;
    if (project.key === "ouro") {
      return fromOuro(
        project,
        ouroYield.data,
        ouroCycles.data?.epochs ?? null,
        now,
        market,
        ouroHolders.data?.counts.paid ?? null,
        reserve.data,
      );
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
 * The one comparable number behind a metric, for ranking.
 *
 * Always oriented so that BIGGER IS FIRST, which is why two of these are negated: sorting by how
 * often a project pays has to put the shortest gap at the top, and sorting by when it last paid has
 * to put the most recent one there. The registry states the direction in words next to the control
 * (`SORT_ORDER`) so the reader is never left to infer it.
 */
export function metricValue(r: ProjectRow, key: SortKey): number | string | null {
  switch (key) {
    case "symbol":
      return r.project.symbol;
    case "price":
      return r.priceUsd;
    case "marketCap":
      return r.marketCapUsd;
    case "volume24h":
      return r.volume.totalUsd;
    case "paidAllTime":
      return r.paidAllTimeUsd;
    case "paid24h":
      return r.paid24hUsd;
    case "assets":
      return r.assets?.length ?? null;
    case "holders":
      return r.holdersAboveLine;
    case "recipients":
      return r.recipientsLast;
    case "ratePerLine":
      return r.ratePerLineUsdPerDay;
    case "apr":
      return r.aprPct;
    case "payoutRhythm":
      return r.cadence.medianH === null ? null : -r.cadence.medianH;
    case "lastPaid":
      return r.cadence.sinceLastH === null ? null : -r.cadence.sinceLastH;
    case "tax":
      return r.project.taxBps;
    case "treasury":
      return r.treasury.navUsd;
  }
}

/**
 * Sort, with nulls always last.
 *
 * A project with no data sinks to the bottom whichever column is chosen, rather than sorting as if
 * it were zero — which would put an unindexed project at the top of an ascending sort and read as a
 * claim about it.
 */
export function sortRows(rows: ProjectRow[], key: SortKey): ProjectRow[] {
  return [...rows].sort((a, b) => {
    const x = metricValue(a, key);
    const y = metricValue(b, key);
    if (x === null && y === null) return a.project.symbol.localeCompare(b.project.symbol);
    if (x === null) return 1;
    if (y === null) return -1;
    if (typeof x === "string" || typeof y === "string") return String(x).localeCompare(String(y));
    return y - x;
  });
}
