# 확인 라운드(3차) 지시서 — 문서 비교 정본 v3 (2026-09-07, Claude → Codex **gpt-6-astra**)

## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md` → **정본** `docs/jobs/todo/document-compare-granularity-20260907.md` 의 「정본화 (2026-09-07 11:55, v3)」 절 → 자신의 2차 산출 `docs/jobs/todo/document-compare-rounds/round-2-AMENDMENTS.md`·`round-2-REPORT.md`(원본 `/tmp/worklazy-dc-r2/` 잔존 시 재사용) → `docs/jobs/todo/ui-theme-redesign-20260907.md` §6-B(이관된 UI 항목).

## 1. 성격·기준
- **읽기·경량 검증 라운드(쓰기 모드 — `/tmp` 산출 필요).** 저장소 추적 파일 수정·커밋·push·브랜치 전환 금지. 워킹트리 `s3-pdf-finish` 는 U4-3 구현 병행 중 — 건드리지 말 것. 산출물 `/tmp/worklazy-dc-r3/`. 무거운 빌드·브라우저는 **불필요**(필요하다고 판단되면 사유를 적고 직렬·4096 으로).

## 2. 확인 항목
1. **권고 반영 정확성**: 2차 `CANONICAL-AMENDMENTS.md` A~C·E 의 문안이 정본 v3 「확정 1·1-a·1-b·2·2-a·3·3-a·4」·「완료 기준」·「기준 해시」에 **누락·왜곡 없이** 반영됐는지 문장 단위 대조. D 절(React·ARIA)과 E 절의 하네스 등록이 UI 개편 계획 §6-B 로 **손실 없이** 이관됐는지.
2. **Q1·Q2·Q3 판정 수용 확인**: 각 권고안대로 확정됐는가. 남은 해석 여지 문장이 있으면 지적.
3. **축소된 범위의 부작용**: UI 변경 0 으로 줄였을 때 (a) 시각 회귀·a11y·rendering 등록 변경이 정말 불필요한지(추적 docx 내려받기·오류 문구 변경이 화면에 노출되는지) (b) `TEST_SCOPE=word` 스모크만으로 회귀가 잡히는지 (c) HWP 안내 문구 교체가 ko/en·SEO·정적 산출에 영향이 없는지.
4. **실행 게이트**: 착수 시 재고정할 `main` 해시 절차, 분리 체크아웃(`git worktree`) 로 S3 워킹트리를 건드리지 않는 방법, 공통 파일 실제 교집합 재산출.
5. **sol 재해석 지점 잔여**: 남아 있으면 문안 제안. 없으면 **"Claude–Codex 간 이견 0 · [정본화 가능]"** 을 명시 선언.

## 3. 판정 형식
항목별 `[동의]/[반박: 증거]/[보완]` + 근거 + 잔여 이견 수 + 마지막 선언. 산출물 `/tmp/worklazy-dc-r3/REPORT.md`.
