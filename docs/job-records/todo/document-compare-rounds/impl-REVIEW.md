# 문서 비교 엔진 통일 구현 검수 — Codx

**[수정 후 재검수] — P2 검증 결함 3건(R1~R3).** 공용 diff 연결·기존 동작의 재현에서는 제품 결함을 확인하지 않았다. 그러나 정본이 요구한 구조 키 기반 oracle, 5쌍의 패키지 거부 결과 검사, E6 실행 fixture가 완성되지 않았다. 정상 테스트의 통과만으로 정본 완료를 인정할 수 없다.

검수 대상은 `/tmp/worklazy-dc-impl`, 브랜치 `document-compare-engine-20260907`, HEAD **`64b5264a5aab0535a95c9ac4ba9e2c2177354120`**이다. 기준 **`5bc6854175331bdd73b267784d9633cdccda8446`**는 현재 main과 같고 대상의 조상이며, 그 이후 커밋은 6개다. 정본 「정본화 v3」 전체, round-2 AMENDMENTS A~C·E, round-3 AMENDMENTS, round-4 REPORT, sol/검수 디스패치와 관련 review-notes를 대조했다. 열린 계획서 검색은 [open-plan-scan.txt](open-plan-scan.txt)에 남겼다. UI §6-B 이관 및 병행 PDF 작업과 충돌하는 엔진 지시는 확인하지 않았다.

**검증 환경과 명령 읽는 법**

`git archive 64b5264a5aab0535a95c9ac4ba9e2c2177354120`을 `/tmp/worklazy-dc-review/source`에 풀어 검증했다. 새 설치 없이 기존 패키지를 항목별로 링크했고 `.tmp/.vite/.vite-temp`는 사본 안에 별도 생성했다. 모든 실행은 [run.py](run.py)가 `NODE_OPTIONS=--max-old-space-size=4096`, 전용 `TMPDIR=/tmp/worklazy-dc-review/tmp`, `npm_config_cache=/tmp/worklazy-dc-review/npm-cache`로 수행한다. 빌드·브라우저·시각은 직렬 실행했다.

archive에서 `git ls-files`를 쓰는 기존 unit도 빠짐없이 실행하려고 `/tmp/worklazy-dc-review/git-metadata`에 별도 bare 메타데이터와 대상 커밋의 임시 index를 만들었다. 원 저장소 객체는 읽기 전용 alternate로 참조하고 `GIT_DIR/GIT_WORK_TREE`는 사본을 가리켰다. 커밋·원 저장소 index/refs 수정·브랜치 전환은 하지 않았다.

QA preview는 4270, production preview는 4272에 `--strictPort`로 띄웠다. Excel 두 스모크는 production 광고 DOM을 요구하므로 최초 production 빌드의 보존 사본 `dist-production`을 사용했다. QA 산출물에는 production 추적 코드 존재 검사를 적용하지 않았다. 두 서버는 종료했으며 포트 폐쇄도 확인했다.

아래 명령은 별도 표기가 없으면 `source/`에서 실행했다. 모든 일반 검증과 반례 명령의 **argv·exit·소요 시간은 `logs/<이름>.json`, 전체 stdout/stderr는 `logs/<이름>.log`**에 있다. 예: `python3 /tmp/worklazy-dc-review/run.py unit npm run test:unit`.

