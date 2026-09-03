import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const pyodideVersion = JSON.parse(await fs.readFile("node_modules/pyodide/package.json", "utf8")).version;
const stickerManifest = JSON.parse(await fs.readFile("src/features/image-studio/stickers.manifest.json", "utf8"));

const routes = [
  "", "tools", "tools/excel-merger", "tools/excel-compare", "tools/document-compare",
  "tools/pdf-editor", "tools/pdf-editor/image-to-pdf",
  "tools/pdf-editor/pdf-to-image", "tools/pdf-editor/convert",
  "tools/hwp-editor", "tools/office-editor", "tools/video-studio", "tools/audio-studio", "tools/image-studio",
  "tools/text-merger", "tools/text-tools", "tools/text-formatter", "tools/work-calculator",
  "tools/timezone-calculator", "tools/payroll-calculator", "tools/image-privacy",
  "tools/security-tools", "tools/qr-studio", "tools/data-converter",
  "about", "privacy", "terms", "contact", "licenses",
];
const socialSlugByRoute = {
  "tools/excel-merger": "excel-merger", "tools/excel-compare": "excel-compare", "tools/document-compare": "document-compare", "tools/pdf-editor": "pdf-tools",
  "tools/pdf-editor/image-to-pdf": "image-to-pdf", "tools/pdf-editor/pdf-to-image": "pdf-to-image", "tools/pdf-editor/convert": "pdf-convert",
  "tools/hwp-editor": "hwp-editor", "tools/office-editor": "office-editor", "tools/video-studio": "video-studio",
  "tools/audio-studio": "audio-studio", "tools/image-studio": "image-studio", "tools/text-merger": "text-merger", "tools/text-tools": "text-tools",
  "tools/text-formatter": "code-formatter", "tools/work-calculator": "workday-calculator", "tools/timezone-calculator": "world-time-planner",
  "tools/payroll-calculator": "payroll-calculator", "tools/image-privacy": "photo-metadata-remover", "tools/security-tools": "password-generator",
  "tools/qr-studio": "qr-studio", "tools/data-converter": "table-data-converter",
};

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
    'rel="manifest"',
    'rel="apple-touch-icon"',
  ];
  for (const marker of required) {
    if (!html.includes(marker)) throw new Error(`${filePath} is missing ${marker}`);
  }
  const socialSlug = socialSlugByRoute[route];
  if (socialSlug) {
    const socialPath = `social/tools/${socialSlug}-${language}.png`;
    if (!html.includes(`https://worklazy.net/${socialPath}`)) throw new Error(`${filePath} does not use its localized tool social image.`);
    const image = await fs.stat(path.join("dist", socialPath));
    if (image.size < 10_000) throw new Error(`${socialPath} is missing or unexpectedly small.`);
  }
  if (route === "tools/video-studio") {
    if (!html.includes('name="worklazy-video-isolation"') || !html.includes('data-worklazy-video-isolation') || !html.includes('./coi-serviceworker.js')) {
      throw new Error(`${filePath} is missing the document-scoped video isolation bootstrap.`);
    }
  } else if (html.includes('data-worklazy-video-isolation')) {
    throw new Error(`${filePath} must not load the video isolation service worker.`);
  }
  if (["tools/excel-merger", "tools/excel-compare", "tools/document-compare", "tools/office-editor", "tools/video-studio", "tools/text-merger"].includes(route)) {
    const expectedQuestion = route === "tools/excel-merger"
      ? language === "ko" ? "XLSX 수식과 서식을 따로 보존할 수 있나요?" : "Can XLSX formulas and formatting be preserved independently?"
      : route === "tools/excel-compare"
        ? language === "ko" ? "어떤 Excel 형식을 비교할 수 있나요?" : "Which Excel formats can I compare?"
      : route === "tools/document-compare"
        ? language === "ko" ? "DOC와 DOCX를 서로 비교할 수 있나요?" : "Can I compare DOC with DOCX?"
        : route === "tools/video-studio"
          ? language === "ko" ? "한 그룹의 영상 구간을 다른 그룹에도 적용할 수 있나요?" : "Can I apply one group's video ranges to other groups?"
        : route === "tools/text-merger"
          ? language === "ko" ? "직접 입력을 TXT 파일 사이에 놓을 수 있나요?" : "Can pasted text be placed between TXT files?"
          : language === "ko" ? "처음 실행 용량이 큰 이유는 무엇인가요?" : "Why is the first start large?";
    if (!html.includes('"@type":"FAQPage"') || !html.includes(expectedQuestion)) {
      throw new Error(`${filePath} is missing its localized static FAQ and FAQPage metadata.`);
    }
  }
  if (html.includes("#/")) throw new Error(`${filePath} still contains a hash route.`);
}
}

