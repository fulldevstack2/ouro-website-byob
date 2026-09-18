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

/** Apply a theme to <html> and remember it for the next visit. */
export function writeTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
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
}

/** Re-apply whatever localStorage has (call after hydrate if React cleared data-theme). */
export function applyStoredTheme(): Theme {
  const theme = readStoredTheme();
  writeTheme(theme);
  return theme;
}

export function toggleTheme(): Theme {
  const next: Theme = readPreferredTheme() === "dark" ? "light" : "dark";
  writeTheme(next);
  return next;
}
