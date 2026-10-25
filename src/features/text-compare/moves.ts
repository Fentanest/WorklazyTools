import type { TextLine, TextRow } from "./resultTypes.ts";

/**
 * Moved-block detection following Diffchecker 7.3.0 (module 62888, computeMoves with
 * extendMovesInAdvanced). The unit is a chunk of the line diff: the left lines of a run of
 * non-equal rows form a deletion chunk and its right lines an insertion chunk; a deletion directly
 * followed by an insertion is a replacement. Only chunks of at least three lines take part.
 *  1. A deletion chunk moves to the most similar insertion chunk less than 1,000 lines away when the
 *     character-multiset similarity exceeds 0.9 (replacements excluded; exact match only for
 *     chunks over 1,000 characters or more than 500 chunks).
 *  2. In the chunks left over (replacements included) runs of at least three lines equal after
 *     trimming are matched by three-line keys, longest first, then extended over neighbouring line
 *     pairs at least 0.6 similar; a block averaging below 0.6 is dropped.
 * The whole detection has a 5 second budget; past it no move is reported.
 */
export interface MoveSide {
  /** Moved block number, shared by both sides of the block. */
  group: number;
  /** Counterpart lines on the other side, 1-based, end exclusive. */
  start: number;
  end: number;
  score: number;
}

const MIN_LINES = 3;
const SIMPLE_THRESHOLD = 0.9, EXTEND_THRESHOLD = 0.6;
const BUDGET_MS = 5_000;

type Chunk = { lines: string[]; lineStart: number; lineEnd: number; text: string };
type Move = { fromStart: number; fromEnd: number; toStart: number; toEnd: number; score: number };

const content = (line: TextLine) => line.key.endsWith("\n") ? line.key.slice(0, -1) : line.key;

function similarity() {
  const counts = new Map<string, Map<string, number>>();
  const histogram = (text: string) => {
    let map = counts.get(text);
    if (!map) {
      map = new Map();
      for (let i = 0; i < text.length; i++) map.set(text[i], (map.get(text[i]) ?? 0) + 1);
      counts.set(text, map);
    }
    return map;
  };
  return (a: string, b: string, exactOnly = false) => {
    if (a === b) return 1;
    if (exactOnly) return 0;
    const x = histogram(a), y = histogram(b);
    let difference = 0;
    x.forEach((count, key) => { difference += Math.abs(count - (y.get(key) ?? 0)); });
    y.forEach((count, key) => { if (!x.has(key)) difference += count; });
    return 1 - difference / (a.length + b.length);
  };
}

/** Sorted, non-overlapping ranges; `wraps` is true when one stored range contains [start, end). */
class RangeSet {
  private ranges: [number, number][] = [];
  private before(range: [number, number]) {
    let low = 0, high = this.ranges.length - 1;
    while (low <= high) { const mid = (low + high) >> 1; if (this.ranges[mid][0] <= range[0]) low = mid + 1; else high = mid - 1; }
    return low;
  }
  wraps(range: [number, number]) {
    let low = 0, high = this.ranges.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1, item = this.ranges[mid];
      if (item[0] <= range[0]) { if (item[1] >= range[1]) return true; low = mid + 1; } else high = mid - 1;
    }
    return false;
  }
  replaceWrappedBy(range: [number, number]) {
    let end = this.before(range); const start = end;
    while (this.ranges[end] && this.ranges[end][1] <= range[1]) end++;
    this.ranges.splice(start, end - start, range);
  }
  overlaps(range: [number, number]) { return this.ranges.some(item => item[0] < range[1] && item[1] > range[0]); }
  add(range: [number, number]) { this.ranges.splice(this.before(range), 0, range); }
}

