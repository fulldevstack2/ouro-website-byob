import { useMemo, useState } from "react";

import type { Route } from "./+types/home";
import { Charts, type MeasureKey } from "~/components/Charts";
import { Corrections } from "~/components/Corrections";
import { DASH } from "~/components/Coverage";
import { Elapsed } from "~/components/Elapsed";
import { Leaderboard } from "~/components/Leaderboard";
import { Matrix } from "~/components/Matrix";
import { useSeries, withinDays, type Point, type Series } from "~/lib/series";
import { useReveal } from "~/lib/motion";
import { sortRows, useProjects } from "~/lib/projects";
import { usePainted } from "~/lib/snapshot";
import { DEFAULT_SORT, PROJECTS, SORTABLE, SORT_LABELS, SORT_ORDER, SORT_RANK, type SortKey } from "~/registry";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Airdrop Meta · Robinhood Chain" },
    {
      name: "description",
      content:
        "Every tax-index token on Robinhood Chain that pays its holders, on one page. What each has airdropped, to how many wallets and at what rate, read from the chain, with what each figure rests on stated beside it.",
    },
  ];
}

/**
 * The lede, at one line.
 *
 * It was four: a sentence naming what is here, a sentence listing the columns, and two sentences of
 * method. The columns name themselves twenty pixels lower, and the method is now one disclosure at
 * the foot of the page for the reader who wants it. What is left is the claim that makes the page
 * worth opening, which is that none of this is self-reported.
 */
const LEDE = "Every tax-index token on Robinhood Chain that pays its holders, side by side, read from the chain.";

const PROJECT_KEYS = PROJECTS.map((p) => ({ key: p.key, symbol: p.symbol }));

/** Per-project daily payouts, keyed for the cards. */
function byProject(series: Series[], days: number | null): Record<string, Point[]> {
  return Object.fromEntries(series.map((s) => [s.key, withinDays(s.points, days)]));
}

