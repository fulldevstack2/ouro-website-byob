/**
 * The vaults: three deposit tokens (OURO, HOOD10, INDEX) × three payout assets (the deposit token, WETH, USDG).
 * The three OURO vaults are live on Robinhood Chain since 2026-09-08 and the /vaults page is their app (it reads
 * and writes them with a connected wallet, see app/hooks/useVault.ts); the HOOD10 and INDEX ones are not deployed
 * and appear only as planned.
 *
 * Sources: ../hood10-vault-contracts (README "Deployments", chains/4663.reward-tokens.json,
 * broadcast/DeployRewardTokenVaults.s.sol/4663) and ../HOOD10-VS-INDEX.md (chain measurements, 2026-08-27). Flip a
 * vault's `status` and set its `address` as each contract ships; the page reads everything from here.
 */
export type TokenKey = "ouro" | "hood10" | "index";
export type PayoutKey = "compound" | "weth" | "usdg";
export type VaultStatus = "live" | "awaiting-deploy" | "in-build";

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
  /** Minimum holding to receive dividends, as shown. */
  threshold: string;
  /** The same line in whole tokens, for reading a vault's pooled balance against it. */
  thresholdTokens: number;
  /** The pool hook that charges the tax. */
  hook: { name: string; address: `0x${string}` };
}

export const TOKENS: IndexToken[] = [
  {
    key: "ouro",
    symbol: "OURO",
    name: "OuroLayer",
    address: "0x8Ea0eB3505f5B3Bd2BbEa0fEBae0cE850cC73ecc",
    icon: "/tokens/ouro.svg",
    siteUrl: "/",
    docsUrl: "/docs/",
    taxLine: "5% of the ETH leg on every buy and sell",
    dividend: "Ouro's airdrop: the Reserve basket (CASHCAT and PONS today), in kind",
    cadence: "About every two hours, each collection streamed over two days",
    threshold: "100,000 OURO (0.01% of supply)",
    thresholdTokens: 100_000,
    hook: { name: "OURO pool hook (letscash, shared with HOOD10)", address: "0x75A54357D9C78a2Db19004a5FDc76c50F9242AEC" },
  },
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
    thresholdTokens: 100_000,
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
    thresholdTokens: 10_000,
    hook: { name: "INDEX fee hook", address: "0x2cd91bd228ff4c537031d6b8204782090c84c0cc" },
  },
];

export interface Payout {
  key: PayoutKey;
  /** One line under the vault name in the accordion header: what it does with the yield. */
  summary: (t: IndexToken) => string;
  /** The same thing in a few words, for the header on a phone, where `summary` ran to two lines. */
  short: (t: IndexToken) => string;
  asset: (t: IndexToken) => string;
  text: (t: IndexToken) => string;
}

