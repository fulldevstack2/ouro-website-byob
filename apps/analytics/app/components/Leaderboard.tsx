/**
 * The three projects as cards, ranked by whatever the reader is ranking by.
 *
 * ── Why cards above the table ──
 * The table is the reference and reads like one: fourteen rows deep, it answers a question you
 * already had. It is a poor way to arrive. The cards answer the question a reader actually opens
 * this page with — who pays the most, and what is it paying right now — in one glance, and they
 * carry the same figures the table does, from the same formatter, so the two can never disagree.
 *
 * ── Why the headline figure follows the sort ──
 * Ranking by APR and then showing all-time dollars as the big number would rank the cards by one
 * quantity and caption them with another. The figure the cards are ordered by is the figure they
 * show, so the one control moves the whole section.
 *
 * ── What stays out of it ──
 * No colour per project, no medal, no "winner" treatment. Same ink for all three, the rank is a
 * numeral, and the order is stated. This page reports on two projects it does not operate, from a
 * domain the third one owns.
 *
 * The share-of-the-three bar and the "2% of the three" beside the caption went the same way. Nobody
 * asked the page how one token's market size compares with the other two's, so a reader met a bar
 * they had not asked for, drawn against a total the page does not otherwise print, and read a short
 * one as a verdict: being the smallest of three is not being bad at something, and on the rows the
 * bar could legitimately be drawn for it was mostly measuring supply. A card now claims a figure,
 * what that figure rests on, and a rank.
 */
import { DASH } from "~/components/Coverage";
import { Spark } from "~/components/Spark";
import { cell, compactBasis } from "~/lib/cells";
import { useChanged, useEnter, useFlip } from "~/lib/motion";
import type { ProjectRow } from "~/lib/projects";
import type { Point } from "~/lib/series";
import { METRICS, SORT_CAPTION, type Metric, type SortKey } from "~/registry";

/** The supporting rows, in the order they are preferred. The one being ranked by is skipped. */
const SUPPORT: Metric[] = ["paidAllTime", "apr", "paid24h", "lastPaid", "recipients", "payoutRhythm"];

const LABEL = Object.fromEntries(METRICS.map((m) => [m.key, m.label])) as Record<Metric, string>;

const fmtUsdAxis = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`);

/** A card figure, flashing for a moment when it moves. Same rule as the table: only a real change. */
function Moving({ value, className, fallback }: { value: string | null; className: string; fallback: string }) {
  const ticked = useChanged(value);
  return (
    <span className={value === null ? `${className} dash` : className} data-tick={ticked ? "on" : undefined}>
      {value ?? fallback}
    </span>
  );
}

export function Leaderboard({
  rows,
  sort,
  focus,
  onFocus,
  paid,
  loading,
}: {
  /** Already sorted. */
  rows: ProjectRow[];
  sort: SortKey;
  focus: string | null;
  onFocus: (key: string | null) => void;
  /** Dollars airdropped per day, per project, keyed by project key. */
  paid: Record<string, Point[]>;
  loading: boolean;
}) {
  // Sorting by name still has to headline something, and all-time paid is the plainest figure on
  // the page: the one quantity that needs no basis read alongside it.
  const ranked: Metric = sort === "symbol" ? "paidAllTime" : sort;
  const support = SUPPORT.filter((m) => m !== ranked).slice(0, 3);

  const grid = useFlip<HTMLDivElement>();
  const entering = useEnter();

  return (
    <div className="cards" ref={grid}>
      {rows.map((row, i) => {
        const p = row.project;
        const head = cell(ranked, row);
        // A rate never appears without what it was measured over, on a card any more than in a cell.
        const headBasis = compactBasis(ranked, row);
        const on = focus === p.key;
        const series = paid[p.key] ?? [];

        return (
          <button
            key={p.key}
            type="button"
            className={entering ? "card enter" : "card"}
            data-flip={p.key}
            /* Staggered across the row on arrival only. `useEnter` drops the class afterwards so a
               re-rank slides the cards without replaying their entrance. */
            style={{ animationDelay: `${i * 70}ms` }}
            data-on={on}
            aria-pressed={on}
            onClick={() => onFocus(on ? null : p.key)}
            title={on ? `Stop tracing ${p.symbol}` : `Trace ${p.symbol} through the table and the charts`}
          >
            <span className="card-top">
              <span className="card-rank">{i + 1}</span>
              {/* Ours is gold, here and everywhere the symbol is printed. See `.ours`. */}
              <span className={p.operator === "ouro" ? "card-sym ours" : "card-sym"}>{p.symbol}</span>
              <span className="card-name">{p.name}</span>
            </span>

            {/* A dash on this page means "not measured". Printing one before the first read has
                landed says something untrue, so an unresolved figure rests instead. */}
            {head.value === null && loading ? (
              <span className="skel skel-cardfig" />
            ) : (
              <Moving value={head.value} className="card-figure" fallback={DASH} />
            )}
            <span className="card-caption">
              {SORT_CAPTION[sort]}
              {headBasis ? <span className="card-basis">{headBasis}</span> : null}
            </span>

            <span className="card-kv">
              {support.map((m) => {
                const c = cell(m, row);
                const basis = compactBasis(m, row);
                return (
                  <span className="kv" key={m}>
                    <span className="kv-label">
                      {LABEL[m]}
                      {basis ? <span className="kv-sub">{basis}</span> : null}
                    </span>
                    {c.value === null && loading ? (
                      <span className="skel skel-kv" />
                    ) : (
                      <Moving value={c.value} className="kv-value" fallback={DASH} />
                    )}
                  </span>
                );
              })}
            </span>

            <span className="card-spark">
              {loading && series.length < 2 ? (
                <span className="skel skel-cardspark" />
              ) : (
                <Spark
                  points={series}
                  format={fmtUsdAxis}
                  height={44}
                  label={`${p.symbol} dollars airdropped per day`}
                  caption="airdropped per day"
                />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
