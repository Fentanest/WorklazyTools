export interface SequencePair {
  beforeIndex: number | null;
  afterIndex: number | null;
}

export interface SequenceGroup {
  beforeIndexes: number[];
  afterIndexes: number[];
  moved?: boolean;
  similarity?: number;
}

export interface DocumentAlignmentOptions<T> {
  textOf: (item: T) => string;
  compatible?: (before: T, after: T) => boolean;
  canGroup?: (item: T) => boolean;
  include?: (item: T) => boolean;
  detectMoves?: boolean;
}

const MATCH_THRESHOLD = 0.24;
const MOVE_THRESHOLD = 0.72;
const MAX_DYNAMIC_CELLS = 12_000_000;

/**
 * 문서 어댑터가 만든 블록을 공통 규칙으로 정렬합니다. 비어 있는 문단은
 * 기본적으로 제외하고, 분할/병합과 이동은 일반 삽입/삭제와 별도로 묶습니다.
 */
export function alignDocumentSequence<T>(
  before: T[],
  after: T[],
  options: DocumentAlignmentOptions<T>,
): SequenceGroup[] {
  const compatible = options.compatible ?? (() => true);
  const canGroup = options.canGroup ?? (() => true);
  const include = options.include ?? ((item: T) => normalizeForMatch(options.textOf(item)).length > 0);
  const beforeIndexes = before.map((item, index) => include(item) ? index : -1).filter((index) => index >= 0);
  const afterIndexes = after.map((item, index) => include(item) ? index : -1).filter((index) => index >= 0);
  const filteredBefore = beforeIndexes.map((index) => before[index]);
  const filteredAfter = afterIndexes.map((index) => after[index]);
  const pairs = alignSequence(filteredBefore, filteredAfter, options.textOf, compatible).map((pair) => ({
    beforeIndex: pair.beforeIndex === null ? null : beforeIndexes[pair.beforeIndex],
    afterIndex: pair.afterIndex === null ? null : afterIndexes[pair.afterIndex],
  }));
  const grouped = groupParagraphSplits(pairs, before, after, options.textOf, canGroup);
  return options.detectMoves === false
    ? grouped
    : pairMovedGroups(grouped, before, after, options.textOf, compatible);
}

/**
 * 표 행/열처럼 빈 값도 위치 의미를 갖는 시퀀스에 사용하는 저수준 정렬입니다.
 */
export function alignSequence<T>(
  before: T[],
  after: T[],
  textOf: (item: T) => string,
  compatible: (before: T, after: T) => boolean = () => true,
): SequencePair[] {
  if (!before.length) return after.map((_, afterIndex) => ({ beforeIndex: null, afterIndex }));
  if (!after.length) return before.map((_, beforeIndex) => ({ beforeIndex, afterIndex: null }));

  const anchors = exactPatienceAnchors(before, after, textOf, compatible);
  const result: SequencePair[] = [];
  let previousBefore = -1;
  let previousAfter = -1;
  for (const anchor of [...anchors, { beforeIndex: before.length, afterIndex: after.length }]) {
    const beforeStart = previousBefore + 1;
    const afterStart = previousAfter + 1;
    const beforeEnd = anchor.beforeIndex;
    const afterEnd = anchor.afterIndex;
    result.push(...alignRange(before, after, beforeStart, beforeEnd, afterStart, afterEnd, textOf, compatible));
    if (anchor.beforeIndex < before.length && anchor.afterIndex < after.length) result.push(anchor);
    previousBefore = anchor.beforeIndex;
    previousAfter = anchor.afterIndex;
  }
  return result;
}

export function groupParagraphSplits<T>(
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

  for (let index = 0; index < groups.length;) {
    let merged: SequenceGroup | undefined;
    let consumed = 0;
    for (const windowSize of [3, 2]) {
      const window = groups.slice(index, index + windowSize);
      if (window.length !== windowSize) continue;
      const beforeIndexes = window.flatMap((group) => group.beforeIndexes);
      const afterIndexes = window.flatMap((group) => group.afterIndexes);
      const oneToMany = beforeIndexes.length === 1 && afterIndexes.length >= 2 && afterIndexes.length <= 3;
      const manyToOne = afterIndexes.length === 1 && beforeIndexes.length >= 2 && beforeIndexes.length <= 3;
      if (!oneToMany && !manyToOne) continue;
      const items = [
        ...beforeIndexes.map((itemIndex) => before[itemIndex]),
        ...afterIndexes.map((itemIndex) => after[itemIndex]),
      ];
      if (!items.every(canGroup)) continue;
      const beforeText = beforeIndexes.map((itemIndex) => textOf(before[itemIndex])).join("\n");
      const afterText = afterIndexes.map((itemIndex) => textOf(after[itemIndex])).join("\n");
      const singleText = oneToMany ? textOf(before[beforeIndexes[0]]) : textOf(after[afterIndexes[0]]);
      const fragmentTexts = oneToMany
        ? afterIndexes.map((itemIndex) => textOf(after[itemIndex]))
        : beforeIndexes.map((itemIndex) => textOf(before[itemIndex]));
      if (!looksLikeSplitOrMerge(beforeText, afterText, singleText, fragmentTexts)) continue;
      merged = { beforeIndexes, afterIndexes, similarity: textSimilarity(beforeText, afterText) };
      consumed = windowSize;
      break;
    }
    if (merged) {
      result.push(merged);
      index += consumed;
    } else {
      result.push(groups[index]);
      index += 1;
    }
  }
  return result;
}

