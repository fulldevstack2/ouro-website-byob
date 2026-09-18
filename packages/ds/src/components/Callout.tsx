import type { CSSProperties, ReactNode } from "react";

export type CalloutTone = "note" | "caution" | "warning";

export interface CalloutProps {
  tone?: CalloutTone;
  title?: ReactNode;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

const TONES: Record<CalloutTone, CSSProperties> = {
  note: { background: "var(--surface-tint)", border: "1px solid var(--border-hairline)" },
  caution: { background: "var(--tint-caution-bg)", border: "1px solid var(--tint-caution-border)" },
  /** Reserved for a risk a reader can act on and lose money by ignoring, not for general caution. */
  warning: { background: "var(--tint-negative-bg)", border: "1px solid var(--tint-negative-border)" },
};

const TITLE_COLOR: Record<CalloutTone, string> = {
  note: "var(--text-primary)",
  caution: "var(--tint-caution-fg)",
  warning: "var(--tint-negative-fg)",
};

/** Honesty/risk notes are first-class in this brand: readable type, never fine print. */
export function Callout({ tone = "note", title, children, style, className }: CalloutProps) {
  return (
    <aside
      className={className}
      style={{
        borderRadius: "var(--radius-md)",
        padding: "14px 18px",
        fontSize: 13,
        lineHeight: 1.55,
        color: "var(--text-secondary)",
        boxSizing: "border-box",
        ...TONES[tone],
        ...style,
      }}
    >
      {title && (
        <div style={{ fontWeight: 600, fontSize: 13, color: TITLE_COLOR[tone], marginBottom: 4 }}>
          {title}
        </div>
      )}
      {children}
    </aside>
  );
}
