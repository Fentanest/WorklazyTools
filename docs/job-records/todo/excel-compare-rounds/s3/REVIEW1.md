**Excel 비교 S3 머리글 자동 감지 — 범위 한정 검수**

**판정: [검수 통과] — 이번 S3 수정에서 비롯된 차단 결함은 발견하지 않았다.** 순수 감지기 조항과 고정 판정표는 일치하며, 감지 도입의 상태/결과/초점 계약도 지정 범위에서 유지됐다. **기존 XLSX/XLSM 오류 타입 소실(BL04)은 실제 파일의 비오류 문자열 조건을 깨뜨리고**, 기존 검색 입력 가림(BL05)도 재현했다. 두 항목은 지시된 기존 결함 정책에 따라 백로그로 귀속하며 무결함으로 포장하지 않는다. S1~S3는 최종 통합 게이트를 남긴 병합·배포 후보이고 실제 병합·push·배포는 하지 않았다.

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| A 감지 정본 대조 | 순수규칙 통과, 기존 입력경로 예외 명시 | `node --experimental-strip-types ../probes/detector.mjs`: 독립47경계 통과. `error-types.mjs`: XLSX/XLSM 오류type 소실2형식 재현 | 기존 BL04를 spreadsheet-core 백로그로 취합 |
| B 22/23판정표 정직성 | 통과 | 실제 원형22 =12/8/2, 제안12중 의미오탐5. 형식138기대일치. CSV원래4+추가1 | 의미오탐을 의미정답으로 세지 않을 것; 현 표 수정요청 없음 |
| C inspect·상태·취소 | 통과 | `header-browser.mjs`: 파일당1회·4시트동봉·수동캐시0회/미캐시1회·지연응답10상태·swap·같은이름File교체·unmount | 없음 |
| D 미감지·aria·ko/en | 지정 범위 통과 | 미감지동일문구·초기1·두ID·파일당polite추가1회. header-a11y16상태·최소5.273:1, AX에설명/상태존재 | 전체axe 대비incomplete는 별도 보류/S4 귀속 |
| E 초점·결과·안전화 | 결과계약 통과, 기존부채 분리 | 원본side-effects/resize/overlap 무수정·motion/focus계약 실패[]; unit396/396·compare스모크통과·보존표면SHA동일 | BL01~03 유지, 검색 BL05 후속 계약 |
| F 사용자파일 | ko/en 실제화면 통과 | 두파일4행suggested, B0그룹, A6그룹/6행·좌2우2 독립목록, 이미지직접확인 | 없음 |
| G 좁은회귀·불변 | 완료 | tsc·unit·production/QA build·Excel스모크·visual16·Excel a11y9 실행, 대상/archive2414파일 변경0 | 전체회귀는 아래 S4 목록으로 이월 |

Codx · 2026-09-08 · Worklazy Tools 자체 제품 품질 검증.
대상 `/tmp/worklazy-xd` · `excel-dupkey-20260907` · `657dec8bb6b7479ee93e54708544aef7b559ebc1` · 부모 `bdd09a7d6bc10da74db8fd3b2b8565da9c3f054e`.

이번 판정은 감지 규칙·판정표 정직성·감지 도입의 회귀에 한정한다. 앞 단계 전체 회귀를 재실행했다는 뜻이 아니다. 검증은 `git archive 657dec8`에서 풀어낸 `main/`에서 했다. 저장소 파일·브랜치·커밋·push는 변경하지 않았다.

**정본 문장과 코드의 1:1 대조**

대조 정본: [보존된 v3 정본](input/excel-compare-dupkey-header-20260907.md)의 O06(82줄), R2-03(135줄), O07/O08 및 R2-03 안내(137줄). v1 초안 문구와 1차 실험 구현은 우선하지 않는다.

