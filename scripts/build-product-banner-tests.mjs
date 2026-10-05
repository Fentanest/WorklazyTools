import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { build } from "vite";
import config from "../vite.config.ts";

// Reuse production config/generator, with job-owned outputs and caches.
const root = process.env.PB_JOB_ROOT;
if (!root) throw new Error("PB_JOB_ROOT required");
await mkdir(`${root}/cache`, { recursive: true });
function run(args, env = process.env) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit", env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
for (const project of ["app", "node"]) run([
  "node_modules/typescript/bin/tsc", "-p", `tsconfig.${project}.json`,
  "--incremental", "--tsBuildInfoFile", `${root}/cache/tsconfig.${project}.tsbuildinfo`,
]);
const outDir = path.resolve(root, "dist");
await build({ ...config, configFile: false, cacheDir: `${root}/cache/vite`, build: { outDir, emptyOutDir: true } });
run(["--experimental-strip-types", "scripts/generate-static-pages.mjs"], { ...process.env, WORKLAZY_STATIC_OUTPUT_DIR: outDir });
const names = (await readdir(`${outDir}/assets`)).filter((name) => /^(ProductBannerPage|input.worker)-/u.test(name));
names.push("../ko/tools/product-banner/index.html", "../en/tools/product-banner/index.html");
const hashes = {};
for (const name of names) hashes[name] = createHash("sha256").update(await readFile(`${outDir}/assets/${name}`)).digest("hex");
await writeFile(`${root}/build-ready.json`, JSON.stringify({ completedAt: new Date().toISOString(), outDir, hashes }, null, 2));
console.log("Product banner build and static generation complete");
