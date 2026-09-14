import type { CSSProperties, ReactNode } from "react";
import { legPct, type SplitLeg } from "~/content/protocol";
import { KVRow } from "./KVRow";
import { micro } from "./text";

export interface Wedge {
  /** Relative width. Any units; the wedges are normalised against their sum by flex. */
  weight: number;
  /** accent: the bronze share (what the protocol keeps). ink / soft / faint: the rest, in descending weight. */
  tone?: "accent" | "ink" | "soft" | "faint";
}

/**
 * A proportional split, drawn as a thin bar: one wedge per share, sized by weight. It always sits
 * above the same numbers in text (the rows under it), so it is `aria-hidden`: a second reading of
 * data that is already on the page. Optional captions name what the two ends of the bar are.
 */
export function SplitBar({ wedges, left, right, style }: { wedges: Wedge[]; left?: string; right?: string; style?: CSSProperties }) {
  return (
    <div style={style}>
      <div className="split" aria-hidden="true">
        {wedges.map((w, i) => (
          <div key={i} className={`split__wedge--${w.tone ?? "ink"}`} style={{ flex: `${w.weight} 1 0` }} />
        ))}
      </div>
      {(left || right) && (
        <div className="split-caps">
          <span style={{ ...micro, color: "var(--text-faint)" }}>{left}</span>
          <span style={{ ...micro, color: "var(--text-faint)", textAlign: "right" }}>{right}</span>
        </div>
      )}
    </div>
  );
}

export interface SplitRow {
  label: ReactNode;
  value: ReactNode;
  /** The bronze figure: the share the protocol keeps. */
  accent?: boolean;
}

/**
 * The hairline rows that read out a bar: label left, share right. The bar above them is decorative,
 * so this is where the figures are actually stated, on the home page and in the docs alike.
 */
export function SplitRows({ rows, style }: { rows: SplitRow[]; style?: CSSProperties }) {
  return (
    <div className="split-rows" style={style}>
      {rows.map((r, i) => (
        <KVRow
          key={i}
          py={10}
          border={i === rows.length - 1 ? "none" : "bottom"}
          label={r.label}
          value={r.value}
          valueStyle={{ fontWeight: 600, color: r.accent ? "var(--bronze-700)" : undefined }}
        />
      ))}
    </div>
  );
}

/** A split's legs as the bar's wedges, in the order they are declared. */
export const legWedges = (legs: SplitLeg[]): Wedge[] => legs.map((l) => ({ weight: l.pct, tone: l.tone }));

/** The same legs as the rows under it, so the bar and the figures cannot disagree. */
export const legRows = (legs: SplitLeg[]): SplitRow[] => legs.map((l) => ({ label: l.label, value: legPct(l), accent: l.tone === "accent" }));
