import fs from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.resolve("dist");
const sourceHtml = await fs.readFile(path.join(outputDirectory, "index.html"), "utf8");
const siteUrl = ensureTrailingSlash(process.env.VITE_SITE_URL || "https://worklazy.net/");
const languages = ["ko", "en"];
const tools = {
  ko: JSON.parse(await fs.readFile("src/locales/ko/tools.json", "utf8")),
  en: JSON.parse(await fs.readFile("src/locales/en/tools.json", "utf8")),
};
const seoCopy = {
  ko: JSON.parse(await fs.readFile("src/locales/ko/seo.json", "utf8")),
  en: JSON.parse(await fs.readFile("src/locales/en/seo.json", "utf8")),
};

const toolRoutes = [
  "excel-merger", "word-compare", "pdf-editor", "hwp-editor", "hwp-compare", "video-studio", "audio-studio",
  "image-studio", "text-tools", "text-formatter", "work-calculator", "timezone-calculator", "payroll-calculator",
  "image-privacy", "security-tools", "qr-studio", "data-converter",
];
const pdfRoutes = ["pdf-editor/image-to-pdf", "pdf-editor/pdf-to-image", "pdf-editor/convert"];
const pageRoutes = ["about", "privacy", "terms", "contact", "licenses"];
const localizedRoutes = ["", "tools", ...toolRoutes.map((slug) => `tools/${slug}`), ...pdfRoutes.map((slug) => `tools/${slug}`), ...pageRoutes];
const videoRoute = "tools/video-studio";

const pageSeo = {
  ko: {
    "": ["무료 문서·PDF·비디오·이미지 업무 도구 | Worklazy Tools", "설치와 로그인 없이 문서·미디어 편집, 텍스트·데이터 변환, 일정·급여 계산과 보안 도구를 실행하세요."],
    tools: ["무료 업무 파일 도구 모음 | Worklazy Tools", "문서·미디어 편집부터 텍스트, 데이터, 일정, 급여, 보안, QR 도구까지 브라우저에서 무료로 실행하세요."],
    about: ["서비스 소개 | Worklazy Tools", "Worklazy Tools의 브라우저 로컬 처리 방식과 지원 범위를 안내합니다."],
    privacy: ["개인정보처리방침 | Worklazy Tools", "로컬 파일 처리, 방문 분석, 광고와 쿠키에 관한 개인정보처리방침입니다."],
    terms: ["이용약관 | Worklazy Tools", "무료 브라우저 업무 도구의 이용 조건, 지원 범위와 사용자 책임을 안내합니다."],
    contact: ["문의·건의·버그 제보 | Worklazy Tools", "버그 제보, 기능 제안과 개인정보 문의 방법을 안내합니다."],
    licenses: ["라이선스 및 제3자 고지 | Worklazy Tools", "Worklazy Tools와 주요 오픈소스 구성요소의 라이선스를 안내합니다."],
  },
  en: {
    "": ["Free Browser Tools for Documents, Media & Work | Worklazy Tools", "Edit documents and media, convert text and data, plan work and use privacy tools without installing software."],
    tools: ["All Free Browser Tools | Worklazy Tools", "Browse free tools for documents, media, text, data, work planning, Korean payroll, privacy and sharing."],
    about: ["About | Worklazy Tools", "Learn how Worklazy Tools processes files in your browser and explains compatibility boundaries."],
    privacy: ["Privacy Policy | Worklazy Tools", "Read how local file processing, analytics, advertising and cookies are handled."],
    terms: ["Terms of Use | Worklazy Tools", "Review the conditions, supported scope and user responsibilities for these browser tools."],
    contact: ["Contact, Suggestions & Bug Reports | Worklazy Tools", "Report a bug, suggest a feature or ask a privacy question."],
    licenses: ["Licenses & Third-Party Notices | Worklazy Tools", "Review Worklazy Tools copyright terms and third-party open-source licenses."],
  },
};

