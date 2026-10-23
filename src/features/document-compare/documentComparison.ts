import type {
  WordCellComment,
  WordCompareResult,
  WordDiffItem,
  WordDiffSegment,
  WordDocumentViewItem,
  WordRecordKind,
  WordTableAxisPair,
  WordTableCell,
  WordTableComparison,
  WordViewKind,
} from "../excel-merger/types";
import { alignDocumentSequence, alignSequence, type SequenceGroup, type SequencePair } from "./documentAlignment.ts";

import { buildRestoreStyleProjections } from "./restoreStyleProjection.ts";
import { buildWordFormatting, projectWordFormatting, type ManifestFormattingView } from "./wordFormatting.ts";
import { completeManifestCoverage, freezeComparisonManifest } from "./comparisonManifest.ts";
import type { ComparisonDecision, DocumentComparisonManifest, DocumentSourceReference, ManifestRecord } from "./comparisonManifest.ts";

export interface ComparisonRecord {
  source?: DocumentSourceReference;
  rawText?: string;
  paragraphs?: ManifestRecord[];
  text: string;
  format: string;
  formatRuns?: Array<{ text: string; style: string }>;
  location: string;
  comments?: WordCellComment[];
}

export interface ComparisonTable {
  location: string;
  grid: WordTableCell[][];
  sourceIndex?: number;
}

export interface ComparisonBlock {
  source?: DocumentSourceReference;
  rawText?: string;
  type: "paragraph" | "table";
  text: string;
  format: string;
  formatRuns?: Array<{ text: string; style: string }>;
  location: string;
  comments?: WordCellComment[];
  table?: ComparisonTable;
}

export interface ComparisonModel {
  sourceRevision?: string;
  sourceInventory?: DocumentSourceReference[];
  blocks: ComparisonBlock[];
  headerFooter: ComparisonRecord[];
  notes: ComparisonRecord[];
  comments?: ComparisonRecord[];
  warnings: string[];
}

export interface ComparisonOptions {
  formatting: boolean;
  tables: boolean;
  metadata: boolean;
}

interface ComparisonLanguage {
  emptyCell: (row: number, column: number) => string;
  table: (index: number) => string;
}

