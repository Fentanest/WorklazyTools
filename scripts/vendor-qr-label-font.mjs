import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);
const snapshot = "noto-cjk-sans-2.004";
const sourceRoot = "https://raw.githubusercontent.com/notofonts/noto-cjk/Sans2.004/";
const cacheRoot = path.join(projectRoot, ".cache", "qr-label-font", snapshot);
const destinationRoot = path.join(projectRoot, "public", "vendor", "qr-label-font", snapshot);

const assets = [
  {
    name: "NotoSansKR-Regular.otf",
    sourceName: "Sans/SubsetOTF/KR/NotoSansKR-Regular.otf",
    size: 4_644_748,
    sha256: "69975a0ac8472717870aefeab0a4d52739308d90856b9955313b2ad5e0148d68",
  },
  {
    name: "OFL.txt",
    sourceName: "LICENSE",
    size: 4_301,
    sha256: "6a73f9541c2de74158c0e7cf6b0a58ef774f5a780bf191f2d7ec9cc53efe2bf2",
  },
];

await fs.mkdir(cacheRoot, { recursive: true });
for (const asset of assets) {
  const cached = path.join(cacheRoot, asset.name);
  if (!(await matches(cached, asset))) {
    const response = await fetch(new URL(asset.sourceName, sourceRoot), { headers: { "Accept-Encoding": "identity" } });
    if (!response.ok) throw new Error(`Unable to download pinned QR label font asset ${asset.name}: HTTP ${response.status}`);
    await fs.writeFile(cached, new Uint8Array(await response.arrayBuffer()));
    if (!(await matches(cached, asset))) {
      await fs.rm(cached, { force: true });
      throw new Error(`Pinned QR label font verification failed: ${asset.name}`);
    }
  }
}

await fs.rm(destinationRoot, { recursive: true, force: true });
await fs.mkdir(destinationRoot, { recursive: true });
await Promise.all(assets.map((asset) => fs.copyFile(path.join(cacheRoot, asset.name), path.join(destinationRoot, asset.name))));
await fs.writeFile(path.join(destinationRoot, "manifest.json"), `${JSON.stringify({ snapshot, sourceRoot, assets }, null, 2)}\n`);

async function matches(filePath, asset) {
  try {
    const bytes = await fs.readFile(filePath);
    return bytes.length === asset.size && createHash("sha256").update(bytes).digest("hex") === asset.sha256;
  } catch {
    return false;
  }
}
