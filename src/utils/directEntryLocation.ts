import { localizedPath, stripLanguagePrefix, type AppLanguage } from "../i18n/languages.ts";
export interface DirectEntryLocation { pathname: string; search: string; hash: string }
export function directEntryRouteKey(pathname: string) {
  return stripLanguagePrefix(pathname).replace(/\/+$/, "") || "/";
}
export function restoreDirectEntryLocation(location: DirectEntryLocation, language: AppLanguage) {
  return localizedPath(language, location.pathname) + location.search + location.hash;
}
