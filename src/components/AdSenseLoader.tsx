import { useEffect, useLayoutEffect, useState } from "react";
import { isThirdPartyBlockedForQa } from "./localQa";
import { isAdIneligible } from "../app/adEligibility";

const ADSENSE_CLIENT = "ca-pub-8940087269746960";

declare global {
  interface Window { adsbygoogle?: unknown[] & { pauseAdRequests?: number }; }
}

export function AdSenseLoader({ ready, terminalIneligible = false }: { ready: boolean; terminalIneligible?: boolean }) {
  const [ineligible, setIneligible] = useState(() => isAdIneligible());

  useEffect(() => {
    const handleEligibility = () => setIneligible(isAdIneligible());
    // Reconcile on subscribe: routePending is set in a layout effect, so the
    // dispatch can fire before this passive subscription attaches. Without
    // this, a missed "pending" event leaves stale local state on lazy routes.
    handleEligibility();
    window.addEventListener("wl-ad-eligibility-changed", handleEligibility);
    return () => window.removeEventListener("wl-ad-eligibility-changed", handleEligibility);
  }, []);

  useLayoutEffect(() => {
    const script = document.querySelector("script[data-worklazy-adsense]");
    if (!script) return;
    // Google's documented request pause prevents new Auto Ads requests while
    // a route is still preparing. It does not remove an already-rendered ad.
    const queue = (window.adsbygoogle ??= []);
    queue.pauseAdRequests = ready && !ineligible && !isAdIneligible() ? 0 : 1;
    if (terminalIneligible) window.location.replace(window.location.href);
  }, [ready, ineligible, terminalIneligible]);

  useEffect(() => {
    if (!import.meta.env.PROD || isThirdPartyBlockedForQa() || !ready || ineligible || isAdIneligible() || document.querySelector("script[data-worklazy-adsense]")) return;
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.worklazyAdsense = "true";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
    document.head.appendChild(script);
  }, [ineligible, ready]);

  return null;
}
