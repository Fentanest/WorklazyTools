# 문서 비교 엔진 fix-1 재검수 — Codx

**[수정 후 재검수] — P2 검증 결함 1건(R2-1).** F1 구조 키·결과 대응, F2 최종 패키지 거부 검사, F3의 E6 다문단 셀 fixture는 자신의 음성 대조에서 해소를 재현했다. 다만 새 E4/E6 pair의 **최종 ZIP에서 `word/comments.xml`이 사라져도 oracle이 통과**한다. 정상 생성기는 메모를 보존하며, 이번 판정은 oracle의 누락 검출 실패에 대한 것이다.

대상 `/tmp/worklazy-dc-impl`, 브랜치 `document-compare-engine-20260907`, HEAD **`a418a3f26345caf70bf82d10e91f1453460f0417`**. 1차 대상 `64b5264a5aab0535a95c9ac4ba9e2c2177354120`과 기준 `5bc6854175331bdd73b267784d9633cdccda8446`가 모두 대상의 조상임을 확인했다. 선독: PROJECT_RULES·AGENTS, 1차 검수 보고, fix/review2 디스패치, sol fix 보고·logs, 정본 v3 확정3·3-a·2-a와 round-2 AMENDMENTS C. [열린 계획서 검색](open-plan-scan.txt)에서 UI §6-B 이관과 병행 PDF 작업은 이번 테스트·fixture 검수 지시와 충돌하지 않는다.

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| F1: 구조 키·키별 지문·E1 | **[통과]** | `python3 .../run.py oracle npm run test:document-diff` → 키62/지문62, match53/E1 9. 자신의 `key-{pairId,storyPart,beforeIndexes,afterIndexes,beforePath,afterPath,sourceSlice}` **각각 exit1**. 누락·중복·정상 결과 교환·offset+1도 각각 exit1. [원출력](logs/)·[정적 검사](static-audit.json). | 없음. E1은 구조 키 행의 `expectedResult=E1`과 사유에 결합한다. 호출 순번 문자열 `paragraph-call:`는 oracle/fixture/support에 0건. |
| F2: 최종 ZIP 거부 | **[통과]** | 정상 oracle reject **5쌍/13 story part/구조 revision5**. 별도 Python [audit-packages.py](audit-packages.py)로 실제 ZIP XML을 수정해 거부한 뒤 before와 비교, **13/13**. 자신의 저장 직전 `base` 본문 p[0] 삭제 텍스트 `빠르게→CORRUPTED_DELETED_TEXT` → **exit1**, `base rejected package text differs`. [로그](logs/probe-deleted-text.log). | 없음. E1 명시 치환7건과 다른 author revision 보존을 적용한 story text 검사다. sidecar 문자열 복원을 패키지 거부 검사로 세지 않는다. |
| F3: E6 fixture·실행·예외 제한 | **[통과]** | 실제 before/after 다문단 셀 각각1. 웹·생성기 입력, 변경 문자열과 offset을 정적 계약에 대조. 실행 등록 제거·실파일 누락·단일 문단화 **각각 exit1**. [입력/결과](baseline-result.json), [단일 문단 반례](logs/probe-e6-single-paragraph.log). | 없음. E6는 `comments-multipara:joined-cell-input` 한 ID만 별도 검증한다. 일반 sidecar에서 E6 불일치를 허용하지 않는다. |
| F3의 E4 연결·확정2-a after bytes | **[결함 R2-1, P2]** | 정상 after와 output은 **259B, 동일 SHA**. 메모 bytes 훼손 exit1. 그러나 같은 출력의 `comments.xml`만 제거하면 **exit0 / commentsPreserved=true / acceptedMatchesAcceptedAfter=false**. 다른 ZIP4항목 SHA 불변. [반례](logs/export-comments-missing.log)·[독립 ZIP 확인](package-audit.json). | after에 part가 있으면 output에도 반드시 있어야 하고 bytes가 같아야 한다. after에 없을 때의 부재도 일치시키며, 새 E4 pair의 누락·훼손 음성 대조를 모두 실패시킨다. 아래 R2-1 문안 참조. |
| 회귀·범위 | **[통과]** | `python3 .../audit-static.py` → fix **8파일만 변경**. `src/`, 문단/표 정렬·diffText·UI/HWP 문구·의존·기존 smoke/시각·unit 무변경. 5쌍/10 DOCX·exact2 DOCX bytes 불변, E2 sourceSlice2건, 골든97 불변. [근거](static-audit.json). | 없음. 시각 회귀는 fix가 테스트·fixture·기록만 변경한 지시서의 생략 조건에 해당한다. |
| 공통 검증 | **[통과]** | tsc·unit345·oracle·build·static·Word·HWP·Office·Excel cleaner/compare·bundle·CSS·registry·diff-check 모두 exit0. 아래 실제 명령표. | 없음. 정상 oracle exit0과 R2-1의 음성 대조 실패는 구분한다. |
| 기록 | **[부분 통과 / R2-1 보정 필요]** | review-notes의 F1·F2·E6 원인/수리, 키62·5/13/5·E1 9·예외 입력/offset과 실행 수치는 재현됨. “after bytes 정확 보존을 별도로 검사”는 **출력 part 누락 시 성립하지 않음**. CHANGELOG·Codx 서명·sol 원로그 존재 확인. | R2-1 수리 후 메모 part 존재/부재와 bytes의 실제 검사 범위 및 누락 음성 대조 결과를 review-notes에 정정. 별도 제품 결함으로 중복 계산하지 않는다. |

