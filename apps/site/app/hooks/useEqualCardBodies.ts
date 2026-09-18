import { useEffect, useRef } from "react";

/**
 * Give every card sharing a row the same body height, and the same height for the blocks inside it,
 * so their figures, their rows and their buttons all sit on one line across the row.
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
 *
 * THE BLOCKS INSIDE (added 2026-09-18, the owner: "can we align this", over the hairline above the
 * rows). Matching bodies only promises the same bottom. Inside, a card whose rate footnote runs to
 * three lines where its neighbour's runs to two started its rows twenty pixels lower, and every row
 * under it was out of line with the same row in the next card. So the figures block and each row are
 * matched across the cards of a row as well, which is what makes the three read as one table.
 * `.vcard__pair` has carried a `min-height` for this same reason since the cards were built; this is
 * the rest of that idea, done by measurement because a footnote's length is not known in CSS.
 */
export function useEqualCardBodies<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const grid = ref.current;
    if (!grid) return;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const cards = Array.from(grid.querySelectorAll<HTMLElement>(".vcard-wrap"));
      if (cards.length === 0) return;

      // Cards that start at the same y are one row. Grouped before anything is written, since setting
      // a height in the first row moves the second row down.
      const byRow = new Map<number, HTMLElement[]>();
      for (const card of cards) {
        const top = Math.round(card.getBoundingClientRect().top + window.scrollY);
        byRow.set(top, [...(byRow.get(top) ?? []), card]);
      }

      // The blocks inside first: the body's height is summed from children that contain them, so it
      // has to be measured after they have taken their final height.
      for (const row of byRow.values()) {
        match(row.map((card) => card.querySelector<HTMLElement>(".vcard__figures")));
        const rows = row.map((card) => Array.from(card.querySelectorAll<HTMLElement>(".vcard__rows > *")));
        const deepest = Math.max(...rows.map((r) => r.length));
        for (let i = 0; i < deepest; i++) match(rows.map((r) => r[i] ?? null));
      }

      const bodies = Array.from(grid.querySelectorAll<HTMLElement>(".vcard__body"));
      const natural = bodies.map((body) =>
        Array.from(body.children).reduce((sum, child) => sum + (child as HTMLElement).offsetHeight, 0),
      );
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

/**
 * Give one block the same height in every card of a row: the tallest of them, as a `min-height`.
 *
 * Measured with whatever was written LAST TIME cleared first, unlike the body above, which sums its
 * children. Neither of the two things matched here can be measured through its children: the figures
 * block is a grid whose two cells stretch to exactly the height written on it, so reading them back
 * would make every pass taller than the last, and a row's own children are inline spans whose
 * heights say nothing about the padding around them. Clearing and reading in the same frame costs one
 * forced layout and cannot ratchet, because what is read is always the natural height.
 *
 * A row of one (the single column on a phone) has nothing to match and is left at its own height.
 */
function match(boxes: (HTMLElement | null)[]): void {
  const found = boxes.filter((b): b is HTMLElement => b !== null);
  if (found.length === 0) return;
  for (const box of found) box.style.minHeight = "";
  if (found.length === 1) return;
  const tallest = found.reduce((max, box) => Math.max(max, box.offsetHeight), 0);
  for (const box of found) box.style.minHeight = `${Math.max(0, Math.ceil(tallest - inset(box)))}px`;
}

/**
 * The vertical padding and borders a `min-height` does NOT cover, per box.
 *
 * This site has no `border-box` reset, so `min-height` sizes the CONTENT box while `offsetHeight`
 * measures the border box. Writing one straight into the other made every row 23 pixels taller than
 * the tallest of them (a KVRow carries 11px of padding above and below and a hairline under it), and
 * the cards stayed aligned with each other while all three grew. Zero for a box that is already
 * border-box, and the last row of a card, which has no hairline, gets its own smaller figure.
 */
function inset(box: HTMLElement): number {
  const cs = getComputedStyle(box);
  if (cs.boxSizing === "border-box") return 0;
  return [cs.paddingTop, cs.paddingBottom, cs.borderTopWidth, cs.borderBottomWidth].reduce((sum, v) => sum + (Number.parseFloat(v) || 0), 0);
}
