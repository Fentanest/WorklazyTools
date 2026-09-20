# U4-1(F0a finish 순수 모듈) 구현 검수 — Codx

**판정: [수정 후 재검수].** 정본과 다른 정책 동작 3건(F1~F3), 전용 TS loader 정리(F4), 골든 회귀 단언 보강(F5)이 필요하다. 저장소 코드를 수정하지 않았다.

- 대상: `s3-pdf-finish`, `fd37ceab057ced2941fb752b2511124dbeaafda4` (`fd37cea`). main: `5bc6854175331bdd73b267784d9633cdccda8446`.
- 기준: `PROJECT_RULES.md` 첫 행동 전문 선독 → `AGENTS.md` → `docs/jobs/todo/pdf-finish-20260905.md` 정본화 우선순위/관련 확정 절·v5~v9·H2 → sol dispatch·보고·원로그 → r3/r4/r6/r7 probe·보고·기각 이력.
- 원 지시: `/tmp/claude-1000/-home-better0101-projects-worklazytools/f5cf1bca-6bf0-442b-b9d4-e7cb45f9c96d/scratchpad/u4-1-review-dispatch.md`.
- 실행 게이트: HEAD/main 일치. `open-plans-scan.txt`에서 PDF finish/로드맵/P2/QR 폰트 관련 열린 지시를 대조했다. 본 검수의 finish 순수 모듈 표면에 상반된 현행 지시 없음. 정본화 이전 본문의 낡은 기준 해시는 정본화 절과 이번 dispatch의 기준으로 대체.
- 검증 위치: 아래 `head/`와 `main/`은 각각 지정 커밋의 `git archive`를 `/tmp`에 푼 사본. 의존성과 vendor는 기존 파일을 복사했으며 설치하지 않았다. 빌드 쓰기는 사본에만 발생. `copy-integrity.json`은 HEAD 사본 추적 파일 2,543개의 시작 원본 대비 변경/누락 0을 증명한다.
- production/bundle/main 빌드는 모두 **직렬**, `NODE_OPTIONS=--max-old-space-size=4096`. 초기 실패도 보존했다. 산출물 루트는 이 보고서가 있는 `/tmp/worklazy-u4-1-review/`.

## 수정이 필요한 사항

