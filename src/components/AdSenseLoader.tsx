import { useEffect } from "react";

const ADSENSE_CLIENT = "ca-pub-8940087269746960";

export function AdSenseLoader() {
  useEffect(() => {
    if (!import.meta.env.PROD || document.querySelector("script[data-worklazy-adsense]")) return;
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.worklazyAdsense = "true";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
    document.head.appendChild(script);
  }, []);

  return null;
}
