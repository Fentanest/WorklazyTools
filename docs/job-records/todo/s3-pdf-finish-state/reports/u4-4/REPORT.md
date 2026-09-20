# U4-4(F2) 구현 보고

- 브랜치: `s3-pdf-finish`
- 기준 HEAD: `31529570059efe2478fb0326baf7740bc4861783`
- 구현 커밋: `5767f135443f113e655fbb0801a01e4d3c11de23` (`feat(pdf): add vector watermark finish mode`)
- main 동기화·병합·push·배포: 수행하지 않음
- 종료 상태: 추적 변경 0. 사용자 미추적 `after.docx`, `before.docx`, 네이버 확인 HTML, `newui/`만 남음

## 구현 결과

- `/tools/pdf-editor/watermark` 직접 route와 워터마크 탭, ko/en SEO·FAQ·canonical·정적 페이지·sitemap·소셜 이미지를 추가했다.
- 텍스트는 PDF Form XObject 안의 벡터 glyph로 출력한다. Helvetica/Noto coverage와 고정 Noto asset의 배치당 1회 로드를 기존 F1 경계에서 공유한다.
- PNG/JPEG는 문서당 이미지 XObject 하나를 임베드하고 단일/타일 배치가 같은 reference를 반복한다.
- 배경/전경, 단일/최대 400개 타일, 7영역, 회전·불투명도·크기·간격·offset, CropBox/UserUnit/페이지 회전을 지원한다.
- 독립 content stream은 `q /Artifact BMC ... EMC Q`로 격리한다. 배경은 새 reference를 등록한 뒤 `/Contents` 배열의 정확한 항목을 제거해 index 0에 넣고, 전경은 마지막에 둔다.
- q/Q 불균형·OCG·tagged document는 사전 경고하며 명시 동의 뒤 선택한 layer 그대로 실행한다. 비정상 Contents는 조용한 전경 폴백 없이 차단한다.
- 저장 결과를 다시 열어 페이지 수와 선택 페이지 첫/마지막 watermark stream을 확인하며 실패 결과는 제공하지 않는다.
- PDF canvas 위 text/image single/tile overlay, object URL cleanup, 범위↔썸네일 양방향 동기화를 추가했다.

## 구조·골든 증거

- `/Contents` fixture: 없음, 단일 stream, 다중 stream, 비정상 entry 4종.
- 정상 3종은 layer 2 × pattern 2 × rotation 4 × renderer 2 = 96렌더를 통과했다.
- 비영점 CropBox 4쪽 고정 색상 fixture의 layer 2 × pattern 2 × page 4 × renderer 2 = 32렌더를 더해 총 128/128이다.
- 비정상 entry는 사전 검사에서 `background-placement`로 차단되고 결과가 없다.
- 픽셀 원수치: `golden/metrics.json`. PDF.js/Poppler 모두 background에서는 원본 blue가 watermark red 위에, foreground에서는 watermark red가 blue 위에 놓임을 단언한다.
- 이미지 resource unit: `/Subtype /Image` 1개, 반복 `Do` 여러 개. 116B PNG의 single output 1,175B, tile output 1,270B, delta 95B다.
- 텍스트 resource unit: form별 font resource 1개와 벡터 text extraction을 단언한다.
- 최초 골든이 이미지 XObject의 이중 크기 배율로 인한 비가시 출력을 검출했다. XObject 단위 사각형 계약으로 수정한 뒤 전체 렌더를 재통과했다.

## 번들 5종

고정 schema-v2 기준 `/tmp/s3-bundle-baseline.json`, `BUNDLE_ROUTES=pdf-editor`, override `{}`, multiplier 1. 최종 JSON은 `bundle-u4-4.json`이다.

| metric | 현재 gzip | 누적 순증분 | 상한 | 잔여 |
|---|---:|---:|---:|---:|
| entryJsGzip | 306,237B | +6,950B | +20,480B | 13,530B |
| affectedRouteJsGzip | 190,745B | +18,881B | +61,440B | 42,559B |
| sharedJsGzip | 3,228,428B | +2,161B | +30,720B | 28,559B |
| appJsGzip | 5,495,335B | +28,748B | +81,920B | 53,172B |
| cssGzip | 37,905B | +218B | +10,240B | 10,022B |

