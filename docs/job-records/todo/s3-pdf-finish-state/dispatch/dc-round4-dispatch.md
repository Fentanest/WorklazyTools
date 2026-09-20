# 최종 확인 라운드(4차) — 문서 비교 정본 v3(3차 보완 반영본) (2026-09-07, Claude → Codex **gpt-6-astra**)

## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md` → 정본 `docs/jobs/todo/document-compare-granularity-20260907.md` 「정본화」 절(3차 보완 반영) → 자신의 3차 산출 `docs/jobs/todo/document-compare-rounds/round-3-AMENDMENTS.md`·`round-3-REPORT.md` → `ui-theme-redesign-20260907.md` §6-B.

## 1. 성격·기준
**읽기 중심 확인 라운드(쓰기 모드 — `/tmp` 산출).** 저장소 추적 파일 수정·커밋·push·브랜치 전환 금지. 워킹트리 `s3-pdf-finish` 는 U4-3 검수 잡이 병행 중 — 건드리지 말 것. 산출물 `/tmp/worklazy-dc-r4/`. 무거운 빌드·브라우저 불필요.

## 2. 확인 항목(짧게)
1. **R3-1**(확정 1-a 가드 단위 = 토큰 수, 문자/UTF-16/code point 금지, 동일 문자열 조기 반환 우선) 반영 정확성.
2. **R3-2**(제거 대상 = `docs/jobs/todo/document-compare-rounds/probes-r2/pruning.json` 의 `removed` 31, SHA-256 `d2c74bea63190073d951e57818bec11d1e072a9580282577fdccf58b53997894`, keep 17·의존 폐쇄 보존, 기준 변경 시 임의 산출 금지) 반영 정확성 — **파일 실존·SHA 재확인 포함**.
3. **R3-3**(확정 4-a: HWP 안내 문구는 화면 문구 변경 → ko/en 단언·QA 빌드 화면 확인(ko/en 데스크톱+320px)·`VISUAL_ONLY=document-compare` 실행 및 해당 상태 기준선만 갱신·worker inline `L(ko,en)` 사실·SEO/광고 불변 기록) 반영 정확성.
4. 편집 보강 3건(우선순위 문장·확정 3 의 4키/5쌍 복원·§6-B 원문 채택 명시) 반영 여부.
5. 남은 sol 재해석 지점. **없으면 "Claude–Codex 간 이견 0 · [정본화 가능]" 명시 선언.**

## 3. 판정 형식
항목별 `[반영 확인]/[미반영: 증거]` + 잔여 이견 수 + 마지막 선언. 산출물 `/tmp/worklazy-dc-r4/REPORT.md`.
