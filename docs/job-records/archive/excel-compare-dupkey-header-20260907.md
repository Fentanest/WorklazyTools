# 작업지시서 초안 — Excel 비교: 중복키 한 행 묶기 · 머리글 행 자동 감지 (2026-09-07, v1 Claude 초안 — 정본 아님)

> 2026-09-07 사용자 신고·결정에서 출발. **선행 정본**: `excel-compare-20260903.md`(U1 본체) · `excel-compare-followup-20260903.md`(X-A/B/C). 이 문서는 그 정본을 **보완**하며, 충돌 시 이 문서가 우선한다.

## 0. 사용자 신고·결정
- 신고(12:45): ① 중복키가 좌·우 별도 행으로 나와 같은 열에서 못 본다 ② 보고서가 시트명만 있고 내용이 없다 ③ "이거 계획 짜서 수정하지 않았나?"
- Claude 실측 회신 후 **결정(13:5x)**: **(가) 같은 키를 한 행으로 묶어 왼쪽 n건·오른쪽 m건을 나란히 표시** · **(나) 머리글 행 자동 감지 추가**.
- ②(빈 보고서)는 **별도 브랜치 `excel-report-width-20260907` 에서 선행 수정 중** — 이 문서 범위 밖(단, 같은 파일 `report.ts` 를 건드리므로 **그 작업이 main 에 들어간 뒤 착수**).

## 1. 실측 사실 (2026-09-07 Claude, 재현 파일 `dummyfortest/2026년 설 선물 발송처_20260204_취합중.xlsx` · `…_취합_송창훈.xlsx` — **CI 참조 금지·커밋 금지**)
| 사실 | 값 |
|---|---|
| 시트 | 양쪽 `최종` 1개. dimension `A1:J78`(좌) |
| 실제 머리글 | **4행** `No | 이름 | 소속 | 주소` |
| 1~3행 | 1행 빈 줄 · **2~3행은 병합 제목 `A2:I3`** `□ 2026년 설명절 선물 발송처(대외, 임직원)` |
| 도구 기본 머리글 행 | **1**(`ExcelComparePage.tsx:381` `leftHeaderRow: 1, rightHeaderRow: 1`) |
| 사용자 실행 파라미터 | `mode=key`, `keyLeftColumns=2`·`keyRightColumns=2`(B열), `duplicateKeyPolicy=error` |
| 관측된 중복키 | **4건**(좌 2·3행, 우 2·3행) — 키가 전부 병합 제목 문자열 |
| 원인 | 머리글 행 1 → 2·3행이 데이터가 되고, `A2:I3` 병합으로 **B열에도 제목 값이 채워져** 같은 키 2회 |
| 실데이터 중복(5행~) | **B열(이름) 중복 0**(좌 74행·우 80행) / **A열(No) 중복 6종** — 73행(한병준)부터 번호가 다시 1로 시작 |
| 중복 표시 구조 | `compareEngine.ts:125-126` 이 좌측 행마다·우측 행마다 **별도 레코드**를 push(정본 "동일 키 다수 시 첫 행 임의 연결 금지" 준수) |
| 레코드 스키마 | `ExcelCompareRecord` 는 `leftRow`·`rightRow` 단일 숫자 — 다중 행을 담을 자리가 없다 |
| 검사 경로 | `inspectExcelCompareFile(file, lang, signal, headerRows=[1])` → worker 가 요청받은 행들의 헤더 문자열만 반환. **자동 감지 없음** |

## 2. 설계 초안
### 2-A. 중복키 한 행 묶기 (사용자 결정 가)
- **레코드 확장**: `ExcelCompareRecord` 에 선택 필드 `leftRows?: number[]`·`rightRows?: number[]`·`leftValues?: string[]`·`rightValues?: string[]` 를 추가하고, 중복 레코드는 **키당 1건**으로 emit. 기존 `leftRow`/`rightRow` 는 **첫 행**(또는 단일 행일 때만) 유지해 하위 호환. 다른 상태(matched/changed/…)는 스키마·동작 불변.
- **임의 연결 금지 유지**: 한 행에 묶어도 **좌 i번째 ↔ 우 j번째를 짝지었다고 표시하지 않는다**. "왼쪽 n건 / 오른쪽 m건" 을 각각 나열한다.
- **표시**: 화면은 좌/우 셀에 각각 행 번호 목록과 값 목록(줄바꿈 또는 `n건` 접기), 상태 배지 `중복키`, **사유 안내**(자동 연결하지 않는 이유 + 보조키/발생 순번 정책 안내) ko/en.
- **보고서 `Duplicates` 시트**: 13열 스키마 유지. `Left row`·`Right row` 에 **쉼표 구분 행 목록**, `Left value`·`Right value` 에 값 목록. 열 이름·시트 9개 구성은 **불변**(`REPORT_TOPOLOGY_INVALID` 계약 유지).
- **요약 수 변화**: `summary.duplicate` 가 "레코드 수" 에서 "중복 키 수" 로 바뀐다 → **의미 변경을 정본·화면·기록에 명시**하고 기존 골든 기대값 동반 갱신.
- 정책 `secondary`·`occurrence` 경로는 **변경 없음**(중복이 duplicate 레코드로 가지 않음).

