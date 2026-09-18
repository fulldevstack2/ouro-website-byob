import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { Address, Hash } from "viem";
import { useAccount, usePublicClient, useReadContract, useReadContracts, useWriteContract } from "wagmi";

import type { LiveVault } from "~/content/vaults";
import { erc20Abi, sharesToAssets, vaultAbi, zeroAddress } from "~/lib/vaultChain";
import { robinhoodChain } from "~/lib/wagmi";

/**
 * Everything one panel shows, read in a single multicall and refreshed every 15 seconds, plus the
 * wallet balance, which is one read shared by every panel (see useWalletBalance).
 */
export interface VaultView {
  totalAssets?: bigint;
  totalSupply?: bigint;
  paused?: boolean;
  /** Deposit token per whole share (1e18 = 1:1). Compounding vaults: rises with every harvest. */
  pricePerShare?: bigint;
  /** Seconds a harvest vests (compounding) or streams (payout) over. */
  profitUnlockPeriod?: bigint;
  /** Compounding vaults: harvest gains still vesting to depositors, the latest harvest's net gain, and when it landed. */
  lockedProfit?: bigint;
  lockedProfitAtHarvest?: bigint;
  lastHarvest?: bigint;
  /** Payout vaults: booked payout not yet claimed (unclaimed rewards plus the unreleased stream). */
  accountedPayout?: bigint;
  rewardRate?: bigint;
  periodFinish?: bigint;
  /** The connected account's shares, their value in the deposit token, and (payout vaults) what it can claim. */
  shares?: bigint;
  deposited?: bigint;
  earned?: bigint;
  /** The connected account's deposit-token allowance to the vault and wallet balance. */
  allowance?: bigint;
  walletBalance?: bigint;
  loading: boolean;
}

export function useVaultView(vault: LiveVault, account: Address | undefined): VaultView {
  const who = account ?? zeroAddress;
  const v = vault.entry.address;
  const asset = vault.token.address;
  const walletBalance = useWalletBalance(asset, account);
  const { data, isLoading } = useReadContracts({
    contracts: [
      { address: v, abi: vaultAbi, functionName: "totalAssets" },
      { address: v, abi: vaultAbi, functionName: "totalSupply" },
      { address: v, abi: vaultAbi, functionName: "paused" },
      { address: v, abi: vaultAbi, functionName: "pricePerShare" },
      { address: v, abi: vaultAbi, functionName: "lockedProfit" },
      { address: v, abi: vaultAbi, functionName: "accountedPayout" },
      { address: v, abi: vaultAbi, functionName: "rewardRate" },
      { address: v, abi: vaultAbi, functionName: "periodFinish" },
      { address: v, abi: vaultAbi, functionName: "balanceOf", args: [who] },
      { address: v, abi: vaultAbi, functionName: "earned", args: [who] },
      { address: asset, abi: erc20Abi, functionName: "allowance", args: [who, v] },
      { address: v, abi: vaultAbi, functionName: "profitUnlockPeriod" },
      { address: v, abi: vaultAbi, functionName: "lockedProfitAtHarvest" },
      { address: v, abi: vaultAbi, functionName: "lastHarvest" },
    ] as const,
    query: { refetchInterval: 15_000 },
  });

  // The reads a vault kind does not have (a compounding vault has no `earned`) fail inside the
  // multicall and come back undefined, which the panel renders as "not applicable".
  const pick = <T,>(i: number): T | undefined => {
    const x = data?.[i];
    return x && x.status === "success" ? (x.result as T) : undefined;
  };

  const totalAssets = pick<bigint>(0);
  const totalSupply = pick<bigint>(1);
  const shares = account ? pick<bigint>(8) : undefined;
  const deposited = shares !== undefined && totalAssets !== undefined && totalSupply !== undefined ? sharesToAssets(shares, { totalAssets, totalSupply }) : undefined;

  return {
    totalAssets,
    totalSupply,
    paused: pick<boolean>(2),
    pricePerShare: pick<bigint>(3),
    profitUnlockPeriod: pick<bigint>(11),
    lockedProfit: vault.kind === "compounding" ? pick<bigint>(4) : undefined,
    lockedProfitAtHarvest: vault.kind === "compounding" ? pick<bigint>(12) : undefined,
    lastHarvest: vault.kind === "compounding" ? pick<bigint>(13) : undefined,
    accountedPayout: vault.kind === "payout" ? pick<bigint>(5) : undefined,
    rewardRate: vault.kind === "payout" ? pick<bigint>(6) : undefined,
    periodFinish: vault.kind === "payout" ? pick<bigint>(7) : undefined,
    shares,
    deposited,
    earned: account && vault.kind === "payout" ? pick<bigint>(9) : undefined,
    allowance: account ? pick<bigint>(10) : undefined,
    walletBalance,
    loading: isLoading,
  };
}

/**
 * The connected account's balance of a deposit token. Deliberately NOT one more line in the panel's
 * multicall: TanStack Query keys this read by token and account, so every panel whose vault takes the
 * same token (all three take OURO) shares one cache entry, one request and one refresh, and the figure
 * changes in every panel in the same render. Inside the multicalls it was three copies, each on its
 * own clock, so the panel that had just transacted showed the new balance seconds before the others.
 */
