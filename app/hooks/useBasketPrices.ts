import { useMemo } from "react";
import type { Address } from "viem";

import { MONITOR_API, useMonitor, type OuroPending, type Reserve } from "~/lib/monitorApi";

export interface BasketPrices {
  /** Dollars per whole token, keyed by lowercase address. Absent means no price the monitor trusts. */
  prices: Record<string, number>;
  /** The airdrop wallet as the keeper has it, null until the monitor answers. Every payout leaves from it. */
  treasury: Address | null;
  loading: boolean;
}

/**
 * Dollars per token for what the airdrop pays in, and the wallet it pays from.
 *
 * The Reserve is an LP in a CASHCAT/WETH and a PONS/WETH pool, so `/v1/reserve` carries a price the
 * monitor trusts for every basket token and for WETH, the same price the Ledger prints. The airdrop
 * wallet's queue (`/v1/ouro/pending`) values each queued token too, and fills in any token the Reserve
 * has no pool for; it also names the wallet every payout leaves from, which is what a wallet's history
 * is filtered on. A token on neither list has no price here, and the page shows its amount alone
 * rather than guessing.
 */
export function useBasketPrices(): BasketPrices {
  const reserve = useMonitor<Reserve>(MONITOR_API ? "/v1/reserve" : null, 120_000);
  const pending = useMonitor<OuroPending>(MONITOR_API ? "/v1/ouro/pending" : null, 60_000);

  const prices = useMemo(() => {
    const out: Record<string, number> = {};
    for (const q of pending.data?.queued ?? []) if (q.usd !== null && q.amountF > 0) out[q.address.toLowerCase()] = q.usd / q.amountF;
    // The Reserve's prices win: they are the ones every other page shows.
    for (const p of reserve.data?.positions ?? []) {
      for (const s of [p.side0, p.side1]) if (s.priceUsd !== null) out[s.address.toLowerCase()] = s.priceUsd;
    }
    return out;
  }, [reserve.data, pending.data]);

  return { prices, treasury: pending.data ? (pending.data.treasury as Address) : null, loading: reserve.loading || pending.loading };
}
