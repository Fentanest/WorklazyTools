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
if (manifest.packages?.["@rhwp/core"] !== version || manifest.packages?.["@rhwp/editor"] !== version) throw new Error("rhwp vendor 패키지 버전이 일치하지 않습니다.");
if (manifest.externalWebFonts !== false || manifest.networkPolicy !== "same-origin-only") throw new Error("rhwp vendor 네트워크 격리 설정이 누락되었습니다.");

const indexHtml = await fs.readFile(path.join(vendorRoot, "index.html"), "utf8");
if (!indexHtml.includes("Content-Security-Policy") || !indexHtml.includes(`name="rhwp-version" content="${version}"`)) throw new Error("rhwp Studio CSP 또는 버전 표기가 누락되었습니다.");
if (/vite-plugin-pwa:register-sw|rel="manifest"|edwardkim\.github\.io/i.test(indexHtml)) throw new Error("rhwp Studio에 외부/PWA 런타임 의존이 남아 있습니다.");

for (const [relative, expected] of Object.entries(manifest.files ?? {})) {
  const bytes = await fs.readFile(path.join(vendorRoot, relative));
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected) throw new Error(`rhwp vendor 파일 해시가 다릅니다: ${relative}`);
}

console.log(`rhwp Studio ${version} vendor validation passed (${Object.keys(manifest.files).length} files).`);
