import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";

import { browserLanguage, getStoredLanguage, localizedPath, storeLanguage, type AppLanguage } from "../i18n/languages";

export function LanguageLandingPage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const storedLanguage = getStoredLanguage();
  const recommended = browserLanguage();

  if (storedLanguage) return <Navigate to={localizedPath(storedLanguage, "/")} replace />;

  const choose = (language: AppLanguage) => {
    storeLanguage(language);
    navigate(localizedPath(language, "/"));
  };

  return (
    <main className="language-landing page-enter">
      <section className="language-landing-card glass-panel">
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Worklazy Tools" />
        <span className="language-landing-icon"><Languages size={25} /></span>
        <p className="eyebrow">{t("landing.eyebrow")}</p>
        <h1><span>{t("landing.titlePrimary")}</span><span lang="ko">{t("landing.titleSecondary")}</span></h1>
        <p className="language-landing-description"><span>{t("landing.descriptionPrimary")}</span><span lang="ko">{t("landing.descriptionSecondary")}</span></p>
        <div className="language-landing-actions">
          <button type="button" className={recommended === "ko" ? "recommended" : ""} onClick={() => choose("ko")}>
            <strong>{t("landing.continueKo")}</strong>
            {recommended === "ko" && <small>{t("landing.recommended")}</small>}
          </button>
          <button type="button" className={recommended === "en" ? "recommended" : ""} onClick={() => choose("en")}>
            <strong>{t("landing.continueEn")}</strong>
            {recommended === "en" && <small>{t("landing.recommended")}</small>}
          </button>
        </div>
      </section>
    </main>
  );
}
