# 작업지시서 — U4-3 F1: finish 화면·route 3개·페이지 번호·머리말/꼬리말 (2026-09-07, Claude → Codex **gpt-5.6-sol**)

## 0. 선독(순서대로 — 정본 문안을 그대로 코드로 옮긴다. 미정의는 임의 결정 금지 → 「범위 밖 발견」)
1. `PROJECT_RULES.md`(특히 「현지화·SEO·AdSense 동시 검토」·「내부 구현 비노출」·「광역 금지 계약」) → `AGENTS.md`.
2. **정본** `docs/jobs/todo/pdf-finish-20260905.md` 「정본화」 절 → 이 단계의 절: **route/preset/navigation = 확정 13·14·15·23 + H1(v4)** · **토큰·선택 = 확정 7·9·24 + D2(v6)·N1(v6)** · **clock = 확정 10 + H3(v4)·D6(v5)** · **폰트 = 확정 1 + N3(v7) + D8(v5)**(실제 임베드는 이 단계부터) · **여러 줄 = 확정 21 + N3** · **실행 realm·취소 = D5(v6·v7)**(장식 엔진 메인 스레드, 공용 lazy 청크 `pdfFontEmbed` owners=[pdf-editor,qr-studio], 협력적 취소 — U4-2 helper 사용) · **미리보기·썸네일 = 확정 26 + N1** · **S0 상속 계약 = H2 + 5차 [동의] H2(b)**(바깥 `PdfRoute` Suspense/ToolReady 재사용, 내부 지연 로딩은 `.tool-route-loading` 표식 + 내부 `ToolReady`) · **게이트 = H5·H6(g)·D6**(rendering 등록·a11y desktop+412 등록·시각 scenario·`mobile-320` viewport·unit 기대값 동반 갱신) · 확정 3(legacy 4모드 불변) · 「명시 제외」.
3. S2b 정본 `docs/jobs/todo/qr-font-20260906.md` §범위 "U4 폰트 경계(U4 는 전체 OTF 유지 — pdf-finish H2(d))" + v2 "U4 병합 — QR selector 미전파·전체 OTF 보존": finish 는 **전체 OTF `vendor/qr-label-font/noto-cjk-sans-2.004/NotoSansKR-Regular.otf`(`QR_LABEL_FONT_PATH`)** 를 임베드하고 QR 의 서브셋 selector(`qrLabelFont.ts`)는 쓰지 않는다. `docs/backlog.md` 「PDF 글꼴 임베드 후속」(GS tofu descriptor — 이 단계에서 **교정하지 않음**, oracle 은 Poppler·PDF.js).
4. 브랜치 산출: U4-1 `src/features/pdf-editor/finish/*`(geometry·selection·tokens·text·tiles·canvasPolicy·stamp·plan·preflight) — **재사용·재구현 금지** · U4-2 facade·`yieldToEventLoop`/`throwIfAborted`/PDF.js cancel helper · U4-0 fixture(`tests/fixtures/pdf-finish/`).
5. 현행 표면 실측 후 착수: `src/app/App.tsx:56-60`(PdfRoute 4 route) · `src/app/seo.ts`(pdf-editor 4경로 등록) · `scripts/generate-static-pages.mjs:15 pdfRoutes` · `scripts/validate-static-output.mjs:15,24` · `src/features/pdf-editor/PdfEditorPage.tsx`(navigation 하드코딩 `grid-cols-4`) · `tests/visual-regression.scenarios.mjs:217-`(pdf-editor 4 scenario, nth-child `:233·245·258`) · `tests/browser-smoke.mjs:349` · `tests/rendering-baseline.mjs:19` · `tests/accessibility-audit.mjs` pages · `tests/visual-regression.config.mjs` `toolReasons` · `tests/unit/visual-config.test.ts`·`visual-clock.test.ts` · 소셜 이미지·사이트맵·FAQ 생성기.

