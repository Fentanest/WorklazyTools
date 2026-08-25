import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { getCanonicalUrl, getSeoDefinition, getSocialImageDefinition, getSocialImageUrl, normalizeSeoPath } from "../app/seo";
import { languageFromPath, stripLanguagePrefix } from "../i18n/languages";

const MANAGED_JSON_LD_ID = "worklazy-route-jsonld";

export function RouteSeo() {
  const location = useLocation();

  useEffect(() => {
    const path = normalizeSeoPath(location.pathname);
    const language = languageFromPath(path) ?? "ko";
    const routePath = normalizeSeoPath(stripLanguagePrefix(path));
    const isTemporaryResult = routePath.startsWith("/tools/document-compare/results/");
    const isOfficeWorkspace = routePath === "/tools/office-editor/app";
    const isExcelPreserveWorkspace = routePath === "/tools/excel-merger/xls-preserve";
    const baseResultPath = "/tools/document-compare";
    const seo = isTemporaryResult
      ? { ...getSeoDefinition(language, baseResultPath), title: language === "en" ? "Document Comparison Result | Worklazy Tools" : "문서 비교 결과 | Worklazy Tools", noIndex: true }
      : isOfficeWorkspace
        ? { ...getSeoDefinition(language, "/tools/office-editor"), noIndex: true }
        : isExcelPreserveWorkspace
          ? { ...getSeoDefinition(language, "/tools/excel-merger"), noIndex: true }
      : getSeoDefinition(language, routePath);
    const canonicalPath = isTemporaryResult
      ? baseResultPath
      : isOfficeWorkspace
        ? "/tools/office-editor"
        : isExcelPreserveWorkspace
          ? "/tools/excel-merger"
          : routePath;
    const canonical = getCanonicalUrl(language, canonicalPath);
    const imageDefinition = getSocialImageDefinition(language, canonicalPath);
    const image = getSocialImageUrl(language, canonicalPath);

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
    image: getSocialImageUrl(language, path),
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

  if (seo.faq?.length) {
    data.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: seo.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    });
  }

  return data;
}
