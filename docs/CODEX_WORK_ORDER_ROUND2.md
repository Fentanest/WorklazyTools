# Codex 작업지시서 2차 — 1차 수정 검증 후속 (2026-08-15)

1차 작업지시서(`docs/CODEX_WORK_ORDER.md`)에 대한 Codex 수정(커밋 `06b78f5`, `51ba2a9`, `347fc33`)을 항목별로 검증한 결과다. 약 120건 중 대부분은 올바르게 수정 완료됐고(핵심 항목은 실행으로 재확인), 아래는 **수정 과정에서 생긴 회귀 2건 + 미해결/부분 해결 항목 + 신규 발견 경미 결함**이다. 공통 지침은 1차 지시서 0절과 동일.

---

## P0 — 회귀 (즉시 수정)

### [R1] 데이터 변환기: 구조 오류 CSV가 오류 대신 빈/부분 데이터로 조용히 성공 (E7 수정의 회귀)
- 파일: `src/features/data-converter/data-converter.worker.ts` (chunk 콜백의 reject 경로, 약 148-155행)
- 문제: 구조 오류(Quotes/Delimiter) 시 `parser.abort()`를 먼저 호출하는데, papaparse의 `abort()`는 `complete` 콜백을 **동기 호출**하므로 `complete`의 `resolve`가 다음 줄의 `reject`보다 먼저 실행된다(실행으로 재현). 수정 전에는 오류가 표시되던 케이스가 이제 조용히 성공 처리된다.
- 수정: `aborted` 플래그를 두어 `complete`에서 resolve를 차단하거나, `reject(...)` 호출 후에 `parser.abort()`를 호출.
- 완료 기준: 따옴표 미종결 CSV 입력 시 오류 메시지 표시(빈 결과 다운로드 불가).

## P1 — 회귀·미해결

### [R2] PDF: 암호 PDF 조기 차단이 PDF→이미지 경로까지 막음 (D1 수정의 과잉 적용)
- 파일: `src/features/pdf-editor/pdfPreview.ts:51-56`(inspectPdf), `PdfImagePanel.tsx:135`
- 문제: `getPermissions()` 기반 거부가 세 패널 공통으로 걸려, pdf.js만 사용해 수정 전에는 정상 변환되던 owner-password PDF의 이미지 변환이 불가능해졌다. 오류 메시지도 "편집할 수 없습니다"로 문맥 불일치.
- 수정: 차단을 pdf-lib을 쓰는 경로(정리/병합/내보내기)로 한정하는 옵션 파라미터를 `inspectPdf`에 추가. PDF→이미지(및 pdf.js 전용 변환 경로)는 통과시키되 필요 시 정보성 안내만.

### [R3] 비디오: AAC 비표준 샘플레이트 직접입력 시 인코딩 실패 (A6의 누락 절반)
- 파일: `src/features/video-studio/videoEncoding.ts:19` (`resolveAudioSampleRate`)
- 문제: opus/mp3는 스냅·클램프됐지만 aac는 입력값을 그대로 반환 — 45,000Hz 같은 값에서 네이티브 aac 인코더가 거부해 일반 오류로 실패.
- 수정: aac 지원 레이트(8/11.025/12/16/22.05/24/32/44.1/48/64/88.2/96kHz)로 최근접 스냅. `tests/unit/video-encoding.test.ts`에 케이스 추가.

### [R4] Excel 병합: 성공 직후 "비밀번호가 필요합니다" 경고 잔존 (E15 절반만 수정)
- 파일: `src/features/excel-merger/ExcelMergerPage.tsx` (약 512행 `missingInputPassword`, 290행 암호 삭제)
- 문제: `outputPasswordMissing`에만 `!result` 가드가 추가됐고, 지시서가 지목한 **입력 암호** 경고는 가드가 없어 암호화 입력 파일 병합 성공 직후 빨간 경고가 결과 카드와 함께 표시된다.
- 수정: `missingInputPassword` 표시 조건에도 `!result` 가드(또는 정보성 문구 전환) 적용.

## P2 — 잔여 결함

