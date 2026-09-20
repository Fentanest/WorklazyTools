# 문서 비교 정본 v3 확인 라운드 3차 (Codx)

**Q1~Q3 판정은 모두 수용한다. 정본 반영·실행 문안 잔여는 3건(R3-1~R3-3)이다. 현재 문서에 대해 [정본화 가능]을 선언하지 않는다.**

기준 문서: `docs/jobs/todo/document-compare-granularity-20260907.md`의 「정본화 (2026-09-07 11:55, v3)」, 88~136행. 문서 행 번호는 [검토 시점 사본](sources/document-compare-granularity-20260907.md) 기준이다. [최소 보완 문안](CANONICAL-AMENDMENTS.md)을 별도 작성했으며 저장소 정본에는 적용하지 않았다.

## 실행 성격·기준

첫 행동으로 `PROJECT_RULES.md` 전문을 읽었다. `AGENTS.md`, 3차 디스패치, v3·v2, 2차 AMENDMENTS/REPORT, UI 계획 §6-B, 관련 기각 이력과 열린 계획서 18개를 확인했다. 이 라운드는 읽기·경량 재현이며 구현 착수가 아니다. 서브에이전트, 빌드, 브라우저, 설치, 서버 기동은 사용하지 않았다.

- `main = 5bc6854175331bdd73b267784d9633cdccda8446`, 정본의 현재 기준값과 일치.
- 시작 `HEAD = 002732a7d79b0a0a5851bf2e20ccdd83d6bdedfc`, branch `s3-pdf-finish`. main과 다른 것은 지시서에 명시된 병행 S3 작업 때문이다.
- 엔진·worker·결과 렌더러 등 확인 표면 8개는 `git show <main>:<path>`로 `/tmp/worklazy-dc-r3/main-slice/`에 복사했고 현 워킹 파일과 **8/8 byte-identical**했다. 실제 코어 검증은 이 고정 사본을 실행했다. [증거](main-source-check.json)
- 사용자 DOCX와 `newui/`는 읽거나 수정하지 않았다. 추적 파일 변경·커밋·push·브랜치 전환·worktree 추가는 수행하지 않았다.

## 1. A~E 문장 단위 반영 — [보완], 잔여 3건

원문 행 번호는 [2차 AMENDMENTS](sources/round-2-AMENDMENTS.md), 이관 대상은 [UI 계획](sources/ui-theme-redesign-20260907.md)이다. 같은 잔여를 아래 다른 항목에서 재언급해도 중복 계산하지 않는다.

