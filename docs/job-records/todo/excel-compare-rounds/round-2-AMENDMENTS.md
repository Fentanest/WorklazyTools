# 정본 반영 문안 — XC 2차 (Codx, 2026-09-07)

**Claude 판정 요청용. 잔여 3건(R2-01~03). 정본화·구현 착수 선언이 아니다.** 사용자 결정 두 건과 Claude의 일반적인 긴 그룹 연속 행 분할 선택은 유지한다. 아래 문안은 구현자가 새 정책을 선택하지 않도록 구체화한 제안이다.

## R2-01 — 반복 Key 자체가 한도를 넘는 예외

> 보고서의 모든 문자열 셀은 32,767 UTF-16 code unit 이하로 제한한다. 이 한도는 값 목록뿐 아니라 Key와 문맥 문자열에도 적용한다. 일반 그룹 목록이 길 때는 그 그룹만 연속 행으로 분할한다. **반복해야 할 displayKey 자체가 허용 길이를 넘는 경우에만** 해당 쌍을 안전하게 실패시키고 정상 다운로드·ZIP에서 제외한다. 다른 쌍은 계속한다. 쌍 결과는 보고서 검증 후에 공개하는 현행 수명 계약을 유지한다. 따라서 이 예외의 쌍은 화면 성공 목록에도 추가되지 않는다. Key를 자르거나 다른 키로 대체하지 않는다. 허용 길이는 단일 줄 Key 32,767, CR/LF가 들어 있는 여러 줄 Key 16,000이다. 여러 줄 Key도 R2-02의 재개방 반례를 피해야 하며 값 목록만 줄이고 Key에는 긴 여러 줄 값을 남기지 않는다.
>
> 내부 오류는 `DUPLICATE_KEY_TOO_LONG`. ko: “선택한 키 열의 내용이 너무 길어 보고서를 만들지 못했습니다. 더 짧은 값이 있는 열을 키로 선택해 다시 비교해 주세요.” en: “The selected key columns contain too much text for the report. Choose key columns with shorter values and compare again.” 원시 코드·예외는 사용자 문구에 출력하지 않는다.
>
> 이 예외는 **목록 길이 때문에 모든 큰 그룹을 쌍 실패시키자는 구 O04의 복원과 다르다**. 빈 열 10만 행 그룹은 정상 분할·성공한다. 초과 displayKey를 성공 결과로 꼭 보존하려면 별도 키 조각 계약 또는 보고서 실패와 화면 성공의 분리 스키마가 필요하며, sol이 이번 작업에서 임의 도입하지 않는다.

근거: `logs/report.json`의 합법적인 원본 키 두 셀 20,000+20,000자 → 표시 Key 40,003자. 선행 생성검사는 통과하지만 SheetJS writer는 거부하고 LibreOffice는 32,767자로 잘랐다(`logs/supplement.json`). 따라서 v2의 '같은 Key 반복·무손실·쌍 성공 불변'을 모든 입력에서 동시에 만족할 수 없다. 쌍 실패 예외를 유지할지 키 continuation을 설계할지는 Claude의 명시 판정이 필요하다.

## R2-02 — 연속 행의 정확한 직렬화·표기·재개방 계약

