import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath: string) => fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
const componentFiles = fs.readdirSync(path.join(repositoryRoot, "src/features"), { recursive: true })
  .filter((entry): entry is string => typeof entry === "string" && entry.endsWith(".tsx"));

test("ToolGuide keeps its public structure and localized eyebrow through shadcn cards", () => {
  const source = read("src/components/ToolGuide.tsx");
  const consumers = componentFiles.filter((entry) => read(path.join("src/features", entry)).includes("<ToolGuide"));

  assert.equal(consumers.length, 22);
  assert.match(source, /<Card as="section"[\s\S]*?aria-labelledby="tool-guide-title"/);
  assert.match(source, /data-ui-component="tool-guide"[\s\S]*?className="ui-tool-guide-heading"[\s\S]*?t\("guide\.eyebrow"\)[\s\S]*?<h2 id="tool-guide-title"/);
  assert.match(source, /className="ui-tool-guide-grid"[\s\S]*?<Card as="article"[\s\S]*?block\.paragraphs[\s\S]*?block\.items/);
  assert.match(source, /className="ui-tool-faq"[\s\S]*?t\("guide\.faq"\)[\s\S]*?<details[\s\S]*?<summary[\s\S]*?<p>/);
});

test("OperationProgress keeps W-D stage rows, active spinner, percentages, and progress semantics", () => {
  const source = read("src/components/OperationProgress.tsx");
  const progressSource = read("src/components/ui/progress.tsx");
  const baseProgressSource = read("node_modules/@base-ui/react/progress/root/ProgressRoot.mjs");
  const consumers = componentFiles.filter((entry) => read(path.join("src/features", entry)).includes("<OperationProgress"));

  assert.equal(consumers.length, 14);
  assert.match(source, /entry\.id === activeLogId \|\| Boolean\(entry\.stageKey && entry\.stageKey === activeStageKey\)/);
  assert.match(source, /isCurrent && status === "running" \? LoaderCircle : Circle/);
  assert.match(source, /className=\{isCurrent && status === "running" \? "animate-spin" : ""\}/);
  assert.match(source, /className="ui-operation-log-progress">\{entry\.progress\}%<\/b>/);
  assert.match(source, /<ol[\s\S]*?className="ui-operation-log"[\s\S]*?aria-live="polite"[\s\S]*?key=\{entry\.id\}/);
  assert.match(source, /<Progress[\s\S]*?className="ui-operation-progress-track[\s\S]*?value=\{progress\}[\s\S]*?aria-label=\{message\}/);
  assert.match(progressSource, /ProgressPrimitive\.Root[\s\S]*?value=\{value\}/);
  assert.match(baseProgressSource, /'aria-valuenow': clampedValue/);
  for (const declaration of ["progressIndicatorClasses", "progressStateClasses"]) {
    const block = source.match(new RegExp(`const ${declaration} = \\{([\\s\\S]*?)\\n\\} satisfies`))?.[1];
    assert.ok(block, `${declaration} declaration is missing`);
    for (const accent of ["green", "blue", "violet", "orange", "pink", "sky"]) assert.match(block, new RegExp(`\\n  ${accent}:`));
  }
});

test("ToolCard keeps a link root, analytics behavior, and all six accent identities", () => {
  const source = read("src/components/ToolCard.tsx");
  const registry = read("src/app/toolRegistry.ts");

  assert.match(source, /<Card[\s\S]*?as=\{Link\}[\s\S]*?data-ui-component="tool-card"[\s\S]*?className=\{cn\(`ui-tool-card ui-accent-\$\{tool\.accent\}/);
  assert.match(source, /to=\{tool\.path\}/);
  assert.match(source, /trackToolOpen\(tool\.id, featured \? "home_card" : "tools_card", language\)/);
  assert.match(source, /ui-tool-icon ui-accent-\$\{tool\.accent\}/);
  for (const accent of ["green", "blue", "violet", "orange", "pink", "sky"]) {
    assert.match(registry, new RegExp(`accent: "${accent}"`));
  }
});

test("LanguageSwitcher keeps its public prop and KO/EN group toggle accessibility", () => {
  const source = read("src/components/LanguageSwitcher.tsx");
  const toggleGroupSource = read("node_modules/@base-ui/react/toggle-group/ToggleGroup.mjs");
  const toggleSource = read("node_modules/@base-ui/react/toggle/Toggle.mjs");

  assert.match(source, /export function LanguageSwitcher\(\{ compact = false \}: \{ compact\?: boolean \}\)/);
  assert.match(source, /<ToggleGroup[\s\S]*?value=\{\[language\]\}[\s\S]*?aria-label=\{t\("language\.switchLabel"\)\}/);
  assert.match(source, /\(\["ko", "en"\] as const\)\.map/);
  assert.match(source, /<ToggleGroupItem[\s\S]*?value=\{item\}[\s\S]*?className=\{language === item \? "ui-selected" : ""\}/);
  assert.match(toggleGroupSource, /role: 'group'/);
  assert.match(toggleSource, /'aria-pressed': pressed/);
});
