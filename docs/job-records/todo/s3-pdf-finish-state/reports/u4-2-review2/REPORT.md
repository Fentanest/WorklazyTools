**U4-2 fix-1 재검수 — [검수 통과]**

2026-09-07 · Codx (astra 검수)

대상은 `s3-pdf-finish` HEAD `446a1e35ba60ebc308a32a13f8b675a02b095365`, fix 전 기준은 `47c0f2286887111e3573d5efaec0af57165d7d0d`, main은 `5bc6854175331bdd73b267784d9633cdccda8446`이다. F1의 같은-turn terminal 오류 덮어쓰기는 해소됐다. 원본 lifecycle probe 49/49, 전체 unit 294/294, 수정을 되돌린 mutant의 새 반례 4/4 실패를 재현했다. 필수 수정 지시는 없다.

첫 행동은 `PROJECT_RULES.md` 전문 읽기였다. AGENTS·review2 dispatch·1차 REPORT와 원본 probe/terminal 로그·fix 지시서·sol 보고와 로그·PDF 정본 확정 2 및 V3-4·관련 review-notes를 대조했다. 최상위 열린 계획서 16개를 스캔했고 이번 facade 표면의 상반된 신규 지시는 없었다. 로드맵의 과거 HEAD/3GiB 문장은 최신 fix-1 기록·review2 dispatch의 HEAD/4GiB 지시로 대체한다. `logs/open-plan-surface.log`에 근거가 있다.

