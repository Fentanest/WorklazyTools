import type { SequenceAlignmentPair } from "./sequenceAlignment.ts";

/** Minimal edit script between two sequences (Myers' O((N+M)D) algorithm, linear-space
 * divide-and-conquer). Time grows with the number of differences, so a small change in a long or
 * repetitive input stays exact where a cell-budgeted alignment would fall back. Returns the
 * aligned pairs in order (equal items paired, others with a null side), or null when the edit
 * distance exceeds `maxDistance`. `checkCanceled` may throw to abort. */
export function myersAlign<T>(before: readonly T[], after: readonly T[], equals: (left: T, right: T) => boolean, maxDistance: number, checkCanceled: () => void = () => undefined): SequenceAlignmentPair[] | null {
  const pairs: SequenceAlignmentPair[] = [];
  let steps = 0;
  const tick = () => { if (++steps % 4096 === 0) checkCanceled(); };
  // Middle snake of before[a0,a1) x after[b0,b1): returns [x, y, u, v, d] (snake from (x,y) to (u,v)).
  const middle = (a0: number, a1: number, b0: number, b1: number): [number, number, number, number, number] | null => {
    const n = a1 - a0, m = b1 - b0, delta = n - m, odd = (delta & 1) !== 0, max = Math.ceil((n + m) / 2);
    const offset = max + 1, forward = new Int32Array(2 * max + 3), backward = new Int32Array(2 * max + 3);
    forward[offset + 1] = 0; backward[offset + 1] = 0;
    for (let d = 0; d <= max; d++) {
      // A part's edit distance never exceeds the whole input's.
      if (d > maxDistance) return null;
      for (let k = -d; k <= d; k += 2) {
        tick();
        let x = k === -d || (k !== d && forward[offset + k - 1] < forward[offset + k + 1]) ? forward[offset + k + 1] : forward[offset + k - 1] + 1;
        let y = x - k; const startX = x, startY = y;
        while (x < n && y < m && equals(before[a0 + x], after[b0 + y])) { x++; y++; }
        forward[offset + k] = x;
        const c = delta - k;
        if (odd && c >= -(d - 1) && c <= d - 1 && x + backward[offset + c] >= n) return [a0 + startX, b0 + startY, a0 + x, b0 + y, 2 * d - 1];
      }
      for (let k = -d; k <= d; k += 2) {
        tick();
        let x = k === -d || (k !== d && backward[offset + k - 1] < backward[offset + k + 1]) ? backward[offset + k + 1] : backward[offset + k - 1] + 1;
        let y = x - k; const startX = x, startY = y;
        while (x < n && y < m && equals(before[a1 - 1 - x], after[b1 - 1 - y])) { x++; y++; }
        backward[offset + k] = x;
        const c = delta - k;
        if (!odd && c >= -d && c <= d && x + forward[offset + c] >= n) return [a1 - x, b1 - y, a1 - startX, b1 - startY, 2 * d];
      }
    }
    return null;
  };
  // Up to this distance the forward pass keeps its frontier per step (at most ~4M integers) and
  // backtracks, which is about half the work of the linear-space recursion below.
  const TRACE_DISTANCE = 2_000;
  const greedy = (a0: number, a1: number, b0: number, b1: number, limit: number): SequenceAlignmentPair[] | null => {
    const n = a1 - a0, m = b1 - b0, offset = limit + 1, trace: Int32Array[] = [];
    let frontier = new Int32Array(2 * limit + 3);
    for (let d = 0; d <= limit; d++) {
      const next = frontier.slice();
      for (let k = -d; k <= d; k += 2) {
        tick();
        let x = k === -d || (k !== d && frontier[offset + k - 1] < frontier[offset + k + 1]) ? frontier[offset + k + 1] : frontier[offset + k - 1] + 1;
        let y = x - k;
        while (x < n && y < m && equals(before[a0 + x], after[b0 + y])) { x++; y++; }
        next[offset + k] = x;
        if (x >= n && y >= m) {
          trace.push(next);
          const result: SequenceAlignmentPair[] = [];
          let cx = n, cy = m;
          for (let step = d; step > 0; step--) {
            const previous = trace[step - 1], kk = cx - cy;
            const down = kk === -step || (kk !== step && previous[offset + kk - 1] < previous[offset + kk + 1]);
            const pk = down ? kk + 1 : kk - 1, px = previous[offset + pk], py = px - pk;
            while (cx > (down ? px : px + 1) && cy > (down ? py + 1 : py)) result.push({ beforeIndex: a0 + --cx, afterIndex: b0 + --cy });
            if (down) result.push({ beforeIndex: null, afterIndex: b0 + --cy }); else result.push({ beforeIndex: a0 + --cx, afterIndex: null });
          }
          while (cx > 0 && cy > 0) result.push({ beforeIndex: a0 + --cx, afterIndex: b0 + --cy });
          return result.reverse();
        }
      }
      trace.push(next); frontier = next;
    }
    return null;
  };
  if (Math.min(maxDistance, TRACE_DISTANCE) >= 0) {
    const small = greedy(0, before.length, 0, after.length, Math.min(maxDistance, TRACE_DISTANCE, before.length + after.length));
    if (small || maxDistance <= TRACE_DISTANCE) return small;
  }
  // Recursion is on an explicit stack: the halves are processed in order, left first.
  const stack: Array<[number, number, number, number] | SequenceAlignmentPair[]> = [[0, before.length, 0, after.length]];
  while (stack.length) {
    const item = stack.pop()!;
    // A range is four numbers; anything else is pairs ready to emit.
    if (typeof item[0] !== "number") { for (const pair of item as SequenceAlignmentPair[]) pairs.push(pair); continue; }
    let [a0, a1, b0, b1] = item as [number, number, number, number];
    const head: SequenceAlignmentPair[] = [], tail: SequenceAlignmentPair[] = [];
    while (a0 < a1 && b0 < b1 && equals(before[a0], after[b0])) head.push({ beforeIndex: a0++, afterIndex: b0++ });
    while (a0 < a1 && b0 < b1 && equals(before[a1 - 1], after[b1 - 1])) tail.push({ beforeIndex: --a1, afterIndex: --b1 });
    tail.reverse();
    if (a0 === a1 || b0 === b1) {
      for (const pair of head) pairs.push(pair);
      for (let x = a0; x < a1; x++) pairs.push({ beforeIndex: x, afterIndex: null });
      for (let y = b0; y < b1; y++) pairs.push({ beforeIndex: null, afterIndex: y });
      for (const pair of tail) pairs.push(pair);
      continue;
    }
    const snake = middle(a0, a1, b0, b1);
    if (!snake) return null;
    const [x, y, u, v] = snake;
    const snakePairs: SequenceAlignmentPair[] = [];
    for (let i = 0; i < u - x; i++) snakePairs.push({ beforeIndex: x + i, afterIndex: y + i });
    // Pushed in reverse: head, left half, snake, right half, tail.
    stack.push(tail, [u, a1, v, b1], snakePairs, [a0, x, b0, y], head);
  }
  return pairs;
}
