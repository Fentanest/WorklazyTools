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
  "pdf-editor": "pdfEditor",
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
            
            if (slug === "pdfEditor") {
                content = content.replace(/import\s*\{\s*ToolGuide\s*\}\s*from\s*"[^"]+ToolGuide";/g, 'import { ToolGuideWrapper } from "../../components/ToolGuideWrapper";');
                content = content.replace(/<ToolGuide\b[^>]*\/>/gs, `<ToolGuideWrapper slug={mode === "convert" ? "pdfEditor.convert" : "pdfEditor.standard"} />`);
            } else if (slug === "documentRedactor") {
                content = content.replace(/import\s*\{\s*ToolGuide\s*\}\s*from\s*"[^"]+ToolGuide";/g, 'import { ToolGuideWrapper } from "../../components/ToolGuideWrapper";');
                content = content.replace(/<ToolGuide\b(?:[^>](?!<\/ToolGuide>))*?>([\s\S]*?)<\/ToolGuide>/gs, `<ToolGuideWrapper slug="${slug}">$1</ToolGuideWrapper>`);
                content = content.replace(/<ToolGuide\b(?:[^>](?!<\/ToolGuide>))*?\/>/gs, `<ToolGuideWrapper slug="${slug}" />`);
            } else {
                content = content.replace(/import\s*\{\s*ToolGuide\s*\}\s*from\s*"[^"]+ToolGuide";/g, 'import { ToolGuideWrapper } from "../../components/ToolGuideWrapper";');
                content = content.replace(/<ToolGuide\b[^>]*\/>/gs, `<ToolGuideWrapper slug="${slug}" />`);
            }
            
            if (content !== originalContent) {
                fs.writeFileSync(fullPath, content);
            }
        }
    }
}

// Reset first to avoid duplicate wrapping!
import { execSync } from "child_process";
execSync("git checkout src/features/");

processDir("src/features");
