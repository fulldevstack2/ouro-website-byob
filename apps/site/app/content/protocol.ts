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

/** The tax on every buy and sell, in ETH. Fixed in letscash's hook at launch; not ours to change. */
export const TRADE_TAX_PCT = 5;

/** One share of a split: the row under the bar, and the bar's own wedge. */
export interface SplitLeg {
  /** The row's label, which names what the share is for. */
  label: string;
  /** The same leg in a word, for the parameter table's one-line form. */
  short: string;
  pct: number;
  /** accent is the share the protocol keeps; the rest descend by weight. */
  tone: "accent" | "ink" | "soft" | "faint";
}

/**
 * Where each point of the tax goes, and where each collection of pool fees goes.
 *
 * The home page's bars, the docs' §02 and §03, and the parameter table all read these, so the
 * figures cannot drift between the three places the site states them. The rate above is fixed at
 * launch; everything below it is operator policy.
 */
export const TAX_SPLIT: SplitLeg[] = [
  { label: "Airdrop: buys tokens and hands them to holders", short: "airdrop", pct: 2, tone: "ink" },
  { label: "LP: buys the Reserve and keeps it", short: "LP", pct: 2, tone: "accent" },
  { label: "Ops: gas, infra, listings", short: "ops", pct: 0.7, tone: "soft" },
  { label: "letscash: the launchpad's platform fee", short: "letscash", pct: 0.3, tone: "faint" },
];

export const FEE_SPLIT: SplitLeg[] = [
  { label: "Holders: airdropped to every wallet above the line, as earned", short: "holders", pct: FEE_SPLIT_HOLDERS_PCT, tone: "ink" },
  { label: "Reserve: tops up the positions, so the next cycle earns more", short: "Reserve", pct: 100 - FEE_SPLIT_HOLDERS_PCT, tone: "accent" },
];

/** "2%", "0.7%", "80%": a leg's share, with no trailing zero on a whole number. */
export const legPct = (leg: SplitLeg) => `${leg.pct}%`;

/** "80 / 20": the fee split as one figure, for a heading and for the parameter table. */
export const FEE_SPLIT_LABEL = FEE_SPLIT.map((l) => String(l.pct)).join(" / ");

/** How a collection at the threshold divides, in whole dollars. Derived, so the copy cannot drift. */
export const COLLECTION_SPLIT_USD = {
  holders: (COLLECT_THRESHOLD_USD * FEE_SPLIT_HOLDERS_PCT) / 100,
  reserve: (COLLECT_THRESHOLD_USD * (100 - FEE_SPLIT_HOLDERS_PCT)) / 100,
};

/** The balance a wallet needs to be paid by the airdrop, in whole OURO. "The line" everywhere on the site. */
export const LINE_TOKENS = 100_000;

/** The supply minted, fixed: no mint function. */
export const TOTAL_SUPPLY_TOKENS = 1_000_000_000;

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

/** The wallet that holds the protocol-owned liquidity, and the owner every Reserve position must have. */
export const RESERVE_ADDRESS = "0xa2d45d2454B4029be1a0c33ae9f5cb1b5dc6C84D" as const;

/** The Uniswap v4 singletons: the PoolManager holds every pool's state, positions are NFTs in the other. */
export const V4_POOL_MANAGER = "0x8366a39CC670B4001A1121B8F6A443A643e40951" as const;
export const V4_POSITION_MANAGER = "0x58daec3116aae6D93017bAAea7749052E8a04fA7" as const;

