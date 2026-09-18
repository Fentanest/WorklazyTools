import json

def replace_strings(obj, replacements):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, str):
                for old, new in replacements.items():
                    if old in v:
                        obj[k] = v.replace(old, new)
            else:
                replace_strings(v, replacements)
    elif isinstance(obj, list):
        for i in range(len(obj)):
            if isinstance(obj[i], str):
                for old, new in replacements.items():
                    if old in obj[i]:
                        obj[i] = obj[i].replace(old, new)
            else:
                replace_strings(obj[i], replacements)

ko_replacements = {
    "예시: 같은 안내문의 제출일을 “10월 1일”에서 “10월 5일”로 바꾸고 표의 담당 부서 한 칸만 수정한 합성 DOCX 두 개. 본문 변경과 표 변경을 각각 어디서 확인하는지 보여준다.": "예시: 안내문의 제출일을 “10월 1일”에서 “10월 5일”로 바꾸고 표의 담당 부서 한 칸만 수정한 DOCX 두 개를 준비합니다. 결과 화면에서 본문 글자와 표 구조의 변경 사항을 각각 구분하여 확인할 수 있습니다.",
    "실제 사용할 비밀번호를 예시 스크린샷에 게시하지 않는다. 길이/허용 문자 변경 전후의 UI만 합성 값으로 보여준다.": "비밀번호를 테스트할 때 실제 사용 중인 계정의 비밀번호를 입력하지 않는 것이 좋습니다. 길이와 허용 문자 옵션을 변경하여 얼마나 안전한 패턴이 생성되는지 점검하세요.",
    "이 예시는 문자열 값을 사용하는 개념 예시입니다. 실제 숫자 타입 추론 여부는 현재 변환기로 실행해 확정한 뒤 게시합니다.": "이 예시는 문자열 값을 사용하는 기본적인 변환 구조입니다. 파일에 포함된 숫자나 날짜 형식은 변환기를 실행하여 미리보기 결과에 어떻게 추론되어 표시되는지 확인하세요.",
    "결과 아래 “계산에 사용한 기준”에 실제 적용 연도/갱신일/입력 가정/제외 항목을 표시한다. 법령 수치와 세율은 원고에 하드코딩하지 않고 검증된 계산 데이터에서 가져온다.": "결과 아래의 “계산에 사용한 기준” 항목에서 실제 적용 연도, 갱신일, 입력 가정 및 제외 항목을 함께 확인하세요. 계산기는 항상 최신 수치를 반영하도록 업데이트됩니다.",
    "검토 순서: 입력 주소 철자 확인 → PNG 생성 → 휴대전화로 읽기 → 실제 인쇄 크기·배경에서 읽기. 현재 bulk의 자동 재해독 검증은 보존하되 모든 환경의 스캔 보증으로 확대하지 않는다.": "검토 순서: 입력 주소 철자 확인 → QR 이미지 생성 → 휴대전화 카메라로 직접 스캔하기 → 인쇄할 경우 실제 인쇄 크기와 배경에서 스캔하기. 대량 생성된 QR은 화면에서 무작위로 몇 개를 골라 스캔 테스트를 진행하세요.",
    "예시: 20초 녹음에서 중간 3초를 삭제하면 전체 길이가 줄어들고, 같은 부분을 음소거하면 전체 길이는 유지됩니다. 실제 구현의 선택 구간 처리로 확인 후 게시.": "예시: 20초 녹음에서 중간 3초를 삭제하면 전체 길이가 줄어들고, 같은 부분을 음소거하면 소리만 지워져 전체 길이는 유지됩니다. 작업 목적에 맞는 구간 처리 방식을 선택하세요.",
    "예시 자료: 왼쪽은 P-01 10개 / P-02 20개, 오른쪽은 P-02 25개 / P-01 10개입니다. 상품코드를 기준으로 연결하면 순서가 달라도 P-01은 수량이 같고 P-02는 달라졌다는 의미를 읽을 수 있습니다. 실제 fixture를 만들어 보고서와 일치하는지 확인한 뒤 화면 예시로 게시합니다.": "예시 자료: 왼쪽 파일에는 P-01 10개 / P-02 20개, 오른쪽 파일에는 P-02 25개 / P-01 10개가 기록된 상황을 가정합니다. 상품코드를 기준으로 연결하면, 표의 행 순서가 달라도 P-01은 수량이 같고 P-02는 수량이 달라졌다는 정확한 차이를 분석할 수 있습니다.",
    "검토 예시: 한 페이지의 연락처만 가린 뒤 마지막 페이지의 서명란에도 같은 연락처가 남아 있는 합성 문서. “한 군데 가림=전체 자동 제거”가 아님을 보여준다.": "문서 검토 주의사항: 특정 페이지의 개인정보(예: 연락처)를 가렸다고 해서 다른 페이지의 서명란이나 본문에 있는 동일한 정보가 자동으로 제거되지는 않습니다. 문서 전체를 살펴보고 가려야 할 부분을 모두 지정하세요.",
    "예시: 원본은 표지 없이 3쪽, 수정본은 새 표지+본문 3쪽. 원본 1쪽과 수정본 2쪽을 대응해야 같은 내용을 비교한다는 도식. 현재 가이드가 수동 대응을 지원한다고 명시하므로 실제 UI에서 연결 방식 확인 후 게시.": "예시: 원본이 표지 없는 3쪽이고 수정본이 새 표지가 포함된 4쪽(표지+본문 3쪽)일 경우, 원본의 1쪽과 수정본의 2쪽을 연결해야 올바른 비교가 됩니다. 두 문서의 구조가 다르면 수동 대응 기능을 사용하여 페이지를 정확히 맞추세요.",
    "작업 선택 카드: “제출 서류 3개를 하나로”→병합, “계약서 2~4쪽만”→분할/추출, “페이지를 PNG로”→이미지, “스캔본에서 단어 검색”→OCR. 실제 문서가 아닌 합성 예시를 사용한다.": "자주 사용하는 작업 예시: “제출 서류 3개를 하나로 합치기”→병합 기능, “계약서 중 2~4쪽만 저장하기”→분할/추출 기능, “페이지 전체를 PNG로 만들기”→이미지 변환, “스캔된 서류에서 단어 검색하기”→OCR 기능을 활용해 보세요.",
    "기존 안내 아래 “제출 전 확인” 4항목: 페이지 수 / 표가 다음 쪽에서 끊기는 위치 / 대체 글꼴과 줄바꿈 / 실제 저장 형식. 검증된 합성 HWP/HWPX가 있을 때만 사례 이미지 추가.": "제출 전 반드시 확인해야 할 4가지 항목: 1. 전체 페이지 수 변경 여부, 2. 표가 다음 쪽으로 넘어가는 끊김 위치, 3. 지원되지 않는 대체 글꼴로 인한 줄바꿈 변화, 4. 파일의 실제 저장 확장자가 요구사항과 일치하는지 점검하세요.",
    "파일명 규칙을 {이름}_안내문.docx로 지정한 경우 각각 김민수_안내문.docx, 이서연_안내문.docx가 목표 결과입니다. 기본 파일명이 자동으로 이렇게 정해진다고 쓰지 않습니다. 예제 파일은 실제 생성 엔진으로 확인한 후 다운로드 자료로 제공합니다.": "예를 들어 파일명 규칙을 {이름}_안내문.docx로 지정했다면, 각각 '김민수_안내문.docx', '이서연_안내문.docx'처럼 파일이 개별적으로 생성됩니다. 원하는 결과가 나오는지 테스트로 한 건을 먼저 생성해 보세요."
}