**R2-1 — P2: 새 E4/E6 fixture에서 메모 part 전체 누락을 보존 성공으로 처리한다.**

핵심 위치는 이번에 추가된 [tests/document-diff-equivalence.mjs:221](/tmp/worklazy-dc-impl/tests/document-diff-equivalence.mjs:221)이다. 이 줄은 `multiparaReport.commentsPreserved`만 단언한다. 그 값의 공급자인 [tests/support/document-diff-equivalence.py:332](/tmp/worklazy-dc-impl/tests/support/document-diff-equivalence.py:332)는 다음 식으로 출력 part가 없으면 참을 반환한다.

```python
"word/comments.xml" not in parts or archive.read("word/comments.xml") == zipfile.ZipFile(after_path).read("word/comments.xml")
```

뒤의 before/after author·본문 단언은 **입력 모델**에 대한 것이므로 출력 메모 누락을 잡지 않는다. 기존 5쌍의 수락 결과 검사는 `contract.fixturePairs`에만 적용되어 새 `exceptionFixturePairs`의 `comments-multipara`에는 적용되지 않는다. 실제로 반례의 `acceptedMatchesAcceptedAfter=false`인데도 최종 명령은 exit0이다. helper의 관대한 식은 이전부터 있었지만, 이번에 새 메모 fixture의 after bytes 보존을 이 값만으로 검사하면서 생긴 검수 공백이다. 확정2-a가 정한 기존 after bytes 보존 범위 안의 문제이며 메모 diff 의미론 확장이 아니다.

재현 명령(모두 이번 검수자가 작성한 사본용 주입; sol의 `DOCUMENT_DIFF_MUTATION` 훅은 사용하지 않음):

```bash
python3 /tmp/worklazy-dc-review2/run.py probe-comments-missing env REVIEW2_MUTATION=comments-missing node --experimental-strip-types /tmp/worklazy-dc-review2/mutants/oracle.mjs
# exit 0: comments.xml 항목을 제거했는데 oracle 전체 통과
python3 /tmp/worklazy-dc-review2/run.py export-comments-missing env REVIEW2_MUTATION=comments-missing node --experimental-strip-types /tmp/worklazy-dc-review2/mutants/export.mjs
# exit 0: 같은 반례의 실제 최종 ZIP와 항목별 SHA 보존
python3 /tmp/worklazy-dc-review2/run.py package-independent python3 /tmp/worklazy-dc-review2/audit-packages.py
# exit 0: outputHasComments=false, oracleCommentsPreserved=true,
# otherPackagePartsUnchanged=true, unchangedPartCount=4,
# acceptedMatchesAcceptedAfter=false
```

[원 반례](mutants/oracle.mjs)·[주입 코드](mutants/support.py)·[ZIP 내보내기](mutants/export.mjs)·[항목별 변조 전후 SHA](comments-missing-result.json)·[누락 ZIP](packages-comments-missing/comments-multipara-tracked.docx). 정상 [after](packages-baseline/comments-multipara-after.docx)와 [tracked](packages-baseline/comments-multipara-tracked.docx)의 메모는 259B·SHA-256 `ff3c11253aaaf98dd85e451c901eeb5144da2c37a750c7368d336013ed4dc51e`로 같다. before는 261B·다른 SHA다. 즉 fixture 자체와 정상 생성 결과는 유효하다. 메모 내용만 훼손하는 대조군은 `word/comments.xml was not preserved from after`로 **exit1**이다([로그](logs/probe-comments-corrupt.log)).

**수정 지시 문안:** `commentsPreserved`를 after ZIP과 출력 ZIP의 해당 part 존재 여부가 동일하고, 존재할 때 bytes가 같은 경우에만 참이 되도록 수정한다. `commentFixture.preservedPackagePart`가 정한 E4 fixture의 after/output part 존재를 명시 단언하고, 출력 part 누락과 bytes 훼손을 각각 별도 음성 대조로 둔다. 둘 다 실패하고 정상 E4/E6·5쌍·exact·골든97 및 요구 공통 검증이 계속 통과해야 한다. 이번 독립 검수 스크립트는 수정하지 않는다. 제품 생성기·메모 본문 diff·UI·diff 코어·정렬은 바꾸지 않는다. CHANGELOG에는 검사 수리만 간결히, review-notes에는 누락 검출 보장과 실행 수치를 남긴다.

