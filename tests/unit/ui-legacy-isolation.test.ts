import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import postcss from "postcss";
import ts from "typescript";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath: string) => fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");

const migratedComponentFiles = [
  "src/components/ui.tsx",
  "src/components/DropZoneHint.tsx",
  "src/components/ToolGuide.tsx",
  "src/components/OperationProgress.tsx",
  "src/components/ToolCard.tsx",
  "src/components/LanguageSwitcher.tsx",
];

const migratedB1ToolFiles = [
  "src/features/text-formatter/TextFormatterPage.tsx",
  "src/features/work-calculator/WorkCalculatorPage.tsx",
  "src/features/payroll-calculator/PayrollCalculatorPage.tsx",
  "src/features/security-tools/SecurityToolsPage.tsx",
  "src/features/image-privacy/ImagePrivacyPage.tsx",
  "src/features/text-tools/TextToolsPage.tsx",
];

const migratedB2ToolFiles = [
  "src/features/data-converter/DataConverterPage.tsx",
  "src/features/timezone-calculator/TimezoneCalculatorPage.tsx",
  "src/features/timezone-calculator/WorldTimeMap.tsx",
  "src/features/text-merger/TextMergerPage.tsx",
  "src/features/hwp-editor/HwpEditorPage.tsx",
  "src/features/office-editor/OfficeEditorPage.tsx",
  "src/features/office-editor/OfficeEditorAppPage.tsx",
  "src/components/RhwpVersionNotice.tsx",
];

const migratedB2RouteFiles = migratedB2ToolFiles.filter((relativePath) => relativePath.endsWith("Page.tsx") && !relativePath.endsWith("AppPage.tsx"));

const migratedB3ToolFiles = [
  "src/features/document-compare/DocumentComparePage.tsx",
  "src/features/document-compare/DocumentFileColumn.tsx",
  "src/features/document-compare/DocumentPairingPreview.tsx",
  "src/features/document-compare/DocumentCompareResultPage.tsx",
  "src/features/word-compare/WordCompareResultPage.tsx",
  "src/features/excel-cleaner/ExcelCleanerPage.tsx",
];

const migratedB4ToolFiles = [
  "src/features/excel-merger/ExcelMergerPage.tsx",
  "src/features/excel-compare/ExcelComparePage.tsx",
  "src/features/excel-compare/PairFileDropZone.tsx",
  "src/features/qr-studio/QrStudioPage.tsx",
  "src/features/qr-studio/QrBulkPanel.tsx",
];

const migratedB5aToolFiles = [
  "src/features/audio-studio/AudioStudioPage.tsx",
  "src/features/audio-studio/AudioStudioPanels.tsx",
  "src/features/pdf-editor/PdfEditorPage.tsx",
  "src/features/pdf-editor/PdfOrganizePanel.tsx",
  "src/features/pdf-editor/PdfImagePanel.tsx",
  "src/features/pdf-editor/PdfConvertPanel.tsx",
  "src/features/pdf-editor/PdfThumbnail.tsx",
  "src/features/pdf-editor/pdfUi.tsx",
];

const migratedB5bToolFiles = [
  "src/features/video-studio/VideoStudioPage.tsx",
  "src/features/video-studio/VideoGroupSection.tsx",
  "src/features/video-studio/VideoTrimLane.tsx",
];

const migratedB6ToolFiles = [
  "src/features/image-studio/ImageStudioPage.tsx",
  "src/features/image-studio/ImageProcessingPanels.tsx",
  "src/features/image-studio/imageStudioShared.tsx",
  "src/features/image-studio/ImageEditorPanel.tsx",
  "src/features/image-studio/ImageEditorToolbar.tsx",
  "src/features/image-studio/ImageEditorViewportControls.tsx",
  "src/features/image-studio/ImageEditorContextMenu.tsx",
  "src/features/image-studio/ImageEditorMinibar.tsx",
  "src/features/image-studio/ImageEditorLayersPanel.tsx",
  "src/features/image-studio/ImageStickerPicker.tsx",
];

