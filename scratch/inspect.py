import json
with open("src/locales/ko/guides.json", "r") as f:
    d = json.load(f)
for k, v in d["officeEditor"].items():
    print(k, ":")
    if k == "blocks":
        for b in v:
            print("  ", b["title"])
