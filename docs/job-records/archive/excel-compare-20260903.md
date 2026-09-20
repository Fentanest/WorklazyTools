# 작업지시서 — U1 Excel 비교·대사 (2026-09-03)

**상태: 정본 (2026-09-03 정본화 — 2차 왕복 이견 0 + 기준 해시 실기입. "v2 확정 사항"이 우선 계약.)** 상위: `new-tools-roadmap-20260903.md`(동시 정본).
기준 해시: **`9c4459b9e563e8bffdbe3fbb18cc5a1830367a5b`**(Claude 실측, `git rev-parse HEAD`=`origin/main`). 경로 `/tools/excel-compare` · 이름 "Excel 비교·대사 / Excel Compare & Reconcile".

## 범위

XLSX·XLSM·XLS·XLSB·CSV(+위장 SpreadsheetML .xls) 비교 도구. **여러 파일 쌍** 등록·쌍마다 좌우 파일·시트 수동 연결. 새 feature `src/features/excel-compare/` + 전용 워커. U0 공통 기반(C1~C4 — 로드맵 확정 계약) 위에 구축.

## 형식별 지원표 (확정 1항 — 화면·문서에 이 표 기준으로만 지원 표시)

| 형식 | 값 | 표시값(SSF) | 수식 | 캐시 계산값 | 셀 서식 diff | 병합 셀 |
|---|---|---|---|---|---|---|
| XLSX | ○ | ○ | ○ | ○ | ○ | ○ |
| XLSM | ○ | ○ | ○ | ○ | ○(VBA fixture 통과 조건) | ○ |
| XLS(BIFF8) | ○ | ○ | ○ | ○ | × (명시 제외) | ○ |
| XLSB | ○ | ○ | ○ | ○ | × (명시 제외) | ○ |
| SpreadsheetML .xls | ○ | ○ | ○ | ○ | × | ○ |
| CSV | ○ | — | — | — | — | — |

## v2 확정 사항 (1차 왕복 9건 — 우선 계약)

1. **지원표·파서 표면 확정**: 위 표. OOXML→ExcelJS 단일 파싱 / BIFF8·XLSB·SpreadsheetML→SheetJS / CSV→PapaParse. 표시값 제품 문구는 "표시 형식 기준 정규화 문자열(SheetJS SSF)" — "Excel 화면과 완전 동일" 표현 금지. **캐시값 없는 수식은 `표시값 없음`/`계산값 없음` 상태로 구분**(오류 아님). XLSM은 실제 VBA 포함 fixture 검증 통과 시 서식 비교 포함.
2. **워커 메모리 계약**: 메인 스레드에서 전체 쌍 ArrayBuffer 선생성 금지 — **현재 쌍만** 워커가 읽고 종료 시 참조 해제. "시트 단위 스트리밍" 문구 폐기 → "현재 쌍 workbook 전체 파싱 → 시트별 순차 diff → 쌍 종료 시 해제". transfer된 ArrayBuffer는 재사용 불가(실측) — 동일 파일의 다중 쌍 참여는 File 재판독(1차 기본, bounded cache는 후속). excel-merger `runWorker`의 request/progress/result/error/abort **형태만** 공용 lifecycle로 추출, merge 전용 payload 비공유.
3. **셀 서식 동등성 계약**: 비교 필드 명시 — numFmt·font·solid/pattern fill·border·alignment·protection. **theme+tint 정규화**: 파일별 theme palette를 읽어 theme 참조와 동일 표시색 ARGB를 같다고 판정 — 기존 `excelThemeColors.ts`(`parseThemePalette`·`applyExcelTint`·`bakeThemeColorsInStyle`)를 공용화 재사용(기대값 실측 존재: accent4 FFC000+tint0.79998→FFF2CC). gradient fill·DXF/조건부 서식은 1차 명시 제외.
4. **행·열 정렬 계약(위치 기준)**: 기존 `documentAlignment.ts`의 patience anchor + bounded DP 구조를 **scorer/동등성 주입형 공용 skeleton으로 추출**(문서용 fuzzy scorer 그대로 사용 금지 — U1은 exact 행 해시 scorer). 폴백 기준은 raw 행 수가 아니라 **DP cell budget**(시작값: 검증된 `12,000,000` — unanchored 구간 product 기준, 모바일 골든 벤치로 확정). budget 초과 시 순수 위치 대조 폴백 + reason code(`ALIGN_LIMIT_FALLBACK`)를 Parameters/Errors에 기록·화면 명시. 중복 행 tie-break·해시 충돌 시 원문 재확인·수정 행 gap의 위치 pairing 명시. **2축 순서: 열 정렬(헤더/열 signature) 선행 → 정렬된 열 기준 행 signature**. 취소 체크 간격 명시.
5. **거래 대사 예산**: 기본 후보 ≤ **10**/대상, component당 조합 ≤ **1,023**(비어 있지 않은 부분집합), **파일 쌍당 전역 1,000,000 combination evaluations 예산**, ≤4,096회 간격 abort check(수치는 브라우저·모바일 벤치 후 재조정 가능 명시). 날짜·거래처 조건으로 candidate component 선구성 후 조합 탐색. **한도 초과는 Ambiguous가 아니라 `RECON_SEARCH_LIMIT` 별도 reason으로 Errors 기록**. 복수 조합 만족 시 자동 확정 금지(Ambiguous). 금액 합산 반올림 단위·비율 오차 분모 0 처리를 Parameters에 명시.
6. **주입 방어 경계**: C4 `writeUntrustedText` — 사용자 유래 값은 `String(value)` primitive 강제(CellValue 객체 수용 금지), 문자열 타입 기록(ExcelJS 실측: `=`·`+`·`-`·`@`·탭·공백 선행 모두 `t="s"` 기록 확인). **적용 범위: 파일명·시트명·키·좌우 값·표시값·대사 근거·오류 등 외부 유래 전 필드**. 테스트에 탭·CR/LF·공백 선행 + formula-object negative control 포함. apostrophe 접두 불사용(값 변형 금지). 본 도구의 XLSX 보고서에 한한 계약 — CSV 출력 추가 시 별도 방어.
7. **정규화 우선순위(고정)**: ① 원시 타입 보존 → ② Unicode(NFC)·공백·줄바꿈·대소문자 옵션 → ③ 날짜 정규화(시리얼 기준·1900/1904 date system 처리) → ④ 숫자형 문자열=숫자 opt-in → ⑤ 허용 오차. **텍스트 타입 셀·`@` numFmt·유의미한 선행 0 문자열은 ④가 켜져도 문자열 유지**(무시하려면 별도 명시 옵션). **빈 셀=0 옵션은 행·열 구조 판정 이후 셀 값 비교에만 적용**(구조적 gap을 0과 동일시 금지). 골든 케이스: 1900/1904·날짜만/시간 포함·캐시값 없음.
8. **결과 topology**: **쌍마다 9시트 XLSX 1개** 생성·완료 즉시 개별 다운로드 제공. **결과 2개 이상일 때만 ZIP** 추가(1쌍이면 ZIP 미생성). 보고서 파일명은 C2 검증·충돌 처리. **쌍 실패는 해당 쌍 격리 — 다른 쌍 계속 진행**. 화면 전체 집계와 쌍별 보고서 구분. 쌍 보고서 완료 후 workbook 해제(확정 2항).
9. **기준 해시·검증 추가**: 정본화 시점 실기입. 검증에 U1 전용 브라우저 스모크·BIFF8/XLSB 수식 fixture·실제 VBA 포함 XLSM fixture·정렬 budget 모바일 골든 벤치 추가.