export function compareDocumentModels(
  beforeName: string,
  afterName: string,
  before: ComparisonModel,
  after: ComparisonModel,
  options: ComparisonOptions,
  language: "ko" | "en",
): WordCompareResult & { manifest: DocumentComparisonManifest } {
  const labels: ComparisonLanguage = language === "en"
    ? { emptyCell: (row, column) => `Empty cell ${row}:${column}`, table: (index) => `Table ${index}` }
    : { emptyCell: (row, column) => `빈 셀 ${row}:${column}`, table: (index) => `표 ${index}` };
  const manifest: DocumentComparisonManifest = {
    version: 1, decisions: [], policyVersion: "worklazy-document-1",
    inputRevision: { before: before.sourceRevision, after: after.sourceRevision },
    options: { formatting: options.formatting, tables: options.tables, metadata: options.metadata },
    preservation: { comments: "preserve-after-existing-contract", existingRevisions: "preserve-after-history" },
    formattingPolicyVersion: "worklazy-formatting-1", formattingScopes: [], restoreStylePolicyVersion: "worklazy-restore-style-1", restorePropertyPairs: [], propertyExclusions: [], propertyActions: [], formattingExcluded: [],
    coverage: { before: [], after: [] },
    sources: { before: before.sourceInventory ?? [], after: after.sourceInventory ?? [] },
    exclusions: {
      formatting: options.formatting ? "compare" : "preserve-after",
      tables: options.tables ? [] : [...before.sourceInventory ?? [], ...after.sourceInventory ?? []].filter((source) => source.kind === "tbl"),
      metadata: options.metadata ? [] : [...before.headerFooter, ...after.headerFooter, ...before.notes, ...after.notes, ...before.comments ?? [], ...after.comments ?? []].flatMap((record) => record.source ? [record.source] : []),
    },
  };
  const changes: WordDiffItem[] = [];
  const tables: WordTableComparison[] = [];
  const documentViews: ManifestFormattingView[] = [];
  const blockGroups = alignDocumentSequence(before.blocks, after.blocks, {
    textOf: (item) => item.text,
    compatible: (left, right) => left.type === right.type,
    canGroup: (item) => item.type === "paragraph",
    include: (item) => item.type === "table" ? options.tables : Boolean(item.text.trim()) || Boolean(item.comments?.length),
  });

  for (const [groupIndex, group] of blockGroups.entries()) {
    const leftBlocks = group.beforeIndexes.map((index) => before.blocks[index]);
    const rightBlocks = group.afterIndexes.map((index) => after.blocks[index]);
    const left = leftBlocks[0];
    const right = rightBlocks[0];
    if (left?.type === "table" || right?.type === "table") {
      const table = compareTable(left?.table, right?.table, tables.length, changes, options.formatting, labels);
      tables.push(table);
      const decision = decisionOf(leftBlocks, rightBlocks, group.moved, "table", `body:${groupIndex}`);
      decision.rows = table.rowPairs;
      decision.columns = table.columnPairs;
      decision.children = [];
      for (const row of table.rowPairs) for (const column of table.columnPairs) {
        const a = row.beforeIndex === null || column.beforeIndex === null ? undefined : left?.table?.grid[row.beforeIndex]?.[column.beforeIndex] as (WordTableCell & ManifestRecord) | undefined;
        const b = row.afterIndex === null || column.afterIndex === null ? undefined : right?.table?.grid[row.afterIndex]?.[column.afterIndex] as (WordTableCell & ManifestRecord) | undefined;
        decision.children.push(...paragraphDecisions(a?.paragraphs ?? [], b?.paragraphs ?? [], `${decision.id}:cell:${row.beforeIndex}:${row.afterIndex}:${column.beforeIndex}:${column.afterIndex}`));
      }
      manifest.decisions.push(decision);
      const baseTableKind = tableViewKind(table);
      documentViews.push({
        comparisonDecisionId: decision.id,
        kind: group.moved && baseTableKind === "unchanged" ? "moved" : baseTableKind,
        section: "table",
        blockType: "table",
        tableIndex: table.index,
        beforeLocation: left?.location ?? "",
        afterLocation: right?.location ?? "",
        before: left?.text ?? "",
        after: right?.text ?? "",
        segments: decision.segments,
        comments: [],
        moved: group.moved,
      });
      continue;
    }
    const decision = decisionOf(leftBlocks, rightBlocks, group.moved, "paragraph", `body:${groupIndex}`);
    manifest.decisions.push(decision);
    documentViews.push(compareRecord(
      combineRecords(leftBlocks),
      combineRecords(rightBlocks),
      "body",
      changes,
      options.formatting,
      group,
      decision,
    ));
  }

  // Extraction retains every source node. Scope filtering belongs to this shared
  // decision builder, including paragraphs flattened from metadata tables.
  const scopedMetadata = (model: ComparisonModel, records: ComparisonRecord[]) => {
    if (!options.metadata) return [];
    if (options.tables) return records;
    const tables = (model.sourceInventory ?? []).filter((source) => source.kind === "tbl");
    const included = (record: ManifestRecord) => !record.source || !tables.some((table) =>
      table.part === record.source!.part && table.path.every((index, depth) => record.source!.path[depth] === index));
    return records.filter(included).flatMap((record) => {
      if (!record.paragraphs?.length) return [record];
      const paragraphs = record.paragraphs.filter(included);
      if (paragraphs.length === record.paragraphs.length) return [record];
      if (!paragraphs.length) return [];
      const projected = combineRecords(paragraphs.map((item) => ({ ...item, format: (item as Partial<ComparisonRecord>).format ?? "", formatRuns: (item as Partial<ComparisonRecord>).formatRuns, location: record.location })))!;
      return [{ ...record, ...projected, paragraphs, rawText: paragraphs.map((item) => item.rawText ?? item.text).join("\n") }];
    });
  };
  const headerFooter = compareRecordList(scopedMetadata(before, before.headerFooter), scopedMetadata(after, after.headerFooter), "headerFooter", changes, options.formatting, manifest);
  const note = compareRecordList(scopedMetadata(before, before.notes), scopedMetadata(after, after.notes), "note", changes, options.formatting, manifest);
  const commentChanges: WordDiffItem[] = [];
  const commentViews = compareRecordList(scopedMetadata(before, before.comments ?? []), scopedMetadata(after, after.comments ?? []), "comment", commentChanges, options.formatting, manifest);
  changes.push(...commentChanges);
  buildRestoreStyleProjections(manifest);
  buildWordFormatting(manifest, diffCharacters);
  projectWordFormatting(manifest, documentViews, headerFooter, note, changes, tables, language);
  const summary: WordCompareResult["summary"] = { added: 0, deleted: 0, changed: 0, format: 0, unchanged: 0, moved: 0 };
  for (const change of changes) {
    if (change.kind === "moved") continue;
    summary[change.kind] += 1;
  }
  const visibleViews = [...documentViews, ...headerFooter, ...note];
  summary.unchanged = visibleViews.filter((view) => view.kind === "unchanged" || view.kind === "comment").length
    + commentViews.filter((view) => view.kind === "unchanged").length;
  summary.moved = visibleViews.filter((view) => view.moved || view.kind === "moved").length;

  completeManifestCoverage(manifest);
  return {
    beforeName,
    afterName,
    manifest: freezeComparisonManifest(manifest),
    summary,
    changes,
    tables,
    views: { document: documentViews, headerFooter, note },
    warnings: [...new Set([...before.warnings, ...after.warnings, ...(manifest.formattingExcluded.length ? [language === "en" ? "Some advanced formatting is kept from the revised file and is not included in tracked formatting changes." : "일부 고급 서식은 수정본 기준으로 유지되며 변경 추적 서식 비교에 포함되지 않습니다."] : []), ...(manifest.formattingScopes.some((scope) => scope.families.length && scope.afterFact.history) ? [language === "en" ? "Some formatting keeps the revised file’s existing revision history." : "일부 서식은 수정본에 있는 기존 변경 기록을 유지합니다."] : [])])],
  };
}

