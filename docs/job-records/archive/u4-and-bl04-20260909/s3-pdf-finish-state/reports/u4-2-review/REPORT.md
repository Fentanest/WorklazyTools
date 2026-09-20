**U4-2(F0b) 구현 검수 — [수정 후 재검수]**

2026-09-07 · Codx (astra 검수)

대상은 `s3-pdf-finish`의 `47c0f2286887111e3573d5efaec0af57165d7d0d`, 직전 기준은 `f56dc68d4c53d58cad520fe41973cd2699a4f548`, main은 `5bc6854175331bdd73b267784d9633cdccda8446`이다. 정본 `docs/jobs/todo/pdf-finish-20260905.md`의 확정 2·3·16·19, v5 V3-3·V3-4, v6·v7 D5와 sol/review dispatch를 대조했다.

**수정이 필요한 제품 결함은 1건(P2)이다.** facade의 오류 envelope 보관 변수가 공용 lifecycle의 terminal guard 밖에서 바뀐다. 같은 실행 턴에서 취소/첫 오류 후 늦은 error를 전달하면 이미 확정된 오류가 `LATE/LATE_CODE`로 바뀐다. 기존 11검사는 통과하지만 추가한 4개 반례는 모두 실패했다. PDF.js 취소 순서·협력적 양보·legacy 출력·기존 스모크·번들 예산은 통과했다.

**검수 방식과 실행 게이트**

- 첫 도구 호출은 `cat PROJECT_RULES.md`였다. AGENTS, 정본, 두 dispatch, sol REPORT/bundle, round 3·5·6 보고와 보존된 `probes-r6/lifecycle.mjs`, `cancel.mjs`를 읽었다. 참조 SHA는 `reference-sha.json`에 기록했다.
- 시작 HEAD/branch/main이 지시와 일치한다. 열린 최상위 계획서 16개를 스캔했고 이번 표면에 반대되는 신규 지시는 없었다. 로드맵의 과거 ref·3GiB 임시 지시는 이후 복구 기록과 이번 4GiB dispatch가 대체한다. `logs/open-plan-surface.log`에 탐색 결과가 있다.
- 원 저장소에서 브랜치 전환·추적 파일 수정·설치·커밋·push를 하지 않았다. `git archive`로 `/tmp/worklazy-u4-2-review/{current,previous,main}` 사본을 만들고 의존성·벤더 캐시를 `/tmp`로 복사했다. 모든 build/browser는 직렬이고 `NODE_OPTIONS=--max-old-space-size=4096`이다. production 사본은 `dist-production/`, QA 산출은 `current/dist/`에 있다.
- 저장소 unit 중 `git ls-files`가 필요하므로 사본별 `GIT_INDEX_FILE`을 `/tmp/worklazy-u4-2-review/{current,previous,main}.index`로 분리하고 원 git object를 읽기만 했다. 원 index는 변경하지 않았다. 초기 index 연결 실패와 재실행은 아래에 기록했다. 상세 명령·cwd·exit·시간은 `commands.jsonl`과 `logs/`에 있다.
- 판정용 추가 코드는 검수자가 새로 작성한 `probes/lifecycle.mjs`, `browser.mjs`, `oracle_compare.py`, `dist_compare.py`, `entry_attribution.py`이다. sol의 소실된 probe/로그를 성공 증거로 간주하지 않았다. 저장소 제공 unit/스모크도 별도로 실행했다.

