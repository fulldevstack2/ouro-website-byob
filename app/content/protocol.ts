import { site } from "./site";

/** Deployed protocol contracts, `null` until launch (rendered as "Publishes at launch"). */
export interface AddressEntry {
  name: string;
  address: `0x${string}` | null;
}

export const PROTOCOL_CONTRACTS: AddressEntry[] = [
  { name: "OURO token", address: null },
  { name: "Ouro hook", address: null },
  { name: "Airdrop distributor", address: null },
  { name: "Treasury / guardian Safe", address: null },
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
 * TODO before launch: the hook enforces a hard ceiling on the tax (3% in the committed contract, which
 * predates the 5% rate). Set the new ceiling, then state it here and in the three places that used to
 * claim "capped at 3%": docs §10, docs §11 ("What Ouro can't do") and the "Can the team rug?" FAQ.
 */
export const PARAMETERS: ParameterRow[] = [
  { parameter: "Total supply", value: "1,000,000,000 OURO", mutable: "No · fixed, no mint" },
  { parameter: "Trade tax", value: "5% of the ETH leg", mutable: "Governed · multisig" },
  { parameter: "Pool LP fee", value: "1%", mutable: "No · fixed at creation" },
  { parameter: "Tax split: airdrop / basket / ops", value: "2% / 2% / 1% of the trade", mutable: "Protocol policy" },
  { parameter: "Fee split: holders / Reserve", value: "80 / 20", mutable: "Protocol policy" },
  { parameter: "Airdrop minimum", value: "100,000 OURO (0.01%)", mutable: "Protocol policy" },
  { parameter: "Basket target size", value: "~5, roughly equal weight", mutable: "Protocol policy" },
  { parameter: "Chain", value: "Robinhood Chain (4663)", mutable: "No" },
];
