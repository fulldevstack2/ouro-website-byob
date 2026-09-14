import { useEffect, useState } from "react";

import { MONITOR_API, useMonitor, type OuroYield } from "@ouro/monitor-client";
import { dexQuote } from "~/lib/dexscreener";

const OURO_ADDRESS = "0x8ea0eb3505f5b3bd2bbea0febae0ce850cc73ecc";

export interface Ticker {
  priceUsd: number | null;
  /** Percent over the last 24 hours, signed; null until DexScreener has answered. */
  changeH24: number | null;
}

/**
 * The price in the nav bar. The price itself comes from ouro-monitor, the same figure the calculator
 * and the vaults use, so the bar never disagrees with the page under it; the day's change comes from
 * DexScreener, which the monitor does not publish for $OURO. Both refresh every five minutes. Empty
 * until the first read lands, so the prerendered bar and the first client frame agree.
 */
export function useOuroTicker(): Ticker {
  const y = useMonitor<OuroYield>(MONITOR_API ? "/v1/ouro/yield?days=7" : null, 300_000);
  const [dex, setDex] = useState<{ priceUsd: number | null; changeH24: number | null } | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      try {
        const q = await dexQuote(OURO_ADDRESS, ctrl.signal);
        if (!ctrl.signal.aborted) setDex(q);
      } catch {
        // Keep whatever was last read; the bar simply shows no change.
      }
      if (!ctrl.signal.aborted) timer = setTimeout(run, 300_000);
    };
    void run();
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, []);

  return {
    priceUsd: y.data?.priceUsd ?? dex?.priceUsd ?? null,
    changeH24: dex?.changeH24 ?? null,
  };
}