| 항목 | 판정·심각도 | 재현 명령·실제 출력 | 수정 지시 문안 |
|---|---|---|---|
| 1. 범위·공용/Excel·4모드 UI | [통과] | `git diff --stat f56dc68..HEAD`: 지정된 12파일. `git diff main..HEAD -- src/utils/workerLifecycle.ts src/features/excel-cleaner src/features/excel-compare`: **0B**. TSX·i18n·registry diff **0B**. `logs/scope-*.log`, `protected.diff`, `ui-locale.diff` | 없음. 취소 버튼·신규 의존·서버 전제 코드 없음. |
| 1-D. package 스크립트 재지정 | [통과] | `fixtures:pdf-legacy-oracle` 1행 capture→compare. current에서 npm 명령 성공, previous에서 `node tests/capture-pdf-legacy-oracle.mjs` 성공. compare는 기존 capture를 subprocess로 **재사용** | §2-D의 재채취 대 baseline 비교를 제공하는 범위 안이다. baseline capture는 직접 node로 호출 가능하며 main source guard도 남아 있다. 별도 제품 결정으로 볼 근거 없음. |
| 2. E3/V3-4 및 호출 호환 | [통과, 아래 terminal 반례 별도] | `node probes/lifecycle.mjs`: E3 **11/11**, 공개 client **5함수×ko/en×성공/중첩 오류=20/20** f56와 동일. transfer buffer/목록 identity, progress/warnings/code, terminate 1회 및 listener 0 확인 | timeout 1건은 원 E3와 마찬가지로 **공용 helper** 검사이다. facade는 timeout 인자를 공개하지 않는다. “facade 자체 timeout까지 11건”으로 확대해서 기록하지 말 것. |
| 2. terminal 이후 늦은 오류 | **[결함] P2 · F1** | 동일 독립 명령에서 **4 FAIL**: abort/error/error-event/post-throw → late error. 모두 `{name:"Error",message:"LATE",code:"LATE_CODE"}`, terminate=1. 다음 task로 분리한 대조군은 AbortError 유지 | `pdfWorkerLifecycle.ts`의 adapter 종료 뒤 captureError/전달을 막고 최초 terminal에 속하는 오류만 현지화한다. 공용 helper·Excel 무수정. 아래 F1 완료 기준 적용. |
| 3. 협력적 취소(v7 D5) | [통과] | Node 및 실제 Chrome 각각 microtask **12/12·aborted=false**, task 양보 **1/12·true**. load 전후·font 전후·page/tile·save 전·등록 전의 8 checkpoint 모형도 중단/기등록 결과 보존. `lifecycle-results.json`, `browser-results.json` | finish 엔진은 U4-3 범위라 여기서는 helper 계약 검증이다. 실제 finish 엔진의 checkpoint 연결까지 검수했다고 해석하지 말 것. |
| 4. PDF.js 순서·소유권 | [통과] | 실제 Chrome/PDF.js에서 렌더 정지 중 `page.cleanup()=false`, `document.cleanup()` → `startCleanup: Page 1 is currently rendering.`. helper는 **cancel → RenderingCancelledException 정착 → cleanup:true → owned destroy**. shared는 destroy 없이 재렌더 성공 | 없음. 경고의 정확한 대상도 구분: 현재 설치본에서 document cleanup은 오류, page cleanup은 false 반환. |
| 4. pdfPreview signal 미전달·취소 재실행 | [통과] | `node probes/browser.mjs`: ZIP **12조합**(2언어×2포맷×3DPI), JPEG **8조합**(2언어×4회전), thumbnail DPR1/2의 **22개 대조 전부 동일**. ZIP/JPEG byte SHA, progress·이름·타입, thumbnail RGBA·치수 대조. 실제 내보내기 signal 취소 후 JPEG 재실행 성공 | 없음. 날짜를 고정한 기존 4페이지 oracle 입력으로 비교했으며 전체 입력에 대한 보편 증명으로 확대하지 않는다. |
| 5. legacy 불변 | [통과] | npm compare + **별도 검수자 재귀 파일/SHA 비교**: client **3/0**, structure **4/0**, render **32/0**, output **4/0**, input **1/0**. baseline 직접 재채취도 모두 0. `oracle-independent.json` | capture의 client oracle은 watermark PNG 계약이다. facade/public client 전체 호환은 위 20개 대조와 양쪽 PDF 스모크가 보완한다. |
| 5. 기존 소비처 스모크 | [통과] | 현행/직전 `TEST_SCOPE=pdf` 양쪽 성공. 현행 전체 `test:browser`, `test:excel-cleaner`(`cancellationAndRerun: passed`), `test:excel-compare`(`cancellation: passed`), `test:new-tools` HWP·Image·Audio·Video 모두 exit 0 | 없음. |
| 6. tsc·unit·build·static·CSS·registry | [통과] | tsc 진단0; 현행 **289/289**, 직전 **272/272**; 현행 production **2,837 modules/61 pages**; static recovery **104**; CSS **212 tokens/고아0**; registry **20**, diff-check 0 | 없음. 초기 사본 index 오류 1회는 아래 환경 기록 참조. |
| 6. rendering | [통과] | `VITE_LOCAL_QA=1 npm run build` 후 `npm run test:rendering`: **3페이지×3회, CLS max=0, externalRequests=0, exit0**. `rendering.json`, `logs/qa-rendering.log` | 없음. UI 변경0 조건에 따라 sol 지시서의 rendering 대체 검증 적용. |
| 6. 번들 5종·entry 귀속 | [통과] | entry **+18B**, PDF route **+758B**, shared **+37B**, app **+867B**, CSS **0B**, multiplier=1/overrides={}. sol 측정 **81/81 SHA 동일**, 이번 production 대 이번 measurement도 **81/81 SHA/gzip 동일** | entry +18B는 PDF lazy preload에 기존 workerLifecycle 청크가 추가된 효과. 모듈 본문은 PDF 청크에 있다. |
| 6. “PDF 청크 외 모든 dist SHA 동일” | **[결함: 검수 조건 문안] P3 · 제품 범위 이탈 아님** | main/previous production 전체 **537파일 동일**. current 비교는 **379 SHA 동일/158 변경**. 변경 중 **156은 자산 참조 해시만**, 나머지 PDF 본체와 entry preload. 참조/재배열을 정규화하면 비PDF 실행 코드 변화 없음 | 이 조건을 “PDF 본체·PDF preload 및 그 자산명을 참조하는 산출물 외 SHA 동일; 참조 변경은 별도 증명”으로 정정할 것. 의도적 facade 이관을 취소해 예전 hash를 강제할 사안 아님. |
| 7. 기록·범위 밖 발견 | [통과: 기록 대조] / [미검증: 소실된 과거 로그] | CHANGELOG·review-notes·sol REPORT의 수치/137·exit9·최종3GiB 조건이 서로 일치. 현행 4GiB production/measurement/main/previous/QA 직렬 빌드는 재현 성공. 과거137 원 로그와 3GiB 복원 당시 로그는 소실 | F1 결함과 수리 결과, 11검사 중 timeout의 실제 대상, 생성물 SHA 참조 전파를 후속 기록에 반영. 과거 로그를 이번에 재검증했다고 쓰지 말 것. |

