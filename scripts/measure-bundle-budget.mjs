import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const scriptRepositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = process.env.BUNDLE_SOURCE_ROOT
  ? path.resolve(process.env.BUNDLE_SOURCE_ROOT)
  : scriptRepositoryRoot;
const outputDirectory = path.join(repositoryRoot, "dist-measure");
const manifestPath = path.join(outputDirectory, ".vite", "manifest.json");
const selectedRoutes = parseCsv(process.env.BUNDLE_ROUTES);
const baselinePath = process.env.BUNDLE_BASELINE ? path.resolve(process.env.BUNDLE_BASELINE) : null;
const reportPath = process.env.BUNDLE_MEASURE_OUTPUT ? path.resolve(process.env.BUNDLE_MEASURE_OUTPUT) : null;
const budgetMultiplier = Number.parseInt(process.env.BUNDLE_BUDGET_MULTIPLIER || "1", 10);
const budgetLimits = Object.freeze({
  entryJsGzip: 20 * 1024,
  affectedRouteJsGzip: 60 * 1024,
  sharedJsGzip: 30 * 1024,
  appJsGzip: 80 * 1024,
  cssGzip: 10 * 1024,
});

try {
  if (!Number.isInteger(budgetMultiplier) || budgetMultiplier < 1) {
    throw new Error(`BUNDLE_BUDGET_MULTIPLIER must be a positive integer, received ${process.env.BUNDLE_BUDGET_MULTIPLIER}.`);
  }
  fs.rmSync(outputDirectory, { recursive: true, force: true });
  execFileSync(process.execPath, [
    path.join(repositoryRoot, "node_modules", "vite", "bin", "vite.js"),
    "build",
    "--manifest",
    "--outDir",
    "dist-measure",
  ], { cwd: repositoryRoot, stdio: "inherit", env: process.env });

  const report = measureOutput();
  if (reportPath) fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  printReport(report);
  if (baselinePath) compareWithBaseline(report, JSON.parse(fs.readFileSync(baselinePath, "utf8")));
} finally {
  fs.rmSync(outputDirectory, { recursive: true, force: true });
}

