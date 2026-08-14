/// <reference lib="webworker" />

import initRhwp, { HwpDocument } from "@rhwp/core";
import rhwpWasmUrl from "@rhwp/core/rhwp_bg.wasm?url";

import type {
  WordCompareResult,
  WordDiffItem,
  WordDiffSegment,
  WordDocumentViewItem,
  WordTableAxisPair,
  WordTableCell,
  WordTableComparison,
  WordViewKind,
} from "../excel-merger/types";
import type { HwpCompareOptions, HwpWorkerPairResult } from "./hwpWorkerClient";

interface PairPayload {
  beforeName: string;
  afterName: string;
  beforeBuffer: ArrayBuffer;
  afterBuffer: ArrayBuffer;
  beforePassword?: string;
  afterPassword?: string;
}

interface HwpParagraph {
  text: string;
  format: string;
  location: string;
}

interface HwpTable {
  section: number;
  paragraph: number;
  control: number;
  location: string;
  grid: WordTableCell[][];
}

interface HwpBlock {
  type: "paragraph" | "table";
  text: string;
  format: string;
  location: string;
  table?: HwpTable;
}

interface HwpModel {
  blocks: HwpBlock[];
  headerFooter: HwpParagraph[];
  notes: HwpParagraph[];
  warnings: string[];
}

interface SequencePair {
  beforeIndex: number | null;
  afterIndex: number | null;
}

interface SequenceGroup {
  beforeIndexes: number[];
  afterIndexes: number[];
}

interface ControlLayout {
  type?: string;
  secIdx?: number;
  paraIdx?: number;
  controlIdx?: number;
  rowCount?: number;
  colCount?: number;
  cells?: Array<{ cellIdx: number; row: number; col: number; rowSpan?: number; colSpan?: number }>;
}

const worker = self as unknown as DedicatedWorkerGlobalScope;
let initialization: Promise<unknown> | undefined;
let currentLanguage: "ko" | "en" = "ko";
const L = (ko: string, english: string) => currentLanguage === "en" ? english : ko;

worker.onmessage = async (event: MessageEvent<{ pairs: PairPayload[]; options: HwpCompareOptions; language?: "ko" | "en" }>) => {
  try {
    currentLanguage = event.data.language === "en" ? "en" : "ko";
    await ensureRhwp();
    const { pairs, options } = event.data;
    const results: HwpWorkerPairResult[] = [];
    for (let index = 0; index < pairs.length; index += 1) {
      const pair = pairs[index];
      const start = (index / Math.max(1, pairs.length)) * 100;
      const size = 100 / Math.max(1, pairs.length);
      progress(start + size * 0.05, L(`[${index + 1}/${pairs.length}] ${pair.beforeName} 문서 구조를 읽는 중…`, `[${index + 1}/${pairs.length}] Reading the structure of ${pair.beforeName}…`));
      const before = parseDocument(pair.beforeName, pair.beforeBuffer, pair.beforePassword, options);
      progress(start + size * 0.38, L(`[${index + 1}/${pairs.length}] ${pair.afterName} 문서 구조를 읽는 중…`, `[${index + 1}/${pairs.length}] Reading the structure of ${pair.afterName}…`));
      const after = parseDocument(pair.afterName, pair.afterBuffer, pair.afterPassword, options);
      progress(start + size * 0.72, L(`[${index + 1}/${pairs.length}] 문단과 표의 대응 관계를 분석하는 중…`, `[${index + 1}/${pairs.length}] Matching paragraphs and tables…`));
      results.push({ result: compareModels(pair.beforeName, pair.afterName, before, after, options) });
      progress(start + size, L(`[${index + 1}/${pairs.length}] HWP 비교 완료`, `[${index + 1}/${pairs.length}] HWP comparison complete`));
      await yieldToWorker();
    }
    worker.postMessage({ type: "result", result: results });
  } catch (error) {
    worker.postMessage({ type: "error", error: { message: normalizeError(error) } });
  }
};

function ensureRhwp() {
  if (!initialization) {
    const scope = globalThis as typeof globalThis & { measureTextWidth?: (font: string, text: string) => number };
    scope.measureTextWidth = (font, text) => {
      if (typeof OffscreenCanvas === "undefined") return String(text).length * 7;
      const canvas = new OffscreenCanvas(1, 1);
      const context = canvas.getContext("2d");
      if (!context) return String(text).length * 7;
      context.font = font || "10pt sans-serif";
      return context.measureText(String(text)).width;
    };
    initialization = initRhwp({ module_or_path: rhwpWasmUrl });
  }
  return initialization;
}

