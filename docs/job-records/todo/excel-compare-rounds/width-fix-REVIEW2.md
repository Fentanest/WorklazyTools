**[수정 후 재검수] — P2 / R1 잔존 1건.** 원본 probe 2건과 지정 음성 6종·양성 4종은 통과했다. 그러나 **같은 행의 서식 전용 A2 + 빈 문자열 B2**를 조합하면, 실제 데이터 0행인 정상 XLSX를 생산 검사와 공용 판정기가 1행으로 오인한다. 열 너비 수정 및 사용자 보고서 내용은 정상이다. 검수 중 제품 코드는 수정하지 않았다. — Codx, 2026-09-07

**대상과 실행 게이트**

- 대상 `/tmp/worklazy-xr`, 브랜치 `excel-report-width-20260907`, HEAD `64af7b3697ee77c0059ff64d300526a01b4f86c5`. 기준 `5bc6854175331bdd73b267784d9633cdccda8446` → 1차 대상 `ac9cc4a2638aeb497a69668079be050786e6edf7` → fix `64af7b3`. [커밋 계보](logs/ancestry.log).
- `PROJECT_RULES.md` 전문 → `AGENTS.md` → 1차 보고·원본 probe·실패/CSV/성능 로그 → fix 지시·sol 보고/로그 → 원 폭 수정 지시·X-A 작업 문서·관련 review-notes를 읽었다. 대상 worktree의 열린 작업 문서는 X-A 실행 사본 하나이며 이번 fix와 상반된 지시가 없다. 금지된 다른 worktree의 계획서는 탐색하지 않았다. [열린 문서 확인](logs/open-plan-gate.log).
- `git archive 64af7b3` 사본에서 실행했다. archive SHA-256 `9af0a7fd050c62ab5b021e83a7d69ff841b149cec2acfeb55c4c0a051df5b5a0`. 의존성·vendor는 대상 worktree에서 사본으로 복사했으며 새 의존을 설치하지 않았다. 단위 테스트의 `git ls-files`를 위해 사본 전용 Git metadata와 index를 마련했다. [준비 스크립트](probes/setup.py), [준비 출력](logs/setup.log).
- 원본 probe는 실제 `/tmp/worklazy-xr-review/probes/empty-data-negative.mts`를 **무수정 실행**했다. bwrap의 읽기 전용 source bind로 대상 커밋만 대체하고 출력 artifacts만 이번 검수 디렉터리에 bind했다. SHA-256 `2b6646058365953cdb7efb362c416bb19d2a121a12d267c58399dd4dff7c2ccc`; 두 원래 거부 단언 모두 pass. 원본 probe의 기대값을 바꾸거나 제품 함수를 감싸서 통과시키지 않았다. [정확한 명령·TAP](logs/original-probe.log).

명령은 별도 표시가 없으면 `cd /tmp/worklazy-xr-review2/source` 후 `source ../env.sh`에서 실행한다. [env.sh](env.sh)는 메모리 상한 4096MiB, 사본 전용 TMPDIR/npm cache/compile cache, offline npm, 테스트 URL 4370, TEST_SCOPE 미설정을 고정한다. 브라우저는 `npm run preview -- --host 127.0.0.1 --port 4370 --strictPort`에서 직렬 실행했다. QR 보조 proxy의 port 0 요청만 저장소 밖 [하니스](probes/browser-harness.mjs)에서 4371로 고정하며 점유 시 실패한다. 하니스는 다운로드 XLSX를 보존하고 테스트 단언을 변경하지 않는다.

**항목별 판정**

