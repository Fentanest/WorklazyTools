최종 통합 후보 검수 — adsense-recheck-20260919 / WU4

검수자: Astra. 검수일: 2026-09-20 KST. Claude 감사·최종 판정에 제출하는 기술 검수이며, 통합·배포 승인이 아니다.
대상: `/tmp/wl-adsense/review/final-src`, detached HEAD `c53cadcd877215c7a9a0a7398b44c19f0bfc1d93`, 기준 `29fe72c`.
아래 저장소 상대 경로는 이 worktree 기준이다. 작업 문서는 `docs/jobs/todo/adsense-recheck-20260919/`를 `JOB/`, 통합 증거는 `/tmp/wl-adsense/integration/`을 `INT/`로 표기한다.

**판정: 신규 차단 결함 없음. WU2 기존 차단 3건 해소. 구현·검증 완료, 운영 미반영 상태는 아래 제한을 보존하는 범위에서 성립한다.**
WU1은 이전 적합 판정과 후속 제출을 재사용하고 재검수하지 않았다. 이번 독립 실행은 Git/Node/Python 읽기 검증, 허용된 단위 검사, 기존 캡처 표본 열람에 한정했다. npm ci, build, test:ads, 브라우저 서버 기동은 시도하지 않았다. F(`.agents/skills/worklazy-scoped-verification/SKILL.md`)를 적용했다.

**1. [비차단] 시작 상태·계보·통합 정합 — 새 실행**

시작 기록:

```text
$ git -C /tmp/wl-adsense/review/final-src status --short
(출력 없음, exit 0)
$ git rev-parse HEAD
c53cadcd877215c7a9a0a7398b44c19f0bfc1d93
(exit 0)
```

요청 명령 `git log --format='%h %p %s' 29fe72c..HEAD`의 실제 출력:

```text
c53cadc 5d6eca9 docs: correct adsense recheck evidence records
5d6eca9 3f29a4a 97739d5 Merge branch 'work/adsense-adtest-20260919' into integration/adsense-recheck-20260919
97739d5 c40c2eb test(ads): S5 render-error injection, S6 pdf-root, status buckets
3f29a4a 5ae29f9 docs: record adsense recheck integration outcomes
5ae29f9 cd53c2a chore(integration): allowlist WU2 ad smoke files in ad-reference audit
cd53c2a ffd49f4 chore(integration): restore package manifest newline
ffd49f4 584b7a0 c40c2eb Merge branch 'work/adsense-adtest-20260919' into integration/adsense-recheck-20260919
584b7a0 73cdb27 fix(guides): require explicit pathFaqs for shared guide keys
c40c2eb 7bfcf7c test(ads): unify docCommits key across all smoke result cases
7bfcf7c 81b3fa1 test(ads): record CDP document commits and S10 ad counters in smoke results
81b3fa1 a48121a test(ads): add ad-eligibility state-transition smoke (S1-S10) and test:ads script
a48121a 29fe72c fix(ads): reconcile ad eligibility on subscribe so pre-consented lazy routes load ads
73cdb27 da3f3ba chore(repo): archive internal work artifacts
da3f3ba 1d63027 chore(repo): stop tracking generated evidence
1d63027 bc252d3 fix(guides): validate and publish audited guide content
bc252d3 29fe72c fix(guides): connect PDF OCR route FAQs
```

`git rev-list --count --merges 29fe72c..HEAD` → `2`. 두 제출 브랜치 원래 커밋이 조상으로 보존되고 통합 전용 비병합 커밋도 지시된 조정·기록뿐이다. cherry-pick으로 복제한 이력은 없다.

Python 읽기 스크립트에서 세 `git diff --name-only` 결과를 집합 비교했다:

```text
29fe72c..584b7a0 = 148파일(WU1+WU3)
29fe72c..97739d5 = 4파일(WU2)
통합 전용 = CHANGELOG.md, docs/backlog.md, docs/review-notes.md,
             tests/unit/app-shell.test.ts (4파일)
29fe72c..HEAD = 156파일
missing=[], unexpected=[]
```

