import koGuides from "../locales/ko/guides.json" with { type: "json" };
import enGuides from "../locales/en/guides.json" with { type: "json" };
import type { AppLanguage } from "./languages.ts";

export interface ToolGuideBlock {
  title: string;
  paragraphs?: string[];
  items?: string[];
}

export interface ToolGuideFaq {
  q: string;
  a: string;
}

export interface ToolGuideDefinition {
  title: string;
  description: string;
  blocks: ToolGuideBlock[];
  faq: Record<string, ToolGuideFaq>;
  pathFaqs?: Record<string, string[]>;
  pathBlocks?: Record<string, ToolGuideBlock[]>;
}

const guidesMap: Record<AppLanguage, Record<string, any>> = {
  ko: koGuides,
  en: enGuides,
};

export function getGuideData(language: AppLanguage, slug: string): ToolGuideDefinition {
  // we fallback to 'en' if slug doesn't exist in current lang, but for guide data we might strictly want it
  const guide = guidesMap[language]?.[slug];
  if (!guide) {
    throw new Error(`Guide data not found for slug: ${slug}`);
  }

  // Validate schema
  if (typeof guide.title !== "string" || !guide.title.trim()) {
    throw new Error(`Invalid guide data for ${slug}: missing or empty 'title'`);
  }
  if (typeof guide.description !== "string" || !guide.description.trim()) {
    throw new Error(`Invalid guide data for ${slug}: missing or empty 'description'`);
  }
  
  const blocks = Array.isArray(guide.blocks) ? guide.blocks : [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (typeof block.title !== "string" || !block.title.trim()) {
      throw new Error(`Invalid guide data for ${slug}: blocks[${i}] missing 'title'`);
    }
  }

  const faq = guide.faq || {};
  for (const [key, item] of Object.entries(faq)) {
    if (typeof (item as any).q !== "string" || typeof (item as any).a !== "string") {
      throw new Error(`Invalid guide data for ${slug}: faq[${key}] missing 'q' or 'a'`);
    }
  }

  return {
    title: guide.title,
    description: guide.description,
    blocks,
    faq,
    pathFaqs: guide.pathFaqs || {},
    pathBlocks: guide.pathBlocks || {}
  };
}


export const toolToGuideKey: Record<string, string> = {
  "excel-merger": "excel",
  "excel-compare": "excelCompare",
  "excel-cleaner": "excelCleaner",
  "document-compare": "documentCompare",
  "pdf-compare": "pdfCompare",
  "pdf-editor": "pdfEditor.standard",
  "hwp-editor": "hwpEditor",
  "office-editor": "officeEditor",
  "video-studio": "video.page",
  "audio-studio": "audio",
  "image-studio": "image",
  "text-tools": "textTools",
  "text-merger": "textMerger",
  "text-formatter": "formatter",
  "work-calculator": "work",
  "timezone-calculator": "timezone",
  "payroll-calculator": "payroll",
  "image-privacy": "imagePrivacy",
  "security-tools": "security",
  "qr-studio": "qr",
  "data-converter": "converter",
  "document-redactor": "documentRedactor",
  "document-generator": "documentGenerator"
};

export function getGuideKeyForPath(slug: string, path: string): string {
  if (path === "/tools/pdf-editor/convert" || path === "/tools/pdf-editor/ocr") return "pdfEditor.convert";
  return toolToGuideKey[slug] || slug;
}

export function getFaqsForPath(language: AppLanguage, slug: string, path: string): { question: string, answer: string }[] {
  const guideKey = getGuideKeyForPath(slug, path);
  const guide = getGuideData(language, guideKey);
  let faqIds = guide.pathFaqs?.[path];
  if (!faqIds && guide.pathFaqs) {
    for (const p of Object.keys(guide.pathFaqs)) {
      const regexStr = "^" + p.replace(/:[^/]+/g, "[^/]+") + "$";
      if (new RegExp(regexStr).test(path)) {
        faqIds = guide.pathFaqs[p];
        break;
      }
    }
  }
  
  if (faqIds && faqIds.length > 0) {
    return faqIds.map(id => {
      const f = guide.faq[id];
      if (!f) throw new Error(`Missing FAQ ID '${id}' for path '${path}' in guide '${guideKey}' (${language})`);
      return { question: f.q, answer: f.a };
    });
  }
  
  return Object.values(guide.faq).map(item => ({ question: item.q, answer: item.a }));
}