| 항목 | 판정 | 직접 실행한 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| 1a. 원본 R1 두 사례 | 통과 | `node --experimental-strip-types --test /tmp/worklazy-xr-review/probes/empty-data-negative.mts`를 위 bind 환경에서 실행: **2/2 pass**, 두 사례 모두 실제 데이터 0·보조 판정 0·생산 거부. [원출력](logs/original-probe.log) | 없음. 원본 probe SHA 유지. |
| 1b. 지정 음성 6·양성 4 | 통과 | `node --experimental-strip-types ../probes/data-row-required.mts`: 행 높이, 셀 s 서식, 3시트 모두 헤더 전용, 빈 inline 문자열, 자식 없는 c, 빈 shared string **6/6 거부**. 정상·혼재·단일 인용부호 `customWidth='true'`·실제 숫자 0/boolean false **4/4 수락**. ExcelJS 독립 재개방과 보조 함수의 행 수 모두 일치. [원출력](logs/data-row-required.log) | 없음. |
| 1c. 조합 음성 및 요소 경계 | **결함 / P2 / R1 잔존** | `node --experimental-strip-types --test ../probes/empty-style-plus-empty-string.mts`: **1 pass / 1 fail, exit 1, Missing expected rejection**. 동일 행 A2 서식+B2 빈 문자열의 실제 데이터 0, 보조 함수 1, 생산 accepted. XML을 수작업 변조하지 않고 ExcelJS로 생성. LibreOffice도 헤더만 17B/1행. [실패 로그](logs/empty-style-plus-empty-string.log), [XLSX](artifacts/negative-style-before-empty.xlsx), [CSV 확인](logs/negative-csv.json) | 아래 R1 수정 지시대로 요소 경계를 고치고 조합 unit을 추가할 것. |
| 2. 단일 구현 | 구조 통과, 판정 정확성 미통과 | 생산과 보조 함수 모두 `xlsxReportDataRows.mjs`의 `countWorksheetDataRows`·`createSharedStringValueLookup`을 import한다. 생산 maximum=1, 보조는 전체 계수이며 값 판정 분기 중복은 없다. 같은 경계 오류가 두 곳에 전파됨. [전수 사용처](logs/shared-function-usage.log), [변경 전체](logs/diff-full.log) | 공용 함수에서 수정할 것. 보조 함수는 이제 0행을 **반환**하며 0행 자체를 throw하지 않는다. 원본 probe 통과는 생산 거부 단언과 보조 계수 0을 뜻한다. “보조 함수도 거부했다”고 기술하면 안 된다. |
| 3a. 폭·경계·대량 회귀 | 통과 | `node --experimental-strip-types ../probes/core.mts`: 누락/NaN/±Infinity/0/음수/빈값/공백 width 거부, header-only·시트 없음·0B·PK만·뒤 시트 width 누락 거부. 빈 시트·헤더만·긴 문자열·NaN/Infinity/객체/hole, 폭 경계 `[12,13,47,48,48]` 통과. 50,000/150,000행 각각 992/2,442ms 생성, RangeError 없음. [전체 출력](logs/core.log) | 없음. |
| 3b. 9시트·열 이름·토폴로지 | 통과 | 3소비처 실제 다운로드를 별도 Python zipfile+ElementTree로 전수 검사. 비교 시트 순서·13개 레코드 열 이름 등 단언 실행. `node --experimental-strip-types ../probes/early-exit-topology.mts`는 제품 파일 무수정·메모리상의 정확한 sheets.map 결과 한 곳만 바꿔 **REPORT_TOPOLOGY_INVALID** 거부 재현. [토폴로지](logs/early-exit-topology.log), [소비처 상세](logs/consumer-xml.json) | 없음. 소비처 개수·결과는 아래 검증표 및 수집 로그 참조. |
| 3c. 안전 사용자 오류 | 통과 | production worker 응답의 폭 대입 한 곳만 메모리에서 NaN으로 대체한 `node ../probes/worker-safe-error.mjs`: ko/en의 기존 재시도 안내, 오류 코드 REPORT_INTEGRITY_FAILED, 다운로드 0, 내부 원인 미노출을 단언. [원출력](logs/worker-safe-error.log) | 없음. |
| 4. 비용·조기 종료 | 비용 통과, 값 경계 결함은 1c | `node --experimental-strip-types ../probes/performance.mts`: 50,000×13·9시트·2,525,550B, 생성 **5,998ms**, 검사 **279/186/186ms**. 1차 327/240/199 대비 **−14.68/−22.50/−6.53%**, sol 271/202/182 대비 +2.95/−7.92/+2.20%. 생성 대비 4.65/3.10/3.10%. [실측](logs/performance.log), [비교](logs/performance-comparison.json) | 이번 표본의 과도한 비용 증가는 없음. max RSS 1,306,140KiB는 생성 포함 전체 프로세스이며 검사 단독 메모리가 아님. 150001행의 첫 값 탐지와 첫 시트 데이터 존재 뒤 세 번째 시트 잘못된 폭 거부는 모두 통과. 요소 경계 오류는 조기 종료 유무와 별개이며 공용 함수에서 수리해야 함. |
| 5. 사용자 파일 재실측 | 통과 | `node --experimental-strip-types ../probes/user-files.mts`로 원본 2파일을 다시 파싱·비교·보고서 생성. **713 matched / 37 changed / 48 added / 4 duplicate**, 나머지 0. **9시트·95논리 열·68 col 태그·856데이터 행·폭 12~48·잘못된 폭 0**. LibreOffice exit 0, Summary CSV 99B/9행·수치 일치. [재생성](logs/user-files.log), [독립 XML](logs/user-xml.log), [LibreOffice](logs/libreoffice.log), [CSV 대조](logs/libreoffice-summary.json) | 없음. Excel GUI 시각 검수로 확대 해석하지 않음. |
| 6. 범위·회귀 | 범위 통과 | `git diff --stat ac9cc4a..64af7b3`: **7파일 +180/−17**. 무결성 검사·공용 함수/타입·테스트 보조·unit·기록뿐. 폭 계산·소비처 3종·비교 엔진·worker·의존성 manifest/lock은 ac9cc4a와 Git blob 동일. UI 수정 0. [범위](logs/diff-stat.log), [동일 표면](logs/unchanged-surfaces.json) | 제품 수정은 1c의 공용 판정기와 관련 unit·기록 범위로 유지할 것. |
| 7. 기록·인계 | 기존 지시 반영 통과, 새 결함 반영 필요 | review-notes가 행 태그만 보던 첫 구현을 폐기하고 값 판정·빈 문자열/shared string·음성 4/양성 3·성능을 명시했다. CHANGELOG는 간결한 Codx 서명 유지. sol REPORT의 범위 밖 발견 “없음” 확인. [기록 diff](logs/diff-full.log) | 다음 fix 기록에 이번 조합 음성·경계 검사와 수리 뒤 실측을 추가할 것. |
| 8. 최종·배포 후보 | **수정 후 재검수** | R1 데이터 없는 XLSX의 거짓 수락이 독립 재현됨. 지정 개별 사례 및 일반 회귀 통과만으로 이를 상쇄하지 않음. | 현재 커밋은 배포 후보로 승인하지 않는다. |