| 정본 조항 | 코드 (`main/src/features/excel-compare/`) | 독립 재현·판정 | 수정 지시 문안 |
|---|---|---|---|
| 후보 물리 1~20행 | `headerDetection.ts:6,34,35` | 20행 후보+24·25행 지지 → suggested20. 21행 머리글 → none/null | 없음 |
| 바로 아래 최대5행·총25행 샘플 | `headerDetection.ts:7,16,18,39` | +5 지지는 포함, +6은 제외. 20행 후보의 25·26행 지지만으로는 uncertain | 없음 |
| raw null 제외 후 문자열화·trim 비어 있지 않음 | `headerDetection.ts:18` | null/공백/탭만 있는 행 skip; false·0은 셀 수에 포함. 숫자는 문자열 검사 전에 type을 유지 | 없음 |
| 병합 메타로 가로·세로 행 표시 | `headerDetection.ts:24–31` | A1:B2는 양쪽 집합에 속하며 가로 skip이 우선 → 3행 제안. A1:B1 + C1:C2는 첫 행 skip 뒤 세로 1셀 2행에서 uncertain | 없음 |
| 빈 행·가로 병합 행 skip | `headerDetection.ts:37` | 빈 행·가로 제목만 있는 후보 구간 → none/null | 없음 |
| 비세로 병합 1셀 제목 + 아래5행 중 2셀 행 존재 시 skip | `headerDetection.ts:44` | 2셀 행이 +5이면 skip; +6이면 uncertain. 세로 A1:A2의 1셀 제목은 **즉시 uncertain/null** | 없음 |
| 처음 만난 판정 행 하나만 검사 | `headerDetection.ts:54–63` | 첫 행 trim 중복, 뒤에 완전한 머리글과 본문을 둬도 uncertain. 첫 성공 뒤 더 밀집한 행을 선택하지 않음 | 없음 |
| 비빈 셀 ≥2 | `headerDetection.ts:55` | 단일열은 지지가 있어도 uncertain | 없음 |
| 비수식·비오류 문자열 ≥1/2 | `headerDetection.ts:51,56` | 2/4는 suggested, 1/4는 uncertain. 문자열 결과 수식·error 타입을 각각 제외한 반례 통과 | **실파일 XLSX/XLSM은 아래 BL04 예외: 기존 어댑터 오류 타입 소실** |
| trim 값 모두 다름 | `headerDetection.ts:52,57` | 4개 중 `A`와 ` A ` 하나만 중복해도 uncertain. `A`·`a`는 서로 다름 | 없음 |
| 같은 열 값 `ceil(n×0.4)` 이상인 하위행 ≥2 | `headerDetection.ts:46–50,58` | 후보 n=2~11 각각 임계값−1/임계값 **20경계** 통과. n=5의 2셀은 정확히40% 통과, n=6의2셀은 실패·3셀은 통과. 다른 열 값만 많으면 실패 | 없음 |
| 세로 병합 행 아님 | `headerDetection.ts:59` | 1셀·다셀 모두 첫 판정에서 uncertain. 가로 동시 병합은 앞선 skip 우선 | 없음 |
| suggested만 정수row, 나머지 null | `headerDetection.ts:61,63,66` | 독립47경계·원형23·형식138의 모든 출력 형태 확인 | 없음 |
| 최초1회, 모든 시트 후보+기본/후보 열명 | `inspection.ts:15–28`, worker `:36–46`, client `:28–40` | 4시트 XLSX 두 파일 각각 inspect1, 요청[1], 응답행 `[1,4] / [1,2] / [1] / [1]`; 열 이름도 같은 응답 | 없음 |
| 요청행∪시트후보행·중복없음 | `inspection.ts:17–26` | 중복 요청 `[1,2,2,3,4]` 직접 시험. 유효한 행들만 Set 합집합, 시트 행수 밖은 제외 | 없음. 유효행 필터는 기존 범위 검증과 양립 |
| 수동행 조회는 재감지 없음 | `ExcelComparePage.tsx:151–168`, `inspection.ts:16,28` | 캐시행1 추가0회, 미캐시행5 추가1회·detectHeader=false. 응답에 suggestion 필드 없음 | 없음 |

명령: `python3 ../probes/check.py detector node --experimental-strip-types ../probes/detector.mjs`.
[전체 입력·실측](evidence/detector.json), [독립 요약](evidence/detector-summary.json). **47/47 경계, 138/138 고정 형식 기대값 통과**는 알고리즘 계약 시험 수치이며 의미 정확도 수치가 아니다.

**판정표의 정직성**

22개 의도행을 최초 반박 실험의 `header-cases.json`과 대조해 **22/22 동일**임을 확인했다([계보](evidence/fixture-intent-lineage.json)). 결과를 보고 정답행을 새로 붙인 것이 아니다. 실제 출력 집계는 **suggested12·uncertain8·none2**, 23번째 vertical-prefix는 uncertain/null이다. 원형23개 행/이유 전체와 형식별 셀 type·merge는 [detector.json](evidence/detector.json)에 저장했다.

| 제안 중 의미상 오탐 | 실제 데이터와 의도 | 실측 | 개별 판정 |
|---|---|---|---|
| filter-row | 1행 `Region,Seoul`은 필터 조건. 2행 `ID,Name,Amount`가 본표 열명 | suggested1, 의도2 | 오탐 맞음. 필터 조건을 머리글로 삼으면 실제 열명행이 데이터가 됨 |
| description-row | 1행 `Please review,Do not edit,Updated weekly`는 설명. 2행이 열명 | suggested1, 의도2 | 오탐 맞음. 서로 다른 문자열이라는 구조 조건만 만족 |
| summary-block | 1행 `Metric,Value,Unit`·2~3행 집계 뒤, 5행에 본표 `ID,Name,Amount` | suggested1, 의도5 | **본표 선택 목표에 대한 오탐**. 1행 자체는 요약 소표의 정상 머리글이므로 “어떤 표의 머리글도 아니다”라고 평가하면 정확도를 부당하게 깎는 설명이 됨 |
| no-header-all-text | `Alice,Seoul / Bob,Busan / Carol,Incheon`은 전부 데이터 | suggested1, 의도null | 오탐 맞음. 첫 데이터가 제외된다. 정본의 열 이름 행 추가 안내가 필요 |
| three-level-no-vertical | 병합 `Sales` 뒤 2행 `North,South`, 3행 `Q1,Q2`, 아래 숫자 | suggested2, 의도3 | **합의한 최하위 열명행 목표에 대한 오탐**. 2행도 다단 머리글의 상위 수준이며, 알고리즘이 전체 다단 머리글을 이해했다고 주장하지 않음 |

