import puppeteer from "puppeteer-core";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";

async function checkPage(page, url, expectedMode) {
  console.log(`Checking ${url}...`);
  await page.goto(url, { waitUntil: "networkidle2" });
  
  // Check for route error
  const errorElement = await page.$("[data-route-error]");
  if (errorElement) throw new Error(`Found data-route-error on ${url}`);
  
  // Wait for guide or dropzone
  await page.waitForSelector("[data-testid='tool-guide']", { timeout: 5000 }).catch(() => {
    throw new Error(`Guide not found on ${url}`);
  });
  
  // Make sure it's not fallback
  const fallback = await page.evaluate(() => document.body.innerHTML.includes("설명 정보를 불러올 수 없습니다."));
  if (fallback) throw new Error(`Fallback guide shown on ${url}`);
  
  // Make sure loading is not stuck
  const loading = await page.evaluate(() => document.body.innerHTML.includes("로딩 중"));
  if (loading) throw new Error(`Stuck loading on ${url}`);
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    
    // Check main direct entry
    await checkPage(page, `${baseUrl}/ko/tools/pdf-editor/`, "organize");
    await checkPage(page, `${baseUrl}/en/tools/pdf-editor/`, "organize");
    
    // Check all modes
    const modes = ["", "finish/", "image-to-pdf/", "pdf-to-image/", "convert/"];
    for (const mode of modes) {
      await checkPage(page, `${baseUrl}/ko/tools/pdf-editor/${mode}`, mode);
      await checkPage(page, `${baseUrl}/en/tools/pdf-editor/${mode}`, mode);
    }
    
    // Internal navigation check
    await page.goto(`${baseUrl}/ko/tools/pdf-editor/`, { waitUntil: "networkidle2" });
    const finishTab = await page.$("a[href='/ko/tools/pdf-editor/finish/']");
    if (finishTab) {
       await Promise.all([
          page.waitForNavigation({ waitUntil: "networkidle2" }),
          finishTab.click()
       ]);
       await page.waitForSelector("[data-testid='tool-guide']");
    }

    console.log("PDF Router Smoke Test Passed!");
  } finally {
    await browser.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
