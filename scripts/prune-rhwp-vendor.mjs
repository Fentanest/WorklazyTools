import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(await fs.readFile(path.join(projectRoot, "package.json"), "utf8"));
const currentVersion = packageJson.dependencies?.["@rhwp/core"];
const editorVersion = packageJson.dependencies?.["@rhwp/editor"];
const staleVersion = process.argv[2];
const allowedStaleVersions = new Set(["0.8.4"]);

if (!currentVersion || currentVersion !== editorVersion) {
  throw new Error("rhwp core/editor 버전 고정이 일치하지 않습니다.");
}
if (!allowedStaleVersions.has(staleVersion)) {
  throw new Error(`제거가 허용되지 않은 rhwp snapshot 버전입니다: ${staleVersion || "(없음)"}`);
}
if (staleVersion === currentVersion) {
  throw new Error(`현재 사용 중인 rhwp snapshot은 제거할 수 없습니다: ${currentVersion}`);
}

const vendorParent = path.join(projectRoot, "public", "vendor", "rhwp-studio");
const staleRoot = path.resolve(vendorParent, staleVersion);
if (path.dirname(staleRoot) !== vendorParent) throw new Error("rhwp snapshot 제거 경로가 안전하지 않습니다.");

try {
  const metadata = await fs.stat(staleRoot);
  if (!metadata.isDirectory()) throw new Error(`rhwp snapshot 경로가 디렉터리가 아닙니다: ${staleVersion}`);
} catch (error) {
  if (error?.code === "ENOENT") {
    console.log(`rhwp Studio ${staleVersion} snapshot is already absent.`);
    process.exit(0);
  }
  throw error;
}

await fs.rm(staleRoot, { recursive: true });
console.log(`Removed stale rhwp Studio snapshot ${staleVersion}. Current version is ${currentVersion}.`);