|2차 문장군|v3 또는 UI §6-B 대응|판정|
|---|---|---|
|A 7: 동일 문자열, 토큰 정규식, 행/열, 점화식, 역추적 tie-break, 뒤집기·인접 병합, 정규화/타입 정렬 금지|v3 103|[동의] 보존. 현행 골든 97/97 실제 일치|
|A 9: **토큰 수**로 1.5M 셀 계산, 빈 guard 항목 보존, XML만 skip|v3 104|[보완] Q1 결정은 맞으나 `beforeTokenCount/afterTokenCount`를 `before/after`로 축약하여 단위가 사라짐. **R3-1**|
|A 11: 정적 JSON/unit 위치, 97=27+68+2, 자기 생성/사용자 문단 커밋 금지|v3 105|[동의] 누락 없음|
|B 15: worker 동기 전역 주입 순서·JSON 값 수신·PyProxy·fallback 금지·현지화 실패|v3 108|[동의] 보존|
|B 17: `_paragraph_revision` 입력, code point cursor, tab/br/cr, 빈 run, surrogate, 마지막 길이와 기존 분기|v3 109|[동의] 보존|
|B 19: 문장 diff만 변경, 정렬 SequenceMatcher 보존, 추출 의존 폐쇄·31개 제거·80건·raw import|v3 110~111|[보완] 동작 계약은 보존. `pruning.json`을 **1차 산출**로 잘못 표기. **R3-2**|
|B 21: after comments bytes 보존·활성 story 범위·웹 메모 유지·내려받기 메모 diff 제외|v3 112|[동의] Q2 수용. author만 예외로 두던 결함 해소|
|C 25: 동일 입력 1:1 문단/단일 문단 셀만 정확 일치|v3 115|[동의] 전체 동치 주장 삭제. 4키+5쌍 표본은 v2 R4 73행에 존속. sidecar 검사와 전체 패키지 수락/거부 구분 문장도 v3에 직접 옮기는 편집 보강을 권고|
|C 27: sidecar 부모 인덱스/경로·location/호출번호 금지·source slice·property/문단 표식 분리·run 병합·offset 음성 대조|v3 116|[동의] 보존|
|C 29·31: E1~E6 명시 fixture 예외·동일 문단 수 셀 반례·E2/E6 제외·전체 통일 별도 설계|v3 117·133|[동의] Q3 수용. 모든 표를 예외로 확대하지 않음|
|D 35: React 단일 구조, DOM nav 우선, x-scroll 형제, mobile 비추종, DOM 이동/복제 금지|v3 123 원문 채택 + UI 90·92|[동의] 원문 계약으로 이관|
|D 37: rail 폭/간격/80px/940px, 529px 정정, mobile grid·toolbar|UI 91~93|[동의] 보존. 613px을 최종 열 폭으로 재사용하지 않음|
|D 39: 부모 상태 유지·index 초기화·key 범위·resize focus·처음/끝/1건/0건 동작|UI 95 + 원문 D 39|[동의] 요약의 “경계 disabled”가 원문 1건 규칙을 폐기하지 않음|
|D 41: ARIA header row/유효 cell/내부 table 유지·focusable region·ArrowRight·겹침·본문 selector|UI 94 + 원문 D 41|[동의] ArrowRight/셸 겹침 등 요약에 없는 상세도 원문 채택으로 보존|
|E 45: 공용 진입 helper, 합성 fixture 수, 실제 업로드, output web-only/metadata on, context 재업로드, timeout/settle|UI 96 + 원문 E 45|[동의] output/metadata/context 세부는 요약 대신 원문에서 유지|
|E 47: a11y result 3 ID, profile/theme summary, rendering phase·raw shifts·scroll/resize·3 runs|UI 96 + 원문 E 47|[동의] LCP 오명명 금지·theme summary·raw shifts·3 runs도 원문에서 유지|
|E 49: S3 공통 파일 9개·등록/기대 목록 함께 병합·CLS 0.1 유지|v3 127, UI 원문 E|[동의] 엔진만의 현재 교집합 3개 재현. UI 등록 수 11/4→14/7은 당시 기준 수치이며 착수 때 재산출|
|E 51: production→QA·직렬 4096·정상 checkout·캐시 격리·baseline 제한·HWP/ko/en/SEO/광고 검토|v3 120·124·127·130|[반박: 증거] HWP 안내 교체를 유지하면서 “UI 변경 0”을 근거로 QA/시각 확인을 축소함. **R3-3**. checkout/직렬/전체 unit는 유지|

**D/E 이관 판정:** UI §6-B 요약에 모든 문장이 반복되지는 않는다. 그러나 v3 123행이 D·E 원문을 “그대로 채택”하고 UI 90행이 그 문안 원문을 W5에 포함하므로, 참조된 원문까지 읽는 계약에서는 손실이 없다. 위 표에 원문에만 남은 상세를 분리했다. 원문 참조를 제거하거나 U1~U6 요약만 sol에 디스패치하면 이 판정의 전제가 사라진다.

## 2. Q1·Q2·Q3 판정 — [동의], 이 세 선택의 잔여 0건

|판정|확인 결과|근거|
|---|---|---|
|Q1|코어 guard의 빈 항목 보존, XML 어댑터만 skip으로 확정. 공용 API의 별도 정규화는 제외|`core-check.mjs`: `diffText('', 'a '.repeat(750000))` → deleted 길이 0 / added 길이 1,500,000. R3-1은 이 결정의 재논의가 아닌 가드 **단위 표기 복원**|
|Q2|`word/comments.xml` after bytes 보존, 웹 메모 diff 존속, 내려받기 메모 diff 제외로 확정|`tests/browser-smoke.mjs:1736`의 `trackedComments !== afterComments` 실패 계약과 일치. [명령/출력](logs/smoke-scope.txt)|
|Q3|동일 입력의 revision 없는 1:1/단일 문단 셀로 한정. E2/E6은 명명된 회귀 fixture 예외|현행 코어 재실행: `Alpha \nBeta→Alpha\nBeta`는 del ` \n`+ins `\n`; 첫 문단만 비교하면 del ` `, [결과](core-results.json). 문단 수가 같은 셀에서도 입력 범위 차이는 남음|

