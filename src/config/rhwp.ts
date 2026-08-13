export const RHWP_VERSION = "0.8.4";
export const RHWP_UPSTREAM_URL = "https://github.com/edwardkim/rhwp";
export const RHWP_STUDIO_VENDOR_PATH = `vendor/rhwp-studio/${RHWP_VERSION}/`;

export function getRhwpStudioUrl() {
  const basePath = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return new URL(`${basePath}${RHWP_STUDIO_VENDOR_PATH}`, window.location.origin).href;
}
