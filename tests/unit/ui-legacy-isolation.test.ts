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
