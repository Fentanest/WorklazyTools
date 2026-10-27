# 에이전트 호출·복구 런북

2026-09-22 정리. 정책은 PROJECT_RULES.md, 정확한 모델은 `docs/agent-ops-config.json`이 정본이다. 첫 호출·설치 버전/환경 변경·복구 때 읽고 확인한 같은 계약은 재사용한다. 아래 명령은 사용자 Linux 호스트에서 실행한다. 문서·파일 생성은 호스트에서의 성공 증명이 아니다.

## 0. 기본 실행 표면 — herdr (2026-10-26 사용자 지시)

사용자가 herdr 화면에서 직접 지켜볼 수 있도록 **외부 에이전트는 모두 herdr 페인에서 대화형 세션으로 띄운다.** 대상은 Codex(Sol·Astra·Luna), Gemini(agy), Muse(OpenCode), Claude 작업자(Sonnet 등)다. 헤드리스 `codex exec`·companion `--background`·`agy -p`·`opencode run`·`nohup`, Claude `Agent` 서브에이전트로 다른 모델 몫을 대신 돌리는 방식은 기본 경로가 아니다. herdr를 쓸 수 없을 때(`HERDR_ENV` 없음, herdr 서버 장애)만 §2~§5의 기존 경로를 쓰고 그 이유를 작업 기록에 남긴다.

**권한 — 사용자 명시 승인(2026-10-26: "권한 차단당하지 말고", opencode 호출 포함).** 권한 질문이나 샌드박스 때문에 작업자가 멈추거나, 질문이 자동 거부돼 빈 결과로 끝나지 않도록 아래 플래그로 시작한다.

| 역할 | `--kind` | `--` 뒤 인자 |
|---|---|---|
| Sol / Astra / Luna | `codex` | `-C "$WT" -m <gpt-6.1-sol / gpt-6-astra / gpt-6-luna> --dangerously-bypass-approvals-and-sandbox` |
| Gemini | `agy` | `--add-dir "$WT" --model gemini-3.8-flash-high --dangerously-skip-permissions` |
| Muse | `opencode` | `--auto "$WT"` — 모델은 `~/.config/opencode/opencode.jsonc`의 `model`(2026-10-26 기준 `opencode-go/muse-spark-1.3-contributor`). 실제 ID를 `muse_runtime_id`에 기록한다 |
| Claude 작업자 | `claude` | `--model sonnet --dangerously-skip-permissions` |

- 권한 플래그는 질문을 없앨 뿐 역할 범위를 넓히지 않는다. 비밀값·실주문·운영 데이터/서비스·push·배포·다른 worktree 금지는 작업서와 사후 검사(`git status --short`, `find <경로> -newer <marker>`)로 지킨다.
- 총괄 Claude가 Claude Code 자동 모드 분류기에 막히면("Create Unsafe Agents" 등) 우회하지 말고 사용자에게 알린다. 상시 허용은 사용자가 `~/.claude/settings.json`에 둔다: `permissions.allow`의 `Bash(herdr *)`와 `autoMode.allow`의 herdr 협업 위임 문구.

### 절차

총괄 Claude 자신이 herdr 페인 안에서 실행 중이어야 한다(`test "$HERDR_ENV" = 1`). 아니면 바깥에서 사용자의 herdr 세션을 조작하지 말고, herdr 안에서 Claude를 다시 열어 달라고 요청한다. 명령 문법의 정본은 설치된 `herdr agent`·`herdr pane` 도움말이다.

```bash
WT=/절대/경로/작업-worktree; NAME=sol-search      # 이름: [a-z][a-z0-9_-]{0,31}, 살아 있는 에이전트끼리 유일
herdr pane layout --pane "$HERDR_PANE_ID"          # 넓으면 right, 좁거나 길면 down
P=$(herdr pane split --current --direction right --cwd "$WT" --no-focus | jq -r .result.pane.pane_id)
herdr agent start "$NAME" --kind codex --pane "$P" --timeout 60000 -- \
  -C "$WT" -m gpt-6.1-sol --dangerously-bypass-approvals-and-sandbox
herdr agent prompt "$NAME" "작업서 $WT/docs/jobs/todo/<파일>.md 를 읽고 수행하라. 결과는 $WT/<결과경로> 에 쓰고, 끝나면 그 경로와 한 줄 요약만 답하라." --wait --timeout 120000
herdr agent wait "$NAME" --timeout 3600000        # 긴 작업: Bash run_in_background로 걸어 하네스 완료 알림을 받는다
herdr agent read "$NAME" --source recent-unwrapped --lines 200
```