function exactPatienceAnchors<T>(
  before: T[],
  after: T[],
  textOf: (item: T) => string,
  compatible: (before: T, after: T) => boolean,
) {
  const beforePositions = positionsByText(before, textOf);
  const afterPositions = positionsByText(after, textOf);
  const candidates: Array<{ beforeIndex: number; afterIndex: number }> = [];
  for (const [key, leftIndexes] of beforePositions) {
    const rightIndexes = afterPositions.get(key);
    if (leftIndexes.length !== 1 || rightIndexes?.length !== 1) continue;
    const beforeIndex = leftIndexes[0];
    const afterIndex = rightIndexes[0];
    if (compatible(before[beforeIndex], after[afterIndex])) candidates.push({ beforeIndex, afterIndex });
  }
  candidates.sort((left, right) => left.beforeIndex - right.beforeIndex);
  return longestIncreasingAfterIndexes(candidates);
}

function positionsByText<T>(items: T[], textOf: (item: T) => string) {
  const positions = new Map<string, number[]>();
  items.forEach((item, index) => {
    const key = normalizeForMatch(textOf(item));
    if (!key) return;
    positions.set(key, [...(positions.get(key) ?? []), index]);
  });
  return positions;
}

function longestIncreasingAfterIndexes(candidates: Array<{ beforeIndex: number; afterIndex: number }>) {
  if (!candidates.length) return [];
  const tails: number[] = [];
  const tailCandidateIndexes: number[] = [];
  const previous = new Int32Array(candidates.length).fill(-1);
  candidates.forEach((candidate, candidateIndex) => {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (tails[middle] < candidate.afterIndex) low = middle + 1;
      else high = middle;
    }
    tails[low] = candidate.afterIndex;
    if (low > 0) previous[candidateIndex] = tailCandidateIndexes[low - 1];
    tailCandidateIndexes[low] = candidateIndex;
  });
  const result: Array<{ beforeIndex: number; afterIndex: number }> = [];
  let candidateIndex = tailCandidateIndexes[tails.length - 1];
  while (candidateIndex >= 0) {
    result.push(candidates[candidateIndex]);
    candidateIndex = previous[candidateIndex];
  }
  return result.reverse();
}

function alignRange<T>(
  before: T[],
  after: T[],
  beforeStart: number,
  beforeEnd: number,
  afterStart: number,
  afterEnd: number,
  textOf: (item: T) => string,
  compatible: (before: T, after: T) => boolean,
) {
  const beforeLength = beforeEnd - beforeStart;
  const afterLength = afterEnd - afterStart;
  if (!beforeLength) return Array.from({ length: afterLength }, (_, offset) => ({ beforeIndex: null, afterIndex: afterStart + offset }));
  if (!afterLength) return Array.from({ length: beforeLength }, (_, offset) => ({ beforeIndex: beforeStart + offset, afterIndex: null }));
  if ((beforeLength + 1) * (afterLength + 1) <= MAX_DYNAMIC_CELLS) {
    return dynamicAlignRange(before, after, beforeStart, beforeEnd, afterStart, afterEnd, textOf, compatible);
  }
  return windowAlignRange(before, after, beforeStart, beforeEnd, afterStart, afterEnd, textOf, compatible);
}

