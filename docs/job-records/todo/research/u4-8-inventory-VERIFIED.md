# U4-8 인벤토리 — Gemini 산출물 검증 (Claude, 2026-09-09)

원본: `<scratchpad>/gemini-u4-8-inventory-out.md` (agy, gemini-3.1-pro-high).
「Gemini 산출물은 단서다」 규칙에 따라 전 항목을 실측 대조했다. **채택**과 **기각**을 아래에 가른다.

## 채택 — 실측으로 확인됨

| 주장 | 실측 확인 | 근거 |
|---|---|---|
| 워터마크+도장 동시 지정을 엔진이 거부 | **확인** | `engine.ts:287` `if (options.watermark && options.stamp) throw ... { field: "decoration" }` |
| 도장이 있으면 다른 장식을 건너뛰고 즉시 반환 | **확인** | `engine.ts:736-739` `if (input.options.stamp) { ...; return analyzeStamp(...) }` |
| 이미지 워터마크도 즉시 반환 | **확인** | `engine.ts:750` |
| 구조 제거·최종 raster 는 직교 적용 | **확인** | `engine.ts:473`(구조) · `engine.ts:971`(raster) |
| 다중 파일 입력 루프가 concurrency 1 | **확인** | `engine.ts:931` `for (const [fileIndex, source] of input.files.entries())` + `await` |
| 두 옵션 이상을 동시에 켜고 출력을 단언하는 테스트 없음 | **확인** | `test:pdf-finish` 는 smoke·watermark·stamp·structure 골든 4종 체인, 각각 단일 축 |
| legacy oracle 기준선 위치 | **확인** | `tests/fixtures/pdf-finish/legacy-oracle/` (client·structure·render·input.pdf·output·manifest.json) |
| `legacy-organize` 라는 이름의 preset 객체는 없음 | **확인** | 저장소 전체 grep 0건 |

## 기각 — 실측이 뒤집음

### 1. "`zipArchive`·`fileNameSafety` 를 import 하는 것은 `videoZipArchive.ts` 뿐이고 PDF finish 는 안 쓴다"

**부분 오류.** PDF finish 가 안 쓴다는 것만 맞고, importer 목록이 **틀렸다**. 실제로는 **4개 기능**이 쓴다:

```
src/features/qr-studio/QrBulkPanel.tsx:10,11,285
src/features/excel-cleaner/ExcelCleanerPage.tsx:13,14
src/features/excel-compare/ExcelComparePage.tsx:13,14
src/features/video-studio/videoZipArchive.ts:3,4
```

**원인은 명확하다**: Gemini 자신의 명령 기록이 `grep_search 'zipArchive' in src (Includes: *.ts)` 로 **`.tsx` 를 제외**했다. 누락된 3개가 전부 `.tsx` 다.

**이 정정이 중요한 이유**: 두 유틸이 이미 앱에 있으므로 PDF route 가 import 해도 **새 앱 바이트가 아니라 귀속 이동**이다. Gemini 목록대로였다면 번들 판단이 달라졌다.

### 2. legacy 보존 값 대조표 (B절) 전체

**범주 오류로 기각.** Gemini 는 `PdfFinishPanel.tsx` 의 **새 finish 기능 기본값**을 "코드의 현재 값"으로 적었다. 정본이 보존하라는 것은 **legacy organize 경로**의 값이다. 그래서 "불일치" 3행(MediaBox·alpha 0.82·Helvetica 9pt y=12)이 **전부 오판**이다 — 실제 legacy 경로에는 세 값이 정확히 있다.

실제 위치(Claude 실측):

- **client PNG** `src/features/pdf-editor/pdfWorkerClient.ts:91-107` — alpha `.82`(`:100`), 폭 `420~1800`(`:96`), 높이 `92`(`:98`), `slice(0,120)`(`:103`)
- **worker 그리기** `src/features/pdf-editor/pdf.worker.ts:92-116` — `degrees(-32)`(`:107`), `opacity: 0.2`(`:108`), `page.getSize()` 비보정(`:98`), Helvetica·`size=9`·`y:12`(`:94,113,114`), `rgb(0.35,0.35,0.38)`·`opacity 0.9`(`:114`), 전 페이지(`:97`)

Gemini 는 `grep_search '0.82' in src` 를 돌렸다고 기록했으나 `pdfWorkerClient.ts:100` 의 `.82`(**선행 0 없는 표기**)를 못 잡고 "없음"으로 결론했다. 문자열 매칭의 한계다.