## 1. 성격·기준
- **파일 수정이 필요한 구현 작업(쓰기 모드).** 브랜치 `s3-pdf-finish`(HEAD = U4-2 검수 통과 커밋 `446a1e35ba60ebc308a32a13f8b675a02b095365`) 위에 **논리 단위별 커밋**(예: ① 타입·route·preset·navigation·SEO/static ② 장식 엔진(번호·머리말/꼬리말·폰트 임베드·취소) ③ 화면(탭·오버레이 미리보기·썸네일 선택) ④ 하네스(`test:pdf-finish`·시각 scenario·a11y·rendering·clock) ⑤ 기록). **main 병합·push 금지.** 착수 시 브랜치·HEAD·`git rev-parse main`(`5bc6854…`) 대조.
- **배포는 U4-8 뒤 1회**(명시 제외 "F1 중간 배포"). 따라서 이 단계의 중간 상태(미구현 탭)는 사용자에게 노출되지 않는다.
- **단계 경계(Claude 의 진행 결정 — 제품 결정 아님)**: 정본은 최종 상태(4탭·5 route)만 정한다. 이 단계는 **route 3개**(`/finish`·`/page-numbers`·`/header-footer`)와 **탭 2개**(page-numbers·header-footer)를 구현한다. `PdfFinishTab` 타입은 정본대로 4값을 정의하되 **탭 바에 렌더하는 목록은 구현된 탭만**(watermark·stamp 는 U4-4·U4-5 에서 목록에 추가). "준비 중" 같은 새 문구를 만들지 않는다. `/watermark`·`/stamp` route·SEO 등록도 각 단계에서.

