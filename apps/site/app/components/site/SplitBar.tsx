import type { CSSProperties } from "react";
import { micro, mono } from "./text";

export interface Wedge {
  /** Shown inside the wedge next to its value, when the wedge is wide enough to hold it. */
  label: string;
  /** The figure, e.g. "4%" or "80%". Always shown. */
  value: string;
  /** Relative width. Any units; the wedges are normalised against their sum. */
  weight: number;
  /** The first wedge is normally the accent one; the rest are ink. */
  tone?: "accent" | "ink";
}

const TONES: Record<"accent" | "ink", CSSProperties> = {
  accent: { background: "var(--bronze-600)", color: "#FFFFFF" },
  ink: { background: "var(--neutral-800)", color: "var(--text-inverse-muted)" },
};

/**
 * A proportional split, drawn. One wedge per slice, sized by weight, with the end captions naming what the
 * two ends of the bar are. It always sits next to the same numbers in text (the split table underneath, or
 * the sentence above), so it is `aria-hidden`: it is a second reading of data that is already available.
 *
 * A wedge narrower than a quarter of the bar drops its label and keeps only its figure, which is what makes
 * a lopsided split like 4 / 1 legible instead of clipped.
 */
export function SplitBar({ wedges, left, right, style }: { wedges: Wedge[]; left?: string; right?: string; style?: CSSProperties }) {
  const total = wedges.reduce((sum, w) => sum + w.weight, 0) || 1;

  return (
    <div style={{ marginTop: 18, ...style }}>
      <div
        aria-hidden="true"
        style={{
          display: "flex",
          height: 46,
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
          border: "1px solid var(--border-hairline)",
        }}
      >
        {wedges.map((w, i) => {
          const share = w.weight / total;
          return (
            <div
              key={w.label}
              style={{
                flex: `${w.weight} 1 0`,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                whiteSpace: "nowrap",
                overflow: "hidden",
                borderLeft: i === 0 ? undefined : "1px solid var(--surface-page)",
                ...TONES[w.tone ?? (i === 0 ? "accent" : "ink")],
              }}
            >
              <span style={{ ...mono, fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>{w.value}</span>
              {share >= 0.25 && <span style={{ ...micro, opacity: 0.85 }}>{w.label}</span>}
            </div>
          );
        })}
      </div>
      {(left || right) && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: 8 }}>
          <span style={{ ...micro, color: "var(--text-faint)" }}>{left}</span>
          <span style={{ ...micro, color: "var(--text-faint)", textAlign: "right" }}>{right}</span>
        </div>
      )}
    </div>
  );
}
