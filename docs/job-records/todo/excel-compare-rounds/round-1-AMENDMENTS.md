# 정본 반영 제안 — XC 반박 1차 (Codx, 2026-09-07)

아래는 Claude가 초안에 반영·판정할 **제안 문안**이다. 정본화·구현 착수 선언이 아니다. 사용자 결정인 “중복키 한 행 묶기”와 “머리글 자동 감지”는 유지한다. 잔여 이견은 REPORT.md의 O01~O11, 총 **11건**이다.

## O01 — §1 실측표 정정

> 기준 `5bc6854175331bdd73b267784d9633cdccda8446`. 좌 `A1:J78`·우 `A1:J84`, 실제 머리글은 양쪽 4행이고 A4:D4는 `No | 이름 | 소속 | 주소`이다. 원본 B2·B3는 값을 갖지 않는 셀이지만 ExcelJS가 병합 `A2:I3`의 master 값을 읽게 하므로 adapter 결과에서는 B2·B3에도 제목이 있다. 머리글 1·B열 키·오류 정책의 재현 파라미터는 `mode=key`, `left.headerRow=right.headerRow=1`, `key.leftColumns=key.rightColumns=[2]`, `key.duplicatePolicy=error`이다. Parameters 명칭은 `keyLeftColumns=2`, `keyRightColumns=2`, `duplicateKeyPolicy=error`이다. 소스 파일만으로 과거 실행 UI 상태까지 입증한 것은 아니다.
>
> 5행 이후 이름 중복은 좌 74행·우 80행에서 각각 0종. No 중복은 각각 1~6의 6종이며 **좌 73행·우 79행부터 1로 재시작**한다. 머리글 1/B열은 중복 4레코드=1키, 머리글 4/A열은 24레코드=6키, 머리글 4/B열은 0이다. 변경 뒤 기대치는 각각 1·6·0 중복 그룹이다.

## O02 — §2-A 스키마·그룹 단위 확정

> `records` 안의 중복 레코드 확장안을 채택한다. 별도 `duplicateGroups` 배열은 채택하지 않는다. `status=duplicate`이면 `leftRows`, `rightRows`, `leftValues`, `rightValues` 네 배열이 모두 존재한다. 각 측의 행 번호와 값은 같은 길이이고 같은 인덱스가 **해당 측의 한 행**을 가리킨다. 없는 측은 `[]`; 복수 여부는 `leftRows.length>1 || rightRows.length>1`이다. 2:0·0:2·2:1·1:2도 같은 규칙이며 반대편 단일 행도 그룹에 포함하고 일반 비교에서 제외한다. 1:1은 기존 비교를 유지한다.
>
> 모든 중복 레코드의 `leftRow/rightRow/leftColumn/rightColumn`은 `null`, `leftValue/rightValue`는 빈 문자열로 둔다. 첫 행을 하위 호환 대표 위치·대표 값으로 두지 않는다. 이는 소비처를 함께 고치는 스키마 전환이며 무수정 하위 호환을 약속하지 않는다. 가능한 한 중복 레코드를 식별하는 타입과 생성 함수를 분리해 배열 누락·길이 불일치를 검출한다.
>
> 그룹 identity는 기존 `normalizeKeyPart` 및 복합키 로직을 그대로 쓴다. 빈 키·숫자/문자·공백·Unicode 처리 의미도 불변이다. 사용자 표시용 `displayKey`를 중복 그룹에 추가하고, 첫 좌측 행(없으면 첫 우측 행)의 **선택된 키 열 원시 표시값**으로 만든다. 이 값은 제목 표시에만 쓰며 행 연결의 근거가 아니다. `string:` 등의 내부 identity를 잘라 파싱해 표시값을 복원하지 않는다. 원본 값에 구분자가 들어 있어도 원본 셀에서 구성한다. 다른 상태의 스키마·의미는 이번 작업에서 바꾸지 않는다.

## O03 — §2-A 소비처·집계·순서·보고서