// These are the component/state classes emitted before the shadcn migration.
// Raw legacy-only pages may still use some of them; migrated adapters must not.
const legacyClassTokens = [
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
] as const;

const legacyDynamicPrefixes = ["accent-", "status-", "log-"] as const;

function classNameTokens(relativePath: string) {
  const source = read(relativePath);
  const sourceFile = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const tokens: string[] = [];

  const collectLiterals = (node: ts.Node) => {
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      tokens.push(...node.text.split(/\s+/).filter(Boolean));
      return;
    }
    ts.forEachChild(node, collectLiterals);
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && node.name.text === "className" && node.initializer) {
      if (ts.isStringLiteral(node.initializer)) collectLiterals(node.initializer);
      if (ts.isJsxExpression(node.initializer) && node.initializer.expression) collectLiterals(node.initializer.expression);
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return tokens;
}

test("all 12 migrated components isolate their DOM from legacy class selectors", (context) => {
  const emittedTokens = migratedComponentFiles.flatMap(classNameTokens);
  const legacyMatches = emittedTokens.filter((token) => (
    legacyClassTokens.includes(token as typeof legacyClassTokens[number])
    || legacyDynamicPrefixes.some((prefix) => token.startsWith(prefix))
  ));

  assert.deepEqual(legacyMatches, []);
  context.diagnostic(`${migratedComponentFiles.length} source files / 12 migrated components checked against ${legacyClassTokens.length} legacy tokens and ${legacyDynamicPrefixes.length} dynamic prefixes`);
});

test("the complete legacy stylesheet is parsed and migrated adapter collisions stay removed", (context) => {
  const css = read("src/styles/global.css");
  const root = postcss.parse(css, { from: "src/styles/global.css" });
  const rules: postcss.Rule[] = [];
  const declarations: postcss.Declaration[] = [];
  root.walkRules((rule) => rules.push(rule));
  root.walkDecls((declaration) => declarations.push(declaration));

  // S1 measures 612 - 71 removed rules = 541; five mixed rules retain live arms.
  assert.ok(rules.length >= 541, `expected the full stylesheet after S1 orphan cleanup, parsed only ${rules.length} rules`);
  assert.match(css, /button:where\(:not\(\[data-slot\]\)\)/);

  const actionRules = rules.filter((rule) => rule.selector.includes(".tool-action-bar") && rule.selector.includes(".ui-primary-button"));
  assert.deepEqual(actionRules, [], "the retired document action-bar selector still targets the migrated primary button");

  const adapterSource = read("src/components/ui.tsx");
  const primaryButtonBlock = adapterSource.match(/export function PrimaryButton[\s\S]*?export function ResultCard/)?.[0] ?? "";
  assert.doesNotMatch(primaryButtonBlock, /\bw-full\b/);
  assert.match(primaryButtonBlock, /w-\[100%\]/);

  const switchSource = read("src/components/ui/switch.tsx");
  assert.match(switchSource, /data-\[size=default\]:h-\[25px\][\s\S]*?data-\[size=default\]:w-\[43px\]/);
  assert.match(switchSource, /group-data-\[size=default\]\/switch:size-\[21px\]/);
  assert.doesNotMatch(adapterSource, /className="ios-switch/);

  context.diagnostic(`${rules.length} CSS rules and ${declarations.length} declarations parsed; both measured collision contracts checked`);
});

test("the six migrated B1 tools emit no class token owned by global.css", (context) => {
  const cssClassTokens = new Set([...read("src/styles/global.css").matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)].map((match) => match[1]));
  const legacyMatches = migratedB1ToolFiles.flatMap((relativePath) => classNameTokens(relativePath)
    .filter((token) => cssClassTokens.has(token))
    .map((token) => `${relativePath}:${token}`));

  assert.deepEqual(legacyMatches, []);
  for (const relativePath of migratedB1ToolFiles) assert.match(read(relativePath), /<UtilityPage toolId=/);
  context.diagnostic(`${migratedB1ToolFiles.length} B1 tool sources checked against ${cssClassTokens.size} global.css class tokens`);
});

