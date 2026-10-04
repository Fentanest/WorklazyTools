import test from "node:test";
import assert from "node:assert/strict";
import { createEditorState, reduceEditorState as reduce, detectDuplicates, hasBannerWork, hasUnsavedChanges, imageStatus, productReviewFields } from "../../src/features/product-banner/state.ts";
import { BannerStateError, DESIGN_IDS, UNDO_LIMITS } from "../../src/features/product-banner/stateTypes.ts";
import { createDefaultSettings, DEFAULT_AFFILIATE_NOTICES, SETTING_RANGES, updateSettings } from "../../src/features/product-banner/settings.ts";
import { createDisplayModel } from "../../src/features/product-banner/displayModel.ts";
import { inputProduct, importedAt, stateWith } from "../fixtures/product-banner/state.ts";
import { extractInputProducts, parsePrice } from "../../src/features/product-banner/inputMapping.ts";
import { parseInputBytes } from "../../src/features/product-banner/inputParser.ts";
import { utf8 } from "../fixtures/product-banner/synthetic.ts";
const code = (expected: string) => (error: unknown) => error instanceof BannerStateError && error.code === expected;
function freeze(value: object) { Object.freeze(value); for (const child of Object.values(value)) if (child && typeof child === "object" && !Object.isFrozen(child)) freeze(child); }

