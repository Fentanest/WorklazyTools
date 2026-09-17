import { useTranslation } from "react-i18next";
import { getGuideData, type ToolGuideDefinition } from "../i18n/guideData";
import { isAppLanguage, defaultLanguage } from "../i18n/languages";

export function useToolGuideData(slug: string): ToolGuideDefinition {
  const { i18n } = useTranslation();
  const lang = isAppLanguage(i18n.language) ? i18n.language : defaultLanguage;
  return getGuideData(lang, slug);
}
