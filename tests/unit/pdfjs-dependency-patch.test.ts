import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function sha256(source: string) {
  return crypto.createHash("sha256").update(source).digest("hex");
}

test("the pinned PDF.js RGB offset patch is hash-verified and applied to full and minified browser builds", async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(repositoryRoot, "scripts/patches/pdfjs-dist-6.2.108-rgb-chunks.json"), "utf8"));
  const metadata = JSON.parse(await fs.readFile(path.join(repositoryRoot, "node_modules/pdfjs-dist/package.json"), "utf8"));
  const packageMetadata = JSON.parse(await fs.readFile(path.join(repositoryRoot, "package.json"), "utf8"));
  assert.equal(manifest.version, "6.2.108");
  assert.equal(metadata.version, manifest.version);
  assert.equal(packageMetadata.dependencies[manifest.package], manifest.version);
  assert.deepEqual(manifest.files.map(({ path: filePath }: { path: string }) => filePath).sort(), [
    "build/pdf.min.mjs",
    "build/pdf.mjs",
    "legacy/build/pdf.min.mjs",
    "legacy/build/pdf.mjs",
  ]);
  for (const entry of manifest.files) {
    const source = await fs.readFile(path.join(repositoryRoot, "node_modules", manifest.package, entry.path), "utf8");
    const replacement = entry.replacement ?? manifest.replacement;
    assert.equal(sha256(source), entry.patchedSha256, entry.path);
    assert.equal(source.split(replacement.from).length - 1, 0, entry.path);
    assert.equal(source.split(replacement.to).length - 1, entry.occurrences, entry.path);
    assert.match(entry.originalSha256, /^[0-9a-f]{64}$/u);
  }
});
