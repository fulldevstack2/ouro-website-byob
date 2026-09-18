/// <reference path="./globals.d.ts" />
// ^ Pulls the `__MONITOR_API__` declaration in for CONSUMERS as well as for this package's own
//   typecheck. Without it the declaration is only visible to tsc runs whose `include` covers this
//   directory — which the package's own tsconfig does and an app's does not, so `pnpm typecheck`
//   passed here and failed in both apps.

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
  /**
   * `"v3"` or `"v4"`. On a v4 position `pool` is a 32-byte pool id inside the PoolManager singleton,
   * NOT a contract — it has no explorer page, so it must never be rendered as an address link.
   */
  venue: string;
  /** The PositionManager holding this position's NFT. Differs per venue, so it is per position. */
  positionManager: string;
  pool: string;
  /** The pool's tier, in hundredths of a bip: 3000 = 0.30%. Arbitrary in v4, not one of four tiers. */
  feeBps: number;
  /** What the LP actually keeps after the pool's protocol skim. Both Reserve v3 pools: 2500, not 3000. */
  lpFeeBps: { fee0: number; fee1: number } | null;
  /**
   * v4 only: the protocol fee in hundredths of a bip, one direction, taken off each swap BEFORE the
   * LP fee rather than out of it — so unlike v3's skim it does not reduce `lpFeeBps`. Null on v3.
   */
  protocolFeeBps: number | null;
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
  /**
   * Positions the Reserve holds in venues the indexer does not read, so the page can say what
   * `totals` leaves out instead of presenting a partial treasury as a whole one.
   *
   * Empty means nothing is missing. `count: null` means the venue could not be read — NOT that it is
   * empty. Nothing here is valued: a count with no USD beside it is the honest statement, and
   * inventing a value for an unindexed position is the one thing this field must not lead to.
   */
  unindexed: UnindexedHolding[];
}

