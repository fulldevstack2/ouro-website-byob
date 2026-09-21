/**
 * Market data — price, value, the volume that pays the tax, and the volume that escapes it.
 *
 * ── Why not the indexer ──
 * ouro-monitor derives the taxed share by counting swaps on the hook pool and comparing them to
 * GeckoTerminal's network-wide figure. That is the right shape for the indexer, which has to
 * reconcile the tax against what the treasury actually received — but it is the wrong shape for this
 * page, for three reasons:
 *
 *   · It only covers the tokens the indexer is configured for. $OURO's pool volume is not on
 *     `/v1/summary` at all, so that cell read "not indexed" for a figure anyone can look up.
 *   · Adding a project to the registry would mean adding a source adapter before its volume
 *     appears, which breaks the promise that a project is a config entry.
 *   · Volume is a market fact, not a chain-replay fact. Nothing here needs to be reconciled against
 *     the treasury, and the venues outside the taxed pool have no events this indexer watches.
 *
 * ── The measurement ──
 * The headline is the CANONICAL POOL's 24h volume — the pool the tax is charged on, matched by
 * `pairAddress`, which for these Uniswap v4 pools is exactly the pool id the registry carries. It
 * used to be the sum across every pair DexScreener returned, and that was the wrong number to put in
 * the biggest type on the card, for three reasons:
 *
 *   · `/token-pairs/v1` is hard-capped at 30 pairs. USDC on ethereum, base and solana — tokens that
 *     trade in thousands of pools — each return exactly 30, and so does INDEX. `latest/dex/tokens`
 *     and `latest/dex/search` return the identical 30, so nothing in this provider can distinguish
 *     "this token has 30 pools" from "it has more and you were handed the first 30". A cross-venue
 *     sum is therefore a floor that cannot announce itself as one.
 *   · Untaxed volume funds no airdrop. Tax, airdropped, rate per line and APR all descend from the
 *     taxed pool, so a headline measured across venues the project does not tax was the one figure
 *     in the column that did not belong to the same story as the rest of it.
 *   · The taxed pool is a single pair, so it is immune to the cap — and unlike the sum, it is
 *     checkable. Against the indexer's own swap replay on 2026-09-21: HOOD10 113 swaps / $16,740.62
 *     here against 113 swaps / $17,090.66 there; INDEX 164 txns / $41,863.97 against 162 swaps /
 *     $42,588.13. Under 2%, which is ETH-price timing.
 *
 * The cross-venue sum stays, as `untaxedUsd` printed under the headline. The leak is the most
 * interesting thing on INDEX's card — it taxes a few percent of its own trading — and it is worth
 * stating. But it is stated as "≥ $1.09M traded elsewhere", never as a ratio: `poolsTruncated` puts
 * the uncertainty in the numerator's own units instead of hiding it in a denominator.
 *
 * An earlier note here claimed this agreed with the indexer "to a fraction of a percent". It did,
 * and the agreement meant nothing: ouro-monitor's `market.ts` reaches its figure through
 * `prices.ts` `tokenPools()`, which requests the same capped `/token-pairs/v1` URL. Same call, same
 * cap, same answer. The swap-replay comparison above is the only real check of the two.
 *
 * Price and market cap come from that same canonical pool when Dex returns it; otherwise from the deepest
 * pool where the project token is the *base* (never the quote). Taking deepest liquidity alone
 * misprices HOOD10 by ~800× when LIME/HOOD10 (HOOD10 as quote) out-liquids HOOD10/ETH.
 */
import { useEffect, useState } from "react";

const API = "https://api.dexscreener.com/token-pairs/v1";

/** DexScreener's id for Robinhood Chain. Kept here rather than in the registry: it names how THIS
 *  provider addresses the chain, and nothing else in the app needs it. */
export const DEXSCREENER_CHAIN = "robinhood";

/** Long enough that a page full of projects costs one request each; short enough to feel live. */
export const CACHE_MS = 30_000;

