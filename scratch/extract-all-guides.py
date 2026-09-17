import json

def extract_guides(in_file, out_features, out_guides):
    with open(in_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    guides = {}
    def find_and_remove(obj, path=""):
        if isinstance(obj, dict):
            # We must iterate over a list of keys since we might delete
            for k in list(obj.keys()):
                if k == "guide" and isinstance(obj[k], dict):
                    guides[path] = obj[k]
                    del obj[k]
                else:
                    find_and_remove(obj[k], path + k + "." if path else k)

    find_and_remove(data)

    # Flatten the guides slightly? Or keep the same path structure?
    # e.g. path="documentCompare.guide" -> keep as "documentCompare" in guides.json
    final_guides = { k.rstrip('.'): v for k, v in guides.items() }

    with open(out_features, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    with open(out_guides, "w", encoding="utf-8") as f:
        json.dump(final_guides, f, ensure_ascii=False, indent=2)

extract_guides("src/locales/ko/features.json", "src/locales/ko/features.json", "src/locales/ko/guides.json")
# Wait, I shouldn't modify English yet because the subagent is translating!
# Let's just create ko/guides.json first to test it.
