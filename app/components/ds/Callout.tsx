import type { CSSProperties, ReactNode } from "react";

export type CalloutTone = "note" | "caution";

export interface CalloutProps {
  tone?: CalloutTone;
  title?: ReactNode;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

const TONES: Record<CalloutTone, CSSProperties> = {
  note: { background: "var(--surface-tint)", border: "1px solid var(--border-hairline)" },
  caution: { background: "var(--amber-050)", border: "1px solid var(--amber-100)" },
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
        <div style={{ fontWeight: 600, fontSize: 13, color: tone === "caution" ? "var(--amber-700)" : "var(--text-primary)", marginBottom: 4 }}>
          {title}
        </div>
      )}
      {children}
    </aside>
  );
}
