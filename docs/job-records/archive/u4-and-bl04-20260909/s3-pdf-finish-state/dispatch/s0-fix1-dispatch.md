# 수정 지시서 — S0 육안 검수 소견 반영 (Claude → Codex gpt-6-astra)

## 0. 선독
`PROJECT_RULES.md` 전문 → `AGENTS.md` → `/tmp/worklazy-s0/REPORT.md`(자신의 S0 보고) → 이 파일.

## 1. 성격·기준
- **파일 수정이 필요한 구현 작업(쓰기 모드)**. 브랜치 `s0-blank-page`(HEAD `ceb96dd`) 위에 커밋 1개. **main 병합·push 금지.** 이전 전달 과정의 "커밋 금지" 제약은 무효.
- 저장소 루트 `/home/better0101/projects/worklazytools`. 착수 시 `git rev-parse s0-blank-page` = `ceb96dd…` 확인, `git status --porcelain` 은 untracked 사용자 파일 3개만.
- **앞선 S0 잡의 사후 상태**: 그 잡은 최종 확인에서 `npm run preview`(4173·4183) 기동 중 종료됐다. 포트 점유 프로세스가 남아 있으면 `ss -ltnp | grep -E '417[0-9]|418[0-9]|419[0-9]'` 로 확인하되 **4188·4189·4190 은 Claude/Gemini 검수용이므로 죽이지 마라**.

## 2. 수정 (Claude 육안 검수 실측 — `/tmp/worklazy-s0/claude-visual/mobile-entry-root.png`)
1. **루트 랜딩 양어 안내 버튼 라벨 붙음** — `index.html` `#startup-help button` 이 `<span lang="ko">새로고침</span><span lang="en">Refresh</span>` 라 루트(`data-worklazy-language-landing`, 양어 표시)에서 **"새로고침Refresh"** 로 렌더된다(DOM innerText 실측 `새로고침Refresh`). 두 언어가 함께 보일 때 구분자를 넣어라 — 예: 두 span 사이에 `<span lang="ko en" aria-hidden="true"> · </span>` 을 두고 단일 언어 모드에서는 hidden 처리, 또는 CSS `#startup-help button [lang="en"]:not([hidden])::before{content:" · "}` 류. 단일 언어 페이지에서는 구분자가 보이지 않아야 한다. 안내 문단 두 개도 같은 원칙(현재는 별도 `<p>` 라 문제 없음 — 변경 불필요).
2. (판정 요청 — 수정 여부는 실측 후 결정) 경계·정적 안내 컨테이너를 `focus()` 하면 헤드리스에서 `outline: auto` 검은 테두리가 컨테이너 전체에 그려진다(`desktop-boundary-audio-ko.png`). 실제 사용자 흐름(포인터 클릭 후 진입)에서 `:focus-visible` 이 매칭되는지 Playwright 로 **마우스 클릭으로 사이드바 진입 → 청크 404** 시나리오를 실측해, 매칭되면 `outline` 을 `:focus-visible` 에서만 두는 등 정돈하고, 매칭되지 않으면 변경 없이 실측 결과만 기록하라. 접근성(alert 포커스) 계약은 유지.

## 3. 검증(실행·출력 기록)
- `npm run build`(production) → `npm run test:static`(startup 안내 검사 포함) · `npm run test:unit` · `npm run test:recovery`(B 사례가 루트 양어 안내를 검사하는지 확인하고, 구분자 유무를 단언에 추가) · `git diff --check`.
- 루트 `/`·`/ko/tools/audio-studio/`·`/en/tools/audio-studio/` 를 entry 404 조건에서 desktop/mobile 캡처해 버튼 라벨 텍스트를 innerText 로 기록(`/tmp/worklazy-s0/fix1/`).
- **`VITE_LOCAL_QA=1 npm run build` 로 `dist/` 를 다시 QA 빌드로 남겨라**(Claude 재검수용). 4188·4189·4190 서버는 dist 를 읽으므로 그대로 새 빌드를 서빙한다.
- `CHANGELOG.md` 기존 S0 항목에 한 구절 보강(별도 항목 신설 금지), `docs/review-notes.md` S0 절 끝에 "육안 검수 소견 반영" 소절 추가. 서명 Codx.

## 4. 보고
커밋 해시 · 검증표 · 2항 실측 결과(매칭 여부·근거) · 캡처 경로 · 종료 `git status --porcelain`·`git log --oneline main..s0-blank-page`.