제안12개 중 의도행 일치 **7**, 오탐 **5**: 제안에 한정한 일치율 7/12(58.33%). 이를 22개 전체 정확도로 부르지 않는다. 불확실8은 제안 보류이고, none2는 빈 시트와 21행 범위 밖이다. “고정 기대출력22개 일치”를 “의미 정답22개”로 바꾸지 않았다. 테스트의 `expected`는 알고리즘 출력이고 `intendedHeaderRow`·`semanticFalseSuggestion`은 별도다. 그 둘을 같게 강제하는 통과 조건은 없다.

형식 표는 `tests/fixtures/excel-compare-header-format-expectations.ts`에 형식별 명시 배열을 두며 실제 직렬화 후 각각 production 파서로 검사한다. XLSX/XLSM/BIFF8 XLS/XLSB/SpreadsheetML 각23/23, CSV23/23이다. 다섯 구조 보존 형식의 결과가 같은 사실은 실행으로 확인했고, CSV를 포함한 여섯 형식에 동일 배열을 복제하는 구현은 아니다.

| CSV에서 달라진 사례 | 구조 보존 원형 → CSV | 파싱 결과에 근거한 원인 |
|---|---|---|
| merged-title | suggested3 → uncertain/null | merge 정보 소실, `Title`3개가 중복인 첫 판정행으로 남음 |
| numeric-header-after-title | uncertain/null → suggested2 | 2024·2025·2026이 CSV에서 문자열로 파싱됨 |
| dense-numeric-header | uncertain/null → suggested1 | ID·2025·2026 모두 문자열, 1/3이던 문자열 비율이3/3 |
| three-level-no-vertical | suggested2 → uncertain/null | merge skip이 사라져 첫 `Sales,Sales`의 중복으로 즉시 중단 |
| vertical-prefix | uncertain/null → suggested3 | 세로 merge 소실로 앞의 1셀행들이 제목 skip 가능해짐 |

**원래22개에서 차이4 + 새23번째에서 차이1 = 5**이므로 정본의 “CSV4패턴”과 sol의 23개 표 “CSV5패턴”은 모순이 아니다. [셀 타입·병합·결과 근거](evidence/detector.json)의 `formats`, `csvDifferences` 참조.

**검사 왕복·상태·취소·화면**

명령: `node ../probes/header-browser.mjs`; 사용자 파일 후반만 `HEADER_PHASE=user node ../probes/header-browser.mjs`. 실제 빌드 Worker의 응답 전달만 보류/해제했으며 가짜 성공 결과를 주입하지 않았다. 요청·응답·종료·live DOM 변경을 별도로 기록했다. [원자료](evidence/header-browser.json).

| 항목 | 판정·재현 출력 | 수정 지시 문안 |
|---|---|---|
| 파일·시트별 수동→후보→1 | Candidate4 수동5, Candidate2 수동1 독립 복원. Uncertain·None 각각1. 다른 시트 숫자 이월0 | 없음 |
| 새 파일·swap | `[suggested4,manual5]`로 파일·시트·source 함께 swap. 같은 이름의 새 File도 이전 manual1/8을 물려받지 않고 자기 suggested1 | 없음 |
| 수동 우선·늦은 캐시 응답 | 수동5 보류→수동6 새 요청→옛5 해제 시6 유지. 수동7 보류 중 캐시1 선택 후7 해제해도 manual1 유지 | 없음 |
| stale finally / busy | 옛5 종료 후 새6 대기 중 compare/swap 계속 disabled. 새6만 종료하면 두 버튼 활성 | 없음 |
| 제거·교체·쌍삭제·unmount | 각 취소에서 terminate 증가. 옛 파일 응답 해제 중 새 파일 busy 유지. 쌍 제거·화면 이탈 뒤 늦은 응답 적용/오류0 | 없음 |
| token·File identity | `inspectionRequests.ts:17–30` 단조 token·동일 File 검사, 이전 finish=false. 같은 이름 새 File 실브라우저 반례 통과 | 없음 |
| pre-abort·읽기 직후 abort | unit 실제 실행: pre-abort에서 file read0·worker생성0, 읽기 안에서 abort해도 worker생성0 | 없음 |
| 미감지 안내 | uncertain·none의 visible guidance 동일, 초기값1. “1행 감지 성공”·내부 reason 안내0. 사용자 시트 이름은 제품 내부 코드 노출로 세지 않음 | 없음 |
| aria-describedby | 입력마다 현재 안내+지속 도움말 두 ID, 대상 DOM 모두 존재 | 없음 |
| polite1회 | 최초 한 파일마다 role=status·aria-live=polite 추가1회(두 파일2). 시트 이동·캐시·미캐시 응답 추가알림0. 수동 변경시 해당 status 제거, 예전 suggestion 재적용0 | 없음 |
| 수동 안내 | manual5 등은 “선택한 머리글” / “Selected header”를 유지 | 없음 |