### 3. "비디오 스튜디오가 따라야 할 기존 ZIP 패턴"

**더 나은 선례가 있어 대체.** `QrBulkPanel.tsx:285` 가 `@zip.js/zip.js` 와 `zipArchive.ts` 를 **함께 지연 import** 한다 — PDF route 예산을 지키려면 이 형태를 따라야 한다. 정적 import 하면 route 가 zip.js 를 통째로 먹는다.

## Gemini 가 놓쳤고 Claude 실측으로 추가된 것

1. **legacy 경로는 이미 복합 적용을 한다** — `pdf.worker.ts:99,110` 의 `decoratePdf` 가 워터마크와 페이지 번호를 **함께** 그린다. 새 엔진이 이를 배타로 좁힌 셈이다.
2. **legacy 경로는 이미 ZIP 을 만든다 — 단 JSZip** (`pdf.worker.ts:81-89`). 새 경로는 정본 C3 대로 zip.js 를 쓰되 **legacy 를 갈아끼우면 안 된다**(「명시 제외」 위반).
3. **배타 제약의 출처**: `git log -S 'options.watermark && options.stamp'` → **`8ec3e4e` (U4-5 도장 구현)**. 정본에 이 배타를 승인한 항이 **없다** — 정본 416 행의 "배타 모드"는 AcroForm 축이다. 즉 **정본 12 의 조용한 축소**이며 U4-8 최종 누락 감사 대상이다.

## 판정

Gemini 의 구조적 발견(장식 배타 차단)은 **정확했고 이번 단계의 성격을 바꾼다** — U4-8 4-1 은 "골든 추가"가 아니라 "복합 파이프라인 구축"이다. 반면 **모든 상수·경로 대조는 틀렸다**. 이번에도 「Gemini 산출물은 단서다」가 값을 했다: 구조 통찰은 채택, 수치·경로는 전량 실측 대체.

---

# 부록 — 번들 구조 실측 (Claude, 2026-09-09) : SCOPE-OUT 대비

U4-8 이 잔여 예산(app 4,764B · PDF route 6,327B)을 넘길 가능성이 4-1 발견으로 커져, 사용자가 사전 등록한 대비책(「또 초과하면 상향 요청 없이 SCOPE-OUT → 구조 변경 실행」)의 근거를 미리 실측했다.

## 계측기가 worker 안을 못 본다

`/tmp/worklazy-u4-7/final-bundle-full.json` 실측:

| realm | 자산 수 | attribution |
|---|---:|---|
| main | 64 | `modules` (모듈 단위로 보임) |
| worker | 42 | **`opaque`** (파일 통째로만 계산) |
| public | 1 | `opaque` |

즉 **worker 청크 43개는 내부 모듈 구성이 계측기에 보이지 않는다.** Vite 가 main 과 worker 를 분리된 Rollup 빌드로 만들기 때문이다. 번들 지표는 크기로는 세지만 "무엇이 중복인지"는 말해 주지 않는다.

## pdf-lib 중복 배포는 실재한다

`dist/assets` 실측:

| 청크 | raw | gzip | pdf-lib 내부 심볼(`PDFHexString`/`PDFRawStream`) |
|---|---:|---:|---|
| `pdf.worker-B5Ox1eh5.js` (legacy worker) | 565,857B | **219,812B** | 있음 |
| `pdfFontEmbed-DaVr2xJ6.js` (main) | 1,149,574B | **509,403B** | 있음 |

**두 청크가 각각 pdf-lib 을 따로 담고 있다.** 백로그의 "pdf-lib 중복 배포, 80~120KB 회수 가능" 주장은 **구조적으로 확인**됐다(정확한 회수액은 실제 분리 작업에서 측정해야 한다 — 여기서 확인한 것은 중복의 존재이지 금액이 아니다).

주의: `dist/` 는 U4-7 측정과 다른 빌드다(해시 `DaVr2xJ6` vs 측정 파일의 `e-VBZZP8`). 구조 판정에는 무관하나 **금액을 인용할 때는 같은 빌드에서 다시 재라.**

## 이것이 의미하는 것

SCOPE-OUT 이 발동하면 그것은 막다른 길이 아니다. 구조 변경(중복 제거)이 회수하는 양은 U4-8 이 필요로 하는 양보다 **한 자릿수 크다.** 다만 비용이 5~10 인일로 추정돼 있어 **사용자 판단 사항**이며, U4-8 을 억지로 우겨넣는 것보다 먼저 물어야 한다.
