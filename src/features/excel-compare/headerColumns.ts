export interface HeaderColumnPair { leftColumn: number; rightColumn: number }

const headerKey = (value: string) => value.trim().normalize("NFC");

/** One-based column pairs whose header text appears exactly once on each side (trimmed, not
 * empty), in left order. */
export function uniqueHeaderPairs(left: readonly string[], right: readonly string[]): HeaderColumnPair[] {
  const positions = (headers: readonly string[]) => {
    const found = new Map<string, number[]>();
    headers.forEach((header, index) => { const key = headerKey(header); if (key) found.set(key, [...found.get(key) ?? [], index + 1]); });
    return found;
  };
  const leftPositions = positions(left), rightPositions = positions(right);
  const pairs: HeaderColumnPair[] = [];
  for (const [key, columns] of leftPositions) {
    const match = rightPositions.get(key);
    if (columns.length === 1 && match?.length === 1) pairs.push({ leftColumn: columns[0], rightColumn: match[0] });
  }
  return pairs.sort((a, b) => a.leftColumn - b.leftColumn);
}

/** True when header pairs cross (a column moved), which an order-keeping alignment cannot pair. */
export function headerPairsReordered(pairs: readonly HeaderColumnPair[]) {
  return pairs.some((pair, index) => index > 0 && pair.rightColumn < pairs[index - 1].rightColumn);
}

/** The manual mapping a user starts from: same-header columns paired, then the remaining columns
 * by position among themselves. */
export function initialColumnMapping(left: readonly string[], right: readonly string[]): HeaderColumnPair[] {
  const pairs = uniqueHeaderPairs(left, right);
  const usedLeft = new Set(pairs.map((pair) => pair.leftColumn)), usedRight = new Set(pairs.map((pair) => pair.rightColumn));
  const restLeft = left.map((_, index) => index + 1).filter((column) => !usedLeft.has(column));
  const restRight = right.map((_, index) => index + 1).filter((column) => !usedRight.has(column));
  for (let index = 0; index < Math.min(restLeft.length, restRight.length); index++) pairs.push({ leftColumn: restLeft[index], rightColumn: restRight[index] });
  return pairs.sort((a, b) => a.leftColumn - b.leftColumn);
}
