**문서 비교 엔진 fix-2 재검수(3차) — Codx**

**[검수 통과] — R2-1 해소, 이번 검수 범위의 잔여 결함 0건.** 2차와 같은 최종 ZIP 제거 반례가 이제 **exit 1 / `commentsPreserved=false`**로 실패한다. bytes 훼손·출력에만 추가·관련 part 3개 각각 제거도 독립 주입으로 모두 실패를 확인했다. F1~F3 회귀 대조와 요구 공통 검증은 통과했다.

대상은 `/tmp/worklazy-dc-impl`, 브랜치 `document-compare-engine-20260907`, HEAD **`4a625489ae2f317d975e0246ffb90e1fd234250a`**다. 2차 대상 `a418a3f26345caf70bf82d10e91f1453460f0417`과 기준 `5bc6854175331bdd73b267784d9633cdccda8446`가 모두 조상임을 확인했다. 실행은 `git archive 4a62548`의 `/tmp/worklazy-dc-review3/source` 사본에서만 수행했다.

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| R2-1: 최종 ZIP `comments.xml` 제거 | **통과** | `python3 run.py probe-comments-missing env REVIEW3_MUTATION=comments-missing node --experimental-strip-types mutants/oracle.mjs`에 해당하는 절대경로 실행 → **exit 1**, `afterPresent=true/outputPresent=false`, `commentsPreserved=false`. 나머지 ZIP **4항목 SHA 불변**. [원출력](logs/probe-comments-missing.log), [독립 확인](package-audit.json). | 없음. 2차의 동일 방식은 exit 0/true였고 이번에는 보존 단언에서 실패한다. |
| bytes 훼손·관련 part 누락 | **통과** | `comments-corrupt`, `extended-missing`, `ids-missing`, `people-missing` 각각 **exit 1**. 훼손 대상 외 4/17/17/17항목 SHA 불변. 아래 음성 대조표. | 없음. `commentsExtended.xml`·`commentsIds.xml`·`people.xml`은 실제 존재하는 revisions pair에서 하나씩 제거했다. |
| 부재 일치·판정 플래그 | **통과** | `comments-added` → exact after에 없는 `comments.xml`을 output에만 추가, **exit 1**, `afterPresent=false/outputPresent=true`, `commentsPreserved=false`. [로그](logs/probe-comments-added.log). 정상 **7쌍 × 4 part = 28행, 존재 7·부재 21**을 실제 ZIP과 대조했다. | 없음. 양쪽 모두 없는 상태는 계약상 성공이며 true가 맞다. 한쪽만 없거나 bytes가 다른 6개 음성 대조에서는 전부 false다. |
| 확정 2-a·3-a 불변 | **통과** | after/tracked 메모 **259B·동일 SHA-256**, before **261B·다른 SHA**. 기존 `trackedComments !== afterComments` 검사와 browser smoke 파일은 기준 커밋부터 bytes 불변이며 Word scope 실행도 exit 0. 기존 계약의 모든 키는 fix-1과 동일하고 새 키 2개만 추가됨. [정적 대조](static-audit.json). | 없음. E4 `comments-multipara:comments-preserved`, E6 `comments-multipara:joined-cell-input` 및 E1~E6 전체 ID/이유·fixture 범위 불변. |
| F1·F2·F3 회귀 | **통과** | 구조 키 `storyPart` 오염 → `Unexpected sidecar key`; 최종 ZIP 삭제 텍스트 훼손 → `base rejected package text differs`; E6 실파일 누락 → ENOENT, 실행 등록 제거 → `0 !== 1`. **각각 exit 1**. [실행표](probe-results.json). | 없음. F2는 sidecar·기존 5쌍 수락 검사가 정상인 채 최종 ZIP 거부 대조에서 실패한다. |
| 변경 범위·공통 검증 | **통과** | `git diff --stat a418a3f..4a62548` → **5파일, +178/−4**, 테스트·계약 fixture·기록만. **제품 코드 변경 0**. tsc·unit345·oracle·build·static·Word/HWP/Office/Excel 2종·bundle·CSS·registry·diff-check 전부 exit 0. [diff](fix2.diff), 아래 실제 명령표. | 없음. 테스트 전용 fix-2이므로 디스패치의 시각 회귀 생략 조건을 적용했다. |
| 기록 보정 | **통과** | `docs/review-notes.md` fix-2 절에 part 누락·bytes 훼손·부재 불일치와 28행/6실행을 명시. fix-1 절은 “output에 part가 있을 때의 after bytes 대조만 보장하고 part 누락은 놓쳤다”로 정정됨. CHANGELOG 검사 보강 한 줄·Codx 서명 확인. | 없음. [정적 대조](logs/static-audit.log). |
| 저장소 불변 | **통과** | 시작·종료 HEAD/브랜치 일치, status 둘 다 clean, **추적 2,395파일 SHA-256 전부 동일**, 대상 `git diff --check` 및 커밋 diff-check exit 0, 종료 후 4270~4279 listening socket 0. [최종 감사](final-audit.json), [시작](state-before.json), [종료](state-after.json). | 없음. 추적 파일 수정·커밋·push·브랜치 전환 없음. |

