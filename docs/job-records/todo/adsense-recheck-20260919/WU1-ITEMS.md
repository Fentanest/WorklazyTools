# WU1 39-item content review

- 기준: `docs/jobs/todo/adsense-content-audit-20260919.md` 39행
- 검증 산출물: `/tmp/wl-adsense/wu1/content-check.json`
- 상태 집계: 수정 17 / 유지 0 / 제거 20 / 미연결 삭제 2 / 격리 미노출 0
- 정적 확인: 연결 경로의 `main.seo-static-fallback` 가이드 위치. xls-preserve는 격리 정적 문서에 가이드가 없음을 별도 기록.
- 런타임 확인: 4181 preview의 `section[data-ui-component="tool-guide"]`. #17·#18은 기존 런타임 가이드 미노출을 별도 기록.

| # | 언어 | 가이드 키 / JSON 경로 | 연결 경로 | 원문 | 판단 | 변경 문구 또는 처리 | 정적 출력 | 런타임 |
|---:|---|---|---|---|---|---|---|---|
| 1 | ko | `textMerger.blocks[3].paragraphs[0]` | `/tools/text-merger` | production notes #1 | 수정 | “직접 입력 카드와 TXT 파일을 한 목록…” | 옛 문구 없음·새 문구 있음 | 동일 |
| 2 | ko | `textTools.blocks[3].paragraphs[0..3]` | `/tools/text-tools` | production notes #2 | 수정 | 분리된 네 문자열을 “문장 중간에서 끊긴 줄바꿈…” 한 문단으로 교체 | 옛 문구 없음·새 문구 있음 | 동일 |
| 3 | ko | `work.blocks[3].paragraphs[0]` | `/tools/work-calculator` | production notes #3 | 수정 | “같은 날짜 범위라도 회사 휴무일…” | 옛 문구 없음·새 문구 있음 | 동일 |
| 4 | ko | `imagePrivacy.blocks[3].paragraphs[0]` | `/tools/image-privacy` | production notes #4 | 수정 | “GPS 좌표와 기기 소유자 정보처럼…” | 옛 문구 없음·새 문구 있음 | 동일 |
| 5 | ko | `timezone.blocks[4].paragraphs[0]` | `/tools/timezone-calculator` | production notes #5 | 수정 | “도시를 선택하면 각 지역의 현지 날짜…” | 옛 문구 없음·새 문구 있음 | 동일 |
| 6 | ko | `excel.blocks[5].paragraphs[0]` | `/tools/excel-merger` | production notes #6 | 수정 | 병합 방식과 반복 제목 행 확인 안내 | 옛 문구 없음·새 문구 있음 | 동일 |
| 7 | ko | `image.blocks[5].paragraphs[0]` | `/tools/image-studio` | production notes #7 | 수정 | 크기/캔버스 차이와 자동 배경 제거 미지원 설명 | 옛 문구 없음·새 문구 있음 | 동일 |
| 8 | ko | `video.blocks[1].paragraphs[0]` | — | production notes #8 | 미연결 삭제 | 코드·검사기·테스트에 가이드 키 참조 없음 확인 후 `video` 키 삭제 | JSON 키 없음 | 연결 없음 |
| 9 | en | `documentCompare.blocks[4].paragraphs[0]` | `/tools/document-compare` | production notes #9 | 수정 | body/table difference 확인 안내 | 옛 문구 없음·새 문구 있음 | 동일 |
| 10 | en | `textTools.blocks[3].paragraphs[0..3]` | `/tools/text-tools` | production notes #10 | 수정 | 분리된 네 문자열을 line-break/list 설명 한 문단으로 교체 | 옛 문구 없음·새 문구 있음 | 동일 |
| 11 | en | `work.blocks[3].paragraphs[0]` | `/tools/work-calculator` | production notes #11 | 수정 | custom company holiday 설명 | 옛 문구 없음·새 문구 있음 | 동일 |
| 12 | en | `imagePrivacy.blocks[3].paragraphs[0]` | `/tools/image-privacy` | production notes #12 | 수정 | hidden metadata와 visible text 구분 | 옛 문구 없음·새 문구 있음 | 동일 |
| 13 | en | `excel.blocks[5].paragraphs[0]` | `/tools/excel-merger` | production notes #13 | 수정 | sheet/vertical/horizontal merge 설명 | 옛 문구 없음·새 문구 있음 | 동일 |
| 14 | en | `audio.blocks[8].paragraphs[0]` | `/tools/audio-studio` | production notes #14 | 수정 | delete/mute 길이 차이와 경계 확인 안내 | 옛 문구 없음·새 문구 있음 | 동일 |
| 15 | en | `image.blocks[5].paragraphs[0]` | `/tools/image-studio` | production notes #15 | 수정 | resize/canvas 차이와 자동 배경 제거 미지원 설명 | 옛 문구 없음·새 문구 있음 | 동일 |
| 16 | en | `excelCleaner.blocks[4].paragraphs[0]` | `/tools/excel-cleaner` | production notes #16 | 수정 | whitespace cleanup과 identifier 주의 | 옛 문구 없음·새 문구 있음 | 동일 |
| 17 | en | `pdfCompare.blocks[2].paragraphs[0]` | `/tools/pdf-compare` | production notes #17 | 수정 | cover 추가 시 manual page matching 안내 | 옛 문구 없음·새 문구 있음 | 기존 `PdfComparePage`에 `ToolGuideWrapper` 없음; 정상 도구 UI·최종 URL 확인, 가이드 미노출 |
| 18 | en | `officeEditor.blocks[4].paragraphs[0]` | `/tools/office-editor` | production notes #18 | 수정 | 준비 완료 대기와 저장본 재확인 안내 | 옛 문구 없음·새 문구 있음 | 랜딩이 `/tools/office-editor/app/`으로 즉시 이동; 격리 작업 화면 정상, 랜딩 가이드 미노출 |
| 19 | en | `video.blocks[1].paragraphs[0]` | — | production notes #19 | 미연결 삭제 | 코드·검사기·테스트에 가이드 키 참조 없음 확인 후 `video` 키 삭제 | JSON 키 없음 | 연결 없음 |
| 20 | ko | `qr.pathBlocks['/tools/qr-studio/bulk'][0].paragraphs[2]` | `/tools/qr-studio/bulk` | `XLS 보존 작업` | 제거 | 마지막 고아 제목 삭제 | 해당 가이드 위치에서 없음 | 동일 |
| 21 | ko | `excel.pathBlocks['/tools/excel-merger/xls-preserve'][0].paragraphs[2]` | `/tools/excel-merger/xls-preserve` | `문서 비교 결과` | 제거 | 마지막 고아 제목 삭제 | 격리 정적 문서에 가이드 미노출, 옛 문구 없음 | 가이드 렌더 확인·옛 문구 없음·기존 본문 있음 |
| 22 | ko | `audio.pathBlocks['/tools/audio-studio/trim'][0].paragraphs[2]` | `/tools/audio-studio/trim` | `QR 일괄 생성` | 제거 | 마지막 고아 제목 삭제 | 해당 가이드 위치에서 없음 | 동일 |
| 23 | ko | `image.pathBlocks['/tools/image-studio/resize'][0].paragraphs[2]` | `/tools/image-studio/resize` | `이미지 모자이크` | 제거 | 마지막 고아 제목 삭제 | 해당 가이드 위치에서 없음 | 동일 |
| 24 | ko | `image.pathBlocks['/tools/image-studio/mosaic'][0].paragraphs[2]` | `/tools/image-studio/mosaic` | `이미지 워터마크` | 제거 | 마지막 고아 제목 삭제 | 해당 가이드 위치에서 없음 | 동일 |
| 25 | ko | `image.pathBlocks['/tools/image-studio/watermark'][0].paragraphs[2]` | `/tools/image-studio/watermark` | `영상 자르기` | 제거 | 마지막 고아 제목 삭제 | 해당 가이드 위치에서 없음 | 동일 |
| 26 | ko | `video.page.pathBlocks['/tools/video-studio/trim'][0].paragraphs[2]` | `/tools/video-studio/trim` | `영상 합치기` | 제거 | 마지막 고아 제목 삭제 | 해당 가이드 위치에서 없음 | 동일 |
| 27 | ko | `video.page.pathBlocks['/tools/video-studio/merge'][0].paragraphs[2]` | `/tools/video-studio/merge` | `영상 음원 추출` | 제거 | 마지막 고아 제목 삭제 | 해당 가이드 위치에서 없음 | 동일 |
| 28 | en | `qr.pathBlocks['/tools/qr-studio/bulk'][0].paragraphs[1]` | `/tools/qr-studio/bulk` | `Preserve XLS` | 제거 | 마지막 고아 제목 삭제 | 해당 가이드 위치에서 없음 | 동일 |
| 29 | en | `excel.pathBlocks['/tools/excel-merger/xls-preserve'][0].paragraphs[1]` | `/tools/excel-merger/xls-preserve` | `Document Comparison Results` | 제거 | 마지막 고아 제목 삭제 | 격리 정적 문서에 가이드 미노출, 옛 문구 없음 | 가이드 렌더 확인·옛 문구 없음·기존 본문 있음 |
| 30 | en | `audio.pathBlocks['/tools/audio-studio/trim'][0].paragraphs[1]` | `/tools/audio-studio/trim` | `Bulk Generate QR` | 제거 | 마지막 고아 제목 삭제 | 해당 가이드 위치에서 없음 | 동일 |
| 31 | en | `image.pathBlocks['/tools/image-studio/resize'][0].paragraphs[1]` | `/tools/image-studio/resize` | `Mosaic Image` | 제거 | 마지막 고아 제목 삭제 | 해당 가이드 위치에서 없음 | 동일 |
| 32 | en | `image.pathBlocks['/tools/image-studio/mosaic'][0].paragraphs[1]` | `/tools/image-studio/mosaic` | `Image Watermark` | 제거 | 마지막 고아 제목 삭제 | 해당 가이드 위치에서 없음 | 동일 |
| 33 | en | `image.pathBlocks['/tools/image-studio/watermark'][0].paragraphs[1]` | `/tools/image-studio/watermark` | `Trim Video` | 제거 | 마지막 고아 제목 삭제 | 해당 가이드 위치에서 없음 | 동일 |
| 34 | en | `video.page.pathBlocks['/tools/video-studio/trim'][0].paragraphs[1]` | `/tools/video-studio/trim` | `Merge Video` | 제거 | 마지막 고아 제목 삭제 | 해당 가이드 위치에서 없음 | 동일 |
| 35 | en | `video.page.pathBlocks['/tools/video-studio/merge'][0].paragraphs[1]` | `/tools/video-studio/merge` | `Extract Audio from Video` | 제거 | 마지막 고아 제목 삭제 | 해당 가이드 위치에서 없음 | 동일 |
| 36 | en | `video.page.pathBlocks['/tools/video-studio/extract-audio'][0].paragraphs[1]` | `/tools/video-studio/extract-audio` | `Trim Audio` | 제거 | 마지막 고아 제목 삭제 | 해당 가이드 위치에서 없음 | 동일 |
| 37 | en | `pdfEditor.standard.pathBlocks['/tools/pdf-editor/pdf-to-image'][0].paragraphs[1]` | `/tools/pdf-editor/pdf-to-image` | `Convert PDF Document` | 제거 | 마지막 고아 제목 삭제 | 해당 가이드 위치에서 없음 | 동일 |
| 38 | en | `pdfEditor.standard.pathBlocks['/tools/pdf-editor/watermark'][0].paragraphs[1]` | `/tools/pdf-editor/watermark` | `PDF Stamp & Signature Image` | 제거 | 마지막 고아 제목 삭제 | 해당 가이드 위치에서 없음 | 동일 |
| 39 | en | `pdfEditor.standard.pathBlocks['/tools/pdf-editor/stamp'][0].paragraphs[1]` | `/tools/pdf-editor/stamp` | `Resize Image` | 제거 | 마지막 고아 제목 삭제 | 가이드 위치에서 없음(페이지 제목의 정상 문자열은 판정 제외) | 동일 |

## 추가 확인

- 같은 블록의 동일 유형 추가 항목: #2·#10은 원문이 JSON에서 네 문단으로 잘려 있던 하나의 제작 메모이므로 해당 행 범위를 `[0..3]`으로 확장해 한 문단으로 복원했다. 별도 독립 문구는 발견하지 않았다.
- xls-preserve는 정적 격리 문서에는 가이드가 없지만 런타임에서는 `ToolGuideWrapper`가 렌더됐다. 따라서 #21·#29는 `격리 미노출`이 아니라 실제 확인 결과인 `제거`로 판정했다.
- #17·#18의 런타임 가이드 미노출은 이번 문구 변경과 무관한 기존 연결 경로 상태이며 WU1 소유 범위 밖이다. 소스·정적 출력 수정은 확인했다.
