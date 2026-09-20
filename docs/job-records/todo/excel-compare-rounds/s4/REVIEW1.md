**Excel 중복키·머리글 S4 최종 통합 검수 — [수정 후 재검수]**

Codx · 2026-09-08 · Worklazy Tools 자체 제품 품질 검증.
대상 `/tmp/worklazy-xd` · `excel-dupkey-20260907` · `3131258cb36d8f052b393abe4c6ec7b60547431d`.

**이월된 명령은 모두 실행됐지만, 실행 범위와 결과를 정직하게 보고했다는 게이트는 통과하지 못한다.** 명령 내부의 건너뜀, 정본 5군 전수 주장의 증거 공백, 새 접근성 노드의 잘못된 잔여 귀속, 백로그 우선순위 누락을 확인했다. 이번 검수에서 확인한 제품 동작은 아래 별도 실측에 기록한다. 기존 BL01~BL05 자체를 차단 결함으로 다시 올리지 않는다.

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| **S4-R01 · P2 · 스모크 내부 건너뜀 미보고** | **수정 필요 — S4 보고 결함** | `rg -an 'streaming smoke skipped' /tmp/worklazy-xd-s4/evidence/new-tools.log` → **80행**. `.meta`는 2026-09-08 01:48:27~01:50:23 UTC, 116.862초, exit0. 본 검수의 무수정 재실행도 같은 분기. `tests/new-tools-smoke.mjs:4025`에서 호환 경로가 없는 Chrome은 메시지를 출력하고 return한다. | REPORT의 전 회귀 표·요약과 `docs/review-notes.md` S4 항목에 **Dolby Vision base-layer streaming 미실행**, 호스트 호환 경로 부재, 실행된 fallback 안내·capability unit과 실행하지 않은 실제 streaming/target-encode 검증의 경계를 명시하라. exit0을 전 세부경로 실행으로 표현하지 말라. 기존 기능·환경 제약이므로 이 영상 기능을 S4에서 수리하라는 요청은 아니다. |
| **S4-R02 · P2 · 정본 5군 ‘전수’의 증거 공백** | **수정 필요 — S4 실행/보고 결함** | `header-browser.json` 실제 **profiles=0·races=0·user=2**. `user-row4.meta`는 `HEADER_PHASE=user`이다. probe의 36행 조건이 55~62행 완료 역전·stale finally·늦은 응답·unmount 경로를 건너뛴다. 공식 unit은 controller `finish(old)=false`, `cancelAll`, pre-abort를 실행했고 공식 스모크는 교체·쌍 제거를 실행했지만, 이것이 지연 완료 순서와 실제 unmount 브라우저 검증은 아니다. 또한 두 중복 관련 unit의 실제 엔진 호출 계측에서 실행된 duplicate 형상은 2:0·0:2·2:1·1:2·2:2·30000:0이며 **2:3 없음**. | 정본 5군 각각을 실제 명령·세부 assertion/출력에 연결하라. 2:3 및 브라우저 완료 역전·unmount의 S4 실행 근거를 보충하고 REPORT/기록을 정정하라. S3의 과거 독립 검수 결과, controller 단위시험, 이번 브라우저 실행을 서로 구분하라. 검수자의 추가 증거를 채택한다면 **검수자 실행**이라고 명시하고 sol이 이미 실행했던 것으로 소급하지 말라. |
| **S4-R03 · P2 · 새 접근성 노드 잔여 귀속 오류** | **수정 필요 — S4 분리 보고 결함** | 자동 위반0·incomplete1274는 사실이다. 그러나 모바일 `.max-w-56` **4노드**(ko/en×light/dark)와 dark 모바일 오른쪽 toggle `button[aria-controls="_r_25_"] > span` **2노드**는 이번 S1~S3가 만든 결과 노드이며 기존 6종 selector 측정에 없다. 원래 측정의 toggle은 `data-side=left`만 조회하며 원본행 항목도 첫 항목을 대표로 측정한다. [DOM 귀속·원래 측정과 교집합](evidence/a11y-attribution.json), [요약](evidence/a11y-summary.json). | 나머지를 일괄 공용 UI 상속으로 분류한 REPORT/기록을 고쳐라. 안정 selector·프로필·귀속·측정/보류 상태를 연결하고 이번 두 종류를 새 결과 노드로 분리하라. 검수자의 보충 대비 측정은 8프로필×2대상 모두 기준 충족(최저 **12.799508:1**). 그 증거를 명시해 해결 판정할 수 있으며 공용 UI 수리는 필요 없다. 보류를 자동 통과로 세지 않는 원칙은 유지하라. |
| **S4-R04 · P2 · 백로그 우선순위 네 건 누락** | **수정 필요 — S4 기록 결함** | `docs/backlog.md:7~11`의 BL01~05에서 명시적 우선순위는 **BL04만** 있다. [항목별 원문·검사](evidence/backlog-audit.json): BL01=false, BL02=false, BL03=false, BL04=true, BL05=false. 재현 경로와 관측은 다섯 항목에 있으며 S4 코드 수리0. | BL01·BL02·BL03·BL05에 합의한 우선순위를 각각 명시하라. BL04의 높은 우선순위/spreadsheet-core 귀속·실제 오류 타입 보존 방침은 유지하라. 이 작업에서 백로그 기능을 수리하지 말라. |

R01~R04는 **기존 제품 결함 면제 정책으로 숨길 수 없는 이번 통합 기록/검증의 누락**이다. BL04의 어댑터 결함, BL01~03/05와 공용 접근성 부채는 기존 귀속 그대로 비차단이다. 소스 기능을 새로 수리하라는 지시는 없다.

**시각 기준선 다섯 장 — 갱신 타당**

이전 기준선은 `git show 657dec8:<파일>`로 추출했고, actual과 diff는 sol의 최초 실행 원본을 열었다. **5×3=15이미지를 모두 직접 열었다.** 교정 PNG 다섯 장은 최초 actual과 SHA가 같다. pixelmatch의 기존 `threshold=0.1`, `includeAA=false`로 재계산했다.

