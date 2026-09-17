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
  "pdf-editor": "pdfEditor",
  "qr-studio": "qr",
  "security-tools": "security",
  "text-formatter": "formatter",
  "text-merger": "textMerger",
  "text-tools": "textTools",
  "timezone-calculator": "timezone",
  "video-studio": "video.page",
  "work-calculator": "work"
}

def replace_toolguide(content, slug):
    # Regex to find <ToolGuide ... /> or <ToolGuide ...>...</ToolGuide>
    # Note: re.sub with a custom function is safest.
    
    # 1. Match self-closing: <ToolGuide [^>]*/>
    content = re.sub(r'<ToolGuide\s+title=[^>]+?/>', f'<ToolGuideWrapper slug="{slug}" />', content, flags=re.DOTALL)
    
    # 2. Match with children: <ToolGuide [^>]+>(.*?)</ToolGuide>
    # Actually wait, PdfEditorPage is pdfEditor, but the slug is dynamic!
    # I already replaced PdfEditorPage using sed earlier, but my previous python script overwrote it? No, pdf-editor was not in mapping in the previous script!
    
    content = re.sub(r'<ToolGuide\s+title=[^>]+?>([\s\S]*?)<\/ToolGuide>', f'<ToolGuideWrapper slug="{slug}">\\1</ToolGuideWrapper>', content, flags=re.DOTALL)
    
    return content

for root, _, files in os.walk(features_dir):
    for f in files:
        if f.endswith(".tsx"):
            path = os.path.join(root, f)
            dir_name = os.path.basename(root)
            if dir_name not in mapping:
                continue
            slug = mapping[dir_name]
            if slug == "pdfEditor":
                continue # Skip pdfEditor because it's dynamic
                
            os.system(f"git checkout {path}") # Reset first
            
            with open(path, "r", encoding="utf-8") as file:
                content = file.read()
            
            if "ToolGuide" in content:
                content = content.replace('import { ToolGuide } from "../../components/ToolGuide";', 'import { ToolGuideWrapper } from "../../components/ToolGuideWrapper";')
                content = replace_toolguide(content, slug)
                
                with open(path, "w", encoding="utf-8") as file:
                    file.write(content)

