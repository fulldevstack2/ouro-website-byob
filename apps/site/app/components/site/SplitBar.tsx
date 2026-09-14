import type { CSSProperties } from "react";
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
