// W3 home + hero asset contract: card census and heading/DOM rules, hero
// copy per locale, picture source sets, slot-vs-sizes math, single initial
// image request, family switch without remount, HOW IT WORKS kept.
// Dev-server fixture-free: drives the real home page. Never ships to dist.
// Usage: node tests/ui-home-assets.mjs --out out.json
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");
const port = Number(process.env.UI_HOME_PORT ?? "4234");
const baseUrl = process.env.TEST_BASE_URL || `http://127.0.0.1:${port}`;
const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const out = outIndex === -1 ? undefined : args[outIndex + 1];
let server;
const passed = [];
const recorded = {};

const EXPECTED = {
  ko: {
    cards: 23, accent: "도구에게", after: " 맡기세요.",
    kicker: "작지만 유용한 업무 도구",
    description: "문서와 데이터부터 이미지·영상까지, 설치도 로그인도 필요 없습니다. 필요한 도구를 고르면 복잡한 작업이 간단해집니다.",
    trustTitle: "파일 업로드 없음",
    trustBody: "모든 작업은 내 브라우저에서 처리됩니다.",
    firstCard: "document-redactor",
  },
  en: {
    cards: 22, accent: "the tedious file work.", after: "",
    kicker: "Small tools for everyday work",
    description: "From documents and data to images and video, no installation or sign-in is needed. Choose a tool to make complex tasks simpler.",
    trustTitle: "No file uploads",
    trustBody: "Everything is processed in your browser.",
    firstCard: "document-redactor",
  },
};

// Independent copy of the .home-hero slot table (see global.css and
// HeroPicture.tsx HERO_SIZES): two equal columns at and above 1440px over a
// 1520px-capped page, stacked full-width below. Computed from layout width
// (clientWidth), never 100vw, so a vertical scrollbar cannot shift the
// expectation. The stacked terms subtract the 2px hero border on top of main
// padding and hero padding.
function expectedSlot(clientWidth) {
  if (clientWidth > 1855) return 700;
  if (clientWidth >= 1440) return (clientWidth - 456) / 2;
  if (clientWidth > 1020) return clientWidth - 272 - 64 - 80 - 2;
  if (clientWidth > 820) return clientWidth - 250 - 48 - 80 - 2;
  if (clientWidth > 620) return clientWidth - 32 - 56 - 2;
  return clientWidth - 24 - 44 - 2;
}

