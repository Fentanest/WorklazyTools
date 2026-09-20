# 지시서 — U4-1 fix-1 재검수 (2026-09-07, Claude → Codex **gpt-6-astra**)

## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md` → 정본 `docs/jobs/todo/pdf-finish-20260905.md`(N3 v7·v6 D3·D7·E5·E6-2 관련 절) → 1차 검수 보고 **자신의** `/tmp/worklazy-u4-1-review/REPORT.md`·`UNIT-MAPPING.md`·`defects.mjs`·`loader-check.mjs`·`goldens.mjs` → 수정 지시서 `<scratchpad>/u4-1-fix1-dispatch.md` → sol 보고 `/tmp/worklazy-u4-1-fix1/REPORT.md` + 로그 (`<scratchpad>` = `/tmp/claude-1000/-home-better0101-projects-worklazytools/f5cf1bca-6bf0-442b-b9d4-e7cb45f9c96d/scratchpad`).

## 1. 성격·기준
- **검수 잡(쓰기 모드·저장소 불변)** — 추적 파일 수정·커밋·push·브랜치 전환·저장소 안 설치 금지. 산출물 `/tmp/worklazy-u4-1-review2/`. 브랜치 `s3-pdf-finish` HEAD `ba762b4b1cf38b13bef3013aa465e59e33eb9146`(fix 커밋 `ba762b4`, 기준 `fd37cea`), `main` `5bc6854175331bdd73b267784d9633cdccda8446`. 시작·종료 `git status --porcelain`·추적 파일 SHA 불변 증명. 빌드 직렬 `NODE_OPTIONS=--max-old-space-size=4096`.

## 2. 검수 항목(재현 필수)
1. **F1~F5 해소 여부** — 1차의 `defects.mjs`·`loader-check.mjs`·`source-audit.mjs` 를 **현행 HEAD 사본**을 가리키도록 조정해 재실행: F1 `maximumTiles` 타입·런타임 부재 + 420 생성 0회 · F2 폭 5pt 긴 줄/짧은 `i`/빈 줄 모두 `narrow-region`, 폭 12pt `…` 만 · F3 timeline ledger 시점 합산 max(1,200B/2 · 800B/2 · 200B/1) 와 누적 pixels 가 peak·차단에 미사용 · F4 helper 정적 re-export 1줄 + `package.json` `test:pdf-finish-oracle` 만 변경(다른 줄 diff 0) + 새 `.ts` 의존 fixture 로 transitive 통과 · F5 `UNIT-MAPPING.md` 누락 항목 ↔ 새 unit 매핑(기대값이 **리터럴**인지 — 테스트 대상 함수 재계산 금지 위반 grep).
2. **회귀**: F1~F3 수정이 1차 통과 골든(400/361·D8·E6-2·A 12행·N1·N2·plan 64조합)을 깨지 않는지 `goldens.mjs` 14그룹 재실행.
3. **공통 검증 재현**: tsc · unit(272, finish 13) · 직렬 build · static · `TEST_SCOPE=pdf` 스모크(production preview) · `test:pdf-finish-oracle`(native flag 56/31) · bundle 5종 Δ0 · css:orphans · registry · `git diff --check` · production 537 SHA = main.
4. **범위**: `git diff --stat fd37cea..HEAD` 가 지시서 범위(finish 3파일·helper·package.json 1줄·unit·기록 2)뿐인지.
5. **기록**: review-notes U4-1 절의 F1~F5 사유·"정본 미정의 정책 없음" 정정·oracle flag 기록 정합, CHANGELOG 간결.

## 3. 판정 형식
| 항목 | 판정([통과]/[결함]/[미검증]) | 재현 명령·출력 | 수정 지시 문안 | · 마지막 **[검수 통과] / [수정 후 재검수]**. 산출물 `/tmp/worklazy-u4-1-review2/REPORT.md`.