- 배치: 기본은 현재 탭의 형제 페인이고 `--no-focus`로 사용자 포커스를 뺏지 않는다. 동시 작업자가 3개를 넘으면 `herdr tab create --label <묶음> --cwd "$WT" --no-focus`로 묶음 탭을 따로 만든다. ID는 JSON 응답에서 읽고 예시·사이드바 순서로 추측하지 않는다.
- 프롬프트: 작업서는 worktree 안 파일로 두고 경로만 보낸다. 긴 결과는 파일로 쓰게 하고 `agent read`는 상태 확인에 쓴다.
- 대기: `--wait`는 첫 `idle`/`done`/`blocked`에서 돌아온다. `pgrep`·로그 grep 대기 루프를 만들지 않는다. `timeout`·`agent_prompt_stalled`는 미전달의 증거가 아니므로 같은 프롬프트를 바로 다시 보내지 말고 `agent get`/`agent read`부터 본다.
- `blocked`: 권한 우회 뒤에도 남은 질문 화면이다. `agent read`로 보고, 작업서 범위 안의 선택이면 `agent send-keys`로 답하고 범위 밖이면 사용자에게 묻는다.
- 완료 판정: `idle`/`done`은 입력 대기일 뿐이다. 결과 파일·diff·검사 출력으로 확인한다. agy는 내부 백그라운드 작업이 남아 있어도 idle로 보일 수 있다.
- 후속: 같은 작업의 후속은 같은 에이전트 이름으로 `agent prompt`해 세션을 잇는다. 다른 작업·다른 worktree는 새 페인·새 세션으로 띄운다.
- 정리: 결과를 회수해 보고한 뒤 **자기가 만든 페인만** `herdr pane close <pane>`로 닫는다. 사용자가 보는 중이거나 남겨 달라고 하면 둔다. 다른 페인·탭·워크스페이스와 `herdr server stop`은 건드리지 않는다.
- 묶음 검수: herdr 경로로 띄운 Astra 검수는 `agent_ops.py dispatch-review`/`finish-review`(companion 잡 ID 기반)를 거치지 않는다. 검수 프롬프트에 정식 결과 JSON 경로를 지정하고, 에이전트 이름·worktree·고정 후보·결과 경로를 `docs/jobs`에 기록한다. `agent_ops.py`의 herdr 연동은 아직 없다.

### agy가 시작 직후 꺼지거나 빈 결과로 끝날 때

- `-p`(인쇄 모드)를 쓰지 않는다. 인쇄 모드는 한 턴 뒤 종료되고 권한 질문을 자동 거부해 빈 출력이 된다. 대화형으로 띄워야 페인이 유지되고 사용자가 볼 수 있다.
- `--dangerously-skip-permissions`와 `--add-dir "$WT"`를 반드시 준다. `--sandbox`(셸이 `connecting to sandbox server ... connection reset by peer`로 전부 실패)와 `--mode plan`은 쓰지 않는다.
- `agent start`가 `agent_not_ready`·타임아웃으로 끝나거나 페인이 셸 프롬프트로 돌아오면 `herdr pane read "$P" --source recent-unwrapped --lines 200`과 agy 로그로 원인(인증·한도·모델 ID·신뢰 질문)을 확인한다. 고칠 수 있는 원인을 고친 뒤 같은 인자로 한 번만 다시 시작한다.
- 메모리 상한(§3, 2026-10-13 OOM): 페인 셸을 먼저 상한 scope 셸로 바꾼 뒤 그 안에서 agy를 시작한다. `herdr pane run "$P" "systemd-run --user --scope --collect -p MemoryMax=8G -p MemorySwapMax=0 bash"` → 프롬프트 확인 → `herdr agent start ... --pane "$P"`. 이 중첩 셸을 herdr가 사용 가능한 셸로 인식하는지는 **미검증**이다. 첫 사용 때 확인하고 이 줄을 고친다.

