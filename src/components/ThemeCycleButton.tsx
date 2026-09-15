import { Moon, Palette, Sun } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { applyTheme, nextTheme, readAppliedTheme, type WorklazyTheme } from "../theme";

function themeIcon(theme: WorklazyTheme) {
  if (theme === "dark-coral" || theme === "dark-mint") return Moon;
  if (theme === "light-mint") return Palette;
  return Sun;
}

export function ThemeCycleButton({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation("common");
  const [theme, setTheme] = useState<WorklazyTheme>(() => readAppliedTheme());
  const upcoming = nextTheme(theme);
  const Icon = themeIcon(theme);
  return (
    <button
      type="button"
      className={`icon-button theme-cycle${compact ? " theme-cycle-compact" : ""}`}
      aria-label={t("theme.switchTo", { theme: t(`theme.names.${upcoming}`) })}
      title={t(`theme.names.${theme}`)}
      onClick={() => {
        applyTheme(upcoming);
        setTheme(upcoming);
      }}
    >
      <Icon size={compact ? 18 : 20} aria-hidden="true" />
      {!compact && <span className="theme-cycle-label">{t(`theme.names.${theme}`)}</span>}
    </button>
  );
}
