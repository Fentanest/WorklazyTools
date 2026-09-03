import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";

import ExcelJS from "exceljs";
import JSZip from "jszip";
import officeCrypto from "officecrypto-tool";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import puppeteer from "puppeteer-core";
import * as XLSX from "xlsx";

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const WORD_2010_NS = "http://schemas.microsoft.com/office/word/2010/wordml";
const WORD_2012_NS = "http://schemas.microsoft.com/office/word/2012/wordml";
const WORD_CID_NS = "http://schemas.microsoft.com/office/word/2016/wordml/cid";
const WORD_CEX_NS = "http://schemas.microsoft.com/office/word/2018/wordml/cex";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:5173";
const koBaseUrl = `${baseUrl}/ko`;
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "worklazytools-test-"));

try {
  const fixtures = await createFixtures(tempDir);
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(180_000);
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(Crypto.prototype, "randomUUID", { configurable: true, value: undefined });
    });
    const pageErrors = [];
    const outboundWrites = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
      console.error("[page error]", error.message);
    });
    page.on("request", (request) => {
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
        const requestUrl = new URL(request.url());
        const isConfiguredAnalyticsWrite = (requestUrl.hostname === "wcs.naver.com" && requestUrl.pathname === "/b")
          || (requestUrl.hostname.endsWith("google-analytics.com") && requestUrl.pathname.endsWith("/collect"));
        if (isConfiguredAnalyticsWrite) return;
        outboundWrites.push(`${request.method()} ${request.url()}`);
      }
    });

    if (process.env.TEST_SCOPE === "pdf") {
      await testPdfTools(page, fixtures, tempDir);
    } else if (process.env.TEST_SCOPE === "excel") {
      await testEncryptedExcelMerge(page, fixtures, tempDir);
      await testExcelThemeColors(page, fixtures, tempDir);
      await testFormulaTranslation(page, fixtures, tempDir);
      await testExcelSheetSelection(page, fixtures, tempDir);
      await testExcelSheetGridLayout(page, fixtures);
      await testExcelSheetTrim(page, fixtures, tempDir);
    } else if (process.env.TEST_SCOPE === "word") {
      await testWordCompare(page, fixtures, tempDir);
    } else {
      await testEncryptedExcelMerge(page, fixtures, tempDir);
      await testExcelThemeColors(page, fixtures, tempDir);
      await testFormulaTranslation(page, fixtures, tempDir);
      await testExcelSheetSelection(page, fixtures, tempDir);
      await testExcelSheetGridLayout(page, fixtures);
      await testExcelSheetTrim(page, fixtures, tempDir);
      await testWordCompare(page, fixtures, tempDir);
      await testPdfTools(page, fixtures, tempDir);
    }

    if (pageErrors.length) throw new Error(`Browser errors:\n${pageErrors.join("\n")}`);
    if (outboundWrites.length) throw new Error(`Unexpected outbound writes:\n${outboundWrites.join("\n")}`);
  } finally {
    await browser.close();
  }

  console.log("Browser smoke tests passed: Excel, Word comparison, PDF edit/range split and PDF conversion.");
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}

async function testPdfTools(page, fixtures, tempDir) {
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await navigateTo(page, `${koBaseUrl}/tools/pdf-editor/`);
  const privacyChoice = await page.$(".privacy-consent-actions .secondary-button");
  if (privacyChoice) await privacyChoice.click();
  const input = await page.$('input[type="file"]');
  await input.uploadFile(fixtures.textPdf);
  await page.waitForFunction(() => document.querySelectorAll(".pdf-page-card").length === 2);
  await page.waitForFunction(() => Array.from(document.querySelectorAll(".pdf-page-card .pdf-thumbnail-frame img")).length === 2 && Array.from(document.querySelectorAll(".pdf-page-card .pdf-thumbnail-frame img")).every((image) => image.complete && image.naturalWidth > 1));
  const firstThumbnailSrc = await page.$eval(".pdf-page-card:first-child .pdf-thumbnail-frame img", (image) => image.src);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise((resolve) => setTimeout(resolve, 120));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction((src) => document.querySelector(".pdf-page-card:first-child .pdf-thumbnail-frame img")?.src === src && !document.querySelector(".pdf-page-card:first-child .pdf-thumbnail-placeholder"), {}, firstThumbnailSrc);
  await page.waitForFunction(() => document.querySelector("#pdf-selection-range")?.value === "1-2");
  await page.click('.pdf-page-card:first-child button[aria-label="오른쪽으로 90도 회전"]');
  const rotationState = await page.$eval(".pdf-page-card:first-child", (card) => ({
    data: card.getAttribute("data-rotation"),
    transform: card.querySelector(".pdf-thumbnail-frame img")?.style.transform || "",
  }));
  if (rotationState.data !== "90" || !rotationState.transform.includes("rotate(90deg)")) {
    throw new Error(`PDF thumbnail rotation was not reflected immediately: ${JSON.stringify(rotationState)}`);
  }
  await page.waitForFunction(() => !document.querySelector(".summary-card .primary-button")?.disabled);
  await clickPrimaryAction(page);
  const immediateFeedback = await page.$eval(".pdf-output-action-zone", (element) => ({
    running: Boolean(element.querySelector(".operation-progress.status-running")),
    ready: Boolean(element.querySelector(".pdf-download-compact .result-download")),
    buttonText: element.querySelector(".primary-button")?.textContent || "",
  }));
  if (!immediateFeedback.running && !immediateFeedback.ready) throw new Error(`PDF export feedback was not shown beside the action: ${JSON.stringify(immediateFeedback)}`);
  if (immediateFeedback.running && !immediateFeedback.buttonText.includes("만드는 중")) throw new Error(`PDF export button did not announce its running state: ${JSON.stringify(immediateFeedback)}`);
  await waitForResult(page);
  if (!await page.$eval(".pdf-download-compact .result-download", (link) => Boolean(link.closest(".pdf-output-action-zone")))) throw new Error("PDF download was not kept in the sticky output action zone.");
  await assertProgressLog(page, "PDF 페이지 편집");
  const rotatedPath = path.join(tempDir, "rotated.pdf");
  await saveBlobLink(page, ".result-download", rotatedPath);
  const rotated = await PDFDocument.load(await fs.readFile(rotatedPath));
  if (rotated.getPageCount() !== 2 || rotated.getPage(0).getRotation().angle !== 90) {
    throw new Error(`PDF output rotation was not persisted: pages=${rotated.getPageCount()}, rotation=${rotated.getPage(0).getRotation().angle}`);
  }

  await page.$eval('.pdf-page-card:first-child input[aria-label="1번 페이지 선택 해제"]', (checkbox) => checkbox.click());
  try {
    await page.waitForFunction(() => document.querySelector('.pdf-page-card:first-child .pdf-page-select input')?.checked === false && document.querySelector("#pdf-selection-range")?.value === "2", { timeout: 5_000 });
  } catch (reason) {
    const state = await page.evaluate(() => ({
      checked: document.querySelector('.pdf-page-card:first-child .pdf-page-select input')?.checked,
      range: document.querySelector("#pdf-selection-range")?.value,
      selected: Array.from(document.querySelectorAll(".pdf-page-card"), (card) => card.classList.contains("selected")),
    }));
    throw new Error(`PDF card selection did not synchronize with the range field: ${JSON.stringify(state)}\n${reason.message || reason}`);
  }
  const selectionRangeInput = await page.$("#pdf-selection-range");
  await replaceInputValue(page, selectionRangeInput, "1");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector('.pdf-page-card:first-child .pdf-page-select input')?.checked === true && document.querySelector('.pdf-page-card:nth-child(2) .pdf-page-select input')?.checked === false);
  await replaceInputValue(page, selectionRangeInput, "2");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector('.pdf-page-card:first-child .pdf-page-select input')?.checked === false && document.querySelector('.pdf-page-card:nth-child(2) .pdf-page-select input')?.checked === true);
  await clickPrimaryAction(page);
  await waitForResult(page);
  const extractedPath = path.join(tempDir, "extracted.pdf");
  await saveBlobLink(page, ".result-download", extractedPath);
  const extracted = await PDFDocument.load(await fs.readFile(extractedPath));
  if (extracted.getPageCount() !== 1 || Math.round(extracted.getPage(0).getWidth()) !== 600) throw new Error("PDF page-range extraction selected the wrong page.");

  await page.$eval('.pdf-output-mode-list button:nth-child(2)', (button) => button.click());
  await page.waitForFunction(() => document.querySelector('.pdf-output-mode-list button:nth-child(2)')?.getAttribute("aria-checked") === "true");
  await page.waitForSelector(".pdf-multi-range-panel");
  const rangeWorkspaceLayout = await page.$eval(".pdf-range-selection-toolbar", (toolbar) => ({
    toolbarPosition: getComputedStyle(toolbar).position,
    insideWorkspace: Boolean(toolbar.closest(".pdf-output-workspace")),
    workspacePosition: getComputedStyle(toolbar.closest(".pdf-output-workspace")).position,
  }));
  if (!rangeWorkspaceLayout.insideWorkspace || rangeWorkspaceLayout.toolbarPosition !== "static" || rangeWorkspaceLayout.workspacePosition !== "sticky") {
    throw new Error(`PDF range controls are not using the sticky sidebar layout: ${JSON.stringify(rangeWorkspaceLayout)}`);
  }
  if (await page.$(".pdf-selection-range-form") || !(await page.$(".pdf-page-select input[type=checkbox]"))) throw new Error("Visual range checkboxes were not shown in multi-range mode.");
  let groupRows = await page.$$(".pdf-range-group");
  if (groupRows.length !== 1) throw new Error(`Expected one seeded PDF range row, got ${groupRows.length}.`);
  let groupInputs = await page.$$(".pdf-range-group input");
  await replaceInputValue(page, groupInputs[1], "1");
  await page.$eval(".pdf-multi-range-actions .secondary-button:last-child", (button) => button.click());
  groupRows = await page.$$(".pdf-range-group");
  if (groupRows.length !== 2) throw new Error(`Expected a second PDF range row after adding one, got ${groupRows.length}.`);
  await page.$eval(".pdf-page-card:first-child .pdf-page-select input", (checkbox) => checkbox.click());
  await page.$eval(".pdf-page-card:nth-child(2) .pdf-page-select input", (checkbox) => checkbox.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, shiftKey: true })));
  groupInputs = await page.$$(".pdf-range-group input");
  try {
    await page.waitForFunction(() => document.querySelectorAll(".pdf-range-group")[1]?.querySelectorAll("input")[1]?.value === "1-2", { timeout: 5_000 });
  } catch (reason) {
    const rangeState = await page.evaluate(() => ({
      ranges: Array.from(document.querySelectorAll(".pdf-range-group"), (row) => Array.from(row.querySelectorAll("input"), (input) => ({ value: input.value, checked: input.checked }))),
      cards: Array.from(document.querySelectorAll(".pdf-page-card"), (card) => ({ selected: card.classList.contains("selected"), checked: card.querySelector(".pdf-page-select input")?.checked })),
    }));
    throw new Error(`Visual PDF range selection did not update the active range: ${JSON.stringify(rangeState)}\n${reason.message || reason}`);
  }
  const firstGroups = await page.$$eval(".pdf-page-card:first-child .pdf-group-badges b", (badges) => badges.map((badge) => badge.textContent));
  const secondGroups = await page.$$eval(".pdf-page-card:nth-child(2) .pdf-group-badges b", (badges) => badges.map((badge) => badge.textContent));
  if (firstGroups.join(",") !== "1,2" || secondGroups.join(",") !== "2") throw new Error(`PDF range badges are incorrect: first=${firstGroups}, second=${secondGroups}`);
  await replaceInputValue(page, groupInputs[3], "2, 1");
  await clickPrimaryAction(page);
  await waitForResult(page);
  const rangeZipPath = path.join(tempDir, "range-pdfs.zip");
  await saveBlobLink(page, ".result-download", rangeZipPath);
  const rangeZip = await JSZip.loadAsync(await fs.readFile(rangeZipPath));
  const rangePdfNames = Object.keys(rangeZip.files).filter((name) => name.endsWith(".pdf"));
  if (rangePdfNames.length !== 2) throw new Error(`Expected two range PDFs in ZIP, got ${rangePdfNames.length}.`);
  const secondRangePdf = await PDFDocument.load(await rangeZip.file(rangePdfNames[1]).async("uint8array"));
  if (secondRangePdf.getPageCount() !== 2 || Math.round(secondRangePdf.getPage(0).getWidth()) !== 600 || secondRangePdf.getPage(1).getRotation().angle !== 90) {
    throw new Error("Range PDF did not preserve the entered page order and rotations.");
  }
  await page.$eval(".pdf-multi-range-actions .secondary-button:first-child", (button) => button.click());
  await page.waitForSelector(".pdf-range-selection-toolbar.quick-split");
  await page.$eval(".pdf-page-card:first-child .pdf-split-after", (button) => button.click());
  await page.waitForFunction(() => document.querySelector(".pdf-range-selection-toolbar.quick-split > b")?.textContent?.includes("2"));
  await page.$eval(".pdf-range-selection-toolbar.quick-split .pdf-range-toolbar-actions .primary", (button) => button.click());
  await page.waitForFunction(() => document.querySelectorAll(".pdf-range-group").length === 2 && Array.from(document.querySelectorAll(".pdf-range-group"), (row) => row.querySelectorAll("input")[1]?.value).join(",") === "1,2");
  groupInputs = await page.$$(".pdf-range-group input");
  await replaceInputValue(page, groupInputs[2], "분할-01");
  await page.waitForFunction(() => document.querySelectorAll(".pdf-range-group.invalid").length === 2);
  if (!await page.$eval(".summary-card .primary-button", (button) => button.disabled)) throw new Error("Duplicate range PDF names did not block export.");

  await page.$eval('.pdf-output-mode-list button:nth-child(3)', (button) => button.click());
  await page.waitForFunction(() => document.querySelector('.pdf-output-mode-list button:nth-child(3)')?.getAttribute("aria-checked") === "true");
  await clickPrimaryAction(page);
  await waitForResult(page);
  const separateZipPath = path.join(tempDir, "separate-pages.zip");
  await saveBlobLink(page, ".result-download", separateZipPath);
  const separateZip = await JSZip.loadAsync(await fs.readFile(separateZipPath));
  const separatePdfNames = Object.keys(separateZip.files).filter((name) => name.endsWith(".pdf"));
  if (separatePdfNames.length !== 1) throw new Error(`Expected one selected page PDF, got ${separatePdfNames.length}.`);

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.waitForSelector(".pdf-mobile-output-dock", { visible: true });
  const mobileDockLayout = await page.evaluate(() => {
    const dock = document.querySelector(".pdf-mobile-output-dock");
    const tabs = document.querySelector(".bottom-tabs");
    const dockRect = dock?.getBoundingClientRect();
    const tabsRect = tabs?.getBoundingClientRect();
    return {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      dockBottom: dockRect?.bottom,
      tabsTop: tabsRect?.top,
      downloadVisible: Boolean(document.querySelector(".pdf-mobile-download")),
    };
  });
  if (mobileDockLayout.scrollWidth !== mobileDockLayout.clientWidth || !mobileDockLayout.downloadVisible
    || mobileDockLayout.dockBottom > mobileDockLayout.tabsTop) {
    throw new Error(`PDF mobile output dock overlaps or overflows: ${JSON.stringify(mobileDockLayout)}`);
  }
  await page.click(".pdf-mobile-output-summary");
  await page.waitForSelector(".pdf-output-sidebar-shell.mobile-open .pdf-output-workspace", { visible: true, timeout: 5_000 });
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".pdf-output-sidebar-shell")?.classList.contains("mobile-open")
    && document.activeElement?.classList.contains("pdf-mobile-output-summary"));
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });

  await navigatePdfTab(page, 2, "/tools/pdf-editor/image-to-pdf", "image-to-pdf", "image/jpeg");
  await (await page.$('input[type="file"][accept*="image/jpeg"]')).uploadFile(fixtures.tinyPng);
  await page.waitForSelector(".pdf-image-card");
  await clickPrimaryAction(page);
  await waitForResult(page);
  const imagePdfPath = path.join(tempDir, "image.pdf");
  await saveBlobLink(page, ".result-download", imagePdfPath);
  const imagePdf = await PDFDocument.load(await fs.readFile(imagePdfPath));
  if (imagePdf.getPageCount() !== 1) throw new Error("Image-to-PDF did not create one page.");

  await navigatePdfTab(page, 3, "/tools/pdf-editor/pdf-to-image", "pdf-to-image", "application/pdf");
  await (await page.$('input[type="file"]')).uploadFile(fixtures.textPdf);
  await page.waitForFunction(() => document.querySelectorAll(".pdf-page-card").length === 2);
  await clickPrimaryAction(page);
  await waitForResult(page);
  const imageZipPath = path.join(tempDir, "pdf-images.zip");
  await saveBlobLink(page, ".result-download", imageZipPath);
  const imageZip = await JSZip.loadAsync(await fs.readFile(imageZipPath));
  const pngNames = Object.keys(imageZip.files).filter((name) => name.endsWith(".png"));
  if (pngNames.length !== 2) throw new Error(`PDF-to-image ZIP has ${pngNames.length} PNG files instead of 2.`);

  await navigatePdfTab(page, 4, "/tools/pdf-editor/convert", "convert", "application/pdf");
  const convertInput = await page.$('input[type="file"]');
  await convertInput.uploadFile(fixtures.textPdf);
  await page.waitForFunction(() => document.querySelectorAll(".pdf-page-card").length === 2);
  const noOcrButton = await findButtonByText(page, ".pdf-summary-control .segmented-control button", "사용 안 함");
  await noOcrButton.click();
  await clickPrimaryAction(page);
  await waitForResult(page);
  const docxPath = path.join(tempDir, "pdf-converted.docx");
  await saveBlobLink(page, ".result-download", docxPath);
  const convertedDocx = await JSZip.loadAsync(await fs.readFile(docxPath));
  const documentXml = await convertedDocx.file("word/document.xml").async("string");
  if (!documentXml.includes("First PDF page") || !documentXml.includes("Second PDF page")) {
    throw new Error("PDF-to-DOCX output did not contain text from both pages.");
  }

  const xlsxButton = await page.$('.pdf-format-grid button:nth-child(2)');
  if (!xlsxButton) throw new Error("PDF XLSX format button was not found.");
  await xlsxButton.click();
  await clickPrimaryAction(page);
  await waitForResult(page);
  const xlsxPath = path.join(tempDir, "pdf-converted.xlsx");
  await saveBlobLink(page, ".result-download", xlsxPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await fs.readFile(xlsxPath));
  if (workbook.worksheets.length !== 2 || !workbook.worksheets[0].getCell("A1").text.includes("First PDF page")) {
    throw new Error("PDF-to-XLSX output did not preserve page worksheets and text.");
  }

  const txtButton = await page.$('.pdf-format-grid button:nth-child(3)');
  if (!txtButton) throw new Error("PDF TXT format button was not found.");
  await txtButton.click();
  await clickPrimaryAction(page);
  await waitForResult(page);
  const txtPath = path.join(tempDir, "pdf-converted.txt");
  await saveBlobLink(page, ".result-download", txtPath);
  const text = await fs.readFile(txtPath, "utf8");
  if (!text.includes("First PDF page") || !text.includes("[페이지 2]")) throw new Error("PDF-to-TXT output is incomplete.");
}

