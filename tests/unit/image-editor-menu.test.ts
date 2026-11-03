import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { tools } from "../../src/app/toolRegistry.ts";
import { canonicalSeoPath, getSeoDefinition, getSocialImageDefinition } from "../../src/app/seo.ts";
import { matchTools } from "../../src/app/toolSearch.ts";

for (const lang of ["ko", "en"] as const) test(`${lang} image editor identity agrees across catalog, page, metadata and social text`, () => {
  const catalog=JSON.parse(fs.readFileSync(`src/locales/${lang}/tools.json`,"utf8"));
  const features=JSON.parse(fs.readFileSync(`src/locales/${lang}/features.json`,"utf8"));
  const expected=lang==="ko"?"이미지 편집":"Image Editor", item=catalog.items["image-studio"];
  assert.equal(item.title,expected);assert.equal(item.shortTitle,expected);assert.equal(features.image.title,expected);
  const seo=getSeoDefinition(lang,"/tools/image-studio");
  assert.match(seo.title,lang==="ko"?/온라인 이미지 편집/:/Online Image Editor/);
  assert.equal(seo.application?.name,expected);
  assert.doesNotMatch(seo.description,/사진 편집기|photo editor/i);
  assert.equal(getSocialImageDefinition(lang,"/tools/image-studio").alt,seo.title);
  const localized=tools.map(tool=>({...tool,...catalog.items[tool.id],highlights:tool.highlights,scenarioLabels:[]}));
  assert.ok(matchTools(localized,lang==="ko"?"이미지 편집":"Image Editor").some(t=>t.id==="image-studio"));
  assert.ok(matchTools(localized,lang==="ko"?"사진 편집":"photo editor").some(t=>t.id==="image-studio"),"existing search words still find the renamed tool");
});

test("image editor is first in the shared media catalog and its URLs stay unchanged", () => {
  assert.equal(tools.filter(t=>t.category==="media")[0].id,"image-studio");
  assert.equal(tools.find(t=>t.id==="image-studio")?.path,"/tools/image-studio");
  for(const path of ["/tools/image-studio","/tools/image-studio/resize","/tools/image-studio/mosaic","/tools/image-studio/watermark"]) {
    assert.equal(canonicalSeoPath(path),path);
    assert.match(getSocialImageDefinition("ko",path).path,/^social\/tools\/image-studio(?:-(?:resize|mosaic|watermark))?-ko\.png$/);
  }
});