**R1 잔존 — 수정 지시 (P2)**

수정 대상은 [xlsxReportDataRows.mjs:1](source/src/utils/xlsxReportDataRows.mjs:1)의 요소 매칭과 [같은 파일:36](source/src/utils/xlsxReportDataRows.mjs:36)의 셀 값 해석, 관련 unit·기록이다. `ROW_ELEMENT`, `CELL_ELEMENT`, `SHARED_STRING_ELEMENT`의 탐욕적인 `[^>]*`가 자체 닫힘 태그의 `/`까지 소비한다. 그러면 `/>` 분기 대신 `>` 시작·종료 태그 분기가 선택되어 다음 형제 요소의 닫힘 태그까지 한 요소로 묶는다.

실제 최소 재현의 2행은 다음과 같다. B2가 참조하는 shared string index 2의 텍스트는 빈 문자열이다.

```xml
<row r="2">
  <c r="A2" s="1"/><c r="B2" t="s"><v>2</v></c>
</row>
```

현재 셀 매치는 위 두 c를 하나로 반환한다. 첫 셀 A2에는 `t="s"`가 없으므로 B2의 `<v>2</v>`를 일반 값으로 판단해 빈 shared string 조회를 우회한다. 이 때문에 생산과 보조 함수가 모두 1행으로 잘못 센다. ExcelJS 재개방의 비어 있지 않은 값 판정과 LibreOffice CSV는 모두 데이터 0행이다. 이 사례는 R1의 서식-only/빈 문자열 제외 계약 안에 있으며 새 제품 계약을 추가한 것이 아니다.

`node --experimental-strip-types --test ../probes/element-boundaries.mts`도 **4 fail / 1 pass, exit 1**이다. [원출력](logs/element-boundaries.log).

| 경계 | 현행 결과 | 기대 결과 |
|---|---|---|
| 자체 닫힘 c + 빈 shared-string c | 데이터 1 | 데이터 0 |
| 자체 닫힘 row r=1 + 값 있는 row r=2 | 데이터 0 | 데이터 1 |
| shared strings `Header`, `<si/>`, 빈 t, `visible` | `[true,false,true,false]` | `[true,false,false,true]` |
| inline rich text의 `<t/>` + 후속 빈 `<t></t>` | 데이터 1 | 데이터 0 |

마지막 세 항목은 공용 파서의 유효 XML 경계를 직접 넣은 진단이다. 사용자 보고서에서 관찰했다고 주장하지 않는다. 첫 항목은 위 **실제 ExcelJS 생성 XLSX**로 별도 증명했다.