## 2. 범위
### A. 타입·route·preset·navigation (확정 13·14·15·23 + H1)
- `types.ts`: `PdfToolMode` 에 `"finish"` 추가(4→5) · `PdfFinishTab`·`PdfFinishPreset { initialTab }` 정본 문안 그대로.
- `App.tsx`: `tools/pdf-editor/finish`(preset page-numbers) · `/page-numbers` · `/header-footer` → 같은 `PdfRoute mode="finish"` + typed preset prop. 전역 generic router·페이지 복제 금지. 진입 후 탭 전환은 route 를 바꾸지 않음(history 오염 방지).
- **finish 패널은 별도 lazy 청크**(`PdfFinishPanel` 동적 import — H2 ①). 바깥 `PdfRoute` 의 Suspense/ToolReady 만 재사용하고 내부 지연 로딩 fallback 에 `.tool-route-loading` 표식 + 내부 `ToolReady`(5차 H2(b) E9 반례).
- navigation **5칸**: 모바일 `repeat(5, minmax(120px,1fr))`·데스크톱 `grid-cols-5`, finish 를 organize **다음**, 직접 진입 시 active 탭을 가시 영역으로 스크롤, selector `data-pdf-nav-mode`(확정 14 ①~⑤). 저장소 전체 `.pdf-tool-navigation a:nth-child` **0건**(확정 15 — 대상 4건 `browser-smoke.mjs:349` + scenarios `:233·245·258`; 내부 목록 nth-child 는 대상 아님).
- SEO(「현지화·SEO·AdSense 동시 검토」): `seo.ts` 3경로 ko/en title·description·FAQ · **canonical 은 `/finish`**(직접 진입 경로는 canonical 을 `/finish` 로) · 정적 페이지 생성기 `pdfRoutes`·`validate-static-output` 허용목록·사이트맵·소셜 이미지 3경로 · `expectedToolIds` **20 불변**(finish 는 pdf-editor 하위 route). 광고: finish 는 격리 경로가 아님 — 일반 로더 정상(광역 금지 계약 검사 통과).
### B. 장식 엔진(메인 스레드 — D5 v6·v7, 확정 1·9·10·21·24 + D2·N3·D8)
- 신설 모듈(제안 `src/features/pdf-editor/finish/engine.ts` 또는 `finishEngine.ts`): 입력 = 파일 목록·U4-1 `selection` exact set·옵션(번호/머리말/꼬리말 텍스트·6영역·크기·색·시작 번호·startPage·표지 제외·`{date}` 형식) · 출력 = 파일별 PDF bytes + warnings. 순서: 파일 load(pdf-lib `PDFDocument.load`, 암호 보호는 U4-0 D1 oracle 대로 "편집 불가" 안내) → **토큰 치환·전처리·coverage(U4-1 `tokens`·`text`)** → 폰트 결정(Helvetica 표준 / **Noto 전체 OTF 1회 fetch·size·SHA 검증 후 `embedFont(bytes,{subset:false})`**, 문서당 단일) → 페이지 루프(U4-1 `geometry` 앵커·upright 회전 · `text` 레이아웃 → `drawText`) → save → 결과 등록(**양보 후 abort 재검사**). 각 지점 `throwIfAborted`, 루프 매 반복 `yieldToEventLoop`(U4-2 helper — `Promise.resolve()` 금지). 동기 단위 즉시 중단 미보장은 안내 문구에 반영(ko/en).
- **`pdfFontEmbed` 공용 lazy 청크**: fontkit 등록·`PDFDocument`·embed 를 담는 모듈을 finish 와 **QR(`qrLabelPdf.ts` `registerFontkit`)이 함께 import** 하도록 QR 의 import 경로만 바꾼다(QR 동작·출력 불변 — `test:qr-bulk`·`test:qr-font-render` 로 증명). 청크 이름은 계약 아님(5차).
- `clock`: batch 시작 시 메인 realm 1회 캡처 → 값·locale 전달(D6). `{date}` 기본 = 문서 언어 로케일, `{date:<fmt>}` 화이트리스트(N3 v8).
- 사용자 메시지: 필드 오류(coverage 누락 scalar 위치·좁은 영역·타일 등)는 **행동 중심 ko/en 문구**로 현지화 — 내부 코드·예외 원문 비노출(「내부 구현 비노출」). 오류 code 는 내부 열거형.
### C. 화면(확정 26 + N1·D2)
- 탭 2개(page-numbers·header-footer) 공통 폼: 텍스트(토큰 도움말 — `{page}`·`{pages}`·`{filename}`·`{date}`·`{date:YYYY-MM-DD}`), 6영역 선택, 크기·색, 시작 번호·startPage·표지 제외(D2 두 필드), 페이지 범위 텍스트 + 홀짝 + **썸네일 토글 양방향 동기**(N1: exact set 정본·토글 → parity=all·canonical 텍스트 재생성·하한 미만 disabled·빈 set → 실행 비활성). 기존 `PdfOrganizePanel` 썸네일 그리드·`PdfThumbnail` 재사용(복제 금지).
- **오버레이 미리보기**: PDF.js 렌더 캔버스 위 DOM 오버레이로 위치·크기·정렬·색·투명도 **근사 표시**, "출력과 픽셀 동일하지 않음" 안내 ko/en(확정 26 범위 제한). 렌더는 `pdfPreview.ts` 경로 + U4-2 cancel helper.
- 실행·취소·진행: 협력적 취소 버튼(finish 전용 — 기존 4모드에는 추가 금지), 진행 표시 phase 는 사용자 언어로. 결과 다운로드는 기존 pdf-editor 결과 UI 관례를 따른다(다중 파일/ZIP 은 U4-8).
- 접근성: 탭·폼·썸네일 토글·오버레이의 이름·역할·대비 — `A11Y_MAX_TOTAL=0`. CLS 0 목표(썸네일·캔버스 자리 예약).
### D. 하네스(H2(b)·H5·H6(g)·D6·H3)
- **`npm run test:pdf-finish` 신설**(`tests/pdf-finish-smoke.mjs` 제안, package script 1줄): 이 단계 범위 = 3 route × ko/en × desktop/mobile **12 정상 진입**(ToolReady·`.tool-route-loading` 소멸·가드 sessionStorage 정리) · SPA 전환(organize→finish→…) · 직접 진입 preset 별 initialTab · **404 청크 주입 시 S0 가드 상속**(reload ≤1) · 실행→취소→재시도 · 필드 오류 표시 · geometry(회전·CropBox fixture 로 출력 좌표 — U4-0 fixture + Poppler/PDF.js 픽셀·텍스트 oracle) · **영어 모바일 320/390 navigation active 가시성·fade**(확정 14 ④, 820/821 은 DOM 단언). 남은 항목(5 preset·20 진입)은 U4-4·U4-5 에서 확장.
- 시각 scenario: `visual-regression.scenarios.mjs` `pdf-editor` 에 finish **구현된 2탭** interaction scenario(light/dark × ko/en × desktop/mobile) + nav 3상태 × ko/en × 320/390 — `mobile-320` viewport ID 신설(기존 scenario 를 320 으로 전역 중복 금지). `visual-config.test.ts`·`visual-clock.test.ts` 기대값 **동반 갱신**(D6). `toolReasons` 에 `pdf-editor` 추가("Finish header/footer `{date}` token captures the batch start date."). 새 baseline 캡처 커밋. 총 실행 시간 기록(상한 20분).
- `rendering-baseline.mjs` targets 에 finish 3 route(독립 ID·finish-ready selector) · `accessibility-audit.mjs` pages 에 `/ko/tools/pdf-editor/finish` desktop + 412 mobile(en 도 1개) · recovery 스모크 20도구 표본 **불변**.
### E. 번들(H2 ①·D5 확정 28)
- `npm run bundle:measure`(U4-0 baseline) — entry/route/CSS 총 Δ·shared/app 순증분 5종 상한 통과(상한 변경·override 금지). finish 패널·`pdfFontEmbed` 의 귀속(route vs shared)을 리포트로 기록. 상한 초과 시 **중단하고 보고**(구조 결정은 Claude/astra).
### F. 기록
CHANGELOG(논리 단위별 간결) · review-notes U4-3 절(route/SEO 표·엔진 계약·취소 지점·미리보기 한계·하네스 수치·번들 표·범위 밖 발견) Codx 서명 · `docs/PUBLISHING_CHECKLIST.md` 영향 확인(사이트맵·정적 페이지 항목).

