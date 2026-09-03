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
