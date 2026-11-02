// Headerless hosting is intentional: preview's COEP headers hide this regression.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import ExcelJS from "exceljs";
import { chromium } from "playwright";
import { startRecoveryServer } from "./recovery-server.mjs";

let server, browser, fixture;
before(async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Synthetic");
  sheet.getCell("A1").value = 7;
  sheet.getCell("A2").value = 11;
  sheet.getCell("A3").value = { formula: "SUM(A1:A2)", result: 18 };
  fixture = Buffer.from(await workbook.xlsx.writeBuffer());
  server = await startRecoveryServer();
  const response = await fetch(`${server.url}/en/tools/excel-merger/xls-preserve/`);
  assert.equal(response.status, 200);
  for (const header of ["cross-origin-embedder-policy", "cross-origin-opener-policy", "cross-origin-resource-policy"]) {
    assert.equal(response.headers.get(header), null, "the static host must not inject isolation headers");
  }
  browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
});
after(async () => { await browser?.close(); await server?.close(); });

for (const scenario of ["fresh direct", "returning document scope", "root controller", "ordinary merger"]) {
  test(`XLSX inspection and merge on headerless host: ${scenario}`, async () => {
    const context = await browser.newContext();
    // Fence provider scripts without intercepting same-origin requests or
    // changing HTTP cache behavior.
    const cdp = await context.newCDPSession(await context.newPage());
    await cdp.send("Network.enable");
    await cdp.send("Network.setBlockedURLs", { urls: ["*googletagmanager.com*", "*googlesyndication.com*", "*pstatic.net*", "*coupang.com*"] });
    await context.addInitScript(({ siteOrigin }) => {
      if (location.origin !== siteOrigin) return;
      window.__WORKLAZY_MOCK_PROVIDERS__ = true;
      const timeline = JSON.parse(sessionStorage.getItem("xls-worker-timeline") || "[]");
      timeline.push({ path: location.pathname, isolated: crossOriginIsolated, controlled: Boolean(navigator.serviceWorker.controller) });
      sessionStorage.setItem("xls-worker-timeline", JSON.stringify(timeline));
    }, { siteOrigin: server.url });
    const page = context.pages()[0];
    page.setDefaultTimeout(60_000);
    const errors = [], failures = [], workers = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("requestfailed", request => {
      if (new URL(request.url()).origin === server.url) failures.push({ url: request.url(), error: request.failure() });
    });
    page.on("worker", worker => workers.push(worker.url()));
    page.on("dialog", dialog => dialog.accept());
    try {
      if (scenario === "root controller") {
        await page.goto(`${server.url}/en/tools/excel-merger/`);
        await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.endsWith("/service-worker.js"));
      }
      const route = scenario === "ordinary merger" ? "/en/tools/excel-merger/" : "/en/tools/excel-merger/xls-preserve/";
      const offset = server.state.requests.length;
      await page.goto(server.url + route, { waitUntil: "domcontentloaded" });
      await page.locator('input[type="file"]').first().waitFor();
      if (scenario !== "ordinary merger") await page.waitForFunction(() => crossOriginIsolated);
      if (scenario === "returning document scope") {
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.locator('input[type="file"]').first().waitFor();
      }
      const state = await page.evaluate(async () => ({
        isolated: crossOriginIsolated,
        controller: navigator.serviceWorker.controller?.scriptURL || "",
        registrations: (await navigator.serviceWorker.getRegistrations()).map(r => r.scope),
        timeline: JSON.parse(sessionStorage.getItem("xls-worker-timeline") || "[]"),
      }));
      console.log(JSON.stringify({ scenario, state }));
      assert.equal(state.isolated, scenario !== "ordinary merger");
      if (scenario.startsWith("fresh") || scenario.startsWith("returning")) {
        assert.ok(state.controller.endsWith("/xls-preserve/coi-serviceworker.js"));
        assert.equal(state.registrations.length, 1, "fresh direct entry must not rely on a root SW");
        assert.equal(state.timeline[0].controlled, false, "first document is genuinely uncontrolled");
        assert.equal(state.timeline[0].isolated, false);
      }
      if (scenario === "fresh direct") {
        assert.equal(server.state.requests.slice(offset).filter(r => r.pathname === route).length, 2, "one automatic preparation reload");
      }
      if (scenario === "root controller") assert.ok(state.controller.endsWith("/service-worker.js"));
      await page.locator('input[type="file"]').first().setInputFiles({ name: "synthetic.xlsx", buffer: fixture, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      await page.waitForFunction(() => document.querySelector('[data-testid=excel-file-status]:not([data-state=checking])'));
      assert.equal(await page.locator('[data-testid=excel-file-status][data-state=ready]').count(), 1,
        await page.locator('[data-testid=excel-file-item]').innerText());
      await page.locator(':is(.summary-card,[data-testid=excel-merge-summary]) [data-ui-component=primary-button]').click();
      const link = page.locator(':is(.result-download,[data-testid=excel-result-download])');
      await link.waitFor();
      const bytes = await link.evaluate(async element => Array.from(new Uint8Array(await (await fetch(element.href)).arrayBuffer())));
      const merged = new ExcelJS.Workbook();
      await merged.xlsx.load(Buffer.from(bytes));
      assert.equal(merged.worksheets.length, 1);
      assert.equal(merged.worksheets[0].getCell("A1").value, 7);
      assert.equal(merged.worksheets[0].getCell("A2").value, 11);
      assert.equal(merged.worksheets[0].getCell("A3").value.result, 18);
      assert.match(merged.worksheets[0].getCell("A3").value.formula, /SUM/);
      assert.equal(workers.length, 2, "inspection and merge each use an actual worker");
      assert.deepEqual(errors, []);
      assert.deepEqual(failures, []);
      console.log(JSON.stringify({ scenario, state, workers, workerRequests: server.state.requests.slice(offset).filter(r => r.pathname.includes("excel.worker")) }));
    } finally { console.log(JSON.stringify({ scenario, errors, failures, workers })); await context.close(); }
  });
}
