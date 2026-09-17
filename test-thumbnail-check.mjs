import { chromium } from "playwright";

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("http://localhost:5173/ko/tools/pdf-editor");
  
  const fileInput = page.locator("input[type=file]");
  await fileInput.setInputFiles("tests/fixtures/pdf-ccitt/ccitt-5pages.pdf");
  await page.waitForTimeout(5000);

  // Check what's actually in the DOM
  const allCanvases = await page.locator("canvas").count();
  const allImgs = await page.locator("img").count();
  console.log(`canvas: ${allCanvases}, img: ${allImgs}`);
  
  // Check for specific thumbnail elements
  const previewElements = await page.evaluate(() => {
    const elements = [];
    document.querySelectorAll('[class*="thumbnail"], [class*="preview"], [class*="page-card"], canvas, [class*="pdf-page"]').forEach(el => {
      elements.push({ tag: el.tagName, classes: el.className, width: el.clientWidth, height: el.clientHeight });
    });
    return elements;
  });
  console.log("Preview elements:", JSON.stringify(previewElements, null, 2));

  await browser.close();
}
test().catch(console.error);
