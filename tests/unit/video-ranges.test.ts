import assert from "node:assert/strict";
import test from "node:test";

import type { VideoGroupId, VideoItem } from "../../src/features/video-studio/types.ts";
import { applyGroupRangesByPosition, applyVideoRangeToGroup, clampVideoRange } from "../../src/features/video-studio/videoRanges.ts";

test("video ranges stay valid when copied to shorter targets", () => {
  assert.deepEqual(clampVideoRange(30, 60, 45), { start: 30, end: 45 });
  assert.deepEqual(clampVideoRange(30, 60, 20), { start: 19.95, end: 20 });
  assert.deepEqual(clampVideoRange(0, 1, 0.03), { start: 0, end: 0.03 });
});

test("group ranges copy by card position and report duration and size differences", () => {
  const items = [
    item("source-a", 1, 100, 10, 80),
    item("source-b", 1, 100, 20, 70),
    item("target-2-a", 2, 90),
    item("target-2-b", 2, 50),
    item("target-3-a", 3, 15),
    item("target-3-b", 3, 15, 2, 8),
    item("target-3-extra", 3, 100, 5, 10),
  ];

  const result = applyGroupRangesByPosition(items, 1, [2, 3]);
  assert.deepEqual(result.items.map(({ start, end }) => [start, end]), [
    [10, 80], [20, 70], [10, 80], [20, 50], [10, 15], [2, 8], [5, 10],
  ]);
  assert.deepEqual(result.summary, { appliedGroups: 2, appliedItems: 3, shortenedItems: 2, skippedShortItems: 1, unmatchedSlots: 1 });
  assert.equal(result.items[0], items[0]);
  assert.equal(result.items[6], items[6]);
});

test("applying one video range clamps viable targets and leaves too-short targets unchanged", () => {
  const source = item("source", 1, 100, 25, 75);
  const shorter = item("shorter", 1, 40);
  const tooShort = item("too-short", 1, 20, 2, 8);
  const outside = item("outside", 2, 100, 5, 10);
  const result = applyVideoRangeToGroup([source, shorter, tooShort, outside], source);
  assert.deepEqual(result.map(({ start, end }) => [start, end]), [[25, 75], [25, 40], [2, 8], [5, 10]]);
  assert.equal(result[2], tooShort);
  assert.equal(result[3], outside);
});

function item(id: string, group: VideoGroupId, duration: number, start = 0, end = duration): VideoItem {
  return {
    id,
    file: new File([], `${id}.mp4`, { type: "video/mp4" }),
    url: `blob:${id}`,
    duration,
    width: 1920,
    height: 1080,
    start,
    end,
    group,
  };
}
