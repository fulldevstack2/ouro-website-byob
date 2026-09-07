/**
 * Client for ouro-monitor (../ouro-monitor), the indexer that watches Robinhood Chain and serves
 * JSON. The base URL is inlined at build time (`MONITOR_API_URL`); without it the page renders its
 * "monitor not configured" state — dashes, never made-up numbers.
 *
 * Two surfaces, and they are deliberately separate:
 *   - `/v1/summary` covers the two upstream dividend tokens the vaults farm (INDEX, HOOD10) → /monitor
 *   - `/v1/reserve` covers Ouro's own protocol-owned liquidity → /ledger
 */
import { useEffect, useRef, useState } from "react";

/**
 * Set at build time by `vite.config.ts`, which is the single place the origin is decided — this used
 * to carry a second, different fallback (`http://localhost:8787` in dev), and a dev server with no
 * local monitor then reported an outage that read as a production one. Empty is still meaningful: it
 * gives the "not configured" state, dashes and no invented numbers.
 */
export const MONITOR_API: string = typeof __MONITOR_API__ === "string" ? __MONITOR_API__ : "";

/** `/v1/summary` covers the two upstream tokens; $OURO has its own endpoints, not that one. */
export type TokenKey = "index" | "hood10";
export type OuroKey = "ouro";
export type Liveness = "ok" | "late" | "stalled" | "unknown";

export interface AssetOut {
  address: string;
  symbol: string | null;
  decimals: number | null;
  amount: string;
  amountF: number;
  usd: number | null;
  recipients: number | null;
}
export interface EpochOut {
  epoch: number;
  status: string;
  startTs: number | null;
  endTs: number | null;
  startBlock: number | null;
  endBlock: number | null;
  paidUsd: number | null;
  costUsd: number | null;
  recipients: number | null;
  holders: number | null;
  eligibleTokens: number | null;
  txs: number;
  assets: AssetOut[];
  meta: Record<string, unknown>;
}
export interface TaxSum {
  swaps: number;
  volume_eth: number;
  tax_eth: number;
}
export interface PaidSum {
  epochs: number;
  paid_usd: number;
  cost_usd: number;
}
export interface MarketRow {
  ts: number;
  price_usd: number | null;
  fdv_usd: number | null;
  vol24_all_usd: number | null;
  vol24_taxed_usd: number | null;
  taxed_share: number | null;
  pools: number | null;
  reserve_taxed_usd: number | null;
}
export interface TokenSummary {
  key: TokenKey;
  symbol: string;
  name: string;
  address: string;
  hook: string;
  hookPoolId: string;
  taxBps: number;
  dividendLineTokens: number;
  cadenceSec: number;
  indexedTo: number | null;
  epochsIndexed: number;
  market: MarketRow | null;
  tax: { h24: TaxSum; d7: TaxSum; all: TaxSum; exact: boolean; ethPriceUsd: number | null };
  paid: { h24: PaidSum; d7: PaidSum; all: PaidSum };
  lastEpoch: EpochOut | null;
  liveness: { status: Liveness; dueTs: number | null; overdueSec: number | null; lastTs: number | null; cadenceSec: number; source: string };
  holders: { aboveLine: number | null; total: number | null; recipientsLast: number | null };
  eligibleTokens: number | null;
  yield: { perLineUsdPerDay: number | null; aprPct: number | null; basisDays: number; paidUsdPerDay: number | null };
  flows: Record<string, { amount: number; count: number }>;
}
export interface Summary {
  generatedAt: number;
  chain: { id: number; name: string; explorer: string };
  head: number;
  tokens: Record<TokenKey, TokenSummary>;
}
export interface DailyRow {
  day: number;
  epochs: number;
  paid_usd: number | null;
  cost_usd: number | null;
  recipients: number | null;
  swaps: number;
  volume_eth: number;
  tax_eth: number;
  tax_usd: number | null;
  price_usd: number | null;
  taxed_share: number | null;
}
export interface AdminEvent {
  id: string;
  ts: number;
  block: number;
  contract: string;
  kind: string;
  severity: "info" | "warn" | "alert";
  summary: string;
  tx: string;
}

// ── the Reserve (/v1/reserve): Ouro's own protocol-owned liquidity ──

