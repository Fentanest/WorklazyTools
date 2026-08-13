import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { getCanonicalUrl, normalizeSeoPath, seoByPath } from "../app/seo";

const MANAGED_JSON_LD_ID = "worklazy-route-jsonld";

export function RouteSeo() {
  const location = useLocation();

  useEffect(() => {
    const path = normalizeSeoPath(location.pathname);
    const isTemporaryResult = path.startsWith("/tools/word-compare/results/");
    const seo = isTemporaryResult
      ? { ...seoByPath["/tools/word-compare"], title: "Word 문서 비교 결과 | Worklazy Tools", noIndex: true }
      : seoByPath[path] ?? seoByPath["/"];
    const canonical = getCanonicalUrl(isTemporaryResult ? "/tools/word-compare" : path);

    document.title = seo.title;
    setMeta("name", "description", seo.description);
    setMeta("name", "robots", seo.noIndex ? "noindex, nofollow" : "index, follow, max-image-preview:large");
    setMeta("property", "og:locale", "ko_KR");
    setMeta("property", "og:type", "website");
    setMeta("property", "og:site_name", "Worklazy Tools");
    setMeta("property", "og:title", seo.title);
    setMeta("property", "og:description", seo.description);
    setMeta("property", "og:url", canonical);
    setMeta("name", "twitter:card", "summary");
    setMeta("name", "twitter:title", seo.title);
    setMeta("name", "twitter:description", seo.description);
    setCanonical(canonical);
    setJsonLd(createStructuredData(isTemporaryResult ? "/tools/word-compare" : path, canonical));
  }, [location.pathname]);

  return null;
}

function setMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

function setCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.appendChild(element);
  }
  element.href = href;
}

function setJsonLd(value: object[]) {
  let element = document.getElementById(MANAGED_JSON_LD_ID) as HTMLScriptElement | null;
  if (!element) {
    element = document.createElement("script");
    element.id = MANAGED_JSON_LD_ID;
    element.type = "application/ld+json";
    document.head.appendChild(element);
  }
  element.text = JSON.stringify(value);
}

function createStructuredData(path: string, canonical: string) {
  const seo = seoByPath[path] ?? seoByPath["/"];
  const data: object[] = [{
    "@context": "https://schema.org",
    "@type": path === "/" ? "WebSite" : "WebPage",
    name: seo.title,
    description: seo.description,
    url: canonical,
    inLanguage: "ko-KR",
  }];

  if (seo.application) {
    data.push({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: seo.application.name,
      description: seo.description,
      url: canonical,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Any",
      featureList: seo.application.featureList,
      offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
    });
  }

  return data;
}
