import fs from "fs";
import path from "path";

const slugMap = {
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

const featuresDir = path.join('/home/better0101/projects/worklazytools/src/features');

function processDir(dir) {
    if (dir.includes('pdf-editor')) return;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            processDir(fullPath);
        } else if (entry.isFile() && fullPath.endsWith('.tsx')) {
            processFile(fullPath);
        }
    }
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    if (content.match(/import\s+\{\s*ToolGuide(?:,\s*type\s+GuideBlock|\s*type\s+GuideBlock,\s*ToolGuide)?\s*\}\s+from\s+["']([^"']+)ToolGuide["'];?/)) {
        content = content.replace(
            /import\s+\{\s*ToolGuide(?:,\s*type\s+GuideBlock|\s*type\s+GuideBlock,\s*ToolGuide)?\s*\}\s+from\s+["']([^"']+)ToolGuide["'];?/g,
            'import { ToolGuideWrapper } from "$1ToolGuideWrapper";'
        );
        modified = true;
    }

    const relPath = path.relative(featuresDir, filePath);
    const featureName = relPath.split(path.sep)[0];
    const slug = slugMap[featureName];
    
    if (!slug) return;

    let idx = 0;
    while (true) {
        idx = content.indexOf('<ToolGuide', idx);
        if (idx === -1) break;
        
        if (content.substring(idx, idx + 17) === '<ToolGuideWrapper') {
            idx += 17;
            continue;
        }

        let braceLevel = 0;
        let tagEnd = -1;
        let isSelfClosing = false;
        
        for (let i = idx + 10; i < content.length; i++) {
            const char = content[i];
            if (char === '{') {
                braceLevel++;
            } else if (char === '}') {
                braceLevel--;
            } else if (char === '>' && braceLevel === 0) {
                if (content[i - 1] === '/') {
                    isSelfClosing = true;
                }
                tagEnd = i;
                break;
            }
        }
        
        if (tagEnd === -1) {
            idx += 10;
            continue;
        }

        if (isSelfClosing) {
            const newTag = `<ToolGuideWrapper slug="${slug}" />`;
            content = content.substring(0, idx) + newTag + content.substring(tagEnd + 1);
            idx += newTag.length;
            modified = true;
        } else {
            const newTag = `<ToolGuideWrapper slug="${slug}">`;
            content = content.substring(0, idx) + newTag + content.substring(tagEnd + 1);
            content = content.replace('</ToolGuide>', '</ToolGuideWrapper>');
            idx += newTag.length;
            modified = true;
        }
    }
    
    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated: ${relPath}`);
    }
}

import { execSync } from "child_process";
execSync("git checkout src/features/");

processDir(featuresDir);
console.log("Done.");
