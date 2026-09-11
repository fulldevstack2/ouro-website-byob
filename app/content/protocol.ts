import { site } from "./site";

/**
 * Fees are left in the positions until they are worth collecting.
 *
 * A collect is a transaction, and so is moving what it returns. Sweeping $4 of fees costs a
 * meaningful fraction of $4, and that cost would come out of the airdrop. So the Reserve's positions
 * accrue until the threshold below has built up across all of them, and only then is a collection
 * taken and split on the usual 80 / 20 — four fifths to the wallet the Airdropper pays from, one
 * fifth compounded straight back into the positions. (Stated in dollars rather than percentages
 * here because the numbers are derived below, so the two cannot drift apart.) Nothing is lost by
 * waiting: uncollected fees sit in the position still earning, and the Ledger publishes the running
 * figure against the threshold.
 *
 * Protocol policy, not a contract rule.
 */
export const COLLECT_THRESHOLD_USD = 100;

/** Share of every collection airdropped to holders; the rest compounds into the Reserve. */
export const FEE_SPLIT_HOLDERS_PCT = 80;

/** How a collection at the threshold divides, in whole dollars. Derived, so the copy cannot drift. */
export const COLLECTION_SPLIT_USD = {
  holders: (COLLECT_THRESHOLD_USD * FEE_SPLIT_HOLDERS_PCT) / 100,
  reserve: (COLLECT_THRESHOLD_USD * (100 - FEE_SPLIT_HOLDERS_PCT)) / 100,
};

/**
 * The wallet collections land in and every airdrop leaves from: the `from` of every payout transfer.
 * The monitor publishes the same address as `treasury` on /v1/ouro/pending.
 */
export const AIRDROP_WALLET: `0x${string}` = "0xEA1B87B70852e48FDcA9262Ca91018C44C19001c";

/**
 * The supply the vaults' share is measured against: the billion minted, less the ~123,000,000 still
 * locked in the team vest (the Sablier stream in PROTOCOL_CONTRACTS below).
 *
 * Against the full billion the figure would understate what is pooled, because a token nobody can
 * move cannot be deposited. Set by the owner on 2026-09-11 and kept as a constant rather than read
 * from the chain: it rises as the vest unlocks, and a denominator that drifts silently under a page
 * that does not say it is moving is worse than one somebody updates. Revisit it as the vest releases.
 */
export const FLOATING_SUPPLY_TOKENS = 877_000_000;

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
  { name: "Tax claimer (pulls the tax out of the hook)", address: "0xd8E6c485aC9210A33B434325FAD5743310102405" },
  { name: "Airdrop wallet (collections land here, and payouts leave from it)", address: AIRDROP_WALLET },
  { name: "Airdrop distributor", address: "0x0bd09D209292c3359885adDBF9CF94A7AEcC369F" },
  { name: "Team vest (Sablier Lockup, stream 156)", address: "0x548129a58bC230549DF7F9e33f27E77F6779ff0f" },
  { name: "Reserve (holds the protocol-owned liquidity)", address: "0xa2d45d2454B4029be1a0c33ae9f5cb1b5dc6C84D" },
];

/**
 * The pools the Reserve is an LP in — the positions the Ledger reports, and the addresses anyone can
 * check them against. Uniswap v3 pools are real contracts, unlike the v4 pool $OURO itself trades in.
 *
 * Both run `feeProtocol = 102`: the pool skims 1/6 of each side's fee for the v3 factory owner
 * (`0x05C420bC4823e039AA4dA645eDde743486dAAA25`, not us), so the Reserve nets **0.25% of a 0.30%
 * pool**. `lpFeeBps` on `/v1/reserve` publishes that, and the Ledger shows both numbers.
 */
export const RESERVE_POOLS: AddressEntry[] = [
  { name: "CASHCAT / WETH · 0.30% (Uniswap v3)", address: "0xd42A491087a15E5afd51FEb3606066Cc152d2b09" },
  { name: "PONS / WETH · 0.30% (Uniswap v3)", address: "0xEd50bDeeA8aDC232f159486192a4157281D722ff" },
];

/**
 * A token the airdrop pays in, for marking a wallet's holdings on /portfolio.
 *
 * The basket is CASHCAT and PONS today. WETH is listed because the fee leg arrives as the pools
 * earned it (docs §05: "often basket tokens plus WETH") and the airdrop wallet's queue already
 * carries a WETH line. ouro-monitor names every token a wallet holds and every token a payment
 * carried, so a new constituent shows up on the page before it is added here; this list is where
 * each token's mark and its display name live, and what the prerendered page lists before any
 * wallet is connected.
 */
export interface BasketToken {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
  /** Self-hosted mark in public/tokens; absent, the design system's ink tile stands in. */
  icon?: string;
}

export const BASKET_TOKENS: BasketToken[] = [
  { symbol: "CASHCAT", name: "Cash Cat", address: "0x020bfC650A365f8BB26819deAAbF3E21291018b4", decimals: 18, icon: "/tokens/cashcat.jpg" },
  { symbol: "PONS", name: "Pons", address: "0x39dBED3a2bd333467115dE45665cC57F813C4571", decimals: 18, icon: "/tokens/pons.png" },
  { symbol: "WETH", name: "Wrapped Ether", address: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73", decimals: 18, icon: "/tokens/weth.svg" },
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
  { name: "v3 Factory owner (takes 1/6 of pool fees)", address: "0x05C420bC4823e039AA4dA645eDde743486dAAA25" },
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
  { parameter: "Fee collection threshold", value: "$100 of accrued LP fees", mutable: "Protocol policy" },
  { parameter: "Airdrop cadence", value: "Every 2 hours", mutable: "Protocol policy" },
  { parameter: "Stream length", value: "~48 hours per collection", mutable: "Protocol policy" },
  { parameter: "Basket", value: "Opens with CASHCAT + PONS, toward ~5", mutable: "Protocol policy" },
  { parameter: "Chain", value: "Robinhood Chain (4663)", mutable: "No" },
];