> 화면 필터는 `records.status` 경계를 유지한다. 검색은 접힘·펼침·현재 표시 건수와 무관하게 중복 그룹의 전체 좌우 값과 모든 원본 행 번호·표시 키를 포함한다. 기존 비중복 검색의 키·좌우 값·변경·사유 범위는 유지한다. 그룹별 React key에는 쌍 ID와 내부 key를 사용한다. 동일 key가 다른 쌍에 있어도 별개 그룹이다.
>
> 기존 결과 정렬 UI는 없다. 출력 순서는 현행 중복키 Set 순회(좌 파일에서 처음 나타난 중복키 순서, 이어서 우측에만 있는 중복키 순서)를 유지하고, 각 측의 행은 원본 행 번호 오름차순이다. 비중복 결과 순서는 기존 엔진대로 유지한다. 정렬 기능은 추가하지 않는다. 화면의 500개/더보기 제한은 그룹을 하나의 결과 레코드로 센다.
>
> `summary.duplicate`는 쌍 안의 중복키 그룹 수이다. `summarize(records)`가 상태 레코드 수를 세는 구현은 그대로 쓸 수 있다. Summary 시트의 `duplicate` 행 이름은 유지한다. Parameters에 `duplicateCountUnit=key-group`을 키/오류 정책에 기록하고 그 외에는 `UNUSED`로 기록한다. 상태 필터·배지는 “중복키 / Duplicate key”를 유지하고 결과 영역에 “중복 키 {{count}}개 / {{count}} duplicate key(s)”를 표시한다. 전체 집계는 성공 쌍의 summary를 합하며 파일 전체 행 수로 해석하지 않는다. 현재 UI에는 상태별 숫자 집계가 없으므로 이 문구는 신규 표시다.
>
> 9시트·결과 시트 13열의 이름·순서를 유지한다. Duplicates의 Left/Right row는 해당 측 행 번호를 `, `로 연결한다. Left/Right value는 `원본행번호: 행값`을 줄바꿈으로 연결한다. Key는 중복의 displayKey를 쓴다. 모든 사용자 값은 기존 `writeUntrustedText`를 통과시키고 수식 객체로 만들지 않는다. 각 측의 목록은 독립이며 좌우 같은 줄의 항목을 매칭했다고 설명하지 않는다. 1성공은 XLSX만, 2성공 이상은 기존 파일명·무결성·Blob·URL·ZIP 수명 계약을 유지한다.

## O04 — §2-A 긴 보고서 셀 처리

> 중복 목록을 1셀로 직렬화하기 전에 행 번호·키·좌우 값의 직렬화 길이를 검사한다. **32,767 UTF-16 code unit 이하**로 보수적으로 제한한다. 경계 32,767/32,768·줄바꿈·이모지·긴 한 행·긴 행번호 목록을 검사한다. 초과 시 `DUPLICATE_GROUP_TOO_LARGE`로 해당 쌍을 실패 처리하고 다운로드·ZIP에 포함하지 않는다. 일부만 자른 정상 보고서를 만들거나 9시트·13열을 임의 변경하지 않는다. 다른 쌍은 계속 처리한다. 이 선택은 현행 “보고서 성공 후 쌍 결과 공개” 흐름을 유지하므로 해당 쌍의 화면 결과도 성공 목록에 올라오지 않는다는 점을 정본에 명시한다.
>
> ko: “같은 키로 묶인 내용이 너무 길어 보고서를 만들지 못했습니다. 비교할 파일을 나누거나 보조키를 추가해 다시 시도해 주세요.”
> en: “The rows grouped under one key are too long for the report. Split the input files or add a secondary key, then try again.”
>
> 제한에 걸려도 화면 결과를 유지하거나 보고서를 분할하려면 별도 반환 스키마/출력 계약이 필요하므로 이번 정본에서 조용히 추가하지 않는다. Claude는 위 실패 계약을 채택하거나 대체 계약을 재왕복해야 한다.

## O05 — §2-A 성능·취소 보강

> `groupRows`의 동일 키마다 배열 전체를 복사하는 `groups.set(key,[...old,row])`를 없애고 그룹 전용 배열에 append한다. 순서·키 정규화·중복 3정책의 결과는 동일하게 유지한다. 같은 함수의 `secondary`·`occurrence` 호출도 결과 회귀를 검증한다. 그룹 구성·행 값 목록 구성·보고서 길이 검사에서 최소 4,096개 처리마다 취소 콜백을 확인한다. 전체 셀/행의 추가 사본을 만들지 않는다. 중복 30,000행 합성에서 반복 복사 구현 대비 append의 결과 동일과 비용 감소를 기록한다. 이 변경은 정책 의미 변경 제외와 양립하는 공통 성능 수정으로 범위에 명시한다.