### 2-B. 머리글 행 자동 감지 (사용자 결정 나)
- **감지 시점**: 파일 선택 후 `inspect` 응답에서 시트별 후보를 산출해 **기본값으로 제안**하고, 사용자가 언제든 바꿀 수 있게 한다(자동 확정이 아니라 **초기값 제안** — 정본의 "자동 확정 금지" 정신 유지).
- **후보 규칙 초안**(결정적·설명 가능): 상위 N행(예 1~20) 중 ① 비어 있지 않은 셀 수가 가장 많고 ② 값이 모두 문자열이며 ③ 아래 행들과 값이 겹치지 않고 ④ **병합 범위에 포함되지 않은** 행. 동점이면 가장 위. 후보 없으면 1.
- **화면**: 감지된 행을 선택 상태로 두고 "n행을 머리글로 인식했습니다 — 바꿀 수 있습니다" 안내(ko/en). 사용자가 바꾸면 그 값이 우선하고 재감지하지 않는다.
- **worker 계약**: `inspect` 가 후보 행 번호와 근거 코드를 함께 반환(내부 코드는 비노출, 화면 문구는 행동 중심).
- 병합 셀 처리: 병합 범위의 값이 하위 행에 채워지는 현행 동작은 유지하되, **감지에서 병합 행을 제외**해 이번 사례가 재발하지 않게 한다.

## 3. 완료 기준(초안)
`npm run build` · `npx tsc -b` · `npm run test:unit`(중복키 그룹 골든·감지 규칙 단위 케이스) · `npm run test:excel-compare`(중복 3정책 회귀·감지 제안 표시) · `npm run test:excel-cleaner` · `npm run test:browser` 전체 · `npm run test:static` · `npm run test:visual`(excel-compare scenario 영향 시) · `A11Y_MAX_TOTAL=0 npm run test:a11y` · `npm run bundle:measure` · `css:orphans` · registry · `git diff --check`. **사용자 파일 수동 재현**: 머리글 자동 감지가 **4행**을 제안하고, B열 키로 중복키 **0**, A열 키로 중복키가 **한 행씩 묶여** 좌우 목록으로 표시.

## 4. 명시 제외
빈 보고서 열 너비 수정(선행 브랜치) · 중복키 자동 연결(임의 짝짓기) · `secondary`/`occurrence` 정책 동작 변경 · 보고서 시트 구성·열 이름 변경 · 대사(reconcile) 모드 · 사용자 파일의 fixture 커밋 · UI 전면 개편(별도 정본).

## 5. 반박 1차 요청(astra, 실험 모드·저장소 불변)
(a) §1 실측 재현·정정(특히 병합 `A2:I3` 로 인한 B열 중복, A열 73행 재시작, 파라미터 `keyColumns=2`). (b) 2-A 레코드 확장이 기존 소비처(화면 필터·검색·보고서·ZIP·골든·스모크)에 주는 파급과 하위 호환 대안 비교(선택 필드 vs 별도 `duplicateGroups` 배열). `summary.duplicate` 의미 변경이 기존 단언·문구에 미치는 범위. (c) 2-B 감지 규칙의 반례 수집 — 실제 스프레드시트 패턴(제목 병합·다단 머리글·빈 열·숫자 머리글·머리글 재등장·필터 행)로 결정적 규칙이 성립하는지, 상위 N·동점 처리·후보 없음의 기본값. (d) 자동 감지가 기존 `inspect` 왕복·성능·취소 계약에 주는 영향. (e) 화면 안내 문구(ko/en)의 「내부 구현 비노출」 준수와 접근성(목록 접기·스크린리더). (f) 선행 브랜치 `excel-report-width-20260907` 와의 파일 충돌 목록·착수 순서. (g) sol 재해석 지점 열거 + 정본 반영 문안.

## 왕복 기록
- v1 초안 2026-09-07 14:05 Claude. 기준 HEAD(main) `5bc6854175331bdd73b267784d9633cdccda8446`. 반박은 main 사본에서 읽기·실험(원 워킹트리 `s3-pdf-finish` 는 U4 잡, `/tmp/worklazy-dc-impl` 은 문서 비교 잡, `/tmp/worklazy-xr` 은 열 너비 잡이 사용 중 — 전부 건드리지 않는다).

---

## v2 반영 (2026-09-07 14:45, Claude — astra 1차 반박 O01~O11 **수용**, 단 O04·O06 은 Claude 판정으로 조정. 근거 `docs/jobs/todo/excel-compare-rounds/round-1-{REPORT,AMENDMENTS,CONSUMER-INVENTORY}.md`·`probes-r1/`)

**첨부 채택**: `round-1-AMENDMENTS.md`(O01~O11 문안) 와 `round-1-CONSUMER-INVENTORY.md`(소비처·단언 목록)를 **정본의 일부**로 채택한다. 아래 요약은 원문을 대체하지 않는다.

