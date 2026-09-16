import { ArrowRight, Download, ExternalLink, FileUp, LockKeyhole, MessageSquarePlus, ScanSearch, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { ToolCard } from "../components/ToolCard";
import { GITHUB_ISSUES_URL } from "../constants/links";
import { useWorklazyTheme } from "../hooks/useWorklazyTheme";
import { localizedPath } from "../i18n/languages";
import { useAppLanguage } from "../i18n/routing";
import { useToolCatalog } from "../i18n/useToolCatalog";
import { cn } from "../lib/utils";

const HOME_TOOL_IDS_KO = [
  "pdf-editor",
  "excel-merger",
  "excel-compare",
  "excel-cleaner",
  "image-studio",
  "document-redactor",
  "document-compare",
  "hwp-editor",
  "text-tools",
  "qr-studio",
  "video-studio",
] as const;

const HOME_TOOL_IDS_EN = [
  "pdf-editor",
  "excel-merger",
  "excel-compare",
  "excel-cleaner",
  "image-studio",
  "document-redactor",
  "document-compare",
  "office-editor",
  "text-tools",
  "qr-studio",
  "video-studio",
] as const;

export function HomePage() {
  const { t } = useTranslation("common");
  const language = useAppLanguage();
  const { tools } = useToolCatalog();
  const { theme } = useWorklazyTheme();
  
  const heroArt = `${import.meta.env.BASE_URL}${theme.includes("mint") ? "hero-mint.png" : "hero-coral.png"}`;
  
  const targetIds = language === "ko" ? HOME_TOOL_IDS_KO : HOME_TOOL_IDS_EN;
  const featuredTools = targetIds
    .map((id) => tools.find((tool) => tool.id === id))
    .filter((tool): tool is NonNullable<typeof tool> => Boolean(tool));

  return (
    <div className="page home-page page-enter">
      <section className="wl-hero">
        <div className="wl-hero-copy">
          <span className="wl-hero-badge"><Sparkles size={15} /> {t("home.kicker")}</span>
          <h1>{t("home.titleBefore")} <span className="wl-accent">{t("home.titleAccent")}</span></h1>
          <p>{t("home.description")}</p>
          <div className="wl-hero-actions">
            <Link className="wl-cta" to={localizedPath(language, "/tools")}>{t("home.browse")} <ArrowRight size={18} /></Link>
            <div className="wl-hero-assure">
              <LockKeyhole size={18} />
              <span><strong>{t("home.noUploadTitle")}</strong><small>{t("home.noUploadBody")}</small></span>
            </div>
          </div>
          <div className="wl-hero-note">
            <MessageSquarePlus size={16} />
            <span>{t("home.feedback.description")}</span>
            <a href={GITHUB_ISSUES_URL} target="_blank" rel="noreferrer">{t("home.feedback.action")} <ExternalLink size={13} /></a>
          </div>
        </div>
        <div className="wl-hero-art">
          <img src={heroArt} alt="" aria-hidden="true" loading="eager" />
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-head">
          <div>
            <h2>{t("home.availableTitle")}</h2>
            <p>{t("home.availableSubtitle")}</p>
          </div>
          <Link className="home-section-link" to={localizedPath(language, "/tools")}>{t("actions.viewAll")} <ArrowRight size={16} /></Link>
        </div>
        <div className="tool-grid">
          {featuredTools.map((tool) => <ToolCard key={tool.id} tool={tool} featured />)}
          <Link to={localizedPath(language, "/tools")} className="ui-tool-card flex h-full flex-col justify-between hover:bg-muted/50 transition-colors">
            <div className="ui-tool-card-top flex items-center justify-between w-full">
              <span className="grid place-items-center rounded-2xl" style={{ width: 46, height: 46, color: "var(--brand-on-bg)", background: "var(--brand-soft)" }}>
                <ArrowRight size={24} aria-hidden="true" />
              </span>
            </div>
            <div className="ui-tool-card-copy">
              <h2>{language === "ko" ? "전체 도구 보기" : "View All Tools"}</h2>
              <p>{language === "ko" ? "문서·이미지·텍스트·계산 등 모든 도구를 살펴보세요." : "Browse all tools for documents, media, text, and calculations."}</p>
            </div>
          </Link>
        </div>
      </section>

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
