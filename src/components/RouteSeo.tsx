import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { getCanonicalUrl, getSeoDefinition, getSocialImageUrl, normalizeSeoPath, socialImages } from "../app/seo";
import { languageFromPath, stripLanguagePrefix } from "../i18n/languages";

const MANAGED_JSON_LD_ID = "worklazy-route-jsonld";

export function RouteSeo() {
  const location = useLocation();

  useEffect(() => {
    const path = normalizeSeoPath(location.pathname);
    const language = languageFromPath(path) ?? "ko";
    const routePath = normalizeSeoPath(stripLanguagePrefix(path));
    const isTemporaryResult = routePath.startsWith("/tools/word-compare/results/") || routePath.startsWith("/tools/hwp-compare/results/");
    const baseResultPath = routePath.startsWith("/tools/hwp-compare") ? "/tools/hwp-compare" : "/tools/word-compare";
    const seo = isTemporaryResult
      ? { ...getSeoDefinition(language, baseResultPath), title: language === "en" ? `${baseResultPath.includes("hwp") ? "HWP" : "Word"} Comparison Result | Worklazy Tools` : `${baseResultPath.includes("hwp") ? "HWP" : "Word"} 문서 비교 결과 | Worklazy Tools`, noIndex: true }
      : getSeoDefinition(language, routePath);
    const canonicalPath = isTemporaryResult ? baseResultPath : routePath;
    const canonical = getCanonicalUrl(language, canonicalPath);
    const imageDefinition = socialImages[language];
    const image = getSocialImageUrl(language);

    document.title = seo.title;
    setMeta("name", "description", seo.description);
    setMeta("name", "robots", seo.noIndex ? "noindex, nofollow" : "index, follow, max-image-preview:large");
    document.documentElement.lang = language;
    setMeta("property", "og:locale", language === "ko" ? "ko_KR" : "en_US");
    setMeta("property", "og:locale:alternate", language === "ko" ? "en_US" : "ko_KR");
    setMeta("property", "og:type", "website");
    setMeta("property", "og:site_name", "Worklazy Tools");
    setMeta("property", "og:title", seo.title);
    setMeta("property", "og:description", seo.description);
    setMeta("property", "og:url", canonical);
    setMeta("property", "og:image", image);
    setMeta("property", "og:image:secure_url", image);
    setMeta("property", "og:image:type", imageDefinition.type);
    setMeta("property", "og:image:width", String(imageDefinition.width));
    setMeta("property", "og:image:height", String(imageDefinition.height));
    setMeta("property", "og:image:alt", imageDefinition.alt);
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", seo.title);
    setMeta("name", "twitter:description", seo.description);
    setMeta("name", "twitter:image", image);
    setMeta("name", "twitter:image:alt", imageDefinition.alt);
    setCanonical(canonical);
    const englishAlternatePath = canonicalPath === "/tools/hwp-editor" ? "/tools" : canonicalPath;
    setAlternate("ko", getCanonicalUrl("ko", canonicalPath));
    setAlternate("en", getCanonicalUrl("en", englishAlternatePath));
    setAlternate("x-default", getCanonicalUrl("en", englishAlternatePath));
    setJsonLd(createStructuredData(language, canonicalPath, canonical));
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

function setAlternate(hreflang: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${hreflang}"]`);
  if (!element) {
    element = document.createElement("link");
    element.rel = "alternate";
    element.hreflang = hreflang;
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

function createStructuredData(language: "ko" | "en", path: string, canonical: string) {
  const seo = getSeoDefinition(language, path);
  const data: object[] = [{
    "@context": "https://schema.org",
    "@type": path === "/" ? "WebSite" : "WebPage",
    name: seo.title,
    description: seo.description,
    url: canonical,
    inLanguage: language === "ko" ? "ko-KR" : "en-US",
    image: getSocialImageUrl(language),
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