> 화면의 duplicate 레코드는 여전히 키당 하나이고 scalar 위치는 null, scalar 값은 빈 문자열이다. **보고서용 분할 객체를 records에 다시 넣지 않는다.** summary.duplicate는 그룹 수이며 Duplicates 시트 데이터 행 수와 별개다. 9시트·결과 시트 13열 이름·순서를 보존한다.
>
> `displayKey`는 선택 키 열 순서대로 기존 `cellText`(원본 셀 표시값/수식 캐시 부재 표시는 기존 동작)를 읽어 ` | `로 연결한다. 첫 왼쪽 원본 행, 없으면 첫 오른쪽 행을 사용한다. 내부 정규화 키는 파싱하지 않는다. 표시 문자열이 같은 서로 다른 내부 키가 존재할 수 있으므로 이를 그룹 identity로 사용하지 않는다.
>
> **좌우 각각의 행번호·값 셀은 16,000 UTF-16 code unit 이하**로 만든다. 32,767은 전체 보고서 셀의 절대 상한이고 16,000은 이 목록의 보수적인 호환성 예산이다. 원본 행 단위로 탐욕적으로 채우되 행번호 `, `와 값 항목 사이 LF, `원본행번호: ` 접두사 길이를 포함한다. 어느 쪽 한 셀이라도 예산을 넘으면 다음 조각을 시작한다. 좌우를 독립적으로 만들고 그 측 조각 수의 최댓값만큼 연속 보고서 행을 낸다. 먼저 끝난 측은 나머지 칸을 빈 문자열로 둔다. 같은 보고서 행의 좌우 항목을 서로 연결한 것으로 취급하지 않는다.
>
> 한 원본 행의 값 하나가 예산을 넘으면 전용 조각으로 나눈다. 조각을 다른 원본 행과 혼합하지 않는다. 행번호 셀은 `r [i/n]`(1부터 시작), 값 셀은 각 조각마다 `r: `와 값 부분을 쓴다. 예: `2 [1/3]`, `2 [2/3]`, `2 [3/3]`은 **원본 2행 한 건의 세 조각**이다. 같은 원본행 번호가 반복되어도 건수가 늘어난 것이 아니다. 원본 값은 순서대로 접합하여 복원 가능해야 한다. 잘림 표시나 새 매칭을 넣지 않는다.
>
> UTF-16 경계가 high/low surrogate 사이에 있으면 한 code unit 앞에서 나눈다. 유효한 surrogate pair를 쪼개지 않는다. CR과 LF 사이도 분할하지 않는다. 그 경계에 걸리면 1 code unit 앞에서 나눈다. 각 보고서 셀의 CRLF→LF 정규화가 조각 경계에서 LF 두 개로 바뀌는 것을 막는다. 그룹 전체 문자열을 먼저 join한 뒤 자르지 않고 원본 행들을 순차 처리한다. 4,096행 이내마다, 매우 긴 한 행에서는 각 조각마다 취소 확인한다. 전체 flat cells/행의 추가 사본을 만들지 않는다. 결과 문자열/필수 4배열과 보고서 행은 출력에 필요한 저장 공간이며 입력 전체 복사와 구분한다.
>
> Key·Change=KEY·Reason=DUPLICATE_KEY 및 문맥 4열을 모든 조각에 반복한다. 모든 값은 기존 writeUntrustedText를 거치고 수식 객체로 쓰지 않는다. 원본 셀의 LF와 조각 구분 LF를 임의 제거하지 않는다. 기존 writer의 CR/CRLF→LF 표시 정규화는 보존하되, '무손실'은 **행/값 항목의 누락·순서 변형·잘림 없음**을 뜻한다고 기록한다. CR/LF 바이트의 동일성까지 보장하려면 별도 escaping 계약이 필요하며 이번 문안에서는 보장하지 않는다.
>
> 같은 displayKey가 여러 내부 그룹에 쓰일 수 있으므로 Parameters에 각 그룹의 원래 출력 구간을 `duplicateReportGroup.<그룹순번> = Duplicates!<시작행>:<끝행>`으로 기록한다. 원본 보고서 행 순서를 기준으로 하며 사용자가 시트를 재정렬하면 이 구간은 재계산되지 않는다. 9시트/13열을 추가하지 않고 그룹 경계를 식별할 수 있게 한다.
>
> Parameters 추가 행(키 모드/오류 정책일 때):
> - `duplicateCountUnit=key-group`
> - `duplicateReportSplit=true|false`
> - `duplicateReportSplitGroupCount=<보고서 2행 이상인 그룹 수>`
> - `duplicateReportDataRows=<Duplicates 전체 데이터 행 수>`
> - `duplicateReportCellLimit=32767`
> - `duplicateReportListCellLimit=16000`
> - `duplicateReportMultilineKeyLimit=16000`
> - `duplicateReportLayout=independent-side-chunks-v1`
> - `duplicateReportRowNotation=r [i/n] means part i of n of source row r. Repeated r is not another source row. Left and right lists are independent, not matched.`
> - 위 그룹 구간 행들.
>
> 비적용 모드/정책에서는 고정 항목 값을 `UNUSED`로 하고 그룹 구간 행은 만들지 않는다. 오류 정책에서 중복 그룹이 없으면 split=false, 그룹/행수=0이다. 행 수 집계는 헤더를 제외한다. Parameters는 report builder가 만들어야 하는 출력 메타데이터이며 엔진 summary/records를 변경하지 않는다.
>
> 골든은 그룹 수와 분할 행 수를 따로 검사하고, 행번호·값 전체 내용·그룹 경계·좌우 소진·주입 문자열·32,767/32,768 절대 한도 및 16,000/16,001 목록 예산·LF/CRLF·이모지·긴 원본 한 행을 검증한다. 실다운로드와 ZIP 내부 XLSX 각각을 재개방한다. 선행 유한 너비·가시성·byteLength·Blob 크기 검사를 보존하되, 내용 무손실을 그 검사만으로 대신하지 않는다.

