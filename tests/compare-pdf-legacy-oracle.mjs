import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testsDirectory, "..");
const baselineDirectory = path.join(testsDirectory, "fixtures", "pdf-finish", "legacy-oracle");
const artifactDirectory = path.resolve(process.env.PDF_LEGACY_ORACLE_ARTIFACT_DIR || "/tmp/worklazy-u4-2");
const relativeToTemp = path.relative(path.resolve("/tmp"), artifactDirectory);
assert.ok(relativeToTemp && !relativeToTemp.startsWith("..") && !path.isAbsolute(relativeToTemp), "PDF_LEGACY_ORACLE_ARTIFACT_DIR must be a child of /tmp.");
await fs.mkdir(artifactDirectory, { recursive: true });
const candidateDirectory = path.join(artifactDirectory, "legacy-oracle-current");

const capture = spawnSync(process.execPath, [path.join(testsDirectory, "capture-pdf-legacy-oracle.mjs")], {
  cwd: repositoryRoot,
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
  env: {
    ...process.env,
    PDF_LEGACY_ORACLE_OUTPUT: candidateDirectory,
    PDF_LEGACY_ORACLE_SOURCE: "current",
  },
});
if (capture.status !== 0) {
  process.stderr.write(capture.stdout);
  process.stderr.write(capture.stderr);
}
assert.equal(capture.status, 0, "Current-source legacy oracle capture failed.");

const categories = {
  client: "client",
  structure: "structure",
  render: "render",
  output: "output",
};
const summary = {};
let totalDiffs = 0;
for (const [name, relativeDirectory] of Object.entries(categories)) {
  const baselineFiles = await listFiles(path.join(baselineDirectory, relativeDirectory));
  const candidateFiles = await listFiles(path.join(candidateDirectory, relativeDirectory));
  assert.deepEqual(candidateFiles, baselineFiles, `${name} oracle file list changed`);
  let diffs = 0;
  for (const file of baselineFiles) {
    const baseline = await fs.readFile(path.join(baselineDirectory, relativeDirectory, file));
    const candidate = await fs.readFile(path.join(candidateDirectory, relativeDirectory, file));
    if (!baseline.equals(candidate)) diffs += 1;
  }
  summary[name] = { files: baselineFiles.length, diffs };
  totalDiffs += diffs;
}

const inputEqual = (await fs.readFile(path.join(baselineDirectory, "input.pdf")))
  .equals(await fs.readFile(path.join(candidateDirectory, "input.pdf")));
assert.equal(inputEqual, true, "Legacy oracle input changed");
const baselineManifest = JSON.parse(await fs.readFile(path.join(baselineDirectory, "manifest.json"), "utf8"));
const candidateManifest = JSON.parse(await fs.readFile(path.join(candidateDirectory, "manifest.json"), "utf8"));
assert.deepEqual(candidateManifest.client.contract, baselineManifest.client.contract);
assert.deepEqual(candidateManifest.determinism, baselineManifest.determinism);
assert.deepEqual(candidateManifest.modes.map(oracleModeSummary), baselineManifest.modes.map(oracleModeSummary));
assert.equal(candidateManifest.source.worker.sha256, baselineManifest.source.worker.sha256, "Legacy PDF worker source changed");
assert.equal(totalDiffs, 0, `Legacy oracle changed: ${JSON.stringify(summary)}`);

console.log(JSON.stringify({
  baselineDirectory,
  candidateDirectory,
  ...summary,
  input: { files: 1, diffs: inputEqual ? 0 : 1 },
  totalDiffs,
}, null, 2));

async function listFiles(directory) {
  return (await fs.readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
}

function oracleModeSummary(mode) {
  return {
    mode: mode.mode,
    options: mode.options,
    output: mode.output,
    structure: mode.structure,
    render: mode.render,
  };
}
