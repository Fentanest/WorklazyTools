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

  // S1 removes the unreachable Word/HWP pages; U7 adds document generation.
  assert.equal(consumers.length, 21);
  assert.match(source, /<Card as="section"[\s\S]*?aria-labelledby="tool-guide-title"/);
  assert.match(source, /data-ui-component="tool-guide"[\s\S]*?className="ui-tool-guide-heading"[\s\S]*?t\("guide\.eyebrow"\)[\s\S]*?<h2 id="tool-guide-title"/);
  assert.match(source, /className="ui-tool-guide-grid"[\s\S]*?<Card as="article"[\s\S]*?block\.paragraphs[\s\S]*?block\.items/);
  assert.match(source, /className="ui-tool-faq"[\s\S]*?t\("guide\.faq"\)[\s\S]*?<details[\s\S]*?<summary[\s\S]*?<p>/);
});

test("OperationProgress keeps W-D stage rows, active spinner, percentages, and progress semantics", () => {
  const source = read("src/components/OperationProgress.tsx");
  const progressSource = read("src/components/ui/progress.tsx");
  const consumers = componentFiles.filter((entry) => read(path.join("src/features", entry)).includes("<OperationProgress"));

  // S1 removed two pages; U4-3, U6 and U7 add scoped consumers.
  assert.equal(consumers.length, 16);
  assert.match(source, /entry\.id === activeLogId \|\| Boolean\(entry\.stageKey && entry\.stageKey === activeStageKey\)/);
  assert.match(source, /isCurrent && status === "running" \? LoaderCircle : Circle/);
  assert.match(source, /className=\{isCurrent && status === "running" \? "animate-spin" : ""\}/);
  assert.match(source, /className="ui-operation-log-progress">\{entry\.progress\}%<\/b>/);
  assert.match(source, /<ol[\s\S]*?className="ui-operation-log"[\s\S]*?aria-live="polite"[\s\S]*?key=\{entry\.id\}/);
  assert.match(source, /className="ui-operation-log"[\s\S]*?aria-label=[\s\S]*?tabIndex=\{0\}/);
  assert.match(source, /<Progress[\s\S]*?className="ui-operation-progress-track[\s\S]*?value=\{progress\}[\s\S]*?aria-label=\{message\}/);
  // Product behavior instead of library internals: the self-implemented
  // progressbar exposes the same value contract without Base UI.
  assert.match(progressSource, /role="progressbar"/);
  assert.match(progressSource, /"aria-valuenow": normalized/);
  assert.match(progressSource, /Math\.min\(max, Math\.max\(min, value\)\)/);
  assert.match(progressSource, /normalized === null \? \{\} : \{ "aria-valuenow": normalized \}/);
  assert.ok(!progressSource.includes("@base-ui/react"), "progress must not depend on Base UI");
  for (const declaration of ["progressIndicatorClasses", "progressStateClasses"]) {
    const block = source.match(new RegExp(`const ${declaration} = \\{([\\s\\S]*?)\\n\\} satisfies`))?.[1];
    assert.ok(block, `${declaration} declaration is missing`);
    for (const accent of ["green", "blue", "violet", "orange", "pink", "sky"]) assert.match(block, new RegExp(`\\n  ${accent}:`));
  }
});

test("ToolCard keeps a link root, analytics behavior, and all six accent identities", () => {
  const source = read("src/components/ToolCard.tsx");
  const accentStyles = read("src/components/toolAccentStyles.ts");
  const registry = read("src/app/toolRegistry.ts");

  assert.match(source, /<Card[\s\S]*?as=\{Link\}[\s\S]*?data-ui-component="tool-card"[\s\S]*?className=\{cn\(`ui-tool-card ui-accent-\$\{tool\.accent\}/);
  assert.match(source, /to=\{tool\.path\}/);
  assert.match(source, /trackToolOpen\(tool\.id, featured \? "home_card" : "tools_card", language\)/);
  assert.match(source, /toolIconAccentClasses\[tool\.accent\]/);
  for (const accent of ["green", "blue", "violet", "orange", "pink", "sky"]) {
    assert.match(registry, new RegExp(`accent: "${accent}"`));
    assert.match(accentStyles, new RegExp(`\\n  ${accent}:`));
  }
});

test("LanguageSwitcher keeps its public prop and KO/EN group toggle accessibility", () => {
  const source = read("src/components/LanguageSwitcher.tsx");
  const toggleGroupSource = read("src/components/ui/toggle-group.tsx");
  const toggleSource = read("src/components/ui/toggle.tsx");

  assert.match(source, /export function LanguageSwitcher\(\{ compact = false \}: \{ compact\?: boolean \}\)/);
  assert.match(source, /<ToggleGroup[\s\S]*?value=\{\[language\]\}[\s\S]*?aria-label=\{t\("language\.switchLabel"\)\}/);
  assert.match(source, /\(\["ko", "en"\] as const\)\.map/);
  assert.match(source, /<ToggleGroupItem[\s\S]*?value=\{item\}[\s\S]*?className=\{language === item \? "ui-selected" : ""\}/);
  // Product behavior instead of library internals.
  assert.match(toggleGroupSource, /role: "group"/);
  assert.match(toggleSource, /"aria-pressed": pressed/);
  assert.ok(!toggleGroupSource.includes("@base-ui/react") && !toggleSource.includes("@base-ui/react"), "toggle primitives must not depend on Base UI");
});
