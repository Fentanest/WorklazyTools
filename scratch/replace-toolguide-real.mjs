import fs from "fs";
import path from "path";

const mapping = {
  "audio-studio": "audio",
  "data-converter": "converter",
  "document-compare": "documentCompare",
  "document-generator": "documentGenerator",
  "document-redactor": "documentRedactor",
  "excel-cleaner": "excelCleaner",
  "excel-compare": "excelCompare",
  "excel-merger": "excel",
  "hwp-editor": "hwpEditor",
  "image-privacy": "imagePrivacy",
  "image-studio": "image",
  "office-editor": "officeEditor",
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

function processDir(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            processDir(fullPath);
        } else if (entry.isFile() && fullPath.endsWith(".tsx")) {
            let content = fs.readFileSync(fullPath, "utf-8");
            let originalContent = content;
            
            let slug = null;
            for (const [d, s] of Object.entries(mapping)) {
                if (fullPath.includes(`/${d}/`)) {
                    slug = s;
                    break;
                }
            }
            if (!slug) continue;

            content = content.replace(/import\s*\{\s*ToolGuide\s*\}\s*from\s*"[^"]+ToolGuide";/g, 'import { ToolGuideWrapper } from "../../components/ToolGuideWrapper";');

            if (slug === "documentRedactor") {
                content = content.replace(/<ToolGuide\s+title=[^>]+?description=[^>]+?blocks=[^>]+?faq=[^>]+?>([\s\S]*?)<\/ToolGuide>/g, `<ToolGuideWrapper slug="${slug}">$1</ToolGuideWrapper>`);
            } else {
                content = content.replace(/<ToolGuide\s+title=[^>]+?description=[^>]+?blocks=[^>]+?faq=[^>]+?\/>/g, `<ToolGuideWrapper slug="${slug}" />`);
            }
            
            if (content !== originalContent) {
                fs.writeFileSync(fullPath, content);
            }
        }
    }
}

processDir("src/features");
