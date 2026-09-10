import { useEffect, useState } from "react";

import { MONITOR_API, useMonitor, type OuroYield, type Summary } from "~/lib/monitorApi";

/** The measured airdrop rate a wallet above the line earns, annualised, with the basis it rests on. */
export interface AirdropRate {
  aprPct: number;
  caveat: string | null;
  annualisable: boolean;
  basisDays: number | null;
}

export interface Prices {
  ouroUsd: number | null;
  ethUsd: number | null;
  airdrop: AirdropRate | null;
  loading: boolean;
  /** True when a price came from DexScreener because the monitor had none. */
  fallback: boolean;
  /**
   * The whole yield reading the rate above was cut from, for a page that needs more of it than the
   * rate: /portfolio divides a wallet's balance by `eligibleTokens` and applies `paidUsdPerDay` to
   * the result. One request serves both rather than the same JSON fetched twice.
   */
  ouroYield: OuroYield | null;
}

/**
 * The dollar figures the vaults page needs: the OURO price (what a deposit is worth), the ETH price
 * (what a WETH payout is worth; USDG is a dollar) and the airdrop rate the vaults' yield rests on
 * before their first harvest.
 *
 * ouro-monitor first, the same source as the rest of the site, so the vaults page never disagrees
 * with the home hero about the OURO price or the airdrop rate. DexScreener fills in only what the
 * monitor could not give: it is CORS-open and indexes the Robinhood Chain pools, and the deepest
 * pool's price is taken. Both refresh every five minutes; a price is a slow figure here.
 */
export function usePrices(): Prices {
  const y = useMonitor<OuroYield>(MONITOR_API ? "/v1/ouro/yield?days=7" : null, 300_000);
  const s = useMonitor<Summary>(MONITOR_API ? "/v1/summary" : null, 300_000);
  const monitorOuro = y.data?.priceUsd ?? null;
  const monitorEth = s.data ? (s.data.tokens.hood10?.tax.ethPriceUsd ?? s.data.tokens.index?.tax.ethPriceUsd ?? null) : null;
  const settled = !y.loading && !s.loading;
  const needFallback = settled && (monitorOuro === null || monitorEth === null);

  const [dex, setDex] = useState<{ ouro: number | null; eth: number | null } | null>(null);
  useEffect(() => {
    if (!needFallback) return;
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      try {
        const [ouro, eth] = await Promise.all([dexPrice(OURO_ADDRESS, ctrl.signal), dexPrice(WETH_ADDRESS, ctrl.signal)]);
        if (!ctrl.signal.aborted) setDex({ ouro, eth });
      } catch {
        // Keep whatever was last read.
      }
      if (!ctrl.signal.aborted) timer = setTimeout(run, 300_000);
    };
    void run();
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [needFallback]);

  const airdrop: AirdropRate | null =
    y.data && y.data.aprPct !== null ? { aprPct: y.data.aprPct, caveat: y.data.caveat, annualisable: y.data.annualisable, basisDays: y.data.basisDays } : null;

  return {
    ouroUsd: monitorOuro ?? dex?.ouro ?? null,
    ethUsd: monitorEth ?? dex?.eth ?? null,
    airdrop,
    loading: !settled,
    fallback: settled && (monitorOuro === null || monitorEth === null),
    ouroYield: y.data,
  };
}

const OURO_ADDRESS = "0x8ea0eb3505f5b3bd2bbea0febae0ce850cc73ecc";
const WETH_ADDRESS = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";

interface DexPair {
  chainId: string;
  priceUsd?: string;
  liquidity?: { usd?: number };
}

/** The token's USD price on its deepest Robinhood Chain pool, or null when DexScreener has none. */
async function dexPrice(token: string, signal: AbortSignal): Promise<number | null> {
  const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token}`, { signal, headers: { accept: "application/json" } });
  if (!r.ok) return null;
  const d = (await r.json()) as { pairs?: DexPair[] };
  const best = (d.pairs ?? [])
    .filter((p) => p.chainId === "robinhood" && p.priceUsd)
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
  const n = best ? Number(best.priceUsd) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}
