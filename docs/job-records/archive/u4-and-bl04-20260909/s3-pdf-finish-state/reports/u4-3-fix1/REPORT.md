# U4-3 fix-1 구현 보고서

- 작업 브랜치: `s3-pdf-finish`
- 기준 커밋: `c8bff1fd1ab64f89afb7240778e0a373c953d1a3`
- 결과 커밋: `ff0452b3ad171bfba920f41ec0789612e5ec2001` (`fix(pdf): resolve finish review defects`)
- `main` / `origin/main`: `5bc6854175331bdd73b267784d9633cdccda8446` (변경 없음)
- push·main 병합·배포: 수행하지 않음

## 구현 결과

- F1: 시작 번호·시작 페이지·글자 크기·여백을 문자열 입력 상태로 보존한다. 시작 페이지의 빈 값, `0`, `-1`, `1.5`는 selection·thumbnail 계산 전에 차단되고, 필드 오류를 고친 뒤 같은 화면에서 정상 복구된다.
- F2: 업로드 오류를 파일 조건부 UI 밖으로 옮겼다. R2/R6 보호 PDF 4종은 보호 문서 안내로, 손상 PDF는 읽기 실패 안내로 분리하며 원시 예외는 노출하지 않는다.
- F3: 실제 canvas wrapper가 원본 종횡비를 유지하고 overlay를 소유한다. 가운데 정렬은 `left:50%`와 `translateX(-50%)`를 쓴다. 모바일 portrait/landscape × 6영역 × ko/en × light/dark 48/48 배치를 검증했다.
- F4: 표시 영역은 CropBox와 MediaBox 교집합이며 빈 교집합은 MediaBox로 fallback한다. 0/90/180/270도 경계 fixture에서 PDF.js와 Poppler 모두 출력 픽셀을 검출했다.
- F5: token 치환, 전처리, glyph 결정, layout을 `analyzeDocument` 한 계획으로 묶어 preflight와 실제 draw가 공유한다. 제어 문자·날짜 형식·누락 glyph는 행/열과 함께 차단하며, 알 수 없는 토큰·가로/세로 생략·전체 글꼴 임베드는 생성 전에 ko/en 경고한다. 전체 글꼴 문안은 약 3.8MB 증가를 알린다.
- F6: file read, font fetch/coverage/embed, 반복 양보, save, 결과 등록 경계에서 취소를 재검사한다. 완료 결과가 있을 때만 `PdfFinishCanceledError.partialResults`로 보존한다. 반례 결과는 부분 결과 1개, 다음 파일 read 0회다.
- F7: 공용 신규 PDF helper가 `PDFDocument.create()` metadata 기본값을 보존한다. QR subset/full 고정 시각 출력은 main과 byte·SHA·Info·Producer·Creator·날짜 및 Poppler 2쪽 SHA가 동일하다.
- F8: 5개 PDF navigation 항목의 실제 최소 폭을 148px로 정하고 821px 강제 5열을 제거했다. 영어 821px에서 navigation client 523px / scroll 764px, 각 링크 client=scroll=148px이며 overflow cue가 유지된다.
- F9: 두 탭 preset, 10pt·24pt·`#34343a`, 실제 출력 opacity 0.9, ko/en 출력명, 6~72pt·0~144pt 검증, 300자 native 제한·counter·초과 안내를 코드와 locale에 고정했다. 실제 PDF ExtGState의 non-stroking opacity 0.9와 QR metadata를 단위 회귀로 고정했다.

정본 계획서 편집 금지에 따라 `docs/jobs/todo/pdf-finish-20260905.md`는 수정하지 않았고, 확정 계약과 판정 근거는 `docs/review-notes.md`에 기록했다. 변경 기록은 `CHANGELOG.md`에 `Codx`로 서명했다.

## 검증 결과

