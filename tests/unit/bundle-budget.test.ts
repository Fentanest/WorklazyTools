import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  assertMeasuredDeploymentExecutionAssets, budgetLimits, compareWithBaseline, isDeploymentExecutionAsset,
  isJavaScriptExecutionPath, measureOutput, resolveBudgetLimits, selectAffectedRoutes,
} from "../../scripts/measure-bundle-budget.mjs";
import {
  BUNDLE_MEASUREMENT_SCHEMA_VERSION,
  MODULE_ATTRIBUTION_SCHEMA,
  allocateChunkGzip,
  buildModuleContributions,
  canonicalModuleId,
  compareContributionRows,
  moduleInventoryEntry,
} from "../../scripts/bundle-module-attribution.mjs";

const quiet = () => {};
const budget = resolveBudgetLimits({});
const renderedSha256 = "a".repeat(64);

test("default budget changes only the PDF route allowance to 72,000 bytes", () => {
  assert.deepEqual(budgetLimits, {
    entryJsGzip: 20 * 1024,
    affectedRouteJsGzip: 72_000,
    sharedJsGzip: 30 * 1024,
    appJsGzip: 80 * 1024,
    cssGzip: 10 * 1024,
  });
  assert.deepEqual(budget, { limits: budgetLimits, overrides: {}, multiplier: 1 });
});

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
    moduleInventory: [moduleInventoryEntry(base.file.paths[0])],
  };
}

function addContribution(target: ReturnType<typeof report>, hash: string, bytes: number, category: string, routeOwners: string[]) {
  const added = contributionFile(hash, bytes, category, routeOwners, `main:<root>/${hash}.ts`);
  target.files.push(added.file);
  target.modules.push(added.modules);
  target.moduleInventory.push(moduleInventoryEntry(added.file.paths[0]));
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
  baseline.moduleInventory = [moduleInventoryEntry(before.file.paths[0])];
  current.moduleInventory = [moduleInventoryEntry(after.file.paths[0])];
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
  const missingInventory = report(); delete missingInventory.moduleInventory;
  assert.throws(() => compareWithBaseline(report(), missingInventory, budget, quiet), /unsupported bundle measurement schema/);
});

test("the current schema rejects empty or partial main metadata on both comparison sides", () => {
  for (const side of ["baseline", "current"] as const) {
    for (const mutation of [
      (target: ReturnType<typeof report>) => { target.modules = []; },
      (target: ReturnType<typeof report>) => { target.modules = target.modules.slice(1); },
    ]) {
      const current = report(); const baseline = report();
      mutation(side === "current" ? current : baseline);
      assert.throws(() => compareWithBaseline(current, baseline, budget, quiet), /missing main chunk metadata/);
    }
  }
});

test("only explicitly inventoried worker and public JavaScript use opaque attribution", () => {
  const measured = report();
  for (const [file, hash, bytes] of [
    ["tools/video-studio/workers/video.worker-example.js", "worker", 7],
    ["assets/pdf.worker-example.js", "asset-worker", 5],
    ["assets/worker-example.js", "generic-worker", 3],
    ["assets/pdf.worker.min-example.mjs", "module-worker", 13],
    ["assets/pdf-example.mjs", "module-public", 17],
    ["service-worker.js", "public", 11],
  ] as const) {
    measured.files.push({ hash, type: "js", category: "shared", gzipBytes: bytes, bytes, paths: [file], routeOwners: [] });
    measured.moduleInventory.push(moduleInventoryEntry(file));
    measured.metrics.appJsGzip += bytes;
  }
  const contributions = buildModuleContributions(measured);
  assert.ok(contributions.some(({ id, bytes }) => id === "opaque:worker:sha256:worker" && bytes === 7));
  assert.ok(contributions.some(({ id, bytes }) => id === "opaque:worker:sha256:asset-worker" && bytes === 5));
  assert.ok(contributions.some(({ id, bytes }) => id === "opaque:worker:sha256:generic-worker" && bytes === 3));
  assert.ok(contributions.some(({ id, bytes }) => id === "opaque:worker:sha256:module-worker" && bytes === 13));
  assert.ok(contributions.some(({ id, bytes }) => id === "opaque:public:sha256:module-public" && bytes === 17));
  assert.ok(contributions.some(({ id, bytes }) => id === "opaque:worker:sha256:public" && bytes === 11));
  const invalid = structuredClone(measured);
  invalid.files.push({ hash: "lost", type: "js", category: "shared", gzipBytes: 1, bytes: 1, paths: ["assets/lost.js"], routeOwners: [] });
  invalid.moduleInventory.push(moduleInventoryEntry("assets/lost.js"));
  invalid.metrics.appJsGzip += 1;
  assert.throws(() => buildModuleContributions(invalid), /missing main chunk metadata/);
});

test("deployment execution inventory includes js and mjs outside pinned vendor and runtime trees", () => {
  for (const file of ["assets/main.js", "assets/pdf.mjs", "nested/service-worker.js", "module.mjs"]) {
    assert.equal(isDeploymentExecutionAsset(file), true, file);
  }
  for (const file of ["vendor/tool.js", "vendor/tool.mjs", "tools/video/runtime/core.js", "runtime/core.mjs", "assets/style.css"]) {
    assert.equal(isDeploymentExecutionAsset(file), false, file);
  }
  for (const file of ["vendor/tool.js", "tools/video/runtime/core.mjs", "assets/main.js"]) {
    assert.equal(isJavaScriptExecutionPath(file), true, `raw network census must retain ${file}`);
  }
  assert.equal(isJavaScriptExecutionPath("assets/style.css"), false);
});

