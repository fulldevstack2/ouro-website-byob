import { useState, type CSSProperties, type ReactNode } from "react";

export interface LedgerColumn {
  key: string;
  label: ReactNode;
  align?: "left" | "right" | "center";
  /** Render cells in mono (figures, addresses). */
  numeric?: boolean;
  nowrap?: boolean;
  /** Minimum column size (applied as minWidth). Prefer this over a fixed width so cell padding is not crushed. */
  width?: number | string;
}

export type LedgerRow = Record<string, ReactNode>;

export interface LedgerTableProps {
  columns: LedgerColumn[];
  rows: LedgerRow[];
  compact?: boolean;
  style?: CSSProperties;
  className?: string;
}

function Row({ row, columns, compact, last }: { row: LedgerRow; columns: LedgerColumn[]; compact: boolean; last: boolean }) {
  const [hover, setHover] = useState(false);
  const py = compact ? 9 : 13;
  return (
    <tr
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ background: hover ? "var(--surface-tint)" : "transparent", transition: "background var(--dur-fast) var(--ease-out)" }}
    >
      {columns.map((c, i) => (
        <td
          key={c.key}
          style={{
            // Sides set explicitly: a shorthand plus paddingLeft:0 was getting horizontal padding
            // crushed to 1px when a column `width` was tighter than label+padding (UTC stuck to #80).
            paddingTop: py,
            paddingBottom: py,
            paddingLeft: i === 0 ? 0 : 16,
            paddingRight: i === columns.length - 1 ? 0 : 16,
            borderBottom: last ? "none" : "1px solid var(--border-hairline)",
            fontSize: 14,
            textAlign: c.align || "left",
            fontFamily: c.numeric ? "var(--font-mono)" : "var(--font-body)",
            fontVariantNumeric: "tabular-nums",
            color: "var(--text-primary)",
            whiteSpace: c.nowrap ? "nowrap" : "normal",
            minWidth: c.width,
          }}
        >
          {row[c.key]}
        </td>
      ))}
    </tr>
  );
}

/** The live-proof ledger: hairline rows, mono figures, caps header. */
export function LedgerTable({ columns, rows, compact = false, style, className }: LedgerTableProps) {
  // max-content + minWidth 100%: fill the card when there is room, but never compress columns so
  // nowrap caps headers ("Cycle", "Value when sent") spill into their neighbours. Inside
  // `.table-scroll` the extra width becomes a horizontal scroll instead of a crushed header row.
  //
  // Column `width` is applied as minWidth, not width: a fixed width smaller than the caps label plus
  // its 16px gutters made the browser shrink cell padding to 1px, so figures in neighbouring columns
  // sat flush (e.g. "UTC#80").
  return (
    <table
      className={className}
      style={{ width: "max-content", minWidth: "100%", borderCollapse: "collapse", fontFamily: "var(--font-body)", ...style }}
    >
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th
              key={c.key}
              scope="col"
              style={{
                paddingTop: 0,
                paddingBottom: compact ? 8 : 10,
                paddingLeft: i === 0 ? 0 : 16,
                paddingRight: i === columns.length - 1 ? 0 : 16,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "var(--tracking-caps)",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                textAlign: c.align || "left",
                borderBottom: "1px solid var(--border-soft)",
                minWidth: c.width,
                whiteSpace: "nowrap",
              }}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <Row key={ri} row={r} columns={columns} compact={compact} last={ri === rows.length - 1} />
        ))}
      </tbody>
    </table>
  );
}