function compareRecordList(
  before: ComparisonRecord[],
  after: ComparisonRecord[],
  section: "headerFooter" | "note" | "comment",
  changes: WordDiffItem[],
  formatting: boolean,
  manifest: DocumentComparisonManifest,
) {
  const groups = alignDocumentSequence(before, after, { textOf: (item) => item.text });
  const decisions = groups.map((group, groupIndex) => {
    const left = group.beforeIndexes.map((index) => before[index]);
    const right = group.afterIndexes.map((index) => after[index]);
    const decision = decisionOf(left, right, group.moved, "paragraph", `${section}:${groupIndex}`);
    if (section === "comment") {
      decision.trackedRepresentation = "preserve-after";
      decision.trackedReason = "existing-comment-contract";
      decision.children = paragraphDecisions(left.flatMap((record) => record.paragraphs ?? []), right.flatMap((record) => record.paragraphs ?? []), `${decision.id}:comment`);
      for (const child of decision.children) {
        child.trackedRepresentation = "preserve-after";
        child.trackedReason = "existing-comment-contract";
      }
    }
    manifest.decisions.push(decision);
    return decision;
  });
  return groups.map((group, groupIndex) => compareRecord(
    combineRecords(group.beforeIndexes.map((index) => before[index])),
    combineRecords(group.afterIndexes.map((index) => after[index])),
    section,
    changes,
    formatting,
    group,
    decisions[groupIndex],
  ));
}


function decisionOf(before: ManifestRecord[], after: ManifestRecord[], moved = false, type: ComparisonDecision["type"] = "paragraph", context = "paragraph"): ComparisonDecision {
  const beforeText = before.map((record) => record.rawText ?? record.text).join("\n");
  const afterText = after.map((record) => record.rawText ?? record.text).join("\n");
  let splitSlices: Array<[number, number]> | undefined;
  const comparisons = [{ before: beforeText, after: afterText, segments: diffText(beforeText, afterText) }];
  // Paragraph-break revisions use synthetic text slices. Their text decisions
  // are fixed here too, so the XML emitter never chooses a second alignment.
  if (before.length === 1 && after.length === 2) {
    const a = Array.from(beforeText);
    const tail = Array.from(after[1].rawText ?? after[1].text);
    let suffix = 0;
    while (suffix < a.length && suffix < tail.length && a[a.length - 1 - suffix] === tail[tail.length - 1 - suffix]) suffix++;
    const boundary = a.length - suffix;
    splitSlices = [[0, boundary], [boundary, a.length]];
    for (const [old, next] of [[a.slice(0, boundary).join(""), after[0].rawText ?? after[0].text], [a.slice(boundary).join(""), tail.join("")]]) {
      comparisons.push({ before: old, after: next, segments: diffText(old, next) });
    }
  } else if (before.length === 2 && after.length === 1) {
    const old = before.map((record) => record.rawText ?? record.text).join("");
    comparisons.push({ before: old, after: afterText, segments: diffText(old, afterText) });
  }
  return {
    comparisons,
    splitSlices,
    trackedRepresentation: "revision",
    id: [...before, ...after].some((record) => record.source)
      ? JSON.stringify([type, before.map((record) => record.source ?? null), after.map((record) => record.source ?? null)])
      : `source-less:${type}:${context}`,
    type, before: before.flatMap((record) => record.source ? [record.source] : []),
    after: after.flatMap((record) => record.source ? [record.source] : []), moved,
    segments: diffText(before.map((record) => record.text).join("\n"), after.map((record) => record.text).join("\n")),
    textSegments: diffText(beforeText, afterText), beforeText, afterText,
  };
}

