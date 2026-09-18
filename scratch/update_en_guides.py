import json

with open("scratch/en_tools.json", "r", encoding="utf-8") as f:
    parsed_tools = json.load(f)

with open("scratch/en_paths.json", "r", encoding="utf-8") as f:
    parsed_paths = json.load(f)

with open("scratch/en_pages.json", "r", encoding="utf-8") as f:
    parsed_pages = json.load(f)

with open("src/locales/en/guides.json", "r", encoding="utf-8") as f:
    en_guides = json.load(f)

# Update documentCompare title
if "documentCompare" in en_guides:
    if en_guides["documentCompare"]["title"] == " How to Use":
        en_guides["documentCompare"]["title"] = "How to Use Document Compare"
    # Actually let's just make it "How to Use Document Compare" unconditionally if it's there
    if en_guides["documentCompare"]["title"] == "Usage Guide" or en_guides["documentCompare"]["title"] == " Usage Guide":
        en_guides["documentCompare"]["title"] = "Document Compare Usage Guide"

# Remove old blocks for officeEditor, documentGenerator
if "officeEditor" in en_guides:
    blocks = en_guides["officeEditor"]["blocks"]
    en_guides["officeEditor"]["blocks"] = [b for b in blocks if b["title"] not in ["Open at Once", "Initial Download", "Close Editor", "Open instantly", "Close the editor"]]
    
if "documentGenerator" in en_guides:
    blocks = en_guides["documentGenerator"]["blocks"]
    en_guides["documentGenerator"]["blocks"] = [b for b in blocks if b["title"] != "Check Preview"]

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

for guide_key, update in parsed_tools.items():
    if guide_key not in en_guides:
        en_guides[guide_key] = {"title": update["name"], "description": "", "blocks": [], "faq": {}}
        
    new_blocks = []
    
    if update.get("blocks"):
        lines = update["blocks"].split("\n")
        title = lines[0]
        paragraphs = [line.strip() for line in lines[1:] if line.strip()]
        new_blocks.append({
            "title": title,
            "paragraphs": paragraphs
        })
        
    if update.get("examples"):
        new_blocks.append({
            "title": "Examples and Selection Help",
            "paragraphs": [p for p in update["examples"].split("\n") if p.strip()]
        })
        
    en_guides[guide_key]["blocks"].extend(new_blocks)
    
    if update.get("faqs"):
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
                new_key = f"new_faq_{len(en_guides[guide_key]['faq'])}"
                en_guides[guide_key]["faq"][new_key] = {"q": q, "a": a}
                q = None
                
for path, update in parsed_paths.items():
    slug = None
    for p in toolSlugByPath:
        if path.startswith(p):
            slug = toolSlugByPath[p]
            break
            
    if slug:
        guide_key = toolToGuideKey.get(slug, slug)
        if guide_key in en_guides:
            if "pathBlocks" not in en_guides[guide_key]:
                en_guides[guide_key]["pathBlocks"] = {}
            if path not in en_guides[guide_key]["pathBlocks"]:
                en_guides[guide_key]["pathBlocks"][path] = []
            
            # Use English title mapping since subagent returned empty titles for some reason? Wait!
            # The subagent returned "title": "", let's use the first paragraph as title if title is empty.
            title = update["title"]
            paragraphs = update["paragraphs"]
            if not title and paragraphs:
                title = paragraphs[0]
                paragraphs = paragraphs[1:]
                
            en_guides[guide_key]["pathBlocks"][path].append({
                "title": title,
                "paragraphs": paragraphs
            })

with open("src/locales/en/guides.json", "w", encoding="utf-8") as f:
    json.dump(en_guides, f, ensure_ascii=False, indent=2)

print("Updated en/guides.json")

with open("src/locales/en/pages.json", "r", encoding="utf-8") as f:
    en_pages_file = json.load(f)

# Update about page
if "about" in parsed_pages:
    lines = parsed_pages["about"].split("\n")
    en_pages_file["about"]["title"] = lines[0]
    en_pages_file["about"]["description"] = lines[2] + " " + lines[3] if len(lines) > 3 else "\n".join(lines[2:4])
    en_pages_file["about"]["localDescription"] = "Selected files, entered passwords, and operation results are not transmitted to external servers. With the exception of specified caches such as recovery local drafts for HWP/Office or program files, all task data is erased when you close the tab."
    en_pages_file["about"]["appearanceDescription"] = "You can manually select light mode, dark mode, or a high-contrast theme according to your usage environment."
    en_pages_file["about"]["items"] = {
      "uploadTitle": "No Uploading", "uploadDescription": "File and password processing is conducted entirely within your browser.",
      "accountTitle": "No Account Required", "accountDescription": "There is no need to log in or enter personal information.",
      "transparentTitle": "Transparent Tools", "transparentDescription": "We do not replace all the features of professional editing software, and we clearly indicate the supported files and preservation scope for each tool."
    }

with open("src/locales/en/pages.json", "w", encoding="utf-8") as f:
    json.dump(en_pages_file, f, ensure_ascii=False, indent=2)

print("Updated en/pages.json")
