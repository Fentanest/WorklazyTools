import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

const migratedNamespaces = ["video", "pdf", "audio", "qr", "textMerger", "excelCompare"];

test("migrated feature locale namespaces have identical key shapes", async () => {
  const [ko, en] = await Promise.all(["ko", "en"].map(async (language) => JSON.parse(await readFile(new URL(`src/locales/${language}/features.json`, root), "utf8"))));
  for (const namespace of migratedNamespaces) {
    assert.ok(ko[namespace], `Korean ${namespace} namespace is missing`);
    assert.ok(en[namespace], `English ${namespace} namespace is missing`);
    assert.deepEqual(leafKeys(ko[namespace]), leafKeys(en[namespace]), `${namespace} locale keys differ`);
  }
});

test("migrated feature locale templates use the same interpolation slots", async () => {
  const [ko, en] = await Promise.all(["ko", "en"].map(async (language) => JSON.parse(await readFile(new URL(`src/locales/${language}/features.json`, root), "utf8"))));
  for (const namespace of migratedNamespaces) {
    const koTemplates = stringLeaves(ko[namespace]);
    const enTemplates = stringLeaves(en[namespace]);
    for (const [key, koValue] of Object.entries(koTemplates)) {
      assert.deepEqual(placeholders(koValue), placeholders(enTemplates[key]), `${namespace}.${key} interpolation slots differ`);
    }
  }
});

test("video messages in both languages hide internal processing names", async () => {
  const resources = await Promise.all(["ko", "en"].map(async (language) => JSON.parse(await readFile(new URL(`src/locales/${language}/features.json`, root), "utf8"))));
  for (const resource of resources) {
    for (const [key, value] of Object.entries(stringLeaves(resource.video))) {
      assert.doesNotMatch(value, /\b(?:OPFS|SyncAccessHandle|zip\.js|mp4box(?:\.js)?|mp4-muxer|WebCodecs?|remux|worker)\b/i, `video.${key} exposes an internal processing name`);
    }
  }
});

test("Excel duplicate result copy keeps independent-list, zero-row, dialog, and guide contracts", async () => {
  const [ko, en] = await Promise.all(["ko", "en"].map(async (language) => JSON.parse(await readFile(new URL(`src/locales/${language}/features.json`, root), "utf8"))));
  assert.equal(ko.excelCompare.results.noLeftRows, "왼쪽 0건");
  assert.equal(en.excelCompare.results.noLeftRows, "No left rows");
  assert.equal(en.excelCompare.results.showLeftRows_one, "Show {{count}} left row");
  assert.equal(en.excelCompare.results.showLeftRows, "Show {{count}} left rows");
  assert.match(ko.excelCompare.results.duplicateGuidance, /자동으로 연결하지 않았습니다/);
  assert.match(en.excelCompare.results.duplicateGuidance, /not been matched automatically/);
  for (const resource of [ko, en]) {
    const copy = Object.values(stringLeaves(resource.excelCompare)).join("\n");
    assert.ok(resource.excelCompare.results.fullValue);
    assert.doesNotMatch(copy, /string:|number:|DUPLICATE_KEY_TOO_LONG/);
  }
  // Guide copy migrated from features.json to guides.json: assert on the actual
  // /tools/excel-compare selection (currently faq_1..faq_5, including faq_5).
  // guides.json faq is an object, not an array.
  const guides = await Promise.all(["ko", "en"].map(async (language) => JSON.parse(await readFile(new URL(`src/locales/${language}/guides.json`, root), "utf8"))));
  for (const [language, resource] of [["ko", guides[0]], ["en", guides[1]]] as const) {
    const guide = resource.excelCompare;
    assert.equal(typeof guide.title, "string", `${language} excelCompare guide title`);
    assert.ok(guide.title, `${language} excelCompare guide title is empty`);
    assert.equal(typeof guide.description, "string", `${language} excelCompare guide description`);
    assert.ok(guide.description, `${language} excelCompare guide description is empty`);
    assert.ok(Array.isArray(guide.blocks) && guide.blocks.length >= 1, `${language} excelCompare guide blocks`);
    assert.equal(typeof guide.faq, "object", `${language} excelCompare guide faq is an object`);
    assert.ok(!Array.isArray(guide.faq), `${language} excelCompare guide faq is not an array`);
    const selected: string[] = guide.pathFaqs["/tools/excel-compare"];
    assert.ok(Array.isArray(selected) && selected.length >= 1, `${language} /tools/excel-compare selection`);
    assert.ok(selected.includes("faq_5"), `${language} /tools/excel-compare selection includes faq_5`);
    const text = selected.map((id: string) => `${guide.faq[id].q} ${guide.faq[id].a}`).join("\n");
    assert.match(text, /중복\s*키|duplicate key/i, `${language} selection covers duplicate keys`);
    assert.match(text, /독립된 목록|independent lists/, `${language} selection covers independent lists`);
    assert.match(text, /자동으로 연결한 것은 아닙니다|not matched automatically/, `${language} selection covers no automatic matching`);
  }
});

function leafKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") return [prefix];
  return Object.entries(value).flatMap(([key, child]) => leafKeys(child, prefix ? `${prefix}.${key}` : key)).sort();
}

function stringLeaves(value: unknown, prefix = "", output: Record<string, string> = {}) {
  if (typeof value === "string") output[prefix] = value;
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, child]) => stringLeaves(child, prefix ? `${prefix}.${key}` : key, output));
  return output;
}

function placeholders(value: string | undefined) {
  return Array.from(value?.matchAll(/{{\s*([^},\s]+)/g) || [], (match) => match[1]).sort();
}
