# 작업지시서 — U2 Excel 데이터 정리 (2026-09-03)

**상태: 구현 완료 (`dac13bb`, 2026-09-03) — 4차 왕복 이견 0 정본의 "v2 확정 사항"(v3·v4 정정 포함)을 구현·검증함.** 상위: `new-tools-roadmap-20260903.md`(정본).
기준 해시: **`9c28c8c714ccabf7fed675e67f35c81e1d33fa4a`**(Claude 실측, `git rev-parse HEAD`=`origin/main` — U1 후속 push 직후). 경로 `/tools/excel-cleaner` · 이름 "Excel 데이터 정리 / Excel Data Cleaner".

## 범위

정리 작업을 추가·순서 변경하는 파이프라인. 다중 파일·시트(C1), 출력 XLSX·CSV. `src/features/excel-cleaner/` + 전용 워커. **U2 선행 단계(U0.1)**: C1 편집 표면 확장 + C4 append helper(확정 2·4항).

## v2 확정 사항 (1차 왕복 10건 — 우선 계약)

1. **수식 정확 갱신은 자체 변환기**(실측: ExcelJS 4.4.0 splice는 상대·절대·범위·교차시트 참조를 전혀 갱신하지 않고, 공유 수식은 master/slave 어긋남으로 **저장 실패**·삭제 참조도 `#REF!` 미생성): 정확 갱신 지원은 **token-aware 수식 파서 + 행·열 좌표 변환표**를 거친 **동일 시트·비공유·비배열 수식의 A1 단일/직사각형 범위 참조로 한정**. `$` 보존·삭제 참조 `#REF!` 치환·부분/전체 삭제 범위 규칙·열 이동 규칙 명문화. **교차시트·defined name·table/structured reference·동적 참조·shared/array 수식은 preflight에서 감지 → 경고 후 값만 출력 강등**(사용자 확인). 구조 변경에 ExcelJS splice 사용 금지 — C1 투영 모델 위에서 변환 후 출력 workbook 재구성. **(3차 정정) 좌표 변환 지원 연산 집합은 실제 규칙 집합에 고정: 행 삭제 / 열 삭제·삽입·재정렬**(행 삽입·행 재정렬 규칙은 존재하지 않음 — 검증 목록도 동일 집합). **열 재정렬·결합·분리로 참조 범위가 비연속이 되는 수식은 해당 셀만 캐시값 강등**(전체 차단 아님) + 오류 행 시트 기록.
2. **C1 편집 표면 확장(U0.1)**: 현행 C1은 `formula`/`result`만 투영 — U2 preflight에 필요한 **수식 종류(shared/array)·shared ref·defined names·table 메타데이터·원본 행/열 lineage**를 C1 OOXML 투영에 추가(단일 파싱 유지 — 이중 파싱 금지). **값 강등 안전 조건**: 모든 수식 셀에 유효 캐시값 존재 시에만 값만 출력 허용 — 캐시 없는 수식 발견 시 해당 셀 목록과 함께 실행 차단. **(3차 정정) C1 투영에 `cacheState: present|missing` 필드 신설**(현행은 누락도 `cachedValue:null` — `0`·`false`·`""`·오류 캐시와 누락을 구분, 각각 단위 테스트). **(3차 정정) 수식 처리 지원표**: 정확 수식 갱신 = **OOXML(XLSX·XLSM)만**. BIFF8·XLSB·SpreadsheetML은 **수식 존재 시 전부 경고 후 값 강등**(SheetJS `v` 캐시값 존재 조건 — 없으면 차단, 메타데이터 표면이 얕아 shared/array 판별 불신). CSV는 수식 개념 없음. 필터·중복 판정이 수식 결과를 쓸 때 "저장된 계산값 기준" 명시.
3. **병합 계약**: 병합 해제·값 채움은 **master 값·범위 snapshot 후 unMergeCells → 채움을 원자 실행**(실측 API 확인). **살아 있는 병합이 있는 상태의 행/열 삭제·삽입·이동 금지** — 구조 규칙이 병합 규칙보다 앞이면 실행 전 순서 오류 표시(ExcelJS 문서도 splice×merge 예측 불가 명시). 병합 유지한 채 구조 변경은 1차 명시 제외.
4. **출력 topology·C4 append**: C4에 **기존 workbook에 보고서 시트를 추가하는 append helper 신설**(`buildXlsxReport`는 새 workbook 생성이라 부적합 — 실측). 출력: **입력 파일당 XLSX 1개 = 정리된 선택 시트 + 보고서 4시트**(변경 요약·처리 규칙·오류 행·제외 행 — 이름 충돌 시 결정적 suffix). **미선택 시트는 출력에 미포함**(보존 시 정리된 시트 참조 무결성 보장 불가 — ko/en 안내 명시). CSV는 선택 시트당 1개. 파일명 `SafeFileNameRegistry`+`createUniqueSafeFileName`, ZIP은 `writeZipArchive`(결과 2개 이상).
5. **CSV 주입 방어(제품 결정)**: 정리 CSV의 기본값은 **원문 보존**(데이터 충실성 우선) — 단, 위험 선행 문자(`=` `+` `-` `@`·탭·CR/LF·선행 공백) 감지 시 다운로드 전 텍스트 경고 표시. **안전 모드 opt-in**(위험 선행 문자에 `'` 접두) 제공, 적용 여부를 처리 규칙 시트에 기록. **(3차 정정) 제품 문구에서 원문 모드를 "안전함"으로 표현 금지.** 상위 로드맵 C4의 "CSV 별도 방어 명시" 요구를 이 계약으로 충족. 위험 문자 fixture 완료 기준 포함.
6. **워커 모델(결정)**: **미리보기 = 명시 재계산**: 갱신 시마다 새 워커에서 파일 하나 전체 파이프라인 실행 → 전 단계 N행 샘플+전체 집계를 단일 terminal 결과로 반환 후 종료. **(3차 정정) `runModuleWorker`를 timeout/heartbeat 옵션으로 공용 확장**(U1 회귀 유지): 워커가 `rule-start`/`progress` 메시지(rule instance ID 포함)를 발신, 부모는 inactivity timer(무진행 30초 초기값)로 watchdog — 초과 시 terminate + **사용자 취소와 구분되는 지역화 timeout 오류**(해당 규칙 지목). 이전 미리보기 job abort + generation ID로 늦은 결과 폐기 + 규칙 변경 시 스테일 배지. 최종 산출은 U1 패턴(파일 단위 순차 워커).
7. **규칙 28종 확정 ID 표**(아래 절 — 안정적 영문 type ID·설정·대상·통계 필드). **선행 0 보존은 규칙이 아니라 변환 규칙(25~28)의 불변 조건**(텍스트 타입·`@` numFmt 존중). `keep: first|last|latest`는 `dedupe-by-columns`의 설정(latest는 날짜 열 지정 — 변환 실패·동률·빈 날짜 정책: 실패/빈 값은 최구(最舊) 취급·동률은 원본 순서 유지, Parameters 기록). **열 선택은 stable column ID**(파싱 시 부여한 lineage id — 이름 변경·순서 변경 후에도 유지). **(3차 정정) 파생 열 ID 영속화**: 열을 생성하는 규칙(`combine-columns`·`split-column`·`add-constant-column`·`add-row-number-column`)은 출력 열 ID를 **규칙 JSON에 선언**해 후속 규칙이 참조 가능. `split-column`은 최대 분할 수 N(1~50) 설정 필수 + N개 출력 ID 선언(초과 조각은 마지막 조각에 잔류). 규칙이 참조하는 열 ID가 그 시점에 존재하지 않으면(삭제됨 등) **실행 전 파이프라인 검증 오류로 차단**. 제외 행 "원문"은 **해당 규칙 적용 직전 상태**로 확정. 구현 순서: ① 규칙 스키마·validator·lineage ② 수식/병합 preflight·좌표 변환 ③ 구조 kernel ④ 텍스트·값 kernel ⑤ 필터·중복 kernel ⑥ 미리보기/집계 ⑦ 출력·보고서·파일명·ZIP ⑧ 워커/UI ⑨ i18n·SEO·AdSense ⑩ 검증.
8. **메모리 계약**: 단계별 전체 snapshot 보관 금지 — 파일당 현재 데이터 + 단계별 N행 샘플 + counter만 유지. 빈 열=profile pass·중복/최신=key map·연속 빈 행=제한 buffer. 입력 buffer·중간 모델·출력 buffer 해제 시점 명시. **예상 셀 수 기반 경고/거부**: 소프트 경고 2,000,000셀·하드 거부 10,000,000셀(초기값 — 브라우저 실측으로 확정 명시). 오류·제외 행 시트 각 상한 100,000행(초과 시 truncation 안내 행). **(3차 정정) heap 게이트 합격 기준**: 헤드리스 Chrome(`--enable-precise-memory-info`)에서 100k×10 전체 파이프라인 실행 시 peak `usedJSHeapSize` **≤ 1,200MB**(초기 합격값 — **초과 시 실패 처리**, 조정은 왕복 기록으로만). worst case fixture 포함: **오류·제외 행이 상한 100,000행까지 찬 케이스**. **(3차 정정) 보고서 버퍼도 메모리 계약에 포함**: 오류·제외 행은 capped buffer(상한 도달 시 truncation 카운터만 증가), C4 보고서 workbook은 파일 단위로 생성·flush 후 해제. **(4차 정정) 해제 시점 확정**: 입력 buffer=파싱 완료 직후 / 투영 모델·capped buffer=출력 workbook 전사 완료 직후 / 보고서 workbook=직렬화 완료 직후 / 출력 buffer=ZIP 추가 또는 다운로드 인계 직후.
9. **규칙 JSON·정규식 안전**: versioned discriminated-union 스키마 + runtime validator — JSON ≤256KB·규칙 ≤100개·문자열 길이/숫자 범위 제한·unknown key 거부(조용한 무시 금지). 정규식: source ≤500자·flags allowlist(`gimsu` — **`y` 금지 확정**)·컴파일 검사·`g` lastIndex 초기화·replacement `$1`/`$&` 의미 고정. **(3차 정정) 28종 각 variant의 필수·선택 키·기본값·수치 한계를 규칙 스키마 절에 고정**(아래) — validator는 unknown key 거부. **ReDoS 방어 = 워커 격리 + 부모 watchdog timeout**(규칙 적용 job 단위 — 초과 시 terminate·해당 규칙 지목 오류, 실측: `(a+)+$` 백트래킹 지수 증가 확인). 선형 엔진 신규 의존 도입은 제외.
10. **검증 확장**: **(3차 정정) 지원 연산 집합 한정** — 행 삭제·열 삭제/삽입/재정렬 × 상대·절대·범위·`#REF!` 기대식 골든 + 열 재정렬 비연속화 셀 강등 케이스 / 교차시트·shared·array·named·table 강등 / 캐시 누락 차단 / **저장→재개봉 수식 검증** / 병합 해제·채움·잘못된 순서 오류 / 28종 rule ID JSON 왕복 + 악성 스키마 거부 + **(4차 정정) variant별 필수·기본값·경계값 케이스·출력 열 ID 영속화/중복 금지·생성 후 참조 성공·삭제된 ID 참조 차단** / regex watchdog·취소·재실행 + **`y` flag 거부·다중 행 적용 시 `g.lastIndex` 초기화 골든** / CSV 정책(원문 경고·안전 모드) / 시트·파일명 충돌 suffix / 100k×10 Chrome peak heap / 다중 파일 실패 격리.

