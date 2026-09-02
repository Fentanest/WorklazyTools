export const OFFICE_ASSET_VERSION = "2026-08-26";

export const OFFICE_CORE_ASSETS = [
  { name: "soffice.js", size: 858124 },
  { name: "soffice.wasm", size: 161667499 },
  { name: "soffice.data", size: 99520604 },
  { name: "soffice.data.js.metadata", size: 215180 },
  { name: "zeta.js", size: 42946 },
  { name: "office_thread.js", size: 2983 },
] as const;

export const OFFICE_EDITOR_FONT_ASSETS = [
  { name: "NanumGothic-Regular.ttf", size: 2054744 },
] as const;

export const OFFICE_ASSETS = [...OFFICE_CORE_ASSETS, ...OFFICE_EDITOR_FONT_ASSETS] as const;

export const OFFICE_DOWNLOAD_BYTES = OFFICE_ASSETS.reduce((sum, asset) => sum + asset.size, 0);
export const OFFICE_CORE_DOWNLOAD_BYTES = OFFICE_CORE_ASSETS.reduce((sum, asset) => sum + asset.size, 0);

export function officeAssetBaseUrl() {
  return new URL(
    `vendor/zetaoffice/${OFFICE_ASSET_VERSION}/`,
    new URL(import.meta.env.BASE_URL, window.location.origin),
  ).href;
}
