import fs from "fs";
import seoFaqs from "./seo-faqs.js";

// Mapping path -> tool slug
const toolSlugByPath = {
  "/tools/excel-merger": "excelMerger",
  "/tools/excel-compare": "excelCompare",
  "/tools/excel-cleaner": "excelCleaner",
  "/tools/document-compare": "documentCompare",
  "/tools/pdf-compare": "pdfCompare",
  "/tools/pdf-editor": "pdfEditor",
  "/tools/hwp-editor": "hwpEditor",
  "/tools/office-editor": "officeEditor",
  "/tools/video-studio": "videoStudio",
  "/tools/audio-studio": "audio", // wait, toolKeys in features.json!
  "/tools/image-studio": "image",
  "/tools/text-tools": "textTools",
  "/tools/text-merger": "textMerger",
  "/tools/text-formatter": "formatter",
  "/tools/work-calculator": "work",
  "/tools/timezone-calculator": "timezone",
  "/tools/payroll-calculator": "payroll",
  "/tools/image-privacy": "imagePrivacy",
  "/tools/security-tools": "security",
  "/tools/qr-studio": "qr",
  "/tools/data-converter": "converter",
  "/tools/document-redactor": "documentRedactor",
  "/tools/document-generator": "documentGenerator"
};

// We will construct guides.json
function processLanguage(lang, featuresPath, outPath) {
  const features = JSON.parse(fs.readFileSync(featuresPath, "utf-8"));
  const guides = {};
  
  // Extract existing guides from features.json
  const extractGuides = (obj, currentPath) => {
    if (typeof obj !== 'object' || obj === null) return;
    for (const key of Object.keys(obj)) {
      if (key === 'guide' && typeof obj[key] === 'object') {
        guides[currentPath] = obj[key];
        delete obj[key]; // we will mutate features.json later
      } else {
        extractGuides(obj[key], currentPath ? currentPath + '.' + key : key);
      }
    }
  };
  extractGuides(features, "");

  // Now process seoFaqs
  const seoLangFaqs = seoFaqs[lang] || {};
  
  // We need to merge them into guides
  // Each guide will have `faqs` (list of all faqs) and `pathFaqs` (mapping path -> faq indices/keys)
  for (const [path, faqList] of Object.entries(seoLangFaqs)) {
    // find tool slug
    let matchedSlug = null;
    let matchedPath = "";
    for (const [p, slug] of Object.entries(toolSlugByPath)) {
      if (path === p || path.startsWith(p + "/")) {
        // use longest match
        if (p.length > matchedPath.length) {
          matchedPath = p;
          matchedSlug = slug;
        }
      }
    }
    
    if (!matchedSlug) {
      console.log(`No slug mapped for path: ${path}`);
      continue;
    }
    
    // add to guides[matchedSlug]
    if (!guides[matchedSlug]) {
      guides[matchedSlug] = { title: "", description: "", blocks: [], faq: [], pathFaqs: {} };
    }
    
    const guide = guides[matchedSlug];
    if (!guide.pathFaqs) guide.pathFaqs = {};
    guide.pathFaqs[path] = [];
    
    for (const item of faqList) {
      // Find if we already have this question in guide.faq
      if (!guide.faq) guide.faq = [];
      let qId = guide.faq.findIndex(f => f.q === item.question);
      if (qId === -1) {
        // also check item.q vs guide.faq[].q in case it's slightly different?
        guide.faq.push({ q: item.question, a: item.answer });
        qId = guide.faq.length - 1;
      }
      guide.pathFaqs[path].push(qId.toString()); // use index as ID for now
    }
  }

  // Assign stable IDs instead of array?
  // Let's change `faq` from Array to Record<string, {q, a}>
  // or keep array but add `id`.
  for (const slug of Object.keys(guides)) {
    const guide = guides[slug];
    const newFaqs = {};
    if (guide.faq) {
      guide.faq.forEach((f, idx) => {
        newFaqs[`faq_${idx}`] = f;
      });
    }
    guide.faq = newFaqs;
    
    // update pathFaqs to use these IDs
    if (guide.pathFaqs) {
      for (const p of Object.keys(guide.pathFaqs)) {
        guide.pathFaqs[p] = guide.pathFaqs[p].map(idx => `faq_${idx}`);
      }
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(guides, null, 2));
  fs.writeFileSync(featuresPath, JSON.stringify(features, null, 2));
}

// First, for EN, we must inject the subagent's translated guides before extracting.
const enGuidesInEn = JSON.parse(fs.readFileSync("scratch/en-guides-in-en.json", "utf-8"));
const enFeatures = JSON.parse(fs.readFileSync("src/locales/en/features.json", "utf-8"));

// Inject them back
function injectGuides(obj, path, guideObj) {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) current[parts[i]] = {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = guideObj;
}
for (const [k, v] of Object.entries(enGuidesInEn)) {
  // k is like "documentCompare.guide"
  injectGuides(enFeatures, k, v);
}
fs.writeFileSync("src/locales/en/features.json", JSON.stringify(enFeatures, null, 2));

processLanguage("ko", "src/locales/ko/features.json", "src/locales/ko/guides.json");
processLanguage("en", "src/locales/en/features.json", "src/locales/en/guides.json");