**음성 대조의 범위와 결과**

`python3 /tmp/worklazy-dc-review2/run.py probe-<이름> env REVIEW2_MUTATION=<이름> node --experimental-strip-types /tmp/worklazy-dc-review2/mutants/oracle.mjs`로 실행했다. [준비 스크립트](prepare-probes.py), 모든 명령·exit·시간은 `logs/<이름>.json`, 전체 stdout/stderr는 `.log`에 보존한다. 정상 대조군 `probe-baseline`은 exit0이다.

| 주입 | 실제 검출 / exit |
|---|---|
| key-pairId / key-storyPart / key-beforeIndexes / key-afterIndexes / key-beforePath / key-afterPath | 각 필드 하나만 교체 → 각각 `Unexpected sidecar key`, **1** |
| key-sourceSlice | 실제 split slice를 `[-999,-998]`로 교체 → `Unexpected sidecar key`, **1** |
| key-missing / key-duplicate | `61 !== 62` / `Duplicate observed sidecar key`, 각각 **1** |
| result-swapped / result-offset | 유효한 두 키에 결과를 잘못 대응 / 삭제 offset+1 → `Sidecar result differs for structural key`, 각각 **1** |
| deleted-text | 생성 종료 후 저장 전 base 본문 p[0]의 이 author 삭제1건 훼손. sidecar 정상·수락5쌍 정상, **최종 package reject에서 1** |
| e6-unregistered / e6-missing-file | 계약에서 실행 pair 제거 / 입력 파일 경로 누락 → 개수 단언 / ENOENT, 각각 **1** |
| e6-single-paragraph | 실제 두 DOCX ZIP의 셀 p2개를 p1개로 병합 → `Alpha Beta→AlphaBeta`, 키별 결과 지문에서 **1**. 정상 입력 배열/웹 입력/각 생성기 입력 단언도 존재. |
| comments-corrupt | 출력 메모 본문 bytes만 변경 → 보존 단언 **1** |
| comments-missing | 출력 메모 part 전체 제거 → **0 (검증 결함)** |

E6 정상 입력은 셀 `['Alpha ', 'Beta']→['Alpha', 'Beta']`다. 웹 입력 `Alpha \nBeta→Alpha\nBeta`의 변경은 `deleted " \n" (5,5)`와 `added "\n" (7,5)`이고, 생성기는 첫 문단 입력 `Alpha →Alpha`에서 `deleted " " (5,5)`, 둘째 `Beta→Beta`는 변경0이다. 정적 계약의 문자열·순서·code point offset을 각각 단언하며 허용 ID를 다른 셀로 넓히지 않았다.

패키지 거부는 5쌍의 실제 생성 ZIP에 대해 별도 stdlib Python으로도 재현했다. [package-audit.json](package-audit.json)에 13 story의 actual/expected와 구조 표식5건을 보존했다. 실제 구조 표식은 base의 **행 삽입1 + 셀 삽입4**이며 이를 제거한 거부 문자열이 기대와 같다. 이를 모든 종류의 구조 revision 검증으로 확대해 주장하지 않는다. before 기대값에는 contract에 명시된 E1 본문3·header/footer/footnote/endnote4 치환만 적용한다. comments.xml은 이 거부 대상에 포함하지 않고 확정2-a의 after bytes 보존으로 따로 판단한다.

**공통 검증 실제 명령**

모든 실행은 [run.py](run.py)가 `source/`를 cwd로, `NODE_OPTIONS=--max-old-space-size=4096`, 전용 `TMPDIR=/tmp/worklazy-dc-review2/tmp`, `npm_config_cache=/tmp/worklazy-dc-review2/npm-cache`를 사용한다. production build 이후 bundle 측정의 내부 build까지 완료한 다음 [check-browser.py](check-browser.py)가 4270 `--strictPort` preview에서 브라우저5종을 직렬 실행했다. `TEST_BASE_URL=http://127.0.0.1:4270`은 wrapper가 설정한다. `browser-word`의 끝 문구는 공통 메시지이며 이번 실행 범위를 전체 Excel/PDF smoke로 잘못 세지 않는다.