function dynamicAlignRange<T>(
  before: T[],
  after: T[],
  beforeStart: number,
  beforeEnd: number,
  afterStart: number,
  afterEnd: number,
  textOf: (item: T) => string,
  compatible: (before: T, after: T) => boolean,
) {
  const beforeLength = beforeEnd - beforeStart;
  const afterLength = afterEnd - afterStart;
  const cols = afterLength + 1;
  const directions = new Uint8Array((beforeLength + 1) * cols);
  let previous = new Float32Array(cols);
  let current = new Float32Array(cols);
  for (let col = 1; col <= afterLength; col += 1) {
    previous[col] = -col;
    directions[col] = 2;
  }
  for (let row = 1; row <= beforeLength; row += 1) {
    current[0] = -row;
    directions[row * cols] = 1;
    for (let col = 1; col <= afterLength; col += 1) {
      const leftItem = before[beforeStart + row - 1];
      const rightItem = after[afterStart + col - 1];
      const similarity = compatible(leftItem, rightItem) ? textSimilarity(textOf(leftItem), textOf(rightItem)) : 0;
      const diagonal = previous[col - 1] + matchScore(similarity);
      const up = previous[col] - 1;
      const left = current[col - 1] - 1;
      const offset = row * cols + col;
      if (diagonal >= up && diagonal >= left) {
        current[col] = diagonal;
        directions[offset] = 3;
      } else if (up >= left) {
        current[col] = up;
        directions[offset] = 1;
      } else {
        current[col] = left;
        directions[offset] = 2;
      }
    }
    [previous, current] = [current, previous];
  }

  const result: SequencePair[] = [];
  let row = beforeLength;
  let col = afterLength;
  while (row > 0 || col > 0) {
    const direction = directions[row * cols + col];
    if (row > 0 && col > 0 && direction === 3) {
      const beforeIndex = beforeStart + row - 1;
      const afterIndex = afterStart + col - 1;
      const similarity = compatible(before[beforeIndex], after[afterIndex])
        ? textSimilarity(textOf(before[beforeIndex]), textOf(after[afterIndex]))
        : 0;
      if (similarity >= MATCH_THRESHOLD) result.push({ beforeIndex, afterIndex });
      else {
        result.push({ beforeIndex: null, afterIndex });
        result.push({ beforeIndex, afterIndex: null });
      }
      row -= 1;
      col -= 1;
    } else if (row > 0 && (direction === 1 || col === 0)) {
      result.push({ beforeIndex: beforeStart + row - 1, afterIndex: null });
      row -= 1;
    } else {
      result.push({ beforeIndex: null, afterIndex: afterStart + col - 1 });
      col -= 1;
    }
  }
  return result.reverse();
}

function windowAlignRange<T>(
  before: T[],
  after: T[],
  beforeStart: number,
  beforeEnd: number,
  afterStart: number,
  afterEnd: number,
  textOf: (item: T) => string,
  compatible: (before: T, after: T) => boolean,
) {
  const result: SequencePair[] = [];
  let beforeIndex = beforeStart;
  let afterIndex = afterStart;
  const lookahead = 96;
  while (beforeIndex < beforeEnd || afterIndex < afterEnd) {
    if (beforeIndex >= beforeEnd) { result.push({ beforeIndex: null, afterIndex: afterIndex++ }); continue; }
    if (afterIndex >= afterEnd) { result.push({ beforeIndex: beforeIndex++, afterIndex: null }); continue; }
    const direct = itemSimilarity(before[beforeIndex], after[afterIndex], textOf, compatible);
    if (direct >= MATCH_THRESHOLD) {
      result.push({ beforeIndex: beforeIndex++, afterIndex: afterIndex++ });
      continue;
    }
    let bestAfter = -1;
    let bestAfterScore = MATCH_THRESHOLD;
    for (let offset = 1; offset <= lookahead && afterIndex + offset < afterEnd; offset += 1) {
      const score = itemSimilarity(before[beforeIndex], after[afterIndex + offset], textOf, compatible) - offset * 0.002;
      if (score > bestAfterScore) { bestAfter = afterIndex + offset; bestAfterScore = score; }
    }
    let bestBefore = -1;
    let bestBeforeScore = MATCH_THRESHOLD;
    for (let offset = 1; offset <= lookahead && beforeIndex + offset < beforeEnd; offset += 1) {
      const score = itemSimilarity(before[beforeIndex + offset], after[afterIndex], textOf, compatible) - offset * 0.002;
      if (score > bestBeforeScore) { bestBefore = beforeIndex + offset; bestBeforeScore = score; }
    }
    if (bestAfter >= 0 && bestAfterScore >= bestBeforeScore) {
      while (afterIndex < bestAfter) result.push({ beforeIndex: null, afterIndex: afterIndex++ });
    } else if (bestBefore >= 0) {
      while (beforeIndex < bestBefore) result.push({ beforeIndex: beforeIndex++, afterIndex: null });
    } else {
      result.push({ beforeIndex: beforeIndex++, afterIndex: null });
      result.push({ beforeIndex: null, afterIndex: afterIndex++ });
    }
  }
  return result;
}

