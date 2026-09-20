# W0~W5 완료 게이트·되돌리기 — 정본 삽입 제안

여기서 ui-* 신규 검증 파일은 sol이 해당 단계 제품 코드와 함께 작성할 산출물이다. 현재 존재하는 명령으로 위장하지 않는다. 이번 반박에서 실제 실행한 명령·결과는 REPORT.md에 별도로 기록한다.

## 공통 실행

실행 위치는 S3 통합 뒤의 UI 전용 git worktree. BASE_SHA·부모 단계SHA·bundle baseline·visual profile/PNG SHA·열린 계획서 소유권 manifest를 저장한다. 문서 비교 엔진의 통합 상태도 재확인한다. 각 명령 stdout/stderr·exit·실행시간·browser version·source/build SHA를 기록하고 실패하면 다음 완료 단계로 넘어가지 않는다.

~~~bash
export NODE_OPTIONS=--max-old-space-size=4096
export UI_BASE_BUNDLE=/tmp/worklazy-ui-impl/base/bundle.json
export UI_RUN_DIR=/tmp/worklazy-ui-impl/STEP
export TMPDIR="$UI_RUN_DIR/tmp"
export npm_config_cache="$UI_RUN_DIR/npm-cache"
export NODE_COMPILE_CACHE="$UI_RUN_DIR/node-cache"
mkdir -p "$TMPDIR" "$npm_config_cache" "$NODE_COMPILE_CACHE"
export TEST_BASE_URL=http://127.0.0.1:4230
export VISUAL_CONCURRENCY=1
export VISUAL_ARTIFACT_DIR="$UI_RUN_DIR/visual"
export A11Y_REPORT_PATH="$UI_RUN_DIR/a11y.json"
export RENDER_REPORT_PATH="$UI_RUN_DIR/rendering.json"
~~~

모든 단계 공통: npm run build(production, tsc 포함) → node node_modules/typescript/bin/tsc -b → npm run test:unit → npm run test:static → 단계 smoke → node tests/tool-registry-routes.mjs → git diff --check. exit0 외에 결과 개수·미누락도 확인한다. 하드코딩된 artifact 경로는 명시 out 인자로 바꾸고 TMPDIR만으로 전부 격리했다고 주장하지 않는다.

QA 단계: production smoke → 서버 종료 → VITE_LOCAL_QA=1 npm run build → node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4230 --strictPort. 빌드·브라우저는 직렬. QA의 production analytics 부재로 static이 실패하는 것을 validator 완화로 숨기지 않는다. 마지막 production 재빌드/static 전에는 W5 완료가 아니다.

## 단계 판정표