## 비교 방식 3종

### 1. 위치 기준
셀 값 · 표시값 · 수식 · 캐시 계산값 · 셀 서식(지원표 한정) · 병합 셀 · 행·열 추가/삭제(확정 4항 정렬 계약).

### 2. 키 기준
키 열 지정(좌우 열 이름 상이 시 수동 매핑) · 복합키 · 행 순서 무시. 상태: 추가/삭제/변경/완전 일치/중복키/다중 후보(자동 확정 금지). 동일 키 다수 시 첫 행 임의 연결 금지 — 3정책: ① 보조키 추가 지정 ② 발생 순번 연결 ③ 중복 오류 처리(Duplicates 격리).

### 3. 거래 대사
열 매핑(금액·날짜·거래처/설명) · 허용 오차(금액 절대/비율·날짜 ±N일). 상태: 한쪽만 존재/금액 상이/날짜 상이/중복 거래/다중 후보/미대사. **1:N·N:1 합계 대사 opt-in** — 확정 5항 예산 내 결정적(고정 정렬) 탐색.

## 비교 옵션

앞뒤 공백 / 연속 공백 / 줄바꿈 / 대소문자 / Unicode 정규화(NFC) / 쉼표·통화기호 / 숫자형 문자열=숫자(opt-in) / 날짜 표시 형식 무시 / 절대·비율 허용 오차 / 빈 셀=빈 문자열 / 빈 셀=0(선택) / 수식·계산값·둘 다 / 서식 포함 여부 — 적용 순서는 확정 7항.

## 결과

- 화면: 상태 필터(일치/변경/추가/삭제/중복키/미대사/다중 후보/오류) + 텍스트 검색, 셀 단위 좌우 값, 색+텍스트 병기.
- XLSX 보고서(C4): **Summary · Parameters · Matched · Changed · Added · Removed · Duplicates · Ambiguous · Errors** 9시트. 각 행에 파일명·시트명·원본 행 번호·키·좌우 값·변경 종류·대사 근거(매칭 규칙·적용 오차). topology는 확정 8항, 주입 방어는 확정 6항.

## 명시 제외

ODS · 암호화 파일 · 조건부 서식/DXF/gradient/차트/도형/개체/VBA 내용 diff · 수식 재계산 엔진(캐시값만) · XLS·XLSB 셀 서식 diff(지원표) · 3-way 비교 · 동일 파일 다중 쌍의 ArrayBuffer 캐시(후속).

## 검증