**자신의 음성 대조와 독립 ZIP 감사**

2차 [prepare-probes.py](/tmp/worklazy-dc-review2/prepare-probes.py)의 저장 직전 ZIP 재작성 방식을 이번 커밋의 oracle에 재적용했다. 기존 `comments-missing`·`comments-corrupt`·`deleted-text` 주입을 유지하고, 검수자가 출력 전용 추가·관련 part 제거를 확장했다. 제품 및 sol의 `DOCUMENT_DIFF_MUTATION` 훅은 사용하지 않았고, 해당 6실행에서 `mutatedPackageParts=[]`도 독립 감사로 확인했다. oracle의 최종 단언은 유지한 채 단언 전에 실제 ZIP와 보고 JSON을 내보냈다.

재현 스크립트는 [prepare-probes.py](prepare-probes.py) → [extend-probes.py](extend-probes.py) → [check-probes.py](check-probes.py) 순서다. 생성된 [oracle.mjs](mutants/oracle.mjs)·[support.py](mutants/support.py), `packages-<probe>/` 실제 DOCX, `<probe>-result.json`을 보존했다. 개별 명령의 전체 stdout/stderr, exit와 시간은 `logs/probe-<probe>.log`·`.json`이다.

```bash
python3 /tmp/worklazy-dc-review3/check-probes.py
# 정상 대조군 exit 0, 음성 대조 10실행 각각 exit 1
python3 /tmp/worklazy-dc-review3/run.py package-independent \
  python3 /tmp/worklazy-dc-review3/audit-packages.py
# exit 0: 실제 ZIP의 28행·부재/bytes·6실행 플래그·다른 part SHA를 독립 대조
```

| probe | 대상·주입 | 실제 실패·exit | 변조 외 ZIP 항목 SHA |
|---|---|---|---|
| `comments-missing` | comments-multipara의 `word/comments.xml` 제거 | `true/false/bytesEqual=null/matchesAfter=false`, **1** | 4항목 동일 |
| `comments-corrupt` | 같은 part의 `After comment body` bytes 훼손 | `true/true/bytesEqual=false/matchesAfter=false`, **1** | 4항목 동일 |
| `comments-added` | exact output에만 `word/comments.xml` 추가 | `false/true/bytesEqual=null/matchesAfter=false`, **1** | 5항목 동일 |
| `extended-missing` | revisions의 `word/commentsExtended.xml` 제거 | `true/false/bytesEqual=null/matchesAfter=false`, **1** | 17항목 동일 |
| `ids-missing` | revisions의 `word/commentsIds.xml` 제거 | 동일 부재 불일치, **1** | 17항목 동일 |
| `people-missing` | revisions의 `word/people.xml` 제거 | 동일 부재 불일치, **1** | 17항목 동일 |
| `key-storyPart` | base 첫 observation의 storyPart만 오염 | `Unexpected sidecar key`, **1** | 결과 구조 키 주입 |
| `deleted-text` | base 최종 본문 p[0]의 생성 삭제 텍스트를 `CORRUPTED_DELETED_TEXT`로 변경 | `base rejected package text differs`, **1** | sidecar 정상·기존 5쌍 수락 정상 |
| `e6-missing-file` | E6 DOCX 입력 경로를 없는 파일로 바꿈 | ENOENT, **1** | 입력 실파일 누락 대조 |
| `e6-unregistered` | E6 실행 pair 및 계약 등록 제거 | `0 !== 1`, **1** | 실행 목록 누락 대조 |

