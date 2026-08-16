import fs from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.resolve("dist");
const sourceHtml = await fs.readFile(path.join(outputDirectory, "index.html"), "utf8");
const siteUrl = ensureTrailingSlash(process.env.VITE_SITE_URL || "https://worklazy.net/");
const languages = ["ko", "en"];
const seoCopy = {
  ko: JSON.parse(await fs.readFile("src/locales/ko/seo.json", "utf8")),
  en: JSON.parse(await fs.readFile("src/locales/en/seo.json", "utf8")),
};
const { getSeoDefinition } = await import("../src/app/seo.ts");

const toolRoutes = [
  "excel-merger", "word-compare", "pdf-editor", "hwp-editor", "hwp-compare", "video-studio", "audio-studio",
  "image-studio", "text-tools", "text-formatter", "work-calculator", "timezone-calculator", "payroll-calculator",
  "image-privacy", "security-tools", "qr-studio", "data-converter",
];
const pdfRoutes = ["pdf-editor/image-to-pdf", "pdf-editor/pdf-to-image", "pdf-editor/convert"];
const pageRoutes = ["about", "privacy", "terms", "contact", "licenses"];
const localizedRoutes = ["", "tools", ...toolRoutes.map((slug) => `tools/${slug}`), ...pdfRoutes.map((slug) => `tools/${slug}`), ...pageRoutes];
const videoRoute = "tools/video-studio";

const generated = [];
for (const language of languages) {
  for (const route of localizedRoutes) {
    if (language === "en" && route === "tools/hwp-editor") continue;
    const page = makePage(language, route);
    const canonical = absolute(language, route);
    const html = renderPage(sourceHtml, page, canonical);
    const directory = path.join(outputDirectory, language, route);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, "index.html"), html);
    generated.push({ language, route, canonical });
  }
}

await fs.writeFile(path.join(outputDirectory, "index.html"), renderLanding(sourceHtml));
await fs.writeFile(path.join(outputDirectory, "404.html"), renderNotFound(sourceHtml));

for (const route of localizedRoutes.filter(Boolean)) {
  const target = absolute("ko", route);
  const directory = path.join(outputDirectory, route);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "index.html"), renderRedirect(sourceHtml, target));
}

const coiSource = path.resolve("node_modules/coi-serviceworker/coi-serviceworker.min.js");
const coiSourceText = await fs.readFile(coiSource, "utf8");
const credentiallessCoiSource = coiSourceText.replace("let coepCredentialless=!1;", "let coepCredentialless=!0;");
if (credentiallessCoiSource === coiSourceText) throw new Error("Unable to configure the video isolation service worker for credentialless subresources.");
for (const language of languages) {
  for (const assetDirectory of ["workers", "runtime"]) {
    const source = path.join(outputDirectory, videoRoute, assetDirectory);
    const target = path.join(outputDirectory, language, videoRoute, assetDirectory);
    await fs.cp(source, target, { recursive: true });
  }
}
for (const language of [...languages, "legacy"]) {
  const target = language === "legacy"
    ? path.join(outputDirectory, videoRoute, "coi-serviceworker.js")
    : path.join(outputDirectory, language, videoRoute, "coi-serviceworker.js");
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, credentiallessCoiSource);
}

await fs.writeFile(path.join(outputDirectory, "sitemap.xml"), createSitemap(generated));
await fs.writeFile(path.join(outputDirectory, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${new URL("sitemap.xml", siteUrl).href}\n`);
console.log(`Generated ${generated.length} localized crawlable pages for ${siteUrl}`);

function makePage(language, route) {
  const pathname = route ? `/${route}` : "/";
  const definition = getSeoDefinition(language, pathname);
  return {
    language,
    route,
    title: definition.title,
    description: definition.description,
    heading: definition.title.split(/\s(?:\||—|-)\s/)[0],
    application: definition.application?.name ?? null,
    highlights: definition.application?.featureList ?? [],
  };
}

function renderPage(template, page, canonical) {
  const alternateKo = absolute("ko", page.route);
  const alternateEn = absolute("en", page.route === "tools/hwp-editor" ? "tools" : page.route);
  const imagePath = page.language === "ko" ? "social/worklazy-tools-share-ko.png" : "social/worklazy-tools-share.png";
  const image = new URL(imagePath, siteUrl).href;
  const locale = page.language === "ko" ? "ko_KR" : "en_US";
  const inLanguage = page.language === "ko" ? "ko-KR" : "en-US";
  const structuredData = [{ "@context": "https://schema.org", "@type": page.route ? "WebPage" : "WebSite", name: page.title, description: page.description, url: canonical, inLanguage, image }];
  if (page.application) structuredData.push({ "@context": "https://schema.org", "@type": "WebApplication", name: page.application, description: page.description, url: canonical, applicationCategory: "BusinessApplication", operatingSystem: "Any", featureList: page.highlights ?? [], offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" } });
  const head = [
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<link rel="alternate" hreflang="ko" href="${escapeHtml(alternateKo)}" />`,
    `<link rel="alternate" hreflang="en" href="${escapeHtml(alternateEn)}" />`,
    `<link rel="alternate" hreflang="x-default" href="${escapeHtml(alternateEn)}" />`,
    `<meta property="og:locale" content="${locale}" />`,
    `<meta property="og:locale:alternate" content="${page.language === "ko" ? "en_US" : "ko_KR"}" />`,
    `<meta property="og:type" content="website" />`, `<meta property="og:site_name" content="Worklazy Tools" />`,
    `<meta property="og:title" content="${escapeHtml(page.title)}" />`, `<meta property="og:description" content="${escapeHtml(page.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`, `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:image:secure_url" content="${escapeHtml(image)}" />`, `<meta property="og:image:type" content="image/png" />`,
    `<meta property="og:image:width" content="1200" />`, `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escapeHtml(seoCopy[page.language].socialImageAlt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`, `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(page.description)}" />`, `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    `<script id="worklazy-route-jsonld" type="application/ld+json">${JSON.stringify(structuredData)}</script>`,
    ...(page.route === videoRoute ? [`<meta name="worklazy-video-isolation" content="document-scope" />`, `<script>globalThis.coi={quiet:true,coepCredentialless:()=>true};</script>`, `<script data-worklazy-video-isolation src="./coi-serviceworker.js"></script>`] : []),
  ].join("\n    ");
  return template.replace(/<html[^>]*>/, `<html lang="${page.language}">`).replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(page.title)}</title>`).replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/>/, `<meta name="description" content="${escapeHtml(page.description)}" />`).replace("</head>", `    ${head}\n  </head>`).replace('<div id="root"></div>', `<div id="root">${staticBody(page)}</div>`);
}

