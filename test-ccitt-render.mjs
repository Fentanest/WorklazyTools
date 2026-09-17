import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";

const CCITT_1PAGE = "tests/fixtures/pdf-ccitt/ccitt-image-mask.pdf";
const CCITT_5PAGE = "tests/fixtures/pdf-ccitt/ccitt-5pages.pdf";
const NORMAL_PDF = "tests/fixtures/pdf-finish/removal/removal-structures.pdf";
const BASE_URL = "http://localhost:5173";

let passed = 0;
let failed = 0;

function ok(label) { passed++; console.log(`  ✅ ${label}`); }
function fail(label, reason) { failed++; console.error(`  ❌ ${label}: ${reason}`); }

async function testPdfToImage(page, pdfPath, format, label) {
  console.log(`\n── ${label} ──`);
  const suffix = format === "jpeg" ? "jpg" : "png";

  await page.goto(`${BASE_URL}/ko/tools/pdf-editor/pdf-to-image`);
  const fileInput = page.locator("input[type=file]");
  await fileInput.setInputFiles(pdfPath);
  await page.waitForTimeout(2000);

  // Switch format if needed
  if (format === "jpeg") {
    const jpgTab = page.locator("button:has-text('JPG')");
    if (await jpgTab.isVisible()) await jpgTab.click();
  }

  const submitBtn = page.locator("button:has-text('ZIP')");
  await submitBtn.click();

  const downloadLink = page.locator("a[download]");
  try {
    await downloadLink.waitFor({ state: "visible", timeout: 60000 });
  } catch {
    fail(`${label} download card`, "다운로드 카드 미출현 (60초 초과)");
    return;
  }

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 30000 }),
    downloadLink.click(),
  ]);

  const dlPath = await download.path();
  const extractDir = `/tmp/pdf-test-${Date.now()}`;
  await fs.mkdir(extractDir, { recursive: true });
  execSync(`unzip -o "${dlPath}" -d "${extractDir}"`);

  const files = (await fs.readdir(extractDir)).filter(
    (f) => f.endsWith(`.${suffix}`) || f.endsWith(".png")
  );
  if (files.length === 0) {
    fail(`${label} extraction`, "ZIP 내부에 이미지 파일 없음");
    return;
  }
  ok(`${label}: ${files.length} images extracted`);

  for (const f of files) {
    const stat = await fs.stat(path.join(extractDir, f));
    if (stat.size < 2000) {
      fail(`${label} ${f}`, `${stat.size}B — 의심스럽게 작음 (빈 이미지?))`);
    } else {
      ok(`${label} ${f}: ${stat.size}B`);
    }
  }

  await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});
}

async function testThumbnail(page, pdfPath, label) {
  console.log(`\n── ${label}: Thumbnail ──`);
  await page.goto(`${BASE_URL}/ko/tools/pdf-editor`);
  const fileInput = page.locator("input[type=file]");
  await fileInput.setInputFiles(pdfPath);
  await page.waitForTimeout(3000);

  const thumbnails = page.locator("canvas, .pdf-page-preview img");
  const count = await thumbnails.count();
  if (count > 0) {
    ok(`${label}: ${count} thumbnail(s) rendered`);
  } else {
    fail(`${label}: thumbnails`, "썸네일 미출현");
  }
}

async function main() {
  console.log("═══ PDF CCITT/Image Decode Test Suite ═══\n");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  // 1) CCITT 1-page PNG
  await testPdfToImage(page, CCITT_1PAGE, "png", "CCITT 1p → PNG");

  // 2) CCITT 5-page PNG
  await testPdfToImage(page, CCITT_5PAGE, "png", "CCITT 5p → PNG");

  // 3) CCITT 5-page JPG
  await testPdfToImage(page, CCITT_5PAGE, "jpeg", "CCITT 5p → JPG");

  // 4) Normal PDF PNG (regression)
  await testPdfToImage(page, NORMAL_PDF, "png", "Normal PDF → PNG");

  // 5) Thumbnails
  await testThumbnail(page, CCITT_5PAGE, "CCITT 5p");
  await testThumbnail(page, NORMAL_PDF, "Normal PDF");

  await browser.close();

  console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