| 파일(모두 desktop) | 유의미한 차이 픽셀 / 비율 | 차이 bounding box (x1,y1,x2,y2) | 직접 확인 |
|---|---:|---|---|
| home ko light | 4,014 / 0.326740% | 592,654,793,836 | Excel 비교 카드의 설명·태그만 변화 |
| home ko dark | 3,908 / 0.318112% | 592,654,793,836 | 같은 범위, 카드·주변 정렬 유지 |
| home en light | 3,872 / 0.315181% | 592,674,791,890 | 같은 범위, 문구와 태그 정상 줄바꿈 |
| home en dark | 3,705 / 0.301587% | 592,674,791,890 | 같은 범위, 인접 카드/언어 제어 변화0 |
| hwp-editor redirect en dark | 3,705 / 0.301587% | 592,638,791,854 | 영어 전체 도구 목록의 동일 카드 변화 |

[재계산 수치](evidence/pixels.json), [기준선 출처](evidence/baseline-provenance.json), [직접 연 이미지 전체 목록](evidence/visual-manual.json). 새 정렬 붕괴·문구 잘림·컴포넌트 내부 이탈은 관찰하지 않았다. 영어 홈 카드 하단이 초기 viewport 아래로 이어지는 것은 스크롤 화면의 캡처 경계이며 새 내부 clipping이 아니다. 모바일 결과 표의 가로 스크롤과 기존 guide 잘림은 별도로 다룬다.

HWP 영어 화면은 편집기를 렌더하는 장면이 아니다. `tests/visual-regression.scenarios.mjs:611` 이후 시나리오는 `/tools/hwp-editor`로 들어가 **`/en/tools` 경로·`.tools-index-page`를 단언**한다. `src/app/App.tsx:127`의 `KoreanOnlyRoute`가 영어를 전체 도구 목록으로 보낸다. 따라서 홈과 같은 Excel 비교 카드 설명/태그 변경이 그 이미지에 반영되는 것이 맞다.

`tests/visual-regression.config.mjs`·`tests/visual-regression.mjs`는 S0 `597a92f`부터 대상까지 blob 동일이다. **maxDiffPixelRatio=0.001(0.100%), per-pixel=0.1, AA 제외, footer 연도 한 영역만 허용**. S4 시나리오/프로필/마스크/허용치 변경0, baseline reset0, 변경 PNG 정확히5. S1~S3의 Excel 기준선16장과 S4의 공용5장을 혼동하지 않았다.

**원 실행 증거 대조**

sol의 `.meta`마다 명령·UTC 시작/종료·경과·exit와 같은 이름 `.log` 원출력을 대조했다. 전체 원문 파일의 SHA·크기·건너뜀 검색 결과는 [sol-execution-audit.json](evidence/sol-execution-audit.json)에 보존했다. NUL이 들어 있는 `new-tools.log`는 텍스트로 강제 읽어 검사했다. 단순 `rg`의 “binary file matches”로 끝내지 않았다.

