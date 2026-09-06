import assert from "node:assert/strict";
import test from "node:test";
import { availableToolRoutes, assertToolRoutes, expectedToolIds } from "../tool-registry-routes.mjs";

test("current registry matches the independent expected list", () => {
  assert.equal(assertToolRoutes(availableToolRoutes).count, expectedToolIds.length);
});
test("a missing tool fails", () => {
  assert.throws(() => assertToolRoutes(availableToolRoutes.slice(1)), /missing/);
});
test("a duplicate ID fails even with the original count", () => {
  const routes = [...availableToolRoutes]; routes[1] = routes[0];
  assert.throws(() => assertToolRoutes(routes), /duplicates/);
});
