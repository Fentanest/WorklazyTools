import puppeteer from "puppeteer-core";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  page.setDefaultTimeout(60_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(baseUrl, { waitUntil: "networkidle0" });
  const homeKicker = await page.$eval(".hero-kicker", (element) => element.textContent);
  if (!homeKicker?.includes("작지만 유용한 업무 도구")) throw new Error(`Home kicker is outdated: ${homeKicker}`);

  await page.goto(`${baseUrl}/tools`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelectorAll(".all-tools-grid .tool-card").length === 16);
  const grid = await page.$eval(".all-tools-grid", (element) => ({ columns: getComputedStyle(element).gridTemplateColumns.split(" ").length, width: element.getBoundingClientRect().width }));
  if (grid.columns !== 4 || grid.width < 900) throw new Error(`Tool grid is not four columns: ${JSON.stringify(grid)}`);

  await page.goto(`${baseUrl}/tools/text-tools`, { waitUntil: "networkidle0" });
  await assertPairedEditors(page, "text-tools");
  await page.type(".utility-editor-grid textarea", "할수  있습니다\n할수  있습니다");
  await page.click(".utility-action-grid button:nth-child(2)");
  await page.waitForFunction(() => document.querySelectorAll(".utility-editor-grid textarea")[1]?.value.includes("할수 있습니다"));
  await clickButton(page, "로컬 문장 검사");
  await page.waitForFunction(() => document.querySelector(".utility-summary")?.textContent?.includes("로컬 패턴"));

  await page.goto(`${baseUrl}/tools/text-formatter`, { waitUntil: "networkidle0" });
  await assertPairedEditors(page, "text-formatter");
  await page.type(".utility-editor-grid textarea", '{"name":"Worklazy","ok":true}');
  await clickButton(page, "들여쓰기 정돈");
  await page.waitForFunction(() => document.querySelectorAll(".utility-editor-grid textarea")[1]?.value.includes('\n  "name"'));

  await page.goto(`${baseUrl}/tools/work-calculator`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".metric-grid article:nth-child(2)");
  const businessDays = await page.$eval(".metric-grid article:nth-child(2) strong", (element) => element.textContent);
  if (!businessDays?.includes("일")) throw new Error("Business-day result is missing.");

  await page.goto(`${baseUrl}/tools/timezone-calculator`, { waitUntil: "networkidle0" });
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

  await page.goto(`${baseUrl}/tools/payroll-calculator`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".payroll-hero strong");
  await page.click(".mode-switch button:nth-child(2)");
  await page.waitForSelector(".payroll-breakdown");
  const standard = await page.$eval(".standard-notice", (element) => element.textContent);
  if (!standard.includes("2026-07-01") || !standard.includes("4.75")) throw new Error(`Payroll standard is incomplete: ${standard}`);

  await page.goto(`${baseUrl}/tools/security-tools`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelector(".password-output input")?.value.length === 20);
  await page.click(".primary-button");
  await page.waitForSelector(".strength-meter");

  await page.goto(`${baseUrl}/tools/qr-studio`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => { const canvas = document.querySelector(".qr-preview canvas"); return canvas instanceof HTMLCanvasElement && canvas.width >= 600; });
  await page.click(".mode-switch button:nth-child(2)");
  await page.waitForSelector(".qr-camera-stage video[playsinline]");
  const cameraCopy = await page.$eval(".qr-scan-layout", (element) => element.textContent);
  if (!cameraCopy?.includes("카메라로 스캔")) throw new Error("Live QR camera scanner is missing.");

  await page.goto(`${baseUrl}/tools/data-converter`, { waitUntil: "networkidle0" });
  await assertPairedEditors(page, "data-converter");
  await page.type(".utility-editor-grid textarea", "name,count\nalpha,2\nbeta,3");
  await clickButton(page, "표 데이터 변환");
  await page.waitForFunction(() => document.querySelectorAll(".utility-editor-grid textarea")[1]?.value.includes('"alpha"'));

  await page.goto(`${baseUrl}/tools/image-privacy`, { waitUntil: "networkidle0" });
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

  await page.goto(`${baseUrl}/tools/image-studio`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelectorAll(".studio-tabs button").length === 4);
  await page.waitForSelector(".fabric-stage .upper-canvas");
  await page.click(".editor-draw-tools button:nth-child(2)");
  const bounds = await page.$eval(".fabric-stage .upper-canvas", (element) => { const box = element.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height }; });
  await page.mouse.move(bounds.x + 80, bounds.y + 80); await page.mouse.down(); await page.mouse.move(bounds.x + 220, bounds.y + 150, { steps: 8 }); await page.mouse.up();
  await page.waitForFunction(() => !document.querySelector('.editor-history-actions button[aria-label="실행 취소"]')?.disabled);

  await page.$eval('a[href="/tools/video-studio/"]', (link) => link.click());
  await page.waitForFunction(() => window.crossOriginIsolated === true, { timeout: 60_000 });
  await page.waitForSelector(".video-engine-status");
  const videoIsolation = await page.evaluate(() => ({
    origin: location.origin,
    path: location.pathname,
    marker: Boolean(document.querySelector('meta[name="worklazy-video-isolation"]')),
    ads: Boolean(document.querySelector("script[data-worklazy-adsense]")),
    controller: navigator.serviceWorker.controller?.scriptURL || "",
    engine: document.querySelector(".video-engine-status")?.textContent || "",
  }));
  if (videoIsolation.origin !== new URL(baseUrl).origin || videoIsolation.path !== "/tools/video-studio/" || !videoIsolation.marker || videoIsolation.ads || !videoIsolation.controller.endsWith("/tools/video-studio/coi-serviceworker.js") || !videoIsolation.engine.includes("멀티스레드")) {
    throw new Error(`Video document isolation is incomplete: ${JSON.stringify(videoIsolation)}`);
  }
  const videoCompatibility = await page.$eval(".video-studio-page .inline-notice.warning", (element) => element.textContent);
  if (!videoCompatibility.includes("MKV") || !videoCompatibility.includes("AVI") || !videoCompatibility.includes("FFmpeg")) throw new Error("Video compatibility fallback notice is incomplete.");

  await page.$eval('a[href="/tools/pdf-editor"]', (link) => link.click());
  await page.waitForFunction(() => location.pathname === "/tools/pdf-editor" && !document.querySelector('meta[name="worklazy-video-isolation"]'));
  await page.waitForSelector("script[data-worklazy-adsense]");
  await page.goto(`${baseUrl}/tools/pdf-editor/convert`, { waitUntil: "networkidle0" });
  await page.waitForSelector('input[placeholder*="1-5, 8"]');

  const social = await page.evaluate(() => ({ card: document.querySelector('meta[name="twitter:card"]')?.content, image: document.querySelector('meta[property="og:image"]')?.content }));
  if (social.card !== "summary_large_image" || !social.image?.endsWith("/social/worklazy-tools-share.png")) throw new Error(`Social metadata is incomplete: ${JSON.stringify(social)}`);
  if (errors.length) throw new Error(`Browser errors:\n${errors.join("\n")}`);
  console.log("Utility tool smoke tests passed: home copy, 4-column grid, paired editors, world map, text, formatter, workday, payroll, security, live QR, data, EXIF, unified image editor, video compatibility and PDF page range.");
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