## 1. 실행 유형과 worktree

| 유형 | 모델·용도 | 실제 권한 |
|---|---|---|
| 조사/순수 원문 대조 | Gemini, 한도 초과 조사 대체 Luna, 순수 계획 판독 Astra | 원문 읽기·검색·허용 조사 스크립트. 제품 수정 없음 |
| 격리 검수 재현 | Astra | 검수 worktree의 임시 빌드·테스트·보고 쓰기. 제품 원본·커밋·push·배포 금지 |
| 구현 | Sol 또는 Muse | 승인된 자기 구현 worktree의 제품 수정·국소 검사·보존 커밋 |

쓰기 sandbox와 제품 구현 허가는 별개다. 검수에 필요한 쓰기를 막아 증거가 0개인 상태를 정상 검수로 만들지 않는다. 반대로 `--write`를 주고 ‘수정하지 마’라는 프롬프트만으로 운영·다른 worktree까지 보호됐다고 주장하지 않는다.

발주·상태·결과·취소의 cwd는 **해당 작업의 worktree**로 고정한다. 주 저장소로 무조건 복귀하지 않는다. `git rev-parse --show-toplevel`, `git worktree list --porcelain`, 대상 HEAD·dirty·소유 범위를 확인한다. 구현·검수는 별도 공간이고 검수 후보는 고정한다.

worktree를 사용할 때 실제 호스트의 trusted 프로젝트 설정, linked gitdir, 필요한 임시/의존성 캐시 쓰기 경로를 확인한다. 상위 프로젝트 신뢰가 하위 worktree에 자동 적용됐다고 가정하지 않는다. `.codex/config.toml` 같은 gitignored 설정은 확인된 필요한 사본만 전달한다. herdr 작업자는 §0의 사용자 승인 플래그로 실행한다. companion 대체 경로의 권한 오류는 실제 mount·설정·로그로 진단하며 전역 설정의 sandbox 해제·무제한 writable_roots로 고치지 않는다. 제품 원본·다른 worktree를 쓰기 가능 범위에 넣지 않는다.

필요한 의존성 준비는 지정 준비 담당이 실제 lock·설치 상태를 확인한 후 수행한다. 매 호출 무조건 재설치하지 않으며, 병렬 작업이 변경 가능한 node_modules·fixture를 공유하지 않는다. 준비 미완료를 테스트 통과로 바꾸지 않는다.

## 2. Codex — herdr를 못 쓸 때: 공식 플러그인 companion 직접 호출

기본은 §0의 herdr 페인(`--kind codex`)이다. 이 절은 herdr를 쓸 수 없을 때의 대체 경로와 `agent_ops.py dispatch-review` 자동 발주용이다. 대체 경로에서는 기존 **공식 Claude용 Codex 플러그인**을 유지한다. `Agent(codex:codex-rescue)`를 거치는 LLM 포워더 대신 그 플러그인의 `scripts/codex-companion.mjs`를 직접 부른다. 별도 Codex API·`nohup codex exec`·다른 하네스로 바꾸지 않는다.

호출 전에 실제 설치 디렉터리의 `agents/codex-rescue.md`와 companion 옵션을 확인한다. 이 문서는 옵션 의미의 참고이며 ‘모델 미지정 기본값’·포워더 호출·검토 시 무조건 쓰기 제거 같은 일반 동작을 이번 명시적 정책보다 우선하지 않는다. 정확한 역할 모델·worktree·실행 유형·fresh/resume 선택·프롬프트를 확정한다.

권장 발주는 이 묶음에 포함된 `scripts/codex_direct.py`다. 설치 레지스트리 또는 현재 plugin root를 찾고 설치본의 지시/스크립트 해시를 기록한다. 여러 설치본이 있으면 실제 사용 중인 하나를 `--plugin-root`로 명시하며 버전 번호를 추정해 선택하지 않는다.