| 원 검사·명령 | UTC 시작 → 종료 | 초 | exit | 원출력·메타 |
|---|---|---:|---:|---|
| state-start · `명령 전문은 meta 참조` | 2026-09-08T01:41:40Z → 2026-09-08T01:41:40Z | 0.174 | 0 | [log](</tmp/worklazy-xd-s4/evidence/state-start.log>) · [meta](</tmp/worklazy-xd-s4/evidence/state-start.meta>) |
| tsc · `./node_modules/.bin/tsc -b` | 2026-09-08T01:42:02Z → 2026-09-08T01:42:20Z | 18.605 | 0 | [log](</tmp/worklazy-xd-s4/evidence/tsc.log>) · [meta](</tmp/worklazy-xd-s4/evidence/tsc.meta>) |
| unit · `npm run test:unit` | 2026-09-08T01:42:20Z → 2026-09-08T01:42:25Z | 4.346 | 0 | [log](</tmp/worklazy-xd-s4/evidence/unit.log>) · [meta](</tmp/worklazy-xd-s4/evidence/unit.meta>) |
| build-production · `npm run build` | 2026-09-08T01:42:25Z → 2026-09-08T01:43:58Z | 93.483 | 0 | [log](</tmp/worklazy-xd-s4/evidence/build-production.log>) · [meta](</tmp/worklazy-xd-s4/evidence/build-production.meta>) |
| static · `npm run test:static` | 2026-09-08T01:43:58Z → 2026-09-08T01:43:59Z | 0.814 | 0 | [log](</tmp/worklazy-xd-s4/evidence/static.log>) · [meta](</tmp/worklazy-xd-s4/evidence/static.meta>) |
| browser · `env TEST_BASE_URL=http://127.0.0.1:4350 npm run test:browser` | 2026-09-08T01:44:36Z → 2026-09-08T01:45:30Z | 53.760 | 0 | [log](</tmp/worklazy-xd-s4/evidence/browser.log>) · [meta](</tmp/worklazy-xd-s4/evidence/browser.meta>) |
| excel-compare · `env TEST_BASE_URL=http://127.0.0.1:4350 npm run test:excel-compare` | 2026-09-08T01:45:30Z → 2026-09-08T01:46:40Z | 70.406 | 0 | [log](</tmp/worklazy-xd-s4/evidence/excel-compare.log>) · [meta](</tmp/worklazy-xd-s4/evidence/excel-compare.meta>) |
| excel-cleaner · `env TEST_BASE_URL=http://127.0.0.1:4350 npm run test:excel-cleaner` | 2026-09-08T01:46:40Z → 2026-09-08T01:47:35Z | 55.474 | 0 | [log](</tmp/worklazy-xd-s4/evidence/excel-cleaner.log>) · [meta](</tmp/worklazy-xd-s4/evidence/excel-cleaner.meta>) |
| qr-bulk · `env TEST_BASE_URL=http://127.0.0.1:4350 NODE_OPTIONS=--max-old-space-size=4096\ --import=/tmp/worklazy-excel-s0/probes/strict-test-port.mjs npm run test:qr-bulk` | 2026-09-08T01:47:35Z → 2026-09-08T01:48:27Z | 51.050 | 0 | [log](</tmp/worklazy-xd-s4/evidence/qr-bulk.log>) · [meta](</tmp/worklazy-xd-s4/evidence/qr-bulk.meta>) |
| new-tools · `env TEST_BASE_URL=http://127.0.0.1:4350 npm run test:new-tools` | 2026-09-08T01:48:27Z → 2026-09-08T01:50:23Z | 116.862 | 0 | [log](</tmp/worklazy-xd-s4/evidence/new-tools.log>) · [meta](</tmp/worklazy-xd-s4/evidence/new-tools.meta>) |
| utilities · `env TEST_BASE_URL=http://127.0.0.1:4350 npm run test:utilities` | 2026-09-08T01:50:23Z → 2026-09-08T01:52:04Z | 100.556 | 0 | [log](</tmp/worklazy-xd-s4/evidence/utilities.log>) · [meta](</tmp/worklazy-xd-s4/evidence/utilities.meta>) |
| office · `env TEST_BASE_URL=http://127.0.0.1:4350 npm run test:office` | 2026-09-08T01:52:04Z → 2026-09-08T01:52:30Z | 26.232 | 0 | [log](</tmp/worklazy-xd-s4/evidence/office.log>) · [meta](</tmp/worklazy-xd-s4/evidence/office.meta>) |
| recovery · `npm run test:recovery` | 2026-09-08T01:52:43Z → 2026-09-08T01:57:22Z | 279.436 | 0 | [log](</tmp/worklazy-xd-s4/evidence/recovery.log>) · [meta](</tmp/worklazy-xd-s4/evidence/recovery.meta>) |
| build-qa · `npm run build` | 2026-09-08T01:57:43Z → 2026-09-08T01:59:20Z | 96.927 | 0 | [log](</tmp/worklazy-xd-s4/evidence/build-qa.log>) · [meta](</tmp/worklazy-xd-s4/evidence/build-qa.meta>) |
| visual · `npm run test:visual` | 2026-09-08T01:59:32Z → 2026-09-08T02:06:54Z | 442.340 | 1 | [log](</tmp/worklazy-xd-s4/evidence/visual.log>) · [meta](</tmp/worklazy-xd-s4/evidence/visual.meta>) |
| baseline-update · `명령 전문은 meta 참조` | 2026-09-08T02:08:57Z → 2026-09-08T02:08:57Z | 0.086 | 0 | [log](</tmp/worklazy-xd-s4/evidence/baseline-update.log>) · [meta](</tmp/worklazy-xd-s4/evidence/baseline-update.meta>) |
| visual-rerun · `npm run test:visual` | 2026-09-08T02:09:09Z → 2026-09-08T02:16:06Z | 417.092 | 0 | [log](</tmp/worklazy-xd-s4/evidence/visual-rerun.log>) · [meta](</tmp/worklazy-xd-s4/evidence/visual-rerun.meta>) |
| a11y · `env A11Y_MAX_TOTAL=0 npm run test:a11y` | 2026-09-08T02:16:35Z → 2026-09-08T02:17:43Z | 67.902 | 0 | [log](</tmp/worklazy-xd-s4/evidence/a11y.log>) · [meta](</tmp/worklazy-xd-s4/evidence/a11y.meta>) |
| user-row1 · `node /tmp/worklazy-xd-s4/probes/user-one.mjs` | 2026-09-08T02:23:26Z → 2026-09-08T02:23:31Z | 5.504 | 0 | [log](</tmp/worklazy-xd-s4/evidence/user-row1.log>) · [meta](</tmp/worklazy-xd-s4/evidence/user-row1.meta>) |
| user-row4 · `env HEADER_PHASE=user node /tmp/worklazy-xd-s4/probes/header-browser.mjs` | 2026-09-08T02:23:31Z → 2026-09-08T02:23:48Z | 16.769 | 0 | [log](</tmp/worklazy-xd-s4/evidence/user-row4.log>) · [meta](</tmp/worklazy-xd-s4/evidence/user-row4.meta>) |
| header-a11y · `node /tmp/worklazy-xd-s4/probes/header-a11y.mjs` | 2026-09-08T02:23:48Z → 2026-09-08T02:24:09Z | 20.714 | 0 | [log](</tmp/worklazy-xd-s4/evidence/header-a11y.log>) · [meta](</tmp/worklazy-xd-s4/evidence/header-a11y.meta>) |
| bundle · `env BUNDLE_BASELINE=/tmp/worklazy-excel-s0/evidence/bundle-baseline.json BUNDLE_MEASURE_OUTPUT=/tmp/worklazy-xd-s4/evidence/bundle.json npm run bundle:measure` | 2026-09-08T02:24:57Z → 2026-09-08T02:26:14Z | 76.862 | 0 | [log](</tmp/worklazy-xd-s4/evidence/bundle.log>) · [meta](</tmp/worklazy-xd-s4/evidence/bundle.meta>) |
| user-report-xml · `python3 /tmp/worklazy-xd-s4/probes/check-xlsx-xml.py` | 2026-09-08T02:24:57Z → 2026-09-08T02:24:57Z | 0.092 | 0 | [log](</tmp/worklazy-xd-s4/evidence/user-report-xml.log>) · [meta](</tmp/worklazy-xd-s4/evidence/user-report-xml.meta>) |
| css · `npm run css:orphans` | 2026-09-08T02:26:14Z → 2026-09-08T02:26:15Z | 0.627 | 0 | [log](</tmp/worklazy-xd-s4/evidence/css.log>) · [meta](</tmp/worklazy-xd-s4/evidence/css.meta>) |
| diff-check · `git diff --check` | 2026-09-08T02:26:15Z → 2026-09-08T02:26:15Z | 0.021 | 0 | [log](</tmp/worklazy-xd-s4/evidence/diff-check.log>) · [meta](</tmp/worklazy-xd-s4/evidence/diff-check.meta>) |
| routes · `node tests/tool-registry-routes.mjs` | 2026-09-08T02:26:15Z → 2026-09-08T02:26:15Z | 0.529 | 0 | [log](</tmp/worklazy-xd-s4/evidence/routes.log>) · [meta](</tmp/worklazy-xd-s4/evidence/routes.meta>) |
| unit-final · `npm run test:unit` | 2026-09-08T02:36:07Z → 2026-09-08T02:36:10Z | 3.706 | 0 | [log](</tmp/worklazy-xd-s4/evidence/unit-final.log>) · [meta](</tmp/worklazy-xd-s4/evidence/unit-final.meta>) |

