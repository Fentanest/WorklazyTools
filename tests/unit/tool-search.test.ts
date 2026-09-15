import assert from "node:assert/strict";
import test from "node:test";

import { matchTools, normalizeSearchText, toolAliasesFor } from "../../src/app/toolSearch.ts";

const tools = [
  { id: "excel-merger", title: "Excel Merger", shortTitle: "Excel 병합", description: "여러 Excel 파일", eyebrow: "스프레드시트", highlights: [{ label: "시트별 병합" }], categoryLabel: "문서", categoryShortLabel: "문서", path: "/tools/excel-merger" },
  { id: "document-compare", title: "Document Compare", shortTitle: "문서 비교", description: "Excel 보고서를 만든다", eyebrow: "문서 비교", highlights: [], categoryLabel: "문서", categoryShortLabel: "문서", path: "/tools/document-compare" },
  { id: "pdf-editor", title: "PDF Tools", shortTitle: "PDF 도구", description: "PDF 편집", eyebrow: "PDF", highlights: [], categoryLabel: "문서", categoryShortLabel: "문서", path: "/tools/pdf-editor" },
];

const ids = (query: string) => matchTools(tools, query).map((tool) => tool.id);

test("search normalizes case, spacing, and blank queries", () => {
  assert.equal(normalizeSearchText("  Excel   병합 "), "excel 병합");
  assert.deepEqual(ids(""), ["excel-merger", "document-compare", "pdf-editor"]);
  assert.deepEqual(ids("EXCEL"), ["excel-merger", "document-compare"]);
  assert.deepEqual(ids("excel 병합"), ["excel-merger"]);
});

test("search matches aliases and eyebrow/category labels", () => {
  assert.deepEqual(toolAliasesFor("excel-merger"), ["엑셀", "xls", "xlsx"]);
  assert.deepEqual(ids("엑셀"), ["excel-merger"]);
  assert.deepEqual(ids("스프레드시트"), ["excel-merger"]);
  assert.deepEqual(ids("xls"), ["excel-merger"]);
});

test("choseong queries match only in choseong space", () => {
  assert.deepEqual(ids("ㅇㅅ"), ["excel-merger"]);
  assert.deepEqual(ids("ㅁㅅ pdf"), []);
  assert.deepEqual(ids("pdf"), ["pdf-editor"]);
});
