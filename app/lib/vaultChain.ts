import { erc20Abi, formatUnits, parseAbi, parseUnits, zeroAddress, type Address } from "viem";

/**
 * What the vault panels call on a dividend vault (hood10-vault-contracts: DividendVaultBase plus the
 * CompoundingDividendVault and PayoutDividendVault strategies). One ABI serves both kinds: the reads
 * only one kind has (`lockedProfit`, `earned`, ...) simply fail on the other, and the multicall that
 * batches them tolerates that per call.
 */
export const vaultAbi = parseAbi([
  "function asset() view returns (address)",
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function pricePerShare() view returns (uint256)",
  "function paused() view returns (bool)",
  "function deposit(uint256 assets, address receiver) returns (uint256 shares)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256 assets)",
  "function profitUnlockPeriod() view returns (uint64)",
  "function lockedProfit() view returns (uint256)",
  "function lockedProfitAtHarvest() view returns (uint256)",
  "function lastHarvest() view returns (uint64)",
  "function accountedPayout() view returns (uint256)",
  "function rewardRate() view returns (uint256)",
  "function periodFinish() view returns (uint64)",
  "function earned(address account) view returns (uint256)",
  "function claim(address receiver) returns (uint256 amount)",
]);

export { erc20Abi, zeroAddress };
export type { Address };

/**
 * The contract's 3-decimal virtual share offset (OpenZeppelin ERC-4626):
 *   shares = assets * (totalSupply + 1e3) / (totalAssets + 1)
 *   assets = shares * (totalAssets + 1) / (totalSupply + 1e3)
 * Reproduced here so a position can be priced from one multicall instead of a call per render.
 */
const OFFSET = 1000n;

export interface Totals {
  totalAssets: bigint;
  totalSupply: bigint;
}

export function sharesToAssets(shares: bigint, t: Totals): bigint {
  return (shares * (t.totalAssets + 1n)) / (t.totalSupply + OFFSET);
}

/**
 * Payout streamed to all depositors together per day, in payout token units. The contract's
 * `rewardRate` is the vault-wide rate per second scaled by 1e36 (`_notify`: `(amount + remaining) *
 * 1e36 / duration`); the per-share accrual divides it by the supply, so it must not be multiplied
 * back here. The day is multiplied in before the scale is divided out, as the contract's own
 * `_streamRemaining` does: a 6-decimal payout streams under one unit a second (USDG on any small
 * harvest), and dividing first truncated that to nothing and showed "No stream running" mid-stream.
 * Zero once the stream has finished.
 */
export function streamPerDay(rewardRate: bigint, periodFinish: bigint, nowSec: number): bigint {
  if (periodFinish <= BigInt(Math.floor(nowSec))) return 0n;
  return (rewardRate * 86_400n) / 10n ** 36n;
}

/** A typed amount, or null when the text is not a positive number the token can represent. */
export function parseAmount(input: string, decimals: number): bigint | null {
  const s = input.trim().replace(/,/g, "");
  if (s === "" || s === "." || !/^\d*\.?\d*$/.test(s)) return null;
  try {
    const v = parseUnits(s, decimals);
    return v > 0n ? v : null;
  } catch {
    return null;
  }
}

/**
 * A token amount for display: grouped integer part, at most `maxFrac` decimals with trailing zeros
 * trimmed, and a "<0.0001" floor rather than a misleading "0" for dust. A missing value is a dash,
 * the site's convention for a figure it has not read.
 */
export function fmtAmount(value: bigint | undefined | null, decimals: number, maxFrac = 4): string {
  if (value === undefined || value === null) return "—";
  if (value === 0n) return "0";
  const [int, frac = ""] = formatUnits(value, decimals).split(".");
  const intFmt = BigInt(int).toLocaleString("en-US");
  const fracTrim = frac.slice(0, maxFrac).replace(/0+$/, "");
  if (intFmt === "0" && fracTrim === "") return `<0.${"0".repeat(Math.max(maxFrac - 1, 0))}1`;
  return fracTrim ? `${intFmt}.${fracTrim}` : intFmt;
}

/** Hours and minutes left until a unix timestamp, or null once it has passed. */
export function timeLeft(untilSec: bigint, nowSec: number): string | null {
  const left = Number(untilSec) - Math.floor(nowSec);
  if (left <= 0) return null;
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}
