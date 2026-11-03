import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { canonicalSeoPath, getSeoDefinition, getSocialImageDefinition } from "../../src/app/seo.ts";
import { matchTools } from "../../src/app/toolSearch.ts";
import { tools } from "../../src/app/toolRegistry.ts";

const entries = [
  ["resize", "이미지 크기 줄이기", "Resize Image - Change Image Pixels & Ratio | Worklazy Tools"],
  ["mosaic", "이미지 모자이크", "Image Mosaic - Blur Specific Areas | Worklazy Tools"],
  ["watermark", "이미지 워터마크 넣기", "Add Image Watermark - Text & Copyright | Worklazy Tools"],
] as const;

for (const [slug, name, englishTitle] of entries) test(`image ${slug} uses the new Korean identity while preserving English and public URLs`, () => {
  const path = `/tools/image-studio/${slug}`;
  const ko = getSeoDefinition("ko", path);
  assert.equal(ko.title.split(" - ")[0], name);
  assert.equal(ko.application?.name, name);
  assert.match(ko.description, /이미지/);
  assert.doesNotMatch(`${ko.title} ${ko.description} ${ko.application?.name}`, /사진/);
  assert.equal(getSeoDefinition("en", path).title, englishTitle);
  for (const language of ["ko", "en"] as const) {
    assert.equal(canonicalSeoPath(path), path);
    assert.equal(getSocialImageDefinition(language, path).path, `social/tools/image-studio-${slug}-${language}.png`);
    assert.equal(getSocialImageDefinition(language, path).alt, getSeoDefinition(language, path).title);
  }
});

test("old Korean image task queries still find the editor through hidden synonyms", () => {
  const catalog = JSON.parse(fs.readFileSync("src/locales/ko/tools.json", "utf8"));
  const localized = tools.map(tool => ({ ...tool, ...catalog.items[tool.id], highlights: tool.highlights, scenarioLabels: [] }));
  const item = catalog.items["image-studio"];
  for (const query of ["사진 크기 줄이기", "사진 크기 조절", "사진 모자이크", "사진 워터마크 넣기"]) {
    assert.ok(item.synonyms.includes(query));
    assert.ok(matchTools(localized, query).some(tool => tool.id === "image-studio"), query);
    for (const field of ["title", "shortTitle", "description", "tagline", "eyebrow"]) assert.ok(!item[field].includes(query), `${query} must remain hidden`);
  }
});
