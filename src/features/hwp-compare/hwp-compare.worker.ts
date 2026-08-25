/// <reference lib="webworker" />

import initRhwp, { HwpDocument } from "@rhwp/core";
import rhwpWasmUrl from "@rhwp/core/rhwp_bg.wasm?url";

import type { WordTableCell } from "../excel-merger/types";
import {
  compareDocumentModels,
  type ComparisonBlock,
  type ComparisonModel,
  type ComparisonRecord,
  type ComparisonTable,
} from "../document-compare/documentComparison";
import type { HwpCompareOptions, HwpWorkerPairResult } from "./hwpWorkerClient";

interface PairPayload {
  beforeName: string;
  afterName: string;
  beforeBuffer: ArrayBuffer;
  afterBuffer: ArrayBuffer;
  beforePassword?: string;
  afterPassword?: string;
}

interface HwpParagraph extends ComparisonRecord {}

interface HwpTable extends ComparisonTable {
  section: number;
  paragraph: number;
  control: number;
  location: string;
  grid: WordTableCell[][];
}

interface HwpBlock extends ComparisonBlock {
  table?: HwpTable;
}

interface HwpModel extends ComparisonModel {
  blocks: HwpBlock[];
  headerFooter: HwpParagraph[];
  notes: HwpParagraph[];
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
      results.push({ result: compareDocumentModels(pair.beforeName, pair.afterName, before, after, options, currentLanguage) });
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
  return { section, paragraph, control: controlIndex, sourceIndex: index, location: L(`표 ${index + 1}`, `Table ${index + 1}`), grid };
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
  const controls = safeJson<Array<{
    ctrlId?: string;
    list?: number;
    para?: number;
    controlIndex?: number;
    section?: number;
    sectionIdx?: number;
    secIdx?: number;
  }>>(document.getControls(), []);
  const seen = new Set<string>();
  for (const control of controls) {
    if ((control.ctrlId !== "fn" && control.ctrlId !== "en") || control.para === undefined || control.controlIndex === undefined) continue;
    const declaredSection = control.sectionIdx ?? control.secIdx ?? control.section;
    const sections = declaredSection === undefined
      ? Array.from({ length: document.getSectionCount() }, (_, section) => section)
      : [declaredSection];
    for (const section of sections) {
      if (section < 0 || section >= document.getSectionCount()) continue;
      if (control.para >= document.getParagraphCount(section)) continue;
      try {
        const info = safeJson<{ ok?: boolean; number?: number; texts?: string[]; paraCount?: number }>(document.getFootnoteInfo(section, control.para, control.controlIndex), {});
        if (!info.ok) continue;
        const key = `${section}:${control.list ?? ""}:${control.para}:${control.controlIndex}:${control.ctrlId}:${info.number ?? ""}`;
        if (seen.has(key)) continue;
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

function progress(value: number, message: string) {
  worker.postMessage({ type: "progress", progress: Math.max(0, Math.min(100, Math.round(value))), message });
}

function yieldToWorker() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function normalizeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/password|decrypt|encrypted|암호/i.test(message)) {
    return L("암호를 확인하거나 암호를 해제한 HWP 사본으로 다시 시도해 주세요.", "Check the password or retry with an unlocked HWP copy.");
  }
  if (/memory|allocation|out of bounds|too large/i.test(message)) {
    return L("문서가 너무 커서 현재 브라우저에서 비교하지 못했습니다. 다른 탭을 닫고 다시 시도해 주세요.", "The document is too large for this browser session. Close other tabs and try again.");
  }
  return L("HWP 문서를 읽지 못했습니다. 올바른 HWP·HWPX 파일인지, 파일이 손상되지 않았는지 확인해 주세요.", "Could not read the HWP document. Check that it is a valid, undamaged HWP or HWPX file.");
}

export {};