### O01 실측 정정 [수용]
좌 `A1:J78`·우 `A1:J84`. 원본 B2·B3 는 값이 없는 셀이지만 **ExcelJS 가 병합 `A2:I3` master 값을 읽어** adapter 결과에서 B2·B3 에 제목이 들어온다(내 "병합으로 B열에 값이 채워진다" 는 이 경로로 정정). 번호 재시작은 **좌 73행·우 79행**(v1 의 "73행" 은 좌측만). 조합별 기대: 머리글 1/B열 = 중복 4레코드·**1키** · 머리글 4/A열 = 24레코드·**6키** · 머리글 4/B열 = **0**. 변경 뒤 그룹 수 기대 1·6·0.

### O02 스키마 [수용, v1 2-A 하위 호환안 폐기]
`records` 안 확장을 채택하고 별도 `duplicateGroups` 배열은 쓰지 않는다. `status=duplicate` 면 `leftRows`·`rightRows`·`leftValues`·`rightValues` **네 배열이 모두 존재**하고 각 측 길이가 같으며 같은 인덱스가 **그 측의 한 행**을 가리킨다. 없는 측은 `[]`. 2:0·0:2·2:1·1:2 도 같은 규칙이고 반대편 단일 행도 그룹에 포함해 일반 비교에서 제외한다. 1:1 은 기존 비교 유지.
**v1 의 "`leftRow` 를 첫 행으로 남겨 하위 호환" 은 폐기** — 전체 값 검색 누락·대표 위치 오해를 만든다(astra 반박). 중복 레코드의 `leftRow/rightRow/leftColumn/rightColumn` 은 **`null`**, `leftValue/rightValue` 는 **빈 문자열**. 소비처를 함께 고치는 **스키마 전환**이며 무수정 하위 호환을 약속하지 않는다. 중복 레코드 전용 타입·생성 함수를 분리해 배열 누락·길이 불일치를 검출한다.
그룹 identity 는 기존 `normalizeKeyPart`·복합키 로직 그대로(빈 키·숫자/문자·공백·Unicode 의미 불변). 표시용 **`displayKey`** 를 추가하고 **첫 좌측 행(없으면 첫 우측 행)의 선택 키 열 원시 표시값**으로 만든다 — 제목 표시 전용이며 행 연결 근거가 아니고, `string:` 같은 내부 identity 를 잘라 복원하지 않는다.

### O03 소비처·집계·순서·보고서 [수용]
필터는 `records.status` 경계 유지. **검색은 접힘·표시 건수와 무관하게 그룹의 전체 좌우 값·모든 원본 행 번호·`displayKey` 를 포함**한다. React key 는 쌍 ID + 내부 key(같은 key 라도 다른 쌍이면 별개 그룹). 출력 순서는 현행 중복키 Set 순회 유지, 각 측 행은 원본 행 번호 오름차순. **500개/더보기 제한은 그룹을 1건으로 센다.**
**`summary.duplicate` = 쌍 안의 중복키 그룹 수**(의미 변경 명시). Summary 시트 `duplicate` 행 이름 유지. Parameters 에 **`duplicateCountUnit=key-group`**(키/오류 정책일 때, 그 외 `UNUSED`). 상태 배지 "중복키 / Duplicate key" 유지 + 결과 영역에 "중복 키 {{count}}개 / {{count}} duplicate key(s)"(신규 표시).
보고서 **9시트·13열 이름·순서 불변**. `Left row`/`Right row` 는 해당 측 행 번호를 `, ` 로 연결, `Left value`/`Right value` 는 `원본행번호: 행값` 을 줄바꿈으로 연결, `Key` 는 `displayKey`. 모든 사용자 값은 기존 `writeUntrustedText` 통과(수식 객체 금지). **좌우 같은 줄을 매칭했다고 설명하지 않는다.**

### O04 긴 그룹 처리 [**Claude 판정 — astra 제안 조정**]
astra 는 32,767 UTF-16 초과 시 **그 쌍 전체를 실패**시키자고 제안했다. **채택하지 않는다** — 사용자가 빈 열을 키로 고르면 전 행이 한 그룹이 되어 흔하게 발생할 수 있고, 그때 비교 결과 전체를 잃는 것은 손해가 크다. **대신**: 셀 직렬화가 32,767 을 넘으면 **그 그룹만 Duplicates 시트에서 연속 행으로 분할**한다 — 같은 `Key`(displayKey)·`Change=KEY`·`Reason=DUPLICATE_KEY` 를 반복하고 각 행에는 **그 조각의 행 번호·값만** 담는다. 9시트·13열·열 이름은 그대로이고 **데이터 손실·조용한 잘림이 없다**. 화면 결과와 쌍 성공 여부는 영향받지 않는다(그룹 수와 Duplicates 행 수가 다를 수 있음은 이미 성립).
경계 검사(32,767/32,768·줄바꿈·이모지·긴 한 행·긴 행번호 목록)는 astra 문안대로 유지하고, **분할 지점이 UTF-16 surrogate pair 를 쪼개지 않도록** 한다. 분할이 발생하면 Parameters 에 그 사실을 기록한다. — **2차 반박에서 이 대안의 실행 가능성·회귀를 검증할 것.**