| 검수 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 / 심각도 |
|---|---|---|---|
| 1. 범위·UI 이관 | [통과] | `git diff --stat 5bc6854 64b5264`: 28파일, +2483/-684. 코어·정렬·browser-smoke·visual config/scenarios 무변경을 [audit-static.py](audit-static.py)로 확인. baseline 변경은 EN dark desktop HWP 결과 1장뿐. | 없음. 폭·rail·모바일·ARIA·새 결과 a11y/rendering·장문 fixture 반입 0. |
| 2. 확정 1·1-a·1-b | [통과] | `python3 .../audit-static.py`: 1차 자료와 골든 97쌍 완전 동일(27/68/2), 사용자 쌍 제외. `node --test --experimental-strip-types .../golden-mutant.test.ts`: `diffText => []` 변조에 **96실패/2통과, exit 1**. `node --experimental-strip-types .../guard.mjs`: 토큰 셀16/문자 셀2,268,036, `equal " tail"` 보존. | 없음. 코어 무변경·정적 기대값·토큰 수 가드 확인. |
| 3. 확정 2 bridge | [통과] | 소스에서 동기 전역 등록→Python 로드, `from js`+`json.loads`, fallback 없음, Python `len`/slice·최종 cursor 검증 확인. 기본 oracle의 tab/br/cr/surrogate/combining/empty-run/empty-text 경계 통과. `node .../bridge-errors.mjs`: 실제 worker 응답을 변조한 **누락·throw·숫자 반환·재구성 오류 × ko/en 8/8**, 최종 화면에 현지화 오류만 표시. [bridge-errors.json](bridge-errors.json) | 없음. 반환값은 JSON 문자열이며 문단별 PyProxy 반환을 만들지 않는다. |
| 4. 죽은 코드·추출 | [통과] | [static-audit.json](static-audit.json): pruning SHA 정본 일치, AST removed31/keep17/추출 폐쇄17, 남은 정의 AST 불변. before/after 각각 10파일×ko/en×tables×metadata **80/80 동일**. raw import와 `runPython(compareScript)` 보존. [extraction-80.json](extraction-80.json) | 없음. |
| 5. 확정 3·3-a oracle | **[결함]** | 기본 `npm run test:document-diff`: 5쌍/55 sidecar, 46일치/9허용, 실제 package4행, 8경계 통과. +1 offset 변조는 exit1. 그러나 **키 변조 exit0**, **실제 패키지 삭제 텍스트 훼손 exit0**, **E6 fixture 부재**. 아래 R1~R3 참조. | **P2 ×3.** 구조 키를 실제 대응·예외 식별에 사용하고, 최종 5쌍 패키지 거부 검사를 추가하며, E6 fixture를 실행한다. |
| 6. 확정 2-a 메모 | [통과] | 기존 `tests/browser-smoke.mjs` 전체 파일이 기준과 동일. `trackedComments !== afterComments` 검사 보존, Word/전체 스모크 통과. 5쌍의 `commentsPreserved=true` 재현. | 없음. 메모 본문 diff를 DOCX에 새로 반영하지 않음. |
| 7. 확정 4·4-a HWP·화면 | [통과] | `TEST_ONLY_HWP=1 npm run test:new-tools`: 실텍스트 `을`→`자금을`, 본문 복원, ko/en 안내, 기존 빈 fixture 편집 왕복 통과. QA ko/en×1440/320px 안내 정확 일치·notice/page overflow0·좌우 잘림0. DOCX 정상 표본 포함 **5화면 직접 열람**, tracking request0. 시각10/10. | 없음. 320px의 기존 결과 nav/legend 잘림과 내부 문서 가로 스크롤은 UI 이관 범위이며 이번 안내 문구 결함으로 세지 않았다. |
| 8. 공통 검증 | [통과] | production build→tsc→unit345→static104→QA build, Word/HWP/전체 browser/Office/Excel cleaner/Excel compare, oracle, visual10, bundle5종, CSS0, registry20, diff-check 모두 exit0. 세부 표 아래. | 없음. 기본 oracle 명령의 exit0과 R1~R3의 계약 완성 여부는 별개다. |
| 9. 사용자 문서 재현 | [통과] | `node --experimental-strip-types .../manual-user-document.mjs`: 제14조④ source/XML **del `을`(104,104)→ins `자금을`(105,104)** 일치. 웹 표시 (106,106)/(107,106)은 `④ ` 2 code point 접두. 수락본문 동일, 생성153 revisions/bridge1158호출. [로그](logs/user-memory.log) | 없음. 원본 읽기·Pyodide 메모리 처리만, 사용자 문서 복사·fixture화 없음. |
| 10. 기록·인계 | [결함] | CHANGELOG의 구현 요약과 빌드·unit·추출·bundle 수치는 재현됐다. 다만 review-notes의 “E1~E6 통과”, 구조 키 검증 표현은 R1~R3 때문에 보장이 과장됐다. 지정 `/tmp/worklazy-dc-impl-out/REPORT.md`는 없음; 실제 로그·캡처·수동 스크립트는 존재. | R1~R3 수정 후 기록과 인계 REPORT를 실제 실행 범위로 갱신. 독립 제품 결함으로 중복 계산하지 않음. Office는 이번 95 download states(기록96), cache7/5088B는 동일; 가변 관측값으로 판단. |
| 11. 범위 밖 발견 판정 | [통과] | sol 기록의 QA 광고 전제 충돌, 두 번째 HWP 파일 선택 교정, 사용자 offset +2는 각각 production 스모크·실텍스트 before/after·E3로 설명되고 재현됨. | 기존 계약 안의 처리로 수용. 새 제품 계약·UI 수리 범위로 확대하지 않음. |

