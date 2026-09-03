import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath: string) => fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
const uiSource = read("src/components/ui.tsx");

test("SegmentedControl keeps group and pressed semantics through the Base UI toggle group", () => {
  const toggleGroupSource = read("node_modules/@base-ui/react/toggle-group/ToggleGroup.mjs");
  const toggleSource = read("node_modules/@base-ui/react/toggle/Toggle.mjs");

  assert.match(toggleGroupSource, /role: 'group'/);
  assert.match(toggleSource, /'aria-pressed': pressed/);
  assert.match(uiSource, /<ToggleGroup[\s\S]*?value=\{\[value\]\}[\s\S]*?aria-label=\{label\}/);
  assert.match(uiSource, /if \(nextValue !== undefined\) onChange\(nextValue\)/);
  assert.equal(fs.existsSync(path.join(repositoryRoot, "src/components/ui/tabs.tsx")), false);
});

test("ToggleRow keeps a native button switch with checked and disabled state", () => {
  const switchSource = read("node_modules/@base-ui/react/switch/root/SwitchRoot.mjs");

  assert.match(switchSource, /role: 'switch'/);
  assert.match(switchSource, /'aria-checked': checked/);
  assert.match(uiSource, /<Switch[\s\S]*?checked=\{checked\}[\s\S]*?onCheckedChange=[\s\S]*?aria-label=\{label\}[\s\S]*?disabled=\{disabled\}[\s\S]*?nativeButton[\s\S]*?render=\{<button type="button" \/>\}/);
});

test("FileDropZone keeps accumulation, async reset, keyboard, and drag contracts", () => {
  assert.match(uiSource, /await onFiles\(multiple \? \[\.\.\.files, \.\.\.next\] : next\.slice\(0, 1\)\)/);
  assert.match(uiSource, /try \{[\s\S]*?await appendFiles\(selectedFiles\)[\s\S]*?finally \{[\s\S]*?input\.value = ""/);
  assert.match(uiSource, /event\.key === "Enter" \|\| event\.key === " "/);
  assert.match(uiSource, /onDragEnter=[\s\S]*?onDragOver=[\s\S]*?onDragLeave=\{handleDragLeave\}[\s\S]*?onDrop=/);
  assert.match(uiSource, /role="button"[\s\S]*?aria-disabled=\{disabled\}/);
});

test("the eight adapters preserve their structural and live-region contracts", () => {
  assert.match(uiSource, /export function PageHeader[\s\S]*?<header[\s\S]*?<h1/);
  assert.match(uiSource, /export function SectionCard[\s\S]*?<Card[\s\S]*?as="section"[\s\S]*?className=\{cn\([\s\S]*?"section-card[\s\S]*?className,[\s\S]*?\)\}/);
  assert.match(uiSource, /export function FileList[\s\S]*?<Card as="ul"[\s\S]*?<li className="file-row"/);
  assert.match(uiSource, /export function PrimaryButton[\s\S]*?disabled=\{disabled \|\| loading\}[\s\S]*?aria-busy=\{loading\}/);
  assert.match(uiSource, /export function ResultCard[\s\S]*?<Card as="section"[\s\S]*?aria-live="polite"/);
  assert.doesNotMatch(uiSource, /export function NavigationRow/);
});

test("all accent adapters explicitly cover the six public ToolAccent values", () => {
  const accents = ["green", "blue", "violet", "orange", "pink", "sky"];
  for (const declaration of ["accentButtonClasses", "accentSoftClasses", "accentDraggingClasses", "accentResultClasses"]) {
    const block = uiSource.match(new RegExp(`const ${declaration} = \\{([\\s\\S]*?)\\n\\} satisfies`))?.[1];
    assert.ok(block, `${declaration} declaration is missing`);
    for (const accent of accents) assert.match(block, new RegExp(`\\n  ${accent}:`));
  }
});
