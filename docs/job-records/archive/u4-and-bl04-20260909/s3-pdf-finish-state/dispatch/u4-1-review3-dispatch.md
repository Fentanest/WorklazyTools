# 지시서 — U4-1 fix-2 재검수(3차) (2026-09-07, Claude → Codex **gpt-6-astra**)

## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md` → 자신의 2차 보고 `/tmp/worklazy-u4-1-review2/REPORT.md`(F5-R 7건 표·R-DOC)·`mutation-audit.py`·`mutants/` → 수정 지시서 `/tmp/claude-1000/-home-better0101-projects-worklazytools/f5cf1bca-6bf0-442b-b9d4-e7cb45f9c96d/scratchpad/u4-1-fix2-dispatch.md` → sol 산출 `/tmp/worklazy-u4-1-fix2/`(`commands.json`·`logs/`·`mutation-audit.json`·`mutation-audit-adjustment.diff`).

## 1. 성격·기준
- **검수 잡(쓰기 모드·저장소 불변)** — 추적 파일 수정·커밋·push·브랜치 전환·설치 금지. 산출물 `/tmp/worklazy-u4-1-review3/`. 브랜치 `s3-pdf-finish` HEAD `f56dc68d4c53d58cad520fe41973cd2699a4f548`(fix-2 커밋 `f56dc68`, 기준 `ba762b4`), `main` `5bc6854175331bdd73b267784d9633cdccda8446`. 시작·종료 `git status`·추적 파일 SHA 불변 증명.
- **범위 좁음**: fix-2 는 `tests/unit/pdf-finish-modules.test.ts`·`docs/review-notes.md` 만. `git diff ba762b4..HEAD -- src/` 0 을 먼저 확인하고, 0 이면 build·bundle·oracle·브라우저 스모크는 **생략**(근거 기록). tsc·unit 은 실행.

## 2. 검수 항목(재현 필수)
1. **F5-R 7건**: 자신의 2차 `mutation-audit.py`(원본 — sol 의 조정판 아님)를 현행 HEAD 사본에 적용해 **7 mutant 각각 unit exit≠0** 재현. 추가로 기대값이 **리터럴**인지(테스트 대상 함수·box 재계산으로 기대값 산출 금지) 새 단언 7곳을 읽어 판정. sol 의 `mutation-audit-adjustment.diff` 가 경로 조정에 그치는지(판정 로직 변경 없음) 대조.
2. **회귀**: 정상 HEAD unit 272/272·finish 13/13, `npx tsc -b` 0, `git diff --check` 0.
3. **R-DOC**: review-notes U4-1 절이 원구현 271/fix-1 272(원로그 부재 명시)/fix-2(원로그 경로) 를 구분하고 경로가 실제 존재하는지(`ls` 로 확인). Codx 서명. CHANGELOG 정합.
4. **범위**: `git diff --stat ba762b4..HEAD` 2파일뿐.

## 3. 판정 형식
| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 | · 마지막 **[검수 통과] / [수정 후 재검수]**. 산출물 `/tmp/worklazy-u4-1-review3/REPORT.md`.
