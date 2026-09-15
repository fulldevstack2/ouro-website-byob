/**
 * A small bar chart, for the places a shape is worth more than another figure.
 *
 * Bars rather than the line used in the panels below, and deliberately so: these are daily totals,
 * which are counts of a thing that happened in a bucket, and a line between them implies values in
 * between that nobody measured. The panels plot the same data as a line because there the reader is
 * following a trend across sixty points; here they are glancing at a rhythm across thirty.
 *
 * A day with no value draws nothing. It is never a zero-height bar, because the gap is the honest
 * rendering of "this project did not pay that day" and a flat run of zeroes is not.
 */
import { useState } from "react";

import { useEnter } from "~/lib/motion";
import type { Point } from "~/lib/series";

export interface SparkProps {
  points: Point[];
  format: (v: number) => string;
  height?: number;
  label: string;
  /** Shown under the bars when nothing is hovered. */
  caption?: string;
}

const fmtDay = (t: number) => new Date(t * 1000).toISOString().slice(5, 10);

export function Spark({ points, format, height = 84, label, caption }: SparkProps) {
  const [hover, setHover] = useState<number | null>(null);
  // Bars grow in when the series arrives or the window changes, not when a card is re-ranked.
  const entering = useEnter(1000);

  if (points.length < 2) {
    return <span className="spark-empty">not enough history yet</span>;
  }

  const W = 600;
  const H = height;
  const n = points.length;
  const slot = W / n;
  const barW = Math.max(2, slot - Math.min(3, slot * 0.22));
  const max = Math.max(...points.map((p) => p.v));
  const active = hover === null ? null : points[hover];

  return (
    <span className="spark">
      <svg
        /* Remounted when the window changes, so the bars grow back in rather than snapping to a new
           set of heights. Keyed on what the window actually changes: how many days, from when. */
        key={`${n}:${points[0]!.t}`}
        viewBox={`0 0 ${W} ${H}`}
        className={entering ? "spark-svg enter" : "spark-svg"}
        role="img"
        aria-label={`${label}. ${n} days, peak ${format(max)}.`}
        onPointerLeave={() => setHover(null)}
      >
        {points.map((p, i) => {
          const h = max > 0 ? Math.max(1.5, (p.v / max) * H) : 1.5;
          const x = i * slot + (slot - barW) / 2;
          const on = hover === i;
          return (
            <g key={p.t} onPointerEnter={() => setHover(i)}>
              <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
              <rect
                x={x}
                y={H - h}
                width={barW}
                height={h}
                rx={Math.min(2, barW / 2)}
                className={on ? "spark-bar on" : "spark-bar"}
                opacity={hover === null || on ? 1 : 0.45}
                /* Left to right, a few milliseconds apart: the series reads as arriving in order
                   rather than appearing all at once. */
                style={{ animationDelay: `${Math.min(i * 11, 420)}ms` }}
              />
            </g>
          );
        })}
      </svg>
      <span className="spark-readout">
        {active ? (
          <>
            <b>{format(active.v)}</b> · {fmtDay(active.t)}
          </>
        ) : (
          (caption ?? `peak ${format(max)} · ${fmtDay(points[0]!.t)} to ${fmtDay(points[n - 1]!.t)}`)
        )}
      </span>
    </span>
  );
}
