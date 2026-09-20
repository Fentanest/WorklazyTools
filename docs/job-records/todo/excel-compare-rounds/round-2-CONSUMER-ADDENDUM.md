# O02 소비처 재검사 — Codx, 2026-09-07

기준: main `5bc6854` 사본. `logs/consumers.txt`, `logs/assertions.txt`는 실제 repo src/tests/scripts 실행 확장자의 재귀 검색 결과. 1차 inventory의 파일군은 핵심 경로를 포함한다. 다만 **줄 번호 일부가 실제 기준과 다르고, O04 분할을 다루는 새 단언 및 검사 하네스 자체의 의미 계약이 빠져 있다.**

|표면|실제 기준 위치|판정/추가할 검증|
|---|---|---|
|중복 emit|src/features/excel-compare/compareEngine.ts:122–129|각측 scalar 행→그룹 한 record. 2:3/2:1/1:2/2:0/0:2/1:1·빈 키·정규화·복합키·왼쪽 Set 다음 오른쪽 중복키 순서|
|배열 복사|같은 파일:378–384|1차 inventory의 groupRows:387은 부정확. append 및 4096 취소. secondary/occurrence 의미 동일|
|summary/Parameters|같은 파일:490–545|summary duplicate 그룹 수; duplicateCountUnit과 비적용 UNUSED. 출력의 split 메타데이터는 report 책임|
|현재 검색|ExcelComparePage.tsx:207–213|old scalar 검색은 tail/원본행번호 모두 누락. 새로운 조회는 내부 identity 대신 displayKey, 전체 배열/행번호를 포함. 비중복 검색은 현행 유지|
|현재 결과 행|같은 파일:260–265|실제 tr:261, 더보기:265. index 포함 React key가 검색/필터로 바뀌면 펼침 상태가 엉뚱한 그룹으로 이동 가능. duplicate는 pairId+내부key. locationText 우회·scalar 값 대신 독립 목록. 표의 전체값/원본행 표시|
|현재 위치/오류 표시|같은 파일:406,408–409|1차 416–421이 아님. null이면 현재 위치는 `L –:– · R –:–`. duplicate용 표시 분기 필요; 내부 reason코드 기본 safe fallback 유지|
|보고서|report.ts:12–57|기존 13열/9시트 외 값전체/그룹경계/분할/행번호 조각/0측빈칸/Summary/Parameters를 검증. report가 UI용 records를 변형하지 않는 deepEqual. 같은 displayKey의 서로 다른 그룹도 구분|
|wire 및 성공 노출|excelCompare.worker.ts:65–78, excelCompareClient.ts:49–65, Page:160–198|배열 structured clone, reportBuffer transfer/길이·Blob 일치, 생성검사 await 보존. 1성공 개별만/2성공 ZIP/실패쌍 제외. actual browser prototype은 신규 배열과 2개 ZIP 항목 왕복을 검증했으나 제품 Page 통합은 구현 gate|
|inspect 취소 helper|src/utils/workerLifecycle.ts, excelCompareClient.ts:22–32|**inventory에 helper 독립 행 추가**. 함수 변경 자체는 불필요할 수 있지만 pre-abort 읽기0/worker0, terminate 및 새토큰 소유권을 테스트해야 함|
|감지 타입/순수 helper|types.ts:94 이후, 새 detector 파일|최초 suggestion 필수/수동 생략 가능, null↔reason 불변식. 22형태×6형식 기대표·추가세로병합·empty·raw formula/error. 시트별 캐시와 token/state는 기존 Page/pairFiles 군|
|표시 문자열 구성 helper|normalization.ts:80–84 cellText, compareEngine.ts:460–461 rowText|displayKey를 셀에서 구성하고 키 구분자 고정. 원래 rowText의 열 순서/빈셀 포함/수식 캐시 누락 표현을 보존. identity 문자열 파싱 금지|
|가시성 helper|선행 tests/xlsx-report-assertions.mjs + reportIntegrity.ts|열 양수·유한 검사와 내용 동일성 검사를 분리. longKey 초과와 Node ZIP encoding은 현 validator를 통과해도 내용 실패 가능|
|기존 스모크|tests/excel-compare-smoke.mjs:103–104,128–139,249–261,369–388,465–476|현재 duplicate0·reconcile수치·Blob 음성 주입 유지. 분할 XLSX를 ZIP에서도 재개방, 그룹 count를 report rowCount로 잘못 비교하지 않음. old filename/URL revoke 순서 보존|
|visual/a11y/locale|tests/visual-regression.scenarios.mjs, accessibility-audit.mjs, feature-locales.test.ts|빈 상태만으론 부족. ko/en×두화면×두테마의 duplicate 결과/후보·미감지·수동·dialog를 추가. 번역 key parity는 의미/복수형/알림중복 테스트 대체 불가|
|생성 입력/회귀|scripts/generate-excel-compare-fixtures.mjs, seo.ts, tools.json, 관련 정적생성 입력|합성 fixture만 생성. URL·광고예외 추가 없음. 공용 writer 소비 Cleaner/QR 회귀 유지|

## 기존 단언의 정확한 변화

**현재 `leftRow=null` 전환 때문에 깨지는 duplicate 전용 행 위치 단언은 0개다.** '있을 것이다'를 파일·라인으로 만들어내지 않았다. 스키마 전환의 검증 공백이다.

- `tests/unit/excel-compare.test.ts:84`만 고정된 nonzero duplicate4→1 변경이 필요하다.
- `:63–64`는 위치 모드 added/changed, `:89`는 occurrence changed 3↔3, `:189`, `:236–237`은 reconcile ambiguous 원본행이다. 이들은 duplicate가 아니므로 그대로 유지한다. 1차 inventory에서 occurrence가 :91이라고 한 줄은 :89로 정정한다.
- `:94` duplicate0, 스모크 :104/:466 duplicate0는 유지한다. `summary.duplicates`는 Excel Cleaner 속성이므로 이번 의미 변경과 무관하다.
- `:282–298`의 9시트·문자열·수식0 report 테스트는 위치 모드 fixture다. grouped 내용을 전혀 검증하지 않는다. 이 테스트만 녹색이어도 duplicate scalar 보고서가 비어 있을 수 있다.

재현: 원 unit에서 engine import만 프로토타입으로 바꾸고 :84의 4→1만 바꾼 `/tmp/worklazy-xc-r2/probes/engine-transition.test.ts` **15/15 통과**. 기존 6파일 34개까지 합쳐 **49/49 통과**(`logs/unit-targeted.log`). scalar 위치 단언을 삭제하거나 다른 정책 기대값을 변경하지 않았다. `supplement-probe.mjs`는 `L –:– · R –:–`와 old tail검색=false/신규검색=true를 직접 재현한다.

결론: inventory는 **기존 핵심 파일군 파악에는 충분**, 전환 완료 판정의 단언 목록으로는 본 추가 내용이 필요하다. 파일 라인만 정정하면 내용검증 공백이 사라지는 것이 아니다. 새 표본은 각 구현 단계의 테스트에 넣고 마지막 통합 단계까지 미루지 않는다.


종료 갱신: 선행 width ref64af7은 `src/utils/xlsxReportDataRows.mjs`와 `.d.mts`를 추가한다. reportIntegrity/helper의 실제 값 행 판정 및 이 선언 파일을 최종 기준에서 보존한다. 최신검사로 두 안의 실다운로드/ZIP을 재검증한 결과는 `logs/final-width.json`. 기존 :줄은 여전히5bc6854기준이므로 병합 뒤 줄번호를 다시 잡는다.
