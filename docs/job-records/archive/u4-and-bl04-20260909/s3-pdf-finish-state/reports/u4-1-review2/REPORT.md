# U4-1 fix-1 재검수 — Codx

**최종 판정: [수정 후 재검수].** F1~F4는 해소됐고, 현재 코드의 독립 골든 14그룹과 공통 검증은 모두 통과했다. **F5의 요청된 회귀 단언 일부가 남았다.** 의도적으로 계약을 깨뜨린 7개 사본이 각각 기존 finish unit **13/13을 통과**했다. 검증 기록의 원로그 경로도 정정해야 한다.

- 대상: `s3-pdf-finish`, HEAD **`ba762b4b1cf38b13bef3013aa465e59e33eb9146`**. fix 기준 `fd37ceab057ced2941fb752b2511124dbeaafda4`, main **`5bc6854175331bdd73b267784d9633cdccda8446`**.
- 첫 행동은 `PROJECT_RULES.md` 전문 읽기. `AGENTS.md`, 정본의 우선순위·N3/D3/D7/D8/N1/N2 관련 절, 원 구현/fix/review2 지시서, 1차 REPORT·UNIT-MAPPING·하네스, sol REPORT 및 지정 경로의 기존 기록을 대조했다.
- 실행 게이트: HEAD·main 일치. 열린 계획서 검색은 `open-plans-scan.txt`; PDF 정본·로드맵·QR/P2 후속과 이번 finish 순수 모듈 검수에 상반된 현행 지시 없음. 과거 로드맵의 낡은 ref는 최신 dispatch 및 실제 ref로 대조했다.
- 실행 장소: 지정 두 커밋을 `git archive`로 `/tmp/worklazy-u4-1-review2/head`와 `main`에 전개했다. 의존성·vendor는 기존 파일 복사이며 설치하지 않았다. **HEAD 사본 추적 2,543파일의 시작 SHA 불일치 0**(`copy-integrity.json`). 모든 빌드는 **직렬, `NODE_OPTIONS=--max-old-space-size=4096`**. 브라우저 스모크는 빌드가 끝난 뒤 production preview에서 실행했다.
- 이 보고서의 상대 경로는 모두 `/tmp/worklazy-u4-1-review2/` 아래다. 원 저장소 추적 파일 수정·커밋·push·브랜치 전환 없음. 별도 오류 주입 사본은 `mutants/`에만 존재한다.

