import os

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

def replace_toolguide(content, slug):
    result = ""
    i = 0
    while i < len(content):
        if content[i:].startswith("<ToolGuide "):
            start = i
            # Find the end of the opening tag
            tag_end = content.find(">", start)
            if tag_end == -1:
                break
            
            # Check if it's self-closing
            is_self_closing = content[tag_end - 1] == "/"
            
            if is_self_closing:
                result += f'<ToolGuideWrapper slug="{slug}" />'
                i = tag_end + 1
            else:
                # Find the closing tag
                close_start = content.find("</ToolGuide>", tag_end)
                if close_start == -1:
                    break
                children = content[tag_end + 1:close_start]
                # Some children might have `{...}` wait, we should just preserve the children verbatim.
                # However, in DocumentRedactorPage, children had `c.guide.fallbackNotice`
                result += f'<ToolGuideWrapper slug="{slug}">{children}</ToolGuideWrapper>'
                i = close_start + len("</ToolGuide>")
        else:
            result += content[i]
            i += 1
    return result

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
            
            if "import { ToolGuide " in content:
                content = content.replace('import { ToolGuide } from "../../components/ToolGuide";', 'import { ToolGuideWrapper } from "../../components/ToolGuideWrapper";')
            
            # Revert DocumentRedactor to git state first
            if slug == "documentRedactor":
                os.system(f"git checkout {path}")
                with open(path, "r", encoding="utf-8") as file:
                    content = file.read()
                content = content.replace('import { ToolGuide } from "../../components/ToolGuide";', 'import { ToolGuideWrapper } from "../../components/ToolGuideWrapper";')
                
            new_content = replace_toolguide(content, slug)
            
            with open(path, "w", encoding="utf-8") as file:
                file.write(new_content)