for (const language of ["ko", "en"]) {
  const filePath = path.join("dist", language, "tools", "office-editor", "app", "index.html");
  const html = await fs.readFile(filePath, "utf8");
  if (!html.includes('name="robots" content="noindex, nofollow"')
    || !html.includes('name="worklazy-office-isolation"')
    || !html.includes('data-worklazy-office-isolation')
    || !html.includes('./coi-serviceworker.js')
    || !html.includes(`/${language}/tools/office-editor/`)
    || html.includes("pagead2.googlesyndication.com/pagead/js/adsbygoogle.js")) {
    throw new Error(`${filePath} does not keep the office workspace noindex, isolated, canonicalized to its guide, and free of ad code.`);
  }
}

{
  const filePath = path.join("dist", "tools", "excel-merger", "xls-preserve", "index.html");
  const html = await fs.readFile(filePath, "utf8");
  if (!html.includes('name="robots" content="noindex, nofollow"')
    || !html.includes('name="worklazy-excel-preserve-isolation"')
    || !html.includes('data-worklazy-excel-preserve-isolation')
    || !html.includes('./coi-serviceworker.js')
    || !html.includes('<link rel="canonical" href="https://worklazy.net/ko/tools/excel-merger/" />')
    || html.includes('rel="alternate" hreflang=')
    || html.includes("pagead2.googlesyndication.com/pagead/js/adsbygoogle.js")) {
    throw new Error(`${filePath} does not keep the unprefixed XLS preservation workspace aligned with the Korean noindex and canonical policy.`);
  }
}

for (const language of ["ko", "en"]) {
  const filePath = path.join("dist", language, "tools", "excel-merger", "xls-preserve", "index.html");
  const html = await fs.readFile(filePath, "utf8");
  const expectedCanonical = `https://worklazy.net/${language}/tools/excel-merger/`;
  if (!html.includes('name="robots" content="noindex, nofollow"')
    || !html.includes('name="worklazy-excel-preserve-isolation"')
    || !html.includes('data-worklazy-excel-preserve-isolation')
    || !html.includes('./coi-serviceworker.js')
    || !html.includes(`<link rel="canonical" href="${expectedCanonical}" />`)
    || html.includes('rel="alternate" hreflang=')
    || html.includes("pagead2.googlesyndication.com/pagead/js/adsbygoogle.js")) {
    throw new Error(`${filePath} does not keep the XLS preservation workspace noindex, isolated, canonicalized only to its localized Excel Merger guide, excluded from hreflang, and free of ad code.`);
  }
}
{
  const unprefixedIsolationPath = path.join("dist", "tools", "excel-merger", "xls-preserve", "coi-serviceworker.js");
  const [unprefixedIsolationWorker, unprefixedIsolationText] = await Promise.all([
    fs.stat(unprefixedIsolationPath),
    fs.readFile(unprefixedIsolationPath, "utf8"),
  ]);
  if (unprefixedIsolationWorker.size < 1_000 || !unprefixedIsolationText.includes("caches.match(request)")
    || !unprefixedIsolationText.includes("vendor\\/zetaoffice") || !unprefixedIsolationText.includes("worklazy_coi_reload:")
    || !unprefixedIsolationText.includes("sessionStorage")) {
    throw new Error("The unprefixed XLS preservation route is missing its document-scoped preparation and asset-cache behavior.");
  }
}

