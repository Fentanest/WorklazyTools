import assert from "node:assert/strict";
import test from "node:test";

import { preserveCsvValue } from "../../src/features/excel-merger/csvImport.ts";
import { strengthChecker } from "../../src/features/security-tools/securityStrength.ts";
import { formatXml } from "../../src/features/text-formatter/formatterCore.ts";

test("CSV import preserves text that resembles typed spreadsheet values", () => {
  for (const value of ["00123", "2026-08-15", "1e3", "TRUE", "#N/A", "9007199254740993"]) {
    assert.equal(preserveCsvValue(value), value);
  }
  assert.equal(preserveCsvValue(""), null);
});

test("XML formatting preserves tag values, CDATA, and mixed-content spacing", () => {
  const source = '<root code="001"><n>007</n><hex>0x1A</hex><exp>1e3</exp><raw><![CDATA[  a < b  ]]></raw><mixed>Hello <b>wide</b> world</mixed></root>';
  const formatted = formatXml(source, "pretty", 2, false);
  assert.match(formatted, /code="001"/);
  assert.match(formatted, /<n>007<\/n>/);
  assert.match(formatted, /<hex>0x1A<\/hex>/);
  assert.match(formatted, /<exp>1e3<\/exp>/);
  assert.match(formatted, /<!\[CDATA\[  a < b  \]\]>/);
  assert.match(formatted, /Hello\s*<b>wide<\/b>\s*world/);
});

test("password strength uses common password dictionaries", () => {
  assert.ok(strengthChecker.check("password123").score <= 1);
});
