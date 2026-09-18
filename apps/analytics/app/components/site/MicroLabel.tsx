import type { CSSProperties, ReactNode } from "react";
import { micro } from "./text";

export type MicroLabelTone = "muted" | "accent" | "secondary" | "faint";

const COLORS: Record<MicroLabelTone, string> = {
  muted: "var(--text-muted)",
  accent: "var(--text-accent)",
  secondary: "var(--text-secondary)",
  faint: "var(--text-faint)",
};

export function MicroLabel({ children, tone = "muted", style, className }: { children?: ReactNode; tone?: MicroLabelTone; style?: CSSProperties; className?: string }) {
  return (
    <div className={className} style={{ ...micro, color: COLORS[tone], ...style }}>
      {children}
    </div>
  );
}