export const PROTOCOL_CONTRACTS: AddressEntry[] = [
  { name: "OURO token", address: "0x8Ea0eB3505f5B3Bd2BbEa0fEBae0cE850cC73ecc" },
  { name: "ETH/OURO pool (Uniswap v4)", address: "0x4abc526118181921d76bf184896938ae7c8fc0921abce79ebef3d36a622968a5", poolId: true },
  { name: "Tax claimer", address: "0xd8E6c485aC9210A33B434325FAD5743310102405" },
  { name: "Airdrop wallet", address: "0xEA1B87B70852e48FDcA9262Ca91018C44C19001c" },
  // The hot wallet above signs every cycle, so it holds a working float only. The ETH behind it sits
  // here and is forwarded when that float runs low.
  { name: "Airdrop ETH reserve (3-of-3 Safe)", address: "0x9EF77382E25334c7952a643286a98178514eECf2" },
  { name: "Airdrop distributor", address: "0x0bd09D209292c3359885adDBF9CF94A7AEcC369F" },
  { name: "Team vest (Sablier Lockup, stream 156)", address: "0x548129a58bC230549DF7F9e33f27E77F6779ff0f" },
  // Custody moved to the 3-of-3 Safe 0xc8BF917136cEd0126f8cDe688CE0d2ff146Af33E on 2026-09-11 and came
  // back here on 2026-09-12: three signatures per fee collection cost more than the arrangement bought.
  // The Safe holds none now. It still appears in the Ledger's position history as two `transfer_out` /
  // `transfer_in` pairs, so it is named here for anyone reconciling those four transactions.
  { name: "Reserve (holds the protocol-owned liquidity)", address: RESERVE_ADDRESS },
];

/**
 * The pools the Reserve is an LP in — the positions the Ledger reports, and the addresses anyone can
 * check them against. Uniswap v3 pools are real contracts, unlike the v4 pool $OURO itself trades in.
 *
 * Both v3 pools run `feeProtocol = 102`: the pool skims 1/6 of each side's fee for the v3 factory
 * owner (`0x05C420bC4823e039AA4dA645eDde743486dAAA25`, not us), so the Reserve nets **0.25% of a
 * 0.30% pool**. `lpFeeBps` on `/v1/reserve` publishes that, and the Ledger shows both numbers.
 *
 * The microduck leg is the third name and the odd one out: it is an ETH pair in a Uniswap v4 pool,
 * so it is an id inside the PoolManager rather than a contract (hence `poolId` and no explorer
 * link), and ouro-monitor reads v3 only, so `/v1/reserve` counts it in `unindexed` and values it
 * nowhere. The site reads that one position itself: see `RESERVE_V4_POSITIONS` below.
 *
 * There is also a v3 microduck / WETH pool (1%, `0xb87C3c63b53d19984f3b4A927e26B667e32087E8`) that
 * the Reserve is NOT in. It is not listed, because this table is what the Reserve holds.
 */
export const RESERVE_POOLS: AddressEntry[] = [
  { name: "CASHCAT / WETH · 0.30% (Uniswap v3)", address: "0xd42A491087a15E5afd51FEb3606066Cc152d2b09" },
  { name: "PONS / WETH · 0.30% (Uniswap v3)", address: "0xEd50bDeeA8aDC232f159486192a4157281D722ff" },
  { name: "ETH / microduck · 1.00% (Uniswap v4)", address: "0x7ce69a29e50d26fa96f7331516789fb834cd542469c86bce303b4352c85b2327", poolId: true },
];

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
 * the v4 counterpart of the 1/6 skim on the v3 pools above.
 */
