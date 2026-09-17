import json

with open("src/locales/en/features.json", "r", encoding="utf-8") as f:
    en_data = json.load(f)

guides_with_ko = {}
def find_guides(obj, path=""):
    if isinstance(obj, dict):
        if "guide" in obj and isinstance(obj["guide"], dict):
            import re
            title = obj["guide"].get("title", "")
            if re.search(r'[가-힣]', title):
                guides_with_ko[path + "guide"] = obj["guide"]
        for k, v in obj.items():
            find_guides(v, path + k + "." if path else k + ".")

find_guides(en_data)

for k in guides_with_ko.keys():
    print(f"Found Korean in: {k}")

with open("scratch/ko-guides-in-en.json", "w", encoding="utf-8") as f:
    json.dump(guides_with_ko, f, ensure_ascii=False, indent=2)
