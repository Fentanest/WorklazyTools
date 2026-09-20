# U4-4 fix-3 구현 보고

## 결과

- 브랜치: `s3-pdf-finish`
- 기준 HEAD: `5a9d5b7b5c570ffa7ebb190b23f2e8d4d2aa4a2b`
- 구현 커밋: `e30018dd2d4801c5abba54a88f200e9ac69325d3`
- 커밋 메시지: `fix(pdf): share display runtime and meter module assets`
- main 병합·push·배포: 수행하지 않음

fix-2에서 main에 정적 번들된 full `pdf.mjs`와 thumbnail worker가 URL로 로드한 `pdf.min.mjs`가 따로 배포되었다. 종전 계측기는 `.js`만 세어 두 번째 표시 런타임을 inventory·gzip에서 빼먹었고, 그 결과 “중복 없음 / 5종 통과”라고 오판했다.

fix-3에서 main의 정적 import를 제거하고 main·thumbnail worker가 동일한 패치 full `pdf.mjs?url`을 동적 import하게 했다. production 산출물은 `assets/pdf-CCjkBPdx.mjs` 하나만 표시 런타임으로 배포하며, `PdfEditorPage-fYnFwc57.js`와 `pdfThumbnailRender.worker-CijM2-_s.js` 모두 그 URL을 참조한다. OffscreenCanvas worker와 PDF.js 내부 `pdf.worker.min-CHFwMXne.mjs`는 제거하지 않았다.

## 번들 계측 수리

- measurement schema를 2에서 3으로 올려 종전 불완전 기준선을 fail-closed한다.
- `vendor/**`와 모든 `runtime/` 트리 밖의 `.js`·`.mjs` 전체를 배포 실행 inventory와 gzip 합계에 넣었다.
- route chunk의 배포 URL 참조를 따라 worker/public 자산에 route 소유권을 재귀적으로 전파한다.
- 동일 SHA-256 자산은 한 번만 세고, 변경 전·후 동일 SHA 기여는 신규 app 증가로 세지 않는다. 기존 `pdf.worker.min.mjs`가 이 경로로 보존됐다.
- CSS 계측 범위는 변경하지 않았다.

S3 기준 산출물을 동일 schema-v3 범위로 재생성하고 `BUNDLE_ROUTES=pdf-editor`로 비교했다. 고정 상한·override·multiplier는 바꾸지 않았다.

| 지표(gzip) | fix-2 산출물 v3 정정값 | fix-3 | 상한 | 판정 |
|---|---:|---:|---:|---|
| entry JS | +7,177B | +7,178B | +20,480B | PASS |
| affected PDF route JS | +22,750B | +58,079B | +61,440B | PASS |
| shared JS(귀속 이동 제외) | +133,495B | +2,152B | +30,720B | PASS |
| app JS | +164,213B | +68,185B | +81,920B | PASS |
| CSS | +235B | +235B | +10,240B | PASS |

- overrides: `{}`
- multiplier: `1`
- astra 원본 `bundle-review.mjs` SHA-256: `c3a0877bb1b7c201f8d7d7f13f89db42330d762e19b8889d6cf79cc66486cc3b`
- astra probe: `unmeasuredNewDisplay=[]`, `correctedPassed=true`
- unscoped 대조: `baseline.perRouteJsGzip.audio-studio must be a finite non-negative integer (bytes).` — 기대한 fail-closed이며 PASS로 세지 않음

## 실제 네트워크 대 inventory

실제 영문 워터마크 워크플로에서 성공 응답한 same-origin `.js/.mjs`를 모두 수집했다.

- 로드된 실행 자산: 20개
- meter inventory에서 누락: 0개 (`missingFromMeasurement=[]`)
- 실제 로드된 공유 표시 런타임: `assets/pdf-CCjkBPdx.mjs`
- 동일 자산 참조자: `PdfEditorPage-fYnFwc57.js`, `pdfThumbnailRender.worker-CijM2-_s.js`
- 별도 `pdf.min-*.mjs` 표시 자산: 0개