function computeMoves(operations: { kind: "equal" | "delete" | "insert"; lines: string[] }[], deadline: number): Move[] | undefined {
  const inTime = () => performance.now() < deadline;
  const deletions: Chunk[] = [], insertions: Chunk[] = [], replacedDeletions = new Set<number>(), replacedInsertions = new Set<number>();
  let left = 1, right = 1;
  operations.forEach((operation, index) => {
    const lineStart = operation.kind === "insert" ? right : left, lineEnd = lineStart + operation.lines.length;
    if (operation.kind !== "equal" && operation.lines.length >= MIN_LINES) {
      const chunk = { lines: operation.lines, lineStart, lineEnd, text: operation.lines.map(line => `${line}\n`).join("") };
      if (operation.kind === "delete") { deletions.push(chunk); if (operations[index + 1]?.kind === "insert") replacedDeletions.add(deletions.length - 1); }
      else { insertions.push(chunk); if (operations[index - 1]?.kind === "delete") replacedInsertions.add(insertions.length - 1); }
    }
    if (operation.kind !== "insert") left += operation.lines.length;
    if (operation.kind !== "delete") right += operation.lines.length;
  });
  const moves: Move[] = [], takenFrom = new Set<number>(), takenTo = new Set<number>();
  const similar = similarity();
  // 1. Whole chunks.
  for (let d = 0; d < deletions.length; d++) {
    if (replacedDeletions.has(d)) continue;
    const from = deletions[d];
    let best = 0, bestDistance = Infinity, target: Chunk | undefined;
    for (let i = 0; i < insertions.length; i++) {
      if (replacedInsertions.has(i)) continue;
      const to = insertions[i], distance = Math.abs(from.lineStart - to.lineStart);
      if (takenTo.has(to.lineStart) || !(distance < 1000)) continue;
      const exactOnly = from.text.length > 1000 || to.text.length > 1000 || deletions.length > 500 || insertions.length > 500;
      const score = similar(from.text, to.text, exactOnly);
      if (score > best || score === best && distance < bestDistance) { best = score; target = to; bestDistance = distance; }
      if (!inTime()) return undefined;
    }
    if (best > SIMPLE_THRESHOLD && target) {
      moves.push({ fromStart: from.lineStart, fromEnd: from.lineEnd, toStart: target.lineStart, toEnd: target.lineEnd, score: best });
      takenFrom.add(from.lineStart); takenTo.add(target.lineStart);
    }
  }
  if (!inTime()) return undefined;
  // 2. Runs of trimmed-equal lines in the remaining chunks, extended by similar neighbours.
  const leftLines = new Map<number, string>(), rightLines = new Map<number, string>();
  for (const chunk of deletions) if (!takenFrom.has(chunk.lineStart)) chunk.lines.forEach((line, i) => leftLines.set(chunk.lineStart + i, line));
  for (const chunk of insertions) if (!takenTo.has(chunk.lineStart)) chunk.lines.forEach((line, i) => rightLines.set(chunk.lineStart + i, line));
  const ids = new Map<string, number>();
  const idsOf = (lines: Map<number, string>) => {
    const result = new Map<number, number>();
    for (const [number, line] of lines) {
      const key = line.trim(); let id = ids.get(key);
      if (id === undefined) { id = ids.size; ids.set(key, id); }
      result.set(number, id);
    }
    return result;
  };
  const leftIds = idsOf(leftLines), rightIds = idsOf(rightLines);
  const keyAt = (map: Map<number, number>, line: number) => {
    const parts: number[] = [];
    for (let i = 0; i < MIN_LINES; i++) { const id = map.get(line + i); if (id === undefined) return undefined; parts.push(id); }
    return parts.join(":");
  };
  const starts = new Map<string, number[]>();
  for (const line of rightLines.keys()) {
    const key = keyAt(rightIds, line);
    if (key !== undefined) { const list = starts.get(key); if (list) list.push(line); else starts.set(key, [line]); }
  }
  const fromRanges = new RangeSet(), toRanges = new RangeSet(), runs = new Map<number, { toStart: number; toEnd: number; fromEnd: number }>();
  for (const line of leftLines.keys()) {
    const key = keyAt(leftIds, line);
    for (const candidate of key === undefined ? [] : starts.get(key) ?? []) {
      if (!inTime()) return undefined;
      // Only the first line of a run of equal pairs starts a block.
      if (leftIds.has(line - 1) && leftIds.get(line - 1) === rightIds.get(candidate - 1)) continue;
      let fromEnd = line + 1, toEnd = candidate + 1;
      while (leftIds.has(fromEnd) && leftIds.get(fromEnd) === rightIds.get(toEnd)) { fromEnd++; toEnd++; }
      if (fromEnd - line < MIN_LINES || fromRanges.wraps([line, fromEnd]) || toRanges.wraps([candidate, toEnd])) continue;
      fromRanges.replaceWrappedBy([line, fromEnd]); toRanges.replaceWrappedBy([candidate, toEnd]);
      runs.set(line, { toStart: candidate, toEnd, fromEnd });
    }
    if (!inTime()) return undefined;
  }
  const ordered = [...runs.entries()].sort(([, a], [, b]) => (b.toEnd - b.toStart) - (a.toEnd - a.toStart));
  const takenFromRanges = new RangeSet(), takenToRanges = new RangeSet();
  for (const [start, run] of ordered) {
    let fromStart = start, fromEnd = start + (run.toEnd - run.toStart), toStart = run.toStart, toEnd = run.toEnd;
    let count = fromEnd - fromStart, total = 0;
    for (let i = 0; i < count; i++) total += similar(leftLines.get(fromStart + i)!, rightLines.get(toStart + i)!);
    while (leftLines.has(fromStart - 1) && rightLines.has(toStart - 1)) {
      const a = leftLines.get(fromStart - 1)!, b = rightLines.get(toStart - 1)!, score = similar(a, b, Math.max(a.length, b.length) > 200);
      if (score < EXTEND_THRESHOLD) break;
      count++; total += score; fromStart--; toStart--;
    }
    while (leftLines.has(fromEnd) && rightLines.has(toEnd)) {
      const a = leftLines.get(fromEnd)!, b = rightLines.get(toEnd)!, score = similar(a, b, Math.max(a.length, b.length) > 200);
      if (score < EXTEND_THRESHOLD) break;
      count++; total += score; fromEnd++; toEnd++;
    }
    const score = total / count;
    if (score < EXTEND_THRESHOLD || takenFromRanges.overlaps([fromStart, fromEnd]) || takenToRanges.overlaps([toStart, toEnd])) continue;
    takenFromRanges.add([fromStart, fromEnd]); takenToRanges.add([toStart, toEnd]);
    moves.push({ fromStart, fromEnd, toStart, toEnd, score });
  }
  return moves;
}