실험은 `git archive`로 만든 `/tmp/worklazy-u4-2-review2/{current,fixbase,main,previous,mutant}` 사본에서 수행했다. 공개 client 대조용 previous는 facade 이관 전 `f56dc68`이며, 번들 fix 전 기준 `fixbase=47c0f22`와 구분한다. 사본 생성 직후 git blob 대조는 current 2,548·fixbase 2,548·main 2,373·previous 2,543파일 모두 mismatch 0이었다. 기존 의존성과 vendor cache를 복사했고 설치하지 않았다. 사본별 `/tmp` index와 `GIT_WORK_TREE`를 지정해 원 저장소 git object를 읽기만 했다. 모든 빌드는 직렬, `NODE_OPTIONS=--max-old-space-size=4096`이다.

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| 기준·실행 게이트 | 통과 | `git rev-parse HEAD`, `git branch --show-current`, `git rev-parse main`: 위 3기준 일치. 열린 계획서 16개 표면 대조, 충돌 없음 | 없음 |
| F1 원본 49검사 | 통과 | `node /tmp/worklazy-u4-2-review2/probes/lifecycle.mjs`: **49 PASS/0 FAIL**, `logs/current-lifecycle.log`, `lifecycle-results.json`, `terminal-races.jsonl` | 없음 |
| terminal 결과·정리 불변 | 통과 | 같은 명령에서 abort/error/error-event/post-throw → late error 네 반례 및 다음-task 대조군·result→late error PASS. `node probes/terminal-literals.mjs`: **5/5**, 아래 리터럴 name/message/code, terminate=1, abort listener=0, callback 해제와 저장해 둔 callback의 재호출 차단, 최초 envelope를 나중에 변조해도 보존 | 없음 |
| 원본 probe 무수정 대조 | 통과, 보존 증거 범위 명시 | `diff -u /tmp/worklazy-u4-2-review/probes/lifecycle.mjs /tmp/worklazy-u4-2-review2/probes/lifecycle.mjs`: **출력 root 1줄만 차이**. 경로 정규화 diff **0B**. 원본 시작·종료 SHA 동일. `provenance.json`, `logs/lifecycle-path-only.diff` | 없음. sol의 별도 수정 probe는 없고 원본 파일 시각도 sol 실행 전이다. 별도 pre-fix archive probe/SHA는 없으므로 역사적 무수정에 대한 증거 한계는 아래 설명 참조 |
| 새 unit 기대값·mutant | 통과, 완전 리터럴 여부 구분 | `python3 mutate.py`: facade만 `git show 47c0f22:src/features/pdf-editor/pdfWorkerLifecycle.ts`로 되돌린 사본에서 전용 unit **18 PASS/4 FAIL, exit1**. 새 반례 4개가 정확히 모두 실패, unit 파일 SHA는 현행과 동일. 정상 전용 22개는 전체 unit에서 모두 PASS | 필수 수정 없음. 일부 메시지 기대값은 현지화 helper이므로 완전 리터럴은 아니다. 독립 리터럴 probe와 mutant로 F1 검출력을 확인했으며 상세를 아래에 기재 |
| E3·공개 client·signature | 통과 | 원본 probe: E3 **11/11**, 공개 5함수×ko/en×성공/중첩 오류 **20/20** f56와 동일. transfer 목록/버퍼 identity·progress·warnings·code·terminate 보존. `node probes/signatures.mjs`: **7함수**의 기존 parameter AST text 동일·마지막 `signal?: AbortSignal`, fix 전후 signature 동일 | 없음. E3 timeout 1개는 **공용 helper 직접 검사**, facade의 timeout API를 검사한 것이 아님 |
| 회귀·정적 검증 | 통과 | `npx tsc -b --pretty false`: 진단0; `npm run test:unit`: **294/294, fail/skip0**; `npm run build`: **2,837 modules, 61 pages**; `npm run test:static`: **startup recovery 104**, 모두 exit0 | 없음 |
| 소비처 스모크 | 통과 | production preview에서 `TEST_SCOPE=pdf npm run test:browser`, `npm run test:excel-cleaner`, `npm run test:excel-compare`: 모두 exit0. PDF edit/range split/conversion, cleaner cancellationAndRerun, compare cancellation PASS | 없음 |
| legacy oracle | 통과 | `npm run fixtures:pdf-legacy-oracle`: client **3/0**, structure **4/0**, render **32/0**, output **4/0**, input **1/0**, 총 diff0. f56 baseline 재채취 후 `python3 probes/oracle_compare.py`의 별도 재귀 SHA 비교도 **두 경로 각각 44파일/0 diff** | 없음 |
| 번들 역행·5종 예산 | 통과 | current/fixbase/main 각각 직렬 build+`npm run bundle:measure`; 아래 실측표. `python3 probes/entry_attribution.py`: fix 전후 preload **20/20 동일**, 청크 소속 변화0, rendered module 변경은 facade 1개. shared 16파일 gzip 변화 합 **−17B** | 없음. entry −18B·shared −17B는 자산 참조명 변경에 따른 압축 차이이며 fix에서 preload 의존성을 제거하거나 공용 코드를 줄인 결과가 아님 |
| 생성물 정정 기준 | 통과 | `node probes/production-gzip.mjs`; `python3 probes/dist_compare.py`: main 대비 **537파일: 379 SHA 동일/158 변경**, 156은 자산 참조만, 나머지는 PDF 본체·entry preload. fixbase 대비 **379 동일/158 변경**, **157 참조만**, 나머지는 PDF 본체. 각 사본 production 대 measurement **81/81 SHA·Node gzip 동일** | 없음. 원 SHA 불일치와 정규화 동일 여부를 별도로 기록했다 |
| 범위·제품 규칙 | 통과 | `git diff --stat 47c0f22..HEAD`: **4파일 +109/−2**, facade(+13/−2, 변경 15줄)·unit(+73)·CHANGELOG(+1)·review-notes(+22)뿐. `git diff main..HEAD -- src/utils/workerLifecycle.ts src/features/excel-cleaner src/features/excel-compare`: **0B**. PDF TSX·i18n diff0, dependency·서버 코드 변경0 | 없음. 기존 4모드 UI·한국어/영어·SEO 내용·광고 격리 정책은 변경 대상이 아니며, 자산 참조 전파와 정적 검증으로 산출 영향 확인 |
| 기록·공백 | 통과 | `scope-records.json`: F1 원인/수리·timeout 대상 정정·156파일 참조 전파·실측값·Codx 서명 존재, CHANGELOG 정합. `git diff --check`, `git diff --check 47c0f22..HEAD`, `git diff --check main..HEAD`: 모두 **exit0/0B** | 없음 |
| 저장소 불변 | 통과 | `python3 invariance.py`: 시작·종료 status/HEAD/branch/main 동일, **추적 2,548파일 SHA mismatch0**, 원본 probe SHA 동일. `invariance.json` | 없음. 저장소 추적 파일 수정·브랜치 전환·설치·커밋·push 없음 |

**F1 결과와 검증 강도**

