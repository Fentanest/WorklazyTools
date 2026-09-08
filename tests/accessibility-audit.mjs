import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";
import { PNG } from "pngjs";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");
const port = readInteger("A11Y_TEST_PORT", 4178);
const baseUrl = process.env.TEST_BASE_URL || `http://127.0.0.1:${port}`;
const chromeExecutable = process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome";
const reportPath = process.env.A11Y_REPORT_PATH || "/tmp/worklazytools-a11y-report.json";
const limits = {
  critical: readInteger("A11Y_MAX_CRITICAL", 0),
  serious: readInteger("A11Y_MAX_SERIOUS", 0),
  total: readInteger("A11Y_MAX_TOTAL", 0),
};
export const f2OwnedSelector = "[data-pdf-watermark-owned]";
export const f3OwnedSelector = "[data-pdf-stamp-owned]";
export const f4aOwnedSelector = "[data-pdf-structure-owned]";
export const f4bOwnedSelector = "[data-pdf-raster-owned]";
export const accessibilityOwnedSelectors = Object.freeze([
  Object.freeze({ owner: "f2-watermark", selector: f2OwnedSelector }),
  Object.freeze({ owner: "f3-stamp", selector: f3OwnedSelector }),
  Object.freeze({ owner: "f4b-raster", selector: f4bOwnedSelector }),
  Object.freeze({ owner: "f4a-structure", selector: f4aOwnedSelector }),
]);
export const f3StampOwnershipTargets = Object.freeze([
  Object.freeze({ id: "tab", selector: "[data-finish-tab='stamp'][data-pdf-stamp-owned]" }),
  Object.freeze({ id: "notice", selector: "[data-testid='pdf-stamp-notice'][data-pdf-stamp-owned]" }),
  Object.freeze({ id: "settings", selector: "[data-pdf-stamp-owned] [data-testid='pdf-stamp-image']" }),
  Object.freeze({ id: "overlay", selector: "[data-testid='pdf-stamp-overlay'][data-pdf-stamp-owned]" }),
]);
export const f4aStructureOwnershipTargets = Object.freeze([
  Object.freeze({ id: "panel", selector: "[data-testid='pdf-finish-structure'][data-pdf-structure-owned]", expected: 1 }),
  Object.freeze({ id: "summary", selector: "[data-pdf-structure-owned] [data-testid='pdf-finish-structure-summary']", expected: 1 }),
  Object.freeze({ id: "link-notice", selector: "[data-pdf-structure-owned] [data-testid='pdf-finish-link-preservation']", expected: 1 }),
  Object.freeze({ id: "cleanup-switches", selector: "[data-pdf-structure-owned] [data-testid='pdf-finish-structure-cleanup-switches'] [role='switch']", expected: 3 }),
  Object.freeze({ id: "form-mode", selector: "[data-pdf-structure-owned] [data-testid='pdf-finish-form-mode']", expected: 1 }),
  Object.freeze({ id: "preservation-rows", selector: "[data-pdf-structure-owned] [data-structure-row]", expected: 13 }),
]);
export const f4bRasterOwnershipTargets = Object.freeze([
  Object.freeze({ id: "panel", selector: "[data-testid='pdf-finish-raster'][data-pdf-raster-owned]", expected: 1 }),
  Object.freeze({ id: "switch", selector: "[data-testid='pdf-finish-raster'] [role='switch']", expected: 1 }),
  Object.freeze({ id: "settings", selector: "[data-testid='pdf-finish-raster-settings']", expected: 1 }),
  Object.freeze({ id: "dpi", selector: "[data-testid='pdf-finish-raster-dpi']", expected: 1 }),
  Object.freeze({ id: "format", selector: "[data-testid='pdf-finish-raster-format']", expected: 1 }),
  Object.freeze({ id: "loss-notice", selector: "[data-testid='pdf-finish-raster-loss']", expected: 1 }),
  Object.freeze({ id: "mobile-limit", selector: "[data-testid='pdf-finish-raster-mobile-limit']", expected: 1 }),
]);
export const pages = Object.freeze([
  { id: "home", path: "/" },
  { id: "document-compare", path: "/ko/tools/document-compare" },
  { id: "tools", path: "/ko/tools" },
  { id: "excel-compare", path: "/ko/tools/excel-compare" },
  { id: "pdf-editor", path: "/ko/tools/pdf-editor" },
  { id: "pdf-finish-ko", path: "/ko/tools/pdf-editor/finish", readySelector: "[data-testid='pdf-finish-ready']" },
  { id: "pdf-finish-mobile-ko", path: "/ko/tools/pdf-editor/finish", viewport: { width: 412, height: 839 }, readySelector: "[data-testid='pdf-finish-ready']" },
  { id: "pdf-finish-en", path: "/en/tools/pdf-editor/finish", readySelector: "[data-testid='pdf-finish-ready']" },
  { id: "pdf-watermark-ko", path: "/ko/tools/pdf-editor/watermark", readySelector: "[data-testid='pdf-finish-ready'][data-pdf-finish-tab='watermark']" },
  { id: "pdf-stamp-ko", path: "/ko/tools/pdf-editor/stamp", readySelector: "[data-testid='pdf-finish-ready'][data-pdf-finish-tab='stamp']" },
  { id: "pdf-stamp-mobile-ko", path: "/ko/tools/pdf-editor/stamp", viewport: { width: 412, height: 839 }, readySelector: "[data-testid='pdf-finish-ready'][data-pdf-finish-tab='stamp']" },
  { id: "pdf-stamp-en", path: "/en/tools/pdf-editor/stamp", readySelector: "[data-testid='pdf-finish-ready'][data-pdf-finish-tab='stamp']" },
  { id: "pdf-stamp-editing-ko-light", path: "/ko/tools/pdf-editor/stamp", readySelector: "[data-testid='pdf-finish-ready'][data-pdf-finish-tab='stamp']", scenario: "pdf-stamp-editing", colorScheme: "light", locale: "ko-KR", ownedSelector: f3OwnedSelector },
  { id: "pdf-stamp-editing-ko-dark", path: "/ko/tools/pdf-editor/stamp", readySelector: "[data-testid='pdf-finish-ready'][data-pdf-finish-tab='stamp']", scenario: "pdf-stamp-editing", colorScheme: "dark", locale: "ko-KR", ownedSelector: f3OwnedSelector },
  { id: "pdf-stamp-editing-en-light", path: "/en/tools/pdf-editor/stamp", readySelector: "[data-testid='pdf-finish-ready'][data-pdf-finish-tab='stamp']", scenario: "pdf-stamp-editing", colorScheme: "light", locale: "en-US", ownedSelector: f3OwnedSelector },
  { id: "pdf-stamp-editing-en-dark", path: "/en/tools/pdf-editor/stamp", readySelector: "[data-testid='pdf-finish-ready'][data-pdf-finish-tab='stamp']", scenario: "pdf-stamp-editing", colorScheme: "dark", locale: "en-US", ownedSelector: f3OwnedSelector },
  { id: "pdf-structure-editing-ko-light", path: "/ko/tools/pdf-editor/finish", readySelector: "[data-testid='pdf-finish-ready']", scenario: "pdf-structure-editing", colorScheme: "light", locale: "ko-KR", ownedSelector: f4aOwnedSelector },
  { id: "pdf-structure-editing-ko-dark", path: "/ko/tools/pdf-editor/finish", readySelector: "[data-testid='pdf-finish-ready']", scenario: "pdf-structure-editing", colorScheme: "dark", locale: "ko-KR", ownedSelector: f4aOwnedSelector },
  { id: "pdf-structure-editing-en-light", path: "/en/tools/pdf-editor/finish", readySelector: "[data-testid='pdf-finish-ready']", scenario: "pdf-structure-editing", colorScheme: "light", locale: "en-US", ownedSelector: f4aOwnedSelector },
  { id: "pdf-structure-editing-en-dark", path: "/en/tools/pdf-editor/finish", readySelector: "[data-testid='pdf-finish-ready']", scenario: "pdf-structure-editing", colorScheme: "dark", locale: "en-US", ownedSelector: f4aOwnedSelector },
  { id: "pdf-raster-editing-ko-light", path: "/ko/tools/pdf-editor/finish", readySelector: "[data-testid='pdf-finish-ready']", scenario: "pdf-raster-editing", colorScheme: "light", locale: "ko-KR", ownedSelector: f4bOwnedSelector },
  { id: "pdf-raster-editing-ko-dark", path: "/ko/tools/pdf-editor/finish", readySelector: "[data-testid='pdf-finish-ready']", scenario: "pdf-raster-editing", colorScheme: "dark", locale: "ko-KR", ownedSelector: f4bOwnedSelector },
  { id: "pdf-raster-editing-en-light", path: "/en/tools/pdf-editor/finish", readySelector: "[data-testid='pdf-finish-ready']", scenario: "pdf-raster-editing", colorScheme: "light", locale: "en-US", ownedSelector: f4bOwnedSelector },
  { id: "pdf-raster-editing-en-dark", path: "/en/tools/pdf-editor/finish", readySelector: "[data-testid='pdf-finish-ready']", scenario: "pdf-raster-editing", colorScheme: "dark", locale: "en-US", ownedSelector: f4bOwnedSelector },
  { id: "pdf-watermark-error-ko-light", path: "/ko/tools/pdf-editor/watermark", readySelector: "[data-testid='pdf-finish-ready'][data-pdf-finish-tab='watermark']", scenario: "pdf-watermark-empty-text", colorScheme: "light", locale: "ko-KR" },
  { id: "pdf-watermark-error-ko-dark", path: "/ko/tools/pdf-editor/watermark", readySelector: "[data-testid='pdf-finish-ready'][data-pdf-finish-tab='watermark']", scenario: "pdf-watermark-empty-text", colorScheme: "dark", locale: "ko-KR" },
  { id: "pdf-watermark-error-en-light", path: "/en/tools/pdf-editor/watermark", readySelector: "[data-testid='pdf-finish-ready'][data-pdf-finish-tab='watermark']", scenario: "pdf-watermark-empty-text", colorScheme: "light", locale: "en-US" },
  { id: "pdf-watermark-error-en-dark", path: "/en/tools/pdf-editor/watermark", readySelector: "[data-testid='pdf-finish-ready'][data-pdf-finish-tab='watermark']", scenario: "pdf-watermark-empty-text", colorScheme: "dark", locale: "en-US" },
  { id: "pdf-watermark-display-error-ko-light", path: "/ko/tools/pdf-editor/watermark", readySelector: "[data-testid='pdf-finish-ready'][data-pdf-finish-tab='watermark']", scenario: "pdf-watermark-display-load-failure", colorScheme: "light", locale: "ko-KR" },
  { id: "pdf-watermark-display-error-ko-dark", path: "/ko/tools/pdf-editor/watermark", readySelector: "[data-testid='pdf-finish-ready'][data-pdf-finish-tab='watermark']", scenario: "pdf-watermark-display-load-failure", colorScheme: "dark", locale: "ko-KR" },
  { id: "pdf-watermark-display-error-en-light", path: "/en/tools/pdf-editor/watermark", readySelector: "[data-testid='pdf-finish-ready'][data-pdf-finish-tab='watermark']", scenario: "pdf-watermark-display-load-failure", colorScheme: "light", locale: "en-US" },
  { id: "pdf-watermark-display-error-en-dark", path: "/en/tools/pdf-editor/watermark", readySelector: "[data-testid='pdf-finish-ready'][data-pdf-finish-tab='watermark']", scenario: "pdf-watermark-display-load-failure", colorScheme: "dark", locale: "en-US" },
  { id: "hwp-editor", path: "/ko/tools/hwp-editor", readySelector: 'iframe[title="rhwp HWP 문서 편집기"]' },
  { id: "home-mobile-ko", path: "/ko", viewport: { width: 412, height: 839 } },
  { id: "tools-mobile-ko", path: "/ko/tools", viewport: { width: 412, height: 839 } },
]);
const selectedPageIds = (process.env.A11Y_PAGE_IDS || "").split(",").map((value) => value.trim()).filter(Boolean);
const auditedPages = selectedPageIds.length ? pages.filter(({ id }) => selectedPageIds.includes(id)) : pages;
if (selectedPageIds.length && (new Set(selectedPageIds).size !== selectedPageIds.length || auditedPages.length !== selectedPageIds.length)) {
  throw new Error(`A11Y_PAGE_IDS contains an unknown or duplicate page: ${selectedPageIds.join(",")}.`);
}

