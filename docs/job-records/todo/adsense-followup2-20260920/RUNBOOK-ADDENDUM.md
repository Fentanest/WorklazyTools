# docs/agent-dispatch-runbook.md 추가 문안 (2026-09-20, Claude 작성 — PLAN-3 통합 기록 커밋에서 Sol이 반영)

삽입 위치: 「Codex 위임 — Claude의 설치된 연결 사용」 절 끝, 「Muse 위임·세션 이어쓰기」 절 끝.

## Codex 절에 추가

worktree에서 Codex를 실행할 때는 다음 네 가지를 갖춘 뒤 발행한다(2026-09-20 adsense-recheck에서 확인).
- `~/.codex/config.toml`의 `[projects."<worktree 절대경로>"] trust_level = "trusted"` 등록. 상위 폴더 등록은 하위 worktree를 덮지 않는다. 미등록이면 worktree의 `.codex/config.toml`이 로드되지 않는다.
- worktree의 `.codex/config.toml`(git 제외라 자동 복제되지 않음) `writable_roots`에 `<main>/.git`, **`<main>/.git/worktrees/<name>`(정확한 linked gitdir)**, worktree 경로, `/home/<user>/.npm`, 임시 산출물 루트를 넣는다. 부모 `.git`만 넣으면 Codex가 linked gitdir를 별도로 읽기 전용 마운트해 `git add`가 EROFS(exit 128)로 실패한다. 판별은 `findmnt -T <gitdir> -o TARGET,OPTIONS`.
- `npm ci`는 발행 전에 총괄이 worktree에서 선실행하고 지시서에 "npm ci 금지"를 적는다(홈 캐시 EROFS 방지).
- 프롬프트에 `--cwd <worktree>`를 명시하고, 상태·결과 조회도 `codex-companion.mjs status --cwd <worktree> <id>`로 한다. 잡 기록은 cwd 이름의 별도 상태 디렉터리(`state/<worktree명>-<hash>/jobs`)에 생긴다.
전달 계층(codex-rescue 서브에이전트) 변조 방지 문구를 프롬프트 머리에 넣는다: 모델 문자열 변경 금지, `--background`를 자체 Bash 백그라운드로 대체 금지, 돌려받은 `task-…` ID 보고. 발행 직후 잡 `.json`의 `model`과 `task-worker --cwd` 프로세스 수를 대조한다.

## Muse(OpenCode) 절에 추가

- `--fork`는 부모 세션의 프로젝트 디렉터리를 물려받는다. **다른 worktree에서 만든 세션을 새 worktree에서 fork하면** 새 경로가 `external_directory`로 판정돼 권한 질문 상태로 헤드리스 실행이 무한 대기한다(로그 0바이트, 프로세스만 생존; `~/.local/share/opencode/log/*.log`에 "asking permission=external_directory"). worktree가 바뀌면 fork 대신 새 세션을 만들고 인계 요약을 프롬프트에 넣는다. 같은 worktree 안의 후속에만 `-s`/`--fork`를 쓴다.
- 비대화형 `opencode run`은 프로젝트 밖 디렉터리 쓰기를 자동 거부한다. 임시 산출물은 worktree 안 git 제외 폴더(예 `tests/visual-artifacts/<작업>/`)로 지정하고 `/tmp`를 쓰지 않는다. `--auto`로 권한을 풀지 않는다.
- 첫 턴이 "착수합니다" 같은 상태 보고로 끝날 수 있으므로 프롬프트에 "이번 턴에서 상태 보고로 끝내지 말고 끝까지 수행"을 넣고, 종료 후 `opencode session list --format json`으로 실제 세션 ID(신규/자식)를 기록한다.

## Gemini(agy) 절에 추가

- 헤드리스 `-p`에서 셸 명령은 권한 질문 불가로 자동 거부되어 출력이 0바이트가 된다. 프롬프트 첫 줄에 "셸 명령 사용 금지, 내장 파일 읽기·검색 도구만 사용"을 넣는다. 입력 목록·참조 파일은 `--add-dir` 안에 두거나 프롬프트에 인라인한다(`/tmp` 경로는 읽지 못한다). 큰 묶음은 8~10건으로 나누고 회신 건수를 요청 건수와 대조한다. 인용된 커밋·경로는 존재 여부를 반드시 재확인한다.

## Muse(OpenCode) 절에 추가 2
- 새 worktree에서 `opencode run --dir <worktree>`가 "bootstrapping … init" 뒤 5분 넘게 `created id=` 로그 없이 멈추면(err 로그 0바이트) 1회만 재시도하고, 재발하면 Muse 실행을 종료하고(작업트리 변경 0 확인) Sol에게 같은 worktree로 인계한다. 2026-09-20 wt-followup2-d에서 2회 재현, 원인 미확인. 종료 시 `pgrep -a opencode | grep <worktree>`로 실행파일 기준 PID만 골라 kill한다(`pgrep -f`는 자기 명령줄을 잡아 스크립트가 함께 죽는다).
