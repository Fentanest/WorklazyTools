import type { AppLanguage } from "../i18n/languages";

export const RHWP_VERSION = "0.8.7";
export const RHWP_UPSTREAM_URL = "https://github.com/edwardkim/rhwp";
export const RHWP_STUDIO_VENDOR_PATH = `vendor/rhwp-studio/${RHWP_VERSION}/`;

export function getRhwpStudioUrl(language?: AppLanguage) {
  const basePath = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const url = new URL(`${basePath}${RHWP_STUDIO_VENDOR_PATH}`, window.location.origin);
  // Studio resolves ?lang before its own saved preference/default locale.
  if (language) url.searchParams.set("lang", language);
  return url.href;
}
