import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { localizedPath, storeLanguage, stripLanguagePrefix, type AppLanguage } from "../i18n/languages";
import { useAppLanguage } from "../i18n/routing";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";

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
    <ToggleGroup
      data-ui-component="language-switcher"
      className={`ui-language-switcher${compact ? " ui-compact" : ""}`}
      value={[language]}
      onValueChange={(nextLanguages) => {
        const nextLanguage = nextLanguages.at(-1) as AppLanguage | undefined;
        if (nextLanguage !== undefined) selectLanguage(nextLanguage);
      }}
      aria-label={t("language.switchLabel")}
      spacing={0}
    >
      {(["ko", "en"] as const).map((item) => (
        <ToggleGroupItem
          key={item}
          value={item}
          className={language === item ? "ui-selected" : ""}
        >
          {item.toUpperCase()}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
