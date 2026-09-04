import { availableToolRoutes } from "./tool-registry-routes.mjs";

const fullProfiles = Object.freeze([
  Object.freeze({ locale: "ko", theme: "light", viewport: "desktop" }),
  Object.freeze({ locale: "ko", theme: "light", viewport: "mobile" }),
  Object.freeze({ locale: "ko", theme: "dark", viewport: "desktop" }),
  Object.freeze({ locale: "ko", theme: "dark", viewport: "mobile" }),
  Object.freeze({ locale: "en", theme: "light", viewport: "desktop" }),
  Object.freeze({ locale: "en", theme: "light", viewport: "mobile" }),
  Object.freeze({ locale: "en", theme: "dark", viewport: "desktop" }),
  Object.freeze({ locale: "en", theme: "dark", viewport: "mobile" }),
]);

const representativeProfiles = Object.freeze([
  Object.freeze({ locale: "ko", theme: "light", viewport: "desktop" }),
  Object.freeze({ locale: "ko", theme: "dark", viewport: "mobile" }),
  Object.freeze({ locale: "en", theme: "light", viewport: "mobile" }),
  Object.freeze({ locale: "en", theme: "dark", viewport: "desktop" }),
]);

export const visualRegressionConfig = Object.freeze({
  routes: Object.freeze([
    Object.freeze({
      id: "home-default",
      path: "/",
      kind: "index",
      profiles: fullProfiles,
      readySelector: ".home-page .hero",
    }),
    Object.freeze({
      id: "tools-media-filter",
      path: "/tools?category=media",
      kind: "index",
      profiles: fullProfiles,
      readySelector: ".tools-index-page .tool-category-section .ui-tool-card",
    }),
    ...availableToolRoutes.map((route) => Object.freeze(route.toolId === "qr-studio"
      ? { ...route, id: "qr-bulk-empty", path: "/tools/qr-studio/bulk", profiles: representativeProfiles, readySelector: '[data-testid="qr-bulk-page"]' }
      : { ...route, profiles: representativeProfiles })),
  ]),
  viewports: Object.freeze([
    Object.freeze({ id: "desktop", width: 1365, height: 900, deviceScaleFactor: 1 }),
    Object.freeze({ id: "mobile", width: 390, height: 844, deviceScaleFactor: 1 }),
  ]),
  animation: Object.freeze({
    css: "none",
    prefersReducedMotion: "reduce",
  }),
  diff: Object.freeze({
    perPixelThreshold: 0.1,
    maxDiffPixelRatio: 0.001,
    includeAntialiasing: false,
  }),
  allowedRegions: Object.freeze([
    Object.freeze({
      selector: ".global-footer > span:first-child",
      reason: "The copyright year is time-dependent and is not part of the UI migration contract.",
    }),
  ]),
});

export const qrBulkQaRoutes = Object.freeze([
  Object.freeze({ id: "qr-bulk-empty", toolId: "qr-bulk", path: "/tools/qr-studio/bulk", kind: "tool", profiles: fullProfiles, readySelector: '[data-testid="qr-bulk-page"]' }),
  Object.freeze({ id: "qr-bulk-result", toolId: "qr-bulk-result", path: "/tools/qr-studio/bulk", kind: "tool", profiles: fullProfiles, readySelector: '[data-testid="qr-bulk-page"]' }),
]);