function measureOutput() {
  const viteManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const allFiles = walkFiles(outputDirectory);
  const includedFiles = allFiles.filter((filePath) => {
    const relativePath = posixRelative(filePath);
    if (relativePath.startsWith("vendor/") || relativePath.includes("/runtime/")) return false;
    if (relativePath.endsWith(".css")) return relativePath.startsWith("assets/") || relativePath.includes("/") || !relativePath.includes("/");
    if (!relativePath.endsWith(".js")) return false;
    return relativePath.startsWith("assets/")
      || !relativePath.includes("/")
      || relativePath.startsWith("tools/video-studio/workers/");
  });

  const recordsByHash = new Map();
  const hashByOutputFile = new Map();
  for (const filePath of includedFiles) {
    const bytes = fs.readFileSync(filePath);
    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    const relativePath = posixRelative(filePath);
    hashByOutputFile.set(relativePath, hash);
    const existing = recordsByHash.get(hash);
    if (existing) {
      existing.paths.push(relativePath);
      continue;
    }
    recordsByHash.set(hash, {
      hash,
      paths: [relativePath],
      bytes: bytes.length,
      gzipBytes: gzipSync(bytes).length,
      type: relativePath.endsWith(".css") ? "css" : "js",
      routeOwners: new Set(),
    });
  }

  const entryManifest = viteManifest["index.html"];
  if (!entryManifest?.file) throw new Error("Vite manifest does not contain the index.html entry chunk.");
  const entryHashes = new Set([hashByOutputFile.get(entryManifest.file)].filter(Boolean));
  const routeSources = deriveLazyRouteSources();
  const manifestBySource = new Map(Object.entries(viteManifest));
  const outputBySource = new Map(Object.entries(viteManifest).map(([source, item]) => [source, item.file]));
  const sourceByOutput = new Map(Object.entries(viteManifest).map(([source, item]) => [item.file, source]));
  const routeSourceEntries = new Map();

  for (const [routeId, sources] of routeSources) {
    const sourceEntries = sources.map((source) => {
      if (manifestBySource.has(source)) return source;
      const moduleName = path.basename(source, path.extname(source));
      const namedEntries = [...manifestBySource].filter(([, item]) => item.name === moduleName);
      if (namedEntries.length !== 1) {
        throw new Error(`Vite manifest is missing an unambiguous lazy route source ${source} for ${routeId} (named matches: ${namedEntries.length}).`);
      }
      return namedEntries[0][0];
    });
    routeSourceEntries.set(routeId, sourceEntries);
    const reachableSources = new Set(sourceEntries.flatMap((source) => [...walkManifestGraph(source, manifestBySource, sourceByOutput)]));
    for (const source of reachableSources) {
      const outputFile = outputBySource.get(source);
      const hash = outputFile && hashByOutputFile.get(outputFile);
      if (hash && recordsByHash.get(hash)?.type === "js") recordsByHash.get(hash).routeOwners.add(routeId);
    }
  }

  const classificationNotes = [];
  for (const record of recordsByHash.values()) {
    if (record.type !== "js" || record.routeOwners.size || entryHashes.has(record.hash)) continue;
    const videoWorker = record.paths.find((filePath) => filePath.startsWith("tools/video-studio/workers/"));
    if (videoWorker) {
      record.routeOwners.add("video-studio");
      classificationNotes.push(`${videoWorker} is assigned to video-studio by its tool-owned worker path.`);
    } else {
      classificationNotes.push(`${record.paths[0]} has no route-owned output path or manifest reachability and is classified as shared.`);
    }
  }

  const availableRoutes = [...routeSourceEntries.keys()].sort();
  const affectedRoutes = selectedRoutes.length ? selectedRoutes : availableRoutes;
  const unknownRoutes = affectedRoutes.filter((routeId) => !routeSourceEntries.has(routeId));
  if (unknownRoutes.length) throw new Error(`BUNDLE_ROUTES contains unknown or non-lazy routes: ${unknownRoutes.join(", ")}.`);

  const uniqueRecords = [...recordsByHash.values()];
  const jsRecords = uniqueRecords.filter(({ type }) => type === "js");
  const cssRecords = uniqueRecords.filter(({ type }) => type === "css");
  const entryRecords = jsRecords.filter(({ hash }) => entryHashes.has(hash));
  const sharedRecords = jsRecords.filter((record) => !entryHashes.has(record.hash) && record.routeOwners.size !== 1);
  const affectedRouteRecords = jsRecords.filter((record) => (
    record.routeOwners.size === 1 && affectedRoutes.includes([...record.routeOwners][0])
  ));
  const perRoute = Object.fromEntries(affectedRoutes.map((routeId) => [routeId, sumGzip(jsRecords.filter((record) => (
    record.routeOwners.size === 1 && record.routeOwners.has(routeId)
  ))) ]));

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    buildCommand: "vite build --manifest --outDir dist-measure",
    includeRules: ["assets/**/*.js", "*.js", "tools/video-studio/workers/**/*.js", "assets/**/*.css", "**/*.css"],
    excludeRules: ["vendor/**", "**/runtime/**", "duplicate SHA-256 content after the first copy"],
    affectedRoutes,
    availableLazyRoutes: availableRoutes,
    metrics: {
      entryJsGzip: sumGzip(entryRecords),
      affectedRouteJsGzip: sumGzip(affectedRouteRecords),
      sharedJsGzip: sumGzip(sharedRecords),
      appJsGzip: sumGzip(jsRecords),
      cssGzip: sumGzip(cssRecords),
    },
    perRouteJsGzip: perRoute,
    uniqueFiles: { js: jsRecords.length, css: cssRecords.length },
    deduplicatedCopies: includedFiles.length - uniqueRecords.length,
    classificationNotes,
  };
}