/** Annotates the rows' moved lines in place; row kinds and counts are unchanged. Returns the number of moved blocks. */
export function annotateMoves(rows: TextRow[], deadline = performance.now() + BUDGET_MS): number {
  const operations: { kind: "equal" | "delete" | "insert"; lines: string[] }[] = [];
  const push = (kind: "equal" | "delete" | "insert", line: string) => {
    const last = operations.at(-1);
    if (last?.kind === kind) last.lines.push(line); else operations.push({ kind, lines: [line] });
  };
  for (let i = 0; i < rows.length;) {
    if (rows[i].kind === "equal" || rows[i].kind === "ignored") { push("equal", content(rows[i].left!)); i++; continue; }
    const run: TextRow[] = [];
    while (i < rows.length && rows[i].kind !== "equal" && rows[i].kind !== "ignored") run.push(rows[i++]);
    for (const row of run) if (row.left) push("delete", content(row.left));
    for (const row of run) if (row.right) push("insert", content(row.right));
  }
  const moves = computeMoves(operations, deadline);
  if (!moves?.length) return 0;
  const leftRows = new Map<number, TextRow>(), rightRows = new Map<number, TextRow>();
  for (const row of rows) { if (row.left) leftRows.set(row.left.number, row); if (row.right) rightRows.set(row.right.number, row); }
  moves.sort((a, b) => a.fromStart - b.fromStart).forEach((move, index) => {
    const group = index + 1;
    for (let line = move.fromStart; line < move.fromEnd; line++) {
      const row = leftRows.get(line);
      if (row) row.leftMove = { group, start: move.toStart, end: move.toEnd, score: move.score };
    }
    for (let line = move.toStart; line < move.toEnd; line++) {
      const row = rightRows.get(line);
      if (row) row.rightMove = { group, start: move.fromStart, end: move.fromEnd, score: move.score };
    }
  });
  return moves.length;
}