## O06 — §2-B 감지 알고리즘·불확실성

> 초안의 “모든 셀 문자열·아래 행과 값 겹침 금지·셀 수 최대·병합 포함 행 전부 제외”를 확정 규칙으로 쓰지 않는다. 감지는 일반적인 표의 초기값을 제안하는 기능이며 정확성을 보증하지 않는다. `headerSuggestion`은 `{ row: number | null, reason: 'suggested' | 'uncertain' | 'none' }`이다. `null`이면 UI 기본값 1을 유지하지만 “1행을 감지했다”고 표시하지 않는다.
>
> 1차 채택 후보는 실험 `xc-probes/headers.mjs:detectConservative`의 결정적 규칙을 아래처럼 옮긴 것이다. **이 알고리즘 선택 자체는 Claude의 판정이 필요하며 최종 합의 전 sol이 선택하지 않는다.**
>
> 물리 행 1~20을 후보 범위로, 바로 아래 물리 행 최대 5개를 근거로 본다(따라서 샘플 읽기는 최대 25행). 셀은 원시 value가 null이 아니고 문자열화 후 trim이 빈 값이 아닌 것만 센다. 병합 메타데이터로 행 20 안의 가로 병합 행과 세로 병합 행을 표시한다. 빈 행과 가로 병합 행은 건너뛴다. 비병합 셀 1개짜리 행 아래 5행에 2개 이상 값이 있는 행이 있으면 제목 후보로 보고 건너뛴다. 그 뒤 처음 만난 행 하나를 판정한다. 그 행의 비빈 셀 ≥2, 비수식/비오류 문자열 셀 비율 ≥1/2, trim한 값이 서로 다름, 같은 열들의 값이 `ceil(후보 셀 수×0.4)`개 이상 있는 하위 행 ≥2, 세로 병합 행이 아님을 모두 만족하면 그 행을 제안한다. 만족하지 않으면 `uncertain`으로 끝내고 본문 아래쪽을 계속 훑어 다른 행을 선택하지 않는다. 후보 범위에 그런 행이 전혀 없으면 `none`이다.
>
> 이 규칙도 설명 행·필터 행·상단 요약 블록·머리글 없는 문자열 표를 뜻만 보고 구분할 수 없다. 자동 확정 표현을 쓰지 않고 후보/열 이름 확인 안내를 항상 둔다. 다단 머리글 병합/합성, 상위 20행 밖 탐색, 단일열 제목 구분, 숫자만 있는 머리글 확정은 지원하지 않으며 수동 선택으로 처리한다. “병합 범위 행 전체 제외”를 모든 패턴에 안전하다고 설명하지 않는다. 추후 병합 마지막 행 합성은 별도 의미 계약이 필요하다.
>
> 고정 fixture는 REPORT.md의 22패턴으로 한다. 구현 테스트는 후보 행뿐 아니라 `suggested/uncertain/none`을 함께 단언한다. 실제 사용자 파일 두 개에서 4행 제안은 로컬 비게이팅 확인이며 CI에 사용자 경로를 넣지 않는다. 모든 supported input format은 기존 adapter를 거친 타입 기준으로 판단한다(CSV 값은 문자열이므로 XLSX와 판정이 달라질 수 있음). 표시값으로 전부 문자열화한 배열을 “전부 문자열” 검사에 쓰지 않는다.
>
> N=20은 첫 버전의 탐색 범위 제한이지 성능이 O(20)이라는 뜻이 아니다. 현행 flat cells를 한 번 훑어 상위 25행을 모으고, 이후 후보/아래행 검사는 bounded sample에서 한다. 행마다 전체 cells를 재검색하지 않는다. 샘플 구축은 O(전체 파싱 셀 수), 저장은 O(상위 25행의 실제 셀 수)이며 병합 행 전개는 20행 안으로 제한한다. 시트별로 순차 처리한다.

## O07 — §2-B 파일·시트·사용자 선택 상태

