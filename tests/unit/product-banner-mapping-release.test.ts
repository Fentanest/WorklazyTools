import test from "node:test";
import assert from "node:assert/strict";
import { extractInputProducts } from "../../src/features/product-banner/inputMapping.ts";
import { parseInputBytes } from "../../src/features/product-banner/inputParser.ts";
import { utf8 } from "../fixtures/product-banner/synthetic.ts";
import type { ProductField, SheetSelection } from "../../src/features/product-banner/inputTypes.ts";

const book = () => parseInputBytes(utf8("Image Url,Promotion Url,Product Desc,ProductId,Video Url,Origin Price,Discount Price,Discount,Currency\nhttps://example.com/i,https://example.com/p,Synthetic name,0001,https://example.com/v,20,10,50%,USD"));
const extract = (mapping?: SheetSelection["mapping"]) => extractInputProducts(book(), 0, "synthetic.csv", [{ sheetIndex: 0, headerRow: 1, mapping }]);
test("R3a-F02 omitted mappings retain automatic detection", () => {
  for (const mapping of [undefined, {}, { name: undefined }]) {
    const result = extract(mapping); assert.deepEqual(result.issues, []);
    assert.equal(result.products[0].name, "Synthetic name"); assert.equal(result.products[0].productId, "0001");
  }
});
test("R3a-F02 explicit release excludes optional source values", () => {
  const result = extract({ name: null, productId: null, videoUrl: null, originPrice: null, discountPrice: null, discount: null, currency: null });
  assert.deepEqual(result.issues, []); assert.equal(result.products.length, 1);
  const p = result.products[0]; assert.equal(p.name, ""); assert.equal(p.productId, null); assert.equal(p.videoUrl, null);
  assert.deepEqual(p.originPrice, { raw: null, amount: null, currency: null });
  assert.deepEqual(p.discountPrice, { raw: null, amount: null, currency: null });
  assert.deepEqual(p.discount, { raw: null, percent: null }); assert.deepEqual(p.needsReview, ["name"]);
});
for (const field of ["imageUrl", "promotionUrl"] as ProductField[]) test(`R3a-F02 released required ${field} blocks extraction until reassigned`, () => {
  const result = extract({ [field]: null }); assert.equal(result.products.length, 0);
  assert.deepEqual(result.issues, [{ sheetIndex: 0, code: "MAPPING_REQUIRED", field }]);
  assert.equal(extract({ [field]: field === "imageUrl" ? 0 : 1 }).products.length, 1);
});
test("R3a-F02 explicit release resolves optional ambiguity without importing it", () => {
  const ambiguous = parseInputBytes(utf8("Image Url,Promotion Url,Name,Product Desc\nhttps://example.com/i,https://example.com/p,A,B"));
  assert.equal(extractInputProducts(ambiguous, 0, "synthetic").products.length, 0);
  const result = extractInputProducts(ambiguous, 0, "synthetic", [{ sheetIndex: 0, headerRow: 1, mapping: { name: null } }]);
  assert.deepEqual(result.issues, []); assert.equal(result.products[0].name, "");
});
