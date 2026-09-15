import { useCallback, useEffect, useState } from "react";

export const WORKLAZY_THEME_STORAGE_KEY = "worklazy-theme";

export type WorklazyTheme = "light-coral" | "dark-coral" | "light-mint" | "dark-mint";

export const WORKLAZY_THEMES: readonly WorklazyTheme[] = [
  "light-coral",
  "dark-coral",
  "light-mint",
  "dark-mint",
] as const;

const DEFAULT_THEME: WorklazyTheme = "light-coral";

function isWorklazyTheme(value: string | null): value is WorklazyTheme {
  return value === "light-coral" || value === "dark-coral" || value === "light-mint" || value === "dark-mint";
}

export function readStoredTheme(): WorklazyTheme {
  try {
    const stored = window.localStorage.getItem(WORKLAZY_THEME_STORAGE_KEY);
    if (isWorklazyTheme(stored)) return stored;
  } catch {
    // Storage may be unavailable (private mode, blocked cookies). Fall back silently.
  }
  return DEFAULT_THEME;
}

export function applyWorklazyTheme(theme: WorklazyTheme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme.startsWith("dark-") ? "dark" : "light";
}

export function nextWorklazyTheme(theme: WorklazyTheme): WorklazyTheme {
  const index = WORKLAZY_THEMES.indexOf(theme);
  return WORKLAZY_THEMES[(index + 1) % WORKLAZY_THEMES.length];
}

/** 4-theme cycle for the WorklazyTools shell: light-coral → dark-coral → light-mint → dark-mint. */
export function useWorklazyTheme() {
  const [theme, setTheme] = useState<WorklazyTheme>(() => {
    if (typeof document !== "undefined" && isWorklazyTheme(document.documentElement.dataset.theme ?? null)) {
      return document.documentElement.dataset.theme as WorklazyTheme;
    }
    return readStoredTheme();
  });

  useEffect(() => {
    applyWorklazyTheme(theme);
    try {
      window.localStorage.setItem(WORKLAZY_THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore persistence failures; the theme still applies to this session.
    }
    window.dispatchEvent(new CustomEvent<WorklazyTheme>("worklazy:theme", { detail: theme }));
  }, [theme]);

  useEffect(() => {
    const syncTheme = (event: Event) => {
      const next = (event as CustomEvent<WorklazyTheme>).detail;
      if (isWorklazyTheme(next)) setTheme(next);
    };
    window.addEventListener("worklazy:theme", syncTheme);
    return () => window.removeEventListener("worklazy:theme", syncTheme);
  }, []);

  const cycleTheme = useCallback(() => {
    setTheme((current) => nextWorklazyTheme(current));
  }, []);

  return { theme, setTheme, cycleTheme, isDark: theme.startsWith("dark-") };
}