/**
 * Pairs `/token-pairs/v1` will return, at most. Not documented by the provider — measured.
 *
 * A response of exactly this length is indistinguishable from a truncated one, so it is treated as
 * truncated: see `poolsTruncated`. Raising this because a token "surely has fewer pools than that"
 * is the mistake it exists to prevent.
 */
export const DEX_PAIR_CAP = 30;

export interface TokenMarket {
  /** Spot price from the canonical pool, else the deepest base-token pool. */
  priceUsd: number | null;
  /**
   * 24h volume on the taxed pool alone — the headline, and the only figure here the 30-pair cap
   * cannot reach. Null when that pool is missing from the response or reports no volume: an unknown,
   * which must not be rendered as zero.
   */
  canonicalUsd: number | null;
  /** Summed 24h volume across every pair returned. A floor when `poolsTruncated`. */
  totalUsd: number | null;
  /**
   * Volume on every pool EXCEPT the taxed one — trading that funds no airdrop. A floor when
   * `poolsTruncated`, and null when either half of the subtraction is unknown.
   */
  untaxedUsd: number | null;
  /** How many pairs came back. A floor when `poolsTruncated`. */
  pools: number | null;
  /**
   * True when the response came back FULL, so pools may exist beyond it and `totalUsd`, `untaxedUsd`
   * and `pools` are floors rather than totals. The page must say so when it is set — the same
   * contract `ProjectRow.paidAllTimeTruncated` carries for a full page of cycles.
   */
  poolsTruncated: boolean;
  /**
   * Market cap, from the same pool as `priceUsd`.
   *
   * DexScreener's own `marketCap`, falling back to its `fdv`: it reports the two as the same number
   * for all three of these tokens, because it treats none of their supply as locked, and a token
   * whose supply it cannot read carries neither. Read from the same payload as `priceUsd`
   * deliberately — either figure is a price times a supply, so taking the two from different
   * providers lets a reader divide one by the other and derive a supply neither of them believes.
   * The indexer does not serve $OURO's at all, which is why that cell used to show the eligible
   * supply at spot: a smaller number under a heading that names a larger one.
   */
  marketCapUsd: number | null;
  /** Summed USD liquidity across all pools. */
  liquidityUsd: number | null;
}

export const EMPTY_MARKET: TokenMarket = {
  priceUsd: null,
  canonicalUsd: null,
  totalUsd: null,
  untaxedUsd: null,
  pools: null,
  poolsTruncated: false,
  marketCapUsd: null,
  liquidityUsd: null,
};

/** Dex pair fields we read. Exported for tests. */
export interface DexPair {
  pairAddress?: string;
  priceUsd?: string | number;
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  baseToken?: { address?: string };
  quoteToken?: { address?: string };
}

/**
 * Module-level cache, shared by every caller in the tab.
 *
 * `at` is when the value was fetched; `inflight` deduplicates concurrent callers so three projects
 * mounting at once make three requests rather than nine. A failed fetch is NOT cached: the previous
 * good value stays until it expires, so one blip does not blank the row.
 */
interface Entry {
  at: number;
  value: TokenMarket;
}
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<TokenMarket>>();

/** Exported for tests, and so a long-lived tab can be made to refetch on demand. */
export function clearMarketCache(): void {
  cache.clear();
  inflight.clear();
}

function addrEq(a: string | undefined, b: string): boolean {
  return (a ?? "").toLowerCase() === b.toLowerCase();
}

function numOrNull(v: string | number | undefined): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Pick the pair that prices the project token.
 *
 * 1. Canonical taxed pool, when present (registry `canonicalPoolId`).
 * 2. Else deepest liquidity among pairs where the project token is `baseToken`.
 *
 * Never use a quote-token pair's `priceUsd` — that is the other asset's price (LIME/HOOD10, mmETH/OURO).
 */
