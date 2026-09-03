import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { localizedPath, storeLanguage, stripLanguagePrefix, type AppLanguage } from "../i18n/languages";
import { useAppLanguage } from "../i18n/routing";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation("common");
  const language = useAppLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const selectLanguage = (nextLanguage: AppLanguage) => {
    if (nextLanguage === language) return;
    storeLanguage(nextLanguage);
    const currentPath = stripLanguagePrefix(location.pathname);
    const destination = nextLanguage === "en" && currentPath === "/tools/hwp-editor"
      ? localizedPath(nextLanguage, "/tools")
      : localizedPath(nextLanguage, currentPath);
    navigate(`${destination}${location.search}${location.hash}`);
  };

  return (
    <div className={`language-switcher${compact ? " compact" : ""}`} role="group" aria-label={t("language.switchLabel")}>
      {(["ko", "en"] as const).map((item) => (
        <button
          type="button"
          key={item}
          className={language === item ? "selected" : ""}
          aria-pressed={language === item}
          onClick={() => selectLanguage(item)}
        >
          {item.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