function renderLanding(template) {
  const title = "Worklazy Tools — Choose Language · 언어 선택";
  const description = "Choose English or Korean for free browser-based work tools. 무료 브라우저 업무 도구의 언어를 선택하세요.";
  const head = `<link rel="canonical" href="${siteUrl}" /><link rel="alternate" hreflang="ko" href="${absolute("ko", "")}" /><link rel="alternate" hreflang="en" href="${absolute("en", "")}" /><link rel="alternate" hreflang="x-default" href="${absolute("en", "")}" />`;
  return template.replace(/<html[^>]*>/, '<html lang="en">').replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`).replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/>/, `<meta name="description" content="${description}" />`).replace("</head>", `${head}</head>`).replace('<div id="root"></div>', '<div id="root"><main class="seo-static-fallback"><p class="eyebrow">WORKLAZY TOOLS</p><h1>Choose your language<br><span lang="ko">언어를 선택하세요</span></h1><p><a href="/en/">Continue in English</a> · <a href="/ko/">한국어로 계속</a></p></main></div>');
}

function renderRedirect(template, target) {
  const scriptTarget = JSON.stringify(target);
  return template.replace(/<title>[\s\S]*?<\/title>/, "<title>Redirecting | Worklazy Tools</title>").replace("</head>", `<link rel="canonical" href="${escapeHtml(target)}" /><meta name="robots" content="noindex, follow" /><meta http-equiv="refresh" content="0;url=${escapeHtml(target)}" /><script>location.replace(${scriptTarget}+location.search+location.hash);</script></head>`).replace('<div id="root"></div>', `<div id="root"><p><a href="${escapeHtml(target)}">Continue</a></p></div>`);
}

function renderNotFound(template) {
  return template
    .replace(/<title>[\s\S]*?<\/title>/, "<title>Page not found | Worklazy Tools</title>")
    .replace(/<meta\s+name="robots"\s+content="[^"]*"\s*\/>/, '<meta name="robots" content="noindex, nofollow" />');
}

function staticBody(page) {
  const isKo = page.language === "ko";
  const intro = isKo ? "설치나 로그인 없이 브라우저에서 바로 사용하세요." : "Use this tool directly in your browser without installing software or signing in.";
  const sections = (page.highlights ?? []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `<main class="seo-static-fallback"><nav aria-label="${isKo ? "주요 페이지" : "Primary pages"}"><a href="/${page.language}/">${isKo ? "홈" : "Home"}</a><a href="/${page.language}/tools/">${isKo ? "모든 도구" : "All tools"}</a></nav><p class="eyebrow">WORKLAZY TOOLS</p><h1>${escapeHtml(page.heading)}</h1><p>${escapeHtml(page.description)}</p><p>${intro}</p>${sections ? `<ul>${sections}</ul>` : ""}</main>`;
}

function createSitemap(entries) {
  const byRoute = new Map(entries.map((entry) => [`${entry.language}:${entry.route}`, entry.canonical]));
  const rows = entries.map(({ language, route, canonical }) => {
    const ko = byRoute.get(`ko:${route}`) ?? absolute("ko", "tools");
    const en = byRoute.get(`en:${route}`) ?? absolute("en", "tools");
    return `  <url><loc>${escapeXml(canonical)}</loc><xhtml:link rel="alternate" hreflang="ko" href="${escapeXml(ko)}"/><xhtml:link rel="alternate" hreflang="en" href="${escapeXml(en)}"/><xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(en)}"/></url>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${rows}\n</urlset>\n`;
}

function absolute(language, route) { return new URL(`${language}/${route ? `${route}/` : ""}`, siteUrl).href; }
function ensureTrailingSlash(value) { return value.endsWith("/") ? value : `${value}/`; }
function escapeHtml(value) { return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
function escapeXml(value) { return escapeHtml(value).replaceAll("'", "&apos;"); }
