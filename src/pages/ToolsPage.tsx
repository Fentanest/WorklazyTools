import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { tools } from "../app/toolRegistry";
import { PrivacyBanner } from "../components/PrivacyBanner";
import { ToolCard } from "../components/ToolCard";
import { PageHeader } from "../components/ui";

export function ToolsPage() {
  const [query, setQuery] = useState("");
  const filteredTools = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return tools;
    return tools.filter((tool) => `${tool.title} ${tool.description} ${tool.eyebrow}`.toLowerCase().includes(normalized));
  }, [query]);

  return (
    <div className="page standard-page page-enter">
      <PageHeader eyebrow="ALL TOOLS" title="모든 도구" description="반복되는 업무를 더 가볍게 만들어 줄 도구를 골라보세요." />
      <div className="tool-search">
        <Search size={19} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="필요한 도구 검색" aria-label="도구 검색" />
      </div>
      <PrivacyBanner compact />
      <div className="tool-grid all-tools-grid">
        {filteredTools.map((tool) => <ToolCard key={tool.id} tool={tool} />)}
      </div>
      {!filteredTools.length && <div className="empty-search"><Search size={25} /><strong>일치하는 도구가 없어요.</strong><span>다른 검색어를 입력해 보세요.</span></div>}
    </div>
  );
}