### O05 성능·취소 [수용]
`groupRows` 의 `groups.set(key,[...old,row])` 전체 복사를 없애고 그룹 전용 배열에 append(순서·키 정규화·3정책 결과 동일 유지, `secondary`·`occurrence` 회귀 검증). 그룹 구성·행 값 목록·보고서 길이 검사에서 **최소 4,096개마다 취소 확인**. 전체 셀/행의 추가 사본 금지. 중복 30,000행 합성으로 append 의 결과 동일·비용 감소 기록. 이 공통 성능 수정은 "정책 의미 변경 제외" 와 양립함을 범위에 명시.

### O06 감지 알고리즘 [**Claude 판정 — astra 보수안 채택**]
v1 초안 규칙은 22패턴 중 **12개 오판**(실측). **`detectConservative` 를 v1 규칙으로 채택**한다 — 정답률을 크게 올리지는 못하지만 **틀린 확신 대신 `uncertain`/`none` 으로 물러난다**. 사용자 결정(자동 감지)의 목적은 "일반적인 표에서 초기값 제안" 이므로 이 성질이 옳다.
`headerSuggestion = { row: number | null, reason: 'suggested' | 'uncertain' | 'none' }`. `null` 이면 UI 기본값 1 을 쓰되 **"1행을 감지했다" 고 표시하지 않는다.**
규칙(astra 문안): 물리 행 1~20 후보, 바로 아래 최대 5행을 근거(샘플 최대 25행). 셀은 **원시 value 가 null 이 아니고 문자열화 후 trim 이 비지 않은 것**만 집계. 병합 메타데이터로 가로·세로 병합 행 표시. 빈 행·가로 병합 행은 건너뛴다. **비병합 셀 1개짜리 행** 아래 5행에 값 2개 이상인 행이 있으면 제목 후보로 보고 건너뛴다. 이후 **처음 만난 행 하나만** 판정: 비빈 셀 ≥2 · 비수식/비오류 문자열 셀 비율 ≥1/2 · trim 값이 서로 다름 · 같은 열들의 값이 `ceil(후보 셀 수×0.4)` 이상인 하위 행 ≥2 · 세로 병합 행 아님 → **모두 만족 시 `suggested`**, 아니면 **`uncertain` 으로 종료**(본문 아래를 계속 훑지 않는다). 후보 범위에 그런 행이 없으면 `none`.
**지원 제외 명시**: 다단 머리글 병합·합성, 상위 20행 밖 탐색, 단일열 제목 구분, 숫자만 있는 머리글 확정 — 수동 선택으로 처리. "병합 행 전체 제외" 를 모든 패턴에 안전하다고 설명하지 않는다. 입력 형식별 타입 차이(CSV 는 값이 문자열)를 판정에 반영하고 **표시값으로 전부 문자열화한 배열에 "전부 문자열" 검사를 적용하지 않는다.**
성능: 상위 25행 원시 샘플을 **한 번** 구성하고 그 안에서 순위를 산출한다. 후보마다 `spreadsheetHeaders()` 를 호출하지 않는다(현행 helper 는 전체 cells 를 훑는다). 실측 500,005셀에서 N=20/50/100 모두 ≈5.6ms — **전체 훑기가 지배적**.
고정 fixture 는 astra **22패턴**, 테스트는 후보 행뿐 아니라 `suggested/uncertain/none` 도 단언. 사용자 파일 4행 제안은 **로컬 비게이팅 확인**이며 CI 에 사용자 경로를 넣지 않는다.

### O07 파일·시트·선택 상태 [수용]
파일 선택 시 **첫 시트 후보와 그 열 이름을 같은 inspect 응답**으로 받는다. 파일·시트마다 `{row, source:'suggested'|'manual'|'fallback'}` 보관. 시트 전환은 **그 시트의 수동 선택 → 그 시트 후보 → 1** 순으로 복원(다른 시트 숫자 재사용 금지). 사용자가 바꾸면 그 값이 우선하고 다른 응답이 덮지 않는다. 새 파일에 이전 수동 상태 이월 금지. 교환은 이 상태까지 PairState 와 함께 스왑(X-B 계약).
비교 전 정수·`1..max(1,rowCount)` 검증. 편집 중 임시 입력은 별도로 두되 **NaN·소수·상한 밖 값을 pairOptions 에 넘기지 않는다.** 선택 행의 열 이름이 없는 상태로 비교 시작 금지. 머리글 변경이 데이터 범위·열 이름을 바꾼다는 안내 제공. 열 매핑 자동 재선택은 추가하지 않되 **존재하지 않는 열 번호는 준비 상태로 인정하지 않는다.**

