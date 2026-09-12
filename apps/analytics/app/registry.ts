/**
 * The project registry, and the coverage manifest that travels with each entry.
 *
 * ── Why a registry ──
 * Adding the next tax-index token that launches on Robinhood Chain should touch this file, add one
 * source adapter in ouro-monitor, and change no page and no API shape. `PROJECTS` below is the whole
 * list; every page derives from it. `LAUNCHPAD` is a fourth entry kept deliberately un-shipped, as a
 * fixture: if adding it ever requires editing a component, the seam has stopped working and the
 * registry has quietly become a hard-coded list of three.
 *
 * ── Why a coverage manifest ──
 * This site ranks projects it does not control, on a domain Ouro owns. That only works if what each
 * figure rests on is stated beside the figure, because the projects do NOT all expose the same
 * things, and the asymmetry does not run one way:
 *
 *   · INDEX's tax is ESTIMATED — 3% of the ETH leg of every swap on the hook pool, because the hook
 *     emits nothing. Ouro's is measured. HOOD10's will be exact (`FeeAccrued`) once it is indexed.
 *   · Per-wallet payout history exists for OURO alone, because only that source writes receipts.
 *   · OURO's APR rests on days of history. INDEX's rests on thousands of epochs.
 *
 * Printing those side by side without saying which is which is not neutrality — it is being quiet
 * about who the omission flatters. So every metric carries a `CoverageRecord`, one component renders
 * it identically for every project, and a blank cell has a reason attached rather than reading as a
 * verdict on the project.
 *
 * ── Where this lives, eventually ──
 * ouro-monitor serves this from `GET /v1/projects` (scope §7.2). Until it does, the shape is proven
 * here against the endpoints that already exist, and `lib/projects.ts` composes the uniform row on
 * the client. Moving it server-side should change that one file and none of these types.
 */

/** How much a figure is worth, stated per project per metric. */
export type CoverageState =
  /** Read from the chain's own events. The figure means exactly what it says. */
  | "measured"
  /** Derived, because the contract does not emit what would settle it. Stated wherever it is shown. */
  | "estimated"
  /** Nothing indexed for it yet. A dash with a reason — never a zero, and never silence. */
  | "not_indexed";

export interface CoverageRecord {
  state: CoverageState;
  /** One short clause, rendered beside the figure. Why it is estimated, or why it is missing. */
  note?: string;
  /** For `not_indexed`: when it is expected, as an ISO date. A badge with no date ages badly. */
  eta?: string;
  /** For a rate: the window it is measured over, and the history that window sits inside. */
  basisDays?: number;
  historyDays?: number;
}

/** Everything a project page can show. A registry entry declares coverage for each one. */
export type Metric =
  | "price"
  | "marketCap"
  | "volume24h"
  | "paidAllTime"
  | "paid24h"
  | "assets"
  | "holders"
  | "recipients"
  | "ratePerLine"
  | "apr"
  | "nextPayout"
  | "tax"
  | "wallet";

export const METRICS: { key: Metric; label: string; hint?: string }[] = [
  { key: "price", label: "Price" },
  { key: "marketCap", label: "Fully diluted value" },
  { key: "volume24h", label: "24 h volume", hint: "and the taxed share of it" },
  { key: "paidAllTime", label: "Airdropped, all time" },
  { key: "paid24h", label: "Airdropped, 24 h" },
  { key: "assets", label: "Tokens paid out" },
  { key: "holders", label: "Holders above the line" },
  { key: "recipients", label: "Wallets paid", hint: "in the most recent cycle" },
  { key: "ratePerLine", label: "Rate per line, per day" },
  { key: "apr", label: "APR", hint: "annualised from the basis shown" },
  { key: "nextPayout", label: "Next payout" },
  { key: "tax", label: "Tax funding it" },
  { key: "wallet", label: "Per-wallet history" },
];