function parseDocument(name: string, buffer: ArrayBuffer, password: string | undefined, options: HwpCompareOptions): HwpModel {
  let document: HwpDocument | undefined;
  try {
    const bytes = new Uint8Array(buffer);
    document = password ? HwpDocument.openWithPassword(bytes, password) : new HwpDocument(bytes);
    const outlineLabels = readOutlineLabels(document);
    const tables = options.tables ? readTables(document) : [];
    const tablesByParagraph = new Map<string, HwpTable[]>();
    tables.forEach((table) => {
      const key = `${table.section}:${table.paragraph}`;
      tablesByParagraph.set(key, [...(tablesByParagraph.get(key) ?? []), table]);
    });

    const blocks: HwpBlock[] = [];
    for (let section = 0; section < document.getSectionCount(); section += 1) {
      for (let paragraph = 0; paragraph < document.getParagraphCount(section); paragraph += 1) {
        const key = `${section}:${paragraph}`;
        const text = cleanText(document.getTextRange(section, paragraph, 0, document.getParagraphLength(section, paragraph)));
        const outline = outlineLabels.get(key);
        const displayText = [outline, text].filter(Boolean).join(" ");
        if (displayText) {
          blocks.push({
            type: "paragraph",
            text: displayText,
            format: options.formatting ? bodyFormat(document, section, paragraph, text.length) : "",
            location: L(`제${section + 1}구역 ${paragraph + 1}문단`, `Section ${section + 1}, paragraph ${paragraph + 1}`),
          });
        }
        for (const table of tablesByParagraph.get(key) ?? []) {
          blocks.push({ type: "table", text: flattenTable(table), format: "", location: table.location, table });
        }
      }
    }

    const headerFooter = options.metadata ? readHeaderFooters(document, options.formatting) : [];
    const notes = options.metadata ? readNotes(document, options.formatting) : [];
    const warnings = [
      L("HWP/HWPX의 검토 메모와 변경 추적 기록은 현재 브라우저 분석 범위에 포함되지 않아 비교 대상에서 제외됩니다.", "HWP/HWPX review comments and tracked changes are outside the current browser parser scope and are excluded from comparison."),
    ];
    if (options.tables && tables.some((table) => table.grid.some((row) => row.some((cell) => /병합|merged/i.test(cell.location))))) {
      warnings.push(L("병합 셀은 시작 셀의 내용으로 비교하며 병합 범위 자체의 세부 차이는 단순화될 수 있습니다.", "Merged cells are compared by their leading cell; detailed differences in the merged range may be simplified."));
    }
    return { blocks, headerFooter, notes, warnings };
  } catch (error) {
    const message = normalizeError(error);
    if (/비밀번호|password|encrypted|암호/i.test(message)) {
      throw new Error(L(`${name}: 암호로 보호된 문서입니다. 파일 목록의 암호 입력란에 열기 암호를 입력해 주세요.`, `${name}: this document is password-protected. Enter its open password in the file list.`));
    }
    throw new Error(`${name}: ${message}`);
  } finally {
    document?.free();
  }
}

function readOutlineLabels(document: HwpDocument) {
  const labels = new Map<string, string>();
  const parsed = safeJson<{ outline?: Array<{ section?: number; paragraph?: number; number?: string }> }>(document.getOutlineNavigation(), {});
  for (const item of parsed.outline ?? []) {
    if (item.section === undefined || item.paragraph === undefined || !item.number) continue;
    labels.set(`${item.section}:${item.paragraph}`, cleanText(item.number));
  }
  return labels;
}

function readTables(document: HwpDocument) {
  const tables: HwpTable[] = [];
  const seen = new Set<string>();
  for (let page = 0; page < document.pageCount(); page += 1) {
    const layout = safeJson<{ controls?: ControlLayout[] }>(document.getPageControlLayout(page), {});
    for (const control of layout.controls ?? []) {
      if (control.type !== "table" || control.secIdx === undefined || control.paraIdx === undefined || control.controlIdx === undefined) continue;
      const key = `${control.secIdx}:${control.paraIdx}:${control.controlIdx}`;
      if (seen.has(key)) continue;
      seen.add(key);
      tables.push(readTable(document, control, tables.length));
    }
  }
  return tables;
}