1. 자체 닫힘 요소를 다음 형제의 종료 태그와 합치지 않도록 경계를 수정한다. c뿐 아니라 동일 패턴의 row·si, 자체 닫힘 t도 함께 점검한다. 셀의 `t`와 값 자식은 같은 셀에서 읽어야 하며 shared string의 인덱스를 보존해야 한다.
2. 이 검수의 `empty-style-plus-empty-string.mts`와 `element-boundaries.mts`를 수정 전 실패/수정 후 통과 증거로 사용하고, 실제 XLSX 조합 음성 및 요소 경계를 커밋 unit에 추가한다. 보조 함수의 전체 계수와 생산 maximum=1의 참/거짓이 같은 값 판정에 근거하는지 확인한다.
3. 원본 probe 2건·음성 6종·양성 4종·후속 시트 폭 검사·0/false·사용자 보고서·대량 비용·필수 회귀를 유지한다. 코딩 중 새 계약을 임의로 추가하거나 비교 엔진·UI·소비처를 변경할 필요는 없다.

**실험 환경에서 발생한 실패**

첫 `test:static`의 `dist/vendor/vendor/rhwp-studio/0.8.6/index.html` 오류는 검수 준비 중 `cp`가 이미 있는 public/vendor 안에 vendor 디렉터리를 한 번 더 복사한 **하니스 오류**였다. 우발적으로 만든 사본 디렉터리만 제거하고 vendor 내용 복사로 고친 뒤 정식 build와 static을 재실행해 통과했다. 제품 코드나 원본 worktree는 고치지 않았다. [최초 static 실패](logs/static.log), [사본 구성 정정](logs/setup-vendor-correction.log), [재빌드](logs/build-corrected.log), [static 재실행](logs/static-corrected.log).

추가 대조 통합 스크립트의 최초 exit 1은 필수 6+4가 통과한 뒤 shared-string 경계 추가 단언에서 발생했다. 이를 숨기지 않고 [최초 출력](logs/data-row-cases.log)을 보존했으며, 필수 대조와 경계 단언을 별도 실행 파일로 나누어 각각의 통과/실패를 명시했다. LibreOffice의 javaldx/dconf 경고도 원출력에 남아 있으나 변환 exit 0과 CSV 내용 단언은 통과했다.

**필수 회귀 최종 결과**

| 명령 | 결과 | 원출력 |
|---|---|---|
| `./node_modules/.bin/tsc -b` | exit 0 | [tsc](logs/tsc.log) |
| `npm run test:unit` | exit 0 · 259/259 | [unit](logs/unit.log) |
| `npm run build` | exit 0 · 2,835 modules · 정적 61페이지 | [build-corrected](logs/build-corrected.log) |
| `npm run test:static` | exit 0 · startup recovery 104문서 | [static-corrected](logs/static-corrected.log) |
| `npm run test:excel-compare` | exit 0 · 9시트 보고서 · 안전 오류 · 다중쌍 | [excel-compare](logs/excel-compare.log) |
| `npm run test:excel-cleaner` | exit 0 · 다운로드 · 수식 · 입력 불변 · mobile | [excel-cleaner](logs/excel-cleaner.log) |
| `npm run test:qr-bulk` | exit 0 · 최초 exit 1; 원본 재실행 7종 · 2시트 manifest · 폰트 · 취소 회귀 통과 | [qr-bulk-retry](logs/qr-bulk-retry.log) |
| `npm run test:browser` | exit 0 · TEST_SCOPE 미설정 전체 Excel · Word · PDF | [browser](logs/browser.log) |
| `npm run bundle:measure` | exit 0 · 80 JS / 1 CSS | [bundle](logs/bundle.log) |
| `npm run css:orphans` | exit 0 · orphan 0 | [css-orphans](logs/css-orphans.log) |
| `node tests/tool-registry-routes.mjs` | exit 0 · 20개, missing/unexpected/duplicates 0 | [registry](logs/registry.log) |
| `git diff --check ac9cc4a..64af7b3 및 기준..fix · 사본 worktree` | exit 0 · 전부 exit 0 | [diff-check](logs/diff-check.log) |
| `python3 ../probes/collect-results.py` | exit 0 · 소비처 3종 고유 XLSX 9개; 전 열 폭 유한 양수 | [consumers-final](logs/consumers-final.log) |