export interface Project {
  /** Matches the monitor's source key, so one string addresses both sides. */
  key: string;
  symbol: string;
  name: string;
  token: `0x${string}`;
  decimals: number;
  /** Trade tax in basis points of the ETH leg. */
  taxBps: number;
  /** The balance a wallet must hold to be paid at all, in whole tokens. */
  dividendLineTokens: number;
  /** Nominal seconds between payouts. What "next payout" counts against. */
  cadenceSec: number;
  /** The ouro-monitor source that indexes it, or null if none exists yet. */
  adapter: string | null;
  /** Who runs it. Shown on the project page — this site is not the operator of most of these. */
  operator: "ouro" | "third-party";
  blurb: string;
  /**
   * One reason covering every un-indexed metric on this project.
   *
   * Hoisted out of the cells on purpose. When a whole column is missing for the SAME reason, that
   * sentence belongs once under the column head — printed in all seven cells it becomes wallpaper,
   * and teaches the reader to skip the notes that DO differ from cell to cell.
   */
  notIndexedReason?: string;
  coverage: Record<Metric, CoverageRecord>;
}

const EXPLORER = "https://robinhoodchain.blockscout.com";
export const explorerToken = (address: string) => `${EXPLORER}/token/${address}`;
export const explorerTx = (hash: string) => `${EXPLORER}/tx/${hash}`;

/**
 * Market data comes from GeckoTerminal and does not depend on the indexer, so it stays live even for
 * a project the indexer has never synced.
 *
 * Deliberately no `note`. The provenance is identical for every project and every market row, so a
 * per-cell note would repeat the same sentence nine times and teach the reader to ignore notes —
 * which is expensive, because the notes that DO differ are the point of this table. It is stated
 * once, in the page footer.
 */
const MARKET_MEASURED: CoverageRecord = { state: "measured" };

/**
 * Every metric at once — for a project the indexer has never synced.
 *
 * No per-cell note: the shared reason goes on the project as `notIndexedReason` and is rendered
 * once. Individual entries can still be overridden afterwards with a note that is genuinely about
 * that one metric.
 */
const allNotIndexed = (eta?: string): Record<Metric, CoverageRecord> =>
  Object.fromEntries(METRICS.map(({ key }) => [key, { state: "not_indexed", eta }])) as Record<
    Metric,
    CoverageRecord
  >;