근거: v2 문자예산 분할은 브라우저에서 100k×양측→195행, 790,690B, 약1.90초로 성공했다. 그러나 LibreOffice 왕복의 값 셀 390개가 달랐다(원시 ZIP/XML 대조). 16k 보완안은 같은 자료→399행, 836,331B, XML 차이0. 16k는 모든 프로그램에 대한 보편적 보장이 아니라 이 실측 반례를 피한 보수안이다. 분할 자체를 기각하거나 일반 큰 그룹을 전부 실패시키자는 제안은 아니다.

Node 시험 주의: ExcelJS의 Node ZIP 문자열 경로는 문자열 16KiB 조각에서 이모지를 깨뜨릴 수 있다. 제품 브라우저는 TextEncoder 경로를 쓰며 100k 실다운로드에는 손상이 없었다. Node 테스트에서 브라우저 writer 경로를 재현하거나 실제 브라우저 산출물을 독립 ZIP/XML·SheetJS로 검사하고, 무결성 통과만으로 원문 동일을 단언하지 않는다. 벤더 수기 수정이나 dependency 설치/갱신을 추가하지 않는다.

## R2-03 — 감지 규칙의 단일 해석과 사용자 영향 안내

> v2 O06의 본문 규칙을 정본으로 삼는다. 비병합 셀 1개짜리 제목을 건너뛰는 조건에는 `!verticalMergedRows.has(row)`를 포함한다. 가로 병합 행은 앞선 규칙으로 건너뛰고, **세로 병합의 1셀 행은 이 제목 skip에 해당하지 않으며 첫 판정에서 uncertain으로 종료**한다. 1차 detectConservative 코드를 그대로 복사해 본문과 다른 결과를 만들지 않는다. 원시 값·수식·오류 타입으로 판정하며 suggested만 row가 정수이고 uncertain/none은 row=null이다.
>
> 원래 22개 fixture의 row와 reason을 고정하되, 22개가 전부 정답을 맞혀야 통과하는 시험이라고 정의하지 않는다. 기대한 보수적 출력을 검사하고 실패한 의미 분류도 표에 명시한다. CSV는 타입·병합 정보가 다른 표현이다. 각각 실제 adapter를 거친 XLSX/XLSM/XLS/XLSB/SpreadsheetML/CSV 기대표를 두며 원시 fixture 기대값을 6형식에 일괄 복제하지 않는다. 세로 병합 1셀 접두 사례를 추가하여 23번째 회귀로 고정한다.
>
> O09의 제안·미감지·수동 안내는 유지한다. uncertain와 none은 동일 미감지 안내를 쓰며 입력 초기값은1이다. '1행을 감지했다' 또는 reason 코드는 표시하지 않는다. 안내 컨테이너는 input의 aria-describedby로 연결하고 비동기 선택 결과를 polite status로 한 번 알린다. source=manual 이후에는 자동 제안 안내로 되돌리지 않는다. 수동 캐시 응답은 이전 suggestion/선택/알림을 재적용하지 않는다.
>
> 모든 머리글 입력 옆의 지속 안내에 다음을 추가한다. ko: “선택한 행 다음부터 비교합니다. 설명·필터·요약 행이 앞에 있으면 실제 열 이름이 있는 행을 선택해 주세요. 머리글이 없는 표는 맨 위에 열 이름 행을 추가해 주세요.” en: “Comparison starts after the selected row. If notes, filters or a summary come first, choose the row containing the actual column names. If your table has no header, add a row of column names at the top.” 같은 의미를 guide/FAQ에 반영한다.
>
> 지원 제외는 다단 머리글 합성·20행 밖 자동 탐색·단일열 제목 구분·숫자 머리글 확정과 **머리글 없는 표의 첫 행 포함 비교**이다. 헤더 없는 표에 '수동1 선택으로 전 행 보존'을 약속하지 않는다. 이 작업에서 headerRow=0 또는 머리글 없음 모드를 새로 도입하지 않는다. 자동 감지 기능은 유지한다.

