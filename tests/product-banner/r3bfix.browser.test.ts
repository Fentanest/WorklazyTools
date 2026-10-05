import test, { before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import { stateWith } from "../fixtures/product-banner/state.ts";
import { saveProjectJson } from "../../src/features/product-banner/projectJson.ts";
import { uiMessages } from "../../src/features/product-banner/uiMessages.ts";
import { startRecoveryServer } from "../recovery-server.mjs";

const root = process.env.PB_R3BFIX_ROOT!;
const run = process.env.PB_R3BFIX_RUN!;
const text = uiMessages.en;
let context: BrowserContext, server: Awaited<ReturnType<typeof startRecoveryServer>>;
const pages = new Set<Page>(), results: object[] = [];
let externalRequests = 0;
before(async () => {
  assert.ok(root === process.env.PB_JOB_ROOT || root?.endsWith("/work/tmp/R3bfix"));
  assert.equal(process.env.TMPDIR, `${root}/tmp`);
  assert.match(run, /^[a-z0-9-]+$/u);
  const ready = JSON.parse(await readFile(`${root}/build-ready.json`, "utf8"));
  for (const [name, hash] of Object.entries(ready.hashes)) {
    assert.equal(createHash("sha256").update(await readFile(path.join(ready.outDir, "assets", name))).digest("hex"), hash);
  }
  await mkdir(`${root}/shots-${run}`);
  await mkdir(`${root}/profiles/${run}`);
  server = await startRecoveryServer({ root: ready.outDir, port: 0 });
  context = await chromium.launchPersistentContext(`${root}/profiles/${run}`, {
    headless: true, args: ["--no-sandbox"], downloadsPath: `${root}/tmp`, viewport: { width: 1440, height: 1000 },
  });
  console.log(`Completed build ${ready.completedAt}; installed Chromium ${context.browser()!.version()}; server ${server.url}`);
});
afterEach(async () => { for (const page of pages) await page.close(); pages.clear(); });
after(async () => {
  await context?.close(); await server?.close();
  await writeFile(`${root}/shots-${run}/RESULTS.json`, JSON.stringify({ results, externalRequestsSent: 0, externalRequestsBlocked: externalRequests }, null, 2));
});
async function open() {
  const page = await context.newPage(); pages.add(page); page.setDefaultTimeout(6000);
  await page.addInitScript(() => { (window as any).__WORKLAZY_MOCK_PROVIDERS__ = true; });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === server.url || !/^https?:$/u.test(url.protocol)) return route.continue();
    externalRequests++; return route.abort();
  });
  await page.goto(`${server.url}/en/tools/product-banner/`);
  await page.locator('[data-tool-page="product-banner"]').waitFor();
  // Hold real File.text promises without replacing the file contents or React handlers.
  await page.evaluate(() => {
    const w = window as any, original = File.prototype.text;
    w.__reads = { held: {}, started: [], settled: [], confirmations: [], approve: true };
    window.confirm = (message) => { w.__reads.confirmations.push(message); return w.__reads.approve; };
    File.prototype.text = function () {
      const file = this;
      w.__reads.started.push(file.name);
      const reading = file.name.startsWith("held-")
        ? new Promise<string>((resolve, reject) => { w.__reads.held[file.name] = async (fail: boolean) => fail ? reject(new Error("synthetic read failure")) : resolve(await original.call(file)); })
        : original.call(file);
      return reading.finally(() => w.__reads.settled.push(file.name));
    };
  });
  return page;
}
const names = (page: Page) => page.getByLabel(text.fields.name, { exact: true });
async function expectName(page: Page, name: string) { await page.waitForFunction((name) => [...document.querySelectorAll<HTMLInputElement>("input")].some((input) => input.value === name), name); }
async function choose(page: Page, name: string, fileName = `${name}.json`) {
  const project = stateWith(1).project; project.products[0].name = name;
  await page.locator('input[accept=".json"]').setInputFiles({ name: fileName, mimeType: "application/json", buffer: Buffer.from(saveProjectJson(project)) });
  await page.waitForFunction((name) => (window as any).__reads.started.includes(name), fileName);
}
async function release(page: Page, fileName: string, fail = false) {
  await page.evaluate(async ({ fileName, fail }) => {
    await (window as any).__reads.held[fileName](fail);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }, { fileName, fail });
  await page.waitForFunction((name) => (window as any).__reads.settled.includes(name), fileName);
}
async function confirmations(page: Page) { return page.evaluate(() => (window as any).__reads.confirmations.length); }
async function approve(page: Page, value: boolean) { await page.evaluate((value) => { (window as any).__reads.approve = value; }, value); }
async function record(page: Page, id: string) {
  const capture = `${id}.png`; await page.screenshot({ path: `${root}/shots-${run}/${capture}` });
  const hash = createHash("sha256").update(await readFile(`${root}/shots-${run}/${capture}`)).digest("hex");
  results.push({ id, names: await names(page).evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value)), confirmations: await confirmations(page), capture, sha256: hash });
}

