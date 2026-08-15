import fs from "node:fs/promises";
import path from "node:path";

const pyodideVersion = JSON.parse(await fs.readFile("node_modules/pyodide/package.json", "utf8")).version;

const routes = [
  "", "tools", "tools/excel-merger", "tools/word-compare",
  "tools/pdf-editor", "tools/pdf-editor/image-to-pdf",
  "tools/pdf-editor/pdf-to-image", "tools/pdf-editor/convert",
  "tools/hwp-editor", "tools/hwp-compare", "tools/video-studio", "tools/audio-studio", "tools/image-studio",
  "tools/text-tools", "tools/text-formatter", "tools/work-calculator",
  "tools/timezone-calculator", "tools/payroll-calculator", "tools/image-privacy",
  "tools/security-tools", "tools/qr-studio", "tools/data-converter",
  "about", "privacy", "terms", "contact", "licenses",
];

for (const language of ["ko", "en"]) {
for (const route of routes) {
  if (language === "en" && route === "tools/hwp-editor") continue;
  const filePath = path.join("dist", language, route, "index.html");
  const html = await fs.readFile(filePath, "utf8");
  const required = [
    "<title>",
    'name="description"',
    'rel="canonical"',
    'hreflang="ko"',
    'hreflang="en"',
    'hreflang="x-default"',
    'property="og:title"',
    'property="og:image"',
    'property="og:image:width" content="1200"',
    'name="twitter:card" content="summary_large_image"',
    'name="twitter:image"',
    'type="application/ld+json"',
    'class="seo-static-fallback"',
    'name="google-adsense-account"',
  ];
  for (const marker of required) {
    if (!html.includes(marker)) throw new Error(`${filePath} is missing ${marker}`);
  }
  if (route === "tools/video-studio") {
    if (!html.includes('name="worklazy-video-isolation"') || !html.includes('data-worklazy-video-isolation') || !html.includes('./coi-serviceworker.js')) {
      throw new Error(`${filePath} is missing the document-scoped video isolation bootstrap.`);
    }
  } else if (html.includes('data-worklazy-video-isolation')) {
    throw new Error(`${filePath} must not load the video isolation service worker.`);
  }
  if (html.includes("#/")) throw new Error(`${filePath} still contains a hash route.`);
}
}

const [ads, robots, sitemap, notFound] = await Promise.all([
  fs.readFile("dist/ads.txt", "utf8"),
  fs.readFile("dist/robots.txt", "utf8"),
  fs.readFile("dist/sitemap.xml", "utf8"),
  fs.readFile("dist/404.html", "utf8"),
]);

const [cname, worklazyLicense, thirdPartyLicenses, favicon, logo, socialImage, koreanSocialImage] = await Promise.all([
  fs.readFile("dist/CNAME", "utf8"),
  fs.readFile("dist/legal/worklazy-license.txt", "utf8"),
  fs.readFile("dist/legal/third-party-licenses.txt", "utf8"),
  fs.readFile("dist/icon.svg", "utf8"),
  fs.readFile("dist/logo.svg", "utf8"),
  fs.readFile("dist/social/worklazy-tools-share.png"),
  fs.readFile("dist/social/worklazy-tools-share-ko.png"),
]);
const [pyodideModule, pyodideWasm, ocrWorker, ocrEnglish, ocrKorean, videoIsolationWorker, videoSingleCore, videoMultiCore, videoMultiWorker] = await Promise.all([
  fs.stat(`dist/vendor/pyodide/${pyodideVersion}/pyodide.mjs`),
  fs.stat(`dist/vendor/pyodide/${pyodideVersion}/pyodide.asm.wasm`),
  fs.stat("dist/vendor/tesseract/7.0.0/worker.min.js"),
  fs.stat("dist/vendor/tesseract/7.0.0/lang/eng.traineddata.gz"),
  fs.stat("dist/vendor/tesseract/7.0.0/lang/kor.traineddata.gz"),
  fs.stat("dist/tools/video-studio/coi-serviceworker.js"),
  fs.stat("dist/tools/video-studio/runtime/single/ffmpeg-core.wasm"),
  fs.stat("dist/tools/video-studio/runtime/multi/ffmpeg-core.wasm"),
  fs.stat("dist/tools/video-studio/runtime/multi/ffmpeg-core.worker.js"),
]);
const videoWorkerFiles = await fs.readdir("dist/tools/video-studio/workers");
for (const language of ["ko", "en"]) {
  const localizedVideoRoot = path.join("dist", language, "tools", "video-studio");
  const [localizedIsolationWorker, localizedSingleCore, localizedMultiCore, localizedMultiWorker] = await Promise.all([
    fs.stat(path.join(localizedVideoRoot, "coi-serviceworker.js")),
    fs.stat(path.join(localizedVideoRoot, "runtime", "single", "ffmpeg-core.wasm")),
    fs.stat(path.join(localizedVideoRoot, "runtime", "multi", "ffmpeg-core.wasm")),
    fs.stat(path.join(localizedVideoRoot, "runtime", "multi", "ffmpeg-core.worker.js")),
  ]);
  const localizedVideoWorkers = await fs.readdir(path.join(localizedVideoRoot, "workers"));
  if (localizedIsolationWorker.size < 1_000
    || localizedSingleCore.size < 30_000_000
    || localizedMultiCore.size < 30_000_000
    || localizedMultiWorker.size < 1_000) {
    throw new Error(`${language} video page is missing its document-scoped FFmpeg runtime.`);
  }
  if (!localizedVideoWorkers.some((name) => name.startsWith("video.worker-"))
    || !localizedVideoWorkers.some((name) => name.startsWith("video-probe.worker-"))
    || !localizedVideoWorkers.some((name) => name.startsWith("video-zip.worker-"))) {
    throw new Error(`${language} video workers were emitted outside their localized document scope.`);
  }
}
const assetFiles = await fs.readdir("dist/assets");
const applicationJavaScript = (await Promise.all(
  assetFiles.filter((name) => name.endsWith(".js")).map((name) => fs.readFile(path.join("dist/assets", name), "utf8")),
)).join("\n");

