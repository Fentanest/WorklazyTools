import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { matchTools, normalizeSearchText } from "../../src/app/toolSearch.ts";
import { tools as registry, toolCategories } from "../../src/app/toolRegistry.ts";
import { fileAccepts } from "../../src/app/fileAccepts.ts";

const catalog = (language: string) => {
  const locale = JSON.parse(readFileSync(new URL(`../../src/locales/${language}/tools.json`, import.meta.url), "utf8"));
  return registry.map((tool) => ({ ...tool, ...locale.items[tool.id],
    highlights: locale.items[tool.id].highlights.map((label: string) => ({ label })),
    categoryLabel: locale.categories[tool.category].label,
    categoryShortLabel: locale.categories[tool.category].shortLabel,
  }));
};
const ids = (query: string, language = "ko") => matchTools(catalog(language), query).map((tool) => tool.id);

test("search normalizes NFKC, case, whitespace; empty preserves registry order", () => {
  assert.equal(normalizeSearchText("  Ｅｘｃｅｌ   병합 "), "excel 병합");
  assert.deepEqual(ids(" \n "), registry.map((tool) => tool.id));
  assert.deepEqual(ids("EXCEL"), ids("excel"));
  assert.ok(ids("엑셀 병합").includes("excel-merger"));
});

test("all legacy aliases remain searchable in their language after locale migration", () => {
  for (const [id, aliases] of Object.entries(legacyAliases)) {
    for (const alias of aliases) {
      assert.ok(ids(alias).includes(id), `ko ${id}: ${alias}`);
      if (!/[가-힣]/.test(alias)) assert.ok(ids(alias, "en").includes(id), `en ${id}: ${alias}`);
    }
  }
});

test("synonyms have matching locale keys and English never consumes Korean copy", () => {
  const ko = catalog("ko"), en = catalog("en");
  assert.deepEqual(ko.map((tool) => tool.id), en.map((tool) => tool.id));
  for (const tool of [...ko, ...en]) {
    assert.ok(Array.isArray(tool.synonyms), tool.id);
    assert.ok(tool.synonyms.every((alias: unknown) => typeof alias === "string" && alias.trim()));
  }
  assert.ok(en.every((tool) => tool.synonyms.every((alias: string) => !/[가-힣]/.test(alias))));
  for (const [query, id, lang] of [
    ["얼굴 모자이크", "image-studio", "ko"], ["4대보험", "payroll-calculator", "ko"],
    ["PDF 직인", "pdf-editor", "ko"], ["QR코드", "qr-studio", "ko"],
    ["image resizer", "image-studio", "en"], ["mp3 cutter", "audio-studio", "en"],
    ["hwp viewer", "hwp-editor", "en"], ["diff checker", "text-compare", "en"],
  ]) assert.ok(ids(query, lang).includes(id), `${lang}: ${query}`);
});

test("choseong and AND terms match; mixed choseong stays literal; unknown gives zero", () => {
  assert.ok(ids("ㅇㅅ").includes("excel-merger"));
  assert.ok(ids("ㅁㅅ ㅂㄱ").includes("document-compare"));
  assert.deepEqual(ids("ㅁㅅ pdf"), []);
  assert.deepEqual(ids("zzz-no-such-tool-zzz"), []);
  assert.deepEqual(ids("병합 엑셀"), ids("엑셀 병합"));
});

test("format search reads the actual receiver contract, including XLSB and JPEG", () => {
  for (const tool of registry) for (const id of tool.receiverIds) {
    for (const extension of fileAccepts[id].extensions) {
      for (const language of ["ko", "en"]) assert.ok(ids(extension.toUpperCase(), language).includes(tool.id), `${language} ${tool.id}: ${extension}`);
    }
  }
  assert.ok(ids("xlsb").includes("excel-cleaner"));
  assert.ok(ids("jpeg").includes("image-studio"));
  // An unmapped tool must not gain unrelated formats from another receiver.
  const item = { ...catalog("en").find((tool) => tool.id === "text-compare")!,
    title: "fixture", shortTitle: "fixture", description: "", eyebrow: "", highlights: [], synonyms: [], categoryLabel: "", categoryShortLabel: "" };
  assert.deepEqual(matchTools([item], "xlsb"), []);
});

test("receiver IDs are valid and belong to the advertised tool; no accepts duplication", () => {
  const seen = new Set<string>();
  for (const tool of registry) {
    assert.equal("accepts" in tool, false);
    assert.ok(tool.scenarios.every((id) => toolCategories.some((category) => category.id === id)));
    assert.ok(tool.entryPoints.includes(tool.path));
    assert.ok(Array.isArray(tool.actions));
    for (const id of tool.receiverIds) {
      assert.ok(id in fileAccepts, `${tool.id}: ${id}`);
      assert.ok(fileAccepts[id].paths.some((path) => path === tool.path || path.startsWith(`${tool.path}/`)));
      assert.equal(seen.has(id), false, `${id} has one catalog owner`);
      seen.add(id);
    }
  }
  assert.deepEqual([...seen].sort(), Object.keys(fileAccepts).sort());
});