| 범위 | 결과 | 로그 |
|---|---|---|
| TypeScript | 진단 0 | `logs/33-tsc-final.log` |
| 전체 unit | 301/301, fail·skip 0 | `logs/34-unit-final.log` |
| production build / static | 2,845 modules, 정적 67페이지, startup recovery 113 | `logs/03-build-production.log`, `logs/04-static-production.log` |
| PDF finish smoke | 12 직접 진입, 보호/손상, 입력 복구, preflight, preview 48, CropBox 4회전, 출력·취소·재시도 통과 | `logs/08-pdf-finish.log` |
| astra engine 원본 probe | geometry 24/24, 오류 위치, 부분 결과 1·next read 0, boundary render 통과 | `logs/06-astra-engine-probe.log`, `engine-results.json` |
| PDF scope / 전체 browser | PDF 4모드 및 Excel·Word·shared UI 통과 | `logs/09-browser-pdf.log`, `logs/10-browser-full.log` |
| new-tools / utilities / office | 통과; Dolby Vision은 기존 host capability skip | `logs/11-new-tools.log`~`logs/13-office.log` |
| Excel Cleaner / Compare | 취소·재실행·보고서·모바일 포함 통과 | `logs/14-excel-cleaner.log`, `logs/15-excel-compare.log` |
| QR bulk / font render / byte 비교 | font 4 scenario·취소·404 통과; 3 fixture changed pixels 0; subset/full main 동일 | `logs/16-qr-bulk.log`, `logs/17-qr-font-render.log`, `logs/05-qr-byte-poppler.log` |
| legacy oracle / recovery | oracle 총 diff 0; recovery 147 cases | `logs/18-legacy-oracle.log`, `logs/19-recovery.log` |
| 전체 visual ko / en | 각각 203/203 | `logs/22-visual-ko-final.log`, `logs/23-visual-en-final.log` |
| 기존 PDF 집중 visual | 10/10 | `logs/32-visual-existing-pdf-final.log` |
| local-QA / a11y / rendering | 정적 67; axe 11페이지 위반 0; 6대상×3회, 외부 요청 0, CLS max 0.011648411 | `logs/24-build-qa.log`~`logs/26-rendering.log` |
| bundle / CSS / legacy / registry | 5종 상한, orphan 0, 155/153/0/2, 도구 20 통과 | `logs/27-bundle.log`~`logs/30-registry.log` |
| astra focused browser | preview canvas/overlay 및 821px navigation 실측 통과 | `logs/31-focused-browser.log`, `focused-visual.json` |

번들 순증분은 entry 4,837B, affected PDF route 13,753B, shared 2,066B, app 21,109B, CSS 118B이며 override `{}`·multiplier 1이다. QR→shared 이동 509,380B는 순증분에서 분리했다.

첫 전체 시각 회귀는 새 navigation 최소 폭이 반영되지 않은 기존 모바일 기준선 2장으로 201/203 실패했으며 그 로그를 `logs/20-visual-ko.log`에 보존했다. UI 수리 뒤 finish 탭 16장, navigation 12장, 기존 PDF 모바일 2장으로 정확히 30장만 갱신했다. 실행시간 문자열만 달라진 비제품 interaction 2장은 HEAD 이미지로 복원했고 집중 visual 10/10으로 재검증했다.

PDF.js `standardFontDataUrl`, Poppler OTF font-type 경고는 기존 환경 경고이며 텍스트·픽셀 oracle은 통과했다. `git diff --check`와 staged diff check도 통과했다.

## 증거 위치

- 원본 로그: `/tmp/worklazy-u4-3-fix1/logs/`
- screenshot: `/tmp/worklazy-u4-3-fix1/shots/`
- engine/QR/focused 산출물과 원 probe 대비 경로 diff: `/tmp/worklazy-u4-3-fix1/`
- a11y/rendering JSON: `/tmp/worklazy-u4-3-fix1/a11y.json`, `/tmp/worklazy-u4-3-fix1/rendering.json`
- ignored state copy: `docs/jobs/todo/s3-pdf-finish-state/reports/u4-3-fix1/`

사용자 미추적 `after.docx`, `before.docx`, 네이버 확인 HTML, `newui/`는 열거나 stage하지 않았고 현재도 그대로 남아 있다.

— Codx
