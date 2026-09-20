# Excel 중복키 S2 결과 화면 검수

**[수정 후 재검수] — 화면 전체 내부 키 비노출 미충족(P2), 한국어 결과 열의 세로 줄바꿈(P2), 영향받은 시각 기준선 2개 미갱신(P3).**

Codx · 2026-09-08 · `/tmp/worklazy-xd` · `excel-dupkey-20260907` · **`ebba5203d2984b9ddcb8b321beaf80f4b953f2a4`**. 부모 `c1e44f60096dfad33e6c225fdb96f5323516edf6`.

중복 그룹 자체의 표시값·identity, 좌우 독립 목록, 50개씩 추가 로딩, 전체 값/원본 행번호 검색, 500그룹 제한, 키보드 대화상자와 다운로드는 재현 범위에서 통과했다. 사용자 파일의 **1·6·0그룹**과 나머지 요약 수치도 일치한다. 그러나 **중복 이외의 실제 결과 행에 `number:`·`string:`이 남고, 목록을 펼치면 한국어 상태가 한 글자씩 세로로 떨어진다.** 새 결과 상태 스냅샷의 일치와 axe 위반 0을 제품 검수 통과로 확대하지 않는다.

## 1. 실행 게이트·검증 출처

- 첫 행동으로 프로젝트 `PROJECT_RULES.md` 전문을 읽었다. 이후 대상 AGENTS, [이번 검수 지시](input/excel-s2-review-dispatch.md), [v3 정본](input/excel-compare-dupkey-header-20260907.md), 채택 R1/R2 문안·R3 합의, S1 1·2차 검수 REPORT, [S2 착수 지시](input/excel-s2-dispatch.md), sol REPORT/evidence, 대상 review-notes의 관련 기각·판정 이력을 읽었다. v3 > v2 > v1을 적용했다.
- 시작 HEAD·브랜치 일치, status 빈 문자열. 대상에는 ignored `docs/jobs/todo`가 없어 **허용된 S0 보존본의 열린 계획 19개**를 재스캔했다. [목록/SHA](evidence/open-plans-inventory.json), [검색 출력](evidence/open-plans-scan.txt). 이번 고정 SHA의 읽기·실험 검수와 상반되는 지시는 발견하지 못했다. 금지된 원 트리의 실시간 계획까지 확인했다는 뜻은 아니다. U4와 공용 locale/검증/기록 표면의 향후 통합 경계는 유지한다.
- **`git -C /tmp/worklazy-xd archive ebba5203d2984b9ddcb8b321beaf80f4b953f2a4`로 새 `main/` 사본**을 만들었다. 커밋·대상·사본의 추적 **2,408파일 SHA-256**을 대조했다. Git을 호출하는 unit을 위해 해당 커밋의 기존 commit/tree/blob 2,052개만 사본의 독립 `.git`에 복사하고 index를 구성했다. 새 커밋/checkout/대상 브랜치 전환은 없다. [archive 증거](evidence/archive-provenance.json).
- 의존성은 대상의 독립 `node_modules` 디렉터리를 사본에 복사했다. 새 설치·의존 추가·금지 원 트리 node_modules 참조 없음. Node v22.17.1, heap 4GiB, TMPDIR/npm cache는 이번 디렉터리 안에 고정했다. [실행 래퍼](probes/check.py)·[모든 명령/exit/시간](evidence/checks.jsonl).
- 빌드·브라우저·번들은 직렬. **4350 `--strictPort`** preview, QR 보조 proxy는 읽기 전용 S0 preload로 **4351** 고정. QA 빌드에서 실제 화면·접근성·시각 회귀를 검사했다. production/QA 각각 HTTP JS/CSS 75자산이 그 시점 archive의 `dist`와 바이트가 같음을 대조했다. [production](evidence/provenance-production.json), [QA](evidence/provenance-qa.json).
- S1의 `independent.mjs`·`supplement.mjs`는 **원본 무수정 재실행**이다. [original.py](probes/original.py)는 읽기 전용 기존 probe의 `main`을 이번 archive로, 출력 `evidence`를 이번 디렉터리로 bind한다. JSON 안에 남는 `/tmp/worklazy-xd-s1-review/evidence/...`는 이 실행의 논리적 경로이며 실제 새 산출물은 여기 있다. S0 부모 엔진은 보존된 비교 oracle이며 현재 제품 코드로 오인하지 않았다. [원본 SHA](evidence/original-probe-sha.json).
- 공통 규칙 첫 선독 외 원 워킹트리, `/tmp/worklazy-xr*`, `/tmp/worklazy-dc-impl`은 열거나 실행하지 않았다. 사용자 파일은 `/tmp/worklazy-userfiles/`에서 읽기만 했으며 참고 비교본은 결과 oracle로 쓰지 않았다. 사용자 원문이 든 캡처·보고서는 `evidence/private/`에 보관했다.

