# 소비처·단언 전수 대조 (Codx)

기준 main `5bc6854`. `evidence/consumers.txt`, `assertions.txt`는 src/tests/scripts의 실행 파일 재귀 검색 결과다. 줄 번호는 기준 사본을 가리킨다. A=records 선택 필드 확장, B=별도 duplicateGroups. 두 안의 producer 프로토타입은 `main/xc-probes/engine-fields.ts`·`engine-groups.ts`다.

|파일·소비처|A 필요 변경|B 필요 변경·추가 위험|기존 단언/추가 단언|
|---|---|---|---|
|`types.ts:57` ExcelCompareRecord|중복 배열·표시키·상태별 불변식|그룹 타입 신규|0/1/복수 양측, 배열 길이 일치|
|`compareEngine.ts:17,121` 엔진 반환·emit|키당 중복 record 1개|엔진 반환에 그룹 배열 추가; 중복을 records에서 제외|기존 error 정책 4→1; 빈키·정규화·2:0/0:2/2:1/2:3|
|`compareEngine.ts:490` summarize|기존 레코드 카운트 알고리즘 유지 가능|records 합산 외 group.length 합산 필요|summary.duplicate=중복 그룹 수; 다른 상태 결과 동일|
|`compareEngine.ts:387` groupRows|반복 배열 복사→append 권장|동일|정규화·순서 동일, occurrence/secondary 회귀|
|`compareEngine.ts:497` Parameters|duplicateCountUnit 기록 제안|동일|error일 때 key-group, 그 외 UNUSED|
|`excelCompare.worker.ts:68-78` 결과 동봉|records 안 배열은 structured clone 그대로 운반|명시 result 객체에 duplicateGroups 동봉하지 않으면 유실|JSON/worker 왕복 양측 전체 목록 일치|
|`types.ts:81` PairResult|records 타입 경유|duplicateGroups 필드 필수 추가|스모크 결과 주입·파일별 성공 타입|
|`excelCompareClient.ts:41-65` compare 수신|전달·무결성 흐름 불변|타입 확장 필요, 내용 직접 가공은 없음|수신 byteLength·새 배열 운반|
|`ExcelComparePage.tsx:31,160-178` CompletedPair/Blob|그룹 보존, reportBuffer 정리·URL 유지|추가 배열이 result에 남도록 함|실다운로드·URL revoke 후행·실패 격리|
|`ExcelComparePage.tsx:207-213` 필터·검색|전체 배열과 원본 행번호 조회로 변경|groups를 UI records로 투영하거나 모든 필터 분기 추가|접힘 마지막 값·행번호 검색; group만 있는 결과도 노출|
|`ExcelComparePage.tsx:265-281` 상태·테이블·위치·500개 limit|양측 독립 목록, 안정 key, 위치 표시 분기|두 결과 집합을 합치고 페이지 크기를 통일|2:3을 한 tr, 첫행 임의 매칭 표시 없음|
|`ExcelComparePage.tsx:416-421` locationText/reasonText|중복은 단일 locationText 우회; safe reason 유지|동일|키/사유 내부 코드 비노출|
|결과 정렬|기존 UI 정렬 기능 없음; Set 삽입순서 보존|그룹/records 합치면서 임의 정렬 위험|다중키 B→A 순서·비중복 순서 유지; 새 sort 기능 불필요|
|`ExcelComparePage.tsx:189-198`, `zipArchive.ts` ZIP|그룹 XLSX가 정상일 때 기존 Blob entries 사용|동일; result 수와 record/group 수 혼동 금지|1성공 no ZIP, 2성공 ZIP 2개·각 내부 Duplicates 수치|
|`report.ts:12-23` Summary/Parameters|duplicate 숫자 의미/단위 입력 반영|groups 길이 합산을 engine에서 반영해야 함|Summary 8상태 이름 불변; Parameters 새 단위만 추가|
|`report.ts:28-57` 상태 분배·recordSheet|Duplicates만 배열 formatter·길이 가드|Duplicates 입력을 group 배열로 바꾸거나 materialize|13열 이름/순서·전체 번호/값·0건 빈칸·텍스트 주입 방어|
|`report.ts:36` topology|9시트 고정 보존|동일|현행 검사는 시트 이름 문자열뿐; 13열이나 행 수를 검증하지 않음|
|`xlsxReport.ts` 공유 writer|선행 유한 너비 수정 계승; 직접 기능 변경 불필요|동일|중복 셀 줄바꿈·긴 값, 폭 유한; 데이터 길이와 가시성 검사는 별개|
|`reportIntegrity.ts`/worker/client/page|선행 async 생성검사·byte/Blob 수명 보존|동일|새 검사 통과만으로 Duplicates 데이터 존재가 보장되지 않음|
|`types.ts:94`, worker inspect `:28-52`|시트별 후보/상태·후보 헤더 동봉|중복안과 무관하게 동일|후보4→headerRows [1,4], 추가 RPC 0|
|`ExcelComparePage.tsx:99-130` select/refresh|token·signal·수동 캐시·최초 제안 적용|동일|4/7 응답 역전·재선택·취소·finally race|
|`pairFiles.ts:3-28,49-80`, Page `:324-341,380-410`|시트별 선택 상태·swap·범위 검증|동일|새 metadata 좌우 교환, 시트 전환 후 수동값 복원|
|`locales/{ko,en}/features.json`|중복 집계·목록·전체 값·미감지·오류·guide/FAQ|동일|feature-locales key parity + 결과 상태 번역/복수형|
|`tests/unit/excel-compare.test.ts:77-98`|**:84 summary.duplicate 4→1**|동일; records 단언도 projections 필요|:91 occurrence changed 위치, :94 secondary duplicate0, :95 ambiguous0는 유지|
|동 unit `:31-49,282-298`|선행 async 무결성 변경 유지; grouped 9/13/주입/초과 추가|동일|현행 report 테스트는 문자열·수식0·9시트만, 그룹 목록 검증 없음|
|`tests/unit/excel-compare-fixtures.test.ts`|기존 1900/1904·xls/xlsb/xlsm 파싱 기대값 유지; 감지 형식 추가|동일|기존 summary.changed0는 변경 대상 아님|
|`tests/unit/excel-compare-pair-files.test.ts:73-100`|새 per-sheet 선택/제안 상태 swap 단언 추가|동일|기존 file/inspection/error/header/key/reconcile 교환 유지|
|`tests/unit/spreadsheet-core.test.ts`|parser 변경 없다면 유지, 선행 width 골든을 후퇴시키지 않음|동일|CSV 문자열/OOXML 병합·타입 차이를 감지 fixture에 반영|
|`tests/excel-compare-smoke.mjs:103-104,249-261`|기존 단일 pair Summary의 duplicate0 유지; 그룹 성공 케이스 추가|동일|현재 smoke에는 duplicate3정책 실행·그룹 행 번호·값 목록 단언 없음|
|동 smoke `:128-139` ZIP|목록 결과가 포함된 XLSX까지 재개방 추가|동일|기존은 ZIP entry names, 개별 보고서만 주요 내용 검사|
|동 smoke `:200-202,465-476`|무결성 주입·swap·optional reconcile 유지|동일|duplicate0/ambiguous2/unmatched3 기존 수치 유지|
|`tests/visual-regression.scenarios.mjs`, `tests/accessibility-audit.mjs`|결과 상태 시나리오/axe 표본 추가|동일|현행 excel 비교 empty/모드 선택 표본만으로 접힘/긴값/후보 못 검증|
|`scripts/generate-excel-compare-fixtures.mjs`|순수 합성 중복·머리글 fixture 추가 또는 별도 생성기|동일|사용자 파일/경로 커밋·CI 참조 금지|
|`scripts/benchmark-excel-compare-alignment.mjs`|위치 정렬 계약 불변|동일|정렬 budget 회귀; 중복 그룹 count 기대값 없음|
|`tests/unit/feature-locales.test.ts`, `seo.test.ts`, `tool-registry-routes.test.ts` 및 정적 검증|guide/FAQ/SEO 입력 변경 동반 검증|동일|URL/registry 20개 집합 유지; 신규 route 불필요|

