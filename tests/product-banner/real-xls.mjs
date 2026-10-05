import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { startRecoveryServer } from "../recovery-server.mjs";

// Never print caught exceptions: browser errors can contain sensitive arguments.
const sha = (value) => createHash("sha256").update(value).digest("hex");
const check = (ok, label) => { if (!ok) throw new Error(label); };
const root = process.env.PB_JOB_ROOT;
const network = process.argv.includes("--images");
const result = { mode: network ? "real-image-network" : "real-xls-ui", comparisons: [], affiliateAttempts: 0, affiliateSent: 0, consoleEvents: 0, pageErrors: 0, network: {} };
let context, server, stage = "input", tokens = [], failed = false;
try {
  check(root, "job root missing");
  const bytes = await readFile(process.env.PRODUCT_BANNER_REAL_SAMPLE || "");
  const expected = JSON.parse(await readFile(process.env.PRODUCT_BANNER_REAL_EXPECTED || "", "utf8"));
  check(sha(bytes) === expected.file_sha256, "input hash mismatch");
  result.fileSha = sha(bytes).slice(0, 12);
  const XLSX = createRequire(import.meta.url)("xlsx");
  const book = XLSX.read(bytes, { type: "buffer" });
  const source = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: "" });
  check(source.length === 3 && expected.rows.length === 3, "input count mismatch");
  const wanted = source.map((row, i) => {
    const image = String(row["Image Url"]).trim(), link = String(row["Promotion Url"]).trim();
    check(image === expected.rows[i].image && link === expected.rows[i].link, "expected source mismatch");
    check(sha(link) === expected.rows[i].link_sha256, "expected hash mismatch");
    return { image, link };
  });
  tokens = source.flatMap((row) => [String(row["Image Url"]), String(row["Promotion Url"]), String(row["Product Desc"]) ]).filter(Boolean);
  check(new Set(wanted.map((r) => r.image)).size === 3 && new Set(wanted.map((r) => r.link)).size === 3, "distinct count mismatch");
  const affiliates = new Set(wanted.map((r) => new URL(r.link).hostname));
  const images = new Set(wanted.map((r) => r.image));
  stage = "build";
  const ready = JSON.parse(await readFile(`${root}/build-ready.json`, "utf8"));
  for (const [name, hash] of Object.entries(ready.hashes)) check(sha(await readFile(`${ready.outDir}/assets/${name}`)) === hash, "build changed");
  server = await startRecoveryServer({ root: ready.outDir, port: 0 });
  context = await chromium.launchPersistentContext(`${root}/profiles/real-${network ? "images" : "ui"}-${Date.now()}`, {
    headless: true, acceptDownloads: false,
  });
  // Playwright's block option reads navigator.serviceWorker in opaque srcdoc
  // frames and itself throws SecurityError. Disable registration only in the
  // same-origin top document, leaving sandbox checks and exports intact.
  await context.addInitScript(() => {
    if (window === window.top && /^https?:$/u.test(location.protocol) && "serviceWorker" in navigator)
      navigator.serviceWorker.register = async () => { throw new Error("QA worker disabled"); };
  });
  let allowImages = false;
  const imageRequests = new Set();
  const image = await readFile(new URL("../fixtures/product-banner/local-image.svg", import.meta.url));
  await context.route("**/*", (route) => {
    const request = route.request(), url = new URL(request.url());
    if (affiliates.has(url.hostname)) { result.affiliateAttempts++; return route.abort(); }
    if (url.origin === server.url) {
      if (url.pathname === "/t6a-host") return route.fulfill({ body: "<!doctype html><html><body></body></html>", contentType: "text/html" });
      return route.continue();
    }
    if (request.resourceType() === "image" && images.has(request.url())) {
      if (allowImages && !imageRequests.has(request.url())) { imageRequests.add(request.url()); return route.continue(); }
      if (allowImages) return route.abort();
      return route.fulfill({ body: image, contentType: "image/svg+xml", headers: { "cross-origin-resource-policy": "cross-origin" } });
    }
    return route.abort();
  });
  context.on("page", (page) => {
    page.on("console", () => result.consoleEvents++);
    page.on("pageerror", () => result.pageErrors++);
    page.on("requestfailed", (request) => {
      if (!allowImages || request.resourceType() !== "image") return;
      const host = new URL(request.url()).hostname;
      const message = request.failure()?.errorText || "";
      const policy = /ORB/iu.test(message) ? "ORB" : /COEP/iu.test(message) ? "COEP" : /CORP/iu.test(message) ? "CORP" : "host-or-network";
      const key = `${host} ${policy}`; result.network[key] = (result.network[key] || 0) + 1;
    });
    page.on("response", (response) => {
      if (!allowImages || response.request().resourceType() !== "image") return;
      const key = `${new URL(response.url()).hostname} status=${response.status()}`;
      result.network[key] = (result.network[key] || 0) + 1;
    });
  });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  // Capture actual UI save Blobs in memory, suppressing file downloads entirely.
  await page.addInitScript(() => {
    window.__WORKLAZY_MOCK_PROVIDERS__ = true;
    const original = URL.createObjectURL.bind(URL), blobs = new Map();
    URL.createObjectURL = (blob) => { const url = original(blob); blobs.set(url, blob); return url; };
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download && blobs.has(this.href)) { window.__savedBlob = blobs.get(this.href).text(); return; }
      return click.call(this);
    };
  });
  stage = "import";
  await page.goto(`${server.url}/en/tools/product-banner/`);
  await page.locator('[data-tool-page="product-banner"]').waitFor();
  await page.locator('input[accept=".xls,.xlsx,.csv"]').setInputFiles({ name: "local-sample.xls", mimeType: "application/vnd.ms-excel", buffer: bytes });
  await page.getByText("Review column mapping", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Import products in selected order", exact: true }).click();
  await page.locator('[data-testid="banner-product"]').nth(2).waitFor();
  check(await page.locator('[data-testid="banner-product"]').count() === 3, "UI count mismatch");
  function compare(actual, id) {
    check(actual.length === 3, `${id} count mismatch`);
    const rows = actual.map((row, i) => {
      const imageMatch = typeof row.image === "string" && sha(row.image) === sha(wanted[i].image);
      const linkMatch = typeof row.link === "string" && sha(row.link) === sha(wanted[i].link);
      check(!row.links || row.links.every((link) => sha(link) === sha(wanted[i].link)), `${id} sibling link sha mismatch`);
      check(imageMatch && linkMatch, `${id} row#${i + 1} sha mismatch`);
      return { index: i + 1, imageMatch, linkMatch, imageSha: sha(row.image).slice(0, 12), linkSha: sha(row.link).slice(0, 12) };
    });
    result.comparisons.push({ id, count: rows.length, rows });
  }
  compare(await page.locator('[data-testid="banner-product"]').evaluateAll((rows) => rows.map((row) => ({
    image: row.querySelectorAll('input:not([type="checkbox"])')[1].value,
    link: row.querySelectorAll('input:not([type="checkbox"])')[2].value,
  }))), "import");
  const outputPage = await context.newPage();
  async function inspect(document, iframe, id) {
    await outputPage.goto(`${server.url}/t6a-host`);
    await outputPage.setContent(document);
    let frame = outputPage.mainFrame();
    if (iframe) frame = await (await outputPage.locator("iframe[data-wlpb-frame]").elementHandle()).contentFrame();
    await frame.locator("[data-wlpb-ready]").waitFor();
    compare(await frame.locator("[data-wlpb-index]").evaluateAll((rows) => rows.map((row) => ({
      image: row.querySelector("img").getAttribute("src"), link: row.querySelector("a").getAttribute("href"),
      links: [...row.querySelectorAll("a")].map((a) => a.getAttribute("href")),
    }))), id);
  }
  stage = "outputs";
  for (const design of ["photo-strip", "product-card", "slim", "vertical", "grid"]) {
    await page.getByLabel("Design", { exact: true }).selectOption(design);
    for (const format of ["html", "iframe"]) {
      await page.getByLabel("Preview", { exact: true }).selectOption(format);
      const code = await page.getByLabel("Export code", { exact: true }).inputValue();
      await inspect(`<!doctype html><html><body>${code}</body></html>`, format === "iframe", `${design}-${format}`);
    }
  }
  async function save(label) {
    await page.evaluate(() => { window.__savedBlob = null; });
    await page.getByRole("button", { name: label, exact: true }).click();
    return page.evaluate(() => window.__savedBlob);
  }
  const standalone = await save("Save HTML file");
  await inspect(standalone, false, "standalone");
  const saved = JSON.parse(await save("Save editing file"));
  compare(saved.products.map((row) => ({ image: row.imageUrl, link: row.promotionUrl })), "json");
  check(result.comparisons.length === 13, "comparison count mismatch");
  if (network) {
    stage = "images";
    await page.close(); await outputPage.close();
    const probe = await context.newPage();
    await probe.goto(`${server.url}/t6a-host`);
    // Static server has no Vite COEP header; this is the production-like control.
    const headers = (await probe.request.get(`${server.url}/en/tools/product-banner/`)).headers();
    check(!headers["cross-origin-embedder-policy"], "unexpected server COEP");
    allowImages = true;
    await probe.setContent(`<!doctype html><body>${wanted.map((r) => `<img src="${r.image.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}">`).join("")}</body>`);
    await probe.waitForFunction(() => [...document.images].every((img) => img.complete), undefined, { timeout: 15000 }).catch(() => {});
    result.images = await probe.locator("img").evaluateAll((items) => ({ count: items.length, loaded: items.filter((img) => img.complete && img.naturalWidth > 0).length }));
    result.imageRequests = imageRequests.size;
    if (result.images.loaded !== 3) { failed = true; result.status = "NETWORK_FAILURE"; }
  }
  check(result.affiliateAttempts === 0 && result.affiliateSent === 0, "affiliate attempt forbidden");
  check(context.serviceWorkers().length === 0, "unexpected service worker");
  check(result.pageErrors === 0, "page errors detected");
} catch {
  failed = true;
  result.status = stage === "input" ? "NOT_RUN" : "FAIL";
  result.stage = stage;
} finally {
  await context?.close().catch(() => { failed = true; });
  await server?.close().catch(() => { failed = true; });
}
// Scan owned textual logs by comparing in memory; no grep pattern or raw match output.
async function scan(dir) {
  let leaks = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory() && !["profiles", "dist", "cache", "tmp"].includes(entry.name)) leaks += await scan(file);
    else if (entry.isFile() && /\.(log|json|jsonl|trace)$/u.test(entry.name)) {
      const text = await readFile(file, "utf8");
      leaks += tokens.filter((token) => text.includes(token)).length;
    }
  }
  return leaks;
}
if (root) {
  result.rawLogMatches = await scan(root);
  if (result.rawLogMatches) failed = true;
  result.status ||= failed ? "FAIL" : "PASS";
  const report = network ? Object.fromEntries(Object.entries(result).filter(([key]) => !["comparisons", "fileSha"].includes(key))) : result;
  const text = JSON.stringify(report, null, 2);
  if (tokens.some((token) => text.includes(token))) { failed = true; console.log("FAIL sanitized output check"); }
  else { await writeFile(`${root}/logs/real-${network ? "images" : "ui"}-${Date.now()}.json`, text); console.log(text); }
}
console.log(`# tests ${result.status === "NOT_RUN" ? 0 : 1}\n# pass ${failed ? 0 : 1}\n# fail ${failed ? 1 : 0}`);
process.exitCode = failed ? 1 : 0;