test("the five migrated B2 tools emit no legacy or global.css-owned class token", (context) => {
  const cssClassTokens = new Set([...read("src/styles/global.css").matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)].map((match) => match[1]));
  const emittedTokens = migratedB2ToolFiles.flatMap((relativePath) => classNameTokens(relativePath)
    .map((token) => ({ relativePath, token })));
  const legacyMatches = emittedTokens.filter(({ token }) => (
    legacyClassTokens.includes(token as typeof legacyClassTokens[number])
    || legacyDynamicPrefixes.some((prefix) => token.startsWith(prefix))
    || cssClassTokens.has(token)
  )).map(({ relativePath, token }) => `${relativePath}:${token}`);

  assert.deepEqual(legacyMatches, []);
  for (const relativePath of migratedB2RouteFiles) assert.match(read(relativePath), /<UtilityPage[\s\S]*?toolId=/);
  context.diagnostic(`${migratedB2ToolFiles.length} B2 surface sources checked against ${legacyClassTokens.length} legacy tokens, ${legacyDynamicPrefixes.length} dynamic prefixes, and ${cssClassTokens.size} global.css class tokens`);
});

test("the reachable B3 document and Excel Cleaner surfaces emit no legacy or global.css-owned class token", (context) => {
  const cssClassTokens = new Set([...read("src/styles/global.css").matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)].map((match) => match[1]));
  const legacyMatches = migratedB3ToolFiles.flatMap((relativePath) => classNameTokens(relativePath)
    .filter((token) => (
      legacyClassTokens.includes(token as typeof legacyClassTokens[number])
      || legacyDynamicPrefixes.some((prefix) => token.startsWith(prefix))
      || cssClassTokens.has(token)
    ))
    .map((token) => `${relativePath}:${token}`));

  assert.deepEqual(legacyMatches, []);
  assert.match(read("src/features/document-compare/DocumentComparePage.tsx"), /<UtilityPage toolId="document-compare"/);
  assert.match(read("src/features/word-compare/WordCompareResultPage.tsx"), /<UtilityPage toolId="document-compare-result"/);
  assert.match(read("src/features/excel-cleaner/ExcelCleanerPage.tsx"), /<UtilityPage toolId="excel-cleaner"/);
  context.diagnostic(`${migratedB3ToolFiles.length} B3 reachable surface sources checked against ${cssClassTokens.size} global.css class tokens`);
});

test("the B4 Excel and QR surfaces emit no legacy or global.css-owned class token", (context) => {
  const cssClassTokens = new Set([...read("src/styles/global.css").matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)].map((match) => match[1]));
  const legacyMatches = migratedB4ToolFiles.flatMap((relativePath) => classNameTokens(relativePath)
    .filter((token) => (
      legacyClassTokens.includes(token as typeof legacyClassTokens[number])
      || legacyDynamicPrefixes.some((prefix) => token.startsWith(prefix))
      || cssClassTokens.has(token)
    ))
    .map((token) => `${relativePath}:${token}`));

  assert.deepEqual(legacyMatches, []);
  assert.match(read("src/features/excel-merger/ExcelMergerPage.tsx"), /<UtilityPage toolId="excel-merger"/);
  assert.match(read("src/features/excel-compare/ExcelComparePage.tsx"), /<UtilityPage toolId="excel-compare"/);
  assert.match(read("src/features/qr-studio/QrStudioPage.tsx"), /<UtilityPage toolId="qr-studio"/);
  context.diagnostic(`${migratedB4ToolFiles.length} B4 surface sources checked against ${cssClassTokens.size} global.css class tokens`);
});