| ID · 심각도 | 위치·정본 근거 | 재현 명령·실제 출력 | 수정 지시 문안 |
|---|---|---|---|
| **F1 · P2** | `src/features/pdf-editor/finish/tiles.ts:16,24,44` — N3(v7) 페이지당 **고정 상한400** | `node --experimental-strip-types /tmp/worklazy-u4-1-review/defects.mjs` → 201×200/10×10/gap0/**maximumTiles=1000** 입력에 `ok:true,count:420,placements:420,allocated:420`. 기본값만400이고 공개 인자로 상한이 해제됨 | 제품 API의 `maximumTiles` override를 제거하고 400을 불변 상한으로 고정한다. 400/420/361 기존 골든과 생성 횟수 계측을 유지하고, 400 초과 허용 인자/경로가 없음을 회귀 단언한다. 정본에 없는 상한 완화 옵션은 추가하지 않는다. |
| **F2 · P2** | `src/features/pdf-editor/finish/text.ts:179,186–187` — N3(v7): **영역 폭 < … 폭이면 필드 오류**, r6 `policies.mjs:17`도 입력 줄 길이와 무관하게 선검사 | 같은 `defects.mjs` → Helvetica12pt, `…=12pt`, 영역5pt, `i=2.664pt`가 `ok:true,warnings:[]`; 빈 줄도 성공. 줄 폭 초과 조건 안에서만 narrow 검사하므로 짧은 줄일 때 정책 누락 | 유효한 ellipsis 폭 산출 직후 영역 폭을 비교해 `narrow-region`을 반환한다. 긴 줄/짧은 i/빈 줄 모두 폭5에서 오류, 폭12의 …만 출력, 폭50×28.8·높이10 골든을 함께 단언한다. |
| **F3 · P2** | `src/features/pdf-editor/finish/canvasPolicy.ts:99–113` — v6 D3의 **동시 생존 canvas/bitmap 장수·합계 raw ledger**, r4 REPORT B raw RGBA 표 | 같은 `defects.mjs` → 동시에 살아 있는100px·200px 자원 각1개를 rawLedger 두 entry로 전달: 필요한 합계 `(100+200)×4=1200B`, `peakRawRgbaBytes=800B`. 현재 식은 entry별 값의 max이며 동시 생존 합계/장수가 없음 | rawLedger의 entry와 시점 의미를 타입·문서로 명시하고, 한 시점의 살아 있는 자원은 bytes·장수를 합산한다. 여러 시점의 peak는 **시점별 합계의 max**로 산출한다. 서로 크기가 다른 동시 자원2개, 단일 자원 복사2개, 해제 후 다음 시점의 골든을 넣는다. 문서 누적량을 peak나 차단 게이트로 사용하지 않는다. |
| **F4 · P2** | `tests/helpers/pdf-finish-ocg-preflight.mjs:1–29`, `package.json:34,43` — 검수 dispatch 12의 기존 TS 실행 경로 재사용·더 단순한 경로 판정 | `node /tmp/worklazy-u4-1-review/loader-check.mjs` → 현재 plain/native87분류·함수SHA 동일. 그러나 **제품 target가 새 dependency.ts를 import**하는 최소 fixture: 전용 loader는 `ERR_UNKNOWN_FILE_EXTENSION` exit1, native strip는7 출력 exit0 | package.json의 `test:pdf-finish-oracle`에 기존 관행대로 `node --experimental-strip-types`를 적용하고 helper는 제품의 **정적 re-export 한 줄**로 바꾼다. package script 한 줄은 이번 수정 지시에서 명시적으로 범위에 포함한다. plain Node를 계속 지원한다는 새 요구를 만들지 않는다. native flag로 oracle56/31·unit 재실행, import/함수 동치 증거를 남긴다. |
| **F5 · P2** | `tests/unit/pdf-finish-modules.test.ts:56,151,237,251,302` 및 `docs/review-notes.md:11–21` — sol 지시 “정본 표의 값을 그대로 단언” | `node /tmp/worklazy-u4-1-review/source-audit.mjs` → 신규12개; D7 dpr는 loop와 메시지에만 등장·실제 PDF.js import 없음; `가\r나`, `{date:foo}`, `\n\n` literal 없음. 상세 **[UNIT-MAPPING.md](UNIT-MAPPING.md)** | E5 중앙 앵커/여백/혼합크기, E6-2 전처리·coverage10입력 전체, 실제 fixture viewport로 D7 독립16조합, A rotation/UserUnit/RGBA/150성공, B raw ledger, tile 생성횟수와 F1~F3 반례를 회귀 단언한다. 정본/기록에 쓴 “골든”을 테스트의 동일 함수 재계산으로 대체하지 않는다. |

F3은 브라우저 실측 peak를 주장하는 항목이 아니다. **정본이 요구한 동시 생존 자원 목록을 계산하는 순수 계약**의 누락이다. rawLedger를 “이미 합산한 시점별 snapshot”으로 해석하면 현재 max가 맞을 수 있으나, 그 경우 현재 타입의 `pixels/simultaneousCopies`가 뜻하는 것과 동시 자원 합산·장수 산출 책임이 명시되어 있지 않다. 구현자가 다음 단계에서 재해석하지 않도록 이번 순수 모듈에서 계약과 산식을 완결해야 한다.

## 검수 dispatch 14항 판정

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 |
|---|---|---|---|
| 1 범위·순수성 | **[통과]** | `git diff --stat main..HEAD -- src/` → finish 아래10개 파일/1,552줄뿐. `scope.json`, `purity-scan.txt`, `consumers-scan.txt`: React/Worker/draw*/fetch/DOM 호출0, finish 밖 제품 소비0 | 없음. preflight의 pdf-lib 파서 import는 명시된 이관 범위. route/registry/locale/SEO/광고 화면 코드 변경0 |
| 2 geometry | **[통과]** 계산, 회귀는F5 | `node --experimental-strip-types …/goldens.mjs`: 실제 PDF.js/E5 네 회전×6 anchors24좌표·여백·upright 벡터 일치. `…/mixed.mjs`: 혼합visual크기4쪽/24anchors PASS | F5 |
| 3 selection | **[통과]** | goldens `N1-D2-state-boundaries`: exact set `{2,3,4,6,8}`, parity all, text `2-4,6,8`, anchor4, 4→5/6→7, physical pages10, disabled 하한/토글 불변·empty PASS | F5의 하한 회귀 보강 |
| 4 tokens | **[통과]** | goldens date23형식×100회, clock1회, filename에 `{date:HH}` 삽입해도 재해석0. `{{page}}`→`{5}`, `{da{page}te}`→`{da5te}`는 안쪽 유효 토큰만 원문에서 한 번 치환; 결과 재파싱 없음. unknown은 literal+warning | 없음. 날짜 **5+4+14 전수는 이미 unit에 있음** |
| 5 text | **[결함]** F2; 나머지 골든 통과 | goldens E6-2 전처리10입력, D8 Résumé/Русский/ή, 80A+🙂의 scalar81 차단, coverage순서, ellipsis/2줄/0줄·양축여백오류. 실제 저장 PDF에서 `<412020202042> Tj`, `<43> Tj`, `<44> Tj`; measured `A    B=29.352pt` 일치. 짧은 입력의 narrow 오류누락은 defects.log | F2/F5 |
| 6 tiles | **[결함]** F1; 기본 골든 통과 | 기본400은400회 생성, 예상420 거부 때0회 생성, gap1=361. gap<0·폭0 오류. 비영점offset/회전 PASS. override시420 실제 생성 | F1/F5 |
| 7 canvasPolicy | **[결함]** F3; A/경고/200MiB는통과 | 실제 viewport UserUnit2×4회전×3DPI12행·ceil/area/RGBA, maxSide/maxArea 독립분기,300→200/150성공·150실패 PASS. A4 8쪽 누적17,413,712는 A거부 없음. B 유효 대용량 입력은 metrics만, 정책차단 flag 없음; invalid input의 RangeError는 B예산거부와 구분. 경고계수1회·메모리4행 PASS | F3/F5 |
| 8 stamp | **[통과]** 계산, 회귀는F5 | 실제 legacy PDF.js CSS viewport(scale.5)+bitmap viewport(.5×DPR) 16/16. 각 회전의 고정PDF좌표 `[170,460]`, `[210,280]`, `[330,340]`, `[290,520]`. N2의600×400→120×90,100×10→13.333…×10·center(90,5) PASS | F5 |
| 9 plan | **[통과]** | goldens `plan-64-combinations-pure`: frozen input64조합, 7단계순서/enable/1-based order/결정성/JSON직렬화 PASS. 실행 함수 호출 없음 | 없음 |
| 10 preflight 이관·동치 | **[통과]** | 실제 `npm run test:pdf-finish-oracle`:87=56/31, 허용변환56·제외시도0·deep residual0 56·양 renderer SHA56·음성대조양쪽검출. helper/product 함수identity·plain/native bodySHA동일. 사용자 locale/UI 소비0 | 실행경로정리는F4 |
| 11 공통검증·production SHA | **[통과]** (환경 보완 후) | unit271/271·production PDF 스모크·oracle56/31·빌드·정적·5종 delta0B·production537 SHA동일. 명령·초기 실패 아래 보존 | 정책 수정 뒤 재실행 |
| 12 strip-only loader | **[결함]** F4; 동일코드/문법우려 일부는기각 | loader-check: native `stripTypeScriptTypes` 사용이며 손수 정규식으로 타입을 제거한 것이 아님. generics/satisfies 양쪽통과, enum 양쪽 동일 `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`. 새 상대 TS dependency만 전용loader가 놓침 | F4. enum을 지원하도록 제품문법을 확대하는 수리는 불필요 |
| 13 unit 밀도 | **[결함]** F5 | **[12개↔골든 매핑표](UNIT-MAPPING.md)**. 날짜23·메모리4·N1/N2는충족. E5중앙/실fixture·E6전수·D7독립성·Bledger·타일생성계측누락 | F5 |
| 14 기록·범위밖발견 | **[결함]** 기록보정 | CHANGELOG1줄·Codx서명·모듈목록/실측값은정합. “그 밖의 정본 미정의 정책 없음”은 F1 공개상한완화와 맞지 않음. helper plain import smoke와 oracle 실행flag는 review-notes에 솔직히 기록. 원 oracle.log는 native flag로실행되어 새 fallback 전체분류를 검증하지 않았음; 이번 검수의 npm oracle가이를보완 | F1~F5 수정사유·실제회귀범위를 review-notes에 남기고 CHANGELOG는간결히. `TEST_SCOPE=pdf`의 고정성공메시지 “Excel, Word…”를 실제Excel/Word실행증거로쓰지않음 |