## 규칙 28종 (확정 7항 — type ID 고정)

**구조(13)**: `trim-edge-empty`(1) · `remove-empty-rows`(2) · `remove-empty-columns`(3) · `collapse-consecutive-empty`(4, axis+N) · `unmerge-cells`(5) · `unmerge-fill-down`(6, 원자) · `rename-column`(7) · `reorder-columns`(8) · `delete-columns`(9) · `combine-columns`(10, 구분자) · `split-column`(11, 구분자·정규식) · `add-constant-column`(12) · `add-row-number-column`(13).
**텍스트(7)**: `trim-whitespace`(14) · `collapse-spaces`(15) · `normalize-newlines`(16) · `remove-invisible-chars`(17, NBSP·zero-width) · `normalize-unicode`(18, NFC) · `find-replace`(19) · `regex-replace`(20).
**행 필터(3)**: `dedupe-rows`(21) · `dedupe-by-columns`(22, keep first/last/latest) · `filter-rows`(23, 삭제·유지 모드 — 연산자: 같음·포함·정규식·빈 값·숫자 비교).
**값 변환(5)**: `fill-empty-cells`(24, 위 값/지정값) · `convert-numeric-strings`(25) · `unify-date-format`(26) · `format-phone-number`(27, 한국) · `format-business-number`(28, 한국).
각 규칙: 설정 스키마·통계 필드(변경 셀·삭제 행/열·중복·변환 실패). 변환 실패는 원값 유지+오류 행 시트 기록(조용한 손상 금지). **(4차 정정) 시트 대상은 규칙 JSON 외부**: 파이프라인 실행 단위는 파일×선택 시트이며 규칙에 시트 필드 없음(전 선택 시트 동일 적용). **stable column ID는 첫 선택 시트 헤더 구조에서 부여**, 다른 시트는 헤더명 일치로 바인딩 — 불일치 시 해당 시트 실행 전 검증 오류.