## 2. 수정 지시와 정본 판단

### S2-R01 — P2: 중복 외 결과에 내부 정규화 키가 계속 표시됨

**제품 입력 도달성:** 정상 XLSX에서 중복 숫자 `1` 두 행·중복 문자열 `1` 두 행과 일반 키 숫자 `2`/문자열 `Unique`의 변경 행을 함께 비교하면 된다. Worker 결과 주입·파일 변조가 없다. [독립 UI probe](probes/ui-review.mjs)의 `typedCollision`과 [결과](evidence/ui-review.json), [실제 혼합 표 캡처](evidence/mixed-key-exposure.png).

중복 두 그룹은 표시가 둘 다 `1`이고 서로 다른 `number:1`/`string:1` identity와 독립 펼침 상태를 유지한다. 이 부분은 **S1-R02 해소**다. 하지만 같은 표의 일반 행 6개에는 **`number:2` 3개, `string:Unique` 3개**가 그대로 출력된다. 사용자 파일 최초 500행에서도 해당 접두사가 보이는 셀은 **499 / 494 / 500개**다. [사용자 측정](evidence/private/user-review.json).

근거는 `main/src/features/excel-compare/ExcelComparePage.tsx:303`의 일반 레코드 `<td>{record.key}</td>`와 `compareEngine.ts`의 일반 키 비교 경로다. **기존 경로의 잔여 노출이며 S2가 새로 정규화 키를 만든 회귀라고 주장하지 않는다.** 다만 최신 사용자 지시와 S2 디스패치의 “결과 화면 내부 key 비노출”에는 일반 행 예외가 없어 화면 전체 충족을 선언할 수 없다. 다른 상태의 스키마 불변이라는 선행 정본과 이 잔여 소비처의 범위를 Claude가 정리해야 한다.

**수정 지시 문안:**

> 중복과 일반 결과가 섞인 화면의 내부 키 비노출 경계를 정본에 명시하고, 일반 키 결과에도 선택 키 열의 원본 표시값을 제공해 UI가 이를 소비하도록 수리하라. 내부 identity는 유지하고 접두사를 잘라 파싱하는 표시 복원은 하지 않는다. 기존 일반 비교의 판정·순서·보고서 계약을 보존하라. 정상 XLSX의 number/string 키와 혼합 상태를 사용해 결과 필터 적용 전·후의 렌더된 텍스트를 검사하고, 숫자/문자 표시 충돌의 독립성도 다시 검증하라. “내부 키가 더 이상 보이지 않는다”는 기록은 검증된 범위로 정정하라.

### S2-R02 — P2: 독립 목록 전개가 한국어 상태·판정 열을 세로로 무너뜨림

**제품 입력 도달성:** 저장소의 새 시각 fixture와 같은 정상 CSV `A / left-value-` 반복 24회 + tail, 오른쪽 singleton이면 충분하다. 사용자 Excel에서도 재현된다. [독립 레이아웃 probe](probes/layout-review.mjs), [좌표/문자별 줄 위치](evidence/layout-review.json), [ko desktop](evidence/layout-ko-desktop.png), [ko mobile](evidence/layout-ko-mobile.png).

| 화면 | 접힘 `중복키` 줄 수 | 왼쪽 펼침 | 양쪽 펼침 | 양쪽 펼침의 판정 줄 수 |
|---|---:|---:|---:|---:|
| ko 1365×900 | 1 | **3** | **3** | 2 |
| ko 390×844 | 1 | **3** | **3** | **3** |
| en desktop/mobile | 1 | 2 | 2 | 2 |

한국어 desktop 상태 셀은 45.656px, mobile은 43.688px이며 좌우 padding 24px를 빼면 한글 3자를 담지 못한다. 영어의 `Duplicate`/`key` 두 단어 줄바꿈과 한국어 한 글자씩의 낙하를 같은 정상 현상으로 보지 않았다. 사용자 1행/B 캡처에서는 키 제목도 매우 좁게 줄바꿈되고 상태·판정이 세로로 표시된다. **좌우 목록의 같은 행 배치는 성공하지만 행 전체의 읽기 품질은 실패**다.

