/**
 * The page chrome, measured.
 *
 * One function, for one reason: the site bar is sticky, and the comparison table's head now sticks
 * underneath it. A sticky offset has to be a number, and the bar's height is not one — it wraps to
 * two rows somewhere around a thousand pixels, to three on a phone, and it changes again when a
 * self-hosted face finishes loading. A constant would either leave a band of page showing under the
 * bar or park the table's head behind it, and which of the two depends on the reader's window.
 */
import { useEffect } from "react";

/**
 * Publish the site bar's height as `--nav-h` on the document, and keep it current.
 *
 * Called from the root layout, so every page has it whether or not it sticks anything. The
 * stylesheet declares its own `--nav-h` for the first paint; this overwrites it on the element,
 * which wins over the sheet.
 */
export function useNavHeight(selector = ".nav"): void {
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(selector);
    if (!nav) return;

    const publish = () => {
      const h = Math.round(nav.getBoundingClientRect().height);
      if (h > 0) document.documentElement.style.setProperty("--nav-h", `${h}px`);
    };
    publish();

    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(publish);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [selector]);
}