async function replaceInputValue(page, input, value) {
  await input.evaluate((element) => {
    element.focus();
    element.select();
  });
  await input.type(value);
}

async function navigateTo(page, url) {
  if (page.url() !== "about:blank") await page.goto("about:blank", { waitUntil: "domcontentloaded" });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.waitForFunction(() => Boolean(document.querySelector("#root .app-shell input[type='file']")), { timeout: 3_000 });
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.reload({ waitUntil: "domcontentloaded" });
    }
  }
}

async function navigatePdfTab(page, index, pathname, mode, acceptedType) {
  await page.$eval(`.pdf-tool-navigation a:nth-child(${index})`, (link) => link.click());
  await page.waitForFunction((expectedPath, expectedMode, expectedType) => {
    const panel = document.querySelector(`.pdf-tool-page[data-pdf-mode="${expectedMode}"]`);
    const input = document.querySelector(".pdf-tool-page input[type='file']");
    return location.pathname.endsWith(expectedPath)
      && panel instanceof HTMLElement
      && input instanceof HTMLInputElement
      && input.accept.includes(expectedType);
  }, {}, pathname, mode, acceptedType);
}

async function testEncryptedExcelMerge(page, fixtures, tempDir) {
  await navigateTo(page, `${koBaseUrl}/tools/excel-merger/`);
  const uiAdapterKeyboard = await assertUiAdapterKeyboardContracts(page, fixtures.xlsxOne);
  await navigateTo(page, `${koBaseUrl}/tools/excel-merger/`);
  const acceptedFormats = await page.$eval('input[type="file"]', (input) => input.accept);
  if (!acceptedFormats.includes(".xlsb") || !acceptedFormats.includes(".xlsm")) {
    throw new Error(`XLSB/XLSM were not exposed as accepted inputs: ${acceptedFormats}`);
  }
  await dropFiles(page, ".drop-zone", [fixtures.xlsxOne, fixtures.csv, fixtures.xls]);
  await page.waitForFunction(() => document.querySelectorAll(".excel-file-item").length === 3);
  await dropFiles(page, ".drop-zone", [fixtures.xlsb, fixtures.xlsm, fixtures.encryptedXlsx]);
  await page.waitForFunction(() => document.querySelectorAll(".excel-file-item").length === 6);
  const excelAddButton = await page.$eval(".drop-zone .secondary-button", (button) => button.textContent || "");
  if (!excelAddButton.includes("더 추가")) throw new Error(`Excel merger does not expose incremental file addition: ${excelAddButton}`);
  await page.waitForFunction(() => !document.querySelector(".file-security-status.checking"));
  console.log(`  shared UI adapter keyboard contracts: ${JSON.stringify(uiAdapterKeyboard)}`);

  const protectedInput = await page.$('.input-password-row input[type="password"]');
  if (!protectedInput) {
    const statuses = await page.$$eval(".excel-file-item", (items) => items.map((item) => item.textContent));
    const pageState = await page.evaluate(() => ({ path: location.pathname, root: document.querySelector("#root")?.textContent, body: document.body.innerText.slice(0, 2_000) }));
    throw new Error(`Encrypted input password field was not shown.\n${statuses.join("\n")}\n${JSON.stringify(pageState)}`);
  }
  await protectedInput.type("input-pass");
  await protectedInput.evaluate((input) => input.blur());
  await page.waitForFunction(() => !document.querySelector(".file-security-status.checking")
    && document.querySelectorAll(".sheet-file-group .sheet-name-list li").length >= 4);

  await clickSetting(page, "출력 파일에 암호 설정");
  const outputPasswords = await page.$$(".output-password-form input");
  await outputPasswords[0].type("output-pass");
  await outputPasswords[1].type("output-pass");
  await page.waitForFunction(() => {
    const button = document.querySelector(".summary-card .primary-button");
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  await page.$eval(".summary-card .primary-button", (button) => button.click());
  await waitForResult(page);
  await assertProgressLog(page, "Excel 병합");

  const resultPath = path.join(tempDir, "encrypted-result.xlsx");
  await saveBlobLink(page, ".result-download", resultPath);
  const encryptedResult = await fs.readFile(resultPath);
  if (!officeCrypto.isEncrypted(encryptedResult)) throw new Error("Output XLSX was not encrypted.");
  const decrypted = await officeCrypto.decrypt(encryptedResult, { password: "output-pass" });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(decrypted);
  if (workbook.worksheets.length < 6) throw new Error("Not all XLSX/CSV/XLS/XLSB/XLSM sheets were merged.");
  const formulaCells = workbook.worksheets.flatMap((sheet) => {
    const values = [];
    sheet.eachRow((row) => row.eachCell((cell) => {
      if (cell.formula) values.push(cell.formula);
    }));
    return values;
  });
  if (!formulaCells.some((formula) => formula.includes("SUM(A1:A2)"))) throw new Error("Formula was not preserved.");
  const warningText = await page.$eval(".result-card", (element) => element.textContent || "");
  if (!warningText.includes("XLSM의 매크로") || !warningText.includes("XLS 수식 또는 서식을 정밀하게 유지")) {
    throw new Error(`Converted format limitations were not shown after merge: ${warningText}`);
  }
}

async function assertUiAdapterKeyboardContracts(page, filePath) {
  const initial = await page.evaluate(() => {
    const group = document.querySelector(".segmented-control");
    const options = Array.from(group?.querySelectorAll("button") || []);
    return {
      pageHeader: document.querySelector(".page-header")?.tagName,
      sectionCard: document.querySelector(".section-card")?.tagName,
      dropRole: document.querySelector(".drop-zone")?.getAttribute("role"),
      dropTabIndex: document.querySelector(".drop-zone")?.getAttribute("tabindex"),
      groupRole: group?.getAttribute("role"),
      groupLabel: group?.getAttribute("aria-label") || "",
      pressedStates: options.map((option) => option.getAttribute("aria-pressed")),
    };
  });
  if (initial.pageHeader !== "HEADER" || initial.sectionCard !== "SECTION" || initial.dropRole !== "button" || initial.dropTabIndex !== "0"
    || initial.groupRole !== "group" || !initial.groupLabel || !initial.pressedStates.includes("true") || !initial.pressedStates.includes("false")) {
    throw new Error(`Shared UI semantic contract failed: ${JSON.stringify(initial)}`);
  }

  const chooserPromise = page.waitForFileChooser();
  await page.focus(".drop-zone");
  await page.keyboard.press("Enter");
  const chooser = await chooserPromise;
  await chooser.accept([filePath]);
  await page.waitForFunction(() => document.querySelectorAll(".excel-file-item").length === 1);
  await page.waitForFunction(() => document.querySelector('.drop-zone-wrap input[type="file"]')?.value === "");
  const drop = await page.evaluate(() => ({
    activeRole: document.activeElement?.getAttribute("role"),
    files: document.querySelectorAll(".excel-file-item").length,
    inputReset: document.querySelector('.drop-zone-wrap input[type="file"]')?.value === "",
  }));

  const groupButtons = await page.$$(".segmented-control button");
  if (groupButtons.length < 2) throw new Error("SegmentedControl keyboard fixture has fewer than two options.");
  await groupButtons[0].focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.activeElement === document.querySelector(".segmented-control button:nth-child(2)"));
  await page.keyboard.press("Space");
  await page.waitForFunction(() => document.querySelector(".segmented-control button:nth-child(2)")?.getAttribute("aria-pressed") === "true");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Space");
  await page.waitForFunction(() => document.querySelector(".segmented-control button:first-child")?.getAttribute("aria-pressed") === "true");

  const switchSelector = '.settings-row button[role="switch"]:not([disabled])';
  await page.waitForSelector(switchSelector);
  const originalSwitchState = await page.$eval(switchSelector, (element) => element.getAttribute("aria-checked"));
  await page.focus(switchSelector);
  await page.keyboard.press("Space");
  await page.waitForFunction((previous) => document.querySelector('.settings-row button[role="switch"]:not([disabled])')?.getAttribute("aria-checked") !== previous, {}, originalSwitchState);
  await page.keyboard.press("Enter");
  await page.waitForFunction((expected) => document.querySelector('.settings-row button[role="switch"]:not([disabled])')?.getAttribute("aria-checked") === expected, {}, originalSwitchState);

  return {
    semanticRoles: "passed",
    fileDropEnter: drop,
    segmentedArrowAndSpace: "passed",
    switchSpaceAndEnter: "passed",
  };
}

async function testExcelThemeColors(page, fixtures, tempDir) {
  await navigateTo(page, `${koBaseUrl}/tools/excel-merger/?run=theme-colors`);
  const input = await page.$('input[type="file"]');
  await input.uploadFile(fixtures.themeXlsxOne, fixtures.themeXlsxTwo);
  await page.waitForFunction(() => document.querySelectorAll(".file-security-status.ready").length === 2);
  await clickPrimaryAction(page);
  await waitForResult(page);

  const resultPath = path.join(tempDir, "theme-colors-result.xlsx");
  await saveBlobLink(page, ".result-download", resultPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await fs.readFile(resultPath));
  const [first, second] = workbook.worksheets;
  const actual = {
    firstFill: first.getCell("A1").fill?.fgColor,
    firstFont: first.getCell("A1").font?.color,
    firstBorder: first.getCell("A1").border?.top?.color,
    secondFill: second.getCell("A1").fill?.fgColor,
    rgb: first.getCell("B1").fill?.fgColor,
    indexed: first.getCell("B2").fill?.fgColor,
    gradient: first.getCell("C1").fill,
    richText: first.getCell("D1").value,
  };
  if (actual.firstFill?.argb !== "FFFFF2CC" || actual.firstFill?.theme !== undefined
    || actual.firstFont?.argb !== "FFED7D31" || actual.firstBorder?.argb !== "FF2F5597"
    || actual.secondFill?.argb !== "FF112233" || actual.secondFill?.theme !== undefined
    || actual.rgb?.argb !== "FF123456" || actual.indexed?.indexed !== 64
    || actual.gradient?.type !== "gradient" || actual.gradient.stops?.[0]?.color?.theme !== 4
    || actual.richText?.richText?.[0]?.font?.color?.theme !== 4) {
    throw new Error(`Theme color baking did not preserve the input-specific appearance boundary: ${JSON.stringify(actual)}`);
  }

  const archive = await JSZip.loadAsync(await fs.readFile(resultPath));
  const stylesXml = await archive.file("xl/styles.xml").async("string");
  if (!stylesXml.includes('rgb="FFFFF2CC"') || !stylesXml.includes('rgb="FF112233"')) {
    throw new Error("Baked theme colors were not serialized as RGB values in styles.xml.");
  }
}

async function testFormulaTranslation(page, fixtures, tempDir) {
  await navigateTo(page, `${koBaseUrl}/tools/excel-merger/?run=formula`);
  const input = await page.$('input[type="file"]');
  await input.uploadFile(fixtures.xlsxOne, fixtures.xlsxTwo);
  await page.waitForFunction(() => document.querySelectorAll(".excel-file-item").length === 2);
  await page.waitForFunction(() => !document.querySelector(".file-security-status.checking"));
  const verticalButton = await findButtonByText(page, ".segmented-control button", "세로");
  await verticalButton.click();
  await clickPrimaryAction(page);
  await waitForResult(page);
  await assertProgressLog(page, "Excel 세로 병합");

  const resultPath = path.join(tempDir, "vertical-result.xlsx");
  await saveBlobLink(page, ".result-download", resultPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await fs.readFile(resultPath));
  const resultSheet = workbook.worksheets[0];
  if (resultSheet.getCell("A6").formula !== "SUM(A4:A5)") {
    throw new Error(`Formula reference was not translated: ${resultSheet.getCell("A6").formula}`);
  }
}

async function testExcelSheetSelection(page, fixtures, tempDir) {
  await navigateTo(page, `${koBaseUrl}/tools/excel-merger/?run=sheets`);
  const input = await page.$('input[type="file"]');
  await input.uploadFile(fixtures.sheetSelectionXlsx);
  await page.waitForFunction(() => document.querySelectorAll(".sheet-file-group .sheet-name-list li").length === 4);
  const sheetNames = await page.$$eval(".sheet-file-group .sheet-name-chip > span", (items) => items.map((item) => item.textContent));
  if (sheetNames.join(",") !== "첫째,둘째,셋째,넷째") throw new Error(`Sheet names were not inspected in order: ${sheetNames.join(",")}`);

  const customButton = await findButtonByText(page, ".section-card .segmented-control button", "직접 선택");
  await customButton.click();
  const sheetButtons = await page.$$(".sheet-name-list button[aria-pressed]");
  await sheetButtons[0].click();
  await sheetButtons[2].click();
  const customSelected = await page.$$(".sheet-name-list li.selected").then((items) => items.length);
  if (customSelected !== 2) throw new Error(`Direct sheet selection did not update: ${customSelected}`);

  const positionsButton = await findButtonByText(page, ".section-card .segmented-control button", "순번 선택");
  await positionsButton.click();
  const patternInput = await page.$("#sheet-position-pattern");
  await patternInput.click();
  await page.keyboard.down("Control");
  await page.keyboard.press("A");
  await page.keyboard.up("Control");
  await patternInput.type("2");
  if (await page.$$(".sheet-name-list li.selected").then((items) => items.length) !== 1) throw new Error("N-th sheet selection failed.");
  await patternInput.click();
  await page.keyboard.down("Control");
  await page.keyboard.press("A");
  await page.keyboard.up("Control");
  await patternInput.type("-2");
  if (await page.$$(".sheet-name-list li.selected").then((items) => items.length) !== 2) throw new Error("Up-to-N sheet selection failed.");

  await clickPrimaryAction(page);
  await waitForResult(page);
  const resultPath = path.join(tempDir, "selected-sheets-result.xlsx");
  await saveBlobLink(page, ".result-download", resultPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await fs.readFile(resultPath));
  if (workbook.worksheets.length !== 2 || !workbook.worksheets.every((sheet) => /첫째|둘째/.test(sheet.name))) {
    throw new Error(`Selected sheet merge output is incorrect: ${workbook.worksheets.map((sheet) => sheet.name).join(",")}`);
  }
}

async function testExcelSheetGridLayout(page, fixtures) {
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await navigateTo(page, `${koBaseUrl}/tools/excel-merger/?run=sheet-grid`);
  const input = await page.$('input[type="file"]');
  await input.uploadFile(...fixtures.sheetGridXlsx);
  await page.waitForFunction(() => document.querySelectorAll(".sheet-file-group").length === 6
    && document.querySelectorAll(".sheet-name-list li").length === 39
    && !document.querySelector(".file-security-status.checking"));

  const desktopLayout = await page.evaluate(() => {
    const selector = document.querySelector(".excel-sheet-selector");
    const cards = Array.from(document.querySelectorAll(".sheet-file-group"));
    const selectorRect = selector?.getBoundingClientRect();
    const cardRects = cards.map((card) => card.getBoundingClientRect());
    const columnLefts = [...new Set(cardRects.map((rect) => Math.round(rect.left)))];
    const rowTops = [...new Set(cardRects.map((rect) => Math.round(rect.top)))];
    const rowGap = Number.parseFloat(selector ? getComputedStyle(selector).rowGap : "0") || 0;
    const stackedHeight = cardRects.reduce((sum, rect) => sum + rect.height, 0) + rowGap * Math.max(0, cardRects.length - 1);
    const firstList = cards[0]?.querySelector(".sheet-name-list");
    const firstHeading = cards[0]?.querySelector(".sheet-file-heading");
    const headingId = cards[0]?.getAttribute("aria-labelledby") || "";
    const labelledHeading = headingId ? document.getElementById(headingId) : null;
    const chip = firstList?.querySelector(".sheet-name-chip");
    const chipStyle = chip ? getComputedStyle(chip) : null;
    const listStyle = firstList ? getComputedStyle(firstList) : null;
    return {
      columns: columnLefts.length,
      rows: rowTops.length,
      selectorHeight: selectorRect?.height ?? 0,
      stackedHeight,
      selectorOverflow: selector ? selector.scrollWidth - selector.clientWidth : 1,
      cardsInside: Boolean(selectorRect) && cardRects.every((rect) => rect.left >= selectorRect.left - 1 && rect.right <= selectorRect.right + 1),
      listClientHeight: firstList?.clientHeight ?? 0,
      listScrollHeight: firstList?.scrollHeight ?? 0,
      listOverflowY: listStyle?.overflowY,
      listFlexWrap: listStyle?.flexWrap,
      headingTag: labelledHeading?.tagName,
      headingMatches: labelledHeading === firstHeading?.querySelector("h3"),
      headingTitle: labelledHeading?.getAttribute("title"),
      headingLabel: labelledHeading?.getAttribute("aria-label"),
      allModeButtons: document.querySelectorAll(".sheet-name-list button").length,
      allModeActions: document.querySelectorAll(".sheet-select-actions").length,
      allModeSelected: document.querySelectorAll(".sheet-name-list li.selected").length,
      allChipStyle: chipStyle ? { display: chipStyle.display, minHeight: chipStyle.minHeight, borderRadius: chipStyle.borderRadius } : null,
      mobileSummaryDisplay: getComputedStyle(document.querySelector(".excel-mobile-sheet-summary")).display,
    };
  });
  if (desktopLayout.columns !== 2 || desktopLayout.rows !== 3
    || desktopLayout.selectorHeight >= desktopLayout.stackedHeight * 0.8) {
    throw new Error(`Excel sheet cards did not form the measured two-column desktop grid: ${JSON.stringify(desktopLayout)}`);
  }
  if (desktopLayout.selectorOverflow > 0 || !desktopLayout.cardsInside) {
    throw new Error(`Excel sheet grid overflowed its desktop selector: ${JSON.stringify(desktopLayout)}`);
  }
  if (desktopLayout.listClientHeight >= desktopLayout.listScrollHeight || desktopLayout.listOverflowY !== "auto"
    || desktopLayout.listFlexWrap !== "wrap") {
    throw new Error(`The 20+ sheet viewport did not wrap and scroll internally: ${JSON.stringify(desktopLayout)}`);
  }
  if (desktopLayout.headingTag !== "H3" || !desktopLayout.headingMatches
    || desktopLayout.headingTitle !== fixtures.sheetGridLongFileName
    || desktopLayout.headingLabel !== fixtures.sheetGridLongFileName) {
    throw new Error(`Excel file cards are missing their labelled full-name heading: ${JSON.stringify(desktopLayout)}`);
  }
  if (desktopLayout.allModeButtons !== 0 || desktopLayout.allModeActions !== 0 || desktopLayout.allModeSelected !== 39
    || desktopLayout.mobileSummaryDisplay !== "none") {
    throw new Error(`All-sheets mode exposed controls or a desktop duplicate summary: ${JSON.stringify(desktopLayout)}`);
  }

  const customModeButton = await findButtonByText(page, ".section-card .segmented-control button", "직접 선택");
  await customModeButton.click();
  await page.waitForFunction(() => document.querySelectorAll(".sheet-name-list button[aria-pressed]").length === 39);
  const customContract = await page.evaluate((expectedStyle) => {
    const buttons = Array.from(document.querySelectorAll(".sheet-name-list button[aria-pressed]"));
    const chipStyle = buttons[0] ? getComputedStyle(buttons[0]) : null;
    return {
      count: buttons.length,
      types: [...new Set(buttons.map((button) => button.getAttribute("type")))],
      states: [...new Set(buttons.map((button) => button.getAttribute("aria-pressed")))],
      actions: document.querySelectorAll(".sheet-select-actions").length,
      checkboxes: document.querySelectorAll('.sheet-name-list input[type="checkbox"]').length,
      sameAppearance: Boolean(chipStyle && expectedStyle
        && chipStyle.display === expectedStyle.display
        && chipStyle.minHeight === expectedStyle.minHeight
        && chipStyle.borderRadius === expectedStyle.borderRadius),
    };
  }, desktopLayout.allChipStyle);
  if (customContract.count !== 39 || customContract.types.join() !== "button" || customContract.states.join() !== "true"
    || customContract.actions !== 6 || customContract.checkboxes !== 0 || !customContract.sameAppearance) {
    throw new Error(`Custom sheet chips do not match the aria-pressed button contract: ${JSON.stringify(customContract)}`);
  }

  await page.click(".sheet-file-group:first-child .sheet-select-actions button:last-child");
  await page.waitForFunction(() => document.querySelectorAll(".sheet-file-group:first-child .sheet-name-list li.selected").length === 0);
  await page.click(".sheet-file-group:first-child .sheet-select-actions button:first-child");
  await page.waitForFunction(() => document.querySelectorAll(".sheet-file-group:first-child .sheet-name-list li.selected").length === 24);
  await page.click(".sheet-file-group:first-child .sheet-name-list button");
  await page.waitForFunction(() => document.querySelector(".sheet-file-group:first-child .sheet-name-list button")?.getAttribute("aria-pressed") === "false");
  await page.click(".sheet-file-group:first-child .sheet-name-list button");

  const headerTopBeforeKeyboard = await page.$eval(".sheet-file-group:first-child .sheet-file-heading", (heading) => heading.getBoundingClientRect().top);
  await page.$eval(".sheet-file-group:first-child .sheet-name-list button", (button) => {
    button.closest(".sheet-name-list").scrollTop = 0;
    button.focus();
  });
  for (let index = 1; index < 24; index += 1) await page.keyboard.press("Tab");
  const keyboardScroll = await page.evaluate(() => {
    const card = document.querySelector(".sheet-file-group:first-child");
    const list = card?.querySelector(".sheet-name-list");
    const buttons = Array.from(card?.querySelectorAll(".sheet-name-list button") || []);
    const focusedStyle = document.activeElement instanceof HTMLElement ? getComputedStyle(document.activeElement) : null;
    return {
      focusedLast: document.activeElement === buttons.at(-1),
      scrollTop: list?.scrollTop ?? 0,
      headerTop: card?.querySelector(".sheet-file-heading")?.getBoundingClientRect().top ?? 0,
      outlineStyle: focusedStyle?.outlineStyle,
      outlineWidth: focusedStyle?.outlineWidth,
    };
  });
  if (!keyboardScroll.focusedLast || keyboardScroll.scrollTop <= 0
    || Math.abs(keyboardScroll.headerTop - headerTopBeforeKeyboard) > 1
    || keyboardScroll.outlineStyle === "none" || keyboardScroll.outlineWidth === "0px") {
    throw new Error(`Keyboard focus did not scroll only the chip viewport with a visible focus ring: ${JSON.stringify(keyboardScroll)}`);
  }

  const positionsButton = await findButtonByText(page, ".section-card .segmented-control button", "순번 선택");
  await positionsButton.click();
  await replaceInputValue(page, await page.$("#sheet-position-pattern"), "2");
  await page.waitForFunction(() => document.querySelectorAll(".sheet-name-list li.selected").length === 6);
  const positionsContract = await page.evaluate(() => ({
    buttons: document.querySelectorAll(".sheet-name-list button").length,
    actions: document.querySelectorAll(".sheet-select-actions").length,
    selected: document.querySelectorAll(".sheet-name-list li.selected").length,
    statusChips: document.querySelectorAll(".sheet-name-list li > span.sheet-name-chip").length,
  }));
  if (positionsContract.buttons !== 0 || positionsContract.actions !== 0
    || positionsContract.selected !== 6 || positionsContract.statusChips !== 39) {
    throw new Error(`Position mode did not preserve non-interactive status chips: ${JSON.stringify(positionsContract)}`);
  }

  const allButton = await findButtonByText(page, ".section-card .segmented-control button", "모든 시트");
  await allButton.click();
  await page.waitForFunction(() => document.querySelectorAll(".sheet-name-list li.selected").length === 39);

  await page.setViewport({ width: 821, height: 900, deviceScaleFactor: 1 });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const narrowDesktop = await page.evaluate(() => {
    const selector = document.querySelector(".excel-sheet-selector");
    const cards = Array.from(document.querySelectorAll(".sheet-file-group"));
    const selectorRect = selector?.getBoundingClientRect();
    return {
      columns: new Set(cards.map((card) => Math.round(card.getBoundingClientRect().left))).size,
      overflow: selector ? selector.scrollWidth - selector.clientWidth : 1,
      cardsInside: Boolean(selectorRect) && cards.every((card) => card.getBoundingClientRect().right <= selectorRect.right + 1),
      mobileSummaryDisplay: getComputedStyle(document.querySelector(".excel-mobile-sheet-summary")).display,
    };
  });
  if (narrowDesktop.columns !== 1 || narrowDesktop.overflow > 0 || !narrowDesktop.cardsInside
    || narrowDesktop.mobileSummaryDisplay !== "none") {
    throw new Error(`The 821px Excel grid overflow-prevention contract failed: ${JSON.stringify(narrowDesktop)}`);
  }

  await customModeButton.click();
  await page.waitForFunction(() => document.querySelectorAll(".sheet-name-list button[aria-pressed]").length === 39);
  const longNames = await page.evaluate((longFileName, longSheetName) => {
    const card = document.querySelector(".sheet-file-group:first-child");
    const heading = card?.querySelector(".sheet-file-heading h3");
    const chip = card?.querySelector(".sheet-name-list button.sheet-name-chip");
    const chipText = chip?.querySelector("span");
    return {
      sectionLabelledBy: card?.getAttribute("aria-labelledby"),
      headingId: heading?.id,
      headingTitle: heading?.getAttribute("title"),
      headingLabel: heading?.getAttribute("aria-label"),
      headingEllipsis: heading ? getComputedStyle(heading).textOverflow : "",
      headingClipped: heading ? heading.scrollWidth > heading.clientWidth : false,
      chipTitle: chip?.getAttribute("title"),
      chipLabel: chip?.getAttribute("aria-label"),
      chipPressed: chip?.getAttribute("aria-pressed"),
      chipEllipsis: chipText ? getComputedStyle(chipText).textOverflow : "",
      chipClipped: chipText ? chipText.scrollWidth > chipText.clientWidth : false,
      expected: { longFileName, longSheetName },
    };
  }, fixtures.sheetGridLongFileName, fixtures.sheetGridLongSheetName);
  if (longNames.sectionLabelledBy !== longNames.headingId
    || longNames.headingTitle !== fixtures.sheetGridLongFileName || longNames.headingLabel !== fixtures.sheetGridLongFileName
    || longNames.headingEllipsis !== "ellipsis" || !longNames.headingClipped
    || longNames.chipTitle !== fixtures.sheetGridLongSheetName || longNames.chipLabel !== fixtures.sheetGridLongSheetName
    || longNames.chipPressed !== "true" || longNames.chipEllipsis !== "ellipsis" || !longNames.chipClipped) {
    throw new Error(`Long Excel names lost ellipsis or their full accessible names: ${JSON.stringify(longNames)}`);
  }

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await new Promise((resolve) => setTimeout(resolve, 100));
  await page.evaluate(() => {
    const summary = document.querySelector(".excel-mobile-sheet-summary");
    if (summary) window.scrollTo(0, window.scrollY + summary.getBoundingClientRect().top + 120);
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const mobileLayout = await page.evaluate(() => {
    const selector = document.querySelector(".excel-sheet-selector");
    const cards = Array.from(document.querySelectorAll(".sheet-file-group"));
    const summary = document.querySelector(".excel-mobile-sheet-summary");
    const list = document.querySelector(".sheet-file-group:first-child .sheet-name-list");
    const chip = document.querySelector(".sheet-file-group:first-child .sheet-name-chip");
    if (list) list.scrollTop = Math.min(80, list.scrollHeight - list.clientHeight);
    const summaryStyle = summary ? getComputedStyle(summary) : null;
    const selectorRect = selector?.getBoundingClientRect();
    return {
      columns: new Set(cards.map((card) => Math.round(card.getBoundingClientRect().left))).size,
      selectorOverflow: selector ? selector.scrollWidth - selector.clientWidth : 1,
      cardsInside: Boolean(selectorRect) && cards.every((card) => card.getBoundingClientRect().right <= selectorRect.right + 1),
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      summaryDisplay: summaryStyle?.display,
      summaryPosition: summaryStyle?.position,
      summaryTop: Number.parseFloat(summaryStyle?.top || "0"),
      summaryRectTop: summary?.getBoundingClientRect().top ?? 0,
      summaryText: summary?.textContent,
      chipHeight: chip?.getBoundingClientRect().height ?? 0,
      listScrollTop: list?.scrollTop ?? 0,
      listOverscroll: list ? getComputedStyle(list).overscrollBehaviorY : "",
      pageScrollTop: window.scrollY,
    };
  });
  if (mobileLayout.columns !== 1 || mobileLayout.selectorOverflow > 0 || !mobileLayout.cardsInside || mobileLayout.pageOverflow > 0
    || mobileLayout.summaryDisplay !== "flex" || mobileLayout.summaryPosition !== "sticky" || mobileLayout.summaryTop < 70
    || Math.abs(mobileLayout.summaryRectTop - mobileLayout.summaryTop) > 2
    || !mobileLayout.summaryText?.includes("6개 파일 · 39개 시트 포함") || mobileLayout.chipHeight < 44
    || mobileLayout.listScrollTop <= 0 || mobileLayout.listOverscroll !== "contain" || mobileLayout.pageScrollTop <= 0) {
    throw new Error(`The mobile one-column, sticky summary or nested scrolling contract failed: ${JSON.stringify(mobileLayout)}`);
  }

  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
}

async function testExcelSheetTrim(page, fixtures, tempDir) {
  await navigateTo(page, `${koBaseUrl}/tools/excel-merger/?run=sheet-trim`);
  await (await page.$('input[type="file"]')).uploadFile(fixtures.sheetTrimXlsx);
  await page.waitForFunction(() => document.querySelectorAll(".sheet-file-group .sheet-name-list li").length === 3);

  const edgeTrimState = await page.$eval('button[aria-label="끝의 빈 행·열 정리"]', (button) => button.getAttribute("aria-checked"));
  if (edgeTrimState !== "true") throw new Error("The existing trailing-edge trim setting was not preserved.");

  await clickSetting(page, "중간의 연속 빈 행 삭제");
  await clickSetting(page, "중간의 연속 빈 열 삭제");
  const thresholdInput = await page.$('.sheet-trim-threshold input[type="number"]');
  await replaceInputValue(page, thresholdInput, "3");
  await clickPrimaryAction(page);
  await waitForResult(page);
  await assertProgressLog(page, "연속 빈 행·열 정리");

  const resultPath = path.join(tempDir, "sheet-trim-result.xlsx");
  await saveBlobLink(page, ".result-download", resultPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await fs.readFile(resultPath));
  const sheet = workbook.worksheets[0];
  const actual = {
    a1: sheet.getCell("A1").text,
    a4: sheet.getCell("A4").text,
    a5: sheet.getCell("A5").text,
    d5: sheet.getCell("D5").text,
    e5: sheet.getCell("E5").text,
    f5: sheet.getCell("F5").text,
  };
  if (actual.a1 !== "첫 행" || actual.a4 !== "중간 행" || actual.a5 !== "마지막 행"
    || actual.d5 !== "D 유지" || actual.e5 !== "H 이동" || actual.f5 !== "") {
    throw new Error(`SheetTrim did not preserve short gaps and delete long row/column blocks: ${JSON.stringify(actual)}`);
  }
  const logText = await page.$eval(".operation-log", (element) => element.textContent || "");
  if (!logText.includes("빈 행 3개, 빈 열 3개")) throw new Error(`SheetTrim counts were not logged: ${logText}`);
  const referencedSheet = workbook.worksheets.find((candidate) => candidate.name.includes("참조 대상"));
  const summarySheet = workbook.worksheets.find((candidate) => candidate.name.includes("참조 요약"));
  const summaryFormula = String(summarySheet?.getCell("A1").formula || "");
  if (referencedSheet?.getCell("A5").text !== "참조 유지" || !summaryFormula.replaceAll("'", "").includes(`${referencedSheet?.name}!A5`)) {
    throw new Error(`Middle-row trimming shifted a cell referenced by another worksheet: ${JSON.stringify({ sheets: workbook.worksheets.map((candidate) => candidate.name), referencedA5: referencedSheet?.getCell("A5").text, summaryFormula })}`);
  }
  const warningText = await page.$eval(".result-warnings", (element) => element.textContent || "");
  if (!warningText.includes("다른 시트 수식에서 참조")) throw new Error(`Incoming sheet-reference protection was not reported: ${warningText}`);
}

async function testWordCompare(page, fixtures, tempDir) {
  await navigateTo(page, `${koBaseUrl}/tools/document-compare/`);
  await dropFiles(page, ".drop-zone", [fixtures.beforeDocx, fixtures.beforeDocxTwo], 0);
  await dropFiles(page, ".drop-zone", [fixtures.afterDocx], 1);
  await page.waitForSelector(".pair-count-error");
  const disabledForMismatch = await page.$eval(".tool-action-bar .primary-button", (button) => button.disabled);
  if (!disabledForMismatch) throw new Error("Word comparison was not blocked for mismatched file counts.");

  await page.evaluate(() => {
    const button = document.querySelector('button[aria-label="before-two.docx 수정 후 목록으로 이동"]');
    if (!(button instanceof HTMLButtonElement)) throw new Error("Move-right button not found.");
    button.click();
  });
  await page.waitForFunction(() => document.querySelectorAll(".sortable-word-files")[0]?.children.length === 1
    && document.querySelectorAll(".sortable-word-files")[1]?.children.length === 2);
  await page.evaluate(() => {
    const button = document.querySelector('button[aria-label="before-two.docx 수정 전 목록으로 이동"]');
    if (!(button instanceof HTMLButtonElement)) throw new Error("Move-left button not found.");
    button.click();
  });
  await page.waitForFunction(() => document.querySelectorAll(".sortable-word-files")[0]?.children.length === 2
    && document.querySelectorAll(".sortable-word-files")[1]?.children.length === 1);

  await dropFiles(page, ".sortable-word-files", [fixtures.afterDocxTwo], 1);
  await page.waitForFunction(() => document.querySelectorAll(".sortable-word-files")[0]?.children.length === 2
    && document.querySelectorAll(".sortable-word-files")[1]?.children.length === 2
    && !document.querySelector(".pair-count-error"));
  const wordAddButtons = await page.$$eval(".word-file-column .drop-zone .secondary-button", (buttons) => buttons.map((button) => button.textContent || ""));
  if (wordAddButtons.length !== 2 || wordAddButtons.some((label) => !label.includes("더 추가"))) throw new Error(`Word comparison does not expose incremental file addition: ${wordAddButtons.join(", ")}`);
  const draggable = await page.$$eval(".sortable-word-files li", (items) => items.every((item) => item.draggable));
  if (!draggable) throw new Error("Word file order list is not draggable.");
  const crossColumnDrag = await page.evaluate(async () => {
    const source = document.querySelectorAll(".sortable-word-files")[0]?.querySelector("li");
    const target = document.querySelectorAll(".sortable-word-files")[1]?.querySelector("li");
    if (!(source instanceof HTMLElement) || !(target instanceof HTMLElement)) throw new Error("Word drag fixtures are unavailable");
    const transfer = new DataTransfer();
    source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    target.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const state = { dropEffect: transfer.dropEffect, highlighted: target.classList.contains("drag-over") };
    source.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    return state;
  });
  if (crossColumnDrag.dropEffect !== "none" || crossColumnDrag.highlighted) throw new Error(`Cross-column reorder still appears available: ${JSON.stringify(crossColumnDrag)}`);
  const moveTooltip = await page.$eval('.move-across-button', (button) => ({ label: button.getAttribute("aria-label"), title: button.getAttribute("title") }));
  if (!moveTooltip.title || moveTooltip.title !== moveTooltip.label) throw new Error(`Move-across tooltip is missing: ${JSON.stringify(moveTooltip)}`);
  if (await page.$eval(".pairing-preview ol", (list) => list.children.length) !== 2) throw new Error("Word pairing preview is incomplete.");
  const defaultAuthorOption = await page.evaluate(() => {
    const label = Array.from(document.querySelectorAll(".settings-row strong")).find((element) => element.textContent === "변경 내용 작성자 통일");
    const toggle = label?.closest(".settings-row")?.querySelector("button");
    const input = document.querySelector(".revision-author-field input");
    return { checked: toggle?.getAttribute("aria-checked"), inputDisabled: input instanceof HTMLInputElement && input.disabled };
  });
  if (defaultAuthorOption.checked !== "false" || !defaultAuthorOption.inputDisabled) {
    throw new Error(`Revision-author rewrite was not disabled by default: ${JSON.stringify(defaultAuthorOption)}`);
  }

  await page.click(".tool-action-bar .primary-button");
  await waitForResult(page, 240_000);
  await assertProgressLog(page, "문서 비교");
  const resultCards = await page.$$(".word-pair-result-card");
  if (resultCards.length !== 2) throw new Error(`Expected 2 Word pair results, got ${resultCards.length}.`);
  if (await page.$$(".word-pair-result-card .blue-download").then((items) => items.length) !== 2) {
    throw new Error("Each Word pair did not receive its own Excel report.");
  }
  if (await page.$$(".word-pair-result-card .tracked-download").then((items) => items.length) !== 2) {
    throw new Error("Each Word pair did not receive its own tracked-change DOCX.");
  }

  const resultPath = path.join(tempDir, "word-report.xlsx");
  await saveBlobLink(page, ".word-pair-result-card .blue-download", resultPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await fs.readFile(resultPath));
  const changesSheet = workbook.getWorksheet("변경 내용");
  if (!changesSheet || changesSheet.rowCount < 2) throw new Error("Word Excel report has no change rows.");
  const sectionValues = [];
  let hasBlueStrikethrough = false;
  let hasRedBold = false;
  changesSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    sectionValues.push(row.getCell(1).text);
    const beforeRichText = row.getCell(3).value?.richText || [];
    const afterRichText = row.getCell(4).value?.richText || [];
    hasBlueStrikethrough ||= beforeRichText.some((part) => part.font?.strike && part.font?.color?.argb === "FF0000FF");
    hasRedBold ||= afterRichText.some((part) => part.font?.bold && part.font?.color?.argb === "FFFF0000");
  });
  if (!sectionValues.includes("메모")) throw new Error("Word comments were not classified as 메모 in the Excel report.");
  if (sectionValues.includes("표")) throw new Error("Table changes should be written to dedicated table sheets.");
  if (!hasBlueStrikethrough || !hasRedBold) throw new Error("Word Excel report rich diff styles are missing.");
  if (!changesSheet.getCell("C2").text.startsWith("1. ") || !changesSheet.getCell("D2").text.startsWith("1. ")) {
    throw new Error(`Word list labels were not included in the Excel report: ${changesSheet.getCell("C2").text} / ${changesSheet.getCell("D2").text}`);
  }

  const tableSheet = workbook.getWorksheet("표 1");
  if (!tableSheet) throw new Error("Dedicated table comparison sheet was not created.");
  if (tableSheet.getCell("A3").text !== "항목" || tableSheet.getCell("E3").text !== "항목" || tableSheet.getCell("F3").text !== "신규열") {
    throw new Error("Before/after table grids were not laid out side by side.");
  }
  let redAddedCells = 0;
  let blueDeletedCells = 0;
  tableSheet.eachRow((row, rowNumber) => {
    if (rowNumber < 3) return;
    row.eachCell({ includeEmpty: false }, (cell) => {
      const richText = cell.value?.richText || [];
      const red = cell.font?.color?.argb === "FFFF0000" || richText.some((part) => part.font?.color?.argb === "FFFF0000");
      const blue = cell.font?.color?.argb === "FF0000FF" || richText.some((part) => part.font?.color?.argb === "FF0000FF");
      if (red) redAddedCells += 1;
      if (blue) blueDeletedCells += 1;
    });
  });
  if (redAddedCells !== 8 || blueDeletedCells !== 0) {
    throw new Error(`Smart table alignment produced false changes: red=${redAddedCells}, blue=${blueDeletedCells}`);
  }

  const trackedPath = path.join(tempDir, "word-tracked.docx");
  await saveBlobLink(page, ".word-pair-result-card .tracked-download", trackedPath);
  await assertTrackedDocument(trackedPath, fixtures.beforeDocx, fixtures.afterDocx);
  const secondTrackedPath = path.join(tempDir, "word-tracked-two.docx");
  await saveBlobLink(page, ".word-pair-result-card:nth-child(2) .tracked-download", secondTrackedPath);
  await assertTrackedDocument(secondTrackedPath, fixtures.beforeDocxTwo, fixtures.afterDocxTwo, false);

  await page.click(".word-pair-result-card .secondary-button");
  await page.waitForFunction(() => location.pathname.endsWith("/tools/document-compare/results/1")
    && document.querySelector("h1")?.textContent?.includes("1번 문서 비교"));
  const detailHeading = await page.$eval("h1", (element) => element.textContent || "");
  if (!detailHeading.includes("1번 문서 비교")) throw new Error(`Pair result view did not open: ${detailHeading}`);
  if (await page.$$(".document-page-column-heading").then((items) => items.length) !== 2) {
    throw new Error("Full before/after document page columns were not rendered.");
  }
  const documentFlow = await page.$$eval(".document-page-row", (items) => items.map((item) => ({
    table: item.classList.contains("table-block"),
    blockCount: item.querySelectorAll(".document-page-block").length,
    height: Math.round(item.getBoundingClientRect().height),
  })));
  if (documentFlow.length !== 4 || !documentFlow.at(-1)?.table || documentFlow.some((item) => item.blockCount !== 2)) {
    throw new Error(`Document flow was not preserved as three paragraphs and one table: ${JSON.stringify(documentFlow)}`);
  }
  if ((documentFlow[2]?.height ?? 100) > 32) {
    throw new Error(`Continuous document paragraphs still have card-like vertical spacing: ${JSON.stringify(documentFlow)}`);
  }
  const webTables = await page.$$(".word-document-table");
  if (webTables.length !== 2) throw new Error(`The document table was flattened instead of rendered on both pages: ${webTables.length}`);
  const alignedTableShape = await page.$$eval(".word-document-table", (tables) => tables.map((table) => ({
    rows: table.rows.length,
    cells: Array.from(table.rows).reduce((total, row) => total + row.cells.length, 0),
    gaps: table.querySelectorAll("td.structural-gap").length,
  })));
  if (alignedTableShape[0]?.rows !== 5 || alignedTableShape[0]?.cells !== 20 || alignedTableShape[0]?.gaps !== 8
    || alignedTableShape[1]?.rows !== 5 || alignedTableShape[1]?.cells !== 20 || alignedTableShape[1]?.gaps !== 0) {
    throw new Error(`Inserted table axes were not aligned in the web document view: ${JSON.stringify(alignedTableShape)}`);
  }
  if (!await page.$(".page-diff-delete") || !await page.$(".page-diff-add")) {
    throw new Error("Inline deleted/inserted highlights were not rendered in the web comparison.");
  }
  const firstComparedParagraph = await page.$eval(".document-page-row p", (element) => element.textContent || "");
  if (!firstComparedParagraph.startsWith("1. ")) throw new Error(`Word list label was not rendered in the web view: ${firstComparedParagraph}`);
  const hasCommentTab = await page.$$eval(".document-toolbar .segmented-control button", (buttons) => buttons.some((button) => button.textContent === "메모"));
  if (hasCommentTab) throw new Error("The standalone comment tab was not removed.");
  await page.waitForSelector(".document-page-row .inline-comment-card");
  const commentParagraphLocations = await page.$$eval(".document-page-row:has(.inline-comment-card) .document-block-meta small", (items) => items.map((item) => item.textContent || ""));
  if (!commentParagraphLocations.every((location) => location.startsWith("본문 2번째 문단"))) {
    throw new Error(`Comments were not shown at their anchored paragraph: ${commentParagraphLocations.join(", ")}`);
  }

  const allContentRowCount = await page.$$(".document-page-row").then((items) => items.length);
  const fullContentToggle = await page.$('.document-content-toggle button[aria-label="내용 전체"]');
  if (!fullContentToggle) throw new Error("Full-content toggle was not rendered on the document tab.");
  await fullContentToggle.evaluate((button) => button.click());
  await page.waitForFunction((previousCount) => document.querySelectorAll(".document-page-row").length < previousCount, {}, allContentRowCount);
  const filteredKinds = await page.$$eval(".document-page-row", (items) => items.map((item) => item.className));
  if (filteredKinds.some((className) => className.includes("unchanged"))) throw new Error("Unchanged paragraphs remained after disabling full content.");
  if (!await page.$(".document-page-row .inline-comment-card")) throw new Error("A changed paragraph's comment was hidden by the change filter.");
  if (!filteredKinds.some((className) => className.includes("table-block"))) throw new Error("The changed table was hidden by the change filter.");
  const backHref = await page.$eval(".result-view-back a", (link) => link.getAttribute("href"));
  await page.$eval(".result-view-back a", (link) => {
    if (!(link instanceof HTMLAnchorElement)) throw new Error("Word result back link was not found.");
    link.click();
  });
  try {
    await page.waitForFunction(() => location.pathname.replace(/\/$/, "").endsWith("/tools/document-compare")
      && document.querySelectorAll(".word-pair-result-card").length === 2, { timeout: 15_000 });
  } catch (error) {
    const state = await page.evaluate(() => ({
      href: location.href,
      pathname: location.pathname,
      cards: document.querySelectorAll(".word-pair-result-card").length,
      title: document.querySelector("h1")?.textContent || "",
      body: document.body.innerText.slice(0, 1_000),
    }));
    throw new Error(`Word result back navigation failed (link=${backHref}): ${JSON.stringify(state)}\n${error.message || error}`);
  }
  if (await page.$$(".word-pair-result-card").then((items) => items.length) !== 2) throw new Error("Pair results were lost after returning from detail view.");
  await page.$eval(".word-pair-result-card:nth-child(2) .secondary-button", (link) => {
    if (!(link instanceof HTMLAnchorElement)) throw new Error("The second Word result link was not found.");
    link.click();
  });
  try {
    await page.waitForFunction(() => location.pathname.endsWith("/tools/document-compare/results/2")
      && document.querySelector("h1")?.textContent?.includes("2번 문서 비교")
      && document.querySelectorAll(".document-page-row").length > 0, { timeout: 15_000 });
  } catch (error) {
    const state = await page.evaluate(() => ({
      href: location.href,
      pathname: location.pathname,
      title: document.querySelector("h1")?.textContent || "",
      rows: document.querySelectorAll(".document-page-row").length,
      cards: document.querySelectorAll(".word-pair-result-card").length,
      buttons: Array.from(document.querySelectorAll(".word-pair-result-card .secondary-button"), (button) => ({ text: button.textContent || "", disabled: button.disabled })),
      body: document.body.innerText.slice(0, 1_000),
    }));
    throw new Error(`Second Word result navigation failed: ${JSON.stringify(state)}\n${error.message || error}`);
  }
  const splitParagraph = await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll(".document-page-row")).find((item) => item.textContent?.includes("제5항의 지급이 완료되면"));
    if (!row) return null;
    return {
      deleted: Array.from(row.querySelectorAll(".page-diff-delete"), (item) => item.textContent || ""),
      added: Array.from(row.querySelectorAll(".page-diff-add"), (item) => item.textContent || ""),
      blocks: row.querySelectorAll(".document-page-block").length,
    };
  });
  if (!splitParagraph || splitParagraph.blocks !== 2 || splitParagraph.deleted.length
    || splitParagraph.added.length !== 1 || !splitParagraph.added[0].includes("다만, 관계 법령에 따른 추가 확인")) {
    throw new Error(`Split paragraph was still rendered as a whole replacement: ${JSON.stringify(splitParagraph)}`);
  }

  await testWordFormattingBoundaries(page, fixtures);
  await testWordUnifiedRevisionAuthor(page, fixtures, tempDir);
}

