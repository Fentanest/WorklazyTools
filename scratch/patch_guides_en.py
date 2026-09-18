import json

def update_guides_json():
    with open("scratch/full_seo_ko.json", "r", encoding="utf-8") as f:
        ko_data = json.load(f)
        
    with open("scratch/full_seo_en.json", "r", encoding="utf-8") as f:
        en_data = json.load(f)

    with open("src/locales/en/guides.json", "r", encoding="utf-8") as f:
        en_guides = json.load(f)

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
      "excel-merger": "excel", "excel-compare": "excelCompare", "excel-cleaner": "excelCleaner",
      "document-compare": "documentCompare", "pdf-compare": "pdfCompare", "pdf-editor": "pdfEditor",
      "office-editor": "officeEditor", "video-studio": "video", "audio-studio": "audio", "image-studio": "image",
      "text-tools": "textTools", "text-merger": "textMerger", "text-formatter": "formatter", "work-calculator": "work",
      "timezone-calculator": "timezone", "payroll-calculator": "payroll", "image-privacy": "imagePrivacy",
      "security-tools": "security", "qr-studio": "qr", "data-converter": "converter",
      "document-redactor": "documentRedactor", "document-generator": "documentGenerator"
    }
    
    # Wait, in the English en_guides.json, the block titles are ALREADY TRANSLATED by the translator subagent in the previous session!
    # How do we find which block to update?
    # We can assume it's the SAME INDEX as in the Korean guides.json!
    with open("src/locales/ko/guides.json", "r", encoding="utf-8") as f:
        ko_guides = json.load(f)
        
    for path, data in en_data.items():
        if "/" not in path: # Main tool
            if path in toolSlugByPath:
                slug = toolSlugByPath[path]
                guide_key = toolToGuideKey.get(slug, slug)
                
                if guide_key in en_guides and guide_key in ko_guides:
                    # Find the index of the block in ko_guides that has the NEW H2
                    ko_h2 = ko_data[path]["h2"]
                    idx_to_update = -1
                    for i, block in enumerate(ko_guides[guide_key]["blocks"]):
                        if block["title"] == ko_h2:
                            idx_to_update = i
                            break
                            
                    if idx_to_update != -1 and idx_to_update < len(en_guides[guide_key]["blocks"]):
                        en_guides[guide_key]["blocks"][idx_to_update]["title"] = data["h2"]
                        print(f"Updated en h2 for {path} in blocks")
        else:
            full_path = "/tools/" + path
            
            # Special PDF handling
            if "pdf-editor" in path:
                if full_path in en_guides.get("pdfEditor.standard", {}).get("pathBlocks", {}):
                    en_guides["pdfEditor.standard"]["pathBlocks"][full_path][0]["title"] = data["h2"]
                    print(f"Updated en h2 for {full_path}")
            elif "video-studio" in path:
                if full_path in en_guides.get("video.page", {}).get("pathBlocks", {}):
                    en_guides["video.page"]["pathBlocks"][full_path][0]["title"] = data["h2"]
                    print(f"Updated en h2 for {full_path}")
            else:
                slug = None
                for p in toolSlugByPath:
                    if path.startswith(p):
                        slug = toolSlugByPath[p]
                        break
                if slug:
                    guide_key = toolToGuideKey.get(slug, slug)
                    if guide_key in en_guides and "pathBlocks" in en_guides[guide_key]:
                        if full_path in en_guides[guide_key]["pathBlocks"]:
                            en_guides[guide_key]["pathBlocks"][full_path][0]["title"] = data["h2"]
                            print(f"Updated en h2 for {full_path}")

    with open("src/locales/en/guides.json", "w", encoding="utf-8") as f:
        json.dump(en_guides, f, ensure_ascii=False, indent=2)
    print("Updated en/guides.json")

if __name__ == "__main__":
    update_guides_json()