2차 생성 DOCX oracle를 다시 읽어 **4/4 키의 문자열·양쪽 code point offset·순서 일치**, offset을 1 옮긴 음성 대조의 실패를 확인했다. [재현 로그](logs/oracle-artifact-check.txt), [결과](oracle-artifact-results.json). 이것은 **기존 2차 산출의 재검사**이며 v3 worker 구현/통합 완료 증거로 사용하지 않는다.

v3 사용자 결정 3·4의 가로 스크롤/ARIA 승인을 수용하고 결정 5에 따라 UI 계획으로 이관한다. 이 두 승인을 다시 요청하지 않는다. UI 관찰의 추가 스크린샷 대조를 엔진 착수의 새로운 승인 게이트로 만들지 않는다. 공용 단어 코어 선택에도 이견이 없다.

## 3. 엔진 범위 축소의 부작용 — [반박: 증거], R3-3 1건

### (a) 화면 영향·시각/a11y/rendering

**DOCX 성공 경로:** `word.worker.ts:109~118`은 웹 모델을 먼저 계산하고, 119~138행의 선택적 내려받기 경로에서 생성기를 호출한다. 공용 TS diff 출력과 추출기가 동치로 유지되면 웹 diff 세그먼트·결과 DOM의 변경은 필요 없다. 내려받는 DOCX 안의 revision 입도는 바뀌지만 이것만으로 웹 ARIA나 rail 구조를 바꿀 이유는 없다. [명령/출력](logs/worker-errors.txt)

**실패 경로:** 새 bridge 오류는 worker catch → worker client reject → `DocumentComparePage`의 `comparisonErrorMessage` → 기존 오류/진행 표시로 전달된다. 따라서 “화면에 전혀 노출되지 않는 변경”은 아니다. 다만 기존 ko/en 메시지를 재사용하는 계약이라 신규 문구·DOM·a11y/rendering 등록이 필수인 것은 아니다. 실제 bridge 실패의 현지화·원시 예외 비노출은 검증해야 한다. 현행 worker의 `/import/` 오류는 다운로드 안내로 분류될 수 있으므로, 이 검토는 새로운 세부 오류 문구를 약속하지 않는다.

**HWP 안내:** `hwp-compare.worker.ts:137~138`은 모든 추출 모델에 현재 warning을 넣고 `WordCompareResultPage.tsx:134`가 `UtilityNotice`로 직접 렌더한다. 실제 기존 `interaction-hwp-result` 시각 시나리오도 HWP 업로드→비교→결과 진입을 수행한다. 따라서 안내 교체는 기존 결과 DOM의 텍스트/줄바꿈/높이에 영향을 줄 수 있다. [재현 명령/출력](logs/warning-ui.txt)

결론:

- 신규 결과 a11y/rendering **등록**과 폭·rail·ARIA 수리를 이관한 것은 동의한다. 기존 전체 결과 axe 71/72 위반을 이번 엔진 작업에서 0으로 만들라는 요구도 추가하지 않는다.
- “UI 변경 0이므로 시각 기준선 갱신은 무조건 범위 밖”, “QA 재빌드 생략 가능”은 근거가 성립하지 않는다. HWP 문구 표본 확인과 기존 시각 상태의 실제 차이 검토는 남는다. 이번에 PNG가 실제 몇 장 바뀌는지는 브라우저를 돌리지 않아 측정하지 않았다.
- 「배포 전 로컬 시각 검수」는 **UI에 영향을 주는 변경**을 대상으로 하고 추적 없는 로컬 빌드를 요구한다. `localQa.ts`와 Analytics/AdSense loader는 `VITE_LOCAL_QA=1`을 추적 차단 조건으로 쓴다. v3에는 그 대안 절차가 없다. 정본의 QA 생략 문장을 고치고 기존 HWP 결과를 좁게 확인하면 된다. [규칙·코드 증거](logs/qa-gate.txt)

### (b) `TEST_SCOPE=word`만으로 충분한가

