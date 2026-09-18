import json

with open("scratch/full_seo_ko.json", "r", encoding="utf-8") as f:
    seo_data = json.load(f)

with open("src/locales/ko/guides.json", "r", encoding="utf-8") as f:
    ko_guides = json.load(f)

for path, data in seo_data.items():
    if "/" in path:
        full_path = "/tools/" + path
        if full_path in ko_guides.get("pdfEditor.standard", {}).get("pathBlocks", {}):
            ko_guides["pdfEditor.standard"]["pathBlocks"][full_path][0]["title"] = data["h2"]
            print(f"Fixed {full_path}")
        if full_path in ko_guides.get("video.page", {}).get("pathBlocks", {}):
            ko_guides["video.page"]["pathBlocks"][full_path][0]["title"] = data["h2"]
            print(f"Fixed {full_path}")

with open("src/locales/ko/guides.json", "w", encoding="utf-8") as f:
    json.dump(ko_guides, f, ensure_ascii=False, indent=2)
