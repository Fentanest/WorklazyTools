import { ArrowRight, Download, ExternalLink, FileUp, LockKeyhole, MessageSquarePlus, ScanSearch, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { PrivacyBanner } from "../components/PrivacyBanner";
import { ToolCard } from "../components/ToolCard";
import { GITHUB_ISSUES_URL } from "../constants/links";
import { localizedPath } from "../i18n/languages";
import { useAppLanguage } from "../i18n/routing";
import { useToolCatalog } from "../i18n/useToolCatalog";

export function HomePage() {
  const { t } = useTranslation("common");
  const language = useAppLanguage();
  const { tools } = useToolCatalog();
  return (
    <div className="page home-page page-enter">
      <section className="hero compact-home-hero">
        <div className="hero-content">
          <div className="hero-kicker"><Sparkles size={16} /> {t("home.kicker")}</div>
          <h1>{t("home.titleBefore")} <span>{t("home.titleAccent")}</span></h1>
          <p>{t("home.description")}</p>
          <div className="hero-actions">
            <Link className="primary-link" to={localizedPath(language, "/tools")}>{t("home.browse")} <ArrowRight size={18} /></Link>
            <div className="hero-trust"><LockKeyhole size={16} /> {t("home.noUpload")}</div>
          </div>
          <div className="hero-feedback">
            <MessageSquarePlus size={17} />
            <span>{t("home.feedback.description")}</span>
            <a href={GITHUB_ISSUES_URL} target="_blank" rel="noreferrer">{t("home.feedback.action")} <ExternalLink size={14} /></a>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="mb-[17px] flex items-end justify-between px-[5px]">
          <div><p className="mb-2 text-sm font-extrabold tracking-[.14em] text-muted-foreground">TOOLS</p><h2 className="m-0 text-[25px] font-bold tracking-[-.045em]">{t("home.availableTitle")}</h2></div>
          <Link className="flex items-center gap-1.5 text-[15px] font-bold text-primary" to={localizedPath(language, "/tools")}>{t("actions.viewAll")} <ArrowRight size={16} /></Link>
        </div>
        <div className="tool-grid">
          {tools.map((tool) => <ToolCard key={tool.id} tool={tool} featured />)}
        </div>
      </section>

      <PrivacyBanner />

      <section className="home-how">
        <div className="mb-[17px] flex items-end justify-between px-[5px]"><div><p className="mb-2 text-sm font-extrabold tracking-[.14em] text-muted-foreground">HOW IT WORKS</p><h2 className="m-0 text-[25px] font-bold tracking-[-.045em]">{t("home.howTitle")}</h2></div></div>
        <div className="home-how-grid">
          <div><span><FileUp size={20} /></span><strong>{t("home.steps.selectTitle")}</strong><p>{t("home.steps.selectDescription")}</p></div>
          <div><span><ScanSearch size={20} /></span><strong>{t("home.steps.processTitle")}</strong><p>{t("home.steps.processDescription")}</p></div>
          <div><span><Download size={20} /></span><strong>{t("home.steps.saveTitle")}</strong><p>{t("home.steps.saveDescription")}</p></div>
        </div>
      </section>

    </div>
  );
}
