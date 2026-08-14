import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "../components/ui";

interface TermsSection { title: string; paragraphs: string[]; items?: string[] }

export function TermsPage() {
  const { t } = useTranslation("pages");
  const sections = t("terms.sections", { returnObjects: true }) as TermsSection[];
  return (
    <div className="page standard-page page-enter content-page">
      <PageHeader eyebrow="TERMS" title={t("terms.title")} description={t("terms.description")} />
      <article className="prose-card">
        <p className="policy-date">{t("terms.date")}</p>
        {sections.map((section) => <section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.items && <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}</section>)}
      </article>
      <div className="content-callouts">
        <div><CheckCircle2 size={20} /><span><strong>{t("terms.backupTitle")}</strong><small>{t("terms.backupText")}</small></span></div>
        <div><AlertTriangle size={20} /><span><strong>{t("terms.verifyTitle")}</strong><small>{t("terms.verifyText")}</small></span></div>
      </div>
    </div>
  );
}
