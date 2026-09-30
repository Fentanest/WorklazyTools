import { useEffect, useRef, useState } from "react";

import { isAdIneligible } from "../app/adEligibility";
import { stripSiteBasePath } from "../app/siteBasePath";
import { isThirdPartyBlockedForQa } from "./localQa";

// With the desktop sidebar and page padding, a 740px banner needs at least
// 1076px of viewport width. Use the smaller variant below that threshold.
const MOBILE_BANNER_QUERY = "(max-width: 1075px)";
const DISCLOSURE_KO = "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";
const DISCLOSURE_EN = "This page includes Coupang Partners affiliate ads. We may earn a commission from purchases made through them.";
const WIDGET_FAILED_MESSAGE = "worklazy:coupang-widget-failed";

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
  const document = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><style>html,body{margin:0;padding:0;overflow:hidden}</style></head><body><script src="https://ads-partners.coupang.com/g.js"></script><script>try{if(window.PartnersCoupang?.G)new PartnersCoupang.G({"id":1034218,"template":"carousel","trackingCode":"AF9752254","width":"${width}","height":"${height}","tsource":""});else parent.postMessage("${WIDGET_FAILED_MESSAGE}","*")}catch{parent.postMessage("${WIDGET_FAILED_MESSAGE}","*")}</script></body></html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(document)}`;
}

export function CoupangBanner({ routeKey }: { routeKey: string }) {
  const [ineligible, setIneligible] = useState(() => isAdIneligible());
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_BANNER_QUERY).matches);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const size = mobile ? "mobile" : "desktop";
  const frameKey = `${routeKey}:${size}`;

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source === frameRef.current?.contentWindow && event.data === WIDGET_FAILED_MESSAGE) setFailedKey(frameKey);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [frameKey]);

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

  if (!import.meta.env.PROD || isThirdPartyBlockedForQa() || ineligible || isAdIneligible() || failedKey === frameKey) return null;

  const direct = /\/tools\/(?:document-redactor|office-editor\/app|excel-merger\/xls-preserve)\/?$/.test(routeKey);
  const english = /^\/en(?:\/|$)/.test(stripSiteBasePath(window.location.pathname, import.meta.env.BASE_URL) ?? "");
  return (
    <section className="coupang-banner" aria-label={english ? "Coupang Partners advertisement" : "쿠팡 파트너스 광고"}>
      <iframe
        ref={frameRef}
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
        onError={() => setFailedKey(frameKey)}
      />
      <p className="coupang-banner-disclosure" tabIndex={0}>{english ? DISCLOSURE_EN : DISCLOSURE_KO}</p>
    </section>
  );
}
