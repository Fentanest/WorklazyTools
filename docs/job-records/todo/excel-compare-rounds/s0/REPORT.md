# Excel 중복키·머리글 자동 감지 S0 보고

**Codx · 2026-09-07 · S0 완료. 정본 v3에 대한 잔여 이견 0건을 명시 선언한다.**

최종 실행 기준은 **`597a92ff56ed9c3eb23755a58df2580b0269b8bd`**다. 선행 병합·배포, 열린 계획의 상반 지시, production bundle 기준선, 현행 코드와 정본 계약의 정합을 확인했다. S1 이후 제품 구현·추적 파일 수정·커밋·push·배포는 수행하지 않았다. 이번 선언은 아래 SHA·정본·측정기 조합에 한정되며 미래 main/계약/측정기 변경을 승인하지 않는다.

**S1 착수 조건 한 줄:** Claude가 이 S0의 최종 SHA·기준선·공용 파일 경계를 정본에 연결한 단일 지시서로, `597a92f`에서 분리한 작업 위치에 **sol S1**을 디스패치할 것 — 단계 후 astra 검수, **S1+S2 단일 제품 전환·S1 단독 병합/배포 금지**.

## 1. 실행 환경·기준 해시 게이트

- 첫 작업은 `PROJECT_RULES.md` 전문 읽기였다. AGENTS, dispatch, v3 전문, R1/R2/R3 보고·채택 문안·소비처 목록·R2 보존 증거와 관련 review-notes를 확인했다.
- 소스는 `git archive 597a92f | tar -x -C /tmp/worklazy-excel-s0/main`으로 전개했다. 작업 디렉터리는 끝까지 이 사본이다.
- 원 워킹트리 HEAD는 `5767f135443f113e655fbb0801a01e4d3c11de23`(U4), **로컬 `main`은 `cdb4007faea277ffc3ae9f3f7f4fe6fd8b8ba7be`**, 로컬 `origin/main`은 지정 `597a92f`였다. GitHub API의 실제 `main`도 시작·종료 모두 `597a92f`다. 따라서 로컬 `main` 이름이나 원 HEAD를 검증 기준으로 사용하지 않았다. ref 이동/fetch/reset도 하지 않았다.
- 설치된 다른 잡 의존성/소스를 사용하지 않도록 **사본에서 lockfile 고정 `npm ci --ignore-scripts --no-audit --no-fund --cache /tmp/worklazy-excel-s0/npm-cache`**를 실행했다(775 packages). package/lock 변경 0. Node `v22.17.1`, npm `10.9.2`. 실행 가능한 제품 변경이나 의존성 갱신을 추가한 것이 아니다.
- 최초 unit에서 `git ls-files`가 Git 없는 archive를 거부했다. 사본에 독립 `.git`/index·detached HEAD를 구성하고 객체만 원 `.git/objects`에서 읽게 해 재실행했다. 원 index/ref 변경 없음. 현재 사본 `HEAD=597a92f`, status 빈 문자열.
- 환경은 [env.sh](env.sh): heap 4GiB, TMPDIR/cache 모두 이 디렉터리 아래, `VITE_LOCAL_QA` unset. production build, bundle build, 브라우저를 직렬 실행했다. preview **4350 `--strictPort`**. QR fixture proxy의 원래 `listen(0)`은 [preload](probes/strict-test-port.mjs)로 **4351**에만 바인딩(점유 시 실패, fallback 없음). 테스트/제품 추적 파일은 고치지 않았다. 종료 시 4350~4359 리스너 0.
- `/tmp/worklazy-xr*`, `/tmp/worklazy-dc-impl`에는 접근하지 않았다. 지시서의 XR 보고서 선독은 최신 접근 금지와 충돌하므로 **허용된 계획 첨부 사본** [배포 보고](input/excel-compare-rounds/deploy/REPORT.md)·[8차 검수](input/excel-compare-rounds/width-fix-REVIEW8.md)로 대조했다. 원 U4 실행 소스는 열거나 실행하지 않았다. 지정 문서·Git 상태/객체 및 요청된 사용자 Excel 두 파일만 필요한 범위에서 읽었다.