- 비교 엔진 골든 케이스(방식 3종×옵션 대표, 중복키 3정책, 대사 예산·RECON_SEARCH_LIMIT, 주입 방어 확장 케이스, 선행 0, 1900/1904, 캐시값 없음).
- 합성 fixture 생성 스크립트 커밋(dummyfortest 참조 금지) — BIFF8/XLSB 수식·VBA XLSM 포함.
- U1 브라우저 스모크 신설 · `npm run build`·`test:unit`·`test:static` · 정렬 budget 모바일 골든 벤치.
- 로드맵 「단위 공통 완료 기준」 전부.

## 반박 기록

### Codex 1차 (2026-09-03, 완료 — U1 9건 전원 수용 → v2 확정 사항. 실측 기여: BIFF8/XLSB probe, ExcelJS 주입 probe, LCS 비용 실측(100k²=40GB DP 불가)·documentAlignment 구조 분석, 부분집합 열거 비용 실측, ArrayBuffer transfer 실측. 판정 "재왕복 필요")
### Codex 2차 (2026-09-03, 완료 — 9건 전건 [반영됨] 대조·신규 모순 없음, **"[정본화 가능] 이견 0" 선언**. 정본 확정은 기준 해시 실기입과 동시).

## 실행 기록

### 실행 게이트 (Codx, 2026-09-03)

- 기준 해시: `HEAD=origin/main=9c4459b9e563e8bffdbe3fbb18cc5a1830367a5b`로 정본 기준과 정확히 일치.
- 열린 계획서: 상위 로드맵 외 `excel-format-fidelity-20260903.md`(`162207a`)·`video-followup-20260903.md`(`9c4459b`)는 구현 완료 상태. 기존 Excel 병합·비디오 표면에 한정되어 U1 신규 경로·비교 엔진과 상반 지시 없음.
- 기존 워킹트리: MP4 3개·DOCX 2개 미추적 파일은 사용자/선행 작업 소유로 보존하고 모든 스테이징에서 제외.
- 판정: 기준 해시 게이트와 열린 계획서 충돌 검사 통과. U0 완료 후 U1 착수 가능.

### 구현 완료 (Codx, 2026-09-03)

- 커밋: 선행 U0 `6b49dc9`, U1 `da8aa188ccf62e436b7b6a6a02e42f9b8312f926`. 정본 기준 `9c4459b9e563e8bffdbe3fbb18cc5a1830367a5b`에서 U0 → U1 순서를 지켰다.
- 지원표: XLSX/XLSM은 값·SSF 표시값·수식·캐시값·정본 필드의 셀 서식·병합을 지원하고, BIFF8 XLS·XLSB·SpreadsheetML은 값·SSF 표시값·수식·캐시값·병합만 지원해 셀 서식 비교를 제외했다. CSV는 값만 지원한다. 실제 BIFF8 Formula, XLSB `BrtFmlaNum`, 15,872B VBA project를 포함한 XLSM fixture로 검증했다.
- 계약: 열 선행+행 patience/DP 위치 비교, 복합 키·중복 3정책, 후보 10·부분집합 1,023·쌍 전역 1,000,000회 한도의 1:N/N:1 대사, 4,096회 이내 취소, 12,000,000 DP cell budget, 현재 쌍만 읽는 worker와 File 재판독, 쌍별 실패 격리, 외부 값을 문자열로 고정한 정확히 9시트 보고서, 성공 결과가 2개 이상일 때만 ZIP을 구현했다.
- 제품 검증: Chrome 제품 스모크에서 단일 쌍은 개별 XLSX만, 2성공+1손상 배치는 개별 2개+ZIP을 생성했다. 9시트·수식 셀 0·상태 색상+텍스트·검색·취소·손상 격리·XLSB/XLSM 지원 문구를 확인했고 390×844에서 overflow 0px·파일 선택 높이 44px였다.
- 완료 기준: `npm run build` exit 0(2,416 modules, Excel Compare page 164.18kB/68.86kB gzip, worker 1,486.75kB, 정적 57페이지), `npm run test:unit` 119/119, `npm run test:excel-compare` exit 0, `npm run test:static` exit 0, 비디오 ZIP 회귀 1/1, `git diff --check` exit 0. 정렬 벤치 9,000,000 product 중앙값 683.4ms·peak heap 20,603,501B, 12,006,225 product는 2.9ms 결정적 폴백이었다.
- 현지화·SEO·AdSense: ko/en key·사용자 문구, route/tool registry, canonical/hreflang·사이트맵·FAQ 각 3개·소셜 이미지 2개를 추가했다. 일반 AppShell의 광고 loader는 활성 상태이고 기존 광고 제외·격리 목록은 변경하지 않았다. 내부 명칭·원시 예외는 사용자 화면에 노출하지 않는다.
- push·동기화: `git push origin main` 성공. `HEAD`·`origin/main`·원격 `refs/heads/main`은 모두 `da8aa188ccf62e436b7b6a6a02e42f9b8312f926`이다. 기존 MP4 3개·DOCX 2개는 보존·미스테이징 상태다.
