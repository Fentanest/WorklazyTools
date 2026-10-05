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
    assert.ok(seo.title.includes(uiMessages[language].title));
    assert.equal(seo.faq?.length, 2);
    assert.ok(guide.blocks.length > 0);
    assert.equal(getSocialImageDefinition(language, path).path, `social/tools/product-banner-${language}.png`);
    assert.ok(fs.statSync(`public/social/tools/product-banner-${language}.png`).size > 10_000);
  }
});

test("AliExpress names, descriptions, search aliases and OG source agree in both languages", async () => {
  const { default: ko } = await import("../../src/locales/ko/tools.json", { with: { type: "json" } });
  const { default: en } = await import("../../src/locales/en/tools.json", { with: { type: "json" } });
  const source = fs.readFileSync("scripts/generate-social-images.mjs", "utf8");
  const search = fs.readFileSync("src/app/toolSearch.ts", "utf8").split('"product-banner":')[1].split("\n")[0];
  for (const [language, dictionary, title] of [["ko", ko, "알리익스프레스 광고 배너 만들기"], ["en", en, "AliExpress Ad Banner Builder"]] as const) {
    const tool = dictionary.items["product-banner"], seo = getSeoDefinition(language, "/tools/product-banner");
    assert.equal(tool.title, title); assert.equal(tool.shortTitle, title); assert.equal(uiMessages[language].title, title);
    assert.ok(seo.title.startsWith(title)); assert.equal(seo.application?.name, title);
    assert.ok(getGuideData(language, "productBanner").title.startsWith(title)); assert.ok(source.includes(title));
    assert.match(tool.description, /HTML.*iframe/u); assert.match(seo.description, /HTML.*iframe/u);
    assert.match(seo.faq![0].question, language === "ko" ? /알리익스프레스/u : /AliExpress/u);
  }
  for (const keyword of ["알리익스프레스", "알리", "제휴 마케팅", "엑셀", "aliexpress", "affiliate", "ad", "banner", "builder", "excel", "html", "iframe"]) assert.ok(search.includes(`"${keyword}"`));
});
