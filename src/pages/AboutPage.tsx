import { Github, Heart, LockKeyhole, Moon, ShieldCheck, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";

import { PageHeader, SectionCard } from "../components/ui";

export function AboutPage() {
  const { t } = useTranslation("pages");
  return (
    <div className="page standard-page page-enter">
      <PageHeader eyebrow="ABOUT" title={t("about.title")} description={t("about.description")} />

      <div className="about-grid">
        <section className="about-hero-card">
          <span className="about-icon"><ShieldCheck size={32} /></span>
          <div><p className="mb-2 text-sm font-extrabold tracking-[.14em] text-green-300">LOCAL FIRST</p><h2>{t("about.localTitle")}</h2><p>{t("about.localDescription")}</p></div>
        </section>
        <SectionCard title={t("about.privacyTitle")}>
          <div className="about-list">
            <div><LockKeyhole size={20} /><span><strong>{t("about.items.uploadTitle")}</strong><small>{t("about.items.uploadDescription")}</small></span></div>
            <div><Heart size={20} /><span><strong>{t("about.items.accountTitle")}</strong><small>{t("about.items.accountDescription")}</small></span></div>
            <div><Github size={20} /><span><strong>{t("about.items.transparentTitle")}</strong><small>{t("about.items.transparentDescription")}</small></span></div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title={t("about.appearanceTitle")} description={t("about.appearanceDescription")}>
        <div className="appearance-preview">
          <span><Sun size={18} /> {t("about.light")}</span><i /><span><Moon size={18} /> {t("about.dark")}</span>
        </div>
      </SectionCard>
    </div>
  );
}
