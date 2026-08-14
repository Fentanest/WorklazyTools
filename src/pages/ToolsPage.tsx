import { LayoutGrid, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { type ToolCategoryId } from "../app/toolRegistry";
import { PrivacyBanner } from "../components/PrivacyBanner";
import { ToolCard } from "../components/ToolCard";
import { PageHeader } from "../components/ui";
import { useToolCatalog } from "../i18n/useToolCatalog";

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
    .filter((group) => group.tools.length > 0), [activeCategory, normalizedQuery]);

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
        <button type="button" className={activeCategory === "all" ? "selected" : ""} aria-pressed={activeCategory === "all"} onClick={() => selectCategory("all")}>
          <LayoutGrid size={17} /><span>{t("tools:index.all")}</span><small>{tools.length}</small>
        </button>
        {toolCategories.map((category) => {
          const Icon = category.icon;
          const count = tools.filter((tool) => tool.category === category.id).length;
          return (
            <button
              type="button"
              className={`accent-${category.accent}${activeCategory === category.id ? " selected" : ""}`}
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
                <span className={`tool-category-icon accent-${category.accent}`}><Icon size={20} /></span>
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

function isToolCategory(value: string | null): value is ToolCategoryId {
  return ["documents", "media", "text-data", "work", "security-share"].includes(value ?? "");
}
