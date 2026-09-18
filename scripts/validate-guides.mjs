import fs from "fs";
import path from "path";
import { getGuideData, getGuideKeyForPath, toolToGuideKey } from "../src/i18n/guideData.ts";

const langs = ["ko", "en"];
const guidesData = {};

let hasError = false;
const errors = [];

function error(msg) {
  errors.push(msg);
  hasError = true;
}

for (const lang of langs) {
  const guidePath = path.join("src/locales", lang, "guides.json");
  guidesData[lang] = JSON.parse(fs.readFileSync(guidePath, "utf-8"));
}

const anyWherePatterns = [
  "배지는 만들지 않는다",
  "before posting",
  "실제 상태에 연결한다"
];

function checkText(lang, slug, context, text) {
  if (typeof text !== "string") return;
  for (const p of anyWherePatterns) {
    if (text.includes(p)) {
      error(`[${lang}] Guide '${slug}' contains leftover memo in ${context}: "${p}"`);
    }
  }
}

for (const lang of langs) {
  const guides = guidesData[lang];
  for (const [slug, guide] of Object.entries(guides)) {
    if (lang === "en" && slug === "hwpEditor") continue;

    if (!guide.title || typeof guide.title !== "string" || !guide.title.trim()) {
      error(`[${lang}] Guide '${slug}' is missing 'title'`);
    }
    if (!guide.description || typeof guide.description !== "string" || !guide.description.trim()) {
      error(`[${lang}] Guide '${slug}' is missing 'description'`);
    }
    
    checkText(lang, slug, 'title', guide.title);
    checkText(lang, slug, 'description', guide.description);

    const blocks = Array.isArray(guide.blocks) ? guide.blocks : [];
    blocks.forEach((block, i) => {
      if (!block.title || typeof block.title !== "string" || !block.title.trim()) {
        error(`[${lang}] Guide '${slug}' blocks[${i}] missing 'title'`);
      }
      checkText(lang, slug, `blocks[${i}].title`, block.title);
      (block.paragraphs || []).forEach(p => checkText(lang, slug, `blocks[${i}].paragraphs`, p));
      (block.items || []).forEach(p => checkText(lang, slug, `blocks[${i}].items`, p));
    });

    if (guide.pathBlocks) {
      for (const [pbPath, pbBlocks] of Object.entries(guide.pathBlocks)) {
        pbBlocks.forEach((block, i) => {
          checkText(lang, slug, `pathBlocks['${pbPath}'][${i}].title`, block.title);
          (block.paragraphs || []).forEach(p => checkText(lang, slug, `pathBlocks['${pbPath}'][${i}].paragraphs`, p));
          (block.items || []).forEach(p => checkText(lang, slug, `pathBlocks['${pbPath}'][${i}].items`, p));
        });
      }
    }

    const faq = guide.faq || {};
    const usedFaqs = new Set();
    
    for (const [k, v] of Object.entries(faq)) {
      if (!v.q || !v.a) {
         error(`[${lang}] Guide '${slug}' faq '${k}' is missing q or a`);
      }
      checkText(lang, slug, `faq['${k}'].q`, v.q);
      checkText(lang, slug, `faq['${k}'].a`, v.a);
    }

    if (guide.pathFaqs) {
      for (const [p, faqIds] of Object.entries(guide.pathFaqs)) {
        faqIds.forEach(id => {
          if (!faq[id]) {
            error(`[${lang}] Guide '${slug}' pathFaqs['${p}'] references missing FAQ ID '${id}'`);
          }
          usedFaqs.add(id);
        });
      }
    }
  }
}

const allToolSlugs = [
  "excel-merger", "excel-compare", "excel-cleaner", "document-compare", "pdf-compare", "pdf-editor",
  "hwp-editor", "office-editor", "video-studio", "audio-studio", "image-studio", "text-tools",
  "text-merger", "text-formatter", "work-calculator", "timezone-calculator", "payroll-calculator",
  "image-privacy", "security-tools", "qr-studio", "data-converter", "document-redactor", "document-generator"
];

for (const lang of langs) {
  for (const slug of allToolSlugs) {
    if (lang === "en" && slug === "hwp-editor") continue;
    const guideKey = toolToGuideKey[slug] || slug;
    if (!guidesData[lang][guideKey]) {
      error(`[${lang}] Guide data not found for tool slug '${slug}' (mapped to key '${guideKey}')`);
    }
  }
}

// Check runtime/static mapping for pdf-editor
for (const lang of langs) {
  const ocrKey = getGuideKeyForPath("pdf-editor", "/tools/pdf-editor/ocr");
  const convertKey = getGuideKeyForPath("pdf-editor", "/tools/pdf-editor/convert");
  if (ocrKey !== "pdfEditor.convert" || convertKey !== "pdfEditor.convert") {
    error(`[${lang}] getGuideKeyForPath failed to map /tools/pdf-editor/ocr or /tools/pdf-editor/convert to pdfEditor.convert`);
  }
}

if (hasError) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("Guides validation passed.");