**단독으로는 부족하지만 v3의 최종 명령 목록은 단독으로 한정되어 있지 않다.** `browser-smoke.mjs:63~64`의 word scope는 `testWordCompare`만 호출한다. 이 함수는 실제 worker 다운로드·XML 구조/서식/번호/메모·수락/거부 검사를 실행하므로 연결 회귀에는 적절하다. 하지만 기존 문장 입도·offset 정확 일치나 HWP 실텍스트 변경을 전부 검증하지는 않는다.

v3 130행이 골든 97, 별도 동치 oracle/음성 대조, HWP 신규 fixture, 전체 browser/office/Excel 스모크를 함께 요구하므로 검증 범위는 유지된다. 단, 괄호에 “입도 변경”을 적는 것으로 현재 Word 스모크에 그 단언이 자동 추가되는 것은 아니다. sol은 새 oracle를 실제 실행 경로에 편입하고 실행 명령·출력을 보고해야 한다. HWP 현재 스모크는 결과 페이지 진입 뒤 편집기로 넘어가므로, 신규 fixture에서는 변경 문자열·본문 복원·ko/en warning 단언까지 추가해야 한다. [현재 스코프와 HWP 검사 종점](logs/smoke-scope.txt)

이 라운드는 테스트 계획 검토다. production build/unit 전체/브라우저를 실행했다고 주장하지 않는다.

### (c) ko/en·SEO·정적 산출·광고

현재 warning은 worker의 inline `L(ko,en)` 한 쌍이며 `src/locales/*/*.json` 키를 통하지 않는다. 확정 4가 두 언어 문안을 모두 지정했으므로 이 쌍을 함께 바꾸면 현지화 범위는 맞다.

현행 문서 비교 SEO/FAQ는 입력 형식, Word↔HWP 비교 제한, DOCX 전용 추적 파일, 본문/표/서식 비교를 설명하며 새 안내와 상충하지 않는다. 정적 생성기는 `src/app/seo.ts`를 읽고 worker warning을 가져오지 않는다. 이 문구 교체만으로 SEO/FAQ·route·sitemap 정적 **본문**을 수정할 필요는 없다. worker 소스 수정에 따른 번들/hash 변경은 발생하므로 “정적 산출물의 모든 바이트 불변”을 뜻하지 않는다. [검색·생성기 증거](logs/seo.txt)

새 npm 의존·네트워크 전송·route·광고 loader/격리 경계 변경은 계획에 없다. 해당 경로 변경 불필요 판단을 작업 기록에 남기고 production `test:static` 등 기존 검증을 보존한다. HWP 안내를 locale JSON으로 임의 이관하거나 SEO 문구를 불필요하게 바꾸면 S3와의 교집합을 다시 계산해야 한다.

## 4. 실행 게이트 — [동의], 독립 잔여 0건

재현 명령:

```bash
python3 /tmp/worklazy-dc-r3/audit.py
```

[실제 출력](logs-audit.txt), [두 집합·교집합](merge-surfaces.json), [열린 계획서 검색](open-plan-scan.txt).

현재 예상 엔진 파일군과 `git diff main..s3-pdf-finish --name-only`의 교집합은 정확히:

1. `CHANGELOG.md`
2. `docs/review-notes.md`
3. `tests/browser-smoke.mjs`

계산에는 HWP worker·new-tools 스모크·골든·기존 alignment unit와 Q3 후속을 남길 `docs/backlog.md`도 포함했다. 단계 종료 시 실제 구현 diff로 다시 계산해야 하며 위 예상 집합을 미래에도 고정된 사실로 사용하지 않는다. 현재 staged/unstaged 교집합은 **0**이다. UI 하네스 6파일을 엔진 변경 목록에서 빼면 기존 9개에서 3개로 줄어드는 정본 설명은 맞다. 기존 HWP PNG를 갱신하더라도 현재 S3 변경은 PDF PNG이므로 현재 교집합이 늘지 않지만, 실제 파일 목록으로 확인해야 한다.

열린 문서 검색 결과: PDF 계획의 browser smoke 변경과 문서 비교 변경은 같은 파일의 다른 기능이며 파일별 병합 대상이다. UI §6-B는 엔진 코어 변경을 지시하지 않는다. 오래된 P2/shadcn 문서는 완료 이력이고 최신 UI 이관 결정을 뒤집는 열린 상반 지시로 판정하지 않았다.