export const PROJECTS: Project[] = [
  {
    key: "index",
    symbol: "INDEX",
    name: "The Index",
    token: "0x56910D4409F3a0C78C64DD8D0545FF0705389870",
    decimals: 18,
    taxBps: 300,
    dividendLineTokens: 10_000,
    cadenceSec: 3600,
    adapter: "index",
    operator: "third-party",
    blurb:
      "Taxes its own trades, buys a basket of stocks with the proceeds, and pays the basket out to every wallet above the line each cycle.",
    coverage: {
      price: MARKET_MEASURED,
      marketCap: MARKET_MEASURED,
      volume24h: MARKET_MEASURED,
      paidAllTime: { state: "measured", note: "USDG actually spent, per cycle" },
      paid24h: { state: "measured" },
      assets: { state: "measured", note: "the cycle's own stock array" },
      holders: { state: "measured", note: "replayed from the token's transfers" },
      recipients: { state: "measured" },
      ratePerLine: { state: "measured", note: "cycles are allocated pro-rata by balance" },
      apr: { state: "measured", basisDays: 7 },
      nextPayout: { state: "measured", note: "nextDistribution() — an exact due time" },
      tax: {
        state: "estimated",
        note: "3% of the ETH leg of every swap on the hook pool; the hook emits nothing to settle it",
      },
      wallet: { state: "not_indexed", note: "payout receipts are not indexed for this project" },
    },
  },
  {
    key: "ouro",
    symbol: "OURO",
    name: "OuroLayer",
    token: "0x8ea0eb3505f5b3bd2bbea0febae0ce850cc73ecc",
    decimals: 18,
    taxBps: 500,
    dividendLineTokens: 100_000,
    cadenceSec: 7200,
    adapter: "ouro",
    operator: "ouro",
    blurb:
      "Taxes its own trades and splits the proceeds: half to holders as an airdrop, half into liquidity the protocol keeps and earns fees on.",
    coverage: {
      price: MARKET_MEASURED,
      marketCap: MARKET_MEASURED,
      volume24h: MARKET_MEASURED,
      paidAllTime: { state: "measured", note: "from the Airdropper's own events" },
      paid24h: { state: "measured" },
      assets: { state: "measured", note: "per cycle, per asset" },
      holders: {
        state: "not_indexed",
        note: "the count lives on the payout registry endpoint, which is uncached by design and not for a dashboard to poll — it needs /v1/projects",
      },
      recipients: { state: "measured", note: "wallets the last cycle actually paid" },
      ratePerLine: {
        state: "measured",
        note: "a floor for most wallets: the keeper's taper pays the three largest less than pro-rata",
      },
      // The number the whole site can most easily mislead with. It ships with its window attached.
      apr: { state: "measured", basisDays: 7, historyDays: 9.2, note: "young — the rate tracks launch volume" },
      nextPayout: { state: "measured", note: "wall-clock keeper wake, not an on-chain clock" },
      tax: { state: "measured" },
      wallet: { state: "measured", note: "every receipt, with the transaction that paid it" },
    },
  },
  {
    key: "hood10",
    symbol: "HOOD10",
    name: "Robinhood10 Index",
    token: "0x0D257cA40d40090BE60C2d2Ed5bB3535392838cc",
    decimals: 18,
    taxBps: 500,
    dividendLineTokens: 100_000,
    cadenceSec: 10_800,
    adapter: "hood10",
    operator: "third-party",
    blurb:
      "Taxes its own trades and distributes a basket of ten constituents to holders through a Merkle distributor, one period at a time.",
    notIndexedReason: "not backfilled yet — 16.07M blocks of history to replay",
    coverage: {
      // Spread FIRST, then override. The other way round, `allNotIndexed` silently overwrites the
      // three market rows below and the page claims we cannot read HOOD10's price — which we can.
      // Set the eta from the Phase 0 spike's measurement, and then hit it. A badge with no date on
      // a neutral scoreboard ages into exactly the accusation it was meant to avoid.
      ...allNotIndexed(undefined),
      // Market data does not go through the indexer, so these three are live even while the rest is not.
      price: MARKET_MEASURED,
      marketCap: MARKET_MEASURED,
      volume24h: MARKET_MEASURED,
      // The one thing worth stating positively about it: once indexed, its tax is better than INDEX's.
      tax: {
        state: "not_indexed",
        note: "will be exact when indexed — the hook emits FeeAccrued per swap",
      },
    },
  },
];

/**
 * The fourth project, deliberately not in `PROJECTS`.
 *
 * It exists so that "the registry is pluggable" is a checked claim rather than an intention. Adding
 * a project should be: append an entry, add a source adapter in ouro-monitor, done. If shipping this
 * one ever needs a component changed, something has hard-coded the three above.
 */
export const LAUNCHPAD_FIXTURE: Project = {
  key: "example",
  symbol: "EXAMPLE",
  name: "Example Index",
  token: "0x0000000000000000000000000000000000000000",
  decimals: 18,
  taxBps: 400,
  dividendLineTokens: 50_000,
  cadenceSec: 14_400,
  adapter: null,
  operator: "third-party",
  blurb: "A registry fixture. Not a real project, and never rendered outside the registry test.",
  notIndexedReason: "no source adapter exists for this project",
  coverage: allNotIndexed(),
};

/**
 * How the comparison table is sorted by default.
 *
 * It is a stated, factual order, and it is never "Ouro first". All-time paid is the honest default
 * for a page about airdrops: it ranks by the thing the page is actually about, and it currently puts
 * a project this site does not operate at the top. The column header names the order, and every
 * column sorts.
 */
export type SortKey = "paidAllTime" | "marketCap" | "apr" | "holders" | "symbol";

export const DEFAULT_SORT: SortKey = "paidAllTime";

export const SORT_LABELS: Record<SortKey, string> = {
  paidAllTime: "Airdropped, all time",
  marketCap: "Fully diluted value",
  apr: "APR",
  holders: "Holders",
  symbol: "Name",
};

export const byKey = (key: string): Project | undefined => PROJECTS.find((p) => p.key === key);