| 단계 | 추가 실행 명령 | PASS·회귀 위험·복귀점 |
|---|---|---|
| W0 | node tests/ui-theme-static.mjs --dist dist --out "$UI_RUN_DIR/theme-static.json"; node tests/ui-theme-surfaces.mjs --matrix tests/ui-theme-surfaces.json --out "$UI_RUN_DIR/surfaces.json"; node tests/ui-theme-bootstrap.mjs --out "$UI_RUN_DIR/bootstrap.json"; npm run test:recovery; npm run test:utilities; npm run test:browser; npm run test:new-tools | 아래 W0 정량 기준 전항. CSS count/source 문자열 oracle 교체도 W0. 파일·편집 상태 보존. source/HTML 미분류0·색/FOUC/OS cross 실패0. checkpoint=W0. 미통과면 S3통합 base에서 해당 변경 원인 교정. |
| W1a 일반6종 | node tests/ui-primitives-browser.mjs --set general --out "$UI_RUN_DIR/primitives.json"; npm run test:control-geometry; npm run test:ui-migration; npm run test:browser; npm run test:utilities; npm run test:excel-compare; npm run test:excel-cleaner; npm run test:new-tools | PRIMITIVES.md 전체 계약을 실제 public 컴포넌트 fixture로 4theme×2locale×2viewport=16 조건에서 확인. ref/render/form/controlled 거절, invalid interactive nesting0, switch 중심≤0.5px/이탈0. BaseUI 패키지 전체 제거는 아직 강제하지 않음. 복귀=W0. |
| W1b Sheet | node tests/ui-primitives-browser.mjs --set sheet --out "$UI_RUN_DIR/sheet.json"; npm run test:utilities; npm run test:control-geometry; node tests/ui-isolation-smoke.mjs --out "$UI_RUN_DIR/isolation.json" | 기존 bottom sheet geometry 유지. PRIMITIVES Sheet 상세 case ID 전부 등록. nested·양방향Tab·route·820↔821·unmount·StrictMode에서 focus/scroll 누수0. 복귀=W1a. |
| W2 셸/검색/select | node tests/ui-shell-search.mjs --out "$UI_RUN_DIR/shell.json"; npm run test:utilities; npm run test:new-tools; npm run test:office; npm run test:xls-preserve; npm run test:xls-first-load; node tests/ui-isolation-smoke.mjs --out "$UI_RUN_DIR/isolation.json"; QA A11Y_MAX_TOTAL=0 npm run test:a11y; npm run test:rendering | SELECTORS.md의 selector·라우팅·IME·touch·modal/편집 shortcut·상태유지. 320/390/620/621/820/821/1099/1100/1439/1440/1920에서 expanded/collapsed/drawer 가로 overflow≤1px, 조작 target 차폐0. HWP focus shell은 새 header 아래 가용영역 충족. axe0+incomplete 미판정0. 복귀=W1b. |
| W3 홈/에셋 | node scripts/generate-hero-assets.mjs --verify; node tests/ui-home-assets.mjs --out "$UI_RUN_DIR/home.json"; npm run test:utilities; QA npm run test:rendering; A11Y_MAX_TOTAL=0 npm run test:a11y; BUNDLE_BASELINE="$UI_BASE_BUNDLE" BUNDLE_MEASURE_OUTPUT="$UI_RUN_DIR/bundle.json" npm run bundle:measure | ko20/en19+privacy article1·HOW IT WORKS3, heading/DOM全文/link/tags 계약. 12asset SHA/크기/codec/예산一致. initial image 중복요청0, slot-sizes 계산차≤1px. DPR1/2·mobile/desktop·CPU4x·1.6Mbps down/750Kbps up/150ms RTT 각 cold3회. CLS 각≤0.1, LCP element/median/max 기록. 복귀=W2. |
| W4 도구/문서결과/의존종료 | §6-B U1~U6 구현은 여기. node tests/document-result-entry.mjs --verify --out "$UI_RUN_DIR/document-result.json"; 아래 전 스코프 smoke; node tests/ui-dependency-audit.mjs --out "$UI_RUN_DIR/dependencies.json"; npm run css:orphans; npm run legacy:manifest; node scripts/generate-third-party-licenses.mjs; 동일schema bundle:measure | single primary·배지/icon tint·diff/error/success/PDF 의미색 보존. U1~U6 모두 재현(529px은 이전 셸 실측이므로 새 셸 차감값 재산출). BaseUI/shadcn 실행 의존0·미분류 hit0. library 소스/6색/rule수 oracle를 제품 행위·owner 검사로 대체. 엔진 변경0. 복귀=W3. |
| W5 최종 | 아래 baseline 절차; QA a11y/rendering/contrast/geometry/isolation 전항; astra 검수·Claude 판정·Gemini 육안 검수; production npm run build·npm run test:static·git diff --check | 동일source/build/browser의 UPDATE 없는 모든 shard PASS, axe0/incomplete 미판정0, CLS 각≤0.1, bundle5종 한도内. QA tracking0·광고 조작부 겹침0. 글자 세로낙하·thumb 정렬 포함 Gemini 육안+Codx 수치 보고. source SHA 동일. 이번 반박의 배포 승인이 아님. |

## W0: legacy 직접 배경 최소 일관성의 정량 정의

1. 이번 main CSS literal 후보는 legacy-color-candidates.json 138개, OS dark media 안31개다. 이 목록은 예외 allowlist가 아니다. 착수 hash에서 저장소 전체의 CSS/TS/TSX/JS/MJS/CJS/HTML을 재귀 탐색해 파일/행/selector/state/owner를 저장한다. node_modules/.git은 의존·메타 입력으로 구분; generated/vendor는 정확한 목적·소유자로 따로 inventory. 현재 hit를 기대 allowlist로 자동 생성하는 검사는 금지.
2. direct surface는 W0 이관 또는 정확한 preview/fallback/vendor 예외로 분류한다. 일반 home/sidebar/header/card/form/placeholder/consent/prose/log/drag 배경에 미분류 W4 defer는 허용하지 않는다. W4는 최종 도구 표현/레이아웃 정합의 소유자다.
3. 새 tests/ui-theme-surfaces.json의 각 항목은 id,route,locale,viewport,setupActions,selector,minimumCount,properties,contrastPairs,exception. 로그·선택·오류·성공·checkerboard·동의배너·문서결과·Office/XLS/Video host·공개 문서까지 각 소유 surface를 실제 mount한다. selector 0개는 skip가 아니라 FAIL.
4. 4테마×OS2의 같은 selector에서 color/background/border/image/native scheme을 수집한다. OS만 바꾸면 지정속성 전부 동일. DOM theme·React state·theme-color·asset family 일치. 본문4.5, 실제 CSS24px 이상 또는18.6667px 이상+700 이상만3; focus/control 경계3. alpha/gradient/overlay는 합성 후 최저대비, NaN/측정불가/누락은 통과 아님.
5. missing/invalid/blocked-read→light-coral; blocked-write→현재 탭 선택 유지, reload는 읽을 수 있는 저장값. rapid4회 순환 원복·focus유지·앱 remount0(File참조/편집상태). module500ms delay·module실패·404/redirect/격리·JS-off 안내 유지. startup-help는 CSS비의존 white/#222 고정 예외. 저장 타탭 storage event 동기화는 범위 밖.
6. print=white/black·장식/shadow/glow 제거, forced-colors=Canvas/CanvasText/ButtonText/Highlight·focus/선택 식별, reduced-motion=비필수 motion0. 기존 폼 내용과 조작 의미는 유지.
7. 부정대조 실행 완료: w0-browser.mjs의8조건·home/document16진입은 **r1 옛 QA 사본의 OS 종속 surface32개**를 검출했다. data-theme가 맞아도 배경이 OS를 따르면 미통과. 이것은 미구현 v2의 실패 수치가 아니다.