소비처별 고유 XLSX는 Excel 비교 4개(각 9시트/95논리 열), Excel 정리 4개(각 5시트/31~33논리 열), QR 1개(2시트/10논리 열)이다. 모든 다운로드의 동일 바이트는 한 번만 검사했으며, 저장 파일과 원 다운로드 경로는 [artifact-origins.jsonl](artifact-origins.jsonl)에 남겼다. [소비처 전수 XML 결과](logs/consumer-xml.json), [수집 단언 출력](logs/consumers-final.log).

QR의 첫 실패는 결과 수가 성공 2개로 바뀐 직후 `목록·실패 보고서` 버튼이 아직 없다는 것이었다. 동일 소스·동일 빌드·동일 원본 테스트를 다시 실행하자 전체 통과했다. 관련 제품 코드는 `setResults` 후 `await createManifest`가 끝나야 `setManifest`를 호출하고, 기존 스모크는 결과 수만 기다린 뒤 버튼까지 즉시 단언한다. 따라서 이 관찰은 기존 대기 조건의 타이밍 경합과 일치한다. 이번 검수에서 그 원인을 확정해 고쳤다고 주장하지 않으며 제품/테스트 소스를 바꾸지 않았다. [최초 실패](logs/qr-bulk.log), [원본 재실행](logs/qr-bulk-retry.log). **비차단 인계:** 별도 작업 시 manifest 준비 완료 대기 조건을 검토할 것.

첫 브라우저 묶음과 preview를 종료한 뒤 bundle:measure를 실행했고, 번들 내부 빌드가 끝난 뒤 QR을 재실행했다. 빌드·브라우저 중첩은 없었다. 각 preview는 종료했다. [첫 preview 종료](logs/preview-lifecycle.json), [QR 재실행 preview 종료](logs/preview-retry-lifecycle.json), [전체 명령·exit·시간](checks.jsonl). 신규 UI·문구·라우트·SEO·광고 경로·서버 전제 코드·의존성 변경은 없으며, ko/en 안전 오류 및 static/registry/전체 unit의 관련 계약을 실행했다.

**불변 증명과 병합 조건**

[start-state.json](start-state.json) / [end-state.json](end-state.json) / [state-comparison.json](state-comparison.json): 대상 worktree의 시작·종료 status는 모두 clean, HEAD·브랜치 동일, **추적 파일 2,376개 SHA 변경 0**이다. 원본 probe·기존 검수 artifacts·대상 오프라인 작업 문서·지정 사용자 입력 2파일을 합친 **보호 파일 36개 SHA 변경 0**이다. 빌드한 archive 사본의 추적 파일 2,376개도 원 archive와 바이트 차이 0이다.

원본 `s3-pdf-finish`의 제품 소스나 다른 잡 디렉터리를 탐색·수정하지 않았다. 공통 규칙 선독 및 명시된 사용자 XLSX 2파일 읽기만 해당 원 경로에서 수행했다. `/tmp/worklazy-dc-impl`, 임시 배포 worktree, `/tmp/worklazy-xc-r2`에 작업하지 않았으며 sol worktree에는 실행 산출물을 만들지 않았다. 커밋·push·브랜치 전환 없음. 모든 새 산출물은 `/tmp/worklazy-xr-review2/` 아래에 있다.

최초 ref 확인에서 main은 `d69e73a5162840837ed36a7ffb7817cab597966a`였고, 시작 SHA snapshot 전에 `cdb4007faea277ffc3ae9f3f7f4fe6fd8b8ba7be`로 갱신됐다. 시작·종료 snapshot의 main은 후자와 동일하다. 사용자 지시대로 이를 중단 사유로 삼지 않았다. 현재 기준→브랜치 변경과 기준→main 변경의 공통 파일은 **CHANGELOG.md, docs/review-notes.md 두 개**이며 실행 코드 교집합은 없다. [최종 교집합](logs/merge-intersection-final.json).

**배포 후보 조건(수리 후):** 기준 `5bc6854`와 최신 main을 다시 대조하고, 문서 비교 통합 main 위에 `ac9cc4a → 64af7b3 → 이번 R1 후속 fix` 순서를 보존해 반영하면서 공통 기록 두 파일을 함께 취합하며, main 갱신 때마다 코드/문서 교집합·필수 회귀를 재검사하고 후속 Excel 변경보다 이 폭 수정의 통합을 먼저 확정할 것. 현재는 R1 수리·재검수 전이므로 배포 후보 승인이 아니다.

재생성한 사용자 보고서: [user-file-report.xlsx](artifacts/user-file-report.xlsx), SHA-256 `2447bdaa422d6b1710dd37835971eb8acb084414684b758dc0cc3caed66c0048`.

**[수정 후 재검수]**