### O08 inspect 왕복·취소 [수용]
최초 inspect **1회**에 각 시트의 후보와 기본/후보 헤더 문자열을 동봉. `candidateRow` 만 받고 재inspect 하지 않는다. 응답 `headerRows` = `[요청행들 ∪ 시트 후보행]`(중복 없음). 감지는 최초 검사에서만, 수동 행 조회는 감지 재수행·초기값 재적용을 하지 않는다. 캐시된 행은 재파싱하지 않고, 미캐시 수동 행은 전체 재파싱 1회를 허용하고 캐시 병합.
인터페이스: 기존 인자 뒤 다섯째 **`detectHeader: boolean = true`**, worker Request 에 `detectHeader?: boolean`(생략 시 true). 최초 `selectFile`=true, 미캐시 `refreshHeader`=false. `sheets[].headerSuggestion` 은 최초 응답에만 존재 가능하도록 타입 설계. 수동 응답은 기존 `headerRows` 를 시트명·행 번호로 병합하고 **기존 suggestion·수동 선택을 덮지 않는다.** 기존 기본 호출은 그대로 동작.
**쌍·측별 AbortController + 단조 증가 token.** 새 파일·제거·쌍 제거·unmount 에서 취소. 완료/오류/finally 는 `(pairId, side, File identity, token)` 이 현재와 같을 때만 반영. 모든 유효 검사 중 `left/rightInspecting` 으로 교환·비교를 막는다. signal 을 client 에 넘기고 `arrayBuffer` 전후 abort 검사. **이미 취소된 요청은 파일을 읽거나 worker 를 만들지 않는다.** 현행 worker 는 **종료형 취소**이므로 "CPU 작업 도중 cancel 메시지를 읽어 즉시 중단" 으로 설명하지 않는다. 단위 콜백 취소와 terminate 취소를 각각 검증하고, 오래된 응답의 finally 가 새 검사 busy 를 지우지 않는지 확인.

### O09 화면·접근성 [수용]
중복은 **한 결과 행 안의 좌·우 두 독립 목록**. 각 목록은 "왼쪽 {{count}}건 보기 / Show {{count}} left row(s)" 의 native `details/summary` 또는 동등 button. **0건은 "왼쪽 0건 / No left rows" 텍스트**로 표시하고 빈 접기 버튼을 만들지 않는다. ko/en plural 처리.
접힘이 기본이며 **닫힌 목록은 내용 DOM 을 만들지 않는다.** 펼침 시 측별 처음 50개, 추가 50개씩. **검색은 DOM 에 없는 전체 값을 조회.** 항목은 행 번호와 값을 붙여 읽히게. 긴 값은 줄바꿈/`overflow-wrap`, 잘림 시 키보드로 여는 "전체 값 / Full value" 대화상자(이름·Escape·초점 반환 검사). hover/title 만으로 접근하게 하지 않고, 펼침 제어 안에 다른 버튼을 중첩하지 않는다.
사유·감지 안내 문구는 astra 문안 그대로 채택(ko/en 4종 + 사용자 선택 후 "선택한 머리글: {{row}}행"). `aria-describedby` 연결, 비동기 제안은 polite status 로 1회. **"인식했습니다 / detected" 같은 확정형 표현 금지.** 내부 reason code·타입 접두사·원시 예외·광고/격리 상태를 사용자 문구에 넣지 않는다.

### 선행 브랜치 정정 [수용]
선행 커밋은 **`ac9cc4a2638aeb497a69668079be050786e6edf7`** 이고 **`report.ts` 는 변경 파일이 아니다**(v1 의 충돌 설명 정정). 실제 교집합은 worker·비교 스모크·비교 unit·기록 + 공유 writer/validator 의 의미 의존성(`round-1-CONSUMER-INVENTORY.md` 표). `excel-report-width-20260907` **main 병합 후 최종 기준 해시를 새로 기입**하고 실행 게이트 재검사. xlsxReport 의 유한 너비 계산과 reportIntegrity 가시성 검사를 보존하고 signature 변경이 있으면 현행 호출에 맞춘다. Duplicates 의 빈/단일/복수/긴 값·실다운로드·ZIP 내 XLSX 모두에서 너비 검사가 함께 통과해야 하며 Excel Cleaner·QR 보고서에도 공유 writer 회귀를 돌린다.

### O10 실행 명령 [수용]
**production 과 QA 산출물 검증을 분리**한다 — `VITE_LOCAL_QA=1` 빌드에는 Analytics 가 없어 `test:static` 이 실패하고, 현행 Excel compare 스모크는 광고 스크립트 존재를 단언한다. 환경 플래그만 켜고 모두 통과한다고 쓰지 않는다. 설치 미허용 작업에서는 `npx tsc -b` 대신 **`./node_modules/.bin/tsc -b`**. `bundle:measure` 는 자체 빌드를 하므로 브라우저 종료 뒤 실행. 명령 전문은 `round-1-AMENDMENTS.md` O10 블록 그대로.

