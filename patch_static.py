import re

with open("scripts/generate-static-pages.mjs", "r", encoding="utf-8") as f:
    code = f.read()

# Replace the import statement
code = code.replace(
    'const { canonicalSeoPath, getSeoDefinition, getSocialImageDefinition } = await import("../src/app/seo.ts");',
    'const { canonicalSeoPath, getSeoDefinition, getSocialImageDefinition, toolSlugByPath } = await import("../src/app/seo.ts");\nconst { getGuideData, toolToGuideKey } = await import("../src/i18n/guideData.ts");'
)

# Modify makePage
makePage_old = """function makePage(language, route) {
  const pathname = route ? `/${route}` : "/";
  const definition = getSeoDefinition(language, pathname);
  const socialImage = getSocialImageDefinition(language, pathname);
  return {
    language,
    route,
    title: definition.title,
    description: definition.description,
    heading: definition.title.split(/\\s(?:\\||—|-)\\s/)[0],
    application: definition.application?.name ?? null,
    highlights: definition.application?.featureList ?? [],
    faq: definition.faq ?? [],
    socialImage,
  };
}"""

makePage_new = """function makePage(language, route) {
  const pathname = route ? `/${route}` : "/";
  const definition = getSeoDefinition(language, pathname);
  const socialImage = getSocialImageDefinition(language, pathname);
  
  let blocks = [];
  try {
    const slug = toolSlugByPath[pathname] || Object.keys(toolSlugByPath).find(p => pathname.startsWith(p + "/")) && toolSlugByPath[Object.keys(toolSlugByPath).find(p => pathname.startsWith(p + "/"))];
    if (slug) {
      const guideKey = toolToGuideKey[slug] || slug;
      const guide = getGuideData(language, guideKey);
      blocks = [...(guide.blocks || []), ...(guide.pathBlocks?.[pathname] || [])];
    }
  } catch (e) {
    // ignore
  }

  return {
    language,
    route,
    title: definition.title,
    description: definition.description,
    heading: definition.title.split(/\\s(?:\\||—|-)\\s/)[0],
    application: definition.application?.name ?? null,
    highlights: definition.application?.featureList ?? [],
    faq: definition.faq ?? [],
    blocks,
    socialImage,
  };
}"""
code = code.replace(makePage_old, makePage_new)

# Modify staticBody
staticBody_old = """function staticBody(page) {
  const isKo = page.language === "ko";
  const intro = isKo ? "설치나 로그인 없이 브라우저에서 바로 사용하세요." : "Use this tool directly in your browser without installing software or signing in.";
  const sections = (page.highlights ?? []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const faq = (page.faq ?? []).map((item) => `<h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p>`).join("");
  return `<main class="seo-static-fallback"><nav aria-label="${isKo ? "주요 페이지" : "Primary pages"}"><a href="/${page.language}/">${isKo ? "홈" : "Home"}</a><a href="/${page.language}/tools/">${isKo ? "모든 도구" : "All tools"}</a></nav><p class="eyebrow">WORKLAZY TOOLS</p><h1>${escapeHtml(page.heading)}</h1><p>${escapeHtml(page.description)}</p><p>${intro}</p>${sections ? `<ul>${sections}</ul>` : ""}${faq ? `<section><h2>${isKo ? "자주 묻는 질문" : "Frequently asked questions"}</h2>${faq}</section>` : ""}</main>`;
}"""

staticBody_new = """function staticBody(page) {
  const isKo = page.language === "ko";
  const intro = isKo ? "설치나 로그인 없이 브라우저에서 바로 사용하세요." : "Use this tool directly in your browser without installing software or signing in.";
  const sections = (page.highlights ?? []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const blocks = (page.blocks ?? []).map((item) => `<h2>${escapeHtml(item.title)}</h2>` + (item.paragraphs ?? []).map(p => `<p>${escapeHtml(p)}</p>`).join("") + (item.items?.length ? `<ul>${item.items.map(i => `<li>${escapeHtml(i)}</li>`).join("")}</ul>` : "")).join("");
  const faq = (page.faq ?? []).map((item) => `<h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p>`).join("");
  return `<main class="seo-static-fallback"><nav aria-label="${isKo ? "주요 페이지" : "Primary pages"}"><a href="/${page.language}/">${isKo ? "홈" : "Home"}</a><a href="/${page.language}/tools/">${isKo ? "모든 도구" : "All tools"}</a></nav><p class="eyebrow">WORKLAZY TOOLS</p><h1>${escapeHtml(page.heading)}</h1><p>${escapeHtml(page.description)}</p><p>${intro}</p>${sections ? `<ul>${sections}</ul>` : ""}${blocks}${faq ? `<section><h2>${isKo ? "자주 묻는 질문" : "Frequently asked questions"}</h2>${faq}</section>` : ""}</main>`;
}"""
code = code.replace(staticBody_old, staticBody_new)

with open("scripts/generate-static-pages.mjs", "w", encoding="utf-8") as f:
    f.write(code)