**R1 — P2: 구조 키를 만들어도 대조·예외 식별에는 사용하지 않는다.**

대상: [tests/document-diff-equivalence.mjs:72](/tmp/worklazy-dc-impl/tests/document-diff-equivalence.mjs:72), [equivalence-contract.json:12](/tmp/worklazy-dc-impl/tests/fixtures/document-compare/equivalence-contract.json:12), [document-diff-equivalence.py:117](/tmp/worklazy-dc-impl/tests/support/document-diff-equivalence.py:117).

현재 검사는 키 필드의 존재·일부 타입만 확인한다. 9개 허용 예외는 `pairId:paragraph-call:index`이고, 실제 4행 package 대조도 `paragraphRows + tableRows`의 위치로 한다. 정본의 “ko/en location·호출 순번을 키로 쓰지 않는다” 및 구조 키 대응 계약이 실행 검사로 구현되지 않았다.

재현: `python3 /tmp/worklazy-dc-review/run.py oracle-mutant-keys node --experimental-strip-types /tmp/worklazy-dc-review/oracle-mutant-keys.mjs` → **exit0**, 46 matching/9 allowed/4 package 그대로. 이 반례는 모든 observation의 before/after index를 `[-999]`, 두 경로를 `WRONG/PATH`, sourceSlice를 음수로 바꾼다. [반례 소스](oracle-mutant-keys.mjs)·[원출력](logs/oracle-mutant-keys.log). 정상 키 표본이 실제로 55개 존재하고 중복 없다는 현재 관측([inventory](oracle-inventory.json))만으로 변조 검출을 대신할 수 없다.

**수정 지시:** fixture의 독립 기대 구조 키와 결과를 대응시켜 `pairId/storyPart/beforeIndexes/afterIndexes/beforePath/afterPath`, split sourceSlice를 검증한다. 누락·중복·잘못된 경로/인덱스를 실패시킨다. E1 허용목록도 구조 키+사유로 바꾸고 호출 순번 문자열을 제거한다. 올바른 키를 잘못된 키로 교체하는 음성 대조가 실패해야 한다. diff 코어·문단 정렬은 변경하지 않는다.

**R2 — P2: 5쌍은 최종 패키지의 거부 결과를 검사하지 않는다.**

대상: [document-diff-equivalence.py:183](/tmp/worklazy-dc-impl/tests/support/document-diff-equivalence.py:183), [document-diff-equivalence.mjs:68](/tmp/worklazy-dc-impl/tests/document-diff-equivalence.mjs:68).

`_run_pair`는 저장 패키지를 수락해 after와 비교한다. `reconstructedBefore`는 저장 이전 `_paragraph_revision` sidecar를 대상으로 하므로 최종 ZIP의 삭제 내용이 손상돼도 검출하지 못한다. 실제 package XML 세그먼트 재독해는 `pair_id == "exact"` 4행에만 있다. 정본이 요구한 “5쌍 sidecar와 전체 패키지 구조/수락/거부 검사를 구분”에서 거부 쪽이 빠졌다.

재현: `python3 /tmp/worklazy-dc-review/run.py oracle-mutant-reject-counted node --experimental-strip-types /tmp/worklazy-dc-review/oracle-mutant-reject.mjs` → **exit0, oracleStillPassed=true**. 생성 후 ZIP 저장 직전에 `word/document.xml`의 `w:delText`를 `CORRUPTED_DELETED_TEXT`로 바꿨다. 실제 훼손 수는 base1/split1/revisions9, boundary0/formatting0/exact0이다. sidecar는 그대로이고 수락 결과는 삭제 텍스트를 제거하므로 정상 통과한다. [변조 Python](support-mutant-reject.py)·[실행 소스](oracle-mutant-reject.mjs)·[원출력](logs/oracle-mutant-reject-counted.log).

**수정 지시:** 5쌍의 최종 생성 ZIP에서 기존 author/구조 revision 의미론과 명시 예외를 적용한 거부 결과를 independently 복원해 before 기대값과 비교한다. 기존 browser 스모크의 package 구조·수락·거부 검사를 재사용할 수 있지만, 5쌍의 적용 범위와 명시 예외를 고정해야 한다. 적어도 정상 1:1 본문에 생성된 삭제 텍스트를 저장 직전에 훼손하는 반례가 실패해야 한다. sidecar 문자열 복원을 패키지 거부 검증으로 기록하지 않는다.