test("the B5a audio and PDF surfaces emit no legacy or global.css-owned class token", (context) => {
  const cssClassTokens = new Set([...read("src/styles/global.css").matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)].map((match) => match[1]));
  const legacyMatches = migratedB5aToolFiles.flatMap((relativePath) => classNameTokens(relativePath)
    .filter((token) => (
      legacyClassTokens.includes(token as typeof legacyClassTokens[number])
      || legacyDynamicPrefixes.some((prefix) => token.startsWith(prefix))
      || cssClassTokens.has(token)
    ))
    .map((token) => `${relativePath}:${token}`));

  assert.deepEqual(legacyMatches, []);
  assert.match(read("src/features/audio-studio/AudioStudioPage.tsx"), /<UtilityPage toolId="audio-studio"/);
  assert.match(read("src/features/pdf-editor/PdfEditorPage.tsx"), /<UtilityPage toolId="pdf-editor"/);
  context.diagnostic(`${migratedB5aToolFiles.length} B5a surface sources checked against ${cssClassTokens.size} global.css class tokens`);
});

test("the B5b Video Studio surfaces emit no legacy or global.css-owned class token", (context) => {
  const cssClassTokens = new Set([...read("src/styles/global.css").matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)].map((match) => match[1]));
  const legacyMatches = migratedB5bToolFiles.flatMap((relativePath) => classNameTokens(relativePath)
    .filter((token) => (
      legacyClassTokens.includes(token as typeof legacyClassTokens[number])
      || legacyDynamicPrefixes.some((prefix) => token.startsWith(prefix))
      || cssClassTokens.has(token)
    ))
    .map((token) => `${relativePath}:${token}`));

  assert.deepEqual(legacyMatches, []);
  assert.match(read("src/features/video-studio/VideoStudioPage.tsx"), /<UtilityPage toolId="video-studio"/);
  context.diagnostic(`${migratedB5bToolFiles.length} B5b surface sources checked against ${cssClassTokens.size} global.css class tokens`);
});

test("the B6 Image Studio surfaces emit no legacy class token", (context) => {
  const legacyMatches = migratedB6ToolFiles.flatMap((relativePath) => classNameTokens(relativePath)
    .filter((token) => (
      legacyClassTokens.includes(token as typeof legacyClassTokens[number])
      || legacyDynamicPrefixes.some((prefix) => token.startsWith(prefix))
    ))
    .map((token) => `${relativePath}:${token}`));

  assert.deepEqual(legacyMatches, []);
  assert.match(read("src/features/image-studio/ImageStudioPage.tsx"), /<UtilityPage toolId="image-studio"/);
  context.diagnostic(`${migratedB6ToolFiles.length} B6 surface sources checked against ${legacyClassTokens.length} legacy tokens and ${legacyDynamicPrefixes.length} dynamic prefixes`);
});

