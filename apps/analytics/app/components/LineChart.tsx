/**
 * One project, one measure, over time.
 *
 * ── Why small multiples rather than three lines on one chart ──
 * Two reasons, one practical and one editorial.
 *
 * Practical: the projects do not share a scale. Wallets paid per cycle runs at a median of 3,251 for
 * INDEX against 341 for $OURO — on one linear axis $OURO is a flat line along the bottom and its
 * shape, which is the entire point of plotting it, is gone.
 *
 * Editorial: three series on one chart need three separable colours, and this design system is
 * warm-only by intent. Every three-hue set drawn from its ramps fails colour-vision separation on
 * the green/red pair (ΔE 4.3–4.5 deuteranopia, against a target of 8). The sets that do pass get
 * there through lightness spread, which leaves the lightest series at 1.93:1 against the page — a
 * 2px line nobody can follow. And on a page whose whole claim is even-handedness, a coloured overlay
 * always makes one line the figure and the rest ground. Identical panels make no such claim: same
 * ink, same shape, same treatment, each on the scale that shows it.
 *
 * So there is no categorical palette here, and none is needed — a single series takes its identity
 * from the panel heading, not from a colour key.
 */
import { useId, useState } from "react";

import type { Point } from "~/lib/series";

export interface LineChartProps {
  points: Point[];
  /** Formats a value for the axis and the tooltip. */
  format: (v: number) => string;
  /** Formats a timestamp for the tooltip. */
  formatTime: (t: number) => string;
  label: string;
  /** Rendered when there is nothing to draw, so an empty panel still says why. */
  emptyNote?: string;
  height?: number;
}

const PAD = { top: 12, right: 10, bottom: 20, left: 46 };

export function LineChart({ points, format, formatTime, label, emptyNote, height = 150 }: LineChartProps) {
  const gradId = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (points.length < 2) {
    return (
      <div className="chart-empty" role="img" aria-label={`${label}: not enough data to plot`}>
        {emptyNote ?? "not enough history to plot"}
      </div>
    );
  }

  const W = 320;
  const H = height;
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;

  const ts = points.map((p) => p.t);
  const vs = points.map((p) => p.v);
  const t0 = Math.min(...ts);
  const t1 = Math.max(...ts);
  // Baseline at zero: these are quantities, and starting the axis anywhere else exaggerates every
  // wobble into a cliff. The top is the real maximum, so the axis label names a value the line
  // actually reaches.
  const vMax = Math.max(...vs);
  const span = t1 - t0 || 1;

  const x = (t: number) => PAD.left + ((t - t0) / span) * iw;
  const y = (v: number) => PAD.top + ih - (vMax > 0 ? (v / vMax) * ih : 0);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(2)},${y(p.v).toFixed(2)}`).join(" ");
  const area = `${line} L${x(t1).toFixed(2)},${(PAD.top + ih).toFixed(2)} L${x(t0).toFixed(2)},${(PAD.top + ih).toFixed(2)} Z`;

  const last = points[points.length - 1] as Point;
  const active = hover === null ? null : points[Math.max(0, Math.min(points.length - 1, hover))];

  // Nearest point to the pointer, in data space — steadier than hit-testing each mark.
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const frac = Math.max(0, Math.min(1, (px - PAD.left) / iw));
    const target = t0 + frac * span;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs((points[i] as Point).t - target);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setHover(best);
  };

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart-svg"
        role="img"
        aria-label={`${label}. ${points.length} points, from ${formatTime(t0)} to ${formatTime(t1)}, peak ${format(vMax)}.`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Recessive grid: two rules, both at values the axis names. */}
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={PAD.left}
            x2={PAD.left + iw}
            y1={PAD.top + ih - f * ih}
            y2={PAD.top + ih - f * ih}
            stroke="var(--border-hairline)"
            strokeWidth="1"
          />
        ))}

        <path d={area} fill={`url(#${gradId})`} />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* The endpoint carries a ring in the surface colour so it reads against the line. */}
        <circle cx={x(last.t)} cy={y(last.v)} r="3.5" fill="var(--accent)" stroke="var(--surface-card)" strokeWidth="2" />

        {active ? (
          <g>
            <line
              x1={x(active.t)}
              x2={x(active.t)}
              y1={PAD.top}
              y2={PAD.top + ih}
              stroke="var(--border-soft)"
              strokeWidth="1"
            />
            <circle cx={x(active.t)} cy={y(active.v)} r="4" fill="var(--accent)" stroke="var(--surface-card)" strokeWidth="2" />
          </g>
        ) : null}

        {/* Axis labels name real values: the peak, the midpoint and zero. */}
        <text x={PAD.left - 6} y={PAD.top + 4} className="chart-axis" textAnchor="end">
          {format(vMax)}
        </text>
        <text x={PAD.left - 6} y={PAD.top + ih / 2 + 4} className="chart-axis" textAnchor="end">
          {format(vMax / 2)}
        </text>
        <text x={PAD.left - 6} y={PAD.top + ih + 4} className="chart-axis" textAnchor="end">
          0
        </text>
        <text x={PAD.left} y={H - 6} className="chart-axis">
          {formatTime(t0)}
        </text>
        <text x={PAD.left + iw} y={H - 6} className="chart-axis" textAnchor="end">
          {formatTime(t1)}
        </text>
      </svg>

      {/* Reserve the row's height whether or not a point is hovered, so the panel does not jump. */}
      <p className="chart-readout">
        {active ? (
          <>
            <b>{format(active.v)}</b> · {formatTime(active.t)}
          </>
        ) : (
          <>
            latest <b>{format(last.v)}</b> · {formatTime(last.t)} · {points.length} points
          </>
        )}
      </p>
    </div>
  );
}
