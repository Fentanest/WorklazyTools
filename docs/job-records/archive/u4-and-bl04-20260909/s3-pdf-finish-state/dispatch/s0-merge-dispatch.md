# 지시서 — S0 브랜치 `--no-ff` 병합 · push(=배포) · 배포 후 확인 (Claude → Codex gpt-6-astra)

## 0. 선독
`PROJECT_RULES.md` 전문(특히 「커밋·업로드·배포는 Codex」·「검증은 실행이다」·「배포 전 로컬 시각 검수」) → `AGENTS.md` → `docs/jobs/todo/roadmap-completion-20260906.md` §2 C-A·C-D ⑨ → `docs/PUBLISHING_CHECKLIST.md` 해당 항목.

## 1. 전제(Claude 실측 · 사용자 승인)
- 사용자가 S0 배포를 승인했다(2026-09-06). 이 승인은 정본 §5 결정 "배포 승인은 한 번에(포괄)" 에 따른 것이다.
- 기준: `main` = `5485fadc43677902c51fbc2d13579e8c1a26db0e`, `s0-blank-page` = `3672fc7af03f3fedd11fe36c8f238b474ce4c4e1`. 착수 시 둘을 `git rev-parse` 로 대조하고 다르면 중단·보고.
- 이전 전달 과정의 "커밋·push 금지" 제약은 무효 — 이 지시서의 완료 기준은 병합·push·배포 확인이다.

## 2. 절차
1. `git checkout main && git pull --ff-only origin main` → HEAD 가 `5485fadc43677902c51fbc2d13579e8c1a26db0e` 인지 확인.
2. `git merge --no-ff s0-blank-page -m "Merge S0 blank-page recovery for live deployment"` (squash·rebase 금지).
3. **push 전 `main` 빌드**: 병합 커밋에서 `npm run build`(production) · `npm run test:unit` · `npm run test:static` · `npm run test:recovery` · `node tests/tool-registry-routes.mjs` · `git diff --check` 를 실행하고 출력 기록. 마지막 브랜치 커밋 `3672fc7`(경계 포커스 outline 클래스·index.html 안내 구분자) 이후 a11y 를 다시 돌리지 않았으므로 **`VITE_LOCAL_QA=1 npm run build` 후 `A11Y_MAX_TOTAL=0 npm run test:a11y` 도 실행**하고, 그 뒤 **production 빌드로 다시 `npm run build`** 해 push 대상 산출물이 production 임을 확인한다(dist 는 커밋 대상 아님 — Actions 가 다시 빌드한다). 하나라도 실패하면 push 하지 말고 보고.
   - 앞선 S0 잡이 남긴 preview 프로세스(포트 4173·4183)가 있으면 `ss -ltnp` 로 확인 후 **자기 것만** 종료. 4188~4190 서버는 Claude 가 이미 종료했다.
4. `git push origin main`. `gh run list --limit 1` 로 run ID 확보 → `gh run watch <id> --exit-status`.
5. 배포 후 확인(C-D ⑨ · P2 배포 계약 계승): Actions 성공 후 라이브 `curl -s https://worklazy.net/ko/ | grep -o 'index-[A-Za-z0-9_-]*\.js'` 가 병합 커밋의 production 빌드 entry 해시와 일치(GitHub Pages CDN 전파는 수 분 걸릴 수 있다 — 최대 10분, 60초 간격 재시도) · `startup-help` 섹션이 라이브 HTML 에 존재 · 5페이지(홈 ko/en · 도구 목록 ko · HWP 편집 ko · 오디오 스튜디오 ko/en) HTTP 200 · 라이브 URL 로 접근성 감사 위반 0(`A11Y_BASE_URL` 류 옵션이 있으면 사용, 없으면 Playwright+axe 로 같은 5페이지 직접 측정) · `/ko/404-없는경로/` 가 404 페이지 · 격리 문서(`/ko/tools/office-editor/app/` 류)에서 `googlesyndication|adsbygoogle` 요청 0 · 홈 ko 의 CLS 라이브 측정 1회(≤0.114199) · 20 도구 ko/en 직접 진입 빈 화면 0(`mainTextLength>0`) 표.
6. 배포 후 확인 결과를 `docs/review-notes.md` S0 항목 아래 **사후 기록 커밋**(C-A 예외)으로 남기고 push.

## 3. 보고
병합 커밋 해시 · push 출력 · Actions run ID/상태/소요 · 5항 각 확인 원문 · 사후 기록 커밋 해시 · 종료 시 `git status --porcelain`(untracked 사용자 파일 3개만).