ko/en 캡처: [한국어 미감지](evidence/headers-ko-fallback.png), [영어 제안](evidence/headers-en-suggested.png). 직접 열어 열명 확인·수동 변경 안내와 레이아웃을 확인했다. 내부 기술명/원시 예외를 앱 안내에 표시하지 않는다. 접근성 증거는 DOM·브라우저 AX 트리·대비 측정이며 특정 스크린리더의 실제 음성 청취를 했다고 주장하지 않는다.

**사용자 파일 실제 화면**

지정한 `/tmp/worklazy-userfiles/` 읽기 전용 사본 두 개만 사용했고 파일명/개인정보가 포함된 캡처는 `evidence/private/`에 둔다. 자동 제안 상태에서 비교를 눌렀으며 row4 결과를 화면에 주입하지 않았다. ko/en 양쪽 결과가 같다.

| 자동선택/키 | 중복 그룹·표행 | matched | changed | added | removed |
|---|---:|---:|---:|---:|---:|
| suggested4 / B(이름) | 0/0 | 703 | 37 | 48 | 0 |
| suggested4 / A(No) | 6/6 | 486 | 134 | 31 | 0 |

각 A그룹은 좌2·우2 원본행/값 네 배열을 보존하며 scalar 위치는 null이다. 키1의 좌 원본행 `[5,73]`, 우 `[5,79]`; 키2~6도 각각 한 결과행이다. 기본 닫힘 DOM0 → 좌펼침2 → 우도펼침4로 독립성을 직접 확인했다. [4행·B열 선택](evidence/private/user-ko-suggestion4.png), [B열0 실제 화면](evidence/private/user-ko-B0.png), [A열6 좌우 목록 한국어](evidence/private/user-ko-A6-lists.png), [영어](evidence/private/user-en-A6-lists.png). 표시 내부 identity 접두사0, 페이지 오류0.

**기존 결함과 귀속 — 이번 단계 비차단**

| 귀속 | 관측·인과 근거 | Claude 취합용 후속 문안 |
|---|---|---|
| BL01 기존 목록 최종소진 초점 | S2에서 남긴 계약: 마지막 더보기 DOM 제거 뒤 BODY. 해당 소비 코드와 초점 계약은 변경 없음 | 별도 접근성 백로그에서 마지막 페이지 로드 뒤 초점 목적지를 정할 것 |
| BL02 기존 한국어 guide 시트명 나열 잘림 | 현재 캡처에도 연속 영문 시트명 나열이 카드 끝에서 잘림. S2 기록·기준선에 이미 존재 | guide 줄바꿈·표현 수리 후 해당 범위 기준선 갱신 |
| BL03 기존 desktop 상단 라벨/링 일부 가림 | S2가 명시한 고정 chrome 없는 desktop의 부분 가림 정책 부채 | 기존 desktop 초점 백로그 유지. 모든 desktop 링이 완전 노출된다고 확대 승인하지 않음 |
| **BL04 기존 XLSX/XLSM error→string 타입 소실** | 정상 OOXML 오류 셀 `B1=#DIV/0!`, `C1=#N/A`와 문자열 `A1=ID`, 아래2행 데이터. XLSX/XLSM 파서는 두 오류를 `type:string`으로 바꿔 **suggested1**. XLS/XLSB/SpreadsheetML은 type:error를 보존해 **uncertain/null**. type만 원래대로 보존한 대조군은 uncertain. `inputAdapter.ts` 전체 SHA가 main597a92f·부모bdd09a7·대상657dec8에서 모두 동일 | **spreadsheet-core 백로그**: ExcelJS 경로의 실제 원시 오류 타입을 보존하고, 진짜 오류 셀과 텍스트 `#N/A`를 구별하는 형식별 회귀를 추가할 것. 문자열 패턴 블랙리스트로 감지기에서 우회하지 말 것. S3의 순수 detector 조건 구현과 구분하며 기존 어댑터 결함이므로 S3를 막지 않음 |

BL04 재현: `node --experimental-strip-types ../probes/error-types.mjs`; [5형식 출력](evidence/error-types.json), [세 기준 동일 SHA](evidence/error-provenance.json), 합성 오류 파일 `evidence/errors.*`. 이 반례를 감지 규칙 전체의 무조건적 end-to-end 통과로 세지 않는다. 고정23패턴에는 실제 오류 타입 입력이 없어 138/138과 이 결함은 동시에 성립한다. 추적 파일 수정 금지이므로 `docs/backlog.md`와 `docs/review-notes.md`를 직접 편집하지 않고 위 문안을 취합 입력으로 남긴다.


