import assert from "node:assert/strict";
import test from "node:test";

import { preserveCsvValue, readCsvWorkbook } from "../../src/features/excel-merger/csvImport.ts";
import { parseCsvStream } from "../../src/features/data-converter/dataConverterCore.ts";
import { strengthChecker } from "../../src/features/security-tools/securityStrength.ts";
import { collapseSql, formatXml } from "../../src/features/text-formatter/formatterCore.ts";

test("CSV import preserves text that resembles typed spreadsheet values", () => {
  for (const value of ["00123", "2026-08-15", "1e3", "TRUE", "#N/A", "9007199254740993"]) {
    assert.equal(preserveCsvValue(value), value);
  }
  assert.equal(preserveCsvValue(""), null);
});

test("Excel CSV integration keeps text values through ExcelJS csv.read", async () => {
  const workbook = await readCsvWorkbook("value\n00123\n2026-08-15\n1e3\nTRUE\n#N/A\n9007199254740993", "CSV");
  assert.deepEqual([2, 3, 4, 5, 6, 7].map((row) => workbook.getWorksheet("CSV")?.getCell(row, 1).value), ["00123", "2026-08-15", "1e3", "TRUE", "#N/A", "9007199254740993"]);
});

test("XML formatting preserves tag values, CDATA, and mixed-content spacing", () => {
  const source = '<root code="001"><n>007</n><hex>0x1A</hex><exp>1e3</exp><raw><![CDATA[  a < b  ]]></raw><mixed>Hello <b>wide</b> world</mixed></root>';
  const formatted = formatXml(source, "pretty", 2, false);
  assert.match(formatted, /code="001"/);
  assert.match(formatted, /<n>007<\/n>/);
  assert.match(formatted, /<hex>0x1A<\/hex>/);
  assert.match(formatted, /<exp>1e3<\/exp>/);
  assert.match(formatted, /<!\[CDATA\[  a < b  \]\]>/);
  assert.ok(formatted.includes("Hello \n    <b>wide</b>\n     world"));
  assert.equal(formatXml('<root><mixed>Hello <b>wide</b> world</mixed></root>', "minify", 2, false), '<root><mixed>Hello <b>wide</b> world</mixed></root>');
  assert.throws(() => formatXml("<root><broken></root>", "minify", 2, false), /XML line 1/);
});

test("CSV streaming rejects fatal quote errors and returns no partial table", async () => {
  await assert.rejects(parseCsvStream('name,value\nvalid,1\n"unterminated,2', false), /Quoted field unterminated/);
  assert.deepEqual(await parseCsvStream("name,value\nvalid,1", false), { headers: ["name", "value"], rows: [["valid", "1"]], warnings: [] });
});

test("SQL minification never joins arithmetic minus tokens into a line comment", () => {
  assert.equal(collapseSql("SELECT a -\n-1 FROM records", false), "SELECT a - -1 FROM records");
  assert.equal(collapseSql("SELECT a -- explanation\nFROM records", false), "SELECT a /* explanation */ FROM records");
});

test("password strength uses common password dictionaries", () => {
  assert.ok(strengthChecker.check("password123").score <= 1);
});
