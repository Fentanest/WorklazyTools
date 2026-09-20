# 지시서 — S2 브랜치 `--no-ff` 병합 · push(=배포) · 배포 후 확인 (Claude → Codex gpt-6-astra)

## 0. 선독
`PROJECT_RULES.md` 전문(특히 「커밋·업로드·배포는 Codex」·「검증은 실행이다」·「배포 전 로컬 시각 검수」) → `AGENTS.md` → `docs/jobs/todo/roadmap-completion-20260906.md` §2 C-A·C-D ⑨ → `docs/PUBLISHING_CHECKLIST.md` 해당 항목.

## 1. 전제(Claude 실측 · 사용자 승인)
- 배포 승인은 **포괄**(2026-09-06 사용자 결정 §결정 7 — S0 승인 시 발효). S2 는 Claude 게이트 ①~⑧(Gemini 로컬 검수 포함) 통과로 배포 조건을 충족했다.
- 기준: `main` = `15b31c1a38a6f39628046e988ae2b1ce92881fe9`, `s2-harness-perf` = `f8f8b0d`(전체 해시는 착수 시 `git rev-parse s2-harness-perf` 로 기록). 착수 시 둘을 `git rev-parse` 로 대조하고 다르면 중단·보고.
- 이전 전달 과정의 "커밋·push 금지" 제약은 무효 — 이 지시서의 완료 기준은 병합·push·배포 확인이다.

## 2. 절차
1. `git checkout main && git pull --ff-only origin main` → HEAD 가 `15b31c1a38a6f39628046e988ae2b1ce92881fe9` 인지 확인.
2. `git merge --no-ff s2-harness-perf -m "Merge S2 harness gates, CLS fixes and accessibility coverage for live deployment"` (squash·rebase 금지).
3. **push 전 `main` 빌드**: 병합 커밋에서 `npm run build`(production, Actions 와 같은 `VITE_SITE_URL=https://worklazy.net/ VITE_BASE_PATH=/`) · `npx tsc -b` · `npm run test:unit` · `npm run test:static` · `npm run css:orphans`(0) · `npm run legacy:manifest` · `node tests/tool-registry-routes.mjs` · `npm run test:qr-bulk` · `git diff --check` · **`VITE_LOCAL_QA=1 npm run build` 후 `A11Y_MAX_TOTAL=0 npm run test:a11y`(확장 8페이지) · `npm run test:rendering`(CLS ≤0.1 절대 게이트)** · 그 뒤 production 으로 다시 `npm run build`. 하나라도 실패하면 push 하지 말고 보고. 앞선 S2 잡의 QA preview(포트 4188)가 남아 있으면 **Claude·Gemini 검수가 끝난 상태이므로** 종료해도 된다.
4. `git push origin main`. `gh run list --limit 1` 로 run ID 확보 → `gh run watch <id> --exit-status`.
5. 배포 후 확인(C-D ⑨ · P2 배포 계약 계승): Actions 성공 후 라이브 `curl -s https://worklazy.net/ko/ | grep -o 'index-[A-Za-z0-9_-]*\.js'` 가 병합 커밋의 production 빌드 entry 해시와 일치(GitHub Pages CDN 전파는 수 분 걸릴 수 있다 — 최대 10분, 60초 간격 재시도) · `startup-help` 섹션 유지 · **라이브 CLS**(홈·문서 비교·PDF 각 3회, `sources` 포함 — 기대 ≤0.1, 로컬 0 과의 차이는 기록) · **라이브 모바일 하단 탭 비활성 색**이 `rgb(105,105,111)` 인지 DOM 확인 · 사이드바 로고 `naturalWidth/naturalHeight` 비율 유지 · 5페이지(홈 ko/en · 도구 목록 ko · HWP 편집 ko · 오디오 스튜디오 ko/en) HTTP 200 · 라이브 URL 로 접근성 감사 위반 0(`A11Y_BASE_URL` 류 옵션이 있으면 사용, 없으면 Playwright+axe 로 같은 5페이지 직접 측정) · `/ko/404-없는경로/` 가 404 페이지 · 격리 문서(`/ko/tools/office-editor/app/` 류)에서 `googlesyndication|adsbygoogle` 요청 0 · 홈 ko 의 CLS 라이브 측정 1회(≤0.114199) · 20 도구 ko/en 직접 진입 빈 화면 0(`mainTextLength>0`) 표.
6. 배포 후 확인 결과를 `docs/review-notes.md` S2 절 아래 **사후 기록 커밋**(C-A 예외)으로 남기고 push.

## 3. 보고
병합 커밋 해시 · push 출력 · Actions run ID/상태/소요 · 5항 각 확인 원문 · 사후 기록 커밋 해시 · 종료 시 `git status --porcelain`(untracked 사용자 파일 3개만).
