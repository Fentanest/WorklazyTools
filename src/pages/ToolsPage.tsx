import { LayoutGrid, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { toolCategories, tools, type ToolCategoryId } from "../app/toolRegistry";
import { PrivacyBanner } from "../components/PrivacyBanner";
import { ToolCard } from "../components/ToolCard";
import { PageHeader } from "../components/ui";

type CategoryFilter = "all" | ToolCategoryId;

export function ToolsPage() {
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
      <PageHeader eyebrow="ALL TOOLS" title="모든 도구" description="업무 목적에 맞는 카테고리를 고르거나 필요한 기능을 검색하세요." />
      <div className="tool-search">
        <Search size={19} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="도구 이름이나 기능 검색" aria-label="도구 검색" />
        {normalizedQuery && <span className="tool-search-count">{visibleToolCount}개</span>}
      </div>

      <div className="tool-category-filter" aria-label="도구 카테고리">
        <button type="button" className={activeCategory === "all" ? "selected" : ""} aria-pressed={activeCategory === "all"} onClick={() => selectCategory("all")}>
          <LayoutGrid size={17} /><span>전체</span><small>{tools.length}</small>
        </button>
        {toolCategories.map((category) => {
          const Icon = category.icon;
          const count = tools.filter((tool) => tool.category === category.id).length;
          return (
            <button
              type="button"
              className={`accent-${category.accent}${activeCategory === category.id ? " selected" : ""}`}
              aria-label={`${category.label} ${count}개 도구`}
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
                <b>{categoryTools.length}개 도구</b>
              </header>
              <div className="tool-grid all-tools-grid">
                {categoryTools.map((tool) => <ToolCard key={tool.id} tool={tool} />)}
              </div>
            </section>
          );
        })}
      </div>

      {!visibleToolCount && <div className="empty-search"><Search size={25} /><strong>일치하는 도구가 없어요.</strong><span>다른 검색어나 카테고리를 선택해 보세요.</span></div>}
    </div>
  );
}

function isToolCategory(value: string | null): value is ToolCategoryId {
  return toolCategories.some((category) => category.id === value);
}
