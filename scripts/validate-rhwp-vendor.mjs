import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(await fs.readFile(path.join(projectRoot, "package.json"), "utf8"));
const version = packageJson.dependencies?.["@rhwp/core"];
if (!version || version !== packageJson.dependencies?.["@rhwp/editor"]) {
  throw new Error("rhwp core/editor 버전 고정이 일치하지 않습니다.");
}
const clientConfig = await fs.readFile(path.join(projectRoot, "src", "config", "rhwp.ts"), "utf8");
if (!clientConfig.includes(`RHWP_VERSION = "${version}"`)) throw new Error("화면의 rhwp 버전 표기와 패키지 버전이 일치하지 않습니다.");

const vendorRoot = path.join(projectRoot, "public", "vendor", "rhwp-studio", version);
const manifest = JSON.parse(await fs.readFile(path.join(vendorRoot, "rhwp-vendor.json"), "utf8"));
if (manifest.version !== version || manifest.tag !== `v${version}`) throw new Error("rhwp vendor 버전 메타데이터가 일치하지 않습니다.");
if (!/^[0-9a-f]{40}$/.test(manifest.commit ?? "")) throw new Error("rhwp vendor 커밋 메타데이터가 올바르지 않습니다.");
if (manifest.packages?.["@rhwp/core"] !== version || manifest.packages?.["@rhwp/editor"] !== version) throw new Error("rhwp vendor 패키지 버전이 일치하지 않습니다.");
if (manifest.externalWebFonts !== false || manifest.withoutHwpCtrl !== true || manifest.networkPolicy !== "same-origin-only") throw new Error("rhwp vendor 네트워크/플러그인 격리 설정이 누락되었습니다.");

const indexHtml = await fs.readFile(path.join(vendorRoot, "index.html"), "utf8");
if (!indexHtml.includes("Content-Security-Policy") || !indexHtml.includes(`name="rhwp-version" content="${version}"`)) throw new Error("rhwp Studio CSP 또는 버전 표기가 누락되었습니다.");
if (/vite-plugin-pwa:register-sw|rel="manifest"|edwardkim\.github\.io/i.test(indexHtml)) throw new Error("rhwp Studio에 외부/PWA 런타임 의존이 남아 있습니다.");

const expectedFiles = manifest.files;
if (!expectedFiles || Array.isArray(expectedFiles) || typeof expectedFiles !== "object") {
  throw new Error("rhwp vendor manifest 파일 목록이 올바르지 않습니다.");
}
const actualFiles = await listFiles(vendorRoot, new Set(["rhwp-vendor.json"]));
const expectedPaths = Object.keys(expectedFiles).sort((left, right) => left.localeCompare(right));
const actualPaths = actualFiles.sort((left, right) => left.localeCompare(right));
const missing = expectedPaths.filter((relative) => !actualPaths.includes(relative));
const unexpected = actualPaths.filter((relative) => !expectedPaths.includes(relative));
if (missing.length || unexpected.length) {
  throw new Error(`rhwp vendor 파일 집합이 manifest와 다릅니다: missing=[${missing.join(", ")}], unexpected=[${unexpected.join(", ")}]`);
}

const pwaFiles = actualPaths.filter((relative) => isPwaArtifact(path.posix.basename(relative)));
if (pwaFiles.length) throw new Error(`rhwp Studio PWA 파일이 남아 있습니다: ${pwaFiles.join(", ")}`);
const studioPluginFiles = actualPaths.filter((relative) => /(^|\/)studio-plugin-[^/]+\.js$/.test(relative));
if (studioPluginFiles.length) throw new Error(`rhwp Studio에 HwpCtrl 플러그인 청크가 남아 있습니다: ${studioPluginFiles.join(", ")}`);

for (const relative of expectedPaths) {
  if (path.posix.isAbsolute(relative) || relative.split("/").includes("..")) {
    throw new Error(`rhwp vendor manifest에 안전하지 않은 경로가 있습니다: ${relative}`);
  }
  const expected = expectedFiles[relative];
  if (!expected || !Number.isSafeInteger(expected.bytes) || expected.bytes < 0 || !/^[0-9a-f]{64}$/.test(expected.sha256 ?? "")) {
    throw new Error(`rhwp vendor manifest 파일 메타데이터가 올바르지 않습니다: ${relative}`);
  }
  const bytes = await fs.readFile(path.join(vendorRoot, relative));
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (bytes.byteLength !== expected.bytes) throw new Error(`rhwp vendor 파일 크기가 다릅니다: ${relative}`);
  if (actual !== expected.sha256) throw new Error(`rhwp vendor 파일 해시가 다릅니다: ${relative}`);
}

const totalBytes = Object.values(expectedFiles).reduce((sum, file) => sum + file.bytes, 0);
console.log(`rhwp Studio ${version} vendor validation passed (${expectedPaths.length} files, ${totalBytes} bytes).`);

function isPwaArtifact(fileName) {
  return fileName === "registerSW.js"
    || fileName === "sw.js"
    || fileName === "manifest.webmanifest"
    || /^workbox-.*\.js$/.test(fileName);
}

async function listFiles(root, excludedNames) {
  const result = [];
  const visit = async (directory) => {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      if (excludedNames.has(relative)) continue;
      if (entry.isDirectory()) await visit(absolute);
      if (entry.isFile()) result.push(relative);
    }
  };
  await visit(root);
  return result;
}