export const RESERVE_V4_POSITIONS: V4PositionEntry[] = [
  {
    tokenId: 2598892n,
    poolId: "0x7ce69a29e50d26fa96f7331516789fb834cd542469c86bce303b4352c85b2327",
    token: { symbol: "microduck", address: "0xD5f1afEA47b1A9eab414D2ee740cF1d6d039E725", decimals: 18 },
    quote: { symbol: "ETH", decimals: 18, priceAddress: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" },
  },
];

/**
 * A token the airdrop pays in, for marking a wallet's holdings on /portfolio and the calculator's slice.
 *
 * The basket is CASHCAT, PONS, AI and microduck today. WETH is listed because the fee leg arrives as the pools
 * earned it (docs §05) and the airdrop wallet's queue already carries a WETH line. ouro-monitor names
 * every token a wallet holds and every token a payment carried, so a new constituent shows up on the
 * page before it is added here; this list is where each token's mark and its display name live.
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
  { symbol: "AI", name: "Artificial Inu", address: "0x2E8c31162b855A2ffa90F6F8634643Ad6F111e18", decimals: 18, icon: "/tokens/ai.png" },
  // Lowercase because that is the symbol the contract carries, and the monitor reports a token by
  // the symbol it reports for itself; spelling it MICRODUCK here would miss the mark on every row.
  { symbol: "microduck", name: "microduck", address: "0xD5f1afEA47b1A9eab414D2ee740cF1d6d039E725", decimals: 18, icon: "/tokens/microduck.png" },
  { symbol: "WETH", name: "Wrapped Ether", address: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73", decimals: 18, icon: "/tokens/weth.svg" },
];

/** The token marks the site knows, by lowercase address and by symbol, for anywhere a token is drawn. */
export const TOKEN_ICONS: Record<string, string> = {
  OURO: "/tokens/ouro.svg",
  CASHCAT: "/tokens/cashcat.jpg",
  PONS: "/tokens/pons.png",
  AI: "/tokens/ai.png",
  microduck: "/tokens/microduck.png",
  WETH: "/tokens/weth.svg",
  USDG: "/tokens/usdg.png",
  HOOD10: "/tokens/hood10.png",
  INDEX: "/tokens/index.png",
};

/** The launchpad rails $OURO trades on. Not ours — letscash's, shared by every token they launch. */
export const VENUE: AddressEntry[] = [
  { name: "letscash trading hook", address: "0x75A54357D9C78a2Db19004a5FDc76c50F9242AEC" },
];

/** Canonical infrastructure Ouro builds on. */
export const INFRASTRUCTURE: AddressEntry[] = [
  { name: "Uniswap v4 PoolManager", address: V4_POOL_MANAGER },
  { name: "v4 Position Manager", address: V4_POSITION_MANAGER },
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

/** Docs §06 (Parameters). */
export interface ParameterRow {
  parameter: string;
  value: string;
  /** "Policy" the operator can change as a public on-chain transaction; "Fixed" nobody can. */
  mutable: string;
}

/**
 * $OURO trades on letscash's shared hook, so the tax rate and the pool's 0% LP fee are fixed at launch and
 * not ours to change. Everything downstream of the fee stream — the splits, the basket, the cadence — is
 * operator policy. Nothing here is enforced by a contract we control.
 */
export const PARAMETERS: ParameterRow[] = [
  { parameter: "Total supply", value: "1,000,000,000 OURO", mutable: "Fixed · no mint" },
  { parameter: "Trade tax", value: `${TRADE_TAX_PCT}% of the ETH leg`, mutable: "Fixed at launch" },
  { parameter: "Pool LP fee", value: "0%", mutable: "Fixed at creation" },
  { parameter: "Tax split", value: TAX_SPLIT.map((l) => `${legPct(l)} ${l.short}`).join(" / "), mutable: "Policy" },
  { parameter: "Fee split: holders / Reserve", value: FEE_SPLIT_LABEL, mutable: "Policy" },
  { parameter: "Airdrop minimum", value: "100,000 OURO (0.01%)", mutable: "Policy" },
  { parameter: "Fee collection threshold", value: "$100 of accrued LP fees", mutable: "Policy" },
  { parameter: "Airdrop cadence", value: "Every 2 hours", mutable: "Policy" },
  { parameter: "Stream length", value: "~48 hours per collection", mutable: "Policy" },
  { parameter: "Basket", value: "CASHCAT + PONS + AI + microduck, toward ~5", mutable: "Policy" },
  { parameter: "Chain", value: "Robinhood Chain (4663)", mutable: "Fixed" },
];
