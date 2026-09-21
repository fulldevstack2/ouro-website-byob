/**
 * The page's motion primitives.
 *
 * ── What motion is for here ──
 * This page reports other people's figures off a chain that never stops. Motion earns its place when
 * it says something true about that: a figure that just changed, a read that is due, a series being
 * drawn, a card that moved because the reader re-ranked it. Anything that moves for decoration is
 * noise on a page whose whole value is that its numbers can be trusted.
 *
 * ── Reduced motion ──
 * The stylesheet kills every CSS animation and transition under `prefers-reduced-motion: reduce`,
 * which covers most of what is below. The two things it cannot reach are the Web Animations calls in
 * `useFlip` and the reveal observer, so both check `prefersReducedMotion()` themselves and simply do
 * nothing. Nothing on the page depends on an animation having run.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A clock that re-renders whoever calls it.
 *
 * Keep it in the smallest component that needs it. Calling this in the route would re-render the
 * table and three SVG charts once a second to move one word.
 */
export function useClock(everyMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

/**
 * True for a moment after `value` changes to a different, still-present value.
 *
 * Deliberately silent on the first arrival (null to a figure). Every cell on the page fills in at
 * once when the first read lands, and flashing all forty-two of them would say "forty-two things
 * just changed" when what happened is that the page loaded. A flash means: this number moved.
 */
export function useChanged(value: string | null, ms = 1150): boolean {
  const previous = useRef(value);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const before = previous.current;
    previous.current = value;
    if (before === null || value === null || before === value) return;
    setOn(true);
    const timer = setTimeout(() => setOn(false), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);

  return on;
}

/**
 * True for the first `ms` after mount, and never again.
 *
 * Entrance animations have to be gated on this because of how React reorders a list: it moves the
 * existing nodes with `insertBefore`, and a re-inserted element restarts every CSS animation
 * attached to it. Left ungated, re-ranking the cards replayed their entrance, so each card faded in
 * from nothing WHILE sliding to its new position, and forty-three sparkline bars regrew underneath.
 * An entrance should fire when something arrives, not when it moves.
 *
 * A component that genuinely should re-animate on new data gets there by remounting on a changed
 * `key`, which starts this over honestly.
 */
export function useEnter(ms = 900): boolean {
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setEntering(false), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return entering;
}

/**
 * Slide children to their new places when the order changes. First, Last, Invert, Play.
 *
 * Re-ranking is the page's main interaction and it moved three cards and three chart panels
 * instantly, which reads as a redraw rather than a reorder: the reader cannot tell whether the cards
 * moved or the figures in them did. Sliding them says which.
 *
 * Measures on every commit rather than on a sort key, because the cards also move when a figure
 * arrives and changes their height. The cost is three `getBoundingClientRect` calls per render of
 * one small list.
 */
interface Spot {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Where an element sits on the PAGE, not in the window.
 *
 * `getBoundingClientRect` is relative to the viewport, so a reader who scrolled between one commit
 * and the next made every card look like it had moved by the distance they scrolled. The first
 * re-rank after scrolling down to the table then slid the cards in from 1,400 pixels away, which is
 * the "flying in" this was reported as. Adding the scroll offset makes the stored position a fact
 * about the document, which is the only frame of reference a reorder means anything in.
 */
function spotOf(el: HTMLElement): Spot {
  const r = el.getBoundingClientRect();
  return { left: r.left + window.scrollX, top: r.top + window.scrollY, width: r.width, height: r.height };
}

export function useFlip<T extends HTMLElement>(duration = 420) {
  const host = useRef<T | null>(null);
  const boxes = useRef(new Map<string, Spot>());
  const running = useRef(new Map<string, Animation>());

  // A resize re-laid the list out. That is not a reorder, so drop the baseline and take a fresh one
  // on the next commit rather than sliding every child from where it used to fit.
  useEffect(() => {
    const onResize = () => boxes.current.clear();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduced = prefersReducedMotion();
    const next = new Map<string, Spot>();
    /**
     * A child cannot legitimately travel further than the diagonal of the list it sits in: the
     * furthest any card moves is across the row, or down the stack. Anything past that came from a
     * stale measurement rather than a reorder, and it snaps instead of sliding. Insurance, now that
     * the scroll bug it was written for is fixed.
     */
    const hostBox = el.getBoundingClientRect();
    const limit = Math.hypot(hostBox.width, hostBox.height) || Number.POSITIVE_INFINITY;

    /**
     * Nothing animates off screen.
     *
     * Re-ranking from a row of the table moves the cards, which by then are a screen and a half
     * above the reader. Sliding them there costs a frame budget to show nobody anything, and on a
     * narrow layout, where the list is stacked and a card travels most of a screen, whatever clips
     * the edge of the viewport on its way past reads as something having gone wrong. When they
     * scroll back up the cards are simply in their new order.
     */
    const viewTop = window.scrollY;
    const viewBottom = viewTop + window.innerHeight;
    const onScreen = (s: Spot) => s.top < viewBottom && s.top + s.height > viewTop;

    for (const child of Array.from(el.children) as HTMLElement[]) {
      const key = child.dataset.flip;
      if (!key) continue;

      /**
       * Two measurements, and both are needed.
       *
       * `getBoundingClientRect` reports the box INCLUDING any transform, so a card measured while it
       * is still sliding reads as being wherever it has got to. Storing that fed a half-finished
       * slide back in as the card's real position: the next commit computed a fresh offset from a
       * distance the card had already partly travelled, stacked a second animation on top, and threw
       * it off the side of the screen. It only took one unrelated re-render (a poll landing, the
       * entrance class dropping) inside the 420 ms to happen.
       *
       * So: `visual` is where it looks right now, `layout` is where it actually belongs once the
       * in-flight slide is cancelled. The layout box is what gets stored, and a card interrupted
       * mid-slide carries on from where it visibly is rather than jumping.
       */
      const visual = spotOf(child);
      const active = running.current.get(key);
      if (active) {
        active.cancel();
        running.current.delete(key);
      }
      const layout = active ? spotOf(child) : visual;
      next.set(key, layout);

      const was = boxes.current.get(key);
      if (!was || reduced) continue;
      const dx = (active ? visual.left : was.left) - layout.left;
      const dy = (active ? visual.top : was.top) - layout.top;
      const travel = Math.hypot(dx, dy);
      if (travel < 1 || travel > limit) continue;
      if (!onScreen(layout) && !onScreen(was)) continue;

      const anim = child.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0px, 0px)" }],
        { duration, easing: "cubic-bezier(0.2, 0.6, 0.2, 1)" },
      );
      running.current.set(key, anim);
      anim.addEventListener("finish", () => {
        if (running.current.get(key) === anim) running.current.delete(key);
      });
    }

    boxes.current = next;
  });

  return host;
}

