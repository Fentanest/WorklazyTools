import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  budgetLimits, compareWithBaseline, measureOutput, resolveBudgetLimits, selectAffectedRoutes,
} from "../../scripts/measure-bundle-budget.mjs";
import {
  BUNDLE_MEASUREMENT_SCHEMA_VERSION,
  MODULE_ATTRIBUTION_SCHEMA,
  allocateChunkGzip,
  canonicalModuleId,
  compareContributionRows,
} from "../../scripts/bundle-module-attribution.mjs";

const quiet = () => {};
const budget = resolveBudgetLimits({});
const renderedSha256 = "a".repeat(64);

function contributionFile(hash: string, gzipBytes: number, category: string, routeOwners: string[], id: string) {
  const file = `assets/${hash}.js`;
  return {
    file: { hash, type: "js", category, gzipBytes, bytes: gzipBytes, paths: [file], routeOwners },
    modules: { file, realm: "main", modules: [{ id, renderedLength: 1, renderedGzip: 1, renderedSha256 }] },
  };
}

function report() {
  const base = contributionFile("base", 100, "shared", [], "main:<root>/base.ts");
  return {
    schemaVersion: BUNDLE_MEASUREMENT_SCHEMA_VERSION,
    moduleAttributionSchema: MODULE_ATTRIBUTION_SCHEMA,
    metrics: Object.fromEntries(Object.keys(budgetLimits).map((key) => [key, 100])),
    affectedRoutes: ["old"],
    availableLazyRoutes: ["old", "unselected"],
    perRouteJsGzip: { old: 100, unselected: 0 },
    files: [base.file],
    modules: [base.modules],
  };
}

function addContribution(target: ReturnType<typeof report>, hash: string, bytes: number, category: string, routeOwners: string[]) {
  const added = contributionFile(hash, bytes, category, routeOwners, `main:<root>/${hash}.ts`);
  target.files.push(added.file);
  target.modules.push(added.modules);
  target.metrics.appJsGzip += bytes;
}

function currentAtDelta(metric: string, delta: number) {
  const current = report();
  if (metric === "entryJsGzip") {
    current.metrics.entryJsGzip += delta;
    addContribution(current, "entry-growth", delta, "entry", []);
  } else if (metric === "affectedRouteJsGzip") {
    current.metrics.affectedRouteJsGzip += delta;
    current.perRouteJsGzip.old += delta;
    addContribution(current, "route-growth", delta, "route", ["old"]);
  } else if (metric === "sharedJsGzip") {
    current.metrics.sharedJsGzip += delta;
    current.metrics.appJsGzip += delta;
    current.files[0].gzipBytes += delta;
  } else if (metric === "appJsGzip") {
    addContribution(current, "app-growth", delta, "route", ["unselected"]);
  } else if (metric === "cssGzip") {
    current.metrics.cssGzip += delta;
  }
  return current;
}

