export const supportedLanguages = ["ko", "en"] as const;
export type AppLanguage = (typeof supportedLanguages)[number];

export const defaultLanguage: AppLanguage = "en";
export const legacyLanguage: AppLanguage = "ko";
export const languageStorageKey = "worklazy_lang";

export function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return supportedLanguages.includes(value as AppLanguage);
}

export function languageFromPath(pathname: string): AppLanguage | null {
  const segment = pathname.split("/").filter(Boolean)[0];
  return isAppLanguage(segment) ? segment : null;
}

export function stripLanguagePrefix(pathname: string) {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const language = languageFromPath(normalized);
  if (!language) return normalized;
  const stripped = normalized.replace(new RegExp(`^/${language}(?=/|$)`), "");
  return stripped || "/";
}

export function localizedPath(language: AppLanguage, pathname: string) {
  const path = stripLanguagePrefix(pathname);
  if (path === "/") return `/${language}/`;
  return `/${language}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getStoredLanguage(): AppLanguage | null {
  try {
    const value = window.localStorage.getItem(languageStorageKey);
    return isAppLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

export function storeLanguage(language: AppLanguage) {
  try {
    window.localStorage.setItem(languageStorageKey, language);
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

export function browserLanguage(): AppLanguage {
  return navigator.languages?.some((language) => language.toLowerCase().startsWith("ko"))
    || navigator.language.toLowerCase().startsWith("ko") ? "ko" : "en";
}