S2 새 결과 행의 `min-w-64` 두 목록과 자동 표 열 배분이 원인인 표면이다. 같은 페이지에서 접힘→펼침으로 바로 재현하므로 공용 테마 대비 부채와 분리한다. 새 ko desktop light/dark **기준선 자체에도 이 결함이 들어 있다.** PROJECT_RULES의 「배포 전 로컬 시각 검수」는 한 글자씩 세로로 낙하하는 정렬 붕괴도 실패로 명시한다.

**수정 지시 문안:**

> 결과 표의 상태·판정 배지와 짧은 머리글이 한 글자씩 나뉘지 않도록 nowrap/최소 폭을 보장하고, 키 열도 읽을 수 있는 폭을 유지하라. 긴 값은 해당 값 셀 안에서 줄바꿈하고, 폭이 부족하면 이미 마련한 이름 있는 가로 스크롤 영역을 사용하라. 한 결과 행의 독립 좌우 목록·lazy DOM·44px 타깃은 유지한다. 정상 합성 CSV 및 사용자 1행/B·4행/A의 접힘/좌측 펼침/양측 펼침을 ko/en desktop/mobile light/dark에서 검증하고, 상태 문자열의 실제 줄 수 또는 충분한 셀 폭을 단언하라. 이 결함이 들어간 새 기준선을 정상 화면으로 승인하지 말라.

### S2-R03 — P3: FAQ 변경의 기존 시각 기준선 두 개가 남아 필수 회귀 실패

`VISUAL_ONLY=excel-compare VISUAL_CONCURRENCY=1 npm run test:visual`을 **전체 Excel 비교 범위 16개**에서 실행했다. **14 일치 / 2 실패 / 인프라 오류 0**이며 신규 결과 8개는 모두 일치한다. [실패 원출력](evidence/visual-final.log), [실제·diff PNG](evidence/visual-final/).

- `excel-compare-empty__bottom__ko__dark__mobile.png`: 24,730 pixels, **7.5131%** 차이.
- `excel-compare-empty__bottom__en__light__mobile.png`: 7,635 pixels, **2.3195%** 차이.

두 기존/현재 이미지를 직접 대조했다. 새 중복키 FAQ 한 항목이 추가되면서 FAQ 위 내용의 화면 위치가 달라진 **의도된 문구 변경**이다. 신규 제품 결함 2건으로 중복 집계하지 않는다. sol은 새 결과 8개만 비교했고 영향받은 기존 bottom 두 장을 놓쳤다. 이번 검수에서는 기준선을 수정하지 않았다.

**수정 지시 문안:**

> R02 수리 후 Excel 비교 전체 16개 시각 시나리오를 실행하라. 새 FAQ에 따른 위 두 bottom 기준선은 실제 변경임을 검토·기록한 뒤 갱신하고, 결과 8개는 R02 수리 화면만 반영하라. 무관한 기존 기준선은 유지하고 파일별 변경 사유와 깨끗한 재실행 출력을 남겨라.

### S2-N01 — 160 code point 임계값: 기능 검증 통과, 수치의 정본 근거 없음

`ExcelComparePage.tsx:60,372`의 **160 Unicode code point**는 정본/채택 O09/S2 지시서에 수치로 없다. 정본은 “긴 값 줄바꿈, 미리보기 잘림 시 전체 값 대화상자”라는 정성적 계약이다. [검색 근거](evidence/preview-policy-evidence.json).

독립 fixture는 `rowText`의 `T | ` 접두사까지 포함한 **159/160/161 code point**를 만들었다. 159·160은 원문 표시·대화상자 버튼 0, 161은 160자+ellipsis와 버튼 1이다. 이모지의 surrogate pair는 보존됐고 모달에는 결합 문자·줄바꿈·공백이 포함된 **해당 원본 행값 전체가 동일한 JavaScript 문자열로** 들어왔다. 이름·Enter·Escape·초점 반환도 8프로필 통과했다. 즉, 현재 구현이 자른 값의 모달 연결 누락이나 자르지 않은 값의 불필요한 버튼은 재현되지 않았다.

**판정:** 160은 sol의 구현 선택이며 정본 숫자라고 인용할 수 없다. sol REPORT/review-notes에 선택 사실은 쓰였지만 선택 근거·정본 밖 판단에 대한 별도 통지는 없다. 숫자 자체를 데이터 손실 결함으로 세지는 않는다. **선택 근거를 “범위 밖 발견/구현 선택”으로 명시해 Claude에 통지하고, 수용 또는 다른 미리보기 정책을 정본에 연결**해야 한다. 이번 검수에서 임계값을 바꾸거나 새 정책을 임의 확정하지 않았다.

