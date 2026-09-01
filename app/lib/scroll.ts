/**
 * Make the scroll React Router performs for the *next* navigation smooth.
 *
 * <ScrollRestoration> scrolls to `location.hash` with `el.scrollIntoView()`, which follows
 * the document's CSS `scroll-behavior`. Turning that on globally would also animate the
 * scroll-to-top on every route change, so it is switched on only for this click and
 * switched off again once the animation has had time to finish.
 */
export function smoothScrollNextNavigation() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.scrollBehavior = "smooth";
  window.setTimeout(() => {
    root.style.scrollBehavior = "";
  }, 1000);
}
