import { useTranslation } from "react-i18next";

import { Card } from "./ui/card";

export interface GuideBlock {
  title: string;
  paragraphs?: string[];
  items?: string[];
}

export interface GuideFaq {
  question: string;
  answer: string;
}

export function ToolGuide({ title, description, blocks, faq }: {
  title: string;
  description: string;
  blocks: GuideBlock[];
  faq: GuideFaq[];
}) {
  const { t } = useTranslation("common");
  return (
    <Card as="section" className="tool-guide gap-0 overflow-visible rounded-none bg-transparent py-0 shadow-none ring-0" aria-labelledby="tool-guide-title">
      <div className="content-heading">
        <div><p className="eyebrow text-muted-foreground">{t("guide.eyebrow")}</p><h2 id="tool-guide-title">{title}</h2><p>{description}</p></div>
      </div>
      <div className="tool-guide-grid">
        {blocks.map((block) => (
          <Card as="article" size="sm" className="gap-2 rounded-3xl border p-5 py-5 shadow-sm ring-0" key={block.title}>
            <h3>{block.title}</h3>
            {block.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {block.items && <ul>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>}
          </Card>
        ))}
      </div>
      <div className="tool-faq">
        <h2>{t("guide.faq")}</h2>
        {faq.map((item) => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </Card>
  );
}
