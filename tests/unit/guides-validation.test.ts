import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

import {
  extractAppRoutes,
  removedProductionMemoTexts,
  validateGuidesData,
} from "../../scripts/validate-guides.mjs";
import expectations from "../../scripts/static-faq-expectations.json" with { type: "json" };

const currentGuides = {
  ko: JSON.parse(fs.readFileSync("src/locales/ko/guides.json", "utf8")),
  en: JSON.parse(fs.readFileSync("src/locales/en/guides.json", "utf8")),
};
const appRoutes = extractAppRoutes(fs.readFileSync("src/app/App.tsx", "utf8"));
const validate = (guidesData = structuredClone(currentGuides)) => validateGuidesData({ guidesData, appRoutes, expectations });
const fixtureParagraphs = (guidesData) => guidesData.en.textMerger.blocks.find((block) => Array.isArray(block.paragraphs)).paragraphs;

test("guide validation derives nested and isolated tool routes from App.tsx and accepts current data", () => {
  assert.ok(appRoutes.includes("/tools/document-compare/results/:pairNumber"));
  assert.ok(appRoutes.includes("/tools/excel-merger/xls-preserve"));
  assert.deepEqual(validate(), []);
});

test("all 19 removed production-note fixtures fail when reintroduced", async (t) => {
  assert.equal(removedProductionMemoTexts.length, 19);
  for (const [index, memo] of removedProductionMemoTexts.entries()) {
    await t.test(`fixture ${index + 1}`, () => {
      const guides = structuredClone(currentGuides);
      fixtureParagraphs(guides).unshift(memo);
      assert.ok(validate(guides).some((error) => error.includes("production memo")));
    });
  }
});

test("an orphan trailing title fails", () => {
  const guides = structuredClone(currentGuides);
  fixtureParagraphs(guides).push("Orphan Heading");
  assert.ok(validate(guides).some((error) => error.includes("orphan trailing paragraph")));
});

test("removing a selected required FAQ is reflected in validation", () => {
  const guides = structuredClone(currentGuides);
  guides.en["pdfEditor.convert"].pathFaqs["/tools/pdf-editor/ocr"] = ["faq_20"];
  assert.ok(validate(guides).some((error) => error.includes("Required FAQ missing") && error.includes("/tools/pdf-editor/ocr")));
});

test("a shared guide key requires an explicit selection for every route", () => {
  const guides = structuredClone(currentGuides);
  delete guides.en["pdfEditor.convert"].pathFaqs["/tools/pdf-editor/convert"];
  assert.ok(validate(guides).some((error) => error.includes("Explicit pathFaqs required for shared guide key 'pdfEditor.convert' at route '/tools/pdf-editor/convert'")));
});

test("a guide key with one validated route may use the full FAQ fallback", () => {
  const guides = structuredClone(currentGuides);
  delete guides.en.excelCompare.pathFaqs["/tools/excel-compare"];
  assert.deepEqual(validate(guides), []);
});

test("a path typo and an empty selection both fail", () => {
  const guides = structuredClone(currentGuides);
  guides.ko.textMerger.pathFaqs["/tools/text-merger-typo"] = ["faq_0"];
  guides.en.textMerger.pathFaqs["/tools/text-merger"] = [];
  const errors = validate(guides);
  assert.ok(errors.some((error) => error.includes("not an exact App route") && error.includes("text-merger-typo")));
  assert.ok(errors.some((error) => error.includes("must not be empty") && error.includes("/tools/text-merger")));
});

test("normal user cautions and short sentences ending in quotes or numbers are negative controls", async (t) => {
  const controls = {
    ko: ["결과를 저장하기 전에 다시 확인하세요.", "이 기능은 원본을 바꾸지 않습니다.", "표시값은 참고용이므로 그대로 믿지 마세요.", "항목 이름은 “보고서”", "최대 개수는 12"],
    en: ["Check the saved result before sharing it.", 'The label is "Report"', "The maximum is 12"],
  };
  for (const [lang, sentences] of Object.entries(controls)) {
    for (const sentence of sentences) {
      await t.test(`${lang}: ${sentence}`, () => {
        const guides = structuredClone(currentGuides);
        guides[lang].textMerger.blocks.find((block) => Array.isArray(block.paragraphs)).paragraphs.push(sentence);
        assert.deepEqual(validate(guides), []);
      });
    }
  }
});
