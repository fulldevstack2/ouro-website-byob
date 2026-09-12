import { useEffect, useRef, type TransitionEvent } from "react";

/* ────────────────────────────────────────────────────────────────────────────
   Opening and closing a panel by animating its measured height.

   Two things on /vaults collapse: a vault row's body (closed height 0, at every width) and a
   long-form section on a phone (closed height a peek, only under the media query). Both want the
   same mechanism, so it lives here.
   ──────────────────────────────────────────────────────────────────────────── */

export interface CollapseOptions {
  /** Height the panel rests at when closed, in px. 0 for a panel that disappears entirely. */
  closedHeight?: number;
  /** Collapse only while this media query matches; above it the stylesheet lays the panel out in full. */
  query?: string;
  /** Called once the panel has finished opening, or straight away when there is no animation to wait for. */
  onOpened?: () => void;
}

/**
 * Animate between the panel's closed resting height and the height its content actually needs,
 * measured at the moment of the toggle. The stylesheet owns both resting states, so the prerendered
 * HTML is already correct before any of this runs.
 *
 * NOT the `grid-template-rows: 0fr -> 1fr` trick, which reads far better but is wrong here: in Chrome
 * an auto-height grid with a sub-1fr row sizes the CONTAINER to `fr x content` and the item inside it
 * to `fr x fr x content`, so all the way through the animation the card is taller than the content it
 * is revealing and an empty band grows under the panel (measured: at 0.5fr, a 435px panel gives a
 * 218px card holding 109px of content). A max-height transition has no such bug but buys it back as
 * dead time, since the value has to be guessed high. Measured heights have neither.
 */
export function useCollapse(open: boolean, { closedHeight = 0, query, onOpened }: CollapseOptions = {}) {
  const ref = useRef<HTMLDivElement>(null);
  /** False until the first pass, which adopts a resting state rather than animating out of one. */
  const settled = useRef(false);
  /** Read inside the effect, so a callback that changes every render does not restart the animation. */
  const opened = useRef(onOpened);
  opened.current = onOpened;

  // Deliberately not useLayoutEffect: this module is in the server bundle for the prerender, and
  // nothing here can flash, since the height does not change until the effect itself changes it.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mq = query ? window.matchMedia(query) : null;

    /** Hand the height back to the stylesheet: `auto` while open so live figures can change it
        underneath us, and nothing at all once closed, which is the resting state CSS already holds. */
    const rest = () => {
      el.style.height = open ? "auto" : "";
    };

    /** `toggled` separates a real open/close from adopting a resting state (the first pass, or the
        viewport crossing the query), which must not animate and must not count as an opening. */
    const apply = (toggled: boolean) => {
      // Above the query the panel is not a panel. Drop every height we set, and start over if the
      // viewport comes back.
      if (mq && !mq.matches) {
        el.style.height = "";
        settled.current = false;
        return;
      }
      if (!toggled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        rest();
        if (open && toggled) opened.current?.();
        return;
      }
      // Read the height before writing one: mid-transition this is what is on screen, so a toggle
      // that interrupts another carries on from where it is rather than jumping to an end state.
      const from = el.getBoundingClientRect().height;
      const to = open ? el.scrollHeight : closedHeight;
      el.style.height = `${from}px`;
      void el.offsetHeight; // take `from` as the start of the transition, not the value before it
      el.style.height = `${to}px`;
    };

    apply(settled.current);
    settled.current = true;

    if (!mq) return;
    const onChange = () => apply(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [open, closedHeight, query]);

  const onTransitionEnd = (e: TransitionEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.target !== el || e.propertyName !== "height") return;
    el.style.height = open ? "auto" : "";
    if (open) opened.current?.();
  };

  return { ref, onTransitionEnd };
}

/**
 * Bring a just-opened row under the sticky nav, but only when it is not already comfortably in view:
 * on a phone the panel opens well below the fold, and on a desktop where the whole row already fits
 * the page should not move at all. The nav's height is measured rather than hard-coded, since it
 * wraps to two rows on a phone.
 *
 * `target` is the whole row, header and panel together, not the header alone: what matters is whether
 * the thing that just opened fits on screen.
 */
export function revealRow(target: HTMLElement | null) {
  if (!target) return;
  const offset = (document.querySelector<HTMLElement>(".site-nav")?.offsetHeight ?? 0) + 10;
  const box = target.getBoundingClientRect();
  if (box.top >= offset - 2 && box.bottom <= window.innerHeight) return;
  const top = Math.max(0, window.scrollY + box.top - offset);
  if (Math.abs(top - window.scrollY) < 8) return;
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
}