원 QA build의 `.meta` 명령은 `npm run build`이다. QA 설정과 4350 preview는 원 실행 환경/로그 및 QA 산출물의 광고·분석 제외를 함께 대조했다. QR은 4351 보조 서버를 strict-port preload로 제한한 명령이며 wrapper 적용을 일반 기본 실행으로 숨기지 않았다.

첫 시각 실패5는 보고돼 있고, 최종 두 visual 로그는 각각 고유183개 이름을 모두 기록한다. 두 실행의 목록은 동일하며 최종 `filter=all`, concurrency1, capture183/183이다. recovery는 **desktop74+android73=147**개의 PASS 행과 실제 artifact가 있다. unit은 **396 pass, fail0, cancelled0, skipped0, todo0**이다. [수량·완주 대조](evidence/original-completeness.json). **명령 호출 누락0**과 **세부경로 건너뜀/증거 공백0**은 서로 다른 판정이며 후자는 R01/R02 때문에 성립하지 않는다.

**정본 회귀 5군 대응**

| 군 | 확인된 실행·증거 | 판정 |
|---|---|---|
| ① 중복 조합·표시/정규화·순서 | duplicate-report unit의 2:0/0:2/2:1/1:2/1:1·표시 identity 분리·복합키·그룹 순서·30000행; 기본 compare unit의 3정책·정규화. 브라우저 복수 쌍·501그룹·0건 측. | 실행된 범위 통과. **2:3를 S4가 실행했다는 주장에는 증거가 없다**. 검수자가 정상 CSV 2:3를 추가 실행해1그룹·좌2/우3 전체 값 보존을 확인했다([shape-23.json](evidence/shape-23.json)). |
| ② 화면 | sol `excel-compare.log`의 `groupedDuplicateUi`: 초기500/총501, 접힌 DOM0, 마지막값/행번호 검색, 좌50→추가50, 우 독립 전개, 0건 버튼0, dialog·Escape·초점반환. 포인터/키보드 되돌림 경로 포함. | 공식 스모크와 이번 재실행 통과. 기존 BL01~03/05를 해소한 것으로 세지 않음. |
| ③ 보고서 | unit의 16000/16001, 32767/32768, multiline Key, surrogate/CRLF 안전 분할, 행번호 목록·조각 메타·Summary/Parameters·주입 문자열; 브라우저 direct2+ZIP2 재개방·동일 내용·13열/9시트·유한폭/가시성. | 실행 증거 확인. 실제 사용자 XLSX도 별도 XML/rels 재개방. |
| ④ 감지 | 원형23 및 **6형식×23=138** 고정 기대표, 원시 formula/error 순수조건, 형식 parser fixture, 초기동봉·수동캐시·swap·교체·쌍 제거·controller stale/cancelAll/pre-abort. | 고정 출력 일치를 의미 정확도로 부르지 않음. BL04는 기존 error type 소실. sol의 실제 늦은 완료/unmount 재실행 주장은 **R02**. 검수자의 full probe는 **2개 언어 프로필·10개 race 상태·사용자2프로필**을 추가 실행해 exit0(29.411초), `released-old5`에서도 선택6 유지, 캐시1이 늦은7보다 우선, pair 삭제·unmount 뒤 응답 무효를 확인했다. |
| ⑤ 결과 시각·접근성 | ko/en×desktop/mobile×light/dark 중복 결과8프로필을 두 하네스에 등록. 캡처8장을 직접 열어 실제 그룹·펼친 원본행·전체값 동작이 있음을 확인. | 전체visual183 재현 통과. axe 자동 위반0이나 공용 잔여/새 노드 귀속은 **R03 정정 필요**. |

R02 추가 증거는 [2:3 CSV 재현](evidence/shape-23.json), [실제 unit 호출 형상 원출력](evidence/unit-shape-trace-async.log), [full header probe 원출력](evidence/header-lifecycle-full.log), [full header 구조화 결과](lifecycle/evidence/header-browser.json)다. 마지막 probe는 `env -u HEADER_PHASE node /tmp/worklazy-xd-s4-review/lifecycle/probes/header-browser.mjs`로 실행했다. 원 probe의 산출물·의존성 경로만 사본으로 바꾸었고 fixture/assertion은 그대로다. 두 duplicate unit 이외의 엔진 호출 파일 `excel-compare-fixtures.test.ts`는 position 날짜 비교이며, 공식 스모크의 fixture도 소스로 대조했다. **추가 실행으로 제품 동작은 확인됐지만 원 S4의 실행 주장이 정확해지는 것은 아니다.** 작성자는 이 보충 실행의 주체·시점과 원래 건너뛴 범위를 구분해 기록을 고칠 수 있다.

**제품 규칙·사용자 파일·범위**

