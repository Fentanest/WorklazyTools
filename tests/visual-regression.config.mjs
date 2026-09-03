export const visualRegressionConfig = Object.freeze({
  routes: Object.freeze([
    Object.freeze({
      id: "home-default",
      path: "/",
      readySelector: ".home-page .hero",
    }),
    Object.freeze({
      id: "tools-media-filter",
      path: "/tools?category=media",
      readySelector: ".tools-index-page .tool-category-section .tool-card",
    }),
    Object.freeze({
      id: "excel-compare-empty",
      path: "/tools/excel-compare",
      readySelector: '[data-testid="excel-compare-page"] [data-testid="excel-compare-pair"]',
    }),
  ]),
  locales: Object.freeze(["ko", "en"]),
  themes: Object.freeze(["light", "dark"]),
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
