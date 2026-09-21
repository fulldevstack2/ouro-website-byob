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
 *   · Protocol-owned liquidity exists for OURO alone — not because the other two are unindexed, but
 *     because they keep none. That is a `none`, not a `not_indexed`, and the difference matters.
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
  | "not_indexed"
  /**
   * The project does not have this thing at all. The reason, and NO badge.
   *
   * Distinct from `not_indexed` on purpose. "Not indexed" is an admission about us; printing it
   * where the project simply has nothing to report would blame our coverage for their design, and
   * on the protocol-owned liquidity row it would read as though INDEX and HOOD10 might have a
   * treasury we failed to find. They do not: their whole tax leaves as the basket they pay out. For
   * the same reason the cell writes "none" instead of spending the dash on it — see `cell()`.
   */
  | "none";

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
  | "payoutRhythm"
  | "lastPaid"
  | "tax"
  | "treasury";

/**
 * The bands the table is read in.
 *
 * The table used to open on Price, which is the one thing on it a reader can get anywhere else. The
 * page is about airdrops, so the airdrop rows come first and the market rows sit underneath as
 * context for them.
 */
export type MetricGroup = "airdrops" | "rhythm" | "market";

export const GROUPS: { key: MetricGroup; label: string }[] = [
  { key: "airdrops", label: "Airdrops" },
  { key: "rhythm", label: "Rhythm" },
  { key: "market", label: "Market and coverage" },
];

export interface MetricDef {
  key: Metric;
  label: string;
  hint?: string;
  group: MetricGroup;
  /**
   * Set when the projects can be ranked by this row, which is how the reader re-sorts: the row label
   * is the control. `order` names the direction in words, because "descending" is meaningless for
   * half of these — sorting by how often a project pays puts the SHORTEST gap first.
   */
  sort?: { order: string };
  /** How the figure is captioned when this metric is the one the leaderboard is ranked by. */
  caption?: string;
  /**
   * The label as it reads inside a sentence: "Ranked by …".
   *
   * Needed because lower-casing `label` turns APR into "apr". Written out rather than fixed with a
   * capitalisation rule, since the next acronym would break that too.
   */
  rank?: string;
}

export const METRICS: MetricDef[] = [
  { key: "paidAllTime", label: "Airdropped, all time", group: "airdrops", sort: { order: "largest first" }, caption: "airdropped, all time", rank: "airdropped, all time" },
  { key: "paid24h", label: "Airdropped, 24 h", group: "airdrops", sort: { order: "largest first" }, caption: "airdropped in 24 h", rank: "what it airdropped in 24 h" },
  { key: "assets", label: "Tokens paid out", group: "airdrops" },
  { key: "recipients", label: "Wallets paid", hint: "in the most recent cycle", group: "airdrops", sort: { order: "most wallets first" }, caption: "wallets paid last cycle", rank: "wallets paid last cycle" },
  { key: "holders", label: "Holders above the line", group: "airdrops", sort: { order: "most holders first" }, caption: "holders above the line", rank: "holders above the line" },
  { key: "ratePerLine", label: "Rate per line, per day", group: "airdrops", sort: { order: "highest first" }, caption: "per line, per day", rank: "rate per line" },
  { key: "apr", label: "APR", hint: "annualised from the basis shown", group: "airdrops", sort: { order: "highest first" }, caption: "APR", rank: "APR" },
  { key: "payoutRhythm", label: "How often it pays", hint: "measured, not the configured interval", group: "rhythm", sort: { order: "most often first" }, caption: "between payouts, typically", rank: "how often it pays" },
  { key: "lastPaid", label: "Last paid", group: "rhythm", sort: { order: "most recent first" }, caption: "since the last payout", rank: "how recently it paid" },
  /**
   * Shown, and not rankable.
   *
   * A unit price is the one figure here that is not comparable between these tokens: it is a market
   * size divided by whatever supply each of them chose to issue, so "ranked by price" ordered the
   * three by their decimals as much as by anything a reader could act on, and put a token first for
   * being scarce rather than for being worth more. Market cap is the same comparison made properly
   * and is the row directly underneath, which is what that control offers now.
   */
  { key: "price", label: "Price", group: "market" },
  { key: "marketCap", label: "Market cap", group: "market", sort: { order: "largest first" }, caption: "market cap", rank: "market cap" },
  { key: "volume24h", label: "24 h volume", hint: "and the taxed share of it", group: "market", sort: { order: "largest first" }, caption: "traded in 24 h", rank: "24 h volume" },
  { key: "tax", label: "Tax funding it", group: "market", sort: { order: "highest first" }, caption: "trade tax", rank: "the tax funding it" },
  /**
   * Not sortable, and that is deliberate.
   *
   * One of the three projects keeps a treasury, so ranking by this row would put Ouro first on a
   * page Ouro operates, with two dashes under it, every time it was pressed. The row is worth
   * showing because the difference between these designs is real; it is not worth offering as an
   * order. See DEFAULT_SORT for the same argument made about the column the table opens on.
   */
  { key: "treasury", label: "Protocol-owned liquidity", hint: "marked to market", group: "market" },
];