if (!ads.includes("pub-8940087269746960")) throw new Error("ads.txt publisher ID is missing.");
if (cname.trim() !== "worklazy.net") throw new Error("CNAME does not point to worklazy.net.");
if (!worklazyLicense.includes("All rights reserved")) throw new Error("Worklazy proprietary license is missing.");
if (!thirdPartyLicenses.includes("@ffmpeg/core-mt") || !thirdPartyLicenses.includes("coi-serviceworker") || !thirdPartyLicenses.includes("@rhwp/core")) throw new Error("Third-party license bundle is incomplete.");
if (!favicon.includes("facet-4") || !logo.includes("Worklazy")) throw new Error("Worklazy favicon or logo is missing from the build.");
if (socialImage.length < 10_000 || koreanSocialImage.length < 10_000) throw new Error("A localized social preview image is missing or unexpectedly small.");
if (pyodideModule.size < 10_000 || pyodideWasm.size < 5_000_000) throw new Error("Self-hosted Pyodide runtime is incomplete.");
if (ocrWorker.size < 50_000 || ocrEnglish.size < 1_000_000 || ocrKorean.size < 1_000_000) throw new Error("Self-hosted Tesseract runtime or language data is incomplete.");
if (videoIsolationWorker.size < 1_000) throw new Error("Video isolation service worker is missing or unexpectedly small.");
if (videoSingleCore.size < 30_000_000 || videoMultiCore.size < 30_000_000 || videoMultiWorker.size < 1_000) throw new Error("Document-scoped FFmpeg runtime is incomplete.");
if (!videoWorkerFiles.some((name) => name.startsWith("video.worker-")) || !videoWorkerFiles.some((name) => name.startsWith("video-probe.worker-")) || !videoWorkerFiles.some((name) => name.startsWith("video-zip.worker-"))) throw new Error("Video workers were emitted outside their isolated document scope.");
if (!assetFiles.some((name) => name.startsWith("audioProcessor.worker-"))) throw new Error("Audio processor worker is missing from the static build.");
if (!applicationJavaScript.includes("G-CFSK50SX9R") || !applicationJavaScript.includes("1025dd835558ee0") || !applicationJavaScript.includes("wcs.pstatic.net/wcslog.js")) throw new Error("Google or Naver Analytics configuration is missing from the application bundle.");
if (!robots.includes("Sitemap:")) throw new Error("robots.txt does not point to the sitemap.");
if (!notFound.includes('name="robots" content="noindex, nofollow"') || !notFound.includes('id="root"')) throw new Error("GitHub Pages SPA 404 fallback is missing or indexable.");
if (!robots.includes("https://worklazy.net/sitemap.xml")) throw new Error("robots.txt does not use the custom root domain.");
if (sitemap.includes("/worklazytools/")) throw new Error("sitemap.xml still contains the repository subpath.");
for (const route of routes) {
  if (route && !sitemap.includes(`/ko/${route}/`)) throw new Error(`sitemap.xml is missing ko/${route}.`);
  if (route && route !== "tools/hwp-editor" && !sitemap.includes(`/en/${route}/`)) throw new Error(`sitemap.xml is missing en/${route}.`);
}
if (!sitemap.includes('xmlns:xhtml=') || !sitemap.includes('hreflang="x-default"')) throw new Error("sitemap.xml is missing multilingual alternate links.");

console.log(`Static output validation passed: localized pages, hreflang metadata, self-hosted browser runtimes, ads.txt, robots.txt and sitemap.xml.`);
