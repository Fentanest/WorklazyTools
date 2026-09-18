import json

with open("src/locales/ko/guides.json", "r", encoding="utf-8") as f:
    ko = json.load(f)

ko["hwpEditor"]["description"] = "공식 rhwp Studio 편집기를 브라우저로 불러와 외부로 파일을 전송하지 않고 HWP 문서를 수정할 수 있습니다."
ko["video"]["description"] = ko["video.page"]["description"]

with open("src/locales/ko/guides.json", "w", encoding="utf-8") as f:
    json.dump(ko, f, ensure_ascii=False, indent=2)

with open("src/locales/en/guides.json", "r", encoding="utf-8") as f:
    en = json.load(f)

en["hwpEditor"]["description"] = "Load the official rhwp Studio editor in your browser to modify HWP documents without transmitting files externally."
en["video"]["description"] = en["video.page"]["description"]

with open("src/locales/en/guides.json", "w", encoding="utf-8") as f:
    json.dump(en, f, ensure_ascii=False, indent=2)

print("Descriptions patched")
