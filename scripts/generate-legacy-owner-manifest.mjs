import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import postcss from "postcss";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repositoryRoot, "docs", "legacy-css-owner-manifest.json");
const stylesheetPath = path.join(repositoryRoot, "src", "styles", "global.css");
const baselineCommit = "454d7c8964d1a2f301c8661a6c6cc00f6304b49f";

const legacyClassTokens = new Set([
  "page-header", "eyebrow", "page-description",
  "section-card", "section-heading", "step-number",
  "segmented-control", "selected",
  "settings-row", "ios-switch", "checked",
  "drop-zone-wrap", "field-label", "visually-hidden", "drop-zone", "dragging", "disabled",
  "drop-icon", "drop-added-status", "drop-hint", "drop-hint-segment",
  "file-list", "file-row", "file-type", "file-meta", "remove-button",
  "primary-button", "result-card", "result-icon",
  "tool-guide", "content-heading", "tool-guide-grid", "tool-faq",
  "operation-progress", "operation-progress-heading", "operation-state-icon", "spin",
  "operation-progress-track", "operation-current-message", "operation-log-toggle",
  "operation-log", "operation-log-progress", "current",
  "tool-card", "featured", "tool-card-top", "tool-icon", "card-arrow",
  "tool-card-copy", "tool-highlights", "language-switcher", "compact",
]);

const range = (start, end) => Array.from({ length: end - start + 1 }, (_, index) => start + index);
const categoryIndexes = new Map(Object.entries({
  "cross-shared": [
    1, 4, 5, 6, 7, 8, 24, 60, 61, 65, 66, 67, 68, 69,
    77, 78, 79, 80, 81, 82, 83, 84, 85, 105, 130, 131, 132, 133, 134, 143, 151,
  ],
  "p2-shared": [2, ...range(9, 23), 98, 152, 153, 154, 155],
  orphan: [43, 45],
  "excel-compare": [...range(25, 42), 44, 46, ...range(136, 139), 147, 148, 150],
  "excel-merger": [...range(47, 59), ...range(62, 64), 86],
  "document-compare": [...range(70, 73), ...range(87, 94), 141],
  "image-studio": [...range(114, 118), 120, 145],
  "pdf-editor": range(100, 104),
  "office-editor": [95, 96, 97, 142],
  "audio-studio": [111, 112, 113, 146],
  "text-merger": [122, 123, 124],
  "hwp-editor": [109, 144],
  "video-studio": [76, 110],
  "excel-cleaner": [149],
  "qr-studio": [128, 129],
  "timezone-calculator": [126],
  "security-tools": [127],
  compact: [3, 74, 75, 99, 106, 107, 108, 119, 121, 125, 135, 140],
}));

const expectedCategoryCounts = Object.freeze({
  "cross-shared": 31,
  "p2-shared": 21,
  orphan: 2,
  "excel-compare": 27,
  "excel-merger": 17,
  "document-compare": 13,
  "image-studio": 7,
  "pdf-editor": 5,
  "office-editor": 4,
  "audio-studio": 4,
  "text-merger": 3,
  "hwp-editor": 2,
  "video-studio": 2,
  "excel-cleaner": 1,
  "qr-studio": 2,
  "timezone-calculator": 1,
  "security-tools": 1,
  compact: 12,
});

const categoryContracts = Object.freeze({
  "p2-shared": { consumers: ["shared:app-shell-and-public-pages"], lastRemovalBundle: "B-shared" },
  "excel-compare": { consumers: ["tool:excel-compare"], lastRemovalBundle: "B4" },
  "excel-merger": { consumers: ["tool:excel-merger"], lastRemovalBundle: "B4" },
  "document-compare": { consumers: ["tool:document-compare", "screen:word-compare-result"], lastRemovalBundle: "B3" },
  "image-studio": { consumers: ["tool:image-studio"], lastRemovalBundle: "B6" },
  "pdf-editor": { consumers: ["tool:pdf-editor"], lastRemovalBundle: "B5a" },
  "office-editor": { consumers: ["tool:office-editor"], lastRemovalBundle: "B2" },
  "audio-studio": { consumers: ["tool:audio-studio"], lastRemovalBundle: "B5a" },
  "text-merger": { consumers: ["tool:text-merger"], lastRemovalBundle: "B2" },
  "hwp-editor": { consumers: ["tool:hwp-editor"], lastRemovalBundle: "B2" },
  "video-studio": { consumers: ["tool:video-studio"], lastRemovalBundle: "B5b" },
  "excel-cleaner": { consumers: ["tool:excel-cleaner"], lastRemovalBundle: "B3" },
  "qr-studio": { consumers: ["tool:qr-studio"], lastRemovalBundle: "B4" },
  "timezone-calculator": { consumers: ["tool:timezone-calculator"], lastRemovalBundle: "B2" },
  "security-tools": { consumers: ["tool:security-tools"], lastRemovalBundle: "B1" },
  orphan: { consumers: [], lastRemovalBundle: "pre-B1" },
});

