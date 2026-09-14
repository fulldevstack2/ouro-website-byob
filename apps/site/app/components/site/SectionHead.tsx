import type { CSSProperties, ReactNode } from "react";
import { MicroLabel } from "./MicroLabel";

/**
 * Editorial section start: 1px ink rule, bronze kicker, display h2, optional lede, and optionally a
 * link at the right end of the row ("Full ledger →").
 */
export function SectionHead({
  kicker,
  title,
  sub,
  action,
  size = "md",
  style,
  titleStyle,
  subStyle,
}: {
  kicker: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  /** md: the home page's 36px headline. sub: 30px, for a section inside a page. small: 28px. */
  size?: "md" | "sub" | "small";
  style?: CSSProperties;
  titleStyle?: CSSProperties;
  subStyle?: CSSProperties;
}) {
  const cls = size === "sub" ? "section-title section-title--sub" : size === "small" ? "section-title section-title--small" : "section-title";
  const head = (
    <div>
      <MicroLabel tone="accent">{kicker}</MicroLabel>
      <h2 className={cls} style={titleStyle}>
        {title}
      </h2>
      {sub && (
        <p className="section-head__sub" style={subStyle}>
          {sub}
        </p>
      )}
    </div>
  );
  if (!action) {
    return (
      <div className="section-head" style={style}>
        {head}
      </div>
    );
  }
  return (
    <div className="section-head section-head--row" style={style}>
      {head}
      <div className="section-head__action">{action}</div>
    </div>
  );
}