const pdfSeo = {
  ko: {
    "pdf-editor/image-to-pdf": ["JPG·PNG 이미지를 PDF로 변환 | Worklazy Tools", "여러 JPG·PNG 이미지를 정렬해 하나의 PDF로 변환하세요."],
    "pdf-editor/pdf-to-image": ["PDF를 PNG·JPG 이미지로 변환 | Worklazy Tools", "PDF 페이지를 PNG 또는 JPG로 변환해 ZIP으로 내려받으세요."],
    "pdf-editor/convert": ["PDF를 DOCX·XLSX·TXT로 변환·한국어 OCR | Worklazy Tools", "PDF를 문서·표·텍스트 또는 검색 가능한 PDF로 브라우저에서 변환하세요."],
  },
  en: {
    "pdf-editor/image-to-pdf": ["Convert JPG & PNG Images to PDF | Worklazy Tools", "Reorder JPG and PNG images and combine them into one browser-generated PDF."],
    "pdf-editor/pdf-to-image": ["Convert PDF Pages to PNG or JPG | Worklazy Tools", "Render PDF pages as PNG or JPG images and download them together as a ZIP."],
    "pdf-editor/convert": ["Convert PDF to DOCX, XLSX or TXT with OCR | Worklazy Tools", "Convert PDF pages to documents, spreadsheets, text or searchable PDF with local OCR."],
  },
};

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

for (const route of localizedRoutes.filter(Boolean)) {
  const target = absolute("ko", route);
  const directory = path.join(outputDirectory, route);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "index.html"), renderRedirect(sourceHtml, target));
}

const coiSource = path.resolve("node_modules/coi-serviceworker/coi-serviceworker.min.js");
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
  await fs.copyFile(coiSource, target);
}

await fs.writeFile(path.join(outputDirectory, "sitemap.xml"), createSitemap(generated));
await fs.writeFile(path.join(outputDirectory, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${new URL("sitemap.xml", siteUrl).href}\n`);
console.log(`Generated ${generated.length} localized crawlable pages for ${siteUrl}`);

function makePage(language, route) {
  const root = pageSeo[language][route];
  if (root) return { language, route, title: root[0], description: root[1], heading: root[0].split(" | ")[0], application: null };
  const pdfSubpath = route.replace(/^tools\//, "");
  if (pdfSeo[language][pdfSubpath]) {
    const [title, description] = pdfSeo[language][pdfSubpath];
    return { language, route, title, description, heading: title.split(" | ")[0], application: "PDF Tools" };
  }
  const slug = route.replace(/^tools\//, "");
  const item = tools[language].items[slug];
  const title = `${item.title} | Worklazy Tools`;
  return { language, route, title, description: item.description, heading: item.title, application: item.title, highlights: item.highlights };
}

function renderPage(template, page, canonical) {
  const alternateKo = absolute("ko", page.route);
  const alternateEn = absolute("en", page.route === "tools/hwp-editor" ? "tools" : page.route);
  const imagePath = page.language === "ko" ? "social/worklazy-tools-share-ko.png" : "social/worklazy-tools-share.png";
  const image = new URL(imagePath, siteUrl).href;
  const locale = page.language === "ko" ? "ko_KR" : "en_US";
  const inLanguage = page.language === "ko" ? "ko-KR" : "en-US";
  const structuredData = [{ "@context": "https://schema.org", "@type": page.route ? "WebPage" : "WebSite", name: page.title, description: page.description, url: canonical, inLanguage, image }];
  if (page.application) structuredData.push({ "@context": "https://schema.org", "@type": "WebApplication", name: page.application, description: page.description, url: canonical, applicationCategory: "BusinessApplication", operatingSystem: "Any", featureList: page.highlights ?? [], offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } });
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
    ...(page.route === videoRoute ? [`<meta name="worklazy-video-isolation" content="document-scope" />`, `<script>globalThis.coi={quiet:true,coepCredentialless:()=>false};</script>`, `<script data-worklazy-video-isolation src="./coi-serviceworker.js"></script>`] : []),
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