**R3 — P2: E6는 이름만 등록됐고 실행 fixture가 없다.**

대상: [equivalence-contract.json:49](/tmp/worklazy-dc-impl/tests/fixtures/document-compare/equivalence-contract.json:49), [document-diff-equivalence.mjs:26](/tmp/worklazy-dc-impl/tests/document-diff-equivalence.mjs:26).

E6 ID는 `comments-multipara:joined-cell-input`이지만 `comments-multipara` pair는 fixturePairs나 별도 실행 목록에 없다. 전체 DOCX fixture12개를 XML로 세었으며 **다문단 셀0개**다([oracle-inventory.json](oracle-inventory.json)). 현재 단언은 E6 이름에 `joined-cell`이 포함되는지만 확인한다. E2의 실제 split fixture와 sourceSlice2건은 존재한다.

검수용으로만 합성한 셀 `['Alpha ','Beta']→['Alpha','Beta']`를 실제 생성기·웹 모델로 실행했다. `python3 /tmp/worklazy-dc-review/run.py e6-probe node --experimental-strip-types /tmp/worklazy-dc-review/e6-probe.mjs` → exit0. 웹 `deleted " \n" + added "\n"`, XML `deleted " "`가 정본 예외 그대로 재현됐다([e6-probe.json](e6-probe.json)). 이것은 허용된 입력 차이이며 제품 알고리즘 수리 요구가 아니다.

**수정 지시:** E6 이름에 연결되는 실제 다문단 셀 fixture와 실행 경로를 추가한다. 웹/생성기 각각의 입력·기대 변경 문자열·offset을 단언하고 해당 ID만 동치 예외로 둔다. fixture를 누락시키거나 단일 문단으로 바꾸면 예외 검증이 실패해야 한다. 기존 5쌍·exact4키·E2 fixture를 유지한다. E4도 현재 같은 미등록 pair명을 참조하므로 이 fixture와 연결할 때 메모 after bytes 보존 범위를 함께 명확히 한다.

**실행 검증표**

| 로그 이름 | 실제 명령 | exit / 핵심 출력 |
|---|---|---|
| build-production | `npm run build` | 0 / 2,834 modules, 61 정적 페이지 |
| tsc | `node node_modules/typescript/bin/tsc -b --pretty false` | 0 / 진단 없음 |
| unit | `npm run test:unit` | 0 / **345 pass, 0 fail, 0 skip** |
| static | `npm run test:static` | 0 / locale/hreflang/runtime/ads/robots/sitemap, startup104 |
| build-qa | `VITE_LOCAL_QA=1 npm run build` | 0 / 2,834 modules, 61 페이지 |
| manual-screen-clean | `node /tmp/worklazy-dc-review/manual-screen-clean.mjs` | 0 / HWP4·DOCX1, 안내 overflow0, tracking0 |
| browser-word | `TEST_SCOPE=word npm run test:browser` | 0 / Word 비교·추적 DOCX·기존 메모/수락/거부 검사 |
| new-tools-hwp | `TEST_ONLY_HWP=1 npm run test:new-tools` | 0 / 실텍스트·ko/en 문구·3,584B/1페이지 editor roundtrip |
| browser-full | `npm run test:browser` | 0 / Excel·Word·PDF·공용 UI 키보드 계약 |
| office | `npm run test:office` | 0 / 95 download/7 cached, Calc edit, DOCX5088B |
| excel-cleaner | `TEST_BASE_URL=http://127.0.0.1:4272 npm run test:excel-cleaner` | 0 / 광고 DOM·정리·취소·정규식 watchdog·입력 불변 |
| excel-compare | `TEST_BASE_URL=http://127.0.0.1:4272 npm run test:excel-compare` | 0 / 비교·내보내기·화면 계약 |
| oracle | `npm run test:document-diff` | 0 / 97 bridge calls, 55 sidecar, 46 match, 9 allowed, package4, edges8 |
| bridge-errors-final | `node /tmp/worklazy-dc-review/bridge-errors.mjs` | 0 / 실제 worker 실패4유형×ko/en8회, 내부 명칭 노출0 |
| visual | `VISUAL_ONLY=document-compare VISUAL_CONCURRENCY=1 npm run test:visual` | 0 / **10/10 matched**, Chrome152.0.7977.64 |
| bundle | `BUNDLE_MEASURE_OUTPUT=/tmp/worklazy-dc-review/bundle.json npm run bundle:measure` | 0 / 아래 5종 값, sol 기록과 정확 일치 |
| css-orphans | `npm run css:orphans` | 0 / zero-reference selector arms0 |
| registry | `node tests/tool-registry-routes.mjs` | 0 / count20, missing/unexpected/duplicate0 |
| user-memory | `node --experimental-strip-types /tmp/worklazy-dc-review/manual-user-document.mjs` | 0 / source/XML 문자열·offset·순서 동일, E3 접두2 |
| diff-check | `git -C /tmp/worklazy-dc-impl diff --check 5bc6854 64b5264` | 0 / 출력 없음 |