export interface ReserveSide {
  address: string;
  symbol: string | null;
  decimals: number;
  /** Raw units; null before the first live poll. */
  amount: string | null;
  amountF: number | null;
  /** Uncollected fees, from a `collect` simulation — not from stale `tokensOwed`. */
  feesF: number | null;
  /** Net of withdrawals: the cost basis still in the pool. */
  depositedF: number;
  collectedF: number;
  priceUsd: number | null;
}

export interface ReservePosition {
  tokenId: string;
  pool: string;
  /** The pool's tier, in hundredths of a bip: 3000 = 0.30%. */
  feeBps: number;
  /** What the LP actually keeps after the pool's protocol skim. Both Reserve pools: 2500, not 3000. */
  lpFeeBps: { fee0: number; fee1: number } | null;
  tickLower: number;
  tickUpper: number;
  tick: number | null;
  inRange: boolean | null;
  shareOfActiveLiquidity: number | null;
  side0: ReserveSide;
  side1: ReserveSide;
  valueUsd: number | null;
  uncollectedFeesUsd: number | null;
  collectedFeesUsd: number | null;
  hodlUsd: number | null;
  netVsHoldingUsd: number | null;
  held: boolean;
  adds: number;
  collects: number;
  firstTs: number | null;
  ownedFromTs: number | null;
  ownedToTs: number | null;
  snapshotTs: number | null;
  snapshotBlock: number | null;
}

export interface ReserveTotals {
  positions: number;
  inRange: number;
  navUsd: number | null;
  uncollectedFeesUsd: number | null;
  collectedFeesUsd: number | null;
  feesTotalUsd: number | null;
  /** What the deposited tokens would be worth simply held. */
  hodlUsd: number | null;
  /** nav − hodl: the divergence loss, normally negative. */
  divergenceUsd: number | null;
  /** **The headline.** nav + fees − hodl: what pooling earned over holding the same tokens. */
  netVsHoldingUsd: number | null;
  netVsHoldingPct: number | null;
  /** False when any leg is unpriced, so every USD figure above is known-incomplete. */
  priced: boolean;
  ageDays: number | null;
}

export interface ReserveSnapshot {
  ts: number;
  block: number;
  positions: number;
  in_range: number;
  nav_usd: number | null;
  fees_usd: number | null;
  hodl_usd: number | null;
  collected_usd: number | null;
  gas_eth: number | null;
  priced: number;
}

export interface Reserve {
  generatedAt: number;
  block: number | null;
  /**
   * The block the position ledger is complete to, or **null before the Reserve has ever been
   * synced** — the difference between "the treasury owns nothing" and "we have not looked yet".
   * Never render the second as the first; the totals are null, not zero, while this is null.
   */
  indexedTo: number | null;
  chain: { id: number; name: string; explorer: string };
  lp: string;
  positionManager: string;
  factory: string;
  totals: ReserveTotals;
  positions: ReservePosition[];
  gas: { eth: number | null; usd: number | null };
  history: ReserveSnapshot[];
}

export type ReserveEventKind = "mint" | "increase" | "decrease" | "collect" | "transfer_in" | "transfer_out";

export interface ReserveEvent {
  id: string;
  tokenId: string;
  kind: ReserveEventKind | string;
  ts: number;
  block: number;
  amount0F: number;
  amount1F: number;
  symbol0: string | null;
  symbol1: string | null;
  usd: number | null;
  tx: string;
}

// ── the airdrops (/v1/ouro/*): $OURO's own payouts ──

/** One asset in a closed cycle, or in the queue waiting to be streamed. */
export interface OuroAsset {
  address: string;
  symbol: string | null;
  decimals: number | null;
  amount: string;
  amountF: number;
  usd: number | null;
  recipients?: number | null;
}

/**
 * One payout transaction inside a cycle, as `/v1/ouro/epochs` returns it.
 *
 * A cycle number can be paid several times hours apart — the keeper re-uses a number when a run
 * broadcasts and then fails to commit its ledger — so this, not the cycle, is one airdrop. Absent
 * (or empty) from a monitor that predates the field, which the page falls back for.
 */
export interface OuroPayout {
  tx: string;
  block: number;
  ts: number;
  /** All-or-nothing: null when any leg of this transaction was unpriced. */
  paidUsd: number | null;
  recipients: number | null;
  assets: OuroAsset[];
}

