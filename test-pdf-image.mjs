import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";

const pdfPath = "tests/fixtures/pdf-finish/removal/removal-structures.pdf";

async function testPdfImage() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  
  await page.goto("http://localhost:5173/ko/tools/pdf-editor/pdf-to-image");
  
  const fileInput = await page.locator("input[type=file]");
  await fileInput.setInputFiles(pdfPath);
  
  await page.waitForTimeout(2000); 

  const submitBtn = await page.locator("button:has-text('ZIP')");
  await submitBtn.click();
  
  console.log("Waiting for PdfDownloadCard...");
  // Wait for the download card to appear. It might have a download link or button.
  // In `PdfDownloadCard`, it's an <a> tag usually, or a button. Let's look for text "다운로드" or "저장".
  const downloadLink = await page.locator("a:has-text('다운로드'), a:has-text('저장'), a[download]");
  await downloadLink.waitFor({ state: "visible", timeout: 60000 });
  
  console.log("Starting download...");
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    downloadLink.click()
  ]);
  
  const downloadPath = await download.path();
  console.log("Downloaded ZIP to:", downloadPath);
  
  const extractDir = "/tmp/pdf-image-test";
  await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(extractDir, { recursive: true });
  
  execSync(`unzip -o ${downloadPath} -d ${extractDir}`);
  
  const files = await fs.readdir(extractDir);
  console.log("Extracted files:", files);
  
  for (const file of files) {
    if (file.endsWith(".jpg") || file.endsWith(".png")) {
      const stat = await fs.stat(path.join(extractDir, file));
      console.log(`Image ${file} size: ${stat.size} bytes`);
      if (stat.size < 5000) {
        console.warn(`Warning: Image ${file} seems suspiciously small (white/blank?).`);
      } else {
        console.log(`Success: Image ${file} seems large enough!`);
      }
    }
  }
  
  await browser.close();
}

testPdfImage().catch(console.error);
