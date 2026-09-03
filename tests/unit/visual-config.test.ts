import assert from "node:assert/strict";
import test from "node:test";

import { availableToolRoutes } from "../tool-registry-routes.mjs";
import { visualRegressionConfig } from "../visual-regression.config.mjs";

test("visual regression derives every available tool and four representative axis combinations", () => {
  assert.equal(availableToolRoutes.length, 20);
  assert.equal(new Set(availableToolRoutes.map(({ toolId }) => toolId)).size, 20);

  const toolRoutes = visualRegressionConfig.routes.filter(({ kind }) => kind === "tool");
  assert.equal(toolRoutes.length, 20);
  assert.ok(toolRoutes.every(({ profiles }) => profiles.length === 4));
  for (const route of toolRoutes) {
    assert.deepEqual(new Set(route.profiles.map(({ locale }) => locale)), new Set(["ko", "en"]));
    assert.deepEqual(new Set(route.profiles.map(({ theme }) => theme)), new Set(["light", "dark"]));
    assert.deepEqual(new Set(route.profiles.map(({ viewport }) => viewport)), new Set(["desktop", "mobile"]));
  }

  const totalCaptures = visualRegressionConfig.routes.reduce((sum, route) => sum + route.profiles.length, 0);
  assert.equal(totalCaptures, 96);
});
