import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

// BentoPDF 3a5f146d1b89d54dc7ca576aa6797c8bd3e42b97 resolves this exact
// package version. Its checked-in public WASM files have different hashes, so
// the package's JS, worker, WASM and data must be deployed as a single set.
const VERSION = "2.6.0";
const assets = [
  ["wasm/soffice.js", "b67acadcb30171e6ec018754fcbe5b527443a3ef1c84f352e29aecff6d210e43"],
  ["wasm/soffice.worker.js", "458bc142e7f837baf44a2d186a0b65b0a11ece760e5dab79ebca2789c9feeef5"],
  ["dist/browser.worker.global.js", "ae38107967ee690140f0e64d228e0947bb46a4e1d0385484b172f0844ad051c9"],
  ["wasm/soffice.wasm", "ea3d8f3b69bd1e586a8ea973e0dfa61c758612fcc529dc94ac2e30519f8b4f7b"],
  ["wasm/soffice.data", "8f4e98aa67e108e161cecc7906d7ac0dd3941ef9347f999c3b9dbc049f165020"],
];
const warmupSha256 = "eb6fe465ec5887efe4955e9316b3a99d59368c35e14417f4534fd4882c5ca76a";
const root = path.resolve(new URL("..", import.meta.url).pathname);
const source = path.join(root, "node_modules", "@matbee", "libreoffice-converter");
const packageInfo = JSON.parse(await fs.readFile(path.join(source, "package.json"), "utf8"));
if (packageInfo.version !== VERSION) throw new Error(`LibreOffice converter version mismatch: ${packageInfo.version}`);
const destination = path.join(root, "public", "vendor", "libreoffice-converter", VERSION);
const staging = `${destination}.staging-${process.pid}`;
await fs.rm(staging, { recursive: true, force: true });
await fs.mkdir(staging, { recursive: true });
try {
  for (const [relative, expected] of assets) {
    const input = path.join(source, relative);
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(input)) hash.update(chunk);
    if (hash.digest("hex") !== expected) throw new Error(`LibreOffice asset mismatch: ${relative}`);
    const name = path.basename(relative);
    if (name.endsWith(".wasm") || name.endsWith(".data")) {
      await pipeline(createReadStream(input), createGzip({ level: 9, mtime: 0 }), createWriteStream(path.join(staging, `${name}.gz`)));
    } else {
      await fs.copyFile(input, path.join(staging, name));
    }
  }
  const warmupSource = path.join(root, "tests", "fixtures", "document-converters", "sample.docx");
  const warmupBytes = await fs.readFile(warmupSource);
  if (createHash("sha256").update(warmupBytes).digest("hex") !== warmupSha256) throw new Error("LibreOffice warmup input mismatch");
  await fs.writeFile(path.join(staging, "warmup.docx"), warmupBytes);
  await fs.writeFile(path.join(staging, "manifest.json"), `${JSON.stringify({ version: VERSION, package: "@matbee/libreoffice-converter", upstreamCommit: "1bfae4a495b9fb17a0e6b20a13d0ad30ad58d343", sourceSha256: Object.fromEntries(assets), warmup: { source: "tests/fixtures/document-converters/sample.docx", sha256: warmupSha256 } }, null, 2)}\n`);
  await fs.rm(destination, { recursive: true, force: true });
  await fs.rename(staging, destination);
} catch (error) {
  await fs.rm(staging, { recursive: true, force: true });
  throw error;
}
