import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { INPUT_ERROR_CODES } from "../../src/features/product-banner/inputTypes.ts";
import { inputErrorMessages } from "../../src/features/product-banner/inputErrorMessages.ts";
import { uiMessages } from "../../src/features/product-banner/uiMessages.ts";
import { getSeoDefinition, getSocialImageDefinition } from "../../src/app/seo.ts";
import { getGuideData, getGuideKeyForPath } from "../../src/i18n/guideData.ts";

function keys(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => typeof child === "object" ? keys(child, `${prefix}${key}.`) : [`${prefix}${key}`]).sort();
}
test("UI dictionaries have matching non-empty Korean and English entries", () => {
  for (const language of ["ko", "en"] as const) assert.deepEqual(Object.keys(inputErrorMessages[language]).sort(), [...INPUT_ERROR_CODES].sort());
  assert.deepEqual(keys(uiMessages.ko), keys(uiMessages.en));
  for (const language of ["ko", "en"] as const) {
    const entries = JSON.stringify(uiMessages[language]);
    assert.ok(!entries.includes(':""'));
    assert.equal(uiMessages[language].designs.length, 5);
  }
});
test("banner registration supplies localized SEO, guides, FAQ and generated social images", () => {
  const path = "/tools/product-banner";
  assert.equal(getGuideKeyForPath("product-banner", path), "productBanner");
  for (const language of ["ko", "en"] as const) {
    const seo = getSeoDefinition(language, path);
    const guide = getGuideData(language, "productBanner");
    assert.ok(seo.title.includes(language === "ko" ? "상품 배너" : "Product Banner"));
    assert.equal(seo.faq?.length, 2);
    assert.ok(guide.blocks.length > 0);
    assert.equal(getSocialImageDefinition(language, path).path, `social/tools/product-banner-${language}.png`);
    assert.ok(fs.statSync(`public/social/tools/product-banner-${language}.png`).size > 10_000);
  }
});
