import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { toolCategories, tools, type ToolCategoryDefinition, type ToolDefinition } from "../app/toolRegistry";
import { localizedPath } from "./languages";
import { useAppLanguage } from "./routing";

export function useToolCatalog() {
  const { t, i18n } = useTranslation("tools");
  const language = useAppLanguage();

  return useMemo(() => {
    const localizedCategories: ToolCategoryDefinition[] = toolCategories.map((category) => ({
      ...category,
      label: t(`categories.${category.id}.label`),
      shortLabel: t(`categories.${category.id}.shortLabel`),
      description: t(`categories.${category.id}.description`),
    }));
    const localizedTools: ToolDefinition[] = tools
      .filter((tool) => language === "ko" || tool.id !== "hwp-editor")
      .map((tool) => ({
        ...tool,
        path: localizedPath(language, tool.path),
        title: t(`items.${tool.id}.title` as never),
        shortTitle: t(`items.${tool.id}.shortTitle` as never),
        description: t(`items.${tool.id}.description` as never),
        eyebrow: t(`items.${tool.id}.eyebrow` as never),
        highlights: tool.highlights.map((highlight, index) => ({
          ...highlight,
          label: t(`items.${tool.id}.highlights.${index}` as never),
        })),
      }));
    return { toolCategories: localizedCategories, tools: localizedTools };
  }, [i18n.resolvedLanguage, language, t]);
}