## 3. 지시서 항목별 판정

I=`s1-independent`/`s1-supplement`, U=`ui-review-final`, K=`a11y-manual-settled`, G=`user-review`다. 실제 명령 전문과 exit는 마지막 표에 있다.

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| A1 내부 key/값 소비·원시 reason/error/격리 | **중복 통과 / 전체 실패** | U: 중복 값 목록 채움·접두사0. 혼합 일반 행에서 6개 내부 키. 별도 `ui-text-scan`은 ko/en 결과·전용 긴 키 오류의 전체 렌더 텍스트를 재귀 검사. | **R01** |
| A2 같은 displayKey의 다른 identity | 통과 | U: number/string `1` 두 그룹, 복합 `a \| b \| c` 두 그룹 각각 유지. 서로 다른 행에서 독립 전개. | 없음 |
| B3 접힘·DOM·측별50·독립 | 통과 | U: 초기 내용 DOM0, 50/0→51/50→0/50, 재개방50/50. 오른쪽 추가50으로100→101. | 없음 |
| B4 0건·중첩버튼·plural | 통과 | U: 2:0·0:2에서 No right/left rows 및 해당 셀 버튼0, button 안 button0. K: ko/en singleton·plural·0건 문자열. | 없음 |
| B5 행번호/값 결합·긴 값 wrap | **의미 통과 / 레이아웃 실패** | K의 접근성 트리에 listitem별 원본행+값 결합. `whitespace-pre-wrap`, `overflow-wrap:anywhere`. 사용자 값 목록 내용은 정상이나 짧은 상태 열이 낙하. | **R02** |
| C6 실제 잘림과 모달·160 근거 | 동작 통과 / 선택 근거 보완 | K:159·160 버튼0,161 preview+버튼1. 정본 수치 없음. | **N01** |
| C7 키보드·이름·Escape·초점·원문 | 통과 | K:8프로필 Enter/Tab 경로, named dialog, 전체 textContent 동일, Escape후 trigger 복귀8/8. 18회 Tab/Shift+Tab×8=144회 안정 후 모달 내부. | 없음 |
| D8 전체 검색 | 통과 | U: 닫힌 G000의 51번째 값, 미표시 501번째 R_ONLY 마지막 값, 원본행602, displayKey 모두 검색. 내용 DOM0. 행602는 실제 다른 그룹에도 있어2행 검색되는 것이 정확함. | 없음 |
| D9 500그룹 제한 | 통과 | U: 실제 CSV501그룹→초기500행/잔여1/닫힌목록0, 더보기501행. | 없음 |
| D10 status·쌍별 identity | 통과 | 소스 `records.status` 필터 유지. U: 서로 다른 두 실제 파일 쌍의 같은 내부 A키가2행, 첫 쌍을 펴도 둘째 닫힘. React key=`pairId:duplicate:record.key`. | 없음 |
| D11 Set·원본 행 순서 | 통과 | I: B→A→C Set 순서와 양측 오름차순 유지. U/G: 목록 값과 행번호 인덱스 동일, 사용자5→73 / 5→79. | 없음 |
| E12 axe incomplete 수동·귀속 | **S2 신규 대비 통과 / 공용 부채·보류 별도** | 아래 접근성 절. 기본1257보류를 통과로 세지 않음. 신규608텍스트 측정, minimum5.273/5.733. | 공용 UI 개편 소관; S2 완료 주장과 분리 |
| E13 region·group·44px·읽힘 | 통과 | K:명명된 focusable result/support region, status group role. 신규 버튼 최소높이44px·최소폭ko68.563/en85.922px. ARIA snapshot 저장. | 없음 |
| F14 보고서·ZIP·선행 보존 | 통과 | 개별2개와 ZIP내2개 byte동일. 독립 ElementTree **29 XLSX·522 XML/rels**,9시트·Duplicates13열·폭12~48·길이상한. 지정 writer/backstop/numFmt/helper 파일 부모와SHA동일. | 없음 |
| F15 S1 되돌림 | 통과 | I:81구성/3정책243대조,4배열,그룹summary,19분할경계,surrogate/CRLF,Key20+20경계,Parameters,4096취소,30k1그룹. 기존스모크는 ko/en전용오류·실다운로드·ZIP 통과. | 없음 |
| G16 사용자 파일·실화면 | 수치·같은 행 통과 / 시각 실패 | G:1·6·0와 지정요약 모두같음. 양측x순서/y동일·각2항목 캡처 직접 확인. | **R02**, 일반행노출은R01 |
| H17 현지화·SEO·정적·광고 | 통과 | features ko/en 결과/guide/FAQ, tools2, seo 입력 동반 갱신. 생성기가 seo.ts를 직접 소비. registry/URL변경 불필요,실제집합동일. 새광고/서버경로0·생성물/벤더수기변경0. | 없음 |
| H18 비매칭 안내 | 통과 | ko “같은 줄끼리 연결한 결과가 아닙니다”, en “items on the same line are not matched to each other”; 양쪽 순서는각파일원본, 보조키/발생순번 안내. | 없음 |
| H19 변경 범위·의존 | 통과 | c1e44f6..ebba520 **23파일 +508/−32**,제품페이지1·SEO/locale5·시험/기준선·기록. package/lock변경0. | 없음 |
| I20 결과 시각 scenario·기준선 | **등록통과 / 시각게이트실패** | 실제중복결과8장신규, 기존baseline수정0. 전체Excel16중14/2. 신규ko기준선에는R02가포함됨. | **R02·R03** |
| I21 필수명령 | **시각만 실패; a11y는 제한 판정** | 아래 원출력표. build/unit/static/스모크/bundle/CSS/routes/diff 통과. axe의명령exit0≠전체접근성통과. | R03 및 공용 a11y 귀속유지 |
| J22 종결·다음단계 | **수정 후 재검수** | 불변SHA·보고서·로그·캡처저장. S3 착수와병합후보조건은끝절. | R01·R02·R03 해소/N01 판정 |