/**
 * Slide a table's columns to their new places when the order changes.
 *
 * Same argument as `useFlip`, for the one place on the page that could not use it. Re-ranking is
 * driven from the table's own row labels, and the table is where the reader is standing when they
 * press one — but the cards and the panels that slide are a screen and a half above them by then,
 * and `useFlip` deliberately does not animate off screen. So the only thing the reader could see was
 * three columns of figures snapping into different places, which reads as a redraw: they cannot tell
 * whether the columns moved or the numbers in them changed. It is worth saying a third time here.
 *
 * ── Why this is not `useFlip` ──
 * A column is not an element. There is no node to translate, only fifteen cells that share an x, so
 * the measurement and the animation come apart: the head cell is measured once per column, and the
 * offset it yields is applied to every cell carrying that column's key. `<col>` exists but is not
 * transformable, and `useFlip` measures the direct children of one host, which here are rows.
 *
 * ── Why the offset is measured inside the host ──
 * The table scrolls horizontally inside its own container on a narrow screen. A viewport-relative
 * left would make a sideways scroll between two commits look like every column had moved, which is
 * the bug `spotOf` fixes for the page's vertical scroll. Measuring against the host's own box makes
 * the stored position a fact about the table.
 */
export function useColumnFlip<T extends HTMLElement>(duration = 460) {
  const host = useRef<T | null>(null);
  const lefts = useRef(new Map<string, number>());
  const running = useRef(new Map<string, Animation[]>());

  // As in `useFlip`: a resize re-lays the table out, which is not a reorder.
  useEffect(() => {
    const onResize = () => lefts.current.clear();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduced = prefersReducedMotion();
    const origin = el.getBoundingClientRect().left;
    const next = new Map<string, number>();
    const moves: { key: string; dx: number }[] = [];

    for (const head of Array.from(el.querySelectorAll<HTMLElement>("thead [data-col]"))) {
      const key = head.dataset.col;
      if (!key) continue;

      /**
       * Two measurements, for the reason written out at length in `useFlip`: a cell measured while
       * it is still sliding reports where it has got to, not where it belongs, and storing that
       * compounds the next offset on top of a journey already half made.
       */
      const visual = head.getBoundingClientRect().left - origin;
      const live = running.current.get(key);
      if (live) {
        for (const anim of live) anim.cancel();
        running.current.delete(key);
      }
      const layout = live ? head.getBoundingClientRect().left - origin : visual;
      next.set(key, layout);

      const was = lefts.current.get(key);
      if (was === undefined || reduced) continue;
      const dx = (live ? visual : was) - layout;
      if (Math.abs(dx) >= 1) moves.push({ key, dx });
    }
    lefts.current = next;
    if (!moves.length) return;

    // Nothing animates off screen. The table is tall, so any part of it showing is enough.
    const box = el.getBoundingClientRect();
    if (box.bottom < 0 || box.top > window.innerHeight) return;

    /**
     * The furthest traveller goes on top.
     *
     * Table cells are transparent, so two columns crossing would show each other's figures through
     * one another. Each cell in flight takes the sheet's own colour and is raised out of the flow
     * (see `[data-sliding]`), and the column that crosses the others is raised highest, so it passes
     * in front of them rather than through them.
     */
    const ranked = [...moves].sort((a, b) => Math.abs(a.dx) - Math.abs(b.dx));
    ranked.forEach(({ key, dx }, tier) => {
      const cells = Array.from(el.querySelectorAll<HTMLElement>(`[data-col="${key}"]`));
      const anims = cells.map((cellEl) => {
        cellEl.dataset.sliding = String(tier + 2);
        const anim = cellEl.animate(
          [{ transform: `translateX(${dx}px)` }, { transform: "translateX(0px)" }],
          { duration, easing: "cubic-bezier(0.2, 0.6, 0.2, 1)" },
        );
        const clear = () => delete cellEl.dataset.sliding;
        anim.addEventListener("finish", clear);
        anim.addEventListener("cancel", clear);
        return anim;
      });
      running.current.set(key, anims);
      anims[0]?.addEventListener("finish", () => {
        if (running.current.get(key) === anims) running.current.delete(key);
      });
    });
  });

  return host;
}

/**
 * Fade and lift each section as it first comes into view.
 *
 * Only sections that START below the fold are ever hidden, and only after the first paint, so
 * nothing above the fold can flicker and a browser without IntersectionObserver (or a reader who
 * asked for less motion) simply gets the page with no animation and nothing missing.
 */
export function useReveal(selector = "[data-reveal]"): void {
  useEffect(() => {
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") return;

    const below = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(
      (n) => n.getBoundingClientRect().top > window.innerHeight * 0.9,
    );
    if (!below.length) return;
    for (const node of below) node.dataset.reveal = "pending";

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.reveal = "in";
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -6% 0px" },
    );
    for (const node of below) io.observe(node);
    return () => io.disconnect();
  }, [selector]);
}
