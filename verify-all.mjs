import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  
  const urls = [
    'http://localhost:5173/ko/tools/pdf-compare',
    'http://localhost:5173/ko/tools/excel-merger',
    'http://localhost:5173/ko/tools/document-compare'
  ];

  for (const url of urls) {
    console.log(`Checking ${url}...`);
    const page = await browser.newPage();
    page.on('console', msg => { if (msg.type() === 'error') console.log(`ERROR on ${url}:`, msg.text()) });
    page.on('pageerror', err => console.log(`PAGE ERROR on ${url}:`, err.toString()));
    
    await page.goto(url, { waitUntil: 'networkidle' });
    const hasErrorBoundary = await page.evaluate(() => document.body.innerText.includes('도구를 불러오지 못했습니다'));
    if (hasErrorBoundary) {
      console.log(`❌ ${url} HAS ERROR BOUNDARY!`);
    } else {
      console.log(`✅ ${url} loaded fine.`);
    }
    await page.close();
  }
  
  await browser.close();
})();
