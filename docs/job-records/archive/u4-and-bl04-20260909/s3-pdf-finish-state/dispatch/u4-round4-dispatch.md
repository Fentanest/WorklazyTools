# 지시서 — U4(PDF 마무리) 계획 v5 · Codex astra 4차 반박 (2026-09-06)
## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md`(신설 「모델 역할 분담」 — 이 라운드는 astra 반박: 작업 중 발생·인지될 예외 상황과 구성의 흠결까지 sol 이 감당할 수 있을 만큼 고려해 반박) → `docs/jobs/todo/pdf-finish-20260905.md` 전문(**「v5 반영」 절이 최신**) → `roadmap-completion-20260906.md` §2·§3 S3·§결정 10·11 → 자신의 3차 보고 `/tmp/worklazy-u4-r3/REPORT.md`(E1~E13 산출물 재사용 가능).
## 1. 성격·기준
- **반박 라운드(실험 모드)** — 저장소 파일 수정·커밋·push·`dist` 변경·npm 설치 절대 금지. 실험은 `/tmp/worklazy-u4-r4/`(3차의 `/tmp/worklazy-u4-r3/project/` 복제본 재사용 가능). 시작·종료 불변 증명(3차의 `verify-unchanged.py` 방식).
- 저장소 루트 `/home/better0101/projects/worklazytools`, 기준 HEAD `main` = `1a04f2571109495a76b8468af95b2f4edcd862cf`. **`AGENTS.md`·`CLAUDE.md` 는 워킹트리에 Claude 의 문서 변경이 있다(모델 역할 규칙 추가) — 이는 알려진 변경이며 불변 증명에서 제외하고 그 외 파일 불변을 증명한다.**
- 동시에 S2b 1차 반박(읽기 전용)이 같은 저장소를 읽는다.
## 2. 반박 대상
「v5 반영」 D1~D8 문안 + 함께 고정한 [동의] 문안 요약. 특히:
- **D5 결정적**: `scripts/measure-bundle-budget.mjs` 의 귀속 비교를 **모듈 단위**로 내리는 설계(baseline route 모듈 → current shared 이동 = "이동", 신규/증가 = "순증분", 게이트는 순증분)를 `/tmp` 복제본에서 **실제로 구현해** 3차 E6 의 `lazy-fontkit`·`integrated-fontkit` 빌드 산출물로 재계산하고 순증분 shared·app·route 수치를 제시. 구현 불가·정의 모호점이 있으면 이견으로. 5종 상한 값 변경은 제안 금지.
- D3: (A) 단일 캔버스 상한 / (B) 누적 자원 예산 분리 절차가 F4b 벤치에서 실측 가능한 형태인지(각 지표의 측정 방법 명시 요구).
- D4: 재구축 보존/지원 제외 표 **초안**을 구조별로 작성(보존 가능 근거: pdf-lib API 실재 여부 probe).
- D2·D7: 확정 문안이 E5 probe 와 정합하는지 재확인.
- D1·D6·D8: 문안 오류 유무.
- **sol 관점 검토**: 정본이 이 상태로 확정되면 sol 이 U4-0~U4-8 을 코딩하면서 **재해석해야 할 지점**이 남아 있는가 — 남아 있으면 각각 이견으로 올려라(이번 라운드의 핵심 요구).
## 3. 판정 형식
항목별 표 · 잔여 이견 수 · [정본화 가능]/[재왕복 필요]. 잔여 0 이면 "Claude–Codex 간 이견 0" 명시. 산출물 `/tmp/worklazy-u4-r4/REPORT.md`.
## 4. 금지
저장소 변경 · 계획서 편집 · 사용자 파일 조작 · 상한 변경 제안.