async function testWordFormattingBoundaries(page, fixtures) {
  await navigateTo(page, `${koBaseUrl}/tools/document-compare/`);
  await dropFiles(page, ".drop-zone", [fixtures.boundaryBeforeDocx, fixtures.formattingBeforeDocx], 0);
  await dropFiles(page, ".drop-zone", [fixtures.boundaryAfterDocx, fixtures.formattingAfterDocx], 1);
  await clickSetting(page, "Excel 보고서");
  await clickSetting(page, "Word 변경 추적 (DOCX 전용)");
  await page.click(".tool-action-bar .primary-button");
  await page.waitForFunction(() => !document.querySelector(".operation-progress.status-running")
    && (document.querySelector(".word-pair-result-card") || document.querySelector(".error-banner")), { timeout: 240_000 });
  if (await page.$(".error-banner")) throw new Error(await page.$eval(".error-banner", (element) => element.textContent || "Word boundary fixture failed."));
  const cards = await page.$$eval(".word-pair-result-card", (items) => items.map((item) => item.textContent || ""));
  if (cards.length !== 2 || !cards[0].includes("변경 없음") || !cards[1].includes("6개 변경 발견")) {
    throw new Error(`Boundary-aware formatting fixture produced unexpected results: ${JSON.stringify(cards)}`);
  }
  await page.click(".word-pair-result-card:nth-child(2) .secondary-button");
  await page.waitForFunction(() => location.pathname.endsWith("/tools/document-compare/results/2") && document.querySelectorAll(".document-page-row").length > 0);
  const formatRows = await page.$$eval(".document-page-row.format", (items) => items.map((item) => item.textContent || ""));
  const expectedLabels = ["Bold change", "Color change", "Highlight change", "Size change", "Font change", "Table highlight"];
  if (formatRows.length !== expectedLabels.length || expectedLabels.some((label) => !formatRows.some((row) => row.includes(label)))) {
    throw new Error(`True formatting changes were not separated correctly: ${JSON.stringify(formatRows)}`);
  }
}