const crossContracts = new Map([
  [1, [["tool:excel-compare", "tool:hwp-editor", "tool:image-studio", "tool:pdf-editor", "tool:qr-studio", "tool:security-tools", "tool:text-merger"], "B6"]],
  [4, [["shared:public-pages", "tool:document-compare", "tool:excel-cleaner", "tool:excel-compare"], "B-shared"]],
  [5, [["shared:privacy-banner-and-about", "tool:document-compare"], "B-shared"]],
  [6, [["shared:home", "tool:document-compare", "tool:excel-cleaner", "tool:excel-compare"], "B-shared"]],
  [7, [["shared:home", "tool:document-compare", "tool:excel-cleaner", "tool:excel-compare"], "B-shared"]],
  [8, [["shared:home", "tool:document-compare", "tool:excel-cleaner", "tool:excel-compare"], "B-shared"]],
  [24, [["tool:excel-compare", "shared:file-drop-zone-adapter"], "B4"]],
  [60, [["tool:excel-cleaner", "tool:excel-compare", "tool:excel-merger"], "B4"]],
  [61, [["tool:excel-cleaner", "tool:excel-compare", "tool:excel-merger"], "B4"]],
  [65, [["tool:excel-merger", "tool:pdf-editor", "shared:toggle-row-adapter"], "B5a"]],
  [66, [["tool:excel-merger", "tool:pdf-editor", "shared:toggle-row-adapter"], "B5a"]],
  [67, [["tool:excel-merger", "tool:pdf-editor", "shared:toggle-row-adapter"], "B5a"]],
  [68, [["tool:excel-merger", "tool:pdf-editor", "shared:toggle-row-adapter"], "B5a"]],
  [69, [["tool:excel-merger", "tool:pdf-editor", "shared:toggle-row-adapter"], "B5a"]],
  [105, [["tool:hwp-editor", "tool:qr-studio", "tool:audio-studio", "tool:image-studio"], "B6"]],
  [130, [["tool:excel-merger", "tool:pdf-editor"], "B5a"]],
  [131, [["tool:excel-merger", "tool:pdf-editor"], "B5a"]],
  [132, [["tool:document-compare", "tool:hwp-editor", "tool:office-editor", "tool:image-studio", "shared:legacy-tool-root"], "B6"]],
  [133, [["tool:excel-cleaner", "tool:excel-compare", "tool:excel-merger", "tool:pdf-editor", "tool:image-studio"], "B6"]],
  [134, [["shared:home", "tool:document-compare", "tool:excel-cleaner", "tool:excel-compare"], "B-shared"]],
  [143, [["tool:hwp-editor", "tool:qr-studio", "tool:audio-studio", "tool:image-studio"], "B6"]],
  [151, [["tool:excel-merger", "tool:pdf-editor", "shared:toggle-row-adapter"], "B5a"]],
]);

for (const index of range(77, 85)) {
  crossContracts.set(index, [[
    "shared:privacy-consent", "tool:hwp-editor", "tool:office-editor", "tool:image-studio",
  ], "B-shared"]);
}

const compactContracts = new Map([
  [3, [["shared:app-shell-brand"], "B-shared"]],
  [74, [["tool:excel-merger"], "B4"]],
  [75, [["tool:excel-merger"], "B4"]],
  [99, [["tool:pdf-editor"], "B5a"]],
  [106, [["tool:hwp-editor"], "B2"]],
  [107, [["tool:hwp-editor"], "B2"]],
  [108, [["tool:hwp-editor"], "B2"]],
  [119, [["tool:image-studio"], "B6"]],
  [121, [["tool:hwp-editor", "tool:pdf-editor"], "B5a"]],
  [125, [["tool:security-tools"], "B1"]],
  [135, [["tool:text-formatter", "tool:text-tools", "tool:work-calculator", "tool:security-tools", "tool:image-privacy", "tool:data-converter", "tool:qr-studio"], "B4"]],
  [140, [["tool:pdf-editor"], "B5a"]],
]);

