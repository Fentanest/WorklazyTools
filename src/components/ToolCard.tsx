import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

import type { ToolDefinition } from "../app/toolRegistry";

interface ToolCardProps {
  tool: ToolDefinition;
  featured?: boolean;
}

export function ToolCard({ tool, featured = false }: ToolCardProps) {
  const Icon = tool.icon;

  return (
    <Link className={`tool-card accent-${tool.accent}${featured ? " featured" : ""}`} to={tool.path}>
      <div className="tool-card-top">
        <span className={`tool-icon accent-${tool.accent}`}><Icon size={29} /></span>
        <span className="card-arrow"><ArrowUpRight size={20} /></span>
      </div>
      <div className="tool-card-copy">
        <p className="eyebrow">{tool.eyebrow}</p>
        <h2>{tool.title}</h2>
        <p>{tool.description}</p>
      </div>
      <div className="tool-highlights">
        {tool.highlights.map((item) => {
          const HighlightIcon = item.icon;
          return <span key={item.label}><HighlightIcon size={14} /> {item.label}</span>;
        })}
      </div>
    </Link>
  );
}