BL05 **기존 검색 입력의 고정 헤더 회피 누락**도 별도 백로그다. 원본 side-effects의 첫 ko-light-390 준비 단계에서 검색 INPUT 중앙이 헤더에 가렸다(전체72상태 중71가시). 실제 Tab으로 검색 INPUT에 진입하는 독립 반례에서도 ko/en 각각 `y=44.5/44.53125`, header bottom63, center hit HEADER였다. `data-testid=excel-result-search`의 마크업 SHA는 main597a92f·부모bdd09a7·대상657dec8 모두 `3816d14a…bf6e397`로 같고 onFocus 보정이 없다. S3는 검색/결과 마크업과 초점 함수도 바꾸지 않았다. [동일 코드](evidence/search-provenance.json), [재현](evidence/search-backlog.json), `node ../probes/search-backlog.mjs`. **후속: 결과 검색 입력까지 고정 chrome 회피 범위를 확장할지 별도 계약으로 정할 것.** 프로그램적 초기 focus를 포함한 원본 전체 수치를 432/432라고 쓰지 않으며, 아래 실제 키보드 결과 경로와 구분한다.

**앞 단계 계약의 되돌림 검사**

`side-effects.mjs`, `side-effects-resize.mjs`, `overlap-review.mjs` 원본 코드는 무수정이다. 읽기 전용 bind로 archive 코드/의존성과 이번 evidence 출력만 연결했다. 자동 감지 전의 원본 시나리오 입력은 사용자 파일 **1행/B열**이므로, 별도 `legacy-lib.mjs`에서 공개 UI로 각 행을 수동1로 선택하는 준비 과정만 보충했다. 감지4/B열 그대로 두면 중복0이 되어 초점 버튼을 검사할 수 없다는 입력 차이를 숨기지 않는다. 원본의 교정 제거 대조군은 통과 수에 넣지 않는다. 재현은 `python3 ../probes/original.py node <원본절대경로>`이며 원문/원본 SHA 보존은 종료 불변 검사에 포함한다.

| 항목 | 판정·실측 | 수정 지시 문안 |
|---|---|---|
| 포인터 추가 로드·닫힘 | mouse/touch4동작 각각 ΔY0·늦은 이동0·보정0회. 추가100항목, 닫힘DOM0 | 없음 |
| 실제 키보드 결과 경로 | 390/819/820/821/1365/320 각각 준비search 제외68/68 중앙·focus-visible. 원본 전체는390 71/72, 나머지각72/72 | 준비search1건은 BL05, 새 결과 버튼 결함 없음 |
| 819/820/821 라벨·링 | 3폭×4프로필×왼쪽Tab/Enter =24/24, 라벨·중앙·3px링 가시 | 없음 |
| 활성 초점 resize | 820→821→820→819→820, 4프로필16/16 중앙·라벨·링 가시 | 없음 |
| 320 시작 모서리 | ko −42px1회·시작간격4px, en −22.796875px1회·4.203125px. 왕복0·높이44 | 없음 |
| 1365 정상 보정 | 전체72상태 중앙가시, 제품 보정0. 문구 추가로 문서 scrollY 절대값이 달라진 것을 레이아웃 불변으로 주장하지 않음 | 기존 BL03 유지 |
| 기존 겹침 | 원본 focus-contract 실패[]; 현재4프로필의13상태씩52/52에서9점 가시(명명된 결과 버튼만48/48) | 없음 |
| 긴 목록·대화상자 | 연속Tab200/200 중앙가시, 원본 Enter/Escape 경로 유지. 최종소진 BODY4/4는 BL01 | 없음 |
| 엔진·보고서 의미 | 전체unit396/396·Excel 스모크 통과. 네 배열·displayKey 일반행 포함·그룹수·독립50/50·닫힘0·전체검색·501그룹→초기500·전체값 dialog·분할 formatter·ko/en 긴키오류 유지 | 없음 |
| 선행 배포 안전화 표면 | engine/report/duplicateReport/reportIntegrity/inputAdapter/workerLifecycle/xlsxReport/DataRows와 package/lock·AppShell/global.css가 부모와 SHA동일. worker compare/report 검증 분기는 무변경 | 없음. 전체공유 writer 스모크는 S4로 이월 |

[초점 집계](evidence/focus-summary.json), [side-effects 원출력](evidence/side-effects-original.log), [resize](evidence/resize-original.log), [겹침](evidence/overlap-original.log), [제품 표면 SHA](evidence/provenance-code.json). 알고리즘·상태 변경과 무관한 기존 부채가 관찰됐다고 앞 단계 전 범위를 재실행하지 않았다.


**실행 게이트와 저장소 불변**

첫 행동으로 공통 PROJECT_RULES.md 전문을 읽고 AGENTS, 검수/착수 지시서, v3 정본과 R2-03, sol REPORT·evidence, S2 4차 검수와 관련 review-notes의 기각 이력을 읽었다. 대상 HEAD·브랜치가 지정값과 일치했고 시작 status는 비어 있었다. 대상에는 ignored `docs/jobs/todo`가 없으므로 S0에 보존된 열린 계획19개를 스캔했다. 현 작업에 상반된 실행 지시는 없었고, 금지된 원 트리의 미커밋 계획을 실시간 스캔했다고 주장하지 않는다([스캔](evidence/open-plans-scan.txt)).