### 규칙별 설정 키 (3차 정정 — validator 기준·unknown key 거부. 공통: `type`(고정 ID)·`id`(인스턴스 UUID). 문자열 값 ≤1,000자·정규식 source ≤500자)

1 `trim-edge-empty`: `axis: rows|columns|both`(기본 both). 2 `remove-empty-rows`: 없음. 3 `remove-empty-columns`: 없음. 4 `collapse-consecutive-empty`: `axis`(필수)·`minRun: 1~1000`(필수). 5 `unmerge-cells`: 없음(시트 전체). 6 `unmerge-fill-down`: 없음. 7 `rename-column`: `columnId`(필수)·`newName`(필수). 8 `reorder-columns`: `order: columnId[]`(필수 — 전 열 포함). 9 `delete-columns`: `columnIds[]`(필수·≥1). 10 `combine-columns`: `columnIds[]`(필수·≥2)·`separator`(선택·기본 "")·`outputColumnId`(**필수**)·`outputName`(필수)·`removeSources: bool`(선택·기본 true). 11 `split-column`: `columnId`(필수)·`mode: delimiter|regex`(필수)·`pattern`(필수)·`maxParts: 1~50`(필수)·`outputColumnIds[]`(**필수·개수=maxParts·전 파이프라인 내 중복 금지**)·`outputNames[]`(**필수·개수=maxParts**)·`removeSource: bool`(선택·기본 true) — 초과 조각은 마지막 조각 잔류. 12 `add-constant-column`: `value`(필수)·`outputColumnId`(**필수**)·`outputName`(필수)·`position: start|end`(선택·기본 end). 13 `add-row-number-column`: `startAt: ≥0`(선택·기본 1)·`outputColumnId`(**필수**)·`outputName`(필수)·`position: start|end`(선택·기본 start). 14 `trim-whitespace`: `columnIds[]`(선택·기본 전 열). 15 `collapse-spaces`: `columnIds[]`(선택·기본 전 열). 16 `normalize-newlines`: `columnIds[]`(선택·기본 전 열)·`replaceWith: space|lf|remove`(선택·기본 space). 17 `remove-invisible-chars`: `columnIds[]`(선택·기본 전 열). 18 `normalize-unicode`: `columnIds[]`(선택·기본 전 열 — 형식 NFC 고정). 19 `find-replace`: `columnIds[]`(선택·기본 전 열)·`find`(필수·≥1자)·`replace`(선택·기본 "")·`caseSensitive: bool`(선택·기본 true). 20 `regex-replace`: `columnIds[]`(선택·기본 전 열)·`pattern`(필수)·`flags`(선택·기본 `"g"`·`gimsu` 부분집합)·`replace`(선택·기본 ""). 21 `dedupe-rows`: 없음(전 열 기준). 22 `dedupe-by-columns`: `columnIds[]`(필수·≥1)·`keep: first|last|latest`(필수)·`dateColumnId`(latest 시 필수). 23 `filter-rows`: `mode: keep|delete`(필수)·`columnId`(필수)·`operator: equals|contains|regex|empty|number-gt|number-gte|number-lt|number-lte|number-eq`(필수)·`value`(empty 외 필수)·`caseSensitive`(선택·기본 true). 24 `fill-empty-cells`: `columnIds[]`(선택·기본 전 열)·`source: above|constant`(필수)·`value`(constant 시 필수). 25 `convert-numeric-strings`: `columnIds[]`(선택·기본 전 열). 26 `unify-date-format`: `columnIds[]`(필수)·`outputFormat`(**필수 — 프리셋 8종 고정: `yyyy-mm-dd`·`yyyy.mm.dd`·`yyyy/mm/dd`·`yyyymmdd`·`mm/dd/yyyy`·`dd/mm/yyyy`·`yyyy-mm-dd hh:mm`·`yyyy-mm-dd hh:mm:ss`**)·`inputHint: auto|serial|text`(선택·기본 auto). 27 `format-phone-number`: `columnIds[]`(필수)·`style: dash|none`(기본 dash). 28 `format-business-number`: `columnIds[]`(필수)·`style: dash|none`(기본 dash).