function readTable(document: HwpDocument, control: ControlLayout, index: number): HwpTable {
  const section = control.secIdx!;
  const paragraph = control.paraIdx!;
  const controlIndex = control.controlIdx!;
  const dimensions = safeJson<{ rowCount?: number; colCount?: number }>(document.getTableDimensions(section, paragraph, controlIndex), {});
  const rowCount = Math.max(1, control.rowCount ?? dimensions.rowCount ?? 1);
  const colCount = Math.max(1, control.colCount ?? dimensions.colCount ?? 1);
  const allCells = safeJson<Array<{ cellIdx: number; row: number; col: number; rowSpan?: number; colSpan?: number }>>(document.getTableCellBboxes(section, paragraph, controlIndex), []);
  const cells = allCells.length ? allCells : control.cells ?? [];
  const grid: WordTableCell[][] = Array.from({ length: rowCount }, (_, row) => Array.from({ length: colCount }, (_, col) => emptyCell(L(`표 ${index + 1} ${row + 1}행 ${col + 1}열`, `Table ${index + 1}, row ${row + 1}, column ${col + 1}`))));

  for (const cell of cells) {
    const paragraphs: string[] = [];
    const formats: unknown[] = [];
    const paragraphCount = document.getCellParagraphCount(section, paragraph, controlIndex, cell.cellIdx);
    for (let cellParagraph = 0; cellParagraph < paragraphCount; cellParagraph += 1) {
      const length = document.getCellParagraphLength(section, paragraph, controlIndex, cell.cellIdx, cellParagraph);
      paragraphs.push(cleanText(document.getTextInCell(section, paragraph, controlIndex, cell.cellIdx, cellParagraph, 0, length)));
      try { formats.push(safeJson(document.getCellParaPropertiesAt(section, paragraph, controlIndex, cell.cellIdx, cellParagraph), {})); } catch { /* 지원되지 않는 셀 서식은 건너뜁니다. */ }
      if (length > 0) {
        try { formats.push(safeJson(document.getCellCharPropertiesAt(section, paragraph, controlIndex, cell.cellIdx, cellParagraph, 0), {})); } catch { /* 동일 */ }
      }
    }
    try { formats.push(safeJson(document.getCellProperties(section, paragraph, controlIndex, cell.cellIdx), {})); } catch { /* 동일 */ }
    const merged = (cell.rowSpan ?? 1) > 1 || (cell.colSpan ?? 1) > 1;
    const location = L(`표 ${index + 1} ${cell.row + 1}행 ${cell.col + 1}열${merged ? " (병합 셀)" : ""}`, `Table ${index + 1}, row ${cell.row + 1}, column ${cell.col + 1}${merged ? " (merged cell)" : ""}`);
    if (!grid[cell.row]?.[cell.col]) continue;
    grid[cell.row][cell.col] = {
      text: paragraphs.filter(Boolean).join("\n"),
      format: stableStringify(formats),
      location,
      segments: [],
      comments: [],
    };
  }
  return { section, paragraph, control: controlIndex, location: L(`표 ${index + 1}`, `Table ${index + 1}`), grid };
}

function readHeaderFooters(document: HwpDocument, formatting: boolean) {
  const records: HwpParagraph[] = [];
  const list = safeJson<{ items?: Array<{ sectionIdx: number; isHeader: boolean; applyTo: number; label?: string }> }>(document.getHeaderFooterList(0, true, 0), {});
  for (const item of list.items ?? []) {
    const info = safeJson<{ exists?: boolean; text?: string; paraCount?: number }>(document.getHeaderFooter(item.sectionIdx, item.isHeader, item.applyTo), {});
    if (!info.exists) continue;
    const text = cleanText(info.text ?? "");
    if (!text) continue;
    const kind = item.isHeader ? L("머리말", "Header") : L("꼬리말", "Footer");
    const format = formatting ? stableStringify({ applyTo: item.applyTo, paraCount: info.paraCount }) : "";
    records.push({ text, format, location: L(`${item.sectionIdx + 1}구역 ${item.label || kind}`, `Section ${item.sectionIdx + 1}, ${item.label || kind}`) });
  }
  return records;
}

