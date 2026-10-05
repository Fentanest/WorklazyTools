import test from "node:test";
import assert from "node:assert/strict";
import { loadProjectJson, saveProjectJson, validateProject } from "../../src/features/product-banner/projectJson.ts";
import { BannerStateError, PROJECT_LIMITS, UNDO_LIMITS } from "../../src/features/product-banner/stateTypes.ts";
import { createEditorState, reduceEditorState as reduce, hasUnsavedChanges, imageStatus } from "../../src/features/product-banner/state.ts";
import { createDisplayModel } from "../../src/features/product-banner/displayModel.ts";
import { inputProduct, importedAt, stateWith } from "../fixtures/product-banner/state.ts";
const code = (expected: string) => (error: unknown) => error instanceof BannerStateError && error.code === expected;
const editable = () => JSON.parse(saveProjectJson(stateWith().project));

test("originalOrder remains below the allocator: accepted JSON can append and save/load", () => {
  const value = JSON.parse(saveProjectJson(stateWith(1).project));
  value.products[0].originalOrder = value.nextId;
  assert.throws(() => loadProjectJson(JSON.stringify(value)), code("INVALID_PROJECT"));
  value.nextId = 5; value.products[0].originalOrder = 4;
  const loaded = loadProjectJson(JSON.stringify(value));
  const restored = reduce(createEditorState("ko"), { type: "load", project: loaded });
  const appended = reduce(restored, { type: "append", products: [inputProduct(2)], importedAt });
  assert.deepEqual(appended.project.products.map((p) => p.originalOrder), [4, 5]);
  assert.deepEqual(loadProjectJson(saveProjectJson(appended.project)), appended.project);
});