test("matcher consumes caller-localized tagline, scenario labels and synonyms without mutation", () => {
  const input = [{ ...catalog("en")[0], synonyms: ["unique-alias"], tagline: "unique-tagline", scenarioLabels: [{ id: "test", label: "unique-scenario" }] }];
  const snapshot = JSON.stringify(input);
  for (const query of ["UNIQUE-ALIAS", "unique-tagline", "unique-scenario"]) assert.equal(matchTools(input, query)[0], input[0]);
  assert.equal(JSON.stringify(input), snapshot);
});

// Fixed pre-U0 alias inventory (47f0678), not derived from current synonyms.
const legacyAliases: Record<string, string[]> = {
  "product-banner": ["알리익스프레스", "알리", "광고 배너", "배너 만들기", "배너 생성기", "제휴 마케팅", "제휴 링크", "엑셀", "aliexpress", "affiliate", "ad", "banner", "builder", "excel", "csv", "html", "iframe"],
  "market-calendar": ["증시", "휴장일", "krx", "nxt", "nyse", "nasdaq", "stock", "market", "calendar"],
  "excel-merger": ["엑셀", "xls", "xlsx"],
  "excel-compare": ["엑셀", "xls", "xlsx", "엑셀 대사", "대사", "diff", "diff checker"],
  "excel-cleaner": ["엑셀", "xls", "xlsx", "엑셀 중복 제거", "공백 제거", "중복 제거", "빈 행 삭제"],
  "document-compare": ["문서", "워드", "한글", "docx", "hwp", "diff", "diff checker"],
  "text-compare": ["텍스트", "비교", "diff", "diff checker"],
  "image-compare": ["이미지 비교", "diff", "diff checker"],
  "pdf-compare": ["pdf 비교", "diff", "diff checker"],
  "folder-compare": ["폴더 비교", "diff", "diff checker"],
  "hwp-editor": ["한글", "hwp", "hwpx", "한글 편집", "한글 뷰어", "hwp 뷰어", "hwp viewer"],
  "office-editor": ["워드 온라인", "엑셀 온라인", "word", "excel", "powerpoint", "office"],
  "pdf-editor": ["피디에프", "pdf", "PDF 나누기", "PDF 자르기", "PDF 직인", "쪽번호", "stamp", "watermark"],
  "pdf-converter": ["피디에프 변환", "PDF 워드 변환", "PDF 엑셀 변환", "PDF PPT 변환", "PDF 한글 변환", "스캔 PDF OCR", "검색 가능한 PDF", "HWP", "HWPX", "워드", "Word", "오피스", "Office", "엑셀", "Excel", "프레젠테이션", "PPT", "PPTX", "PowerPoint", "JPG", "PNG", "image to pdf", "pdf to image", "convert word to pdf", "pdf to word", "pdf to powerpoint", "word to pdf", "pdf to docx", "pdf to xlsx", "pdf to pptx", "pdf to hwpx", "searchable pdf", "scanned pdf ocr", "hwp to pdf"],
  "document-markdown": ["워드 마크다운", "엑셀 마크다운", "프레젠테이션", "마크다운", "Word to Markdown", "Excel to Markdown", "PowerPoint to Markdown", "PDF to Markdown", "DOCX", "XLSX", "XLS", "PPTX", "MarkItDown", "markdown"],
  "image-studio": ["사진", "이미지", "png", "jpg", "리사이즈", "image resizer", "블러", "얼굴 모자이크", "pixelate", "mosaic"],
  "audio-studio": ["음악 자르기", "mp3 cutter", "오디오", "mp3", "음악", "녹음"],
  "document-generator": ["워드 메일머지", "메일머지", "mail merge", "문서 일괄 생성", "양식 자동 채우기", "DOCX", "Word", "워드 온라인", "엑셀 온라인"],
  "document-redactor": ["개인정보 마스킹", "검정 박스", "PDF 가리기", "문서 가리기"],
  "payroll-calculator": ["4대보험", "급여", "실수령액", "퇴직금", "payroll", "salary"],
  "image-privacy": ["사진 메타데이터", "exif", "gps", "위치정보", "metadata"],
  "security-tools": ["랜덤 비밀번호", "비밀번호", "password", "random"],
  "qr-studio": ["QR 스튜디오", "QR 만들기", "QR 스캔", "QR코드", "qr", "qrcode"],
  "data-converter": ["데이터 변환", "csv", "json", "html", "table"],
};
