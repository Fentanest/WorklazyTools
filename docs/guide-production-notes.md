# Guide production notes

## Route-specific FAQ policy

- A route listed in `pathFaqs` renders only the FAQ IDs in that route's selection.
- Every configured selection must contain at least one ID. `scripts/validate-guides.mjs` rejects empty selections.
- A route without a `pathFaqs` entry falls back to every FAQ in the resolved guide.
- A guide key with two or more validated `(slug, route)` FAQ connections requires a non-empty explicit `pathFaqs` selection for every connected route.
- `/tools/pdf-editor/convert` and `/tools/pdf-editor/ocr` always require explicit selections in `pdfEditor.convert`.

## Removed production notes

Content-writing instructions removed from user-facing guides are recorded here by guide key and JSON path.

1. `ko:textMerger.blocks[3].paragraphs[0]` — 카드 순서: 직접 입력 “1. 오전 회의” → 오전.txt → 직접 입력 “2. 오후 회의” → 오후.txt. 구분자 빈 줄을 선택한 결과를 보여준다.
2. `ko:textTools.blocks[3].paragraphs[0..3]` — 예시: 문장 “보고서를\n확인해 주세요.”는 줄바꿈 합치기 대상이 될 수 있지만 “서울\n부산\n대구”는 항목 경계를 유지해야 하는 목록이다. 실제 결합 시 공백 처리 결과와 예문을 맞춘다.
3. `ko:work.blocks[3].paragraphs[0]` — 예시: 같은 날짜 범위를 두고 회사 휴무일 한 날을 추가했을 때 영업일 수가 어떻게 바뀌는지 보여준다. 실제 공휴일 날짜를 임의로 정해 사례에 쓰지 않는다.
4. `ko:imagePrivacy.blocks[3].paragraphs[0]` — 예시를 만들 때 실제 GPS 좌표·기기 소유자 이름을 쓰지 않는다. “보이는 정보/숨은 정보” 두 칸으로 구분해 도구 선택을 돕는다.
5. `ko:timezone.blocks[4].paragraphs[0]` — 예시 문장 형식: “서울: ○월 ○일 ○시 / 다른 도시: ○월 ○일 ○시”. 고정 시차 숫자 대신 실제 선택 결과가 들어가게 하며, 날짜가 다른 도시를 별도 표시한다.
6. `ko:excel.blocks[5].paragraphs[0]` — 예시: 1월·2월 자료를 각 탭으로 남기면 시트별, 같은 열의 거래내역을 아래로 이어 붙이면 세로. 가로 병합은 두 자료의 행 순서가 같다는 전제에서 사용한다. 제목 행을 자동으로 한 번만 남긴다고 안내하지 않는다.
7. `ko:image.blocks[5].paragraphs[0]` — 예시: 가로 1600px 사진을 800px로 줄이기와, 사진은 유지하고 정사각 캔버스에 여백 넣기를 나란히 설명. 자동 크롭/배경제거 기능으로 오해시키지 않는다.
8. `ko:video.blocks[1].paragraphs[0]` — 예시: 회의 녹화에서 00:30~01:10을 남기는 경우. 빠른 복사와 다시 변환의 의미를 설명하되, 모든 파일에서 정확히 같은 성능·품질 수치를 약속하지 않는다.
9. `en:documentCompare.blocks[4].paragraphs[0]` — Example: Prepare two DOCX files where the submission date of a notice is changed from "October 1" to "October 5" and only one cell in the department table is modified. On the result screen, you can distinctly check the changes made to the body text and the table structure.
10. `en:textTools.blocks[3].paragraphs[0..3]` — Example: The sentence "Please check\nthe report." can be a target for Merge Line Breaks, but "Seoul\nBusan\nDaegu" is a list that must maintain item boundaries. Ensure the actual combination result regarding whitespace processing matches the example sentences.
11. `en:work.blocks[3].paragraphs[0]` — Example: Show how the number of business days changes when one company holiday is added to the same date range. Do not assign arbitrary dates to actual public holidays for use in examples.
12. `en:imagePrivacy.blocks[3].paragraphs[0]` — Do not use real GPS coordinates or device owner names when creating examples. Distinguish between "visible information / hidden information" in two columns to help users choose the right tool.
13. `en:excel.blocks[5].paragraphs[0]` — Example: Leaving January and February data in separate tabs is merge by sheet; appending transaction details of the same columns downward is vertical merge. Horizontal merge assumes the row order of both datasets is identical. Do not state that the header row is automatically kept only once.
14. `en:audio.blocks[8].paragraphs[0]` — Example: Deleting the middle 3 seconds of a 20-second recording reduces the total length, while muting the same part maintains the total length. Post after confirming with the actual implementation of selected section processing.
15. `en:image.blocks[5].paragraphs[0]` — Example: Explain shrinking a 1600px wide photo to 800px side-by-side with keeping the photo as is and adding margins to a square canvas. Do not mislead users into thinking it has automatic crop/background removal features.
16. `en:excelCleaner.blocks[4].paragraphs[0]` — Example: "Seoul " and "Seoul" can become the same value after whitespace cleanup. However, if "0012" and "12" are product codes, they might be different values, so do not apply number conversion first.
17. `en:pdfCompare.blocks[2].paragraphs[0]` — Example: If the original is 3 pages without a cover and the revision has 4 pages (a new cover + 3 body pages), you must link page 1 of the original to page 2 of the revision for an accurate comparison. If the structures differ, use the manual matching feature to align the pages correctly.
18. `en:officeEditor.blocks[4].paragraphs[0]` — Short status guide: "Preparing editing environment — You can select a file in advance." / "Preparation complete — Drop the file to edit." / "Opening document" / "Downloaded the saved file." Connect the displays to the actual statuses.
19. `en:video.blocks[1].paragraphs[0]` — Example: Keeping 00:30~01:10 from a meeting recording. Explain the meaning of quick copy vs. re-conversion, but do not promise exact performance/quality numbers across all files.