- **[R5]** `tracked_docx.py:1129-1134` — settings.xml 삽입 폴백 앵커가 3개(doNotTrackMoves 등)뿐이라 일반적인 settings.xml(defaultTabStop·compat·rsids만 존재)에서는 revisionView가 루트 끝에 append되어 여전히 스키마 순서 위반. 앵커 목록에 `w:trackChanges`도 누락. CT_Settings sequence 전체 요소 순서 목록을 상수로 두고 "앞에 와야 하는 마지막 요소 뒤" 삽입 위치를 계산하는 방식으로 교체.
- **[R6]** `ImageStudioPage.tsx:456-462` — JPEG 내보내기가 화면 캔버스(900×600×DPR)를 업스케일해 치수만 원본급이고 픽셀이 흐릿함(C5 부분 해결). PNG/WebP처럼 `instance.toCanvasElement(outputMultiplier)`로 재렌더한 캔버스를 흰 배경에 합성하는 방식으로 교체.
- **[R7]** `PdfOrganizePanel.tsx:84` — Sortable 생성 effect 의존성의 `download`(`useDownloadResult`가 매 렌더 새 객체 반환) 때문에 렌더마다 Sortable destroy/create. `download.clearResult`를 ref로 참조하거나 deps에서 제거.
- **[R8]** 로케일 키 2건 누락 — `image.editor.duplicate`, `imagePrivacy.readError`가 ko/en JSON에 없어 영어 UI에 한국어 defaultValue 노출. 양쪽 추가.
- **[R9]** `PdfOrganizePanel.tsx:297-303` — 이미지 기반 압축이 선택 페이지 전체를 `Promise.all` 병렬 렌더(수백 페이지 메모리 스파이크) + 결과 JPEG(품질 0.78)가 `normalizeImageOrientation`에서 0.96으로 재인코딩되는 이중 압축. 동시성 3~4로 제한하고, 압축 경로 산출물은 orientation 정규화를 건너뛰기(캔버스 산출물이라 EXIF 없음).
- **[R10]** `QrStudioPage.tsx:276-277` — 사진 input을 여전히 **읽기 전** `value=""` 리셋(C9 절반만 수정, `ui.tsx` 자체 주석과 모순). 읽기 완료 후 리셋으로 이동.
- **[R11]** 경미 결함 모음:
  - `audioHelpers.ts:37` — WAV fmt bounds 체크 off-by-4(`offset+12` → `offset+16` 필요). 절단 WAV에서 RangeError.
  - 오디오: exportSelection 토글 ON 상태에서 selection이 사라진 문서(TRIM 직후 등)를 내보내면 throw로 종료 — 전체 내보내기로 폴백하거나 토글 자동 해제.
  - `image-privacy.worker.ts:154` — `_raw` 제외 후 재가산이 no-op이라 XMP 존재 시 감지 개수 1 과다.
  - `generate-static-pages.mjs` renderNotFound — 404.html에 robots 메타 2개 공존(index,follow + noindex). 원본 메타를 교체로.
  - `generate-static-pages.mjs` makePage — 정적 h1 분리자가 `" | "`/`" — "`만 처리해 seo.ts의 `" - "` 타이틀이 꼬리까지 h1에 포함됨.
  - `text-formatter.worker.ts` collapseSql — `a - -1`이 `a--1`로 접혀 라인 주석화(1차 이전부터 존재). 토큰 사이 결합 시 `--`/`#` 생성 여부 검사.
  - 오디오 가이드 문구(ko "완료 즉시 종료합니다"/en 동일 취지)가 B14의 세션 유지 워커와 불일치 — 문구 갱신.
  - QR: 생성→스캔→생성 탭 왕복 시 캔버스가 비어 있는데 `qrReady`가 true로 남아 빈 PNG 다운로드 가능 — 캔버스 재마운트 시 재생성 트리거.
  - `AnalyticsLoader` — `lastGooglePath`/`lastNaverPath`가 모듈 스코프라 동의 철회→재동의 시 같은 경로 page_view 미전송(극소).
  - 계산기: `localIsoDate` 헬퍼가 두 페이지에 중복 정의 — 공용화.

## P3 — 이월(선택)

- **[R12] i18n 부채**: A17(비디오 `L()` 126회)·D13(PDF `L()`, 신규 워터마크/압축 문자열도 인라인으로 추가됨)·오디오 신규 편집 버튼(`audio.edit.*` 키가 있는데 미사용)·QR 신규 문자열의 features.json 이관. 부채가 1차보다 늘었으므로 다음 라운드 최우선 P3.
- **[R13] 테스트 보강**: calculators.test.ts에 2028/2030 설날(dangi vs chinese 판별 케이스)과 월 300만·부양 1인 세액공제 수치 단언 추가, p0 테스트의 XML 공백 단언(`\s*` → 정확 문자열)과 minify 모드 검증, E1을 `csv.read` 경유 통합 테스트로 승격, audio-helpers에 ID3 오프셋 MP3·fmt 후순위 WAV 케이스.
- **[R14] 구조 개선 잔여**: A16(그룹/트림 하위 컴포넌트 분리 — 트림 드래그 전체 리렌더 잔존), B13·C16(거대 컴포넌트 분리), D12(mergePages 중복), E25(Word 보고서 로직 분리, applyInspectionResult 추출), F15(비교 페이지 공용 컴포넌트).
- **[R15]** E5 잔여: sheets 모드에서 수식 없는 시트를 트림할 때 **다른 시트**의 참조 수식이 어긋날 수 있음 — 트림 스킵 판정을 워크북 단위 참조 검사로 확장.

## 보류 (수정 불가/불필요 확인)

- **F9**(HWP 각주 구역 귀속): rhwp 0.8.4의 getControls가 구역 인덱스를 내보내지 않음을 wasm 문자열 테이블로 확인 — 라이브러리 업데이트 전까지 보류. 누락 케이스 해소(continue 전환)는 완료됨.
- **A20 키보드 미세 트림, C17 드래그 자르기**: P4 잔여 — 필요 시 별도 지시.

## 1차 검증 통과 확인(재작업 불필요)

빌드(`npm run build`)·단위 테스트 14/14·정적 검증 통과. P0 4건(E1·E2·C1·G1)과 공휴일/급여/음력(G2·G3·G4·G6·G10), 비디오 A1~A4, 오디오 B1~B2, PDF D1~D5(단 R2 예외), 문서 비교 F1~F3(단 R5 예외), 동의 배너(G8), 404.html(G5) 모두 실행 또는 코드 정독으로 정상 확인.
