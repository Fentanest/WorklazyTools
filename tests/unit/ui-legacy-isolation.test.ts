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

test("the complete legacy stylesheet is parsed and critical adapter collisions stay separated", (context) => {
  const css = read("src/styles/global.css");
  const root = postcss.parse(css, { from: "src/styles/global.css" });
  const rules: postcss.Rule[] = [];
  const declarations: postcss.Declaration[] = [];
  root.walkRules((rule) => rules.push(rule));
  root.walkDecls((declaration) => declarations.push(declaration));

  assert.ok(rules.length >= 2_049, `expected the full legacy sheet, parsed only ${rules.length} rules`);
  assert.match(css, /button:where\(:not\(\[data-slot\]\)\)/);

  const actionRule = rules.find((rule) => rule.selector.includes(".tool-action-bar") && rule.selector.includes(".ui-primary-button"));
  assert.ok(actionRule, "migrated primary button is missing the tool action bar contract");
  assert.equal(actionRule.nodes.find((node) => node.type === "decl" && node.prop === "width")?.value, "190px");
  assert.equal(actionRule.nodes.find((node) => node.type === "decl" && node.prop === "flex")?.value, "0 0 auto");

  const adapterSource = read("src/components/ui.tsx");
  const primaryButtonBlock = adapterSource.match(/export function PrimaryButton[\s\S]*?export function ResultCard/)?.[0] ?? "";
  assert.doesNotMatch(primaryButtonBlock, /\bw-full\b/);

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
  assert.equal(manifest.entries.filter(({ currentState }) => currentState === "removed").length, 4);
  assert.equal(manifest.entries.filter(({ currentState }) => currentState === "legacy-arm-removed").length, 1);
  assert.deepEqual(manifest.entries.filter(({ removedIn }) => removedIn === "pre-B1").map(({ id }) => id), ["legacy-043", "legacy-045"]);
  assert.deepEqual(manifest.entries.filter(({ removedIn }) => removedIn === "B1").map(({ id }) => id), ["legacy-125", "legacy-127", "legacy-135"]);
  context.diagnostic("155 rules / 18 ownership categories / four removals / one split verified");
});
