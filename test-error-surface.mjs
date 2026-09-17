import { chromium } from "playwright";

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes("Dependent") || text.includes("decode") || text.includes("디코딩")) {
      console.log("CONSOLE:", text);
    }
  });

  await page.goto("http://localhost:5173/ko/tools/pdf-editor/pdf-to-image");
  const fileInput = page.locator("input[type=file]");
  await fileInput.setInputFiles("tests/fixtures/pdf-ccitt/ccitt-image-mask.pdf");
  await page.waitForTimeout(2000);

  const submitBtn = page.locator("button:has-text('ZIP')");
  await submitBtn.click();

  // Wait for either download card or error
  await page.waitForTimeout(15000);

  const downloadLinks = await page.locator("a[download]").count();
  const errorElements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[class*="text-destructive"], [role="alert"], [class*="error"]')).map(el => el.textContent?.trim()).filter(Boolean);
  });

  // Also check for the OperationProgress fail state
  const opFailText = await page.evaluate(() => {
    const el = document.querySelector('[class*="operation-fail"], [class*="destructive"]');
    return el?.textContent?.trim() || null;
  });

  console.log("Download links:", downloadLinks);
  console.log("Error elements:", errorElements);
  console.log("Operation fail:", opFailText);

  if (downloadLinks > 0) {
    console.log("Result: Download succeeded");
  } else if (errorElements.length > 0 || opFailText) {
    console.log("Result: Error surfaced correctly");
  } else {
    console.log("Result: UNEXPECTED - neither download nor error");
  }

  await browser.close();
}
test().catch(console.error);
