import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { generatePdfFinishFixtures } from "../../scripts/generate-pdf-finish-fixtures.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const trackedFixtureDirectory = path.join(repositoryRoot, "tests", "fixtures", "pdf-finish");

async function treeHashes(directory: string) {
  const result: Record<string, string> = {};
  async function visit(current: string) {
    for (const entry of (await fs.readdir(current, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else result[path.relative(directory, absolute).split(path.sep).join("/")] = crypto.createHash("sha256").update(await fs.readFile(absolute)).digest("hex");
    }
  }
  await visit(directory);
  return result;
}

function withoutLegacy(tree: Record<string, string>) {
  return Object.fromEntries(Object.entries(tree).filter(([file]) => !file.startsWith("legacy-oracle/")));
}

test("PDF finish fixtures are deterministic twice and match the tracked oracle tree", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "worklazy-pdf-finish-fixtures-"));
  const first = path.join(temporaryRoot, "first");
  const second = path.join(temporaryRoot, "second");
  try {
    const firstManifest = await generatePdfFinishFixtures(first);
    const secondManifest = await generatePdfFinishFixtures(second);
    assert.deepEqual(firstManifest.counts, {
      total: 104,
      byCategory: { encrypted: 4, damage: 3, background: 4, risk: 3, removal: 1, ordinary: 2, ocg: 87 },
      ocg: { allowed: 4, excluded: 31, directArrayRegression: 32, representatives: 20, pixelOracle: 56 },
    });
    assert.deepEqual(secondManifest, firstManifest);
    assert.deepEqual(await treeHashes(second), await treeHashes(first));
    assert.deepEqual(withoutLegacy(await treeHashes(trackedFixtureDirectory)), await treeHashes(first));
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("legacy PDF oracles remain tied to the exact main blobs and all three oracle types", async () => {
  const legacyDirectory = path.join(trackedFixtureDirectory, "legacy-oracle");
  const manifest = JSON.parse(await fs.readFile(path.join(legacyDirectory, "manifest.json"), "utf8"));
  assert.equal(manifest.baseCommit, "5bc6854175331bdd73b267784d9633cdccda8446");
  assert.deepEqual(manifest.determinism, { runs: 2, byteEqualModes: 4, structureEqualModes: 4, popplerPixelDiffs: 0, pdfjsPixelDiffs: 0 });
  assert.equal(manifest.modes.length, 4);
  for (const source of Object.values(manifest.source) as Array<{ file: string; sha256: string }>) {
    const baseBlob = execFileSync("git", ["show", `${manifest.baseCommit}:${source.file}`], { cwd: repositoryRoot });
    assert.equal(crypto.createHash("sha256").update(baseBlob).digest("hex"), source.sha256, source.file);
  }
  assert.equal(
    crypto.createHash("sha256").update(await fs.readFile(path.join(repositoryRoot, manifest.source.worker.file))).digest("hex"),
    manifest.source.worker.sha256,
    "The legacy PDF worker remains unchanged; the migrated client is checked by fixtures:pdf-legacy-oracle.",
  );
  for (const mode of manifest.modes) {
    assert.equal(crypto.createHash("sha256").update(await fs.readFile(path.join(legacyDirectory, mode.output.file))).digest("hex"), mode.output.sha256, mode.mode);
    assert.equal(crypto.createHash("sha256").update(await fs.readFile(path.join(legacyDirectory, mode.structure.file))).digest("hex"), mode.structure.sha256, mode.mode);
    assert.equal(mode.output.sha256, mode.output.secondRunSha256);
    assert.deepEqual(mode.render.poppler.secondRunChangedPixels, [0, 0, 0, 0]);
    assert.deepEqual(mode.render.pdfjs.secondRunChangedPixels, [0, 0, 0, 0]);
    assert.equal(mode.render.poppler.pages.length, 4);
    assert.equal(mode.render.pdfjs.pages.length, 4);
  }
  assert.deepEqual(manifest.client.records.map(({ name, width, height }: { name: string; width: number; height: number }) => ({ name, width, height })), [
    { name: "short", width: 420, height: 92 },
    { name: "wide", width: 1800, height: 92 },
    { name: "surrogate", width: 1800, height: 92 },
  ]);
});

test("PDF finish OCG manifest preserves canonical cohorts and exact SHA oracles", async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(trackedFixtureDirectory, "manifest.json"), "utf8"));
  const cohorts = Map.groupBy(manifest.ocg.files, (fixture: { cohort: string }) => fixture.cohort);
  assert.equal(cohorts.get("allowed")?.length, 4);
  assert.equal(cohorts.get("excluded")?.length, 31);
  assert.equal(cohorts.get("direct-array-regression")?.length, 32);
  assert.equal(cohorts.get("representative")?.length, 20);
  assert.equal(manifest.ocg.files.filter((fixture: { pixelOracle?: unknown }) => fixture.pixelOracle).length, 56);
  for (const fixture of manifest.ocg.files) {
    const bytes = await fs.readFile(path.join(trackedFixtureDirectory, fixture.file));
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), fixture.sha256, fixture.file);
    assert.equal(fixture.preflight.allowed, fixture.cohort !== "excluded", fixture.file);
  }
  assert.deepEqual(manifest.ocg.exploration.directArrayAxes, {
    locations: ["marked-content", "form-xobject"],
    policies: ["AnyOn", "AllOn", "AnyOff", "AllOff"],
    twoGroupStates: ["00", "01", "10", "11"],
  });
  assert.equal(manifest.ocg.exploration.round11.length, 72);
  assert.equal(manifest.ocg.exploration.round12.length, 50);
});

test("ordinary marked content and pages without Resources remain non-OC fixtures", async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(trackedFixtureDirectory, "manifest.json"), "utf8"));
  const ordinary = manifest.fixtures.filter((fixture: { category: string }) => fixture.category === "ordinary");
  assert.deepEqual(ordinary.map(({ file }: { file: string }) => file), [
    "ordinary/named-properties.pdf",
    "ordinary/no-resources.pdf",
  ]);
  for (const fixture of ordinary) {
    assert.deepEqual(fixture.expectation.preflight, { allowed: true, reason: "allow" });
    assert.deepEqual(fixture.expectation.pixelOracle.poppler, fixture.expectation.pixelOracle.pdfjs);
  }
});

test("PDF finish fixture generator imports Node built-ins only", async () => {
  const source = await fs.readFile(path.join(repositoryRoot, "scripts", "generate-pdf-finish-fixtures.mjs"), "utf8");
  const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
  assert.ok(imports.length > 0);
  assert.ok(imports.every((specifier) => specifier.startsWith("node:")), imports.join(", "));
});