근거: `evidence/runtime-assets.json`, `evidence/bundle-final.json`, `evidence/bundle-review.json`.

## 응답성·fallback

고정 manifest의 12개 유효 PDF를 각각 3개의 새 1280×900, DPR 1 context에서 측정했다. CPU/network throttling은 없다.

| decoded curve | 중앙 total | 중앙 heartbeat gap | 중앙 Long Task |
|---|---:|---:|---:|
| 16MiB | 1,691.848ms | 41.665ms | 0ms |
| 32MiB | 1,976.756ms | 45.750ms | 0ms |
| 64MiB | 3,017.034ms | 86.220ms | 75ms |
| 128MiB | 5,700.530ms | 161.120ms | 145ms |

- 128/16 total 비율은 8 이하, 128MiB heartbeat는 200ms 이하로 PASS.
- 외부 cancel click→UI: 105.491ms(상한 250ms), stale canvas=false, stale result=false, retry=true.
- `globalThis.Worker=undefined` 실제 브라우저 대조: previewReady=true, outputPreserved=true, routeError=false.
- 128MiB를 포함한 fixture manifest SHA-256: `c2629b4719786580cab709143a17af1728b86eb8e515493109ad2d7276d85eb2`.

근거: `evidence/performance-final.json`.

## PDF.js 의존 패치 재검증

astra 렌더 프로브의 논리는 바꾸지 않고 사용자가 지정한 포트 범위를 지키기 위해 하드코딩된 `4274`만 `4284`로 바꾸었다. 제품 저장소는 bwrap으로 read-only bind했고 산출물은 이 디렉터리에만 썼다. 첫 시도의 Playwright 기본 `/tmp` 생성은 read-only 격리에서 EROFS로 제품 실행 전 중단되었고, 같은 격리에 `TMPDIR` 쓰기 경로만 제공해 재실행했다.

- modern/legacy × full/minified: 네 변형 각 180 fixture 렌더 성공
- 변환 실패: 0
- 각 변형의 패치 변경 fixture: 33
- 독립 scalar oracle: patchedDiff=0, originalDiff=77, rawOracleBad=0, all4Same=true
- 버전·lockfile: `pdfjs-dist@6.2.108`, resolved URL·integrity 불변, other package changes 0
- 패치 대상 네 파일의 원본·패치 SHA 모두 manifest와 일치, 선언한 치환 2회와 정확히 일치
- positive: 원본 적용·멱등 재적용 exit 0
- fail-closed: unknown hash, unknown version, original occurrence, patched occurrence, output hash 대조 5개 모두 Vite 실행 전 exit 1

근거: `evidence/render-matrix.json`, `evidence/render-scalar.json`, `evidence/dependency.json`.

## 전체 검증

