import assert from "node:assert/strict";
import test from "node:test";

import { alignDocumentSequence } from "../../src/features/document-compare/documentAlignment.ts";
import { compareDocumentModels, type ComparisonModel } from "../../src/features/document-compare/documentComparison.ts";
import { sniffDocumentFormat, validateDocumentPairFormats } from "../../src/features/document-compare/documentFormat.ts";

interface Paragraph {
  text: string;
  type?: "paragraph" | "table";
}

const align = (before: Paragraph[], after: Paragraph[]) => alignDocumentSequence(before, after, {
  textOf: (item) => item.text,
  compatible: (left, right) => (left.type ?? "paragraph") === (right.type ?? "paragraph"),
  canGroup: (item) => (item.type ?? "paragraph") === "paragraph",
});

test("empty paragraphs never become anchors or mass additions and deletions", () => {
  const before = [
    { text: "지원 동기" },
    { text: "" },
    { text: "고객의 요구를 빠르게 이해하고 실행 가능한 해결책을 제안했습니다." },
    { text: "입사 후 계획" },
  ];
  const after = [
    { text: "지원 동기" },
    { text: "   \n" },
    { text: "고객의 요구를 정확히 이해하고 실행 가능한 해결책을 제안했습니다." },
    { text: "입사 후 계획" },
  ];

  const groups = align(before, after);
  assert.deepEqual(groups.map(({ beforeIndexes, afterIndexes }) => ({ beforeIndexes, afterIndexes })), [
    { beforeIndexes: [0], afterIndexes: [0] },
    { beforeIndexes: [2], afterIndexes: [2] },
    { beforeIndexes: [3], afterIndexes: [3] },
  ]);
});

test("a rewritten paragraph split into two paragraphs remains one comparison group", () => {
  const before = [{
    text: "프로젝트에서 사용자 문의를 분석하고 반복되는 불편을 정리해 업무 절차를 개선했습니다. 그 결과 처리 시간이 줄고 안내의 정확성이 높아졌습니다.",
  }];
  const after = [
    { text: "프로젝트에서 사용자 문의를 세밀하게 분석하고 반복되는 불편을 정리했습니다." },
    { text: "이를 바탕으로 업무 절차를 개선해 처리 시간을 줄이고 안내 정확성을 높였습니다." },
  ];

  const groups = align(before, after);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].beforeIndexes, [0]);
  assert.deepEqual(groups[0].afterIndexes, [0, 1]);
});

test("a moved paragraph is paired once and marked independently from text changes", () => {
  const before = [
    { text: "첫 번째 역량은 자료를 체계적으로 정리하는 능력입니다." },
    { text: "두 번째 역량은 이해관계자와 명확하게 소통하는 능력입니다." },
    { text: "세 번째 역량은 일정과 위험을 끝까지 관리하는 책임감입니다." },
    { text: "마지막으로 배운 내용을 팀의 기준으로 문서화했습니다." },
  ];
  const after = [before[0], before[2], before[3], before[1]];

  const groups = align(before, after);
  const moved = groups.filter((group) => group.moved);
  assert.equal(groups.length, 4);
  assert.equal(moved.length, 1);
  assert.deepEqual(moved[0].beforeIndexes, [1]);
  assert.deepEqual(moved[0].afterIndexes, [3]);
  assert.equal(groups.flatMap((group) => group.beforeIndexes).length, 4);
  assert.equal(groups.flatMap((group) => group.afterIndexes).length, 4);
});

test("large documents with insertions do not fall back to cascading mismatches", () => {
  const before = Array.from({ length: 2_000 }, (_, index) => ({
    text: `문단 ${index + 1}: 고유한 업무 기록과 검토 번호 ${String(index * 7919).padStart(8, "0")}`,
  }));
  const after = [
    ...before.slice(0, 650),
    { text: "새로 추가된 첫 번째 검토 안내 문단입니다." },
    ...before.slice(650, 1_420),
    { text: "새로 추가된 두 번째 검토 안내 문단입니다." },
    ...before.slice(1_420),
  ];

  const groups = align(before, after);
  assert.equal(groups.filter((group) => group.beforeIndexes.length === 1 && group.afterIndexes.length === 1).length, 2_000);
  assert.equal(groups.filter((group) => group.beforeIndexes.length === 0).length, 2);
  assert.equal(groups.filter((group) => group.afterIndexes.length === 0).length, 0);
});

