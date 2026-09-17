import fs from "fs";
let seoContent = fs.readFileSync("src/app/seo.ts", "utf-8");

const withFaqStr = `function withFaq(language: AppLanguage, path: string, definition: SeoDefinition): SeoDefinition {
  let slug = toolSlugByPath[path];
  if (!slug) {
    // try to find by prefix
    for (const p of Object.keys(toolSlugByPath)) {
      if (path.startsWith(p + "/")) {
        slug = toolSlugByPath[p];
        break;
      }
    }
  }
  const faq = slug ? getFaqsForPath(language, slug, path) : [];
  return faq.length > 0 ? { ...definition, faq } : definition;
}`;

seoContent = seoContent.replace(/function withFaq[\s\S]*?(?=\nexport function normalizeSeoPath)/, withFaqStr);
fs.writeFileSync("src/app/seo.ts", seoContent);
