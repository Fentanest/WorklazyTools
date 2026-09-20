# BL04 XLSX/XLSM 오류 타입 소실 — 상세 수리 지시서

## 공통 실행 계약
- 작성/판정 Codx, 기준 `d9c79b7a16f5b99fa7cddfde741b8d10f08f07d0`, 브랜치 `s3-pdf-finish`, 2026-09-09. 이번은 **문서 정본화만**. 상태: **상세 정본 — 실제 gpt-5.6-sol R2 이견 0**.
- 현재 사용자 지시가 이전 로드맵의 U7/U8 상세 작성 연기와 번들 “마지막 상향” 조건을 대체한다. **번들 용량 상한 없음; 용량 정리는 모든 정본 작업의 맨 마지막.** 배포 JS/worker/public/mjs/CSS·route별 raw/gzip 증분과 초기/실행시 요청량은 계속 계측한다. 로딩 성능을 위해 route/엔진은 지연 로딩한다. 메모리/응답성 안전 경계는 번들 상한과 별개다.
- 실행자는 PROJECT_RULES.md 전문, 이 문서, PLAN-INDEX와 참조 정본/기각 이력을 선독하고 `git rev-parse HEAD`, `git status --short`, `git diff d9c79b7..HEAD -- <대상>`로 기준 차이와 열린 계획 충돌을 기록한다. 계획 승인과 제품 구현 착수/배포 승인은 구별한다. 이번엔 구현·커밋·push·배포가 금지다.
- 새 회귀는 수리하고 기존 부채는 부모 대조 증거로 backlog에 귀속한다. 매 구현 라운드: 되돌림 사냥, 하위 호환 oracle, 검사기 음성 대조/누락 감지, 사용자 경로 재현. 큰 검증을 미루면 항목을 기록해 최종 병합 전 전부 실행한다. 아래 미래 명령을 이번에 통과했다고 기록하지 않는다.
- UI가 생기면 ko/en 행동 중심 오류/진행/빈 상태/취소/부분 결과/접근성 이름, toolRegistry·App.tsx lazy route·SEO·정적 페이지·sitemap·FAQ·소셜 이미지 생성 입력을 함께 반영. 기존 일반 광고 경로를 사용하며 새 격리 필요성을 근거 없이 만들지 않는다. production 정적 검증과 `VITE_LOCAL_QA=1` 광고·분석 없는 브라우저 검증을 분리한다. 새 경로의 일반 로더와 기존 광고 제외 경로의 요청 0, 모바일 320/390·820/821·desktop, ko/en·light/dark·키보드·드래그 버튼 대안을 검증한다. Worker/런타임/원시 예외를 사용자에게 노출하지 않는다.
- 생성물 직접 수정 금지. 코드 변경은 CHANGELOG(Codx), 판정/기각/수치는 review-notes(Codx). 이번 문안은 `/tmp/worklazy-canon2/tracked-updates.md`에만 남긴다.

## 현상·원인·귀속 실측
높은 우선순위 spreadsheet-core 기존 결함. 머리글 자동 감지는 `a002c0c`로 이미 도입됐고 이번은 detector threshold 변경이 아니다.
`node --experimental-strip-types /tmp/worklazy-canon2/bl04-repro.ts` exit0; 독립 sol 보고 `reviews/BL04-INDEPENDENT.md`. A1='ID', B1=진짜 #DIV/0!, C1=진짜 #N/A + 숫자 데이터2행을 각형식으로 직렬화→`parseSpreadsheetInput`→`detectExcelCompareHeader`.
|입력|B1/C1 모델|머리글|
|XLSX/XLSM 실제 error|type string, 값 '#DIV/0!'/'#N/A'|suggested row1(오판)|
|XLS/XLSB/SpreadsheetML 실제 error|type error, 값7/42|uncertain null|
|5형식 literal 텍스트 '#DIV/0!'/'#N/A'|type string|suggested row1(정상)|
`inputAdapter.ts:134-145` 형식 분기 → `:175-176` ExcelJS 로드 → `:192` normalize → `:198` scalarType(value). `normalizeExcelJsValue:438-446`의 error→value.error 문자열 평탄화로 원타입이 소실되고 `scalarType:455-459`는 문자열로 분류한다. 반면 SheetJS `:269-275`는 cell.t==='e'를 별도 전달한다. `headerDetection.ts:51,54-61`의 비오류 문자열 비율은 3/3 vs1/3으로 달라진다. 문자열 blacklist는 실제 문자열까지 깨므로 금지.