QR route→shared 이동 509,794B는 순증분과 분리됐다. 첫 기준 비교는 `BUNDLE_ROUTES`를 생략해 PDF-only baseline과 전체 route 집합이 달랐고 baseline audio route 부재 오류로 거부됐다. 이를 성공으로 계산하지 않고 scoped 명령으로 재실행했다. 불필요한 동적 import 제거 뒤 `PdfFinishPanel` production chunk는 54.56kB/gzip 17.21kB다.

## 시각 기준선

- 신규 8개: `pdf-finish-watermark__interaction__{ko,en}__{light,dark}__{desktop,mobile}.png`
- 수정 16개: `pdf-finish-{page-numbers,header-footer}__interaction__{ko,en}__{light,dark}__{desktop,mobile}.png`
- 수정 4개: `pdf-finish-navigation__active__{ko,en}__light__{mobile,mobile-320}.png`
- 합계: 신규 8 + 수정 20 = 28개.
- 첫 전체 visual의 기존 finish 20개 실패는 세 번째 탭 추가로 인한 실제 UI 변화였다. diff 육안 판정 뒤 그 20개만 갱신했고 최종 211/211을 통과했다.
- 직접 경로 캡처: `pdf-finish-shots/`. 최종 제품 시각 검수는 ko/en desktop/mobile에서 탭, 문구, form, overlay, overflow를 확인했다.

## 완료 기준

| 검증 | 결과 | 원출력 |
|---|---|---|
| `npx tsc -b` | exit 0, 진단 0 | `logs/tsc-final.log` |
| `npm run test:unit` | 306/306, fail·skip 0 | `logs/test-unit-final.log` |
| production `npm run build` | 2,847 modules, 정적 69페이지 | `logs/build-final.log` |
| `npm run test:static` | startup recovery 116, 통과 | `logs/test-static-final.log` |
| `npm run test:pdf-finish` | 16 직접 진입, F1 회귀, F2 text/image/tile/risk, CropBox/4회전, 128 golden 통과 | `logs/test-pdf-finish-final.log` |
| `TEST_SCOPE=pdf npm run test:browser` | 기존 PDF 4모드 통과 | `logs/test-browser-pdf.log` |
| `npm run test:browser` | Excel·Word·PDF·shared UI 통과 | `logs/test-browser.log` |
| new-tools·utilities·office | 통과 | `logs/test-new-tools.log`, `test-utilities.log`, `test-office.log` |
| QR bulk·QR font render | 통과 | `logs/test-qr-bulk.log`, `test-qr-font-render.log` |
| recovery | 147 cases 통과 | `logs/test-recovery.log` |
| legacy oracle | client 3, structure 4, render 32, output 4, input 1, total diff 0 | `logs/pdf-legacy-oracle.log` |
| Excel Cleaner·Compare | 통과 | `logs/test-excel-cleaner.log`, `test-excel-compare.log` |
| 전체 visual | ko/en 포함 211/211, 2m15.11s | `logs/test-visual.log` |
| 최종 `VITE_LOCAL_QA=1 npm run build` | 2,847 modules, 정적 69페이지 | `logs/build-local-qa-final.log` |
| a11y | 12페이지, axe 위반 0, 외부 요청 0 | `logs/test-a11y-final.log`, `a11y-final.json` |
| rendering | 7대상×3회, 외부 요청 0, watermark CLS max 0.0001480366 | `logs/test-rendering-final.log`, `rendering-final.json` |
| scoped bundle | 5종 상한 통과 | `logs/bundle-compare-final.log`, `bundle-u4-4.json` |
| CSS orphan | 0 | `logs/css-orphans.log` |
| legacy manifest | 155 rules / 153 removed / 0 split / 2 active | `logs/legacy-manifest.log` |
| tool registry | 20, 누락·중복 0 | `logs/tool-registry-routes.log` |
| `git diff --check` | 통과 | `logs/git-diff-check.log` 및 commit 후 재실행 |

Node PDF.js의 `standardFontDataUrl`과 QR Poppler font-type 출력은 기존 환경 경고이며 해당 텍스트·픽셀 oracle은 통과했다. 사용 포트는 4280~4285이고 모두 `--strictPort` 경로다.

— Codx