for (const [metric, limit] of Object.entries(budgetLimits) as [string, number][]) {
  test(`bundle ${metric}: limit passes; +1 byte fails`, () => {
    assert.doesNotThrow(() => compareWithBaseline(currentAtDelta(metric, limit), report(), budget, quiet));
    assert.throws(() => compareWithBaseline(currentAtDelta(metric, limit + 1), report(), budget, quiet), new RegExp(metric));
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
    const current = currentAtDelta(metric, 7);
    const logs: string[] = [];
    assert.doesNotThrow(() => compareWithBaseline(current, report(), overridden, (line: string) => logs.push(line)));
    assert.ok(logs.some((line) => line.includes(key)));
    assert.throws(() => compareWithBaseline(currentAtDelta(metric, 8), report(), overridden, quiet), /exceeded/);
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

test("same module moving from route to shared is not new application bytes even when its chunk hash changes", () => {
  const baseline = report(); const current = report();
  const before = contributionFile("before-hash", 40, "route", ["old"], "main:<node_modules>/pdf-lib/index.js");
  const after = contributionFile("after-hash", 40, "shared", ["old", "unselected"], "main:<node_modules>/pdf-lib/index.js");
  baseline.files = [before.file]; baseline.modules = [before.modules];
  current.files = [after.file]; current.modules = [after.modules];
  baseline.metrics = { entryJsGzip: 0, affectedRouteJsGzip: 40, sharedJsGzip: 0, appJsGzip: 40, cssGzip: 0 };
  current.metrics = { entryJsGzip: 0, affectedRouteJsGzip: 0, sharedJsGzip: 40, appJsGzip: 40, cssGzip: 0 };
  baseline.perRouteJsGzip.old = 40; current.perRouteJsGzip.old = 0;
  let result = compareWithBaseline(current, baseline, budget, quiet).attribution;
  assert.equal(result.movedRouteToSharedGzip, 40);
  assert.equal(result.netAppJsGrowthGzip, 0);
  assert.equal(result.sharedDeltaExcludingMovementGzip, 0);
  current.files[0].gzipBytes = 49;
  current.metrics.sharedJsGzip = 49; current.metrics.appJsGzip = 49;
  result = compareWithBaseline(current, baseline, budget, quiet).attribution;
  assert.equal(result.movedRouteToSharedGzip, 40);
  assert.equal(result.sharedDeltaExcludingMovementGzip, 9);
  assert.equal(result.netAppJsGrowthGzip, 9);
});

test("old bundle measurement schemas are rejected instead of using SHA fallback", () => {
  const old = { ...report(), schemaVersion: 1 };
  assert.throws(() => compareWithBaseline(report(), old, budget, quiet), /unsupported bundle measurement schema/);
  const missing = report(); delete missing.modules;
  assert.throws(() => compareWithBaseline(report(), missing, budget, quiet), /unsupported bundle measurement schema/);
});

test("largest-remainder allocation is integer, deterministic, and conserves the chunk gzip size", () => {
  assert.deepEqual(allocateChunkGzip(5, [{ id: "b", weight: 1 }, { id: "a", weight: 1 }]), [
    { id: "a", bytes: 3 }, { id: "b", bytes: 2 },
  ]);
  assert.deepEqual(allocateChunkGzip(7, [{ id: "a", weight: 2 }, { id: "b", weight: 1 }]), [
    { id: "a", bytes: 5 }, { id: "b", bytes: 2 },
  ]);
});

test("canonical module ids retain realm, virtual prefix, package path, and query", () => {
  const root = mkdtempSync(path.join(tmpdir(), "bundle-module-id-"));
  try {
    mkdirSync(path.join(root, "node_modules/pkg/sub"), { recursive: true });
    assert.equal(canonicalModuleId(`\0${root}/src/file.ts?raw`, { sourceRoot: root }), "main:\0<root>/src/file.ts?raw");
    assert.equal(canonicalModuleId(`${root}/node_modules/pkg/sub/index.js?commonjs-proxy`, { sourceRoot: root }),
      "main:<node_modules>/pkg/sub/index.js?commonjs-proxy");
    assert.equal(canonicalModuleId(`${root}/node_modules/pkg/index.js`, { sourceRoot: root, realm: "worker:pdf" }),
      "worker:pdf:<node_modules>/pkg/index.js");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("same-category bytes are retained before remaining bytes move", () => {
  const result = compareContributionRows([
    { id: "module", category: "route:old", bytes: 10 },
    { id: "module", category: "shared", bytes: 30 },
  ], [
    { id: "module", category: "route:old", bytes: 30 },
  ]);
  assert.deepEqual(result.movements, [{ id: "module", from: "route:old", to: "shared", bytes: 20 }]);
  assert.equal(result.categoryDeltas.shared.net, 10);
  assert.equal(result.appNet, 10);
});

test("measurement validates selected routes against the actual build graph", () => {
  const root = mkdtempSync(path.join(tmpdir(), "bundle-unit-"));
  try {
    mkdirSync(path.join(root, "src/app"), { recursive: true });
    mkdirSync(path.join(root, "node_modules"), { recursive: true });
    mkdirSync(path.join(root, "output/.vite"), { recursive: true });
    const manifest = { "index.html": { file: "entry.js" } };
    const moduleChunks = [{ file: "entry.js", modules: [{
      id: path.join(root, "src/app/App.tsx"), renderedLength: 5, renderedGzip: 5, renderedSha256, codeAvailable: true,
    }] }];
    const routes = Array.from({ length: 18 }, (_, index) => `route-${index}`);
    writeFileSync(path.join(root, "src/app/App.tsx"), routes.map((id) => `lazy(() => import("../features/${id}/Page"))`).join("\n"));
    writeFileSync(path.join(root, "output/entry.js"), "entry");
    for (const id of routes) {
      manifest[`src/features/${id}/Page.tsx`] = { file: `${id}.js` };
      writeFileSync(path.join(root, `output/${id}.js`), `console.log('${id}');`);
      moduleChunks.push({ file: `${id}.js`, modules: [{
        id: path.join(root, `src/features/${id}/Page.tsx`), renderedLength: 5, renderedGzip: 5, renderedSha256, codeAvailable: true,
      }] });
    }
    writeFileSync(path.join(root, "output/.vite/manifest.json"), JSON.stringify(manifest));
    const options = { sourceRoot: root, directory: path.join(root, "output"), routes: [routes[0]], moduleChunks };
    const current = measureOutput(options);
    assert.deepEqual(current.affectedRoutes, [routes[0]]);
    assert.ok(current.metrics.affectedRouteJsGzip > 0);
    assert.throws(() => measureOutput({ ...options, routes: ["typo"] }), /unknown or non-lazy/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