착수 시 절차는 다음처럼 구체화할 수 있다. 아래 명령은 **이번 라운드에 실행하지 않았다**.

```bash
# 원 워킹트리에서는 조회만 한다.
git status --porcelain=v2 --branch
git rev-parse HEAD main
git worktree list --porcelain
git diff 5bc6854175331bdd73b267784d9633cdccda8446..main --name-only
```

main이 바뀌면 해당 diff와 열린 계획서/변경 파일의 영향을 기록한 뒤 Claude가 착수 정본의 기준 SHA를 재고정한다. 단순히 최신 SHA 문자열만 덮어쓰면 기준 해시 게이트를 통과한 것이 아니다. 최신 SHA가 확정된 뒤 그 값을 직접 사용한다.

```bash
# 아래 경로/브랜치가 아직 없음을 확인한 뒤 실행할 구현 단계 예시.
git worktree add -b document-compare-engine-20260907 /tmp/worklazy-dc-impl <재고정한-main-SHA>
git -C /tmp/worklazy-dc-impl rev-parse HEAD
git -C /tmp/worklazy-dc-impl status --porcelain=v2 --branch
```

worktree 경로는 저장소 바깥에 두고 원 `s3-pdf-finish`에서 checkout/switch/reset/stash/clean을 하지 않는다. 정식 worktree는 `.git` 의존 unit를 실행할 수 있다. node_modules 전체 symlink는 공유 `.tmp/.vite/.vite-temp` 캐시 쓰기를 유발할 수 있으므로 사본 설치 또는 의존 항목별 링크와 사본 전용 캐시를 사용한다. 빌드/브라우저는 그 worktree에서 직렬 4096으로 실행한다. 원본 cache나 `dist/`를 치우지 않는다. stale worktree prune도 이 작업에 필요하지 않다.

push 전 사용자 보고·Codex 커밋/push 담당·S3 후행 병합과 자체 게이트 재실행은 유지한다. 이번 검토는 배포 실행 또는 새로운 승인 요청이 아니다.

## 5. sol 재해석 잔여·수정 제안 — [보완], 총 3건

|ID|문서 위치|증거와 필요한 결정/수정|
|---|---|---|
|R3-1|v3 104, 확정 1-a|가드의 `before/after`가 문자열인지 길이인지 토큰 수인지 불명확. A 9의 정확한 `beforeTokenCount/afterTokenCount`로 복원해야 함|
|R3-2|v3 111, 삭제 목록|`pruning.json(1차 산출)`은 존재하지 않음. 실제 2차 파일의 저장소 내 전체 경로를 고정해야 함|
|R3-3|v3 120·124·127·130|HWP 화면 문구 변경과 “UI 변경 0/QA 생략” 충돌. UI 구조 이관은 유지하고 문구 변경의 ko/en·시각/QA 검증 범위를 명시해야 함|

**R3-1 재현:** before=`'a'.repeat(1500)+' tail'`, after=`'b'.repeat(1500)+' tail'`은 토큰 셀 **16**, 문자열 길이 셀 **2,268,036**이다. 현행 출력은 deleted 1500 + added 1500 + **equal ` tail` 5자**다. 문자열 길이로 가드하면 전체 교체가 되어 현행 계약과 달라진다. 단위가 구현상 무의미한 약어는 아니다. [실행 코드](core-check.mjs), [출력](logs/core-check.txt)

**R3-2 재현:** jobs 원문 아래 `pruning.json`은 `probes-r2/pruning.json` 한 개이고 probes-r1에는 없다. 이 파일과 `/tmp/worklazy-dc-r2/pruning.json`은 byte-identical. main의 Python 정의 48개를 AST로 읽어 removed 31 + keep 17이 정확한 분할임을 재확인했다. [실행 코드](audit.py), [실측 경로·SHA](pruning-source-check.json)

**R3-3 재현:** source warning → `UtilityNotice` → 기존 HWP 결과 시나리오, QA 플래그 → 분석/광고 loader 차단, PROJECT_RULES 「배포 전 로컬 시각 검수」를 함께 대조했다. 기존 UI 수리를 엔진 범위로 되돌리는 제안이 아니다. [최소 교체 문안](CANONICAL-AMENDMENTS.md)

