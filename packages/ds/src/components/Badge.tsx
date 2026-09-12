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
  neutral: { background: "var(--neutral-050)", color: "var(--neutral-700)", border: "1px solid var(--border-hairline)" },
  accent: { background: "var(--bronze-050)", color: "var(--bronze-700)", border: "1px solid var(--bronze-200)" },
  positive: { background: "var(--green-050)", color: "var(--green-700)", border: "1px solid var(--green-100)" },
  negative: { background: "var(--red-050)", color: "var(--red-700)", border: "1px solid var(--red-100)" },
  caution: { background: "var(--amber-050)", color: "var(--amber-700)", border: "1px solid var(--amber-100)" },
  inverse: { background: "var(--neutral-900)", color: "#fff", border: "1px solid var(--neutral-900)" },
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