// Minimal exception: rhwp Studio 0.8.6 upstream owns these vendor iframe nodes.
// See docs/backlog.md, "HWP 편집기 iframe 접근성 위반 4노드". The host page stays audited.
export const accessibilityExceptions = Object.freeze([
  Object.freeze({ pageId: "hwp-editor", selector: 'iframe[title="rhwp HWP 문서 편집기"]',
    owner: "rhwp Studio 0.8.6 upstream",
    reason: "Vendor iframe: four upstream accessibility nodes; docs/backlog.md — HWP 편집기 iframe 접근성 위반 4노드" }),
]);

export function accessibilityOwnerFromResolution(resolution, context = "unknown") {
  if (resolution === "f2-watermark" || resolution === "f3-stamp" || resolution === "f4a-structure" || resolution === "f4b-raster" || resolution === "shared-existing") return resolution;
  if (resolution === "missing" || resolution === "invalid") {
    throw new Error(`Accessibility incomplete target is ${resolution}: ${context}.`);
  }
  throw new Error(`Accessibility incomplete target resolution is unknown: ${context}.`);
}

export function summarizeAccessibility(results, registeredPages = pages) {
  const ids = results.map(({ id }) => id);
  if (new Set(ids).size !== ids.length || ids.length !== registeredPages.length
    || registeredPages.some(({ id }) => !ids.includes(id))) throw new Error("Accessibility page registration mismatch (missing, duplicate or unexpected result).");
  const severityCounts = {};
  let violations = 0;
  let incompleteRules = 0;
  let incompleteNodes = 0;
  let f2IncompleteNodes = 0;
  let f3IncompleteNodes = 0;
  let f4aIncompleteNodes = 0;
  let f4bIncompleteNodes = 0;
  let inheritedIncompleteNodes = 0;
  let pixelResolvedIncompleteNodes = 0;
  for (const result of results) {
    if (!Array.isArray(result.violations)) throw new Error(`Missing accessibility violations: ${result.id}.`);
    if (!Array.isArray(result.incomplete)) throw new Error(`Missing accessibility incomplete results: ${result.id}.`);
    for (const violation of result.violations) {
      const severity = violation.impact || "unknown";
      severityCounts[severity] = (severityCounts[severity] || 0) + 1;
      violations += 1;
    }
    for (const incomplete of result.incomplete) {
      if (!Array.isArray(incomplete.nodes)) throw new Error(`Missing accessibility incomplete nodes: ${result.id}/${incomplete.id}.`);
      incompleteRules += 1;
      incompleteNodes += incomplete.nodes.length;
      for (const node of incomplete.nodes) {
        if (!Array.isArray(node.target) || !node.target.length || !Array.isArray(node.reasons) || !node.reasons.length) {
          throw new Error(`Incomplete accessibility target or reason was discarded: ${result.id}/${incomplete.id}.`);
        }
        if (node.owner === "f2-watermark") f2IncompleteNodes += 1;
        else if (node.owner === "f3-stamp") f3IncompleteNodes += 1;
        else if (node.owner === "f4a-structure") f4aIncompleteNodes += 1;
        else if (node.owner === "f4b-raster") f4bIncompleteNodes += 1;
        else if (node.owner === "shared-existing") inheritedIncompleteNodes += 1;
        else throw new Error(`Unknown accessibility incomplete owner: ${result.id}/${incomplete.id}.`);
      }
    }
    for (const node of result.resolvedIncomplete ?? []) {
      if (!Array.isArray(node.target) || !node.target.length || !Array.isArray(node.reasons) || !node.reasons.length
        || node.resolution !== "measured-pixel" || !["f2-watermark", "f3-stamp"].includes(node.owner)) {
        throw new Error(`Resolved accessibility incomplete evidence is invalid: ${result.id}.`);
      }
      pixelResolvedIncompleteNodes += 1;
    }
  }
  return { pages: results.length, violations, severityCounts, incompleteRules, incompleteNodes, f2IncompleteNodes, f3IncompleteNodes, f4aIncompleteNodes, f4bIncompleteNodes, inheritedIncompleteNodes, pixelResolvedIncompleteNodes };
}

