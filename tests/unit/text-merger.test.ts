import assert from "node:assert/strict";
import test from "node:test";

import { mergeTextItems, moveTextItem, type TextMergeItem } from "../../src/features/text-merger/textMerger.ts";

const items: TextMergeItem[] = [
  { id: "direct", source: "direct", name: "Pasted text", content: "  alpha  " },
  { id: "empty", source: "direct", name: "Empty", content: "  \n " },
  { id: "file", source: "file", name: "notes.txt", content: "beta\nline", originalContent: "beta\nline" },
];

test("text merger preserves content while excluding empty items", () => {
  assert.equal(mergeTextItems(items, { separator: "\n", trimItems: false, excludeEmpty: true }), "  alpha  \nbeta\nline");
});

test("text merger trims item edges and applies a custom separator", () => {
  assert.equal(mergeTextItems(items, { separator: " / ", trimItems: true, excludeEmpty: true }), "alpha / beta\nline");
});

test("empty items can remain in the separator sequence", () => {
  assert.equal(mergeTextItems(items, { separator: "|", trimItems: true, excludeEmpty: false }), "alpha||beta\nline");
});

test("direct text and TXT items move through one immutable list", () => {
  const moved = moveTextItem(items, 2, 1);
  assert.deepEqual(moved.map((item) => item.id), ["direct", "file", "empty"]);
  assert.deepEqual(items.map((item) => item.id), ["direct", "empty", "file"]);
  assert.equal(moveTextItem(items, -1, 1), items);
});
