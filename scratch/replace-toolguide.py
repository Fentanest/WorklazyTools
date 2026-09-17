import os
import re

features_dir = "src/features"
mapping = {
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
}

for root, _, files in os.walk(features_dir):
    for f in files:
        if f.endswith(".tsx"):
            path = os.path.join(root, f)
            dir_name = os.path.basename(root)
            if dir_name not in mapping:
                continue
            slug = mapping[dir_name]
            
            with open(path, "r", encoding="utf-8") as file:
                content = file.read()
            
            if "<ToolGuide" in content:
                # Replace import
                content = re.sub(
                    r'import\s+\{\s*ToolGuide\s*\}\s+from\s+"[^"]+";',
                    'import { ToolGuideWrapper } from "../../components/ToolGuideWrapper";',
                    content
                )
                
                # Replace <ToolGuide ... /> (self-closing)
                # It might have children, we should be careful.
                # Actually, most ToolGuides don't have children except DocumentRedactorPage
                if slug == "documentRedactor":
                    content = re.sub(
                        r'<ToolGuide[^>]*>([\s\S]*?)<\/ToolGuide>',
                        f'<ToolGuideWrapper slug="{slug}">\\1</ToolGuideWrapper>',
                        content
                    )
                else:
                    # Self-closing ToolGuide
                    content = re.sub(
                        r'<ToolGuide[^>]*\/>',
                        f'<ToolGuideWrapper slug="{slug}" />',
                        content
                    )
                
                with open(path, "w", encoding="utf-8") as file:
                    file.write(content)

