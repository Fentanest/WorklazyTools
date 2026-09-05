import { LayoutGrid, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { type ToolAccent, type ToolCategoryId } from "../app/toolRegistry";
import { PrivacyBanner } from "../components/PrivacyBanner";
import { ToolCard } from "../components/ToolCard";
import { PageHeader } from "../components/ui";
import { useToolCatalog } from "../i18n/useToolCatalog";
import { cn } from "../lib/utils";

type CategoryFilter = "all" | ToolCategoryId;

export function ToolsPage() {
  const { t } = useTranslation(["tools", "common"]);
  const { toolCategories, tools } = useToolCatalog();
  const [query, setQuery] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedCategory = searchParams.get("category");
  const activeCategory: CategoryFilter = isToolCategory(requestedCategory) ? requestedCategory : "all";
  const normalizedQuery = query.trim().toLowerCase();

  const groupedTools = useMemo(() => toolCategories
    .filter((category) => activeCategory === "all" || category.id === activeCategory)
    .map((category) => ({
      category,
      tools: tools.filter((tool) => {
        if (tool.category !== category.id) return false;
        if (!normalizedQuery) return true;
        const searchText = [
          tool.title,
          tool.shortTitle,
          tool.description,
          tool.eyebrow,
          category.label,
          category.shortLabel,
          ...tool.highlights.map((highlight) => highlight.label),
        ].join(" ").toLowerCase();
        return searchText.includes(normalizedQuery);
      }),
    }))
    .filter((group) => group.tools.length > 0), [activeCategory, normalizedQuery, toolCategories, tools]);

  const visibleToolCount = groupedTools.reduce((count, group) => count + group.tools.length, 0);
  const selectCategory = (category: CategoryFilter) => {
    const next = new URLSearchParams(searchParams);
    if (category === "all") next.delete("category");
    else next.set("category", category);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="page standard-page page-enter tools-index-page">
      <PageHeader eyebrow={t("tools:index.eyebrow")} title={t("tools:index.title")} description={t("tools:index.description")} />
      <div className="tool-search">
        <Search size={19} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("tools:index.searchPlaceholder")} aria-label={t("tools:index.searchLabel")} />
        {normalizedQuery && <span className="tool-search-count">{t("common:format.tools", { count: visibleToolCount })}</span>}
      </div>

      <div className="tool-category-filter" aria-label={t("tools:index.categoryLabel")}>
        <button type="button" className={cn(activeCategory === "all" && "bg-foreground text-background shadow-lg [&_small]:bg-background/20 [&_small]:text-inherit")} aria-pressed={activeCategory === "all"} onClick={() => selectCategory("all")}>
          <LayoutGrid size={17} /><span>{t("tools:index.all")}</span><small>{tools.length}</small>
        </button>
        {toolCategories.map((category) => {
          const Icon = category.icon;
          const count = tools.filter((tool) => tool.category === category.id).length;
          return (
            <button
              type="button"
              className={cn(activeCategory === category.id && [categoryActiveClasses[category.accent], "text-white shadow-lg [&_small]:bg-white/20 [&_small]:text-inherit"])}
              aria-label={`${category.label} ${t("common:format.tools", { count })}`}
              aria-pressed={activeCategory === category.id}
              key={category.id}
              onClick={() => selectCategory(category.id)}
            >
              <Icon size={17} /><span>{category.shortLabel}</span><small>{count}</small>
            </button>
          );
        })}
      </div>

      <PrivacyBanner compact />

      <div className="tool-category-groups" aria-live="polite">
        {groupedTools.map(({ category, tools: categoryTools }) => {
          const Icon = category.icon;
          return (
            <section className="tool-category-section" key={category.id} aria-labelledby={`tool-category-${category.id}`}>
              <header className="tool-category-heading">
                <span className={cn("grid size-[42px] place-items-center rounded-[13px]", categoryIconClasses[category.accent])}><Icon size={20} /></span>
                <span><h2 id={`tool-category-${category.id}`}>{category.label}</h2><p>{category.description}</p></span>
                <b>{t("common:format.tools", { count: categoryTools.length })}</b>
              </header>
              <div className="tool-grid all-tools-grid">
                {categoryTools.map((tool) => <ToolCard key={tool.id} tool={tool} />)}
              </div>
            </section>
          );
        })}
      </div>

      {!visibleToolCount && <div className="empty-search"><Search size={25} /><strong>{t("tools:index.emptyTitle")}</strong><span>{t("tools:index.emptyDescription")}</span></div>}
    </div>
  );
}

const categoryActiveClasses = {
  green: "bg-green-700",
  blue: "bg-blue-700",
  violet: "bg-violet-700",
  orange: "bg-orange-700",
  pink: "bg-pink-700",
  sky: "bg-sky-700",
} satisfies Record<ToolAccent, string>;

const categoryIconClasses = {
  green: "bg-green-100 text-green-700 dark:bg-green-950/70 dark:text-green-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-950/70 dark:text-orange-300",
  pink: "bg-pink-100 text-pink-700 dark:bg-pink-950/70 dark:text-pink-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300",
} satisfies Record<ToolAccent, string>;

function isToolCategory(value: string | null): value is ToolCategoryId {
  return ["documents", "media", "text-data", "work", "security-share"].includes(value ?? "");
}