```bash
python3 scripts/codex_direct.py --repo "$WORKTREE" doctor
python3 scripts/codex_direct.py --repo "$WORKTREE" dispatch --request "$REQUEST_JSON"
python3 scripts/codex_direct.py --repo "$WORKTREE" status "$JOB"
python3 scripts/codex_direct.py --repo "$WORKTREE" result "$JOB"
python3 scripts/codex_direct.py --repo "$WORKTREE" cancel "$JOB"
```

직접 호출의 실제 형태(값은 확인된 경로를 사용):

```bash
(cd "$WORKTREE" && node "$PLUGIN_ROOT/scripts/codex-companion.mjs" task \
  --cwd "$WORKTREE" --background --fresh --model "$MODEL" \
  --prompt-file "$PROMPT_FILE" --write --json < /dev/null)
```

순수 읽기 조사에는 `--write`를 빼고, 격리 재현 검수·구현에는 넣는다. `--prompt-file`은 설치본 지원을 확인한 뒤 사용한다. 미지원 버전은 파일 본문을 **단일 argv**로 전달하는 방식으로 해당 호출부만 조정한다. 셸 문자열 재평가·`eval`로 프롬프트를 전달하지 않는다. 백틱·`$()`·따옴표 자체를 내용에서 삭제할 필요는 없고 데이터가 셸 코드로 해석되지 않게 한다.

새 잡은 `--fresh`를 명시한다. 정상 후속을 재개할 경우에는 같은 작업·모델·worktree의 실제 이전 thread ID와 최신 지시서·diff·완료 범위를 확인한 후 설치본의 `--resume-last` 조건에 맞춰 직접 호출한다. 다른 작업이 가장 최근 스레드라면 재개하지 않는다. 제공된 자동 발주기는 오연결 방지를 위해 신규 잡만 발주한다. 실행 중인 잡을 두고 별도 새 잡을 만들지 않는다.

### 발주 직후 모델·디렉터리·권한 확인

검사 기준은 MyTradingDesk의 구체적인 방식으로 통일한다. 잡의 `request.model`·`workspaceRoot`·`write`와 실제 Codex rollout의 **`turn_context.model`·cwd·sandbox_policy**를 대조한다. 잡의 Claude `sessionId`와 Codex `threadId`를 혼동하지 않는다. `MODEL_MISMATCH`, `CWD_MISMATCH`, `WRITE_MISMATCH`, 실제 세션 확인 불가는 해당 잡 취소·보류 사유다. 다른 모델의 결과를 기다렸다가 뒤늦게 발견하지 않는다.

제공 실행기는 설치 플러그인의 `lib/state.mjs`에서 실제 jobs 경로를 얻고 지정 thread만 확인한다. 기존 `~/.claude/scripts/mtd-codex-model-check.sh`가 있으면 추가 확인용으로 사용할 수 있으나 그 파일 존재를 필수 전제로 삼지 않는다. 주 저장소 경로를 정답으로 고정했던 검사는 worktree 경로를 기대값으로 바꾼 뒤에만 사용한다. 글로벌 경로·기본 모델·쓰기 기본값을 추정하지 않는다.

발주 예약은 실제 호출 전 저장하고 잡 ID·실제 실행값은 직후 보존한다. 응답을 잃어 발주 여부가 불명확한 경우 자동 재시도하지 않는다. 같은 worktree의 살아 있는 잡과 미확정 예약을 먼저 확인한다. 원인이 확인된 실패도 취소·종료·diff 보존 뒤에만 재발주한다.

## 3. Gemini — `gemini-3.8-flash-high` 고정, 셸 허용, 결과 회수

기본은 §0의 herdr 대화형 agy(`--kind agy`, `--dangerously-skip-permissions`)다. 아래 `agy -p`·`scripts/gemini_research.py`는 herdr를 쓸 수 없을 때의 대체 경로다. 대체 경로에서도 셸이 필요한 조사는 `--dangerously-skip-permissions`를 붙인다(인쇄 모드의 권한 질문 자동 거부로 빈 출력이 되는 것을 막는다, 2026-10-26 사용자 승인).