### O11 제품 영향·완료 기준 [수용]
ko/en `features.json` 의 상태 안내·접기·전체 값·미감지·머리글 안내와 guide/FAQ 갱신. 가이드의 "키·보조키·발생순서" 설명에 **한 행 묶기의 비매칭 의미**와 후보 확인·수동 변경을 추가. `seo.ts`·registry·ko/en `tools.json`·정적 생성기의 Excel compare 설명/FAQ 입력 점검(기능 설명이 바뀌는 부분만). **URL·canonical·hreflang·사이트맵 집합 불변**, 새 경로·광고 예외 신설 금지, 생성 HTML/사이트맵/벤더 수기 수정 금지.
완료 회귀 5군: ① 중복 2:3·2:1·2:0·0:2·1:1·빈 키·정규화·복합키·복수 쌍·그룹 순서 ② 접힌 마지막 값/원본 행번호 검색·필터·500개 더보기·양측 독립 펼침 ③ Duplicates 13열·9시트·Summary·Parameters·주입 문자열·**한도 경계(분할 포함)**·선행 유한너비/가시성 검사·실다운로드·ZIP 재개방 ④ 감지 22패턴 및 XLSX/XLSM·XLS·XLSB·SpreadsheetML·CSV 각각의 타입/병합/빈행 경로와 다중 시트·수동 왕복·교환·검사 완료 역전·제거/unmount·pre-abort ⑤ ko/en × desktop/mobile × light/dark **결과 상태**의 시각·접근성(빈 상태만 보는 현행 검사로 대체 불가).

### 2차 반박 요청(astra)
(i) v2 가 O01~O11 을 누락·왜곡 없이 반영했는지 문장 단위 대조. (ii) **O04 대안(연속 행 분할)** 의 실행 가능성 — 13열·9시트 불변, surrogate 안전 분할, Parameters 기록, 화면·ZIP·무결성 검사와의 정합, 극단 입력(빈 열 키로 전 행 1그룹, 10만 행)에서의 비용·동작. 실패 계약(쌍 실패)보다 나은지 반례로 판정. (iii) **O06 보수안 채택** 후 남는 오판 패턴의 사용자 영향과 안내 문구가 충분한지, `uncertain`/`none` 의 UI 동작이 O09 문구와 정합하는지. (iv) O02 스키마 전환의 소비처 변경 목록이 `CONSUMER-INVENTORY` 로 충분한지, 빠진 단언. (v) 단계 분할 제안(스키마·엔진 → 화면 → 감지 → 하네스) 과 각 단계 완료 게이트. (vi) sol 재해석 지점 잔여. **잔여 0 이면 [정본화 가능]**(착수는 선행 브랜치 main 병합 후).

---

# 정본화 (2026-09-07 15:25, Claude — v3. astra 2차 잔여 R2-01~03 **전건 수용**. 근거 `docs/jobs/todo/excel-compare-rounds/round-2-{REPORT,AMENDMENTS}.md`·`probes-r2/`)

## 우선순위·첨부
**정본화 v3 > v2 반영 > v1 본문** 순으로 우선하며 충돌 시 v3 가 정본이다. **첨부를 정본의 일부로 채택**한다: `round-1-AMENDMENTS.md`(O01~O11) · `round-1-CONSUMER-INVENTORY.md` · `round-2-AMENDMENTS.md`(R2-01~03 + 단계 분할 S0~S4) · `probes-r1/`·`probes-r2/`. 요약은 원문을 대체하지 않는다.

## R2-01 — 반복 Key 자체가 한도를 넘는 예외 [수용]
보고서의 **모든 문자열 셀은 32,767 UTF-16 code unit 이하**(값 목록뿐 아니라 Key·문맥 문자열 포함). 일반 그룹 목록이 길면 **그 그룹만 연속 행으로 분할**(Claude 판정 유지). **반복해야 할 `displayKey` 자체가 허용 길이를 넘는 경우에만** 해당 쌍을 안전하게 실패시키고 정상 다운로드·ZIP 에서 제외한다(다른 쌍은 계속). 쌍 결과는 보고서 검증 후 공개하는 현행 수명 계약을 유지하므로 그 쌍은 화면 성공 목록에도 오르지 않는다. **Key 를 자르거나 다른 키로 대체하지 않는다.** 허용 길이: 단일 줄 Key **32,767**, CR/LF 포함 여러 줄 Key **16,000**. 값 목록만 줄이고 Key 에 긴 여러 줄 값을 남기지 않는다.