export function assertAccessibilityResults(report, { registeredPages = pages, limits = { critical: 0, serious: 0, total: 0 } } = {}) {
  const summary = summarizeAccessibility(report.results, registeredPages);
  for (const key of ["critical", "serious", "total"]) if (!Number.isSafeInteger(limits[key]) || limits[key] < 0) throw new Error(`Invalid accessibility limit: ${key}.`);
  if (report.externalRequests.length) throw new Error(`Accessibility audit made ${report.externalRequests.length} external request(s).`);
  if (registeredPages.some(({ id }) => id === "document-compare")) {
    const contrast = report.summary.placeholderContrast?.ratio;
    if (!Number.isFinite(contrast) || contrast < 4.5) throw new Error("Document placeholder contrast is below 4.5:1 or missing.");
  }
  const errorStatePages = registeredPages.filter(({ scenario }) => scenario === "pdf-watermark-empty-text");
  for (const target of errorStatePages) {
    const result = report.results.find(({ id }) => id === target.id);
    const measurements = result?.settledContrast;
    if (!Array.isArray(measurements) || measurements.length !== 2) {
      throw new Error(`PDF watermark error-state contrast is missing: ${target.id}.`);
    }
    for (const measurement of measurements) {
      if (!Number.isFinite(measurement.ratio) || measurement.ratio < 4.5) {
        throw new Error(`PDF watermark error-state contrast is below 4.5:1: ${target.id}/${measurement.target}=${measurement.ratio}.`);
      }
    }
  }
  const displayFailurePages = registeredPages.filter(({ scenario }) => scenario === "pdf-watermark-display-load-failure");
  for (const target of displayFailurePages) {
    const result = report.results.find(({ id }) => id === target.id);
    const measurements = result?.interactiveContrast;
    const states = measurements?.map(({ state }) => state).sort();
    if (!Array.isArray(measurements) || measurements.length !== 3
      || JSON.stringify(states) !== JSON.stringify(["focus", "hover", "normal"])) {
      throw new Error(`PDF display reload contrast is missing an interaction state: ${target.id}.`);
    }
    for (const measurement of measurements) {
      if (!Number.isFinite(measurement.ratio) || measurement.ratio < 4.5) {
        throw new Error(`PDF display reload contrast is below 4.5:1: ${target.id}/${measurement.state}=${measurement.ratio}.`);
      }
    }
  }
  const stampPages = registeredPages.filter(({ id }) => id.startsWith("pdf-stamp"));
  for (const target of stampPages) {
    const result = report.results.find(({ id }) => id === target.id);
    if (target.scenario === "pdf-stamp-editing" || target.id.startsWith("pdf-stamp-editing")) {
      for (const rule of result?.incomplete ?? []) {
        for (const node of rule.nodes) {
          if (node.owner !== "f3-stamp") {
            throw new Error(`F3 stamp editing incomplete node lost ownership: ${target.id}/${rule.id}.`);
          }
        }
      }
      const ownership = result?.stampOwnership;
      const expectedTargets = f3StampOwnershipTargets.map(({ id }) => id).sort();
      const actualTargets = ownership?.targets?.map(({ id }) => id).sort();
      if (ownership?.owner !== "f3-stamp" || ownership.selector !== f3OwnedSelector
        || JSON.stringify(actualTargets) !== JSON.stringify(expectedTargets)
        || ownership.targets.some(({ matches }) => matches !== 1)) {
        throw new Error(`F3 stamp editing ownership marker is missing or ambiguous: ${target.id}.`);
      }
    }
    const measurements = result?.stampContrast;
    const measuredTargets = measurements?.map(({ target: measuredTarget }) => measuredTarget).sort();
    if (!Array.isArray(measurements) || measurements.length !== 2
      || JSON.stringify(measuredTargets) !== JSON.stringify(["notice-body", "notice-title"])) {
      throw new Error(`PDF stamp notice contrast evidence is missing: ${target.id}.`);
    }
    for (const measurement of measurements) {
      if (!Number.isFinite(measurement.ratio) || measurement.ratio < 4.5) {
        throw new Error(`PDF stamp notice contrast is below 4.5:1: ${target.id}/${measurement.target}=${measurement.ratio}.`);
      }
    }
    for (const node of result?.resolvedIncomplete ?? []) {
      if (node.owner === "f3-stamp" && !measurements.some(({ target: measuredTarget }) => measuredTarget === node.measurementTarget)) {
        throw new Error(`Resolved F3 stamp evidence is missing its pixel measurement: ${target.id}/${node.measurementTarget}.`);
      }
    }
    const resolvedStampTargets = (result?.resolvedIncomplete ?? []).filter(({ owner }) => owner === "f3-stamp").map(({ measurementTarget }) => measurementTarget);
    if (new Set(resolvedStampTargets).size !== resolvedStampTargets.length) {
      throw new Error(`Resolved F3 stamp evidence reuses a pixel measurement target: ${target.id}.`);
    }
  }
  const structurePages = registeredPages.filter(({ scenario }) => scenario === "pdf-structure-editing");
  for (const target of structurePages) {
    const result = report.results.find(({ id }) => id === target.id);
    for (const rule of result?.incomplete ?? []) {
      for (const node of rule.nodes) {
        if (node.owner !== "f4a-structure") {
          throw new Error(`F4a structure editing incomplete node lost ownership: ${target.id}/${rule.id}.`);
        }
      }
    }
    const ownership = result?.structureOwnership;
    const expectedTargets = f4aStructureOwnershipTargets.map(({ id }) => id).sort();
    const actualTargets = ownership?.targets?.map(({ id }) => id).sort();
    if (ownership?.owner !== "f4a-structure" || ownership.selector !== f4aOwnedSelector
      || JSON.stringify(actualTargets) !== JSON.stringify(expectedTargets)
      || ownership.targets.some(({ id, matches }) => matches !== f4aStructureOwnershipTargets.find((targetDefinition) => targetDefinition.id === id)?.expected)) {
      throw new Error(`F4a structure editing ownership marker is missing or ambiguous: ${target.id}.`);
    }
  }
  const rasterPages = registeredPages.filter(({ scenario }) => scenario === "pdf-raster-editing");
  for (const target of rasterPages) {
    const result = report.results.find(({ id }) => id === target.id);
    for (const rule of result?.incomplete ?? []) {
      for (const node of rule.nodes) {
        if (node.owner !== "f4b-raster") throw new Error(`F4b raster editing incomplete node lost ownership: ${target.id}/${rule.id}.`);
      }
    }
    const ownership = result?.rasterOwnership;
    const expectedTargets = f4bRasterOwnershipTargets.map(({ id }) => id).sort();
    const actualTargets = ownership?.targets?.map(({ id }) => id).sort();
    if (ownership?.owner !== "f4b-raster" || ownership.selector !== f4bOwnedSelector
      || JSON.stringify(actualTargets) !== JSON.stringify(expectedTargets)
      || ownership.targets.some(({ id, matches }) => matches !== f4bRasterOwnershipTargets.find((targetDefinition) => targetDefinition.id === id)?.expected)) {
      throw new Error(`F4b raster editing ownership marker is missing or ambiguous: ${target.id}.`);
    }
  }
  if ((summary.severityCounts.critical || 0) > limits.critical || (summary.severityCounts.serious || 0) > limits.serious
    || summary.violations > limits.total) throw new Error(`Accessibility limits exceeded: ${JSON.stringify({ ...summary, limits })}`);
  if (summary.f2IncompleteNodes > 0) throw new Error(`F2 accessibility incomplete nodes must be resolved: ${JSON.stringify(summary)}`);
  if (summary.f3IncompleteNodes > 0) throw new Error(`F3 accessibility incomplete nodes must be resolved: ${JSON.stringify(summary)}`);
  if (summary.f4aIncompleteNodes > 0) throw new Error(`F4a accessibility incomplete nodes must be resolved: ${JSON.stringify(summary)}`);
  if (summary.f4bIncompleteNodes > 0) throw new Error(`F4b accessibility incomplete nodes must be resolved: ${JSON.stringify(summary)}`);
  return summary;
}