function deriveLazyRouteSources() {
  const appSource = fs.readFileSync(path.join(repositoryRoot, "src", "app", "App.tsx"), "utf8");
  const routeSources = new Map();
  for (const match of appSource.matchAll(/lazy\(\(\) => import\("\.\.\/features\/([^/]+)\/([^".]+)"\)/g)) {
    const [, featureDirectory, moduleName] = match;
    const routeId = featureDirectory === "document-compare" ? "document-compare" : featureDirectory;
    const source = `src/features/${featureDirectory}/${moduleName}.tsx`;
    if (!routeSources.has(routeId)) routeSources.set(routeId, []);
    routeSources.get(routeId).push(source);
  }
  if (routeSources.size < 18) throw new Error(`Expected at least 18 lazy route groups, derived ${routeSources.size}.`);
  return routeSources;
}

function walkManifestGraph(rootSource, manifestBySource, sourceByOutput) {
  const visited = new Set();
  const pending = [rootSource];
  while (pending.length) {
    const source = pending.pop();
    if (visited.has(source)) continue;
    visited.add(source);
    const item = manifestBySource.get(source);
    if (!item) continue;
    for (const outputFile of [...(item.imports ?? []), ...(item.dynamicImports ?? [])]) {
      const importedSource = manifestBySource.has(outputFile) ? outputFile : sourceByOutput.get(outputFile);
      // Vite can record index.html as an import when a lazy chunk reuses symbols
      // emitted in the entry chunk. Walking back through that entry would then
      // reach every sibling lazy route and falsely classify all route chunks as
      // shared. The entry has its own budget and is a terminal graph boundary.
      if (importedSource === "index.html") continue;
      if (importedSource && !visited.has(importedSource)) pending.push(importedSource);
    }
  }
  return visited;
}

function compareWithBaseline(current, baseline) {
  const deltas = Object.fromEntries(Object.keys(budgetLimits).map((metric) => [
    metric,
    current.metrics[metric] - baseline.metrics[metric],
  ]));
  const failures = Object.entries(deltas).filter(([metric, delta]) => delta > budgetLimits[metric] * budgetMultiplier);
  console.log(`Bundle budget deltas against baseline (limit multiplier ${budgetMultiplier}):`);
  for (const [metric, delta] of Object.entries(deltas)) {
    console.log(`  ${metric}: ${formatBytes(delta)} (limit +${formatBytes(budgetLimits[metric] * budgetMultiplier)})`);
  }
  if (failures.length) {
    throw new Error(`Bundle budget exceeded: ${failures.map(([metric, delta]) => `${metric} ${formatBytes(delta)} > +${formatBytes(budgetLimits[metric] * budgetMultiplier)}`).join("; ")}.`);
  }
  console.log("Bundle budget passed: all five deltas are within their fixed limits.");
}

function printReport(report) {
  console.log("Bundle measurement (gzip bytes, duplicate hashes counted once):");
  console.log(`  source root: ${repositoryRoot}`);
  for (const [metric, value] of Object.entries(report.metrics)) console.log(`  ${metric}: ${value} (${formatBytes(value)})`);
  console.log(`  affected routes: ${report.affectedRoutes.join(", ")}`);
  console.log(`  unique files: ${report.uniqueFiles.js} JS / ${report.uniqueFiles.css} CSS; deduplicated copies: ${report.deduplicatedCopies}`);
  if (reportPath) console.log(`  report: ${reportPath}`);
}

function walkFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(filePath) : [filePath];
  });
}

function posixRelative(filePath) {
  return path.relative(outputDirectory, filePath).split(path.sep).join("/");
}

function sumGzip(records) {
  return records.reduce((sum, record) => sum + record.gzipBytes, 0);
}

function parseCsv(value) {
  return value ? [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))] : [];
}

function formatBytes(bytes) {
  const sign = bytes < 0 ? "-" : "";
  return `${sign}${(Math.abs(bytes) / 1024).toFixed(2)} KiB`;
}