- `git diff 584b7a0 HEAD -- <위 148파일>` → 빈 출력. WU1 소유 9파일과 WU3 추적 해제·ignore 변경까지 모두 보존.
- `git diff 97739d5 HEAD -- tests/ad-eligibility-smoke.mjs tests/helpers/ad-stub.mjs src/components/AdSenseLoader.tsx` → 빈 출력.
- `git diff 97739d5 HEAD -- package.json` → 마지막 개행 복원만. scripts·의존성 변형 없음.
- `git diff 29fe72c HEAD -- tests/unit/app-shell.test.ts` → 소유자 주석이 붙은 WU2 검사 파일 2개 허용목록 추가만(:57, :60). 비교 로직·기대 조건 하향 없음.
- `git diff --check 29fe72c..HEAD` → exit 0.

**2. [비차단] WU2 차단 3건 해소 — 코드 분석 + 제출 실행 재사용**

(a) S5: `tests/ad-eligibility-smoke.mjs:537`의 주입은 QrBulkPanel 렌더 표현식에 플래그 조건 throw를 넣는다. 정상 QR 화면에서 script=1·loads=1·attempt=1·초기 docCommits=1·bulk 미요청을 먼저 단언(:564). `state.transform`을 설정하고 플래그를 켠 뒤 실제 bulk 탭을 클릭(:574)한다. 경계 대기 후 URL 불변·docCommits=1·routeError≥1·새 스텁=0·loads=1을 단언(:603), 잔류 태그를 기록(:621)한다. 잔류 태그가 1이어야만 성공하도록 강제하지 않는 것은 PLAN의 “잔류 여부 기록” 요구와 맞다.

최종 JSON `INT/visual-artifacts/adsense-recheck/ad-smoke-results.json:3423`과 Muse 사본 모두 S5=pass, URL 불변, docCommits 1, attempt/stub/blocked/allowedExternal=1/1/2/0, loads=1, stubAdded=0, residualScriptTags=1이다. 통합 주입 chunk는 `QrBulkPanel-DvQKNB0p.js`, 앵커 1개, 원문 26033 → 응답 26124(+91), HTTP 200. `INT/build.log:302`의 통합 chunk명과 같다. 원래 Muse 빌드의 `QrBulkPanel-B12wkdUX.js`와 구분된다.

`JOB/WU2-REPORT.md:59`, `JOB/WU4-REPORT.md:63`, `docs/review-notes.md:11`, JSON method에 주입 재현임이 명시돼 있다. 실제 import 실패나 실제 광고 검증으로 표현하지 않는다. `INT/visual-artifacts/adsense-recheck/S5-error.png`를 이번에 직접 열어 오류 화면과 다시 시도 버튼을 확인했다. 문서 동일성과 잔류 태그 수는 캡처가 아니라 위 단언·JSON 근거다. 제품의 잔류 광고 처리 정책은 PLAN §4-3 제외 범위로 유지된다.

(b) S6: `tests/ad-eligibility-smoke.mjs:287`은 허용 화면의 script=1 확인 후 `.sidebar a[href="/<lang>/tools/pdf-editor"]`를 실제 클릭(:300)한다. KO/EN PDF root가 moves에 모두 포함(:350, :352)되고, 새 CDP 문서 커밋 정확히 1·새 script=0·추가 stub=0(:315), 5초 안정화 중 추가 교체 0(:319)을 단언한다. 서버 301은 별도 배열(:325)이다. AppShell은 기준 대비 변경되지 않았고 실제 사이드바 NavLink 소비자다.

최종 JSON :1031/:1421에서 각각 초기 포함 docCommits=2, 서로 다른 전체 loaderId, script=0, stubAdded=0, 301은 KO/EN 각 1개다. 5초 추가 교체 0은 실행 코드의 단언으로 보장되며 JSON에 별도의 숫자 필드가 있는 것은 아니다. S6-ko-merge는 :359에서 정확 링크 부재 검사 후 `not-applicable`로 분리한다. PDF 경로군 전환 검사를 생략한 이전 문제는 해소됐다.

(c) 집계: `runCase`(:155)는 명시 상태를 보존하고 예외만 fail로 기록한다. :729의 상태별 집계와 :754의 fail 존재 시 exitCode=1 처리가 분리됐다. 최종 stdout `INT/logs/pass3-test-ads.log`와 JSON은 pass 26 / not-applicable 1 / recorded 1 / unverified 1, fail 0, 총 29행이다. fail 0은 JSON summary에서 키가 생략되며 summary 로그에서는 0으로 명시한다. “29/29 통과”로 합산하지 않는다. S9=recorded, S10=unverified가 유지된다.