> 파일 선택 시 첫 시트 후보와 그 열 이름을 같은 inspect 응답으로 받는다. 각 파일·시트마다 `{row, source:'suggested'|'manual'|'fallback'}` 선택 상태를 보관한다. 시트 전환은 해당 시트의 수동 선택→해당 시트 후보→1 순으로 복원한다. 다른 시트의 숫자를 그대로 재사용하지 않는다. 사용자가 머리글을 바꾸면 해당 파일·시트에서 그 값이 우선하며 다른 응답이 덮지 않는다. 재선택한 새 파일에는 이전 파일의 수동 상태를 이월하지 않는다. 교환은 이 상태·검사 결과·오류·매핑을 기존 PairState와 함께 교환한다.
>
> 입력은 실제 비교 전에 정수 및 `1..max(1,rowCount)`를 검증한다. 편집 중 임시 입력값을 별도로 둘 수 있지만 NaN·소수·상한 밖의 값을 pairOptions에 넘기지 않는다. 선택 행의 열 이름이 없는 상태로 비교를 시작하지 않는다. 머리글 변경으로 데이터 제외 범위와 열 이름이 바뀐다는 안내를 제공한다. 기존 열 매핑의 자동 재선택을 이 작업에서 추가하지 않되 존재하지 않는 열 번호는 비교 준비 상태로 인정하지 않는다.

## O08 — §2-B inspect 왕복·취소·경쟁

> 최초 inspect 1회에서 각 시트의 후보와 기본/후보 헤더 문자열을 동봉한다. candidateRow만 받고 재inspect하지 않는다. 응답 headerRows는 중복 행 번호 없이 `[요청행들 ∪ 해당 시트 후보행]`이다. 감지는 최초 검사에서만 수행하고 수동 행 조회는 detection을 재수행하거나 초기값을 재적용하지 않는다. 이미 캐시된 행 조회는 재파싱하지 않는다. 미캐시 수동 행은 현재 구조상 파일 전체 재파싱 1회를 허용하고 이전 캐시와 병합한다.
>
> 호출 인터페이스는 기존 인자 뒤에 다섯째 `detectHeader: boolean = true`를 추가한다. worker inspect Request에는 `detectHeader?: boolean`을 두고 생략 시 true로 본다. 최초 selectFile은 true, 미캐시 refreshHeader는 false를 전달한다. `sheets[].headerSuggestion`은 최초 감지 응답에서 존재하고 수동 조회 응답에서는 생략할 수 있게 타입을 둔다. 수동 응답은 기존 inspection의 headerRows를 시트명·행 번호 기준으로 병합하며 기존 headerSuggestion/수동 선택 상태를 덮지 않는다. 기존 기본 호출은 그대로 동작한다.
>
> 파일 쌍·측별 AbortController와 단조 증가 request token을 둔다. 새 파일·파일 제거·쌍 제거·unmount에서 해당 검사를 취소한다. 완료·오류·finally는 `(pairId, side, File identity, token)`이 현재와 같을 때만 반영한다. 수동 조회도 같은 소유권 규칙을 따른다. 모든 유효 검사 중 `left/rightInspecting`으로 교환과 비교를 막는다. 시트/수동 행 선택을 비활성화하지 않고 변경을 허용한다면 최신 token만 반영하도록 한다. signal을 client에 넘기고 arrayBuffer 전/후 abort check를 한다. 이미 취소된 요청은 파일을 읽거나 worker를 만들지 않는다.
>
> 현행 worker는 종료형 취소를 사용한다. 같은 스레드의 CPU 작업 도중 postMessage의 cancel 메시지를 읽으면 즉시 중단된다는 식으로 설명하지 않는다. 단위 콜백 취소와 브라우저 worker terminate 취소를 각각 검증한다. 필요 없는 old response가 finally에서 새 검사 busy를 지우지 않는지 확인한다. 캐시·수동 선택·token 처리 후 교환의 X-B 계약을 다시 실행한다.

## O09 — §2-A/B 화면·접근성

