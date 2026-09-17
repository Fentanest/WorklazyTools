import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const page = await browser.newPage();
await page.goto("http://127.0.0.1:4173/ko/tools/office-editor?guide=1", { waitUntil: "networkidle0" });
const html = await page.evaluate(() => document.body.innerHTML);
import fs from "fs";
fs.writeFileSync("scratch/dom.html", html);
await browser.close();
