import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { CONSENT_EVENT, getPrivacyConsent, initializeGoogleConsentMode, setPrivacyConsent, type PrivacyConsent } from "./privacyConsent";

export function PrivacyConsentBanner() {
  const { t } = useTranslation("common");
  const [consent, setConsent] = useState<PrivacyConsent>(() => getPrivacyConsent());

  useEffect(() => {
    initializeGoogleConsentMode();
    const handleChange = (event: Event) => setConsent((event as CustomEvent<PrivacyConsent>).detail);
    window.addEventListener(CONSENT_EVENT, handleChange);
    return () => window.removeEventListener(CONSENT_EVENT, handleChange);
  }, []);

  if (consent !== "unset") return null;
  return (
    <aside className="privacy-consent glass-panel" aria-labelledby="privacy-consent-title">
      <ShieldCheck size={22} />
      <div>
        <strong id="privacy-consent-title">{t("consent.title")}</strong>
        <p>{t("consent.description")}</p>
      </div>
      <div className="privacy-consent-actions">
        <button type="button" className="secondary-button" onClick={() => setPrivacyConsent("denied")}>{t("consent.reject")}</button>
        <button type="button" className="primary-button accent-blue" onClick={() => setPrivacyConsent("granted")}>{t("consent.accept")}</button>
      </div>
    </aside>
  );
}
