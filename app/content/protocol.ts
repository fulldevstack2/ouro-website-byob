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
 * The hook's ceiling is 5% and the tax launches AT it, so governance can only ever lower the tax. The one
 * exception is the anti-snipe surcharge below: it is written once at launch, decays to 5% over 60s, and no
 * function can restart, extend or re-arm it — after that minute the 5% ceiling is absolute.
 */
export const PARAMETERS: ParameterRow[] = [
  { parameter: "Total supply", value: "1,000,000,000 OURO", mutable: "No · fixed, no mint" },
  { parameter: "Trade tax", value: "5% of the ETH leg", mutable: "Governed · multisig · capped at 5%" },
  {
    parameter: "Anti-snipe surcharge (first 60s)",
    value: "99% on buys, decaying to 5%",
    mutable: "No · expires on its own, cannot be re-armed",
  },
  { parameter: "Pool LP fee", value: "1%", mutable: "No · fixed at creation" },
  { parameter: "Tax split: airdrop / basket / ops", value: "2% / 2% / 1% of the trade", mutable: "Protocol policy" },
  { parameter: "Fee split: holders / Reserve", value: "80 / 20", mutable: "Protocol policy" },
  { parameter: "Airdrop minimum", value: "100,000 OURO (0.01%)", mutable: "Protocol policy" },
  { parameter: "Basket", value: "Opens with CASHCAT + PONS, toward ~5", mutable: "Protocol policy" },
  { parameter: "Chain", value: "Robinhood Chain (4663)", mutable: "No" },
];
