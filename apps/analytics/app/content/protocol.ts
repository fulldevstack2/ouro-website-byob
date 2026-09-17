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

/** The design's abbreviated display form: `0x8366… 40951`. */
export function shortAddress(address: string) {
  return `${address.slice(0, 6)}… ${address.slice(-5)}`;
}

export function explorerAddressUrl(address: string) {
  return site.links.explorer === "#" ? "#" : `${site.links.explorer}/address/${address}`;
}
