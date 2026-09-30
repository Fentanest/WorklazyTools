import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { safeAnalyticsPage } from "../app/publicService";
import { stripSiteBasePath, withSiteBasePath } from "../app/siteBasePath";
import { tools } from "../app/toolRegistry";
import { isThirdPartyBlockedForQa } from "./localQa";

const GOOGLE_ANALYTICS_ID = "G-CFSK50SX9R";
const NAVER_ANALYTICS_ID = "1025dd835558ee0";
const GOOGLE_TAG_URL = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`;
const NAVER_TAG_URL = "https://wcs.pstatic.net/wcslog.js";
const TOOL_IDS = new Set([...tools.map((tool) => tool.id), "topbar-search"]);
const MENU_SOURCES = new Set(["home_card", "tools_card", "sidebar", "mobile_sheet", "topbar"]);
const SITE_BASE_URL = import.meta.env.BASE_URL;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    wcs_add?: Record<string, string>;
    wcs?: { event?: (category: string, action: string) => void };
    wcs_do?: () => void;
  }
}

type SafePage = NonNullable<ReturnType<typeof safeAnalyticsPage>>;
let activePage: { key: string; page: SafePage; naverSafe: boolean; route: string } | null = null;
let googleLoaded = false;
let googleConfigured = false;
let naverLoaded = false;
let lastGoogleKey = "";
let lastNaverKey = "";

export function AnalyticsLoader({ ready }: { ready: boolean }) {
  const location = useLocation();

  useEffect(() => {
    const safePage = ready ? safeAnalyticsPage(location.pathname, location.search, location.hash) : null;
    if (!import.meta.env.PROD || isThirdPartyBlockedForQa() || !safePage) {
      activePage = null;
      lastGoogleKey = "";
      lastNaverKey = "";
      return;
    }
    activePage = {
      key: `${location.key}:${safePage.path}`,
      page: safePage,
      naverSafe: isSafeNaverReferrer(document.referrer),
      route: `${location.pathname}${location.search}${location.hash}`,
    };
    initializeGoogleAnalytics();
    if (activePage.naverSafe) initializeNaverAnalytics();
    flushPageViews();
    return () => { activePage = null; };
  }, [ready, location.key, location.pathname, location.search, location.hash]);

  return null;
}

export function trackToolOpen(toolId: string, menuSource: string, contentLanguage: "ko" | "en") {
  const page = currentPage();
  if (!import.meta.env.PROD || isThirdPartyBlockedForQa() || !page) return;
  if (!TOOL_IDS.has(toolId) || !MENU_SOURCES.has(menuSource)) return;
  if (googleLoaded) window.gtag?.("event", "tool_open", {
    tool_id: toolId, menu_source: menuSource, content_language: contentLanguage,
  });
  if (page.naverSafe && naverLoaded) window.wcs?.event?.("tool_open", `${contentLanguage}:${menuSource}:${toolId}`);
}

function isSafeNaverReferrer(referrer: string) {
  if (!referrer) return true;
  try {
    const url = new URL(referrer);
    if (url.search || url.hash) return false;
    if (url.origin !== window.location.origin) return url.pathname === "/";
    // The language landing is a safe same-site referrer even though it has
    // no locale-specific analytics page of its own.
    const pathname = stripSiteBasePath(url.pathname, SITE_BASE_URL);
    return pathname === "/" || Boolean(pathname && safeAnalyticsPage(pathname));
  } catch { return false; }
}

function currentPage() {
  if (!activePage) return null;
  const pathname = stripSiteBasePath(window.location.pathname, SITE_BASE_URL);
  if (!pathname || `${pathname}${window.location.search}${window.location.hash}` !== activePage.route) return null;
  return activePage;
}

function initializeGoogleAnalytics() {
  const existing = document.querySelector<HTMLScriptElement>("script[data-worklazy-google-analytics]");
  if (existing) {
    if (existing.dataset.loaded === "true") {
      googleLoaded = true;
      configureGoogleAnalytics();
    }
    return;
  }
  if (!currentPage()) return;
  ensureGoogleTagQueue();
  const script = document.createElement("script");
  script.async = true;
  script.referrerPolicy = "origin";
  script.dataset.worklazyGoogleAnalytics = "true";
  script.src = GOOGLE_TAG_URL;
  script.addEventListener("load", () => {
    script.dataset.loaded = "true";
    googleLoaded = true;
    configureGoogleAnalytics();
    flushPageViews();
  }, { once: true });
  script.addEventListener("error", () => {
    googleLoaded = false;
    script.remove();
  }, { once: true });
  document.head.appendChild(script);
}

function ensureGoogleTagQueue() {
  window.dataLayer ??= [];
  window.gtag ??= function gtag() { window.dataLayer?.push(arguments); };
}

function configureGoogleAnalytics() {
  const page = currentPage()?.page;
  if (!googleLoaded || googleConfigured || !page) return;
  googleConfigured = true;
  ensureGoogleTagQueue();
  window.gtag?.("js", new Date());
  window.gtag?.("config", GOOGLE_ANALYTICS_ID, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    send_page_view: false,
    page_location: new URL(withSiteBasePath(page.path, SITE_BASE_URL), window.location.origin).href,
    page_title: page.title,
    page_referrer: "",
  });
}

function initializeNaverAnalytics() {
  window.wcs_add ??= {};
  window.wcs_add.wa = NAVER_ANALYTICS_ID;
  if (window.wcs && window.wcs_do) { naverLoaded = true; return; }
  const existing = document.querySelector<HTMLScriptElement>("script[data-worklazy-naver-analytics]");
  if (existing) return;
  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.referrerPolicy = "origin";
  script.dataset.worklazyNaverAnalytics = "true";
  script.src = NAVER_TAG_URL;
  script.addEventListener("load", () => {
    naverLoaded = Boolean(window.wcs && window.wcs_do);
    flushPageViews();
  }, { once: true });
  script.addEventListener("error", () => {
    naverLoaded = false;
    script.remove();
  }, { once: true });
  document.head.appendChild(script);
}

function flushPageViews() {
  const current = currentPage();
  if (!current) return;
  configureGoogleAnalytics();
  const { key, page, naverSafe } = current;
  if (googleLoaded && key !== lastGoogleKey) {
    lastGoogleKey = key;
    window.gtag?.("event", "page_view", {
      page_location: new URL(withSiteBasePath(page.path, SITE_BASE_URL), window.location.origin).href,
      page_path: withSiteBasePath(page.path, SITE_BASE_URL),
      page_title: page.title,
      page_referrer: "",
    });
  }
  if (naverSafe && naverLoaded && key !== lastNaverKey) {
    lastNaverKey = key;
    window.wcs_do?.();
  }
}