test("input mapping → edit state → display retains raw and trim-only links, ordering and stable IDs", () => {
  const raw = " https://EXAMPLE.com:443/a/../p?b=2&a=1%20x ";
  const input = extractInputProducts(parseInputBytes(utf8(`Image Url,Promotion Url,Product Desc\nhttps://example.com/i,${raw},합성\nhttps://example.com/i2,https://example.com/p2,둘`)), 0, "private-source.csv");
  const s = reduce(createEditorState("ko"), { type: "append", products: input.products, importedAt });
  assert.deepEqual(s.project.products.map((p) => [p.id, p.originalOrder]), [["pb-1", 1], ["pb-2", 2]]);
  assert.equal(s.project.products[0].originalUrls.promotionUrl, raw);
  assert.equal(createDisplayModel(s.project).products[0].promotionUrl, raw.trim());
  assert.equal(s.project.products[0].source.importedAt, importedAt);
  assert.ok(!JSON.stringify(createDisplayModel(s.project)).includes("private-source.csv"));
});
test("selection/all/clear is independent of included products, history and unsaved edits", () => {
  const saved = reduce(stateWith(), { type: "mark-saved" });
  let s = reduce(saved, { type: "select", ids: ["pb-3", "pb-1"], selected: true });
  assert.deepEqual(s.selectedIds, ["pb-1", "pb-3"]);
  s = reduce(s, { type: "select", ids: ["pb-1"], selected: false }); assert.deepEqual(s.selectedIds, ["pb-3"]);
  s = reduce(s, { type: "select-all", selected: true }); assert.equal(s.selectedIds.length, 3);
  s = reduce(s, { type: "select-all", selected: false }); assert.deepEqual(s.selectedIds, []);
  assert.equal(s.project, saved.project); assert.equal(s.past, saved.past); assert.equal(hasUnsavedChanges(s), false);
});
test("include/exclude preserves order, selection and raw fields; empty and fully excluded display work", () => {
  let s = stateWith();
  s = reduce(s, { type: "include", ids: ["pb-2"], included: false });
  assert.deepEqual(createDisplayModel(s.project).products.map((p) => p.id), ["pb-1", "pb-3"]);
  assert.equal(s.project.products[1].originalUrls.promotionUrl, inputProduct(2).originalUrls.promotionUrl);
  s = reduce(s, { type: "include", ids: ["pb-2"], included: true });
  assert.deepEqual(createDisplayModel(s.project).products.map((p) => p.id), ["pb-1", "pb-2", "pb-3"]);
  s = reduce(s, { type: "include", ids: ["pb-1", "pb-2", "pb-3"], included: false });
  assert.deepEqual(createDisplayModel(s.project).products, []); assert.equal(hasBannerWork(s), true);
  assert.deepEqual(createDisplayModel(createEditorState("en").project).products, []);
});
test("delete can be undone with edits, inclusion, ordering and selection restored", () => {
  let s = reduce(stateWith(), { type: "select-all", selected: true });
  s = reduce(s, { type: "edit", id: "pb-2", changes: { name: "수정한 이름" } });
  const before = s; freeze(before);
  s = reduce(s, { type: "delete", ids: ["pb-2"] });
  assert.deepEqual(s.selectedIds, ["pb-1", "pb-3"]);
  const undone = reduce(s, { type: "undo" }); assert.equal(undone.project, before.project); assert.deepEqual(undone.selectedIds, before.selectedIds);
  assert.equal(before.project.products.length, 3);
});
test("move arbitrary target and up/down boundaries preserve stable ID/original order without mutation", () => {
  const initial = stateWith(); freeze(initial);
  let s = reduce(initial, { type: "move", id: "pb-3", to: 0 });
  assert.deepEqual(s.project.products.map((p) => p.id), ["pb-3", "pb-1", "pb-2"]);
  assert.deepEqual(s.project.products.map((p) => p.originalOrder), [3, 1, 2]);
  assert.equal(reduce(s, { type: "move-step", id: "pb-3", direction: "up" }), s);
  s = reduce(s, { type: "move-step", id: "pb-3", direction: "down" });
  assert.deepEqual(s.project.products.map((p) => p.id), ["pb-1", "pb-3", "pb-2"]);
  assert.equal(reduce(s, { type: "move-step", id: "pb-2", direction: "down" }), s);
  assert.throws(() => reduce(s, { type: "move", id: "pb-1", to: 3 }), code("INVALID_PROJECT"));
  assert.throws(() => reduce(s, { type: "edit", id: "missing", changes: {} }), code("INVALID_ACTION"));
});
test("edits preserve originals, trim URLs only, allow text markup without evaluation and flag invalid URLs", () => {
  let s = stateWith(1);
  const raw = s.project.products[0].originalUrls;
  s = reduce(s, { type: "edit", id: "pb-1", changes: { name: '<script>globalThis.executed=true</script>😀', imageUrl: " https://example.com/new.jpg ", promotionUrl: " https://EXAMPLE.com:443/a/../z?b=2&a=%22 ", commission: 9 } as never });
  assert.deepEqual(s.project.products[0].originalUrls, raw);
  assert.equal(s.project.products[0].promotionUrl, "https://EXAMPLE.com:443/a/../z?b=2&a=%22");
  assert.equal(createDisplayModel(s.project).products[0].name, s.project.products[0].name);
  assert.equal(Object.hasOwn(s.project.products[0], "commission"), false);
  s = reduce(s, { type: "edit", id: "pb-1", changes: { imageUrl: "javascript:alert(1)" } });
  assert.deepEqual(productReviewFields(s.project.products[0]), ["imageUrl"]);
  assert.throws(() => createDisplayModel(s.project), code("INVALID_PRODUCT_URL"));
  s = reduce(s, { type: "include", ids: ["pb-1"], included: false }); assert.equal(createDisplayModel(s.project).products.length, 0);
});
test("image status distinguishes unchecked/checking/success/failure; stale callbacks cannot change edited URL", () => {
  let s = stateWith(1); const url = s.project.products[0].imageUrl;
  assert.equal(imageStatus(s, "pb-1"), "unchecked");
  for (const status of ["checking", "success", "failure", "checking"] as const) {
    s = reduce(s, { type: "image-status", id: "pb-1", url, status }); assert.equal(imageStatus(s, "pb-1"), status);
  }
  const pastLength = s.past.length;
  s = reduce(s, { type: "edit", id: "pb-1", changes: { imageUrl: "https://example.com/new" } });
  assert.equal(imageStatus(s, "pb-1"), "unchecked");
  assert.equal(reduce(s, { type: "image-status", id: "pb-1", url, status: "success" }), s);
  assert.equal(s.past.length, pastLength + 1);
  assert.equal(imageStatus(reduce(s, { type: "undo" }), "pb-1"), "unchecked");
});
test("duplicates annotate both ID/link without automatically excluding, sorting or deleting", () => {
  const input = inputProduct(); const s = reduce(createEditorState("ko"), { type: "append", products: [input, inputProduct(2), input], importedAt });
  assert.deepEqual(detectDuplicates(s.project.products), [{ by: "productId", ids: ["pb-1", "pb-3"] }, { by: "promotionUrl", ids: ["pb-1", "pb-3"] }]);
  assert.equal(createDisplayModel(s.project).products.length, 3);
  assert.deepEqual(s.project.products.map((p) => p.originalOrder), [1, 2, 3]);
});
test("append retains edits/order/selection and allocates fresh IDs after deletion; replace requires explicit confirmation and undo", () => {
  let s = reduce(stateWith(), { type: "edit", id: "pb-1", changes: { name: "편집 유지" } });
  s = reduce(s, { type: "delete", ids: ["pb-3"] });
  s = reduce(s, { type: "append", products: [inputProduct(4)], importedAt });
  assert.deepEqual(s.project.products.map((p) => p.id), ["pb-1", "pb-2", "pb-4"]); assert.equal(s.project.products[0].name, "편집 유지");
  assert.throws(() => reduce(s, { type: "replace", products: [inputProduct(9)], importedAt }), code("REPLACEMENT_CONFIRMATION_REQUIRED"));
  const next = reduce(s, { type: "replace", products: [inputProduct(9)], importedAt, confirmDiscard: true });
  assert.deepEqual(next.project.products.map((p) => p.id), ["pb-5"]); assert.equal(reduce(next, { type: "undo" }).project, s.project);
  assert.equal(reduce(s, { type: "append", products: [], importedAt }), s);
});
test("dirty state, undo to saved state, deletion and settings-only work support T5's movement guard", () => {
  let s = createEditorState("en"); assert.equal(hasBannerWork(s), false);
  s = reduce(s, { type: "settings", patch: { width: 700 } }); assert.equal(hasBannerWork(s), true);
  assert.throws(() => reduce(s, { type: "replace", products: [], importedAt }), code("REPLACEMENT_CONFIRMATION_REQUIRED"));
  assert.equal(hasBannerWork(reduce(s, { type: "undo" })), false);
  s = reduce(stateWith(1), { type: "mark-saved" }); assert.equal(hasUnsavedChanges(s), false); assert.equal(hasBannerWork(s), true);
  const deleted = reduce(s, { type: "delete", ids: ["pb-1"] }); assert.equal(hasBannerWork(deleted), true);
  assert.equal(hasUnsavedChanges(reduce(deleted, { type: "undo" })), false);
});
test("undo is bounded, no-op changes do not fill it and large appends reject without truncation", () => {
  let s = createEditorState("ko"); assert.equal(reduce(s, { type: "undo" }), s);
  for (let i = 0; i < 60; i++) s = reduce(s, { type: "settings", patch: { width: 700 + i } });
  assert.equal(s.past.length, UNDO_LIMITS.steps);
  assert.equal(reduce(s, { type: "settings", patch: { width: s.project.settings.width } }), s);
  assert.throws(() => reduce(s, { type: "append", products: Array.from({ length: 10_001 }, () => inputProduct()), importedAt }), code("PROJECT_LIMIT"));
});
for (const design of DESIGN_IDS) test(`settings: ${design} defaults, language, constrained layout and immutable patches`, () => {
  const defaults = createDefaultSettings("en", design); assert.equal(defaults.design, design); assert.equal(defaults.language, "en");
  assert.equal(defaults.intervalSeconds, 5); assert.equal(defaults.showPrice, false); assert.equal(defaults.showDiscount, false); assert.equal(defaults.advertisingLabel, true);
  assert.equal(defaults.autoPlay, design !== "grid" && design !== "vertical");
  assert.equal(defaults.affiliateNotice, DEFAULT_AFFILIATE_NOTICES.en);
  if (design === "photo-strip") { assert.equal(defaults.visibleCount, 4); assert.equal(defaults.showName, false); assert.equal(defaults.showButton, false); }
  const updated = updateSettings(defaults, { visibleCount: 6, gridPreset: "3x2", gridColumns: 6, gridRows: 9, autoPlay: true });
  assert.equal(updated.visibleCount, design === "slim" ? 1 : 6); assert.equal(updated.gridColumns, 3); assert.equal(updated.gridRows, 2);
  assert.equal(defaults.visibleCount, createDefaultSettings("en", design).visibleCount);
});
test("design and language switches apply defaults but preserve edited publisher notice, colors, theme and price opt-in", () => {
  let settings = updateSettings(createDefaultSettings("ko"), { language: "en" }); assert.equal(settings.affiliateNotice, DEFAULT_AFFILIATE_NOTICES.en);
  settings = updateSettings(settings, { affiliateNotice: "Publisher's text", showPrice: true, colors: { accent: "#AABBCC" }, theme: "dark" });
  settings = updateSettings(settings, { design: "product-card", language: "ko" });
  assert.equal(settings.visibleCount, 3); assert.equal(settings.showName, true); assert.equal(settings.showPrice, true);
  assert.equal(settings.affiliateNotice, "Publisher's text"); assert.equal(settings.colors.accent, "#AABBCC"); assert.equal(settings.theme, "dark");
  const custom = updateSettings(settings, { gridPreset: "custom", gridColumns: 5, gridRows: 3 }); assert.equal(custom.gridColumns, 5); assert.equal(custom.gridRows, 3);
});
test("setting range boundaries are accepted, values outside each range and CSS/JS inputs rejected", () => {
  const defaults = createDefaultSettings("ko");
  for (const [key, [min, max]] of Object.entries(SETTING_RANGES)) {
    for (const value of [min, max]) assert.doesNotThrow(() => updateSettings(defaults, { [key]: value }));
    for (const value of [min - 1, max + 1, 2.5, "5", null]) assert.throws(() => updateSettings(defaults, { [key]: value } as never), code("INVALID_SETTING"));
  }
  for (const patch of [{ advertisingLabel: false }, { theme: "system" }, { moveBy: "random" }, { language: "fr" }, { design: "other" }, { showPrice: "true" }, { autoPlay: 1 }, { colors: { accent: "red; background:url(x)" } }, { colors: { text: "#fff" } }]) assert.throws(() => updateSettings(defaults, patch as never));
  assert.equal(Object.hasOwn(updateSettings(defaults, { css: "body{}", script: "alert(1)" } as never), "css"), false);
});
test("display allowlist strips excluded products/metadata/unselected prices and supplies an accessible name for photo-only links", () => {
  let s = reduce(stateWith(), { type: "include", ids: ["pb-2"], included: false });
  s = reduce(s, { type: "edit", id: "pb-1", changes: { name: "  " } });
  const model = createDisplayModel(s.project);
  assert.deepEqual(model.products.map((p) => p.id), ["pb-1", "pb-3"]);
  assert.deepEqual(Object.keys(model.products[0]), ["id", "name", "accessibleName", "imageUrl", "promotionUrl"]);
  assert.equal(model.products[0].accessibleName, "상품 1"); assert.equal(model.fileBasedInformation, false);
  const output = JSON.stringify(model);
  for (const field of ["originalUrls", "originalOrder", "productId", "source", "importedAt", "commission", "raw", "amount", "206.5"]) assert.ok(!output.includes(field));
  assert.equal(Object.hasOwn(model.products[0], "prices"), false);
});
test("price/discount opt-in exposes validated labels and currency only, missing/failing values are omitted without zero filling", () => {
  let s = reduce(stateWith(1), { type: "settings", patch: { showPrice: true, showDiscount: true } });
  const model = createDisplayModel(s.project); assert.equal(model.fileBasedInformation, true);
  assert.deepEqual(model.products[0].prices, { original: { text: "282.87", currency: "USD" }, sale: { text: "206.50", currency: "USD" } });
  assert.equal(model.products[0].discount, "27%"); assert.ok(!JSON.stringify(model).includes(importedAt));
  const failed = inputProduct(); failed.originPrice = { raw: "unknown", amount: null, currency: "USD" }; failed.discountPrice = { raw: "10", amount: 10, currency: null }; failed.discount = { raw: "invalid", percent: null };
  s = reduce(s, { type: "replace", products: [failed], importedAt, confirmDiscard: true });
  assert.equal(Object.hasOwn(createDisplayModel(s.project).products[0], "prices"), false); assert.equal(Object.hasOwn(createDisplayModel(s.project).products[0], "discount"), false);
  const zero = inputProduct(); zero.discountPrice = { raw: "USD 0", amount: 0, currency: "USD" };
  s = reduce(s, { type: "replace", products: [zero], importedAt, confirmDiscard: true }); assert.equal(createDisplayModel(s.project).products[0].prices?.sale?.text, "0");
});

