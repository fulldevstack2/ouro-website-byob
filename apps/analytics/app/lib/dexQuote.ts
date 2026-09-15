/**
 * One token's price from DexScreener, off the deepest Robinhood Chain pool.
 *
 * Kept apart from lib/dexscreener.ts, which is this app's own richer reader for the comparison page:
 * that one caches a whole market (price, volume, the taxed share) per token for the leaderboard,
 * while this is the single figure the Ledger needs to mark a v4 position to market, taking an
 * AbortSignal so a read can be dropped with the page. Copied from apps/site with the Ledger.
 */
export interface DexQuote {
  priceUsd: number | null;
  /** Percent change over the last 24 hours, signed, or null when DexScreener has none. */
  changeH24: number | null;
}

interface DexPair {
  chainId: string;
  priceUsd?: string;
  priceChange?: { h24?: number };
  liquidity?: { usd?: number };
}

export async function dexQuote(token: string, signal: AbortSignal): Promise<DexQuote> {
  const none: DexQuote = { priceUsd: null, changeH24: null };
  const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token}`, { signal, headers: { accept: "application/json" } });
  if (!r.ok) return none;
  const d = (await r.json()) as { pairs?: DexPair[] };
  const best = (d.pairs ?? [])
    .filter((p) => p.chainId === "robinhood" && p.priceUsd)
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
  if (!best) return none;
  const price = Number(best.priceUsd);
  const change = best.priceChange?.h24;
  return {
    priceUsd: Number.isFinite(price) && price > 0 ? price : null,
    changeH24: typeof change === "number" && Number.isFinite(change) ? change : null,
  };
}