function pairMovedGroups<T>(
  groups: SequenceGroup[],
  before: T[],
  after: T[],
  textOf: (item: T) => string,
  compatible: (before: T, after: T) => boolean,
) {
  const deleted = groups.map((group, groupIndex) => ({ group, groupIndex }))
    .filter(({ group }) => group.beforeIndexes.length === 1 && group.afterIndexes.length === 0);
  const added = groups.map((group, groupIndex) => ({ group, groupIndex }))
    .filter(({ group }) => group.beforeIndexes.length === 0 && group.afterIndexes.length === 1);
  const candidates: Array<{ deletedGroup: number; addedGroup: number; similarity: number }> = [];
  for (const left of deleted) {
    const beforeIndex = left.group.beforeIndexes[0];
    for (const right of added) {
      const afterIndex = right.group.afterIndexes[0];
      if (!compatible(before[beforeIndex], after[afterIndex])) continue;
      const similarity = textSimilarity(textOf(before[beforeIndex]), textOf(after[afterIndex]));
      if (similarity >= MOVE_THRESHOLD) candidates.push({
        deletedGroup: left.groupIndex,
        addedGroup: right.groupIndex,
        similarity,
      });
    }
  }
  candidates.sort((left, right) => right.similarity - left.similarity);
  const usedDeleted = new Set<number>();
  const usedAdded = new Set<number>();
  const moveByAdded = new Map<number, SequenceGroup>();
  for (const candidate of candidates) {
    if (usedDeleted.has(candidate.deletedGroup) || usedAdded.has(candidate.addedGroup)) continue;
    usedDeleted.add(candidate.deletedGroup);
    usedAdded.add(candidate.addedGroup);
    moveByAdded.set(candidate.addedGroup, {
      beforeIndexes: groups[candidate.deletedGroup].beforeIndexes,
      afterIndexes: groups[candidate.addedGroup].afterIndexes,
      moved: true,
      similarity: candidate.similarity,
    });
  }
  return groups.flatMap((group, groupIndex) => {
    if (usedDeleted.has(groupIndex)) return [];
    return [moveByAdded.get(groupIndex) ?? group];
  });
}

function looksLikeSplitOrMerge(leftValue: string, rightValue: string, singleValue: string, fragments: string[]) {
  const left = normalizeForMatch(leftValue);
  const right = normalizeForMatch(rightValue);
  const single = normalizeForMatch(singleValue);
  if (Math.max(left.length, right.length) < 20) return false;
  if (fragments.some((fragment) => normalizeForMatch(fragment).length < 6)) return false;
  if (fragments.some((fragment) => directionalNgramCoverage(normalizeForMatch(fragment), single) < 0.55)) return false;
  const similarity = textSimilarity(left, right);
  const coverage = ngramCoverage(left, right);
  return similarity >= 0.62 || (similarity >= 0.54 && coverage >= 0.68);
}

function directionalNgramCoverage(value: string, reference: string) {
  const valueGrams = new Set(ngrams(value, value.length < 8 ? 1 : 2));
  const referenceGrams = new Set(ngrams(reference, reference.length < 8 ? 1 : 2));
  if (!valueGrams.size) return 0;
  let matches = 0;
  for (const gram of valueGrams) if (referenceGrams.has(gram)) matches += 1;
  return matches / valueGrams.size;
}

function ngramCoverage(left: string, right: string) {
  const leftGrams = new Set(ngrams(left, left.length < 8 ? 1 : 2));
  const rightGrams = new Set(ngrams(right, right.length < 8 ? 1 : 2));
  if (!leftGrams.size || !rightGrams.size) return 0;
  let matches = 0;
  for (const gram of leftGrams) if (rightGrams.has(gram)) matches += 1;
  return matches / Math.min(leftGrams.size, rightGrams.size);
}

function itemSimilarity<T>(
  before: T,
  after: T,
  textOf: (item: T) => string,
  compatible: (before: T, after: T) => boolean,
) {
  return compatible(before, after) ? textSimilarity(textOf(before), textOf(after)) : 0;
}

function matchScore(similarity: number) {
  if (similarity === 1) return 5;
  return similarity >= MATCH_THRESHOLD ? 0.15 + similarity * 3 : -2.2;
}

export function textSimilarity(leftValue: string, rightValue: string) {
  const left = normalizeForMatch(leftValue);
  const right = normalizeForMatch(rightValue);
  if (left === right) return 1;
  if (!left || !right) return 0;
  const gramSize = Math.min(left.length, right.length) < 8 ? 1 : 2;
  const leftGrams = ngrams(left, gramSize);
  const rightGrams = ngrams(right, gramSize);
  const counts = new Map<string, number>();
  leftGrams.forEach((item) => counts.set(item, (counts.get(item) ?? 0) + 1));
  let matches = 0;
  rightGrams.forEach((item) => {
    const count = counts.get(item) ?? 0;
    if (count > 0) {
      matches += 1;
      counts.set(item, count - 1);
    }
  });
  return (2 * matches) / (leftGrams.length + rightGrams.length);
}

function ngrams(value: string, size: number) {
  if (value.length <= size) return [value];
  return Array.from({ length: value.length - size + 1 }, (_, index) => value.slice(index, index + size));
}

export function normalizeForMatch(value: string) {
  return value.normalize("NFC").toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").trim();
}
