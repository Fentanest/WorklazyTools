import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

import type { ToolAccent, ToolDefinition } from "../app/toolRegistry";
import { toolCategories } from "../app/toolRegistry";
import { useAppLanguage } from "../i18n/routing";
import { cn } from "../lib/utils";
import { trackToolOpen } from "./AnalyticsLoader";
import { toolIconAccentClasses } from "./toolAccentStyles";
import { Card } from "./ui/card";

interface ToolCardProps {
  tool: ToolDefinition;
  featured?: boolean;
}

const FALLBACK_ACCENT: ToolAccent = "blue";

export function ToolCard({ tool, featured = false }: ToolCardProps) {
  const Icon = tool.icon;
  const language = useAppLanguage();
  // Single category mapping: the card inherits its category color, never a
  // per-tool accent.
  const accent = toolCategories.find((category) => category.id === tool.category)?.accent ?? FALLBACK_ACCENT;

  return (
    <Card
      as={Link}
      data-ui-component="tool-card"
      className={cn(`ui-tool-card ui-accent-${accent}${featured ? " ui-featured" : ""}`, "gap-0 rounded-2xl border bg-card p-5 py-5 shadow-sm ring-0")}
      to={tool.path}
      onClick={() => trackToolOpen(tool.id, featured ? "home_card" : "tools_card", language)}
    >
      <div className="ui-tool-card-top">
        <span className={cn("grid size-12 place-items-center rounded-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,.65)]", toolIconAccentClasses[accent])} data-accent={accent} aria-hidden="true"><Icon size={29} /></span>
        <span className="ui-card-arrow" aria-hidden="true"><ArrowUpRight size={20} /></span>
      </div>
      <div className="ui-tool-card-copy">
        <p className="mb-2 text-sm font-extrabold tracking-[.14em] text-muted-foreground">{tool.eyebrow}</p>
        <h3>{tool.title}</h3>
        <p>{tool.description}</p>
      </div>
      <div className="ui-tool-highlights">
        {tool.highlights.slice(0, 3).map((item) => {
          const HighlightIcon = item.icon;
          return <span key={item.label}><HighlightIcon size={14} aria-hidden="true" /> {item.label}</span>;
        })}
      </div>
    </Card>
  );
}
