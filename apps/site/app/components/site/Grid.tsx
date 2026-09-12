import type { CSSProperties, ReactNode } from "react";

export interface GridProps {
  /** grid-template-columns, e.g. "1.05fr 0.95fr" or "repeat(4, 1fr)". Collapses to one column below 860px (see site.css). */
  cols: string;
  gap?: number | string;
  align?: CSSProperties["alignItems"];
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function Grid({ cols, gap = 24, align, className, style, children }: GridProps) {
  const vars = { "--cols": cols, "--gap": typeof gap === "number" ? `${gap}px` : gap } as CSSProperties;
  return (
    <div className={className ? `grid ${className}` : "grid"} style={{ ...vars, alignItems: align, ...style }}>
      {children}
    </div>
  );
}
