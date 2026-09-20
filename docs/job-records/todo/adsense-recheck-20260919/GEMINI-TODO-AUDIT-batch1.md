I am currently reviewing the requested markdown documents through my codebase researcher subagent. Since the task requires comprehensively analyzing 12 large specification files and cross-referencing their states with the codebase (including `CHANGELOG.md`, `review-notes.md`, `backlog.md`, and source files) using built-in read-only tools, it will take a brief moment. I will present the final Korean table summarizing the document states, implementation evidence, and remaining items shortly.
I will just stop execution to wait for the system to notify me when the subagent finishes.
지정해주신 조건과 제약(셸 명령 미사용, 내장 도구 기반 읽기 전용)에 따라 `research` 서브에이전트의 코드베이스 읽기 능력을 활용하여 문서를 분석하고 코드 구현 여부를 교차 검증했습니다. 

다음은 요청하신 각 문서의 상태, 요구 작업, 소스 반영 여부 및 남은 작업에 대한 1차 검수 요약 표입니다.

| 문서 파일명 | 문서 기재 상태 | 핵심 작업 요약 | 코드·문서 반영 여부 | 남은 것·후속 |
|---|---|---|---|---|
| **PLAN-INDEX-20260909.md**<br>*(최상위 요약 정본)* | 정본화 / 진행 중 | 1) U9 직접 진입 구현<br>2) U4/BL04/U6/U7/U8 종결 명시<br>3) PDF 파일명 숫자 제한 옵션<br>4) UI 재기준화 및 용량 정리 | **확인됨**<br>근거: `CHANGELOG.md`(2026-09-14 U9 연계 및 PDF 파일명 제한 기록), `review-notes.md` | U9 상세 구현 마무리, UI 재설계(v3) 진행, 전체 완료 후 마지막 번들 용량 정리 |
| **roadmap-completion-20260906.md**<br>*(하위 요약 정본)* | 부분 완료 | 1) S0: 빈 페이지 결함 수정<br>2) S1: 죽은 코드 제거<br>3) S2: 하네스/성능/시각 기준 갱신<br>4) S3: 신규 도구 로드맵 통합 | **확인됨**<br>근거: `CHANGELOG.md`(2026-09-06 S0~S2 반영 확인됨) | S3 이후의 U6~U8 연계 작업 (현 시점에선 `PLAN-INDEX`로 통제권이 이관되어 역할 종결됨) |
| **excel-compare-20260903.md** | 구현 완료 | 1) 위치/키 기반 엑셀 비교<br>2) 1:N / N:1 행 조정<br>3) 서식 및 수식 판정<br>4) 9개 시트 및 다중 ZIP 보고서 생성 | **확인됨**<br>근거: `CHANGELOG.md`(2026-09-03), `src/features/excel-compare/excelCompareClient.ts` | 없음 (완료) |
| **excel-compare-followup-20260903.md** | 구현 완료 | 1) 빈 보고서 무결성 방어<br>2) 파일 좌우 교체 기능<br>3) 특정 쌍별 날짜/거래처 기준 해제 | **확인됨**<br>근거: `CHANGELOG.md`(2026-09-03 좌우 설정 교환 및 기준 해제) | 없음 (완료) |
| **excel-compare-dupkey-header-20260907.md**<br>*(Excel 계열 최신 정본)* | 정본 / 구현 완료 | 1) 중복 키 그룹 단일 행 보고<br>2) 머리글 데이터 행 자동 감지<br>3) 엑셀 중복 요약 파라미터 추출 | **확인됨**<br>근거: `CHANGELOG.md`(2026-09-08 머리글 감지 및 중복 오류 행 변환 기록) | 없음 (완료) |
| **excel-compare-rounds/s3-REPORT.md** | 검증 통과 (보고서) | 1) 머리글 행 감지 성능 검증<br>2) 수동 행 지정 우선순위 확인<br>3) 23패턴 6형식 경계 테스트 | **확인됨**<br>근거: `CHANGELOG.md`(2026-09-08 회귀 테스트 기록). 단, 이 파일은 실행 검수 보고서임 | 없음 (보고서로서 종결) |
| **ui-theme-redesign-20260907.md**<br>*(UI 계열 상위 정본)* | 정본화 / 미착수 | 1) 셸/홈 전체 shadcn 제거<br>2) 반응형 UI/새 테마 적용<br>3) WebP/AVIF 히어로 자산 교체<br>4) 카테고리 사이드바 신설 | **미반영으로 보임**<br>근거: `CHANGELOG.md`에 shadcn 롤백(9/3)만 있고, 새 디자인 코드는 병합되지 않음. `backlog.md`로 대기 상태 기록 | S3 통합 완료 후 전체 재설계 7단계(W0~W6) 착수 필요 |
| **ui-theme-rebaseline-procedure-20260909.md** | 기준 절차 정본 | 1) UI 인벤토리 기준선 수립<br>2) 시각/접근성/번들 회귀 갱신<br>3) 자동화 검수 체계 적용 | **부분 확인됨**<br>근거: `review-notes.md`에 U4 검증 후 시각 기준선 55장 갱신 절차 실행 확인됨 | 새 UI 테마 재설계와 연동하여 지속적인 재기준화 수행 |
| **pdf-finish-20260905.md** | 완료 / 아카이브 | 1) 번호/머리말/바닥글 삽입<br>2) 워터마크/도장 임베드<br>3) 인터랙티브 폼/주석 제거<br>4) 래스터 평탄화 | **확인됨**<br>근거: `CHANGELOG.md`(2026-09-07~08 통합 완료), `PdfFinishPanel.tsx` | 없음 (완료되어 아카이브 보관 중) |
| **bundle-pdflib-dedup-20260909.md** | 부분 완료 / 착수 대기 | 1) B0/B1: pdf-lib 번들 기여도 측정<br>2) B2: pdf-lib 중복 제거 및 공용 ESM 청크 분리 | **미확인**<br>근거: 계측 툴(B1)은 9/9 `CHANGELOG`에 있으나, 중복 분리(B2) 코드 구현 증거 없음 | 사용자 승인 후 B2(중복 제거 및 공유 분리) 착수 |
| **pdf-header-filename-limit-20260913.md**<br>*(PDF 부가 최신 정본)* | 정본 / 착수 대기 (이후 완료) | 1) 머리글/바닥글 파일명 글자 수 제한<br>2) 초과 시 말줄임/폭 맞춤 폴백 적용<br>3) UI 유효성 안내 연결 | **확인됨**<br>근거: `CHANGELOG.md`(2026-09-14 구현 완료 기록), `pdf-editor/finish/engine.ts` | 기능 자체는 구현 완료되었으며, U9와 함께 라이브 배포/검증 대기 |
| **u8-pdf-compare-20260909.md** | 구현·배포 완료 | 1) 전후 PDF 픽셀 및 네이티브 텍스트 추출 비교<br>2) 차이(추가/삭제) 오버레이<br>3) 차이점 XLSX 및 다중 ZIP 생성 | **확인됨**<br>근거: `CHANGELOG.md`(2026-09-13 기능 전체 추가), `PdfComparePage.tsx` | 없음 (완료) |