function paragraphDecisions(before: ManifestRecord[], after: ManifestRecord[], context: string): ComparisonDecision[] {
  return alignDocumentSequence(before, after, { textOf: (record) => record.text }).map((group, index) => decisionOf(
    group.beforeIndexes.map((index) => before[index]), group.afterIndexes.map((index) => after[index]), group.moved, "paragraph", `${context}:${index}`,
  ));
}

function combineRecords(records: Array<Pick<ComparisonRecord, "text" | "format" | "formatRuns" | "location" | "comments"> | ComparisonBlock>) {
  if (!records.length) return undefined;
  const first = records[0];
  const last = records[records.length - 1];
  const formatRuns = records.every((record) => record.formatRuns)
    ? records.flatMap((record, index) => [
      ...(index ? [{ text: "\n", style: "__paragraph-break__" }] : []),
      ...record.formatRuns!,
    ])
    : undefined;
  return {
    text: records.map((record) => record.text).join("\n"),
    format: records.map((record) => record.format).join("||paragraph-break||"),
    formatRuns,
    location: first.location === last.location ? first.location : `${first.location}~${last.location}`,
    comments: records.flatMap((record) => record.comments ?? []),
  };
}

function compareRecord(
  before: ComparisonRecord | undefined,
  after: ComparisonRecord | undefined,
  section: Exclude<WordRecordKind, "table">,
  changes: WordDiffItem[],
  formatting: boolean,
  group?: SequenceGroup,
  decision?: ComparisonDecision,
): ManifestFormattingView {
  const beforeText = before?.text ?? "";
  const afterText = after?.text ?? "";
  const comments = compareComments(before?.comments ?? [], after?.comments ?? []);
  const moved = group?.moved === true;
  const baseKind: WordViewKind = !before
    ? "added"
    : !after
      ? "deleted"
      : beforeText !== afterText
        ? "changed"
        : !comments.every((comment) => comment.kind === "unchanged")
          ? "comment"
          : formatting && before.format !== after.format
            ? "format"
            : "unchanged";
  const kind: WordViewKind = moved && baseKind === "unchanged" ? "moved" : baseKind;
  const segments = decision?.segments ?? diffText(beforeText, afterText);
  if (kind !== "unchanged" && kind !== "comment") {
    changes.push({
      kind,
      section,
      location: after?.location || before?.location || "",
      beforeLocation: before?.location ?? "",
      afterLocation: after?.location ?? "",
      before: beforeText,
      after: afterText,
      segments,
      moved,
    });
    if (baseKind === "changed" && formatting) {
      changes.push(...inlineFormattingChanges(before, after, section));
    }
  }
  return {
    comparisonDecisionId: decision?.id,
    kind,
    section,
    blockType: "paragraph",
    beforeLocation: before?.location ?? "",
    afterLocation: after?.location ?? "",
    before: beforeText,
    after: afterText,
    segments,
    comments,
    moved,
  };
}

function inlineFormattingChanges(
  before: ComparisonRecord | undefined,
  after: ComparisonRecord | undefined,
  section: Exclude<WordRecordKind, "table">,
): WordDiffItem[] {
  if (!before?.formatRuns || !after?.formatRuns) return [];
  const beforeStyles = expandedStyles(before.text, before.formatRuns);
  const afterStyles = expandedStyles(after.text, after.formatRuns);
  if (!beforeStyles || !afterStyles) return [];

  const result: WordDiffItem[] = [];
  let beforeIndex = 0;
  let afterIndex = 0;
  for (const segment of diffCharacters(before.text, after.text)) {
    const characters = Array.from(segment.text);
    if (segment.type === "equal") {
      let start = -1;
      for (let index = 0; index <= characters.length; index += 1) {
        const changed = index < characters.length
          && beforeStyles[beforeIndex + index] !== afterStyles[afterIndex + index];
        if (changed && start < 0) start = index;
        if ((!changed || index === characters.length) && start >= 0) {
          const text = characters.slice(start, index).join("");
          result.push({
            kind: "format",
            section,
            location: after.location || before.location,
            beforeLocation: before.location,
            afterLocation: after.location,
            before: text,
            after: text,
            segments: [{ type: "equal", text }],
          });
          start = -1;
        }
      }
      beforeIndex += characters.length;
      afterIndex += characters.length;
    } else if (segment.type === "deleted") {
      beforeIndex += characters.length;
    } else {
      afterIndex += characters.length;
    }
  }
  return result;
}