function readNotes(document: HwpDocument, formatting: boolean) {
  const records: HwpParagraph[] = [];
  const controls = safeJson<Array<{ ctrlId?: string; list?: number; para?: number; controlIndex?: number }>>(document.getControls(), []);
  const seen = new Set<string>();
  for (const control of controls) {
    if ((control.ctrlId !== "fn" && control.ctrlId !== "en") || control.para === undefined || control.controlIndex === undefined) continue;
    for (let section = 0; section < document.getSectionCount(); section += 1) {
      if (control.para >= document.getParagraphCount(section)) continue;
      try {
        const info = safeJson<{ ok?: boolean; number?: number; texts?: string[]; paraCount?: number }>(document.getFootnoteInfo(section, control.para, control.controlIndex), {});
        if (!info.ok) continue;
        const key = `${section}:${control.para}:${control.controlIndex}:${control.ctrlId}`;
        if (seen.has(key)) break;
        seen.add(key);
        const text = (info.texts ?? []).map(cleanText).filter(Boolean).join("\n");
        if (text) {
          const kind = control.ctrlId === "fn" ? L("각주", "Footnote") : L("미주", "Endnote");
          records.push({
            text,
            format: formatting ? stableStringify({ paraCount: info.paraCount }) : "",
            location: `${kind} ${info.number ?? records.length + 1}`,
          });
        }
        break;
      } catch { /* 표 셀 내부 등 현재 공개 좌표로 찾을 수 없는 주석은 건너뜁니다. */ }
    }
  }
  return records;
}

function bodyFormat(document: HwpDocument, section: number, paragraph: number, length: number) {
  const values: unknown[] = [safeJson(document.getParaPropertiesAt(section, paragraph), {})];
  const offsets = representativeOffsets(length);
  for (const offset of offsets) {
    try { values.push(safeJson(document.getCharPropertiesAt(section, paragraph, offset), {})); } catch { /* 빈 문단 등 */ }
  }
  return stableStringify(values);
}

function compareModels(beforeName: string, afterName: string, before: HwpModel, after: HwpModel, options: HwpCompareOptions): WordCompareResult {
  const changes: WordDiffItem[] = [];
  const tables: WordTableComparison[] = [];
  const documentViews: WordDocumentViewItem[] = [];
  const blockPairs = alignSequence(before.blocks, after.blocks, (item) => item.text, (left, right) => left.type === right.type);
  for (const group of groupParagraphSplits(blockPairs, before.blocks, after.blocks, (item) => item.text, (item) => item.type === "paragraph")) {
    const leftBlocks = group.beforeIndexes.map((index) => before.blocks[index]);
    const rightBlocks = group.afterIndexes.map((index) => after.blocks[index]);
    const left = leftBlocks[0];
    const right = rightBlocks[0];
    if (left?.type === "table" || right?.type === "table") {
      const table = compareTable(left?.table, right?.table, tables.length, changes, options.formatting);
      tables.push(table);
      documentViews.push({
        kind: tableViewKind(table),
        section: "table",
        blockType: "table",
        tableIndex: table.index,
        beforeLocation: left?.location ?? "",
        afterLocation: right?.location ?? "",
        before: left?.text ?? "",
        after: right?.text ?? "",
        segments: diffText(left?.text ?? "", right?.text ?? ""),
        comments: [],
      });
      continue;
    }
    documentViews.push(compareRecord(combineParagraphRecords(leftBlocks), combineParagraphRecords(rightBlocks), "body", changes, options.formatting));
  }

  const headerFooter = compareRecordList(before.headerFooter, after.headerFooter, "headerFooter", changes, options.formatting);
  const note = compareRecordList(before.notes, after.notes, "note", changes, options.formatting);
  const summary = { added: 0, deleted: 0, changed: 0, format: 0, unchanged: 0 };
  for (const view of [...documentViews, ...headerFooter, ...note]) {
    if (view.kind === "unchanged" || view.kind === "comment") summary.unchanged += 1;
    else summary[view.kind] += 1;
  }

  return {
    beforeName,
    afterName,
    summary,
    changes,
    tables,
    views: { document: documentViews, headerFooter, note },
    warnings: [...new Set([...before.warnings, ...after.warnings])],
  };
}

function compareRecordList(before: HwpParagraph[], after: HwpParagraph[], section: "headerFooter" | "note", changes: WordDiffItem[], formatting: boolean) {
  const pairs = alignSequence(before, after, (item) => item.text);
  return groupParagraphSplits(pairs, before, after, (item) => item.text).map((group) => compareRecord(
    combineParagraphRecords(group.beforeIndexes.map((index) => before[index])),
    combineParagraphRecords(group.afterIndexes.map((index) => after[index])),
    section,
    changes,
    formatting,
  ));
}

function combineParagraphRecords(records: Array<Pick<HwpParagraph, "text" | "format" | "location"> | HwpBlock>) {
  if (!records.length) return undefined;
  const first = records[0];
  const last = records[records.length - 1];
  return {
    text: records.map((record) => record.text).join("\n"),
    format: records.map((record) => record.format).join("||paragraph-break||"),
    location: first.location === last.location ? first.location : `${first.location}~${last.location}`,
  };
}

