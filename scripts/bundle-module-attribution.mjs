import fs from "node:fs";
import path from "node:path";

export const BUNDLE_MEASUREMENT_SCHEMA_VERSION = 3;
export const MODULE_ATTRIBUTION_SCHEMA = "independent-rendered-gzip-largest-remainder-v1-main-opaque-workers";

function assertBytes(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a finite non-negative integer (bytes).`);
  }
  return value;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function normalizePath(value) {
  return value.replaceAll("\\", "/");
}

function compareCodePoints(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function outputFileRealm(file) {
  const normalized = normalizePath(file);
  if (/(?:^|\/)tools\/video-studio\/workers\/|(?:^|\/)[^/]*worker(?:[.-][^/.-]+)*\.m?js$/.test(normalized)) return "worker";
  if (normalized.startsWith("assets/") && normalized.endsWith(".js")) return "main";
  return "public";
}

export function moduleInventoryEntry(file) {
  const normalized = normalizePath(file);
  const realm = outputFileRealm(normalized);
  if (realm === "main") return { file: normalized, realm, attribution: "modules" };
  return {
    file: normalized,
    realm,
    attribution: "opaque",
    reason: realm === "worker"
      ? "worker module collection is deferred"
      : "public execution asset has no Rollup main-chunk module graph",
  };
}

function realPath(value) {
  return normalizePath(fs.realpathSync(value)).replace(/\/$/, "");
}

export function canonicalModuleId(id, {
  sourceRoot,
  nodeModulesRoot = path.join(sourceRoot, "node_modules"),
  realm = "main",
} = {}) {
  if (typeof id !== "string" || !id) throw new Error("Module id must be a non-empty string.");
  if (typeof sourceRoot !== "string" || !sourceRoot) throw new Error("sourceRoot is required to canonicalize module ids.");
  if (typeof realm !== "string" || !realm) throw new Error("realm is required to canonicalize module ids.");

  const normalizedSourceRoot = realPath(sourceRoot);
  const normalizedNodeModulesRoot = realPath(nodeModulesRoot);
  const queryIndex = id.indexOf("?");
  const query = queryIndex === -1 ? "" : id.slice(queryIndex);
  let modulePath = normalizePath(queryIndex === -1 ? id : id.slice(0, queryIndex));
  let virtualPrefix = "";
  while (modulePath.startsWith("\0")) {
    virtualPrefix += "\0";
    modulePath = modulePath.slice(1);
  }

  const relativeTo = (root, marker) => {
    if (modulePath === root) return marker;
    if (modulePath.startsWith(`${root}/`)) return `${marker}/${modulePath.slice(root.length + 1)}`;
    return null;
  };
  modulePath = relativeTo(normalizedNodeModulesRoot, "<node_modules>")
    ?? relativeTo(normalizedSourceRoot, "<root>")
    ?? modulePath;
  return `${realm}:${virtualPrefix}${modulePath}${query}`;
}

export function normalizeModuleChunks(moduleChunks, options) {
  if (!Array.isArray(moduleChunks)) throw new Error("Module attribution metadata is required for the measurement build.");
  const files = new Set();
  return moduleChunks.map((chunk, chunkIndex) => {
    if (typeof chunk?.file !== "string" || !chunk.file) throw new Error(`modules[${chunkIndex}].file must be a non-empty string.`);
    if (files.has(chunk.file)) throw new Error(`Duplicate module metadata for ${chunk.file}.`);
    files.add(chunk.file);
    if (!Array.isArray(chunk.modules)) throw new Error(`modules[${chunkIndex}].modules must be an array.`);
    const ids = new Set();
    const modules = chunk.modules.map((module, moduleIndex) => {
      const label = `modules[${chunkIndex}].modules[${moduleIndex}]`;
      assertBytes(module?.renderedLength, `${label}.renderedLength`);
      assertBytes(module?.renderedGzip, `${label}.renderedGzip`);
      if (module.renderedLength > 0 && (module.codeAvailable !== true || module.renderedGzip === 0)) {
        throw new Error(`${label} is missing rendered code or independent gzip weight.`);
      }
      if (typeof module.renderedSha256 !== "string" || !/^[a-f0-9]{64}$/.test(module.renderedSha256)) {
        throw new Error(`${label}.renderedSha256 must be a SHA-256 hex digest.`);
      }
      const id = canonicalModuleId(module.id, options);
      if (ids.has(id)) throw new Error(`Canonical module id collision in ${chunk.file}: ${id}.`);
      ids.add(id);
      return {
        id,
        renderedLength: module.renderedLength,
        renderedGzip: module.renderedGzip,
        renderedSha256: module.renderedSha256,
      };
    });
    return { file: normalizePath(chunk.file), realm: options?.realm ?? "main", modules };
  });
}

export function allocateChunkGzip(totalBytes, weightedModules) {
  assertBytes(totalBytes, "chunk gzip");
  if (!Array.isArray(weightedModules)) throw new Error("weightedModules must be an array.");
  const modules = weightedModules.map(({ id, weight }, index) => {
    if (typeof id !== "string" || !id) throw new Error(`weightedModules[${index}].id must be a non-empty string.`);
    return { id, weight: assertBytes(weight, `weightedModules[${index}].weight`), bytes: 0, remainder: 0n };
  }).filter(({ weight }) => weight > 0).sort((left, right) => compareCodePoints(left.id, right.id));
  if (!modules.length) {
    if (totalBytes !== 0) throw new Error("A non-empty chunk needs at least one positive module weight.");
    return [];
  }
  const denominator = BigInt(sum(modules.map(({ weight }) => weight)));
  for (const module of modules) {
    const numerator = BigInt(totalBytes) * BigInt(module.weight);
    module.bytes = Number(numerator / denominator);
    module.remainder = numerator % denominator;
  }
  const remainderOrder = [...modules].sort((left, right) => {
    if (left.remainder === right.remainder) return compareCodePoints(left.id, right.id);
    return left.remainder > right.remainder ? -1 : 1;
  });
  const unallocated = totalBytes - sum(modules.map(({ bytes }) => bytes));
  for (let index = 0; index < unallocated; index += 1) remainderOrder[index].bytes += 1;
  if (sum(modules.map(({ bytes }) => bytes)) !== totalBytes) throw new Error("Module allocation does not equal the chunk gzip size.");
  return modules.map(({ id, bytes }) => ({ id, bytes }));
}

function contributionCategory(file) {
  if (file.category !== "route") return file.category;
  if (!Array.isArray(file.routeOwners) || file.routeOwners.length !== 1) {
    throw new Error(`Route contribution ${file.hash} must have exactly one owner.`);
  }
  return `route:${file.routeOwners[0]}`;
}

export function buildModuleContributions(report) {
  assertMeasurementSchema(report, "report");
  const chunksByFile = new Map(report.modules.map((chunk) => [chunk.file, chunk]));
  const inventoryByFile = new Map(report.moduleInventory.map((entry) => [entry.file, entry]));
  const seenHashes = new Set();
  const contributions = [];
  for (const file of report.files.filter(({ type }) => type === "js")) {
    if (seenHashes.has(file.hash)) throw new Error(`Duplicate deduplicated JS hash ${file.hash}.`);
    seenHashes.add(file.hash);
    assertBytes(file.gzipBytes, `file.${file.hash}.gzipBytes`);
    const category = contributionCategory(file);
    const chunk = file.paths.map((filePath) => chunksByFile.get(filePath)).find(Boolean);
    if (!chunk) {
      const opaqueEntry = file.paths.map((filePath) => inventoryByFile.get(filePath))
        .find((entry) => entry?.attribution === "opaque");
      if (!opaqueEntry) throw new Error(`Missing main module attribution for ${file.paths.join(", ")}.`);
      contributions.push({
        id: `opaque:${opaqueEntry.realm}:sha256:${file.hash}`,
        category,
        bytes: file.gzipBytes,
        file: file.paths[0],
        opaque: true,
      });
      continue;
    }
    const weightedModules = chunk.modules
      .filter(({ renderedLength }) => renderedLength > 0)
      .map(({ id, renderedGzip }) => ({ id, weight: renderedGzip }));
    if (!weightedModules.length) {
      throw new Error(`Main chunk ${chunk.file} has no positive module attribution weight.`);
    }
    for (const contribution of allocateChunkGzip(file.gzipBytes, weightedModules)) {
      if (contribution.bytes === 0) continue;
      contributions.push({ ...contribution, category, file: file.paths[0], opaque: false });
    }
  }
  const total = sum(contributions.map(({ bytes }) => bytes));
  if (total !== report.metrics.appJsGzip) {
    throw new Error(`Module contributions ${total} do not equal appJsGzip ${report.metrics.appJsGzip}.`);
  }
  return contributions;
}

function groupContributions(rows) {
  const grouped = new Map();
  for (const row of rows) {
    assertBytes(row.bytes, `contribution.${row.id}`);
    if (!grouped.has(row.id)) grouped.set(row.id, new Map());
    const categories = grouped.get(row.id);
    categories.set(row.category, (categories.get(row.category) ?? 0) + row.bytes);
  }
  return grouped;
}

export function compareContributionRows(currentRows, baselineRows) {
  const current = groupContributions(currentRows);
  const baseline = groupContributions(baselineRows);
  const movements = [];
  for (const id of [...new Set([...baseline.keys(), ...current.keys()])].sort()) {
    const remainingBaseline = new Map(baseline.get(id) ?? []);
    const remainingCurrent = new Map(current.get(id) ?? []);
    for (const category of [...remainingBaseline.keys()].sort()) {
      const retained = Math.min(remainingBaseline.get(category), remainingCurrent.get(category) ?? 0);
      remainingBaseline.set(category, remainingBaseline.get(category) - retained);
      remainingCurrent.set(category, (remainingCurrent.get(category) ?? 0) - retained);
    }
    for (const from of [...remainingBaseline.keys()].sort()) {
      for (const to of [...remainingCurrent.keys()].sort()) {
        if (from === to) continue;
        const bytes = Math.min(remainingBaseline.get(from), remainingCurrent.get(to));
        if (!bytes) continue;
        movements.push({ id, from, to, bytes });
        remainingBaseline.set(from, remainingBaseline.get(from) - bytes);
        remainingCurrent.set(to, remainingCurrent.get(to) - bytes);
      }
    }
  }

  const categories = [...new Set([...baselineRows, ...currentRows].map(({ category }) => category))].sort();
  const categoryDeltas = Object.fromEntries(categories.map((category) => {
    const gross = sum(currentRows.filter((row) => row.category === category).map(({ bytes }) => bytes))
      - sum(baselineRows.filter((row) => row.category === category).map(({ bytes }) => bytes));
    const movedIn = sum(movements.filter((movement) => movement.to === category).map(({ bytes }) => bytes));
    const movedOut = sum(movements.filter((movement) => movement.from === category).map(({ bytes }) => bytes));
    return [category, { gross, movedIn, movedOut, net: gross - movedIn + movedOut }];
  }));
  const appNet = sum(currentRows.map(({ bytes }) => bytes)) - sum(baselineRows.map(({ bytes }) => bytes));
  if (sum(Object.values(categoryDeltas).map(({ net }) => net)) !== appNet) {
    throw new Error("Category net deltas do not equal the actual application delta.");
  }
  return { categoryDeltas, movements, appNet };
}

export function compareModuleAttribution(current, baseline) {
  assertMeasurementSchema(current, "current");
  assertMeasurementSchema(baseline, "baseline");
  return compareContributionRows(buildModuleContributions(current), buildModuleContributions(baseline));
}

export function assertMeasurementSchema(report, label) {
  if (report?.schemaVersion !== BUNDLE_MEASUREMENT_SCHEMA_VERSION
      || report?.moduleAttributionSchema !== MODULE_ATTRIBUTION_SCHEMA
      || !Array.isArray(report?.modules)
      || !Array.isArray(report?.moduleInventory)) {
    throw new Error(`${label} uses an unsupported bundle measurement schema; regenerate it with the module-attribution meter.`);
  }
  if (!Array.isArray(report.files)) throw new Error(`${label}.files must be an array.`);

  const expectedInventory = new Map();
  for (const [fileIndex, file] of report.files.entries()) {
    if (file?.type !== "js") continue;
    if (!Array.isArray(file.paths) || !file.paths.length) throw new Error(`${label}.files[${fileIndex}].paths must be a non-empty array.`);
    for (const [pathIndex, filePath] of file.paths.entries()) {
      if (typeof filePath !== "string" || !filePath) throw new Error(`${label}.files[${fileIndex}].paths[${pathIndex}] must be a non-empty string.`);
      const normalized = normalizePath(filePath);
      if (expectedInventory.has(normalized)) throw new Error(`${label} has duplicate JS output path ${normalized}.`);
      expectedInventory.set(normalized, moduleInventoryEntry(normalized));
    }
  }

  const actualInventory = new Map();
  for (const [index, entry] of report.moduleInventory.entries()) {
    if (typeof entry?.file !== "string" || !entry.file) throw new Error(`${label}.moduleInventory[${index}].file must be a non-empty string.`);
    const file = normalizePath(entry.file);
    if (actualInventory.has(file)) throw new Error(`${label} has duplicate module inventory for ${file}.`);
    const expected = expectedInventory.get(file);
    if (!expected) throw new Error(`${label} module inventory has unknown JS output ${file}.`);
    if (entry.realm !== expected.realm || entry.attribution !== expected.attribution || entry.reason !== expected.reason) {
      throw new Error(`${label} module inventory classification is invalid for ${file}.`);
    }
    actualInventory.set(file, entry);
  }
  for (const file of expectedInventory.keys()) {
    if (!actualInventory.has(file)) throw new Error(`${label} module inventory is missing JS output ${file}.`);
  }

  const chunks = new Set();
  for (const [chunkIndex, chunk] of report.modules.entries()) {
    const chunkLabel = `${label}.modules[${chunkIndex}]`;
    if (typeof chunk?.file !== "string" || !chunk.file) throw new Error(`${chunkLabel}.file must be a non-empty string.`);
    const file = normalizePath(chunk.file);
    if (chunks.has(file)) throw new Error(`${label} has duplicate main chunk metadata for ${file}.`);
    chunks.add(file);
    const inventory = actualInventory.get(file);
    if (!inventory || inventory.realm !== "main" || inventory.attribution !== "modules" || chunk.realm !== "main") {
      throw new Error(`${chunkLabel} must identify an inventoried main chunk.`);
    }
    if (!Array.isArray(chunk.modules) || !chunk.modules.length) throw new Error(`${chunkLabel}.modules must be a non-empty array.`);
    const ids = new Set();
    let positiveWeight = 0;
    for (const [moduleIndex, module] of chunk.modules.entries()) {
      const moduleLabel = `${chunkLabel}.modules[${moduleIndex}]`;
      if (typeof module?.id !== "string" || !module.id) throw new Error(`${moduleLabel}.id must be a non-empty string.`);
      if (ids.has(module.id)) throw new Error(`${chunkLabel} has duplicate canonical module id ${module.id}.`);
      ids.add(module.id);
      assertBytes(module.renderedLength, `${moduleLabel}.renderedLength`);
      assertBytes(module.renderedGzip, `${moduleLabel}.renderedGzip`);
      if (module.renderedLength > 0 && module.renderedGzip === 0) throw new Error(`${moduleLabel} is missing its independent gzip weight.`);
      if (module.renderedGzip > 0) positiveWeight += 1;
      if (typeof module.renderedSha256 !== "string" || !/^[a-f0-9]{64}$/.test(module.renderedSha256)) {
        throw new Error(`${moduleLabel}.renderedSha256 must be a SHA-256 hex digest.`);
      }
    }
    if (!positiveWeight) throw new Error(`${chunkLabel} has no positive module attribution weight.`);
  }
  for (const [file, entry] of actualInventory) {
    if (entry.realm === "main" && !chunks.has(file)) throw new Error(`${label} is missing main chunk metadata for ${file}.`);
    if (entry.realm !== "main" && chunks.has(file)) throw new Error(`${label} may only use opaque attribution for worker/public JavaScript: ${file}.`);
  }
}