test("R3bfix JSON reverse completion preserves B and subsequent edit C", async () => {
  const page = await open();
  await choose(page, "Older request A", "held-a.json");
  await choose(page, "Latest request B"); await expectName(page, "Latest request B");
  await names(page).fill("New unsaved edit C");
  await release(page, "held-a.json");
  assert.equal(await names(page).inputValue(), "New unsaved edit C");
  assert.equal(await confirmations(page), 0);
  await record(page, "reverse-completion");
});
test("R3bfix JSON edit during a read expires its initial replacement approval", async () => {
  const page = await open(); await choose(page, "Original"); await expectName(page, "Original");
  await choose(page, "Old replacement", "held-edit.json"); assert.equal(await confirmations(page), 1);
  await names(page).fill("Keep this edit"); await release(page, "held-edit.json");
  assert.equal(await names(page).inputValue(), "Keep this edit");
  assert.equal(await confirmations(page), 1);
  await record(page, "edit-during-read");
});
test("R3bfix JSON read guards route exit and cannot affect a remounted editor", async () => {
  const page = await open(); await choose(page, "Departed request", "held-leave.json");
  await page.getByRole("link", { name: "All tools", exact: true }).first().click();
  await page.getByTestId("unsaved-work-dialog").waitFor({ state: "visible" });
  await page.getByTestId("unsaved-stay").click();
  assert.match(page.url(), /\/tools\/product-banner\/$/u);
  await page.getByRole("link", { name: "All tools", exact: true }).first().click();
  await page.getByTestId("unsaved-leave").click(); await page.waitForURL(/\/en\/tools\/?$/u);
  await page.getByRole("link", { name: /Product Banner Builder/u }).first().click();
  await page.locator('[data-tool-page="product-banner"]').waitFor();
  await choose(page, "New editor"); await expectName(page, "New editor");
  await release(page, "held-leave.json");
  assert.equal(await names(page).inputValue(), "New editor"); assert.equal(await confirmations(page), 0);
  await record(page, "route-exit");
});
test("R3bfix JSON normal single read retains decline and approval confirmations", async () => {
  const page = await open(); await choose(page, "Original"); await expectName(page, "Original");
  await approve(page, false);
  await page.locator('input[accept=".json"]').setInputFiles({ name: "declined.json", mimeType: "application/json", buffer: Buffer.from(saveProjectJson(stateWith(1).project)) });
  assert.equal(await confirmations(page), 1); assert.equal(await names(page).inputValue(), "Original");
  assert.equal(await page.evaluate(() => (window as any).__reads.started.includes("declined.json")), false);
  await approve(page, true); await choose(page, "Accepted", "held-normal.json");
  await release(page, "held-normal.json"); await expectName(page, "Accepted");
  assert.equal(await confirmations(page), 2); await record(page, "normal-confirmation");
});
test("R3bfix JSON newer pending request survives older completion and stale rejection", async () => {
  const page = await open();
  await choose(page, "Older A", "held-old.json"); await choose(page, "Newer B", "held-new.json");
  await release(page, "held-old.json"); assert.equal(await names(page).count(), 0);
  await release(page, "held-new.json"); await expectName(page, "Newer B");
  await choose(page, "Stale error", "held-error.json");
  await choose(page, "Fresh C"); await expectName(page, "Fresh C");
  await release(page, "held-error.json", true);
  assert.equal(await names(page).inputValue(), "Fresh C");
  assert.equal(await page.getByText(text.jsonError, { exact: true }).count(), 0);
  await record(page, "stale-completion-and-error");
});

test("R3bfix Worker replacement uses current work after delayed extraction", async () => {
  const page = await open();
  await page.getByRole("combobox", { name: text.import, exact: true }).selectOption("replace");
  await page.locator('input[accept=".xls,.xlsx,.csv"]').setInputFiles({ name: "synthetic.csv", mimeType: "text/csv", buffer: Buffer.from("Image Url,Promotion Url,Product Desc\nhttps://example.com/img/a.png,https://example.com/p/a,Worker result") });
  const button = page.getByRole("button", { name: text.confirmImport, exact: true }); await button.waitFor();
  // Intercept only the extraction Worker result. Inspection used the real Worker already.
  await page.evaluate(() => {
    const w = window as any, Original = Worker;
    w.__workerRelease = null;
    w.Worker = class extends Original {
      set onmessage(listener: ((event: MessageEvent) => void) | null) {
        super.onmessage = listener ? (event: MessageEvent) => {
          if (event.data.type === "result") w.__workerRelease = () => listener.call(this, event);
          else listener.call(this, event);
        } : null;
      }
    };
  });
  await button.click(); await page.waitForFunction(() => !!(window as any).__workerRelease);
  await page.getByLabel(text.width, { exact: true }).fill("480");
  await approve(page, false); await page.evaluate(() => (window as any).__workerRelease());
  await button.waitFor({ state: "visible" });
  assert.equal(await confirmations(page), 1); assert.equal(await names(page).count(), 0);
  assert.equal(await page.getByLabel(text.width, { exact: true }).inputValue(), "480");
  // The rejected import remains selectable and a second approved extraction succeeds.
  await approve(page, true); await page.evaluate(() => { (window as any).__workerRelease = null; });
  await button.click(); await page.waitForFunction(() => !!(window as any).__workerRelease);
  await page.evaluate(() => (window as any).__workerRelease()); await expectName(page, "Worker result");
  assert.equal(await confirmations(page), 2); await record(page, "worker-current-confirmation");
});