export function pickPricePair(pairs: DexPair[], token: string, canonicalPoolId: string): DexPair | null {
  if (pairs.length === 0) return null;
  const canon = canonicalPoolId.toLowerCase();
  const want = token.toLowerCase();

  const canonical = pairs.find((p) => (p.pairAddress ?? "").toLowerCase() === canon);
  if (canonical) return canonical;

  let best: DexPair | null = null;
  let deepest = -1;
  for (const p of pairs) {
    if (!addrEq(p.baseToken?.address, want)) continue;
    const liq = Number(p.liquidity?.usd ?? 0);
    if (!Number.isFinite(liq) || liq <= deepest) continue;
    deepest = liq;
    best = p;
  }
  return best;
}

/** Pure market reduction. Exported for unit tests. */
export function summarise(pairs: DexPair[], token: string, canonicalPoolId: string): TokenMarket {
  if (pairs.length === 0) return EMPTY_MARKET;
  const canon = canonicalPoolId.toLowerCase();

  // Null rather than 0 until a pair actually reports a number. A response whose pairs carry no
  // `volume` at all is an unknown, and the old `let totalUsd = 0` published it as "$0 traded" — the
  // one zero on this page that was a claim about the project rather than a statement about us.
  let totalUsd: number | null = null;
  let canonicalUsd: number | null = null;
  let liquidityUsd = 0;

  for (const p of pairs) {
    const v = numOrNull(p.volume?.h24);
    const liq = Number(p.liquidity?.usd ?? 0);
    if (Number.isFinite(liq)) liquidityUsd += liq;
    if (v !== null) totalUsd = (totalUsd ?? 0) + v;
    if ((p.pairAddress ?? "").toLowerCase() === canon && v !== null) canonicalUsd = (canonicalUsd ?? 0) + v;
  }

  const priced = pickPricePair(pairs, token, canonicalPoolId);
  // Clamped at zero: the two halves are summed from the same response, so a negative can only be
  // float drift, and "−$0.004 traded elsewhere" is a worse thing to print than a rounded zero.
  const untaxedUsd = totalUsd === null || canonicalUsd === null ? null : Math.max(0, totalUsd - canonicalUsd);

  return {
    priceUsd: priced ? numOrNull(priced.priceUsd) : null,
    canonicalUsd,
    totalUsd,
    untaxedUsd,
    pools: pairs.length,
    poolsTruncated: pairs.length >= DEX_PAIR_CAP,
    marketCapUsd: priced ? (numOrNull(priced.marketCap) ?? numOrNull(priced.fdv)) : null,
    liquidityUsd: liquidityUsd > 0 ? liquidityUsd : null,
  };
}

export async function fetchMarket(token: string, canonicalPoolId: string, now = Date.now()): Promise<TokenMarket> {
  const key = token.toLowerCase();
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_MS) return hit.value;
  const pending = inflight.get(key);
  if (pending) return pending;

  const run = (async () => {
    try {
      const r = await fetch(`${API}/${DEXSCREENER_CHAIN}/${token}`, { headers: { accept: "application/json" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = (await r.json()) as DexPair[] | { pairs?: DexPair[] };
      const pairs = Array.isArray(body) ? body : (body?.pairs ?? []);
      const value = summarise(pairs, token, canonicalPoolId);
      cache.set(key, { at: Date.now(), value });
      return value;
    } catch {
      // Keep whatever was last known good rather than blanking the row on one failed poll.
      return cache.get(key)?.value ?? EMPTY_MARKET;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, run);
  return run;
}

/** Market data for several tokens at once, keyed by lowercased token address. */
export function useMarkets(tokens: { token: string; canonicalPoolId: string }[]): Record<string, TokenMarket> {
  const [out, setOut] = useState<Record<string, TokenMarket>>({});
  // The set of tokens is the registry and does not change between renders; key on it so a stable
  // list does not restart the interval on every paint.
  const signature = tokens.map((t) => t.token).join(",");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const entries = await Promise.all(
        tokens.map(async (t) => [t.token.toLowerCase(), await fetchMarket(t.token, t.canonicalPoolId)] as const),
      );
      if (alive) setOut(Object.fromEntries(entries));
    };
    void load();
    const timer = setInterval(() => void load(), CACHE_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return out;
}