async function testWordUnifiedRevisionAuthor(page, fixtures, tempDir) {
  await navigateTo(page, `${koBaseUrl}/tools/document-compare/`);
  await dropFiles(page, ".drop-zone", [fixtures.revisionsBeforeDocx], 0);
  await dropFiles(page, ".drop-zone", [fixtures.revisionsAfterDocx], 1);
  await clickSetting(page, "Excel 보고서");
  const input = await page.$(".revision-author-field input");
  if (!input || !await input.evaluate((element) => element.disabled)) throw new Error("The revision-author input was not rendered disabled while rewriting was off.");
  await clickSetting(page, "변경 내용 작성자 통일");
  if (await input.evaluate((element) => element.disabled)) throw new Error("The revision-author input did not become enabled.");
  await replaceInputValue(page, input, "Unified Reviewer");
  await page.click(".tool-action-bar .primary-button");
  await waitForResult(page, 240_000);
  const trackedPath = path.join(tempDir, "word-unified-author.docx");
  await saveBlobLink(page, ".word-pair-result-card .tracked-download", trackedPath);
  await assertUnifiedTrackedDocument(trackedPath, fixtures.revisionsBeforeDocx, fixtures.revisionsAfterDocx, fixtures.revisionOracle);

  await clickSetting(page, "변경 내용 작성자 통일");
  await page.waitForFunction(() => !document.querySelector(".word-pair-result-card"));
  if (!await input.evaluate((element) => element.disabled)) throw new Error("Changing the rewrite option did not disable its input and clear prior results.");
}

