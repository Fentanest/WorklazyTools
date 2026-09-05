import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { CONSENT_EVENT, getPrivacyConsent, initializeGoogleConsentMode, setPrivacyConsent, type PrivacyConsent } from "./privacyConsent";
import { Button } from "./ui/button";

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
        <Button type="button" variant="outline" className="rounded-xl" onClick={() => setPrivacyConsent("denied")}>{t("consent.reject")}</Button>
        <Button type="button" className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90" data-testid="privacy-consent-accept" onClick={() => setPrivacyConsent("granted")}>{t("consent.accept")}</Button>
      </div>
    </aside>
  );
}