/** One airdrop cycle, as `/v1/ouro/epochs` returns it. */
export interface OuroCycle {
  epoch: number;
  status: string;
  distributor: string;
  startTs: number | null;
  endTs: number | null;
  startBlock: number | null;
  endBlock: number | null;
  /** All-or-nothing: null when any leg of the cycle was unpriced. */
  paidUsd: number | null;
  costUsd: number | null;
  recipients: number | null;
  holders: number | null;
  eligibleTokens: number | null;
  txs: number;
  assets: OuroAsset[];
  /** The transactions that paid it, oldest first. Missing on an older monitor build. */
  payouts?: OuroPayout[];
  meta: Record<string, unknown>;
}

export interface OuroQueuedAsset {
  address: string;
  symbol: string | null;
  decimals: number;
  amount: string;
  amountF: number;
  usd: number | null;
}

/**
 * What is on its way to holders. `queued` is the airdrop wallet's balance, **not** the next payout:
 * a collection streams over ~48 h and a wallet owed less than the gas waits, so it is the pool the
 * next several cycles draw from.
 */
export interface OuroPending {
  pendingWei: string;
  tabWei: string;
  /** What a claim actually returns — letscash keeps 6% of the gross. */
  claimableWei: string;
  creator: string;
  treasury: string;
  queued: OuroQueuedAsset[];
  queuedUsd: number | null;
  block: number;
  at: number;
}

/** One day of the airdrop wallet: what landed, what went out, and what it closed at. */
export interface OuroQueueDay {
  day: number;
  inUsd: number | null;
  outUsd: number | null;
  /** Closing balance, valued at *that day's* price — not remarked at spot. */
  balanceUsd: number | null;
  balances: { asset: string; symbol: string | null; amountF: number }[];
  transfersIn: number;
  transfersOut: number;
  priced: boolean;
}

/**
 * What a holding earns, from payouts actually made.
 *
 * `perLineUsdPerDay` is a measurement and needs no token price. `aprPct` is an extrapolation: it is
 * published, but `caveat` has to travel with it — the same payouts annualise to wildly different
 * rates depending only on the window, so the basis is half the figure. `withheld` is the narrower
 * case of having nothing to state at all.
 */
export interface OuroYield {
  generatedAt: number;
  /** Days of payout history indexed: first cycle to now. */
  historyDays: number | null;
  /** The window the rate is measured over. */
  basisDays: number | null;
  cycles: number;
  paidUsd: number | null;
  paidUsdPerDay: number | null;
  /** Weighted supply that shares each cycle — excludes the pool, the vest and below-line wallets. */
  eligibleTokens: number | null;
  lineTokens: number;
  perLineUsdPerDay: number | null;
  perLineUsdPerMonth: number | null;
  priceUsd: number | null;
  /** One line at spot mid: what the quantity is worth. */
  lineCostUsd: number | null;
  /** Trade tax in basis points of the ETH leg — a buy pays it on top of the mid. */
  taxBps: number;
  /** What acquiring a line costs: mid + tax. A floor; it excludes pool slippage. */
  lineCostWithTaxUsd: number | null;
  /** Days for the payouts to cover the cost. Gated with `aprPct` — same claim, different units. */
  paybackDays: number | null;
  eligibleValueUsd: number | null;
  aprPct: number | null;
  /** False while the rate rests on less than a week of payouts. The number is published regardless. */
  annualisable: boolean;
  /**
   * The sentence that must be shown beside the rate when it rests on thin history — it names the
   * actual basis. Showing `aprPct` without this is showing half the data.
   */
  caveat: string | null;
  /** Set only when there is nothing to state at all: no payouts, or a cycle that could not be valued. */
  withheld: string | null;
}

export interface OuroHolder {
  address: string;
  /** Raw units, as a decimal string. */
  balance: string;
  eligible: boolean;
  /** Null when this address is paid; otherwise why it is not. */
  excluded: string | null;
}

export interface OuroHolders {
  token: string;
  chainId: number;
  symbol: string;
  decimals: number;
  /** The block the list is true as of; null before the first sync. */
  snapshotBlock: number | null;
  head: number;
  blocksBehind: number | null;
  secondsBehind: number | null;
  eligibilityLine: string;
  supplySeen: string;
  weightedBalance: string;
  counts: { holders: number; eligible: number; paid: number; belowLine: number; excludedByPolicy: number };
  exclusionPolicy: { address: string; reason: string }[];
  holders: OuroHolder[];
}

