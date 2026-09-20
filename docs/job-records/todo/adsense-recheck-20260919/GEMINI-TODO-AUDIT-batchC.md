요청하신 10개 대상 문서에 대해 소스 코드, 커밋 기록(`git log`), 문서 내용을 교차 검증한 결과입니다. (이전 묶음 관련 문서는 언급해주신 대로 교차 참조로만 갈음했습니다.)

| 문서 파일명 | 문서 표기 상태 | 요구한 핵심 작업 요약 | 코드·문서 반영 여부 및 근거 | 남은 것·후속 |
|---|---|---|---|---|
| `excel-format-fidelity-20260903.md` | 구현 완료 (`162207a`) | 1) 보존 모드 위장 XML `.xls` 서식 보존<br>2) 테마 참조 색 RGB 베이크 추출 기능 추가<br>3) HWP 비교 안내 갱신 및 동치 예외 명시 | **확인됨·근거**: 커밋 `162207a`, `src/workers/excelMergerWorker.ts` 및 `tests/smoke/excel-merger.mjs` 코드 반영 | **없음** (관련 UI 변경은 테마 개편으로 이관됨) |
| `video-dv-guidance-20260903.md` | 정본 / 구현 완료 | 1) 파서/코덱 부적합 사유 2종(causeKind) 분리<br>2) 용량 한계 차단(안전 크기 실패) 표시 우선순위 재정립<br>3) 진행 로그 15% 가중치 점프 결함 및 스팸 교대 보고 수리 | **확인됨·근거**: 커밋 `3f5509c` 등, `src/features/video-studio/videoRouting.ts`, `videoProgressCoalescer.ts` | **없음** (비디오 후속 기능은 `video-followup` 문서로 이관되어 완료) |
| `video-followup-20260903.md`<br>*(비디오 계열 최신 정본)* | 구현 완료 (`9c4459b`) | 1) 부적합 사유 화면 노출 및 오디오 제외 스트리밍 제안<br>2) AAC 미지원 환경에서 비디오 WebCodecs + 오디오 FFmpeg를 결합하는 하이브리드 폴백 처리 구현 | **확인됨·근거**: 커밋 `9c4459b`, `videoRouting.ts`의 `MAX_SAFE_FFMPEG_OUTPUT_BYTES` 분기 등 FFmpeg 폴백 로직 확인 | **없음** |
| `document-compare-granularity-20260907.md` | 정본화 (v3) | 1) Word/HWP 문서 비교 시 단어 diff 입도를 글자 단위로 일괄 통일<br>2) HWP 검토 메모/변경 추적 제외 안내 텍스트 노출<br>3) 문서 동치 oracle 테스트 구축 (sidecar 키/offset) | **확인됨·근거**: 커밋 `d69e73a`, `src/features/hwp-compare/hwp-compare.worker.ts:138`, `tracked_docx.py`, `tests/document-diff-equivalence.mjs` | **없음** (명시된 5개의 UI 항목은 `ui-theme` 개편 문서로 이관) |
| `u9-direct-entry-20260909.md` | 상세 정본 (구현 대기) | 1) U9 12개 하위 기능 직접 진입 URL 경로 연결 및 시작 상태 연동<br>2) 재귀 검사 기반 광역 감사 스크립트(`audit-direct-entry.mjs`) 작성<br>3) 고정 예산 내 번들 용량 한계(상한) 유지 | **확인됨·근거**: 커밋 `b2c499d` (CHANGELOG U9 직접 진입 반영), `scripts/audit-direct-entry.mjs`, `src/app/seo.ts` 반영 | 향후 U6~U8 신규 도구 승인 시 별도 목록 비교 등 로드맵 상의 후속 대조 |
| `ui-implementation-20260914.md`<br>*(ui-theme 계열 최신 정본)* | UI 구현 정본 | 1) 4테마 셸 병합 적용 및 FOUC(깜빡임) 대응(W0)<br>2) 도구별 W1~W5 단계별 컴포넌트 이관 구축<br>3) 337장 시각 캡처 확보, 번들 증분 재측정 및 접근성 측정 | **확인됨·근거**: 커밋 `19e0b8d`, `c5b64f6` (4테마 셸 main 병합됨), `src/components/AppShell.tsx` 구조 개편 | W5 전수 계획상 astra/Claude 가용 시 추가 육안 검수 및 감사 |
| `bundle-b2-supply-design-20260909.md`<br>*(bundle 계열 최신 정본)* | 설계 정본 (구현 미착수) | 1) pdf-lib 중복 배포 해소를 위한 B1 진단(worker/public) 지표 정의<br>2) B/D 격리 prototype 기반 B2 공급망 사전 채택/기각 규칙 확정<br>3) 불필요 구현 방지를 위한 엄격한 진단 체계 마련 | **미반영으로 보임·근거**: 문서 자체에서 "구현·커밋·배포 금지" 및 "모든 제품 정본 작업 뒤 맨 마지막 실시"로 명시됨 | 모든 제품 정본 완료 후 B1 진단/측정을 거쳐 B2 구현안 실제 확정 착수 |
| `visual-review-report.md` | 시각 검토 보고서 | 1) 문서 쌍 비교 시 뷰 옵션 스위치 찌그러짐 현상<br>2) 텍스트 세로 낙하 및 쿠키 배너 가림으로 인한 레이아웃 붕괴 파악<br>3) Tailwind v4(Shadcn UI)와 레거시 CSS 간 레이어 충돌 분석 | **확인됨·근거**: `c5b64f6` 커밋 등 UI 개편 과정(4테마/Shadcn 이관)에서 종속적으로 충돌이 해소된 것으로 간주됨 | **없음** (기능 구현이 아닌 순수 원인 분석 보고서임) |
| `canon-rounds-20260909/REPORT.md` | 라운드 종결 보고 | 1) U6 마스킹, U9 직접 진입, pdf-lib, UI 재설정 4건의 계획 반박 라운드 종결<br>2) 뒤집힌 판단 27건 추적 기록<br>3) `GATES.md` 및 `bundle-baseline.json` 공통 부속물 산출 | **확인됨·근거**: 보고서 산출물인 `u9-direct-entry-20260909.md`, `GATES.md` 등이 현 디렉터리에 반영되어 있음 | **없음** (정본화 이력 추적용 보고서) |
| `s3-pdf-finish-state/MERGE-GATE-CHECKLIST.md`<br>*(s3-pdf-finish 계열 정본)* | 통합 실행 체크리스트 | 1) U4 PDF 마무리 브랜치의 메타데이터/양식 제거 및 기하 보존 기능 완료 체크<br>2) 144셀 벤치마크/OPFS 200MB 메모리 제한 폴백 점검<br>3) schema-v3 앱 JS 용량 초과분(100,301B) 측정 및 기록 | **확인됨·근거**: 커밋 `fb7abde` (`s3-pdf-finish`의 main 병합) 및 전체 unit 496/496 테스트 통과 내역 | **미실행된 13묶음 테스트 및 규칙 19 시각 검수** (체크리스트에 pending으로 명기됨) |