| 로그 | 실제 명령 | exit / 출력 |
|---|---|---|
| [build](logs/build.log) | `npm run build` | 0 / production build, 2,834 modules·정적 61페이지 |
| [tsc](logs/tsc.log) | `node node_modules/typescript/bin/tsc -b --pretty false` | 0 / 진단 0 |
| [unit](logs/unit.log) | `npm run test:unit` | 0 / 345 pass / 0 fail / 0 skip |
| [oracle](logs/oracle.log) | `npm run test:document-diff` | 0 / 5쌍55 sidecar·전체 키/지문62·53 match/9 E1·reject 5/13/5·exact4·E6 1·edge8 |
| [static](logs/static.log) | `npm run test:static` | 0 / locale/hreflang/runtime/ads/robots/sitemap·startup104 |
| [browser-word](logs/browser-word.log) | `env TEST_SCOPE=word npm run test:browser` | 0 / Word scope·웹/내려받기/기존 메모 수락·거부 검사 |
| [new-tools-hwp](logs/new-tools-hwp.log) | `env TEST_ONLY_HWP=1 npm run test:new-tools` | 0 / 실텍스트·한영 안내·3,584B/1페이지 편집 왕복 |
| [office](logs/office.log) | `npm run test:office` | 0 / 96 download / 7 cached / DOCX5,088B·Calc 편집 |
| [excel-cleaner](logs/excel-cleaner.log) | `npm run test:excel-cleaner` | 0 / 정리/취소/정규식/광고 DOM/입력 보존 스모크 |
| [excel-compare](logs/excel-compare.log) | `npm run test:excel-compare` | 0 / 비교/내보내기/화면 계약 스모크 |
| [bundle](logs/bundle.log) | `env BUNDLE_MEASURE_OUTPUT=/tmp/worklazy-dc-review2/bundle.json npm run bundle:measure` | 0 / gzip entry299294 / routes2450893 / shared2711698 / app5461885 / CSS37687 |
| [css-orphans](logs/css-orphans.log) | `npm run css:orphans` | 0 / zero-reference selector arms 0 |
| [registry](logs/registry.log) | `node tests/tool-registry-routes.mjs` | 0 / 20개·누락/예상 외/중복0 |
| [diff-check](logs/diff-check.log) | `git --no-optional-locks diff --check 64b5264 a418a3f` | 0 / fix 범위 공백 오류0 |
| [diff-check-full](logs/diff-check-full.log) | `git --no-optional-locks diff --check 5bc6854175331bdd73b267784d9633cdccda8446 a418a3f` | 0 / 기준5bc6854부터 전체 공백 오류0 |
| [package-independent](logs/package-independent.log) | `python3 /tmp/worklazy-dc-review2/audit-packages.py` | 0 / 별도 Python XML 거부 복원13/13·구조 표식5·메모 bytes 교차 확인 |

Bundle 값5종은 sol 제출 기록과 정확히 같다. `bundle:measure`는 이번 명령에서 측정 보고서를 생성한 것이며, 별도 기준 보고서와의 budget delta 게이트를 실행했다고 주장하지 않는다. build의 기존 큰 chunk/eval 경고, Node type-stripping 경고, HWP의 기존 CanvasView 빈 페이지 로그2건은 원출력에 남겼다. 명령 실패를 숨기거나 경고를 제품 결함으로 계산하지 않았다.

**저장소 불변·종료**

`git archive a418a3f` 사본 `/tmp/worklazy-dc-review2/source`에서만 빌드·검증했다. 기존 의존 패키지는 읽기 링크로 사용하고 `.tmp/.vite/.vite-temp/.cache`는 사본 안의 독립 디렉터리다. archive에서도 `git ls-files`를 사용하는 unit을 실행하기 위해 `/tmp/worklazy-dc-review2/git-metadata`에 별도 bare 메타데이터·대상 tree index를 두었으며, 원 저장소 객체는 alternate로 읽기만 했다. 원 저장소 index/refs 변경이나 commit/branch 전환은 없다.

[시작 상태](start-state.json)·[종료 상태](end-state.json)·[불변 검사](immutability.json): 대상 sol worktree의 **추적 파일2395/2395 SHA-256, HEAD, branch, status 모두 동일**. 시작/종료 status는 모두 빈 문자열이다. 제품 파일과 sol worktree·기존 1차 검수 산출물을 수정하지 않았다. 원 `s3-pdf-finish` 워킹트리는 규칙/오프라인 계획서 읽기 외의 작업을 하지 않았으며, 병행 PDF 변경의 정리·복원·검증·전환에 개입하지 않았다. 병행 워킹트리 전체 bytes 불변을 주장하지 않는다.

모든 산출물·변조 fixture·실제 ZIP·보고서는 `/tmp/worklazy-dc-review2/`에만 작성했다. 커밋·push·브랜치 전환 없음. preview 종료 후 **4270~4279 listening socket 0**([기록](ports-final.json)).

**최종 판정: [수정 후 재검수]. F1·F2·E6 해소는 확인되었으며, R2-1(E4 메모 part 누락 미검출)과 이에 따른 기록 보정만 남는다. — Codx**
