export interface SequenceAlignmentPair {
  beforeIndex: number | null;
  afterIndex: number | null;
}

export interface SequenceAlignmentOptions<T> {
  signature: (item: T) => string;
  equals: (before: T, after: T) => boolean;
  score: (before: T, after: T) => number;
  acceptsPair: (before: T, after: T) => boolean;
  gapScore?: number;
  cellBudget?: number;
  fallback?: (before: T[], after: T[], beforeStart: number, beforeEnd: number, afterStart: number, afterEnd: number) => SequenceAlignmentPair[];
  checkCanceled?: () => void;
}

export interface SequenceAlignmentResult {
  pairs: SequenceAlignmentPair[];
  budgetFallback: boolean;
  largestSegmentCells: number;
}

export function alignSequenceWithBudget<T>(
  before: T[],
  after: T[],
  options: SequenceAlignmentOptions<T>,
): SequenceAlignmentResult {
  if (!before.length) return { pairs: after.map((_, afterIndex) => ({ beforeIndex: null, afterIndex })), budgetFallback: false, largestSegmentCells: 0 };
  if (!after.length) return { pairs: before.map((_, beforeIndex) => ({ beforeIndex, afterIndex: null })), budgetFallback: false, largestSegmentCells: 0 };
  const anchors = exactPatienceAnchors(before, after, options);
  const pairs: SequenceAlignmentPair[] = [];
  let previousBefore = -1;
  let previousAfter = -1;
  let budgetFallback = false;
  let largestSegmentCells = 0;
  for (const anchor of [...anchors, { beforeIndex: before.length, afterIndex: after.length }]) {
    options.checkCanceled?.();
    const beforeStart = previousBefore + 1;
    const afterStart = previousAfter + 1;
    const cells = (anchor.beforeIndex - beforeStart) * (anchor.afterIndex - afterStart);
    largestSegmentCells = Math.max(largestSegmentCells, cells);
    if (cells > (options.cellBudget ?? 12_000_000)) {
      budgetFallback = true;
      pairs.push(...(options.fallback ?? positionFallback)(before, after, beforeStart, anchor.beforeIndex, afterStart, anchor.afterIndex));
    } else {
      pairs.push(...dynamicAlignRange(before, after, beforeStart, anchor.beforeIndex, afterStart, anchor.afterIndex, options));
    }
    if (anchor.beforeIndex < before.length && anchor.afterIndex < after.length) pairs.push(anchor);
    previousBefore = anchor.beforeIndex;
    previousAfter = anchor.afterIndex;
  }
  return { pairs, budgetFallback, largestSegmentCells };
}

export function positionFallback<T>(
  _before: T[],
  _after: T[],
  beforeStart: number,
  beforeEnd: number,
  afterStart: number,
  afterEnd: number,
) {
  const pairs: SequenceAlignmentPair[] = [];
  const common = Math.min(beforeEnd - beforeStart, afterEnd - afterStart);
  for (let offset = 0; offset < common; offset += 1) pairs.push({ beforeIndex: beforeStart + offset, afterIndex: afterStart + offset });
  for (let index = beforeStart + common; index < beforeEnd; index += 1) pairs.push({ beforeIndex: index, afterIndex: null });
  for (let index = afterStart + common; index < afterEnd; index += 1) pairs.push({ beforeIndex: null, afterIndex: index });
  return pairs;
}

function exactPatienceAnchors<T>(before: T[], after: T[], options: SequenceAlignmentOptions<T>) {
  const beforePositions = positionsBySignature(before, options.signature);
  const afterPositions = positionsBySignature(after, options.signature);
  const candidates: Array<{ beforeIndex: number; afterIndex: number }> = [];
  for (const [signature, beforeIndexes] of beforePositions) {
    const afterIndexes = afterPositions.get(signature);
    if (beforeIndexes.length !== 1 || afterIndexes?.length !== 1) continue;
    const beforeIndex = beforeIndexes[0];
    const afterIndex = afterIndexes[0];
    if (options.equals(before[beforeIndex], after[afterIndex])) candidates.push({ beforeIndex, afterIndex });
  }
  candidates.sort((left, right) => left.beforeIndex - right.beforeIndex || left.afterIndex - right.afterIndex);
  return longestIncreasingAfterIndexes(candidates);
}