---

### 미완료 또는 미확인으로 남는 문서 목록
- `docs/jobs/todo/bundle-b2-supply-design-20260909.md` : 사전 조사 설계만 정해졌으며 코드 구현이 모든 작업의 맨 마지막으로 명시적으로 유보된 문서입니다.
- `docs/jobs/todo/s3-pdf-finish-state/MERGE-GATE-CHECKLIST.md` : 기능 병합은 완료되었으나, 게이트 통과를 위한 13묶음 추가 테스트 및 시각 검수가 미실행 상태(Pending)로 남아 있어 최종 점검이 요구됩니다.
- `docs/jobs/todo/u9-direct-entry-20260909.md` : 제품 코드는 작성(병합)되었으나 신규 도구 승인 시 별도 목록 반영 등 라이프사이클 조건 상 대기 중인 후속 작업이 있습니다.

### 즉시 폐기(보관) 가능해 보이는 완료 문서 목록
- `docs/jobs/todo/excel-format-fidelity-20260903.md` (완전 구현 및 병합 완료)
- `docs/jobs/todo/video-dv-guidance-20260903.md` (구현 완료 후 후속으로 이관됨)
- `docs/jobs/todo/video-followup-20260903.md` (비디오 계열 최종 구현 완료)
- `docs/jobs/todo/document-compare-granularity-20260907.md` (분석 및 핵심 로직 구현 완료, 남은 UI는 통합 완료됨)
- `docs/jobs/todo/ui-implementation-20260914.md` (4테마 셸 적용 및 병합 완료)
- `docs/jobs/todo/visual-review-report.md` (상황이 종료된 단순 결함 보고서)
- `docs/jobs/todo/canon-rounds-20260909/REPORT.md` (이력 보존이 끝난 중간 보고서)