## 지시 항목별 판정

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| **F1 고정400** | **[통과]** | `node --experimental-strip-types /tmp/worklazy-u4-1-review2/defects.mjs` → 예상420에 `{ok:false,error:"tile-limit",count:420,maximumTiles:400}`, **allocated0**, 옛 override getter 읽기0. `type-negative.json`의 tsc 명령 → 의도한 **TS2353/exit2**, `maximumTiles does not exist in type TileLayoutInput`. 공통 tsc는 exit0 | 없음. 결과 객체의 `maximumTiles:400`은 상한 안내값이며 입력 override 경로와 다름 |
| **F2 narrow-region** | **[통과]** | 같은 `defects.mjs` → Helvetica12pt, 폭5에서 긴 줄·`i`·빈 줄 모두 `narrow-region`; `i=2.664pt`, ellipsis=12pt. 폭12 초과 줄은 `…`/12pt만. 골든50×28.8/높이10도 통과. F2 재도입 대조 mutant는 기존 unit **12 pass/1 fail** | 없음 |
| **F3 시점 raw ledger** | **[통과]** | 같은 `defects.mjs` → 시점별 **1200B/2,800B/2,200B/1**, peak1200B/2. 문서 누적을 **1,677,721,600px / 6,710,886,400B**로 늘려도 동일 peak; explicit empty ledger peak0. 출력은 metrics만. `canvasPolicy.ts:35–65,121–160`의 타입·주석·실행식 대조 | 없음. 이 값은 raw 자원 합계이며 관측 heap 또는 B 차단 게이트가 아님 |
| **F4 loader·package** | **[통과]** | `node --experimental-strip-types /tmp/worklazy-u4-1-review2/loader-check.mjs` → helper 정적1줄, export identity=true, **87분류56/31** 및 함수SHA 1차와 동일, 새 `dependency.ts` fixture **exit0/출력7**. `python3 …/scope-audit.py` → package script 한 줄 외 diff0. npm oracle도 native flag로 실제 실행 | 없음. plain Node 지원은 요구하지 않음 |
| **F5 unit 골든 대응** | **[결함] F5-R/P2** | `node --experimental-strip-types …/source-audit.mjs` → 13개, E6 요구 리터럴 모두 존재·PDF.js/DPR 실제사용 확인. 그러나 `python3 …/mutation-audit.py` → **7개 mutant 각각13/13 통과**. 각 독립 계약 probe는 정상 HEAD exit0/해당 mutant exit1. 상세 [UNIT-MAPPING.md](UNIT-MAPPING.md), `mutation-audit.json` | 아래 F5-R 목록을 커밋된 unit의 독립 기대값으로 고정. 현재 정상 계산을 바꾸지 말고 빠진 회귀를 추가 |
| **1차 통과 골든 회귀** | **[통과]** | `node --experimental-strip-types …/goldens.mjs` → **14 passed/0 failed**: 타일400/361 및420 생성0, D8, E6-2 전처리·coverage10입력/레이아웃/저장 Tj, E5/혼합크기, D7실제16, A12행·150성공·독립상한, B/메모리4행, N1/N2, 날짜23×100회, plan64조합 | 없음. `/tmp` 검수 통과가 F5의 커밋된 회귀 누락을 대신하지 않음 |
| **공통 검증** | **[통과]** | `python3 …/run-checks.py`, `python3 …/run-browser.py` → tsc·unit272/272·head/main build·static·PDF production smoke·native oracle·bundle·css·registry 모두 exit0. 아래 상세 표 | 없음 |
| **production/main 동등** | **[통과]** | `python3 …/compare-builds.py` → HEAD537/main537, **different=[]**, 파일별 SHA동일 | 없음 |
| **fix 범위** | **[통과]** | `git diff --stat fd37cea..HEAD` → **8파일,323추가/93삭제**. finish3파일·helper·package1줄·unit·기록2개와 정확히 일치. `scope.json`의 explicit8개 목록 및 packageOtherLineDiff0. `git diff --check`/`fd37cea..HEAD`/`main..HEAD` 모두 exit0 | 없음. 새 의존/제품 route/UI/ko/en/SEO/광고 경로 변경0, 제품 그래프의 finish 외부 소비0 |
| **기록** | **[결함] R-DOC/P3** | `python3 …/records-audit.py` → 미정의 정책 없음 주장 철회·F1~F5 사유·native flag·PDF 범위 문구 정정은 확인. 다만 review-notes:25의 원로그 경로 `/tmp/worklazy-u4-1/`에 있는 unit은 **271개**이고, fix1 경로에는 **REPORT.md/bundle.json뿐, .log0개**. F5 전체 보강 취지도 위 누락과 불일치 | 실제 커밋된 단언 범위와 로그 provenance를 맞춘다. 원구현271과 fix272 결과·경로를 구분하고 다음 수정의 명령/cwd/env/exit/원출력을 보존. 현재 재현 근거로 이 review2 로그를 명시해도 됨. CHANGELOG 한 줄·Codx 서명은 유지 |
| **저장소 불변** | **[통과]** | `python3 …/finalize.py` → sameRefs/sameStatus=true, **changedTracked=[](2543개)**, **changedAuxiliary=[](dist537+사용자3)** | 없음 |

## F5-R — 남은 수정 지시

현재 제품에서 아래 계약이 잘못 계산된다는 판정은 아니다. 정상 HEAD에 대한 독립 probe는 모두 통과한다. **이미 1차 UNIT-MAPPING과 fix 지시서에 포함된 회귀 단언이 여전히 없어**, 이후 오류가 들어와도 커밋된 unit이 잡지 못한다는 판정이다.

