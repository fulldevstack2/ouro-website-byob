/** Persisted light/dark preference for ourolayer.com and analytics.ourolayer.com. */

export type Theme = "light" | "dark";

/** localStorage key — shared across both apps so the choice follows the brand. */
export const THEME_STORAGE_KEY = "ouro-theme";

/**
 * Inline boot script: apply the saved theme before first paint.
 * Must run in <head> before CSS paints; <html> also needs suppressHydrationWarning so React
 * hydration does not strip the attribute the script just set.
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);var m=document.querySelector('meta[name="theme-color"]');if(m){if(t==='dark')m.setAttribute('content','#0A0A0A');else{var L=m.getAttribute('data-light');if(L)m.setAttribute('content',L)}}}}catch(e){}`;

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/** What the last visit saved. Missing / unreadable storage = light (canonical default). */
export function readStoredTheme(): Theme {
  if (typeof localStorage === "undefined") return "light";
  try {
    const t = localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(t)) return t;
  } catch {
    /* private mode / blocked storage */
  }
  return "light";
}

/**
 * Prefer the live <html data-theme>, then fall back to storage.
 * After a hydration wipe the attribute may be gone while storage still says dark.
 */
export function readPreferredTheme(): Theme {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.getAttribute("data-theme");
    if (isTheme(attr)) return attr;
  }
  return readStoredTheme();
}

/** @deprecated use readPreferredTheme — kept for call sites that meant the live attribute. */
export function readDocumentTheme(): Theme {
  return readPreferredTheme();
}

/**
 * How long the colours take to cross over, matching `--dur-theme` in tokens/effects.css.
 *
 * Duplicated rather than read back off the custom property, because this runs in the same frame as
 * the flip and a getComputedStyle call there is a forced style flush for a number that has changed
 * once. If one moves, move the other; theme-swap.css names this file for that reason.
 */
const SWAP_MS = 280;

function wantsTheCut(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

let swapTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Run `flip` with the page's colours transitioning instead of cutting.
 *
 * The reflow between arming and flipping is load-bearing. A transition only starts when the property
 * had one declared in the style BEFORE the change as well, so arming the rule and remapping the
 * tokens in one style recalculation animates nothing — the browser resolves both at once and paints
 * the new colours. Reading `offsetWidth` forces the armed style to be computed first, which is what
 * makes the flip a change rather than a cut.
 */
function withColourFade(flip: () => void): void {
  const root = document.documentElement;
  if (wantsTheCut()) {
    flip();
    return;
  }
  clearTimeout(swapTimer);
  root.setAttribute("data-theme-swap", "");
  void root.offsetWidth;
  flip();
  // Taken off again so nothing outside this window carries a transition it did not ask for. A second
  // press inside the window restarts the clock rather than stranding the attribute.
  swapTimer = setTimeout(() => root.removeAttribute("data-theme-swap"), SWAP_MS);
}

/**
 * Apply a theme to <html> and remember it for the next visit.
 *
 * `animate` is off by default because most callers are not a person changing their mind: the boot
 * script and `applyStoredTheme` are restoring a theme the reader already had, and fading that in
 * would make every page load look like a theme change. Only a deliberate switch animates.
 */
export function writeTheme(theme: Theme, { animate = false }: { animate?: boolean } = {}): void {
  if (typeof document === "undefined") return;
  const apply = () => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* private mode / blocked storage — theme still applies for this session */
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", theme === "dark" ? "#0A0A0A" : meta.getAttribute("data-light") || "#FFFFFF");
    }
  };
  animate ? withColourFade(apply) : apply();
}

/** Re-apply whatever localStorage has (call after hydrate if React cleared data-theme). */
export function applyStoredTheme(): Theme {
  const theme = readStoredTheme();
  writeTheme(theme);
  return theme;
}

/** The one path that is a person changing their mind, so the one that animates. */
export function toggleTheme(): Theme {
  const next: Theme = readPreferredTheme() === "dark" ? "light" : "dark";
  writeTheme(next, { animate: true });
  return next;
}