export interface Project {
  /** Matches the monitor's source key, so one string addresses both sides. */
  key: string;
  symbol: string;
  name: string;
  token: `0x${string}`;
  decimals: number;
  /**
   * The pool the trade tax is charged on — the project's canonical venue.
   *
   * DexScreener returns this verbatim as a pair's `pairAddress` (these are Uniswap v4 pool ids), so
   * it is how the taxed share of volume is identified: the canonical pool's 24h volume over the sum
   * across every pool the token trades in. Everything outside this pool is untaxed — volume that
   * funds no airdrop.
   */
  canonicalPoolId: `0x${string}`;
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
 * Price and value come from the indexer's market poller (GeckoTerminal / DexScreener) and do not
 * depend on the chain replay, so they stay live even for a project the indexer has never synced.
 * Volume is separate — see VOLUME_MEASURED.
 *
 * Deliberately no `note`. The provenance is identical for every project and every market row, so a
 * per-cell note would repeat the same sentence nine times and teach the reader to ignore notes —
 * which is expensive, because the notes that DO differ are the point of this table. It is stated
 * once, in the page footer.
 */
const MARKET_MEASURED: CoverageRecord = { state: "measured" };

/**
 * Volume is measured for every project, from DexScreener, independently of the indexer.
 *
 * It is summed across every pool the token trades in and split against the canonical taxed pool, so
 * the same figure covers a project the indexer has never seen. $OURO's volume used to read "not
 * indexed" here purely because `/v1/summary` does not carry it.
 */
const VOLUME_MEASURED: CoverageRecord = { state: "measured", note: "summed across every pool it trades in" };

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
    canonicalPoolId: "0x00dd2df2f17d431cf3a0938f06c9cf9abc5e9643b6cc466ca3f71f3af246edf3",
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
      volume24h: VOLUME_MEASURED,
      paidAllTime: { state: "measured", note: "basket paid_usd, valued when each cycle settled" },
      paid24h: { state: "measured" },
      assets: { state: "measured", note: "the cycle's own stock array" },
      holders: { state: "measured", note: "on-chain holderCount() for wallets at or above the line" },
      recipients: { state: "measured" },
      ratePerLine: { state: "measured", note: "cycles are allocated pro-rata by balance" },
      apr: { state: "measured", basisDays: 3, note: "paid USD / payable supply at the Dex price shown" },
      payoutRhythm: { state: "measured", note: "measured from up to its last 200 closed cycles" },
      lastPaid: { state: "measured", note: "closed cycles only" },
      tax: {
        state: "estimated",
        note: "3% of the ETH leg of every swap on the hook pool; the hook emits nothing to settle it",
      },
      treasury: { state: "none", note: "the whole tax buys the basket it pays out, so none is kept as liquidity" },
    },
  },
  {
    key: "ouro",
    symbol: "OURO",
    name: "OuroLayer",
    token: "0x8ea0eb3505f5b3bd2bbea0febae0ce850cc73ecc",
    decimals: 18,
    canonicalPoolId: "0x4abc526118181921d76bf184896938ae7c8fc0921abce79ebef3d36a622968a5",
    taxBps: 500,
    dividendLineTokens: 100_000,
    cadenceSec: 7200,
    adapter: "ouro",
    operator: "ouro",
    blurb:
      "Taxes its own trades: one point is airdropped to holders, 3.3 buy liquidity the protocol keeps, and every fee that liquidity earns goes back into it.",
    coverage: {
      price: MARKET_MEASURED,
      marketCap: MARKET_MEASURED,
      volume24h: VOLUME_MEASURED,
      paidAllTime: { state: "measured", note: "from the Airdropper's own events" },
      paid24h: { state: "measured" },
      assets: { state: "measured", note: "per cycle, per asset" },
      holders: {
        state: "measured",
        note: "above the line after policy exclusions (Sablier / PoolManager out)",
      },
      // No note: "in the most recent cycle" is already the column hint, and saying it again in
      // every cell is exactly the wallpaper that teaches a reader to skip the notes that differ.
      recipients: { state: "measured" },
      ratePerLine: {
        state: "measured",
        note: "a floor for most wallets: the keeper's taper pays the three largest less than pro-rata",
      },
      // History length comes from `/v1/ouro/yield`; do not hard-code a launch-era figure here.
      apr: { state: "measured", basisDays: 3, note: "paid USD / payable supply at the Dex price shown" },
      payoutRhythm: { state: "measured", note: "measured from up to its last 200 closed cycles" },
      lastPaid: { state: "measured", note: "closed cycles only" },
      tax: { state: "measured", note: "exact: the hook emits FeeAccrued per swap" },
      treasury: { state: "measured", note: "bought with 3.3 of the 5-point tax, and never handed out" },
    },
  },
  {
    key: "hood10",
    symbol: "HOOD10",
    name: "Robinhood10 Index",
    token: "0x0D257cA40d40090BE60C2d2Ed5bB3535392838cc",
    decimals: 18,
    canonicalPoolId: "0x2e152bc12f30bd46eb39f0ead2367df62b9572ba3a2d54ea3e3aca43c00ae9f6",
    taxBps: 500,
    dividendLineTokens: 100_000,
    cadenceSec: 10_800,
    adapter: "hood10",
    operator: "third-party",
    blurb:
      "Taxes its own trades and distributes a basket of ten constituents to holders through a Merkle distributor, one period at a time.",
    coverage: {
      price: MARKET_MEASURED,
      marketCap: MARKET_MEASURED,
      volume24h: VOLUME_MEASURED,
      /**
       * Fully priced as of 2026-09-13 (indexer price-loader fix). Earlier totals that looked like a
       * floor were understated because one unpriced basket leg nulls a whole period.
       */
      paidAllTime: {
        state: "measured",
        note: "from PeriodClosed / Claimed events; Merkle root itself is unverified on-chain",
      },
      paid24h: { state: "measured" },
      assets: { state: "measured", note: "the ten basket constituents, per period" },
      holders: { state: "measured", note: "replayed from the token's transfers" },
      recipients: { state: "measured" },
      ratePerLine: { state: "measured" },
      apr: { state: "measured", basisDays: 3, note: "paid USD / payable supply at the Dex price shown" },
      payoutRhythm: { state: "measured", note: "measured from up to its last 200 closed cycles" },
      lastPaid: { state: "measured", note: "closed cycles only" },
      // The one place HOOD10 is better instrumented than INDEX: its hook emits FeeAccrued per swap.
      tax: { state: "measured", note: "exact: the hook emits FeeAccrued per swap" },
      treasury: { state: "none", note: "the whole tax buys the basket it pays out, so none is kept as liquidity" },
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
  canonicalPoolId: "0x0000000000000000000000000000000000000000000000000000000000000000",
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
 * How the cards and the comparison table are ranked when the page opens, and the one order the
 * chart panels ever hold (see `chartOrder` in the home route).
 *
 * Rate per line, per day: what a holder above the line is actually paid, which is the figure a
 * reader comparing these tokens is here for. All-time paid held this slot until 2026-09-17 and
 * ranks by accumulated size instead, so the oldest token leads it whatever it pays today.
 *
 * Note what the change costs. The figures decide who leads, and they can put Ouro, whose domain this
 * sits on, at the top, where the old default put a project this site does not operate. The order is
 * still a stated, factual one, the cards' heading names it, the cards' select and every rankable row
 * of the table re-rank their own section in one press, and the operator disclosure is in the chrome
 * of every page. Keep all four, or this becomes a ranking that ranks its own author first and says
 * nothing about it.
 */
export type SortKey = Metric | "symbol";

export const DEFAULT_SORT: SortKey = "ratePerLine";

/** Every row that carries a `sort`, plus the alphabetical fallback. The table label IS the control. */
export const SORTABLE: SortKey[] = [...METRICS.filter((m) => m.sort).map((m) => m.key), "symbol"];

export const isSortable = (key: SortKey): boolean => SORTABLE.includes(key);

export const SORT_LABELS: Record<SortKey, string> = {
  ...(Object.fromEntries(METRICS.map((m) => [m.key, m.label])) as Record<Metric, string>),
  symbol: "Name",
};

/** "largest first", "most often first" — the direction, in words, printed next to the ranking. */
export const SORT_ORDER: Record<SortKey, string> = {
  ...(Object.fromEntries(METRICS.map((m) => [m.key, m.sort?.order ?? ""])) as Record<Metric, string>),
  symbol: "A to Z",
};

/** How the ranked figure is captioned on a leaderboard card. */
export const SORT_CAPTION: Record<SortKey, string> = {
  ...(Object.fromEntries(METRICS.map((m) => [m.key, m.caption ?? m.label.toLowerCase()])) as Record<Metric, string>),
  symbol: "airdropped, all time",
};

/** The label as it reads inside "Ranked by …". */
export const SORT_RANK: Record<SortKey, string> = {
  ...(Object.fromEntries(METRICS.map((m) => [m.key, m.rank ?? m.label.toLowerCase()])) as Record<Metric, string>),
  symbol: "name",
};

export const byKey = (key: string): Project | undefined => PROJECTS.find((p) => p.key === key);
