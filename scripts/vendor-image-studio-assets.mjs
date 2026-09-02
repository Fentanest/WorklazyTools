import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);
const manifestPath = path.join(projectRoot, "src", "features", "image-studio", "stickers.manifest.json");
const manifestBytes = await fs.readFile(manifestPath);
const manifest = JSON.parse(manifestBytes.toString("utf8"));

validateManifest(manifest);

const cacheDirectory = path.join(projectRoot, ".cache", "image-studio-assets", manifest.version);
const destination = path.join(projectRoot, "public", "vendor", "emoji", manifest.version);
await fs.mkdir(cacheDirectory, { recursive: true });

const pinnedFiles = [
  { file: manifest.license.file, sourceUrl: manifest.license.sourceUrl, bytes: manifest.license.bytes, sha256: manifest.license.sha256 },
  ...manifest.assets.map((asset) => ({
    file: asset.file,
    sourceUrl: new URL(asset.file, manifest.sourceBaseUrl).href,
    bytes: asset.bytes,
    sha256: asset.sha256,
  })),
];

for (let index = 0; index < pinnedFiles.length; index += 8) {
  await Promise.all(pinnedFiles.slice(index, index + 8).map((asset) => cachePinnedAsset(cacheDirectory, asset)));
}

await fs.rm(destination, { recursive: true, force: true });
await fs.mkdir(destination, { recursive: true });
await Promise.all(pinnedFiles.map((asset) => fs.copyFile(path.join(cacheDirectory, asset.file), path.join(destination, asset.file))));
await fs.writeFile(path.join(destination, "manifest.json"), manifestBytes);

const totalBytes = manifest.assets.reduce((total, asset) => total + asset.bytes, 0);
console.log(`Image Studio sticker assets verified: ${manifest.assets.length} files, ${totalBytes} bytes, Twemoji ${manifest.version}.`);

async function cachePinnedAsset(directory, asset) {
  const target = path.join(directory, asset.file);
  if (await matchesPinnedAsset(target, asset)) return;
  const response = await fetch(asset.sourceUrl, { headers: { "Accept-Encoding": "identity" } });
  if (!response.ok || !response.body) throw new Error(`Unable to download pinned Image Studio asset ${asset.file}: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await fs.writeFile(target, bytes);
  if (await matchesPinnedAsset(target, asset)) return;
  await fs.rm(target, { force: true });
  throw new Error(`Pinned Image Studio asset verification failed: ${asset.file}`);
}

async function matchesPinnedAsset(filePath, asset) {
  try {
    const bytes = await fs.readFile(filePath);
    return bytes.length === asset.bytes && createHash("sha256").update(bytes).digest("hex") === asset.sha256;
  } catch {
    return false;
  }
}

function validateManifest(value) {
  const categories = new Set(["faces", "gestures", "animals", "food", "nature", "activities", "symbols"]);
  if (value?.schemaVersion !== 1 || value.vendor !== "Twemoji" || !/^\d+\.\d+\.\d+$/.test(value.version)
    || !/^[a-f0-9]{40}$/.test(value.commit) || !Array.isArray(value.assets)
    || value.sourceBaseUrl !== `https://raw.githubusercontent.com/jdecked/twemoji/${value.commit}/assets/svg/`
    || value.license?.sourceUrl !== `https://raw.githubusercontent.com/jdecked/twemoji/${value.commit}/LICENSE-GRAPHICS`
    || value.license?.sourcePath !== "LICENSE-GRAPHICS" || value.license?.file !== "LICENSE-GRAPHICS.txt"
    || value.license?.declaredLicense !== "CC-BY-4.0" || !Number.isInteger(value.license?.bytes)
    || !/^[a-f0-9]{64}$/.test(value.license?.sha256) || value.curationLimit !== 120
    || value.assets.length < 1 || value.assets.length > value.curationLimit) {
    throw new Error("Image Studio sticker manifest metadata is invalid.");
  }
  const files = new Set();
  const codepoints = new Set();
  for (const asset of value.assets) {
    if (!/^[a-f0-9]+(?:-[a-f0-9]+)*$/.test(asset.codepoint) || asset.file !== `${asset.codepoint}.svg`
      || !Number.isInteger(asset.bytes) || asset.bytes < 1 || !/^[a-f0-9]{64}$/.test(asset.sha256)
      || !categories.has(asset.category) || !asset.name?.ko || !asset.name?.en || files.has(asset.file) || codepoints.has(asset.codepoint)) {
      throw new Error(`Image Studio sticker manifest entry is invalid: ${asset?.file ?? "unknown"}`);
    }
    files.add(asset.file);
    codepoints.add(asset.codepoint);
  }
}
