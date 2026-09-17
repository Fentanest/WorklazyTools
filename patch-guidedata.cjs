const fs = require('fs');
const file = 'src/i18n/guideData.ts';
let content = fs.readFileSync(file, 'utf8');

const mapCode = `
export const toolToGuideKey: Record<string, string> = {
  "excel-merger": "excel",
  "excel-compare": "excelCompare",
  "excel-cleaner": "excelCleaner",
  "document-compare": "documentCompare",
  "pdf-compare": "pdfCompare",
  "pdf-editor": "pdfEditor.standard",
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
`;

content = content.replace('export function getFaqsForPath', mapCode + '\nexport function getFaqsForPath');

content = content.replace(
  'const guide = getGuideData(language, slug);',
  'const guideKey = toolToGuideKey[slug] || slug;\n    const guide = getGuideData(language, guideKey);'
);

fs.writeFileSync(file, content);
