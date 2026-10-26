import assert from "node:assert/strict";
import test from "node:test";

import { myersAlign } from "../../src/utils/myersDiff.ts";

function lcs(a: number[], b: number[]) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  return dp[0][0];
}

test("Myers alignment is a valid, optimal, in-order script and honours the distance limit", () => {
  let seed = 11;
  const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let round = 0; round < 3000; round++) {
    const k = 1 + Math.floor(random() * 3);
    const a = Array.from({ length: Math.floor(random() * 10) }, () => Math.floor(random() * k));
    const b = Array.from({ length: Math.floor(random() * 10) }, () => Math.floor(random() * k));
    const common = lcs(a, b), distance = a.length + b.length - 2 * common;
    for (const limit of [a.length + b.length, 2]) {
      const pairs = myersAlign(a, b, (x, y) => x === y, limit);
      if (distance > limit) { assert.equal(pairs, null); continue; }
      assert.ok(pairs);
      let before = 0, after = 0, equal = 0;
      for (const pair of pairs) {
        if (pair.beforeIndex !== null) assert.equal(pair.beforeIndex, before++);
        if (pair.afterIndex !== null) assert.equal(pair.afterIndex, after++);
        if (pair.beforeIndex !== null && pair.afterIndex !== null) { assert.equal(a[pair.beforeIndex], b[pair.afterIndex]); equal++; }
      }
      assert.deepEqual([before, after, equal], [a.length, b.length, common]);
    }
  }
  // Past the traced distance the linear-space search still finds the optimum.
  const big = Array.from({ length: 6000 }, (_, i) => i), other = big.map(i => i % 2 ? i : -i - 1);
  assert.equal(myersAlign(big, other, (x, y) => x === y, 1_000_000)!.filter(pair => pair.beforeIndex !== null && pair.afterIndex !== null).length, 3000);
});
