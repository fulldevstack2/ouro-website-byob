import type { CSSProperties, ReactNode } from "react";
import { hairline, mono } from "./text";

export interface KVRowProps {
  label: ReactNode;
  /** Rendered mono + tabular. */
  value: ReactNode;
  py?: number;
  border?: "top" | "bottom" | "none";
  /** On the inverse (ink) card. */
  inverse?: boolean;
  labelStyle?: CSSProperties;
  valueStyle?: CSSProperties;
}

/** Label-left / figure-right hairline row: a 14px label in the secondary ink, a 13px mono figure. */
export function KVRow({ label, value, py = 11, border = "bottom", inverse = false, labelStyle, valueStyle }: KVRowProps) {
  const line = inverse ? "1px solid var(--border-inverse)" : hairline;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 16,
        padding: `${py}px 0`,
        borderTop: border === "top" ? line : undefined,
        borderBottom: border === "bottom" ? line : undefined,
      }}
    >
      {/* The label takes whatever is left and wraps; the figure never shrinks below its own width
          (shrinking it is how "2%" came out as "2" over "%"), and a long figure wraps at its spaces
          inside the right-hand 62% of the row. */}
      <span style={{ flex: "1 1 0%", minWidth: 0, fontSize: 14, lineHeight: 1.5, color: inverse ? "var(--text-inverse-muted)" : "var(--text-secondary)", ...labelStyle }}>
        {label}
      </span>
      <span
        style={{
          ...mono,
          flex: "0 0 auto",
          maxWidth: "62%",
          fontSize: 13,
          lineHeight: 1.5,
          textAlign: "right",
          overflowWrap: "break-word",
          color: inverse ? "var(--text-inverse)" : "var(--text-primary)",
          ...valueStyle,
        }}
      >
        {value}
      </span>
    </div>
  );
}