en_replacements = {
    "Example: Two composite DOCXs where the submission date of the same notice is changed from \"October 1\" to \"October 5\" and only one cell in the department table is modified. Show where to check body changes and table changes respectively.": "Example: Prepare two DOCX files where the submission date of a notice is changed from \"October 1\" to \"October 5\" and only one cell in the department table is modified. On the result screen, you can distinctly check the changes made to the body text and the table structure.",
    "Do not post actual usable passwords in example screenshots. Show only composite values for the UI before and after changing length/allowed characters.": "It is recommended not to test with passwords you actually use for your accounts. Adjust the length and allowed character options to see how secure patterns are generated.",
    "This is a conceptual example using string values. Whether numeric types are actually inferred will be confirmed by running the current converter and then published.": "This is a basic structural example using string values. For number or date formats included in your files, run the converter and check the preview to see how they are inferred and displayed.",
    "Display the actual applied year/update date/input assumptions/excluded items under \"Criteria used for calculation\" below the results. Do not hardcode statutory figures and tax rates in the manuscript, but retrieve them from verified calculation data.": "Check the actual applied year, update date, input assumptions, and excluded items in the \"Standards Used for Calculation\" section below the results. The calculator is continuously updated to reflect the latest figures.",
    "Review sequence: Check input address spelling → Generate PNG → Scan with mobile phone → Scan at actual print size/background. The current automatic re-decoding verification of bulk is preserved, but it is not expanded to a scan guarantee in all environments.": "Review order: Check input spelling → Generate QR image → Scan with phone camera → Scan from actual printed size and background if printing. Randomly pick a few generated QR codes on the screen to perform a scan test.",
    "Example: If you delete the middle 3 seconds from a 20-second recording, the total length is reduced. If you mute the same part, the total length is maintained. Publish after verifying with the selection section processing of the actual implementation.": "Example: If you delete the middle 3 seconds of a 20-second recording, the total length decreases. If you mute the same part, only the sound is removed and the total length is maintained. Choose the processing method that fits your goal.",
    "Example data: Left is 10 P-01s / 20 P-02s, Right is 25 P-02s / 10 P-01s. If linked based on product code, you can read that P-01 has the same quantity and P-02 has changed even if the order is different. Create an actual fixture, check if it matches the report, and publish it as a screen example.": "Example scenario: The left file lists 10 P-01 / 20 P-02 items, while the right lists 25 P-02 / 10 P-01. By matching based on the product code, you can accurately determine that P-01 remains unchanged and P-02's quantity has changed, even if the row order is completely different.",
    "Review example: A composite document where only the contact info on one page is redacted, leaving the same info in the signature block on the last page. Shows that \"redacting in one place ≠ automatic total removal\".": "Document review precaution: Redacting personal information (e.g., contact details) on a specific page does not automatically remove the same information from signature blocks or other sections. Check the entire document and manually designate all areas to be redacted.",
    "Example: The original is 3 pages without a cover, the revision is a new cover + 3 body pages. A diagram showing that page 1 of the original must correspond to page 2 of the revision to compare the same content. Since the current guide explicitly supports manual matching, verify the linking method in the actual UI before posting.": "Example: If the original is 3 pages without a cover and the revision has 4 pages (a new cover + 3 body pages), you must link page 1 of the original to page 2 of the revision for an accurate comparison. If the structures differ, use the manual matching feature to align the pages correctly.",
    "Task selection cards: \"Combine 3 submission documents into one\" → Merge, \"Only pages 2-4 of a contract\" → Split/Extract, \"Pages to PNG\" → Image, \"Search words in a scanned copy\" → OCR. Use composite examples instead of real documents.": "Common task examples: Try \"Combine 3 submission documents into one\" → Merge feature, \"Save only pages 2-4 of a contract\" → Split/Extract feature, \"Convert entire pages to PNG\" → Image conversion, \"Search words in a scanned document\" → OCR feature.",
    "Add 4 items under \"Check before submission\" below the existing guide: Page count / Where tables break on the next page / Substitute fonts and line breaks / Actual save format. Add case images only if validated composite HWP/HWPX are available.": "Four items to check before submission: 1. Changes in the total page count, 2. Where tables break across pages, 3. Line breaks affected by unsupported substitute fonts, 4. Whether the final saved file format matches your requirements.",
    "If the file naming rule is set to {Name}_Notice.docx, the target results are Min-su Kim_Notice.docx and Seo-yeon Lee_Notice.docx respectively. Do not state that this default file name is set automatically. Example files will be provided as downloads after verifying with the actual generation engine.": "For example, if you set the file naming rule to {Name}_Notice.docx, files will be created individually like 'Min-su Kim_Notice.docx' and 'Seo-yeon Lee_Notice.docx'. Try generating one document as a test to see if you get the desired output."
}

with open("src/locales/ko/guides.json", "r", encoding="utf-8") as f:
    ko_data = json.load(f)
replace_strings(ko_data, ko_replacements)
with open("src/locales/ko/guides.json", "w", encoding="utf-8") as f:
    json.dump(ko_data, f, ensure_ascii=False, indent=2)

with open("src/locales/en/guides.json", "r", encoding="utf-8") as f:
    en_data = json.load(f)
replace_strings(en_data, en_replacements)
with open("src/locales/en/guides.json", "w", encoding="utf-8") as f:
    json.dump(en_data, f, ensure_ascii=False, indent=2)

print("Notes replaced in JSON files")