보호 part가 존재하는 7행은 base/comments, split/comments, revisions/comments·commentsExtended·commentsIds·people, comments-multipara/comments다. 나머지 21행은 after와 output 양쪽에 없음을 실제 ZIP에서 확인했다. 정상 comments-multipara after/tracked 메모 SHA-256은 **`ff3c11253aaaf98dd85e451c901eeb5144da2c37a750c7368d336013ed4dc51e`**로 2차 정상 결과와 같다. 누락 반례에서는 입력 after의 메모는 유지하고 최종 output 항목만 제거했다. [package-audit.json](package-audit.json)은 oracle이 보고한 값을 다시 신뢰하는 대신 stdlib `zipfile`로 bytes·항목 목록·SHA를 재계산한 결과다.

검사 위치는 [tests/support/document-diff-equivalence.py:226](/tmp/worklazy-dc-impl/tests/support/document-diff-equivalence.py:226)의 대칭 존재/bytes 대조와 [tests/document-diff-equivalence.mjs:185](/tmp/worklazy-dc-impl/tests/document-diff-equivalence.mjs:185)의 모든 pair/part 단언이다. `commentsPreserved`는 네 행의 `matchesAfter`가 모두 참일 때만 참이다. 기존 보존 테스트는 [tests/browser-smoke.mjs:1736](/tmp/worklazy-dc-impl/tests/browser-smoke.mjs:1736)에 그대로 남아 있다.

**공통 검증 원출력**

모든 명령은 [run.py](run.py)가 사본을 cwd로 삼아 `NODE_OPTIONS=--max-old-space-size=4096`, `TMPDIR=/tmp/worklazy-dc-review3/tmp`, `npm_config_cache=/tmp/worklazy-dc-review3/npm-cache`를 적용했다. 의존성은 lockfile bytes가 같은 2차 검수 사본에서 별도 복사했고 설치·의존 변경은 없었다. Git 의존 검사는 `/tmp` 전용 metadata/index를 사용했다. production build와 bundle 내부 build가 끝난 뒤 [check-browser.py](check-browser.py)가 **4270 `--strictPort`** preview에서 브라우저를 직렬 실행했다.

| 로그 | 실제 명령 | exit·실측 |
|---|---|---|
| [tsc](logs/tsc.log) | `node node_modules/typescript/bin/tsc -b --pretty false` | **0**, 진단 0 |
| [unit](logs/unit.log) | `npm run test:unit` | **0**, 345 pass / 0 fail / 0 skip |
| [oracle](logs/oracle.log) | `npm run test:document-diff` | **0**, 구조 키/결과62, match53/E1 9, reject5쌍/13 story/구조5, 보호28행(7/21), exact4, E6 fixture1, edge8 |
| [build](logs/build.log) | `npm run build` | **0**, 2,834 modules, 정적61페이지 |
| [static](logs/static.log) | `npm run test:static` | **0**, locale/hreflang/runtime/ads/robots/sitemap, startup104문서 |
| [browser-word](logs/browser-word.log) | `TEST_SCOPE=word npm run test:browser` | **0**, Word scope 실제 실행. 마지막 공통 출력 문구를 전체 Excel/PDF smoke 실행으로 세지 않음 |
| [new-tools-hwp](logs/new-tools-hwp.log) | `TEST_ONLY_HWP=1 npm run test:new-tools` | **0**, 실텍스트·한영 안내·3,584B/1페이지 편집 왕복 |
| [office](logs/office.log) | `npm run test:office` | **0**, **95 download / 7 cached / 저장 DOCX 5,089B**, Korean Calc 편집 |
| [excel-cleaner](logs/excel-cleaner.log) | `npm run test:excel-cleaner` | **0**, 정리·취소·정규식 watchdog·입력 보존·모바일 overflow0 |
| [excel-compare](logs/excel-compare.log) | `npm run test:excel-compare` | **0**, 비교·내보내기·화면 계약 |
| [bundle](logs/bundle.log) | `BUNDLE_MEASURE_OUTPUT=/tmp/worklazy-dc-review3/bundle.json npm run bundle:measure` | **0**, gzip entry299294 / routes2450893 / shared2711698 / app5461885 / CSS37687 |
| [css-orphans](logs/css-orphans.log) | `npm run css:orphans` | **0**, zero-reference selector arm0 |
| [registry](logs/registry.log) | `node tests/tool-registry-routes.mjs` | **0**, 20개·누락/예상 외/중복0 |
| [diff-check](logs/diff-check.log), [커밋 diff-check](logs/commit-diff-check.log) | `git diff --check`, `git diff --check a418a3f..4a62548` | 각각 **0**, 원 대상 worktree에서도 종료 시 재실행 |

