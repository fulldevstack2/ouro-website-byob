import type { CSSProperties, ReactNode } from "react";

export type StatSize = "sm" | "md" | "lg" | "xl";
export type StatTone = "default" | "inverse";

export interface StatProps {
  label?: ReactNode;
  /** Always mono + tabular; pass "—" for figures that publish later. */
  value: ReactNode;
  unit?: ReactNode;
  /** Signed delta, e.g. "+2.1%" or "−0.6%", colored by sign. */
  delta?: string | number | null;
  footnote?: ReactNode;
  size?: StatSize;
  tone?: StatTone;
  style?: CSSProperties;
  className?: string;
}

const FONT_SIZES: Record<StatSize, number> = { sm: 20, md: 28, lg: 40, xl: 56 };

export function Stat({ label, value, unit, delta, footnote, size = "md", tone = "default", style, className }: StatProps) {
  const fs = FONT_SIZES[size];
  const inv = tone === "inverse";
  const d = delta == null ? null : String(delta).trim();
  const deltaColor = d ? (d.startsWith("-") || d.startsWith("−") ? "var(--text-negative)" : "var(--text-positive)") : undefined;

  return (
    <div className={className} style={style}>
      {label && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "var(--tracking-caps)",
            textTransform: "uppercase",
            color: inv ? "var(--text-inverse-muted)" : "var(--text-muted)",
            marginBottom: 8,
          }}
        >
          {label}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 600,
            fontSize: fs,
            lineHeight: 1.05,
            letterSpacing: "var(--tracking-mono-big)",
            fontVariantNumeric: "tabular-nums",
            color: inv ? "#fff" : "var(--text-primary)",
          }}
        >
          {value}
        </span>
        {unit && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 500,
              fontSize: Math.max(12, Math.round(fs * 0.42)),
              color: inv ? "var(--text-inverse-muted)" : "var(--text-muted)",
            }}
          >
            {unit}
          </span>
        )}
        {d && (
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 13, fontVariantNumeric: "tabular-nums", color: deltaColor }}>
            {d}
          </span>
        )}
      </div>
      {footnote && <div style={{ fontSize: 12, color: inv ? "var(--text-inverse-muted)" : "var(--text-faint)", marginTop: 8 }}>{footnote}</div>}
    </div>
  );
}
