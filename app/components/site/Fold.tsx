import { useId, useState, type CSSProperties, type ReactNode } from "react";

import { useCollapse } from "~/hooks/useCollapse";

/**
 * A long-form block that a phone shows the top of, with a button to read the rest.
 *
 * /vaults is a page with an app at the top and a whitepaper under it: on a 390px screen the reading
 * matter after the deposit panel ran past seven screens, so a reader looking for one figure scrolled
 * through everything. Each block is wrapped in one of these instead. Above the query it does nothing
 * at all: the button is `display: none` and the stylesheet sets no height, so the desktop page is the
 * page it always was, and the prerendered HTML holds every word whatever the viewport.
 *
 * The section's own heading stays OUTSIDE the fold, so a phone still sees what each block is and can
 * skip past it in one flick. Closed, the body is clipped and masked to fade out (background-agnostic,
 * unlike a gradient overlay, since these blocks sit on the page ground, on a card and on a tint).
 */
export function Fold({
  children,
  /** Height of the peek, in px. */
  peek = 176,
  /** Button copy while closed. Name what is inside, e.g. "Read the trust model". */
  more = "Read more",
  less = "Show less",
  style,
}: {
  children: ReactNode;
  peek?: number;
  more?: string;
  less?: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const body = useCollapse(open, { closedHeight: peek, query: FOLD_QUERY });
  const id = useId();

  return (
    <div className="fold" data-open={open ? "true" : "false"} style={{ ...({ "--peek": `${peek}px` } as CSSProperties), ...style }}>
      <div id={id} className="fold__body" ref={body.ref} onTransitionEnd={body.onTransitionEnd}>
        {children}
      </div>
      <button type="button" className="fold__more" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        {open ? less : more}
        <svg className="fold__chev" width="14" height="14" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M4.5 7L9 11.5L13.5 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

/** The one place the fold's breakpoint is decided; site.css carries the same value. */
export const FOLD_QUERY = "(max-width: 720px)";
