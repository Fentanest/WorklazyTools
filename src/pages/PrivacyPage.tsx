import { FileLock2, Globe2, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "../components/ui";

interface PolicySection { title: string; paragraphs: string[]; items?: string[] }

export function PrivacyPage() {
  const { t } = useTranslation("pages");
  const sections = t("privacy.sections", { returnObjects: true }) as PolicySection[];
  return (
    <div className="page standard-page page-enter content-page">
      <PageHeader eyebrow="PRIVACY" title={t("privacy.title")} description={t("privacy.description")} />
      <div className="policy-summary"><ShieldCheck size={25} /><div><strong>{t("privacy.principleTitle")}</strong><p>{t("privacy.principle")}</p></div></div>
      <article className="prose-card">
        <p className="policy-date">{t("privacy.date")}</p>
        {sections.map((section) => <section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.items && <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}</section>)}
      </article>
      <div className="content-callouts">
        <div><FileLock2 size={20} /><span><strong>{t("privacy.localTitle")}</strong><small>{t("privacy.localText")}</small></span></div>
        <div><Globe2 size={20} /><span><strong>{t("privacy.networkTitle")}</strong><small>{t("privacy.networkText")}</small></span></div>
      </div>
    </div>
  );
}