export default function Home() {
  const [sort, setSort] = useState<SortKey>(DEFAULT_SORT);
  /** The project the reader is tracing through the page, if any. Never set by default. */
  const [focus, setFocus] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<number | null>(30);

  const live = useProjects();
  const liveSeries = useSeries(PROJECT_KEYS);
  const painted = usePainted(live, liveSeries);
  useReveal();

  const ordered = sortRows(painted.rows, sort);
  const perProject = useMemo(() => byProject(painted.paid, windowDays), [painted.paid, windowDays]);
  const chartSeries = useMemo(
    () => ({ gaps: painted.gaps, tax: painted.tax, recipients: painted.recipients }) as Record<MeasureKey, Series[]>,
    [painted.gaps, painted.tax, painted.recipients],
  );

  const loading = painted.source === "empty" && live.configured;

  /**
   * What is on screen, said plainly.
   *
   * "Cached" is its own state rather than being folded into "Live", because the page's whole claim is
   * that the figures came off the chain just now. Showing yesterday's under a green light would be
   * the one dishonest thing on it.
   */
  const status = !live.configured
    ? { state: "off", text: "Monitor not configured" }
    : painted.source === "live"
      ? { state: "live", text: "Live" }
      : painted.source === "cache"
        ? { state: "cached", text: live.error ? "Offline" : "Cached" }
        : live.error
          ? { state: "off", text: "Monitor unreachable" }
          : { state: "loading", text: "Reading the chain" };

  return (
    <>
      <div className="container masthead">
        <div className="masthead-main">
          <p className="eyebrow">Robinhood Chain · 4663</p>
          <h1>The airdrop meta, read from the chain</h1>
          <p className="lede">{LEDE}</p>
        </div>
        <div className="masthead-meta">
          <span className="live" data-state={status.state}>
            <span className="dot" aria-hidden="true" />
            {status.text}
          </span>
          {/* Fills over the poll interval and restarts when a read lands. The one piece of always-on
              motion that is telling the reader something: when the next read is due. */}
          {status.state === "live" ? (
            <span className="poll" key={painted.generatedAt ?? 0} aria-hidden="true">
              <span className="poll-fill" />
            </span>
          ) : null}
          <span className="meta-line">
            {status.state === "live" && painted.generatedAt ? (
              <Elapsed sinceMs={painted.generatedAt * 1000} prefix="as of " suffix=" ago" />
            ) : status.state === "cached" && painted.cachedAt ? (
              <Elapsed sinceMs={painted.cachedAt} prefix="your last read, " suffix=" old" />
            ) : live.configured ? (
              "waiting on the first read"
            ) : (
              "no monitor origin set"
            )}
          </span>
          <span className="meta-line">
            {painted.rows.length} tokens · source <b>ouro-monitor</b>
          </span>
        </div>
      </div>

      <section className="container section" data-reveal="">
        <div className="section-head">
          <div>
            <h2>Ranked by {SORT_RANK[sort]}</h2>
            <p className="sub cap">
              {SORT_ORDER[sort]}. Any row of the table below re-ranks these, and selecting a token traces it
              through the charts and the table.
            </p>
          </div>
          <div className="controls">
            <label className="seg-label" htmlFor="sort">
              Rank by
            </label>
            <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              {SORTABLE.map((k) => (
                <option key={k} value={k}>
                  {SORT_LABELS[k]}
                </option>
              ))}
            </select>
            {focus ? (
              <button type="button" className="tab solo" onClick={() => setFocus(null)}>
                Clear {focus.toUpperCase()}
              </button>
            ) : null}
          </div>
        </div>

        <Leaderboard rows={ordered} sort={sort} focus={focus} onFocus={setFocus} paid={perProject} loading={loading} />
      </section>

      <Charts
        series={chartSeries}
        order={ordered.map((r) => r.project.key)}
        windowDays={windowDays}
        onWindow={setWindowDays}
        focus={focus}
        loading={loading || !painted.hasSeries}
      />

      <section className="container section" data-reveal="">
        <div className="section-head">
          <div>
            <h2>Every figure, side by side</h2>
            <p className="sub">
              Press any row to rank by it. Where a figure is estimated or not yet indexed the cell says so, and a
              blank is about our coverage, never a zero for the project.
            </p>
          </div>
        </div>

        <Matrix rows={ordered} sort={sort} onSort={setSort} focus={focus} onFocus={setFocus} />
      </section>

      <section className="container section" data-reveal="">
        <details className="method">
          <summary>How to read this page</summary>
          <div className="method-body">
            <p className="note">
              <strong>The rates are not comparing like with like, and the row says so.</strong> Every APR here is
              real and measured, but they rest on very different things. A rate from a fortnight of payouts over a
              million dollars of eligible supply is not the same kind of number as one from thousands of epochs
              over twenty-eight times the base. That is why the window sits under the figure rather than behind a
              tooltip: the basis is not a footnote, it is half the rate.
            </p>
            <p className="note">
              <strong>A blank is about our coverage, not about the project.</strong> Where a cell is empty it says
              why underneath, either estimated or not yet indexed. Nothing here is rendered as a zero because we
              have not read it, and a total leaves out what it could not count rather than counting it as nothing.
            </p>
            <p className="note">
              <strong>The panels do not share an axis.</strong> These tokens differ by an order of magnitude, so
              one shared scale flattens the smaller ones into the baseline and hides the shape that is worth
              plotting. Every panel is drawn on the scale that shows it and names its own peak, so the panels are
              read for shape and the table below them for size.
            </p>
          </div>
        </details>
      </section>

      <footer className="container foot">
        <span>Read from Robinhood Chain · nothing reported by hand</span>
        <span>Operated by Ouro · unaffiliated with the other projects listed</span>
        <span>Price, value and volume: DexScreener, polled every 30 s</span>
        <Corrections />
      </footer>
    </>
  );
}
