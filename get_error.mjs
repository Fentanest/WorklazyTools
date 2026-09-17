import puppeteer from "puppeteer-core";
async function run() {
  const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:4173/ko/tools/pdf-editor/");
  await page.waitForSelector("[data-route-error]");
  const text = await page.evaluate(() => document.body.innerText);
  console.log(text);
  await browser.close();
}
run();