export async function runAccessibilityAudit() {
  let server;
  let browser;

  try {
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    if (!process.env.TEST_BASE_URL) server = await startPreview();
    browser = await chromium.launch({
      executablePath: chromeExecutable,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-device-scale-factor=1"],
    });
    const results = [];
    const externalRequests = [];
    let placeholderContrast;
    for (const target of auditedPages) {
      const context = await browser.newContext({
        viewport: target.viewport ?? { width: 1280, height: 800 },
        isMobile: Boolean(target.viewport),
        hasTouch: Boolean(target.viewport),
        serviceWorkers: "block",
        deviceScaleFactor: 1,
        colorScheme: target.colorScheme ?? "light",
        reducedMotion: "reduce",
        locale: target.locale ?? "ko-KR",
        timezoneId: "Asia/Seoul",
      });
      await context.addInitScript(() => {
        localStorage.setItem("worklazy_privacy_consent", "denied");
      });

      const page = await context.newPage();
      let displayAssetRequests = 0;
      if (target.scenario === "pdf-watermark-display-load-failure") {
        await page.route("**/assets/pdf-*.mjs", async (route) => {
          displayAssetRequests += 1;
          await route.abort("failed");
        });
      }
      page.on("request", (request) => {
        const requestUrl = new URL(request.url());
        const allowed = requestUrl.origin === new URL(baseUrl).origin || ["data:", "blob:"].includes(requestUrl.protocol);
        if (!allowed) externalRequests.push({ page: target.id, url: request.url() });
      });
      await page.goto(new URL(target.path, baseUrl).href, { waitUntil: "networkidle" });
      if (target.readySelector) await page.locator(target.readySelector).waitFor({ state: "visible" });
      await page.addStyleTag({
        content: "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important;scroll-behavior:auto!important}",
      });
      let settledContrast;
      let interactiveContrast;
      let stampOwnership;
      let structureOwnership;
      let rasterOwnership;
      let stampContrast;
      if (target.scenario === "pdf-watermark-empty-text") {
        await page.locator("[data-testid='pdf-finish-ready'] input[accept*='application/pdf']")
          .setInputFiles(path.join(repositoryRoot, "tests/fixtures/pdf-finish/ordinary/no-resources.pdf"));
        await page.waitForFunction(() => {
          const panel = document.querySelector("[data-testid='pdf-finish-ready']");
          return panel?.getAttribute("data-preflight-status") === "ready"
            && panel.querySelector("[data-testid='pdf-finish-preview']")?.getAttribute("data-preview-status") === "ready";
        }, undefined, { timeout: 30_000 });
        await page.locator("[data-testid='pdf-finish-template']").fill(" \n\n ");
        await page.locator("[data-testid='pdf-finish-preflight-error'][data-error-code='empty-text']").waitFor();
        await page.waitForTimeout(1_000);
        settledContrast = await measureRenderedContrast(page, [
          { target: "invalid-textarea", selector: "[data-testid='pdf-finish-template'][aria-invalid='true']" },
          { target: "empty-text-notice", selector: "[data-testid='pdf-finish-preflight-error'][data-error-code='empty-text']" },
        ]);
      } else if (target.scenario === "pdf-watermark-display-load-failure") {
        await page.locator("[data-testid='pdf-finish-ready'] input[accept*='application/pdf']")
          .setInputFiles(path.join(repositoryRoot, "tests/fixtures/pdf-finish/ordinary/no-resources.pdf"));
        const reloadButton = page.locator("[data-testid='pdf-display-reload']");
        await reloadButton.waitFor();
        await page.waitForTimeout(1_200);
        if (displayAssetRequests !== 1) throw new Error(`PDF display failure must stop after its first asset request: ${target.id}/${displayAssetRequests}.`);
        interactiveContrast = await measureInteractivePixelContrast(page, reloadButton);
      } else if (target.scenario === "pdf-stamp-editing") {
        await page.locator("[data-testid='pdf-finish-ready'] input[accept*='application/pdf']")
          .setInputFiles(path.join(repositoryRoot, "tests/fixtures/pdf-finish/ordinary/no-resources.pdf"));
        await page.locator("[data-testid='pdf-stamp-image']").setInputFiles({
          name: "accessibility-stamp.png",
          mimeType: "image/png",
          buffer: createAccessibilityStamp(),
        });
        await page.locator("[data-testid='pdf-stamp-overlay']").waitFor();
        await page.locator("[data-testid='pdf-finish-preflight-ready']").waitFor();
        stampOwnership = {
          owner: "f3-stamp",
          selector: f3OwnedSelector,
          targets: await Promise.all(f3StampOwnershipTargets.map(async ({ id, selector }) => ({
            id,
            matches: await page.locator(selector).count(),
          }))),
        };
      } else if (target.scenario === "pdf-structure-editing") {
        await page.locator("[data-testid='pdf-finish-ready'] input[accept*='application/pdf']")
          .setInputFiles(path.join(repositoryRoot, "tests/fixtures/pdf-finish/removal/removal-structures.pdf"));
        await page.locator("[data-testid='pdf-finish-structure-summary']").click();
        await page.locator("[data-testid='pdf-finish-link-preservation']").waitFor();
        structureOwnership = {
          owner: "f4a-structure",
          selector: f4aOwnedSelector,
          targets: await Promise.all(f4aStructureOwnershipTargets.map(async ({ id, selector }) => ({
            id,
            matches: await page.locator(selector).count(),
          }))),
        };
      } else if (target.scenario === "pdf-raster-editing") {
        await page.locator("[data-testid='pdf-finish-ready'] input[accept*='application/pdf']")
          .setInputFiles(path.join(repositoryRoot, "tests/fixtures/pdf-finish/ordinary/no-resources.pdf"));
        await page.locator("[data-testid='pdf-finish-structure-summary']").click();
        await page.locator("[data-testid='pdf-finish-raster'] [role='switch']").click();
        await page.locator("[data-testid='pdf-finish-raster-settings']").waitFor();
        rasterOwnership = {
          owner: "f4b-raster",
          selector: f4bOwnedSelector,
          targets: await Promise.all(f4bRasterOwnershipTargets.map(async ({ id, selector }) => ({
            id,
            matches: await page.locator(selector).count(),
          }))),
        };
      }
      await page.evaluate(async () => {
        if (document.fonts?.ready) await document.fonts.ready;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      if (target.id.startsWith("pdf-stamp")) stampContrast = await measureStampNoticeContrast(page);
      const builder = new AxeBuilder({ page });
      if (target.ownedSelector) builder.include(target.ownedSelector);
      const exceptions = accessibilityExceptions.filter(({ pageId }) => pageId === target.id);
      for (const exception of exceptions) {
        if (await page.locator(exception.selector).count() !== 1) throw new Error(`Accessibility exception must match exactly one iframe: ${exception.selector}`);
        builder.exclude(exception.selector);
      }
      const audit = await builder.analyze();
      const incomplete = [];
      const resolvedIncomplete = [];
      for (const rule of audit.incomplete) {
        const nodes = [];
        for (const node of rule.nodes) {
          const firstTarget = node.target.flat(Infinity).find((value) => typeof value === "string");
          if (typeof firstTarget !== "string" || !firstTarget.trim()) {
            throw new Error(`Accessibility incomplete target is missing: ${target.id}/${rule.id}.`);
          }
          const ownership = await page.evaluate(({ target, ownedSelectors, pixelMeasuredReload, pixelMeasuredStamp }) => {
            try {
              const element = document.querySelector(target);
              if (!element) return { resolution: "missing" };
              if (pixelMeasuredReload && element.matches("[data-testid='pdf-display-reload']")) {
                return { resolution: "measured-pixel", owner: "f2-watermark" };
              }
              if (pixelMeasuredStamp && element.closest("[data-testid='pdf-stamp-notice']")) {
                return {
                  resolution: "measured-pixel",
                  owner: "f3-stamp",
                  measurementTarget: element.matches("[data-testid='pdf-stamp-notice-title']") ? "notice-title" : "notice-body",
                };
              }
              for (const owned of ownedSelectors) {
                if (element.closest(owned.selector)) return { resolution: "owned", owner: owned.owner };
              }
              return { resolution: "owned", owner: "shared-existing" };
            } catch {
              return { resolution: "invalid" };
            }
          }, {
            target: firstTarget,
            ownedSelectors: accessibilityOwnedSelectors,
            pixelMeasuredReload: target.scenario === "pdf-watermark-display-load-failure" && rule.id === "color-contrast",
            pixelMeasuredStamp: target.id.startsWith("pdf-stamp") && rule.id === "color-contrast",
          });
          const reasons = [...node.any, ...node.all, ...node.none].map(({ message }) => message).filter(Boolean);
          if (ownership.resolution === "measured-pixel") {
            resolvedIncomplete.push({
              rule: rule.id,
              target: node.target,
              reasons: reasons.length ? reasons : [node.failureSummary || rule.help || rule.id],
              resolution: "measured-pixel",
              owner: ownership.owner,
              ...(ownership.measurementTarget ? { measurementTarget: ownership.measurementTarget } : {}),
            });
            continue;
          }
          const owner = accessibilityOwnerFromResolution(ownership.resolution === "owned" ? ownership.owner : ownership.resolution, `${target.id}/${rule.id}/${firstTarget}`);
          nodes.push({
            target: node.target,
            failureSummary: node.failureSummary,
            reasons: reasons.length ? reasons : [node.failureSummary || rule.help || rule.id],
            owner,
          });
        }
        if (nodes.length) incomplete.push({ id: rule.id, impact: rule.impact, help: rule.help, helpUrl: rule.helpUrl, nodes });
      }
      if (target.id === "document-compare") {
        placeholderContrast = await page.locator('[data-testid="document-revision-author"] input[placeholder]').evaluate((input) => {
          const parseRgb = (color) => {
            const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
            if (!channels || channels.length !== 3) throw new Error(`Could not parse rendered color ${color}.`);
            return channels;
          };
          const luminance = (color) => parseRgb(color).map((channel) => {
            const normalized = channel / 255;
            return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
          }).reduce((value, channel, index) => value + channel * [0.2126, 0.7152, 0.0722][index], 0);
          const foreground = getComputedStyle(input, "::placeholder").color;
          const background = getComputedStyle(input).backgroundColor;
          const light = Math.max(luminance(foreground), luminance(background));
          const dark = Math.min(luminance(foreground), luminance(background));
          return { foreground, background, ratio: (light + 0.05) / (dark + 0.05) };
        });
      }
      results.push({
        id: target.id,
        path: target.path,
        viewport: page.viewportSize(),
        exceptions,
        passes: audit.passes.length,
        violations: audit.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          nodes: violation.nodes.length,
          targets: violation.nodes.map((node) => node.target),
        })),
        incomplete,
        ...(resolvedIncomplete.length ? { resolvedIncomplete } : {}),
        ...(settledContrast ? { settledContrast } : {}),
        ...(interactiveContrast ? { interactiveContrast } : {}),
        ...(stampOwnership ? { stampOwnership } : {}),
        ...(structureOwnership ? { structureOwnership } : {}),
        ...(rasterOwnership ? { rasterOwnership } : {}),
        ...(stampContrast ? { stampContrast } : {}),
      });
      await context.close();
    }

    const aggregation = summarizeAccessibility(results, auditedPages);
    const summary = {
      axeCore: "4.13.0",
      browserDriver: "playwright 1.63.0",
      ...aggregation,
      measuredAt: new Date().toISOString(),
      colorSchemes: [...new Set(auditedPages.map(({ colorScheme }) => colorScheme ?? "light"))],
      externalRequests: externalRequests.length,
      placeholderContrast,
      limits,
    };
    const report = { summary, results, externalRequests };
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

    for (const result of results) {
      const detail = result.violations.map((violation) => `${violation.id}:${violation.impact}:${violation.nodes}`).join(", ") || "none";
      const incompleteDetail = result.incomplete.map((rule) => `${rule.id}:${rule.nodes.length}`).join(", ") || "none";
      console.log(`${result.id}: passes=${result.passes}; violations=${result.violations.length}; ${detail}; incomplete=${incompleteDetail}`);
    }
    console.log(`Accessibility audit summary: ${JSON.stringify(summary)}`);
    if (placeholderContrast) console.log(`Document placeholder contrast: ${placeholderContrast.ratio.toFixed(4)}:1 (${placeholderContrast.foreground} on ${placeholderContrast.background}).`);
    for (const result of results.filter(({ settledContrast }) => settledContrast)) {
      console.log(`${result.id} settled contrast: ${result.settledContrast.map(({ target, ratio }) => `${target}=${ratio.toFixed(4)}:1`).join(", ")}`);
    }
    for (const result of results.filter(({ interactiveContrast }) => interactiveContrast)) {
      console.log(`${result.id} reload contrast: ${result.interactiveContrast.map(({ state, ratio }) => `${state}=${ratio.toFixed(4)}:1`).join(", ")}`);
    }
    for (const result of results.filter(({ stampContrast }) => stampContrast)) {
      console.log(`${result.id} stamp notice contrast: ${result.stampContrast.map(({ target, ratio }) => `${target}=${ratio.toFixed(4)}:1`).join(", ")}`);
    }
    console.log(`Accessibility report: ${reportPath}`);

    assertAccessibilityResults(report, { registeredPages: auditedPages, limits });
  } finally {
    await browser?.close();
    if (server) await stopServer(server);
  }
}

