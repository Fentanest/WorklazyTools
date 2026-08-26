import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);
const publicVendorRoot = path.join(projectRoot, "public", "vendor");

await copyPyodide();
await copyTesseract();
await copyVideoRuntime();
await vendorZetaOffice();

async function copyPyodide() {
  const source = path.join(projectRoot, "node_modules", "pyodide");
  const packageMetadata = JSON.parse(await fs.readFile(path.join(source, "package.json"), "utf8"));
  const declaredVersion = JSON.parse(await fs.readFile(path.join(projectRoot, "package.json"), "utf8")).dependencies?.pyodide;
  if (!packageMetadata.version || packageMetadata.version !== declaredVersion) {
    throw new Error(`Pyodide version mismatch: package.json=${declaredVersion ?? "missing"}, installed=${packageMetadata.version ?? "missing"}`);
  }
  const destination = path.join(publicVendorRoot, "pyodide", packageMetadata.version);
  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(destination, { recursive: true });
  await Promise.all([
    "pyodide-lock.json",
    "pyodide.asm.js",
    "pyodide.asm.wasm",
    "pyodide.mjs",
    "python_stdlib.zip",
  ].map((fileName) => fs.copyFile(path.join(source, fileName), path.join(destination, fileName))));
}

async function copyTesseract() {
  const destination = path.join(publicVendorRoot, "tesseract", "7.0.0");
  const coreSource = path.join(projectRoot, "node_modules", "tesseract.js-core");
  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(path.join(destination, "core"), { recursive: true });
  await fs.mkdir(path.join(destination, "lang"), { recursive: true });

  await fs.copyFile(
    path.join(projectRoot, "node_modules", "tesseract.js", "dist", "worker.min.js"),
    path.join(destination, "worker.min.js"),
  );
  const coreFiles = (await fs.readdir(coreSource)).filter((fileName) => /^tesseract-core.*\.wasm\.js$/.test(fileName));
  await Promise.all(coreFiles.map((fileName) => fs.copyFile(path.join(coreSource, fileName), path.join(destination, "core", fileName))));
  await Promise.all(["eng", "kor"].map((language) => fs.copyFile(
    path.join(projectRoot, "node_modules", "@tesseract.js-data", language, "4.0.0_best_int", `${language}.traineddata.gz`),
    path.join(destination, "lang", `${language}.traineddata.gz`),
  )));
}

async function copyVideoRuntime() {
  const destination = path.join(projectRoot, "public", "tools", "video-studio", "runtime");
  const ffmpegWorkerSource = path.join(projectRoot, "node_modules", "@ffmpeg", "ffmpeg", "dist", "esm");
  const singleCoreSource = path.join(projectRoot, "node_modules", "@ffmpeg", "core", "dist", "esm");
  const multiCoreSource = path.join(projectRoot, "node_modules", "@ffmpeg", "core-mt", "dist", "esm");
  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(path.join(destination, "single"), { recursive: true });
  await fs.mkdir(path.join(destination, "multi"), { recursive: true });

  await Promise.all([
    [path.join(ffmpegWorkerSource, "worker.js"), path.join(destination, "ffmpeg-worker.js")],
    [path.join(ffmpegWorkerSource, "const.js"), path.join(destination, "const.js")],
    [path.join(ffmpegWorkerSource, "errors.js"), path.join(destination, "errors.js")],
    [path.join(singleCoreSource, "ffmpeg-core.js"), path.join(destination, "single", "ffmpeg-core.js")],
    [path.join(singleCoreSource, "ffmpeg-core.wasm"), path.join(destination, "single", "ffmpeg-core.wasm")],
    [path.join(multiCoreSource, "ffmpeg-core.js"), path.join(destination, "multi", "ffmpeg-core.js")],
    [path.join(multiCoreSource, "ffmpeg-core.wasm"), path.join(destination, "multi", "ffmpeg-core.wasm")],
    [path.join(multiCoreSource, "ffmpeg-core.worker.js"), path.join(destination, "multi", "ffmpeg-core.worker.js")],
  ].map(([source, target]) => fs.copyFile(source, target)));
}

