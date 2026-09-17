import { chromium } from "playwright";

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes("jbig2") || text.includes("Unable to decode") || text.includes("Dependent image")) {
      console.log("WARN:", text);
    }
  });

  await page.goto("http://localhost:5173/ko/tools/pdf-editor");
  const fileInput = page.locator("input[type=file]");
  await fileInput.setInputFiles("tests/fixtures/pdf-ccitt/ccitt-5pages.pdf");
  await page.waitForTimeout(5000);

  const pageCards = await page.locator(".pdf-page-card").count();
  const thumbnailFrames = await page.locator(".pdf-thumbnail-frame").count();
  const thumbnailImgs = await page.locator(".pdf-thumbnail-frame img").count();
  const thumbnailPlaceholders = await page.locator(".pdf-thumbnail-placeholder").count();

  console.log(`Page cards: ${pageCards}`);
  console.log(`Thumbnail frames: ${thumbnailFrames}`);
  console.log(`Thumbnail images: ${thumbnailImgs}`);
  console.log(`Thumbnail placeholders: ${thumbnailPlaceholders}`);

  // Check if thumbnails loaded (img) or are still placeholders
  if (thumbnailImgs > 0) {
    console.log("✅ Thumbnails loaded as images");
  } else if (thumbnailPlaceholders > 0) {
    console.log("ℹ️ Thumbnails still as placeholders (worker OffscreenCanvas may not be available in headless)");
  }

  await browser.close();
}
test().catch(console.error);