for (const language of ["ko", "en"] as const) for (const [raw, text, kind] of [
  ["USD 206.50", "206.50", "string"], ["USD 1,150.16", "1,150.16", "string"],
  ["USD 387", "387", "string"], ["282.8", "282.8", "number"],
  ["USD 1.1234567890123456789010", "1.1234567890123456789010", "string"],
] as const) test(`price digits: ${language} ${raw} (${kind})`, () => {
  const input = inputProduct(), price = parsePrice({ text: raw, kind }, kind === "number" ? "USD" : undefined);
  input.originPrice = price; input.discountPrice = price;
  let s = reduce(createEditorState(language), { type: "append", products: [input], importedAt });
  s = reduce(s, { type: "settings", patch: { showPrice: true } });
  const display = createDisplayModel(s.project).products[0];
  assert.deepEqual(display.prices, { original: { text, currency: "USD" }, sale: { text, currency: "USD" } });
  assert.equal(s.project.products[0].originPrice.raw, raw);
  assert.equal(Object.hasOwn(display.prices!.original!, "raw"), false);
});
test("price display omits invalid or inconsistent raw digits without substituting amounts", () => {
  for (const raw of ["USD 206.50<script>", "USD 206.51", "KRW 206.50", "USD 20,6.50", ""]) {
    const project = stateWith(1).project;
    const model = createDisplayModel({ ...project, settings: { ...project.settings, showPrice: true }, products: [{
      ...project.products[0], originPrice: { raw, amount: 206.5, currency: "USD" }, discountPrice: { raw: null, amount: null, currency: null },
    }] });
    assert.equal(model.products[0].prices, undefined);
  }
});

