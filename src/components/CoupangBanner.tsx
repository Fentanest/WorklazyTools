import { useEffect, useState } from "react";

import { isAdIneligible } from "../app/adEligibility";
import { CONSENT_EVENT, getPrivacyConsent, type PrivacyConsent } from "./privacyConsent";
import { isLocalQaBuild } from "./localQa";

// With the desktop sidebar and page padding, a 740px banner needs at least
// 1076px of viewport width. Use the smaller variant below that threshold.
const MOBILE_BANNER_QUERY = "(max-width: 1075px)";
const DISCLOSURE_KO = "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";
const DISCLOSURE_EN = "This page includes Coupang Partners affiliate ads. We may earn a commission from purchases made through them.";

function bannerSource(size: "mobile" | "desktop", direct: boolean) {
  const width = size === "mobile" ? 280 : 740;
  const height = size === "mobile" ? 160 : 180;
  // The redactor's strict CSP and the Office/XLS require-corp documents cannot
  // run the loader. Use its cross-origin widget URL there. Elsewhere, run the
  // documented loader in an opaque-origin frame, apart from editor files.
  if (direct) {
    const params = new URLSearchParams({
      id: "1034218", template: "carousel", trackingCode: "AF9752254",
      width: String(width), height: String(height), tsource: "", rUrl: "", tag: "js",
    });
    return `https://ads-partners.coupang.com/widgets.html?${params}`;
  }
  const document = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><style>html,body{margin:0;padding:0;overflow:hidden}</style></head><body><script src="https://ads-partners.coupang.com/g.js"></script><script>if(window.PartnersCoupang?.G)new PartnersCoupang.G({"id":1034218,"template":"carousel","trackingCode":"AF9752254","width":"${width}","height":"${height}","tsource":""});</script></body></html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(document)}`;
}

export function CoupangBanner({ routeKey }: { routeKey: string }) {
  const [consent, setConsent] = useState<PrivacyConsent>(() => getPrivacyConsent());
  const [ineligible, setIneligible] = useState(() => isAdIneligible());
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_BANNER_QUERY).matches);

  useEffect(() => {
    const onConsent = (event: Event) => setConsent((event as CustomEvent<PrivacyConsent>).detail);
    window.addEventListener(CONSENT_EVENT, onConsent);
    setConsent(getPrivacyConsent());
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);

  useEffect(() => {
    const update = () => setIneligible(isAdIneligible());
    update();
    window.addEventListener("wl-ad-eligibility-changed", update);
    return () => window.removeEventListener("wl-ad-eligibility-changed", update);
  }, []);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_BANNER_QUERY);
    const update = () => setMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  if (!import.meta.env.PROD || isLocalQaBuild || consent !== "granted" || ineligible || isAdIneligible()) return null;

  const size = mobile ? "mobile" : "desktop";
  const direct = /\/tools\/(?:document-redactor|office-editor\/app|excel-merger\/xls-preserve)\/?$/.test(routeKey);
  const english = /^\/en(?:\/|$)/.test(window.location.pathname);
  return (
    <section className="coupang-banner" aria-label={english ? "Coupang Partners advertisement" : "쿠팡 파트너스 광고"}>
      <iframe
        {...({ credentialless: "" } as { credentialless: string })}
        key={`${routeKey}:${size}`}
        title={english ? "Coupang Partners advertisement" : "쿠팡 파트너스 광고"}
        src={bannerSource(size, direct)}
        className="coupang-banner-frame"
        width={mobile ? 280 : 740}
        height={mobile ? 160 : 180}
        loading="lazy"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      />
      <p className="coupang-banner-disclosure" tabIndex={0}>{english ? DISCLOSURE_EN : DISCLOSURE_KO}</p>
    </section>
  );
}
