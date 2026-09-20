# 수정 지시서 — S2b 3차 검수 소견 F2-R 반영 (2026-09-07, Claude → Codex **gpt-5.6-sol**)

## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md` → **3차 검수 보고 `/tmp/worklazy-s2b-review3/REPORT.md`**(F2-R 정의·실패 원문 `qr-bulk-smoke.mjs:218` actual `{present:true,disabled:true…}`·"대기 보강 사본" 위치) → 정본 `docs/jobs/todo/qr-font-20260906.md` 「정본화 보강」 스모크 계약.

## 1. 성격·기준
- **파일 수정이 필요한 구현 작업(쓰기 모드).** 브랜치 `s2b-qr-font`(HEAD `71a6200`) 위에 커밋 1개. **main 병합·push 금지.** 착수 시 브랜치·HEAD·`git rev-parse main`(`f29d249…`) 확인. **제품 코드 변경 금지**(테스트만). 사용자 untracked 3파일 금지.
- 동시에 U4 11차 반박(읽기 전용, pdf-editor 표면)이 돌 수 있다 — 무관.

## 2. 수정(F2-R)
- `tests/qr-bulk-smoke.mjs` 의 결과 교체(새 CSV 선택 → cleanup → 재생성) 흐름에서 **재생성 완료를 기다리지 않고** PDF 버튼 상태(`present:true, disabled:false`)를 단언해 실패한다(원본 2회 exit 1, `:218`). 3차 검수의 **대기 보강 사본**(`/tmp/worklazy-s2b-review3/` 아래 — 보고서에 경로) 과 같은 방식으로 **재생성 완료(결과 컨테이너·생성 버튼 상태·PDF 버튼 enabled) 를 `waitForFunction` 으로 대기**한 뒤 단언한다. 고정 `sleep` 금지, 타임아웃은 기존 스모크 관례(생성 대기 상한)에 맞춘다. 3 scenario·font404·청크 404·취소 단언 등 기존 검사는 그대로.
- 결정성: `npm run test:qr-bulk` **연속 2회** 통과를 확인해 원문 기록.

## 3. 검증
`npm run test:qr-bulk` ×2 · `npm run test:unit` · `npx tsc -b` · `npm run test:static` · `git diff --check`. `docs/review-notes.md` S2b 절에 F2-R 반영 한 줄(서명 Codx). `dist/` 변경 없음(테스트만).

## 4. 정지점·보고
커밋 후 브랜치 상태로 정지(4차 검수는 astra). 보고: 변경 위치·2회 실행 원문·검증표·`git status --porcelain`·`git log --oneline main..s2b-qr-font`. 산출물 `/tmp/worklazy-s2b-fix3/`.

## 5. 금지
main 커밋·병합·push · 제품 코드 변경 · 고정 sleep 으로 회피 · page.route · 계획서 편집 · 사용자 파일 조작.
