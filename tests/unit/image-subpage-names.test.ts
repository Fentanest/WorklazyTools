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

test("Korean image landing body and shared editor help consistently say image", () => {
  const guides = JSON.parse(fs.readFileSync("src/locales/ko/guides.json", "utf8")).image;
  const features = JSON.parse(fs.readFileSync("src/locales/ko/features.json", "utf8")).image;
  assert.doesNotMatch(JSON.stringify(guides), /사진/);
  assert.doesNotMatch(JSON.stringify(features), /사진/);
  assert.doesNotMatch(JSON.stringify([guides, features]), /이미지을|이미지은|이미지이 /);
  assert.match(guides.blocks[0].paragraphs[0], /JPG·PNG·WebP 이미지를 열고/);
  for (const [slug] of entries) assert.ok(guides.pathBlocks[`/tools/image-studio/${slug}`].length > 0);
  assert.equal(guides.pathBlocks["/tools/image-studio/resize"][0].title, "이미지 비율을 유지하면서 픽셀 크기를 줄이려면?");
  assert.equal(guides.pathBlocks["/tools/image-studio/watermark"][0].title, "이미지에 이름이나 출처 문구를 넣으려면?");
});

test("photo information removal keeps its distinct Korean proper names", () => {
  const features = JSON.parse(fs.readFileSync("src/locales/ko/features.json", "utf8"));
  const guides = JSON.parse(fs.readFileSync("src/locales/ko/guides.json", "utf8"));
  const common = JSON.parse(fs.readFileSync("src/locales/ko/common.json", "utf8"));
  assert.equal(features.imagePrivacy.title, "사진 메타데이터 제거");
  assert.equal(guides.imagePrivacy.title, "사진 메타데이터 제거 사용 안내");
  assert.equal(common.sendTo.privacy, "사진 정보 제거로 넘기기");
});