| 현행 unit 위치 | 남은 단언·재현 증거 | 수정 지시 문안 |
|---|---|---|
| `tests/unit/pdf-finish-modules.test.ts:372,415–427` | `appliedDpi` 기대는200/200/null뿐. `reject-150-success`: A를 만족하는150을 일부러 거부해도13/13; 독립 probe `null !== 150` | `viewportAtDpi: dpi => ({width:1600*dpi/72,height:1000*dpi/72})`에서 요청300 → attempts `[300,200,150]`, applied150, supported=true, use-lower-dpi를 리터럴 단언 |
| 같은 파일372 이후 | `maxAreaExceeded` 독립 단언 없음. `ignore-max-area`: 면적검사 항상false로 해도13/13 | 100×100·maxSide4096·maxArea9999에서 pixels10000, side=false, area=true, allowed=false. 4096² 허용 및4096.01 한 변 초과의 독립 경계도 단언 |
| 같은 파일145–177 | startPage4에서 disabled/toggle 불변 단언 없음. `ignore-disabled-start-page`13/13 | options `{startPage:4,excludeCover:true}`에서 2·3쪽 disabled, 선택 `[4,6,8]`, 3쪽 toggle은 동일 상태 객체 유지; 표지 제외 empty 경계도 고정 |
| 같은 파일287–328 | 6영역 y/줄간격 리터럴 없음. `zero-text-y`13/13; 독립 기대 `[768,753.6]`과 불일치. 높이10 입력은A1줄뿐 | 6영역 x/y와 여러 줄 간격을 독립 리터럴로 단언. 원 E6의 `80A/B/C`·50×10에서 runs=[]와 `['horizontal-overflow','vertical-overflow']`, 50×28.8에서두 run의 text/width/y를 고정. 결과 box/width로 기대 좌표를 재계산하는 것만으로 대체하지 않음 |
| 같은 파일330–370 | offsetX/Y 모두0만 사용. `ignore-nonzero-offset`13/13 | 20×20·타일10×10·gap0·offsetX5/offsetY5·rotation30 → `(5,5),(15,5),(5,15),(15,15)` 및 각rotation30을 리터럴 단언 |
| 같은 파일545–546 | corners.length4뿐. `zero-stamp-corners`13/13 | 네 corner의 좌표도 고정. 예: stamp(10,20,30,40), 주입변환(x+1,y+2) → `(11,22),(41,22),(11,62),(41,62)` |
| 같은 파일215–285 | Helvetica 전수검사→Noto 순서 trace 없음. `early-noto-coverage`13/13 | 후보 `['Русский','ASCII']`에서 호출 trace를 `['H:Русский','H:ASCII','N']`로 고정하여 순서와 Noto1회를 검증. 기존 noFallback0회 단언 유지 |

재현 명령은 `python3 /tmp/worklazy-u4-1-review2/mutation-audit.py`다. 각 mutant의 제품 변경 한 식·13개 unit 원출력·정상/변이 독립 probe를 `mutants/<name>/`에 보존했다. **7개 모두 unit exit0**, 동일 mutant의 독립 probe는 **exit1**. 새 F2를 되돌린 대조군은 unit exit1이어서 하네스가 테스트 실패를 숨기는 경우도 배제했다.

기대값 감사 grep은 `expectation-audit-grep.txt`. 새 E5·E6 10행·A12행·D7에는 리터럴 기대값이 있다. D7의 종전 동일 제품 함수 재계산 문제는 해소됐다. `const expected = factory()`(597줄)는 결정성 전용으로 남은 정상 검사이며 그 자체를 결함으로 세지 않는다. 날짜 추가 반례와 plan64의 unit 편입도 새 의무로 확대하지 않는다. 정본14그룹에 대한 별도 회귀 실행은 완료했다.

## 실제 검증 명령·원출력

`checks.json`, `probe-checks.json`, `browser.json`, `diff-check.json`, `type-negative.json`에 명령·cwd·환경·exit를 보존했다. `head`/`main`은 위 `/tmp` 커밋 사본이며, 소스 저장소에서 실행한 명령은 읽기 git 검사뿐이다.

| 명령 | 실제 결과 | 원출력 |
|---|---|---|
| `npx --no-install tsc -b --pretty false` | exit0, 진단0 | `tsc.log` |
| `npm run test:unit` | **272/272**, finish13/13, 실패·skip0 | `unit.log` |
| `NODE_OPTIONS=--max-old-space-size=4096 npm run build` (HEAD) | exit0, 2834modules·61정적페이지 | `build-head.log` |
| `npm run test:static` | exit0, localized/SEO/vendor/ads/robots/sitemap, startup104문서 | `static.log` |
| `PDF_FINISH_ORACLE_OUTPUT=/tmp/worklazy-u4-1-review2/oracle.json npm run test:pdf-finish-oracle` | native strip **87=56허용+31제외**, 허용변환56·제외시도0·deep residual0개56건·두 렌더러SHA56건일치·양쪽 음성대조검출 | `oracle.log`, `oracle.json` |
| `BUNDLE_ROUTES=pdf-editor BUNDLE_BASELINE=/tmp/s3-bundle-baseline.json BUNDLE_MEASURE_OUTPUT=/tmp/worklazy-u4-1-review2/bundle.json npm run bundle:measure` | 직렬4096MiB build, **5종 gross/net Δ0B**, override{}·multiplier1 | `bundle.log`, `bundle.json` |
| `npm run css:orphans` | exit0, orphan selector arms0 | `css-orphans.log` |
| `node tests/tool-registry-routes.mjs` | exit0, count20·missing/unexpected/duplicates=[] | `registry.log` |
| 동일4096MiB `npm run build` (main) | exit0, 직렬단독실행 | `build-main.log` |
| `python3 /tmp/worklazy-u4-1-review2/compare-builds.py` | **537/537파일 SHA-256동일** | `production-sha.log`, `production-sha.json`, `production-sha-all.json` |
| `TEST_SCOPE=pdf TEST_BASE_URL=http://127.0.0.1:5189 npm run test:browser` | production preview에서 exit0, 10.35초 | `browser-production.log`, `browser.json` |
| `git diff --check`; `git diff --check fd37cea..HEAD`; `git diff --check main..HEAD` | 모두exit0, 출력없음 | `diff-check.json` |
| `python3 /tmp/worklazy-u4-1-review2/run-probes.py` (4개 하네스 각각 native flag 실행) | 각각exit0, F1~F4해소·13unit소스매핑·골든14/14 | `probe-checks.json`, 각 `*-repro.log` |