## 4. 접근성: 자동 결과와 수동 판정을 분리

**기본 명령은 실제 16페이지·위반0·외부요청0, exit0**다. 그러나 보류는 **color-contrast 1,254 node instances + aria-prohibited-attr 3 = 1,257**다. 이 중 공식 S2 결과8프로필의 대비 보류는 **504**다. [공식 JSON](evidence/a11y.json).

공식 JSON의 보류 selector **1,257개 모두를 같은 페이지/상태에서 다시 찾아** 누락0을 확인했다. [전수 수동 입력/색상/귀속](evidence/official-incomplete-manual.json), [판정표](evidence/official-incomplete-disposition.json). 단색 합성으로 판단 가능한 **721개**는 통과한다. **533개는 공용 상속 UI의 실제 기여 그라디언트가 있어 단색 근사값만으로 통과시키지 않고 보류**, 3개는 generic div의 aria-label 문제로 통과시키지 않는다. 해당 3개는 ToolsPage의 `.tool-category-filter` 두 프로필과 HWP host shell 한 개이며 S2 신규 노드가 아니다. 전역 UI 전체의 접근성을 승인한다는 뜻은 아니다.

별도 S2 경계 fixture8프로필×목록/모달16상태에서는 color-contrast 보류 **1,002**, 모달 focus 보류 **144**도 저장했다. 타깃에 따라 넓은 공용 부모 노드가 잡힐 수 있어, **S2 신규 실제 텍스트 608표본을 따로 측정**했다. 브라우저 canvas로 computed color를 sRGB로 변환하고 alpha·조상 opacity·배경을 합성했다. 신규 표본에는 기여 배경 이미지0, 기준 미달0이며 최소 **light5.2729537:1 / dark5.7329025:1**이다. [수동 원자료](evidence/a11y-manual.json), [요약/귀속](evidence/a11y-summary.json).

공용 상속 부채는 다음과 같이 분리한다.

