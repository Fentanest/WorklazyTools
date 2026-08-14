import { Navigate, useLocation, useParams } from "react-router-dom";

import { defaultLanguage, isAppLanguage, legacyLanguage, localizedPath, stripLanguagePrefix, type AppLanguage } from "./languages";

export function useAppLanguage(): AppLanguage {
  const { lang } = useParams();
  return isAppLanguage(lang) ? lang : defaultLanguage;
}

export function useLocalizedPath(pathname: string) {
  return localizedPath(useAppLanguage(), pathname);
}

export function LocalizedNavigate({ to, replace = true }: { to: string; replace?: boolean }) {
  const language = useAppLanguage();
  return <Navigate to={localizedPath(language, to)} replace={replace} />;
}

export function InvalidLanguageRedirect() {
  const location = useLocation();
  const firstSegment = location.pathname.split("/").filter(Boolean)[0] ?? "";
  const looksLikeLanguage = /^[a-z]{2}(?:-[a-z]{2})?$/i.test(firstSegment);
  const targetLanguage = looksLikeLanguage ? defaultLanguage : legacyLanguage;
  const remainder = looksLikeLanguage
    ? location.pathname.replace(new RegExp(`^/${firstSegment}(?=/|$)`, "i"), "") || "/"
    : stripLanguagePrefix(location.pathname);
  return <Navigate to={`${localizedPath(targetLanguage, remainder)}${location.search}${location.hash}`} replace />;
}