> 중복은 한 결과 행 안의 좌·우 두 독립 목록이다. 각 목록은 “왼쪽 {{count}}건 보기 / Show {{count}} left row(s)” 및 우측 대응 문구를 가진 native details/summary 또는 동등한 button 제어를 쓴다. 0건은 “왼쪽 0건 / No left rows”라는 텍스트로 표시하고 빈 접기 버튼은 만들지 않는다. 비원어민용 `Left 1 rows` 같은 단복수 오류가 없게 ko/en plural을 둔다.
>
> 접힘은 기본값이며 닫힌 목록은 내용 DOM을 만들지 않는다. 펼침 시 측별 처음 50개, 추가 50개씩 표시한다. 검색은 DOM에 올라오지 않은 전체 값을 조회한다. 각 항목의 행 번호는 값을 붙여 읽을 수 있게 한다. 아주 긴 값은 줄바꿈/overflow-wrap을 지원하고 미리보기 잘림 시 키보드로 여는 “전체 값 / Full value” 대화상자를 제공한다. dialog의 이름·Escape·초점 반환을 검사한다. hover/title만으로 전체 값에 접근하게 하지 않는다. 펼침 제어 안에 다른 버튼을 중첩하지 않는다.
>
> 사유 ko: “같은 키가 여러 행에 있어 자동으로 연결하지 않았습니다. 두 목록은 각각 원본 행 순서입니다. 보조키를 추가하거나 발생 순번 연결을 선택할 수 있습니다.”
> 사유 en: “This key occurs in multiple rows, so the rows have not been matched automatically. Each list follows its original row order. You can add a secondary key or choose occurrence order.”
>
> 감지 ko: “{{row}}행을 머리글 후보로 선택했습니다. 열 이름을 확인하고 필요하면 바꿔 주세요.”
> 감지 en: “Row {{row}} is selected as a suggested header. Check the column names and change the row if needed.”
> 미감지 ko: “머리글 행을 찾기 어려워 1행을 선택했습니다. 열 이름을 확인하고 머리글 행을 지정해 주세요.”
> 미감지 en: “We could not identify a header row, so row 1 is selected. Check the column names and choose the header row.”
> 사용자 선택 뒤에는 감지 성공 문구 대신 “선택한 머리글: {{row}}행 / Selected header: row {{row}}”을 쓴다. input과 안내를 aria-describedby로 연결하고 비동기 제안은 polite status로 한 번 알린다. “인식했습니다 / detected”라는 확정형 표현을 쓰지 않는다. 내부 reason code·타입 접두사·원시 예외·광고/격리 상태는 사용자 문구에 넣지 않는다.

## 선행 브랜치 — 동의, 정본의 순서 유지

> 실측 선행 커밋은 `ac9cc4a2638aeb497a69668079be050786e6edf7`이다. **report.ts는 선행 변경 파일이 아니므로 초안의 해당 충돌 설명을 정정**한다. 직접 겹치는 worker·비교 smoke·비교 unit·기록과 공유 writer/validator의 의미 의존성은 CONSUMER-INVENTORY의 실제 diff 표를 따른다.
>
> `excel-report-width-20260907`의 main 병합 후 이 작업의 **최종 기준 해시를 새로 기입**하고 실행 게이트를 재검사한다. xlsxReport의 유한 너비 계산과 reportIntegrity 가시성 검사를 보존하고 await/signature 변경이 있으면 현행 호출에 맞춘다. 실제 파일 교집합은 선행 커밋의 git diff로 다시 확정한다. 비교 보고서 내용과 너비 검사는 Duplicates의 빈/단일/복수/긴 값·실다운로드·ZIP내 XLSX 모두에서 함께 통과해야 한다. Excel Cleaner·QR 보고서에도 공유 writer 회귀를 돌린다. 원 워킹트리·다른 잡 체크아웃은 수정하지 않는다.

## O10 — §3 실행 명령·산출물 분리·선행 기준 갱신

> 아래의 production/QA 구분은 필수다. `VITE_LOCAL_QA=1` 빌드에는 Analytics가 없으므로 현재 `test:static`을 그대로 적용하면 실패한다. 또한 현행 Excel compare smoke는 광고 스크립트 존재를 단언한다. 환경 플래그만 켜서 모든 검증이 같이 통과한다고 적지 않는다. 설치를 허용하지 않은 작업에서는 `npx tsc -b` 대신 `./node_modules/.bin/tsc -b`를 사용한다.

