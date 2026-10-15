import assert from "node:assert/strict";
import test from "node:test";
import { groupPdfPagesBySource, movePdfItemsById, pdfPageIndexesById, compactPdfPageRange } from "../../src/features/pdf-editor/pdfShared.ts";

const pages = [1, 2, 3, 4, 5, 6].map(id => ({ id: String(id), sourceId: id < 4 ? "a" : "b", rotation: id === 2 ? 90 : 0 }));
const ids = (items: readonly { id: string }[]) => items.map(item => item.id);

test("single and Shift-selected blocks move by ID and retain screen order, references and selection", () => {
  assert.deepEqual(ids(movePdfItemsById(pages, new Set(["2"]))), ["1", "3", "4", "5", "6", "2"]);
  const selected = new Set(["4", "2", "3"]);
  const moved = movePdfItemsById(pages, selected);
  assert.deepEqual(ids(moved), ["1", "5", "6", "2", "3", "4"]);
  assert.equal(moved[3], pages[1]);
  assert.equal(moved[3].rotation, 90);
  assert.deepEqual([...selected], ["4", "2", "3"]);
  assert.deepEqual(ids(movePdfItemsById(moved, selected, "1")), ["2", "3", "4", "1", "5", "6"]);
});

test("source grouping preserves first appearance and edited page order including same-name sources", () => {
  const input = [pages[0], pages[3], pages[2], pages[4], pages[1]].map(page => ({ ...page, sourceName: "same.pdf" }));
  const grouped = groupPdfPagesBySource(input);
  assert.deepEqual(grouped.map(group => ids(group.pages)), [["1", "3", "2"], ["4", "5"]]);
  const moved = movePdfItemsById(grouped, new Set(["a"])).flatMap(group => group.pages);
  assert.deepEqual(ids(moved), ["4", "5", "1", "3", "2"]);
  assert.equal(moved[4], input[4]);
  assert.ok(!moved.some(page => page.id === "6"), "deleted pages are never rebuilt");
});

test("actual range pages survive reorder and deletion while displayed positions follow current order", () => {
  const rangeIds = ["2", "4", "6"];
  const moved = movePdfItemsById(pages, new Set(["2", "3", "4"]));
  const indexes = pdfPageIndexesById(moved, rangeIds);
  assert.deepEqual(indexes.map(index => moved[index].id), ["6", "2", "4"]);
  assert.equal(compactPdfPageRange(indexes), "3-4, 6");
  const remaining = moved.filter(page => page.id !== "2");
  assert.deepEqual(pdfPageIndexesById(remaining, rangeIds).map(index => remaining[index].id), ["6", "4"]);
});
