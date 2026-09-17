import puppeteer from 'puppeteer-core';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log("Checking TopBar on homepage...");
  await page.goto('http://localhost:4173/ko', { waitUntil: 'networkidle0' });
  let topbarTop = await page.evaluate(() => {
    const topbar = document.querySelector('.wl-topbar');
    return topbar ? topbar.getBoundingClientRect().top : null;
  });
  if (topbarTop !== 0) throw new Error(`TopBar top is ${topbarTop}, expected 0`);
  
  await page.evaluate(() => window.scrollTo(0, 500));
  await new Promise(r => setTimeout(r, 100));
  topbarTop = await page.evaluate(() => document.querySelector('.wl-topbar').getBoundingClientRect().top);
  if (topbarTop !== 0) throw new Error(`TopBar top is ${topbarTop} after scroll, expected 0`);
  console.log("TopBar is fixed at top=0.");

  console.log("Checking TopBar in Office Editor (Standard Mode)...");
  await page.goto('http://localhost:4173/ko/tools/office-editor/app/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.wl-topbar');
  
  console.log("Checking Drag Overlay in Office Editor...");
  await page.waitForSelector('[data-tool-page="office-editor-app"]');
  // Inject a file drop
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(["hello"], "test.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
    const event = new DragEvent('dragenter', { dataTransfer: dt, bubbles: true, cancelable: true });
    document.querySelector('[data-tool-page="office-editor-app"]').dispatchEvent(event);
  });
  await page.waitForSelector('[data-testid="office-drop-overlay"]');
  console.log("Drag overlay appeared.");
  
  await page.evaluate(() => {
    const dt = new DataTransfer();
    const event = new DragEvent('dragleave', { dataTransfer: dt, relatedTarget: null, bubbles: true, cancelable: true });
    window.dispatchEvent(event);
  });
  await new Promise(r => setTimeout(r, 100));
  const overlay = await page.$('[data-testid="office-drop-overlay"]');
  if (overlay) throw new Error("Drag overlay did not disappear on window leave!");
  console.log("Drag overlay disappeared on window leave.");
  
  await browser.close();
  console.log("All custom smoke tests passed!");
})();
