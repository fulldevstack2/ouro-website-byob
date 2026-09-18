/**
 * History, as three panels of one measure at a time.
 *
 * ── Why one measure at a time ──
 * This was three stacked sections, nine panels and three paragraphs of lede, about 1,400 pixels of
 * page for a reader who wanted one of them. They are the same three panels with the same data; the
 * measure is now a control instead of a scroll.
 *
 * ── Why each panel keeps its own axis ──
 * The projects do not share a scale. Wallets paid per cycle runs at a median of 3,251 for INDEX
 * against 341 for $OURO; on one axis $OURO is a flat line along the bottom and its shape, which is
 * the entire reason for plotting it, is gone. So every panel is drawn on the scale that shows it and
 * says so in its own caption. See LineChart for why there is no colour key here.
 */
import { useState } from "react";

import { LineChart } from "~/components/LineChart";
import { fmtHours } from "~/lib/cadence";
import { useFlip } from "~/lib/motion";
import { withinDays, type Series } from "~/lib/series";

export type MeasureKey = "gaps" | "tax" | "recipients";

const fmtDay = (t: number) => new Date(t * 1000).toISOString().slice(5, 10);
const fmtUsdAxis = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : `${Math.round(v)}`;
const fmtCount = (v: number) => Math.round(v).toLocaleString("en-US");

/** How long ago, in the same units the gap chart is drawn in. */
const sinceNow = (t: number) => Math.max(0, Date.now() / 1000 - t) / 3600;

/**
 * One pair of units for a whole duration axis, picked from the top of it.
 *
 * `fmtHours` changes units with the size of the figure, which is right for a value standing on its
 * own and wrong for an axis: a panel topping out at 58.5 h set "2d 11h" over "29h 29m", two ticks of
 * one scale written two ways, and the reader has to do arithmetic to see that the first is twice the
 * second. So the top tick chooses, and every tick below it is written the same way. The hover
 * readout still uses `fmtHours`, where a value has no neighbour it has to agree with.
 */
const axisHours = (top: number) => (h: number) => {
  if (!Number.isFinite(h)) return "—";
  if (top >= 48) {
    const hours = Math.round(h);
    const rest = hours % 24;
    return rest === 0 ? `${Math.floor(hours / 24)}d` : `${Math.floor(hours / 24)}d ${rest}h`;
  }
  const mins = Math.round(h * 60);
  const rest = mins % 60;
  if (mins < 60) return `${mins}m`;
  return rest === 0 ? `${Math.floor(mins / 60)}h` : `${Math.floor(mins / 60)}h ${rest}m`;
};

interface Measure {
  key: MeasureKey;
  label: string;
  lede: string;
  format: (v: number) => string;
}

export const MEASURES: Measure[] = [
  {
    key: "gaps",
    label: "Airdrop frequency",
    lede:
      "How long each token went between one airdrop and the next, so a rising line is a token paying less often.",
    /* Two units, "1h 49m" and "2d 12h": a gap is a thing the reader is measuring against their own
       sense of "often", and "1.7 h" made them finish the figure first. See `axisHours` for the one
       place that has to be stricter than this. */
    format: fmtHours,
  },
  {
    key: "tax",
    label: "Tax collected",
    lede: "What each trade tax brought in, by UTC day. This is the money the airdrops are paid out of.",
    format: fmtUsdAxis,
  },
  {
    key: "recipients",
    label: "Wallets paid",
    lede: "How many wallets each payout cycle reached. Per cycle rather than per day, because a day holds a different number of cycles for each token.",
    format: fmtCount,
  },
];

export const WINDOWS: { label: string; days: number | null }[] = [
  { label: "14 d", days: 14 },
  { label: "30 d", days: 30 },
  { label: "All", days: null },
];

export function Charts({
  series,
  order,
  windowDays,
  onWindow,
  focus,
  loading,
}: {
  series: Record<MeasureKey, Series[]>;
  /** Project keys in the order the rest of the page is ranked, so the panels match the cards. */
  order: string[];
  windowDays: number | null;
  onWindow: (days: number | null) => void;
  focus: string | null;
  loading: boolean;
}) {
  const [measure, setMeasure] = useState<MeasureKey>("gaps");
  // The panels re-rank with the cards, so they slide rather than jump.
  const panels = useFlip<HTMLDivElement>();

  const active = MEASURES.find((m) => m.key === measure) as Measure;
  const rank = (key: string) => {
    const i = order.indexOf(key);
    return i === -1 ? order.length : i;
  };
  const windowed = (series[measure] ?? [])
    .map((s) => ({ ...s, points: withinDays(s.points, windowDays) }))
    .sort((a, b) => rank(a.key) - rank(b.key));

  return (
    <section className="container section" id="history" data-reveal="">
      <div className="section-head">
        <div>
          <h2>History</h2>
          <p className="sub">{active.lede}</p>
        </div>
        <div className="controls">
          <div className="seg" role="group" aria-label="Measure">
            {MEASURES.map((m) => (
              <button
                key={m.key}
                type="button"
                className="tab"
                aria-pressed={m.key === measure}
                onClick={() => setMeasure(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <span className="seg-label">Window</span>
          <div className="seg" role="group" aria-label="Window">
            {WINDOWS.map((w) => (
              <button
                key={w.label}
                type="button"
                className="tab"
                aria-pressed={w.days === windowDays}
                onClick={() => onWindow(w.days)}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="charts" ref={panels}>
        {loading && windowed.every((s) => s.points.length === 0) ? (
          <>
            <span className="skel skel-panel" />
            <span className="skel skel-panel" />
            <span className="skel skel-panel" />
          </>
        ) : (
          windowed.map((s) => {
            const own = s.points.length ? Math.max(...s.points.map((p) => p.v)) : null;
            const last = s.points[s.points.length - 1];
            const sorted = s.points.map((p) => p.v).sort((a, b) => a - b);
            const typical = sorted.length ? (sorted[Math.floor(sorted.length / 2)] as number) : null;
            /**
             * Each panel says the thing its measure needs saying.
             *
             * For a quantity that is its peak, because the panels do NOT share a y-axis, and saying
             * which is the difference between small multiples and a misread comparison. For the gaps
             * it is when the token last paid and what is typical for it: the whole point of the
             * series is rhythm, and a lone median would hide a tail that runs to two and a half
             * days. Both come from the plotted points, so the note can never disagree with the line
             * above it.
             */
            const note =
              measure === "gaps"
                ? last
                  ? `last airdrop ${fmtHours(sinceNow(last.t))} ago · typically ${fmtHours(typical)} apart`
                  : "no payouts in this window"
                : `own scale · peak ${own === null ? "—" : active.format(own)}`;
            return (
              <div className="chart-panel" key={s.key} data-flip={s.key} data-on={focus === s.key}>
                <h3>{s.symbol}</h3>
                <p className="panel-note">{note}</p>
                <LineChart
                  /* Remounting on a control change is what replays the draw-on. It is keyed on the
                     controls and the point count only, so a poll that changes nothing does not
                     redraw a chart the reader is looking at. */
                  key={`${measure}:${windowDays}:${s.points.length}`}
                  points={s.points}
                  format={active.format}
                  formatAxis={measure === "gaps" ? axisHours(own ?? 0) : undefined}
                  formatTime={fmtDay}
                  label={`${s.symbol} ${active.label}`}
                  emptyNote="nothing in this window"
                  height={168}
                />
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