Office의 download 상태 수와 저장 크기는 sol 보고의 96/5,088B와 달리 이번에 95/5,089B로 관찰됐다. 스모크의 편집·저장 검증은 통과했으며 실측을 그대로 기록했다. HWP의 기존 빈 fixture를 여는 `[CanvasView] 페이지 0 정보가 없습니다` 2줄도 원출력에 보존했고 뒤의 저장·재파싱·재개방은 통과했다. bundle 5종은 sol 및 2차 수치와 정확히 같다.

**실행 게이트·기록 범위**

첫 행동은 원 저장소 `PROJECT_RULES.md` 전문 선독이었다. 이후 대상 AGENTS, 2차 보고/누락 로그/ZIP 감사, fix-2 지시서와 sol 보고·음성 대조 로그, review3 지시서를 읽었다. 대상 worktree와 archive에는 미추적 `docs/jobs/todo`가 없으므로, 원 워킹트리 접근 금지를 지켜 **4차 정본 확인 때의 보존 사본**에서 v3 확정 2-a·3-a와 전체 정본 절을 읽고, 2차 열린 계획서 검색 기록·현재 디스패치를 대조했다. 현재 원 워킹트리의 계획서들을 새로 스캔했다고 주장하지 않는다. 입력 경로·SHA 및 제한은 [gate.json](gate.json)에 보존했다. 이 검수는 이미 지정된 테스트 전용 fix-2에 한정되며 UI 이관이나 병행 PDF/Excel 작업의 코드를 변경하지 않았다.

검수용 정적 대조 첫 실행은 전용 `GIT_DIR` 환경을 상속해 사본 metadata에 없는 S3 ref를 조회하면서 exit128이 났다. [실패 원출력](logs/static-audit-attempt1.log)을 보존하고, 읽기 전용 ref 조회에만 해당 환경변수를 제외한 뒤 같은 감사를 exit0으로 재실행했다. 제품/테스트 결함이나 검사 완화는 아니다.

보고·실험 파일은 전부 `/tmp/worklazy-dc-review3/`에만 기록했다. sol worktree는 읽기와 상태/SHA 대조만 수행했으며 원 워킹트리·`/tmp/worklazy-xr`·`/tmp/worklazy-xc-r1`은 실험·빌드·탐색 대상으로 삼지 않았다. 저장소의 CHANGELOG·review-notes 추가 편집은 하지 않았다. [final-audit.json](final-audit.json)은 필수 명령 종료값, 모든 음성 대조 기대값, 포트 종료, 2,395파일 불변을 모두 단언한 최종 결과다.

**배포 후보 조건:** 기준 `main=5bc6854175331bdd73b267784d9633cdccda8446`에서 분리한 `4a62548`은 재검수·공통 검증을 충족했으며, S3 커밋 `c8bff1f`와의 실측 교집합 **`CHANGELOG.md`·`docs/review-notes.md`·`package.json` 3개를 파일별 병합**하고, 문서 비교의 최종 로컬 시각 게이트·보고 후 선배포 → S3가 최신 main을 병합해 자체 게이트를 재통과하는 순서의 **배포 후보**다.

교집합은 다른 worktree에 접근하지 않고 고정된 Git 커밋들의 변경 목록으로 계산했다. 정본의 예상 `browser-smoke`는 이 브랜치에서 기준 대비 변경0이고, 대신 `package.json`의 oracle 명령 추가가 실제 교집합에 포함된다. S3 미커밋 변경은 이번 접근 금지 범위이므로 병합 시 최신 해시·교집합을 다시 확인해야 한다. 본 판정은 브랜치 검수이며 병합·배포 및 Gemini/Claude의 최종 시각 게이트 완료를 대신 선언하지 않는다.

**[검수 통과] — Codx**