function useWalletBalance(token: Address, account: Address | undefined): bigint | undefined {
  const { data } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account ?? zeroAddress],
    query: { enabled: account !== undefined, refetchInterval: 15_000 },
  });
  return data;
}

export type TxPhase = "idle" | "approving" | "depositing" | "withdrawing" | "claiming" | "done" | "error";

export interface TxState {
  phase: TxPhase;
  /** The transaction in flight or just confirmed. */
  hash?: Hash;
  /**
   * The block it was mined in, once confirmed. The page waits for ouro-monitor's index to reach it
   * before printing what the wallet has earned: read any earlier and a deposit the index has not
   * seen yet counts as gain (see hooks/useVaultEarnings).
   */
  block?: bigint;
  /** What happened, for the status line. */
  message?: string;
}

/** A transaction that has been mined successfully. */
interface Confirmed {
  hash: Hash;
  block: bigint;
}

export const BUSY_PHASES: TxPhase[] = ["approving", "depositing", "withdrawing", "claiming"];

/** A wallet error in one line: the user's own rejection is not a failure worth a stack trace. */
function describe(e: unknown): string {
  const err = e as { name?: string; shortMessage?: string; message?: string; cause?: { name?: string } };
  if (err?.name === "UserRejectedRequestError" || err?.cause?.name === "UserRejectedRequestError" || /rejected/i.test(err?.shortMessage ?? "")) {
    return "Rejected in the wallet.";
  }
  const m = err?.shortMessage ?? err?.message ?? "Something went wrong.";
  return m.length > 160 ? `${m.slice(0, 157)}...` : m;
}

/**
 * The three things a depositor does. Each sends its transaction(s), waits for the receipt, then has
 * every chain read on the page re-read at once, so the figures on screen never run ahead of the chain
 * and no part of the page runs ahead of another.
 */
export function useVaultActions(vault: LiveVault) {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: robinhoodChain.id });
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();
  const [tx, setTx] = useState<TxState>({ phase: "idle" });

  /**
   * Refetch every mounted wagmi read in one sweep: this panel's multicall, the wallet balance the
   * panels share and the TVL band, none of which should wait out its own 15-second interval after a
   * transaction. "readContract" and "readContracts" are the scopes wagmi puts first in its query keys.
   */
  const reread = useCallback(
    () => void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "readContract" || q.queryKey[0] === "readContracts" }),
    [queryClient],
  );

  const run = useCallback(
    async (phase: TxPhase, send: () => Promise<Hash>): Promise<Confirmed> => {
      setTx({ phase });
      const hash = await send();
      setTx({ phase, hash });
      if (!publicClient) throw new Error("No RPC client for Robinhood Chain.");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("The transaction reverted.");
      return { hash, block: receipt.blockNumber };
    },
    [publicClient],
  );

  /** Approve exactly `amount` when the allowance is short, then deposit it. */
  const deposit = useCallback(
    async (amount: bigint, allowance: bigint) => {
      if (!address) return;
      try {
        if (allowance < amount) {
          await run("approving", () =>
            writeContractAsync({ address: vault.token.address, abi: erc20Abi, functionName: "approve", args: [vault.entry.address, amount], chainId: robinhoodChain.id }),
          );
        }
        const done = await run("depositing", () =>
          writeContractAsync({ address: vault.entry.address, abi: vaultAbi, functionName: "deposit", args: [amount, address], chainId: robinhoodChain.id }),
        );
        setTx({ phase: "done", ...done, message: "Deposited." });
        reread();
      } catch (e) {
        setTx({ phase: "error", message: describe(e) });
      }
    },
    [address, run, writeContractAsync, vault, reread],
  );

  /**
   * Withdraw an exact amount of the deposit token, or everything by redeeming every share (so no
   * rounding dust is left behind). Redeeming to zero also claims what the account has earned.
   */
  const withdraw = useCallback(
    async (req: { assets: bigint } | { allShares: bigint }) => {
      if (!address) return;
      try {
        const done = await run("withdrawing", () =>
          "allShares" in req
            ? writeContractAsync({ address: vault.entry.address, abi: vaultAbi, functionName: "redeem", args: [req.allShares, address, address], chainId: robinhoodChain.id })
            : writeContractAsync({ address: vault.entry.address, abi: vaultAbi, functionName: "withdraw", args: [req.assets, address, address], chainId: robinhoodChain.id }),
        );
        setTx({ phase: "done", ...done, message: "Withdrawn." });
        reread();
      } catch (e) {
        setTx({ phase: "error", message: describe(e) });
      }
    },
    [address, run, writeContractAsync, vault, reread],
  );

  const claim = useCallback(async () => {
    if (!address) return;
    try {
      const done = await run("claiming", () =>
        writeContractAsync({ address: vault.entry.address, abi: vaultAbi, functionName: "claim", args: [address], chainId: robinhoodChain.id }),
      );
      setTx({ phase: "done", ...done, message: "Claimed." });
      reread();
    } catch (e) {
      setTx({ phase: "error", message: describe(e) });
    }
  }, [address, run, writeContractAsync, vault, reread]);

  const reset = useCallback(() => setTx({ phase: "idle" }), []);

  return { tx, busy: BUSY_PHASES.includes(tx.phase), deposit, withdraw, claim, reset };
}

export type VaultActions = ReturnType<typeof useVaultActions>;
