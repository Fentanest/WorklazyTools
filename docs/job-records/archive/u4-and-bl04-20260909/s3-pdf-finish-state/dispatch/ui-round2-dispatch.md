# 반박 2차 지시서 — UI 개편 계획 v2 (2026-09-07, Claude → Codex **gpt-6-astra**)

## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md` → 계획서 **`docs/jobs/todo/ui-theme-redesign-20260907.md` 「v2 반영」 절**(R1~R12 전건 수용 + 사용자 결정 ④⑤ + 단계 W0~W5 + 「2차 반박 요청」 (i)~(vii)) → 자신의 1차 산출 `docs/jobs/todo/ui-redesign-rounds/round-1-REPORT.md`·`probes-r1/`(`/tmp/worklazy-ui-r1/` 원본 잔존 시 재사용) → 시안 `newui/`(읽기만).

## 1. 성격·기준
- **실험 작업(쓰기 모드) — 저장소 불변.** 추적 파일 수정·커밋·push·브랜치 전환 금지. 워킹트리 `s3-pdf-finish` 는 U4 검수가 병행 중이고 `/tmp/worklazy-dc-impl` 에서 문서 비교 구현 잡이 병행 중이다 — **둘 다 건드리지 말 것.** 실험은 1차 사본(`/tmp/worklazy-ui-r1/main`) 재사용 또는 `/tmp/worklazy-ui-r2/main` 신규 전개(`git archive 5bc6854175331bdd73b267784d9633cdccda8446`). 산출물 `/tmp/worklazy-ui-r2/`. 새 npm 설치 금지.
- **포트는 4230~4239 범위 `--strictPort`**(다른 잡과 충돌 방지). 빌드·브라우저 직렬, `NODE_OPTIONS=--max-old-space-size=4096`.
- 사용자 결정 5건(shadcn 전면 제거 · 셸+홈+도구 전체 · WebP/AVIF · 홈 카드 전부 ko20/en19 · HOW IT WORKS 유지)은 되돌리는 제안 금지. 이의는 "★사용자 확인" 으로만.

## 2. 반박 항목 = v2 「2차 반박 요청」 (i)~(vii) 전부
(i) v2 문안이 1차 R1~R12 권고를 **누락·왜곡 없이** 반영했는지 문장 단위 대조(미반영은 증거와 함께).
(ii) 단계 **W0~W5 각각의 완료 판정 게이트**를 실행 가능한 형태로 확정: 무엇을 실행해 무엇이 통과해야 그 단계가 끝나는가, 단계 간 회귀 위험과 되돌리기 지점. 특히 W0 의 "legacy 직접 배경 최소 일관성" 을 어떻게 측정·판정하는지.
(iii) v2 보정 팔레트를 **CSS 값 기준**으로 4테마 × 주요 표면(본문·보조·CTA normal/hover/active/disabled·태그·틴트·focus 링·diff 삽입/삭제·preview·toast/error/success)에 대입해 대비 재계산 — 미달 시 보정값 제시. 반올림 전 기준, large text 는 실제 CSS 크기·굵기 충족 시에만 3:1.
(iv) **7종 프리미티브 계약표**를 sol 이 그대로 구현할 수 있는 수준인지 판정하고 빠진 상태·이벤트·엣지(controlled/uncontrolled·SSR 없음·중첩 modal·RTL 없음 등)를 채운다. Sheet 는 1차 native-dialog 실험의 Tab wrap 포함.
(v) **4테마 visual profile 의 정확한 집합**: 406 기본안을 scenario·locale·viewport·theme 조합 **목록으로** 산출하고, 하네스에 localStorage/`data-theme` 를 주입하고 캡처 전 DOM 값을 단언하는 방식을 프로토타입으로 1회 검증(소수 표본). a11y·rendering 이 같은 fixture 를 공유하는 방법도.
(vi) **검색 combobox 와 native select 언어 전환**이 기존 스모크 selector·라우팅·시각 시나리오에 주는 변경 목록(파일·selector 단위)과 대체안.
(vii) sol 재해석 지점 잔여 + 정본 반영 문안. 규칙 4·5·19 재점검. **잔여 0 이면 "Claude–Codex 간 이견 0 · [정본화 가능]"**(착수는 S3 통합 후라는 조건 명시).

## 3. 판정 형식
항목별 `[동의]/[반박: 증거]/[보완]` + 재현 명령·출력 + 정본 반영 문안 + 잔여 이견 수. 산출물 `/tmp/worklazy-ui-r2/REPORT.md`(+ `CANONICAL-AMENDMENTS.md` 권장).