function createAccessibilityStamp() {
  const image = new PNG({ width: 160, height: 80 });
  for (let index = 0; index < image.data.length; index += 4) {
    image.data[index] = 202;
    image.data[index + 1] = 30;
    image.data[index + 2] = 55;
    image.data[index + 3] = 255;
  }
  return PNG.sync.write(image);
}

async function measureStampNoticeContrast(page) {
  return Promise.all([
    measureTextPixelContrast(page.locator("[data-testid='pdf-stamp-notice-description']"), "notice-body"),
    measureTextPixelContrast(page.locator("[data-testid='pdf-stamp-notice-title']"), "notice-title"),
  ]);
}

async function measureTextPixelContrast(locator, target) {
  const foreground = await locator.evaluate((element) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Could not create a color measurement canvas.");
    const color = getComputedStyle(element).color;
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    return { css: color, rgba: [...context.getImageData(0, 0, 1, 1).data] };
  });
  await locator.evaluate((element) => element.style.setProperty("color", "transparent", "important"));
  let screenshot;
  try {
    await locator.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    screenshot = await locator.screenshot({ animations: "disabled" });
  } finally {
    await locator.evaluate((element) => element.style.removeProperty("color"));
  }
  const image = PNG.sync.read(screenshot);
  const foregroundLuminance = luminance(foreground.rgba);
  const ratios = [];
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const offset = (y * image.width + x) * 4;
      const backgroundLuminance = luminance(image.data.subarray(offset, offset + 4));
      ratios.push((Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05));
    }
  }
  if (!ratios.length) throw new Error(`PDF stamp ${target} background pixel sample is empty.`);
  return {
    target,
    foreground: foreground.css,
    ratio: Math.min(...ratios),
    maximumRatio: Math.max(...ratios),
    samples: ratios.length,
    method: "Computed text color against every rendered pixel behind that text after making only that text transparent.",
  };
}