- ko/en `features.json`의 ExcelCompare 문구·guide/FAQ와 `tools.json`의 해당 카드 설명/태그, `src/app/seo.ts` 설명·FAQ 입력이 같이 바뀌었다. 다른 기능 locale 키 변경0. 정적 생성기는 변경된 `seo.ts`를 입력으로 사용한다. [키 단위 diff](evidence/localization-changes.json).
- production 출력 집합은 S0와 **HTML105·canonical62·hreflang91·sitemap61** 모두 정확히 동일하다(개수만 비교한 것이 아님). [url-sets.json](evidence/url-sets.json). 정적 검사 startup104는 vendor 제외105 HTML 집합과 다른 검사 분모다.
- 실행 가능 확장자 `.js/.jsx/.mjs/.cjs/.ts/.tsx/.mts/.cts/.html/.htm/.svg/.vue/.svelte`를 저장소 파일 목록 전체에서 조사했다. 추적 목록과 `rg --files --hidden` 결과를 합쳤고, vendor/검증/생성 스크립트를 개별 파일 inventory와 소유자로 구분했다. `displayKey` 소비5파일은 명시 allowlist로 대조했다. [source-audit.json](evidence/source-audit.json), [전 파일 SHA/소유](evidence/source-inventory.json), [일치한 모든 행](evidence/source-matches.json).
- `displayKey`는 원본값 표시·검색·보고서용이며 React/그룹 identity는 `record.key`다. `safeError`와 `reasonText`는 현지화된 기본 안내로 fallback한다. UI에 정규화 key/원시 reason/error를 직접 삽입하는 새 sink를 발견하지 않았다. React `key={record.key}`는 화면 텍스트가 아니다. Parameters 계약명은 XLSX 메타데이터에 있고 guide의 실제 시트 이름 안내는 사용자용 설명으로 구분한다. UI 오류의 원시 Parameters 계약명 노출0.
- 의존성·App/AppShell·광고/분석 loader·공유 inputAdapter·global.css·번들 검사기는 S0와 동일하다. 새 서버 전제·광고 예외·URL 경로0. S4는 제품 코드 변경0, 생성물·vendor 수기 수정0이다. QA HTTP의 entry/Excel page/worker/관련 CSS bytes와 사본 dist SHA도 일치하고 추적 URL 검색0([http-qa.json](evidence/http-qa.json)).

| 검수자 실제 사용자 설정 | 중복 그룹 | matched | changed | added |
|---|---:|---:|---:|---:|
| 수동1행/B | 1 | 713 | 37 | 48 |
| 자동4행/B (ko/en 동일) | 0 | 703 | 37 | 48 |
| 자동4행/A (ko/en 동일) | 6 | 486 | 134 | 31 |

두 입력 모두 최초4행 후보. 행4/A의 첫 그룹 좌`[5,73]`, 우`[5,79]`, 6개 표시키 각각 좌2·우2다. 좌 목록2→우도 전개4 DOM 항목으로 독립성을 확인했다. 사용자 원본은 지정 사본만 읽고 결과·개인정보 캡처는 `evidence/private/`에만 두었다. ko/en 실제 다운로드 각9시트·Duplicates13열·폭12~48, 각 XLSX ZIP의18 XML/rels·24 entry를 ElementTree로 재개방했다. [사용자 결과](evidence/header-browser.json), [행1/B](evidence/user-one.json), [XML](evidence/xml.log).

**접근성 보류와 백로그**

원자료와 독립 전체 재실행은 모두16페이지·자동 violation0·외부요청0이다. `passes`는 axe의 passes 수이고 incomplete를 그 수에 더하지 않는다. **incomplete1274(contrast1271+aria3)**는 보존됐다. 중복 결과48측정과 머리글48측정의 최저는 기존 보고값5.272954:1(light), 5.732903:1(dark)과 일치한다. 다만 그것만으로 모든 새 노드가 해결됐다는 설명은 R03과 같이 부정확하다. 보충 측정16개는 검수자가 따로 실행한 증거다. 공용 shell/기존 표/guide/footer/모바일 탭·기존 ARIA 보류는 UI 재설계 소유로 유지한다. 특정 스크린리더 음성이나 실기기 검사를 한 것은 아니다.

| 남은 기존 백로그 | 기록된 관측·재현 | 우선순위·수리 여부 |
|---|---|---|
| BL01 | 151행 중복 목록 마지막 더보기 소진→BODY 초점,4/4. 키 비교 후 Tab·Enter. | **우선순위 미기록**, S4 수리0 |
| BL02 | ko guide의 긴 시트명 나열 잘림.390px dark에서 아래로 스크롤. | **우선순위 미기록**, S4 수리0 |
| BL03 | desktop1365×900 오른쪽 Enter 뒤 y=−19.53125..24.46875, 인접0.46875; 두 테마6상태. | **우선순위 미기록**, UI 재설계 귀속, 수리0 |
| BL04 | XLSX/XLSM 실제 error→string으로 suggested1, 타입 보존 XLS/XLSB/SpreadsheetML은 uncertain/null. | **높음·spreadsheet-core**, 기존 어댑터 SHA동일, 수리0 |
| BL05 | 모바일 검색 중앙71/72; ko/en y44.5/44.53125, header bottom63, center hit HEADER. | **우선순위 미기록**, UI 재설계 귀속, 수리0 |
| 공용 a11y | 자동판정 보류1274 중 새 결과 노드를 정정 분리한 잔여; 기존 ARIA3 포함. | UI 재설계 계획 소유. 새 노드를 여기로 넘기지 말 것. |

**번들**

S0 기준선 SHA는 `726a2d5be21ca250c76a5a9c9220affb8931da9286769f762f3531fd64d002c8`. 예산 코드·상한·override·multiplier는 불변이고 19 lazy routes 전체를 계측했다.

| gzip bytes 지표 | 검수 측정 | S0 대비 증가 | 증가 상한 | 결과 |
|---|---:|---:|---:|---|
| entryJsGzip | 301,530 | +2,242 | 20,480 | 통과 |
| affectedRouteJsGzip | 2,455,589 | +4,008 | 61,440 | 통과 |
| sharedJsGzip | 2,716,274 | +1,766 | 30,720 | 통과 |
| appJsGzip | 5,473,393 | +8,016 | 81,920 | 통과 |
| cssGzip | 37,839 | +146 | 10,240 | 통과 |

sol과 독립 검수의 다섯 값이 모두 같다. override `{}`, multiplier `1`, JavaScript80/CSS1개다. [bundle.json](</tmp/worklazy-xd-s4-review/evidence/bundle.json>) · [bundle.log](</tmp/worklazy-xd-s4-review/evidence/bundle.log>)

**배포 후보와 통합 경계**

현 HEAD의 **S4 최종 통과 선언은 보류**한다. S1~S3의 선행 승인·제품 동작을 취소하는 판정은 아니며, R01~R04를 반영한 실행/보고 보완 뒤 S1~S4 전체의 후보 판정을 다시 확정할 수 있다. 이 잡은 병합·commit·push·배포를 하지 않았다.

