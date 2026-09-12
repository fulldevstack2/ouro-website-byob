import { formatUnits } from "viem";

/** A token amount as a plain number, for pricing. Precision past 15 digits is irrelevant for dollars. */
export function toNumber(value: bigint | undefined | null, decimals: number): number | null {
  if (value === undefined || value === null) return null;
  const n = Number(formatUnits(value, decimals));
  return Number.isFinite(n) ? n : null;
}

/** A token amount in dollars, or null when either side is unknown. */
export function usdValue(value: bigint | undefined | null, decimals: number, priceUsd: number | null): number | null {
  const n = toNumber(value, decimals);
  return n === null || priceUsd === null ? null : n * priceUsd;
}

const YEAR_SECONDS = 365 * 86_400;
/** The vault's performance fee: 10% of every harvest gain. */
export const FEE_FACTOR = 0.9;
/** The OURO vault's rebuy pays the OURO pool's 5% tax on the ETH leg like any other buy. */
export const REBUY_TAX_FACTOR = 0.95;

export interface RealisedYield {
  /** Percent per year. */
  pct: number;
  /** APY when the gain compounds inside the vault (the OURO vault), APR when it is paid out. */
  label: "APY" | "APR";
  /** Unix seconds of the harvest the figure rests on. */
  harvestAt: number;
}

export interface YieldInputs {
  kind: "compounding" | "payout";
  /** Seconds a harvest vests or streams over. */
  profitUnlockPeriod?: bigint;
  /** Payout vaults: the stream set by the latest harvest. */
  rewardRate?: bigint;
  periodFinish?: bigint;
  /** Compounding vaults: the latest harvest's net gain (plus what was still vesting) and when it landed. */
  lockedProfitAtHarvest?: bigint;
  lastHarvest?: bigint;
  totalAssets?: bigint;
  assetDecimals: number;
  payoutDecimals: number;
  /** Dollars per payout token (1 for USDG) and the vault's deposits in dollars. */
  payoutUsd: number | null;
  tvlUsd: number | null;
}

/**
 * The yield the vault's own latest harvest implies, annualised, or null before any harvest.
 *
 * Payout vaults: the harvest put `rewardRate * unlock / 1e36` of the payout token on a stream over
 * the unlock period; that amount, in dollars, over the vault's deposits in dollars, repeated for a
 * year, is the APR. Compounding vaults: the harvest added `lockedProfitAtHarvest` of the deposit
 * token to the pool over the same period; that ratio compounded once per period for a year is the
 * APY, and it needs no price because gain and deposits are the same token. Both rest on one harvest,
 * so they move with each one; the panel says which harvest they come from.
 */
export function realisedYield(i: YieldInputs): RealisedYield | null {
  const unlock = i.profitUnlockPeriod !== undefined && i.profitUnlockPeriod > 0n ? Number(i.profitUnlockPeriod) : null;
  if (unlock === null) return null;
  const periodsPerYear = YEAR_SECONDS / unlock;

  if (i.kind === "payout") {
    if (i.rewardRate === undefined || i.periodFinish === undefined || i.periodFinish === 0n) return null;
    if (i.tvlUsd === null || i.tvlUsd <= 0 || i.payoutUsd === null) return null;
    const perPeriod = toNumber((i.rewardRate * BigInt(unlock)) / 10n ** 36n, i.payoutDecimals);
    if (perPeriod === null) return null;
    const pct = ((perPeriod * i.payoutUsd * periodsPerYear) / i.tvlUsd) * 100;
    return { pct, label: "APR", harvestAt: Number(i.periodFinish) - unlock };
  }

  if (i.lastHarvest === undefined || i.lastHarvest === 0n || i.lockedProfitAtHarvest === undefined || i.totalAssets === undefined) return null;
  const gain = toNumber(i.lockedProfitAtHarvest, i.assetDecimals);
  const base = toNumber(i.totalAssets, i.assetDecimals);
  if (gain === null || base === null || base <= 0) return null;
  const perPeriod = gain / base;
  const pct = (Math.pow(1 + perPeriod, periodsPerYear) - 1) * 100;
  return { pct, label: "APY", harvestAt: Number(i.lastHarvest) };
}

/**
 * Until a vault holds the airdrop line and has harvested: the airdrop rate a wallet above the line earns, less what the vault
 * takes on the way (its fee, and for the OURO vault the pool tax on every rebuy). Swap fees and price
 * impact are not modelled, so this is a ceiling for the first figure, not an estimate of it.
 */
export function projectedYieldPct(kind: "compounding" | "payout", airdropAprPct: number): number {
  return airdropAprPct * FEE_FACTOR * (kind === "compounding" ? REBUY_TAX_FACTOR : 1);
}

/**
 * Above this a figure is noise rather than a rate: one harvest out of all proportion to the vault (a hand-fed
 * basket on a two-token pool compounded to a 94-digit APY) and it is shown capped, so it can neither mislead nor
 * blow the card's layout.
 */
export const YIELD_DISPLAY_CAP_PCT = 10_000;

/** "35.8%", "1,240%" once the decimals stop meaning anything, or ">10,000%" past the cap (infinity included). */
export function fmtYieldPct(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || Number.isNaN(pct) || pct === -Infinity) return "—";
  if (pct > YIELD_DISPLAY_CAP_PCT) return `>${YIELD_DISPLAY_CAP_PCT.toLocaleString("en-US")}%`;
  if (pct >= 1000) return `${Math.round(pct).toLocaleString("en-US")}%`;
  return `${pct.toFixed(1)}%`;
}
