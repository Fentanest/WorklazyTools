import { ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { CONSENT_EVENT, getPrivacyConsent, initializeGoogleConsentMode, setPrivacyConsent, type PrivacyConsent } from "./privacyConsent";
import { Button } from "./ui/button";

export function PrivacyConsentBanner() {
  const { t } = useTranslation("common");
  const [consent, setConsent] = useState<PrivacyConsent>(() => getPrivacyConsent());
  const bannerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    initializeGoogleConsentMode();
    const handleChange = (event: Event) => setConsent((event as CustomEvent<PrivacyConsent>).detail);
    window.addEventListener(CONSENT_EVENT, handleChange);
    return () => window.removeEventListener(CONSENT_EVENT, handleChange);
  }, []);

  // Reserve content space while the fixed banner is visible so it never
  // covers tool cards or the footer. The height is measured live because the
  // banner wraps differently per viewport and language.
  useEffect(() => {
    if (consent !== "unset") return;
    const update = () => {
      const height = bannerRef.current?.offsetHeight ?? 0;
      if (height > 0) {
        document.body.setAttribute("data-consent-banner", "visible");
        document.documentElement.style.setProperty("--consent-banner-height", `${Math.ceil(height) + 24}px`);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      document.body.removeAttribute("data-consent-banner");
      document.documentElement.style.removeProperty("--consent-banner-height");
    };
  }, [consent]);

  if (consent !== "unset") return null;
  return (
    <aside ref={bannerRef} className="privacy-consent glass-panel" aria-labelledby="privacy-consent-title">
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
