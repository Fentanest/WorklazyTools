#!/usr/bin/env node
// IndexNow URL submission for worklazy.net.
//
// Reads the deployed sitemap (file or URL), builds the IndexNow JSON payload
// and POSTs it to the IndexNow endpoint. Only public canonical URLs are ever
// sent (the sitemap holds exactly those; see generate-static-pages.mjs).
//
// Usage:
//   node scripts/submit-indexnow.mjs --dry-run [--sitemap <path-or-url>] [--endpoint <url>]
//   node scripts/submit-indexnow.mjs --live     [--sitemap <path-or-url>] [--endpoint <url>]
//
// Default endpoint is https://api.indexnow.org/indexnow. Per the official
// protocol documentation (https://www.indexnow.org/documentation, confirmed
// 2026-11-02), participating search engines (Bing, Naver, Yandex, Seznam,
// Yep) share received URLs with each other, and Naver's own endpoint
// (https://searchadvisor.naver.com/indexnow, listed in
// https://www.indexnow.org/searchengines.json with "unsubscribe": false)
// receives the same submissions through that sharing. One POST therefore
// covers Naver without a Naver-specific lock-in. Google does not use IndexNow.
//
// Exit codes: 0 on success or dry-run; 1 on submission/validation failure.
// The deploy workflow calls --live with continue-on-error so a failure never
// fails the deployment.
import fs from "node:fs/promises";
import path from "node:path";

const SITE_HOST = "worklazy.net";
const SITE_URL = "https://worklazy.net/";
const INDEXNOW_KEY_FILE = "2411577b873469cc87b1f4e841f50092.txt";
const DEFAULT_ENDPOINT = "https://api.indexnow.org/indexnow";
const DEFAULT_SITEMAP = "https://worklazy.net/sitemap.xml";
const FETCH_TIMEOUT_MS = 15_000;

function parseArgs(argv) {
  const options = { mode: "dry-run", endpoint: DEFAULT_ENDPOINT, sitemap: DEFAULT_SITEMAP };
  for (let index = 2; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--live") options.mode = "live";
    else if (argument === "--dry-run") options.mode = "dry-run";
    else if (argument === "--endpoint") options.endpoint = argv[(index += 1)];
    else if (argument === "--sitemap") options.sitemap = argv[(index += 1)];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.endpoint || !options.sitemap) throw new Error("Missing --endpoint or --sitemap value.");
  return options;
}

async function readSitemapXml(source) {
  if (/^https?:\/\//.test(source)) {
    const response = await fetch(source, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`Failed to fetch sitemap ${source}: HTTP ${response.status}`);
    return response.text();
  }
  return fs.readFile(path.resolve(source), "utf8");
}

function extractLocs(sitemapXml) {
  const locs = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
  const unique = [...new Set(locs)];
  for (const loc of unique) {
    const url = new URL(loc);
    if (url.host !== SITE_HOST) throw new Error(`Sitemap loc outside ${SITE_HOST}: ${loc}`);
  }
  if (unique.length === 0) throw new Error("Sitemap contains no <loc> entries.");
  return unique.sort();
}

async function main() {
  const options = parseArgs(process.argv);
  const key = (await fs.readFile(path.resolve(`public/${INDEXNOW_KEY_FILE}`), "utf8")).trim();
  if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) throw new Error("IndexNow key file has an invalid format.");
  const sitemapXml = await readSitemapXml(options.sitemap);
  const urlList = extractLocs(sitemapXml);
  const keyLocation = new URL(INDEXNOW_KEY_FILE, SITE_URL).href;
  const payload = { host: SITE_HOST, key, keyLocation, urlList };

  console.log(`IndexNow ${options.mode}: endpoint=${options.endpoint}`);
  console.log(`host=${payload.host}`);
  console.log(`key=${payload.key}`);
  console.log(`keyLocation=${payload.keyLocation}`);
  console.log(`urlList=${payload.urlList.length} urls (first=${payload.urlList[0]}, last=${payload.urlList[payload.urlList.length - 1]})`);

  if (options.mode === "dry-run") {
    console.log("dry-run: no request sent.");
    return;
  }

  // No retry: at most one attempt, bounded by FETCH_TIMEOUT_MS.
  const response = await fetch(options.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  console.log(`IndexNow response: HTTP ${response.status}`);
  if (response.status !== 200 && response.status !== 202) {
    throw new Error(`IndexNow submission failed with HTTP ${response.status}.`);
  }
}

try {
  await main();
} catch (error) {
  console.error(`submit-indexnow: ${error.message}`);
  process.exit(1);
}