고정 배포 기준 `597a92f`→`2c338cf`→`c1e44f6`→`ebba520`→`ab00de3`→`5dfe413`→`bdd09a7`→`657dec8`→`3131258` 계보를 실제 부모 해시로 확인했다. `git merge-base --is-ancestor 597a92f 3131258` exit0. **53파일 +3203/−120**, S4만 **8파일(기록3 + PNG5), 텍스트 +25/−0**다([scope.json](evidence/scope.json)). 이 고정 쌍은 조상/후손이므로 분기 충돌이 없다.

읽기 시점의 **로컬 `main` ref는 cdb4007**이며 지정된 배포 기준597a92f와 다르다. cdb4007도597a92f의 조상이다. 이를 원격main 최신 상태라고 주장하지 않았고 fetch하지 않았다. 배포 잡에서 실제 통합main SHA를 다시 확정해야 한다. 금지된 U4 워킹트리/미커밋 산출물을 열지 않았으므로 그 미래 병합이 clean하다는 보장은 없다.

| main 대비 실제 공동 표면 | U4 등과 통합 시 보존할 내용 |
|---|---|
| ko/en features.json·tools.json, seo.ts | Excel 그룹 의미·후보/수동 안내·FAQ와 다른 제품 문구를 함께 보존 |
| 정적 생성 입력 | generator 자체는 불변이나 seo.ts 입력 변경을 소비. URL/canonical/hreflang/사이트맵 집합과 광고 경계 유지 |
| accessibility-audit.mjs·관련 unit | Excel 기본1+결과8 등록, incomplete 원자료와 새/상속 귀속 유지 |
| visual scenarios·config unit·기준선 | Excel16·공용5를 포함한 현재183세트와 다른 도구 결과 시나리오를 함께 보존. 임계값/마스크 불변 |
| tests/excel-compare-smoke.mjs | 독립50/50·500그룹·긴 키 실패/ZIP·검사 상태를 유지. 공용 browser-smoke 자체는 이번 브랜치에서 불변 |
| CHANGELOG·review-notes·backlog | 양쪽 기록 병합, R01~04 정정과 BL01~05 귀속/우선순위 보존 |
| package/lock·공유 writer·inputAdapter·AppShell/CSS | 이번 브랜치에서 바뀌지 않은 선행 보존 표면. U4 등의 별도 변화가 들어오면 그 의미 교집합을 검증 |

승인 후 배포는 **S1~S4 전체를 머지 커밋(`--no-ff`)으로 통합**하는 방식이 맞다. S1 단독을 떼어 적용하지 않는다. 실제 통합 산출물의 공용 표면·충돌 해결분 검증, 추적 제외 로컬 시각 확인, 지정 배포 게이트를 거쳐야 한다.

라이브 확인 예정 항목은 (1) ko/en Excel 비교 첫 로드·광고/분석의 일반/격리 경계 (2) 지정 사용자 사본 두 파일4행 후보와 수동1행 전환 (3) B1/A6/B0 중복 그룹 및 기대 summary (4) 같은 키가 **한 행 안 좌우 독립 목록**으로 보이고 전체 검색·펼침·더보기·전체값/Escape가 작동하는지 (5) XLSX/ZIP 다운로드의9시트·13열·실내용·유한 폭 (6) mobile/light/dark 레이아웃 (7) 갱신된 홈 카드와 영어 HWP→전체 도구 redirect (8) 언어/SEO/canonical·hreflang/사이트맵이다. 라이브 사이트는 이번 로컬 검수에서 열지 않았으며 배포 완료로 표기하지 않는다.

**규칙 19·캡처 인계**

S4 dispatch가 Gemini 직접 검수 대신 Codex 실측·캡처 보존과 Claude 확인을 지정했고, sol REPORT와 추적 review-notes가 그 차이를 명시했다. Gemini가 봤다는 허위 주장은 없다. Claude가 열 수 있는 구체 목록은 [visual-manual.json](evidence/visual-manual.json)과 아래 캡처 인덱스다. 원래 ‘전체 캡처 보존’과 ‘사람이183장 모두 육안으로 봄’은 다른 사실이며, 본 검수는 실제로 연 파일을 명시했다.

전체 파일별 클릭 경로는 [CAPTURES.md](</tmp/worklazy-xd-s4-review/CAPTURES.md>)에 있다. 검수자183장·sol183장·검수자 사용자7장·머리글16장·이전 기준선5장을 별도 목록으로 제공한다. 직접 연 baseline/actual/diff15장과 결과8장, 추가 사용자2장/머리글2장의 구분은 [visual-manual.json](</tmp/worklazy-xd-s4-review/evidence/visual-manual.json>)에 보존했다.

sol의 실제 결과8장(모두 직접 열어 확인):

- [excel-compare-empty__interaction-duplicate-result__ko__light__desktop.png](</tmp/worklazy-xd-s4/evidence/visual-captures-final/excel-compare-empty__interaction-duplicate-result__ko__light__desktop.png>)
- [excel-compare-empty__interaction-duplicate-result__ko__light__mobile.png](</tmp/worklazy-xd-s4/evidence/visual-captures-final/excel-compare-empty__interaction-duplicate-result__ko__light__mobile.png>)
- [excel-compare-empty__interaction-duplicate-result__ko__dark__desktop.png](</tmp/worklazy-xd-s4/evidence/visual-captures-final/excel-compare-empty__interaction-duplicate-result__ko__dark__desktop.png>)
- [excel-compare-empty__interaction-duplicate-result__ko__dark__mobile.png](</tmp/worklazy-xd-s4/evidence/visual-captures-final/excel-compare-empty__interaction-duplicate-result__ko__dark__mobile.png>)
- [excel-compare-empty__interaction-duplicate-result__en__light__desktop.png](</tmp/worklazy-xd-s4/evidence/visual-captures-final/excel-compare-empty__interaction-duplicate-result__en__light__desktop.png>)
- [excel-compare-empty__interaction-duplicate-result__en__light__mobile.png](</tmp/worklazy-xd-s4/evidence/visual-captures-final/excel-compare-empty__interaction-duplicate-result__en__light__mobile.png>)
- [excel-compare-empty__interaction-duplicate-result__en__dark__desktop.png](</tmp/worklazy-xd-s4/evidence/visual-captures-final/excel-compare-empty__interaction-duplicate-result__en__dark__desktop.png>)
- [excel-compare-empty__interaction-duplicate-result__en__dark__mobile.png](</tmp/worklazy-xd-s4/evidence/visual-captures-final/excel-compare-empty__interaction-duplicate-result__en__dark__mobile.png>)