새 Node 검증에서 실제 소스의 `runCase` 함수만 메모리로 추출해 명시 상태 5종·기본 pass·예외 fail 총 7 fixture를 실행했고 예상 상태와 일치(exit 0). 네트워크/브라우저 재현이 아닌 상태 분기 재현이다.

**2-1. [비차단/권고] WU2 비차단 후속 반영 범위**

| 후속 | 반영 여부·근거 |
|---|---|
| 전 시나리오 4계수 | 최종 29행 모두 attempt/stub/blocked/allowedExternal 존재, 외부 허용 0. Node로 전 행 확인. 문서별 독립 계수·프로세스 합계까지 완비됐다는 뜻은 아니다. S6/S7는 같은 세션 누적값이므로 행 합산 금지. |
| assertNoRealNetwork | 최종 29행의 실행 경로에는 반영(:183,206,237,269,323,370,409,474,519,609,648). **부분 미반영:** discriminate의 :689는 의도된 stub 단언 실패(:688) 뒤라 성공적인 판별 실행에서는 도달하지 않는다. S5 not-reproduced 분기(:594)도 호출 없이 반환한다. 실제 결과의 0 기록과 헬퍼의 외부 HTTP(S) abort 구조는 확인됐으며 신규 유출 증거는 없다. |
| docCommits 스냅샷 | :331/:414의 객체 복제로 S6-hwp에 S7가 섞이는 문제 해소. JSON은 S6-hwp=2, S7=3. |
| SPA 단계 스냅샷 | :336의 클릭 전·새 문서·안정화 후 3개 복제 필드 반영. 클릭 순간 pushState 전체를 포착했다고 주장하지 않으며 WU2 보고 :57에 제한 명시. |
| loaderId 전체 비교 | :92에서 전체 문자열 비교, loaderShort는 표시만. 반영. |
| discriminate 예외 구분 | :696에서 `stub expected` 메시지인 경우만 성공 인정. 일반 timeout을 성공으로 세던 문제는 보완됨. 엄밀한 AssertionError 타입/code 검사까지는 없으므로 “예외 타입을 직접 검사”했다고 표현하면 과장. 제출 JSON의 실제 오류는 AssertionError [ERR_ASSERTION]. |

위 잔여 사항은 이전 비차단 후속의 부분 반영으로 분류한다. 이번 3개 차단 해소를 뒤집는 제품 결함이나 실유출 근거는 아니다.

**3. [비차단] 통합 실행 증거·재사용 — 원로그/JSON 새 대조, 제품 검사는 재사용**

| 검사 | 직접 대조 결과 | 근거 |
|---|---|---|
| build | exit 파일 0, test:guides 49 routes, tsc/Vite 완료, 지역화 101페이지 | `INT/build.log:11`, :18, :333, :336; `build.exit` |
| test:unit | tests 547 / pass 537 / fail 10, exit 파일 1. 기준 10개 실패 이름과 집합 완전 동일 | `INT/logs/test-unit.log:4006`, :4008, :4009; `test-unit.exit`; `/tmp/wl-adsense/review/baseline-unit-7files.log` |
| test:static | 통과, startup recovery 164문서, exit 파일 0 | `INT/logs/test-static.log:5`, `test-static.exit` |
| pass3 test:ads | 29행, pass 26/N/A 1/recorded 1/unverified 1/fail 0, 29행 4계수, allowedExternal=0, S5 잔류 1 | `INT/logs/pass3-test-ads.log`, `pass3-test-ads-summary.log:1`; 최종 JSON |
| pass3 discriminate | DISCRIMINATION OK; scripts=1, loads=0, attempt/stub/blocked/allowedExternal=1/0/3/0, 예상 stub AssertionError | `INT/logs/pass3-discriminate.log`; 최종 `ad-smoke-discrimination.json` |
| pass3 app-shell | 3/3, fail/skipped/cancelled 0 | `INT/logs/pass3-app-shell.log` |
| content-check | passed=true, 39/39, FAQ 4/4, 캡처 파일 7/7 존재 | `INT/content-check.json`, `INT/content-check.mjs:6`, :60, :62, :128, :149; `INT/logs/content-check.log` |