Gemini 모델은 `gemini-3.8-flash-high`로 고정한다(2026-10-17 사용자 지시). 값은 `docs/agent-ops-config.json`의 `models.gemini`이며 `scripts/gemini_research.py`가 `--model`로 넘긴다. 모델 ID는 `agy models`로 대조한다. 실제 사용 모델을 기록한다. `--mode plan`은 기본값으로 쓰지 않는다. 모델에 따라 `--effort`를 거부하므로 붙이지 않는다. 기존 agy·구독 연결을 유지한다. 구 gemini CLI나 별도 API 과금으로 조용히 바꾸지 않는다.

**메모리 상한 필수(2026-10-13 사고):** agy는 작업 폴더의 git 미추적 파일마다 diff를 만든다. 대용량 미추적 운영 데이터가 있는 폴더를 `--add-dir`로 주면 수십 GB까지 커져 시스템 전체 OOM이 나고 편집기·Claude 세션까지 죽는다. 항상 `systemd-run --user --scope --collect -p MemoryMax=8G -p MemorySwapMax=0`으로 감싸고, 저장소 전체 대신 필요한 범위의 작은 폴더를 준다. 운영 데이터 폴더(`artifacts/`)는 로컬 `.git/info/exclude`로 미추적 목록에서 뺀다.

```bash
systemd-run --user --scope --collect -p MemoryMax=8G -p MemorySwapMax=0 \
agy --add-dir "$WORKTREE" --dangerously-skip-permissions \
  --print-timeout 15m --log-file "$JOB_DIR/gemini.log" \
  -p "$(cat "$PROMPT_FILE")" < /dev/null \
  > "$JOB_DIR/gemini-out.md" 2> "$JOB_DIR/gemini-err.log"
```

호스트의 duration·옵션 지원은 설치본으로 확인한다. 모든 작업의 시간을 15분으로 고정하라는 뜻이 아니다. 

```bash
(cd "$WORKTREE" && nohup timeout "$SECONDS_LIMIT" \
  agy --dangerously-skip-permissions -p "$(cat "$PROMPT_FILE")" \
  < /dev/null > "$JOB_DIR/gemini.log" 2>&1 &)
```

외부 관리자는 해당 PID·최종 결과를 회수해야 하며, 이 셸 예시가 Claude 하네스의 완료 알림까지 자동 설치하는 것은 아니다. 가능한 `scripts/gemini_research.py`를 전경 또는 하네스의 알림 연결 실행으로 사용한다. 로그는 작업별 영속 공간에 두고 `/tmp`만을 유일 보관소로 쓰지 않는다.

### 내부 배경 작업 문제의 해결

기존 장애의 본질은 ‘모든 비동기 실행 금지’가 아니라 **결과를 받기 전에 턴이 끝나 후속 단계가 끊기는 것**이다.

- Gemini 내부에서 반환값이 필요한 셸/도구 호출은 전경으로 수행하거나 같은 턴에서 명시적으로 wait·결과 조회를 끝낸다. 완료 전에 출력만 약속하고 종료하지 않는다.
- 외부 실행기가 agy 프로세스를 비동기로 관리하는 것은 허용한다. 다만 종료/로그/결과 파일을 확인한 뒤에만 다음 단계를 호출한다. 단순 PID 생존이나 로그 정체는 성공 증명이 아니다.
- 수집 → Jev → 부족한 자료 재수집은 **외부의 명시적인 순차 단계**로 연결한다. 첫 agy 호출의 실제 결과를 저장하고 `agent_ops.py check` 결과를 읽은 후, 필요 항목과 기존 증거 경로를 다음 agy 호출에 전달한다. 인쇄 모드의 가상의 ‘다음 턴’에 의존하지 않는다.
- 결과가 완결됐는데 agy가 유휴 상태로 남는 경우는 실제 최종 산출물을 확인한 뒤 소유한 실행만 종료한다. 출력 0바이트·타임아웃·부분 출력은 미확인이다. 회수되지 않은 내부 배경 작업을 완료로 간주하지 않는다.