## R2-02 — 연속 행 직렬화·표기·재개방 계약 [수용]
- 화면 duplicate 레코드는 **키당 하나**, scalar 위치 `null`·scalar 값 빈 문자열. **보고서용 분할 객체를 `records` 에 넣지 않는다.** `summary.duplicate` 는 그룹 수이며 Duplicates 데이터 행 수와 별개. 9시트·13열 이름·순서 보존.
- `displayKey` = 선택 키 열 순서대로 기존 `cellText` 를 ` | ` 로 연결(첫 좌측 원본 행, 없으면 첫 우측). 내부 정규화 키를 파싱하지 않는다. **표시 문자열이 같은 서로 다른 내부 키가 있을 수 있으므로 그룹 identity 로 쓰지 않는다.**
- **좌우 각각의 행번호·값 셀은 16,000 code unit 이하**. 32,767 은 전체 셀 절대 상한, 16,000 은 호환성 예산 — **실측 근거**: 100k×양측을 32,767 예산으로 나누면 195행·790,690B 로 성공하나 **LibreOffice 왕복에서 값 셀 390개가 달라졌고**, 16,000 예산은 399행·836,331B 에 **XML 차이 0**. 원본 행 단위 탐욕 채움(행번호 `, `·값 사이 LF·`원본행번호: ` 접두 길이 포함), 어느 한 셀이라도 예산 초과면 다음 조각. **좌우 독립**으로 만들고 조각 수의 최댓값만큼 연속 행을 낸다(먼저 끝난 측은 빈 문자열). **같은 보고서 행의 좌우를 연결한 것으로 취급하지 않는다.**
- 한 원본 행의 값 하나가 예산을 넘으면 **전용 조각**으로 나누고 다른 원본 행과 혼합하지 않는다. 행번호 셀 표기 **`r [i/n]`**(1부터), 값 셀은 조각마다 `r: ` + 값 부분. `2 [1/3]`·`2 [2/3]`·`2 [3/3]` 은 **원본 2행 한 건의 세 조각**이며 건수가 늘어난 것이 아니다. 원본 값은 순서대로 접합해 복원 가능해야 하고 **잘림 표시·새 매칭을 넣지 않는다.**
- 분할 안전: high/low surrogate 사이면 1 code unit 앞에서, **CR 과 LF 사이도 분할 금지**(걸리면 1 앞). 셀의 CRLF→LF 정규화가 조각 경계에서 LF 두 개가 되지 않게 한다. **전체 문자열을 join 후 자르지 않고 원본 행을 순차 처리.** 4,096행마다·아주 긴 한 행은 조각마다 취소 확인. 입력 전체 사본 금지.
- `Key`·`Change=KEY`·`Reason=DUPLICATE_KEY`·문맥 4열은 **모든 조각에 반복**. 모든 값은 `writeUntrustedText` 통과(수식 객체 금지). 원본 LF 와 조각 구분 LF 를 임의 제거하지 않는다. **"무손실" 은 행/값 항목의 누락·순서 변형·잘림 없음**을 뜻하며 CR/LF 바이트 동일성은 이번 문안에서 보장하지 않는다(별도 escaping 계약 필요).
- **Parameters 메타데이터**(키 모드/오류 정책일 때, 그 외 `UNUSED`): `duplicateCountUnit=key-group` · `duplicateReportSplit` · `duplicateReportSplitGroupCount` · `duplicateReportDataRows` · `duplicateReportCellLimit=32767` · `duplicateReportListCellLimit=16000` · `duplicateReportMultilineKeyLimit=16000` · `duplicateReportLayout=independent-side-chunks-v1` · `duplicateReportRowNotation=<r [i/n] 설명>` · **그룹 구간 `duplicateReportGroup.<순번> = Duplicates!<시작행>:<끝행>`**(원본 행 순서 기준, 사용자가 재정렬하면 재계산되지 않음). 시트·열을 추가하지 않고 그룹 경계를 식별한다. Parameters 는 report builder 의 출력 메타데이터이며 엔진 summary/records 를 바꾸지 않는다.
- 골든: 그룹 수와 분할 행 수를 **따로** 검사. 행번호·값 전체 내용·그룹 경계·좌우 소진·주입 문자열·32,767/32,768 절대 한도·16,000/16,001 목록 예산·LF/CRLF·이모지·긴 원본 한 행. **실다운로드와 ZIP 내부 XLSX 각각 재개방.** 선행 유한 너비·가시성·byteLength·Blob 검사를 보존하되 **내용 무손실을 그 검사로 대신하지 않는다.**

