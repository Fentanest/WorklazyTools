export const THEME_STORAGE_KEY = "worklazy-theme";

export const THEMES = ["light-coral", "dark-coral", "light-mint", "dark-mint"] as const;

export type WorklazyTheme = (typeof THEMES)[number];

export const DEFAULT_THEME: WorklazyTheme = "light-coral";

const THEME_BACKGROUNDS: Record<WorklazyTheme, string> = {
  "light-coral": "#f2f6fa",
  "dark-coral": "#10171e",
  "light-mint": "#f2f6fa",
  "dark-mint": "#0d181e",
};

export function isWorklazyTheme(value: unknown): value is WorklazyTheme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

export function nextTheme(current: WorklazyTheme): WorklazyTheme {
  return THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
}

export function readStoredTheme(): WorklazyTheme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isWorklazyTheme(stored)) return stored;
  } catch {
    // Storage blocked: keep the default theme.
  }
  return DEFAULT_THEME;
}

export function readAppliedTheme(): WorklazyTheme {
  const applied = document.documentElement.getAttribute("data-theme");
  return isWorklazyTheme(applied) ? applied : DEFAULT_THEME;
}

export function applyTheme(theme: WorklazyTheme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    document.documentElement.style.colorScheme = theme.startsWith("dark-") ? "dark" : "light";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_BACKGROUNDS[theme]);
  } catch {
    // Non-critical theme metadata.
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage write failure keeps the current tab theme; reload falls back
    // to the readable stored value or the default theme.
  }
}
