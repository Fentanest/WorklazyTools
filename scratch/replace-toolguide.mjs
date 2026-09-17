import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const featuresDir = "src/features";
const dirs = fs.readdirSync(featuresDir);

const mapping = {
  "audio-studio": "audio",
  "data-converter": "converter",
  "document-compare": "documentCompare",
  "document-generator": "documentGenerator",
  "document-redactor": "documentRedactor",
  "excel-cleaner": "excelCleaner",
  "excel-compare": "excelCompare",
  "excel-merger": "excel",
  "image-privacy": "imagePrivacy",
  "image-studio": "image",
  "payroll-calculator": "payroll",
  "qr-studio": "qr",
  "security-tools": "security",
  "text-formatter": "formatter",
  "text-merger": "textMerger",
  "text-tools": "textTools",
  "timezone-calculator": "timezone",
  "video-studio": "video.page",
  "work-calculator": "work"
};

for (const dir of dirs) {
  const pagePath = path.join(featuresDir, dir, `${dir.split('-').map(p => p[0].toUpperCase() + p.slice(1)).join('')}Page.tsx`);
  if (fs.existsSync(pagePath) && mapping[dir]) {
    let content = fs.readFileSync(pagePath, "utf-8");
    if (content.includes("<ToolGuide ")) {
      content = content.replace(/import \{ ToolGuide \} from "[^"]+";/, 'import { ToolGuideWrapper } from "../../components/ToolGuideWrapper";');
      // replace <ToolGuide ... />
      content = content.replace(/<ToolGuide\s+title=\{[^}]+\}\s+description=\{[^}]+\}\s+blocks=\{[^}]+\}\s+faq=\{[^}]+\}\s*\/>/, `<ToolGuideWrapper slug="${mapping[dir]}" />`);
      
      // handle children if any
      content = content.replace(/<ToolGuide\s+title=\{[^}]+\}\s+description=\{[^}]+\}\s+blocks=\{[^}]+\}\s+faq=\{[^}]+\}\s*>([\s\S]*?)<\/ToolGuide>/, `<ToolGuideWrapper slug="${mapping[dir]}">$1</ToolGuideWrapper>`);
      
      fs.writeFileSync(pagePath, content);
    }
  }
}

// Check fallback pages
const fallbackPath = "src/features/document-redactor/DocumentRedactorFallback.tsx";
if (fs.existsSync(fallbackPath)) {
    let content = fs.readFileSync(fallbackPath, "utf-8");
    content = content.replace(/import \{ ToolGuide \} from "[^"]+";/, 'import { ToolGuideWrapper } from "../../components/ToolGuideWrapper";');
    content = content.replace(/<ToolGuide\s+title=\{[^}]+\}\s+description=\{[^}]+\}\s+blocks=\{[^}]+\}\s+faq=\{[^}]+\}\s*>([\s\S]*?)<\/ToolGuide>/, `<ToolGuideWrapper slug="documentRedactor">$1</ToolGuideWrapper>`);
    fs.writeFileSync(fallbackPath, content);
}

