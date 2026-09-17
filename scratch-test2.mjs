import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/ko/tools/pdf-compare', { waitUntil: 'networkidle' });
  const text = await page.evaluate(() => document.body.innerText);
  console.log("TEXT:\n", text);
  
  await browser.close();
})();