원본 probe가 새로 기록한 실제 결과는 다음과 같다. 네 경우 raw Worker terminate는 모두 1회다. 별도 리터럴 probe는 각 경우의 abort listener 0까지 단언했다.

```text
abort      → AbortError / The PDF operation was canceled. / code 20
error      → Error / FIRST / FIRST_CODE
error-event→ Error / Unable to start the PDF operation. / code undefined
post-throw → Error / Unable to start the PDF operation. / code undefined
49 checks / 49 pass / 0 fail
```

수리는 공용 helper가 호출하는 adapter `terminate()`에서 자체 terminal을 먼저 잠그고 원 Worker 콜백을 해제한다. 이미 참조된 callback이 나중에 호출되더라도 `terminated` guard가 captureError와 전달을 막는다. 최초 error의 message/code도 값으로 복사한다. 따라서 공용 helper의 terminal guard 밖에서 rejection 복구용 상태를 바꾸던 F1 경로가 닫힌다.

새 unit 4개의 `name`, `FIRST`, `FIRST_CODE`, `undefined`, terminate=1/listener=0은 직접 기대값이다. abort message는 `pdfWorkerCanceledMessage("en")`, 두 start message는 `featureMessage(...)`, abort code는 `new DOMException(...).code`를 사용하므로 **전체 기대값이 리터럴이라고 판정하지 않는다**. 이 helper들이 함께 잘못 바뀌는 경우의 문구 검출력은 제한된다. 다만 F1의 terminal 상태 검출은 네 unit 모두 수정 되돌리기에 실패했고, 검수자의 `terminal-literals.mjs`는 제품 현지화 helper를 기대값 계산에 사용하지 않고 위 실제 문자열·20·undefined를 단언했다. F1 수정 지시의 완료 조건을 충족하며 이번 범위의 잔존 결함으로 집계하지 않는다.

이 경합은 controllable Worker의 같은-turn 전달을 통한 facade 계약 검증이다. 일반 native Worker의 서로 다른 browser task에서 사용자 오류가 발생했다고 확대하지 않는다. 다음-task 대조군과 result→late error는 그대로 통과한다. 협력적 취소·render 순서는 원본 49검사에 포함된 Node helper 계약을 다시 확인했으며, 이번 fix 재검수를 실제 새 finish 엔진 통합이나 새로운 시각 검수로 확대하지 않는다.

**번들 실측과 감소 원인**

| 지표 | main | 47c0f22 | fix-1 | fix 전 대비 Δ | main 대비 Δ | main 대비 상한 |
|---|---:|---:|---:|---:|---:|---:|
| entry JS gzip | 299,287B | 299,305B | 299,287B | -18B | +0B | +20,480B |
| PDF route JS gzip | 171,864B | 172,622B | 172,668B | +46B | +804B | +61,440B |
| shared JS gzip | 2,716,473B | 2,716,510B | 2,716,493B | -17B | +20B | +30,720B |
| app JS gzip | 5,466,587B | 5,467,454B | 5,467,461B | +7B | +874B | +81,920B |
| CSS gzip | 37,687B | 37,687B | 37,687B | +0B | +0B | +10,240B |

`budget.multiplier=1`, `overrides={}`이며 shared/app의 보정 후 delta와 총 delta는 이번 비교에서 같다. 현행 5종 값과 측정 대상 81개 SHA는 sol fix-1 보고와 같고, fixbase의 값·81개 SHA도 1차 검수 보존값과 같다.

fix 전후 `__vite__mapDeps` 숫자를 실제 의존 파일명으로 되돌려 비교하면 **20개 호출 전부 동일**하다. entry의 참조 경로와 basename을 실제 자산 대응표로 정규화한 내용도 완전히 같다. module metadata에서 바뀐 rendered code는 `main:<root>/src/features/pdf-editor/pdfWorkerLifecycle.ts` 하나, 각 module의 동거 청크 구성 변화는 0이다. 따라서 facade 본문 변경 → PDF 청크 자산명 변경 → 상호 import/preload/export 참조명 전파가 발생했고, 길이가 같은 참조명도 압축 문자열의 반복 패턴이 달라 gzip이 증감한다.

