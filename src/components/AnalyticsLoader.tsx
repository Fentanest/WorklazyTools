import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { CONSENT_EVENT, getPrivacyConsent, initializeGoogleConsentMode, updateGoogleConsent, type PrivacyConsent } from "./privacyConsent";

const GOOGLE_ANALYTICS_ID = "G-CFSK50SX9R";
const NAVER_ANALYTICS_ID = "1025dd835558ee0";
const GOOGLE_TAG_URL = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`;
const NAVER_TAG_URL = "https://wcs.pstatic.net/wcslog.js";

type AnalyticsValue = string | number | boolean;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    wcs_add?: Record<string, string>;
    wcs?: { event?: (category: string, action: string) => void };
    wcs_do?: () => void;
  }
}

let initialized = false;
let naverReady = false;
let lastNaverPath = "";
let lastGooglePath = "";
let pendingNaverPageView = false;
const pendingNaverEvents: Array<[string, string]> = [];

export function AnalyticsLoader({ disabled = false }: { disabled?: boolean }) {
  const location = useLocation();
  const [consent, setConsent] = useState<PrivacyConsent>(() => getPrivacyConsent());

  useEffect(() => {
    initializeGoogleConsentMode();
    updateGoogleConsent(consent);
    const handleConsent = (event: Event) => setConsent((event as CustomEvent<PrivacyConsent>).detail);
    window.addEventListener(CONSENT_EVENT, handleConsent);
    return () => window.removeEventListener(CONSENT_EVENT, handleConsent);
  }, []);

  useEffect(() => {
    updateGoogleConsent(consent);
    if (!import.meta.env.PROD || disabled || consent !== "granted") {
      resetPageViewState();
      return;
    }
    initializeAnalytics();
  }, [consent, disabled]);

  useEffect(() => {
    if (!import.meta.env.PROD || disabled || consent !== "granted") return;
    const path = `${location.pathname}${location.search}`;
    const timer = window.setTimeout(() => {
      requestGooglePageView(path);
      requestNaverPageView(path);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [consent, disabled, location.pathname, location.search]);

  return null;
}

export function trackToolOpen(toolId: string, menuSource: string, contentLanguage: "ko" | "en") {
  if (!import.meta.env.PROD || !initialized || getPrivacyConsent() !== "granted") return;
  const safeToolId = sanitizeEventValue(toolId);
  const safeMenuSource = sanitizeEventValue(menuSource);

  sendGoogleEvent("tool_open", {
    tool_id: safeToolId,
    menu_source: safeMenuSource,
    content_language: contentLanguage,
  });
  sendNaverEvent("tool_open", `${contentLanguage}:${safeMenuSource}:${safeToolId}`);
}

function initializeAnalytics() {
  if (initialized) return;
  initialized = true;
  initializeGoogleAnalytics();
  initializeNaverAnalytics();
}

function initializeGoogleAnalytics() {
  window.dataLayer ??= [];
  window.gtag ??= function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };

  window.gtag("js", new Date());
  window.gtag("config", GOOGLE_ANALYTICS_ID, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    send_page_view: false,
  });

  if (document.querySelector("script[data-worklazy-google-analytics]")) return;
  const script = document.createElement("script");
  script.async = true;
  script.dataset.worklazyGoogleAnalytics = "true";
  script.src = GOOGLE_TAG_URL;
  document.head.appendChild(script);
}

function requestGooglePageView(path: string) {
  if (path === lastGooglePath || !initialized) return;
  lastGooglePath = path;
  window.gtag?.("event", "page_view", {
    page_location: window.location.href,
    page_path: path,
    page_title: document.title,
  });
}

function initializeNaverAnalytics() {
  window.wcs_add ??= {};
  window.wcs_add.wa = NAVER_ANALYTICS_ID;

  if (window.wcs && window.wcs_do) {
    markNaverReady();
    return;
  }

  const existing = document.querySelector<HTMLScriptElement>("script[data-worklazy-naver-analytics]");
  if (existing) {
    existing.addEventListener("load", markNaverReady, { once: true });
    return;
  }

  const script = document.createElement("script");
  script.async = true;
  script.dataset.worklazyNaverAnalytics = "true";
  script.src = NAVER_TAG_URL;
  script.addEventListener("load", markNaverReady, { once: true });
  document.head.appendChild(script);
}

function requestNaverPageView(path: string) {
  if (path === lastNaverPath) return;
  lastNaverPath = path;
  if (!naverReady || !window.wcs_do) {
    pendingNaverPageView = true;
    return;
  }
  window.wcs_do();
}

function markNaverReady() {
  naverReady = Boolean(window.wcs && window.wcs_do);
  if (!naverReady) return;
  if (pendingNaverPageView) {
    pendingNaverPageView = false;
    window.wcs_do?.();
  }
  pendingNaverEvents.splice(0).forEach(([category, action]) => window.wcs?.event?.(category, action));
}

function sendGoogleEvent(name: string, parameters: Record<string, AnalyticsValue>) {
  window.gtag?.("event", name, parameters);
}

function sendNaverEvent(category: string, action: string) {
  if (naverReady && window.wcs?.event) {
    window.wcs.event(category, action);
    return;
  }
  if (pendingNaverEvents.length < 20) pendingNaverEvents.push([category, action]);
}

function sanitizeEventValue(value: string) {
  return value.replace(/[^a-z0-9_-]/gi, "_").slice(0, 60);
}

function resetPageViewState() {
  lastGooglePath = "";
  lastNaverPath = "";
  pendingNaverPageView = false;
}
