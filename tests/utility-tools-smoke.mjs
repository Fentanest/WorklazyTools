import puppeteer from "puppeteer-core";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
const koBaseUrl = `${baseUrl}/ko`;
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
let page;
try {
  page = await browser.newPage();
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
  await page.click("[data-testid=privacy-consent-accept]");
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
  const languageSwitcher = await page.$eval(".ui-language-switcher", (group) => ({
    tagName: group.tagName,
    role: group.getAttribute("role"),
    label: group.getAttribute("aria-label") || "",
    values: Array.from(group.querySelectorAll("button"), (button) => ({ text: button.textContent?.trim(), pressed: button.getAttribute("aria-pressed") })),
  }));
  if (languageSwitcher.tagName !== "DIV" || languageSwitcher.role !== "group" || !languageSwitcher.label
    || JSON.stringify(languageSwitcher.values) !== JSON.stringify([{ text: "KO", pressed: "true" }, { text: "EN", pressed: "false" }])) {
    throw new Error(`Language switcher accessibility contract failed: ${JSON.stringify(languageSwitcher)}`);
  }
  await page.focus('.desktop-language-switcher .ui-language-switcher button[aria-pressed="true"]');
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  await page.waitForFunction(() => location.pathname.startsWith("/en") && document.documentElement.lang === "en"
    && document.querySelector('.desktop-language-switcher .ui-language-switcher button:nth-child(2)')?.getAttribute("aria-pressed") === "true");
  await page.click(".desktop-language-switcher .ui-language-switcher button:first-child");
  await page.waitForFunction(() => location.pathname.startsWith("/ko") && document.documentElement.lang === "ko");
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
  await page.waitForFunction(() => document.querySelectorAll(".all-tools-grid .ui-tool-card").length === 20);
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
  const toolCards = await page.$$eval(".all-tools-grid .ui-tool-card", (cards) => cards.map((card) => ({
    tagName: card.tagName,
    slot: card.getAttribute("data-slot"),
    accent: Array.from(card.classList).find((name) => name.startsWith("ui-accent-")),
    iconAccent: card.querySelector("[data-accent]")?.getAttribute("data-accent"),
    href: card.getAttribute("href"),
  })));
  if (toolCards.length !== 20 || toolCards.some((card) => card.tagName !== "A" || card.slot !== "card" || !card.href || card.accent !== `ui-accent-${card.iconAccent}`)) {
    throw new Error(`Tool card link or accent contract failed: ${JSON.stringify(toolCards)}`);
  }
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  await page.waitForFunction(() => window.matchMedia("(prefers-color-scheme: dark)").matches && document.querySelector('.tool-category-filter button[aria-pressed="true"]'));
  const darkSelectedContrast = await page.$eval('.tool-category-filter button[aria-pressed="true"]', (element) => {
    const toRgb = (color) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d");
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
    };
    const luminance = (color) => {
      const [red, green, blue] = color.map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const style = getComputedStyle(element);
    const foreground = luminance(toRgb(style.color));
    const background = luminance(toRgb(style.backgroundColor));
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  if (darkSelectedContrast < 4.5) throw new Error(`Selected tool category contrast is below 4.5:1 in dark mode: ${darkSelectedContrast}`);
  await page.click('.tool-category-filter button[aria-label^="이미지·영상·오디오"]');
  await page.waitForFunction(() => new URLSearchParams(location.search).get("category") === "media" && document.querySelectorAll(".tool-category-section").length === 1 && document.querySelectorAll(".ui-tool-card").length === 3);
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await page.click(".tool-category-filter button:first-child");
  await page.type('.tool-search input[aria-label="도구 검색"]', "비밀번호");
  await page.waitForFunction(() => document.querySelectorAll(".tool-category-section").length === 1 && document.querySelectorAll(".ui-tool-card").length === 1 && document.querySelector(".tool-category-heading h2")?.textContent === "보안·공유");
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${koBaseUrl}/tools`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".all-tools-grid .ui-tool-card");
  const mobileToolsLayout = await page.evaluate(() => ({
    columns: getComputedStyle(document.querySelector(".all-tools-grid")).gridTemplateColumns.split(" ").length,
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    categoryScrollable: document.querySelector(".tool-category-filter").scrollWidth > document.querySelector(".tool-category-filter").clientWidth,
  }));
  if (mobileToolsLayout.columns !== 1 || mobileToolsLayout.pageWidth > mobileToolsLayout.viewportWidth + 1 || !mobileToolsLayout.categoryScrollable) {
    throw new Error(`Mobile tool categories overflow incorrectly: ${JSON.stringify(mobileToolsLayout)}`);
  }
  await page.click('#mobile-navigation-trigger');
  await page.waitForSelector('[data-slot="sheet-content"]', { visible: true });
  await page.waitForFunction(() => document.activeElement instanceof HTMLElement && Boolean(document.activeElement.closest('[data-slot="sheet-content"]')));
  await page.waitForFunction(() => {
    const sheet = document.querySelector('[data-slot="sheet-content"]');
    const list = sheet?.querySelector('.sheet-tool-list');
    if (!(sheet instanceof HTMLElement) || !(list instanceof HTMLElement)) return false;
    const rect = sheet.getBoundingClientRect();
    return rect.left >= 9 && rect.right <= window.innerWidth - 9 && rect.top >= 9
      && rect.bottom <= window.innerHeight - 9 && list.scrollHeight > list.clientHeight;
  });
  const mobileNavigationSheet = await page.$eval('[data-slot="sheet-content"]', (sheet) => {
    const rect = sheet.getBoundingClientRect();
    const style = getComputedStyle(sheet);
    const list = sheet.querySelector('.sheet-tool-list');
    return {
      role: sheet.getAttribute("role"),
      modal: sheet.getAttribute("aria-modal"),
      label: sheet.getAttribute("aria-label"),
      title: sheet.querySelector('[data-slot="sheet-title"]')?.textContent || "",
      overlay: Boolean(document.querySelector('[data-slot="sheet-overlay"]')),
      links: sheet.querySelectorAll(".sheet-tool-item").length,
      top: rect.top,
      bottom: rect.bottom,
      overflowY: style.overflowY,
      listOverflowY: list ? getComputedStyle(list).overflowY : "",
      listScrollable: list instanceof HTMLElement && list.scrollHeight > list.clientHeight,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  if (mobileNavigationSheet.role !== "dialog" || mobileNavigationSheet.modal !== "true" || mobileNavigationSheet.label !== "바로가기"
    || mobileNavigationSheet.title !== "어떤 작업을 할까요?" || !mobileNavigationSheet.overlay || mobileNavigationSheet.links !== 21
    || mobileNavigationSheet.top < -1 || mobileNavigationSheet.bottom > 845 || mobileNavigationSheet.overflowY !== "hidden"
    || mobileNavigationSheet.listOverflowY !== "auto" || !mobileNavigationSheet.listScrollable || mobileNavigationSheet.pageOverflow > 1) {
    throw new Error(`Mobile navigation sheet semantics or clipping failed: ${JSON.stringify(mobileNavigationSheet)}`);
  }
  await page.$eval('[data-slot="sheet-content"] .sheet-tool-item:last-child', (element) => element.focus());
  await page.keyboard.press("Tab");
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "닫기");
  await page.keyboard.down("Shift");
  await page.keyboard.press("Tab");
  await page.keyboard.up("Shift");
  await page.waitForFunction(() => document.activeElement?.matches('[data-slot="sheet-content"] .sheet-tool-item:last-child'));
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[data-slot="sheet-content"]'));
  await page.waitForFunction(() => document.activeElement?.id === "mobile-navigation-trigger");
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

  await page.goto(`${koBaseUrl}/tools/text-merger`, { waitUntil: "networkidle0" });
  const toolGuide = await page.$eval(".ui-tool-guide", (guide) => ({
    tagName: guide.tagName,
    slot: guide.getAttribute("data-slot"),
    labelledBy: guide.getAttribute("aria-labelledby"),
    eyebrow: guide.querySelector(".ui-tool-guide-heading p")?.textContent,
    titleId: guide.querySelector(".ui-tool-guide-heading h2")?.id,
    articles: Array.from(guide.querySelectorAll(".ui-tool-guide-grid > article"), (article) => article.getAttribute("data-slot")),
    faq: Array.from(guide.querySelectorAll(".ui-tool-faq details"), (item) => Boolean(item.querySelector("summary") && item.querySelector("p"))),
  }));
  if (toolGuide.tagName !== "SECTION" || toolGuide.slot !== "card" || toolGuide.labelledBy !== "tool-guide-title"
    || toolGuide.eyebrow !== "안내" || toolGuide.titleId !== "tool-guide-title" || !toolGuide.articles.length
    || toolGuide.articles.some((slot) => slot !== "card") || !toolGuide.faq.length || toolGuide.faq.some((valid) => !valid)) {
    throw new Error(`Tool guide structure or localization contract failed: ${JSON.stringify(toolGuide)}`);
  }
  await page.type("[data-testid='text-merger-editor'] textarea", "첫 번째");
  await page.evaluate(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["파일 A"], "a.txt", { type: "text/plain" }));
    transfer.items.add(new File(["파일 B"], "b.txt", { type: "text/plain" }));
    const input = document.querySelector("[data-tool-page='text-merger'] input[type='file']");
    Object.defineProperty(input, "files", { configurable: true, value: transfer.files });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelectorAll("[data-testid='text-merger-item']").length === 3);
  await clickButton(page, "직접 입력 추가");
  await page.type("[data-testid='text-merger-item']:last-child textarea", "직접 입력 사이");
  await page.$eval("[data-testid='text-merger-item']:last-child [data-testid='text-merger-order-actions'] button:first-child", (button) => button.click());
  await page.waitForFunction(() => document.querySelectorAll("[data-testid='text-merger-source']")[2]?.textContent?.includes("직접 입력"));
  await page.$eval("[data-testid='text-merger-item']:nth-child(2) [data-testid='text-merger-preview']", (button) => button.click());
  await page.$eval("[data-testid='text-merger-item']:nth-child(2) textarea", (textarea) => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(textarea, "파일 A 편집"); textarea.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.waitForFunction(() => document.querySelector("[data-testid='text-merger-item']:nth-child(2) [data-testid='text-merger-meta'] b")?.textContent === "편집됨");
  await clickButton(page, "텍스트 병합");
  await page.waitForFunction(() => document.querySelector("[data-testid='text-merger-result']")?.value === "첫 번째\n파일 A 편집\n직접 입력 사이\n파일 B");

  await page.goto(`${koBaseUrl}/tools/text-tools`, { waitUntil: "networkidle0" });
  await assertPairedEditors(page, "text-tools");
  await page.type("[data-testid='text-tools-input']", "할수  있습니다\n할수  있습니다");
  await page.click("[data-testid='text-actions'] button:nth-child(2)");
  await page.waitForFunction(() => document.querySelector("[data-testid='text-tools-output']")?.value.includes("할수 있습니다"));
  await clickButton(page, "브라우저 내장 규칙 검사");
  await page.waitForFunction(() => document.querySelector("[data-testid='text-inspection-summary']")?.textContent?.includes("내장 규칙"));

  await page.goto(`${koBaseUrl}/tools/text-formatter`, { waitUntil: "networkidle0" });
  await assertPairedEditors(page, "text-formatter");
  await page.type("[data-testid='formatter-input']", '{"name":"Worklazy","ok":true}');
  await clickButton(page, "들여쓰기 정돈");
  await page.waitForFunction(() => document.querySelector("[data-testid='formatter-output']")?.value.includes('\n  "name"'));

  await page.goto(`${koBaseUrl}/tools/work-calculator`, { waitUntil: "networkidle0" });
  await page.waitForSelector("[data-testid='business-day-results'] article:nth-child(2)");
  const businessDays = await page.$eval("[data-testid='business-day-results'] article:nth-child(2) strong", (element) => element.textContent);
  if (!businessDays?.includes("일")) throw new Error("Business-day result is missing.");
  await page.$eval("[data-testid='work-mode'] [data-ui-component='segmented-control']", (root) => root.querySelectorAll("button")[1]?.click());
  await page.waitForSelector("[data-testid='leave-result']");
  const leaveDays = await page.$eval("[data-testid='leave-result'] strong", (element) => element.textContent);
  if (!leaveDays?.includes("일")) throw new Error("Annual-leave mode result is missing after the mode change.");

  await page.goto(`${koBaseUrl}/tools/timezone-calculator`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelectorAll("[data-testid='timezone-map-pin']").length === 44);
  await page.waitForFunction(() => document.querySelectorAll("[data-testid='timezone-world-clocks'] article").length === 4);
  const timezoneMetaFont = await page.$eval("[data-testid='timezone-world-clocks'] article > small", (element) => Number.parseFloat(getComputedStyle(element).fontSize));
  if (timezoneMetaFont < 13) throw new Error(`Timezone comparison copy is too small: ${timezoneMetaFont}px`);
  await page.$eval('[data-testid="timezone-map-pin"][aria-label^="두바이"]', (element) => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  await page.waitForFunction(() => document.querySelectorAll("[data-testid='timezone-world-clocks'] article").length === 5);
  await page.type("[data-testid='timezone-city-search'] input", "시드니");
  await page.waitForSelector("[data-testid='timezone-search-results'] button");
  await page.click("[data-testid='timezone-search-results'] button");
  await page.waitForFunction(() => document.querySelectorAll("[data-testid='timezone-world-clocks'] article").length === 6);
  await page.click('[data-testid="timezone-map-controls"] button[aria-label="지도 확대"]');
  await page.waitForFunction(() => document.querySelector("[data-testid='timezone-map-controls'] output")?.textContent === "150%");

  await page.goto(`${koBaseUrl}/tools/payroll-calculator`, { waitUntil: "networkidle0" });
  await page.waitForSelector("[data-testid='payroll-result'] strong");
  await page.$eval("[data-testid='payroll-mode'] [data-ui-component='segmented-control']", (root) => root.querySelectorAll("button")[1]?.click());
  await page.waitForSelector("[data-testid='payroll-breakdown']");
  const standard = await page.$eval("[data-tool-page='payroll-calculator']", (element) => element.textContent || "");
  if (!standard.includes("2026-07-01") || !standard.includes("4.75")) throw new Error(`Payroll standard is incomplete: ${standard}`);

  await page.goto(`${koBaseUrl}/tools/security-tools`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelector("[data-testid='password-output'] input")?.value.length === 20);
  await page.click("[data-tool-page='security-tools'] [data-ui-component='primary-button']");
  await page.waitForSelector("[data-testid='password-strength']");
  const passwordStrengthCopy = await page.$eval("[data-tool-page='security-tools']", (element) => element.textContent || "");
  if (!passwordStrengthCopy.includes("예상 해독 시간") || !passwordStrengthCopy.includes("초당 100억 회") || passwordStrengthCopy.includes("오프라인 고속 공격") || passwordStrengthCopy.includes("centuries")) {
    throw new Error(`Password strength explanation is unclear: ${passwordStrengthCopy}`);
  }

  await page.goto(`${koBaseUrl}/tools/qr-studio`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => { const canvas = document.querySelector("[data-testid=qr-preview] canvas"); return canvas instanceof HTMLCanvasElement && canvas.width >= 600; });
  const qrFixture = await page.$eval("[data-testid=qr-preview] canvas", (canvas) => canvas.toDataURL("image/png"));
  await page.click("[data-testid=qr-mode] button:nth-child(3)");
  await page.waitForSelector('[data-testid="qr-camera-stage"] video[playsinline]');
  const cameraCopy = await page.$eval("[data-testid=qr-scan-layout]", (element) => element.textContent);
  if (!cameraCopy?.includes("카메라로 스캔")) throw new Error("Live QR camera scanner is missing.");
  await page.setViewport({ width: 390, height: 844 });
  await page.evaluate(async (dataUrl) => {
    const blob = await (await fetch(dataUrl)).blob();
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], "qr-fixture.png", { type: "image/png" }));
    const input = document.querySelector('[data-testid=qr-photo-picker] input[type="file"]');
    Object.defineProperty(input, "files", { configurable: true, value: transfer.files });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, qrFixture);
  await page.waitForFunction(() => document.querySelector("[data-testid=qr-scan-result]")?.textContent?.includes("worklazy.net"));
  const mobileQrScanLayout = await page.evaluate(() => ({
    resultTop: document.querySelector("[data-testid=qr-scan-result-slot]").getBoundingClientRect().top,
    scannerBottom: document.querySelector('[data-testid="qr-camera-scan-card"]').getBoundingClientRect().bottom,
    photoPickerInsideScanner: Boolean(document.querySelector("[data-testid=qr-photo-picker]")),
  }));
  if (!mobileQrScanLayout.photoPickerInsideScanner || mobileQrScanLayout.resultTop < mobileQrScanLayout.scannerBottom) {
    throw new Error(`Mobile QR photo picker and result layout is incomplete: ${JSON.stringify(mobileQrScanLayout)}`);
  }
  await page.setViewport({ width: 1440, height: 1000 });

  await page.goto(`${koBaseUrl}/tools/data-converter`, { waitUntil: "networkidle0" });
  await assertPairedEditors(page, "data-converter");
  await page.type("[data-testid='data-converter-input']", "name,count\nalpha,2\nbeta,3");
  await clickButton(page, "표 데이터 변환");
  await page.waitForFunction(() => document.querySelector("[data-testid='data-converter-output']")?.value.includes('"alpha"'));

  await page.goto(`${koBaseUrl}/tools/image-privacy`, { waitUntil: "networkidle0" });
  const privacyCompatibility = await page.$eval("[data-tool-page='image-privacy'] [data-slot='notice']", (element) => element.textContent);
  if (!privacyCompatibility.includes("HEIC") || !privacyCompatibility.includes("iOS 16.3")) throw new Error("Image privacy mobile compatibility notice is incomplete.");
  await page.evaluate(async () => {
    const canvas = document.createElement("canvas"); canvas.width = 48; canvas.height = 32;
    const context = canvas.getContext("2d"); context.fillStyle = "#159bd7"; context.fillRect(0, 0, 48, 32);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const transfer = new DataTransfer(); transfer.items.add(new File([blob], "privacy.png", { type: "image/png" }));
    const input = document.querySelector('[data-tool-page="image-privacy"] input[type="file"]'); Object.defineProperty(input, "files", { configurable: true, value: transfer.files }); input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => !document.querySelector("[data-tool-page='image-privacy'] [data-ui-component='primary-button']")?.disabled);
  await page.click("[data-tool-page='image-privacy'] [data-ui-component='primary-button']");
  await page.waitForSelector("[data-testid='image-privacy-result']");

  await page.goto(`${koBaseUrl}/tools/image-studio`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelectorAll(".studio-tabs button").length === 4);
  await page.waitForSelector(".fabric-stage .upper-canvas");
  await page.click('[data-testid="image-editor-panel-draw"]');
  await page.click('[data-testid="image-editor-draw-pencil"]');
  const bounds = await page.$eval(".fabric-stage .upper-canvas", (element) => { const box = element.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height }; });
  await page.mouse.move(bounds.x + 80, bounds.y + 80); await page.mouse.down(); await page.mouse.move(bounds.x + 220, bounds.y + 150, { steps: 8 }); await page.mouse.up();
  await page.waitForFunction(() => !document.querySelector('[data-testid="image-editor-undo"]')?.disabled);

  await page.evaluate(() => {
    const originalGtag = window.gtag;
    window.gtag = (...args) => {
      if (args[0] === "event" && args[1] === "tool_open" && args[2]?.tool_id === "video-studio") {
        sessionStorage.setItem("worklazy-test-google-video-open", "1");
      }
      originalGtag?.(...args);
    };
  });
  const naverVideoVisit = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.hostname === "wcs.naver.com" && url.pathname === "/b";
  }, { timeout: 60_000 });
  await page.$eval('a[href^="/ko/tools/video-studio"]', (link) => link.click());
  await page.waitForFunction(() => window.crossOriginIsolated === true, { timeout: 60_000 });
  await page.waitForFunction(() => sessionStorage.getItem("worklazy-test-google-video-open") === "1");
  await naverVideoVisit;
  await page.waitForSelector("[data-testid=video-runtime-status]");
  const videoIsolation = await page.evaluate(() => ({
    origin: location.origin,
    path: location.pathname,
    marker: Boolean(document.querySelector('meta[name="worklazy-video-isolation"]')),
    ads: Boolean(document.querySelector("script[data-worklazy-adsense]")),
    googleAnalytics: Boolean(document.querySelector("script[data-worklazy-google-analytics]")),
    naverAnalytics: Boolean(document.querySelector("script[data-worklazy-naver-analytics]")),
    controller: navigator.serviceWorker.controller?.scriptURL || "",
    engine: document.querySelector("[data-testid=video-runtime-status]")?.textContent || "",
  }));
  const validVideoController = videoIsolation.controller.endsWith("/service-worker.js") || videoIsolation.controller.endsWith("/ko/tools/video-studio/coi-serviceworker.js");
  if (videoIsolation.origin !== new URL(baseUrl).origin || videoIsolation.path !== "/ko/tools/video-studio/" || !videoIsolation.marker || videoIsolation.ads
    || !videoIsolation.googleAnalytics || !videoIsolation.naverAnalytics || !validVideoController || !videoIsolation.engine.includes("멀티스레드")) {
    throw new Error(`Video document isolation is incomplete: ${JSON.stringify(videoIsolation)}`);
  }
  const videoCompatibility = await page.$$eval(".video-studio-page [data-slot=notice]", (elements) => elements.find((element) => element.textContent?.includes("MKV"))?.textContent || "");
  if (!videoCompatibility.includes("MKV") || !videoCompatibility.includes("AVI") || !videoCompatibility.includes("재생 시간") || videoCompatibility.includes("FFmpeg")) throw new Error("Video compatibility fallback notice is incomplete or exposes implementation details.");

  await page.$eval('a[href^="/ko/tools/pdf-editor"]', (link) => link.click());
  await page.waitForFunction(() => location.pathname === "/ko/tools/pdf-editor" && !document.querySelector('meta[name="worklazy-video-isolation"]'));
  await page.waitForSelector("script[data-worklazy-adsense]");
  await page.goto(`${koBaseUrl}/tools/pdf-editor/convert`, { waitUntil: "networkidle0" });
  await page.waitForSelector('input[placeholder*="1-5, 8"]');

  const social = await page.evaluate(() => ({ card: document.querySelector('meta[name="twitter:card"]')?.content, image: document.querySelector('meta[property="og:image"]')?.content }));
  if (social.card !== "summary_large_image" || !social.image?.endsWith("/social/tools/pdf-convert-ko.png")) throw new Error(`Tool-specific social metadata is incomplete: ${JSON.stringify(social)}`);

  const englishRoutes = ["/en/", "/en/tools/", "/en/tools/excel-merger", "/en/tools/excel-compare", "/en/tools/excel-cleaner", "/en/tools/document-compare", "/en/tools/office-editor", "/en/tools/pdf-editor", "/en/tools/pdf-editor/convert", "/en/tools/audio-studio", "/en/tools/image-studio", "/en/tools/text-merger", "/en/tools/text-tools", "/en/tools/text-formatter", "/en/tools/work-calculator", "/en/tools/timezone-calculator", "/en/tools/payroll-calculator", "/en/tools/image-privacy", "/en/tools/security-tools", "/en/tools/qr-studio", "/en/tools/data-converter", "/en/privacy", "/en/terms"];
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
  const englishToolCount = await page.$$eval(".all-tools-grid .ui-tool-card", (cards) => cards.length);
  if (englishToolCount !== 19) throw new Error(`English tool catalog should hide HWP editor: ${englishToolCount}`);
  await page.goto(`${baseUrl}/en/tools/hwp-editor`, { waitUntil: "networkidle0" });
  if (new URL(page.url()).pathname !== "/en/tools") throw new Error(`English HWP editor was not hidden: ${page.url()}`);

  if (errors.length) throw new Error(`Browser errors:\n${errors.join("\n")}`);
  console.log("Utility tool smoke tests passed: Korean and English routes, hreflang, categorized tools, paired editors, world map, utility tools, video compatibility and PDF page range.");
} catch (error) {
  console.error(`Utility smoke failed at ${page?.url() || "unknown URL"}.`);
  throw error;
} finally { await browser.close(); }

async function clickButton(page, text) { const clicked = await page.evaluate((label) => { const button = Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.includes(label)); if (!button) return false; button.click(); return true; }, text); if (!clicked) throw new Error(`Button not found: ${text}`); }

async function assertPairedEditors(page, route) {
  const selector = route === "text-tools"
    ? "[data-testid='text-tools-editors']"
    : route === "text-formatter"
      ? "[data-testid='formatter-editors']"
      : "[data-testid='data-converter-editors']";
  const sizes = await page.$eval(selector, (grid) => ({
    cards: Array.from(grid.querySelectorAll(":scope > [data-ui-component='section-card'], :scope > .ui-section-card"), (element) => element.getBoundingClientRect().height),
    textareas: Array.from(grid.querySelectorAll("textarea"), (element) => element.getBoundingClientRect().height),
  }));
  if (sizes.cards.length !== 2 || sizes.textareas.length !== 2 || Math.abs(sizes.cards[0] - sizes.cards[1]) > 1 || Math.abs(sizes.textareas[0] - sizes.textareas[1]) > 1) {
    throw new Error(`${route} paired editor heights differ: ${JSON.stringify(sizes)}`);
  }
}
