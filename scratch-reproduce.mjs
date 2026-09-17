import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext();
  
  // Inject script to mock non-secure context where crypto.randomUUID is missing
  await context.addInitScript(() => {
    Object.defineProperty(window, 'isSecureContext', { value: false });
    if (window.crypto) {
      window.crypto.randomUUID = undefined;
    }
  });

  const page = await context.newPage();
  
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE_ERROR:', err.toString()));

  await page.goto('http://localhost:5173/ko/tools/pdf-compare', { waitUntil: 'networkidle' });
  
  const text = await page.evaluate(() => {
    const errorBoundary = document.querySelector('h1, h2, h3, .text-destructive, [role="alert"]');
    return document.body.innerText.substring(0, 500);
  });
  console.log("PAGE TEXT EXTRACT:\n", text);
  
  await browser.close();
})();
