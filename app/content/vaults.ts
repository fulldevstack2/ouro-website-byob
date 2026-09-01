/**
 * The vaults: two index tokens (HOOD10, INDEX) × three payout assets (the deposit token, WETH, USDG).
 *
 * Sources: ../hood10-vault-contracts (README, script/Deploy.s.sol defaults), ../hood10-vault-ui
 * src/config/contracts.ts, and ../HOOD10-VS-INDEX.md (chain measurements, 2026-08-27). Flip a vault's
 * `status` and set its `address` as each contract ships; the page reads everything from here.
 */
export type TokenKey = "hood10" | "index";
export type PayoutKey = "compound" | "weth" | "usdg";
export type VaultStatus = "awaiting-deploy" | "in-build";

export interface IndexToken {
  key: TokenKey;
  symbol: string;
  name: string;
  address: `0x${string}`;
  /** Self-hosted token mark (public/tokens). */
  icon: string;
  siteUrl: string;
  /** Public docs for how the token pays dividends; when absent the site is linked instead. */
  docsUrl?: string;
  /** One line on the trade tax, e.g. "5% of the ETH leg". */
  taxLine: string;
  /** What the dividend is paid in. */
  dividend: string;
  /** How often it is paid. */
  cadence: string;
  /** Minimum holding to receive dividends. */
  threshold: string;
  /** The pool hook that charges the tax. */
  hook: { name: string; address: `0x${string}` };
}

export const TOKENS: IndexToken[] = [
  {
    key: "hood10",
    symbol: "HOOD10",
    name: "Robinhood10 Index",
    address: "0x0D257cA40d40090BE60C2d2Ed5bB3535392838cc",
    icon: "/tokens/hood10.png",
    siteUrl: "https://www.hood10.xyz/",
    docsUrl: "https://www.hood10.xyz/docs",
    taxLine: "5% of the ETH leg on every buy and sell",
    dividend: "The ten deepest Robinhood Chain tokens, in kind",
    cadence: "Roughly every three hours",
    threshold: "100,000 HOOD10 (0.01% of supply)",
    hook: { name: "HOOD10 pool hook", address: "0x75A54357D9C78a2Db19004a5FDc76c50F9242AEC" },
  },
  {
    key: "index",
    symbol: "INDEX",
    name: "The Index",
    address: "0x56910D4409F3a0C78C64DD8D0545FF0705389870",
    icon: "/tokens/index.png",
    siteUrl: "https://theindex.finance/",
    taxLine: "3% of the ETH leg, plus the pool's 1% LP fee",
    dividend: "18 tokenized Robinhood stocks, bought with USDG",
    cadence: "Hourly",
    threshold: "10,000 INDEX",
    hook: { name: "INDEX fee hook", address: "0x2cd91bd228ff4c537031d6b8204782090c84c0cc" },
  },
];

export interface Payout {
  key: PayoutKey;
  /** Column label, with the token symbol filled in for the compounding vault. */
  label: (t: IndexToken) => string;
  asset: (t: IndexToken) => string;
  text: (t: IndexToken) => string;
}

export const PAYOUTS: Payout[] = [
  {
    key: "compound",
    label: (t) => `Pays in ${t.symbol}`,
    asset: (t) => t.symbol,
    text: (t) =>
      `Dividends are sold for ${t.symbol} and booked into the vault. Your share count stays the same and each share is worth more ${t.symbol} after every harvest. Nothing to claim. Each rebuy routes through the cheapest venue the keeper can quote.`,
  },
  {
    key: "weth",
    label: () => "Pays in WETH",
    asset: () => "WETH",
    text: (t) => `Dividends are sold for WETH, which accrues to your shares until you claim it. Your ${t.symbol} stays exactly as deposited. The yield arrives in ETH.`,
  },
  {
    key: "usdg",
    label: () => "Pays in USDG",
    asset: () => "USDG",
    text: (t) =>
      `Dividends are sold for USDG, a dollar stablecoin, which accrues to your shares until you claim it. Your ${t.symbol} stays exactly as deposited. The yield arrives in dollars.`,
  },
];

export interface VaultEntry {
  token: TokenKey;
  payout: PayoutKey;
  status: VaultStatus;
  /** Share token symbol once fixed at deploy (it is also the permit domain, so it never changes). */
  shareSymbol?: string;
  address: `0x${string}` | null;
}

export const VAULTS: VaultEntry[] = [
  { token: "hood10", payout: "compound", status: "awaiting-deploy", shareSymbol: "vHOOD10", address: null },
  { token: "hood10", payout: "weth", status: "in-build", address: null },
  { token: "hood10", payout: "usdg", status: "in-build", address: null },
  { token: "index", payout: "compound", status: "in-build", address: null },
  { token: "index", payout: "weth", status: "in-build", address: null },
  { token: "index", payout: "usdg", status: "in-build", address: null },
];

export const STATUS_LABEL: Record<VaultStatus, string> = { "awaiting-deploy": "Awaiting deploy", "in-build": "In build" };

export function vaultFor(token: TokenKey, payout: PayoutKey): VaultEntry {
  return VAULTS.find((x) => x.token === token && x.payout === payout)!;
}

/** Terms shared by every vault (from the deployed design's defaults). */
export const TERMS = {
  performanceFeePct: 10,
  maxPerformanceFeePct: 30,
  profitUnlock: "1 day",
  maxProfitUnlock: "30 days",
  venue: { name: "Uniswap UniversalRouter (Robinhood fork)", address: "0x8876789976dEcBfCbBbe364623C63652db8C0904" as const },
  weth: { name: "WETH", address: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" as const },
  /** TODO: URL of the vault app once it is hosted. */
  appUrl: "#",
};
