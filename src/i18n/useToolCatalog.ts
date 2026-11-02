import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { toolCategories, tools, type ToolCategoryDefinition, type ToolDefinition } from "../app/toolRegistry";
import { localizedPath } from "./languages";
import { useAppLanguage } from "./routing";

export interface LocalizedTool extends ToolDefinition {
  tagline: string;
  synonyms: string[];
  scenarioLabels: Array<{ id: string; label: string }>;
}

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
    const localizedTools: LocalizedTool[] = tools
      .map((tool) => {
        const synonyms: unknown = t(`items.${tool.id}.synonyms` as never, { returnObjects: true });
        return {
          ...tool,
          path: localizedPath(language, tool.path),
          // Missing future copy falls back to the existing localized description.
          tagline: t(`items.${tool.id}.tagline` as never, { defaultValue: t(`items.${tool.id}.description` as never) }),
          synonyms: Array.isArray(synonyms) ? synonyms.filter((alias): alias is string => typeof alias === "string") : [],
          scenarioLabels: tool.scenarios.map((id) => ({
            id,
            label: t(`scenarios.${id}.label` as never, { defaultValue: t(`categories.${id}.shortLabel` as never) }),
          })),
          entryPoints: tool.entryPoints.map((path) => localizedPath(language, path)),
          title: t(`items.${tool.id}.title` as never),
          shortTitle: t(`items.${tool.id}.shortTitle` as never),
          description: t(`items.${tool.id}.description` as never),
          eyebrow: t(`items.${tool.id}.eyebrow` as never),
          highlights: tool.highlights.map((highlight, index) => ({
            ...highlight,
            label: t(`items.${tool.id}.highlights.${index}` as never),
          })),
        };
      });
    return { toolCategories: localizedCategories, tools: localizedTools };
  }, [i18n.resolvedLanguage, language, t]);
}
