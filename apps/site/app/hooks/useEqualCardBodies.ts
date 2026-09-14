import { useEffect, useRef } from "react";

/**
 * Give every card sharing a row the same body height, so their buttons sit on one line and their
 * bottoms agree.
 *
 * WHY NOT `align-items: stretch`. A grid row stretches its items to the tallest item in it, and one
 * of these cards can open a deposit panel a few hundred pixels tall. Stretching then dragged the two
 * closed cards down to the open card's height and left each of them a hand's width of empty card
 * above its buttons. Turning the stretch off while a panel is open (a `:has()` rule) was worse in two
 * ways the owner spotted straight away: the closed cards fell back to their own natural heights, which
 * differ from each other, so they no longer matched; and on closing they snapped back to a row that
 * was still tall and shrank along with the collapsing panel, so cards that had never been open
 * appeared to play a closing animation of their own.
 *
 * WHAT THIS DOES INSTEAD. It measures each card's body, takes the tallest in each row, and sets that
 * as a `min-height` on all of them. The panel sits outside the body, so opening one changes nothing
 * for the others: the closed cards keep the height they already had, and the open card simply grows
 * below them. In one column each card is its own row and keeps its own height, so nothing is padded
 * out on a phone.
 *
 * WHY IT CANNOT RATCHET. The figure is summed from the body's CHILDREN, whose heights come from their
 * content and are never the height this hook writes. Reading back a body it had already stretched
 * would make every pass a little taller than the last and the cards would grow without bound. For
 * the same reason the body carries no margins between its children: `offsetHeight` excludes margins,
 * so the spacing is padding, and every child is inside a flex column, where margins cannot collapse
 * out of the box being measured.
 */
export function useEqualCardBodies<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const grid = ref.current;
    if (!grid) return;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const bodies = Array.from(grid.querySelectorAll<HTMLElement>(".vcard__body"));
      if (bodies.length === 0) return;

      const natural = bodies.map((body) =>
        Array.from(body.children).reduce((sum, child) => sum + (child as HTMLElement).offsetHeight, 0),
      );

      // Cards that start at the same y are one row. Grouped before anything is written, since setting
      // a height in the first row moves the second row down.
      const rowTop = bodies.map((body) => Math.round(body.getBoundingClientRect().top + window.scrollY));
      const tallest = new Map<number, number>();
      rowTop.forEach((top, i) => tallest.set(top, Math.max(tallest.get(top) ?? 0, natural[i]!)));

      bodies.forEach((body, i) => {
        const px = `${Math.ceil(tallest.get(rowTop[i]!) ?? natural[i]!)}px`;
        if (body.style.minHeight !== px) body.style.minHeight = px;
      });
    };

    /** One measurement per frame however many observers fired, and never during a resize callback. */
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    // The children are what is watched: a live figure re-rendering, a font arriving, or the column
    // narrowing all change them, and each is a reason to measure again.
    const observer = new ResizeObserver(schedule);
    observer.observe(grid);
    for (const child of grid.querySelectorAll<HTMLElement>(".vcard__body > *")) observer.observe(child);
    schedule();

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return ref;
}