function compareRecord(
  before: Pick<HwpParagraph, "text" | "format" | "location"> | undefined,
  after: Pick<HwpParagraph, "text" | "format" | "location"> | undefined,
  section: "body" | "headerFooter" | "note",
  changes: WordDiffItem[],
  formatting: boolean,
): WordDocumentViewItem {
  const beforeText = before?.text ?? "";
  const afterText = after?.text ?? "";
  const kind: WordViewKind = !before ? "added" : !after ? "deleted" : beforeText !== afterText ? "changed" : formatting && before.format !== after.format ? "format" : "unchanged";
  const segments = diffText(beforeText, afterText);
  if (kind !== "unchanged") {
    changes.push({
      kind,
      section,
      location: after?.location || before?.location || "",
      beforeLocation: before?.location ?? "",
      afterLocation: after?.location ?? "",
      before: beforeText,
      after: afterText,
      segments,
    });
  }
  return {
    kind,
    section,
    blockType: "paragraph",
    beforeLocation: before?.location ?? "",
    afterLocation: after?.location ?? "",
    before: beforeText,
    after: afterText,
    segments,
    comments: [],
  };
}

function compareTable(before: HwpTable | undefined, after: HwpTable | undefined, index: number, changes: WordDiffItem[], formatting: boolean): WordTableComparison {
  const beforeGrid = before?.grid ?? [];
  const afterGrid = after?.grid ?? [];
  const rowPairs = before && after
    ? alignSequence(beforeGrid, afterGrid, rowText).map(toAxisPair)
    : before ? beforeGrid.map((_, row) => ({ beforeIndex: row, afterIndex: null })) : afterGrid.map((_, row) => ({ beforeIndex: null, afterIndex: row }));
  const beforeColumns = transpose(beforeGrid);
  const afterColumns = transpose(afterGrid);
  const columnPairs = before && after
    ? alignSequence(beforeColumns, afterColumns, rowText).map(toAxisPair)
    : before ? beforeColumns.map((_, col) => ({ beforeIndex: col, afterIndex: null })) : afterColumns.map((_, col) => ({ beforeIndex: null, afterIndex: col }));
  const beforeKinds = beforeGrid.map((row) => row.map<WordViewKind>(() => "unchanged"));
  const afterKinds = afterGrid.map((row) => row.map<WordViewKind>(() => "unchanged"));

  for (const rowPair of rowPairs) {
    for (const columnPair of columnPairs) {
      const beforeCell = rowPair.beforeIndex === null || columnPair.beforeIndex === null ? undefined : beforeGrid[rowPair.beforeIndex]?.[columnPair.beforeIndex];
      const afterCell = rowPair.afterIndex === null || columnPair.afterIndex === null ? undefined : afterGrid[rowPair.afterIndex]?.[columnPair.afterIndex];
      if (!beforeCell && !afterCell) continue;
      const kind: WordViewKind = !beforeCell ? "added" : !afterCell ? "deleted" : beforeCell.text !== afterCell.text ? "changed" : formatting && beforeCell.format !== afterCell.format ? "format" : "unchanged";
      const segments = diffText(beforeCell?.text ?? "", afterCell?.text ?? "");
      if (beforeCell) {
        beforeCell.segments = segments;
        beforeKinds[rowPair.beforeIndex!][columnPair.beforeIndex!] = kind;
      }
      if (afterCell) {
        afterCell.segments = segments;
        afterKinds[rowPair.afterIndex!][columnPair.afterIndex!] = kind;
      }
      if (kind !== "unchanged") {
        changes.push({
          kind,
          section: "table",
          location: afterCell?.location || beforeCell?.location || L(`표 ${index + 1}`, `Table ${index + 1}`),
          beforeLocation: beforeCell?.location ?? "",
          afterLocation: afterCell?.location ?? "",
          before: beforeCell?.text ?? "",
          after: afterCell?.text ?? "",
          segments,
        });
      }
    }
  }

  const allKinds = [...beforeKinds.flat(), ...afterKinds.flat()];
  const kind = !before ? "added" : !after ? "deleted" : allKinds.some((value) => value !== "unchanged") ? "changed" : "unchanged";
  return {
    index,
    kind,
    beforeIndex: before ? index : null,
    afterIndex: after ? index : null,
    before: beforeGrid,
    after: afterGrid,
    rowPairs,
    columnPairs,
    beforeKinds,
    afterKinds,
  };
}