- **미선택 status 버튼7개:** duplicate만 선택하면 밝은 테마에서 axe가 실제 위반7개를 찾는다. foreground `#808082`, background `#f8f8fb`, 14px, **약3.71:1 <4.5**. ko/en desktop/mobile×목록/모달에서 총56 node instances이며, 고유 문제는 같은7버튼이다. `.opacity-55`는 부모에도 있는 스타일이고 S2는 이 컨테이너에 group role만 추가했다. 공식 새 scenario가 모든 필터 선택 상태만 검사하므로 이 문제를 보지 못한다.
- **공용 탐색/하단/로컬 처리 안내:** 밝은 테마의 옅은 라벨이 보류/낮은 대비 후보로 남는다. 단색 배경 근사치는 약2.84~3.10이며, 기여 그라디언트가 있는 항목은 이 수치로 확정 통과하지 않았다. 소유 파일은 변경 없는 `src/components/AppShell.tsx`·`src/styles/global.css`다. 구체 selector·색상·이미지·opacity를 저장했으며 사용자 지시대로 공용 UI 재설계 계획 소관으로 남긴다.
- **모달 aria-hidden-focus 보류:** 18개×8프로필. 배경의 공용 노드와 S2 모달이 생성한 focus guard를 구분한다. 초기 즉시 측정에서는 포커스 가드 span을 팝업 밖으로 보아 assertion이 실패했다. 보정 검사는 즉시/두 프레임 후 activeElement를 모두 기록했다. 즉시 팝업 밖인 것은 **모두 Base UI focus guard뿐**, 안정 후에는 **144/144 모달 내부**였다. Escape 복귀도8/8. 이 보류는 수동 키보드 판정 통과이며 상속 부채로 떠넘기지 않았다.

실제 접근성 트리는 “왼쪽4건접기, expanded → list → listitem: 원본2행+값”, “왼쪽 원본5행의 전체 값 열기”, 이름 “전체 값/Full value”와 측/행 설명을 제공한다. [ko 목록](evidence/ko-light-desktop-aria.txt), [en 목록](evidence/en-light-desktop-aria.txt), [ko 모달](evidence/ko-light-desktop-dialog-aria.txt). 이는 Chrome 접근성 트리·키보드 직접 재현이며 **NVDA/VoiceOver 음성 출력으로 시험했다는 주장은 아니다.** hover/title 전용 경로가 없고 본문 줄바꿈/모달 원문 보존을 확인했다.

## 5. 사용자 파일·실제 캡처

| 머리글/키 | 그룹 / UI 행 | matched | changed | added | 최초 표시500행의 내부key셀 |
|---|---:|---:|---:|---:|---:|
| 1행/B | **1/1** | 713 | 37 | 48 | 499 |
| 4행/A | **6/6** | 486 | 134 | 31 | 494 |
| 4행/B | **0/0** | 703 | 37 | 48 | 500 |

[1행/B 한 행의 양측 목록](evidence/private/user-h1-c2-side-by-side.png), [4행/A 한 행의 양측 목록](evidence/private/user-h4-c1-side-by-side.png)을 직접 열어 확인했다. 둘 다 1440px viewport에서 오른쪽 목록 끝이 화면 안에 있고, 양쪽 cell y가 동일하며 각각 2개 원본 항목을 갖는다. 4행/A의 첫 그룹은 좌측 5·73행, 우측 5·79행이다. 서로 같은 줄의 항목을 매칭했다고 표시하지 않는다. 캡처의 상태·판정 낙하는 R02로 실패 판정한다. 원본 3파일·S0 기준선 SHA는 시작·종료 동일하다.

## 6. 변경 범위·시각 기준선·번들

[범위/보존SHA](evidence/scope.json), [전체 diff](evidence/diff-full.txt), [명시적 파일 예외를 둔 실행 확장자 재귀 탐색](evidence/recursive-contract-scan.json), [ko/en 문구](evidence/localization.json).

생성 HTML·사이트맵·벤더·THIRD_PARTY_NOTICES의 추적 수기 변경0, package/lock 변경0, 새 network/ad/server 코드0다. 정적 생성기는 `scripts/generate-static-pages.mjs:8`에서 **변경된 seo.ts 입력을 직접 사용**하므로 생성 스크립트 자체를 고칠 필요가 없는 동반 갱신이다. 실제 production 집합 **HTML105·canonical62·hreflang91·sitemap61**을 S0와 전체 대조해 동일했다. [집합](evidence/url-sets.json).

새 baseline 8장의 변경은 모두 **이전에는 없던 실제 결과 상태의 추가**이며 무관한 기존 파일 덮어쓰기 0이다. 8장 모두 직접 열었다. ko desktop light/dark는 R02가 이미 픽셀에 고정되어 있어 품질 승인 불가다. en desktop은 두 단어 줄바꿈으로 읽히고, mobile 4장은 가로 스크롤된 좌측 목록 영역을 찍으므로 우측·상태 열 전체의 품질까지 입증하지 않는다. 사용자 양측 캡처와 별도 DOM 측정으로 그 빈틈을 보완했다. 기존 bottom 2장의 차이는 새 FAQ 추가로 설명되며 R03 수리 대상이다.

