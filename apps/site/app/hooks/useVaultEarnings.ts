import { useMemo } from "react";
import type { Address } from "viem";

import { MONITOR_API, type PortfolioVaultPosition } from "@ouro/monitor-client";
import { usePortfolioSummary } from "~/hooks/usePortfolio";

/* ────────────────────────────────────────────────────────────────────────────
   What the connected wallet has earned in the vaults, for the /vaults page.

   The chain cannot answer this on the compounding vault. Its yield arrives as a higher share price,
   so a depositor's gain is only visible against what they put in, and the contract keeps no record
   of that. ouro-monitor does: it indexes every `Deposit` and `Withdraw`, and serves the gain as
   `vaults[].earnedF` on `GET /v1/portfolio/{address}`, as balance today less deposits plus
   withdrawals. That holds after a withdrawal, because a withdrawal lowers the balance and the basis
   by the same amount, and it counts only vested gains: the compounding vault's `totalAssets`
   subtracts what is still unlocking (the card's "Arriving over the next day" row).

   On the payout vaults `earnedF` is the same claimable figure the panel already reads from the chain,
   so the cards use the chain for those and this hook's wallet-wide total, which does include claims
   already taken, is what covers their history.
   ──────────────────────────────────────────────────────────────────────────── */

export interface VaultEarnings {
  /**
   * The wallet's position per vault, keyed by lowercase vault address. Null until the monitor has
   * answered for THIS wallet, or when its live read of the vaults failed. Present but without an
   * entry means the monitor answered and the wallet has never used that vault.
   */
  positions: Map<string, PortfolioVaultPosition> | null;
  /**
   * Everything the vaults have returned this wallet, in dollars: claimed, claimable and compounding
   * gain. Null when the monitor cannot price one of those legs, which is how it says "unknown"
   * rather than understating the total.
   */
  lifetimeUsd: number | null;
  /** Claims the wallet has made and when the latest one landed, for the line under the total. */
  claims: number;
  lastClaimTs: number | null;
  /**
   * The block the monitor's deposit and withdrawal index has reached. A gain read before the wallet's
   * own deposit is indexed counts that deposit as gain, so the panel holds the figure back until this
   * has passed the wallet's latest vault transaction (see `LiveSection`).
   */
  indexedBlock: number | null;
  /** False on a build with no monitor origin, where there is nothing to show rather than a dash. */
  configured: boolean;
  loading: boolean;
  error: string | null;
}

/** Whether this build has a monitor to ask at all. */
const CONFIGURED = MONITOR_API !== "";

const EMPTY: VaultEarnings = {
  positions: null,
  lifetimeUsd: null,
  claims: 0,
  lastClaimTs: null,
  indexedBlock: null,
  configured: CONFIGURED,
  loading: false,
  error: null,
};

/**
 * Polled every 30 seconds, which is as fresh as this needs to be: a deposit or a withdrawal moves
 * the balance and the basis together and leaves the gain where it was, so only a harvest changes the
 * figure. The chain reads on the page stay on their own 15-second clock.
 */
export function useVaultEarnings(address: Address | undefined): VaultEarnings {
  const { data, error, loading } = usePortfolioSummary(address ?? null, 30_000);
  const positions = useMemo(
    () => (data && Array.isArray(data.vaults) ? new Map(data.vaults.map((v) => [v.address.toLowerCase(), v])) : null),
    [data],
  );
  if (!address || !CONFIGURED) return EMPTY;
  return {
    positions,
    lifetimeUsd: data?.totalVaultEarnedUsd ?? null,
    claims: data?.vaultClaims ?? 0,
    lastClaimTs: data?.lastVaultClaimTs ?? null,
    indexedBlock: data?.snapshotBlock ?? null,
    configured: true,
    loading,
    error,
  };
}

/**
 * One vault's gain, as the card has to say it: a figure, "nothing deposited" (the monitor answered
 * and the wallet has never used this vault) or "not known" (it has not answered, or it has no cost
 * basis for the position, which is what a wallet that was sent its shares rather than depositing
 * looks like).
 */
export type Gain = { kind: "unknown" } | { kind: "none" } | { kind: "known"; tokens: number; usd: number | null };

export function gainIn(earnings: VaultEarnings, vault: Address): Gain {
  const { positions } = earnings;
  if (positions === null) return { kind: "unknown" };
  const pos = positions.get(vault.toLowerCase());
  if (pos === undefined) return { kind: "none" };
  if (pos.earnedF === null) return { kind: "unknown" };
  return { kind: "known", tokens: pos.earnedF, usd: pos.earnedUsd };
}