## 3. 검증(전부 실행·기록 — 빌드·시각 회귀·브라우저는 **직렬**, `NODE_OPTIONS=--max-old-space-size=4096`; 호스트 메모리 64GiB 로 증설됨)
`npx tsc -b` · `npm run test:unit` · `npm run build` · `npm run test:static` · `npm run test:pdf-finish`(신설) · `TEST_SCOPE=pdf npm run test:browser`(4모드 불변) · `npm run test:browser`(전체) · `npm run test:new-tools` · `npm run test:utilities` · `npm run test:office` · **`npm run test:qr-bulk`** + **`npm run test:qr-font-render`**(S2b 렌더 회귀 — pdfFontEmbed 이관 후 QR PDF Poppler 픽셀 원본 동일) · `npm run test:recovery` · `npm run fixtures:pdf-legacy-oracle` 비교(diff 0) · `npm run test:excel-cleaner`·`test:excel-compare` · `LANG=ko_KR.UTF-8 npm run test:visual` + `LANG=en_US.UTF-8`(신규 baseline, 시간 기록) · `VITE_LOCAL_QA=1 npm run build` 후 `A11Y_MAX_TOTAL=0 npm run test:a11y` · `npm run test:rendering`(CLS ≤0.1, finish 3 route) · `npm run bundle:measure` · `npm run css:orphans` · `npm run legacy:manifest` · `node tests/tool-registry-routes.mjs`(20) · **`rg "pdf-tool-navigation a:nth-child"` 0건** · 광역 금지 검사(원시 예외 노출·광고 격리) · `git diff --check`.
- 추적 코드 제외 로컬 빌드(`VITE_LOCAL_QA=1`)를 띄우고 finish 3 route × ko/en × desktop/mobile 스크린샷을 `/tmp/worklazy-u4-3/shots/` 에 남긴다(Claude·Gemini 육안 검수 입력 — 규칙 19 는 배포 직전 게이트이나 첫 화면이므로 이 단계에서 1회 선행).

## 4. 금지
main 병합·push · 기존 4모드 UI/문구/동작 변경(취소 버튼 포함) · `pdf.worker.ts` legacy 경로 변경 · subset 재시도·QR selector 전파 · 새 npm 의존 · 상한 override · 정본 미정의 임의 결정 · 계획서 편집 · **검수(astra) 재현 스크립트 수정** · 사용자 파일 조작 · `dist`/`public/vendor` 직접 수정.

## 5. 정지점·보고
커밋 후 브랜치 상태로 정지 → astra 검수. 보고: 커밋별 요지·route/SEO 표·엔진 계약·하네스 수치(진입 12·scenario 수·캡처 수·시간)·번들 5종 표·a11y/CLS 수치·스크린샷 경로·범위 밖 발견·git 상태. 산출물 `/tmp/worklazy-u4-3/`.
