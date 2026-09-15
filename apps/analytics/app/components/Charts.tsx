/**
 * History, as three panels of one measure at a time.
 *
 * ── Why one measure at a time ──
 * This was three stacked sections, nine panels and three paragraphs of lede, about 1,400 pixels of
 * page for a reader who wanted one of them. They are the same three panels with the same data; the
 * measure is now a control instead of a scroll. Nothing was dropped, and the table view under the
 * panels still carries whichever measure is showing, in full.
 *
 * ── Why the panels still do not share an axis by default ──
 * The projects do not share a scale. Wallets paid per cycle runs at a median of 3,251 for INDEX
 * against 341 for $OURO; on one axis $OURO is a flat line along the bottom and its shape, which is
 * the entire reason for plotting it, is gone. So each panel is drawn on the scale that shows it and
 * says so in its own caption. "Shared scale" is offered because the opposite question — how big is
 * this one against that one — is a fair question too, and a shared axis answers it without the thing
 * that would really rank them, which is colour. See LineChart for why there is no colour key here.
 */
import { useState } from "react";

import { LineChart } from "~/components/LineChart";
import { useFlip } from "~/lib/motion";
import { withinDays, type Series } from "~/lib/series";

export type MeasureKey = "paid" | "tax" | "recipients";

const fmtDay = (t: number) => new Date(t * 1000).toISOString().slice(5, 10);
const fmtUsdAxis = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`;
const fmtCount = (v: number) => Math.round(v).toLocaleString("en-US");

interface Measure {
  key: MeasureKey;
  label: string;
  lede: string;
  unit: string;
  format: (v: number) => string;
}

export const MEASURES: Measure[] = [
  {
    key: "paid",
    label: "Airdropped",
    lede: "Dollars paid out to holders, by UTC day. Days a token paid nothing are left blank rather than drawn as zero.",
    unit: "US dollars airdropped per day",
    format: fmtUsdAxis,
  },
  {
    key: "tax",
    label: "Tax collected",
    lede: "What each trade tax brought in, by UTC day. This is the money the airdrops are paid out of.",
    unit: "US dollars collected per day",
    format: fmtUsdAxis,
  },
  {
    key: "recipients",
    label: "Wallets paid",
    lede: "How many wallets each payout cycle reached. Per cycle rather than per day, because a day holds a different number of cycles for each token.",
    unit: "wallets per payout cycle",
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
  const [measure, setMeasure] = useState<MeasureKey>("paid");
  const [shared, setShared] = useState(false);
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
  const peak = Math.max(0, ...windowed.flatMap((s) => s.points.map((p) => p.v)));

  return (
    <section className="container section" id="history" data-reveal="">
      <div className="section-head">
        <div>
          <h2>History</h2>
          <p className="sub">
            {active.lede} The window sets these panels and every bar above them.
          </p>
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
          <button
            type="button"
            className="tab solo"
            aria-pressed={shared}
            onClick={() => setShared((s) => !s)}
            title="Draw all three panels on one axis, so their sizes can be compared directly"
          >
            Shared scale
          </button>
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
            return (
              <div className="chart-panel" key={s.key} data-flip={s.key} data-on={focus === s.key}>
                <h3>{s.symbol}</h3>
                {/* Each panel carries its own peak, because the panels do NOT share a y-axis unless
                    asked to — saying which is the difference between small multiples and a misread
                    comparison. */}
                <p className="panel-note">
                  {shared ? "shared scale · peaks at " : "own scale · peak "}
                  {own === null ? "—" : active.format(own)}
                </p>
                <LineChart
                  /* Remounting on a control change is what replays the draw-on. It is keyed on the
                     controls and the point count only, so a poll that changes nothing does not
                     redraw a chart the reader is looking at. */
                  key={`${measure}:${windowDays}:${shared}:${s.points.length}`}
                  points={s.points}
                  format={active.format}
                  formatTime={fmtDay}
                  label={`${s.symbol} ${active.label}`}
                  emptyNote="nothing in this window"
                  height={168}
                  yMax={shared ? peak : null}
                />
              </div>
            );
          })
        )}
      </div>

      <details className="chart-table">
        <summary>Show as a table</summary>
        <div className="table-scroll">
          <table className="matrix">
            <thead>
              <tr>
                <th scope="col">Token</th>
                <th scope="col">Points</th>
                <th scope="col">First</th>
                <th scope="col">Latest</th>
                <th scope="col">Peak</th>
                <th scope="col">Median</th>
              </tr>
            </thead>
            <tbody>
              {windowed.map((s) => {
                const v = s.points.map((p) => p.v).sort((a, b) => a - b);
                const med = v.length ? (v[Math.floor(v.length / 2)] as number) : null;
                const last = s.points[s.points.length - 1];
                const first = s.points[0];
                return (
                  <tr key={s.key}>
                    <td className="metric-name">{s.symbol}</td>
                    <td className="cell">{s.points.length}</td>
                    <td className="cell">{first ? fmtDay(first.t) : "—"}</td>
                    <td className="cell">{last ? active.format(last.v) : "—"}</td>
                    <td className="cell">{v.length ? active.format(v[v.length - 1] as number) : "—"}</td>
                    <td className="cell">{med === null ? "—" : active.format(med)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="legend">
          All figures in {active.unit}
          {windowDays === null ? ", over everything indexed." : `, over the last ${windowDays} days.`}
        </p>
      </details>
    </section>
  );
}