셸·git 읽기·검색·조사 스크립트는 허용한다. 과거 ‘셸 전면 금지’·특정 allowlist 개수·일괄 짧은 인자 제한은 폐기한다. 비밀값·실주문·운영 데이터/서비스 변경·다른 작업트리 변경 금지는 유지한다. 실제 환경 거부는 stderr·현재 설정·해당 대화 로그로 진단하고, 고칠 수 있는 원인을 고친 뒤 Gemini로 재실행한다. 한도 초과가 아닌 오류를 Luna 전환으로 처리하지 않는다.

## 4. Jev 연결과 정식 검수 발주

실제 REST 전송 코드는 `scripts/jev_client.py`에 있다. 공식 SDK/OpenAPI 기준으로 `POST https://api.typesafe.ai/v1/systemone`에 `model/state/questions`와 Bearer 인증을 보낸다. 응답의 model·answers·choice/probabilities·usage를 검증한다. 키는 `TYPESAFE_API_KEY`에서만 읽는다. 자세한 실행·입력·예외 처리는 `docs/agent-ops-guide.md`다.

`check`는 짧은 1차 결과와 누적/보충/수리/검수 필요를 반환한다. `boundary`는 영역 전환 또는 최종 단계에서 묶음을 닫는다. 검수할 때만 고정 후보의 별도 review worktree를 준비하고 `dispatch-review`를 실행한다. `--dispatch --review-worktree ...`를 주면 check가 검수 필요로 판정한 경우 같은 발주기를 호출한다. 담당 모델은 Astra로 고정되며 정식 검수 결과는 `finish-review`로 회수한다. 일반 단계에 Claude의 재승인을 끼워 넣지 않는다.

이 코드 설치는 전역 Stop hook·MCP·새 daemon을 설치하지 않는다. 구현 종료/영역 전환 단계가 해당 명령을 실제 호출해야 작동한다. 기존 플러그인의 자동 review gate가 켜져 있으면 건별 중복 검수가 발생할 수 있으므로 현재 설정을 확인해 이번 묶음 정책과 충돌하는지 기록한다. 관련 설정을 조용히 바꾸거나 CI 필수 검사와 혼동하지 않는다.

## 5. WorklazyTools 전용 — Muse / OpenCode

기본은 §0의 herdr 대화형 OpenCode(`--kind opencode`, `--auto`)다. herdr 페인에서는 같은 에이전트 이름에 `agent prompt`를 보내 세션을 잇고, 이전 세션을 다시 열 때는 `--` 뒤에 `-s "$SESSION_ID"`를 준다. 아래 `opencode run`은 herdr를 쓸 수 없을 때의 대체 경로다.

Muse Spark 1.3은 Sol과 함께 정식 구현자다. MyTradingDesk에는 이 실행기를 추가하지 않는다. Muse의 실제 provider/model ID는 호스트 `opencode models`에서 확인해 작업지시서와 `docs/agent-ops-config.json`의 `muse_runtime_id`에 기록한다. 표시 이름으로 ID를 추정하거나 Codex 명령의 모델 문자열만 바꾸지 않는다. 기존 OpenCode·구독 연결을 유지한다.

같은 작업·같은 worktree의 정상 후속은 실제 세션 ID로 `-s`를 우선 사용한다. 바로 전 세션이 확실할 때만 `-c`를 사용한다. 같은 worktree 안의 대안·실험에만 `--fork`를 쓰고 부모/자식 ID와 목적을 기록한다. 새 worktree에는 fork를 강제하지 말고 새 세션과 인계 요약을 사용한다. 세션 분기는 파일 격리나 구현 허가가 아니다.

```bash
(cd "$MUSE_WORKTREE" && opencode run --auto --model "$MUSE_MODEL_ID" \
  -s "$SESSION_ID" "$PROMPT" < /dev/null \
  > "$JOB_DIR/muse-out.log" 2> "$JOB_DIR/muse-err.log")
```