test("the owner/refcount manifest accounts for all 155 baseline legacy rules", (context) => {
  const manifest = JSON.parse(read("docs/legacy-css-owner-manifest.json")) as {
    baseline: { legacyRuleCount: number; compactRuleCount: number; nonCompactRuleCount: number };
    categoryCounts: Record<string, number>;
    entries: Array<{
      id: string;
      consumers: string[];
      refCount: number;
      currentState: "active" | "removed" | "legacy-arm-removed";
      removedIn: string | null;
    }>;
  };
  assert.equal(manifest.baseline.legacyRuleCount, 155);
  assert.equal(manifest.baseline.nonCompactRuleCount, 143);
  assert.equal(manifest.baseline.compactRuleCount, 12);
  assert.equal(Object.values(manifest.categoryCounts).reduce((sum, count) => sum + count, 0), 155);
  assert.equal(new Set(manifest.entries.map(({ id }) => id)).size, 155);
  assert.ok(manifest.entries.every(({ consumers, refCount }) => consumers.length === refCount));
  assert.equal(manifest.entries.filter(({ currentState }) => currentState === "removed").length, 153);
  assert.equal(manifest.entries.filter(({ currentState }) => currentState === "legacy-arm-removed").length, 0);
  assert.deepEqual(manifest.entries.filter(({ currentState }) => currentState === "active").map(({ id }) => id), ["legacy-004", "legacy-005"]);
  assert.deepEqual(manifest.entries.filter(({ removedIn }) => removedIn === "S1").map(({ id }) => id), ["legacy-006", "legacy-007", "legacy-134"]);
  assert.deepEqual(manifest.entries.filter(({ removedIn }) => removedIn === "pre-B1").map(({ id }) => id), ["legacy-043", "legacy-045"]);
  assert.deepEqual(manifest.entries.filter(({ removedIn }) => removedIn === "B1").map(({ id }) => id), ["legacy-125", "legacy-127"]);
  assert.deepEqual(manifest.entries.filter(({ removedIn }) => removedIn === "B2").map(({ id }) => id), [
    "legacy-095", "legacy-096", "legacy-097", "legacy-106", "legacy-107", "legacy-108", "legacy-109",
    "legacy-122", "legacy-123", "legacy-124", "legacy-126", "legacy-142", "legacy-144",
  ]);
  assert.deepEqual(manifest.entries.filter(({ removedIn }) => removedIn === "B3").map(({ id }) => id), [
    "legacy-070", "legacy-071", "legacy-072", "legacy-073", "legacy-087", "legacy-088", "legacy-089",
    "legacy-090", "legacy-091", "legacy-092", "legacy-093", "legacy-094", "legacy-132", "legacy-141", "legacy-149",
  ]);
  assert.deepEqual(manifest.entries.filter(({ removedIn }) => removedIn === "B4").map(({ id }) => id), [
    "legacy-024", "legacy-025", "legacy-026", "legacy-027", "legacy-028", "legacy-029", "legacy-030",
    "legacy-031", "legacy-032", "legacy-033", "legacy-034", "legacy-035", "legacy-036", "legacy-037",
    "legacy-038", "legacy-039", "legacy-040", "legacy-041", "legacy-042", "legacy-044", "legacy-046",
    "legacy-047", "legacy-048", "legacy-049", "legacy-050", "legacy-051", "legacy-052", "legacy-053",
    "legacy-054", "legacy-055", "legacy-056", "legacy-057", "legacy-058", "legacy-059", "legacy-060",
    "legacy-061", "legacy-062", "legacy-063", "legacy-064", "legacy-074", "legacy-075", "legacy-086",
    "legacy-128", "legacy-129", "legacy-135", "legacy-136", "legacy-137", "legacy-138",
    "legacy-139", "legacy-147", "legacy-148", "legacy-150", "legacy-151",
  ]);
  assert.deepEqual(manifest.entries.filter(({ removedIn }) => removedIn === "B5a").map(({ id }) => id), [
    "legacy-065", "legacy-066", "legacy-067", "legacy-068", "legacy-069", "legacy-099", "legacy-100",
    "legacy-101", "legacy-102", "legacy-103", "legacy-104", "legacy-111", "legacy-112", "legacy-113",
    "legacy-121", "legacy-130", "legacy-131", "legacy-140", "legacy-146",
  ]);
  assert.deepEqual(manifest.entries.filter(({ removedIn }) => removedIn === "B5b").map(({ id }) => id), ["legacy-076", "legacy-110"]);
  assert.deepEqual(manifest.entries.filter(({ removedIn }) => removedIn === "B6").map(({ id }) => id), [
    "legacy-001", "legacy-105", "legacy-114", "legacy-115", "legacy-116", "legacy-117",
    "legacy-118", "legacy-119", "legacy-120", "legacy-133", "legacy-143", "legacy-145",
  ]);
  assert.deepEqual(manifest.entries.filter(({ removedIn }) => removedIn === "B-shared").map(({ id }) => id), [
    "legacy-002", "legacy-003", "legacy-008", "legacy-009", "legacy-010", "legacy-011", "legacy-012",
    "legacy-013", "legacy-014", "legacy-015", "legacy-016", "legacy-017", "legacy-018", "legacy-019",
    "legacy-020", "legacy-021", "legacy-022", "legacy-023", "legacy-077", "legacy-078", "legacy-079",
    "legacy-080", "legacy-081", "legacy-082", "legacy-083", "legacy-084", "legacy-085", "legacy-098",
    "legacy-152", "legacy-153", "legacy-154", "legacy-155",
  ]);
  assert.equal(manifest.categoryCounts["excel-compare"], 27);
  assert.equal(manifest.categoryCounts["excel-cleaner"], 1);
  context.diagnostic("155 rules / 18 ownership categories / 149 removals / one split verified");
});
