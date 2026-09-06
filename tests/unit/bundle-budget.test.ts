import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  budgetLimits, compareWithBaseline, measureOutput, resolveBudgetLimits, selectAffectedRoutes,
} from "../../scripts/measure-bundle-budget.mjs";

const quiet = () => {};
const budget = resolveBudgetLimits({});
function report() {
  return { metrics: Object.fromEntries(Object.keys(budgetLimits).map((key) => [key, 100])),
    affectedRoutes: ["old"], availableLazyRoutes: ["old"], perRouteJsGzip: { old: 100 }, files: [] };
}

for (const [metric, limit] of Object.entries(budgetLimits) as [string, number][]) {
  test(`bundle ${metric}: limit passes; +1 byte fails`, () => {
    const baseline = report(); const current = report();
    current.metrics[metric] += limit;
    assert.doesNotThrow(() => compareWithBaseline(current, baseline, budget, quiet));
    current.metrics[metric] += 1;
    assert.throws(() => compareWithBaseline(current, baseline, budget, quiet), new RegExp(metric));
  });
  test(`bundle ${metric}: both sides reject NaN, missing and non-integer bytes`, () => {
    for (const side of ["current", "baseline"]) for (const invalid of [NaN, Infinity, -1, 0.5, "100", undefined]) {
      const current = report(); const baseline = report();
      const target = side === "current" ? current : baseline;
      if (invalid === undefined) delete target.metrics[metric]; else target.metrics[metric] = invalid;
      assert.throws(() => compareWithBaseline(current, baseline, budget, quiet), new RegExp(`${side}.${metric}`));
    }
  });
  test(`bundle ${metric}: independent override is recorded and enforced`, () => {
    const key = `BUNDLE_LIMIT_${metric.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`;
    const overridden = resolveBudgetLimits({ [key]: "7" });
    assert.deepEqual(overridden.overrides[metric], { environment: key, bytes: 7 });
    for (const other of Object.keys(budgetLimits).filter((key) => key !== metric)) assert.equal(overridden.limits[other], budgetLimits[other]);
    const current = report(); current.metrics[metric] += 7;
    const logs: string[] = [];
    assert.doesNotThrow(() => compareWithBaseline(current, report(), overridden, (line: string) => logs.push(line)));
    assert.ok(logs.some((line) => line.includes(key)));
    current.metrics[metric] += 1;
    assert.throws(() => compareWithBaseline(current, report(), overridden, quiet), /exceeded/);
    for (const invalid of ["NaN", "", "1.5", "-1", "7junk"]) assert.throws(() => resolveBudgetLimits({ [key]: invalid }));
  });
}

test("new current lazy route has baseline zero; typo and eager routes are rejected", () => {
  const current = { ...report(), availableLazyRoutes: ["old", "new"], affectedRoutes: ["new"], perRouteJsGzip: { new: 100 } };
  const comparison = compareWithBaseline(current, report(), budget, quiet);
  assert.deepEqual(comparison.newRoutes, ["new"]);
  assert.equal(comparison.baselineRouteBytes, 0);
  assert.equal(comparison.deltas.affectedRouteJsGzip, 100);
  for (const route of ["typo", "excel-merger"]) assert.throws(() => selectAffectedRoutes(current.availableLazyRoutes, [route]), /unknown or non-lazy/);
  assert.throws(() => compareWithBaseline(report(), { ...report(), perRouteJsGzip: {} }, budget, quiet), /baseline.perRoute/);
});

test("same chunk moving route to shared is separate from new application bytes", () => {
  const baseline = report(); const current = report();
  baseline.files = [{ hash: "same", type: "js", category: "route", gzipBytes: 40, paths: ["a.js"], routeOwners: ["old"] }];
  current.files = [{ ...baseline.files[0], category: "shared", routeOwners: ["old", "new"] }];
  current.metrics.affectedRouteJsGzip -= 40; current.metrics.sharedJsGzip += 40;
  let result = compareWithBaseline(current, baseline, budget, quiet).attribution;
  assert.equal(result.movedRouteToSharedGzip, 40);
  assert.equal(result.netAppJsGrowthGzip, 0);
  assert.equal(result.sharedDeltaExcludingMovementGzip, 0);
  current.metrics.sharedJsGzip += 9; current.metrics.appJsGzip += 9;
  result = compareWithBaseline(current, baseline, budget, quiet).attribution;
  assert.equal(result.movedRouteToSharedGzip, 40);
  assert.equal(result.sharedDeltaExcludingMovementGzip, 9);
  assert.equal(result.netAppJsGrowthGzip, 9);
  current.files[0].hash = "different";
  assert.equal(compareWithBaseline(current, baseline, budget, quiet).attribution.movedRouteToSharedGzip, 0);
});

test("measurement validates selected routes against the actual build graph", () => {
  const root = mkdtempSync(path.join(tmpdir(), "bundle-unit-"));
  try {
    mkdirSync(path.join(root, "src/app"), { recursive: true });
    mkdirSync(path.join(root, "output/.vite"), { recursive: true });
    const manifest = { "index.html": { file: "entry.js" } };
    const routes = Array.from({ length: 18 }, (_, index) => `route-${index}`);
    writeFileSync(path.join(root, "src/app/App.tsx"), routes.map((id) => `lazy(() => import("../features/${id}/Page"))`).join("\n"));
    writeFileSync(path.join(root, "output/entry.js"), "entry");
    for (const id of routes) {
      manifest[`src/features/${id}/Page.tsx`] = { file: `${id}.js` };
      writeFileSync(path.join(root, `output/${id}.js`), `console.log('${id}');`);
    }
    writeFileSync(path.join(root, "output/.vite/manifest.json"), JSON.stringify(manifest));
    const options = { sourceRoot: root, directory: path.join(root, "output"), routes: [routes[0]] };
    const current = measureOutput(options);
    assert.deepEqual(current.affectedRoutes, [routes[0]]);
    assert.ok(current.metrics.affectedRouteJsGzip > 0);
    assert.throws(() => measureOutput({ ...options, routes: ["typo"] }), /unknown or non-lazy/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
