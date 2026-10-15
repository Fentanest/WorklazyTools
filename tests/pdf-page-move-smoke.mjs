import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { PDFDocument, StandardFonts } from "pdf-lib";
import JSZip from "jszip";

const base = process.env.PDF_MOVE_BASE_URL || "http://127.0.0.1:5184";
const out = process.env.PDF_MOVE_EVIDENCE || await fs.mkdtemp(path.join(os.tmpdir(), "worklazy-pdf-move-"));
await fs.mkdir(out, { recursive: true });
const files = [];
for (const prefix of ["A", "B"]) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let index = 1; index <= 3; index++) pdf.addPage([250, 320]).drawText(`${prefix}${index}`, { x: 40, y: 240, size: 40, font });
  const file = path.join(out, `${prefix}.pdf`); await fs.writeFile(file, await pdf.save()); files.push(file);
}
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = []; page.on("pageerror", error => errors.push(error.message));
await page.route("**/*", route => {
  const url = new URL(route.request().url());
  if (!["http:", "https:"].includes(url.protocol) || url.origin === new URL(base).origin) return route.continue();
  return route.abort("blockedbyclient");
});
const cards = page.locator(".pdf-page-card");
const card = name => cards.filter({ has: page.locator(`.pdf-page-source[title="${name[0]}.pdf"]`) }).filter({ hasText: `Source page ${name[1]}` });
const readOrder = nodes => nodes.map(node => `${node.querySelector(".pdf-page-source strong").textContent[0]}${node.querySelector(".pdf-page-source small").textContent.match(/\d+/)[0]}`);
const order = () => cards.evaluateAll(readOrder);
async function expectOrder(expected) {
  await page.waitForFunction(expected => {
    const found = [...document.querySelectorAll(".pdf-page-card")].map(node => `${node.querySelector(".pdf-page-source strong").textContent[0]}${node.querySelector(".pdf-page-source small").textContent.match(/\d+/)[0]}`);
    return JSON.stringify(found) === JSON.stringify(expected);
  }, expected, { timeout: 15000 });
  assert.deepEqual(await order(), expected);
}
async function drag(handle, target, after = true) {
  await handle.scrollIntoViewIfNeeded();
  const initialFrom = await handle.boundingBox();
  const initialTo = await target.boundingBox();
  await page.evaluate(top => window.scrollBy(0, top - 130), Math.min(initialFrom.y, initialTo.y));
  const from = await handle.boundingBox();
  const to = await target.boundingBox();
  const isGroup = await target.evaluate(element => element.classList.contains("pdf-file-group"));
  // Pointer inputs exercise Sortable's real native drag path. No app state calls or synthetic onEnd.
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 12, { steps: 5 });
  await page.waitForTimeout(180);
  await page.mouse.move(to.x + (after ? to.width - 8 : 8), to.y + (isGroup ? after ? to.height - 8 : 8 : to.height / 2), { steps: 20 });
  await page.waitForTimeout(250);
  assert.equal(await page.locator('[data-testid=global-file-drop]').count(), 0, "internal drag must not show upload overlay");
  await page.screenshot({ path: path.join(out, `drag-${Date.now()}.png`) });
  await page.mouse.up();
  await page.waitForTimeout(250);
}
async function outputText(bytes) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loading = pdfjs.getDocument({ data: new Uint8Array(bytes), standardFontDataUrl: `${path.resolve("node_modules/pdfjs-dist/standard_fonts")}/` });
  const doc = await loading.promise;
  try { const labels = []; for (let index = 1; index <= doc.numPages; index++) labels.push((await (await doc.getPage(index)).getTextContent()).items.map(item => item.str || "").join("").trim()); return labels; }
  finally { await loading.destroy(); }
}
async function downloadResult(name) {
  const waiting = page.waitForEvent("download");
  await page.locator('[data-testid="pdf-download"]').click();
  const result = await waiting; const file = path.join(out, name); await result.saveAs(file); return fs.readFile(file);
}
try {
  await page.goto(`${base}/en/tools/pdf-editor/`, { waitUntil: "networkidle" });
  await page.locator('input[type="file"]').first().setInputFiles(files);
  await expectOrder(["A1", "A2", "A3", "B1", "B2", "B3"]);
  assert.equal(await cards.locator('input[type="checkbox"]:checked').count(), 6);
  assert.equal(await page.locator('[data-move-selected="true"]').count(), 0);
  await drag(card("A1").locator(".pdf-drag-handle"), card("A2"));
  await expectOrder(["A2", "A1", "A3", "B1", "B2", "B3"]);
  console.log("ok 1 - initial auto-output selection still drags one page");

  await page.getByRole("button", { name: "Clear selection", exact: true }).click();
  await card("A1").locator('input[type="checkbox"]').click();
  await card("B1").locator('input[type="checkbox"]').click({ modifiers: ["Shift"] });
  assert.equal(await page.locator('[data-move-selected="true"]').count(), 3);
  await drag(card("A3").locator(".pdf-drag-handle"), card("B3"));
  await expectOrder(["A2", "B2", "B3", "A1", "A3", "B1"]);
  assert.equal(await page.locator('[data-move-selected="true"]').count(), 3);
  console.log("ok 2 - Shift-selected pages move together in visual order and stay selected");

  await page.getByRole("button", { name: "Select all", exact: true }).click();
  await page.getByRole("button", { name: "Clear move selection", exact: true }).click();
  await card("A3").locator('input[type="checkbox"]').click();
  await card("A1").getByRole("button", { name: "Rotate 90 degrees clockwise" }).click();
  await card("B2").getByRole("button", { name: "Delete page", exact: true }).click();
  const originalThumbnail = await card("A1").locator(".pdf-thumbnail-frame img").getAttribute("src");
  await page.getByLabel("Group by source file", { exact: true }).check();
  await expectOrder(["A2", "A1", "A3", "B3", "B1"]);
  assert.equal(await page.locator(".pdf-drag-handle").count(), 0);
  const groups = page.locator(".pdf-file-group");
  await drag(groups.first().locator(".pdf-file-drag-handle"), groups.last());
  await expectOrder(["B3", "B1", "A2", "A1", "A3"]);
  await page.getByLabel("Group by source file", { exact: true }).uncheck();
  await expectOrder(["B3", "B1", "A2", "A1", "A3"]);
  assert.equal(await card("A1").getAttribute("data-rotation"), "90");
  await card("A1").locator(".pdf-thumbnail-frame img").waitFor();
  assert.equal(await card("A1").locator(".pdf-thumbnail-frame img").getAttribute("src"), originalThumbnail);
  assert.equal(await card("A3").locator('input[type="checkbox"]').isChecked(), false);
  await page.getByRole("button", { name: "Create PDF", exact: true }).click();
  await page.locator('[data-testid="pdf-download"]').waitFor();
  const merged = await downloadResult("merged.pdf");
  assert.deepEqual(await outputText(merged), ["B3", "B1", "A2", "A1"]);
  assert.equal((await PDFDocument.load(merged)).getPage(3).getRotation().angle, 90);
  console.log("ok 3 - grouped drag and ungroup preserve edits, deletion, output order and rotation");

  await page.getByRole("radio", { name: /One PDF per range/ }).click();
  const range = page.locator(".pdf-range-group input").last();
  await range.fill("1, 4");
  await drag(card("A1").locator(".pdf-drag-handle"), card("B3"), false);
  await expectOrder(["A1", "B3", "B1", "A2", "A3"]);
  assert.equal(await range.inputValue(), "1-2");
  assert.equal(await page.locator('[data-testid="pdf-download"]').count(), 0);
  await page.getByRole("button", { name: "Create PDF ZIP", exact: true }).click();
  await page.locator('[data-testid="pdf-download"]').waitFor();
  const zip = await JSZip.loadAsync(await downloadResult("ranges.zip"));
  const pdf = Object.values(zip.files).find(entry => !entry.dir && entry.name.endsWith(".pdf"));
  assert.deepEqual(await outputText(await pdf.async("uint8array")), ["A1", "B3"]);
  console.log("ok 4 - ranges retain actual page IDs and export reordered content");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Group by source file", { exact: true }).check();
  await page.getByLabel("Group by source file", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, "mobile-grouped.png"), fullPage: true });
  await page.screenshot({ path: path.join(out, "mobile-grouped-viewport.png") });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "mobile page has no horizontal overflow");
  assert.deepEqual(errors, []);
  console.log("ok 5 - mobile grouped layout fits and no browser exceptions occurred");
  console.log(`1..5\n# tests 5\n# pass 5\n# fail 0\nEvidence: ${out}`);
} catch (error) {
  await page.screenshot({ path: path.join(out, "failure.png"), fullPage: true });
  console.error("Order:", await order(), "Errors:", errors, "Evidence:", out);
  throw error;
} finally { await browser.close(); }