test("summary and document view are generated from the same alignment manifest", () => {
  const model = (paragraphs: string[]): ComparisonModel => ({
    blocks: paragraphs.map((text, index) => ({
      type: "paragraph",
      text,
      format: "",
      location: `본문 ${index + 1}문단`,
    })),
    headerFooter: [],
    notes: [],
    comments: [],
    warnings: [],
  });
  const before = model([
    "자기소개",
    "",
    "사용자의 문제를 관찰하고 원인을 정리해 해결책을 제안했습니다.",
    "업무 경험",
  ]);
  const after = model([
    "자기소개",
    " ",
    "사용자의 문제를 세밀하게 관찰하고 원인을 정리해 해결책을 제안했습니다.",
    "업무 경험",
  ]);

  const result = compareDocumentModels("before.docx", "after.docx", before, after, {
    formatting: true,
    tables: true,
    metadata: true,
  }, "ko");
  assert.deepEqual(result.summary, { added: 0, deleted: 0, changed: 1, format: 0, unchanged: 2, moved: 0 });
  assert.equal(result.changes.length, 1);
  assert.equal(result.views.document.length, 3);
  assert.equal(result.views.document.filter((view) => view.kind === "changed").length, 1);
});

test("inserted table rows and columns do not turn preserved cells into replacements", () => {
  const cell = (text: string, row: number, column: number) => ({
    text,
    format: "",
    location: `표 1 ${row}행 ${column}열`,
    segments: [],
    comments: [],
  });
  const tableModel = (rows: string[][]): ComparisonModel => ({
    blocks: [{
      type: "table",
      text: rows.map((row) => row.join("␟")).join(" | "),
      format: "",
      location: "표 1",
      table: { location: "표 1", sourceIndex: 0, grid: rows.map((row, rowIndex) => row.map((text, columnIndex) => cell(text, rowIndex + 1, columnIndex + 1))) },
    }],
    headerFooter: [], notes: [], comments: [], warnings: [],
  });
  const result = compareDocumentModels("before.docx", "after.docx", tableModel([
    ["항목", "금액", "비고"], ["A", "10", "유지"], ["B", "20", "유지"], ["C", "30", "유지"],
  ]), tableModel([
    ["항목", "신규열", "금액", "비고"], ["A", "x", "10", "유지"], ["새행", "y", "15", "추가"], ["B", "z", "20", "유지"], ["C", "w", "30", "유지"],
  ]), { formatting: true, tables: true, metadata: true }, "ko");

  assert.deepEqual(result.tables[0].rowPairs, [
    { beforeIndex: 0, afterIndex: 0 }, { beforeIndex: 1, afterIndex: 1 }, { beforeIndex: null, afterIndex: 2 },
    { beforeIndex: 2, afterIndex: 3 }, { beforeIndex: 3, afterIndex: 4 },
  ]);
  assert.deepEqual(result.tables[0].columnPairs, [
    { beforeIndex: 0, afterIndex: 0 }, { beforeIndex: null, afterIndex: 1 },
    { beforeIndex: 1, afterIndex: 2 }, { beforeIndex: 2, afterIndex: 3 },
  ]);
  assert.equal(result.changes.filter((change) => change.kind === "added").length, 8);
  assert.equal(result.changes.filter((change) => change.kind === "deleted").length, 0);
});

test("document formats are detected from content instead of file extensions", () => {
  const zip = (entry: string) => {
    const name = new TextEncoder().encode(entry);
    const bytes = new Uint8Array(4 + name.length);
    bytes.set([0x50, 0x4b, 0x03, 0x04]);
    bytes.set(name, 4);
    return bytes.buffer;
  };
  const compound = (stream: string) => {
    const encoded = new Uint8Array(stream.length * 2);
    for (let index = 0; index < stream.length; index += 1) encoded[index * 2] = stream.charCodeAt(index);
    const bytes = new Uint8Array(8 + encoded.length);
    bytes.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    bytes.set(encoded, 8);
    return bytes.buffer;
  };

  assert.equal(sniffDocumentFormat(zip("word/document.xml")), "docx");
  assert.equal(sniffDocumentFormat(zip("Contents/content.hpf")), "hwpx");
  assert.equal(sniffDocumentFormat(compound("WordDocument")), "doc");
  assert.equal(sniffDocumentFormat(compound("FileHeader")), "hwp");
});

test("pair validation allows same-family mixes and blocks Word-to-HWP pairs", () => {
  assert.deepEqual(validateDocumentPairFormats("doc", "docx", "ko"), {
    before: "doc",
    after: "docx",
    family: "word",
    trackedDocxEligible: false,
  });
  assert.deepEqual(validateDocumentPairFormats("hwp", "hwpx", "en"), {
    before: "hwp",
    after: "hwpx",
    family: "hwp",
    trackedDocxEligible: false,
  });
  assert.throws(() => validateDocumentPairFormats("docx", "hwp", "ko"), /서로 비교할 수 없습니다/);
});