근거: 원시22패턴에서 suggested12(그중 의미 오판5), uncertain8, none2. CSV에서4패턴이 다른 출력. 머리글 없는 텍스트 표 첫 행만 변경하면 suggested1 아래 데이터는 모두 matched이고 첫 행 차이가 누락된다. 세로 병합 A1:A2+3행 머리글 사례는 코드 suggested3/본문 uncertain(null)로 다르다. 본문에 맞춘 수정 프로토타입은 기존22 결과를 유지하고 그 추가 사례만 uncertain으로 바꿨다.

## 단계 분할·수용 부분의 정본 정리

1. **기준 갱신(S0)**: 선행 `excel-report-width-20260907` main 병합 확인 → 최종 main SHA 기입 → 열린 계획서 충돌 검사 → 그 main의 production bundle baseline. 원 U4/DC/XR 트리는 사용하지 않는다.
2. **스키마·엔진·보고서(S1)**: 중복 전용 discriminated union/생성기, 배열 불변식, append·취소, displayKey/count, 분할 formatter·Parameters·무결성 호출을 함께 완성하고 그 단위시험을 같은 단계에서 갱신한다. engine-only 중간 산출은 내부 검증 완료이며 제품 공개 가능한 완료가 아니다.
3. **화면(S2)**: records 소비처 전환, 전체 검색/안정 key/500그룹, 양측 lazy 50/50/0 목록, 전체값 dialog, 다운로드·ZIP을 연결한다. **S1+S2가 제품 동작의 하나의 전환 단위**다. S1만 적용된 페이지는 새 schema를 제대로 읽지 못하므로 배포·병합 후보로 취급하지 않는다.
4. **감지(S3)**: 순수 detector·원시 sample → inspect request/response → client pre-abort/token/cache → 파일·시트 상태/swap → ko/en 안내를 같이 구현한다. 수동/경쟁/취소 시험은 이 단계에 둔다.
5. **최종 통합(S4)**: 전 스모크·production static·bundle·QA 결과 visual/a11y 및 Gemini 직접 시각 검수를 실행한다. '하네스 마지막'은 통합 범위 확장을 뜻하며 S1~3의 회귀시험을 끝까지 미룬다는 뜻이 아니다.

각 단계의 실제 명령과 성공 기준은 REPORT.md (v)를 그대로 정본에 첨부한다. 모든 미해결 예외는 '범위 밖 발견'으로 보고하고 sol이 정책을 새로 선택하지 않는다.

규칙4: features ko/en/guide/FAQ와 관련 SEO·tools·정적 생성 입력만 갱신, URL/canonical/hreflang/sitemap 집합·일반 광고 배치·격리 경로 불변. 규칙5: 타입 접두사·내부 reason/error·광고/격리 상태를 사용자 화면에 출력하지 않는다. 규칙19: 추적코드를 제외한 로컬 QA 빌드의 **결과 상태**를 Gemini가 직접 보고 Codex가 실측 교차한다. 이번 프로토타입 axe0는 제품 검수 통과가 아니다.

**최종 착수 조건**: 위 잔여 판정과 문안 통합으로 Claude–Codex 이견0을 확인한 뒤, 선행 브랜치 main 병합·새 기준 SHA 기입·실행 게이트 재검사를 모두 완료하여 정본화된 단일 작업계획서로 디스패치한다.
