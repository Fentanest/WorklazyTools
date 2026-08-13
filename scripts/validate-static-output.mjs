import fs from "node:fs/promises";
import path from "node:path";

const routes = [
  "", "tools", "tools/excel-merger", "tools/word-compare",
  "tools/pdf-editor", "tools/pdf-editor/image-to-pdf",
  "tools/pdf-editor/pdf-to-image", "tools/pdf-editor/convert",
  "tools/hwp-editor", "tools/hwp-compare", "tools/video-studio", "tools/image-studio",
  "about", "privacy", "terms", "contact", "licenses",
];

for (const route of routes) {
  const filePath = path.join("dist", route, "index.html");
  const html = await fs.readFile(filePath, "utf8");
  const required = [
    "<title>",
    'name="description"',
    'rel="canonical"',
    'property="og:title"',
    'type="application/ld+json"',
    'class="seo-static-fallback"',
    'name="google-adsense-account"',
  ];
  for (const marker of required) {
    if (!html.includes(marker)) throw new Error(`${filePath} is missing ${marker}`);
  }
  if (html.includes("#/")) throw new Error(`${filePath} still contains a hash route.`);
}

const [ads, robots, sitemap] = await Promise.all([
  fs.readFile("dist/ads.txt", "utf8"),
  fs.readFile("dist/robots.txt", "utf8"),
  fs.readFile("dist/sitemap.xml", "utf8"),
]);

const [cname, worklazyLicense, thirdPartyLicenses, favicon, logo] = await Promise.all([
  fs.readFile("dist/CNAME", "utf8"),
  fs.readFile("dist/legal/worklazy-license.txt", "utf8"),
  fs.readFile("dist/legal/third-party-licenses.txt", "utf8"),
  fs.readFile("dist/icon.svg", "utf8"),
  fs.readFile("dist/logo.svg", "utf8"),
]);

if (!ads.includes("pub-8940087269746960")) throw new Error("ads.txt publisher ID is missing.");
if (cname.trim() !== "worklazy.net") throw new Error("CNAME does not point to worklazy.net.");
if (!worklazyLicense.includes("All rights reserved")) throw new Error("Worklazy proprietary license is missing.");
if (!thirdPartyLicenses.includes("@ffmpeg/core") || !thirdPartyLicenses.includes("@rhwp/core")) throw new Error("Third-party license bundle is incomplete.");
if (!favicon.includes("facet-4") || !logo.includes("Worklazy")) throw new Error("Worklazy favicon or logo is missing from the build.");
if (!robots.includes("Sitemap:")) throw new Error("robots.txt does not point to the sitemap.");
if (!robots.includes("https://worklazy.net/sitemap.xml")) throw new Error("robots.txt does not use the custom root domain.");
if (sitemap.includes("/worklazytools/")) throw new Error("sitemap.xml still contains the repository subpath.");
for (const route of routes) {
  if (route && !sitemap.includes(`/${route}/`)) throw new Error(`sitemap.xml is missing ${route}.`);
}

console.log(`Static output validation passed: ${routes.length} pages, ads.txt, robots.txt and sitemap.xml.`);
