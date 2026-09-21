import { useEffect, useState } from "react";

import { MONITOR_API, useMonitor, type OuroYield, type Summary } from "@ouro/monitor-client";
import { dexQuote } from "~/lib/dexscreener";

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
}

/**
 * The dollar figures the vaults page needs: the OURO price (what a deposit is worth), the ETH price
 * (what a WETH payout is worth; USDG is a dollar) and the airdrop rate the vaults' yield rests on
 * before their first harvest.
 *
 * ouro-monitor first, the same source as the rest of the site, so the vaults page never disagrees
 * with the home page about the OURO price or the airdrop rate. DexScreener fills in only what the
 * monitor could not give (lib/dexscreener.ts). Both refresh every five minutes; a price is a slow
 * figure here.
 */
export function usePrices(): Prices {
  const y = useMonitor<OuroYield>(MONITOR_API ? "/v1/ouro/yield?days=3" : null, 300_000);
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
        const [ouro, eth] = await Promise.all([dexQuote(OURO_ADDRESS, ctrl.signal), dexQuote(WETH_ADDRESS, ctrl.signal)]);
        if (!ctrl.signal.aborted) setDex({ ouro: ouro.priceUsd, eth: eth.priceUsd });
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
  };
}

const OURO_ADDRESS = "0x8ea0eb3505f5b3bd2bbea0febae0ce850cc73ecc";
const WETH_ADDRESS = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
