import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destination = path.join(root, "public/vendor/opencv/4.13.0-dev");
await fs.mkdir(destination, { recursive: true });
for (const [name, hash, size] of [
  ["opencv.js", "5930cd64d2f8f0fa6c572aae761837d95dd8d5b67c972c6a8a9daa37aa63795f", 128047],
  ["opencv_js.wasm", "8f4e4ff34715a0efc28262ca60248f93ab48b720b33378926321d8eb0dc448bd", 8355721],
]) {
  const bytes = await fs.readFile(path.join(root, "vendor/comparison/opencv/4.13.0-dev", name));
  if (bytes.length !== size || createHash("sha256").update(bytes).digest("hex") !== hash) throw new Error(`Comparison asset checksum mismatch: ${name}`);
  await fs.writeFile(path.join(destination, name), bytes);
}
await build({ entryPoints: [path.join(root, "src/features/image-compare/regions.worker.ts")], outfile: path.join(destination, "regions.worker.js"), bundle: true, format: "iife", platform: "browser", target: "es2022", legalComments: "inline" });
console.log("Comparison assets verified: OpenCV 4.13.0-dev JS/WASM and owned classic region worker.");