async function vendorZetaOffice() {
  const version = "2026-08-26";
  const sourceSnapshotVersion = "2026-08-25";
  const sourceBaseUrl = process.env.ZETAOFFICE_ASSET_BASE_URL || "https://cdn.zetaoffice.net/zetaoffice_latest/";
  const cacheDirectory = path.join(projectRoot, ".cache", "zetaoffice", sourceSnapshotVersion);
  const destination = path.join(publicVendorRoot, "zetaoffice", version);
  const assets = [
    { name: "soffice.js", size: 858124, sha256: "5143e5354f470b87f86ba272bcfef857bd13e6f07b59666e48a7ccb89643cd77" },
    { name: "soffice.wasm", size: 161667499, sha256: "9ebd9a487e849a24b9c69f843ebdb451709c27b7722c010e36846433474a5bd4" },
    { name: "soffice.data", size: 99520604, sha256: "3dab0a5448e599dccc1b1e69f4f86ea9eb30777c3f1ed7b9c386a5f4163e361c" },
    { name: "soffice.data.js.metadata", size: 215180, sha256: "5d9d909d0b9b38443c0f19704032d0fc12d654f6c9c24c2c3b237739c4848ae3" },
  ];
  const editorFontAssets = [
    {
      name: "NanumGothic-Regular.ttf",
      size: 2054744,
      sha256: "76f45ef4a6bcff344c837c95a7dcc26e017e38b5846d5ae0cdcb5b86be2e2d31",
      sourceUrl: "https://raw.githubusercontent.com/google/fonts/6a003b5eb672dc8bf5bff5937cf5863f8b175445/ofl/nanumgothic/NanumGothic-Regular.ttf",
    },
  ];
  const fontLicenseAssets = [{
    name: "NanumGothic-OFL.txt",
    size: 4534,
    sha256: "eeacf16032901d0ed0456876ec77b8f0fda6b3fecec7d972f8543eb602e6c30f",
    sourceUrl: "https://raw.githubusercontent.com/google/fonts/6a003b5eb672dc8bf5bff5937cf5863f8b175445/ofl/nanumgothic/OFL.txt",
  }];
  const allAssets = [...assets, ...editorFontAssets, ...fontLicenseAssets];
  await fs.mkdir(cacheDirectory, { recursive: true });
  for (const asset of allAssets) {
    const target = path.join(cacheDirectory, asset.name);
    if (!(await matchesAsset(target, asset))) {
      const response = await fetch(asset.sourceUrl ?? new URL(asset.name, ensureTrailingSlash(sourceBaseUrl)), {
        headers: { "Accept-Encoding": "identity" },
      });
      if (!response.ok || !response.body) throw new Error(`Unable to download pinned office asset ${asset.name}: HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      await fs.writeFile(target, bytes);
      if (!(await matchesAsset(target, asset))) {
        await fs.rm(target, { force: true });
        throw new Error(`Pinned office asset verification failed: ${asset.name}`);
      }
    }
  }
  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(destination, { recursive: true });
  await Promise.all(allAssets.map((asset) => fs.copyFile(path.join(cacheDirectory, asset.name), path.join(destination, asset.name))));
  await Promise.all([
    fs.copyFile(path.join(projectRoot, "node_modules", "zetajs", "source", "zeta.js"), path.join(destination, "zeta.js")),
    fs.copyFile(path.join(projectRoot, "src", "features", "office-editor", "office_thread.js"), path.join(destination, "office_thread.js")),
  ]);
  await fs.writeFile(path.join(destination, "manifest.json"), `${JSON.stringify({ version, assets, editorFontAssets, fontLicenseAssets }, null, 2)}\n`);
}

async function matchesAsset(filePath, asset) {
  try {
    const stats = await fs.stat(filePath);
    if (stats.size !== asset.size) return false;
    const { createHash } = await import("node:crypto");
    const bytes = await fs.readFile(filePath);
    return createHash("sha256").update(bytes).digest("hex") === asset.sha256;
  } catch {
    return false;
  }
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
