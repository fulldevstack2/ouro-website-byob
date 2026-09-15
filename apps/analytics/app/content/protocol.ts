/**
 * Ouro's own protocol constants, as far as the two pages moved here need them.
 *
 * THE FULL COPY LIVES IN apps/site/app/content/protocol.ts and is the one the docs, the home page
 * and the vaults read. These are the same values, kept here so this app does not import across the
 * workspace into another app — and they have to be changed in both places. They are policy figures
 * and deployed addresses, which move rarely and never quietly; if that stops being true, the honest
 * fix is a shared package rather than a third copy.
 */
import { site } from "./site";

/**
 * Fees are left in the positions until they are worth collecting.
 *
 * A collect is a transaction, and so is moving what it returns. Sweeping $4 of fees costs a
 * meaningful fraction of $4, and that cost would come straight out of what goes back into the pools.
 * So the Reserve's positions accrue until the threshold has built up across all of them, and only
 * then is a collection taken. Protocol policy, not a contract rule.
 */
export const COLLECT_THRESHOLD_USD = 100;

/**
 * Share of every collection that compounds straight back into the Reserve's positions.
 *
 * 100 since 2026-09-15, when the airdrop's fee leg was retired: until then it was 80 to holders and
 * 20 back into the positions. The airdrop is the tax's 1% leg now, and nothing else.
 */
export const FEE_SPLIT_RESERVE_PCT = 100;

/** The balance a wallet needs to be paid by the airdrop, in whole OURO. "The line" on every page. */
export const LINE_TOKENS = 100_000;

/** The supply minted, fixed: no mint function. */
export const TOTAL_SUPPLY_TOKENS = 1_000_000_000;

/** The wallet that holds the protocol-owned liquidity, and the owner every Reserve position must have. */
export const RESERVE_ADDRESS = "0xa2d45d2454B4029be1a0c33ae9f5cb1b5dc6C84D" as const;

/** The Uniswap v4 singletons: the PoolManager holds every pool's state, positions are NFTs in the other. */
export const V4_POOL_MANAGER = "0x8366a39CC670B4001A1121B8F6A443A643e40951" as const;
export const V4_POSITION_MANAGER = "0x58daec3116aae6D93017bAAea7749052E8a04fA7" as const;

export interface V4PositionEntry {
  /** The position NFT in `V4_POSITION_MANAGER`. */
  tokenId: bigint;
  /** `keccak256(abi.encode(poolKey))`, verified against the 25 bytes the position itself stores. */
  poolId: `0x${string}`;
  /** The constituent side, which the row is named and marked for. Must be the pool's `currency1`. */
  token: { symbol: string; address: `0x${string}`; decimals: number };
  /**
   * The other side. Native ETH is `address(0)` in a v4 pool key and has no contract, so it is priced
   * off WETH's market, which is the same ether.
   */
  quote: { symbol: string; decimals: number; priceAddress: `0x${string}` };
}

/**
 * The Reserve's Uniswap v4 positions, listed one by one because they cannot be discovered: the v4
 * PositionManager is not enumerable (`tokenOfOwnerByIndex` reverts) and its ids run to the millions,
 * so there is no way to ask the chain "what does this wallet hold". Each entry is checked against the
 * chain before anything is drawn from it (owner, pool key and liquidity), so a stale one disappears
 * from the page rather than printing a figure nobody holds.
 *
 * Today that is one position: 0.2 ETH and ~387k microduck between ticks 101200 and 132000, opened
 * 2026-09-13, LP fee 10024 pips (1.0024%). The pool also carries a v4 protocol fee of 1000 pips each
 * way, 0.1% of the input of every swap, which goes to the PoolManager's fee controller and not to us,
 * the v4 counterpart of the 1/6 skim on the v3 pools.
 */
export const RESERVE_V4_POSITIONS: V4PositionEntry[] = [
  {
    tokenId: 2598892n,
    poolId: "0x7ce69a29e50d26fa96f7331516789fb834cd542469c86bce303b4352c85b2327",
    token: { symbol: "microduck", address: "0xD5f1afEA47b1A9eab414D2ee740cF1d6d039E725", decimals: 18 },
    quote: { symbol: "ETH", decimals: 18, priceAddress: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" },
  },
];

/** The design's abbreviated display form: `0x8366… 40951`. */
export function shortAddress(address: string) {
  return `${address.slice(0, 6)}… ${address.slice(-5)}`;
}

export function explorerAddressUrl(address: string) {
  return site.links.explorer === "#" ? "#" : `${site.links.explorer}/address/${address}`;
}
