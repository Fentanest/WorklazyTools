import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";

const base = process.env.TEST_BASE_URL || "http://127.0.0.1:4187";
const fixture = path.join(import.meta.dirname, "fixtures/document-converters");
const expected = JSON.parse(await fs.readFile(path.join(fixture, "markdown-expected.json"), "utf8"));
const richExpected = JSON.parse(await fs.readFile(path.join(fixture, "rich-markdown-expected.json"), "utf8"));
let browser, page;
const external = [];
const errors = [];
before(async () => {
  browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => localStorage.setItem("worklazy_privacy_consent_v2", "denied"));
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(base).origin || ["data:", "blob:"].includes(url.protocol)) return route.continue();
    external.push(url.origin); return route.abort();
  });
  page = await context.newPage();
  page.setDefaultTimeout(120000);
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", message => { if (message.type() === "error") console.error("[browser]", message.text()); });
  await page.goto(base + "/en/tools/document-markdown");
  await page.locator("[data-tool-page='document-markdown']").waitFor();
});
after(async () => { await browser?.close(); });
for (const extension of ["docx", "xlsx", "xls", "pptx", "pdf"]) {
  test(extension.toUpperCase() + " uses actual MarkItDown and matches native Python output", async () => {
    await page.locator("input[type=file]").setInputFiles(path.join(fixture, "sample." + extension));
    await page.getByRole("button", { name: "Create Markdown", exact: true }).click();
    const link = page.getByTestId("markdown-download");
    await page.waitForFunction(() => document.querySelector("[data-testid=markdown-download], [role=alert]"));
    assert.equal(await page.getByRole("alert").allTextContents().then(x => x.join(" ")), "");
    await link.waitFor();
    const markdown = await link.evaluate(async element => (await fetch(element.href)).text());
    assert.equal(markdown, expected[extension]);
    assert.equal(await link.getAttribute("download"), "sample.md");
    assert.equal(await page.locator("textarea").inputValue(), expected[extension]);
    assert.equal(await page.locator("[role=alert]").count(), 0);
  });
}
for (const extension of ["docx", "xlsx", "pdf"]) {
  test("rich " + extension + " matches unmodified native MarkItDown", async () => {
    await page.locator("input[type=file]").setInputFiles(path.join(fixture, "rich." + extension));
    await page.getByRole("button", { name: "Create Markdown", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("[data-testid=markdown-download], [role=alert]"));
    assert.deepEqual(await page.getByRole("alert").allTextContents(), []);
    await page.getByTestId("markdown-download").waitFor();
    assert.equal(await page.locator("textarea").inputValue(), richExpected[extension]);
    assert.match(richExpected[extension], /한글/);
    assert.match(richExpected[extension], /42/);
  });
}
test("unsupported input and damaged DOCX cannot leave a stale successful download", async () => {
  await page.locator("input[type=file]").setInputFiles({ name: "legacy.doc", mimeType: "application/msword", buffer: Buffer.from("unsupported") });
  await page.getByRole("alert").waitFor();
  assert.equal(await page.getByTestId("markdown-download").count(), 0);
  assert.equal(await page.getByRole("button", { name: "Create Markdown", exact: true }).isDisabled(), true);
  await page.locator("input[type=file]").setInputFiles({ name: "broken.docx", mimeType: "application/octet-stream", buffer: Buffer.from("not an Office ZIP") });
  await page.getByRole("button", { name: "Create Markdown", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "could not be converted" }).waitFor();
  assert.equal(await page.getByTestId("markdown-download").count(), 0);
});
test("a PDF with no text reports the OCR limitation instead of producing an empty result", async () => {
  const pdf = await PDFDocument.create(); pdf.addPage([300, 400]);
  await page.locator("input[type=file]").setInputFiles({ name: "no-text.pdf", mimeType: "application/pdf", buffer: Buffer.from(await pdf.save()) });
  await page.getByRole("button", { name: "Create Markdown", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "No text was extracted" }).waitFor();
  assert.equal(await page.getByTestId("markdown-download").count(), 0);
});
test('encrypted OOXML is rejected before parsing or downloading another runtime', async () => {
  await page.locator('input[type=file]').setInputFiles(path.join(fixture, 'encrypted.docx'));
  await page.getByRole('button', { name: 'Create Markdown', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Password-protected' }).waitFor();
  assert.equal(await page.getByTestId('markdown-download').count(), 0);
});
test("cancel terminates initialization and a new file can be converted", async () => {
  let held;
  const pattern = "**/vendor/markitdown/0.1.8/converters.zip";
  await page.route(pattern, route => { held = route; });
  await page.locator("input[type=file]").setInputFiles(path.join(fixture, "sample.docx"));
  await page.getByRole("button", { name: "Create Markdown", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".ui-operation-progress.ui-status-running"));
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.unroute(pattern);
  if (held) await held.abort().catch(() => {});
  assert.equal(await page.getByTestId("markdown-download").count(), 0);
  await page.locator("input[type=file]").setInputFiles(path.join(fixture, "sample.xlsx"));
  await page.getByRole("button", { name: "Create Markdown", exact: true }).click();
  await page.getByTestId("markdown-download").waitFor();
  assert.equal(await page.locator("textarea").inputValue(), expected.xlsx);
});
test("Korean mobile page remains usable and document processing makes no external request", async () => {
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("markdown-download").click()]);
  assert.equal(download.suggestedFilename(), "sample.md");
  assert.equal(await download.failure(), null);
  page = await page.context().newPage();
  page.setDefaultTimeout(120000);
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(base + "/ko/tools/document-markdown/");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Markdown 만들기", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(external, []);
  assert.deepEqual(errors, []);
});
