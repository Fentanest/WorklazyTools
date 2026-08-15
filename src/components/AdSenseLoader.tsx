import { useEffect, useState } from "react";

import { CONSENT_EVENT, getPrivacyConsent, type PrivacyConsent } from "./privacyConsent";

const ADSENSE_CLIENT = "ca-pub-8940087269746960";

export function AdSenseLoader() {
  const [consent, setConsent] = useState<PrivacyConsent>(() => getPrivacyConsent());
  useEffect(() => {
    const handleConsent = (event: Event) => setConsent((event as CustomEvent<PrivacyConsent>).detail);
    window.addEventListener(CONSENT_EVENT, handleConsent);
    return () => window.removeEventListener(CONSENT_EVENT, handleConsent);
  }, []);
  useEffect(() => {
    if (!import.meta.env.PROD || consent !== "granted" || document.querySelector("script[data-worklazy-adsense]")) return;
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.worklazyAdsense = "true";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
    document.head.appendChild(script);
  }, [consent]);

  return null;
}
