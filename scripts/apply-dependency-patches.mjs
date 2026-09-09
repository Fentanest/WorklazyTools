import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPaths = [path.join(repositoryRoot, "scripts/patches/pdfjs-dist-6.2.108-rgb-chunks.json")];

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function countOccurrences(source, needle) {
  return source.split(needle).length - 1;
}

export async function applyDependencyPatches() {
  const verified = [];
  for (const manifestPath of manifestPaths) {
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    if (manifest.schemaVersion !== 1 || manifest.package !== "pdfjs-dist" || !Array.isArray(manifest.files)) {
      throw new Error(`Invalid dependency patch manifest: ${manifestPath}`);
    }
    const packageRoot = path.join(repositoryRoot, "node_modules", manifest.package);
    const packageMetadata = JSON.parse(await fs.readFile(path.join(packageRoot, "package.json"), "utf8"));
    if (packageMetadata.version !== manifest.version) {
      throw new Error(`Dependency patch version mismatch: expected ${manifest.package}@${manifest.version}, received ${packageMetadata.version}.`);
    }

    for (const entry of manifest.files) {
      const target = path.join(packageRoot, entry.path);
      const source = await fs.readFile(target, "utf8");
      const replacement = entry.replacement ?? manifest.replacement;
      if (!replacement?.from || !replacement?.to) {
        throw new Error(`Dependency patch replacement is missing for ${entry.path}.`);
      }
      const beforeHash = sha256(source);
      if (beforeHash === entry.patchedSha256 || entry.successorSha256?.includes(beforeHash)) {
        if (countOccurrences(source, replacement.from) !== 0
            || countOccurrences(source, replacement.to) !== entry.occurrences) {
          throw new Error(`Dependency patch verification failed for already-patched ${entry.path}.`);
        }
        continue;
      }
      if (beforeHash !== entry.originalSha256) {
        throw new Error(`Dependency patch source hash mismatch for ${entry.path}: ${beforeHash}.`);
      }
      if (countOccurrences(source, replacement.from) !== entry.occurrences) {
        throw new Error(`Dependency patch occurrence mismatch for ${entry.path}.`);
      }
      const patched = source.replaceAll(replacement.from, replacement.to);
      if (sha256(patched) !== entry.patchedSha256) {
        throw new Error(`Dependency patch output hash mismatch for ${entry.path}.`);
      }
      await fs.writeFile(target, patched);
    }
    verified.push(manifest.description);
  }

  console.log(`Dependency patches verified: pdfjs-dist@6.2.108 (${verified.join("; ")}).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await applyDependencyPatches();
}
