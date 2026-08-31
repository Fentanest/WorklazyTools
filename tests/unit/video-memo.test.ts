import assert from "node:assert/strict";
import test from "node:test";

import { areVideoGroupRenderInputsEqual, areVideoTrimRenderInputsEqual } from "../../src/features/video-studio/videoMemo.ts";

test("video group memoization only ignores active changes outside its own group", () => {
  const first = { id: "first" };
  const base = { group: 1, settings: {}, language: "ko", players: {}, items: [first], availableGroups: [1, 2], activeId: "outside-a" };
  assert.equal(areVideoGroupRenderInputsEqual(base, { ...base, activeId: "outside-b" }), true);
  assert.equal(areVideoGroupRenderInputsEqual(base, { ...base, activeId: "first" }), false);
  assert.equal(areVideoGroupRenderInputsEqual({ ...base, activeId: "first" }, { ...base, activeId: "first" }), true);
});

test("video group memoization invalidates available group changes", () => {
  const base = { group: 1, settings: {}, language: "ko", players: {}, items: [{ id: "first" }], availableGroups: [1], activeId: "first" };
  assert.equal(areVideoGroupRenderInputsEqual(base, { ...base, availableGroups: [1, 2] }), false);
});

test("video trim memoization invalidates synchronization behavior changes", () => {
  const base = { item: {}, index: 0, active: true, groupSize: 2, synchronizationKey: "one", language: "ko" };
  assert.equal(areVideoTrimRenderInputsEqual(base, { ...base }), true);
  assert.equal(areVideoTrimRenderInputsEqual(base, { ...base, synchronizationKey: "two" }), false);
});

test("memo contracts deliberately ignore callback identity changes", () => {
  const groupBase = { group: 1, settings: {}, language: "ko", players: {}, items: [{ id: "first" }], availableGroups: [1], activeId: "outside", onActivate: () => 1 };
  assert.equal(areVideoGroupRenderInputsEqual(groupBase, { ...groupBase, onActivate: () => 2 }), true);
  const trimBase = { item: {}, index: 0, active: true, groupSize: 2, synchronizationKey: "stable", language: "ko", onStart: () => 1 };
  assert.equal(areVideoTrimRenderInputsEqual(trimBase, { ...trimBase, onStart: () => 2 }), true);
});