실제 XLSX 결과 파일은 [user-ko-A6.xlsx](</tmp/worklazy-xd-s4-review/evidence/private/user-ko-A6.xlsx>) · [user-en-A6.xlsx](</tmp/worklazy-xd-s4-review/evidence/private/user-en-A6.xlsx>)이며 공개 저장소/보고 본문에 원본 개인정보를 옮기지 않았다.

**본 검수의 독립 실행과 한계**

명령별 cwd·전체 환경·UTC 시작/종료는 [checks.jsonl](</tmp/worklazy-xd-s4-review/evidence/checks.jsonl>)에 있다. 초반 두 공식 스모크만 [checks.jsonl](</tmp/worklazy-xd-s4-review/evidence/first-attempt/checks.jsonl>)의 충돌 전 완주 기록을 사용한다.

| 검수자 실제 명령 | 초 | exit | 원출력·결과 |
|---|---:|---:|---|
| `env TEST_BASE_URL=http://127.0.0.1:4350 npm run test:excel-compare` | 69.997 | 0 | [excel-compare.log](</tmp/worklazy-xd-s4-review/evidence/first-attempt/excel-compare.log>) · 공식 스모크 통과 |
| `env TEST_BASE_URL=http://127.0.0.1:4350 npm run test:new-tools` | 114.265 | 0 | [new-tools.log](</tmp/worklazy-xd-s4-review/evidence/first-attempt/new-tools.log>) · R01과 같은 건너뜀 |
| `./node_modules/.bin/tsc -b --pretty false` | 17.226 | 0 | [tsc.log](</tmp/worklazy-xd-s4-review/evidence/tsc.log>) |
| `npm run test:unit` | 4.328 | 0 | [unit.log](</tmp/worklazy-xd-s4-review/evidence/unit.log>) |
| `npm run build` | 94.514 | 0 | [build-production.log](</tmp/worklazy-xd-s4-review/evidence/build-production.log>) |
| `npm run test:static` | 0.827 | 0 | [static.log](</tmp/worklazy-xd-s4-review/evidence/static.log>) |
| `python3 /tmp/worklazy-xd-s4-review/probes/url-sets.py` | 0.135 | 0 | [url-sets.log](</tmp/worklazy-xd-s4-review/evidence/url-sets.log>) |
| `env VITE_LOCAL_QA=1 npm run build` | 93.790 | 0 | [build-qa.log](</tmp/worklazy-xd-s4-review/evidence/build-qa.log>) |
| `node --import=/tmp/worklazy-xd-s4-review/probes/observe-shapes.mjs --test --experimental-strip-types tests/unit/excel-compare.test.ts tests/unit/excel-compare-duplicate-report.test.ts` | 0.465 | 1 | [unit-shape-trace.log](</tmp/worklazy-xd-s4-review/evidence/unit-shape-trace.log>) · 검수 loader 오류, 아래 설명 |
| `node --import=/tmp/worklazy-xd-s4-review/probes/observe-shapes-async.mjs --test --experimental-strip-types tests/unit/excel-compare.test.ts tests/unit/excel-compare-duplicate-report.test.ts` | 1.352 | 0 | [unit-shape-trace-async.log](</tmp/worklazy-xd-s4-review/evidence/unit-shape-trace-async.log>) |
| `env VISUAL_ARTIFACT_DIR=/tmp/worklazy-xd-s4-review/evidence/visual-final VISUAL_CAPTURE_DIR=/tmp/worklazy-xd-s4-review/main/tests/visual-artifacts/final npm run test:visual` | 408.410 | 0 | [visual.log](</tmp/worklazy-xd-s4-review/evidence/visual.log>) |
| `node --experimental-strip-types ../probes/shape-23.mjs` | 0.485 | 0 | [shape-23.log](</tmp/worklazy-xd-s4-review/evidence/shape-23.log>) |
| `env A11Y_MAX_TOTAL=0 npm run test:a11y` | 67.853 | 0 | [a11y.log](</tmp/worklazy-xd-s4-review/evidence/a11y.log>) |
| `python3 /tmp/worklazy-xd-s4-review/probes/http-qa.py` | 0.243 | 0 | [http-qa.log](</tmp/worklazy-xd-s4-review/evidence/http-qa.log>) |
| `node /tmp/worklazy-xd-s4-review/probes/a11y-attribution.mjs` | 40.032 | 0 | [a11y-attribution.log](</tmp/worklazy-xd-s4-review/evidence/a11y-attribution.log>) |
| `node /tmp/worklazy-xd-s4-review/probes/user-one.mjs` | 4.870 | 0 | [user-row1.log](</tmp/worklazy-xd-s4-review/evidence/user-row1.log>) |
| `env HEADER_PHASE=user node /tmp/worklazy-xd-s4-review/probes/header-browser.mjs` | 15.502 | 0 | [user-row4.log](</tmp/worklazy-xd-s4-review/evidence/user-row4.log>) |
| `node /tmp/worklazy-xd-s4-review/probes/header-a11y.mjs` | 21.057 | 0 | [header-a11y.log](</tmp/worklazy-xd-s4-review/evidence/header-a11y.log>) |
| `python3 /tmp/worklazy-xd-s4-review/probes/check-xlsx-xml.py` | 0.083 | 0 | [xml.log](</tmp/worklazy-xd-s4-review/evidence/xml.log>) |
| `npm run bundle:measure` | 74.689 | 0 | [bundle.log](</tmp/worklazy-xd-s4-review/evidence/bundle.log>) |
| `npm run css:orphans` | 0.617 | 0 | [css.log](</tmp/worklazy-xd-s4-review/evidence/css.log>) |
| `node tests/tool-registry-routes.mjs` | 0.500 | 0 | [routes.log](</tmp/worklazy-xd-s4-review/evidence/routes.log>) |
| `env -u HEADER_PHASE node /tmp/worklazy-xd-s4-review/lifecycle/probes/header-browser.mjs` | 29.411 | 0 | [header-lifecycle-full.log](</tmp/worklazy-xd-s4-review/evidence/header-lifecycle-full.log>) |
| `git diff --check 597a92f 3131258` | 0.053 | 0 | [diff-check.log](</tmp/worklazy-xd-s4-review/evidence/diff-check.log>) |
| `python3 /tmp/worklazy-xd-s4-review/probes/final-state.py` | 0.810 | 0 | [final-state.log](</tmp/worklazy-xd-s4-review/evidence/final-state.log>) |

