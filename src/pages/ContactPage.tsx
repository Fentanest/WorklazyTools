import { Bug, ExternalLink, Lightbulb, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "../components/ui";

const GITHUB_ISSUES = "https://github.com/Fentanest/WorklazyTools/issues";

export function ContactPage() {
  const { t } = useTranslation("pages");
  const reportItems = t("contact.reportItems", { returnObjects: true }) as string[];
  return (
    <div className="page standard-page page-enter content-page">
      <PageHeader eyebrow="CONTACT" title={t("contact.title")} description={t("contact.description")} />

      <section className="contact-card">
        <div className="contact-icon"><Bug size={27} /></div>
        <div>
          <p className="eyebrow">GITHUB</p>
          <h2>{t("contact.githubTitle")}</h2>
          <p>{t("contact.githubDescription")}</p>
          <a className="secondary-button" href={GITHUB_ISSUES} target="_blank" rel="noreferrer">{t("contact.githubAction")} <ExternalLink size={15} /></a>
        </div>
      </section>

      <div className="contact-grid">
        <section className="prose-card compact-prose">
          <Lightbulb size={21} />
          <h2>{t("contact.ideaTitle")}</h2>
          <p>{t("contact.ideaDescription")}</p>
        </section>
        <section className="prose-card compact-prose">
          <ShieldCheck size={21} />
          <h2>{t("contact.privacyTitle")}</h2>
          <p>{t("contact.privacyDescription")}</p>
        </section>
      </div>

      <article className="prose-card">
        <h2>{t("contact.reportTitle")}</h2>
        <ol>
          {reportItems.map((item) => <li key={item}>{item}</li>)}
        </ol>
      </article>
    </div>
  );
}