export const PAYOUTS: Payout[] = [
  {
    key: "compound",
    summary: (t) => `Deposit ${t.symbol}, earn more ${t.symbol}`,
    short: (t) => `Earn more ${t.symbol}`,
    asset: (t) => t.symbol,
    text: (t) =>
      `Yes \u2014 it goes straight back in. Every couple of hours the airdrop the vault received is sold and turned into more ${t.symbol}, which stays in the vault. Your balance simply gets bigger. There is nothing to collect and nothing to do, and you can withdraw the whole lot whenever you want. The buy-back goes through Ouro\u0027s own pool, so the 5% tax on it returns to holders instead of going to outside market makers.`,
  },
  {
    key: "weth",
    summary: (t) => `Deposit ${t.symbol}, earn ETH`,
    short: () => "Earn ETH",
    asset: () => "WETH",
    text: (t) => `Your ${t.symbol} is never sold and never moves \u2014 it comes back exactly as you put it in. Every couple of hours the airdrop the vault received is sold for ETH, and that ETH is yours to take out whenever you want.`,
  },
  {
    key: "usdg",
    summary: (t) => `Deposit ${t.symbol}, earn dollars`,
    short: () => "Earn dollars",
    asset: () => "USDG",
    text: (t) =>
      `Your ${t.symbol} is never sold and never moves \u2014 it comes back exactly as you put it in. Every couple of hours the airdrop the vault received is sold for USDG, a dollar stablecoin, and those dollars are yours to take out whenever you want. Good if you would rather the yield held its value.`,
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
  // Deployed 2026-09-08 (CREATE2, blocks 57376688 / 57376741 / 57376793) by 0x4183988484943ABE0cFD3Fb00925883Eb8Fb150C.
  // Fee recipient 0xd8E6c485aC9210A33B434325FAD5743310102405, keeper 0xEA1B87B70852e48FDcA9262Ca91018C44C19001c, and
  // ownership offered to 0x328A0309D8Eb9CE4a9bF5aB8Acf1E1391dF98586 (two-step, pending its acceptOwnership).
  // Names are the permit domain and never change.
  { token: "ouro", payout: "compound", status: "live", shareSymbol: "vOURO", address: "0x74ea0A8D3DE28dFbB4744A2b023c096bA532A514" },
  { token: "ouro", payout: "weth", status: "live", shareSymbol: "vOUROweth", address: "0xAc0E041AeDC87E115DA61566F84948afc792386B" },
  { token: "ouro", payout: "usdg", status: "live", shareSymbol: "vOUROusdg", address: "0x8EbF99A1C60bd0C5D00Eeea9ce32FBDAD7b6EA79" },
  { token: "hood10", payout: "compound", status: "awaiting-deploy", shareSymbol: "vHOOD10", address: null },
  { token: "hood10", payout: "weth", status: "in-build", address: null },
  { token: "hood10", payout: "usdg", status: "in-build", address: null },
  { token: "index", payout: "compound", status: "in-build", address: null },
  { token: "index", payout: "weth", status: "in-build", address: null },
  { token: "index", payout: "usdg", status: "in-build", address: null },
];

export const STATUS_LABEL: Record<VaultStatus, string> = { live: "Live", "awaiting-deploy": "Awaiting deploy", "in-build": "In build" };

/** Deposit tokens with at least one live vault, in display order. */
export const LIVE_TOKENS: IndexToken[] = TOKENS.filter((t) => VAULTS.some((v) => v.token === t.key && v.status === "live"));

/** The tokens the payout vaults pay, for reading balances, formatting amounts and marking the row. */
export const PAYOUT_TOKENS = {
  weth: { symbol: "WETH", address: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" as `0x${string}`, decimals: 18, icon: "/tokens/weth.svg" },
  usdg: { symbol: "USDG", address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as `0x${string}`, decimals: 6, icon: "/tokens/usdg.png" },
} as const;

/** Decimals of every deposit token; all three are plain 18-decimal ERC20s. */
export const TOKEN_DECIMALS: Record<TokenKey, number> = { ouro: 18, hood10: 18, index: 18 };

/** A deployed vault with everything the live panel needs resolved: its kind, and what it pays in. */
export interface LiveVault {
  token: IndexToken;
  payout: Payout;
  entry: VaultEntry & { address: `0x${string}`; shareSymbol: string };
  /** `compounding` pays in the deposit token by lifting the share price; `payout` streams a second token to claim. */
  kind: "compounding" | "payout";
  payoutSymbol: string;
  payoutDecimals: number;
  /** The payout token's address; null for the compounding vault, whose payout is the deposit token. */
  payoutAddress: `0x${string}` | null;
  /** The payout token's mark, for the pair on the row header. Null when it is the deposit token's own,
      so the header shows one mark rather than the same one twice. */
  payoutIcon: string | null;
}

export const LIVE_VAULTS: LiveVault[] = VAULTS.flatMap((entry): LiveVault[] => {
  if (entry.status !== "live" || !entry.address || !entry.shareSymbol) return [];
  const token = TOKENS.find((t) => t.key === entry.token)!;
  const payout = PAYOUTS.find((p) => p.key === entry.payout)!;
  const paid = entry.payout === "compound" ? null : PAYOUT_TOKENS[entry.payout];
  return [
    {
      token,
      payout,
      entry: entry as LiveVault["entry"],
      kind: paid ? "payout" : "compounding",
      payoutSymbol: paid ? paid.symbol : token.symbol,
      payoutDecimals: paid ? paid.decimals : TOKEN_DECIMALS[token.key],
      payoutAddress: paid ? paid.address : null,
      payoutIcon: paid ? paid.icon : null,
    },
  ];
});

export function vaultFor(token: TokenKey, payout: PayoutKey): VaultEntry {
  return VAULTS.find((x) => x.token === token && x.payout === payout)!;
}

/** Terms shared by every vault (from the deployed design's defaults). */
export const TERMS = {
  performanceFeePct: 10,
  maxPerformanceFeePct: 30,
  /**
   * Where the performance fee goes, in points of the harvest gain, so the two add up to
   * `performanceFeePct`. THE ONLY PLACE THIS SPLIT IS WRITTEN: the copy on /vaults and the home
   * page reads it from here.
   *
   * Operator policy, not a contract rule, and said as such wherever it appears. On chain the vault
   * pays the whole fee to a single `feeRecipient` (DividendVaultBase.feeRecipient) and has no notion
   * of a split; this is what that recipient does with it, exactly like the 5% tax's
   * "2% airdrop / 2% LP / 0.7% ops / 0.3% letscash" row in content/protocol.ts.
   */
  feeSplit: { airdrops: 7, ops: 3 },
  profitUnlock: "1 day",
  maxProfitUnlock: "30 days",
  venue: { name: "Uniswap UniversalRouter (Robinhood fork)", address: "0x8876789976dEcBfCbBbe364623C63652db8C0904" as const },
  weth: { name: "WETH", address: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" as const },
  usdg: { name: "USDG", address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as const },
  /** The vault app is the /vaults page itself: connect a wallet there to deposit, withdraw and claim. */
  appUrl: "/vaults/",
};