test("unsafe ProductId warning survives edits, undo and project JSON without guessing an ID", async () => {
  const { saveProjectJson, loadProjectJson } = await import("../../src/features/product-banner/projectJson.ts");
  const product = { ...inputProduct(1), productId: "9007199254740992", needsReview: ["productId"] as ["productId"] };
  let s = reduce(createEditorState("ko"), { type: "append", products: [product], importedAt });
  s = reduce(s, { type: "edit", id: "pb-1", changes: { name: "Edited" } });
  s = reduce(s, { type: "undo" });
  const p = loadProjectJson(saveProjectJson(s.project)).products[0];
  assert.equal(p.productId, product.productId);
  assert.equal(p.productIdNeedsReview, true);
  assert.deepEqual(productReviewFields(p), ["productId"]);
  assert.ok(!JSON.stringify(createDisplayModel(s.project)).includes("productIdNeedsReview"));
  const legacy = JSON.parse(saveProjectJson(s.project)); delete legacy.products[0].productIdNeedsReview;
  assert.equal(loadProjectJson(JSON.stringify(legacy)).products[0].productIdNeedsReview, false);
  legacy.products[0].productIdNeedsReview = "true";
  assert.throws(() => loadProjectJson(JSON.stringify(legacy)), code("INVALID_PROJECT"));
});