## 명시 제외

피벗/차트/조건부 서식 보존 · VBA 보존(XLSM 입력 시 매크로 제거 안내) · 수식 재계산 · 교차 파일 참조 갱신 · 병합 유지 구조 변경(확정 3항) · 미선택 시트 출력 보존(확정 4항) · 선형시간 정규식 엔진 도입(확정 9항).

## 검증

확정 10항 목록 전부 + 합성 fixture 생성 스크립트(수식·공유 수식·병합·1900/1904 — dummyfortest 참조 금지) + U2 브라우저 스모크(`test:excel-cleaner`) 신설 + `npm run build`·`test:unit`·`test:static`·**`npm run test:excel-compare`(U1 회귀 — runModuleWorker 확장 영향)** + 로드맵 「단위 공통 완료 기준」 전부(드래그 순서 변경의 버튼 대안 포함).

## 반박 기록

### Codex 1차 (2026-09-03, 완료 — 10건 전원 수용 → v2 확정 사항. 실측 기여: ExcelJS splice 무갱신·공유 수식 저장 실패·`#REF!` 미생성, 캐시 없는 수식, merge API·splice 예측 불가 문서, C1/C4/C2/C3 실제 export 표면, 100k×10 메모리 실측(rss 631MB), ReDoS 지수 증가, papaparse 위험 문자 통과. 판정 "재왕복 필요")
### Codex 2차 (2026-09-03, 완료 — 10건 반영 확인 + 오케스트레이터 결정 2건 수용((a) CSV 정책 — 단서: 원문 모드 "안전" 표현 금지 / (b) 미선택 시트 미포함 — 조건: C1 preflight 보장). 잔여 5건(연산 집합 정합·C1 cacheState/비OOXML 표·규칙 variant 스키마/파생 열 ID·watchdog 프로토콜·heap 합격 기준/보고서 버퍼) → v3 정정. 실측 기여: 시트 제거 후 참조 문자열 잔존, cachedValue:null 누락 비구분, PapaParse 안전 모드 접두 확인)
### Codex 3차 (2026-09-03, 완료 — 1·2 반영 확인, 3·4·5 부분반영(스키마 필수/기본값 미완결·시트 대상 envelope·U1 회귀 명령·lastIndex 골든·heap 문구 모순·해제 시점 미확정) → v4 정정)
### Codex 4차 (2026-09-03, 완료 — 3건 전건 반영 확인·신규 모순 없음, **"이견 0" 명시 선언·정본화 가능**. 정본 확정은 기준 해시 실기입과 동시).

