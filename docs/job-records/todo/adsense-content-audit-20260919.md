# AdSense 재심사 콘텐츠 감사 — 잔존 편집자 메모·고아 제목 항목표

- 작성: Claude, 2026-09-19
- 소스 기준: origin/main 29fe72c (guides.json은 a946a0b와 39건 모두 동일 문장)
- 운영 기준: worklazy.net 정적 HTML(a946a0b 배포본). 런타임(JS 실행 후 화면)은 별도 미확인이나 같은 guides.json을 번들하므로 소스 잔존 = 런타임 노출로 추정
- 판정 열 의미: 노출 확인 = 운영 정적 HTML에 해당 문장 존재 / 연결 없음 = 어떤 도구도 그 가이드 키를 읽지 않음 / 정적 미노출 = 격리 라우트 전용 템플릿이 가이드 블록을 넣지 않음
- 검출 기준: KO는 '…다.'로 끝나고 '…니다.'가 아닌 문단, EN은 Example:/Show/Explain/Do not… 시작 또는 fixture·composite·arbitrary dates 포함, 고아 제목은 pathBlocks 마지막 문단이 40자 미만·종결부호 없음. 의미 판별은 사람이 다시 해야 함

| # | 유형 | 언어 | 가이드 키 | JSON 경로 | 연결 경로 | 운영 정적 HTML | 원문(앞 90자) |
|---|---|---|---|---|---|---|---|
| 1 | 메모 | ko | `textMerger` | `textMerger.blocks[3].paragraphs[0]` | /tools/text-merger | 노출 확인 | 카드 순서: 직접 입력 “1. 오전 회의” → 오전.txt → 직접 입력 “2. 오후 회의” → 오후.txt. 구분자 빈 줄을 선택한 결과를 보여준다. |
| 2 | 메모 | ko | `textTools` | `textTools.blocks[3].paragraphs[3]` | /tools/text-tools | 노출 확인 | 대구”는 항목 경계를 유지해야 하는 목록이다. 실제 결합 시 공백 처리 결과와 예문을 맞춘다. |
| 3 | 메모 | ko | `work` | `work.blocks[3].paragraphs[0]` | /tools/work-calculator | 노출 확인 | 예시: 같은 날짜 범위를 두고 회사 휴무일 한 날을 추가했을 때 영업일 수가 어떻게 바뀌는지 보여준다. 실제 공휴일 날짜를 임의로 정해 사례에 쓰지 않는다. |
| 4 | 메모 | ko | `imagePrivacy` | `imagePrivacy.blocks[3].paragraphs[0]` | /tools/image-privacy | 노출 확인 | 예시를 만들 때 실제 GPS 좌표·기기 소유자 이름을 쓰지 않는다. “보이는 정보/숨은 정보” 두 칸으로 구분해 도구 선택을 돕는다. |
| 5 | 메모 | ko | `timezone` | `timezone.blocks[4].paragraphs[0]` | /tools/timezone-calculator | 노출 확인 | 예시 문장 형식: “서울: ○월 ○일 ○시 / 다른 도시: ○월 ○일 ○시”. 고정 시차 숫자 대신 실제 선택 결과가 들어가게 하며, 날짜가 다른 도시를 별도 표… |
| 6 | 메모 | ko | `excel` | `excel.blocks[5].paragraphs[0]` | /tools/excel-merger | 노출 확인 | 예시: 1월·2월 자료를 각 탭으로 남기면 시트별, 같은 열의 거래내역을 아래로 이어 붙이면 세로. 가로 병합은 두 자료의 행 순서가 같다는 전제에서 사용한다. … |
| 7 | 메모 | ko | `image` | `image.blocks[5].paragraphs[0]` | /tools/image-studio | 노출 확인 | 예시: 가로 1600px 사진을 800px로 줄이기와, 사진은 유지하고 정사각 캔버스에 여백 넣기를 나란히 설명. 자동 크롭/배경제거 기능으로 오해시키지 않는다. |
| 8 | 메모 | ko | `video` | `video.blocks[1].paragraphs[0]` | — | 연결 없음(미노출) | 예시: 회의 녹화에서 00:30~01:10을 남기는 경우. 빠른 복사와 다시 변환의 의미를 설명하되, 모든 파일에서 정확히 같은 성능·품질 수치를 약속하지 않는다… |
| 9 | 메모 | en | `documentCompare` | `documentCompare.blocks[4].paragraphs[0]` | /tools/document-compare | 노출 확인 | Example: Prepare two DOCX files where the submission date of a notice is changed from "Oct… |
| 10 | 메모 | en | `textTools` | `textTools.blocks[3].paragraphs[0]` | /tools/text-tools | 노출 확인(이스케이프 문자열로 재검) | Example: The sentence "Please check |
| 11 | 메모 | en | `work` | `work.blocks[3].paragraphs[0]` | /tools/work-calculator | 노출 확인 | Example: Show how the number of business days changes when one company holiday is added to… |
| 12 | 메모 | en | `imagePrivacy` | `imagePrivacy.blocks[3].paragraphs[0]` | /tools/image-privacy | 노출 확인 | Do not use real GPS coordinates or device owner names when creating examples. Distinguish … |
| 13 | 메모 | en | `excel` | `excel.blocks[5].paragraphs[0]` | /tools/excel-merger | 노출 확인 | Example: Leaving January and February data in separate tabs is merge by sheet; appending t… |
| 14 | 메모 | en | `audio` | `audio.blocks[8].paragraphs[0]` | /tools/audio-studio | 노출 확인 | Example: Deleting the middle 3 seconds of a 20-second recording reduces the total length, … |
| 15 | 메모 | en | `image` | `image.blocks[5].paragraphs[0]` | /tools/image-studio | 노출 확인 | Example: Explain shrinking a 1600px wide photo to 800px side-by-side with keeping the phot… |
| 16 | 메모 | en | `excelCleaner` | `excelCleaner.blocks[4].paragraphs[0]` | /tools/excel-cleaner | 노출 확인(이스케이프 문자열로 재검) | Example: "Seoul " and "Seoul" can become the same value after whitespace cleanup. However,… |
| 17 | 메모 | en | `pdfCompare` | `pdfCompare.blocks[2].paragraphs[0]` | /tools/pdf-compare | 노출 확인 | Example: If the original is 3 pages without a cover and the revision has 4 pages (a new co… |
| 18 | 메모 | en | `officeEditor` | `officeEditor.blocks[4].paragraphs[0]` | /tools/office-editor | 노출 확인(이스케이프 문자열로 재검) | Short status guide: "Preparing editing environment — You can select a file in advance." / … |
| 19 | 메모 | en | `video` | `video.blocks[1].paragraphs[0]` | — | 연결 없음(미노출) | Example: Keeping 00:30~01:10 from a meeting recording. Explain the meaning of quick copy v… |
| 20 | 고아제목 | ko | `qr` | `qr.pathBlocks['/tools/qr-studio/bulk'][0].paragraphs[2]` | /tools/qr-studio/bulk | 노출 확인 | XLS 보존 작업 |
| 21 | 고아제목 | ko | `excel` | `excel.pathBlocks['/tools/excel-merger/xls-preserve'][0].paragraphs[2]` | /tools/excel-merger/xls-preserve | 정적 미노출(격리 템플릿)·런타임 미확인 | 문서 비교 결과 |
| 22 | 고아제목 | ko | `audio` | `audio.pathBlocks['/tools/audio-studio/trim'][0].paragraphs[2]` | /tools/audio-studio/trim | 노출 확인 | QR 일괄 생성 |
| 23 | 고아제목 | ko | `image` | `image.pathBlocks['/tools/image-studio/resize'][0].paragraphs[2]` | /tools/image-studio/resize | 노출 확인 | 이미지 모자이크 |
| 24 | 고아제목 | ko | `image` | `image.pathBlocks['/tools/image-studio/mosaic'][0].paragraphs[2]` | /tools/image-studio/mosaic | 노출 확인 | 이미지 워터마크 |
| 25 | 고아제목 | ko | `image` | `image.pathBlocks['/tools/image-studio/watermark'][0].paragraphs[2]` | /tools/image-studio/watermark | 노출 확인 | 영상 자르기 |
| 26 | 고아제목 | ko | `video.page` | `video.page.pathBlocks['/tools/video-studio/trim'][0].paragraphs[2]` | /tools/video-studio/trim | 노출 확인 | 영상 합치기 |
| 27 | 고아제목 | ko | `video.page` | `video.page.pathBlocks['/tools/video-studio/merge'][0].paragraphs[2]` | /tools/video-studio/merge | 노출 확인 | 영상 음원 추출 |
| 28 | 고아제목 | en | `qr` | `qr.pathBlocks['/tools/qr-studio/bulk'][0].paragraphs[1]` | /tools/qr-studio/bulk | 노출 확인 | Preserve XLS |
| 29 | 고아제목 | en | `excel` | `excel.pathBlocks['/tools/excel-merger/xls-preserve'][0].paragraphs[1]` | /tools/excel-merger/xls-preserve | 정적 미노출(격리 템플릿)·런타임 미확인 | Document Comparison Results |
| 30 | 고아제목 | en | `audio` | `audio.pathBlocks['/tools/audio-studio/trim'][0].paragraphs[1]` | /tools/audio-studio/trim | 노출 확인 | Bulk Generate QR |
| 31 | 고아제목 | en | `image` | `image.pathBlocks['/tools/image-studio/resize'][0].paragraphs[1]` | /tools/image-studio/resize | 노출 확인 | Mosaic Image |
| 32 | 고아제목 | en | `image` | `image.pathBlocks['/tools/image-studio/mosaic'][0].paragraphs[1]` | /tools/image-studio/mosaic | 노출 확인 | Image Watermark |
| 33 | 고아제목 | en | `image` | `image.pathBlocks['/tools/image-studio/watermark'][0].paragraphs[1]` | /tools/image-studio/watermark | 노출 확인 | Trim Video |
| 34 | 고아제목 | en | `video.page` | `video.page.pathBlocks['/tools/video-studio/trim'][0].paragraphs[1]` | /tools/video-studio/trim | 노출 확인 | Merge Video |
| 35 | 고아제목 | en | `video.page` | `video.page.pathBlocks['/tools/video-studio/merge'][0].paragraphs[1]` | /tools/video-studio/merge | 노출 확인 | Extract Audio from Video |
| 36 | 고아제목 | en | `video.page` | `video.page.pathBlocks['/tools/video-studio/extract-audio'][0].paragraphs[1]` | /tools/video-studio/extract-audio | 노출 확인 | Trim Audio |
| 37 | 고아제목 | en | `pdfEditor.standard` | `pdfEditor.standard.pathBlocks['/tools/pdf-editor/pdf-to-image'][0].paragraphs[1]` | /tools/pdf-editor/pdf-to-image | 노출 확인 | Convert PDF Document |
| 38 | 고아제목 | en | `pdfEditor.standard` | `pdfEditor.standard.pathBlocks['/tools/pdf-editor/watermark'][0].paragraphs[1]` | /tools/pdf-editor/watermark | 노출 확인(이스케이프 문자열로 재검) | PDF Stamp & Signature Image |
| 39 | 고아제목 | en | `pdfEditor.standard` | `pdfEditor.standard.pathBlocks['/tools/pdf-editor/stamp'][0].paragraphs[1]` | /tools/pdf-editor/stamp | 노출 확인 | Resize Image |