const currentStateOverrides = new Map([
  [4, {
    currentState: "active",
    removedIn: null,
    currentSelector: ".eyebrow",
    lastUpdatedIn: "P-final",
  }],
  [43, { currentState: "removed", removedIn: "pre-B1" }],
  [45, { currentState: "removed", removedIn: "pre-B1" }],
  [24, {
    currentState: "legacy-arm-removed",
    removedIn: "B4",
    currentSelector: ".ui-field-label",
  }],
  ...[
    ...range(25, 42), 44, 46,
    ...range(47, 64), 74, 75, 86, 128, 129, 135,
    ...range(136, 139), 147, 148, 150,
  ].map((index) => [index, {
    currentState: "removed",
    removedIn: "B4",
  }]),
  ...[95, 96, 97, 106, 107, 108, 109, 122, 123, 124, 126, 142, 144].map((index) => [index, {
    currentState: "removed",
    removedIn: "B2",
  }]),
  ...[70, 71, 72, 73, 87, 88, 89, 90, 91, 92, 93, 94, 141, 149].map((index) => [index, {
    currentState: "removed",
    removedIn: "B3",
  }]),
  ...[99, 100, 101, 102, 103, 104, 111, 112, 113, 121, 130, 131, 140, 146].map((index) => [index, {
    currentState: "removed",
    removedIn: "B5a",
  }]),
  ...[76, 110].map((index) => [index, {
    currentState: "removed",
    removedIn: "B5b",
  }]),
  ...[1, 105, 114, 115, 116, 117, 118, 119, 120, 133, 143, 145].map((index) => [index, {
    currentState: "removed",
    removedIn: "B6",
  }]),
  [65, { currentState: "legacy-arm-removed", removedIn: "B5a", currentSelector: ".ui-settings-row" }],
  [66, { currentState: "legacy-arm-removed", removedIn: "B5a", currentSelector: ".ui-settings-row + .ui-settings-row" }],
  [67, { currentState: "legacy-arm-removed", removedIn: "B5a", currentSelector: ".ui-settings-row > div" }],
  [68, { currentState: "legacy-arm-removed", removedIn: "B5a", currentSelector: ".ui-settings-row strong" }],
  [69, { currentState: "legacy-arm-removed", removedIn: "B5a", currentSelector: ".ui-settings-row small" }],
  [125, { currentState: "removed", removedIn: "B1" }],
  [127, { currentState: "removed", removedIn: "B1" }],
  [132, {
    currentState: "removed",
    removedIn: "B3",
    lastUpdatedIn: "S1",
  }],
  [151, {
    currentState: "removed",
    removedIn: "B4",
    lastUpdatedIn: "B-shared",
  }],
  ...[2, 3, ...range(8, 23), 77, 78, 79, 80, 81, 82, 83, 84, 85, 98, 152, 153, 154, 155].map((index) => [index, {
    currentState: "removed",
    removedIn: "B-shared",
  }]),
  ...[24, 65, 66, 67, 68, 69].map((index) => [index, {
    currentState: "removed",
    removedIn: index === 24 ? "B4" : "B5a",
    lastUpdatedIn: "B-shared",
  }]),
  ...[6, 7, 134].map((index) => [index, {
    currentState: "removed",
    removedIn: "S1",
    lastUpdatedIn: "S1",
  }]),
]);

const categoryByIndex = new Map();
for (const [category, indexes] of categoryIndexes) {
  for (const index of indexes) {
    if (categoryByIndex.has(index)) throw new Error(`Legacy manifest index ${index} is assigned more than once.`);
    categoryByIndex.set(index, category);
  }
}

const baselineCss = execFileSync("git", ["show", `${baselineCommit}:src/styles/global.css`], {
  cwd: repositoryRoot,
  encoding: "utf8",
});
const baselineRules = [];
postcss.parse(baselineCss, { from: `${baselineCommit}:src/styles/global.css` }).walkRules((rule) => {
  const classNames = [...rule.selector.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)].map((match) => match[1]);
  const matchedTokens = [...new Set(classNames.filter((className) => legacyClassTokens.has(className)))];
  if (!matchedTokens.length) return;
  baselineRules.push({
    baselineLine: rule.source.start.line,
    selector: normalizeSelector(rule.selector),
    legacyTokens: matchedTokens,
  });
});

