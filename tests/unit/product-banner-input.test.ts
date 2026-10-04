import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { headers, syntheticBytes, syntheticRow, utf8 } from "../fixtures/product-banner/synthetic.ts";
import { parseInputBytes, sniffInputFormat, classifyInputError } from "../../src/features/product-banner/inputParser.ts";
import { extractInputProducts, mapHeaders, normalizeHeader, parsePrice, parseDiscount, summarizeSheets } from "../../src/features/product-banner/inputMapping.ts";
import { INPUT_LIMITS, ProductBannerInputError } from "../../src/features/product-banner/inputTypes.ts";
import { validateProductUrl } from "../../src/features/product-banner/urlPolicy.ts";
const errorCode = (code: string) => (error: unknown) => error instanceof ProductBannerInputError && error.code === code;
for (const format of ["biff8", "xlsx"] as const) test(`${format}: byte sniffing, 21 columns, strings, prices, discount, video`, () => {
  const bytes = syntheticBytes(format), book = parseInputBytes(bytes), result = extractInputProducts(book, 2, "wrong.csv");
  assert.equal(book.format, format === "biff8" ? "xls" : "xlsx");
  assert.equal(result.products.length, 3); assert.equal(book.sheets[0].columnCount, 21);
  assert.equal(new Set(result.products.map((p) => p.imageUrl)).size, 3);
  assert.equal(new Set(result.products.map((p) => p.promotionUrl)).size, 3);
  assert.equal(result.products.filter((p) => p.videoUrl).length, 1);
  const product = result.products[0];
  assert.equal(product.productId, "1000000000000001"); assert.match(product.name, /합성 상품/u);
  assert.deepEqual(product.originPrice, { raw: "USD 282.87", amount: 282.87, currency: "USD" });
  assert.deepEqual(product.discount, { raw: "27%", percent: 27 }); assert.deepEqual(product.needsReview, []);
  assert.deepEqual(product.source, { fileIndex: 2, sheetIndex: 0, rowNumber: 2 });
  assert.ok(!JSON.stringify(product).includes("commission")); assert.ok(!JSON.stringify(product).includes("SYNTHETIC"));
});
test("UTF-8 BOM CSV retains quotes, commas, embedded newline, Korean and IDs", () => {
  const text = "\uFEFF" + Papa.unparse([headers, syntheticRow(1), [], syntheticRow(2)]);
  const result = extractInputProducts(parseInputBytes(utf8(text)), 0, "wrong.xls");
  assert.equal(result.format, "csv"); assert.equal(result.products.length, 2);
  assert.equal(result.products[0].name, syntheticRow(1)[3]);
  assert.equal(result.products[1].source.rowNumber, 4);
  assert.equal(result.products[0].productId, "1000000000000001");
  const row = syntheticRow(1); row[3] = '<script>synthetic text only</script>'; row[14] = '=HYPERLINK("https://example.com/p")';
  const textOnly = extractInputProducts(parseInputBytes(utf8(Papa.unparse([headers, row]))), 0, "csv").products[0];
  assert.equal(textOnly.name, row[3]); assert.equal(textOnly.promotionUrl, row[14]); assert.ok(textOnly.needsReview.includes("promotionUrl"));
});
test("header normalization, aliases, reordering and explicit instruction-row selection", () => {
  assert.equal(normalizeHeader("\uFEFF  Image   URL "), "image url");
  const book = parseInputBytes(syntheticBytes("xlsx", [["사용 안내"], [" 제휴   링크 ", "상품명", "이미지 주소", "상품ID"], ["https://example.com/p", "상품", "https://example.com/i", "00001234567890123456"]]));
  assert.equal(summarizeSheets(book)[0].suggestedHeaderRow, 2);
  const result = extractInputProducts(book, 0, "a", [{ sheetIndex: 0, headerRow: 2 }]);
  assert.equal(result.products[0].productId, "00001234567890123456"); assert.equal(result.products[0].source.rowNumber, 3);
});
test("duplicate/ambiguous and missing headers require confirmation; explicit mapping resolves", () => {
  const book = parseInputBytes(syntheticBytes("xlsx", [["Image Url", "image url", "Promotion Url"], ["https://example.com/i", "wrong", "https://example.com/p"]]));
  assert.equal(mapHeaders(["Image Url", "image url", "Promotion Url"]).issues[0].code, "MAPPING_AMBIGUOUS");
  assert.equal(extractInputProducts(book, 0, "a").products.length, 0);
  const result = extractInputProducts(book, 0, "a", [{ sheetIndex: 0, headerRow: 1, mapping: { imageUrl: 0 } }]);
  assert.equal(result.products.length, 1); assert.deepEqual(result.products[0].needsReview, ["name"]);
  const missing = parseInputBytes(utf8("CustomImage,CustomLink\nhttps://example.com/i,https://example.com/p"));
  assert.equal(extractInputProducts(missing, 0, "a").issues[0].code, "MAPPING_REQUIRED");
  assert.equal(extractInputProducts(missing, 0, "a", [{ sheetIndex: 0, headerRow: 1, mapping: { imageUrl: 0, promotionUrl: 1 } }]).products.length, 1);
  assert.equal(extractInputProducts(missing, 0, "a", [{ sheetIndex: 0, headerRow: 1, mapping: { imageUrl: 99, promotionUrl: 1 } }]).products.length, 0);
  assert.equal(extractInputProducts(missing, 0, "a", [{ sheetIndex: 0, headerRow: 99 }]).issues[0].code, "HEADER_ROW_INVALID");
  assert.equal(extractInputProducts(missing, 0, "a", [{ sheetIndex: 3 }]).issues[0].code, "SHEET_NOT_FOUND");
});
test("multi-sheet input follows workbook order and preserves duplicate rows", () => {
  const book = parseInputBytes(syntheticBytes("xlsx", [headers, syntheticRow(1), [], syntheticRow(1)], [[headers, syntheticRow(2)]]));
  const result = extractInputProducts(book, 0, "a", [{ sheetIndex: 1, headerRow: 1 }, { sheetIndex: 0, headerRow: 1 }]);
  assert.deepEqual(result.products.map((p) => [p.source.sheetIndex, p.source.rowNumber]), [[0, 2], [0, 4], [1, 2]]);
  assert.equal(result.products[0].promotionUrl, result.products[1].promotionUrl);
});
test("formula caches, display text and hyperlink metadata stay separate, no evaluation", () => {
  const sheet = XLSX.utils.aoa_to_sheet([headers, syntheticRow(1), syntheticRow(2)]);
  sheet.B2 = { t: "s", v: "https://EXAMPLE.com:443/a/../i?x=1&y=2", l: { Target: "https://example.com/metadata" } };
  sheet.O2 = { t: "s", v: "https://example.com/cached", f: 'HYPERLINK("https://example.com/formula","label")' };
  sheet.O3 = { t: "n", f: "1+1" }; sheet.A3 = { t: "n", v: 123456789012345678 }; // Already damaged.
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, sheet, "Formula");
  const book = parseInputBytes(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
  const products = extractInputProducts(book, 0, "a").products;
  assert.equal(products[0].sourceHyperlinks.imageUrl, "https://example.com/metadata");
  assert.equal(products[0].imageUrl, sheet.B2.v); assert.equal(products[0].promotionUrl, "https://example.com/cached");
  assert.ok(products[1].needsReview.includes("promotionUrl")); assert.ok(products[1].needsReview.includes("productId"));
  assert.equal(products[1].productId, null);
});
test("prices distinguish numeric cells, currency, failures and no conversion", () => {
  assert.deepEqual(parsePrice({ text: "282.87", kind: "number" }, "KRW"), { raw: "282.87", amount: 282.87, currency: "KRW" });
  assert.deepEqual(parsePrice({ text: "USD 282.87", kind: "string" }, "KRW"), { raw: "USD 282.87", amount: null, currency: "KRW" });
  assert.equal(parsePrice({ text: "USD 1,234.56", kind: "string" }).amount, 1234.56);
  for (const raw of ["", "unknown", "USD NaN", "1,23", "12abc", "-3"]) assert.equal(parsePrice({ text: raw, kind: "string" }).amount, null);
  assert.equal(parsePrice(null).amount, null); assert.equal(parsePrice({ text: "0", kind: "number" }).amount, 0);
  assert.equal(parseDiscount({ text: "0.27", kind: "number", display: "27%" }).percent, 27);
  for (const raw of ["", "27", "101%", "-1%", "Code 27%"]) assert.equal(parseDiscount({ text: raw, kind: "string" }).percent, null);
  assert.equal(parseDiscount(null).percent, null);
  const row = syntheticRow(1); row[6] = "";
  assert.equal(extractInputProducts(parseInputBytes(syntheticBytes("xlsx", [headers, row])), 0, "a").products[0].discount.percent, null);
});
test("unsafe URLs are retained and flagged; whitespace trim is the only rewrite", () => {
  const row = syntheticRow(1); row[1] = " javascript:alert(1) "; row[14] = " https://EXAMPLE.com:443/a/../b?x=1&y=2 "; row[3] = "";
  const p = extractInputProducts(parseInputBytes(syntheticBytes("xlsx", [headers, row])), 0, "a").products[0];
  assert.equal(p.imageUrl, "javascript:alert(1)"); assert.equal(p.promotionUrl, "https://EXAMPLE.com:443/a/../b?x=1&y=2");
  assert.deepEqual(p.originalUrls, { imageUrl: row[1], promotionUrl: row[14] });
  assert.deepEqual(p.needsReview, ["imageUrl", "name"]);
});
test("URL policy rejects schemes, credentials, controls, private IPs and local names", () => {
  for (const raw of ["http://example.com", "javascript:alert(1)", "file:///tmp/a", "data:image/png,x", "blob:https://example.com/x", "https://u:p@example.com", "https://example.com/a b", "https://example.com/a\nb", "https://example.com\\a", "https://localhost", "https://intranet", "https://x.local", "https://10.1.2.3", "https://172.16.1.1", "https://192.168.0.1", "https://169.254.1.1", "https://127.1", "https://2130706433", "https://0x7f000001", "https://[::1]", "https://[fc00::1]", "https://[fe80::1]", "https://[::ffff:192.168.1.1]"]) assert.equal(validateProductUrl(raw).valid, false, raw);
  for (const raw of ["https://example.com/a%20b", "https://fcshop.com", "https://fdshop.com", "https://[2606:4700:4700::1111]/"]) assert.equal(validateProductUrl(raw).valid, true, raw);
  assert.equal(validateProductUrl("https://localhost:1234", { allowLocalhost: true }).valid, true);
  assert.equal(validateProductUrl("https://10.0.0.1", { allowLocalhost: true }).valid, false);
});
test("HTML-as-xls is rejected without DOM/script execution; format/error codes are bounded", () => {
  assert.throws(() => parseInputBytes(utf8('<html><script>throw 1</script><table><tr><td>x</td></tr></table></html>')), errorCode("HTML_XLS_UNSUPPORTED"));
  assert.throws(() => parseInputBytes(utf8('<table><tr><td>x</td></tr></table>')), errorCode("HTML_XLS_UNSUPPORTED"));
  assert.throws(() => parseInputBytes(utf8(' '.repeat(5000) + '<table><tr><td>x</td></tr></table>')), errorCode("HTML_XLS_UNSUPPORTED"));
  assert.throws(() => parseInputBytes(new ArrayBuffer(0)), errorCode("EMPTY_FILE"));
  assert.throws(() => parseInputBytes(utf8("  \n")), errorCode("EMPTY_FILE"));
  assert.throws(() => parseInputBytes(new Uint8Array([0, 1, 2]).buffer), errorCode("UNSUPPORTED_FORMAT"));
  assert.throws(() => parseInputBytes(new Uint8Array([0x50, 0x4b, 3, 4, 0]).buffer), errorCode("DAMAGED_FILE"));
  assert.throws(() => parseInputBytes(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).buffer), errorCode("DAMAGED_FILE"));
  assert.throws(() => parseInputBytes(utf8('Image Url,Promotion Url\n"unfinished')), errorCode("CSV_INVALID"));
  assert.equal(classifyInputError(new Error("password required SECRET")).message, "ENCRYPTED_FILE");
  assert.equal(classifyInputError(new Error("bad SECRET")).message, "DAMAGED_FILE");
});
test("legacy raw BIFF bytes are sniffed as xls", () => {
  assert.equal(sniffInputFormat(new Uint8Array([9, 8, 16, 0])), "xls");
  // BIFF8 BOF + XOR FilePass + EOF; synthetic encryption marker, no real data.
  const encrypted = new Uint8Array([9,8,16,0,0,6,5,0,0,0,0,0,0,0,0,0,0,0,0,0,47,0,6,0,0,0,0,0,0,0,10,0,0,0]);
  assert.throws(() => parseInputBytes(encrypted.buffer), errorCode("ENCRYPTED_FILE"));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["not xlsx"]]), "s");
  for (const bookType of ["ods", "xlsb"] as const) assert.throws(() => parseInputBytes(XLSX.write(wb, { type: "array", bookType })), errorCode("UNSUPPORTED_FORMAT"));
});
test("1,000 and 10,000 products fit; file, cell, sheet and product bounds reject explicitly", () => {
  for (const count of [1000, INPUT_LIMITS.products]) {
    const rows = [headers, ...Array.from({ length: count }, (_, i) => syntheticRow(i + 1))];
    const result = extractInputProducts(parseInputBytes(utf8(Papa.unparse(rows))), 0, "large.csv");
    assert.equal(result.products.length, count);
  }
  assert.throws(() => sniffInputFormat(new Uint8Array(INPUT_LIMITS.fileBytes + 1)), errorCode("FILE_TOO_LARGE"));
  const book = parseInputBytes(utf8("Image Url,Promotion Url\nhttps://example.com/i,https://example.com/p"));
  book.sheets[0].rows.push(...Array.from({ length: INPUT_LIMITS.products }, (_, i) => ({ ...book.sheets[0].rows[1], rowNumber: i + 3 })));
  assert.throws(() => extractInputProducts(book, 0, "a"), errorCode("PRODUCT_LIMIT"));
  const wb = XLSX.utils.book_new(), sheet = XLSX.utils.aoa_to_sheet([["x"]]); sheet["!ref"] = "A1:ZZ10000";
  XLSX.utils.book_append_sheet(wb, sheet, "HugeRange");
  assert.throws(() => parseInputBytes(XLSX.write(wb, { type: "array", bookType: "xlsx" })), errorCode("CELL_LIMIT"));
  assert.throws(() => parseInputBytes(utf8("a,b\n".repeat(125_001))), errorCode("CELL_LIMIT"));
  const many = XLSX.utils.book_new(); for (let i = 0; i <= INPUT_LIMITS.sheets; i++) XLSX.utils.book_append_sheet(many, XLSX.utils.aoa_to_sheet([["x"]]), `s${i}`);
  assert.throws(() => parseInputBytes(XLSX.write(many, { type: "array", bookType: "xlsx" })), errorCode("SHEET_LIMIT"));
});
