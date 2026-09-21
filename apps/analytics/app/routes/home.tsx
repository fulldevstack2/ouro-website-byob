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
 * method. The columns name themselves twenty pixels lower, and the method is gone from the page
 * entirely: each of its three points was already said where it applies — the basis sits under every
 * rate, a blank cell says underneath why it is blank, and each panel names its own peak — so the
 * disclosure at the foot was the page explaining itself twice. What is left is the claim that makes
 * the page worth opening, which is that none of this is self-reported.
 */
const LEDE = "Every tax-index token on Robinhood Chain that pays its holders, side by side, read from the chain.";

const PROJECT_KEYS = PROJECTS.map((p) => ({ key: p.key, symbol: p.symbol }));

/** Per-project daily payouts, keyed for the cards. */
function byProject(series: Series[], days: number | null): Record<string, Point[]> {
  return Object.fromEntries(series.map((s) => [s.key, withinDays(s.points, days)]));
}

export default function Home() {
  /**
   * One order per section, and a control that moves the section it sits in and nothing else.
   *
   * These were a single `sort`. The cards' select therefore re-ordered the table's columns as a side
   * effect, and pressing a row label in the table re-ranked three cards and three chart panels that
   * are a screen and a half above the reader by then — where `useFlip` deliberately does not animate
   * anything off screen, so the reader pressed a row and the only things that moved were things they
   * could not see. Now the select ranks the cards, a row label ranks the columns, and the panels hold
   * the page's default order (see `chartOrder`). Tracing one token still crosses all three, because
   * crossing sections is the whole of what the reader asks for by selecting it.
   */
  const [cardSort, setCardSort] = useState<SortKey>(DEFAULT_SORT);
  const [tableSort, setTableSort] = useState<SortKey>(DEFAULT_SORT);
  /** The project the reader is tracing through the page, if any. Never set by default. */
  const [focus, setFocus] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<number | null>(30);

  const live = useProjects();
  const liveSeries = useSeries(PROJECT_KEYS);
  const painted = usePainted(live, liveSeries);
  useReveal();

  const cardRows = useMemo(() => sortRows(painted.rows, cardSort), [painted.rows, cardSort]);
  const tableRows = useMemo(() => sortRows(painted.rows, tableSort), [painted.rows, tableSort]);
  /**
   * The panels follow neither control.
   *
   * They are small multiples, read side by side, and nothing above them claims an order: shuffling
   * them because another section was re-ranked would cost the reader the positions they had just
   * learned, for a claim the section never made. So they keep the order the page opens in, and move
   * only when the figures behind it do.
   */
  const chartOrder = useMemo(() => sortRows(painted.rows, DEFAULT_SORT).map((r) => r.project.key), [painted.rows]);
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
            <h2>Ranked by {SORT_RANK[cardSort]}</h2>
            <p className="sub cap">
              {SORT_ORDER[cardSort]}, for these three cards. The table below is ranked by its own row labels, and
              selecting a token traces it through the charts and the table.
            </p>
          </div>
          <div className="controls">
            <label className="seg-label" htmlFor="sort">
              Rank by
            </label>
            <select id="sort" value={cardSort} onChange={(e) => setCardSort(e.target.value as SortKey)}>
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

        <Leaderboard
          rows={cardRows}
          sort={cardSort}
          focus={focus}
          onFocus={setFocus}
          paid={perProject}
          loading={loading}
        />
      </section>

      <Charts
        series={chartSeries}
        order={chartOrder}
        windowDays={windowDays}
        onWindow={setWindowDays}
        focus={focus}
        loading={loading || !painted.hasSeries}
      />

      <section className="container section" data-reveal="">
        <div className="section-head">
          <div>
            <h2>Every figure, side by side</h2>
            {/* "Press any row to rank by it" overclaimed twice: two of the fourteen rows do not
                rank, and the mark that says which do was invisible until the pointer was already on
                one. The copy now names the mark, and the mark is now drawn. */}
            <p className="sub">
              Press a row name marked <span className="sub-mark">↕</span> to rank the table by it. Where a figure is
              estimated or not yet indexed the cell says so, and a blank is about our coverage, never a zero for the
              project.
            </p>
          </div>
        </div>

        <Matrix rows={tableRows} sort={tableSort} onSort={setTableSort} focus={focus} onFocus={setFocus} />
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
