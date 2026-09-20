# 지시서 — U4-2 fix-1 재검수 (2026-09-07, Claude → Codex **gpt-6-astra**)

## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md` → 자신의 1차 보고 `/tmp/worklazy-u4-2-review/REPORT.md`(F1·P3)·`probes/lifecycle.mjs`·`terminal-races.jsonl` → 수정 지시서 `<scratchpad>/u4-2-fix1-dispatch.md` → sol 보고 `/tmp/worklazy-u4-2-fix1/REPORT.md`·logs (`<scratchpad>` = `/tmp/claude-1000/-home-better0101-projects-worklazytools/f5cf1bca-6bf0-442b-b9d4-e7cb45f9c96d/scratchpad`).

## 1. 성격·기준
- **검수 잡(쓰기 모드·저장소 불변)** — 추적 파일 수정·커밋·push·브랜치 전환·설치 금지. 산출물 `/tmp/worklazy-u4-2-review2/`. 브랜치 `s3-pdf-finish` HEAD `446a1e35ba60ebc308a32a13f8b675a02b095365`(fix 커밋, 기준 `47c0f22`), `main` `5bc6854175331bdd73b267784d9633cdccda8446`. 시작·종료 `git status`·추적 파일 SHA 불변 증명. 빌드 직렬 `NODE_OPTIONS=--max-old-space-size=4096`.
- **검수 조건 정정(P3 반영)**: 생성물 비교 기준은 "PDF 본체·PDF preload 및 그 자산명을 참조하는 산출물 외 SHA 동일, 참조 변경은 별도 증명"(1차 `probes/dist_compare.py` 방식).

## 2. 검수 항목(재현 필수)
1. **F1 해소**: 자신의 **원본** `probes/lifecycle.mjs` 를 현행 HEAD 사본에 적용 → **49 PASS/0 FAIL**(반례 4: abort/error/error-event/post-throw → late error 가 첫 오류 name·message·code 유지, terminate 1회, abort listener 0; 다음-task 대조군·result→late error 보존). sol 이 스크립트를 수정했는지(`diff` — 경로 조정만 허용) 대조. 새 unit 4개가 리터럴 기대값인지·mutant(수정 되돌리기)로 실패하는지 1회 확인.
2. **번들 역행 확인**: sol 표에서 47c0f22 → fix-1 로 entry −18B·shared −17B·route +46B·app +7B. 15줄 facade 변경으로 entry/shared 가 줄어든 이유(preload 목록·청크 경계 변화?)를 `entry_attribution.py` 방식으로 귀속해 설명하고, main 기준 5종 Δ를 다시 적는다.
3. **회귀**: E3 11/11·공개 client 20/20 대조·signature AST 비교(1차 `signature-results.json` 방식) · `git diff main..HEAD -- src/utils/workerLifecycle.ts src/features/excel-cleaner src/features/excel-compare` 0바이트 · tsc · unit 전수 · 직렬 build · `TEST_SCOPE=pdf` · Excel 스모크 2종 · legacy oracle diff 0 · 번들 5종(47c0f22 대비 Δ 기록·상한) · 생성물 비교(정정 기준) · `git diff --check`.
4. **범위**: `git diff --stat 47c0f22..HEAD` 가 `pdfWorkerLifecycle.ts`·`pdf-lifecycle.test.ts`·기록만인지.
5. **기록**: review-notes U4-2 절에 F1 사유·수리·timeout 검사 대상 정정·SHA 참조 전파 사실이 있는지, CHANGELOG 정합, Codx 서명.

## 3. 판정 형식
| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 | · 마지막 **[검수 통과] / [수정 후 재검수]**. 산출물 `/tmp/worklazy-u4-2-review2/REPORT.md`.
