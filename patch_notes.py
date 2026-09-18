import json

with open("src/locales/ko/guides.json", "r", encoding="utf-8") as f:
    ko_data = json.load(f)

# documentCompare
dc_ko = ko_data["documentCompare"]["pathBlocks"]["/tools/document-compare/results/:pairNumber"][0]
dc_ko["title"] = "변경 표시와 원문을 함께 읽기"
dc_ko["paragraphs"] = [
    "변경 목록을 선택해 원본과 수정본의 같은 위치를 함께 확인하세요. 날짜·금액·대상자처럼 중요한 항목부터 확인하고, 연결이 모호하거나 표·서식 구조가 달라진 부분은 직접 검토하세요. 검토 기록이 필요하면 결과를 저장하세요."
]

# formatter
ko_data["formatter"]["blocks"][0]["paragraphs"][-1] = "들여쓰기는 JSON의 구조를 읽기 쉽게 정리합니다. 따옴표 안의 공백은 값의 일부이므로 서식용 공백과 구분해야 합니다. 문법 검사나 정리의 성공이 코드가 의도대로 동작한다는 것을 의미하지는 않습니다. 직접 실행해 안전성을 확인하세요."

with open("src/locales/ko/guides.json", "w", encoding="utf-8") as f:
    json.dump(ko_data, f, ensure_ascii=False, indent=2)

with open("src/locales/en/guides.json", "r", encoding="utf-8") as f:
    en_data = json.load(f)

# documentCompare
dc_en = en_data["documentCompare"]["pathBlocks"]["/tools/document-compare/results/:pairNumber"][0]
dc_en["title"] = "Reading change marks alongside the original text"
dc_en["paragraphs"] = [
    "Select a change from the list to view the corresponding location in both the original and revised documents simultaneously. Prioritize important details such as dates, amounts, and subjects. Manually review areas where the connection is ambiguous or where the table or formatting structure has changed. If you need a review record, save the results."
]

# formatter
en_data["formatter"]["blocks"][0]["paragraphs"][-1] = "Indentation makes the JSON structure easier to read. Spaces inside quotes are part of the value and should be distinguished from formatting spaces. Note that a successful syntax check or formatting does not guarantee that the code will execute safely. Always verify the safety by testing."

# converter
en_data["converter"]["blocks"][1]["paragraphs"][-1] = "This is a basic structural example using string values. For number or date formats included in your files, run the converter and check the preview to see how they are inferred and displayed."

# excelCompare
en_data["excelCompare"]["blocks"][1]["paragraphs"][-1] = "Example scenario: The left file lists 10 P-01 / 20 P-02 items, while the right lists 25 P-02 / 10 P-01. By matching based on the product code, you can accurately determine that P-01 remains unchanged and P-02's quantity has changed, even if the row order is completely different."

with open("src/locales/en/guides.json", "w", encoding="utf-8") as f:
    json.dump(en_data, f, ensure_ascii=False, indent=2)

print("Notes fixed")