설치본 opencode v2.0.29의 `opencode run --help`에는 `--dir`이 없다(2026-10-26 확인). 그래서 worktree로 cd한 뒤 실행한다. `--dir`을 넘기는 기존 실행기(safemap `scripts/muse_dispatch.py` 등)는 쓰기 전에 설치본 도움말로 확인한다.

신규 작업은 세션 옵션을 빼고, 확인된 대안 분기는 같은 명령에 `--fork`를 추가한다. 같은 호출에서 `-c`와 `-s`를 함께 쓰지 않는다. 같은 세션·작업 공간에 동시에 두 실행을 띄우지 않는다. 최신 정책·계획 버전·request mode·구현 허가를 매 인계에 전달한다.

비대화 호출은 **항상 `< /dev/null`**로 stdin을 닫는다. 과거 `init`에서 정지·세션 미생성은 stdin 소켓 대기 실측이 있었으며, inotify 부족으로 단정하지 않는다. 해당 조건을 확인했을 때만 stdin 차단을 적용해 한 번 재시도한다. 실패하면 정확한 소유 프로세스 종료·diff 보존 뒤 Sol로 인계한다.

프로젝트 밖 권한 질문 때문에 헤드리스가 멈추지 않게, 모델이 쓰는 임시 결과는 worktree 안의 gitignored 작업 경로를 사용한다. 과거 경로를 가진 세션을 다른 worktree에 무리하게 연결하지 않는다. 권한 질문은 `--auto`(명시 거부 규칙이 없는 권한 자동 승인, 2026-10-26 사용자 승인)로 넘기고, OpenCode 전역 설정의 권한 규칙은 바꾸지 않는다. 첫 답변이 ‘착수합니다’로 끝난 경우 실제 세션·산출물을 확인해 정상 후속을 보내며 신규 세션을 중복 발행하지 않는다. 상태·결과는 OpenCode의 실제 도구로 확인하고 Codex companion으로 조회하지 않는다.


## 감시·실패·복구·완료

herdr 작업자는 `herdr agent wait`(필요하면 Bash `run_in_background`)로 기다린다. 그 밖에도 가능하면 하네스가 완료를 통지하는 실행을 사용한다. 일회성 종료 대기에 만료되는 감시기만 의존하지 않는다. 완료 알림이 없는 별도 `nohup`만 띄워 놓고 대화를 끝내지 않는다. 대기 루프가 필요하면 별도 스크립트와 정확한 잡 ID/PID를 사용하고 `pgrep -f`·넓은 `pkill -f`로 자기 감시기·다른 잡을 잡지 않는다.

상태 문자열·로그 갱신·프로세스·실제 결과를 함께 확인한다. 단순 running·종료 알림·로그 정체만으로 성공을 판정하지 않는다. 실행기 종료·모델 답변·검수 통과·최종 승인·배포는 다르다. 제공 코드의 `completed`는 프로세스 terminal 상태이지 검수 통과가 아니다.

오류는 한도/인증/모델 부재/권한/도구/입력/불완전 결과로 나눈다. 수정 가능한 원인이 확인된 도구 실패만 한 번 재시도하며 동일 실패를 쌓지 않는다. 이 제한은 근거 있는 추가 반박 횟수와 다르다. 실패·모델 교체 시 기존 diff·staged/unstaged·필요한 새 파일·로그·완료 범위를 보존한다. reset·clean으로 지우지 않는다.

정상 질문에는 확인된 같은 세션을 안전하게 잇고, 죽은 잡은 종료·남은 작업을 확인한 뒤 새 잡에 인계한다. 발주/예약/결과를 잃은 경우 상태부터 복구하며 자동으로 동일 작업을 새로 띄우지 않는다. 실행 도구의 내부 스키마가 바뀌면 확인된 스키마로 작은 어댑터를 고치고, 가짜 모델/경로/옵션을 쓰지 않는다.

계획만 종료는 정본화·구현 대기다. 구현 단계 종료는 해당 단계의 필수 검사·차단 해소, 최종 단계는 남은 묶음 검수·최종 통합·승인된 배포 확인까지 구분한다. 문서·운영 도구 유지보수만으로 제품 배포를 시작하지 않는다.