```bash
# 실험/작업 사본 루트에서. 실제 구현 checkout에도 자기 전용 경로로 치환한다.
export NODE_OPTIONS=--max-old-space-size=4096
export TMPDIR=/tmp/worklazy-xc-r1/tmp
export npm_config_cache=/tmp/worklazy-xc-r1/npm-cache
export TEST_BASE_URL=http://127.0.0.1:4350
export VISUAL_CONCURRENCY=1

# production 산출물 검증
unset VITE_LOCAL_QA
./node_modules/.bin/tsc -b
npm run build
npm run test:unit
npm run test:static
npm run css:orphans
node tests/tool-registry-routes.mjs
BUNDLE_MEASURE_OUTPUT=/tmp/worklazy-xc-r1/evidence/bundle-after.json npm run bundle:measure
# 선행 main의 동일 명령 baseline 파일을 별도로 채집한 뒤 BUNDLE_BASELINE과 비교한다.
# preview는 별도 터미널/관리 프로세스에서 실행하고 아래 스모크를 직렬 실행한다.
./node_modules/.bin/vite preview --host 127.0.0.1 --port 4350 --strictPort
# (위 preview가 준비된 상태에서)
npm run test:excel-compare
npm run test:excel-cleaner
npm run test:qr-bulk
npm run test:browser
# preview 중지 후, 빌드와 브라우저는 겹치지 않는다.

# 로컬 시각·접근성 검증: 광고/네이버/구글 추적 로딩 제외
VITE_LOCAL_QA=1 npm run build
./node_modules/.bin/vite preview --host 127.0.0.1 --port 4350 --strictPort
# (위 preview가 준비된 상태에서)
VISUAL_ONLY=excel-compare-empty VISUAL_CONCURRENCY=1 npm run test:visual
A11Y_REPORT_PATH=/tmp/worklazy-xc-r1/evidence/a11y.json A11Y_MAX_TOTAL=0 npm run test:a11y
# 추가한 중복/감지 상호작용 scenario도 명시한 VISUAL_ONLY 값으로 실행한다.
# 결과 상태의 axe 검사 + Gemini 직접 시각 검수, Codex 실측 교차를 별도로 실행한다.
# preview 종료 후 실제 구현 checkout에서:
git diff --check
```

> production smoke의 네트워크 차단/동의 설정은 기존 하네스 계약을 확인한다. 일반 코드의 loader 존재 검증을 QA 산출물에 맞추려고 없애지 않는다. 동일 포트를 생산/QA 서버가 동시에 점유하지 않게 소유 PID를 기록한다. `bundle:measure`는 자체 Vite build를 실행하므로 브라우저 종료 뒤 실행한다. 위 명령 중 현재 실행하지 않은 것은 구현 완료 보고에서 통과로 쓰지 않는다.

## O11 — 제품 영향·완료 기준 추가

> ko/en `features.json`의 상태 안내·접기·전체 값·미감지·초과 오류·머리글 안내와 guide/FAQ를 함께 갱신한다. 현재 가이드의 “키·보조키·발생순서” 설명에 한 행 묶기의 비매칭 의미와 후보 확인/수동 변경을 추가한다. `src/app/seo.ts`, 도구 registry/ko·en tools.json, 정적 페이지 생성기의 Excel compare 설명/FAQ 입력을 점검하고 기능 설명이 바뀌는 부분만 갱신한다. URL·canonical·hreflang·사이트맵 경로 집합은 불변이며 새로운 경로나 광고 예외를 만들지 않는다. 생성된 HTML/사이트맵/벤더 파일을 손으로 고치지 않는다. AdSense의 현재 일반 AppShell 경로/배치는 그대로 검증한다.
>
> 완료 회귀는 (1) 중복 2:3·2:1·2:0·0:2·1:1·빈 키·정규화·복합키·복수 쌍·그룹 순서, (2) 접힌 마지막 값/원본 행번호 검색·필터·500개 더보기·양측 독립 펼침, (3) Duplicates 13열·9시트·Summary 및 Parameters·주입 문자열·한도 경계·선행 유한너비/가시성 검사·실다운로드·ZIP 재개방, (4) 감지 22패턴 및 XLSX/XLSM·BIFF8 XLS·XLSB·SpreadsheetML·CSV 각각의 타입/병합/빈행 경로와 다중 시트·수동 왕복·파일 교환·검사 완료 역전·제거/unmount·pre-abort, (5) ko/en×desktop/mobile×light/dark 결과 상태의 시각/접근성으로 고정한다. 빈 상태만 검사하는 현행 visual/a11y는 신규 결과 상태를 대신하지 않는다.
>
> 코드 변경은 CHANGELOG에 간결히 Codx 서명, 판정·기각·실측은 docs/review-notes.md에 반영한다. 이 실험에서는 저장소 불변 지시가 우선이므로 두 파일을 수정하지 않았고, 본 보고서 내용을 후속 기록 입력으로 넘긴다. 사용자 파일을 fixture나 보고서 샘플로 저장·커밋하지 않는다.
