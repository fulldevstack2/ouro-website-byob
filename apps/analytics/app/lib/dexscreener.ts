/**
 * Market data — price, value, volume and how much of that volume pays the tax — from DexScreener.
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
 *     the treasury; it needs to be current and to cover every venue the token trades on.
 *
 * ── The measurement ──
 * DexScreener returns every pair a token trades in. The taxed share is the canonical pool's 24h
 * volume over the sum across all of them, and the remainder is the leak: trading that funds no
 * airdrop. The canonical pool is matched by `pairAddress`, which for these Uniswap v4 pools is
 * exactly the pool id the registry carries.
 *
 * Checked against the indexer's own numbers the day this was written: INDEX $1,568,859 / 4.8% here
 * against $1,574,144 / 4.8% there, HOOD10 $168,110 / 50.2% against $167,444 / 50.4%. Agreement to a
 * fraction of a percent, and it covers $OURO, which the indexer does not.
 */
import { useEffect, useState } from "react";

const API = "https://api.dexscreener.com/token-pairs/v1";

/** DexScreener's id for Robinhood Chain. Kept here rather than in the registry: it names how THIS
 *  provider addresses the chain, and nothing else in the app needs it. */
export const DEXSCREENER_CHAIN = "robinhood";

/** Long enough that a page full of projects costs one request each; short enough to feel live. */
export const CACHE_MS = 30_000;

export interface TokenMarket {
  /** Spot price from the deepest pool. */
  priceUsd: number | null;
  /** Summed 24h volume across every pool the token trades in. */
  totalUsd: number | null;
  /** 24h volume on the taxed pool alone. */
  canonicalUsd: number | null;
  /**
   * Canonical over total, 0–1. Null when the canonical pool is not among the pairs returned —
   * an unknown share, which must not be rendered as zero.
   */
  taxedShare: number | null;
  /** How many pools the token trades in. Context for the share. */
  pools: number | null;
  /**
   * Fully diluted value, from the deepest pool.
   *
   * Taken from the same payload as `priceUsd` deliberately. FDV is price x supply, so sourcing the
   * two from different providers lets a reader divide one by the other and derive a supply neither
   * provider believes. The indexer does not serve $OURO's FDV at all, which is why that cell used to
   * show the eligible supply at spot — a smaller number under a heading that names a larger one.
   */
  fdvUsd: number | null;
  /** Summed USD liquidity across all pools. */
  liquidityUsd: number | null;
}

export const EMPTY_MARKET: TokenMarket = {
  priceUsd: null,
  totalUsd: null,
  canonicalUsd: null,
  taxedShare: null,
  pools: null,
  fdvUsd: null,
  liquidityUsd: null,
};

interface Pair {
  pairAddress?: string;
  priceUsd?: string | number;
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  fdv?: number;
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

function summarise(pairs: Pair[], canonicalPoolId: string): TokenMarket {
  if (pairs.length === 0) return EMPTY_MARKET;
  const canon = canonicalPoolId.toLowerCase();

  let totalUsd = 0;
  let canonicalUsd = 0;
  let liquidityUsd = 0;
  let deepest = -1;
  let fdvUsd: number | null = null;
  let priceUsd: number | null = null;
  let sawCanonical = false;

  for (const p of pairs) {
    const v = Number(p.volume?.h24 ?? 0);
    const liq = Number(p.liquidity?.usd ?? 0);
    if (Number.isFinite(v)) totalUsd += v;
    if (Number.isFinite(liq)) {
      liquidityUsd += liq;
      // FDV is a per-pair figure derived from that pair's price; take the deepest pool's, which is
      // the least susceptible to a thin market's last trade.
      if (liq > deepest) {
        deepest = liq;
        fdvUsd = Number.isFinite(Number(p.fdv)) ? Number(p.fdv) : null;
        priceUsd = Number.isFinite(Number(p.priceUsd)) ? Number(p.priceUsd) : null;
      }
    }
    if ((p.pairAddress ?? "").toLowerCase() === canon) {
      sawCanonical = true;
      if (Number.isFinite(v)) canonicalUsd += v;
    }
  }

  return {
    priceUsd,
    totalUsd,
    canonicalUsd: sawCanonical ? canonicalUsd : null,
    // A share needs both halves. No canonical pool in the response means we cannot say what fraction
    // was taxed — which is different from saying none of it was.
    taxedShare: sawCanonical && totalUsd > 0 ? canonicalUsd / totalUsd : null,
    pools: pairs.length,
    fdvUsd,
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
      const body = (await r.json()) as Pair[] | { pairs?: Pair[] };
      const pairs = Array.isArray(body) ? body : (body?.pairs ?? []);
      const value = summarise(pairs, canonicalPoolId);
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