function alignSequence<T>(before: T[], after: T[], textOf: (item: T) => string, compatible: (before: T, after: T) => boolean = () => true): SequencePair[] {
  const rows = before.length + 1;
  const cols = after.length + 1;
  if (rows * cols > 4_000_000) return greedyAlign(before, after, textOf, compatible);
  const scores = new Float32Array(rows * cols);
  const directions = new Uint8Array(rows * cols);
  const gap = -1;
  for (let row = 1; row < rows; row += 1) { scores[row * cols] = row * gap; directions[row * cols] = 1; }
  for (let col = 1; col < cols; col += 1) { scores[col] = col * gap; directions[col] = 2; }
  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const similarity = compatible(before[row - 1], after[col - 1]) ? textSimilarity(textOf(before[row - 1]), textOf(after[col - 1])) : 0;
      const diagonal = scores[(row - 1) * cols + col - 1] + (similarity === 1 ? 5 : similarity >= 0.24 ? 0.15 + similarity * 3 : -2.2);
      const up = scores[(row - 1) * cols + col] + gap;
      const left = scores[row * cols + col - 1] + gap;
      const offset = row * cols + col;
      if (diagonal >= up && diagonal >= left) { scores[offset] = diagonal; directions[offset] = 3; }
      else if (up >= left) { scores[offset] = up; directions[offset] = 1; }
      else { scores[offset] = left; directions[offset] = 2; }
    }
  }
  const result: SequencePair[] = [];
  let row = before.length;
  let col = after.length;
  while (row > 0 || col > 0) {
    const direction = directions[row * cols + col];
    if (row > 0 && col > 0 && direction === 3) {
      const similarity = compatible(before[row - 1], after[col - 1]) ? textSimilarity(textOf(before[row - 1]), textOf(after[col - 1])) : 0;
      if (similarity >= 0.24) result.push({ beforeIndex: row - 1, afterIndex: col - 1 });
      else {
        result.push({ beforeIndex: null, afterIndex: col - 1 });
        result.push({ beforeIndex: row - 1, afterIndex: null });
      }
      row -= 1;
      col -= 1;
    } else if (row > 0 && (direction === 1 || col === 0)) {
      result.push({ beforeIndex: row - 1, afterIndex: null });
      row -= 1;
    } else {
      result.push({ beforeIndex: null, afterIndex: col - 1 });
      col -= 1;
    }
  }
  return result.reverse();
}

function groupParagraphSplits<T>(
  pairs: SequencePair[],
  before: T[],
  after: T[],
  textOf: (item: T) => string,
  canGroup: (item: T) => boolean = () => true,
): SequenceGroup[] {
  const groups: SequenceGroup[] = pairs.map((pair) => ({
    beforeIndexes: pair.beforeIndex === null ? [] : [pair.beforeIndex],
    afterIndexes: pair.afterIndex === null ? [] : [pair.afterIndex],
  }));
  const result: SequenceGroup[] = [];

  for (let index = 0; index < groups.length; index += 1) {
    const current = groups[index];
    const next = groups[index + 1];
    if (!next) { result.push(current); continue; }

    const currentBefore = current.beforeIndexes[0];
    const currentAfter = current.afterIndexes[0];
    const nextBefore = next.beforeIndexes[0];
    const nextAfter = next.afterIndexes[0];

    if (!current.beforeIndexes.length && current.afterIndexes.length === 1
      && next.beforeIndexes.length === 1 && next.afterIndexes.length === 1
      && [after[currentAfter], before[nextBefore], after[nextAfter]].every(canGroup)
      && looksLikeSplit(textOf(before[nextBefore]), textOf(after[currentAfter]), textOf(after[nextAfter]))) {
      result.push({ beforeIndexes: [nextBefore], afterIndexes: [currentAfter, nextAfter] });
      index += 1;
      continue;
    }

    if (current.beforeIndexes.length === 1 && current.afterIndexes.length === 1
      && !next.beforeIndexes.length && next.afterIndexes.length === 1
      && [before[currentBefore], after[currentAfter], after[nextAfter]].every(canGroup)
      && looksLikeSplit(textOf(before[currentBefore]), textOf(after[currentAfter]), textOf(after[nextAfter]))) {
      result.push({ beforeIndexes: [currentBefore], afterIndexes: [currentAfter, nextAfter] });
      index += 1;
      continue;
    }

    if (!current.afterIndexes.length && current.beforeIndexes.length === 1
      && next.beforeIndexes.length === 1 && next.afterIndexes.length === 1
      && [before[currentBefore], before[nextBefore], after[nextAfter]].every(canGroup)
      && looksLikeSplit(textOf(after[nextAfter]), textOf(before[currentBefore]), textOf(before[nextBefore]))) {
      result.push({ beforeIndexes: [currentBefore, nextBefore], afterIndexes: [nextAfter] });
      index += 1;
      continue;
    }

    if (current.beforeIndexes.length === 1 && current.afterIndexes.length === 1
      && next.beforeIndexes.length === 1 && !next.afterIndexes.length
      && [before[currentBefore], before[nextBefore], after[currentAfter]].every(canGroup)
      && looksLikeSplit(textOf(after[currentAfter]), textOf(before[currentBefore]), textOf(before[nextBefore]))) {
      result.push({ beforeIndexes: [currentBefore, nextBefore], afterIndexes: [currentAfter] });
      index += 1;
      continue;
    }

    result.push(current);
  }
  return result;
}

