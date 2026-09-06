import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const snapshot = "noto-cjk-sans-2.004";
const subsetSnapshot = "noto-cjk-sans-2.004-ksx1001-v1";
const sourceRoot = "https://raw.githubusercontent.com/notofonts/noto-cjk/Sans2.004/";
const cacheRoot = path.join(projectRoot, ".cache", "qr-label-font", snapshot);
const outputRoot = path.join(projectRoot, "public", "vendor", "qr-label-font");
const inputRoot = path.join(projectRoot, "scripts", "assets", "qr-label-font", subsetSnapshot);
const assets = [
  { name: "NotoSansKR-Regular.otf", sourceName: "Sans/SubsetOTF/KR/NotoSansKR-Regular.otf", size: 4_644_748, sha256: "69975a0ac8472717870aefeab0a4d52739308d90856b9955313b2ad5e0148d68" },
  { name: "OFL.txt", sourceName: "LICENSE", size: 4_301, sha256: "6a73f9541c2de74158c0e7cf6b0a58ef774f5a780bf191f2d7ec9cc53efe2bf2" },
];
const subset = { name: "NotoSansKR-Regular.ksx1001.otf", size: 931_704, sha256: "b84d27a582d3f3e660db728e7913af3061d4e825e93cabdb6802f0ce23a252be" };
const inputs = [
  { name: `${subset.name}.gz`, size: 561_161, sha256: "e1db3cdcbb8d76fc0546ec582bed773b3b7ef3da60867b6828493a6b342c7e66" },
  { name: "coverage.json", size: 19_686, sha256: "58f248442d4e8e5726559644a746740bd0066cebabf154956e0bb7e1458eafea" },
  { name: "provenance.json", size: 1_201, sha256: "30e10e1815835b8076a100ecdc9804c2613b115b555cbcc0b122150b92f77667" },
];

// All local inputs fail closed BEFORE public is changed or any source is downloaded.
const inputBytes = new Map();
for (const asset of inputs) {
  const bytes = await fs.readFile(path.join(inputRoot, asset.name));
  verify(bytes, asset);
  inputBytes.set(asset.name, bytes);
}
const subsetBytes = gunzipSync(inputBytes.get(inputs[0].name), { maxOutputLength: subset.size });
verify(subsetBytes, subset);
const coverage = JSON.parse(inputBytes.get("coverage.json").toString("utf8"));
validateCoverage(coverage);
const provenance = JSON.parse(inputBytes.get("provenance.json").toString("utf8"));
if (provenance.schema !== 1 || provenance.snapshot !== subsetSnapshot || provenance.source.sha256 !== assets[0].sha256 ||
    provenance.fonttools.version !== "4.59.2" || provenance.fonttools.sha256 !== "738f31f23e0339785fd67652a94bc69ea49e413dfdb14dcb8c8ff383d249464e" ||
    provenance.unicodes.sha256 !== "ac8fefb54a969022fc1b139a3a7a1937f711e71280fb992683eb0d4d43978b0c") throw new Error("Invalid QR font provenance");
for (const asset of [subset, inputs[0], inputs[1]]) {
  if (provenance.outputs[asset.name]?.sha256 !== asset.sha256 || provenance.outputs[asset.name]?.size !== asset.size) throw new Error("QR font provenance output mismatch");
}
const sourceBytes = new Map();
await fs.mkdir(cacheRoot, { recursive: true });
for (const asset of assets) {
  const cached = path.join(cacheRoot, asset.name);
  let bytes = await fs.readFile(cached).catch(() => undefined);
  if (!bytes || !matches(bytes, asset)) {
    const response = await fetch(new URL(asset.sourceName, sourceRoot), { headers: { "Accept-Encoding": "identity" } });
    if (!response.ok) throw new Error(`Unable to download pinned QR label font asset ${asset.name}: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    verify(bytes, asset); // Do not persist a rejected response.
    await fs.writeFile(cached, bytes);
  }
  sourceBytes.set(asset.name, bytes);
}

// Stage everything first; replace only the two owned snapshot directories.
// Other vendors/snapshots must remain untouched. Rename failures roll back both.
await fs.mkdir(outputRoot, { recursive: true });
const stage = await fs.mkdtemp(path.join(outputRoot, ".qr-font-stage-"));
const committed = [];
try {
  const fullDir = path.join(stage, snapshot);
  const subDir = path.join(stage, subsetSnapshot);
  await fs.mkdir(fullDir);
  await fs.mkdir(subDir);
  for (const asset of assets) await fs.writeFile(path.join(fullDir, asset.name), sourceBytes.get(asset.name));
  await fs.writeFile(path.join(fullDir, "manifest.json"), json({ snapshot, sourceRoot, assets }));
  await fs.writeFile(path.join(subDir, subset.name), subsetBytes);
  await fs.writeFile(path.join(subDir, "OFL.txt"), sourceBytes.get("OFL.txt"));
  for (const asset of inputs.slice(1)) await fs.writeFile(path.join(subDir, asset.name), inputBytes.get(asset.name));
  await fs.writeFile(path.join(subDir, "manifest.json"), json({ snapshot: subsetSnapshot, sourceSnapshot: snapshot, assets: [subset, assets[1], ...inputs.slice(1)], inputs }));
  try {
    for (const name of [snapshot, subsetSnapshot]) {
      const destination = path.join(outputRoot, name);
      const backup = path.join(stage, `${name}.previous`);
      const hadPrevious = await fs.stat(destination).then(() => true, (error) => { if (error.code === "ENOENT") return false; throw error; });
      if (hadPrevious) await fs.rename(destination, backup);
      committed.push({ destination, backup, hadPrevious });
      await fs.rename(path.join(stage, name), destination);
    }
  } catch (error) {
    for (const { destination, backup, hadPrevious } of committed.reverse()) {
      await fs.rm(destination, { recursive: true, force: true });
      if (hadPrevious) await fs.rename(backup, destination);
    }
    throw error;
  }
} finally {
  await fs.rm(stage, { recursive: true, force: true });
}
console.log("QR fonts verified: full=4644748 subset=931704 coverage=3394");

function json(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function matches(bytes, asset) { return bytes.length === asset.size && createHash("sha256").update(bytes).digest("hex") === asset.sha256; }
function verify(bytes, asset) { if (!matches(bytes, asset)) throw new Error(`Pinned QR font verification failed: ${asset.name}`); }
function validateCoverage(value) {
  if (!value || Object.keys(value).sort().join(",") !== "codepoints,schema,snapshot" || value.schema !== 1 || value.snapshot !== subsetSnapshot || !Array.isArray(value.codepoints) || value.codepoints.length !== 3_394) throw new Error("Invalid QR coverage schema");
  let previous = -1;
  for (const cp of value.codepoints) {
    if (!Number.isInteger(cp) || cp <= previous || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) throw new Error("Invalid QR coverage codepoints");
    previous = cp;
  }
  if (!value.codepoints.includes(0x2026)) throw new Error("Missing QR ellipsis");
}