unit의 `app-shell.test.ts`는 git 추적 파일 목록을 읽으므로, 사본에 설치/새 저장소를 만들지 않고 다음 환경을 사용했다. 원 `.git`은 읽고 별도 index를 사용한다.

```bash
GIT_DIR=/home/better0101/projects/worklazytools/.git \
GIT_WORK_TREE=/tmp/worklazy-u4-1-review2/head \
GIT_INDEX_FILE=/tmp/worklazy-u4-1-review2/head.index GIT_OPTIONAL_LOCKS=0 \
NODE_OPTIONS=--max-old-space-size=4096 TMPDIR=/tmp/worklazy-u4-1-review2/tmp \
npm --prefix /tmp/worklazy-u4-1-review2/head run test:unit
```

번들 절대값은 entry299,287B·PDFroute171,864B·shared2,716,473B·app5,466,587B·CSS37,687B다. baseline SHA-256은 `2605437e04a5d77ed41c2dbfac4fae864a6a9c8b5e56941e696a80b7f76ac692`. production entry `assets/index-EfPTmre2.js` SHA는 `6105ffd880fb0757f94c22b01578a971246a9d37cc22c5ab7588ba32565fc6f3`, PDFroute `assets/PdfEditorPage-BoRVyNXa.js`는 `a6cb00912bbc54fbd408942b7f7684fa7de44098c438aaa3fe370994173363e3`이며 main과 같다.

PDF 스모크의 고정 성공 메시지에 Excel/Word가 들어 있어도 **해당 제품군 실행 증거로 사용하지 않았다**. 이번 명령은 TEST_SCOPE=pdf였다. preview는 종료됐고 `preview-stopped.json`에 정상 정리 후 종료143을 기록했다. 테스트exit은0이다. Vite의 vm-browserify eval 및 번들 크기 경고, Node strip 실험 경고는 원로그에 그대로 남겼다.

1차 하네스 수정 내역은 [harness-adaptations.md](harness-adaptations.md)에 있다. 기존14그룹의 수치·좌표 기대값은 바꾸지 않았으며 B 결과에 새로 추가된 공개 키2개만 키목록 단언에 반영했다. 예전 immutable 검수 사본에서 옛 결함이 재현됐다는 sol 설명은 타당하다. 이번 검수는 현재 HEAD 사본을 명시적으로 import한다.

## 기록·저장소 불변

`records-audit.json`의 `.log0`은 **fix1 과거 실행을 안 했다는 뜻이 아니다**. 제공된 보고에는 실행 요약이 있으나 지정 경로에서 원로그를 확인할 수 없었다는 한계다. 이번 재검수로 현재 HEAD의 공통 검증 실행은 독립 재현했다. review-notes에는 실제 원출력 경로와 각 단계의 case 수를 구분해 남겨야 한다.

`start-state.json`/`end-state.json`, `start-status.txt`/`end-status.txt`, `start-sha256.json`/`end-sha256.json` 및 `invariance.json`:

| 비교 | 결과 |
|---|---|
| 브랜치·HEAD·main | 모두 시작과 동일 |
| git status --porcelain | 문자열 동일, 기존 사용자 미추적3개뿐 |
| 추적파일 SHA-256 | **2543/2543동일** |
| 원저장소 기존 dist SHA-256 | **537/537동일** |
| 사용자 미추적파일 SHA-256 | **3/3동일** |

```text
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html
```

소스·기록·계획서를 수정하지 않았고 커밋·push·브랜치 전환·저장소 내 설치를 수행하지 않았다. 이번 판정과 수정 지시는 이 `/tmp` 보고서로 전달한다.

**[수정 후 재검수] — F1~F4 해소. F5-R 회귀 단언 누락과 R-DOC 기록 정합을 수정한 뒤 재검수. — Codx**