function looksLikeSplit(singleValue: string, firstValue: string, secondValue: string) {
  const single = normalizeForMatch(singleValue);
  const first = normalizeForMatch(firstValue);
  const second = normalizeForMatch(secondValue);
  if (single.length < 20 || first.length < 8 || second.length < 8) return false;
  const prefix = commonPrefixLength(single, first);
  const suffix = commonSuffixLength(single, second);
  const minimumPrefix = Math.min(24, Math.max(8, Math.round(Math.min(single.length, first.length) * 0.12)));
  const minimumSuffix = Math.min(24, Math.max(8, Math.round(Math.min(single.length, second.length) * 0.12)));
  const covered = Math.min(single.length, prefix + suffix) / single.length;
  const nonOverlapping = prefix < single.length - Math.floor(minimumSuffix / 2)
    && suffix < single.length - Math.floor(minimumPrefix / 2);
  return prefix >= minimumPrefix && suffix >= minimumSuffix && covered >= 0.58 && nonOverlapping;
}

function commonPrefixLength(left: string, right: string) {
  const limit = Math.min(left.length, right.length);
  let index = 0;
  while (index < limit && left[index] === right[index]) index += 1;
  return index;
}

function commonSuffixLength(left: string, right: string) {
  const limit = Math.min(left.length, right.length);
  let index = 0;
  while (index < limit && left[left.length - index - 1] === right[right.length - index - 1]) index += 1;
  return index;
}

function greedyAlign<T>(before: T[], after: T[], textOf: (item: T) => string, compatible: (before: T, after: T) => boolean) {
  const result: SequencePair[] = [];
  let beforeIndex = 0;
  let afterIndex = 0;
  while (beforeIndex < before.length || afterIndex < after.length) {
    if (beforeIndex >= before.length) { result.push({ beforeIndex: null, afterIndex: afterIndex++ }); continue; }
    if (afterIndex >= after.length) { result.push({ beforeIndex: beforeIndex++, afterIndex: null }); continue; }
    const direct = compatible(before[beforeIndex], after[afterIndex]) ? textSimilarity(textOf(before[beforeIndex]), textOf(after[afterIndex])) : 0;
    if (direct >= 0.24) { result.push({ beforeIndex: beforeIndex++, afterIndex: afterIndex++ }); continue; }
    const nextAfter = afterIndex + 1 < after.length && compatible(before[beforeIndex], after[afterIndex + 1]) ? textSimilarity(textOf(before[beforeIndex]), textOf(after[afterIndex + 1])) : 0;
    const nextBefore = beforeIndex + 1 < before.length && compatible(before[beforeIndex + 1], after[afterIndex]) ? textSimilarity(textOf(before[beforeIndex + 1]), textOf(after[afterIndex])) : 0;
    if (nextAfter > nextBefore && nextAfter >= 0.4) result.push({ beforeIndex: null, afterIndex: afterIndex++ });
    else if (nextBefore >= 0.4) result.push({ beforeIndex: beforeIndex++, afterIndex: null });
    else { result.push({ beforeIndex: beforeIndex++, afterIndex: null }); result.push({ beforeIndex: null, afterIndex: afterIndex++ }); }
  }
  return result;
}

