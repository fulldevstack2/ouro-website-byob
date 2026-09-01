import type { CSSProperties, ReactNode } from "react";
import { MicroLabel } from "./MicroLabel";

/** Editorial section start: 1px ink rule + bronze kicker + display h2 (+ optional lede). */
export function SectionHead({
  kicker,
  title,
  sub,
  style,
  titleStyle,
  subStyle,
}: {
  kicker: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  style?: CSSProperties;
  titleStyle?: CSSProperties;
  subStyle?: CSSProperties;
}) {
  return (
    <div style={{ borderTop: "1px solid var(--border-strong)", paddingTop: 20, marginBottom: 40, ...style }}>
      <MicroLabel tone="accent">{kicker}</MicroLabel>
      <h2 className="section-title" style={{ margin: "12px 0 0", ...titleStyle }}>
        {title}
      </h2>
      {sub && <p style={{ margin: "12px 0 0", fontSize: 16, lineHeight: 1.6, color: "var(--text-secondary)", maxWidth: 620, ...subStyle }}>{sub}</p>}
    </div>
  );
}