shared 감소는 **16파일의 변화 합 −17B**다(`entry-attribution.json.sharedGzipChanges`). 예: trash-2 −3B, jszip.min·minimize-2·refresh-cw 각각 −2B, featureMessages·zipArchive 각각 +1B. 이 파일들의 본문은 자산 참조를 정규화하면 동일하다. app의 fix 전후 변화는 **entry −18 + PDF route 46 + shared −17 + 기타 route −4 = +7B**다.

main 대비 PDF preload에는 기존 `workerLifecycle` 자산 1개가 추가된 상태가 유지된다. 나머지 lazy preload 19개와 preload를 제외한 entry 코드는 같다. main 대비 entry gzip Δ가 0B가 된 것은 이 preload 차이가 사라졌다는 뜻이 아니다.

생성물 원 SHA 목록은 `dist-sha.json`, 모든 변경 파일과 정규화 판정은 `dist-comparison.json`, 충돌0을 단언한 대응표는 `asset-map.json`에 있다. 정정된 생성물 계약을 충족하며 비PDF 실행 코드의 범위 이탈은 없다.

**재현과 환경 기록**

보존 사본을 사용한 주요 재현 명령이다. `run_checks.py`는 tsc/unit/production/static와 세 사본 build·bundle을 직렬 실행하며, `run_browser_checks.py`는 preview 관리·PDF/Excel 스모크·legacy 재채취를 실행한다. 명령·cwd·env·exit·소요시간은 `commands.jsonl`, 원출력은 `logs/`에 있다.

```sh
python3 /tmp/worklazy-u4-2-review2/run_checks.py
python3 /tmp/worklazy-u4-2-review2/run_browser_checks.py
node /tmp/worklazy-u4-2-review2/probes/signatures.mjs
node /tmp/worklazy-u4-2-review2/probes/terminal-literals.mjs
python3 /tmp/worklazy-u4-2-review2/probes/oracle_compare.py
node /tmp/worklazy-u4-2-review2/probes/production-gzip.mjs
python3 /tmp/worklazy-u4-2-review2/probes/dist_compare.py
python3 /tmp/worklazy-u4-2-review2/probes/entry_attribution.py
python3 /tmp/worklazy-u4-2-review2/invariance.py
```

mutant의 실제 명령·실패 목록·unit SHA는 `mutation-results.json`과 `logs/mutant-unit.log`에 있다. 이는 facade만 이전 파일로 바꾼 별도 `/tmp` 사본이며 현행 제품 파일을 바꾸지 않았다.

환경/검수 도구의 재실행을 제품 성공 로그에서 숨기지 않는다: 선택적 archive probe 사본 부재, current에서 기본 baseline capture를 호출해 보호 assertion 발생, main 구형 bundle schema에 `modules` 부재, Python/Node 압축 구현 차이에 따른 초기 보조 비교 실패가 있었다. 최종 비교는 올바른 기준 사본·검증된 metadata·저장소와 같은 Node gzipSync로 수행했다. 경위와 재현 경로는 `ENVIRONMENT-NOTES.md`에 기록했다. main의 기존 meter는 schema 1이지만 새 81파일 경로/SHA/bytes/gzip와 metrics가 canonical schema 2 baseline과 같음을 먼저 확인했다(`main-baseline-crosscheck.json`). 제품의 실제 현행 예산 게이트는 schema 2다.

원본 lifecycle SHA-256은 `51ff671606ca4123e9df1e1ba1fd7315b49509b61a16842c38a4b6061d6e7eed`이다. 현존 파일 mtime/ctime `2026-09-07 00:10:43 UTC`는 sol probe 로그 `00:32:17 UTC`보다 앞선다. sol 별도 수정본은 없으며 이번 사본과의 정규화 diff는 0이다. 별도의 pre-fix archive 원문/SHA가 없어 역사적 무수정을 독립 SHA 한 쌍으로 입증한 것은 아니다. 판정은 현존 원본을 직접 재실행한 증거에 근거한다.

원 저장소의 시작·종료 status는 아래 내용으로 동일하다. 추적 파일 2,548개 SHA 불변, HEAD/main/branch 불변이며 세 파일 모두 착수 전부터 있던 사용자 미추적 파일이다.

```text
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html
```

최종 판정: **[검수 통과]** — F1 해소, 필수 회귀·범위·기록·번들·정정된 생성물 조건 충족. — Codx