function diffText(before: string, after: string): WordDiffSegment[] {
  if (before === after) return before ? [{ type: "equal", text: before }] : [];
  const left = tokenize(before);
  const right = tokenize(after);
  const rows = left.length + 1;
  const cols = right.length + 1;
  if (rows * cols > 1_500_000) return [{ type: "deleted", text: before }, { type: "added", text: after }];
  const matrix = new Uint32Array(rows * cols);
  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      matrix[row * cols + col] = left[row - 1] === right[col - 1]
        ? matrix[(row - 1) * cols + col - 1] + 1
        : Math.max(matrix[(row - 1) * cols + col], matrix[row * cols + col - 1]);
    }
  }
  const reversed: WordDiffSegment[] = [];
  let row = left.length;
  let col = right.length;
  while (row > 0 || col > 0) {
    if (row > 0 && col > 0 && left[row - 1] === right[col - 1]) { reversed.push({ type: "equal", text: left[--row] }); col -= 1; }
    else if (col > 0 && (row === 0 || matrix[row * cols + col - 1] >= matrix[(row - 1) * cols + col])) reversed.push({ type: "added", text: right[--col] });
    else reversed.push({ type: "deleted", text: left[--row] });
  }
  const result: WordDiffSegment[] = [];
  for (const segment of reversed.reverse()) {
    const previous = result[result.length - 1];
    if (previous?.type === segment.type) previous.text += segment.text;
    else result.push({ ...segment });
  }
  return result;
}

function tokenize(text: string) {
  return text.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) ?? [];
}

function textSimilarity(leftValue: string, rightValue: string) {
  const left = normalizeForMatch(leftValue);
  const right = normalizeForMatch(rightValue);
  if (left === right) return 1;
  if (!left || !right) return 0;
  const a = ngrams(left, left.length < 8 ? 1 : 2);
  const b = ngrams(right, right.length < 8 ? 1 : 2);
  const counts = new Map<string, number>();
  a.forEach((item) => counts.set(item, (counts.get(item) ?? 0) + 1));
  let matches = 0;
  b.forEach((item) => {
    const count = counts.get(item) ?? 0;
    if (count > 0) { matches += 1; counts.set(item, count - 1); }
  });
  return (2 * matches) / (a.length + b.length);
}

function ngrams(value: string, size: number) {
  if (value.length <= size) return [value];
  return Array.from({ length: value.length - size + 1 }, (_, index) => value.slice(index, index + size));
}

function normalizeForMatch(value: string) {
  return value.normalize("NFC").toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").trim();
}

function cleanText(value: string) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffc]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function representativeOffsets(length: number) {
  if (length <= 0) return [];
  if (length <= 64) return Array.from({ length }, (_, index) => index);
  return Array.from(new Set(Array.from({ length: 32 }, (_, index) => Math.min(length - 1, Math.round((index / 31) * (length - 1))))));
}

function stableStringify(value: unknown) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortValue(item)]));
  return value;
}

function safeJson<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function emptyCell(location: string): WordTableCell {
  return { text: "", format: "", location, segments: [], comments: [] };
}

function flattenTable(table: HwpTable) {
  return table.grid.map(rowText).filter(Boolean).join(" | ");
}

function rowText(row: WordTableCell[]) {
  return row.map((cell) => cell.text).join("\u241f");
}

function transpose(grid: WordTableCell[][]) {
  const width = Math.max(0, ...grid.map((row) => row.length));
  return Array.from({ length: width }, (_, column) => grid.map((row, rowIndex) => row[column] ?? emptyCell(L(`빈 셀 ${rowIndex + 1}:${column + 1}`, `Empty cell ${rowIndex + 1}:${column + 1}`))));
}

function toAxisPair(pair: SequencePair): WordTableAxisPair {
  return { beforeIndex: pair.beforeIndex, afterIndex: pair.afterIndex };
}

function tableViewKind(table: WordTableComparison): WordViewKind {
  if (table.beforeIndex === null) return "added";
  if (table.afterIndex === null) return "deleted";
  const kinds = [...table.beforeKinds.flat(), ...table.afterKinds.flat()];
  if (kinds.some((kind) => kind === "added" || kind === "deleted" || kind === "changed")) return "changed";
  if (kinds.some((kind) => kind === "format")) return "format";
  return "unchanged";
}

function progress(value: number, message: string) {
  worker.postMessage({ type: "progress", progress: Math.max(0, Math.min(100, Math.round(value))), message });
}

function yieldToWorker() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function normalizeError(error: unknown) {
  return error instanceof Error ? error.message : String(error || L("HWP 문서를 처리하지 못했습니다.", "Unable to process the HWP document."));
}

export {};