archive 시작2414파일을 대상 파일 SHA와 대조해 차이0이었다. node_modules는 대상의 독립 디렉터리에서 `cp -a --reflink=auto`로 복사했다. 설치·의존 추가·별도Git 초기화·checkout은 하지 않았다. 명령은 Node22.17.1·`NODE_OPTIONS=--max-old-space-size=4096`, `TEST_BASE_URL=http://127.0.0.1:4350`, `--strictPort`, visual concurrency1로 직렬 실행했다. 출력·임시 파일·npm cache는 이 작업의 /tmp 디렉터리로 보냈다. production/QA 각각 entry JS·CSS·Excel page·Excel worker의 HTTP bytes가 사본dist와 같았다([production](evidence/provenance-production.json), [QA](evidence/provenance-qa.json)).

원 트리의 필수 공통규칙 첫 읽기 외에는 원 워킹트리, `/tmp/worklazy-xr*`, `/tmp/worklazy-dc-impl` 및 해당 잡 포트에 접근하지 않았다. 사용자 파일은 지정 사본만 읽었고 fixture로 커밋하거나 외부로 보내지 않았다. 원본 probe의 코드·입력은 ro bind, 출력은 이번 evidence로 연결했다. 수동1 준비용 bridge는 새로운 별도 probe이며 원본세부시나리오/판정식은 바꾸지 않았다.

**검증 중 실패·보정의 정직한 기록**

- 첫 `npm run test:unit`: **395/396, exit1**. archive에 `.git`이 없어 기존 app-shell의 `git ls-files` 기반 검사1개가 실행 실패했다. `GIT_DIR`은 읽을 메타데이터, `GIT_WORK_TREE`는 archive, `GIT_INDEX_FILE`은 /tmp 복사 인덱스, `GIT_OPTIONAL_LOCKS=0`으로 분리해 동일 unit 명령을 실행하자 **396/396, exit0**. 테스트/제품 소스는 수정하지 않았다. [첫실패](evidence/unit.log), [실행환경](evidence/git-test-environment.json), [재실행](evidence/unit-archive-index.log).
- 독립 header-browser 첫 검사: 일반 영어 문장 `suggested header`까지 내부 reason 노출로 잡은 **검수 probe의 과도한 정규식**이었다. 사용자에게 읽히는 정상 제안 표현은 허용하고 원시 reason 단독노출을 검사하도록 probe만 보정했다.
- 같은 이름 File identity 실험의 첫 fixture는 CSV bytes에 `.xlsx` 확장자를 붙여 기대한 성공응답 대신 안전한 파일오류로 끝났다. 정상 XLSX로 직렬화한 새 파일로 바꿔 교체경쟁을 통과했다. 제품 오류로 분류하지 않는다.
- 위 독립검사는 상태/취소 전체를 통과한 뒤 `display:contents` 페이지 root의 element screenshot이 사각형을 갖지 않아 캡처 단계에서 중단됐다. 사용자 후반만 full-page 캡처로 실행했다. 이전 상태실측을 버리거나 중복 통과로 세지 않았다. 각 실패로그와 최종 원자료를 보존했다.
- 추가 실제 오류셀 반례의 XLSX/XLSM 의미 실패는 위와 달리 **제품의 기존 BL04**다. 테스트 실행 exit0은 관측기 실행 성공이며 해당2형식의 판정이 올바르다는 의미가 아니다.
- 원본 검색 준비 단계 가림과 별도 실제Tab 재현은 **BL05**로 남겼다. 전체432상태 가시라고 과장하지 않았다.

**S4 착수 조건·병합/배포 후보 판정**

Claude가 이 범위 검수 판정과 기존 백로그 귀속을 채택하고, 실제 통합 대상 HEAD와 열린 계획 충돌을 확인한 **S4 정본 지시서**를 발행하면 최종 통합에 착수할 수 있다. 이번 검수는 S4를 실행하거나 main에 병합하지 않았다. S1+S2의 결과 스키마/소비처 전환과 S3의 후보/수동우선 상태를 함께 유지한 **S1~S3는 병합·배포 후보**다. 아래 최종 게이트 전에는 실제 배포 완료/승인으로 해석하지 않는다.

병합될 정확한 최종 산출물에서 다음을 **1회 최종 회귀 묶음**으로 실행한다. 이번 좁은 검증으로 대체하지 않는다.

- `./node_modules/.bin/tsc -b`, `npm run test:unit`, `npm run test:excel-compare`.
- 전체 `npm run test:browser`, `npm run test:excel-cleaner`, `npm run test:qr-bulk` 및 통합변경이 요구하는 나머지 도구 스모크.
- production `npm run build` 후 `npm run test:static`.
- `VITE_LOCAL_QA=1 npm run build` 후 결과상태 포함 통합범위 visual 및 전체 `A11Y_MAX_TOTAL=0 npm run test:a11y`. incomplete는 별도 수동판정·기존/신규 귀속.
- `BUNDLE_BASELINE=/tmp/worklazy-excel-s0/evidence/bundle-baseline.json npm run bundle:measure` — S0 baseline SHA `726a2d5be21ca250c76a5a9c9220affb8931da9286769f762f3531fd64d002c8` 유지, 예산/귀속 임의 증가 금지.
- `npm run css:orphans`, `node tests/tool-registry-routes.mjs`, `git diff --check`, 정본의 repo-wide 실행확장자/최소허용목록 계약 검사.
- 추적코드를 제외한 로컬 QA **실제 결과 화면의 Gemini 직접 시각 검수**와 Codex 실측 교차, 최종 통합·배포 게이트.