S0 기준선은 `/tmp/worklazy-excel-s0/evidence/bundle-baseline.json`, SHA-256 **`726a2d5be21ca250c76a5a9c9220affb8931da9286769f762f3531fd64d002c8`** 하나만 썼다. 재설정·예산 증가·route 선택·override 없음, multiplier 1·lazy 19 routes·기존 귀속을 유지했다. **다섯 예산 통과**. [측정 JSON](evidence/bundle.json).

| gzip bytes | S0 | 이번 측정 | 증분 | 증가 한도 | 잔여 |
|---|---:|---:|---:|---:|---:|
| Entry JS | 299,288 | 300,694 | +1,406 | 20,480 | **19,074** |
| Affected routes JS | 2,451,581 | 2,453,004 | +1,423 | 61,440 | **60,017** |
| Shared JS | 2,714,508 | 2,715,789 | +1,281 | 30,720 | **29,439** |
| App JS | 5,465,377 | 5,469,487 | +4,110 | 81,920 | **77,810** |
| CSS | 37,693 | 37,818 | +125 | 10,240 | **10,115** |

## 7. 실제 실행 명령·출력

아래는 sol의 표를 옮긴 것이 아니라 이번 검수에서 실행한 로그다. 기본 cwd는 `/tmp/worklazy-xd-s2-review/main`이며, `python3 ../probes/check.py <로그이름> <명령...>`이 환경을 고정한다. preview는 이 cwd에서 `./node_modules/.bin/vite preview --host 127.0.0.1 --port 4350 --strictPort`로 별도 실행했다.

| 명령 | 결과/시간 | 원출력 |
|---|---|---|
| `tsc`: `./node_modules/.bin/tsc -b` | **exit 0** · 17.019s | [tsc.log](evidence/tsc.log) |
| `unit`: `npm run test:unit` | **exit 0** · 3.896s | [unit.log](evidence/unit.log) |
| `build`: `npm run build` | **exit 0** · 100.166s | [build.log](evidence/build.log) |
| `static`: `npm run test:static` | **exit 0** · 0.798s | [static.log](evidence/static.log) |
| `smoke-compare`: `npm run test:excel-compare` | **exit 0** · 36.407s | [smoke-compare.log](evidence/smoke-compare.log) |
| `smoke-cleaner`: `npm run test:excel-cleaner` | **exit 0** · 54.108s | [smoke-cleaner.log](evidence/smoke-cleaner.log) |
| `smoke-qr`: `env NODE_OPTIONS=--max-old-space-size=4096 --import /tmp/worklazy-excel-s0/probes/strict-test-port.mjs npm run test:qr-bulk` | **exit 0** · 49.408s | [smoke-qr.log](evidence/smoke-qr.log) |
| `smoke-browser`: `npm run test:browser` | **exit 0** · 50.531s | [smoke-browser.log](evidence/smoke-browser.log) |
| `qa-build`: `env VITE_LOCAL_QA=1 npm run build` | **exit 0** · 88.488s | [qa-build.log](evidence/qa-build.log) |
| `visual-final`: `env VISUAL_ONLY=excel-compare VISUAL_ARTIFACT_DIR=/tmp/worklazy-xd-s2-review/evidence/visual-final npm run test:visual` | **exit 1** · 44.130s | [visual-final.log](evidence/visual-final.log) |
| `a11y`: `env A11Y_MAX_TOTAL=0 A11Y_REPORT_PATH=/tmp/worklazy-xd-s2-review/evidence/a11y.json npm run test:a11y` | **exit 0** · 58.441s | [a11y.log](evidence/a11y.log) |
| `a11y-manual-settled`: `node ../probes/a11y-review.mjs` | **exit 0** · 63.447s | [a11y-manual-settled.log](evidence/a11y-manual-settled.log) |
| `official-incomplete-manual`: `node ../probes/official-incomplete.mjs` | **exit 0** · 33.383s | [official-incomplete-manual.log](evidence/official-incomplete-manual.log) |
| `ui-review-final`: `node ../probes/ui-review.mjs` | **exit 0** · 20.124s | [ui-review-final.log](evidence/ui-review-final.log) |
| `user-review`: `node ../probes/user-review.mjs` | **exit 0** · 16.655s | [user-review.log](evidence/user-review.log) |
| `s1-independent`: `python3 ../probes/original.py node --experimental-strip-types --expose-gc /tmp/worklazy-xd-s1-review/probes/independent.mjs` | **exit 0** · 10.695s | [s1-independent.log](evidence/s1-independent.log) |
| `s1-supplement`: `python3 ../probes/original.py node --experimental-strip-types /tmp/worklazy-xd-s1-review/probes/supplement.mjs` | **exit 0** · 0.890s | [s1-supplement.log](evidence/s1-supplement.log) |
| `layout-review`: `node ../probes/layout-review.mjs` | **exit 0** · 13.708s | [layout-review.log](evidence/layout-review.log) |
| `xml-review-final`: `python3 ../probes/xml-review.py` | **exit 0** · 0.314s | [xml-review-final.log](evidence/xml-review-final.log) |
| `ui-text-scan`: `node ../probes/text-scan.mjs` | **exit 0** · 13.056s | [ui-text-scan.log](evidence/ui-text-scan.log) |
| `bundle`: `env BUNDLE_BASELINE=/tmp/worklazy-excel-s0/evidence/bundle-baseline.json BUNDLE_MEASURE_OUTPUT=/tmp/worklazy-xd-s2-review/evidence/bundle.json npm run bundle:measure` | **exit 0** · 74.117s | [bundle.log](evidence/bundle.log) |
| `css`: `npm run css:orphans` | **exit 0** · 0.592s | [css.log](evidence/css.log) |
| `routes`: `node tests/tool-registry-routes.mjs` | **exit 0** · 0.506s | [routes.log](evidence/routes.log) |
| `diff-check`: `git diff --check` | **exit 0** · 0.070s | [diff-check.log](evidence/diff-check.log) |
| `scope-final`: `python3 ../probes/scope.py` | **exit 0** · 0.457s | [scope-final.log](evidence/scope-final.log) |

