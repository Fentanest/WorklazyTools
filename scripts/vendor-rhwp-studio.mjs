import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(await fs.readFile(path.join(projectRoot, "package.json"), "utf8"));
const coreVersion = packageJson.dependencies?.["@rhwp/core"];
const editorVersion = packageJson.dependencies?.["@rhwp/editor"];

if (!/^\d+\.\d+\.\d+$/.test(coreVersion) || coreVersion !== editorVersion) {
  throw new Error("@rhwp/core와 @rhwp/editor는 동일한 정확한 버전으로 고정되어야 합니다.");
}

const version = coreVersion;
const tag = `v${version}`;
const upstreamUrl = "https://github.com/edwardkim/rhwp.git";
const suppliedSource = process.env.RHWP_SOURCE_DIR ? path.resolve(process.env.RHWP_SOURCE_DIR) : undefined;
const temporaryRoot = suppliedSource ? undefined : await fs.mkdtemp(path.join(os.tmpdir(), `worklazy-rhwp-${version}-`));
const sourceRoot = suppliedSource ?? path.join(temporaryRoot, "source");

try {
  if (!suppliedSource) {
    await run("git", ["clone", "--filter=blob:none", "--depth", "1", "--branch", tag, "--sparse", upstreamUrl, sourceRoot]);
    await run("git", ["-C", sourceRoot, "sparse-checkout", "set", "rhwp-studio", "assets/fonts", "assets/logo"]);
  }

  const studioRoot = path.join(sourceRoot, "rhwp-studio");
  const studioPackage = JSON.parse(await fs.readFile(path.join(studioRoot, "package.json"), "utf8"));
  if (studioPackage.version !== version) {
    throw new Error(`공식 Studio 버전(${studioPackage.version})과 프로젝트 버전(${version})이 다릅니다.`);
  }

  const { stdout: commitOutput } = await execFileAsync("git", ["-C", sourceRoot, "rev-parse", "HEAD"], { encoding: "utf8" });
  const commit = commitOutput.trim();
  const { stdout: tagCommitOutput } = await execFileAsync("git", ["-C", sourceRoot, "rev-list", "-n", "1", tag], { encoding: "utf8" });
  if (commit !== tagCommitOutput.trim()) throw new Error(`${tag}의 정확한 커밋이 checkout되지 않았습니다.`);

  const corePackageRoot = path.join(projectRoot, "node_modules", "@rhwp", "core");
  const wasmFiles = ["rhwp.js", "rhwp_bg.wasm", "rhwp.d.ts", "rhwp_bg.wasm.d.ts"];
  await fs.mkdir(path.join(sourceRoot, "pkg"), { recursive: true });
  for (const fileName of wasmFiles) {
    await fs.copyFile(path.join(corePackageRoot, fileName), path.join(sourceRoot, "pkg", fileName));
  }
  await fs.copyFile(path.join(corePackageRoot, "rhwp.js"), path.join(studioRoot, "public", "rhwp.js"));
  await fs.copyFile(path.join(corePackageRoot, "rhwp_bg.wasm"), path.join(studioRoot, "public", "rhwp_bg.wasm"));

  if (!(await exists(path.join(studioRoot, "node_modules")))) {
    await run("npm", ["ci", "--ignore-scripts"], { cwd: studioRoot });
  }
  await run("npx", ["vite", "build", "--base=./"], {
    cwd: studioRoot,
    env: { ...process.env, RHWP_DISABLE_EXTERNAL_WEBFONTS: "1" },
  });

  const outputRoot = path.join(projectRoot, "public", "vendor", "rhwp-studio", version);
  await fs.rm(outputRoot, { recursive: true, force: true });
  await fs.mkdir(path.dirname(outputRoot), { recursive: true });
  await fs.cp(path.join(studioRoot, "dist"), outputRoot, { recursive: true, dereference: true });

  for (const pwaFile of ["registerSW.js", "sw.js", "workbox-dcde9eb3.js", "manifest.webmanifest"]) {
    await fs.rm(path.join(outputRoot, pwaFile), { force: true });
  }

  const contentSecurityPolicy = [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-src 'self' blob:",
    "media-src 'self' data: blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");

  const indexPath = path.join(outputRoot, "index.html");
  let indexHtml = await fs.readFile(indexPath, "utf8");
  indexHtml = indexHtml
    .replace(/<link rel="manifest"[^>]*>/g, "")
    .replace(/<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>/g, "")
    .replace("<head>", `<head>\n  <meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}">\n  <meta name="rhwp-version" content="${version}">`);
  await fs.writeFile(indexPath, indexHtml);

  const printPath = path.join(outputRoot, "print.html");
  let printHtml = await fs.readFile(printPath, "utf8");
  printHtml = printHtml.replace("<head>", `<head>\n  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:">`);
  await fs.writeFile(printPath, printHtml);

  await fs.copyFile(path.join(sourceRoot, "LICENSE"), path.join(outputRoot, "LICENSE.rhwp.txt"));
  await fs.copyFile(path.join(sourceRoot, "THIRD_PARTY_LICENSES.md"), path.join(outputRoot, "THIRD_PARTY_LICENSES.md"));

  const hashes = await hashFiles(outputRoot, new Set(["rhwp-vendor.json"]));
  const manifest = {
    name: "rhwp-studio",
    version,
    upstream: upstreamUrl.replace(/\.git$/, ""),
    tag,
    commit,
    packages: { "@rhwp/core": coreVersion, "@rhwp/editor": editorVersion },
    externalWebFonts: false,
    networkPolicy: "same-origin-only",
    files: hashes,
  };
  await fs.writeFile(path.join(outputRoot, "rhwp-vendor.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Vendored rhwp Studio ${version} (${commit.slice(0, 12)}) → ${path.relative(projectRoot, outputRoot)}`);
} finally {
  if (temporaryRoot) await fs.rm(temporaryRoot, { recursive: true, force: true });
}

async function run(command, args, options = {}) {
  const result = await execFileAsync(command, args, { ...options, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function hashFiles(root, excludedNames) {
  const result = {};
  const visit = async (directory) => {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (excludedNames.has(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      if (entry.isFile()) {
        const relative = path.relative(root, absolute).split(path.sep).join("/");
        result[relative] = createHash("sha256").update(await fs.readFile(absolute)).digest("hex");
      }
    }
  };
  await visit(root);
  return result;
}
