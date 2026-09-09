import { useId, useRef, useState, type ReactNode } from "react";

import { revealRow, useCollapse } from "~/hooks/useCollapse";
import { MicroLabel } from "./MicroLabel";

/**
 * One long-form section as a row you open: its kicker and headline always visible, its body under
 * them.
 *
 * /vaults is an app with a whitepaper under it, and the whitepaper was winning. Six full-length
 * sections ran the desktop page past 5,000px and the phone past 4,700px even with each one's body
 * clipped to a peek, because the cost was never only the prose: every section also spent a rule, a
 * kicker, a 30px headline and 96px of air before it. Closed, a section costs one row of that, and the
 * five rows together read as an index of what the page holds.
 *
 * The headline stays in the row rather than being replaced by a plain label, because it is the page's
 * argument in one line ("One line, cleared together.", "Read before depositing.") and a reader
 * deciding whether to open a section is exactly who it was written for.
 *
 * Rows are independent, not one-at-a-time like the vault rows: those are three alternatives, these
 * are reference, and comparing the terms against the risks is a reasonable thing to want.
 *
 * The body is clipped and `visibility: hidden` while closed, not unmounted, so every word is in the
 * prerendered HTML for a crawler or a shared link whichever rows happen to be open.
 */
export function Disclosure({
  kicker,
  title,
  /** One line under the headline, visible while closed. Worth it where a reader should see the gist
      before deciding to open, and left off where the headline already says it. */
  sub,
  children,
}: {
  kicker: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
}) {
  /**
   * Every row starts closed, including the first. Opening one by default was tried and is a bad
   * trade on a phone: the terms row alone is 1,760px there, which cost more than the four closed
   * rows saved and left the page the length it had been.
   */
  const [open, setOpen] = useState(false);
  const row = useRef<HTMLDivElement>(null);
  const body = useCollapse(open, { onOpened: () => revealRow(row.current) });
  const id = useId();

  return (
    <div className="disc" data-open={open ? "true" : "false"} ref={row}>
      {/* The button goes inside the heading, not the other way round: a <button> takes phrasing
          content, so an <h3> within one would be invalid, and this is the shape assistive tech
          expects of an accordion. */}
      <h3 className="disc__heading">
        <button type="button" className="disc__head" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
          <span className="disc__label">
            <MicroLabel tone="accent">{kicker}</MicroLabel>
            <span className="disc__title">{title}</span>
            {sub && <span className="disc__sub">{sub}</span>}
          </span>
          <svg className="disc__chev" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M4.5 7L9 11.5L13.5 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </h3>
      <div id={id} className="disc__body" ref={body.ref} onTransitionEnd={body.onTransitionEnd}>
        <div className="disc__content">{children}</div>
      </div>
    </div>
  );
}

/** The rows, stacked between hairlines. */
export function DisclosureList({ children }: { children: ReactNode }) {
  return <div className="disc-list">{children}</div>;
}