## 로더 판단의 근거

sol의 최초 `ERR_UNKNOWN_FILE_EXTENSION` 보고는 원로그와 일치한다. package.json에 이미 `test:unit`, `test:qr-font-render`, static generator의 native strip 실행 경로가 있다. 범위를 지키려 했던 이유는 이해되지만, scope 밖으로 인지했다면 의존 `.ts` 한 파일만 처리하는 새 전역 loader를 도입하는 것보다 기존 script 한 줄의 변경 필요를 보고하는 편이 계약에 맞는다.

두 사본 금지는 **현재 실질적으로 준수**한다. helper는 제품 파일 URL 그대로 읽고 Node 공식 strip API에 넘긴다. plain/native 87분류가 동일하고 두 환경의 classifier 함수 body SHA-256은 `c6fc653b4ffca0f01d102ffcd32fa845e67c10eb0254eaf9763a0967ea6ccd59`. 제품의 동일 export와 helper export identity도 true. 손수 만든 parser가 로직을 훼손했다는 주장은 기각한다. 재현된 회귀 신호는 `loader-transitive-plain.log`의 새 `.ts` 의존 파일 미처리다.

## 재현 명령과 검증 결과

`run-checks.py`, `checks.json`, `checks-progress.log`에 커맨드·cwd·환경·exit·시간을 저장했다. 아래 모든 명령은 `/tmp` 사본에서 실행했으며 최초 실패로그를 덮어쓰지 않았다.

