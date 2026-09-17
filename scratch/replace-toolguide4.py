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

def replace_guides(content, slug):
    if slug == "documentRedactor":
        # special case for children
        i = content.find("<ToolGuide")
        while i != -1:
            end_open = content.find(">", i)
            if content[end_open-1] == "/":
                content = content[:i] + f'<ToolGuideWrapper slug="{slug}" />' + content[end_open+1:]
            else:
                end_close = content.find("</ToolGuide>", end_open)
                children = content[end_open+1:end_close]
                content = content[:i] + f'<ToolGuideWrapper slug="{slug}">{children}</ToolGuideWrapper>' + content[end_close+len("</ToolGuide>"):]
            i = content.find("<ToolGuide", i + 10)
    else:
        i = content.find("<ToolGuide")
        while i != -1:
            # find end of tag
            end_idx = content.find("/>", i)
            end_close = content.find("</ToolGuide>", i)
            
            # which comes first?
            if end_idx != -1 and (end_close == -1 or end_idx < end_close):
                content = content[:i] + f'<ToolGuideWrapper slug="{slug}" />' + content[end_idx+2:]
            elif end_close != -1:
                content = content[:i] + f'<ToolGuideWrapper slug="{slug}" />' + content[end_close+len("</ToolGuide>"):]
            
            i = content.find("<ToolGuide", i + 10)
    return content

os.system("git checkout src/features/")

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
            
            orig = content
            
            if "ToolGuide" in content:
                content = content.replace('import { ToolGuide } from "../../components/ToolGuide";', 'import { ToolGuideWrapper } from "../../components/ToolGuideWrapper";')
                
                content = replace_guides(content, slug)
                
                if content != orig:
                    with open(path, "w", encoding="utf-8") as file:
                        file.write(content)

