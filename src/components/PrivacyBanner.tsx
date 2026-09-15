import { Check, LockKeyhole, ServerOff } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PrivacyBannerProps {
  compact?: boolean;
  card?: boolean;
}

export function PrivacyBanner({ compact = false, card = false }: PrivacyBannerProps) {
  const { t } = useTranslation("common");
  if (card) {
    // Last card of the home tool grid: informative but non-interactive, and
    // never counted as a tool.
    return (
      <article className="ui-tool-card ui-privacy-card" aria-label={t("privacy.eyebrow")}>
        <div className="ui-tool-card-top">
          <span className="privacy-card-icon" aria-hidden="true"><ServerOff size={25} /></span>
        </div>
        <div className="ui-tool-card-copy">
          <p className="mb-2 text-sm font-extrabold tracking-[.14em] text-muted-foreground">{t("privacy.eyebrow")}</p>
          <h3>{t("privacy.title")}</h3>
          <p>{t("privacy.description")}</p>
        </div>
        <div className="ui-tool-highlights">
          <span><Check size={14} aria-hidden="true" /> {t("privacy.local")}</span>
          <span><Check size={14} aria-hidden="true" /> {t("privacy.removed")}</span>
        </div>
      </article>
    );
  }
  if (compact) {
    return (
      <div className="privacy-inline">
        <LockKeyhole size={15} />
        <span>{t("privacy.compact")}</span>
      </div>
    );
  }

  return (
    <section className="privacy-banner" aria-label={t("privacy.eyebrow")}>
      <div className="privacy-icon"><ServerOff size={25} /></div>
      <div className="privacy-copy">
        <p className="mb-2 text-sm font-extrabold tracking-[.14em] text-green-700 dark:text-green-300">{t("privacy.eyebrow")}</p>
        <h2>{t("privacy.title")}</h2>
        <p>{t("privacy.description")}</p>
      </div>
      <div className="privacy-points" aria-hidden="true">
        <span><Check size={14} /> {t("privacy.local")}</span>
        <span><Check size={14} /> {t("privacy.removed")}</span>
      </div>
    </section>
  );
}
