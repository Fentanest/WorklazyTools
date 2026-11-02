import { personalization, usePersonalization } from "../app/personalization";
import { FileLock2, Globe2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { clearRecipes } from "../features/excel-cleaner/recipeStore";
import { Button } from "../components/ui/button";
import { useTranslation } from "react-i18next";

import { PageHeader } from "../components/ui";

interface PolicySection { title: string; paragraphs: string[]; items?: string[] }

export function PrivacyPage() {
  const { t } = useTranslation("pages");
  const [clearStatus, setClearStatus] = useState<"ok" | "storage">();
  const personal = usePersonalization();
  const sections = t("privacy.sections", { returnObjects: true }) as PolicySection[];
  return (
    <div className="page standard-page page-enter content-page">
      <PageHeader eyebrow="PRIVACY" title={t("privacy.title")} description={t("privacy.description")} />
      <div className="policy-summary"><ShieldCheck size={25} /><div><strong>{t("privacy.principleTitle")}</strong><p>{t("privacy.principle")}</p></div></div>
      <article className="prose-card">
        <p className="policy-date">{t("privacy.date")}</p>
        {sections.map((section) => <section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.items && <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}</section>)}
        <section data-testid="privacy-personalization">
          <h2>{t("privacy.personalizationControls")}</h2>
          <div className="flex flex-wrap gap-2">{(["recent", "favorites"] as const).map(kind => <Button key={kind} type="button" variant="outline" disabled={!personal[`${kind}Enabled`] || !personal[kind].length} onClick={() => personalization.clear(kind)}>{t(`privacy.clear${kind === "recent" ? "Recent" : "Favorites"}`)}</Button>)}</div>
          {(!personal.recentEnabled || !personal.favoritesEnabled) && <p role="status">{t("privacy.personalizationUnavailable")}</p>}
        </section>
        <section data-testid="privacy-cleaner-recipes">
          <h2>{t("privacy.cleanerRecipes.title")}</h2>
          <p>{t("privacy.cleanerRecipes.description")}</p>
          <Button type="button" variant="outline" onClick={() => setClearStatus(clearRecipes().status === "ok" ? "ok" : "storage")}>{t("privacy.cleanerRecipes.clear")}</Button>
          {clearStatus && <p role="status">{t(`privacy.cleanerRecipes.${clearStatus}`)}</p>}
        </section>
        <section>
          <h2>{t("privacy.providerLinksTitle")}</h2>
          <p>{t("privacy.providerLinksDescription")}</p>
          <ul>
            <li><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">{t("privacy.googlePolicyLink")}</a></li>
            <li><a href="https://analytics.naver.com/" target="_blank" rel="noopener noreferrer">{t("privacy.naverPolicyLink")}</a></li>
            <li><a href="https://partners.coupang.com/" target="_blank" rel="noopener noreferrer">{t("privacy.coupangPolicyLink")}</a></li>
          </ul>
        </section>
      </article>
      <div className="content-callouts">
        <div><FileLock2 size={20} /><span><strong>{t("privacy.localTitle")}</strong><small>{t("privacy.localText")}</small></span></div>
        <div><Globe2 size={20} /><span><strong>{t("privacy.networkTitle")}</strong><small>{t("privacy.networkText")}</small></span></div>
      </div>
    </div>
  );
}