`summary.duplicate`의 기존 **0이 아닌 고정 기대값 변경은 :84의 4→1 한 곳**이다. 현재 화면에는 summary 상태 숫자를 출력하는 컴포넌트가 없고 status 버튼에도 count가 없다. `summary.duplicates`는 Excel Cleaner의 별도 속성이므로 변경 대상이 아니다. 현재 엔진의 다른 상태는 셀/거래 단위가 섞여 있어 전체 합계를 입력 행 수라고 설명하면 안 된다.

## 선행 열 너비 커밋과 실제 교집합

조사 중 branch ref가 base에서 `ac9cc4a2638aeb497a69668079be050786e6edf7`로 이동했다. 다른 worktree를 읽거나 수정하지 않고 git 객체의 diff를 보관했다(`evidence/width-branch.diff`).

|선행 변경 파일|이번 작업의 교집합|보존할 단언/계약|
|---|---|---|
|excelCompare.worker.ts|직접 수정|**await assertGeneratedXlsxReport(buffer)**; inspect 변경 중 await를 잃지 않음|
|tests/excel-compare-smoke.mjs|직접 수정|assertNineSheetReport 시작의 **await assertVisibleXlsxReport(bytes)**|
|tests/unit/excel-compare.test.ts|직접 수정|생성검사 doesNotReject/rejects 전환·missing-width/header-only 음성; 새 duplicate 기대값은 별도|
|CHANGELOG.md, docs/review-notes.md|후속 기록 시 직접 수정|선행 기록 보존·작업별 Codx 서명|
|src/utils/xlsxReport.ts|호출/내용 영향|유한 width loop·50,000행 시험|
|src/features/excel-compare/reportIntegrity.ts|호출 의미 영향|async ZIP/XML 가시성 검사·기존 안전 오류 code|
|tests/unit/spreadsheet-core.test.ts|선행 회귀 유지|sparse width 골든·50,000행 RangeError 없음|
|tests/xlsx-report-assertions.mjs|선행 공용 helper 소비|열 가시성·데이터 존재 검사; grouped 내용 수치는 별도로|
|tests/excel-cleaner-smoke.mjs, tests/qr-bulk-smoke.mjs|회귀 실행|3소비처 공용 writer 가시성 검사|

**`src/features/excel-compare/report.ts`는 선행 커밋에서 바뀌지 않았다.** 초안의 “같은 report.ts를 건드리므로”는 정정한다. 병합 후 착수 순서는 async 생성검사·공유 writer·공통 단언의 의미 의존성 때문에 계속 타당하다. 현 main은 여전히 `5bc6854`여서 구현 착수 게이트는 아직 열리지 않았다.
