import { Check, LockKeyhole, ServerOff } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PrivacyBannerProps {
  compact?: boolean;
}

export function PrivacyBanner({ compact = false }: PrivacyBannerProps) {
  const { t } = useTranslation("common");
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
        <p className="eyebrow success">{t("privacy.eyebrow")}</p>
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