## 전 스코프의 정확한 명령 집합

각각 npm run으로 직렬: test:browser, test:new-tools, test:utilities, test:office, test:qr-bulk, test:recovery, test:excel-compare, test:excel-cleaner, test:xls-preserve, test:xls-first-load, test:control-geometry, test:ui-migration, test:pdf-finish, test:pdf-finish-oracle.
별도 TEST_SCOPE=pdf npm run test:browser 및 node tests/tool-registry-routes.mjs.
S3 통합 시 추가된 필수 검증·등록은 삭제하지 않는다. 영향 없는 성능/엔진 검사를 무조건 늘리지 않는다.

## 시각·a11y·rendering

- existing203→406 정확한 집합=visual-profiles-406.csv/json, home16. 추가 제안은 검색3상태48+desktop접힘8+mobile drawer8+문서결과3profile×family2=70. 현재 기준 app **476장**. 실제 primitive를 import하는 별도 fixture16 캡처는 행동 suite로, product route/card 개수에 넣지 않는다.
- 1차175장496.2초의 선형 추정: 406=1151.184초(19m11.2),476=1349.664초(22m29.7). 476 단일20분 보장은 불가. 새 VISUAL_SHARD=1/2,2/2 계약: canonical ordered expanded list의 index%2, 현재238/238. 두 프로세스는 직렬, 각 timeout --signal=TERM 20m npm run test:visual. shard 합집합 누락/중복0. 속도 보장으로 표현하지 않음.
- 새 node tests/ui-visual-manifest.mjs --plan은 생성/교체/삭제 파일명·사전SHA를 저장. full expected manifest는 filter/shard 전에 생성. coordinator에서 정리1회→UPDATE 각shard→동일build/browser에서 UPDATE env unset한 각shard. 예상 밖 수정/삭제0. 현재 global-delete 함수를 partial update에 조용히 재사용하지 않는다.
- tests/ui-theme-fixture.mjs는 Puppeteer visual과 Playwright a11y/rendering 공유. context init에서는 storage만 seed하고 제품 bootstrap이 data-theme를 설정하도록 한 뒤 capture/axe/metric 수집 전에 assertTheme. 이름과 DOM 불일치 FAIL. 복구/FOUC는 seed 없는 독립context.
- a11y 등록ID는 baseId__locale__theme__viewport, 기존 baseId 필드 유지. 기존11개 S3 target 각각4theme 보존, actual homeko/en×desktop/mobile×4, 검색3상태 full, drawer mobile full, 결과3×family2 추가. 기존 target의 viewport/locale 유지, suffix 때문에 HWP exact exception·document-compare placeholder 조건이 사라지지 않게 baseId로 매칭. 각profile placeholder 대비를 따로 저장, 마지막 값으로 덮지 않음. duplicate/missing0·axe0·incomplete 미판정0.
- rendering 기존6target 각각4theme/기존ko1280×800/3run 보존 + homeko/en×1365/390×4 + theme/family전환 + 결과3profile×family2×3run. installRenderingObservers의 worklazy_lang='ko' 덮어쓰기를 observer에서 분리하고 seedTheme→observer를 한 init으로 실행. 결과 mount 직전 CLS reset, 입력/결과 metric phase 분리. 현행6target이 그대로인지 S3 통합 후 재확인.
- 번들 기본 누적 상한: entry+20,480B, affected routes+61,440B, shared+30,720B, app+81,920B, CSS+10,240B. 동일 measurement schema·route集合·mode로 BASE_SHA 대비, 단계별 baseline을 새로 잡아 예산을 리셋하지 않음.

복귀점은 UI전용 worktree에서 해당 단계 변경을 수리/재구현하기 위한 checkpoint다. 병행 트리 reset/checkout·타인 변경삭제·검수 전 main 배포는 금지. 최종 승인 전 baseline은 별도 artifact로 비교하고 기존 기준선을 임의 교체하지 않는다.

— Codx
