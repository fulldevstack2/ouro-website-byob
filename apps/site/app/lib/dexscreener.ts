/**
 * DexScreener's public token endpoint: CORS-open, keyless, and it indexes the Robinhood Chain pools.
 * The site reads it for what ouro-monitor does not publish (a token's day-on-day change, and a price
 * when the monitor has none).
 *
 * Prefer the deepest pool where this token is the *base*. Quote-token pairs (e.g. mmETH/OURO,
 * LIME/HOOD10) publish the other asset's priceUsd and must not win on liquidity alone.
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
  baseToken?: { address?: string };
}

export async function dexQuote(token: string, signal: AbortSignal): Promise<DexQuote> {
  const none: DexQuote = { priceUsd: null, changeH24: null };
  const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token}`, { signal, headers: { accept: "application/json" } });
  if (!r.ok) return none;
  const d = (await r.json()) as { pairs?: DexPair[] };
  const want = token.toLowerCase();
  const best = (d.pairs ?? [])
    .filter((p) => p.chainId === "robinhood" && p.priceUsd && (p.baseToken?.address ?? "").toLowerCase() === want)
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
  if (!best) return none;
  const price = Number(best.priceUsd);
  const change = best.priceChange?.h24;
  return {
    priceUsd: Number.isFinite(price) && price > 0 ? price : null,
    changeH24: typeof change === "number" && Number.isFinite(change) ? change : null,
  };
}
