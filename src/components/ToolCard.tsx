import { ArrowRight, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { personalization, usePersonalization } from "../app/personalization";

import type { ToolDefinition } from "../app/toolRegistry";
import { useAppLanguage } from "../i18n/routing";
import { cn } from "../lib/utils";
import { trackToolOpen } from "./AnalyticsLoader";
import { getToolIconTone } from "./toolAccentStyles";
import { Card } from "./ui/card";

interface ToolCardProps {
  tool: ToolDefinition & { tagline?: string };
  featured?: boolean;
}

export function ToolCard({ tool, featured = false }: ToolCardProps) {
  const Icon = tool.icon;
  const language = useAppLanguage();

  return (
    <div className="relative h-full">
    <Card
      as={Link}
      data-ui-component="tool-card"
      className={cn(`group ui-tool-card ui-accent-${tool.accent}${featured ? " ui-featured" : ""}`, "h-full gap-0 border bg-card p-5 py-5 shadow-md ring-0")}
      to={tool.path}
      onClick={() => trackToolOpen(tool.id, featured ? "home_card" : "tools_card", language)}
    >
      <div className="ui-tool-card-top pr-12">
        <span className={cn("grid place-items-center rounded-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,.65)] tone-icon-badge")} data-icon-tone={getToolIconTone(tool.id)}><Icon size={24} /></span>
        <span className="ui-card-arrow"><ArrowRight size={18} /></span>
      </div>
      <div className="ui-tool-card-copy">
        {!featured && <p className="mb-2 text-sm font-extrabold tracking-[.14em] text-muted-foreground">{tool.eyebrow}</p>}
        <h2>{tool.title}</h2>
        <p data-testid="tool-tagline">{tool.tagline ?? tool.description}</p>
      </div>
      <div className="ui-tool-highlights">
        {tool.highlights.slice(0, 3).map((item) => {
          const HighlightIcon = item.icon;
          return <span key={item.label}><HighlightIcon size={13} /> {item.label}</span>;
        })}
      </div>
    </Card>
    <FavoriteToolButton tool={tool} />
    </div>
  );
}

/** A sibling of the navigation link so keyboard and pointer toggles never navigate. */
export function FavoriteToolButton({ tool, list = false }: { tool: Pick<ToolDefinition, "id" | "title">; list?: boolean }) {
  const { t } = useTranslation("common");
  const { favorites, favoritesEnabled } = usePersonalization();
  const selected = favorites.includes(tool.id);
  const label = t(selected ? "personalization.removeFavorite" : "personalization.addFavorite", { tool: tool.title });
  return <button type="button" data-favorite-tool={tool.id} aria-pressed={selected} aria-label={label} title={favoritesEnabled ? label : t("personalization.unavailable")}
    disabled={!favoritesEnabled} onClick={() => personalization.toggle(tool.id)}
    className={cn("absolute right-3 z-10 grid size-11 place-items-center rounded-xl border-0 bg-transparent text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-on-bg)] disabled:opacity-40", list ? "top-1/2 -translate-y-1/2" : "top-3")}
    style={selected ? { color: "var(--brand-on-bg)" } : undefined}>
    <Star size={18} fill={selected ? "currentColor" : "none"} aria-hidden="true" />
  </button>;
}