async function measureInteractivePixelContrast(page, button) {
  const measurements = [];
  for (const state of ["normal", "hover", "focus"]) {
    await page.mouse.move(0, 0);
    if (state === "normal") {
      await button.evaluate((element) => element.blur());
    } else if (state === "hover") {
      await button.hover();
    } else {
      await button.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
    }
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const stateApplied = await button.evaluate((element, expectedState) => expectedState === "normal"
      ? !element.matches(":hover") && !element.matches(":focus-visible")
      : element.matches(expectedState === "hover" ? ":hover" : ":focus-visible"), state);
    if (!stateApplied) throw new Error(`PDF display reload ${state} state could not be applied.`);
    measurements.push(await measureElementPixelContrast(button, state));
  }
  await page.mouse.move(0, 0);
  await button.evaluate((element) => element.blur());
  return measurements;
}

async function measureElementPixelContrast(locator, state) {
  const foreground = await locator.evaluate((element) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Could not create a color measurement canvas.");
    const color = getComputedStyle(element).color;
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    return { css: color, rgba: [...context.getImageData(0, 0, 1, 1).data] };
  });
  await locator.evaluate((element) => element.style.setProperty("color", "transparent", "important"));
  let screenshot;
  try {
    screenshot = await locator.screenshot({ animations: "disabled" });
  } finally {
    await locator.evaluate((element) => element.style.removeProperty("color"));
  }
  const image = PNG.sync.read(screenshot);
  const foregroundLuminance = luminance(foreground.rgba);
  const ratios = [];
  for (let y = 9; y < image.height - 9; y += 1) {
    for (let x = 12; x < image.width - 12; x += 1) {
      const offset = (y * image.width + x) * 4;
      const backgroundLuminance = luminance(image.data.subarray(offset, offset + 4));
      ratios.push((Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05));
    }
  }
  if (!ratios.length) throw new Error("PDF display reload background pixel sample is empty.");
  return {
    state,
    foreground: foreground.css,
    ratio: Math.min(...ratios),
    maximumRatio: Math.max(...ratios),
    samples: ratios.length,
    method: "Computed foreground against rendered background pixels after making only the button foreground transparent; the inner rectangle excludes borders and corners.",
  };
}

