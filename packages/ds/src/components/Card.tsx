import type { CSSProperties, ReactNode } from "react";

export type CardTone = "default" | "tint" | "inverse";

export interface CardProps {
  /** Micro-label in the card header. */
  label?: ReactNode;
  /** Right-aligned header slot (badge, timestamp, link). */
  action?: ReactNode;
  tone?: CardTone;
  padding?: number | string;
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
}

const TONES: Record<CardTone, CSSProperties> = {
  default: { background: "var(--surface-card)", border: "1px solid var(--border-hairline)", boxShadow: "var(--shadow-card)" },
  tint: { background: "var(--surface-tint)", border: "1px solid var(--border-hairline)" },
  inverse: { background: "var(--surface-inverse)", border: "1px solid var(--surface-inverse)", color: "var(--text-inverse)" },
};

export function Card({ label, action, tone = "default", padding = 24, style, className, children }: CardProps) {
  return (
    <section className={className} style={{ borderRadius: "var(--radius-lg)", padding, boxSizing: "border-box", ...TONES[tone], ...style }}>
      {(label || action) && (
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
          {label ? (
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "var(--tracking-caps)",
                textTransform: "uppercase",
                color: tone === "inverse" ? "var(--text-inverse-muted)" : "var(--text-muted)",
              }}
            >
              {label}
            </div>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