async function waitForResult(page, timeout = 180_000) {
  await page.waitForFunction(() => !document.querySelector(".operation-progress.status-running")
    && (document.querySelector(".result-download") || document.querySelector(".error-banner")), { timeout });
  const error = await page.$(".error-banner");
  if (error) throw new Error(await page.$eval(".error-banner", (element) => element.textContent || "Unknown UI error"));
}

async function clickPrimaryAction(page) {
  const previousHref = await page.$eval(".result-download", (link) => link.href).catch(() => "");
  await page.$eval(".summary-card .primary-button", (button) => {
    if (!(button instanceof HTMLButtonElement) || button.disabled) throw new Error("The primary action is unavailable.");
    button.click();
  });
  await page.waitForFunction((href) => {
    const result = document.querySelector(".result-download");
    return Boolean(document.querySelector(".operation-progress.status-running")
      || document.querySelector(".error-banner")
      || !result
      || result.href !== href);
  }, {}, previousHref);
}

async function assertProgressLog(page, label) {
  if (!await page.$(".operation-progress .operation-log")) {
    await page.$eval(".operation-progress .operation-log-toggle", (button) => button.click());
    await page.waitForSelector(".operation-progress .operation-log");
  }
  const state = await page.$eval(".operation-progress", (element) => ({
    className: element.className,
    progress: element.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow"),
    logs: element.querySelectorAll(".operation-log li").length,
    logViewport: (() => {
      const log = element.querySelector(".operation-log");
      if (!(log instanceof HTMLOListElement)) return null;
      const style = getComputedStyle(log);
      return {
        height: Math.round(log.getBoundingClientRect().height),
        overflowY: style.overflowY,
        scrollbarGutter: style.scrollbarGutter,
        atBottom: Math.abs(log.scrollHeight - log.clientHeight - log.scrollTop) <= 2,
      };
    })(),
  }));
  if (!state.className.includes("status-success") || state.progress !== "100" || state.logs < 4) {
    throw new Error(`${label} progress log is incomplete: ${JSON.stringify(state)}`);
  }
  if (!state.logViewport || state.logViewport.height < 150 || state.logViewport.overflowY !== "scroll"
    || !state.logViewport.scrollbarGutter.includes("stable") || !state.logViewport.atBottom) {
    throw new Error(`${label} progress log viewport is unstable: ${JSON.stringify(state.logViewport)}`);
  }
}

async function clickSetting(page, label) {
  await page.evaluate((text) => {
    const strong = Array.from(document.querySelectorAll(".settings-row strong")).find((element) => element.textContent === text);
    const button = strong?.closest(".settings-row")?.querySelector("button");
    if (!(button instanceof HTMLButtonElement)) throw new Error(`Setting not found: ${text}`);
    button.click();
  }, label);
}

async function findButtonByText(page, selector, text) {
  const buttons = await page.$$(selector);
  for (const button of buttons) {
    if ((await button.evaluate((element) => element.textContent)) === text) return button;
  }
  throw new Error(`Button not found: ${text}`);
}

async function saveBlobLink(page, selector, outputPath) {
  const bytes = await page.$eval(selector, async (link) => {
    const response = await fetch(link.href);
    return Array.from(new Uint8Array(await response.arrayBuffer()));
  });
  await fs.writeFile(outputPath, Buffer.from(bytes));
}

