import json

def update_guides_json():
    with open("scratch/full_seo_ko.json", "r", encoding="utf-8") as f:
        seo_data = json.load(f)

    with open("src/locales/ko/guides.json", "r", encoding="utf-8") as f:
        ko_guides = json.load(f)

    with open("scratch/parsed_tools.json", "r", encoding="utf-8") as f:
        parsed_tools = json.load(f)
        
    with open("scratch/parsed_paths.json", "r", encoding="utf-8") as f:
        parsed_paths = json.load(f)

    toolSlugByPath = {
      "excel-merger": "excel-merger", "excel-compare": "excel-compare", "excel-cleaner": "excel-cleaner", "document-compare": "document-compare", "pdf-compare": "pdf-compare", "pdf-editor": "pdf-editor",
      "hwp-editor": "hwp-editor", "office-editor": "office-editor", "video-studio": "video-studio",
      "audio-studio": "audio-studio", "image-studio": "image-studio", "text-tools": "text-tools",
      "text-merger": "text-merger",
      "text-formatter": "text-formatter", "work-calculator": "work-calculator", "timezone-calculator": "timezone-calculator",
      "payroll-calculator": "payroll-calculator", "image-privacy": "image-privacy", "security-tools": "security-tools",
      "qr-studio": "qr-studio", "data-converter": "data-converter", "document-redactor": "document-redactor", "document-generator": "document-generator"
    }

    toolToGuideKey = {
      "excel-merger": "excel",
      "excel-compare": "excelCompare",
      "excel-cleaner": "excelCleaner",
      "document-compare": "documentCompare",
      "pdf-compare": "pdfCompare",
      "pdf-editor": "pdfEditor", # main key for pdf-editor blocks
      "office-editor": "officeEditor",
      "video-studio": "video.page", # wait, video-studio guideKey is video
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
    
    # fix video guideKey
    toolToGuideKey["video-studio"] = "video"
    
    # Update main tool blocks
    for path, data in seo_data.items():
        if "/" not in path: # Main tool
            if path in toolSlugByPath:
                slug = toolSlugByPath[path]
                guide_key = toolToGuideKey.get(slug, slug)
                
                # The old title we added
                old_title = ""
                # wait, guide_key in parsed_tools might be "converter" for data-converter
                pt_key = guide_key
                # wait, my parsed_tools used guideKey as key? Let's check parsed_tools.json keys.
                # Yes, parsed_tools has keys like "excel", "excelCompare"
                if pt_key == "video.page": pt_key = "video"
                
                if pt_key in parsed_tools and parsed_tools[pt_key]["blocks"]:
                    old_title = parsed_tools[pt_key]["blocks"].split("\n")[0]
                elif pt_key == "pdfEditor" and "pdfEditor.standard" in parsed_tools:
                    # special case for pdfEditor
                    if parsed_tools["pdfEditor.standard"]["blocks"]:
                        old_title = parsed_tools["pdfEditor.standard"]["blocks"].split("\n")[0]
                
                if old_title and guide_key in ko_guides:
                    # Find the block and update title
                    for block in ko_guides[guide_key]["blocks"]:
                        if block["title"] == old_title:
                            block["title"] = data["h2"]
                            print(f"Updated h2 for {path} in blocks")
                            break
        else:
            # Sub path (e.g. pdf-editor/merge)
            # Find the guideKey
            slug = None
            for p in toolSlugByPath:
                if path.startswith(p):
                    slug = toolSlugByPath[p]
                    break
            if slug:
                guide_key = toolToGuideKey.get(slug, slug)
                full_path = "/tools/" + path
                if guide_key in ko_guides and "pathBlocks" in ko_guides[guide_key]:
                    if full_path in ko_guides[guide_key]["pathBlocks"]:
                        # Find the block we added
                        old_title = ""
                        if full_path in parsed_paths:
                            old_title = parsed_paths[full_path]["title"]
                            
                        for block in ko_guides[guide_key]["pathBlocks"][full_path]:
                            if block["title"] == old_title:
                                block["title"] = data["h2"]
                                print(f"Updated h2 for {full_path} in pathBlocks")
                                break

    with open("src/locales/ko/guides.json", "w", encoding="utf-8") as f:
        json.dump(ko_guides, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    update_guides_json()
