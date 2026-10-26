import assert from "node:assert/strict";
import test from "node:test";

import { regionPreset } from "../../src/features/image-compare/regionOptions.ts";
import { addPreset, customDefault, defaultPresetOptions, deletePreset, matchingPreset, normalizeDefault, presetNameError, readCustomPresets, readDefaultPreset, renamePreset, sameRegionOptions, updatePresetOptions, validRegionOptions, writeRegionPresets, REGION_PRESET_LIMITS } from "../../src/features/image-compare/regionPresets.ts";

const options = { diffThreshold: 30, groupingRadius: 5, minArea: 40, maxAreaFraction: 0.2 };
function withStorage<T>(run: (store: Map<string, string>) => T) {
  const store = new Map<string, string>(), previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)), removeItem: (k: string) => void store.delete(k) } });
  try { return run(store); } finally { if (previous) Object.defineProperty(globalThis, "localStorage", previous); else delete (globalThis as { localStorage?: unknown }).localStorage; }
}

test("names are trimmed, required, bounded and unique ignoring case", () => {
  const presets = addPreset([], "  Receipts ", options);
  assert.deepEqual(presets, [{ name: "Receipts", options }]);
  assert.equal(presetNameError("   ", presets), "empty");
  assert.equal(presetNameError("receipts", presets), "taken");
  assert.equal(presetNameError("x".repeat(REGION_PRESET_LIMITS.nameLength + 1), presets), "tooLong");
  assert.equal(presetNameError("RECEIPTS", presets, "Receipts"), undefined, "renaming to a different case of itself is allowed");
  const full = Array.from({ length: REGION_PRESET_LIMITS.count }, (_, i) => ({ name: `p${i}`, options }));
  assert.equal(presetNameError("new", full), "full");
  assert.throws(() => addPreset(presets, "RECEIPTS", options), /taken/u);
});

test("rename and delete keep the default consistent", () => {
  const presets = addPreset(addPreset([], "A", options), "B", { ...options, diffThreshold: 40 });
  const renamed = renamePreset(presets, customDefault("A"), "A", "Alpha");
  assert.deepEqual(renamed.presets.map(p => p.name), ["Alpha", "B"]); assert.equal(renamed.defaultPreset, "custom:Alpha");
  assert.equal(renamePreset(presets, "words", "A", "Alpha").defaultPreset, "words");
  assert.equal(deletePreset(renamed.presets, renamed.defaultPreset, "Alpha").defaultPreset, null);
  assert.equal(deletePreset(renamed.presets, renamed.defaultPreset, "B").defaultPreset, "custom:Alpha");
  assert.equal(updatePresetOptions(presets, "B", options)[1].options.diffThreshold, 30);
});

test("storage drops invalid entries and normalizes the default", () => withStorage(store => {
  store.set("worklazy.imageRegionPresets", JSON.stringify([{ name: " Ok ", options }, { name: "ok", options }, { name: "bad", options: { ...options, diffThreshold: 300 } }, { name: "", options }, { options }, "x"]));
  const presets = readCustomPresets();
  assert.deepEqual(presets, [{ name: "Ok", options }]);
  store.set("worklazy.imageRegionDefaultPreset", "OK"); assert.equal(readDefaultPreset(presets), "custom:Ok");
  store.set("worklazy.imageRegionDefaultPreset", "custom:missing"); assert.equal(readDefaultPreset(presets), null);
  store.set("worklazy.imageRegionDefaultPreset", "graphics"); assert.equal(readDefaultPreset(presets), "graphics");
  writeRegionPresets(presets, null); assert.equal(store.has("worklazy.imageRegionDefaultPreset"), false);
  writeRegionPresets(presets, "custom:Ok"); assert.equal(store.get("worklazy.imageRegionDefaultPreset"), "custom:Ok");
  store.set("worklazy.imageRegionPresets", "{not json"); assert.deepEqual(readCustomPresets(), []);
  assert.equal(normalizeDefault(null, presets), null);
}));

test("storage failures leave presets empty and writes silent", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("blocked"); } });
  try { assert.deepEqual(readCustomPresets(), []); assert.equal(readDefaultPreset([]), null); assert.doesNotThrow(() => writeRegionPresets([], "words")); }
  finally { if (previous) Object.defineProperty(globalThis, "localStorage", previous); else delete (globalThis as { localStorage?: unknown }).localStorage; }
});

test("defaults: built-ins scale with the image, saved presets are copied; matching prefers built-ins", () => {
  const presets = [{ name: "Mine", options }];
  assert.deepEqual(defaultPresetOptions("words", presets, 2000, 1000), regionPreset("words", 2000, 1000));
  assert.deepEqual(defaultPresetOptions("custom:Mine", presets, 2000, 1000), options);
  assert.equal(defaultPresetOptions("custom:Gone", presets, 10, 10), undefined);
  assert.equal(defaultPresetOptions(null, presets, 10, 10), undefined);
  assert.equal(matchingPreset(regionPreset("tiny", 300, 300), presets, 300, 300), "tiny");
  assert.equal(matchingPreset({ ...options, maxAreaFraction: 0.20000001 }, presets, 300, 300), "custom:Mine");
  assert.equal(matchingPreset({ ...options, minArea: 41 }, presets, 300, 300), null);
  assert.equal(sameRegionOptions(options, { ...options, minArea: 40.0002 }), false);
  assert.equal(validRegionOptions({ ...options, groupingRadius: 1.5 }), undefined);
  assert.equal(validRegionOptions({ ...options, maxAreaFraction: 0 }), undefined);
});