| 명령 (cwd는 head 사본, main 빌드만 main 사본) | 최종 결과 | 로그·산출물 |
|---|---|---|
| `npx --no-install tsc -b --pretty false` | exit0, 진단0 | `tsc.log` |
| `npm run test:unit` | **271/271**, 신규12/12; Git 사본 환경 보완 후 exit0 | `unit-repro.log` (초기 `unit.log` 보존) |
| `NODE_OPTIONS=--max-old-space-size=4096 npm run build` | exit0, 2,834 modules·정적61페이지 | `build-head.log` |
| `npm run test:static` | exit0, 정적 출력·startup104문서 | `static.log` |
| `TEST_SCOPE=pdf TEST_BASE_URL=http://127.0.0.1:5187 npm run test:browser` | **production preview에서 exit0** | `browser-production.log`; 첫 dev DOCX 결과대기180초 실패 `browser.log` 보존 |
| `BUNDLE_ROUTES=pdf-editor BUNDLE_BASELINE=/tmp/s3-bundle-baseline.json BUNDLE_MEASURE_OUTPUT=/tmp/worklazy-u4-1-review/bundle.json npm run bundle:measure` | exit0, **5종 delta 전부0B**, override없음 | `bundle.log`, `bundle.json` |
| `npm run css:orphans` | exit0, orphan0 | `css-orphans.log` |
| `node tests/tool-registry-routes.mjs` | exit0,20도구·누락/예상외/중복0 | `registry.log` |
| `git diff --check` 및 `git diff --check main..HEAD` (원 저장소) | exit0 각각 | `supplemental-checks.json`, `diff-check.log` |
| `PDF_FINISH_ORACLE_OUTPUT=/tmp/worklazy-u4-1-review/oracle.json npm run test:pdf-finish-oracle` | exit0,87=56허용+31제외·양 renderer SHA56 | `oracle.log`, `oracle.json` |
| main 사본의 동일 `npm run build` | 최초137 Killed → dev/browser 종료 후 **단독 재실행 exit0** | `build-main.log`, `build-main-retry.log` |
| `python3 /tmp/worklazy-u4-1-review/compare-builds.py` | **537/537 production 파일 SHA-256 동일**; entry/PDF route 포함 | `production-sha.log`, `production-sha.json`, `production-sha-all.json` |
| `node --experimental-strip-types /tmp/worklazy-u4-1-review/goldens.mjs` | 수정된 검수 fixture로 **14그룹 전부 PASS**, 실제 정본 수치 재계산 | `goldens.log`, `goldens.json`; 초기 harness 실패는 `goldens-initial.*` |