| 검증 | 결과 |
|---|---|
| `npx tsc -b` | PASS, 진단 0 |
| `npm run test:unit` | PASS, 319/319, fail·skip 0 |
| `NODE_OPTIONS=--max-old-space-size=4096 npm run build` | PASS, 2,847 modules, 정적 69페이지 |
| `npm run test:static` | PASS, startup recovery 116 documents |
| `PDF_FINISH_TEST_PORT=4280 npm run test:pdf-finish` | PASS, finish smoke + PDF.js/Poppler 160/160 |
| `TEST_SCOPE=pdf npm run test:browser` | PASS |
| `npm run test:browser` | PASS, Excel·Word·PDF |
| `npm run test:new-tools` | PASS, HWP·Image·Audio·Video; Dolby Vision host capability skip은 결정적 unit/fallback PASS |
| `npm run test:utilities` | PASS |
| `npm run test:office` | PASS, 95 download states·7 cached states·Calc edit·DOCX save |
| `QR_BULK_TEST_PORT=4283 npm run test:qr-bulk` | PASS |
| `npm run test:qr-font-render` | PASS, 3 fixture, Poppler changed pixels 0, PDF.js text 동일 |
| `RECOVERY_TEST_PORT=4284 npm run test:recovery` | PASS, 147 cases |
| `npm run fixtures:pdf-legacy-oracle` | PASS, client 3·structure 4·render 32·output 4·input 1, total diff 0 |
| `npm run test:excel-cleaner` | PASS, 취소·재실행·보고서·모바일 포함 |
| `npm run test:excel-compare` | PASS, 취소·재실행·무결성·모바일 포함 |
| `LANG=ko_KR.UTF-8 npm run test:visual` | PASS, 211/211; baseline 갱신 0 |
| `LANG=en_US.UTF-8 npm run test:visual` | PASS, 211/211; baseline 갱신 0 |
| `VITE_LOCAL_QA=1 npm run build` | PASS, 2,847 modules, 정적 69페이지 |
| `A11Y_MAX_TOTAL=0 A11Y_TEST_PORT=4285 npm run test:a11y` | PASS, 12 pages, violations 0, F2 incomplete 0, inherited 925, external 0 |
| `RENDER_TEST_PORT=4286 npm run test:rendering` | PASS, 7 targets×3, external 0, finish max CLS 0.0001480366 |
| `npm run css:orphans` | PASS, orphan 0 |
| `npm run legacy:manifest` | PASS, 155 rules / 153 removed / 0 split / 2 active |
| `node tests/tool-registry-routes.mjs` | PASS, 20 tools, missing·unexpected·duplicate 0 |
| `git diff --check` / `git diff --cached --check` | PASS |
| schema-v3 scoped `npm run bundle:measure` | PASS, 5/5, override `{}`, multiplier 1 |
| astra 원본 `bundle-review.mjs` | PASS, 새 미계측 표시 자산 0 |

PDF finish의 `standardFontDataUrl` 경고와 QR 렌더러의 font-type 경고는 기존 환경 진단이며, 양 렌더러 골든·텍스트·픽셀 검증은 통과했다.

## 기록·범위·상태

- `docs/review-notes.md` 최상단에 fix-3 근거·실측값을 기록했다.
- fix-2 섹션 내 “표시 런타임 중복 없음”과 `.mjs` 누락 예산 통과 문장을 직접 기각·정정했다.
- `CHANGELOG.md`에 코드 변경을 Codx 서명으로 기록했다.
- 사용자 화면·문구·route 변경은 없어 한·영 현지화, SEO·정적 페이지, AdSense 격리 경로의 추가 변경은 필요하지 않았다. 정적·visual·a11y·rendering으로 무회귀를 확인했다.
- 사용자가 이미 두던 `after.docx`, `before.docx`, 네이버 확인 HTML, `newui/`는 열거나 stage하지 않았고 커밋 후에도 그대로 미추적이다.
- 금지 worktree에는 접근하지 않았고 `/tmp/worklazy-u4-4-review3`은 읽기 전용 소스로만 사용했다. probe 쓰기는 bwrap의 `/tmp/worklazy-u4-4-fix3` mapping으로 격리했다.

## 산출물

- `evidence/bundle-baseline-v3.json`: 동일 자산 범위의 S3 기준선
- `evidence/bundle-final.json`: 최종 scoped 계측
- `evidence/bundle-review.json`: astra 원본 probe 결과
- `evidence/runtime-assets.json`: 실제 네트워크↔inventory 대조
- `evidence/performance-final.json`: 12×3 성능·취소·fallback
- `evidence/dependency.json`: 패치 범위·fail-closed·lockfile
- `evidence/render-matrix.json`, `evidence/render-scalar.json`: 4×180 렌더·독립 oracle
- `evidence/a11y.json`, `evidence/rendering.json`, `evidence/recovery/`: local-QA·복구
- `shots/`: PDF finish 브라우저 캡처

