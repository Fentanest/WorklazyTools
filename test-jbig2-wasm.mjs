import { chromium } from "playwright";

const pdfPath = "test-ccitt.pdf";

async function testWasmLoad() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  await page.goto("http://localhost:5173/ko/tools/pdf-editor");
  
  await page.evaluate(() => {
    const origWarn = console.warn;
    console.warn = (...args) => {
      origWarn(...args);
      if (typeof args[0] === 'string' && args[0].includes("Dependent image isn't ready yet")) {
         window.IMAGE_ERROR = true;
      }
    };
  });

  const fileInput = await page.locator("input[type=file]");
  await fileInput.setInputFiles(pdfPath);
  
  await page.waitForTimeout(3000);
  
  const hasError = await page.evaluate(() => !!window.IMAGE_ERROR);
  console.log("HAS IMAGE ERROR:", hasError);

  await browser.close();
}
testWasmLoad().catch(console.error);
