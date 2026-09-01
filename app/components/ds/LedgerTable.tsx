import { useState, type CSSProperties, type ReactNode } from "react";

export interface LedgerColumn {
  key: string;
  label: ReactNode;
  align?: "left" | "right" | "center";
  /** Render cells in mono (figures, addresses). */
  numeric?: boolean;
  nowrap?: boolean;
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
            padding: compact ? "9px 16px" : "13px 16px",
            paddingLeft: i === 0 ? 0 : undefined,
            paddingRight: i === columns.length - 1 ? 0 : undefined,
            borderBottom: last ? "none" : "1px solid var(--border-hairline)",
            fontSize: 14,
            textAlign: c.align || "left",
            fontFamily: c.numeric ? "var(--font-mono)" : "var(--font-body)",
            fontVariantNumeric: "tabular-nums",
            color: "var(--text-primary)",
            whiteSpace: c.nowrap ? "nowrap" : "normal",
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
  return (
    <table className={className} style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-body)", ...style }}>
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th
              key={c.key}
              scope="col"
              style={{
                padding: compact ? "0 16px 8px" : "0 16px 10px",
                paddingLeft: i === 0 ? 0 : undefined,
                paddingRight: i === columns.length - 1 ? 0 : undefined,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "var(--tracking-caps)",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                textAlign: c.align || "left",
                borderBottom: "1px solid var(--border-soft)",
                width: c.width,
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