async function dropFiles(page, selector, filePaths, elementIndex = 0) {
  const payload = await Promise.all(filePaths.map(async (filePath) => ({
    name: path.basename(filePath),
    base64: (await fs.readFile(filePath)).toString("base64"),
  })));
  const elements = await page.$$(selector);
  const target = elements[elementIndex];
  if (!target) throw new Error(`Drop target not found: ${selector}[${elementIndex}]`);
  await target.evaluate((element, files) => {
    const transfer = new DataTransfer();
    files.forEach((file) => {
      const binary = atob(file.base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      transfer.items.add(new File([bytes], file.name));
    });
    ["dragenter", "dragover", "drop"].forEach((type) => element.dispatchEvent(new DragEvent(type, {
      bubbles: true,
      cancelable: true,
      dataTransfer: transfer,
    })));
  }, payload);
}

async function createFixtures(directory) {
  const xlsxOne = path.join(directory, "one.xlsx");
  const xlsxTwo = path.join(directory, "two.xlsx");
  const csv = path.join(directory, "data.csv");
  const xls = path.join(directory, "legacy.xls");
  const xlsb = path.join(directory, "binary.xlsb");
  const xlsm = path.join(directory, "macro.xlsm");
  const encryptedXlsx = path.join(directory, "protected.xlsx");
  const sheetSelectionXlsx = path.join(directory, "sheet-selection.xlsx");
  const sheetGridLongFileName = "quarterly-regional-consolidated-financial-results-accessibility-contract-2026.xlsx";
  const sheetGridLongSheetName = "Quarterly results finalized";
  const sheetGridXlsx = [
    path.join(directory, sheetGridLongFileName),
    ...Array.from({ length: 5 }, (_, index) => path.join(directory, `sheet-grid-region-${index + 2}.xlsx`)),
  ];
  const sheetTrimXlsx = path.join(directory, "sheet-trim.xlsx");
  const themeXlsxOne = path.join(directory, "theme-office-2022.xlsx");
  const themeXlsxTwo = path.join(directory, "theme-custom.xlsx");
  const beforeDocx = path.join(directory, "before.docx");
  const afterDocx = path.join(directory, "after.docx");
  const beforeDocxTwo = path.join(directory, "before-two.docx");
  const afterDocxTwo = path.join(directory, "after-two.docx");
  const boundaryBeforeDocx = path.join(directory, "word-boundary-before.docx");
  const boundaryAfterDocx = path.join(directory, "word-boundary-after.docx");
  const formattingBeforeDocx = path.join(directory, "word-formatting-before.docx");
  const formattingAfterDocx = path.join(directory, "word-formatting-after.docx");
  const revisionsBeforeDocx = path.join(directory, "word-revisions-before.docx");
  const revisionsAfterDocx = path.join(directory, "word-revisions-after.docx");
  const textPdf = path.join(directory, "text-pages.pdf");
  const tinyPng = path.join(directory, "tiny.png");

  const first = new ExcelJS.Workbook();
  const firstSheet = first.addWorksheet("First");
  firstSheet.getCell("A1").value = 1;
  firstSheet.getCell("A2").value = 2;
  firstSheet.getCell("A3").value = { formula: "SUM(A1:A2)", result: 3 };
  firstSheet.getCell("A3").font = { bold: true, color: { argb: "FF208A4B" } };
  await first.xlsx.writeFile(xlsxOne);

  const second = new ExcelJS.Workbook();
  const secondSheet = second.addWorksheet("Second");
  secondSheet.getCell("A1").value = 10;
  secondSheet.getCell("A2").value = 20;
  secondSheet.getCell("A3").value = { formula: "SUM(A1:A2)", result: 30 };
  await second.xlsx.writeFile(xlsxTwo);

  await fs.writeFile(csv, "name,amount\nalpha,100\nbeta,200\n", "utf8");
  const legacyBook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(legacyBook, XLSX.utils.aoa_to_sheet([["legacy", "value"], ["row", 7]]), "Legacy");
  await fs.writeFile(xls, XLSX.write(legacyBook, { type: "buffer", bookType: "xls" }));
  await fs.writeFile(xlsb, XLSX.write(legacyBook, { type: "buffer", bookType: "xlsb" }));
  await fs.writeFile(xlsm, XLSX.write(legacyBook, { type: "buffer", bookType: "xlsm" }));

  const protectedPlain = await first.xlsx.writeBuffer();
  await fs.writeFile(encryptedXlsx, officeCrypto.encrypt(protectedPlain, { password: "input-pass" }));
  const sheetSelectionBook = new ExcelJS.Workbook();
  ["첫째", "둘째", "셋째", "넷째"].forEach((name, index) => {
    sheetSelectionBook.addWorksheet(name).getCell("A1").value = index + 1;
  });
  await sheetSelectionBook.xlsx.writeFile(sheetSelectionXlsx);
  for (let fileIndex = 0; fileIndex < sheetGridXlsx.length; fileIndex += 1) {
    const gridBook = new ExcelJS.Workbook();
    const sheetCount = fileIndex === 0 ? 24 : 3;
    for (let sheetIndex = 0; sheetIndex < sheetCount; sheetIndex += 1) {
      const name = fileIndex === 0 && sheetIndex === 0
        ? sheetGridLongSheetName
        : `Region ${fileIndex + 1} Sheet ${String(sheetIndex + 1).padStart(2, "0")}`;
      gridBook.addWorksheet(name).getCell("A1").value = `${fileIndex + 1}-${sheetIndex + 1}`;
    }
    await gridBook.xlsx.writeFile(sheetGridXlsx[fileIndex]);
  }
  const sheetTrimBook = new ExcelJS.Workbook();
  const sheetTrimSheet = sheetTrimBook.addWorksheet("SheetTrim 확인");
  sheetTrimSheet.getCell("A1").value = "첫 행";
  sheetTrimSheet.getCell("D1").value = "D 유지";
  sheetTrimSheet.getCell("H1").value = "H 유지";
  sheetTrimSheet.getCell("B2").value = "   ";
  sheetTrimSheet.getCell("F3").value = "\t";
  sheetTrimSheet.getCell("A4").value = "중간 행";
  sheetTrimSheet.getCell("D4").value = "D 유지";
  sheetTrimSheet.getCell("H4").value = "H 유지";
  sheetTrimSheet.getCell("C6").value = "   ";
  sheetTrimSheet.getCell("A8").value = "마지막 행";
  sheetTrimSheet.getCell("D8").value = "D 유지";
  sheetTrimSheet.getCell("H8").value = "H 이동";
  const referencedSheet = sheetTrimBook.addWorksheet("참조 대상");
  referencedSheet.getCell("A1").value = "첫 행";
  referencedSheet.getCell("A5").value = "참조 유지";
  const referenceSummary = sheetTrimBook.addWorksheet("참조 요약");
  referenceSummary.getCell("A1").value = { formula: "'참조 대상'!A5", result: "참조 유지" };
  await sheetTrimBook.xlsx.writeFile(sheetTrimXlsx);
  await createThemeWorkbook(themeXlsxOne, {
    accent1: "4472C4",
    accent2: "ED7D31",
    accent4: "FFC000",
    a1Theme: 7,
    a1Tint: 0.7999816888943144,
  });
  await createThemeWorkbook(themeXlsxTwo, {
    accent1: "112233",
    accent2: "654321",
    accent4: "00B050",
    a1Theme: 4,
    a1Tint: 0,
  });
  await fs.writeFile(beforeDocx, await createDocx("업무 파일을 빠르게 처리합니다.", [
    ["항목", "금액", "비고"],
    ["A", "10", "유지"],
    ["B", "20", "유지"],
    ["C", "30", "유지"],
  ], "기존 머리말", "기존 메모", false));
  await fs.writeFile(afterDocx, await createDocx("업무 파일을 안전하고 신속하게 처리합니다.", [
    ["항목", "신규열", "금액", "비고"],
    ["A", "x", "10", "유지"],
    ["새행", "y", "15", "추가"],
    ["B", "z", "20", "유지"],
    ["C", "w", "30", "유지"],
  ], "변경된 머리말", "변경된 메모", true));
  const splitOriginal = "제5항의 지급이 완료되면 채권 전부를 변제받은 것으로 인정하고 이후 이의를 제기하지 아니한다. 또한 지급 완료 후 필요한 신청을 취하하고 접수증을 송부한다.";
  const splitInserted = " 다만, 관계 법령에 따른 추가 확인이 필요한 경우 별도로 절차를 진행할 수 있다.";
  const splitAt = splitOriginal.indexOf(" 또한");
  await fs.writeFile(beforeDocxTwo, await createDocx(splitOriginal, "두 번째 기존 표", "두 번째 기존 머리말", "두 번째 기존 메모", false));
  await fs.writeFile(afterDocxTwo, await createDocx([splitOriginal.slice(0, splitAt) + splitInserted, splitOriginal.slice(splitAt + 1)], "두 번째 변경 표", "두 번째 변경 머리말", "두 번째 변경 메모", true));
  const boundaryFixtures = await createWordBoundaryFixtures();
  await fs.writeFile(boundaryBeforeDocx, boundaryFixtures.before);
  await fs.writeFile(boundaryAfterDocx, boundaryFixtures.after);
  const formattingFixtures = await createWordFormattingFixtures();
  await fs.writeFile(formattingBeforeDocx, formattingFixtures.before);
  await fs.writeFile(formattingAfterDocx, formattingFixtures.after);
  const revisionFixtures = await createWordRevisionFixtures();
  await fs.writeFile(revisionsBeforeDocx, revisionFixtures.before);
  await fs.writeFile(revisionsAfterDocx, revisionFixtures.after);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const firstPdfPage = pdf.addPage([400, 600]);
  firstPdfPage.drawText("First PDF page", { x: 48, y: 520, size: 18, font, color: rgb(0.1, 0.1, 0.1) });
  firstPdfPage.drawText("Name    Amount", { x: 48, y: 480, size: 12, font });
  firstPdfPage.drawText("Alpha   100", { x: 48, y: 458, size: 12, font });
  const secondPdfPage = pdf.addPage([600, 400]);
  secondPdfPage.drawText("Second PDF page", { x: 48, y: 330, size: 18, font, color: rgb(0.1, 0.1, 0.1) });
  await fs.writeFile(textPdf, await pdf.save());
  await fs.writeFile(tinyPng, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zk90AAAAASUVORK5CYII=", "base64"));

  return { xlsxOne, xlsxTwo, csv, xls, xlsb, xlsm, encryptedXlsx, sheetSelectionXlsx, sheetGridXlsx, sheetGridLongFileName, sheetGridLongSheetName, sheetTrimXlsx, themeXlsxOne, themeXlsxTwo, beforeDocx, afterDocx, beforeDocxTwo, afterDocxTwo, boundaryBeforeDocx, boundaryAfterDocx, formattingBeforeDocx, formattingAfterDocx, revisionsBeforeDocx, revisionsAfterDocx, revisionOracle: revisionFixtures.oracle, textPdf, tinyPng };
}

async function createThemeWorkbook(filePath, colors) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Theme colors");
  sheet.getCell("A1").value = path.basename(filePath);
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { theme: colors.a1Theme, tint: colors.a1Tint }, bgColor: { indexed: 64 } };
  sheet.getCell("A1").font = { color: { theme: 5 } };
  sheet.getCell("A1").border = { top: { style: "thin", color: { theme: 4, tint: -0.25 } } };
  sheet.getCell("B1").value = "explicit rgb";
  sheet.getCell("B1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123456" } };
  sheet.getCell("B2").value = "indexed";
  sheet.getCell("B2").fill = { type: "pattern", pattern: "solid", fgColor: { indexed: 64 } };
  sheet.getCell("C1").value = "gradient excluded";
  sheet.getCell("C1").fill = { type: "gradient", gradient: "angle", degree: 0, stops: [{ position: 0, color: { theme: 4 } }, { position: 1, color: { theme: 5 } }] };
  sheet.getCell("D1").value = { richText: [{ text: "rich text excluded", font: { color: { theme: 4 } } }] };

  const archive = await JSZip.loadAsync(await workbook.xlsx.writeBuffer());
  const themePath = "xl/theme/theme1.xml";
  let themeXml = await archive.file(themePath).async("string");
  themeXml = replaceThemeColor(themeXml, "accent1", colors.accent1);
  themeXml = replaceThemeColor(themeXml, "accent2", colors.accent2);
  themeXml = replaceThemeColor(themeXml, "accent4", colors.accent4);
  archive.file(themePath, themeXml);
  await fs.writeFile(filePath, await archive.generateAsync({ type: "nodebuffer" }));
}

function replaceThemeColor(xml, key, rgb) {
  const pattern = new RegExp(`(<a:${key}>\\s*<a:srgbClr\\s+val=")[0-9A-Fa-f]{6}("\\s*\\/>\\s*<\\/a:${key}>)`);
  const replaced = xml.replace(pattern, `$1${rgb}$2`);
  if (replaced === xml) throw new Error(`Could not replace ${key} in the synthetic Excel theme.`);
  return replaced;
}

async function createMinimalDocx(body) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${WORD_NS}"><w:body>${body}<w:sectPr/></w:body></w:document>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

function wordRun(text, properties = "", attributes = "") {
  return `<w:r${attributes}>${properties ? `<w:rPr>${properties}</w:rPr>` : ""}<w:t xml:space="preserve">${text}</w:t></w:r>`;
}

async function createWordBoundaryFixtures() {
  const before = [
    `<w:p>${wordRun("Proofing split remains stable", "", ' w:rsidR="00000001"')}</w:p>`,
    `<w:p><w:hyperlink>${wordRun("Hyperlink boundary")}</w:hyperlink></w:p>`,
    `<w:p><w:ins w:id="1" w:author="Existing">${wordRun("Revision boundary")}</w:ins></w:p>`,
    `<w:p><w:fldSimple w:instr=" DATE ">${wordRun("Field result")}</w:fldSimple></w:p>`,
    `<w:p><w:r><w:fldChar w:fldCharType="begin"/><w:instrText>PAGE</w:instrText></w:r>${wordRun("Complex field result")}<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`,
    `<w:p><w:r><w:t>A</w:t><w:tab/><w:t>B</w:t><w:br/><w:t>C</w:t></w:r></w:p>`,
    `<w:p>${wordRun("Foot")}<w:r><w:footnoteReference w:id="1"/></w:r>${wordRun("note")}</w:p>`,
    `<w:p>${wordRun("A")}${wordRun("B", "<w:b/>")}${wordRun("A")}</w:p>`,
    `<w:tbl><w:tr><w:tc><w:p>${wordRun("Table cell split")}</w:p></w:tc></w:tr></w:tbl>`,
  ].join("");
  const after = [
    `<w:p><w:proofErr w:type="spellStart"/>${wordRun("Proofing ", "", ' w:rsidR="99999999"')}<w:proofErr w:type="spellEnd"/>${wordRun("split remains ", "", ' w:rsidR="88888888"')}${wordRun("stable")}</w:p>`,
    `<w:p><w:hyperlink>${wordRun("Hyperlink ")}${wordRun("boundary")}</w:hyperlink></w:p>`,
    `<w:p><w:ins w:id="99" w:author="Another">${wordRun("Revision ")}${wordRun("boundary")}</w:ins></w:p>`,
    `<w:p><w:fldSimple w:instr=" DATE ">${wordRun("Field ")}${wordRun("result")}</w:fldSimple></w:p>`,
    `<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>PAGE</w:instrText></w:r>${wordRun("Complex ")}${wordRun("field result")}<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`,
    `<w:p>${wordRun("A")}<w:r><w:tab/></w:r>${wordRun("B")}<w:r><w:br/></w:r>${wordRun("C")}</w:p>`,
    `<w:p>${wordRun("Fo")}${wordRun("ot")}<w:r><w:footnoteReference w:id="1"/></w:r>${wordRun("no")}${wordRun("te")}</w:p>`,
    `<w:p>${wordRun("A")}${wordRun("B", "<w:b/>")}${wordRun("A")}</w:p>`,
    `<w:tbl><w:tr><w:tc><w:p><w:proofErr w:type="spellStart"/>${wordRun("Table cell ")}<w:proofErr w:type="spellEnd"/>${wordRun("split")}</w:p></w:tc></w:tr></w:tbl>`,
  ].join("");
  return { before: await createMinimalDocx(before), after: await createMinimalDocx(after) };
}

async function createWordFormattingFixtures() {
  const paragraph = (text, properties) => `<w:p>${wordRun(text, properties)}</w:p>`;
  const before = [
    paragraph("Bold change", ""),
    paragraph("Color change", '<w:color w:val="FF0000"/>'),
    paragraph("Highlight change", '<w:highlight w:val="yellow"/>'),
    paragraph("Size change", '<w:sz w:val="20"/>'),
    paragraph("Font change", '<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>'),
    `<w:tbl><w:tr><w:tc>${paragraph("Table highlight", '<w:highlight w:val="yellow"/>')}</w:tc></w:tr></w:tbl>`,
  ].join("");
  const after = [
    paragraph("Bold change", "<w:b/>"),
    paragraph("Color change", '<w:color w:val="0000FF"/>'),
    paragraph("Highlight change", '<w:highlight w:val="cyan"/>'),
    paragraph("Size change", '<w:sz w:val="28"/>'),
    paragraph("Font change", '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>'),
    `<w:tbl><w:tr><w:tc>${paragraph("Table highlight", '<w:highlight w:val="cyan"/>')}</w:tc></w:tr></w:tbl>`,
  ].join("");
  return { before: await createMinimalDocx(before), after: await createMinimalDocx(after) };
}

function legacyRevision(kind, content, id) {
  return `<w:${kind} w:id="${id}" w:author="Legacy Revision" w:date="2026-01-01T00:00:00Z">${content}</w:${kind}>`;
}

function commentAnchor(commentId, label, deleted = false) {
  const anchors = `<w:commentRangeStart w:id="${commentId}"/>${deleted ? '<w:r><w:delText>discarded anchor text</w:delText></w:r>' : wordRun(label)}<w:commentRangeEnd w:id="${commentId}"/><w:r><w:commentReference w:id="${commentId}"/></w:r>`;
  return `<w:p>${deleted ? legacyRevision("del", anchors, `7${commentId}`) : anchors}</w:p>`;
}