function expandedStyles(text: string, runs: Array<{ text: string; style: string }>) {
  if (runs.map((run) => run.text).join("") !== text) return undefined;
  return runs.flatMap((run) => Array.from(run.text, () => run.style));
}

function compareComments(before: WordCellComment[], after: WordCellComment[]): WordDocumentViewItem["comments"] {
  return alignSequence(before, after, (comment) => `${comment.author}\0${comment.text}`).map((pair) => {
    const left = pair.beforeIndex === null ? undefined : before[pair.beforeIndex];
    const right = pair.afterIndex === null ? undefined : after[pair.afterIndex];
    const kind: "added" | "deleted" | "changed" | "unchanged" = !left ? "added" : !right ? "deleted" : left.author !== right.author || left.text !== right.text ? "changed" : "unchanged";
    return {
      kind,
      beforeId: left?.id ?? "",
      afterId: right?.id ?? "",
      beforeAuthor: left?.author ?? "",
      afterAuthor: right?.author ?? "",
      before: left?.text ?? "",
      after: right?.text ?? "",
      segments: diffText(left?.text ?? "", right?.text ?? ""),
    };
  });
}

function compareTable(
  before: ComparisonTable | undefined,
  after: ComparisonTable | undefined,
  index: number,
  changes: WordDiffItem[],
  formatting: boolean,
  labels: ComparisonLanguage,
): WordTableComparison {
  const beforeGrid = before?.grid ?? [];
  const afterGrid = after?.grid ?? [];
  const rowPairs = before && after
    ? alignSequence(beforeGrid, afterGrid, rowText).map(toAxisPair)
    : before ? beforeGrid.map((_, row) => ({ beforeIndex: row, afterIndex: null })) : afterGrid.map((_, row) => ({ beforeIndex: null, afterIndex: row }));
  const beforeColumns = transpose(beforeGrid, labels);
  const afterColumns = transpose(afterGrid, labels);
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
      const commentChanged = beforeCell && afterCell && !sameComments(beforeCell.comments, afterCell.comments);
      const kind: WordViewKind = !beforeCell
        ? "added"
        : !afterCell
          ? "deleted"
          : beforeCell.text !== afterCell.text
            ? "changed"
            : commentChanged
              ? "comment"
              : formatting && beforeCell.format !== afterCell.format ? "format" : "unchanged";
      const segments = diffText(beforeCell?.text ?? "", afterCell?.text ?? "");
      if (beforeCell) {
        beforeCell.segments = segments;
        beforeKinds[rowPair.beforeIndex!][columnPair.beforeIndex!] = kind;
      }
      if (afterCell) {
        afterCell.segments = segments;
        afterKinds[rowPair.afterIndex!][columnPair.afterIndex!] = kind;
      }
      if (kind !== "unchanged" && kind !== "comment") {
        changes.push({
          kind,
          section: "table",
          location: afterCell?.location || beforeCell?.location || labels.table(index + 1),
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
    beforeIndex: before ? before.sourceIndex ?? index : null,
    afterIndex: after ? after.sourceIndex ?? index : null,
    before: beforeGrid,
    after: afterGrid,
    rowPairs,
    columnPairs,
    beforeKinds,
    afterKinds,
  };
}

export function diffText(before: string, after: string): WordDiffSegment[] {
  if (before === after) return before ? [{ type: "equal", text: before }] : [];
  const left = tokenize(before);
  const right = tokenize(after);
  return diffUnits(left, right, before, after);
}

function diffCharacters(before: string, after: string): WordDiffSegment[] {
  if (before === after) return before ? [{ type: "equal", text: before }] : [];
  const left = Array.from(before);
  const right = Array.from(after);
  if ((left.length + 1) * (right.length + 1) > 1_500_000) return diffText(before, after);

  const matches: Array<{ left: number; right: number; size: number }> = [];
  const pending = [{ leftStart: 0, leftEnd: left.length, rightStart: 0, rightEnd: right.length }];
  while (pending.length) {
    const range = pending.pop()!;
    const match = longestContiguousMatch(left, right, range);
    if (!match.size) continue;
    matches.push(match);
    if (range.leftStart < match.left && range.rightStart < match.right) {
      pending.push({ leftStart: range.leftStart, leftEnd: match.left, rightStart: range.rightStart, rightEnd: match.right });
    }
    const leftAfter = match.left + match.size;
    const rightAfter = match.right + match.size;
    if (leftAfter < range.leftEnd && rightAfter < range.rightEnd) {
      pending.push({ leftStart: leftAfter, leftEnd: range.leftEnd, rightStart: rightAfter, rightEnd: range.rightEnd });
    }
  }
  matches.sort((a, b) => a.left - b.left || a.right - b.right);

  const segments: WordDiffSegment[] = [];
  const append = (type: WordDiffSegment["type"], text: string) => {
    if (!text) return;
    const previous = segments[segments.length - 1];
    if (previous?.type === type) previous.text += text;
    else segments.push({ type, text });
  };
  let leftIndex = 0;
  let rightIndex = 0;
  for (const match of matches) {
    append("deleted", left.slice(leftIndex, match.left).join(""));
    append("added", right.slice(rightIndex, match.right).join(""));
    append("equal", left.slice(match.left, match.left + match.size).join(""));
    leftIndex = match.left + match.size;
    rightIndex = match.right + match.size;
  }
  append("deleted", left.slice(leftIndex).join(""));
  append("added", right.slice(rightIndex).join(""));
  return segments;
}

function longestContiguousMatch(
  left: string[],
  right: string[],
  range: { leftStart: number; leftEnd: number; rightStart: number; rightEnd: number },
) {
  const width = range.rightEnd - range.rightStart;
  let previous = new Uint32Array(width + 1);
  let best = { left: range.leftStart, right: range.rightStart, size: 0 };
  for (let leftIndex = range.leftStart; leftIndex < range.leftEnd; leftIndex += 1) {
    const current = new Uint32Array(width + 1);
    for (let offset = 1; offset <= width; offset += 1) {
      const rightIndex = range.rightStart + offset - 1;
      if (left[leftIndex] !== right[rightIndex]) continue;
      current[offset] = previous[offset - 1] + 1;
      const size = current[offset];
      const candidateLeft = leftIndex - size + 1;
      const candidateRight = rightIndex - size + 1;
      if (size > best.size || (size === best.size && (candidateLeft < best.left || (candidateLeft === best.left && candidateRight < best.right)))) {
        best = { left: candidateLeft, right: candidateRight, size };
      }
    }
    previous = current;
  }
  return best;
}

function diffUnits(left: string[], right: string[], before: string, after: string): WordDiffSegment[] {
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
    if (row > 0 && col > 0 && left[row - 1] === right[col - 1]) {
      reversed.push({ type: "equal", text: left[--row] });
      col -= 1;
    } else if (col > 0 && (row === 0 || matrix[row * cols + col - 1] >= matrix[(row - 1) * cols + col])) {
      reversed.push({ type: "added", text: right[--col] });
    } else {
      reversed.push({ type: "deleted", text: left[--row] });
    }
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

function rowText(row: WordTableCell[]) {
  return row.map((cell) => cell.text).join("\u241f");
}

function transpose(grid: WordTableCell[][], labels: ComparisonLanguage) {
  const width = Math.max(0, ...grid.map((row) => row.length));
  return Array.from({ length: width }, (_, column) => grid.map((row, rowIndex) => row[column] ?? emptyCell(labels.emptyCell(rowIndex + 1, column + 1))));
}

function emptyCell(location: string): WordTableCell {
  return { text: "", format: "", location, segments: [], comments: [] };
}

function toAxisPair(pair: SequencePair): WordTableAxisPair {
  return { beforeIndex: pair.beforeIndex, afterIndex: pair.afterIndex };
}

function tableViewKind(table: WordTableComparison): WordViewKind {
  if (table.beforeIndex === null) return "added";
  if (table.afterIndex === null) return "deleted";
  const kinds = [...table.beforeKinds.flat(), ...table.afterKinds.flat()];
  if (kinds.some((kind) => kind === "added" || kind === "deleted" || kind === "changed")) return "changed";
  if (kinds.some((kind) => kind === "comment")) return "comment";
  if (kinds.some((kind) => kind === "format")) return "format";
  return "unchanged";
}

function sameComments(before: WordCellComment[], after: WordCellComment[]) {
  return JSON.stringify(before.map(({ author, text }) => ({ author, text })))
    === JSON.stringify(after.map(({ author, text }) => ({ author, text })));
}
