import json

with open("scratch/parsed_tools.json", "r", encoding="utf-8") as f:
    parsed_tools = json.load(f)

with open("scratch/parsed_paths.json", "r", encoding="utf-8") as f:
    parsed_paths = json.load(f)

with open("src/locales/ko/guides.json", "r", encoding="utf-8") as f:
    ko_guides = json.load(f)

# Update documentCompare title specifically mentioned in phase 1
if "documentCompare" in ko_guides:
    if ko_guides["documentCompare"]["title"] == " 사용 안내":
        ko_guides["documentCompare"]["title"] = "문서 비교 사용 안내"

# Map toolSlugByPath to guideKey
toolSlugByPath = {
  "/tools/excel-merger": "excel-merger", "/tools/excel-compare": "excel-compare", "/tools/excel-cleaner": "excel-cleaner", "/tools/document-compare": "document-compare", "/tools/pdf-compare": "pdf-compare", "/tools/pdf-editor": "pdf-editor",
  "/tools/hwp-editor": "hwp-editor", "/tools/office-editor": "office-editor", "/tools/video-studio": "video-studio",
  "/tools/audio-studio": "audio-studio", "/tools/image-studio": "image-studio", "/tools/text-tools": "text-tools",
  "/tools/text-merger": "text-merger",
  "/tools/text-formatter": "text-formatter", "/tools/work-calculator": "work-calculator", "/tools/timezone-calculator": "timezone-calculator",
  "/tools/payroll-calculator": "payroll-calculator", "/tools/image-privacy": "image-privacy", "/tools/security-tools": "security-tools",
  "/tools/qr-studio": "qr-studio", "/tools/data-converter": "data-converter", "/tools/document-redactor": "document-redactor", "/tools/document-generator": "document-generator"
}

toolToGuideKey = {
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
}

# Update tools in guides.json
for guide_key, update in parsed_tools.items():
    if guide_key not in ko_guides:
        ko_guides[guide_key] = {"title": update["name"], "description": "", "blocks": [], "faq": {}}
        
    # Append blocks
    new_blocks = []
    
    if update["blocks"]:
        lines = update["blocks"].split("\n")
        title = lines[0]
        paragraphs = []
        for line in lines[1:]:
            if line.strip():
                paragraphs.append(line.strip())
        new_blocks.append({
            "title": title,
            "paragraphs": paragraphs
        })
        
    if update["examples"]:
        new_blocks.append({
            "title": "예제 및 선택 도움",
            "paragraphs": [p for p in update["examples"].split("\n") if p.strip()]
        })
        
    ko_guides[guide_key]["blocks"].extend(new_blocks)
    
    # Update FAQs
    if update["faqs"]:
        faq_lines = update["faqs"].split("\n")
        q = None
        for line in faq_lines:
            line = line.strip()
            if not line:
                continue
            if not q:
                q = line
            else:
                a = line
                # Create a new unique faq key
                new_key = f"new_faq_{len(ko_guides[guide_key]['faq'])}"
                ko_guides[guide_key]["faq"][new_key] = {"q": q, "a": a}
                q = None
                
# Add pathBlocks
for path, update in parsed_paths.items():
    # Find matching tool slug
    slug = None
    for p in toolSlugByPath:
        if path.startswith(p):
            slug = toolSlugByPath[p]
            break
            
    if slug:
        guide_key = toolToGuideKey.get(slug, slug)
        if guide_key in ko_guides:
            if "pathBlocks" not in ko_guides[guide_key]:
                ko_guides[guide_key]["pathBlocks"] = {}
            if path not in ko_guides[guide_key]["pathBlocks"]:
                ko_guides[guide_key]["pathBlocks"][path] = []
            
            ko_guides[guide_key]["pathBlocks"][path].append({
                "title": update["title"],
                "paragraphs": update["paragraphs"]
            })

with open("src/locales/ko/guides.json", "w", encoding="utf-8") as f:
    json.dump(ko_guides, f, ensure_ascii=False, indent=2)

print("Updated ko/guides.json")
