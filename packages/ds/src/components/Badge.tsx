import type { CSSProperties, ReactNode } from "react";

export type BadgeTone = "neutral" | "accent" | "positive" | "negative" | "caution" | "inverse";

export interface BadgeProps {
  tone?: BadgeTone;
  /** Leading dot in the current text color (for "live" states). */
  dot?: boolean;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

const TONES: Record<BadgeTone, CSSProperties> = {
  neutral: { background: "var(--tint-neutral-bg)", color: "var(--tint-neutral-fg)", border: "1px solid var(--tint-neutral-border)" },
  accent: { background: "var(--tint-accent-bg)", color: "var(--tint-accent-fg)", border: "1px solid var(--tint-accent-border)" },
  positive: { background: "var(--tint-positive-bg)", color: "var(--tint-positive-fg)", border: "1px solid var(--tint-positive-border)" },
  negative: { background: "var(--tint-negative-bg)", color: "var(--tint-negative-fg)", border: "1px solid var(--tint-negative-border)" },
  caution: { background: "var(--tint-caution-bg)", color: "var(--tint-caution-fg)", border: "1px solid var(--tint-caution-border)" },
  inverse: { background: "var(--surface-inverse)", color: "var(--text-inverse)", border: "1px solid var(--surface-inverse)" },
};

export function Badge({ tone = "neutral", dot = false, children, style, className }: BadgeProps) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: "var(--radius-full)",
        fontFamily: "var(--font-body)",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "var(--tracking-caps)",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        lineHeight: 1.5,
        ...TONES[tone],
        ...style,
      }}
    >
      {dot && <span style={{ width: 6, height: 6, borderRadius: 99, background: "currentColor", flex: "none" }} />}
      {children}
    </span>
  );
}