if (baselineRules.length !== 155) throw new Error(`Expected 155 baseline legacy rules, found ${baselineRules.length}.`);
if (categoryByIndex.size !== baselineRules.length) throw new Error(`Expected ${baselineRules.length} categorized rules, found ${categoryByIndex.size}.`);

const entries = baselineRules.map((rule, zeroBasedIndex) => {
  const index = zeroBasedIndex + 1;
  const category = categoryByIndex.get(index);
  const [consumers, lastRemovalBundle] = category === "cross-shared"
    ? requireContract(crossContracts, index, category)
    : category === "compact"
      ? requireContract(compactContracts, index, category)
      : [categoryContracts[category].consumers, categoryContracts[category].lastRemovalBundle];
  const state = currentStateOverrides.get(index) ?? { currentState: "active", removedIn: null };
  return {
    id: `legacy-${String(index).padStart(3, "0")}`,
    ...rule,
    category,
    consumers,
    refCount: consumers.length,
    lastRemovalBundle,
    ...state,
  };
});

const actualCategoryCounts = Object.fromEntries(Object.keys(expectedCategoryCounts).map((category) => [
  category,
  entries.filter((entry) => entry.category === category).length,
]));
if (JSON.stringify(actualCategoryCounts) !== JSON.stringify(expectedCategoryCounts)) {
  throw new Error(`Legacy category counts changed: ${JSON.stringify(actualCategoryCounts)}.`);
}

const currentSelectors = [];
postcss.parse(fs.readFileSync(stylesheetPath, "utf8"), { from: stylesheetPath }).walkRules((rule) => {
  currentSelectors.push(normalizeSelector(rule.selector));
});
const missingActive = entries.filter((entry) => entry.currentState === "active" && !currentSelectors.includes(entry.currentSelector ?? entry.selector));
const presentRemoved = entries.filter((entry) => entry.currentState === "removed" && currentSelectors.includes(entry.selector));
const invalidSplits = entries.filter((entry) => entry.currentState === "legacy-arm-removed" && (
  currentSelectors.includes(entry.selector) || !currentSelectors.includes(entry.currentSelector)
));
if (missingActive.length || presentRemoved.length || invalidSplits.length) {
  throw new Error([
    missingActive.length ? `Active manifest selectors missing from global.css: ${missingActive.map(({ id }) => id).join(", ")}` : null,
    presentRemoved.length ? `Removed manifest selectors remain in global.css: ${presentRemoved.map(({ id }) => id).join(", ")}` : null,
    invalidSplits.length ? `Split manifest selectors do not match global.css: ${invalidSplits.map(({ id }) => id).join(", ")}` : null,
  ].filter(Boolean).join("\n"));
}

const manifest = {
  schemaVersion: 1,
  baseline: {
    branch: "ui-migration",
    commit: baselineCommit,
    stylesheet: "src/styles/global.css",
    legacyRuleCount: entries.length,
    compactRuleCount: actualCategoryCounts.compact,
    nonCompactRuleCount: entries.length - actualCategoryCounts.compact,
  },
  ownershipSemantics: {
    refCount: "Number of named tool or shared-screen consumers for the legacy selector rule at the baseline commit.",
    lastRemovalBundle: "The final planned bundle that can remove the legacy rule or its legacy selector arm after its refCount reaches zero.",
    mixedSelectors: "A mixed legacy/ui selector keeps its non-legacy arm until that arm has its own zero refCount; currentState tracks the baseline legacy rule inventory.",
  },
  categoryCounts: actualCategoryCounts,
  entries,
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Legacy owner manifest verified: ${entries.length} rules (${manifest.baseline.nonCompactRuleCount} non-compact + ${manifest.baseline.compactRuleCount} compact); ${entries.filter(({ currentState }) => currentState === "removed").length} removed, ${entries.filter(({ currentState }) => currentState === "legacy-arm-removed").length} split, ${entries.filter(({ currentState }) => currentState === "active").length} active.`);
console.log(`Wrote ${path.relative(repositoryRoot, manifestPath)}.`);

function normalizeSelector(selector) {
  return selector.replace(/\s+/g, " ").trim();
}

function requireContract(contracts, index, category) {
  const contract = contracts.get(index);
  if (!contract) throw new Error(`Missing ${category} contract for legacy rule ${index}.`);
  return contract;
}
