import type { ReactNode } from "react";

/** The design's `.qt` "?" dot with a hover/focus tooltip. Styles live in site.css ("Help tooltips"). */
export function HelpTip({ children, placement = "below" }: { children: ReactNode; placement?: "below" | "above" }) {
  return (
    <span className="qt">
      <span className="qt-dot" tabIndex={0} aria-label="More detail">
        ?
      </span>
      <span className={placement === "above" ? "qt-tip qt-tip--above" : "qt-tip"} role="tooltip">
        {children}
      </span>
    </span>
  );
}
