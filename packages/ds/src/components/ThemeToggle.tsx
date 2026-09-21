import { useLayoutEffect, useState, type CSSProperties, type ReactNode } from "react";

import {
  applyStoredTheme,
  isTheme,
  readPreferredTheme,
  THEME_STORAGE_KEY,
  toggleTheme,
  writeTheme,
  type Theme,
} from "../theme";

export interface ThemeToggleProps {
  className?: string;
  style?: CSSProperties;
}

/** 14px Lucide-style marks — sun means "switch to light", moon means "switch to dark". */
function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5z" />
    </svg>
  );
}

/**
 * Nav control: moon/sun mark + "Dark mode" / "Light mode". Light is the default; the choice is
 * stored under `ouro-theme` (see THEME_BOOT_SCRIPT). useLayoutEffect re-applies storage after hydrate.
 */
export function ThemeToggle({ className, style }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>(() => readPreferredTheme());

  useLayoutEffect(() => {
    setTheme(applyStoredTheme());
    /**
     * The reader switched in another tab. That is still a person changing their mind, so it fades
     * here too, and it goes through `writeTheme` rather than setting the attribute by hand — which
     * is what used to leave this tab's theme-color meta on the old theme's value.
     */
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && isTheme(e.newValue)) {
        writeTheme(e.newValue, { animate: true });
        setTheme(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const dark = theme === "dark";
  const label = dark ? "Light mode" : "Dark mode";
  const aria = dark ? "Switch to light mode" : "Switch to dark mode";
  const icon: ReactNode = dark ? <SunIcon /> : <MoonIcon />;

  return (
    <button
      type="button"
      className={className ? `theme-toggle ${className}` : "theme-toggle"}
      aria-label={aria}
      onClick={() => setTheme(toggleTheme())}
      style={style}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