/** One venue the Reserve holds liquidity in that the Ledger does not index. */
export interface UnindexedHolding {
  /** e.g. "Uniswap v4". */
  label: string;
  /** The ERC-721 that custodies those positions. */
  positionManager: string;
  /** Why it is not indexed, in the page's voice — render it, do not summarise it. */
  note: string;
  /** Positions held across every Reserve wallet; null when the count could not be read. */
  count: number | null;
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
  /**
   * The tax accrued in letscash's hook and not yet pulled out, in wei of ETH, and what a claim would
   * return of it. /airdrops publishes `pendingWei` as the first stage of what is on its way. Optional
   * because a monitor build could stop serving them; the page then shows a dash.
   */
  pendingWei?: string;
  tabWei?: string;
  claimableWei?: string;
  creator: string;
  treasury: string;
  /**
   * Cold store for the ETH float, or null on a deploy that predates the custody split. Only an
   * address: the balance is read straight from the chain, like `treasury`'s.
   */
  ethReserve: string | null;
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

/**
 * When the next $OURO airdrop is due.
 *
 * `dueTs` is always set, even mid-backfill, so a countdown has a target — the keeper wakes on
 * wall-clock multiples of `cadenceSec` rather than on an on-chain clock, which is what `source` and
 * `caveat` say. Waking is not paying: a run can still defer if gas is high against what is owed.
 */
export interface OuroNext {
  generatedAt: number;
  cadenceSec: number;
  /** Last indexed payout time, or null before the first cycle is synced. */
  lastTs: number | null;
  lastEpoch: number | null;
  /** Next wall-aligned keeper wake. Negative `overdueSec` means it is not due yet. */
  dueTs: number;
  overdueSec: number | null;
  status: Liveness;
  source: string;
  caveat: string;
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

// ── one wallet (/v1/portfolio/{address}): what /portfolio prints ──

/** Where a wallet stands for its next payment, as `/v1/portfolio/{address}/next` and `summary.next` say it. */
export type PortfolioNextStatus = "ineligible" | "excluded" | "due-next-cycle" | "accruing" | "unknown";

/**
 * When one wallet is next paid. Per wallet, not per cycle: a wallet just over the line is credited
 * every cycle but paid only once what it is owed covers the gas to send it, so its `estimatedPayTs`
 * can sit several cycles past the next keeper slot.
 */
export interface PortfolioNext {
  status: PortfolioNextStatus;
  /** Why there is no countdown, for `ineligible` and `excluded`. */
  reason: string | null;
  /** The next keeper slot: the next wall-clock multiple of `cadenceSec`. */
  nextCycleTs: number;
  cadenceSec: number;
  /** When this wallet is estimated to receive a transfer; null when nothing can be said. */
  estimatedPayTs: number | null;
  cyclesUntilPay: number | null;
  /** Owed but not yet sent, in dollars. */
  pendingUsd: number | null;
  /** What has to accrue before a transfer is worth its gas. */
  dustThresholdUsd: number | null;
  estimatedPerCycleUsd: number | null;
  shareOfEligible: number | null;
  /** `inferred` (share × recent payouts) or `stream-ledger` (the keeper's own accrual, if mounted). */
  source: string;
  caveat: string;
}

/** One ERC-20 the wallet holds, read live by the monitor: $OURO, the basket tokens and WETH. */
export interface PortfolioHolding {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  /** Raw units, as a decimal string; `balanceF` is the same in whole tokens. */
  balance: string;
  balanceF: number;
  priceUsd: number | null;
  usd: number | null;
}

/** The wallet's position in one live vault. Only vaults it has a position in are listed. */
export interface PortfolioVaultPosition {
  address: string;
  kind: "compounding" | "payout";
  shareSymbol: string;
  label: string;
  depositSymbol: string;
  /** Its shares in the deposit token, through the vault's own totals. */
  assets: string;
  assetsF: number;
  assetsUsd: number | null;
  payoutSymbol: string;
  /**
   * Payout vaults: what it can claim now, in raw payout-token units. Null on the compounding vault,
   * which has nothing to claim: its yield arrives as a higher share price.
   */
  earned: string | null;
  /**
   * What the vault has returned this wallet, in whole payout tokens. On a payout vault it is the
   * claimable amount above. On the compounding vault it is the lifetime gain: the balance today,
   * less everything deposited, plus everything withdrawn, from the monitor's own index of those
   * events. So it holds after a withdrawal, and it counts only vested gains, because that vault's
   * totalAssets subtracts what is still unlocking.
   *
   * Null is not zero but 'not known': the live read failed, or the position has no indexed cost
   * basis (shares transferred in rather than deposited).
   */
  earnedF: number | null;
  earnedUsd: number | null;
}

/**
 * Everything /portfolio prints for one wallet, from `GET /v1/portfolio/{address}`.
 *
 * Two clocks inside it. The balance, the standing and the share come from the monitor's holder
 * snapshot (`snapshotBlock`; `blocksBehind` says how far it trails the head). The holdings and the
 * vault positions are read from the chain as the request is served (`liveAt`), and are null with
 * `liveError` set when that read failed. A wallet that has never held $OURO is a 200 with zeros, not
 * a 404: only a malformed address is one. Served `Cache-Control: no-store`.
 */
export interface PortfolioSummary {
  address: string;
  generatedAt: number;
  chainId: number;
  symbol: string;
  decimals: number;
  balance: string;
  balanceTokens: number;
  /** At or above the line. Policy-excluded addresses are `eligible` with `excluded` set, so check both. */
  eligible: boolean;
  /** Null when the wallet is paid; otherwise why not, in words (below the line, or the policy reason). */
  excluded: string | null;
  eligibilityLine: string;
  lineTokens: number;
  /** Whole tokens short of the line; 0 at or above it. */
  shortfallTokens: number;
  /** Fraction (0 to 1) of the supply a cycle is divided among; null when the wallet is not paid. */
  shareOfEligible: number | null;
  shareOfEligiblePct: number | null;
  eligibleSupplyTokens: number | null;
  priceUsd: number | null;
  balanceUsd: number | null;
  /** Every payment valued when sent. Null while any indexed leg is unpriced; 0 when never paid. */
  totalAirdropUsd: number | null;
  /** Distinct payout transactions received. */
  airdropPayments: number;
  lastAirdropTs: number | null;
  /**
   * Lifetime USD claimed from payout vaults (indexed Claimed events). Null if any claim is unpriced;
   * 0 when never claimed. Does not include currently unclaimed earned.
   */
  totalVaultClaimedUsd: number | null;
  vaultClaims: number;
  lastVaultClaimTs: number | null;
  /**
   * Claimed + currently claimable. Null when claimed is unpriced, or live earned has an unpriced leg.
   * Without live vault reads, equals totalVaultClaimedUsd.
   */
  totalVaultEarnedUsd: number | null;
  /** Recent cycle averages applied to this wallet's share; null when not paid, or with no priced history. */
  projectedUsdPerDay: number | null;
  projectedUsdPerMonth: number | null;
  next: PortfolioNext;
  /** The canonical public page for this wallet, for share links. */
  portfolioUrl: string;
  snapshotBlock: number | null;
  head: number | null;
  blocksBehind: number | null;
  holdings: PortfolioHolding[] | null;
  holdingsTotalUsd: number | null;
  vaults: PortfolioVaultPosition[] | null;
  /** Deposits plus what is claimable, in dollars. */
  vaultsTotalUsd: number | null;
  liveAt: number | null;
  liveError: string | null;
}

/** One leg of one payment: a basket token and what its cycle valued it at. */
export interface PortfolioPaymentAsset {
  address: string;
  symbol: string | null;
  decimals: number | null;
  amount: string;
  amountF: number;
  usd: number | null;
}

/** One payout transaction to the wallet, from `/v1/portfolio/{address}/airdrops`. */
export interface PortfolioPayment {
  tx: string;
  block: number;
  ts: number;
  cycle: number;
  /** All-or-nothing: null when any leg was unpriced. */
  paidUsd: number | null;
  assets: PortfolioPaymentAsset[];
}

/**
 * A page of payments, newest first. `nextBefore` is the `before=` for the next older page (an
 * exclusive bound on `ts`), null once the oldest payment has been served. `limit` is clamped to 1-200.
 */
export interface PortfolioAirdrops {
  address: string;
  payments: PortfolioPayment[];
  nextBefore: number | null;
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
/**
 * A dollar figure.
 *
 * Anything under a cent reads "< $0.01" rather than "$0.000984". These are values, and six leading
 * zeros tell a reader nothing they were asking: a claim, a deposit or a day's stream worth a
 * fraction of a cent is, to them, worth nothing yet. Pass `exact` where the small number IS the
 * point, which on this site means the unit price of a sub-cent token.
 *
 * Only positive values are floored. A negative under a cent keeps its digits, so the sign never has
 * to be glued onto an inequality ("−< $0.01"); `fmtUsdSigned`, which owns the signed rendering,
 * opts out entirely.
 */
export function fmtUsd(n: number | null | undefined, opts: { compact?: boolean; exact?: boolean } = {}): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  // Minus outside the dollar sign, and the site's own glyph: "$-12.50" was the old shape of it.
  const sign = n < 0 ? "−" : "";
  if (opts.compact && abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (opts.compact && abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  if (abs >= 1000) return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
  // Cents, all the way down to one: `toPrecision(3)` used to start here and rendered fifty cents as
  // "$0.500" and a single cent as "$0.0100".
  if (abs >= 0.01) return `${sign}$${abs.toFixed(2)}`;
  if (abs === 0) return "$0";
  if (!opts.exact && n > 0) return "< $0.01";
  return `${sign}$${abs.toPrecision(3)}`;
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
/**
 * A duration, written in two units: "48s", "49m", "1h 49m", "2d 12h".
 *
 * One unit with one decimal is how every duration on both sites used to read, and "1.7 h ago" is a
 * figure the reader has to finish: 0.7 of an hour is 42 minutes, and nobody does that arithmetic
 * while scanning a card. Two units carry the same precision already finished, and they carry it in a
 * form that survives being stacked — a chart axis of "2d 12h" over "1d 6h" compares at a glance,
 * where "2.5 d" over "29.7 h" did not.
 *
 * The smaller unit is dropped when it is zero, so a round figure stays round ("2h", never "2h 0m"),
 * and it stops at two units, which keeps the longest thing this prints to seven characters.
 */
export function fmtDuration(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return "—";
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}s`;
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) {
    const m = mins % 60;
    return m === 0 ? `${hours}h` : `${hours}h ${m}m`;
  }
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  return h === 0 ? `${days}d` : `${days}d ${h}h`;
}

/** How long ago, from an elapsed count of seconds. The caller supplies the word "ago". */
export function ago(sec: number | null | undefined): string {
  return fmtDuration(sec);
}
export function fmtWhen(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toISOString().replace("T", " ").slice(5, 16) + " UTC";
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "11 Sep 2026", in UTC. Hand-formatted rather than through `toLocaleDateString`, whose month
 * abbreviations move with the browser's locale data ("Sep" against "Sept" on the same page), which
 * matters for the share card: that one is painted into an image and has to come out the same twice.
 */
export function fmtDay(ts: number | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function shortHash(h: string): string {
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

/** A signed USD figure, so a loss is never mistaken for a gain. `—` when unknown. */
export function fmtUsdSigned(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (n === 0) return "$0.00";
  // `exact`, because this owns the sign: the floored form would come out as "+< $0.01".
  const body = fmtUsd(Math.abs(n), { exact: true });
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

/** "1d 5h" / "18h", for the basis of any rate-of-return reading. */
export function fmtAge(days: number | null | undefined): string {
  if (days === null || days === undefined || !Number.isFinite(days)) return "—";
  return fmtDuration(days * 86_400);
}
