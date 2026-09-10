import type { Address, ContractFunctionParameters } from "viem";
import { useReadContracts } from "wagmi";

import { BASKET_TOKENS } from "~/content/protocol";
import { LIVE_VAULTS, TOKENS, type LiveVault } from "~/content/vaults";
import { erc20Abi, sharesToAssets, vaultAbi, zeroAddress } from "~/lib/vaultChain";

const OURO = TOKENS.find((t) => t.key === "ouro")!;
const READS_PER_VAULT = 4;

export interface VaultPosition {
  vault: LiveVault;
  /** The wallet's shares priced in the deposit token through the vault's own totals, as the vaults page does. */
  deposited?: bigint;
  /** Payout vaults only: what the wallet can claim right now. */
  earned?: bigint;
}

export interface WalletChain {
  /** $OURO in the wallet itself, not counting what it has in the vaults. */
  ouro?: bigint;
  /** Each basket token's balance, keyed by lowercase address. */
  basket: Record<string, bigint | undefined>;
  vaults: VaultPosition[];
  loading: boolean;
  /** The multicall itself failed: the chain, not one contract, did not answer. */
  error: boolean;
}

/**
 * Everything the portfolio reads from the chain for one wallet, in one multicall refreshed every
 * fifteen seconds: its $OURO, its balance of every token the airdrop pays in, and for each live vault
 * its shares and what it can claim. The reads go through the site's public transport rather than the
 * connected wallet, so they work for whichever address the page is showing.
 */
export function usePortfolioChain(address: Address | null): WalletChain {
  const who = address ?? zeroAddress;
  const contracts: ContractFunctionParameters[] = [
    { address: OURO.address, abi: erc20Abi, functionName: "balanceOf", args: [who] },
    ...BASKET_TOKENS.map((t): ContractFunctionParameters => ({ address: t.address, abi: erc20Abi, functionName: "balanceOf", args: [who] })),
    ...LIVE_VAULTS.flatMap((v): ContractFunctionParameters[] => [
      { address: v.entry.address, abi: vaultAbi, functionName: "balanceOf", args: [who] },
      { address: v.entry.address, abi: vaultAbi, functionName: "totalAssets" },
      { address: v.entry.address, abi: vaultAbi, functionName: "totalSupply" },
      // Fails inside the multicall on the compounding vault, which has no `earned`; that read comes back undefined.
      { address: v.entry.address, abi: vaultAbi, functionName: "earned", args: [who] },
    ]),
  ];
  const { data, isLoading, isError } = useReadContracts({ contracts, query: { enabled: address !== null, refetchInterval: 15_000 } });

  const pick = <T>(i: number): T | undefined => {
    if (!address) return undefined;
    const x = data?.[i];
    return x && x.status === "success" ? (x.result as T) : undefined;
  };

  const basket: Record<string, bigint | undefined> = {};
  BASKET_TOKENS.forEach((t, i) => {
    basket[t.address.toLowerCase()] = pick<bigint>(1 + i);
  });

  const base = 1 + BASKET_TOKENS.length;
  const vaults = LIVE_VAULTS.map((vault, i): VaultPosition => {
    const at = base + i * READS_PER_VAULT;
    const shares = pick<bigint>(at);
    const totalAssets = pick<bigint>(at + 1);
    const totalSupply = pick<bigint>(at + 2);
    return {
      vault,
      deposited: shares !== undefined && totalAssets !== undefined && totalSupply !== undefined ? sharesToAssets(shares, { totalAssets, totalSupply }) : undefined,
      earned: vault.kind === "payout" ? pick<bigint>(at + 3) : undefined,
    };
  });

  return { ouro: pick<bigint>(0), basket, vaults, loading: address !== null && isLoading, error: address !== null && isError };
}
