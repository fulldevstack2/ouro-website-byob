import type { CSSProperties, ReactNode } from "react";
import { MicroLabel } from "./MicroLabel";

/**
 * Sub-page header: bronze kicker, display h1, one-sentence lede, and on the right whatever the page
 * has to say about its own state (a Live badge, the clock, the wallet). A hairline closes it.
 */
export function PageHeader({
  kicker,
  title,
  lede,
  aside,
  note,
  ledeStyle,
}: {
  kicker: ReactNode;
  title: ReactNode;
  lede: ReactNode;
  aside?: ReactNode;
  /** One short line under the lede, for a fact the lede cannot carry (whose wallet is on screen). */
  note?: ReactNode;
  ledeStyle?: CSSProperties;
}) {
  return (
    <div className="page-head">
      <div className="page-head__main">
        <MicroLabel tone="accent">{kicker}</MicroLabel>
        <h1 className="page-title">{title}</h1>
        <p className="page-head__lede" style={ledeStyle}>
          {lede}
        </p>
        {note && <div className="page-head__note">{note}</div>}
      </div>
      {aside && <div className="page-head__aside">{aside}</div>}
    </div>
  );
}