export interface Poll<T> {
  data: T | null;
  error: string | null;
  /** Wall-clock ms of the last successful fetch. */
  updatedAt: number | null;
  loading: boolean;
}

/**
 * Poll a monitor endpoint. Starts empty so the pre-rendered HTML equals the first client render,
 * refreshes every `intervalMs` while the tab is visible, and keeps the last good payload on errors.
 */
export function useMonitor<T>(path: string | null, intervalMs = 30_000): Poll<T> {
  const [state, setState] = useState<Poll<T>>({ data: null, error: null, updatedAt: null, loading: Boolean(path) });
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    if (!path || !MONITOR_API) {
      setState({ data: null, error: MONITOR_API ? null : "not-configured", updatedAt: null, loading: false });
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ctrl: AbortController | undefined;
    const run = async () => {
      ctrl?.abort();
      ctrl = new AbortController();
      try {
        const r = await fetch(`${MONITOR_API}${path}`, { signal: ctrl.signal, headers: { accept: "application/json" } });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as T;
        if (alive.current) setState({ data, error: null, updatedAt: Date.now(), loading: false });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        if (alive.current) setState((s) => ({ ...s, error: (e as Error).message, loading: false }));
      }
      if (alive.current) timer = setTimeout(run, document.visibilityState === "visible" ? intervalMs : intervalMs * 4);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        void run();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    void run();
    return () => {
      alive.current = false;
      clearTimeout(timer);
      ctrl?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [path, intervalMs]);
  return state;
}

// ── formatting ──
export function fmtUsd(n: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (opts.compact && abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (opts.compact && abs >= 10_000) return `$${(n / 1_000).toFixed(1)}k`;
  if (abs >= 1000) return `$${Math.round(n).toLocaleString("en-US")}`;
  if (abs >= 1) return `$${n.toFixed(2)}`;
  if (abs === 0) return "$0";
  return `$${n.toPrecision(3)}`;
}
export function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
export function fmtEth(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (n >= 100) return n.toFixed(1);
  if (n >= 1) return n.toFixed(3);
  return n.toFixed(4);
}
export function fmtPct(x: number | null | undefined, digits = 1): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}
export function ago(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return "—";
  const s = Math.max(0, sec);
  if (s < 60) return `${Math.round(s)} s`;
  if (s < 5400) return `${Math.round(s / 60)} min`;
  if (s < 172_800) return `${(s / 3600).toFixed(1)} h`;
  return `${(s / 86_400).toFixed(1)} d`;
}
export function fmtWhen(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toISOString().replace("T", " ").slice(5, 16) + " UTC";
}
export function shortHash(h: string): string {
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

/** A signed USD figure, so a loss is never mistaken for a gain. `—` when unknown. */
export function fmtUsdSigned(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (n === 0) return "$0.00";
  const body = fmtUsd(Math.abs(n));
  return `${n > 0 ? "+" : "−"}${body}`;
}

/** A token amount at a sensible precision for its size. */
export function fmtTokens(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (abs >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (abs === 0) return "0";
  return n.toPrecision(3);
}

/** Hundredths of a bip → a percentage: 3000 → "0.30%". */
export function fmtFeeTier(bps: number | null | undefined): string {
  if (bps === null || bps === undefined || !Number.isFinite(bps)) return "—";
  return `${(bps / 10_000).toFixed(2)}%`;
}

/** Signed percent for a delta, e.g. "+0.41%". */
export function fmtPctSigned(x: number | null | undefined, digits = 2): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  return `${x > 0 ? "+" : x < 0 ? "−" : ""}${(Math.abs(x) * 100).toFixed(digits)}%`;
}

/** "1.2 days" / "18 h", for the basis of any rate-of-return reading. */
export function fmtAge(days: number | null | undefined): string {
  if (days === null || days === undefined || !Number.isFinite(days)) return "—";
  if (days < 1) return `${Math.round(days * 24)} h`;
  if (days < 10) return `${days.toFixed(1)} days`;
  return `${Math.round(days)} days`;
}
