import assert from "node:assert/strict";
import test from "node:test";
import { normalizeToolsSearch, safeAnalyticsPage, toolFilterValues } from "../../src/app/publicService.ts";
import { stripSiteBasePath } from "../../src/app/siteBasePath.ts";
test("R9 accepts all 512 fixed filter combinations, with fixed order and query-free analytics", () => {
  for (const category of ["", ...toolFilterValues.category]) for (const from of ["", ...toolFilterValues.from]) for (const action of ["", ...toolFilterValues.do]) {
    const params = new URLSearchParams();
    if (action) params.set("do", action); if (from) params.set("from", from); if (category) params.set("category", category);
    const raw = params.size ? `?${params}` : "", canonical = normalizeToolsSearch(raw);
    assert.equal(normalizeToolsSearch(canonical), canonical);
    assert.deepEqual([...new URLSearchParams(canonical).keys()], [category && "category", from && "from", action && "do"].filter(Boolean));
    for (const lang of ["ko", "en"]) {
      const pathname = stripSiteBasePath(`/worklazytools/${lang}/tools/`, "/worklazytools/")!;
      assert.deepEqual(safeAnalyticsPage(pathname, canonical), { path: `/${lang}/tools/`, title: "Worklazy Tools · tools" });
      if (raw !== canonical) assert.equal(safeAnalyticsPage(pathname, raw), null);
    }
  }
});
test("R9 drops unknown/empty/duplicate/malformed keys and values before provider eligibility", () => {
  for (const [raw, expected] of [
    ["?category=documents&category=media&from=image", "?from=image"],
    ["?category=documents&%63ategory=media", ""], ["?from=pdf&from=%ZZ", ""],
    ["?category=media&file=private.pdf", "?category=media"], ["?category=&from=PDF&do=merge", "?do=merge"],
    ["?%E0%A4%A=x&from=pdf&do=%ZZ", "?from=pdf"], ["?%FF=pdf&do=clean", "?do=clean"],
    ["?category=media&category", ""], ["?from=pdf&&do=protect&", "?from=pdf&do=protect"],
    ["?%63ategory=%6dedia", "?category=media"], ["?q=private.pdf&do=clean", "?do=clean"],
    ["?from=private.xlsx&do=secret", ""], ["?Category=media", ""], ["?", ""],
  ]) {
    assert.equal(normalizeToolsSearch(raw), expected, raw);
    assert.equal(safeAnalyticsPage("/en/tools/", raw), null, raw);
    assert.ok(safeAnalyticsPage("/en/tools/", expected));
  }
  assert.equal(safeAnalyticsPage("/ko/tools/", "?from=pdf", "#private.pdf"), null);
  assert.equal(safeAnalyticsPage("/en/tools/pdf-editor/", "?from=pdf"), null);
});
