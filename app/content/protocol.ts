import { site } from "./site";

/** Deployed protocol contracts, `null` until launch (rendered as "Publishes at launch"). */
export interface AddressEntry {
  name: string;
  address: `0x${string}` | null;
}

export const PROTOCOL_CONTRACTS: AddressEntry[] = [
  { name: "OURO token", address: "0x8ea0eB3505F5b3bd2bBeA0FeBae0ce850cC73eCC" },
  { name: "Fee recipient (funds the payouts)", address: "0xd8E6c485aC9210A33B434325FAD5743310102405" },
  { name: "Airdrop distributor", address: null },
];

/** The launchpad rails $OURO trades on. Not ours — letscash's, shared by every token they launch. */
export const VENUE: AddressEntry[] = [
  { name: "letscash trading hook", address: "0x75a54357d9c78a2db19004a5FdC76c50f9242Aec" },
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
  { parameter: "Tax split: airdrop / basket / ops", value: "PENDING — see note", mutable: "Protocol policy" },
  { parameter: "Fee split: holders / Reserve", value: "80 / 20", mutable: "Protocol policy" },
  { parameter: "Airdrop minimum", value: "100,000 OURO (0.01%)", mutable: "Protocol policy" },
  { parameter: "Basket", value: "Opens with CASHCAT + PONS, toward ~5", mutable: "Protocol policy" },
  { parameter: "Chain", value: "Robinhood Chain (4663)", mutable: "No" },
];