function positionsBySignature<T>(items: T[], signatureOf: (item: T) => string) {
  const positions = new Map<string, number[]>();
  items.forEach((item, index) => {
    const signature = signatureOf(item);
    if (!signature) return;
    positions.set(signature, [...(positions.get(signature) ?? []), index]);
  });
  return positions;
}

function longestIncreasingAfterIndexes(candidates: Array<{ beforeIndex: number; afterIndex: number }>) {
  if (!candidates.length) return [];
  const tails: number[] = [];
  const tailCandidates: number[] = [];
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
    if (low > 0) previous[candidateIndex] = tailCandidates[low - 1];
    tailCandidates[low] = candidateIndex;
  });
  const result: Array<{ beforeIndex: number; afterIndex: number }> = [];
  let index = tailCandidates[tails.length - 1];
  while (index >= 0) {
    result.push(candidates[index]);
    index = previous[index];
  }
  return result.reverse();
}

function dynamicAlignRange<T>(
  before: T[],
  after: T[],
  beforeStart: number,
  beforeEnd: number,
  afterStart: number,
  afterEnd: number,
  options: SequenceAlignmentOptions<T>,
) {
  const beforeLength = beforeEnd - beforeStart;
  const afterLength = afterEnd - afterStart;
  if (!beforeLength) return Array.from({ length: afterLength }, (_, offset) => ({ beforeIndex: null, afterIndex: afterStart + offset }));
  if (!afterLength) return Array.from({ length: beforeLength }, (_, offset) => ({ beforeIndex: beforeStart + offset, afterIndex: null }));
  const columns = afterLength + 1;
  const directions = new Uint8Array((beforeLength + 1) * columns);
  let previous = new Float32Array(columns);
  let current = new Float32Array(columns);
  const gap = options.gapScore ?? -1;
  for (let column = 1; column <= afterLength; column += 1) {
    previous[column] = column * gap;
    directions[column] = 2;
  }
  let operations = 0;
  for (let row = 1; row <= beforeLength; row += 1) {
    current[0] = row * gap;
    directions[row * columns] = 1;
    for (let column = 1; column <= afterLength; column += 1) {
      if ((operations += 1) % 4096 === 0) options.checkCanceled?.();
      const beforeItem = before[beforeStart + row - 1];
      const afterItem = after[afterStart + column - 1];
      const diagonal = previous[column - 1] + options.score(beforeItem, afterItem);
      const up = previous[column] + gap;
      const left = current[column - 1] + gap;
      const offset = row * columns + column;
      if (diagonal >= up && diagonal >= left) {
        current[column] = diagonal;
        directions[offset] = 3;
      } else if (up >= left) {
        current[column] = up;
        directions[offset] = 1;
      } else {
        current[column] = left;
        directions[offset] = 2;
      }
    }
    [previous, current] = [current, previous];
  }

  const result: SequenceAlignmentPair[] = [];
  let row = beforeLength;
  let column = afterLength;
  while (row > 0 || column > 0) {
    const direction = directions[row * columns + column];
    if (row > 0 && column > 0 && direction === 3) {
      const beforeIndex = beforeStart + row - 1;
      const afterIndex = afterStart + column - 1;
      if (options.acceptsPair(before[beforeIndex], after[afterIndex])) result.push({ beforeIndex, afterIndex });
      else {
        result.push({ beforeIndex: null, afterIndex });
        result.push({ beforeIndex, afterIndex: null });
      }
      row -= 1;
      column -= 1;
    } else if (row > 0 && (direction === 1 || column === 0)) {
      result.push({ beforeIndex: beforeStart + row - 1, afterIndex: null });
      row -= 1;
    } else {
      result.push({ beforeIndex: null, afterIndex: afterStart + column - 1 });
      column -= 1;
    }
  }
  return result.reverse();
}
