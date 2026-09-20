# 지시서 — S1 브랜치 `--no-ff` 병합 · push(=배포) · 배포 후 확인 (Claude → Codex gpt-6-astra)

## 0. 선독
`PROJECT_RULES.md` 전문(특히 「커밋·업로드·배포는 Codex」·「검증은 실행이다」·「배포 전 로컬 시각 검수」) → `AGENTS.md` → `docs/jobs/todo/roadmap-completion-20260906.md` §2 C-A·C-D ⑨ → `docs/PUBLISHING_CHECKLIST.md` 해당 항목.

## 1. 전제(Claude 실측 · 사용자 승인)
- 배포 승인은 **포괄**(2026-09-06 사용자 결정 §결정 7 — S0 승인 시 발효). S1 은 Claude 게이트 ①~⑧(Gemini 로컬 검수 포함) 통과로 배포 조건을 충족했다.
- 기준: `main` = `37d4e69924d80120c3f34a38b0d20dd0e08d3f59`, `s1-dead-code` = `454d9fb`(전체 해시는 착수 시 `git rev-parse s1-dead-code` 로 기록). 착수 시 둘을 `git rev-parse` 로 대조하고 다르면 중단·보고.
- 이전 전달 과정의 "커밋·push 금지" 제약은 무효 — 이 지시서의 완료 기준은 병합·push·배포 확인이다.

## 2. 절차
1. `git checkout main && git pull --ff-only origin main` → HEAD 가 `37d4e69924d80120c3f34a38b0d20dd0e08d3f59` 인지 확인.
2. `git merge --no-ff s1-dead-code -m "Merge S1 document-compare dead code removal for live deployment"` (squash·rebase 금지).
3. **push 전 `main` 빌드**: 병합 커밋에서 `npm run build`(production, Actions 와 같은 `VITE_SITE_URL=https://worklazy.net/ VITE_BASE_PATH=/`) · `npx tsc -b` · `npm run test:unit` · `npm run test:static` · `npm run css:orphans`(0) · `npm run legacy:manifest` · `node tests/tool-registry-routes.mjs` · `TEST_SCOPE=word npm run test:browser` · `TEST_ONLY_HWP=1 npm run test:new-tools` · `git diff --check`. 하나라도 실패하면 push 하지 말고 보고. 앞선 S1 잡의 QA preview(포트 4288)가 남아 있으면 **Claude·Gemini 검수가 끝난 상태이므로** 종료해도 된다.
4. `git push origin main`. `gh run list --limit 1` 로 run ID 확보 → `gh run watch <id> --exit-status`.
5. 배포 후 확인(C-D ⑨ · P2 배포 계약 계승): Actions 성공 후 라이브 `curl -s https://worklazy.net/ko/ | grep -o 'index-[A-Za-z0-9_-]*\.js'` 가 병합 커밋의 production 빌드 entry 해시와 일치(GitHub Pages CDN 전파는 수 분 걸릴 수 있다 — 최대 10분, 60초 간격 재시도) · `startup-help` 섹션 유지 · **redirect 3건**(`/ko/tools/word-compare/`·`/ko/tools/hwp-compare/`·`/en/tools/word-compare/` → document-compare 도착 DOM) · 문서 비교 ko/en 200·정상 DOM · 5페이지(홈 ko/en · 도구 목록 ko · HWP 편집 ko · 오디오 스튜디오 ko/en) HTTP 200 · 라이브 URL 로 접근성 감사 위반 0(`A11Y_BASE_URL` 류 옵션이 있으면 사용, 없으면 Playwright+axe 로 같은 5페이지 직접 측정) · `/ko/404-없는경로/` 가 404 페이지 · 격리 문서(`/ko/tools/office-editor/app/` 류)에서 `googlesyndication|adsbygoogle` 요청 0 · 홈 ko 의 CLS 라이브 측정 1회(≤0.114199) · 20 도구 ko/en 직접 진입 빈 화면 0(`mainTextLength>0`) 표.
6. 배포 후 확인 결과를 `docs/review-notes.md` S1 절 아래 **사후 기록 커밋**(C-A 예외)으로 남기고 push.

## 3. 보고
병합 커밋 해시 · push 출력 · Actions run ID/상태/소요 · 5항 각 확인 원문 · 사후 기록 커밋 해시 · 종료 시 `git status --porcelain`(untracked 사용자 파일 3개만).