test("largest-remainder allocation is integer, deterministic, and conserves the chunk gzip size", () => {
  assert.deepEqual(allocateChunkGzip(5, [{ id: "b", weight: 1 }, { id: "a", weight: 1 }]), [
    { id: "a", bytes: 3 }, { id: "b", bytes: 2 },
  ]);
  assert.deepEqual(allocateChunkGzip(7, [{ id: "a", weight: 2 }, { id: "b", weight: 1 }]), [
    { id: "a", bytes: 5 }, { id: "b", bytes: 2 },
  ]);
  assert.deepEqual(allocateChunkGzip(1, [{ id: "a.ts", weight: 1 }, { id: "Z.ts", weight: 1 }]), [
    { id: "Z.ts", bytes: 1 }, { id: "a.ts", bytes: 0 },
  ]);
  assert.deepEqual(allocateChunkGzip(1, [{ id: "ä.ts", weight: 1 }, { id: "z.ts", weight: 1 }]), [
    { id: "z.ts", bytes: 1 }, { id: "ä.ts", bytes: 0 },
  ]);
});

test("largest-remainder tie order is identical in en-US and sv-SE processes", () => {
  const moduleUrl = pathToFileURL(path.join(import.meta.dirname, "../../scripts/bundle-module-attribution.mjs")).href;
  const expression = `import { allocateChunkGzip } from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify({ ascii: allocateChunkGzip(1, [{ id: "a.ts", weight: 1 }, { id: "Z.ts", weight: 1 }]), nonAscii: allocateChunkGzip(1, [{ id: "ä.ts", weight: 1 }, { id: "z.ts", weight: 1 }]) }));`;
  const results = ["en_US.UTF-8", "sv_SE.UTF-8"].map((locale) => {
    const child = spawnSync(process.execPath, ["--input-type=module", "--eval", expression], {
      encoding: "utf8",
      env: { ...process.env, LANG: locale, LC_ALL: locale },
    });
    assert.equal(child.status, 0, child.stderr);
    return JSON.parse(child.stdout);
  });
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(results[0].ascii, [{ id: "Z.ts", bytes: 1 }, { id: "a.ts", bytes: 0 }]);
  assert.deepEqual(results[0].nonAscii, [{ id: "z.ts", bytes: 1 }, { id: "ä.ts", bytes: 0 }]);
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
      const dependency = id === routes[0] ? "const worker = '/assets/thumbnail.worker.js';" : "";
      writeFileSync(path.join(root, `output/${id}.js`), `console.log('${id}');${dependency}`);
      moduleChunks.push({ file: `${id}.js`, modules: [{
        id: path.join(root, `src/features/${id}/Page.tsx`), renderedLength: 5, renderedGzip: 5, renderedSha256, codeAvailable: true,
      }] });
    }
    mkdirSync(path.join(root, "output/assets"), { recursive: true });
    writeFileSync(path.join(root, "output/assets/thumbnail.worker.js"), "import('/assets/pdf.mjs')");
    writeFileSync(path.join(root, "output/assets/pdf.mjs"), "export const display = true;");
    writeFileSync(path.join(root, "output/assets/pdf-copy.mjs"), "export const display = true;");
    mkdirSync(path.join(root, "output/ko/generated"), { recursive: true });
    mkdirSync(path.join(root, "output/en/generated"), { recursive: true });
    writeFileSync(path.join(root, "output/ko/generated/static.js"), "self.generated = true;");
    writeFileSync(path.join(root, "output/en/generated/static.js"), "self.generated = true;");
    writeFileSync(path.join(root, "output/assets/not-executable.txt"), "ignored");
    writeFileSync(path.join(root, "output/.vite/manifest.json"), JSON.stringify(manifest));
    const options = { sourceRoot: root, directory: path.join(root, "output"), routes: [routes[0]], moduleChunks };
    const current = measureOutput(options);
    assert.deepEqual(current.affectedRoutes, [routes[0]]);
    assert.ok(current.metrics.affectedRouteJsGzip > 0);
    const worker = current.files.find(({ paths }) => paths.includes("assets/thumbnail.worker.js"));
    const display = current.files.find(({ paths }) => paths.includes("assets/pdf.mjs"));
    assert.deepEqual(worker.routeOwners, [routes[0]], "worker URL dependencies must inherit their route owner");
    assert.deepEqual(display.routeOwners, [routes[0]], "mjs URL imports must inherit ownership through the worker");
    assert.deepEqual(display.paths.sort(), ["assets/pdf-copy.mjs", "assets/pdf.mjs"], "identical deployment assets must be SHA-deduplicated");
    const localizedGenerated = current.files.find(({ paths }) => paths.includes("ko/generated/static.js"));
    assert.deepEqual(localizedGenerated.paths.sort(), ["en/generated/static.js", "ko/generated/static.js"], "locale copies stay inventoried while identical bytes are charged once");
    assert.ok(current.moduleInventory.some(({ file, attribution }) => file === "assets/pdf.mjs" && attribution === "opaque"));
    assert.equal(current.files.some(({ paths }) => paths.includes("assets/not-executable.txt")), false);
    assert.doesNotThrow(() => assertMeasuredDeploymentExecutionAssets(current, path.join(root, "output")));
    writeFileSync(path.join(root, "output/ko/generated/late-static.mjs"), "export const late = true;");
    assert.throws(
      () => assertMeasuredDeploymentExecutionAssets(current, path.join(root, "output")),
      /late-static\.mjs/,
      "a JS/MJS file created after measurement must fail the deployment inventory guard",
    );
    assert.throws(() => measureOutput({ ...options, routes: ["typo"] }), /unknown or non-lazy/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