pass3 세 명령의 exit 0은 WU4 보고값과 정상 완료 stdout/TAP가 일치한다. 별도 pass3 `.exit` 파일은 제공되지 않았으므로 직접 재실행 종료 코드로 바꿔 적지 않는다. 단위 실패 10건도 “전체 통과”로 재해석하지 않는다. Node로 두 원로그의 `not ok` 이름 10개를 추출·정렬하여 동등성을 단언했다(exit 0).

content-check의 39/39는 항목별 예외를 포함한 처리 기준 충족이다. #17 PDF compare와 #18 office-editor는 runtime expectedPresent=null, guideRendered=false를 유지한다. 39개 화면 모두 새 가이드가 표시됐다는 뜻이 아니다. WU1 항목표의 수정17/제거20/미연결삭제2와 이전 적합 판정을 재사용했다.

재사용 대상 소스 연결:

- `INT/logs/build-reuse.txt:2`의 실제 빌드 출발점은 **cd53c2a**다. `cd53c2a..3f29a4a`는 app-shell 검사와 공통 문서 4파일만 변경. 3f29a4a에서 취합한 빌드 결과는 이미 cd53c2a 빌드의 재사용이었다.
- `git diff --stat 3f29a4a HEAD` → `tests/ad-eligibility-smoke.mjs`, `docs/review-notes.md`, `docs/backlog.md` 3파일만. 제품·빌드/정적 생성 입력·의존성·fixture 변경 없음. 따라서 build/static/content-check/시각 캡처 및 전체 unit 결과 재사용이 타당하다.
- 변경된 광고 검사기는 `5d6eca9`에 97739d5를 재병합한 후 pass3에서 다시 실행했다. `INT/logs/pass3-merge-commit.log`의 부모는 3f29a4a와 97739d5, 최종 c53cadc의 추가 변경은 문서뿐이다.
- 최종 광고 근거는 **INT/visual-artifacts/adsense-recheck/**다. **INT/ad-smoke-artifacts/**의 JSON은 27행인 이전 통합 실행(16:33–16:35Z)이므로 S5/S6/집계 해소 근거로 재사용하지 않았다. worktree `tests/visual-artifacts/adsense-recheck/`는 Muse 4182 실행이고 최종 통합 4183 실행과 구분했다.

증거 식별:

```text
최종 광고 JSON: 2026-09-19T16:51:59.926Z ~ 16:53:56.091Z, port 4183
SHA256 798a51b4d4823d7e20e234be3804e0f7a65185be6c2a4aa5fc2b5a2797d87fef
content-check: generatedAt 2026-09-19T16:37:20.413Z
SHA256 998e02dfbec35dc33a034784d580c339315d59557b6b86b73a3581383710d9a8
```

**3-1. [미확인/비차단] 독립 단위 실행 제약과 보완**

`node --experimental-strip-types --test tests/unit/app-shell.test.ts` → exit 1, 파일 단위 ERR_TEST_FAILURE. 원인을 좁히기 위해 허용된 Node 직접 실행 `node --experimental-strip-types tests/unit/app-shell.test.ts`를 수행했다(Node v22.17.1). 앞 2검사는 통과, 셋째는 제품 단언 전에 `spawnSync git EPERM`(:38)으로 실패했다. 이번 환경에서 3/3을 새로 재현했다고 보고하지 않는다.

셋째 검사의 Git 파일 목록과 동일한 확장자·vendor 제외·3개 문자열·명시 허용목록 비교를 Python 읽기 스크립트로 독립 수행했다. 출력 `Independent allowlist equivalent: matched 15 files, PASS`, exit 0. 원본 통합 TAP 3/3은 재사용하고 이 환경의 실패는 샌드박스 실행 제약으로 별도 보존한다. 추적 테스트 파일을 수정하거나 기대값을 낮추지 않았다.
보조 Git 집합 비교의 첫 Python 호출은 괄호 오타로 SyntaxError(exit 1), 검사를 시작하지 못했다. 수정한 인메모리 스크립트의 후속 호출은 위 전체 비교를 수행해 exit 0이었다.

**4. [비차단] WU3 분류표·Git 처리 표본 — 새 정적 대조**

`git ls-tree -r --name-only 1d63027`에서 대상 식으로 추출한 138경로와 분류표 138행은 순서까지 같고 중복 0이다. `git diff-tree --no-commit-id --name-status -r da3f3ba`는 evidence 삭제 42 + .gitignore 변경, 73cdb27은 내부 부산물 삭제 96 + .gitignore 변경이다. 제품·검사 코드의 삭제는 없다.

아래 12개 표본 모두 해당 커밋에서 D, 최종 `git ls-files -- <파일>`은 빈 출력, `git check-ignore -v <파일>`은 표시한 규칙과 일치했다.

| 표본 | 분류표 행 | 처리 커밋 / ignore |
|---|---:|---|
| evidence/corpus/fixtures/blank.pdf | 12 | da3f3ba / .gitignore:6 |
| evidence/corpus/fixtures/manifest.json | 24 | da3f3ba / .gitignore:6 |
| evidence/empty-failed.xlsx | 33 | da3f3ba / .gitignore:6 |
| evidence/multi.zip | 34 | da3f3ba / .gitignore:6 |
| evidence/vite-cache/deps/_metadata.json | 40 | da3f3ba / .gitignore:6 |
| scratch/move-pdf-guides.mjs | 95 | 73cdb27 / .gitignore:7 |
| scratch/parse_plan.py | 98 | 73cdb27 / .gitignore:7 |
| scratch/parsed_pages.json | 100 | 73cdb27 / .gitignore:7 |
| scratch/seo_agent_prompt.txt | 140 | 73cdb27 / .gitignore:7 |
| scratch/test-css-var-canvas.html | 142 | 73cdb27 / .gitignore:7 |
| patch_adsense.py | 55 | 73cdb27 / .gitignore:8 |
| patch_notes.py | 62 | 73cdb27 / .gitignore:8 |

scratch/루트 스크립트는 분류표에 각각 archive 상대 경로가 명시돼 있다. archive는 `.gitignore:23`의 docs/jobs/에 포함된다. src/scripts/tests/package.json/.github에서 scratch/patch/test-drag/integration_status 실행 참조는 검색되지 않았다. evidence fixture는 실제 참조가 있다(`tests/pdf-compare-smoke.mjs:4`, :10; `tests/pdf-compare-golden.mjs:4`, :8). manifest 부재 시 생성기 호출이 있어 추적 해제와 모순되지 않는다. “evidence 참조 없음”으로 일괄 보고하지 않았다.

[미확인] **archive 이동 결과 자체는 미검증.** 이 검수 worktree에는 archive가 없다. `JOB/WU3-REPORT.md:30`의 “evidence 42개 디스크 보존, archive 96개 원본과 byte 동일”을 구현자 주장으로만 보존한다. Git D는 추적 해제는 증명하지만 디스크 보존·이동·byte 동일을 증명하지 않는다. 원본 로컬 수정본/untracked 보존도 이번 독립 검증 대상 밖이다. PLAN §6의 Claude archive 사본 보존은 worktree 제거 전에 별도로 이행할 사항이다.

[비차단] 검사 방법은 PLAN §5와 맞는다. `JOB/WU3-REPORT.md:37`은 XLSX 전체 ZIP package 및 중첩 XLSX, docProps·관계·주석 영역을 포함한다. 실제 `/tmp/wl-adsense/wu3/scan-sensitive.mjs:44`는 ZIP을 풀어 모든 항목을 순회하고 중첩 ZIP/XLSX도 재귀 검사한다. :77은 전 페이지 pdftotext, pdfimages -list, pdfdetach -list, :105는 빈 텍스트·이미지·첨부·검사 불능을 미확인으로 분리한다. 스캐너를 다시 실행하지 않고 소스와 기존 결과를 대조했다.

기존 sensitive-scan.json을 Node로 읽은 결과 target/results=138/138, XLSX 3개 각각 entries/scanned=10/10, multi.zip 내 XLSX 2개 각각 10/10. PDF 미확인은 정확히 blank.pdf, small-blank.pdf, large-blank.pdf, image.pdf의 4개이며 모두 추출 텍스트 공백, image.pdf만 이미지 1, 첨부는 모두 0이다. 분류표 :163과 맞는다. 합성 생성 가능성을 내용 검사 완료로 대체하지 않았다.

fixture 재생성은 기존 `/tmp/wl-adsense/wu3/fixture-generation.log`의 `fixed fixtures: 8 PDFs 10 pages`, `fixture-manifest-check.log`의 manifest 8·missing [], `fixture-status.log`의 fixture/manifest_check/manifest_cmp/font/pdf_lib=0 결과를 재사용했다. 생성기 `tests/helpers/pdf-compare-fixtures.mjs:6`, :9, :23에서 pdf-lib·폰트와 미확인 4개 경계 fixture의 생성 경로도 확인했다. 실제 민감정보 전수 무발견을 이번 검수자가 새로 보증하는 것은 아니다.

**5. [비차단/권고] 공통 기록·서명·보고 정확성**

`CHANGELOG.md:5`의 2026-09-20 항목은 정확히 5줄이며 WU1 가이드/검사기·WU3 정리=Codx, 로더 수정=Muse로 배정과 맞는다. `docs/review-notes.md:7`의 “Claude 판정”은 판정 주체, 각 항목 말미 Codx/Muse는 구현·증거 출처를 표시한다. PLAN 운영 이력 :201–203, WU1/WU2/WU3 보고의 배정·판정과 대조했으며 Astra가 Claude 판정의 작성자라고 주장한 곳은 없다. Git 작성자 필드만으로 모델 신원을 독립 인증한 것은 아니다.

공통 기록의 S5 주입·잔류, S6 KO/EN 루트, S9 설계 동작, 광고 제외 유지, office-editor ?guide=1 예외는 증거와 맞는다. 공통 신규 항목에 “모든 화면/완전 검증/실광고 검증 완료” 과장은 없다. 다음 보정·후속은 비차단으로 남긴다.

- **[권고, 신규 보고 오기] WU4 실패표 분류:** `JOB/WU4-REPORT.md:74`의 “Excel duplicate result copy…”는 p1b-components가 아니라 **feature-locales**다. 원로그 `INT/logs/test-unit.log:1711`이 `tests/unit/feature-locales.test.ts:38:1`을 가리킨다. 실패 이름 10개와 합계는 맞고 `docs/review-notes.md:10`, `docs/backlog.md:7`의 feature-locales 1 / p1b-components 3은 올바르다. WU4의 “오기 정정” 인계 뒤에도 이 표 한 셀이 남았다.
- **[권고, 신규 통합 메타데이터 오기]** `tests/ad-eligibility-smoke.mjs:737`의 `reused c40c2eb build`가 하드코딩돼 최종 통합 JSON :6에도 남는다. 실제 통합 빌드는 cd53c2a이며 위 build-reuse·chunk명·4183 로그로 연결된다. 검사 결과 무효 사유는 아니지만 JSON 단독 출처 표시는 틀리므로 다음 보고/검사기 정비 때 실행 빌드 출처를 전달해야 한다. WU4의 “3f29a4a 결과 재사용”도 “cd53c2a 빌드를 3f29a4a에서 재사용”으로 쓰면 정확하다.
- **[권고, 신규 보고 오기]** `JOB/WU2-REPORT.md:21`은 수정 라운드가 ad-stub도 바꿨다고 쓰지만 `git show 97739d5 --stat` 및 계보상 실제 변경은 ad-eligibility-smoke.mjs 하나다. 헬퍼는 동일하다. 상태 분리·실행 판단에는 영향 없다.
- **[권고, 후속 기록 누락]** PLAN :201의 S9 경고 부재 UX·전역 메모리 도구 추가 위험 후보와 :202의 데스크톱 하단 메뉴 노출 후보를 backlog에 남겼다는 서술에 비해 `docs/backlog.md:5`의 이번 8항목에는 해당 항목이 없다. S9 자체 판정은 review-notes :13에 보존돼 있다. 다음 기록 정비에서 후보를 보존하거나 이월하지 않은 결정을 명시하는 것이 좋다.

**5-1. [비차단/미확인] 시각 증거 범위와 표현 제한**

PLAN §6의 Gemini 7장 열람은 `/tmp/wl-adsense/review/gemini-visual/gemini-out.md:5`의 7행과 exit.txt=0으로 확인했다. 파일 존재·결과를 재사용했으며 새 Gemini 작업을 발행하지 않았다. 이번 Astra는 S5 오류 캡처와 통합 KO/EN OCR 2장을 직접 열람했다. 통합 나머지 5장은 기존 Gemini/Codx 관찰을 재사용한다.

KO/EN OCR 캡처에는 동의 배너가 없고 FAQ 2문항이 보인다. 다만 fullPage 이미지 중간의 고정 검색 헤더가 첫 가이드 카드 제목/본문 일부를 덮으며, 하단 Home/All tools 메뉴가 세로로 노출돼 있다. Gemini :6/:11도 같은 현상을 기록한다. 따라서 `JOB/WU4-REPORT.md:91`과 `INT/logs/visual-review.txt:7`의 “잘림 없음”은 보이는 영역으로 한정해야 한다. 가려진 픽셀까지 확인 완료로 받아들이지 않았다.

PLAN :202에는 Claude가 헤더 가림을 fullPage 캡처 산물로, 하단 메뉴를 기준 CSS와 동일한 기존 UI 결함 후보로 판정한 기록이 있다. 현재 변경에는 AppShell/스타일 수정이 없고 `src/styles/global.css:904`의 bottom-tabs 규칙도 이번 범위에서 불변이다. 새 콘텐츠 회귀의 근거는 없으므로 비차단. 실제 스크롤 뷰포트에서의 가림·하단 표시 정도는 이번 환경에서 미확인이고, 운영 시각 확인까지 완료됐다는 뜻은 아니다.

**6. [비차단] §6 배포 전 상태·종료 구분**

소유 파일 보존, 통합 build/static/content-check, 수정된 광고 29행·판별 모드, 시각 7장 검토 입력, unit 기존 10건의 이름 일치를 확인했다. WU2 이전 차단 3건은 해소됐고, 잔류 위험·N/A·recorded·unverified를 pass로 합산하지 않는다. 따라서 이번 기술 검수 범위에서 **“구현·검증 완료, 운영 미반영”**은 성립한다. archive 독립 미검증과 위 비차단 기록/검사 후속은 이를 전면 검증·전 항목 통과로 확대할 수 없게 하는 제한이다.

- 새 실행: Git 계보·파일 집합/보존 비교·diff-check, 원로그 실패 이름 비교, 29행 JSON/4계수/주입·전환/캡처 참조 대조, runCase 7 fixture, app-shell 실행 제약 확인과 15파일 동등 비교, WU3 138행·12표본 Git/ignore 대조, 기존 스캐너 방법/결과 대조, 캡처 3장 직접 열람.
- 재사용: WU1 적합 및 후속 결과, 통합 cd53c2a 빌드와 이후 무영향 변경에 대한 static/unit/content-check/캡처, pass3 광고·discriminate·app-shell 원결과, Gemini 7장 시각 검토, WU3 fixture 재생성 결과.
- 미실행/미확인: build/test:ads 재실행·포트 listen·전체 회귀·npm ci 없음. 이 환경 app-shell 원형 3/3 독립 재현은 실행 제약. archive 이동/byte 동일은 미검증. 가려진 화면 영역·실제 광고 overlay·계정 제외/Auto ads·실제 노출·심사 결과는 확인하지 않았다.
- main 반영·push·배포·운영 URL 확인은 이번 대상 아님. Claude 감사·최종 판정과 기존 사용자 승인/통합 담당 절차를 대신하지 않는다. 이 검수에서는 추적 파일 수정·커밋·push를 하지 않았다. 지속 산출물은 이 보고서 한 파일이다.

종료 기록(위 검사와 캡처 열람 후):

```text
$ git -C /tmp/wl-adsense/review/final-src status --short
(출력 없음, exit 0)
$ git rev-parse HEAD
c53cadcd877215c7a9a0a7398b44c19f0bfc1d93
(exit 0)
```

시작·종료 HEAD 동일, 작업트리 clean. 추적 파일 수정 없음.

main 반영 후보 적합 여부: 적합
