import { useState, type ReactNode } from "react";

import type { Route } from "./+types/home";
import { ago, fmtNum, fmtUsd } from "@ouro/monitor-client";
import { fmtHours } from "~/lib/cadence";
import { LineChart } from "~/components/LineChart";
import { useSeries, type Series } from "~/lib/series";
import { Basis, DASH, Figure } from "~/components/Coverage";
import { sortRows, useProjects, type ProjectRow } from "~/lib/projects";
import { DEFAULT_SORT, METRICS, PROJECTS, SORT_LABELS, type Metric, type SortKey } from "~/registry";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Airdrop Meta · Robinhood Chain" },
    {
      name: "description",
      content:
        "Every tax-index token on Robinhood Chain that pays its holders, on one page: what each has airdropped, to how many wallets, at what rate, read from the chain — with what each figure rests on stated beside it.",
    },
  ];
}

const LEDE =
  "Every tax-index token on Robinhood Chain that pays its holders, side by side. What each has paid, to how many wallets, in which tokens, and at what rate — read from the chain, none of it reported by hand. Where a figure is estimated or not yet indexed, the cell says so.";

/**
 * One cell.
 *
 * Returns `null` for "we do not have this", which `Figure` renders as a dash with the coverage note
 * attached. It must never return "0" for an absent figure: zero is a claim about the project, a dash
 * is a statement about our coverage, and on a page about other people's projects that difference is
 * the whole editorial position.
 */
function cell(metric: Metric, row: ProjectRow): { value: string | null; extra?: ReactNode } {
  const p = row.project;
  switch (metric) {
    case "price":
      return { value: row.priceUsd === null ? null : fmtUsd(row.priceUsd, { exact: true }) };

    case "marketCap":
      return {
        value: row.marketCapUsd === null ? null : fmtUsd(row.marketCapUsd, { compact: true }),
      };

    case "volume24h": {
      const v = row.volume;
      if (v.totalUsd === null) return { value: null };
      return {
        value: fmtUsd(v.totalUsd, { compact: true }),
        extra: (
          <span className="basis">
            {v.taxedShare === null
              ? // No canonical pool in the response: the share is unknown, not zero.
                `across ${v.pools ?? "?"} pools · taxed share unavailable`
              : `${(v.taxedShare * 100).toFixed(1)}% taxed across ${v.pools} pools · ${fmtUsd(
                  v.totalUsd - (v.canonicalUsd ?? 0),
                  { compact: true },
                )} untaxed`}
          </span>
        ),
      };
    }

    case "paidAllTime": {
      const { pricedPeriods: pr, closedPeriods: cl } = row;
      const partial = pr !== null && cl !== null && pr < cl;
      if (row.paidAllTimeUsd === null) return { value: null };
      return {
        // "at least", because the unpriced cycles are real payouts contributing nothing to the sum.
        value: `${partial || row.paidAllTimeTruncated ? "≥ " : ""}${fmtUsd(row.paidAllTimeUsd, { compact: true })}`,
        extra: partial ? (
          <span className="basis">
            only {pr} of {cl} payout cycles could be priced — the rest paid wallets this figure does not count
          </span>
        ) : row.paidAllTimeTruncated ? (
          <span className="basis">at least — older cycles beyond the page were not summed</span>
        ) : undefined,
      };
    }

    case "paid24h":
      return { value: row.paid24hUsd === null ? null : fmtUsd(row.paid24hUsd, { compact: true }) };

    case "assets": {
      const syms = (row.assets?.map((a) => a.symbol).filter(Boolean) ?? []) as string[];
      if (!syms.length) return { value: null };
      // INDEX pays eighteen stocks in a cycle. The full list is a paragraph, not a cell — it forces
      // the column wide enough to push every other project off the screen. Name a few, count the
      // rest; the project page is where the whole basket belongs.
      const SHOWN = 4;
      const rest = syms.length - SHOWN;
      return {
        value: syms.slice(0, SHOWN).join(" · "),
        extra: rest > 0 ? <span className="basis">+{rest} more</span> : undefined,
      };
    }

    case "holders":
      return {
        value: row.holdersAboveLine === null ? null : fmtNum(row.holdersAboveLine),
        extra: <span className="basis">line: {fmtNum(p.dividendLineTokens)} {p.symbol}</span>,
      };

    case "recipients":
      return { value: row.recipientsLast === null ? null : fmtNum(row.recipientsLast) };

    case "ratePerLine":
      return {
        value:
          row.ratePerLineUsdPerDay === null ? null : `${fmtUsd(row.ratePerLineUsdPerDay, { exact: true })}/day`,
        extra: <span className="basis">per {fmtNum(p.dividendLineTokens)} {p.symbol}</span>,
      };

    case "apr": {
      const { aprWindowPriced: wp, aprWindowTotal: wt } = row;
      // A rate divided by a window in which some cycles carry no value is understated by exactly the
      // share it could not see. Understating a competitor is as unfair as overstating ourselves.
      const partial = wp !== null && wt !== null && wt > 0 && wp < wt;
      return {
        value: row.aprPct === null ? null : `${partial ? "≥ " : ""}${row.aprPct.toFixed(1)}%`,
        extra: (
          <>
            <Basis basisDays={row.aprBasisDays} historyDays={row.aprHistoryDays} />
            {partial ? (
              <span className="basis">
                understated: {wp} of {wt} cycles in the window could be priced
              </span>
            ) : null}
          </>
        ),
      };
    }

    /**
     * What the project's payout rhythm ACTUALLY is.
     *
     * This replaced "every 1 h", which came from the configured interval and described a schedule
     * none of these projects keeps — INDEX's real gaps run p50 1.0h to a 58.9h max. The median alone
     * would be equally misleading, so the spread rides with it.
     */
    case "payoutRhythm": {
      const c = row.cadence;
      if (c.medianH === null) return { value: null };
      return {
        value: `~${fmtHours(c.medianH)}`,
        extra: (
          <span className="basis">
            typical · 90% within {fmtHours(c.p90H)} · longest {fmtHours(c.maxH)} ({c.samples} cycles)
          </span>
        ),
      };
    }

    /**
     * Elapsed since the last payout, and whether that is unusual FOR THIS PROJECT.
     *
     * Replaces a "next in ~N" countdown that was computed from the contract's declared due time and
     * clamped negatives to zero — so INDEX, 10.4h past due, rendered "next in ~0 s". Elapsed time is
     * a fact; a predicted next payout, for a keeper-driven crank with no permissionless fallback,
     * is not.
     */
    case "lastPaid": {
      const c = row.cadence;
      if (c.sinceLastH === null) return { value: null };
      return {
        value: `${fmtHours(c.sinceLastH)} ago`,
        extra:
          c.quieterThanUsual === null ? undefined : (
            <span className="basis">
              {c.quieterThanUsual
                ? `longer than 90% of its recent gaps (${fmtHours(c.p90H)})`
                : `within its usual range (90% under ${fmtHours(c.p90H)})`}
            </span>
          ),
      };
    }

    case "tax":
      return { value: `${(p.taxBps / 100).toFixed(p.taxBps % 100 === 0 ? 0 : 1)}%` };

    case "wallet":
      return { value: p.coverage.wallet.state === "measured" ? "available" : null };
  }
}