문서 우선순위의 “뒤가 앞을 정정” 방향 표기, C의 4키/5쌍 설명 재삽입, UI 원문 채택 문장 강조는 편집 보강이며 추가 이견으로 계산하지 않았다. 선택이 이미 확정됐거나 다른 명시 문장으로 현재 의미가 복원되기 때문이다.

## 실제 경량 검증·한계

|명령|결과|
|---|---|
|`python3 /tmp/worklazy-dc-r3/audit.py`|exit 0; main/working 표면 8/8 동일, 공통 3파일, working overlap 0, 삭제 31/보존 17, 근거 로그 6개|
|`NODE_OPTIONS=--max-old-space-size=4096 node --experimental-strip-types /tmp/worklazy-dc-r3/core-check.mjs`|exit 0; 골든 97/97(27/68/2), 동일 입력 2건, 빈 guard/단위 반례/Q3 셀 입력 차이 재현|
|`python3 /tmp/worklazy-dc-r3/oracle-artifact-check.py`|exit 0; 2차 DOCX 4키 재검사 4/4, offset 음성 대조 실패 확인|

이번에 pyodide bridge/추출 80건을 새로 실행하지 않았다. 2차의 80/80은 과거 실측으로만 인용하고, 이번에는 삭제 목록의 존재·출처·AST 분할을 검증했다. user 문서 메모리 재현, 실제 v3 worker 연결, production build, 전체 unit, HWP/Word browser, 시각 기준선 갱신, 최종 배포 게이트는 **구현 이후 실행해야 할 작업**이다. 이번 라운드에서 브라우저가 불필요하다는 지시와 향후 HWP 문구 변경의 시각 검수가 필요하다는 판정은 적용 시점이 다르다.

## 저장소 상태와 마지막 선언

시작/종료 `git status`·HEAD/branch·추적 파일 SHA-256은 [start-state.json](start-state.json), [end-state.json](end-state.json), [비교](state-comparison.json)에 보존한다. 모든 신규 산출물은 `/tmp/worklazy-dc-r3/` 안이다. 저장소 추적 파일·jobs 정본·커밋·push·브랜치 상태를 직접 변경하지 않았다.

|상태|시작→종료|판정|
|---|---|---|
|branch|`s3-pdf-finish` → 동일|전환 없음|
|main|`5bc6854175331bdd73b267784d9633cdccda8446` → 동일|기준 변동 없음|
|HEAD|`002732a7d79b0a0a5851bf2e20ccdd83d6bdedfc` → `c8bff1fd1ab64f89afb7240778e0a373c953d1a3`|병행 S3 커밋 2건|
|추적 파일 SHA|2,587개 중 2,584개 동일; `tests/pdf-finish-smoke.mjs`·`CHANGELOG.md`·`docs/review-notes.md` 3개 변경|병행 커밋의 변경 파일 집합과 정확히 일치|
|문서 비교 확인 표면·검토 문서|제품 표면 8/8 동일, 검토 문서 4/4 동일|이 검토의 대상 불변|
|staged/unstaged·미추적|추적 working 변경 0; 기존 미추적 DOCX 2개·네이버 HTML·`newui/` 그대로|S3 작업과 사용자 파일을 건드리지 않음|

병행 커밋은 `520ba4a test(pdf): inject finish chunk recovery failure`와 `c8bff1f docs(pdf): record finish F1 implementation gates`다. 종료 상태 확인 중 두 번째 커밋을 발견해 종료 SHA·상태·교집합을 다시 기록했다. [git log 원출력](logs/concurrent-commits.txt). worktree 목록의 차이는 원 worktree HEAD 값뿐이며 경로/branch 목록은 같다. 전체 저장소가 시간상 불변이었다고 주장하지 않고, SHA 차이와 병행 커밋의 일치를 보고한다. 종료 HEAD에서도 엔진 교집합은 3개로 같다([종료 교집합](merge-surfaces-end.json)).

**Q1~Q3 선택 이견 0. v3 문안·실행 게이트 잔여 3건. Claude–Codex 간 이견 0에 아직 도달하지 않았으므로 [정본화 가능]을 선언하지 않는다.** 세 최소 보완의 정본 반영 확인 전 sol 구현 착수는 보류 판정이다.

— Codx
