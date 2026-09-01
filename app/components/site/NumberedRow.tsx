import type { CSSProperties, ReactNode } from "react";
import { hairline, rowIndex } from "./text";

export interface NumberedRowProps {
  /** "01", "R1"… set in bronze mono. */
  n: ReactNode;
  children: ReactNode;
  /** Right-aligned slot (e.g. an amount). */
  trailing?: ReactNode;
  /** Vertical padding in px. */
  py?: number;
  borderBottom?: boolean;
  align?: CSSProperties["alignItems"];
  indexWidth?: number;
  style?: CSSProperties;
}

/** Hairline rule row with a bronze index: the Loop steps, basket rules, cycle feed, vault steps. */
export function NumberedRow({ n, children, trailing, py = 16, borderBottom = false, align, indexWidth = 26, style }: NumberedRowProps) {
  return (
    <div style={{ display: "flex", gap: 20, padding: `${py}px 0`, borderTop: hairline, borderBottom: borderBottom ? hairline : undefined, alignItems: align, ...style }}>
      <span style={{ ...rowIndex, width: indexWidth }}>{n}</span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {trailing}
    </div>
  );
}
