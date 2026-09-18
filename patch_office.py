import json

with open("src/locales/ko/guides.json", "r", encoding="utf-8") as f:
    ko_guides = json.load(f)

# Office Editor
if "officeEditor" in ko_guides:
    blocks = ko_guides["officeEditor"]["blocks"]
    ko_guides["officeEditor"]["blocks"] = [b for b in blocks if b["title"] not in ["한 번에 열기", "초기 다운로드", "편집기 닫기"]]

# Document Generator
if "documentGenerator" in ko_guides:
    blocks = ko_guides["documentGenerator"]["blocks"]
    # The old blocks were "미리 보기 확인", "개별 양식 파일", maybe others?
    ko_guides["documentGenerator"]["blocks"] = [b for b in blocks if b["title"] != "미리 보기 확인"]

with open("src/locales/ko/guides.json", "w", encoding="utf-8") as f:
    json.dump(ko_guides, f, ensure_ascii=False, indent=2)
