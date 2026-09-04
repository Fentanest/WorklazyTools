import { b1QaScenarios, qrBulkQaScenarios, visualRegressionScenarios } from "./visual-regression.scenarios.mjs";

export const visualRegressionConfig = Object.freeze({
  scenarios: visualRegressionScenarios,
  viewports: Object.freeze([
    Object.freeze({ id: "desktop", width: 1365, height: 900, deviceScaleFactor: 1 }),
    Object.freeze({ id: "mobile", width: 390, height: 844, deviceScaleFactor: 1 }),
  ]),
  animation: Object.freeze({
    css: "none",
    prefersReducedMotion: "reduce",
  }),
  environment: Object.freeze({
    timezone: "UTC",
    fontFamily: "Worklazy Visual Noto Sans KR",
    fontUrl: "/vendor/qr-label-font/noto-cjk-sans-2.004/NotoSansKR-Regular.otf",
    maxCapturesPerBrowser: 12,
    settleTimeMs: 200,
    locales: Object.freeze({
      ko: Object.freeze({ browserLocale: "ko-KR", acceptLanguage: "ko-KR,ko;q=0.9,en;q=0.8" }),
      en: Object.freeze({ browserLocale: "en-US", acceptLanguage: "en-US,en;q=0.9" }),
    }),
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

export { b1QaScenarios, qrBulkQaScenarios };