---

### 미완료 또는 미확인으로 남는 문서 목록 (작업 진행 필요)
*   **`docs/jobs/todo/ui-theme-redesign-20260907.md`**: 전면적인 UI 재설계 계획. 현재 미착수 상태.
*   **`docs/jobs/todo/ui-theme-rebaseline-procedure-20260909.md`**: UI 테마 개편에 따라 시각/번들 기준선을 다시 잡기 위한 절차서.
*   **`docs/jobs/todo/bundle-pdflib-dedup-20260909.md`**: pdf-lib의 공용화 및 번들 축소(B2) 단계가 코드로 실행되지 않음.
*   **`docs/jobs/todo/PLAN-INDEX-20260909.md`**: 마일스톤 관리 인덱스로, U9 배포 및 위 항목들이 해결될 때까지 현행화가 필요함.

### 즉시 폐기(아카이브 보관) 가능해 보이는 완료 문서 목록
*   `docs/jobs/todo/excel-compare-20260903.md`
*   `docs/jobs/todo/excel-compare-followup-20260903.md`
*   `docs/jobs/todo/excel-compare-dupkey-header-20260907.md`
*   `docs/jobs/todo/excel-compare-rounds/s3-REPORT.md`
*   `docs/jobs/archive/u4-and-bl04-20260909/pdf-finish-20260905.md` (이미 아카이브 폴더에 존재)
*   `docs/jobs/todo/pdf-header-filename-limit-20260913.md`
*   `docs/jobs/archive/u8-pdf-compare-20260913/u8-pdf-compare-20260909.md` (이미 아카이브 폴더에 존재)
*   `docs/jobs/todo/roadmap-completion-20260906.md` (하위 계획으로서의 소임을 다하고 9/9 인덱스로 바통을 넘김)
