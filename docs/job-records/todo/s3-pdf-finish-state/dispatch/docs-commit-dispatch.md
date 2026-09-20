# 지시서 — 런북 이전 docs 커밋 1개 · main push (2026-09-06, Claude → Codex)

## 0. 선독
`PROJECT_RULES.md` 를 먼저 전부 읽어라(특히 「작업 기록」·「커밋·업로드·배포는 Codex」·「검증은 실행이다」). 그 다음 `AGENTS.md`.

## 1. 작업 성격
**파일 수정이 필요한 구현 작업이다(쓰기 모드)** — 단, 코드 변경은 없다. 워킹트리에 이미 있는 **문서 변경 3파일만** 커밋·push 한다. 이전 전달 과정의 "커밋 금지" 제약이 있었다면 무효다 — 이 지시서의 완료 기준은 커밋·push 다.

## 2. 기준
- 저장소 루트 `/home/better0101/projects/worklazytools`, 브랜치 `main`, 기준 HEAD `4d0bae93c141d5e3607e2be757a0e1ceee61d5d6`. 착수 시 `git rev-parse HEAD` 로 대조하고 다르면 중단·보고.
- `git status --porcelain` 기대값(착수 시 그대로여야 함):
  ```
   M CLAUDE.md
   M docs/agent-dispatch-runbook.md
   M docs/backlog.md
  ?? after.docx
  ?? before.docx
  ?? naver05161fb06bc9701a23cfc09ad5773578.html
  ```

## 3. 커밋 내용
- **스테이징 대상은 정확히 3파일**: `CLAUDE.md` · `docs/agent-dispatch-runbook.md` · `docs/backlog.md`. `git add <파일 3개>` 로만 추가한다. **`git add -A`·`git add .` 금지.**
- **untracked 3파일(`after.docx`·`before.docx`·루트 `naver0516….html`)은 절대 커밋하지 않는다** — 사용자 로컬 파일이며 지우지도 않는다(루트 naver 파일은 `public/` 에 이미 추적본이 있다).
- 변경 내용: ① 에이전트 호출 런북을 `docs/agent-dispatch-runbook.md` 에서 `CLAUDE.md` 「에이전트 호출 런북 — Opus 전용」절로 이전(runbook 파일은 이전 안내 스텁으로 축소) ② `docs/backlog.md` 「ZIP 출력 공통」절 신설(U5 드랍 후 살아남은 결함 후보 2건 이관). 2026-09-06 사용자 결정.
- 커밋 메시지(영어 한 줄 요약 관례): `docs: move agent dispatch runbook into CLAUDE.md and log ZIP backlog`
- **CHANGELOG.md 는 갱신하지 않는다** — 코드 변경 0 이다(「작업 기록」: CHANGELOG 는 코드 변경 기록). review-notes 도 불필요.

## 4. 커밋 전 검증(실행하고 출력 기록)
- `git diff --check` (공백 오류 0)
- `git diff --stat` 이 정확히 3파일인지
- `grep -rn 'agent-dispatch-runbook' --include=*.md . | grep -v node_modules | grep -v '^./docs/agent-dispatch-runbook.md'` — 다른 문서에서 옛 런북을 참조하는 곳이 있으면 **고치지 말고 목록만 보고**(이 커밋 범위 밖).

## 5. push · 배포 확인
- `git push origin main`.
- 이 저장소는 `main` push 가 GitHub Actions "Deploy GitHub Pages" 를 트리거한다. push 후 `gh run list --limit 1` 로 새 run 이 생겼는지 확인하고 **run ID·상태만 보고**한다. 문서 변경만이라 성공 여부까지 기다릴 필요는 없으나, `gh run watch <id> --exit-status` 로 10분 안에 끝나면 결과도 적어라.

## 6. 보고 형식
- 착수 시 `git rev-parse HEAD`·`git status --porcelain` 원문
- 커밋 해시(전체)·`git show --stat HEAD` 원문
- push 결과·Actions run ID·상태
- 4항 grep 결과
- 종료 시 `git status --porcelain` 원문(untracked 3파일이 그대로 남아 있어야 한다)

## 7. 금지
`git add -A`·squash·rebase·force push·CHANGELOG 편집·코드 파일 편집·untracked 파일 삭제.