## 2. 선행 병합·배포 확인

`597a92f`는 부모 `cdb4007faea277ffc3ae9f3f7f4fe6fd8b8ba7be` + **`0654fa74bd3e23bba86c1306501c4f9123fde60a`**를 갖는 머지 커밋이다. 요구된 7개 커밋의 `git merge-base --is-ancestor <commit> 597a92f`가 모두 exit 0이다. 실제 계보에는 지시서 축약 목록 외 희소 backstop 수리 **`de66637`**도 있고 이것 역시 조상 검사 exit 0이다.

`ac9cc4a → 64af7b3 → cbe491a → 3270512 → 88fa10e → 8b5b505 → de66637 → 0654fa7 → merge 597a92f`

증거: [merge-lineage.json](evidence/merge-lineage.json), [소스 blob 대조](evidence/contract-blob-crosscheck.json). merge의 writer·data-row helper·validator·worker 5개는 선행 최종 blob과 동일하다. 과거 본체 기준 `5bc6854` 대비 types/engine/report/client/page/inputAdapter 6개도 동일해서 R1~R3 소비처·진입점 전제가 유지된다.

[GitHub Pages run 34129562381](https://github.com/Fentanest/WorklazyTools/actions/runs/34129562381)은 **해당 SHA, completed/success**, UTC 13:49:34 시작·13:54:51 종료다. [API 원출력](evidence/deployment-runs.json). 라이브 `/ko/tools/excel-compare/`는 **HTTP 200**, Last-Modified `Mon, 07 Sep 2026 13:54:45 GMT`였다([headers](evidence/live-headers.txt), [HTML](evidence/live-page.html)). 웹 도구의 첫 open은 도구 URL 검증 오류로 실패했고 curl로 실제 응답을 확인했다. 라이브에서 사용자 파일을 새로 업로드하거나 재배포하지 않았다. 라이브 기능 검증은 첨부 배포 보고와 대조했고, 본 S0의 사용자 파일 실행은 로컬이다.

## 3. 열린 계획서 충돌 검사

최상위 작업 문서 **19개**를 완료 이력이 있는 문서까지 포함해 스캔했다. 제목의 ‘초안’만 보지 않고 각 문서의 우선순위/정본화·로드맵 최신 진행 기록을 적용했다. 목록·SHA: [open-plan-inventory.json](evidence/open-plan-inventory.json), 원문 검색: [open-plans-scan.txt](evidence/open-plans-scan.txt), 읽은 사본: [open-plans/](input/open-plans/).

| 작업 | 겹치는 표면/판정 |
|---|---|
| U1 및 X-A/B/C | 같은 Excel 비교 표면의 선행 계약. 이번 v3가 명시 보완·우선하며 기존 임의 매칭 금지·보고서 수명·swap을 보존하므로 상반 지시 0. |
| 열 너비·문자 안전화 | 이미 main 병합. writer/validator/helper/unit/smoke를 계승한다. 최신 numFmt/희소 방어를 되돌리는 지시 없음. |
| U4 / 진행 중 U4-4 | PDF 소유 엔진·watermark·preview와 S1 Excel 엔진/report의 직접 기능 표면은 분리된다. PDF 계획 377·463행은 공용 lifecycle 무수정/PDF facade 및 Excel 무변경 회귀를 요구하므로 S1에 공용 lifecycle 변경을 가져오지 않는다. **locale features.json, SEO/정적 입력, a11y/visual/browser 하네스, 기록 파일은 공동 표면**이다. 종료 status에서도 ko/en features.json·accessibility-audit.mjs의 실제 수정 경로를 확인했다. 그 U4 내용은 접근 금지여서 읽지 않았으며, 작업물 전체의 충돌 부재를 주장하지 않는다. 이번 S0는 두 작업을 합치거나 실행하지 않았고, S1은 고정 SHA에서 별도 진행한다. 후속 병합 때 파일/키/시나리오별 취합·재검사가 필요하다. |
| U4 번들 측정기 | PDF 정본 366·425~428행은 모듈 기여/순증분·구 schema 거부를 U4-0에 요구한다. **이번 main 측정기는 schemaVersion=1**이며 그 개편을 아직 포함하지 않는다. 이번 기준선과 U4 기준선을 혼용하거나 U4 미병합 측정기를 가져오지 않는다. 향후 U4/main 이동 때 같은 기준 소스·같은 새 측정기로 재채취/게이트 재판정해야 한다. 기존 기준선을 조용히 재설정하거나 예산을 늘리는 승인은 없다. |
| 문서 비교·UI 개편 | 문서 비교 핵심은 main에 반영됐고 Excel 코드 blob 불변. UI 개편의 도구 전역/primitive/테마·결과 하네스는 후속 공동 표면이며 이번 작업의 UI 전면 개편 제외를 유지한다. 현재 정본 v3의 중복/감지 의미와 상반되는 지시는 발견하지 못했다. |
| 그 밖의 완료/상위 문서 | Excel Cleaner/서식 충실도·QR/폰트·RHWP·SEO·비디오·이전 UI 이력을 포함해 스캔. 이번 v3의 1그룹/독립 목록/머리글 후보 의미를 뒤집는 지시 없음. |

**판정: 이 SHA에서 S0/S1을 수행하는 데 필요한 정본 변경·정책 충돌 0. 공동 파일 겹침은 존재하며 위 통합 경계로 명시한다.** 배포 보고의 ‘열린 문서 0개’라는 과거 서술을 현재 원 문서 디렉터리의 사실로 재사용하지 않았다. S1/후속 통합 직전에 열린 계획과 기준 SHA가 다시 달라지면 재검사한다.

## 4. Production bundle 고정 기준선

명령: `BUNDLE_MEASURE_OUTPUT=/tmp/worklazy-excel-s0/evidence/bundle-baseline.json npm run bundle:measure` (env.sh, production, BUNDLE_ROUTES/BASELINE/override 미설정).

**기준 파일:** `/tmp/worklazy-excel-s0/evidence/bundle-baseline.json`  
**SHA-256:** `726a2d5be21ca250c76a5a9c9220affb8931da9286769f762f3531fd64d002c8`  
**소스 SHA:** `597a92ff56ed9c3eb23755a58df2580b0269b8bd`  
**schemaVersion=1 · 80 JS/1 CSS · SHA 중복 0 · lazy route 19종 · multiplier=1 · overrides={}.** 도구 registry 20개와 lazy route 19종은 서로 다른 집합이다.

단위는 모두 **gzip bytes**다. 상한은 현재 절대 크기의 제한이 아니라 S0 대비 **허용 증가분**이다.

| 항목 | S0 기준값 | S0 대비 사용분 | 잔여 증가 예산 | 동일 귀속 기준 절대 도달값 |
|---|---:|---:|---:|---:|
| Entry JS | 299,288 | 0 | 20,480 | 319,768 |
| Affected route JS (19 routes) | 2,451,581 | 0 | 61,440 | 2,513,021 |
| Shared JS | 2,714,508 | 0 | 30,720 | 2,745,228 |
| App JS 전체 | 5,465,377 | 0 | 81,920 | 5,547,297 |
| CSS | 37,693 | 0 | 10,240 | 47,933 |

새 Excel 변경이 아직 없으므로 S0 대비 사용분 0/잔여 전액이다. 이를 U4 예산과 합산하거나 앞으로 다른 브랜치가 들어와도 그대로 쓸 수 있는 예산으로 해석하지 않는다. `affectedRouteJsGzip`는 기본 호출 그대로 **19개 전체**를 고정했고 Excel 비교만의 route gzip은 **10,036B**다. 현 측정기에서 `excelCompare.worker` **454,131B**, `excelCleaner.worker` **456,274B**는 owners=[]의 shared 분류여서 엔진/report 증분은 shared 예산에도 영향을 준다. S1부터 결과가 작다는 이유로 scope나 귀속을 임의 변경하지 않는다.

[측정 원출력](evidence/bundle-measure.log), [메타데이터·스크립트/lock SHA·예산](evidence/bundle-baseline-metadata.json). 원 측정기의 `compareWithBaseline(b,b)`를 실행해 5종 delta=0·budget pass도 확인했다([self-check](evidence/baseline-self-check.log)); 신규 구현의 예산 통과를 주장하는 검사는 아니다. 이후 동일 main 계보·측정기에서는 `BUNDLE_BASELINE=/tmp/worklazy-excel-s0/evidence/bundle-baseline.json BUNDLE_MEASURE_OUTPUT=<해당 단계의 고유 출력 경로> npm run bundle:measure`로 비교한다.

## 5. 정본 계약의 현행 코드 정합

| 계약 | 판정·현행 근거 및 S1/S3 적용 경계 |
|---|---|
| duplicate discriminated union | **성립.** `types.ts:57`, `compareEngine.ts:122~129`는 R1과 같은 blob. 현재 각 측별 emit 두 루프를 키당 생성기로 전환할 경계가 유지된다. status=duplicate에만 4배열 필수, 동측 길이 동일, scalar 위치 null/값 빈 문자열, 다른 상태 불변. 반대편 단일 행 포함 후 두 map에서 삭제, 1:1 기존 비교·3정책/Set 순서 유지. 현재 scalar 소비처가 새 스키마를 읽는다는 뜻은 아니며 S1+S2 함께 전환한다. |
| append·취소·displayKey/count | **성립.** groupRows는 여전히 배열 spread 복사, rowText/cellText·normalizeKeyPart 기존 계약 그대로다. S1에서 append와 4096개 간격/긴 조각별 취소, 원시 표시값의 ` | ` 조합·내부 key와 identity 분리, 그룹 count 전환을 수행한다. 이번 S0에서는 성능 구현/30k 벤치 완료를 주장하지 않는다. |
| report/writer·분할 formatter | **성립.** `report.ts:9~60`의 Duplicates 전용 분기와 Parameters 구성에 배치 가능하다. 공유 writer는 `XlsxReportSheet.rows: unknown[][]`를 받아 전 문자열에 `writeUntrustedText`를 적용한다. 9시트·13열과 `REPORT_TOPOLOGY_INVALID`, 12~48 유한 폭, 직렬화 직전 XML backstop을 그대로 유지한다. 원시 입력 style이나 임의 numFmt를 새 formatter로 가져오지 않는다. |
| 문자 안전화·무손실 범위 | **성립.** 최신 sanitizer는 XML 금지 UTF-16 단위를 각각 U+FFFD 하나로 바꾸고 유효 surrogate pair를 유지한다. 길이를 늘리지 않으므로 16000/32767 예산을 깨지 않는다. 정본의 기존 writer 보존 조건에는 이 현행 안전 치환이 포함된다. 원본 UI 배열은 그대로 보존하고 보고서 기대값은 안전 치환 + 기존 XML CR/CRLF→LF를 적용한다. ‘무손실’을 금지 문자의 원바이트 보존으로 확장하지 않는다. |
| 16000 목록·r [i/n] | **성립.** 행번호/값 양쪽 각각 접두사·`, `·LF까지 포함해 16000 이하, 원본행 단위 탐욕·좌우 독립, 긴 단일행 전용 조각·surrogate/CRLF 사이 분할 금지 규칙이 유효하다. 합성 사전 직렬화 2행을 현재 builder/writer에 공급하여 `2 [1/2]`, `2 [2/2]`, 오른쪽 소진 빈칸, 값/Key/문맥 치환·XML 재개방을 확인했다. 이것은 formatter/union 구현 완료가 아닌 **직렬화 수용성 fixture**다. 실제 formatter 경계·그룹 구간·4096취소·실다운로드/ZIP 전체 내용은 S1/S2 게이트다. |
| Key 초과만 신규 쌍 실패 | **성립.** 새 길이 실패는 displayKey 단일줄 >32767 또는 CR/LF 포함 >16000일 때 `DUPLICATE_KEY_TOO_LONG`이며 다른 parse/integrity 오류는 그대로 존재한다. 일반 긴 목록 때문에 쌍을 실패시키지 않는다. 현행 writer/visibility는 Key 32768을 통과시키는 것을 직접 확인했으므로 **S1의 전용 guard가 필수**다. worker는 report 생성 → await 생성검사 → result post 순서여서 그 예외는 성공 UI/개별 다운로드/ZIP에 진입하지 않고 다음 쌍으로 격리 가능하다. 현재 길이 검사가 이미 구현돼 있다는 주장은 하지 않는다. |
| xlsxReportDataRows.mjs/.d.mts | **보존, 변경 필요 없음.** 실제 XML에 값이 있는 데이터행을 판정할 뿐 엔진 duplicate 수와 Duplicates 물리행 수를 동일시하지 않는다. 연속 조각도 정상 행이므로 기존 helper로 검사된다. Summary/Parameters가 존재하면 Duplicates 누락만으로는 visibility가 실패하지 않으므로 별도 내용 골든은 계속 필수다. 두 파일 SHA는 메타데이터에 고정했다. |
| 희소/numFmt backstop | **보존.** 저장 columns 전체, findRow/findCell을 쓰는 현행 검사 유지. 생성형 includeEmpty 순회로 되돌리지 않는다. 단위 368개 및 별도 Row/Column 금지 numFmt 음성으로 안전 오류를 재확인했다. 기존 비문자열 numFmt/인위적 getter 한계는 8차 검수에서 제품 도달성 밖으로 구분됐으며 이번 문자열 formatter가 그 지원 범위를 넓히지 않는다. |
| detectConservative 진입점 | **성립.** `excelCompare.worker.ts:32~49`의 parse 뒤 sheets.map 전에 원시 cells/merges에서 최대25행 샘플을 한 번 구성할 수 있다. 입력 adapter와 inspection/client/page는 R1 blob 그대로, 현재 headerSuggestion/detectHeader 없음. 다섯째 client 인자 default true·최초 `[요청∪후보]` 헤더 동봉·수동 false 캐시 병합, null/uncertain/none·세로병합 한 셀 skip 금지·23번째 fixture가 그대로 후속 계약이다. 원문 규칙의 S0 감사용 판정은 사용자 두 파일에 row4/suggested를 냈다. 제품 자동 감지가 동작한다는 뜻이 아니다. |
| 상태/취소·제품 규칙 | **성립.** per-file/per-sheet manual 우선, token+File identity+pair/side 소유권, pre-abort 읽기0/worker0, 늦은 finally 보호는 S3에 필요하다. ko/en·guide/FAQ/SEO 입력, 내부 identity/reason 비노출·현재 URL 집합/광고 경계 유지·결과 상태 Gemini 시각 검수 게이트도 유지한다. |

재현: [current-contract.mjs](probes/current-contract.mjs), [원출력](evidence/current-contract.log), [상세 결과](evidence/current-contract.json), [현행 소비처 재귀 검색](evidence/current-consumers.txt), [독립 XML 검사](evidence/independent-xml.json). R2의 132개 형식/LibreOffice 실험은 보존 증거와 불변 adapter/blob로 재대조했으며 **이번에 전부 다시 실행했다고 주장하지 않는다**.

## 6. 사용자 파일 현행 증상 고정

실제 두 파일 SHA는 [current-contract.json](evidence/current-contract.json) 및 [invariance.json](evidence/invariance.json)에 기록했다. 원본 파일은 수정/fixture 커밋하지 않았다. 4행 `No / 이름 / 소속 / 주소`, 좌78·우84행과 병합 A2:I3가 유지된다. 기본 UI 머리글은 양쪽 **1**, 최초 inspect에는 후보가 없다.

| 머리글 / 키 | 현재 화면·엔진 duplicate 레코드 | 내부 중복키 수 (미래 그룹 기대) | 현재 Duplicates 데이터행 | 실제 브라우저 다운로드 B |
|---|---:|---:|---:|---:|
| 1 / B | 4 | 1 | 4 | 54,122 |
| 4 / A | 24 | 6 | 24 | 49,255 |
| 4 / B | 0 | 0 | 0 | 52,987 |

1/B는 **leftRow=2,3 / rightRow=null인 2행 + leftRow=null / rightRow=2,3인 2행**으로 출력된다. Summary matched713·changed37·added48·duplicate4를 현재 화면/다운로드에서 재현했다. S1+S2 후 각각 1·6·0그룹이 되어야 한다. 보고서는 모두 9시트·13열·95논리 열·유한 폭이며, 세 실제 다운로드와 합성 fixture의 XML/rels는 각각 18개 전부 독립 ElementTree parse 통과. 파일 byte 수는 생성 시각 영향이 있어 불변 oracle로 삼지 않는다.

[브라우저 실행 코드](probes/user-browser.mjs), [최종 로그](evidence/user-browser-final.log), [raw UI/worker·XLSX 위치](evidence/private/browser-user-results.json), [현재 화면 캡처](evidence/private/duplicates-current.png). raw 값/보고서는 `evidence/private/`에만 두었다. 캡처를 직접 열어 확인했으며 현재 상태/판정 열의 좁은 줄바꿈도 기준 화면에 남겼다. 이번 캡처는 신규 UI/S4 시각 승인 자료가 아니다.

**실패 원출력:** 첫 자동 입력 두 실행에서 4를 넣으려던 머리글 입력이 실제 `14`가 됐고 duplicate0이라 단언이 실패했다([first](evidence/user-browser-first.log), [diagnostic](evidence/user-browser-diagnostic.log), [실제 controls=14](evidence/private/browser-input-diagnostic.json)). 정본 O07이 요구한 편집 중 임시값 처리를 무시할 수 없다는 현행 관측이다. S0 하네스는 native input setter/input 이벤트로 실제 row4를 설정하고 선택값을 확인한 후 재실행했다. 제품 입력 코드는 수정하지 않았다. 최종 3조합 pageErrors=[]·download 재개방 통과. 최초 실패를 제품 비교 결과가 4행에서 틀렸다는 근거로 삼거나 로그를 삭제하지 않았다.

## 7. 실제 완료 기준 검증

| 명령 | 실제 결과 | 원출력 |
|---|---|---|
| `./node_modules/.bin/tsc -b` | exit0 | [tsc.log](evidence/tsc.log) |
| `npm run test:unit` | 최초 Git 없는 archive: 367 pass/1 fail. Git metadata 구성 후 **368 pass/0 fail, exit0** | [최초](evidence/unit.log), [최종](evidence/unit-with-git.log) |
| `npm run build` | exit0, 2835 modules·61 정적 페이지, 100.29s | [build.log](evidence/build.log) |
| `npm run test:static` | exit0, localized/hreflang/runtime/ads/robots/sitemap·startup104 | [static.log](evidence/static.log) |
| `npm run test:excel-compare` | exit0, 19.06s | [smoke](evidence/smoke-excel-compare.log) |
| `npm run test:excel-cleaner` | exit0, 54.52s | [smoke](evidence/smoke-excel-cleaner.log) |
| `npm run test:qr-bulk` | exit0, 49.85s, proxy4351 | [smoke](evidence/smoke-qr-bulk.log) |
| `npm run bundle:measure` | exit0, 5종 production 기준값 저장 | [bundle](evidence/bundle-measure.log) |
| `node tests/tool-registry-routes.mjs` | exit0, 20·missing/unexpected/duplicates=[] | [registry](evidence/registry.log) |
| `npm run css:orphans`, `git diff --check` | exit0, orphan0·공백 오류0 | [CSS](evidence/css-orphans.log), [diff](evidence/diff-check.log) |
| 현재 계약·사용자 파일 Node probe | exit0, 3조합·writer fixture·안전 오류·길이 guard 필요 확인 | [contract](evidence/current-contract.log) |
| 사용자 파일 production 브라우저 | 보정 후 exit0, 3조합 실제 UI/다운로드·pageErrors0 | [browser](evidence/user-browser-final.log) |
| 독립 XML/rels 재개방 | 4파일×18part pass | [XML](evidence/independent-xml.json) |

검증 요약: [checks.json](evidence/checks.json), [smokes.json](evidence/smokes.json). build의 기존 큰 청크/eval 경고는 원출력에 유지했다. 전체 `test:browser`, 전체 visual/a11y, 신규 23×6형식 감지/formatter 단위·30k append 벤치·Gemini 신규 UI 검수는 **S0 지시의 실행 범위가 아니며 S1~S4 게이트로 남는다**. 선행 보고의 그 검사 통과를 이번 실행으로 표시하지 않는다.

## 8. 불변 증명·정본 연결 문안

[시작 파일 SHA](evidence/archive-sha-start.json)와 [종료 파일 SHA](evidence/archive-sha-end.json): **지정 main archive 추적 2,398파일 전부 동일**. 사본 HEAD 동일·git status 빈 문자열. 사용자 원본 두 파일, 읽은 최상위 계획 19개 SHA 동일. 코드/정본/CHANGELOG/review-notes 직접 수정 없음.

원 저장소의 HEAD/main/origin/main refs는 시작·종료 동일하다. 다만 **원 status는 동일하지 않다**: 종료 때 PDF 관련 5개·ko/en features2개·a11y3개의 수정이 추가로 관측됐다. [시작 status](evidence/source-status-start.txt), [종료 status](evidence/source-status-end.txt), [refs 시작](evidence/source-refs-start.txt), [refs 종료](evidence/source-refs-end.txt). 이 세션은 원 파일에 쓰지 않았고 U4 진행 소스를 열어 비교/복구하지 않았다. 동시 작업 중인 원 트리 전체 파일 SHA 불변을 주장하지 않는다. **불변 실측의 범위는 검증에 쓴 main 사본·지정 입력/계획**이다. [종료 종합](evidence/invariance.json).

정본은 임의 편집 금지이므로 이 보고에 최종 SHA를 기입하고 아래 연결 문안을 인계한다:

> **S0 확정 (2026-09-07, Codx):** 실행 기준 `597a92ff56ed9c3eb23755a58df2580b0269b8bd`(실제 GitHub main/origin/main, 부모 cdb4007+0654fa7). 열 너비 계보 병합/배포 확인. production baseline `/tmp/worklazy-excel-s0/evidence/bundle-baseline.json`, SHA-256 `726a2d5be21ca250c76a5a9c9220affb8931da9286769f762f3531fd64d002c8`, schemaVersion1·전체 lazy19 route·override 없음. 정본 계약 이견0. xlsxReportDataRows 두 파일과 최신 writer 안전화/희소·Row/Column numFmt backstop 보존. U4 공동 locale/검증/기록 파일은 분리 작업 후 취합하며, main 또는 측정기 변경 시 실행 게이트/동일 측정 기준을 다시 확인한다. sol S1 디스패치 가능; S1+S2 한 제품 전환, 각 단계 astra 검수, 최종 S4 게이트 유지.

**정본 변경을 요구할 이견 0건. S0 완료. 이번에는 S1에 착수하지 않았다.**
