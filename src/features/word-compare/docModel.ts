import docToText, { type LegacyWordModel, type LegacyWordParagraph, type LegacyWordRun } from "legacy-word-doc-reader";

import type { WordCellComment, WordTableCell } from "../excel-merger/types";
import type {
  ComparisonBlock,
  ComparisonModel,
  ComparisonOptions,
  ComparisonRecord,
  ComparisonTable,
} from "../document-compare/documentComparison";

export function extractLegacyDocModel(
  bytes: Uint8Array,
  options: ComparisonOptions,
  language: "ko" | "en",
): ComparisonModel {
  const model = docToText.model(bytes);
  if (!model) {
    throw new Error(language === "en"
      ? "This DOC file could not be opened. Word 6/95 files, password-protected files, and damaged files are not supported. Save it again as Word 97–2003 DOC or DOCX and retry."
      : "이 DOC 파일을 열지 못했습니다. Word 6/95 형식, 암호로 보호된 파일, 손상된 파일은 지원하지 않습니다. Word 97–2003 DOC 또는 DOCX로 다시 저장한 뒤 시도해 주세요.");
  }
  const comments = options.metadata ? recordsFromStory(model.annotations, language === "en" ? "Comment" : "메모", options.formatting) : [];
  const blocks = bodyBlocks(model, comments, options, language);
  const headerFooter = options.metadata
    ? [
        ...recordsFromStory(model.header, language === "en" ? "Header" : "머리말", options.formatting),
        ...recordsFromStory(model.footer, language === "en" ? "Footer" : "꼬리말", options.formatting),
      ]
    : [];
  const notes = options.metadata
    ? [
        ...recordsFromStory(model.footnotes, language === "en" ? "Footnote" : "각주", options.formatting),
        ...recordsFromStory(model.endnotes, language === "en" ? "Endnote" : "미주", options.formatting),
      ]
    : [];
  return {
    blocks,
    headerFooter,
    notes,
    comments,
    warnings: [language === "en"
      ? "DOC comparison preserves text, common formatting, lists, and tables. Exact page layout, drawing objects, and some advanced Word features may be simplified."
      : "DOC 비교는 텍스트, 일반 서식, 목록과 표를 반영합니다. 정확한 페이지 배치, 그리기 개체와 일부 고급 Word 기능은 단순화될 수 있습니다."],
  };
}

function bodyBlocks(
  model: LegacyWordModel,
  commentRecords: ComparisonRecord[],
  options: ComparisonOptions,
  language: "ko" | "en",
) {
  const blocks: ComparisonBlock[] = [];
  let paragraphIndex = 0;
  let tableIndex = 0;
  let tableRows: WordTableCell[][] = [];
  let tableRow: WordTableCell[] = [];
  const flushTable = () => {
    if (!tableRows.length && !tableRow.length) return;
    if (tableRow.length) tableRows.push(tableRow);
    if (options.tables) {
      const location = language === "en" ? `Table ${tableIndex + 1}` : `표 ${tableIndex + 1}`;
      const table: ComparisonTable = { location, sourceIndex: tableIndex, grid: tableRows };
      blocks.push({
        type: "table",
        text: tableRows.map((row) => row.map((cell) => cell.text).join("\u241f")).filter(Boolean).join(" | "),
        format: "",
        location,
        table,
      });
      tableIndex += 1;
    }
    tableRows = [];
    tableRow = [];
  };

  for (const paragraph of model.body ?? []) {
    if (paragraph.kind === "cell" || paragraph.kind === "rowEnd") {
      const rowNumber = tableRows.length + 1;
      const columnNumber = tableRow.length + 1;
      const location = language === "en"
        ? `Table ${tableIndex + 1}, row ${rowNumber}, column ${columnNumber}`
        : `표 ${tableIndex + 1} ${rowNumber}행 ${columnNumber}열`;
      tableRow.push(cellFromParagraph(paragraph, location, options.formatting));
      if (paragraph.kind === "rowEnd") {
        tableRows.push(tableRow);
        tableRow = [];
      }
      continue;
    }
    flushTable();
    paragraphIndex += 1;
    const record = recordFromParagraph(
      paragraph,
      language === "en" ? `Body paragraph ${paragraphIndex}` : `본문 ${paragraphIndex}번째 문단`,
      options.formatting,
      commentRecords,
    );
    blocks.push({ type: "paragraph", ...record });
  }
  flushTable();
  return blocks;
}

function recordsFromStory(story: LegacyWordParagraph[] | undefined, label: string, formatting: boolean) {
  return (story ?? []).flatMap((paragraph, index) => {
    const record = recordFromParagraph(paragraph, `${label} ${index + 1}`, formatting, []);
    return record.text || record.format ? [record] : [];
  });
}

function recordFromParagraph(
  paragraph: LegacyWordParagraph,
  location: string,
  formatting: boolean,
  commentRecords: ComparisonRecord[],
): ComparisonRecord {
  const marker = paragraph.list?.marker?.trim() ?? "";
  const rawText = (paragraph.runs ?? []).map(runText).join("");
  const text = marker && rawText ? `${marker} ${rawText}` : marker || rawText;
  const commentIndexes = (paragraph.runs ?? []).flatMap((run) => typeof run.comRef === "number" ? [run.comRef] : []);
  const comments: WordCellComment[] = [...new Set(commentIndexes)].flatMap((index) => {
    const comment = commentRecords[index];
    return comment ? [{ id: String(index), author: "", text: comment.text }] : [];
  });
  return {
    text: cleanText(text),
    format: formatting ? paragraphFormat(paragraph) : "",
    location,
    comments,
  };
}

function cellFromParagraph(paragraph: LegacyWordParagraph, location: string, formatting: boolean): WordTableCell {
  const record = recordFromParagraph(paragraph, location, formatting, []);
  return { ...record, segments: [], comments: record.comments ?? [] };
}

function runText(run: LegacyWordRun) {
  return typeof run.text === "string" ? run.text : "";
}

function paragraphFormat(paragraph: LegacyWordParagraph) {
  return stableStringify({
    align: paragraph.align ?? 0,
    list: paragraph.list ?? null,
    pp: paragraph.pp ?? null,
    runs: (paragraph.runs ?? []).flatMap((run) => {
      if (!run.text) return [];
      const { text: _text, image: _image, ...format } = run;
      return [format];
    }),
  });
}

function cleanText(value: string) {
  return value.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function stableStringify(value: unknown) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortValue(item)]));
  }
  return value;
}