이번 실행에서 하지 않은 금지목록은 정확히 전체browser·qr-bulk·excel-cleaner·test:static·전체a11y·bundle:measure·css:orphans·tool-registry-routes이다. 검수에 요구된 전체unit 내부의 골든시험이 실행된 사실과 이 전 스코프 명령들의 이월을 구분한다.

**고정 main597a92f 대비 공동 표면**

`git merge-base --is-ancestor 597a92f 657dec8` exit0: 고정main은 대상의 조상이므로 이 고정 쌍 자체에는 분기충돌이 없다. main→S1~S3 **47파일 +3178/−120**, S3만 **39파일 +1036/−61**([main diff](evidence/main-diff.txt), [S3 diff stat](evidence/diff-stat.txt)). 금지된 U4 워킹트리나 다른 잡의 현재 미커밋 코드는 읽지 않았으므로 실제 미래 clean merge를 보장하지 않는다.

| 공동 표면 | 통합 때 확인할 내용 |
|---|---|
| ExcelComparePage·engine·report·detector·inspection·pairFiles·전용tests | S1~S3의 한 전환 단위. PDF 전용 feature와 직접 교집합 없음 |
| `src/app/seo.ts`, ko/en `features.json`·`tools.json` | U4/PDF와 파일 공유 가능. Excel 후보/FAQ와 PDF 등의 문구/SEO를 서로 덮지 않고 보존 |
| accessibility-audit·관련unit, visual scenarios·config unit | U4 등 결과페이지 등록/기대목록과 합쳐지는 표면. Excel9개 a11y 선택 및 중복결과 시나리오 보존 |
| `CHANGELOG.md`, `docs/review-notes.md` | 양쪽 기록 취합, 이 보고서의 BL04/05는 `docs/backlog.md` 귀속 |
| 공유writer/DataRows, package/lock, AppShell/global.css | 이번 전환의 안전화보존 표면. 다른 잡에서 바뀐 부분을 통합할 때 별도 회귀 확인 |

**QA 시각·접근성 실측**

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| Excel 시각 | 통과 | `VISUAL_ONLY=excel-compare VISUAL_CONCURRENCY=1 npm run test:visual`, **16/16 일치**, 기준선 수정0 | 없음. 기존 BL02/03까지 정상으로 승인하지 않음 |
| Excel axe | 자동 위반0, 대비 자동보류 유지 | `A11Y_ONLY=excel-compare A11Y_MAX_TOTAL=0 npm run test:a11y`, **9페이지·위반0·외부요청0**, `incomplete=color-contrast` **9규칙/586노드** | 자동 보류는 통과에 넣지 않고 기존 대비 부채/최종 S4 수동판정 목록 유지 |
| 새 머리글 안내 | 별도 수동계산 통과 | `node ../probes/header-a11y.mjs`, ko/en×light/dark×desktop/mobile×suggested/fallback **16상태**, guidance/help/input 세대상48측정. 최소 light **5.272954:1**, dark **5.732903:1** | 없음. 이48측정으로 나머지586노드가 해결됐다고 하지 않음 |

[시각 실행 로그](evidence/visual-excel.log), [axe 원자료/보류 selector](evidence/a11y.json), [요약](evidence/a11y-summary.json), [새 안내 AX·색상계산](evidence/header-a11y.json). 계산은 Chrome canvas로 CSS색을 sRGB에 그린 후 조상 배경 alpha 합성과 상대휘도로 확인했다. 실제 캡처의 ko-light-mobile 중복결과·en-dark-desktop 중복결과, ko-dark-mobile fallback·en-light-mobile suggested와 앞의 사용자 결과 캡처를 직접 열었다. baseline 재일치는 특정 기준선에 대한 일치이며 기존 부채를 해결했다는 뜻이 아니다.

**실행 명령 기록**

cwd는 `/tmp/worklazy-xd-s3-review/main`. `python3 ../probes/check.py <이름> <명령...>`이 stdout/stderr·exit·시간을 저장했다. [기계 기록](evidence/checks.jsonl). 상위focus/QA queue도 직렬이며 fail-fast다.