test("JSON restores ordered IDs, included/excluded lists, edited values, raw/used links, settings and display identically", () => {
  let s = stateWith();
  s = reduce(s, { type: "edit", id: "pb-1", changes: { name: '수정 "<&>😀', promotionUrl: " https://EXAMPLE.com:443/a/../z?b=2&a=%22 " } });
  s = reduce(s, { type: "include", ids: ["pb-2"], included: false });
  s = reduce(s, { type: "move", id: "pb-3", to: 0 });
  s = reduce(s, { type: "settings", patch: { design: "grid", gridPreset: "custom", gridColumns: 3, gridRows: 4, showPrice: true, language: "en", affiliateNotice: 'Text <script> & " 😀', colors: { accent: "#ABCDEF" }, autoHeight: true } });
  const json = saveProjectJson(s.project), restored = loadProjectJson(json);
  assert.deepEqual(restored, s.project); assert.deepEqual(createDisplayModel(restored), createDisplayModel(s.project));
  assert.equal(restored.products[2].included, false);
  assert.equal(restored.products[1].originalUrls.promotionUrl, inputProduct().originalUrls.promotionUrl);
  assert.equal(restored.products[1].promotionUrl, "https://EXAMPLE.com:443/a/../z?b=2&a=%22");
  assert.notEqual(restored, s.project); assert.notEqual(restored.products[0], s.project.products[0]);
});
test("load protects existing edits, is undoable, allocates subsequent IDs safely and clears image observations", () => {
  let s = stateWith(1); const url = s.project.products[0].imageUrl;
  s = reduce(s, { type: "image-status", id: "pb-1", url, status: "success" });
  const loaded = loadProjectJson(saveProjectJson(stateWith(3).project));
  assert.throws(() => reduce(s, { type: "load", project: loaded }), code("REPLACEMENT_CONFIRMATION_REQUIRED"));
  const next = reduce(s, { type: "load", project: loaded, confirmDiscard: true });
  assert.equal(hasUnsavedChanges(next), false); assert.equal(imageStatus(next, "pb-1"), "unchecked");
  assert.equal(reduce(next, { type: "undo" }).project, s.project);
  assert.equal(reduce(next, { type: "append", products: [inputProduct(4)], importedAt }).project.products[3].id, "pb-4");
});
test("save/load allowlist drops filenames, paths, workbooks, commission, unnecessary fields and session state at every level", () => {
  const value = editable();
  Object.assign(value, { fileName: "PRIVATE.xlsx", localPath: "/private/input", workbook: { data: "PRIVATE_WORKBOOK" }, selectedIds: ["pb-1"], imageStates: { "pb-1": "success" } });
  value.settings.css = "body{display:none}"; value.settings.script = "globalThis.executed = true"; value.settings.colors.extra = "PRIVATE_COLOR";
  for (const p of value.products) {
    p.commission = "PRIVATE_COMMISSION"; p.estimatedRevenue = 99; p.videoUrl = "PRIVATE_VIDEO"; p.workbook = "PRIVATE_WORKBOOK";
    p.source.fileName = "PRIVATE.xlsx"; p.source.localPath = "/private/input"; p.originalUrls.extra = "PRIVATE_URL"; p.originPrice.extra = "PRIVATE_PRICE";
  }
  value.products[1].included = false;
  const saved = saveProjectJson(value), restored = loadProjectJson(JSON.stringify(value));
  assert.equal(restored.products.length, 3); assert.equal(restored.products[1].included, false);
  for (const marker of ["PRIVATE", "/private/input", "estimatedRevenue", "selectedIds", "imageStates", "script", '"css"']) assert.ok(!saved.includes(marker), marker);
  assert.equal(saved, saveProjectJson(restored));
});
for (const key of ["__proto__", "constructor", "prototype"]) test(`JSON rejects ${key} at root/settings/nested product/ignored field without pollution`, () => {
  for (const location of ["root", "settings", "source", "ignored"]) {
    const value = editable();
    const target = location === "root" ? value : location === "settings" ? value.settings : location === "source" ? value.products[1].source : (value.unexpected = {});
    Object.defineProperty(target, key, { value: { polluted: true }, enumerable: true });
    assert.throws(() => loadProjectJson(JSON.stringify(value)), code("INVALID_PROJECT"));
  }
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
});
test("invalid JSON/version/root/schema/type and missing fields are rejected without executing strings", () => {
  for (const text of ["", "undefined", "{", "null", "[]", '"text"', "globalThis.executed = true"]) assert.throws(() => loadProjectJson(text));
  for (const version of [0, 2, "1", null]) { const v = editable(); v.schemaVersion = version; assert.throws(() => loadProjectJson(JSON.stringify(v)), code("UNSUPPORTED_VERSION")); }
  const mutations = [
    (v: any) => delete v.products, (v: any) => v.products = {}, (v: any) => v.nextId = "4", (v: any) => v.nextId = 0,
    (v: any) => v.products[0].included = "true", (v: any) => v.products[0].name = 1, (v: any) => delete v.products[0].originalUrls,
    (v: any) => v.products[0].source.importedAt = "2026-02-30T00:00:00.000Z", (v: any) => v.products[0].source.rowNumber = -1,
    (v: any) => v.products[0].originPrice.amount = "10", (v: any) => v.products[0].originPrice.currency = "US",
    (v: any) => v.products[0].discount.percent = 101, (v: any) => v.products[0].originPrice.raw = null,
  ];
  for (const mutate of mutations) { const v = editable(); mutate(v); assert.throws(() => loadProjectJson(JSON.stringify(v)), code("INVALID_PROJECT")); }
  const v = editable(); v.products[0].name = '<script>globalThis.__pb_executed = true</script>';
  assert.equal(loadProjectJson(JSON.stringify(v)).products[0].name, v.products[0].name);
  assert.equal((globalThis as any).__pb_executed, undefined);
});
test("IDs/order/counter must be unique, stable, bounded and cannot collide after loading", () => {
  const mutations = [
    (v: any) => v.products[1].id = v.products[0].id,
    (v: any) => v.products[1].originalOrder = v.products[0].originalOrder,
    (v: any) => v.products[0].id = "pb-0", (v: any) => v.nextId = 3,
    (v: any) => v.products[0].id = "__proto__", (v: any) => v.products[0].originalOrder = 1.5,
  ];
  for (const mutate of mutations) { const v = editable(); mutate(v); assert.throws(() => loadProjectJson(JSON.stringify(v)), code("INVALID_PROJECT")); }
});
test("JSON setting validation rejects code/CSS/range violations, enforces advertising and corrects layout constraints", () => {
  for (const patch of [{ advertisingLabel: false }, { visibleCount: 0 }, { intervalSeconds: 1 }, { width: 1e9 }, { colors: { background: "url(https://example.com/x)" } }, { autoHeight: "true" }]) {
    const v = editable(); Object.assign(v.settings, patch); assert.throws(() => loadProjectJson(JSON.stringify(v)), code("INVALID_SETTING"));
  }
  const v = editable(); Object.assign(v.settings, { design: "slim", visibleCount: 4, gridPreset: "3x2", gridColumns: 1, gridRows: 5 });
  const restored = loadProjectJson(JSON.stringify(v)); assert.equal(restored.settings.visibleCount, 1); assert.equal(restored.settings.gridColumns, 3); assert.equal(restored.settings.gridRows, 2);
});
test("byte bounds include UTF-8 bytes before parsing, not just JS string length", () => {
  assert.throws(() => loadProjectJson(" ".repeat(PROJECT_LIMITS.bytes + 1)), code("PROJECT_LIMIT"));
  const text = JSON.stringify({ ...editable(), ignored: "가".repeat(Math.floor(PROJECT_LIMITS.bytes / 3)) });
  assert.ok(text.length < PROJECT_LIMITS.bytes); assert.ok(new TextEncoder().encode(text).byteLength > PROJECT_LIMITS.bytes);
  assert.throws(() => loadProjectJson(text), code("PROJECT_LIMIT"));
});
test("string boundary is accepted and longer text, including ignored fields, rejects explicitly", () => {
  const v = editable(); v.products[0].name = "가".repeat(PROJECT_LIMITS.stringLength);
  assert.equal(loadProjectJson(JSON.stringify(v)).products[0].name.length, PROJECT_LIMITS.stringLength);
  v.products[0].name += "a"; assert.throws(() => loadProjectJson(JSON.stringify(v)), code("PROJECT_LIMIT"));
  const ignored = editable(); ignored.extra = "a".repeat(PROJECT_LIMITS.stringLength + 1); assert.throws(() => loadProjectJson(JSON.stringify(ignored)), code("PROJECT_LIMIT"));
});
test("depth boundary applies to ignored fields too; cyclic runtime objects reject", () => {
  const v = editable();
  v.extra = "x"; for (let i = 1; i < PROJECT_LIMITS.depth; i++) v.extra = [v.extra];
  assert.doesNotThrow(() => loadProjectJson(JSON.stringify(v)));
  v.extra = [v.extra]; assert.throws(() => loadProjectJson(JSON.stringify(v)), code("PROJECT_LIMIT"));
  const cycle = editable(); cycle.extra = cycle; assert.throws(() => validateProject(cycle), code("INVALID_PROJECT"));
});
test("1,000/10,000 project products round-trip and limit+1 rejects without silently truncating; undo slot budget stays bounded", () => {
  let s = stateWith(1000); assert.deepEqual(loadProjectJson(saveProjectJson(s.project)), s.project);
  s = stateWith(PROJECT_LIMITS.products); const json = saveProjectJson(s.project);
  assert.ok(new TextEncoder().encode(json).byteLength < PROJECT_LIMITS.bytes); assert.equal(loadProjectJson(json).products.length, PROJECT_LIMITS.products);
  for (let i = 0; i < 10; i++) s = reduce(s, { type: "edit", id: "pb-1", changes: { name: `edit ${i}` } });
  assert.ok(s.past.reduce((sum, entry) => sum + entry.project.products.length, 0) <= UNDO_LIMITS.productSlots);
  const v = JSON.parse(json); v.products.push(v.products[0]); assert.throws(() => loadProjectJson(JSON.stringify(v)), code("PROJECT_LIMIT"));
});
test("save rejects an over-byte-limit project even when every individual field/product is permitted", () => {
  const s = stateWith(2000);
  const products = s.project.products.map((p) => ({ ...p, name: "가".repeat(PROJECT_LIMITS.stringLength) }));
  assert.throws(() => saveProjectJson({ ...s.project, products }), code("PROJECT_LIMIT"));
});
test("invalid retained URLs restore for correction but cannot become a display/output URL", () => {
  const v = editable(); v.products[0].promotionUrl = "javascript:alert(1)";
  const loaded = loadProjectJson(JSON.stringify(v)); assert.equal(loaded.products[0].promotionUrl, v.products[0].promotionUrl);
  assert.throws(() => createDisplayModel(loaded), code("INVALID_PRODUCT_URL"));
  const ready = { ...loaded, products: loaded.products.map((p) => p.id === "pb-1" ? { ...p, included: false } : p) };
  assert.equal(createDisplayModel(ready).products.length, 2);
});
test("load corrects only surrounding URL whitespace while preserving raw original and noncanonical spelling", () => {
  const v = editable(); const original = v.products[0].originalUrls.promotionUrl;
  v.products[0].promotionUrl = " https://EXAMPLE.com:443/a/../p?b=2&a=%22 ";
  const loaded = loadProjectJson(JSON.stringify(v));
  assert.equal(loaded.products[0].promotionUrl, v.products[0].promotionUrl.trim());
  assert.equal(loaded.products[0].originalUrls.promotionUrl, original);
  assert.equal(createDisplayModel(loaded).products[0].promotionUrl, v.products[0].promotionUrl.trim());
});

for (const design of ["photo-strip", "product-card", "slim", "vertical", "grid"] as const) test(`saved false choices survive JSON load and every design switch: ${design}`, () => {
  let s = reduce(stateWith(1), { type: "settings", patch: { design, showName: false, showPrice: false, showDiscount: false, showButton: false, autoHeight: false, autoPlay: false } });
  const loaded = loadProjectJson(saveProjectJson(s.project));
  for (const key of ["showName", "showPrice", "showDiscount", "showButton", "autoHeight", "autoPlay"] as const) assert.equal(loaded.settings[key], false);
  s = reduce(s, { type: "load", project: loaded, confirmDiscard: true });
  for (const next of ["photo-strip", "product-card", "slim", "vertical", "grid"] as const) {
    s = reduce(s, { type: "settings", patch: { design: next } });
    for (const key of ["showName", "showPrice", "showDiscount", "showButton", "autoHeight"] as const) assert.equal(s.project.settings[key], false);
    assert.deepEqual(s.project.products, loaded.products);
  }
});
