import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";

const CCITT_5PAGE = "tests/fixtures/pdf-ccitt/ccitt-5pages.pdf";
const NORMAL_PDF = "tests/fixtures/pdf-finish/removal/removal-structures.pdf";
const BASE_URL = "http://localhost:5173";
let passed = 0, failed = 0;
function ok(l) { passed++; console.log(`  ✅ ${l}`); }
function fail(l, r) { failed++; console.error(`  ❌ ${l}: ${r}`); }

async function testExport(page, pdfPath, format, label) {
  console.log(`\n── ${label} ──`);
  await page.goto(`${BASE_URL}/ko/tools/pdf-editor/pdf-to-image`);
  const fi = page.locator("input[type=file]");
  await fi.setInputFiles(pdfPath);
  await page.waitForTimeout(2000);
  if (format === "jpeg") {
    const jpgTab = page.locator("button:has-text('JPG')");
    if (await jpgTab.isVisible()) await jpgTab.click();
  }
  const sb = page.locator("button:has-text('ZIP')");
  await sb.click();
  const dl = page.locator("a[download]");
  try {
    await dl.waitFor({ state: "visible", timeout: 60000 });
  } catch {
    fail(label, "다운로드 카드 미출현");
    return;
  }
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 30000 }),
    dl.click(),
  ]);
  const dlPath = await download.path();
  const dir = `/tmp/pdf-final-${Date.now()}`;
  await fs.mkdir(dir, { recursive: true });
  execSync(`unzip -o "${dlPath}" -d "${dir}"`);
  const suffix = format === "jpeg" ? "jpg" : "png";
  const files = (await fs.readdir(dir)).filter(f => f.endsWith(`.${suffix}`) || f.endsWith(".png"));
  ok(`${label}: ${files.length} images`);
  for (const f of files) {
    const s = (await fs.stat(path.join(dir, f))).size;
    if (s < 2000) fail(`${label} ${f}`, `${s}B too small`);
    else ok(`${label} ${f}: ${s}B`);
  }
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
}

async function main() {
  console.log("═══ Final Verification ═══");
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();

  await testExport(page, CCITT_5PAGE, "png", "CCITT 5p→PNG");
  await testExport(page, CCITT_5PAGE, "jpeg", "CCITT 5p→JPG");
  await testExport(page, NORMAL_PDF, "png", "Normal→PNG");

  await browser.close();
  console.log(`\n═══ Final: ${passed} passed, ${failed} failed ═══`);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