const fmtDay = (t: number) => new Date(t * 1000).toISOString().slice(5, 10);
const fmtUsdAxis = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`;
const fmtCount = (v: number) => Math.round(v).toLocaleString("en-US");

/** One row of panels: the same measure for every project, each on the scale that shows it. */
function Panels({
  title,
  lede,
  series,
  format,
  unit,
}: {
  title: string;
  lede: string;
  series: Series[];
  format: (v: number) => string;
  unit: string;
}) {
  return (
    <>
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          <p className="sub">{lede}</p>
        </div>
      </div>
      <div className="charts">
        {series.map((s) => (
          <div className="chart-panel" key={s.key}>
            <h3>{s.symbol}</h3>
            {/* Each panel carries its own peak, because the panels do NOT share a y-axis —
                saying so is the difference between small multiples and a misread comparison. */}
            <p className="panel-note">
              own scale · peak {s.points.length ? format(Math.max(...s.points.map((p) => p.v))) : "—"}
            </p>
            <LineChart
              points={s.points}
              format={format}
              formatTime={fmtDay}
              label={`${s.symbol} ${title}`}
              emptyNote="not enough history to plot"
            />
          </div>
        ))}
      </div>
      <details className="chart-table">
        <summary>Show as a table</summary>
        <div className="table-scroll">
          <table className="matrix">
            <thead>
              <tr>
                <th scope="col">Project</th>
                <th scope="col">Points</th>
                <th scope="col">First</th>
                <th scope="col">Latest</th>
                <th scope="col">Peak</th>
                <th scope="col">Median</th>
              </tr>
            </thead>
            <tbody>
              {series.map((s) => {
                const v = s.points.map((p) => p.v).sort((a, b) => a - b);
                const med = v.length ? (v[Math.floor(v.length / 2)] as number) : null;
                const last = s.points[s.points.length - 1];
                const first = s.points[0];
                return (
                  <tr key={s.key}>
                    <td className="metric-name">{s.symbol}</td>
                    <td className="cell">{s.points.length}</td>
                    <td className="cell">{first ? fmtDay(first.t) : "—"}</td>
                    <td className="cell">{last ? format(last.v) : "—"}</td>
                    <td className="cell">{v.length ? format(v[v.length - 1] as number) : "—"}</td>
                    <td className="cell">{med === null ? "—" : format(med)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="legend">All figures in {unit}.</p>
      </details>
    </>
  );
}

/**
 * The two series the indexer can support for every project.
 *
 * Deliberately only two. Airdropped-dollars-per-day is unusable for HOOD10 (one unpriced basket leg
 * nulls 39 of its 43 periods), holders-over-time is unusable for $OURO (its source records no
 * per-epoch holder count), and price and volume history run to ten days and none for $OURO. On a
 * page whose claim is even-handedness, a two-of-three chart is worse than no chart.
 */
function ChartSection() {
  const { tax, recipients, loading } = useSeries(PROJECTS.map((p) => ({ key: p.key, symbol: p.symbol })));
  if (loading) return null;
  return (
    <section className="container section">
      <Panels
        title="Tax collected, per day"
        lede="What each project's trade tax brought in, by UTC day. This is the money the airdrops are paid out of. Days with no trading are omitted rather than drawn as zero."
        series={tax}
        format={fmtUsdAxis}
        unit="US dollars per day"
      />
      <div style={{ height: 28 }} />
      <Panels
        title="Wallets paid, per cycle"
        lede="How many wallets each payout cycle reached. Per cycle rather than per day, because a day holds a different number of cycles for each project — and for INDEX, anywhere from one to twenty."
        series={recipients}
        format={fmtCount}
        unit="wallets per payout cycle"
      />
    </section>
  );
}

export default function Home() {
  const [sort, setSort] = useState<SortKey>(DEFAULT_SORT);
  const { rows, loading, error, generatedAt, configured } = useProjects();
  const ordered = sortRows(rows, sort);

  const status = !configured
    ? "Monitor not configured"
    : error
      ? "Monitor unreachable — showing what was last read"
      : loading
        ? "Reading…"
        : "Live";

  return (
    <>
      <div className="container page-head">
        <p className="eyebrow">Robinhood Chain · 4663</p>
        <h1>The airdrop meta, read from the chain</h1>
        <p className="lede">{LEDE}</p>
      </div>

      <div className="container">
        <div className="strip">
          <span>
            <b>{status}</b>
          </span>
          <span>
            Projects tracked <b>{rows.length}</b>
          </span>
          {generatedAt ? (
            <span>
              As of <b>{ago(Math.floor(Date.now() / 1000) - generatedAt)}</b> ago
            </span>
          ) : null}
          <span>
            Source <b>ouro-monitor</b>
          </span>
        </div>
      </div>

      <section className="container section">
        <div className="section-head">
          <div>
            <h2>Side by side</h2>
            <p className="sub">
              Sorted by {SORT_LABELS[sort].toLowerCase()}, descending. Every column sorts; the order is never
              fixed to put any one project first.
            </p>
          </div>
          <div className="sortbar">
            <label htmlFor="sort">Sort by</label>
            <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  {SORT_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-scroll">
          <table className="matrix">
            <thead>
              <tr>
                <th scope="col" className="metric-name">
                  <span className="phead">
                    <span className="sym" style={{ fontSize: "var(--text-2xs)", letterSpacing: "var(--tracking-caps)", textTransform: "uppercase", color: "var(--text-muted)" }}>
                      Metric
                    </span>
                  </span>
                </th>
                {ordered.map((row) => (
                  <th scope="col" key={row.project.key}>
                    <span className="phead">
                      <span className="sym">{row.project.symbol}</span>
                      <span className="who">
                        {row.project.name}
                        {row.project.operator === "ouro" ? " · ours" : ""}
                      </span>
                      {/* Said once here rather than in each of this column's empty cells. */}
                      {row.project.notIndexedReason ? (
                        <span className="mark not-indexed">Not indexed</span>
                      ) : null}
                      {row.project.notIndexedReason ? (
                        <span className="mark-note">{row.project.notIndexedReason}</span>
                      ) : null}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map(({ key, label, hint }) => (
                <tr key={key}>
                  <td className="metric-name">
                    {label}
                    {hint ? <span className="hint">{hint}</span> : null}
                  </td>
                  {ordered.map((row) => {
                    const { value, extra } = cell(key, row);
                    const coverage = row.project.coverage[key];
                    return (
                      <td key={row.project.key}>
                        <Figure value={value} coverage={coverage} />
                        {/* The qualifier only belongs beside a figure that exists. */}
                        {value !== null && coverage.state !== "not_indexed" ? extra : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </section>

      <ChartSection />

      <section className="container section">
        <p className="note">
          <strong>The rates are not comparing like with like, and the row says so.</strong> Every APR here is
          real and measured, but they rest on very different things — a rate from nine days of payouts over a
          million dollars of eligible supply is not the same kind of number as one from thousands of epochs
          over twenty-eight times the base. That is why the window sits under the figure rather than behind a
          tooltip: the basis is not a footnote, it is half the rate.
        </p>

        <p className="note">
          <strong>A dash is about our coverage, not about the project.</strong> Where a cell is blank it says
          why underneath — estimated, or not yet indexed. Nothing here is rendered as a zero because we have
          not read it.
        </p>
      </section>

      <footer className="container foot">
        <span>Read from Robinhood Chain · nothing reported by hand</span>
        <span>Operated by Ouro · unaffiliated with the other projects listed</span>
        <span>{DASH} means not measured, not zero</span>
        <span>Prices and volume: GeckoTerminal / DexScreener, polled every 5 min</span>
      </footer>
    </>
  );
}