## 수리 계약
- OOXML **원래 ExcelJS 값/캐시 result의 error 태그 신호를 normalize 전에 획득**하고 `scalarType(value, isError)`에 전달. type 시스템 확장/전부 객체 유지 불필요. XLSX/XLSM의 value/cachedValue/displayValue는 현행 문자열을 그대로 두고 **type만 error로 교정**한다. legacy의 숫자 오류 표현을 통일하는 별도 리팩터 금지.
- 캐시 오류의 기대 tuple은 value="#DIV/0!", cachedValue="#DIV/0!", type=error, cacheState=present; missing은 value=null, cachedValue=undefined, type=blank, cacheState=missing. 일반 오류 `cell.value`의 `{error:...}`와 formula의 cached `cell.result` 오류를 구별해 양쪽 모두 type error. `formula && cacheState==='present'`에서만 result 오류를 type에 반영; missing 캐시는 null/blank·cacheState missing 유지. 정상 수식/공유 수식/배열 수식의 formula 문자열·ref·cachedValue·lineage·format·date1904 불변. 판정식은 `raw !== null && typeof raw === "object" && Object.prototype.hasOwnProperty.call(raw, "error") && typeof raw.error === "string"`. nonformula raw=cell.value, formula+present raw=cell.result, 나머지 false. formula wrapper 재귀 탐색/오류명 허용목록0. ExcelJS ValueType.Error는 일반 오류의 교차 oracle로만 사용; 문자열 '#N/A'는 false.
- `normalizeExcelJsValue`는 현재 scalar 계약 보존, detector/normalization threshold/자동 선택 UI의 정책을 수정하지 않는다. C1 `SpreadsheetCellType` 이미 error가 있으므로 신규 공개 API/worker payload shape 없음.
- **의도된 전파**: `excel-compare/normalization.ts:97`은 type error와 string을 구분하므로 동일 표시값이라도 실제 오류 vs literal이 새로 차이로 보이는 것이 올바르다. 이 경로 기대값 변경은 BL04 의도 변화로 명시. 기존 비오류 golden을 새 기대에 맞춰 통째 재생성 금지.
- C1 소비자(Excel compare/cleaner/QR/U7 예정)와 xlsxReport 출력 전수 검색. 오류 셀 type만 교정했는데 오류 값/셀 형식 소실이 새로 생기면 회귀로 수리. 기존 오류 재출력 값 손실은 부모 대조 후 별도 backlog; detector 수리 범위를 임의 확대하지 않는다.

## 단계 분할·골든
BL04-0 부모/current 5형식 actual-error/literal 대조, 소스 기반 원인 재현·비오류 model oracle 저장. /tmp 합성만 사용, 사용자 미추적 문서 접근0.
BL04-1 원시 오류 신호 helper 또는 지역 판단 최소 변경+unit. 정규식 '#N/A' 탐지/숫자7·42를 error로 추측 금지. code dispatch는 실제 기준 HEAD 고정과 충돌검사 후만.
BL04-2 head→C1→detector→비교UI·보고서 전파 검증. 수식 오류 cached 및 missing, '#DIV/0!'/'#N/A' 문자, #REF!/#VALUE!/#NAME?/#NUM!/#NULL!, blank/boolean/number/date/richText/hyperlink, 공유·배열 수식·1900/1904를 포함. 실제 xlsm content type 및 VBA파트 포함 합성 fixture를 사용하며 '확장자만 xlsm' 대조를 본 증거와 구별한다(매크로 실행은 하지 않음). VBA 파트는 XLSM 실제 형식 분류/메타 현실성의 oracle이며 VBA를 실행/내용 변경하지 않는다. 해당 fixture의 매크로 동작을 검증했다고 주장하지 않는다.
BL04-3 compare 기존 골든/cleaner/QR 회귀·검수·기록. BL01/02/03/05 UI 수리는 여기에서 하지 않는다.

## 하위 호환·완료 기준 검증 명령
현재 독립 재현은 실패 원인 확인만 완료. 아래는 제품 수리 때 실행할 미래 계약이다.
```sh
npm run build
npm run test:unit
npm run test:excel-compare
npm run test:excel-cleaner
npm run test:qr-bulk
npm run test:static
npm run test:utilities
npm run bundle:measure
```
`tests/unit/spreadsheet-core.test.ts`와 기존 header tests에 직렬화 roundtrip·formula cached/error/literal 대조 추가(실제 파일명은 실행 inventory에 맞춤), 사용자 경로 재현은 xlsx/xlsm 각각 ko/en 자동 감지 uncertain·수동1행 선택 가능·정상 문자열 suggested 유지. 기존 비오류 model(JSON 정규화)/행 좌표/normalization/보고서 구조와 legacy XLS/XLSB/SpreadsheetML의 모델이 baseline과 동일. 기존 고정 출력 byte oracle이 있으면 diff0; ExcelJS ZIP timestamp가 가변인 새 출력은 clock 고정 또는 ZIP payload별 독립 대조를 하며 전체 byte 동일을 근거 없이 요구/주장하지 않는다. 원본 SHA 불변.
음성 대조: helper를 false로 치환하면 actual-error 테스트 실패, 문자열 blacklist면 literal 테스트 실패, formula cached 오류를 누락하면 formula 테스트 실패. 감지기 단위 모델만 인위 구성해 adapter 경로를 건너뛰는 테스트는 완료 증거가 아니다.
새 UI 문구/route0: ko/en 기존 uncertain/suggested 문구 그대로, SEO/static/sitemap/FAQ/광고 제외 경로 영향 없음은 diff+static/locale 스모크로 확인. 오류 현지화 누락이나 raw message 노출은 신규 변경분에 한해 수리. 번들 사전 증분: 의존0, 태그 판단 로직 소량 **미측정**, 완성 gzip 실제값 기록·상한 없음.

## 명시 제외
이번 코드 구현/저장소 수정/commit/push/deploy, 머리글 점수·기준/오류명 blacklist·기존 비오류 골든 재기록·legacy parser 교체·수식 계산·오류 코드 표시값 통일·BL01/02/03/05·번들 다이어트.

## 반박에서 뒤집힌 것
R1 sol 3건 수용: ①own string error 원신호 판정식을 입력분기별 고정(차단 이견 해소), ②cached/missing tuple 고정, ③의도된 OOXML type delta와 legacy/비오류 diff0 분리·VBA 현실성 oracle 범위 명시. 수리 방향 변경0건, 구현 계약 구체화3건. R2 독립 확인 완료, 이견0. 독립 재현·원인확인은 반박 횟수와 분리.