번들 절대값: entry **299,287B**, PDF route **171,864B**, shared **2,716,473B**, app **5,466,587B**, CSS **37,687B**. gross/net delta 모두0B. module inventory에 finish 모듈0개: 제품 import 그래프 미연결이 실제 산출물에서도 확인된다. baseline JSON SHA-256은 `2605437e04a5d77ed41c2dbfac4fae864a6a9c8b5e56941e696a80b7f76ac692`.

production 실제 entry `assets/index-EfPTmre2.js`: `6105ffd880fb0757f94c22b01578a971246a9d37cc22c5ab7588ba32565fc6f3`; PDF route `assets/PdfEditorPage-BoRVyNXa.js`: `a6cb00912bbc54fbd408942b7f7684fa7de44098c438aaa3fe370994173363e3`. 두 커밋의 빌드가 모두 위 SHA와 같다.

최초 main 빌드는 `Killed`/137이며 당시 메모리 압박과 browser/dev 작업 동시 진행이 있었다. OS kill의 정확한 원인은 확인하지 않았으므로 코드 실패로 분류하지 않는다. 최초 browser dev timeout은 DOCX 변환 결과 대기에서 발생했고 dependency reoptimization/reload 로그가 있었지만 인과관계는 단정하지 않는다. **동일 소스의 production preview에서 전체 PDF 스모크 통과**로 최종 검증을 완료했다. 검수용 서버와 브라우저는 종료했다.


초기 unit 실패(`unit.log`, 270/271)는 사본에 `.git`이 없어 `app-shell.test.ts`의 `git ls-files`가 실패한 검수 환경 문제다. 원본 `.git`을 읽기 대상으로 지정하고 별도 복사 index를 사용해 `unit-repro.log`에서 **271/271(신규12/12)**을 재현했다. 명령:

```bash
GIT_DIR=/home/better0101/projects/worklazytools/.git \
GIT_WORK_TREE=/tmp/worklazy-u4-1-review/head \
GIT_INDEX_FILE=/tmp/worklazy-u4-1-review/head.index GIT_OPTIONAL_LOCKS=0 \
NODE_OPTIONS=--max-old-space-size=4096 TMPDIR=/tmp/worklazy-u4-1-review/tmp \
npm --prefix /tmp/worklazy-u4-1-review/head run test:unit
```

독립 골든 하네스의 초기 혼합페이지 기대 실패도 `goldens-initial.*`로 보존했다. legacy fixture는 **MediaBox는 혼합이나 회전을 적용한 CropBox visual 크기는 동일**하여 검수의 “서로 다른 visual 크기” 전제가 틀렸다. `mixed.mjs`가 `/tmp`에 별도4쪽 fixture를 생성하여 올바른 혼합visual크기/여백/회전24anchors를 검증했다(`mixed.log`, `mixed.json`, `mixed.pdf`). 이를 제품 결함으로 세지 않았다. 나머지13개 골든 그룹은 초기부터 통과했다. 혼합페이지 하네스를 바로잡은 최종 `goldens.mjs`는 14/14 통과한다.

## 저장소 불변

`python3 /tmp/worklazy-u4-1-review/snapshot.py start` / `end` 실행 결과(`invariance.log`, `snapshot-start.json`, `snapshot-end.json`, `unchanged.json`):

| 비교 | 시작→종료 |
|---|---|
| HEAD | `fd37ceab057ced2941fb752b2511124dbeaafda4` 동일 |
| main | `5bc6854175331bdd73b267784d9633cdccda8446` 동일 |
| 브랜치 | `s3-pdf-finish` 동일 |
| git status --porcelain | 아래 미추적 사용자3개만, 문자열 동일 |
| 추적 파일 SHA-256 | **2,543/2,543 동일** |
| 기존 저장소 dist SHA-256 | **537/537 동일** |
| 사용자 미추적 파일 SHA-256 | **3/3 동일** |

```text
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html
```


구현 수정·커밋·push·브랜치 전환·저장소 내 설치를 수행하지 않았다. 기존 정본/CHANGELOG/review-notes에도 검수 내용을 쓰지 않았으며, 이 `/tmp` 보고서가 Claude 판정 입력이다.

**최종 판정: [수정 후 재검수].** F1~F5를 수리하고 정본 골든과 공통검증을 다시 실행한 커밋을 검수 대상으로 제출한다. — Codx
