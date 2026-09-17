import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('BROWSER ERROR:', msg.text());
    }
  });

  await page.goto('http://localhost:5173/ko/tools/pdf-compare', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'pdf-compare.png' });
  
  await browser.close();
})();