| 이름 | 실제 명령 | exit | 초 | 원출력 |
|---|---|---:|---:|---|
| tsc | `./node_modules/.bin/tsc -b --pretty false` | 0 | 19.144 | [tsc.log](evidence/tsc.log) |
| unit | `npm run test:unit` | 1 | 4.278 | [unit.log](evidence/unit.log) |
| detector | `node --experimental-strip-types ../probes/detector.mjs` | 0 | 1.059 | [detector.log](evidence/detector.log) |
| unit-archive-index | `python3 ../probes/unit.py` | 0 | 4.389 | [unit-archive-index.log](evidence/unit-archive-index.log) |
| provenance-code | `python3 ../probes/provenance.py code` | 0 | 0.155 | [provenance-code.log](evidence/provenance-code.log) |
| build-production | `npm run build` | 0 | 106.649 | [build-production.log](evidence/build-production.log) |
| provenance-production | `python3 ../probes/provenance.py production` | 0 | 0.119 | [provenance-production.log](evidence/provenance-production.log) |
| smoke-compare | `npm run test:excel-compare` | 0 | 77.126 | [smoke-compare.log](evidence/smoke-compare.log) |
| provenance-code-correct-paths | `python3 ../probes/provenance.py code` | 0 | 0.162 | [provenance-code-correct-paths.log](evidence/provenance-code-correct-paths.log) |
| header-browser | `node ../probes/header-browser.mjs` | 1 | 9.228 | [header-browser.log](evidence/header-browser.log) |
| header-browser-v2 | `node ../probes/header-browser.mjs` | 1 | 73.554 | [header-browser-v2.log](evidence/header-browser-v2.log) |
| header-browser-v3 | `node ../probes/header-browser.mjs` | 1 | 20.165 | [header-browser-v3.log](evidence/header-browser-v3.log) |
| header-browser-user | `env HEADER_PHASE=user node ../probes/header-browser.mjs` | 0 | 15.18 | [header-browser-user.log](evidence/header-browser-user.log) |
| error-types | `node --experimental-strip-types ../probes/error-types.mjs` | 0 | 0.725 | [error-types.log](evidence/error-types.log) |
| provenance-production-feature | `python3 ../probes/provenance.py production` | 0 | 0.122 | [provenance-production-feature.log](evidence/provenance-production-feature.log) |
| side-effects-original | `python3 ../probes/original.py node /tmp/worklazy-xd-s2-review3/probes/side-effects.mjs` | 0 | 568.56 | [side-effects-original.log](evidence/side-effects-original.log) |
| resize-original | `python3 ../probes/original.py node /tmp/worklazy-xd-s2-review3/probes/side-effects-resize.mjs keyboard` | 0 | 88.889 | [resize-original.log](evidence/resize-original.log) |
| overlap-original | `python3 ../probes/original.py node /tmp/worklazy-xd-s2-review2/probes/overlap-review.mjs` | 0 | 40.926 | [overlap-original.log](evidence/overlap-original.log) |
| motion-contract | `python3 ../probes/original.py python3 /tmp/worklazy-xd-s2-review3/probes/motion-contract.py` | 0 | 0.243 | [motion-contract.log](evidence/motion-contract.log) |
| overlap-contract | `python3 ../probes/original.py python3 /tmp/worklazy-xd-s2-review2/probes/focus-contract.py` | 0 | 0.073 | [overlap-contract.log](evidence/overlap-contract.log) |
| focus-summary | `python3 ../probes/focus-summary.py` | 0 | 0.215 | [focus-summary.log](evidence/focus-summary.log) |
| search-backlog | `node ../probes/search-backlog.mjs` | 0 | 10.451 | [search-backlog.log](evidence/search-backlog.log) |
| build-qa | `env VITE_LOCAL_QA=1 npm run build` | 0 | 95.768 | [build-qa.log](evidence/build-qa.log) |
| provenance-qa | `python3 ../probes/provenance.py qa` | 0 | 0.134 | [provenance-qa.log](evidence/provenance-qa.log) |
| visual-excel | `env VISUAL_ONLY=excel-compare VISUAL_ARTIFACT_DIR=../evidence/visual VISUAL_CAPTURE_DIR=../main/tests/visual-artifacts/s3-review-excel npm run test:visual` | 0 | 43.888 | [visual-excel.log](evidence/visual-excel.log) |
| a11y-excel | `env A11Y_ONLY=excel-compare A11Y_MAX_TOTAL=0 A11Y_REPORT_PATH=/tmp/worklazy-xd-s3-review/evidence/a11y.json npm run test:a11y` | 0 | 43.974 | [a11y-excel.log](evidence/a11y-excel.log) |
| header-a11y | `node ../probes/header-a11y.mjs` | 0 | 21.215 | [header-a11y.log](evidence/header-a11y.log) |
| final-state | `python3 ../probes/final-state.py` | 0 | 2.213 | [final-state.log](evidence/final-state.log) |


**종료 검증** — 시작/종료 HEAD·브랜치·status 동일(clean), **대상 2414파일·archive 2414파일 변경0**, 사용자 사본3개 변경0, 보호한 원본probe/계획 입력 **461파일 변경0**. `4350~4359` listener0. [시작](evidence/state-start.json), [종료](evidence/state-finish.json), [불변 요약](evidence/invariance.json). 생성/검증 산출물은 모두 이 `/tmp/worklazy-xd-s3-review/` 아래에 있으며 원본probe/계획/사용자파일은 수정하지 않았다.

**최종 판정: [검수 통과]** — 이번 범위의 새 차단 수정요청0. BL01~05 및 대비 자동보류는 위 백로그/S4 귀속을 유지한다. S1~S3 병합·배포 후보, 실제 통합·배포는 S4 최종 게이트 후 별도 수행.
