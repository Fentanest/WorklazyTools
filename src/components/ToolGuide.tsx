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
    <section className="tool-guide" aria-labelledby="tool-guide-title">
      <div className="content-heading">
        <div><p className="eyebrow">GUIDE</p><h2 id="tool-guide-title">{title}</h2><p>{description}</p></div>
      </div>
      <div className="tool-guide-grid">
        {blocks.map((block) => (
          <article key={block.title}>
            <h3>{block.title}</h3>
            {block.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {block.items && <ul>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>}
          </article>
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
    </section>
  );
}
import { useTranslation } from "react-i18next";