function luminance(color) {
  return [...color].slice(0, 3).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  }).reduce((value, channel, index) => value + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

async function measureRenderedContrast(page, targets) {
  return page.evaluate((definitions) => {
    const parseColor = (color) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Could not create a color measurement canvas.");
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data].map((channel, index) => index === 3 ? channel / 255 : channel);
    };
    const over = (front, back) => {
      const alpha = front[3] + back[3] * (1 - front[3]);
      if (alpha === 0) return [0, 0, 0, 0];
      return [0, 1, 2].map((index) => (front[index] * front[3] + back[index] * back[3] * (1 - front[3])) / alpha).concat(alpha);
    };
    const backgroundFor = (element) => {
      let background = [0, 0, 0, 0];
      for (let current = element; current; current = current.parentElement) {
        background = over(background, parseColor(getComputedStyle(current).backgroundColor));
      }
      return over(background, [255, 255, 255, 1]);
    };
    const luminance = (color) => color.slice(0, 3).map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    }).reduce((value, channel, index) => value + channel * [0.2126, 0.7152, 0.0722][index], 0);
    return definitions.map(({ target, selector }) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) throw new Error(`Contrast target is missing: ${selector}.`);
      const foreground = parseColor(getComputedStyle(element).color);
      const background = backgroundFor(element);
      const renderedForeground = over(foreground, background);
      const foregroundLuminance = luminance(renderedForeground);
      const backgroundLuminance = luminance(background);
      return {
        target,
        foreground: getComputedStyle(element).color,
        background: getComputedStyle(element).backgroundColor,
        ratio: (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05),
      };
    });
  }, targets);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runAccessibilityAudit();

function readInteger(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a non-negative integer.`);
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative integer.`);
  return parsed;
}

async function startPreview() {
  const viteBin = path.join(repositoryRoot, "node_modules", "vite", "bin", "vite.js");
  const child = spawn(process.execPath, [viteBin, "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: repositoryRoot,
    env: { ...process.env, BROWSER: "none" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = [];
  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));
  child.unref();
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Vite preview exited early (${child.exitCode}): ${output.join("")}`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return child;
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill("SIGTERM");
  throw new Error(`Timed out waiting for ${baseUrl}: ${output.join("")}`);
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