Bundle gzip bytes: entry **299294**, affected routes **2450893**, shared **2711698**, app **5461885**, CSS **37687**. [bundle.json](bundle.json). 이번 명령은 5종 실측이며 기준 보고서와의 budget delta 게이트를 별도로 수행했다고 주장하지 않는다.

[shots-clean/](shots-clean/)의 HWP ko/en desktop·320px 및 DOCX 표본5장을 직접 열어 확인했다. 기존 동의창이 화면을 덮던 최초 [shots/](shots/)도 보존했다. 최종 화면은 consent granted·추적 없는 QA·폰트/paint 대기 후 캡처했다. 안내는 두 언어에서 줄바꿈되고 잘리지 않았다. 토글 thumb 이탈·텍스트 세로 낙하도 보이지 않았다. baseline 전후 두 장([이전](baseline-before.png), [이후](baseline-after.png))은 안내 문구가 1줄에서 2줄로 바뀌고 아래 내용이 이동한 차이로 확인했다. 기준선 전체 cleanup이나 검수 중 baseline 수정은 없다.

**실패 로그 해석과 기록 보정**

- `golden-mutant`와 `oracle-mutant-offset`의 exit1은 의도한 음성 대조 성공이다. 반대로 `oracle-mutant-keys`와 `oracle-mutant-reject[-counted]`의 exit0은 R1/R2의 증거다.
- `bridge-errors`·`bridge-errors-ui`의 최초 exit1 두 건은 검수 스크립트가 최종 UI의 기존 오류 문구를 지나치게 좁혀 단언한 실패다. 기존 worker와 UI의 두 단계 현지화 경계를 확인한 뒤, 코드 변경 없이 이미 존재하는 현지화 문구 집합 및 내부 명칭 부재를 검사했다. 최종8/8 통과. missing bridge의 EN 문구는 기존 분류기에서 DOCX 구조 오류로 분류되지만 원시 예외는 노출하지 않으며, 이번에 오류 분류 정확성까지 새 계약으로 확대하지 않았다.
- HWP 빈 fixture에서 `[CanvasView] 페이지 0 정보가 없습니다` 상류 로그2줄은 재현됐고 실제 저장/재파싱/재개방은 통과했다.
- sol의 REPORT 부재 때문에 별도의 범위 밖 발견 목록 전체 존재는 확인할 수 없다. review-notes에 기록된 실행 중 판정은 위 11항에서 검토했다. 추가 미보고 발견이 없다고 추정하지 않는다.

**저장소 불변과 종료**

[시작](start-state.json)·[종료](end-state.json)·[불변 검사](immutability.json): 대상 sol worktree의 **추적 파일2392/2392 SHA-256, HEAD, branch, status가 모두 동일**하다. 시작/종료 status는 빈 문자열이다. 검수 산출물과 변조 반례는 `/tmp/worklazy-dc-review/`에만 작성했고 sol worktree 추적 파일·코어·fixture를 변조하지 않았다. 커밋·push·브랜치 전환 없음.

원 워킹트리의 [시작 status](original-status-start.txt)와 [종료 status](original-status-end.txt)는 다르다. 종료 시 PDF7개 추적 파일 변경과 `src/features/pdf-editor/outputName.ts` 신규 파일이 관측됐다. 이는 사용자에게 고지된 병행 U4-3 작업 표면이며 이 검수에서는 해당 워킹트리에 쓰는 명령을 실행하지 않았다. 따라서 **원 워킹트리 전체 불변이라고 거짓 판정하지 않고**, 차이를 별도 보존한다. 그 변경을 수정·정리·되돌리지 않았다. QA/production preview는 모두 종료했고 4270/4272 접속 불가를 확인했다.

**최종 판정: [수정 후 재검수]. R1~R3와 그에 따른 기록 보정을 완료한 커밋을 재검수 대상으로 제출한다.**