## 실행 기록

### 실행 게이트 (Codx, 2026-09-03)

- 기준 해시: `HEAD=origin/main=9c28c8c714ccabf7fed675e67f35c81e1d33fa4a`로 본 지시서 기준과 정확히 일치.
- 열린 계획서: `shadcn-migration-20260903.md`는 정본이 아닌 초안이며 Excel Cleaner 배포 완료 뒤 착수하도록 명시되어 있다. U2에 UI 프레임워크 변경을 선반영하지 않는다. 나머지 정본·완료 계획서는 U2 공용 모듈·경로·검증 계약과 상반되지 않는다.
- 기존 워킹트리: MP4 3개·DOCX 2개 미추적 파일은 사용자/선행 작업 소유로 보존하고 모든 스테이징에서 제외한다. 추적 파일 변경은 없다.
- 판정: 기준 해시 게이트와 열린 계획서 충돌 검사 통과. U0.1 → U2 순차 착수 가능.

### U0.1·U2 구현 완료 (Codx, 2026-09-03)

- 커밋: U0.1 `5619869` → 엔진·규칙 `000db09` → UI·출력 `dac13bb`로 분리했다.
- 구현: C1 편집 메타데이터·C4 append 경계, 28종 규칙과 version 1 validator·column lineage, token-aware 수식 변환과 값 강등/병합 preflight, 전용 worker·30초 watchdog·명시 미리보기, 다중 파일/시트 UI, XLSX·CSV·ZIP 출력, ko/en·SEO·FAQ·정적 페이지·소셜 이미지까지 완료했다.
- 검증: `npm run build`(2,429 modules·정적 59페이지), `npm run test:unit` 158/158, `npm run test:excel-cleaner`, `npm run test:excel-compare`, `npm run test:utilities`, `npm run test:static`, `npm run bench:excel-cleaner`, `git diff --check` 모두 통과했다. Chrome 100k×10 peak heap은 916,061,264B로 1,200MiB 한도 이하였다.
- 배포: `git push origin main` 뒤 local `HEAD`·`origin/main`·원격 `refs/heads/main`이 `dac13bb55e4d727c02b604d7a326d35d3edd838d`로 일치했다. GitHub Pages run `33738388547`의 build·deploy가 모두 성공했고 실서비스 한국어 경로의 title·소셜 이미지 메타를 확인했다.
