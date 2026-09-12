import { useState, type CSSProperties } from "react";
import { mono } from "./text";

export interface Bar {
  /** Unix seconds of the bucket start (UTC day). */
  t: number;
  value: number | null;
}

/**
 * One-series daily bar chart, inline SVG, no library. Thin marks anchored to the baseline with a
 * rounded top, a 2px surface gap between bars, a recessive baseline, and a hover tooltip. Days with
 * no data draw nothing (an honest gap), never a placeholder bar.
 *
 * The first and last day are always labelled; over a long window every 7th day is too, except within
 * three slots of either end, where the weekly tick would print on top of the first or last label.
 */
export function Bars({ data, format, color = "var(--bronze-600)", height = 120, ariaLabel, style }: { data: Bar[]; format: (v: number) => string; color?: string; height?: number; ariaLabel: string; style?: CSSProperties }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 600;
  const padTop = 18;
  const padBottom = 20;
  const plotH = height - padTop - padBottom;
  const n = Math.max(1, data.length);
  const slot = width / n;
  const barW = Math.max(2, slot - 2);
  const max = Math.max(0, ...data.map((d) => d.value ?? 0));
  const hasData = data.some((d) => d.value !== null && d.value !== 0);
  const y = (v: number) => padTop + plotH - (max > 0 ? (v / max) * plotH : 0);
  const label = (t: number) => new Date(t * 1000).toISOString().slice(5, 10);
  const h = hover !== null ? data[hover] : undefined;
  return (
    <div style={{ position: "relative", ...style }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={ariaLabel} style={{ display: "block", overflow: "visible" }} onMouseLeave={() => setHover(null)}>
        <line x1={0} x2={width} y1={padTop + plotH} y2={padTop + plotH} stroke="var(--border-hairline)" strokeWidth={1} />
        {max > 0 && (
          <>
            <line x1={0} x2={width} y1={padTop} y2={padTop} stroke="var(--border-hairline)" strokeDasharray="2 4" strokeWidth={1} />
            <text x={0} y={padTop - 6} style={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--text-faint)" }}>
              {format(max)}
            </text>
          </>
        )}
        {data.map((d, i) => {
          const x = i * slot + 1;
          const v = d.value;
          const top = v === null ? null : y(v);
          const hh = top === null ? 0 : Math.max(v === 0 ? 0 : 2, padTop + plotH - top);
          const on = hover === i;
          return (
            <g key={d.t} onMouseEnter={() => setHover(i)}>
              <rect x={x} y={padTop} width={barW} height={plotH} fill="transparent" />
              {hh > 0 && <rect x={x} y={padTop + plotH - hh} width={barW} height={hh} rx={Math.min(4, barW / 2)} fill={color} opacity={hover === null || on ? 1 : 0.55} />}
              {(i === 0 || i === data.length - 1 || (data.length > 14 && i % 7 === 0 && i < data.length - 3 && i > 2)) && (
                <text x={x + barW / 2} y={height - 6} textAnchor={i === data.length - 1 ? "end" : i === 0 ? "start" : "middle"} style={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--text-faint)" }}>
                  {label(d.t)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {!hasData && (
        <div style={{ position: "absolute", inset: `${padTop}px 0 ${padBottom}px 0`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "var(--text-faint)", fontStyle: "italic", fontFamily: "var(--font-display)", pointerEvents: "none" }}>
          no data in this window yet
        </div>
      )}
      {h && (
        <div style={{ position: "absolute", top: 0, right: 0, ...mono, fontSize: 12, color: "var(--text-secondary)", background: "var(--surface-page)", padding: "2px 6px", border: "1px solid var(--border-hairline)", borderRadius: 6, pointerEvents: "none" }}>
          {new Date(h.t * 1000).toISOString().slice(0, 10)} · {h.value === null ? "no data" : format(h.value)}
        </div>
      )}
    </div>
  );
}
