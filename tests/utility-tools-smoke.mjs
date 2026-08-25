import puppeteer from "puppeteer-core";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
const koBaseUrl = `${baseUrl}/ko`;
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  page.setDefaultTimeout(60_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(baseUrl, { waitUntil: "networkidle0" });
  await page.evaluate(() => localStorage.removeItem("worklazy_lang"));
  await page.reload({ waitUntil: "networkidle0" });
  const landingLines = await page.evaluate(() => ({
    title: Array.from(document.querySelectorAll(".language-landing-card h1 span"), (element) => element.textContent),
    description: Array.from(document.querySelectorAll(".language-landing-description span"), (element) => element.textContent),
  }));
  if (landingLines.title.join("|") !== "Choose your language|언어를 선택하세요"
    || landingLines.description.join("|") !== "Your choice is saved only in this browser.|선택한 언어는 이 브라우저에만 저장됩니다.") {
    throw new Error(`Language landing copy is not split into bilingual lines: ${JSON.stringify(landingLines)}`);
  }

  await page.goto(koBaseUrl, { waitUntil: "networkidle0" });
  await page.waitForSelector(".privacy-consent");
  await page.click(".privacy-consent .primary-button");
  await page.waitForFunction(() => localStorage.getItem("worklazy_privacy_consent") === "granted");
  await page.waitForFunction(() => (window.dataLayer || []).some((item) => Object.prototype.toString.call(item) === "[object Arguments]" && item[0] === "event" && item[1] === "page_view"));
  const analyticsBootstrap = await page.evaluate(() => ({
    google: Boolean(document.querySelector("script[data-worklazy-google-analytics]")),
    naver: Boolean(document.querySelector("script[data-worklazy-naver-analytics]")),
    malformedCommands: (window.dataLayer || []).filter((item) => Array.isArray(item) && typeof item[0] === "string").length,
  }));
  if (!analyticsBootstrap.google || !analyticsBootstrap.naver || analyticsBootstrap.malformedCommands) {
    throw new Error(`Analytics bootstrap is incomplete or uses malformed gtag commands: ${JSON.stringify(analyticsBootstrap)}`);
  }
  const homeKicker = await page.$eval(".hero-kicker", (element) => element.textContent);
  if (!homeKicker?.includes("작지만 유용한 업무 도구")) throw new Error(`Home kicker is outdated: ${homeKicker}`);
  const homeFeedback = await page.$eval(".hero-feedback", (element) => ({
    text: element.textContent || "",
    href: element.querySelector("a")?.href || "",
    target: element.querySelector("a")?.target || "",
  }));
  if (!homeFeedback.text.includes("기능 개선 제안이나 버그 문의") || !homeFeedback.href.endsWith("/Fentanest/WorklazyTools/issues") || homeFeedback.target !== "_blank") {
    throw new Error(`Home GitHub Issues guidance is incomplete: ${JSON.stringify(homeFeedback)}`);
  }

  await page.goto(`${koBaseUrl}/tools`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelectorAll(".all-tools-grid .tool-card").length === 17);
  const grid = await page.$eval(".all-tools-grid", (element) => ({ columns: getComputedStyle(element).gridTemplateColumns.split(" ").length, width: element.getBoundingClientRect().width }));
  if (grid.columns !== 4 || grid.width < 900) throw new Error(`Tool grid is not four columns: ${JSON.stringify(grid)}`);
  const categoryOverview = await page.evaluate(() => ({
    filters: document.querySelectorAll(".tool-category-filter button").length,
    sections: document.querySelectorAll(".tool-category-section").length,
    headings: Array.from(document.querySelectorAll(".tool-category-heading h2"), (element) => element.textContent),
    repeatedLocalBadges: document.querySelectorAll(".local-badge").length,
  }));
  if (categoryOverview.filters !== 6 || categoryOverview.sections !== 5 || categoryOverview.repeatedLocalBadges !== 0 || !categoryOverview.headings.includes("이미지·영상·오디오")) {
    throw new Error(`Tool categories are incomplete: ${JSON.stringify(categoryOverview)}`);
  }
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  await page.waitForFunction(() => window.matchMedia("(prefers-color-scheme: dark)").matches && getComputedStyle(document.querySelector(".tool-category-filter button.selected")).color !== "rgb(255, 255, 255)");
  const darkSelectedText = await page.$eval(".tool-category-filter button.selected", (element) => getComputedStyle(element).color);
  if (darkSelectedText === "rgb(255, 255, 255)") throw new Error("Selected tool category still uses invisible white text in dark mode.");
  await page.click('.tool-category-filter button[aria-label^="이미지·영상·오디오"]');
  await page.waitForFunction(() => new URLSearchParams(location.search).get("category") === "media" && document.querySelectorAll(".tool-category-section").length === 1 && document.querySelectorAll(".tool-card").length === 3);
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await page.click(".tool-category-filter button:first-child");
  await page.type('.tool-search input[aria-label="도구 검색"]', "비밀번호");
  await page.waitForFunction(() => document.querySelectorAll(".tool-category-section").length === 1 && document.querySelectorAll(".tool-card").length === 1 && document.querySelector(".tool-category-heading h2")?.textContent === "보안·공유");
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${koBaseUrl}/tools`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".all-tools-grid .tool-card");
  const mobileToolsLayout = await page.evaluate(() => ({
    columns: getComputedStyle(document.querySelector(".all-tools-grid")).gridTemplateColumns.split(" ").length,
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    categoryScrollable: document.querySelector(".tool-category-filter").scrollWidth > document.querySelector(".tool-category-filter").clientWidth,
  }));
  if (mobileToolsLayout.columns !== 1 || mobileToolsLayout.pageWidth > mobileToolsLayout.viewportWidth + 1 || !mobileToolsLayout.categoryScrollable) {
    throw new Error(`Mobile tool categories overflow incorrectly: ${JSON.stringify(mobileToolsLayout)}`);
  }
  await page.waitForSelector(".app-install-button");
  await page.evaluate(() => {
    window.__installPromptCalls = 0;
    window.__installChoiceResolved = false;
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.defineProperties(event, {
      prompt: { value: async () => { window.__installPromptCalls += 1; } },
      userChoice: { value: Promise.resolve({ outcome: "dismissed", platform: "web" }).then((choice) => {
        window.__installChoiceResolved = true;
        return choice;
      }) },
    });
    window.dispatchEvent(event);
  });
  await page.click(".app-install-button");
  await page.waitForFunction(() => window.__installPromptCalls === 1 && window.__installChoiceResolved);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.click(".app-install-button");
  await page.waitForSelector(".install-sheet");
  const installFallback = await page.$eval(".install-sheet", (element) => element.textContent || "");
  if (!installFallback.includes("홈 화면에 추가") || !installFallback.includes("브라우저 메뉴")) throw new Error(`Mobile install fallback is incomplete: ${installFallback}`);
  await page.click(".install-sheet .secondary-button");
  const pwaRegistration = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration(new URL("/", location.origin));
    return registration?.active?.scriptURL || registration?.installing?.scriptURL || registration?.waiting?.scriptURL || "";
  });
  if (!pwaRegistration.endsWith("/service-worker.js")) throw new Error(`PWA service worker is not registered: ${pwaRegistration}`);
  await page.setViewport({ width: 1440, height: 1000 });

  await page.goto(`${koBaseUrl}/tools/text-tools`, { waitUntil: "networkidle0" });
  await assertPairedEditors(page, "text-tools");
  await page.type(".utility-editor-grid textarea", "할수  있습니다\n할수  있습니다");
  await page.click(".utility-action-grid button:nth-child(2)");
  await page.waitForFunction(() => document.querySelectorAll(".utility-editor-grid textarea")[1]?.value.includes("할수 있습니다"));
  await clickButton(page, "브라우저 내장 규칙 검사");
  await page.waitForFunction(() => document.querySelector(".utility-summary")?.textContent?.includes("내장 규칙"));

  await page.goto(`${koBaseUrl}/tools/text-formatter`, { waitUntil: "networkidle0" });
  await assertPairedEditors(page, "text-formatter");
  await page.type(".utility-editor-grid textarea", '{"name":"Worklazy","ok":true}');
  await clickButton(page, "들여쓰기 정돈");
  await page.waitForFunction(() => document.querySelectorAll(".utility-editor-grid textarea")[1]?.value.includes('\n  "name"'));

  await page.goto(`${koBaseUrl}/tools/work-calculator`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".metric-grid article:nth-child(2)");
  const businessDays = await page.$eval(".metric-grid article:nth-child(2) strong", (element) => element.textContent);
  if (!businessDays?.includes("일")) throw new Error("Business-day result is missing.");

  await page.goto(`${koBaseUrl}/tools/timezone-calculator`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelectorAll(".world-map-pin").length === 44);
  await page.waitForFunction(() => document.querySelectorAll(".world-clock-grid article").length === 4);
  const timezoneMetaFont = await page.$eval(".world-clock-grid article > small", (element) => Number.parseFloat(getComputedStyle(element).fontSize));
  if (timezoneMetaFont < 13) throw new Error(`Timezone comparison copy is too small: ${timezoneMetaFont}px`);
  await page.$eval('.world-map-pin[aria-label^="두바이"]', (element) => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  await page.waitForFunction(() => document.querySelectorAll(".world-clock-grid article").length === 5);
  await page.type('.city-search-field input', "시드니");
  await page.waitForSelector(".city-search-results button");
  await page.click(".city-search-results button");
  await page.waitForFunction(() => document.querySelectorAll(".world-clock-grid article").length === 6);
  await page.click('.world-map-controls button[aria-label="지도 확대"]');
  await page.waitForFunction(() => document.querySelector(".world-map-controls output")?.textContent === "150%");

  await page.goto(`${koBaseUrl}/tools/payroll-calculator`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".payroll-hero strong");
  await page.click(".mode-switch button:nth-child(2)");
  await page.waitForSelector(".payroll-breakdown");
  const standard = await page.$eval(".payroll-page", (element) => element.textContent || "");
  if (!standard.includes("2026-07-01") || !standard.includes("4.75")) throw new Error(`Payroll standard is incomplete: ${standard}`);

  await page.goto(`${koBaseUrl}/tools/security-tools`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelector(".password-output input")?.value.length === 20);
  await page.click(".primary-button");
  await page.waitForSelector(".strength-meter");
  const passwordStrengthCopy = await page.$eval(".security-page", (element) => element.textContent || "");
  if (!passwordStrengthCopy.includes("예상 해독 시간") || !passwordStrengthCopy.includes("초당 100억 회") || passwordStrengthCopy.includes("오프라인 고속 공격") || passwordStrengthCopy.includes("centuries")) {
    throw new Error(`Password strength explanation is unclear: ${passwordStrengthCopy}`);
  }

  await page.goto(`${koBaseUrl}/tools/qr-studio`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => { const canvas = document.querySelector(".qr-preview canvas"); return canvas instanceof HTMLCanvasElement && canvas.width >= 600; });
  const qrFixture = await page.$eval(".qr-preview canvas", (canvas) => canvas.toDataURL("image/png"));
  await page.click(".mode-switch button:nth-child(2)");
  await page.waitForSelector(".qr-camera-stage video[playsinline]");
  const cameraCopy = await page.$eval(".qr-scan-layout", (element) => element.textContent);
  if (!cameraCopy?.includes("카메라로 스캔")) throw new Error("Live QR camera scanner is missing.");
  await page.setViewport({ width: 390, height: 844 });
  await page.evaluate(async (dataUrl) => {
    const blob = await (await fetch(dataUrl)).blob();
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], "qr-fixture.png", { type: "image/png" }));
    const input = document.querySelector('.qr-camera-scan-card .qr-photo-picker input[type="file"]');
    Object.defineProperty(input, "files", { configurable: true, value: transfer.files });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, qrFixture);
  await page.waitForFunction(() => document.querySelector(".qr-scan-result-slot .scan-result")?.textContent?.includes("worklazy.net"));
  const mobileQrScanLayout = await page.evaluate(() => ({
    resultTop: document.querySelector(".qr-scan-result-slot").getBoundingClientRect().top,
    scannerBottom: document.querySelector(".qr-camera-scan-card").getBoundingClientRect().bottom,
    photoPickerInsideScanner: Boolean(document.querySelector(".qr-camera-scan-card .qr-photo-picker")),
  }));
  if (!mobileQrScanLayout.photoPickerInsideScanner || mobileQrScanLayout.resultTop < mobileQrScanLayout.scannerBottom) {
    throw new Error(`Mobile QR photo picker and result layout is incomplete: ${JSON.stringify(mobileQrScanLayout)}`);
  }
  await page.setViewport({ width: 1440, height: 1000 });

  await page.goto(`${koBaseUrl}/tools/data-converter`, { waitUntil: "networkidle0" });
  await assertPairedEditors(page, "data-converter");
  await page.type(".utility-editor-grid textarea", "name,count\nalpha,2\nbeta,3");
  await clickButton(page, "표 데이터 변환");
  await page.waitForFunction(() => document.querySelectorAll(".utility-editor-grid textarea")[1]?.value.includes('"alpha"'));

  await page.goto(`${koBaseUrl}/tools/image-privacy`, { waitUntil: "networkidle0" });
  const privacyCompatibility = await page.$eval(".image-privacy-page .inline-notice", (element) => element.textContent);
  if (!privacyCompatibility.includes("HEIC") || !privacyCompatibility.includes("iOS 16.3")) throw new Error("Image privacy mobile compatibility notice is incomplete.");
  await page.evaluate(async () => {
    const canvas = document.createElement("canvas"); canvas.width = 48; canvas.height = 32;
    const context = canvas.getContext("2d"); context.fillStyle = "#159bd7"; context.fillRect(0, 0, 48, 32);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const transfer = new DataTransfer(); transfer.items.add(new File([blob], "privacy.png", { type: "image/png" }));
    const input = document.querySelector('.image-privacy-page input[type="file"]'); Object.defineProperty(input, "files", { configurable: true, value: transfer.files }); input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => !document.querySelector(".image-privacy-page .primary-button")?.disabled);
  await page.click(".image-privacy-page .primary-button");
  await page.waitForSelector(".clean-result");

  await page.goto(`${koBaseUrl}/tools/image-studio`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelectorAll(".studio-tabs button").length === 4);
  await page.waitForSelector(".fabric-stage .upper-canvas");
  await page.click(".editor-draw-tools button:nth-child(2)");
  const bounds = await page.$eval(".fabric-stage .upper-canvas", (element) => { const box = element.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height }; });
  await page.mouse.move(bounds.x + 80, bounds.y + 80); await page.mouse.down(); await page.mouse.move(bounds.x + 220, bounds.y + 150, { steps: 8 }); await page.mouse.up();
  await page.waitForFunction(() => !document.querySelector('.editor-history-actions button[aria-label="실행 취소"]')?.disabled);

  const googleVideoVisit = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.hostname.endsWith("google-analytics.com") && url.pathname.endsWith("/collect") && url.searchParams.get("en") === "page_view";
  }, { timeout: 60_000 });
  const naverVideoVisit = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.hostname === "wcs.naver.com" && url.pathname === "/b";
  }, { timeout: 60_000 });
  await page.$eval('a[href^="/ko/tools/video-studio"]', (link) => link.click());
  await page.waitForFunction(() => window.crossOriginIsolated === true, { timeout: 60_000 });
  await Promise.all([googleVideoVisit, naverVideoVisit]);
  await page.waitForSelector(".video-engine-status");
  const videoIsolation = await page.evaluate(() => ({
    origin: location.origin,
    path: location.pathname,
    marker: Boolean(document.querySelector('meta[name="worklazy-video-isolation"]')),
    ads: Boolean(document.querySelector("script[data-worklazy-adsense]")),
    googleAnalytics: Boolean(document.querySelector("script[data-worklazy-google-analytics]")),
    naverAnalytics: Boolean(document.querySelector("script[data-worklazy-naver-analytics]")),
    controller: navigator.serviceWorker.controller?.scriptURL || "",
    engine: document.querySelector(".video-engine-status")?.textContent || "",
  }));
  const validVideoController = videoIsolation.controller.endsWith("/service-worker.js") || videoIsolation.controller.endsWith("/ko/tools/video-studio/coi-serviceworker.js");
  if (videoIsolation.origin !== new URL(baseUrl).origin || videoIsolation.path !== "/ko/tools/video-studio/" || !videoIsolation.marker || videoIsolation.ads
    || !videoIsolation.googleAnalytics || !videoIsolation.naverAnalytics || !validVideoController || !videoIsolation.engine.includes("멀티스레드")) {
    throw new Error(`Video document isolation is incomplete: ${JSON.stringify(videoIsolation)}`);
  }
  const videoCompatibility = await page.$eval(".video-studio-page .inline-notice.warning", (element) => element.textContent);
  if (!videoCompatibility.includes("MKV") || !videoCompatibility.includes("AVI") || !videoCompatibility.includes("재생 시간") || videoCompatibility.includes("FFmpeg")) throw new Error("Video compatibility fallback notice is incomplete or exposes implementation details.");

  await page.$eval('a[href^="/ko/tools/pdf-editor"]', (link) => link.click());
  await page.waitForFunction(() => location.pathname === "/ko/tools/pdf-editor" && !document.querySelector('meta[name="worklazy-video-isolation"]'));
  await page.waitForSelector("script[data-worklazy-adsense]");
  await page.goto(`${koBaseUrl}/tools/pdf-editor/convert`, { waitUntil: "networkidle0" });
  await page.waitForSelector('input[placeholder*="1-5, 8"]');

  const social = await page.evaluate(() => ({ card: document.querySelector('meta[name="twitter:card"]')?.content, image: document.querySelector('meta[property="og:image"]')?.content }));
  if (social.card !== "summary_large_image" || !social.image?.endsWith("/social/tools/pdf-convert-ko.png")) throw new Error(`Tool-specific social metadata is incomplete: ${JSON.stringify(social)}`);

  const englishRoutes = ["/en/", "/en/tools/", "/en/tools/excel-merger", "/en/tools/document-compare", "/en/tools/office-editor", "/en/tools/pdf-editor", "/en/tools/pdf-editor/convert", "/en/tools/audio-studio", "/en/tools/image-studio", "/en/tools/text-tools", "/en/tools/text-formatter", "/en/tools/work-calculator", "/en/tools/timezone-calculator", "/en/tools/payroll-calculator", "/en/tools/image-privacy", "/en/tools/security-tools", "/en/tools/qr-studio", "/en/tools/data-converter", "/en/privacy", "/en/terms"];
  for (const route of englishRoutes) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle0" });
    const localized = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      korean: document.body.innerText.match(/[가-힣]+/g) || [],
      koAlternate: document.querySelector('link[hreflang="ko"]')?.getAttribute("href"),
      enAlternate: document.querySelector('link[hreflang="en"]')?.getAttribute("href"),
    }));
    if (localized.lang !== "en" || localized.korean.length || !localized.koAlternate || !localized.enAlternate) throw new Error(`English localization is incomplete at ${route}: ${JSON.stringify(localized)}`);
  }
  await page.goto(`${baseUrl}/en/tools/`, { waitUntil: "networkidle0" });
  const englishToolCount = await page.$$eval(".all-tools-grid .tool-card", (cards) => cards.length);
  if (englishToolCount !== 16) throw new Error(`English tool catalog should hide HWP editor: ${englishToolCount}`);
  await page.goto(`${baseUrl}/en/tools/hwp-editor`, { waitUntil: "networkidle0" });
  if (new URL(page.url()).pathname !== "/en/tools") throw new Error(`English HWP editor was not hidden: ${page.url()}`);

  if (errors.length) throw new Error(`Browser errors:\n${errors.join("\n")}`);
  console.log("Utility tool smoke tests passed: Korean and English routes, hreflang, categorized tools, paired editors, world map, utility tools, video compatibility and PDF page range.");
} finally { await browser.close(); }

async function clickButton(page, text) { const clicked = await page.evaluate((label) => { const button = Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.includes(label)); if (!button) return false; button.click(); return true; }, text); if (!clicked) throw new Error(`Button not found: ${text}`); }

async function assertPairedEditors(page, route) {
  const sizes = await page.$eval(".utility-editor-grid", (grid) => ({
    cards: Array.from(grid.querySelectorAll(":scope > .section-card"), (element) => element.getBoundingClientRect().height),
    textareas: Array.from(grid.querySelectorAll("textarea"), (element) => element.getBoundingClientRect().height),
  }));
  if (sizes.cards.length !== 2 || sizes.textareas.length !== 2 || Math.abs(sizes.cards[0] - sizes.cards[1]) > 1 || Math.abs(sizes.textareas[0] - sizes.textareas[1]) > 1) {
    throw new Error(`${route} paired editor heights differ: ${JSON.stringify(sizes)}`);
  }
}