**F1 — 이미 확정된 실패를 late error가 덮어쓴다 (P2)**

위치: `src/features/pdf-editor/pdfWorkerLifecycle.ts:88–96`의 무조건 `captureError(data.error)`, `:83–85`의 종료 시 입력 미차단, `:54–67`의 변경 가능한 외부 변수를 읽는 rejection handler.

`runModuleWorker`는 terminal을 잠그고 한 번만 terminate/reject한다. 하지만 facade는 원 Worker의 onmessage를 남겨 두고 terminal 여부와 무관하게 `envelopeError`를 갱신한다. `.then`의 rejection handler가 실행되기 전 늦은 error가 들어오면, guard가 그 메시지를 거부해도 외부 변수가 이미 바뀌었으므로 다른 Error를 만들어 던진다. **terminate 1회만 확인해서는 실패 결과 불변을 증명할 수 없다.**

```sh
node /tmp/worklazy-u4-2-review/probes/lifecycle.mjs
```

관련 원문은 `logs/lifecycle.log`, 구조화 결과는 `terminal-races.jsonl`이다.

```text
E3 11/11 PASS
terminal-abort-then-late-error: expected AbortError, actual Error / LATE / LATE_CODE
terminal-error-then-late-error: expected FIRST / FIRST_CODE, actual LATE / LATE_CODE
terminal-error-event-then-late-error: expected localized start error, actual LATE / LATE_CODE
terminal-post-throw-then-late-error: expected localized start error, actual LATE / LATE_CODE
each terminated=1
late-error-in-next-task-control: PASS, AbortError retained
all independent node checks: 49, pass 45, fail 4
```

**실측 한계:** 반례는 저장소 unit/E3와 같은 controllable Worker로 같은 턴에 메시지를 전달한 것이다. 일반 native Worker 메시지가 별도 browser task로 도착하면 promise reaction이 먼저 실행되므로 다음-task 대조군은 통과한다. 일반 사용자 클릭 경로에서 이 경합이 발생했다고 주장하지 않는다. 다만 정본의 “중복 terminal·늦은 결과 무시”와 독립 수명주기 계약을 만족하지 않는 **facade 단위 결함**은 재현됐다. 기존 중복-terminal test는 result→error뿐이라 rejection 복구 경로의 외부 상태 변경을 발견하지 못한다.

수정 지시:

1. PDF 소유 adapter의 종료 상태를 공용 helper가 호출하는 `terminate()`에서 먼저 확정하고, 이후 원 Worker message/error callback의 외부 상태 갱신과 전달을 막는다. 단순 `envelopeError ??=`만으로는 abort/error-event/post-throw 이후 첫 late error를 막지 못한다.
2. 최초 수락된 PDF error의 message/code를 고정한다. AbortError 및 시작 실패에 다른 envelope를 붙여 새 Error로 바꾸지 않는다. 공용 `workerLifecycle.ts`·Excel 소스는 계속 diff 0이어야 한다.
3. 위 4개 반례를 제품 unit에 추가하고 첫 오류 이름·message·code, terminate 1회, abort listener 0을 단언한다. 다음-task 대조군과 result→late error도 보존한다.
4. 후속 커밋에서 독립 49검사 **49 PASS/0 FAIL**, 기존 unit·두 언어 오류/경고·transfer·legacy oracle·PDF/Excel 스모크·번들 게이트를 재실행하고 기록한다. 이 검수는 저장소를 수정하지 않았으므로 수리는 별도 sol 작업이다.

추가로 실제 pdf-lib embed/draw/save 뒤 결과 등록도 검사했다(`registration-result.json`). 저장 완료 745B 시점에는 타이머가 아직 실행되지 않았고, `yieldBeforeResultRegistration(signal)` 뒤에는 AbortError로 새 결과를 등록하지 않아 `retained=["previous"]`였다.

