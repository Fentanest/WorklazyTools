export type PrivacyConsent = "granted" | "denied" | "unset";

// v2 explicitly names Coupang Partners. A legacy Google/Naver grant cannot be
// silently extended to the new provider and purpose.
const STORAGE_KEY = "worklazy_privacy_consent_v2";
const LEGACY_STORAGE_KEY = "worklazy_privacy_consent";
export const CONSENT_EVENT = "worklazy-consent-change";
let volatileConsent: PrivacyConsent = "unset";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let googleDefaultApplied = false;

export function getPrivacyConsent(): PrivacyConsent {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : volatileConsent;
  } catch {
    return volatileConsent;
  }
}

export function initializeGoogleConsentMode() {
  window.dataLayer ??= [];
  window.gtag ??= function gtag() { window.dataLayer?.push(arguments); };
  if (googleDefaultApplied) return;
  googleDefaultApplied = true;
  window.gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    wait_for_update: 500,
  });
}

export function setPrivacyConsent(value: Exclude<PrivacyConsent, "unset">) {
  volatileConsent = value;
  try { localStorage.setItem(STORAGE_KEY, value); } catch { /* Storage can be unavailable in strict private modes. */ }
  updateGoogleConsent(value);
  window.dispatchEvent(new CustomEvent<PrivacyConsent>(CONSENT_EVENT, { detail: value }));
}

export function resetPrivacyConsent() {
  volatileConsent = "unset";
  try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(LEGACY_STORAGE_KEY); } catch { /* Ignore restricted storage. */ }
  updateGoogleConsent("denied");
  window.dispatchEvent(new CustomEvent<PrivacyConsent>(CONSENT_EVENT, { detail: "unset" }));
}

export function updateGoogleConsent(value: PrivacyConsent) {
  initializeGoogleConsentMode();
  if (value !== "granted" && window.dataLayer) {
    // If consent is withdrawn while gtag.js is still downloading, discard
    // previously queued grants before the delayed supplier can consume them.
    for (let index = window.dataLayer.length - 1; index >= 0; index -= 1) {
      const entry = window.dataLayer[index] as ArrayLike<unknown> | undefined;
      const state = entry?.[2] as { analytics_storage?: string; ad_storage?: string } | undefined;
      if (entry?.[0] === "consent" && entry[1] === "update"
        && (state?.analytics_storage === "granted" || state?.ad_storage === "granted")) {
        window.dataLayer.splice(index, 1);
      }
    }
  }
  const granted = value === "granted" ? "granted" : "denied";
  window.gtag?.("consent", "update", {
    analytics_storage: granted,
    ad_storage: granted,
    ad_user_data: granted,
    ad_personalization: granted,
  });
}
