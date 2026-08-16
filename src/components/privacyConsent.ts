export type PrivacyConsent = "granted" | "denied" | "unset";

const STORAGE_KEY = "worklazy_privacy_consent";
export const CONSENT_EVENT = "worklazy-consent-change";

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
    return value === "granted" || value === "denied" ? value : "unset";
  } catch {
    return "unset";
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
  try { localStorage.setItem(STORAGE_KEY, value); } catch { /* Storage can be unavailable in strict private modes. */ }
  updateGoogleConsent(value);
  window.dispatchEvent(new CustomEvent<PrivacyConsent>(CONSENT_EVENT, { detail: value }));
}

export function resetPrivacyConsent() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* Ignore restricted storage. */ }
  updateGoogleConsent("denied");
  window.dispatchEvent(new CustomEvent<PrivacyConsent>(CONSENT_EVENT, { detail: "unset" }));
}

export function updateGoogleConsent(value: PrivacyConsent) {
  initializeGoogleConsentMode();
  const granted = value === "granted" ? "granted" : "denied";
  window.gtag?.("consent", "update", {
    analytics_storage: granted,
    ad_storage: granted,
    ad_user_data: granted,
    ad_personalization: granted,
  });
}