function revisionDocument(side, commentIds) {
  const capitalized = side[0].toUpperCase() + side.slice(1);
  const anchors = commentIds.map((item, index) => commentAnchor(item, `${capitalized} anchor ${index + 1}`, index === 0)).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${WORD_NS}" xmlns:w14="${WORD_2010_NS}"><w:body>
    <w:p><w:pPr><w:numPr><w:numberingChange w:id="101" w:author="Legacy Revision"/></w:numPr><w:pPrChange w:id="102" w:author="Legacy Revision"><w:pPr/></w:pPrChange></w:pPr>
      ${legacyRevision("del", '<w:r><w:delText>discard inline</w:delText></w:r>', "103")}
      ${legacyRevision("ins", wordRun(`${capitalized} accepted`), "104")}
      ${legacyRevision("moveFrom", wordRun(" discard move"), "105")}${legacyRevision("moveTo", wordRun(" moved"), "106")}
      <w:moveFromRangeStart w:id="105"/><w:moveFromRangeEnd w:id="105"/><w:moveToRangeStart w:id="106"/><w:moveToRangeEnd w:id="106"/>
      <w:customXmlInsRangeStart w:id="107"/><w:customXmlInsRangeEnd w:id="107"/><w:customXmlDelRangeStart w:id="108"/><w:customXmlDelRangeEnd w:id="108"/>
    </w:p>
    <w:p><w:pPr><w:rPr><w:del w:id="109" w:author="Legacy Revision"/></w:rPr></w:pPr>${wordRun("Merge ")}</w:p><w:p>${wordRun(`tail ${side}`)}</w:p>
    <w:p><w:pPr><w:rPr><w:ins w:id="110" w:author="Legacy Revision"/></w:rPr></w:pPr>${wordRun(`Split ${side} A`)}</w:p><w:p>${wordRun(`Split ${side} B`)}</w:p>
    <w:tbl><w:tblPr><w:tblPrChange w:id="111" w:author="Legacy Revision"><w:tblPr/></w:tblPrChange></w:tblPr><w:tblGrid><w:gridCol w:w="2000"/><w:tblGridChange w:id="112" w:author="Legacy Revision"><w:tblGrid/></w:tblGridChange></w:tblGrid>
      <w:tr><w:trPr><w:del w:id="113" w:author="Legacy Revision"/></w:trPr><w:tc><w:p>${wordRun("discard row")}</w:p></w:tc></w:tr>
      <w:tr><w:tblPrEx><w:tblPrExChange w:id="114" w:author="Legacy Revision"><w:tblPrEx/></w:tblPrExChange></w:tblPrEx><w:trPr><w:ins w:id="115" w:author="Legacy Revision"/><w:trPrChange w:id="116" w:author="Legacy Revision"><w:trPr/></w:trPrChange></w:trPr>
        <w:tc><w:tcPr><w:cellDel w:id="117" w:author="Legacy Revision"/></w:tcPr><w:p>${wordRun("discard cell")}</w:p></w:tc>
        <w:tc><w:tcPr><w:vMerge w:val="restart"/><w:cellIns w:id="118" w:author="Legacy Revision"/><w:cellMerge w:id="119" w:author="Legacy Revision"/><w:tcPrChange w:id="120" w:author="Legacy Revision"><w:tcPr/></w:tcPrChange></w:tcPr><w:p><w:r><w:rPr><w:b/><w:rPrChange w:id="121" w:author="Legacy Revision"><w:rPr/></w:rPrChange></w:rPr><w:t>Kept ${side}</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>${anchors}<w:sectPr><w:sectPrChange w:id="122" w:author="Legacy Revision"><w:sectPr/></w:sectPrChange></w:sectPr>
  </w:body></w:document>`;
}

function revisionComment(id, author, initials, paraId, finalText, draftText) {
  const paragraphId = paraId ? ` w14:paraId="${paraId}"` : "";
  return `<w:comment w:id="${id}" w:author="${author}" w:initials="${initials}" w:date="2026-09-01T00:00:00Z"><w:p${paragraphId}>${legacyRevision("ins", wordRun(finalText), `8${id}`)}${legacyRevision("del", `<w:r><w:delText>${draftText}</w:delText></w:r>`, `9${id}`)}</w:p></w:comment>`;
}

function revisionComments(after) {
  const rows = after ? [
    ["10", "Legacy Reviewer", "LR", "A0000001", "Shared final", "Shared draft"],
    ["11", "Existing Author", "EA", "A0000002", "Para identity", "Para draft"],
    ["12", "Duplicate Author", "DA", null, "Duplicate body", "Duplicate draft"],
    ["13", "Reply Author", "RA", "A0000003", "Existing reply", "Reply draft"],
    ["18", "SML", "SML", "A0000008", "Duplicate body", "New duplicate draft"],
    ["19", "SML", "SML", "A0000009", "New reply final", "New reply draft"],
  ] : [
    ["0", "Legacy Reviewer", "LR", "A0000001", "Shared final", "Shared draft"],
    ["1", "Existing Author", "EA", "A0000002", "Para identity", "Para draft"],
    ["2", "Duplicate Author", "DA", null, "Duplicate body", "Duplicate draft"],
    ["3", "Reply Author", "RA", "A0000003", "Existing reply", "Reply draft"],
  ];
  return `<?xml version="1.0" encoding="UTF-8"?><w:comments xmlns:w="${WORD_NS}" xmlns:w14="${WORD_2010_NS}">${rows.map((row) => revisionComment(...row)).join("")}</w:comments>`;
}

function commentsIds(after) {
  const rows = after
    ? [["A0000001", "D0000001"], ["A0000003", "D0000003"], ["A0000008", "D0000008"], ["A0000009", "D0000009"]]
    : [["A0000001", "D0000001"], ["A0000003", "D0000003"]];
  return `<?xml version="1.0" encoding="UTF-8"?><w16cid:commentsIds xmlns:w16cid="${WORD_CID_NS}">${rows.map(([paraId, durableId]) => `<w16cid:commentId w16cid:paraId="${paraId}" w16cid:durableId="${durableId}"/>`).join("")}</w16cid:commentsIds>`;
}

function commentsExtended(after) {
  const rows = after
    ? [["A0000001", ""], ["A0000002", ""], ["A0000003", "A0000001"], ["A0000008", ""], ["A0000009", "A0000008"]]
    : [["A0000001", ""], ["A0000002", ""], ["A0000003", "A0000001"]];
  return `<?xml version="1.0" encoding="UTF-8"?><w15:commentsEx xmlns:w15="${WORD_2012_NS}">${rows.map(([paraId, parent]) => `<w15:commentEx w15:paraId="${paraId}"${parent ? ` w15:paraIdParent="${parent}"` : ""} w15:done="0"/>`).join("")}</w15:commentsEx>`;
}

function commentsExtensible(after) {
  const ids = after ? ["D0000001", "D0000003", "D0000008", "D0000009"] : ["D0000001", "D0000003"];
  return `<?xml version="1.0" encoding="UTF-8"?><w16cex:commentsExtensible xmlns:w16cex="${WORD_CEX_NS}">${ids.map((id) => `<w16cex:commentExtensible w16cex:durableId="${id}" w16cex:dateUtc="2026-09-01T00:00:00Z"/>`).join("")}</w16cex:commentsExtensible>`;
}

function peopleXml(after) {
  return `<?xml version="1.0" encoding="UTF-8"?><w15:people xmlns:w15="${WORD_2012_NS}"><w15:person w15:author="Legacy Reviewer"><w15:presenceInfo w15:providerId="AD" w15:userId="legacy-id"/></w15:person>${after ? '<w15:person w15:author="SML"><w15:presenceInfo w15:providerId="None" w15:userId="SML"/></w15:person>' : ""}</w15:people>`;
}

function revisionStory(rootTag, side, label) {
  const capitalized = side[0].toUpperCase() + side.slice(1);
  return `<?xml version="1.0" encoding="UTF-8"?><w:${rootTag} xmlns:w="${WORD_NS}"><w:p>${legacyRevision("del", '<w:r><w:delText>discard story</w:delText></w:r>', "201")}${legacyRevision("ins", wordRun(`${capitalized} ${label}`), "202")}</w:p></w:${rootTag}>`;
}

function revisionNotes(rootTag, noteTag, side, label) {
  const capitalized = side[0].toUpperCase() + side.slice(1);
  return `<?xml version="1.0" encoding="UTF-8"?><w:${rootTag} xmlns:w="${WORD_NS}"><w:${noteTag} w:id="1"><w:p>${legacyRevision("del", '<w:r><w:delText>discard note</w:delText></w:r>', "211")}${legacyRevision("ins", wordRun(`${capitalized} ${label}`), "212")}</w:p></w:${noteTag}></w:${rootTag}>`;
}

async function createWordRevisionFixture(after) {
  const side = after ? "after" : "before";
  const commentIds = after ? ["10", "11", "12", "13", "18", "19"] : ["0", "1", "2", "3"];
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/><Override PartName="/word/endnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml"/><Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/></Relationships>`);
  zip.file("word/document.xml", revisionDocument(side, commentIds));
  zip.file("word/header1.xml", revisionStory("hdr", side, "header"));
  zip.file("word/footer1.xml", revisionStory("ftr", side, "footer"));
  zip.file("word/footnotes.xml", revisionNotes("footnotes", "footnote", side, "footnote"));
  zip.file("word/endnotes.xml", revisionNotes("endnotes", "endnote", side, "endnote"));
  zip.file("word/comments.xml", revisionComments(after));
  zip.file("word/commentsIds.xml", commentsIds(after));
  zip.file("word/commentsExtended.xml", commentsExtended(after));
  zip.file("word/commentsExtensible.xml", commentsExtensible(after));
  zip.file("word/people.xml", peopleXml(after));
  zip.file("word/styles.xml", `<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="${WORD_NS}"><w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="${after ? "160" : "80"}"/><w:pPrChange w:id="301" w:author="Legacy Revision"><w:pPr/></w:pPrChange></w:pPr><w:rPr>${after ? "<w:b/>" : "<w:i/>"}<w:rPrChange w:id="302" w:author="Legacy Revision"><w:rPr/></w:rPrChange></w:rPr></w:style></w:styles>`);
  zip.file("word/settings.xml", `<?xml version="1.0" encoding="UTF-8"?><w:settings xmlns:w="${WORD_NS}"><w:trackRevisions/><w:defaultTabStop w:val="720"/><w:compat/></w:settings>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

function acceptedOracle(side, commentCount) {
  const capitalized = side[0].toUpperCase() + side.slice(1);
  const anchorText = Array.from({ length: commentCount - 1 }, (_, index) => `${capitalized} anchor ${index + 2}`).join("");
  return `<w:root xmlns:w="${WORD_NS}"><w:t>${capitalized} accepted</w:t><w:t> moved</w:t><w:t>Merge </w:t><w:t>tail ${side}</w:t><w:t>Split ${side} A</w:t><w:t>Split ${side} B</w:t><w:t>Kept ${side}</w:t><w:t>${anchorText}</w:t></w:root>`;
}

async function createWordRevisionFixtures() {
  return {
    before: await createWordRevisionFixture(false),
    after: await createWordRevisionFixture(true),
    oracle: {
      beforeDocument: acceptedOracle("before", 4),
      afterDocument: acceptedOracle("after", 6),
      beforeHeader: `<w:t xmlns:w="${WORD_NS}">Before header</w:t>`,
      afterHeader: `<w:t xmlns:w="${WORD_NS}">After header</w:t>`,
      beforeFooter: `<w:t xmlns:w="${WORD_NS}">Before footer</w:t>`,
      afterFooter: `<w:t xmlns:w="${WORD_NS}">After footer</w:t>`,
      beforeFootnote: `<w:t xmlns:w="${WORD_NS}">Before footnote</w:t>`,
      afterFootnote: `<w:t xmlns:w="${WORD_NS}">After footnote</w:t>`,
      beforeEndnote: `<w:t xmlns:w="${WORD_NS}">Before endnote</w:t>`,
      afterEndnote: `<w:t xmlns:w="${WORD_NS}">After endnote</w:t>`,
    },
  };
}

async function createDocx(paragraph, tableValue, headerValue, commentValue, bold) {
  const zip = new JSZip();
  const paragraphs = Array.isArray(paragraph) ? paragraph : [paragraph];
  const bodyParagraphs = paragraphs.map((value, index) => `<w:p>${index === 0 ? '<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>' : ""}<w:r>${bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t>${value}</w:t></w:r></w:p>`).join("");
  const tableRows = Array.isArray(tableValue) ? tableValue : [[tableValue]];
  const tableXml = `<w:tbl>${tableRows.map((row) => `<w:tr>${row.map((value) => `<w:tc><w:p><w:r><w:t>${value}</w:t></w:r></w:p></w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`;
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/><Relationship Id="rIdComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  const commentReference = `<w:r><w:commentReference w:id="0"/></w:r>`;
  const anchoredCommentReference = bold
    ? `<w:ins w:id="801" w:author="기존 작성자" w:date="2026-01-01T00:00:00Z">${commentReference}</w:ins>`
    : commentReference;
  const existingRevisionText = bold ? "메모가 연결된 문단입니다." : "메모가 연결된 이전 문단입니다.";
  const commentText = `<w:ins w:id="800" w:author="기존 작성자" w:date="2026-01-01T00:00:00Z"><w:r><w:t>${existingRevisionText}</w:t></w:r></w:ins>`;
  const commentParagraph = `<w:p><w:commentRangeStart w:id="0"/>${commentText}<w:commentRangeEnd w:id="0"/>${anchoredCommentReference}</w:p>`;
  const commentBlock = bold
    ? `<w:sdt><w:sdtPr><w:tag w:val="anchored-comment"/></w:sdtPr><w:sdtContent>${commentParagraph}</w:sdtContent></w:sdt>`
    : commentParagraph;
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${bodyParagraphs}${commentBlock}<w:p><w:r><w:t>변경 없는 문단입니다.</w:t></w:r></w:p>${tableXml}<w:sectPr><w:headerReference w:type="default" r:id="rIdHeader"/><w:footerReference w:type="default" r:id="rIdFooter"/></w:sectPr></w:body></w:document>`);
  zip.file("word/numbering.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`);
  zip.file("word/header1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>${headerValue}</w:t></w:r></w:p></w:hdr>`);
  const footerParagraph = `<w:p><w:r><w:t>- ${bold ? "1" : "23"} -</w:t></w:r></w:p>`;
  zip.file("word/footer1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${bold ? footerParagraph : `<w:sdt><w:sdtContent>${footerParagraph}</w:sdtContent></w:sdt>`}</w:ftr>`);
  zip.file("word/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="${bold ? "160" : "80"}"/></w:pPr><w:rPr>${bold ? "<w:b/>" : "<w:i/>"}</w:rPr></w:style></w:styles>`);
  zip.file("word/comments.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="0" w:author="검토자"><w:p><w:r><w:t>${commentValue}</w:t></w:r></w:p></w:comment></w:comments>`);
  zip.file("word/settings.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="720"/><w:compat/><w:rsids/></w:settings>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

async function assertTrackedDocument(trackedPath, beforePath, afterPath, requireTableAxes = true) {
  const [trackedZip, beforeZip, afterZip] = await Promise.all([
    JSZip.loadAsync(await fs.readFile(trackedPath)),
    JSZip.loadAsync(await fs.readFile(beforePath)),
    JSZip.loadAsync(await fs.readFile(afterPath)),
  ]);
  const [trackedDocument, beforeDocument, afterDocument, trackedHeader, beforeHeader, afterHeader, trackedFooter, beforeFooter, afterFooter, trackedStyles, trackedComments, afterComments, settings, trackedNumbering] = await Promise.all([
    trackedZip.file("word/document.xml").async("string"),
    beforeZip.file("word/document.xml").async("string"),
    afterZip.file("word/document.xml").async("string"),
    trackedZip.file("word/header1.xml").async("string"),
    beforeZip.file("word/header1.xml").async("string"),
    afterZip.file("word/header1.xml").async("string"),
    trackedZip.file("word/footer1.xml").async("string"),
    beforeZip.file("word/footer1.xml").async("string"),
    afterZip.file("word/footer1.xml").async("string"),
    trackedZip.file("word/styles.xml").async("string"),
    trackedZip.file("word/comments.xml").async("string"),
    afterZip.file("word/comments.xml").async("string"),
    trackedZip.file("word/settings.xml").async("string"),
    trackedZip.file("word/numbering.xml").async("string"),
  ]);

  const expectedMarkers = ["<w:ins", "<w:del", "<w:delText", "<w:rPrChange"];
  if (requireTableAxes) expectedMarkers.push("<w:cellIns");
  for (const marker of expectedMarkers) {
    if (!trackedDocument.includes(marker)) throw new Error(`Tracked DOCX is missing ${marker}. ${trackedDocument.slice(0, 1800)}`);
  }
  if (!trackedDocument.includes('w:author="Worklazy Tools"')) throw new Error("Tracked changes have no revision author.");
  if (!settings.includes("<w:revisionView")) {
    throw new Error("Tracked-change display settings were not written.");
  }
  const revisionViewIndex = settings.indexOf("<w:revisionView");
  for (const laterSetting of ["<w:defaultTabStop", "<w:compat", "<w:rsids"]) {
    const laterIndex = settings.indexOf(laterSetting);
    if (laterIndex >= 0 && revisionViewIndex > laterIndex) {
      throw new Error(`Tracked-change display settings violate CT_Settings order before ${laterSetting}.`);
    }
  }
  if (settings.includes("<w:trackRevisions")) {
    throw new Error("The generated document unexpectedly enables tracking for the user's future edits.");
  }
  const definedNumberIds = new Set(Array.from(trackedNumbering.matchAll(/<w:num\b[^>]*w:numId="(\d+)"/g), (match) => match[1]));
  const referencedNumberIds = Array.from(trackedDocument.matchAll(/<w:numId\b[^>]*w:val="(\d+)"/g), (match) => match[1]);
  const missingNumberIds = referencedNumberIds.filter((numberId) => numberId !== "0" && !definedNumberIds.has(numberId));
  if (missingNumberIds.length) throw new Error(`Tracked DOCX has unresolved numbering references: ${missingNumberIds.join(",")}`);
  assertTrackedDocumentStructure(trackedDocument, trackedComments, trackedNumbering);

  const existingRevisionParagraph = Array.from(trackedDocument.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g))
    .map((match) => match[0])
    .find((paragraphXml) => xmlText(paragraphXml) === "메모가 연결된 문단입니다.");
  if (!existingRevisionParagraph || /<w:(?:ins|del)\b[^>]*w:author="Worklazy Tools"/.test(existingRevisionParagraph)) {
    throw new Error("An existing author's text revision was nested inside a Worklazy text revision.");
  }
  if (!trackedDocument.includes('w:author="기존 작성자"')) {
    throw new Error("An existing after-document revision author was overwritten or removed.");
  }

  assertRevisionOutcome("document accept", trackedDocument, afterDocument, "accept");
  assertRevisionOutcome("document reject", trackedDocument, beforeDocument, "reject", [
    ["메모가 연결된 이전 문단입니다.", "메모가 연결된 문단입니다."],
  ]);
  assertRevisionOutcome("header accept", trackedHeader, afterHeader, "accept");
  assertRevisionOutcome("header reject", trackedHeader, beforeHeader, "reject");
  assertRevisionOutcome("footer accept", trackedFooter, afterFooter, "accept");
  assertRevisionOutcome("footer reject", trackedFooter, beforeFooter, "reject");
  if (!trackedFooter.includes('<w:del') || !trackedFooter.includes('<w:ins')
    || !trackedFooter.includes('w:author="Worklazy Tools"')) {
    throw new Error("A footer content control was not compared as a text replacement.");
  }
  if (!trackedStyles.includes('<w:pPrChange') || !trackedStyles.includes('<w:rPrChange')
    || !trackedStyles.includes('w:author="Worklazy Tools"')) {
    throw new Error("Style definition changes were not tracked.");
  }
  if (trackedComments !== afterComments) {
    throw new Error("After-document comment authors or contents were modified.");
  }

  let libreOfficeAvailable = true;
  try {
    await fs.access("/usr/bin/libreoffice");
  } catch (error) {
    if (error?.code === "ENOENT") libreOfficeAvailable = false;
    else throw error;
  }
  if (libreOfficeAvailable) {
    const validationDirectory = path.join(path.dirname(trackedPath), "libreoffice-validation");
    const profileDirectory = path.join(path.dirname(trackedPath), "libreoffice-profile");
    await fs.mkdir(validationDirectory, { recursive: true });
    try {
      await runExecutable("/usr/bin/libreoffice", [
        "--headless",
        `-env:UserInstallation=file://${profileDirectory}`,
        "--convert-to",
        "pdf",
        "--outdir",
        validationDirectory,
        trackedPath,
      ]);
      await fs.access(path.join(validationDirectory, `${path.basename(trackedPath, ".docx")}.pdf`));
    } catch (error) {
      throw new Error(`Tracked DOCX could not be opened by LibreOffice: ${error.message || error}`);
    }
  }
}

async function assertUnifiedTrackedDocument(trackedPath, beforePath, afterPath, oracle) {
  const [trackedZip, afterZip] = await Promise.all([
    JSZip.loadAsync(await fs.readFile(trackedPath)),
    JSZip.loadAsync(await fs.readFile(afterPath)),
  ]);
  const partNames = [
    "word/document.xml",
    "word/header1.xml",
    "word/footer1.xml",
    "word/footnotes.xml",
    "word/endnotes.xml",
    "word/comments.xml",
    "word/styles.xml",
    "word/settings.xml",
    "word/people.xml",
  ];
  const parts = Object.fromEntries(await Promise.all(partNames.map(async (name) => [name, await trackedZip.file(name).async("string")])));
  const documentXml = parts["word/document.xml"];
  const revisionAuthors = Array.from(documentXml.matchAll(/<w:(?:ins|del|moveFrom|moveTo|rPrChange|pPrChange|tblPrChange|tblPrExChange|tblGridChange|trPrChange|tcPrChange|sectPrChange|cellIns|cellDel|cellMerge|numberingChange)\b[^>]*w:author="([^"]+)"/g), (match) => match[1]);
  if (!revisionAuthors.length || revisionAuthors.some((author) => author !== "Unified Reviewer")) {
    throw new Error(`Tracked revisions were not assigned to one author: ${JSON.stringify([...new Set(revisionAuthors)])}`);
  }
  if (Object.values(parts).some((xml) => /<w:(?:ins|del|moveFrom|moveTo|rPrChange|pPrChange|tblPrChange|tblPrExChange|tblGridChange|trPrChange|tcPrChange|sectPrChange|cellIns|cellDel|cellMerge|numberingChange)\b[^>]*w:author="Legacy Revision"/.test(xml))) {
    throw new Error("An input revision author survived the accept-before-compare path.");
  }
  for (const marker of ["moveFromRangeStart", "moveFromRangeEnd", "moveToRangeStart", "moveToRangeEnd", "customXmlInsRangeStart", "customXmlInsRangeEnd", "customXmlDelRangeStart", "customXmlDelRangeEnd", "tblGridChange", "tblPrExChange", "cellMerge", "numberingChange"]) {
    if (documentXml.includes(`:${marker}`)) throw new Error(`Accepted tracked output retained ${marker}.`);
  }
  for (const discarded of ["discard inline", "discard move", "discard row", "discard cell", "discarded anchor text"]) {
    if (documentXml.includes(discarded)) throw new Error(`Accepted tracked output retained deleted content: ${discarded}`);
  }
  if (parts["word/settings.xml"].includes("trackRevisions")) throw new Error("Accepted tracked output still enables revision tracking.");

  assertRevisionOutcome("unified document accept", documentXml, oracle.afterDocument, "accept", [], "Unified Reviewer");
  assertRevisionOutcome("unified document reject", documentXml, oracle.beforeDocument, "reject", [], "Unified Reviewer");
  assertRevisionOutcome("unified header accept", parts["word/header1.xml"], oracle.afterHeader, "accept", [], "Unified Reviewer");
  assertRevisionOutcome("unified header reject", parts["word/header1.xml"], oracle.beforeHeader, "reject", [], "Unified Reviewer");
  assertRevisionOutcome("unified footer accept", parts["word/footer1.xml"], oracle.afterFooter, "accept", [], "Unified Reviewer");
  assertRevisionOutcome("unified footer reject", parts["word/footer1.xml"], oracle.beforeFooter, "reject", [], "Unified Reviewer");
  assertRevisionOutcome("unified footnote accept", parts["word/footnotes.xml"], oracle.afterFootnote, "accept", [], "Unified Reviewer");
  assertRevisionOutcome("unified footnote reject", parts["word/footnotes.xml"], oracle.beforeFootnote, "reject", [], "Unified Reviewer");
  assertRevisionOutcome("unified endnote accept", parts["word/endnotes.xml"], oracle.afterEndnote, "accept", [], "Unified Reviewer");
  assertRevisionOutcome("unified endnote reject", parts["word/endnotes.xml"], oracle.beforeEndnote, "reject", [], "Unified Reviewer");

  const comments = Array.from(parts["word/comments.xml"].matchAll(/<w:comment\b([^>]*)>([\s\S]*?)<\/w:comment>/g), (match) => ({
    id: match[1].match(/w:id="([^"]+)"/)?.[1],
    author: match[1].match(/w:author="([^"]+)"/)?.[1],
    initials: match[1].match(/w:initials="([^"]+)"/)?.[1],
    text: xmlText(match[2]),
  }));
  const expectedComments = new Map([
    ["10", ["Legacy Reviewer", "LR", "Shared final"]],
    ["11", ["Existing Author", "EA", "Para identity"]],
    ["12", ["Duplicate Author", "DA", "Duplicate body"]],
    ["13", ["Reply Author", "RA", "Existing reply"]],
    ["18", ["Unified Reviewer", "UR", "Duplicate body"]],
    ["19", ["Unified Reviewer", "UR", "New reply final"]],
  ]);
  for (const [id, expected] of expectedComments) {
    const actual = comments.find((comment) => comment.id === id);
    if (!actual || actual.author !== expected[0] || actual.initials !== expected[1] || actual.text !== expected[2]) {
      throw new Error(`Comment ${id} was not preserved or rewritten correctly: ${JSON.stringify(actual)}`);
    }
    for (const marker of ["commentRangeStart", "commentRangeEnd", "commentReference"]) {
      const count = documentXml.match(new RegExp(`<w:${marker}\\b[^>]*w:id="${id}"`, "g"))?.length ?? 0;
      if (count !== 1) throw new Error(`Comment ${id} has ${count} ${marker} anchors after acceptance.`);
    }
  }

  for (const name of ["word/commentsExtended.xml", "word/commentsIds.xml", "word/commentsExtensible.xml"]) {
    const [actual, expected] = await Promise.all([trackedZip.file(name).async("nodebuffer"), afterZip.file(name).async("nodebuffer")]);
    if (!actual.equals(expected)) throw new Error(`${name} changed during comment-author rewriting.`);
  }
  const originalPeople = await afterZip.file("word/people.xml").async("string");
  const originalLegacy = personIdentity(originalPeople, "Legacy Reviewer");
  const trackedLegacy = personIdentity(parts["word/people.xml"], "Legacy Reviewer");
  if (JSON.stringify(originalLegacy) !== JSON.stringify(trackedLegacy)) throw new Error("An existing people.xml entry was changed globally.");
  const unifiedPerson = personIdentity(parts["word/people.xml"], "Unified Reviewer");
  if (!unifiedPerson || unifiedPerson.presence) throw new Error(`The new author entry copied presence information: ${JSON.stringify(unifiedPerson)}`);

  let libreOfficeAvailable = true;
  try {
    await fs.access("/usr/bin/libreoffice");
  } catch (error) {
    if (error?.code === "ENOENT") libreOfficeAvailable = false;
    else throw error;
  }
  if (libreOfficeAvailable) {
    const validationDirectory = path.join(path.dirname(trackedPath), "libreoffice-unified-validation");
    const profileDirectory = path.join(path.dirname(trackedPath), "libreoffice-unified-profile");
    await fs.mkdir(validationDirectory, { recursive: true });
    await runExecutable("/usr/bin/libreoffice", ["--headless", `-env:UserInstallation=file://${profileDirectory}`, "--convert-to", "pdf", "--outdir", validationDirectory, trackedPath]);
    await fs.access(path.join(validationDirectory, `${path.basename(trackedPath, ".docx")}.pdf`));
  }
}

function personIdentity(xml, author) {
  const person = Array.from(xml.matchAll(/<w15:person\b([^>]*)(?:\/>|>([\s\S]*?)<\/w15:person>)/g))
    .find((match) => match[1].includes(`w15:author="${author}"`));
  if (!person) return null;
  const presence = person[2]?.match(/<w15:presenceInfo\b([^>]*)\/>/);
  return {
    author,
    presence: presence ? Object.fromEntries(Array.from(presence[1].matchAll(/w15:([^=\s]+)="([^"]*)"/g), (match) => [match[1], match[2]])) : null,
  };
}

function assertTrackedDocumentStructure(documentXml, commentsXml, numberingXml) {
  const revisionIds = Array.from(documentXml.matchAll(/<w:(?:ins|del|moveFrom|moveTo|rPrChange|pPrChange|tblPrChange|trPrChange|tcPrChange|sectPrChange|cellIns|cellDel)\b[^>]*w:id="([^"]+)"/g), (match) => match[1]);
  if (new Set(revisionIds).size !== revisionIds.length) {
    throw new Error("Tracked DOCX contains duplicate revision IDs.");
  }

  const commentIds = Array.from(commentsXml.matchAll(/<w:comment\b[^>]*w:id="([^"]+)"/g), (match) => match[1]);
  for (const commentId of commentIds) {
    const escapedId = commentId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const marker of ["commentRangeStart", "commentRangeEnd", "commentReference"]) {
      const matches = documentXml.match(new RegExp(`<w:${marker}\\b[^>]*w:id="${escapedId}"`, "g")) || [];
      if (matches.length !== 1) throw new Error(`Comment ${commentId} has ${matches.length} ${marker} anchors.`);
    }
  }

  const numberingChildren = Array.from(numberingXml.matchAll(/<w:(abstractNum|num|numIdMacAtCleanup)\b/g), (match) => match[1]);
  const firstNumber = numberingChildren.indexOf("num");
  const firstCleanup = numberingChildren.indexOf("numIdMacAtCleanup");
  if (firstNumber >= 0 && numberingChildren.slice(firstNumber).includes("abstractNum")) {
    throw new Error("numbering.xml places abstractNum after num.");
  }
  if (firstCleanup >= 0 && firstCleanup !== numberingChildren.length - 1) {
    throw new Error("numbering.xml cleanup marker is not the final child.");
  }

  const contentControlIndex = documentXml.indexOf("<w:sdt>");
  const unchangedParagraphIndex = documentXml.indexOf("변경 없는 문단입니다.");
  const tableIndex = documentXml.indexOf("<w:tbl>");
  if (contentControlIndex < 0 || !(contentControlIndex < unchangedParagraphIndex && unchangedParagraphIndex < tableIndex)) {
    throw new Error("A body content control moved away from its original document position.");
  }
}

function runExecutable(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 30_000 }, (error, stdout, stderr) => {
      if (error) reject(new Error(`${error.message}\n${stdout}\n${stderr}`));
      else resolve();
    });
  });
}

function assertRevisionOutcome(label, trackedXml, expectedXml, action, substitutions = [], targetAuthor = "Worklazy Tools") {
  const actual = trackedTextAfterAction(trackedXml, action, targetAuthor);
  const expected = substitutions.reduce(
    (value, [before, after]) => value.replace(before, after),
    xmlText(expectedXml),
  );
  if (actual !== expected) throw new Error(`${label} does not reproduce its source.\nactual=${actual}\nexpected=${expected}`);
}

function trackedTextAfterAction(xml, action, targetAuthor = "Worklazy Tools") {
  let result = xml;
  const unwanted = action === "accept" ? "del" : "ins";
  const unwantedCell = action === "accept" ? "cellDel" : "cellIns";
  result = result.replace(new RegExp(`<w:tr\\b(?:(?!<\\/w:tr>)[\\s\\S])*?<w:${unwanted}\\b(?=[^>]*w:author="${targetAuthor}")[^>]*/>(?:(?!<\\/w:tr>)[\\s\\S])*?<\\/w:tr>`, "g"), "");
  result = result.replace(new RegExp(`<w:tc\\b(?:(?!<\\/w:tc>)[\\s\\S])*?<w:${unwantedCell}\\b(?=[^>]*w:author="${targetAuthor}")[^>]*/>(?:(?!<\\/w:tc>)[\\s\\S])*?<\\/w:tc>`, "g"), "");
  result = result.replace(new RegExp(`<w:${unwanted}\\b(?=[^>]*w:author="${targetAuthor}")(?![^>]*\\/>)[^>]*>[\\s\\S]*?<\\/w:${unwanted}>`, "g"), "");
  return xmlText(result);
}

function xmlText(xml) {
  return Array.from(xml.matchAll(/<w:(?:t|delText)\b[^>]*>([\s\S]*?)<\/w:(?:t|delText)>/g), (match) => decodeXml(match[1])).join("");
}

function decodeXml(value) {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}