const [ads, robots, sitemap, notFound] = await Promise.all([
  fs.readFile("dist/ads.txt", "utf8"),
  fs.readFile("dist/robots.txt", "utf8"),
  fs.readFile("dist/sitemap.xml", "utf8"),
  fs.readFile("dist/404.html", "utf8"),
]);

const [cname, worklazyLicense, thirdPartyLicenses, favicon, logo, manifestText, serviceWorker, installIcon180, installIcon192, installIcon512, socialImage, koreanSocialImage] = await Promise.all([
  fs.readFile("dist/CNAME", "utf8"),
  fs.readFile("dist/legal/worklazy-license.txt", "utf8"),
  fs.readFile("dist/legal/third-party-licenses.txt", "utf8"),
  fs.readFile("dist/icon.svg", "utf8"),
  fs.readFile("dist/logo.svg", "utf8"),
  fs.readFile("dist/site.webmanifest", "utf8"),
  fs.readFile("dist/service-worker.js", "utf8"),
  fs.stat("dist/icon-180.png"),
  fs.stat("dist/icon-192.png"),
  fs.stat("dist/icon-512.png"),
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
const officeAssets = [
  ["soffice.js", 858124, "5143e5354f470b87f86ba272bcfef857bd13e6f07b59666e48a7ccb89643cd77"],
  ["soffice.wasm", 161667499, "9ebd9a487e849a24b9c69f843ebdb451709c27b7722c010e36846433474a5bd4"],
  ["soffice.data", 99520604, "3dab0a5448e599dccc1b1e69f4f86ea9eb30777c3f1ed7b9c386a5f4163e361c"],
  ["soffice.data.js.metadata", 215180, "5d9d909d0b9b38443c0f19704032d0fc12d654f6c9c24c2c3b237739c4848ae3"],
  ["NanumGothic-Regular.ttf", 2054744, "76f45ef4a6bcff344c837c95a7dcc26e017e38b5846d5ae0cdcb5b86be2e2d31"],
  ["NanumGothic-OFL.txt", 4534, "eeacf16032901d0ed0456876ec77b8f0fda6b3fecec7d972f8543eb602e6c30f"],
];
for (const [name, expectedSize, expectedHash] of officeAssets) {
  const filePath = path.join("dist", "vendor", "zetaoffice", "2026-08-26", name);
  const bytes = await fs.readFile(filePath);
  if (bytes.length !== expectedSize || createHash("sha256").update(bytes).digest("hex") !== expectedHash) {
    throw new Error(`Pinned office asset verification failed in static output: ${name}`);
  }
}
if (stickerManifest.vendor !== "Twemoji" || stickerManifest.version !== "17.0.3" || stickerManifest.commit !== "b6b55fef1e8636b540a6d016a4729ca8cdf2e60b"
  || stickerManifest.curationLimit !== 120 || stickerManifest.assets.length !== 112 || stickerManifest.assets.length > stickerManifest.curationLimit) {
  throw new Error("The Image Studio sticker manifest version or curation limit is invalid.");
}
const stickerOutputRoot = path.join("dist", "vendor", "emoji", stickerManifest.version);
for (const asset of [...stickerManifest.assets, stickerManifest.license]) {
  const bytes = await fs.readFile(path.join(stickerOutputRoot, asset.file));
  if (bytes.length !== asset.bytes || createHash("sha256").update(bytes).digest("hex") !== asset.sha256) {
    throw new Error(`Pinned Image Studio sticker verification failed in static output: ${asset.file}`);
  }
}
const [sourceStickerManifest, outputStickerManifest] = await Promise.all([
  fs.readFile("src/features/image-studio/stickers.manifest.json"),
  fs.readFile(path.join(stickerOutputRoot, "manifest.json")),
]);
if (!sourceStickerManifest.equals(outputStickerManifest)) throw new Error("The emitted Image Studio sticker manifest does not match its source.");
const [officeThread, officeThreadSource] = await Promise.all([
  fs.readFile(path.join("dist", "vendor", "zetaoffice", "2026-08-26", "office_thread.js")),
  fs.readFile(path.join("src", "features", "office-editor", "office_thread.js")),
]);
if (officeThread.length !== 2983 || !officeThread.equals(officeThreadSource)) {
  throw new Error("The pinned office command bridge is missing or does not match the current source.");
}
for (const language of ["ko", "en"]) {
  for (const isolatedRoute of [["tools", "office-editor", "app"], ["tools", "excel-merger", "xls-preserve"]]) {
    const officeIsolationPath = path.join("dist", language, ...isolatedRoute, "coi-serviceworker.js");
    const [officeIsolationWorker, officeIsolationText] = await Promise.all([fs.stat(officeIsolationPath), fs.readFile(officeIsolationPath, "utf8")]);
    if (officeIsolationWorker.size < 1_000 || !officeIsolationText.includes("caches.match(request)") || !officeIsolationText.includes("vendor\\/zetaoffice")
      || !officeIsolationText.includes("worklazy_coi_reload:") || !officeIsolationText.includes("sessionStorage")) {
      throw new Error(`${language}/${isolatedRoute.join("/")} is missing its document-scoped preparation and asset-cache behavior.`);
    }
  }
}
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
if (!thirdPartyLicenses.includes("@ffmpeg/core-mt") || !thirdPartyLicenses.includes("coi-serviceworker") || !thirdPartyLicenses.includes("@rhwp/core")
  || !thirdPartyLicenses.includes("ZetaOffice / LibreOffice") || !thirdPartyLicenses.includes("zetajs") || !thirdPartyLicenses.includes("JSDoc legacy Word reader")
  || !thirdPartyLicenses.includes("Twemoji graphics 17.0.3") || !thirdPartyLicenses.includes("Attribution 4.0 International")) throw new Error("Third-party license bundle is incomplete.");
if (!favicon.includes("facet-4") || !logo.includes("Worklazy")) throw new Error("Worklazy favicon or logo is missing from the build.");
const manifest = JSON.parse(manifestText);
if (manifest.display !== "standalone" || manifest.scope !== "./" || manifest.start_url !== "./"
  || !manifest.icons?.some((icon) => icon.sizes === "192x192") || !manifest.icons?.some((icon) => icon.sizes === "512x512")) {
  throw new Error("The installable web app manifest is incomplete.");
}
if (!serviceWorker.includes('addEventListener("install"') || !serviceWorker.includes('addEventListener("fetch"') || !serviceWorker.includes('"credentialless"')
  || !serviceWorker.includes('Cross-Origin-Embedder-Policy') || !serviceWorker.includes('Cross-Origin-Opener-Policy')
  || !serviceWorker.includes('Cross-Origin-Resource-Policy') || !serviceWorker.includes('vendor\\/zetaoffice')
  || !serviceWorker.includes('event.request.destination === "worker"') || !serviceWorker.includes('event.request.destination === "sharedworker"')
  || installIcon180.size < 5_000 || installIcon192.size < 5_000 || installIcon512.size < 10_000) {
  throw new Error("The mobile web app service worker or install icons are incomplete.");
}
if (socialImage.length < 10_000 || koreanSocialImage.length < 10_000) throw new Error("A localized social preview image is missing or unexpectedly small.");
if (pyodideModule.size < 10_000 || pyodideWasm.size < 5_000_000) throw new Error("Self-hosted Pyodide runtime is incomplete.");
if (ocrWorker.size < 50_000 || ocrEnglish.size < 1_000_000 || ocrKorean.size < 1_000_000) throw new Error("Self-hosted Tesseract runtime or language data is incomplete.");
if (videoIsolationWorker.size < 1_000) throw new Error("Video isolation service worker is missing or unexpectedly small.");
if (!(await fs.readFile("dist/tools/video-studio/coi-serviceworker.js", "utf8")).includes("let coepCredentialless=!0;")) throw new Error("Video isolation service worker does not allow credentialless analytics requests.");
if (videoSingleCore.size < 30_000_000 || videoMultiCore.size < 30_000_000 || videoMultiWorker.size < 1_000) throw new Error("Document-scoped FFmpeg runtime is incomplete.");
if (!videoWorkerFiles.some((name) => name.startsWith("video.worker-")) || !videoWorkerFiles.some((name) => name.startsWith("video-probe.worker-")) || !videoWorkerFiles.some((name) => name.startsWith("video-zip.worker-"))) throw new Error("Video workers were emitted outside their isolated document scope.");
if (!assetFiles.some((name) => name.startsWith("audioProcessor.worker-"))) throw new Error("Audio processor worker is missing from the static build.");
if (!applicationJavaScript.includes("G-CFSK50SX9R") || !applicationJavaScript.includes("1025dd835558ee0") || !applicationJavaScript.includes("wcs.pstatic.net/wcslog.js")) throw new Error("Google or Naver Analytics configuration is missing from the application bundle.");
if (!robots.includes("Sitemap:")) throw new Error("robots.txt does not point to the sitemap.");
if (!notFound.includes('name="robots" content="noindex, nofollow"') || !notFound.includes('id="root"')) throw new Error("GitHub Pages SPA 404 fallback is missing or indexable.");
if (!robots.includes("https://worklazy.net/sitemap.xml")) throw new Error("robots.txt does not use the custom root domain.");
if (sitemap.includes("/worklazytools/")) throw new Error("sitemap.xml still contains the repository subpath.");
if (sitemap.includes("/tools/office-editor/app/") || sitemap.includes("/tools/excel-merger/xls-preserve/") || sitemap.includes("/tools/word-compare/") || sitemap.includes("/tools/hwp-compare/")) throw new Error("sitemap.xml contains a workspace or retired comparison route.");
for (const route of routes) {
  if (route && !sitemap.includes(`/ko/${route}/`)) throw new Error(`sitemap.xml is missing ko/${route}.`);
  if (route && route !== "tools/hwp-editor" && !sitemap.includes(`/en/${route}/`)) throw new Error(`sitemap.xml is missing en/${route}.`);
}
if (!sitemap.includes('xmlns:xhtml=') || !sitemap.includes('hreflang="x-default"')) throw new Error("sitemap.xml is missing multilingual alternate links.");

const [koreanFeatures, englishFeatures] = await Promise.all([
  fs.readFile("src/locales/ko/features.json", "utf8"),
  fs.readFile("src/locales/en/features.json", "utf8"),
]);
for (const forbidden of ["광고 스크립트를 불러오지", "광고 실행 환경", "FFmpeg", "오디오 Worker", "브라우저 실행 구성요소", "OCR WebAssembly", "ZIP Worker", "does not load advertising scripts", "ad execution", "analysis worker", "audio worker", "OCR runtime", "separate worker", "ZIP worker"]) {
  if (koreanFeatures.includes(forbidden) || englishFeatures.includes(forbidden)) throw new Error(`User-facing feature copy exposes implementation state: ${forbidden}`);
}
if (!koreanFeatures.includes("JPG·PNG·WebP를 지원하며 HEIC·HEIF는 지원하지 않습니다")
  || !englishFeatures.includes("JPG, PNG and WebP are supported; HEIC and HEIF are not")) {
  throw new Error("Photo metadata FAQ does not match the supported JPG, PNG and WebP inputs.");
}
const [koreanPages, englishPages] = await Promise.all([
  fs.readFile("src/locales/ko/pages.json", "utf8"),
  fs.readFile("src/locales/en/pages.json", "utf8"),
]);
if (!koreanPages.includes("비디오 스튜디오, 오피스 편집 작업 화면과 XLS 수식·서식 보존 화면은 AdSense 스크립트를 불러오지 않으며")
  || !koreanPages.includes("오피스 편집 작업 화면과 XLS 수식·서식 보존 화면은 방문 분석도 불러오지 않습니다")
  || !englishPages.includes("Video Studio, the office editing workspace and the XLS formula-and-formatting preservation screen do not load AdSense")
  || !englishPages.includes("office editing workspace and XLS preservation screen also do not load visit analytics")) {
  throw new Error("The privacy policy does not describe the isolated workspace analytics and ad exclusions accurately.");
}

console.log(`Static output validation passed: localized pages, hreflang metadata, self-hosted browser runtimes, ads.txt, robots.txt and sitemap.xml.`);
