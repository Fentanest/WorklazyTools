import { isRedactorDocument, isRedactorPath } from "../app/redactorIsolation";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { localizedPath, storeLanguage, stripLanguagePrefix, type AppLanguage } from "../i18n/languages";
import { useAppLanguage } from "../i18n/routing";

const LANGUAGE_OPTIONS = ["ko", "en"] as const;

function normalizeToolPath(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation("common");
  const language = useAppLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const selectLanguage = (nextLanguage: AppLanguage) => {
    if (nextLanguage === language) return;
    storeLanguage(nextLanguage);
    const currentPath = normalizeToolPath(stripLanguagePrefix(location.pathname));
    const destination = nextLanguage === "en" && currentPath === "/tools/hwp-editor"
      ? localizedPath(nextLanguage, "/tools")
      : localizedPath(nextLanguage, currentPath);
    if (isRedactorDocument() || isRedactorPath(location.pathname)) { window.location.assign(`${destination}${location.search}${location.hash}`); return; }
    navigate(`${destination}${location.search}${location.hash}`);
  };

  return (
    <select
      data-ui-component="language-switcher"
      className={`ui-language-switcher${compact ? " ui-compact" : ""}`}
      aria-label={t("language.switchLabel")}
      value={language}
      onChange={(event) => {
        const nextLanguage = event.target.value;
        if (nextLanguage === "ko" || nextLanguage === "en") selectLanguage(nextLanguage);
      }}
    >
      {LANGUAGE_OPTIONS.map((item) => (
        <option key={item} value={item}>
          {item.toUpperCase()}
        </option>
      ))}
    </select>
  );
}
