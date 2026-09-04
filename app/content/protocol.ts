import { site } from "./site";

/** Deployed protocol contracts, `null` until launch (rendered as "Publishes at launch"). */
export interface AddressEntry {
  name: string;
  address: `0x${string}` | null;
  /**
   * A Uniswap v4 pool is a 32 byte id inside the PoolManager singleton, not a contract with an
   * address of its own, so it gets no explorer link.
   */
  poolId?: boolean;
}

export const PROTOCOL_CONTRACTS: AddressEntry[] = [
  { name: "OURO token", address: "0x8Ea0eB3505f5B3Bd2BbEa0fEBae0cE850cC73ecc" },
  { name: "ETH/OURO pool (Uniswap v4)", address: "0x4abc526118181921d76bf184896938ae7c8fc0921abce79ebef3d36a622968a5", poolId: true },
  { name: "Fee recipient (funds the payouts)", address: "0xd8E6c485aC9210A33B434325FAD5743310102405" },
  { name: "Airdrop distributor", address: "0x0bd09D209292c3359885adDBF9CF94A7AEcC369F" },
  { name: "Team vest (Sablier Lockup, stream 156)", address: "0x548129a58bC230549DF7F9e33f27E77F6779ff0f" },
];

/** The launchpad rails $OURO trades on. Not ours — letscash's, shared by every token they launch. */
export const VENUE: AddressEntry[] = [
  { name: "letscash trading hook", address: "0x75A54357D9C78a2Db19004a5FDc76c50F9242AEC" },
];

/** Canonical infrastructure Ouro builds on (design project → uploads/DOCS.md §13). */
export const INFRASTRUCTURE: AddressEntry[] = [
  { name: "Uniswap v4 PoolManager", address: "0x8366a39CC670B4001A1121B8F6A443A643e40951" },
  { name: "Uniswap v3 Factory", address: "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA" },
  { name: "v3 Position Manager", address: "0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3" },
  { name: "WETH", address: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" },
];

/** The design's abbreviated display form: `0x8366… 40951`. */
export function shortAddress(address: string) {
  return `${address.slice(0, 6)}… ${address.slice(-5)}`;
}

export function explorerAddressUrl(address: string) {
  return site.links.explorer === "#" ? "#" : `${site.links.explorer}/address/${address}`;
}

/** Docs §09 (Parameters). */
export interface ParameterRow {
  parameter: string;
  value: string;
  mutable: string;
}

/**
 * $OURO trades on letscash's shared hook, so the tax rate and the pool's 0% LP fee are fixed at launch and
 * not ours to change. Everything downstream of the fee stream — the splits, the basket, the cadence — is
 * operator policy. Nothing here is enforced by a contract we control.
 */
export const PARAMETERS: ParameterRow[] = [
  { parameter: "Total supply", value: "1,000,000,000 OURO", mutable: "No · fixed, no mint" },
  { parameter: "Trade tax", value: "5% of the ETH leg", mutable: "No · fixed at launch" },
  { parameter: "Pool LP fee", value: "0%", mutable: "No · fixed at creation" },
  { parameter: "Tax split", value: "2% airdrop / 2% LP / 0.7% ops / 0.3% letscash", mutable: "Protocol policy" },
  { parameter: "Fee split: holders / Reserve", value: "80 / 20", mutable: "Protocol policy" },
  { parameter: "Airdrop minimum", value: "100,000 OURO (0.01%)", mutable: "Protocol policy" },
  { parameter: "Airdrop cadence", value: "Target: every 2 hours", mutable: "Protocol policy" },
  { parameter: "Stream length", value: "~48 hours per collection", mutable: "Protocol policy" },
  { parameter: "Basket", value: "Opens with CASHCAT + PONS, toward ~5", mutable: "Protocol policy" },
  { parameter: "Chain", value: "Robinhood Chain (4663)", mutable: "No" },
];
