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

/** Label-left / figure-right hairline row. */
export function KVRow({ label, value, py = 12, border = "bottom", inverse = false, labelStyle, valueStyle }: KVRowProps) {
  const line = inverse ? "1px solid var(--neutral-700)" : hairline;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        padding: `${py}px 0`,
        borderTop: border === "top" ? line : undefined,
        borderBottom: border === "bottom" ? line : undefined,
      }}
    >
      <span style={{ fontSize: 13, color: inverse ? "var(--text-inverse-muted)" : "var(--text-muted)", ...labelStyle }}>{label}</span>
      {/* Shrinkable and breakable anywhere, so a figure that fits nowhere wraps inside the row instead of widening it. */}
      <span style={{ ...mono, fontSize: 13, color: inverse ? "#FFFFFF" : undefined, minWidth: 0, overflowWrap: "anywhere", ...valueStyle }}>{value}</span>
    </div>
  );
}
