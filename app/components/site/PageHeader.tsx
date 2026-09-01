import type { CSSProperties, ReactNode } from "react";
import { MicroLabel } from "./MicroLabel";

/** Sub-page header (Ledger / Docs / Stake): kicker, display h1, lede, optional right-hand status. */
export function PageHeader({ kicker, title, lede, aside, ledeStyle }: { kicker: ReactNode; title: ReactNode; lede: ReactNode; aside?: ReactNode; ledeStyle?: CSSProperties }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, flexWrap: "wrap" }}>
      <div>
        <MicroLabel tone="accent">{kicker}</MicroLabel>
        <h1 className="page-title" style={{ margin: "14px 0 0" }}>
          {title}
        </h1>
        <p style={{ margin: "14px 0 0", fontSize: 16, color: "var(--text-secondary)", maxWidth: 560, ...ledeStyle }}>{lede}</p>
      </div>
      {aside}
    </div>
  );
}