unit **380/380**, production/QA 각 2,835 modules·61 정적 페이지, static startup 104문서다. 필수 원본 명령의 실패는 전체 Excel 시각 회귀 2개이며 삭제하거나 기준을 완화하지 않았다. `git -C /tmp/worklazy-xd diff --check c1e44f6..ebba520`도 scope 검사 안에서 실행해 exit 0(출력 빈 문자열), archive의 unstaged diff도 exit 0이다.

**하네스 시행착오를 제품 결함과 구분:** 최초 scope는 내가 client 파일명을 `client.ts`로 잘못 적어 제품 실행 전에 실패했고 실제 `excelCompareClient.ts`로 고쳐 통과했다. 최초 독립 UI의 두 쌍 시험은 4파일을 한 쌍 input에 넣어 검사 대기가 실패했다. 실제 “쌍 추가” 버튼과 각 input을 쓰도록 고친 재실행은 통과했다. 첫 visual 명령은 capture 디렉터리 제약으로 0/16 실행 전에 실패했고, 불필요한 옵션을 제거한 정상 실행에서 위 2개의 실제 diff 실패를 확인했다. 모달의 초기 즉시 focus assertion 실패는 위에 설명한 가드 중간 상태이며 즉시·안정 후 증거를 둘 다 남겼다. 모든 최초 exit 1 로그는 보존했다. 제품·기존 검사·기준선은 수정하지 않았다.

## 8. 불변 확인·다음 단계

시작·종료 대상 HEAD·브랜치·status가 동일하고 status는 빈 문자열이다. 대상 및 archive 각각 **추적 2,408파일 SHA 전부 동일**, 사용자 3파일 및 S0 번들 기준선 SHA 동일, 종료의 새 git archive 스트림도 시작 tar와 동일하다. 새 산출물은 이 디렉터리 안에만 있고, 커밋·push·브랜치 전환·병합·배포 없음. 종료 4350~4359 listener 0. [시작](evidence/state-start.json), [종료](evidence/state-finish.json), [불변 요약](evidence/invariance.json).

**S3 착수 조건:** Claude가 R01의 일반 결과 표시 경계와 N01의 미리보기 선택을 정본에 연결하고, R01·R02·R03 수리 커밋의 S2 재검수 통과 후 그 SHA를 기준으로 S3 단일 지시서를 발행할 것. 이번 검수에서 머리글 자동 감지에 착수하지 않았다.

**S1+S2 병합·배포 후보:** **현재는 아니다.** 중복 그룹 전환의 핵심은 동작하지만 위 제품·검증 잔여가 있다. 수리 후 S2 게이트를 통과하면 S1+S2 단일 전환의 병합 후보 판정이 가능하며, 실제 배포는 정본의 S4 통합·Gemini 직접 시각 검수 및 해당 배포 게이트를 별도로 통과해야 한다. 이번 Chrome·접근성 트리 검수가 그 승인을 대체하지 않는다.

**[수정 후 재검수]**