**byte·번들 불변의 구체적 경계**

`probes/dist_compare.py`는 537개 모든 파일의 원 SHA를 먼저 비교하고, 실제 산출된 자산명만 대응시켜 참조 변화를 구분한다. entry 등 `index-*.js` 충돌은 manifest에서 확인한 entry/shared/zip 세 쌍을 명시적으로 분리하고 key 충돌 0을 단언한다. `dist-sha.json`, `dist-comparison.json`, `logs/dist-comparison.log`에 원값을 남겼다. 이는 SHA 불일치를 동일하다고 처리한 것이 아니다.

`probes/entry_attribution.py`는 Vite `__vite__mapDeps` 숫자를 실제 파일명으로 되돌려 **20개 lazy preload 호출**을 비교했다. 달라진 호출은 PDF 하나이며 새 dependency는 `assets/workerLifecycle-BLdSBlop.js` 하나다. 다른 preload 호출 19개와 preload를 제외한 entry 본문은 동일하다. 공용 helper의 모듈 rendered SHA도 baseline/current 동일하다. 신규 facade·cooperativeCancel·renderLifecycle 본문은 `PdfEditorPage` 청크에 있고 entry에 번들된 것이 아니다. 세부는 `entry-attribution.json` 및 `bundle.json`에 있다.

신규 signal은 기존 공개 함수 7개의 마지막 optional 인자로만 추가됐고 이전 parameter 목록은 AST 비교에서 일치했다(`signature-results.json`). no-signal의 성공·정상 PDF error envelope는 기존과 동일하다. constructor/post/error-event의 원시 예외는 공용 lifecycle의 안전한 현지화 시작 오류로 수렴하며 이 변경은 sol 기록에도 명시돼 있다. 원시 시작 예외 문자열까지 byte 동일하다고 주장하지 않는다.

**재현 실행과 환경 기록**

다음은 보존된 사본/의존성과 함께 재실행할 수 있다. `run_checks.py`는 tsc/unit/production/static/CSS/registry/bundle/main/previous build를, `run_browser_checks.py`는 preview 서버 관리·스모크·두 capture 경로·독립 Chrome·QA build/rendering을 직렬 수행한다. 모두 원 저장소 외 `/tmp`에 쓴다.

```sh
python3 /tmp/worklazy-u4-2-review/run_checks.py
python3 /tmp/worklazy-u4-2-review/run_browser_checks.py
node /tmp/worklazy-u4-2-review/probes/lifecycle.mjs
python3 /tmp/worklazy-u4-2-review/probes/oracle_compare.py
python3 /tmp/worklazy-u4-2-review/probes/entry_attribution.py
```

`dist_compare.py`는 **QA build 전 production 산출**에 대해 실행한다. 이번 검수의 production 원본은 `dist-production/`와 `dist-sha.json`에 보존되어 있다. 이미 QA로 바뀐 `current/dist`를 production 비교 대상으로 사용하면 안 된다.

현재 검수에서 처음 실행한 previous unit은 **271 pass/1 fail**이었다(`logs/previous-unit.log`): current index를 공유해 f56에 없는 `pdfRenderLifecycle.ts`를 `git ls-files`가 반환한 검수 환경 오류다. 단언이나 제품 파일을 바꾸지 않고 f56용 `/tmp` index를 생성한 뒤 같은 `npm run test:unit`을 재실행하여 **272/272**를 얻었다(`logs/previous-unit-correct-index.log`). 실패 로그를 보존했다.

과거 host OOM 두 번(exit137), 금지 NODE_OPTIONS exit9, 3GiB·GOMAXPROCS=1 복원은 기존 REPORT와 review-notes에 모두 기록돼 있다. 해당 원 로그는 재부팅으로 소실돼 독립 확인할 수 없다. 이번 세션은 62GiB 인식/약55GiB 가용·swap 사용0에서 시작했고, 지정한 4GiB heap으로 모든 빌드를 직렬 통과했다. 새 137 실패는 없다.

**저장소 불변 증명**

시작·종료 branch/HEAD/main 동일. `git-status-start.txt`와 `git-status-end.txt` 내용 동일, 추적 파일 **2,548개 SHA-256 mismatch 0**, 최종 `git diff --check` exit0이다. `invariance.json`, `tracked-sha-start.json`, `tracked-sha-end.json`으로 확인할 수 있다.

```text
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html
```

위 3개는 착수 전부터 있던 사용자 미추적 파일이다. 이번 검수로 새로 생긴 원 저장소 변경은 없다.

최종 판정: **[수정 후 재검수]** — F1(P2) 수리 후 재검수. 검수 조건의 생성물 SHA 문안(P3)은 위 실측대로 정정하며, 그 자체를 제품 코드 범위 이탈로 집계하지 않는다. — Codx