async function newHome(browser, language) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: language === "ko" ? "ko-KR" : "en-US" });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  const heroRequests = [];
  page.on("request", (request) => {
    if (request.url().includes("/assets/hero/")) heroRequests.push(request.url());
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseUrl}/${language}/`, { waitUntil: "networkidle" });
  await page.locator(".home-page .home-hero").waitFor();
  return { context, page, heroRequests, errors };
}

try {
  if (!process.env.TEST_BASE_URL) server = await startDevServer();
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-device-scale-factor=1"],
  });
  try {
    for (const language of ["ko", "en"]) {
      const expected = EXPECTED[language];
      // Page A: copy, census, card DOM, picture, and the initial request
      // count. No resizes happen on this page, so its request list is the
      // true initial load (resizing legitimately fetches more candidates).
      const pageA = await newHome(browser, language);
      const { page, heroRequests, errors } = pageA;

      // Heading: fixed copy, accent span covers exactly the approved phrase.
      assert.equal(await page.locator(".home-hero h1 span").innerText(), expected.accent);
      const heading = await page.locator(".home-hero h1").innerText();
      assert.ok(heading.replace(/\s+/g, " ").includes(`${expected.accent}${expected.after}`.trim()), `heading accent placement broke: ${heading}`);
      assert.equal(await page.locator(".hero-kicker").innerText(), expected.kicker);
      assert.equal(await page.locator(".home-hero .hero-content > p").innerText(), expected.description);
      const trust = await page.locator(".hero-trust").evaluate((node) => ({
        title: node.querySelector("strong")?.textContent ?? "",
        body: node.querySelector("small")?.textContent ?? "",
      }));
      assert.equal(trust.title, expected.trustTitle);
      assert.equal(trust.body, expected.trustBody);
      const browseHref = await page.locator(".home-hero .primary-link").getAttribute("href");
      assert.ok(browseHref?.endsWith(`/${language}/tools`), `browse CTA target broke: ${browseHref}`);
      const ctaBox = await page.locator(".home-hero .primary-link").evaluate((node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return { wrap: style.whiteSpace, width: Math.round(rect.width) };
      });
      assert.equal(ctaBox.wrap, "nowrap", "CTA text must never wrap");
      assert.ok(ctaBox.width >= 150, `CTA narrower than 150px: ${ctaBox.width}`);
      passed.push(`${language} hero copy, accent span, and CTA`);

      // Card census: every catalog tool in registry order plus exactly one
      // non-interactive privacy article that is never counted as a tool.
      const gridCount = await page.locator(".home-tool-grid > *").count();
      assert.equal(gridCount, expected.cards + 1, `home grid children: ${gridCount}`);
      const cardCount = await page.locator(".home-tool-grid a.ui-tool-card").count();
      assert.equal(cardCount, expected.cards, `home tool cards: ${cardCount}`);
      const privacyCount = await page.locator(".home-tool-grid article.ui-privacy-card").count();
      assert.equal(privacyCount, 1, "privacy card is a single article");
      assert.equal(await page.locator(".home-tool-grid article.ui-privacy-card a, .home-tool-grid article.ui-privacy-card button").count(), 0, "privacy card must stay non-interactive");
      const firstHref = await page.locator(".home-tool-grid a.ui-tool-card").first().getAttribute("href");
      assert.ok(firstHref?.includes(expected.firstCard), `registry order broke: ${firstHref}`);
      passed.push(`${language} card census ${expected.cards}+privacy in registry order`);

      // Card DOM contract: single link root, h3 title, at most 3 plain tags in
      // the bottom row with the arrow, decorative nodes hidden.
      const cards = await page.locator(".home-tool-grid a.ui-tool-card").evaluateAll((nodes) => nodes.map((card) => ({
        nested: card.querySelectorAll("a, button").length,
        title: card.querySelector(":scope > .ui-tool-card-copy > h3")?.textContent ?? null,
        h2: card.querySelectorAll("h2").length,
        tags: card.querySelectorAll(":scope > .ui-tool-card-foot .ui-tool-highlights > span").length,
        tagIcons: card.querySelectorAll(":scope > .ui-tool-card-foot .ui-tool-highlights svg").length,
        iconHidden: card.querySelector(":scope > .ui-tool-card-top > span[data-accent]")?.getAttribute("aria-hidden"),
        arrowHidden: card.querySelector(":scope > .ui-tool-card-foot > .ui-card-arrow")?.getAttribute("aria-hidden"),
      })));
      assert.equal(cards.length, expected.cards);
      for (const card of cards) {
        assert.equal(card.nested, 0, "card must not nest links or buttons");
        assert.ok(card.title && card.title.length > 0, "card title must be an h3");
        assert.equal(card.h2, 0, "card must not carry an h2 inside section h2 context");
        assert.ok(card.tags >= 1 && card.tags <= 3, `card shows 1-3 tags, got ${card.tags}`);
        assert.equal(card.tagIcons, 0, "tags stay neutral gray without icons");
        assert.equal(card.iconHidden, "true");
        assert.equal(card.arrowHidden, "true");
      }
      passed.push(`${language} card DOM: link root, h3, <=3 plain tags, bottom arrow`);

      // Picture: AVIF first, WebP second, decoded img fallback with fixed
      // intrinsic size, one family at a time.
      const picture = await page.locator(".hero-picture picture").evaluate((node) => ({
        avif: node.querySelector("source[type='image/avif']")?.getAttribute("srcset") ?? "",
        webp: node.querySelector("source[type='image/webp']")?.getAttribute("srcset") ?? "",
        img: node.querySelector("img")?.getAttribute("srcset") ?? "",
        sizes: node.querySelector("img")?.getAttribute("sizes") ?? "",
        width: node.querySelector("img")?.getAttribute("width"),
        height: node.querySelector("img")?.getAttribute("height"),
        alt: node.querySelector("img")?.getAttribute("alt"),
        currentSrc: node.querySelector("img")?.currentSrc ?? "",
      }));
      for (const set of [picture.avif, picture.webp, picture.img]) {
        assert.ok(set.includes("coral-480.") && set.includes("coral-960.") && set.includes("coral-1440."), `srcset keeps 3 widths: ${set}`);
      }
      assert.ok(picture.sizes.length > 0, "sizes must be declared");
      assert.equal(picture.width, "1672");
      assert.equal(picture.height, "941");
      assert.equal(picture.alt, "");
      assert.ok(picture.currentSrc.includes("/assets/hero/coral-"), `default family is coral: ${picture.currentSrc}`);
      const intrinsic = await page.evaluate(async (src) => {
        const probe = new Image();
        probe.src = src;
        try { await probe.decode(); } catch { return null; }
        return { width: probe.naturalWidth, height: probe.naturalHeight };
      }, picture.currentSrc);
      assert.ok(intrinsic && intrinsic.width >= 480 && intrinsic.height >= 270, `hero file decodes at full intrinsic size: ${JSON.stringify(intrinsic)}`);
      passed.push(`${language} picture sources, intrinsic size, decode`);

      // Exactly one hero file on initial load (srcset+sizes dedupe).
      const initialHeroFiles = [...new Set(heroRequests)];
      assert.equal(initialHeroFiles.length, 1, `initial load must fetch one hero file: ${JSON.stringify(initialHeroFiles)}`);
      passed.push(`${language} single initial hero request`);

      // HOW IT WORKS stays: three steps under its own heading.
      assert.equal(await page.locator(".home-how-grid > div").count(), 3, "how-it-works keeps 3 steps");
      assert.ok((await page.locator(".home-how h2").innerText()).length > 0, "how-it-works keeps its heading");
      passed.push(`${language} how-it-works kept`);
      assert.ok(!errors.length, `page errors: ${errors.join("; ")}`);
      await pageA.context.close();

      // Page B (fresh): slot-vs-sizes sweep. Resizing re-evaluates
      // candidates, so request counts are not asserted here.
      const pageB = await newHome(browser, language);
      const sweep = pageB.page;

      // Slot-vs-sizes: measured picture slot matches the layout table within
      // 1px, and the picked candidate is never smaller than the slot.
      for (const width of [1920, 1856, 1855, 1440, 1439, 1100, 820, 621, 620, 390]) {
        await sweep.setViewportSize({ width, height: 900 });
        await sweep.waitForTimeout(250);
        const measured = await sweep.evaluate(() => ({
          slot: document.querySelector(".hero-picture").getBoundingClientRect().width,
          clientWidth: document.documentElement.clientWidth,
          picked: document.querySelector(".hero-picture img").currentSrc,
        }));
        const want = expectedSlot(measured.clientWidth);
        assert.ok(Math.abs(measured.slot - want) <= 1, `slot ${measured.slot}px vs table ${want}px at viewport ${width} (client ${measured.clientWidth})`);
        const pickedWidth = Number((measured.picked.match(/-(\d+)\.(avif|webp)/) ?? [])[1]);
        assert.ok(pickedWidth >= Math.floor(measured.slot), `picked ${pickedWidth}w smaller than slot ${measured.slot}px at ${width}`);
        // NOTE: Chrome 153 headless reports a srcset img's naturalWidth as the
        // sizes-evaluated size, so intrinsic decode is verified with an
        // isolated Image instead (isolated decode of the same bytes is full
        // size; the quirk is browser reporting, not an asset defect).
        const decoded = await sweep.evaluate(async (src) => {
          const probe = new Image();
          probe.src = src;
          try { await probe.decode(); } catch { return null; }
          return probe ? { width: probe.naturalWidth, height: probe.naturalHeight } : null;
        }, measured.picked);
        assert.ok(decoded && decoded.width >= pickedWidth, `picked file decodes below its descriptor at ${width}: ${JSON.stringify(decoded)}`);
      }
      await sweep.setViewportSize({ width: 1440, height: 900 });
      await sweep.waitForTimeout(250);
      recorded[`${language}Slot1440`] = await sweep.evaluate(() => document.querySelector(".hero-picture").getBoundingClientRect().width);
      passed.push(`${language} slot-vs-sizes within 1px at 10 widths, picked candidate covers slot`);
      assert.ok(!pageB.errors.length, `sweep page errors: ${pageB.errors.join("; ")}`);
      await pageB.context.close();

      // Page C (fresh): family switch swaps sources together without
      // remounting the app, adding exactly one mint file to its own load.
      const pageC = await newHome(browser, language);
      const switcher = pageC.page;
      await switcher.evaluate(() => { window.__w3probe = document.querySelector(".home-hero"); });
      for (let step = 0; step < 3; step++) {
        await switcher.locator(".app-topbar .theme-cycle").click();
        await switcher.waitForTimeout(200);
      }
      assert.equal(await switcher.evaluate(() => document.documentElement.getAttribute("data-theme")), "dark-mint");
      const afterSwitch = await switcher.locator(".hero-picture picture").evaluate((node) => ({
        currentSrc: node.querySelector("img").currentSrc,
        avif: node.querySelector("source[type='image/avif']").getAttribute("srcset"),
      }));
      assert.ok(afterSwitch.currentSrc.includes("/assets/hero/mint-"), `family switch shows mint art: ${afterSwitch.currentSrc}`);
      assert.ok(afterSwitch.avif.includes("mint-480."), "avif and img switch together");
      assert.ok(await switcher.evaluate(() => window.__w3probe?.isConnected === true), "family switch must not remount the hero");
      const switchedHeroFiles = [...new Set(pageC.heroRequests)];
      assert.equal(switchedHeroFiles.length, 2, `family switch adds exactly one mint file: ${JSON.stringify(switchedHeroFiles)}`);
      passed.push(`${language} family switch without remount, +1 request`);

      // LCP readout (recorded; CLS gating stays with rendering-baseline).
      const lcp = await switcher.evaluate(() => new Promise((resolve) => {
        let done = false;
        const finish = (value) => { if (!done) { done = true; resolve(value); } };
        try {
          const observer = new PerformanceObserver((list) => {
            const entry = list.getEntries().pop();
            if (entry) finish({ element: entry.element?.tagName ?? null, startTime: Math.round(entry.startTime), size: entry.size ?? null });
          });
          observer.observe({ type: "largest-contentful-paint", buffered: true });
          setTimeout(() => { observer.disconnect(); finish(null); }, 3000);
        } catch { finish(null); }
      }));
      recorded[`${language}Lcp`] = lcp;
      assert.ok(!pageC.errors.length, `switch page errors: ${pageC.errors.join("; ")}`);
      await pageC.context.close();
    }
    console.log(`Home asset contract passed: ${passed.length} checks.`);
    console.log(`Recorded: ${JSON.stringify(recorded)}`);
    if (out) await fs.writeFile(out, `${JSON.stringify({ passed, recorded }, null, 1)}\n`);
  } finally {
    await browser.close();
  }
} finally {
  if (server) await stopServer(server);
}

async function startDevServer() {
  const viteBin = path.join(repositoryRoot, "node_modules/vite/bin/vite.js");
  const child = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: repositoryRoot,
    env: { ...process.env, BROWSER: "none" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = [];
  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Vite dev exited early (${child.exitCode}): ${output.join("")}`);
    try { if ((await fetch(baseUrl)).ok) return child; } catch { /* Dev server is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  child.kill("SIGTERM");
  throw new Error(`Timed out waiting for ${baseUrl}: ${output.join("")}`);
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
