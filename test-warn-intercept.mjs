import { chromium } from "playwright";

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto("http://localhost:5173/ko/tools/pdf-editor/pdf-to-image");

  // Inject a console.warn interceptor BEFORE the PDF is loaded
  await page.evaluate(() => {
    window.__capturedWarns = [];
    const origWarn = console.warn;
    console.warn = (...args) => {
      window.__capturedWarns.push(args.map(String).join(' '));
      origWarn.apply(console, args);
    };
  });

  const fileInput = page.locator("input[type=file]");
  await fileInput.setInputFiles("tests/fixtures/pdf-ccitt/ccitt-image-mask.pdf");
  await page.waitForTimeout(2000);

  const submitBtn = page.locator("button:has-text('ZIP')");
  await submitBtn.click();
  await page.waitForTimeout(15000);

  const capturedWarns = await page.evaluate(() => window.__capturedWarns);
  console.log("Captured warns on page:", capturedWarns);

  await browser.close();
}
test().catch(console.error);
