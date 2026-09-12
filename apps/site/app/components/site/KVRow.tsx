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
        alignItems: "baseline",
        gap: 16,
        padding: `${py}px 0`,
        borderTop: border === "top" ? line : undefined,
        borderBottom: border === "bottom" ? line : undefined,
      }}
    >
      {/* Label yields width first so a long caption wraps instead of digit-breaking "$1234" into "$123" / "4". */}
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: inverse ? "var(--text-inverse-muted)" : "var(--text-muted)", ...labelStyle }}>{label}</span>
      <span style={{ ...mono, flex: "none", fontSize: 13, color: inverse ? "#FFFFFF" : undefined, whiteSpace: "nowrap", ...valueStyle }}>{value}</span>
    </div>
  );
}