## R2-03 — 감지 규칙 단일 해석·사용자 영향 [수용]
v2 O06 본문 규칙을 정본으로 삼되, 비병합 1셀 제목 skip 조건에 **`!verticalMergedRows.has(row)`** 를 포함한다. 가로 병합 행은 앞선 규칙으로 건너뛰고, **세로 병합의 1셀 행은 제목 skip 대상이 아니며 첫 판정에서 `uncertain` 으로 종료**한다. 1차 코드를 그대로 복사해 본문과 다른 결과를 만들지 않는다. **원시 값·수식·오류 타입**으로 판정하며 `suggested` 만 row 가 정수, `uncertain`/`none` 은 `row=null`.
22 fixture 의 row·reason 을 고정하되 **"22개 전부 정답" 을 통과 조건으로 삼지 않는다** — 기대한 보수적 출력을 검사하고 실패한 의미 분류도 표에 명시한다(실측: suggested 12 중 의미 오판 5, uncertain 8, none 2; CSV 에서 4패턴이 다른 출력). **형식별(XLSX/XLSM/XLS/XLSB/SpreadsheetML/CSV) 기대표를 각각** 두고 원시 기대값을 6형식에 일괄 복제하지 않는다. **세로 병합 1셀 접두 사례를 23번째 회귀로 추가.**
안내: `uncertain`·`none` 은 **동일한 미감지 안내**를 쓰고 입력 초기값은 1. "1행을 감지했다"·reason 코드 표시 금지. `aria-describedby` 연결, 비동기 결과는 polite status 1회. `source=manual` 이후에는 자동 제안 안내로 되돌리지 않고, 수동 캐시 응답이 이전 suggestion·선택·알림을 재적용하지 않는다.
**모든 머리글 입력 옆 지속 안내 추가** — ko: "선택한 행 다음부터 비교합니다. 설명·필터·요약 행이 앞에 있으면 실제 열 이름이 있는 행을 선택해 주세요. 머리글이 없는 표는 맨 위에 열 이름 행을 추가해 주세요." / en: "Comparison starts after the selected row. If notes, filters or a summary come first, choose the row containing the actual column names. If your table has no header, add a row of column names at the top." 같은 의미를 guide/FAQ 에 반영.
**지원 제외**: 다단 머리글 합성 · 20행 밖 자동 탐색 · 단일열 제목 구분 · 숫자 머리글 확정 · **머리글 없는 표의 첫 행 포함 비교**. 머리글 없는 표에 "수동 1 선택으로 전 행 보존" 을 약속하지 않는다. **`headerRow=0`·머리글 없음 모드를 새로 도입하지 않는다.**

## 단계 분할 S0~S4 [수용]
1. **S0 기준 갱신**: 선행 `excel-report-width-20260907` **main 병합 확인 → 최종 main SHA 기입 → 열린 계획서 충돌 검사 → 그 main 의 production bundle baseline**. 원 U4/DC/XR 트리를 쓰지 않는다.
2. **S1 스키마·엔진·보고서**: 중복 전용 discriminated union·생성기, 배열 불변식, append·취소, `displayKey`/count, 분할 formatter·Parameters·무결성 호출을 함께 완성하고 그 단위시험도 같은 단계에서 갱신. **engine-only 중간 산출은 제품 공개 가능한 완료가 아니다.**
3. **S2 화면**: records 소비처 전환, 전체 검색·안정 key·500그룹, 양측 lazy 50/50/0 목록, 전체값 dialog, 다운로드·ZIP 연결. **S1+S2 가 제품 동작의 한 전환 단위** — S1 만 적용된 상태는 배포·병합 후보가 아니다.
4. **S3 감지**: 순수 detector·원시 sample → inspect request/response → client pre-abort/token/cache → 파일·시트 상태/swap → ko/en 안내를 같이. 수동·경쟁·취소 시험을 이 단계에.
5. **S4 최종 통합**: 전 스모크·production static·bundle·QA 결과 visual/a11y 및 **Gemini 직접 시각 검수**. "하네스 마지막" 은 통합 범위 확장을 뜻하며 S1~S3 회귀시험을 미룬다는 뜻이 아니다.

## 제품 규칙
규칙 4: ko/en `features.json`·guide/FAQ·관련 SEO/tools/정적 생성 입력을 함께 갱신. **URL·canonical·hreflang·사이트맵 집합 불변**, 새 광고 예외·서버 전제 경로 없음. 규칙 5: `displayKey` 는 원본 표시용이며 내부 identity·reason·error·광고 격리 상태를 사용자에게 출력하지 않는다. 실행 확장자 전체 재귀 검색 + 명시적 최소 예외로 최종 검사. Parameters 계약명은 보고서 metadata 이며 UI 오류로 노출하지 않는다. 규칙 19: 추적 제외 로컬 QA **결과 상태**를 **Gemini 가 직접 검수**하고 Codex 가 실측 교차한다(이번 프로토타입으로 대체 불가).

## 착수 조건
① 선행 `excel-report-width-20260907` **main 병합** → ② S0 으로 최종 기준 SHA 기입·게이트 재검사 → ③ astra 3차 확인에서 **이견 0** → ④ S1 부터 sol 디스패치(각 단계 후 astra 검수, S1+S2 를 한 전환 단위로).

## 정본화 선언
**2026-09-07 15:36 — Claude–Codex 간 이견 0 · [정본화 가능]**(astra 3차 확인 `task-mtqus3im-pyalut`: R2-01~03 전건 수용 정확, S0~S4·S1+S2 전환 단위 반영, 잔여 0). 보고서 `docs/jobs/todo/excel-compare-rounds/round-3-REPORT.md`.
**착수는 아직 불가** — 선행 `excel-report-width-20260907` 의 main 병합 후 **S0** 에서 최종 기준 SHA·실행 게이트·production bundle baseline 을 확정하고 이견 0 이 유지된 정본으로 **S1** 을 디스패치할 때 가능하다. S0 에서 계약 변경·충돌이 발견되면 astra 확인에 반영한다(이번 선언이 미래 기준 변경을 자동 승인하지 않는다). 선행 브랜치의 `xlsxReportDataRows.mjs`·`.d.mts` 는 S0 에서 **보존할 현행 선행 코드**다.
