import type { CSSProperties, ReactNode } from "react";

export type TokenChipTone = "neutral" | "inverse";

export interface TokenChipProps {
  symbol: string;
  amount?: ReactNode;
  tone?: TokenChipTone;
  style?: CSSProperties;
  className?: string;
}

/** Basket constituent without a logo: ink tile with the ticker's first letter. */
export function TokenChip({ symbol, amount, tone = "neutral", style, className }: TokenChipProps) {
  const inv = tone === "inverse";
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 10px 4px 4px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid " + (inv ? "var(--neutral-700)" : "var(--border-hairline)"),
        background: inv ? "var(--neutral-800)" : "var(--surface-tint)",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 4,
          background: inv ? "#fff" : "var(--neutral-900)",
          color: inv ? "var(--neutral-900)" : "#fff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          fontWeight: 700,
          flex: "none",
        }}
      >
        {symbol.slice(0, 1)}
      </span>
      <span style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", color: inv ? "#fff" : "var(--text-primary)" }}>
        {symbol}
      </span>
      {amount != null && (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            fontWeight: 500,
            color: inv ? "var(--text-inverse-muted)" : "var(--text-muted)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {amount}
        </span>
      )}
    </span>
  );
}
