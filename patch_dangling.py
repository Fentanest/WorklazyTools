import json

with open("src/locales/ko/guides.json", "r", encoding="utf-8") as f:
    ko_data = json.load(f)

if ko_data["video.page"]["pathBlocks"]["/tools/video-studio/extract-audio"][0]["paragraphs"][-1] == "오디오 자르기":
    ko_data["video.page"]["pathBlocks"]["/tools/video-studio/extract-audio"][0]["paragraphs"].pop()
if ko_data["pdfEditor.standard"]["pathBlocks"]["/tools/pdf-editor/stamp"][0]["paragraphs"][-1] == "이미지 크기 변경":
    ko_data["pdfEditor.standard"]["pathBlocks"]["/tools/pdf-editor/stamp"][0]["paragraphs"].pop()

with open("src/locales/ko/guides.json", "w", encoding="utf-8") as f:
    json.dump(ko_data, f, ensure_ascii=False, indent=2)

with open("src/locales/en/guides.json", "r", encoding="utf-8") as f:
    en_data = json.load(f)

en_paragraphs_audio = en_data["video.page"]["pathBlocks"]["/tools/video-studio/extract-audio"][0]["paragraphs"]
if len(en_paragraphs_audio) == 3: # Title, Text, Title
    en_paragraphs_audio.pop()

en_paragraphs_stamp = en_data["pdfEditor.standard"]["pathBlocks"]["/tools/pdf-editor/stamp"][0]["paragraphs"]
if len(en_paragraphs_stamp) == 3:
    en_paragraphs_stamp.pop()

with open("src/locales/en/guides.json", "w", encoding="utf-8") as f:
    json.dump(en_data, f, ensure_ascii=False, indent=2)

print("Dangling titles removed")