실행 위치는 `git archive 3131258`를 푼 `main/`이며 시작에 대상 추적2414파일과 SHA일치했다. 의존성은 대상 node_modules를 독립 복사했고 설치/새 의존 없음. Git을 쓰는 unit 때문에 읽을 object 경로만 연결한 `/tmp` 메타데이터와 복사 index를 사용했다. 빌드·브라우저는 아래 검수 도구 오류를 보정한 뒤 직렬·heap4GiB·4350 `--strictPort`, visual concurrency1이다. 원본 sol의 명령 전부를 무조건 다시 실행하지는 않았다: 전체 browser/Cleaner/QR/utilities/office/recovery는 원출력·소스·완주 증거를 검토했고, 공식 Excel/new-tools 및 필수 빌드/unit/static/visual/a11y/bundle/CSS/registry와 추가 반례는 이번 사본에서 실행했다. 원 실행과 독립 실행을 각 표에 분리했다.

검수 도구의 실패도 기록한다. 초기 `queue.py` 이름이 Python 표준 모듈 이름과 충돌해 source 조사 중 두 번째 실행 묶음이 시작됐다. 원래 Excel/new-tools 완주 후였으며 중복 production build와 QA build가 겹쳤다. 두 세션을 exit130으로 중단했고, 겹친 빌드·중단 visual5/183은 최종 증거에서 제외했다. 이전 production 로그는 중복 명령에 덮였으므로 그 원시출력을 최종 검증으로 쓰지 않는다. 파일명을 바꾸고 production/QA부터 직렬 재실행했다([제외 기록](evidence/first-attempt/EXCLUDED.md)). 엔진 호출 관찰의 첫 synchronous Node loader는 JSZip 로딩에서 `ERR_INTERNAL_ASSERTION`으로 실패했다. 비수정 원본 unit은 이미 통과했고, 비동기 loader로 동일 in-memory 관찰만 바꾸자 통과했다. 이는 제품 결함이나 공식 unit 실패가 아니다. 조사 중 JSON nodes를 배열로 가정한 요약 오류와 React key prop을 visible sink로 잘못 잡은 검수 정규식도 원자료 형식/실제 JSX 문맥에 맞게 보정했다. 원본 probe/제품 테스트 assertion은 수정하지 않았다.

첫 행동으로 현재 PROJECT_RULES 전문을 읽고 AGENTS·v3 정본·착수/검수 dispatch·sol 보고/evidence·S1/S2/S3 종결 검수·관련 review-notes를 확인했다. 대상에 todo가 없어 S0 보존19개 열린 계획의 관련 지시를 대조했다. **초기 원 트리 계획 파일 목록 탐색에서 금지된 s3-pdf-finish 하위 파일명까지 나열된 것은 절차 실수**다. 해당 내용은 열지 않았으며 재귀탐색을 중단하고 보존 입력만 사용했다. 금지된 U4·XR·DC 코드/산출물 내용은 열거나 실행하지 않았다. 현재 미커밋 U4 계획까지 실시간 충돌 검사했다고 주장하지 않는다.

**종료 불변 증명**

2026-09-08T03:15:07.872283+00:00 확인: 대상 HEAD `3131258cb36d8f052b393abe4c6ec7b60547431d`, 브랜치 `excel-dupkey-20260907`, 시작/종료 git status 모두 clean. **대상 추적2414파일·archive 사본 동일 2414파일의 SHA 변화0**. 원 저장소 status도 시작과 동일하며, 허용된 미커밋 `CLAUDE.md`·`PROJECT_RULES.md`만 추적 변경 상태다. 기존 untracked 이름은 시작부터 있었고 내용을 열지 않았다.

| 보호 대상 | 시작 SHA-256 = 종료 SHA-256 |
|---|---|
| 원 저장소 CLAUDE.md | `6029e02f8f22eda2e253e136be586efb614cf0b8c25c806b311d473d23bb983d` |
| 원 저장소 PROJECT_RULES.md | `f06ba920a3dfaa09e03445bcbbf411e6ae13741ed1ccc26cd95d051684e94905` |

사용자 파일3·보존 입력27·원 실행 log27도 SHA 변화0. **4350~4359 LISTEN 0**. 브랜치 전환·commit·push·추적 수정 없이 종료했다. 전체 파일별 SHA와 status는 [state-start.json](</tmp/worklazy-xd-s4-review/evidence/state-start.json>) · [state-final.json](</tmp/worklazy-xd-s4-review/evidence/state-final.json>) · [final-state.log](</tmp/worklazy-xd-s4-review/evidence/final-state.log>)에 있다. REPORT.md 저장 후 파일 존재·크기·SHA·내부 링크를 검사하며 그 결과는 [report-validation.json](</tmp/worklazy-xd-s4-review/evidence/report-validation.json>)에 별도 보존한다.

**최종 판정: [수정 후 재검수]** — 기존 백로그의 기능 수리 없이 R01~R04의 실행 증거·귀속·보고·우선순위를 보완할 것. 그 전에는 S4를 최종 통과/배포 후보 확정으로 기록하지 않는다.
