# 에이전트 호출·복구 런북

2026-09-22 정리. 정책은 PROJECT_RULES.md 가 정본이다. 에이전트 이름 → Paseo 실행값(provider/model·모드)은 §0 표가 정본이고, `docs/agent-ops-config.json` 은 보조 실행기(`agent_ops.py`·`codex_direct.py`·`gemini_research.py`)가 읽는 모델 설정이다 — 두 곳의 같은 모델 값은 일치시킨다. 첫 호출·설치 버전/환경 변경·복구 때 읽고 확인한 같은 계약은 재사용한다. 아래 명령은 사용자 Linux 호스트에서 실행한다. 문서·파일 생성은 호스트에서의 성공 증명이 아니다.

## 0. 기본 실행 표면 — Paseo (2026-11-09 사용자 지시로 herdr 에서 전환)

사용자가 Paseo 앱에서 직접 지켜볼 수 있도록 **외부 에이전트는 모두 Paseo 에이전트(총괄의 하위 에이전트)로 띄운다.** 대상은 Muse(OpenCode), Codex(Sol·Astra·Luna), Claude 작업자(Sonnet), Gemini(antigravity/agy)다(Gemini 는 2026-11-10 사용자 지시로 Paseo 에이전트 호출로 바꿨다. 메모리 주의는 아래). 총괄 Claude 는 Paseo 가 주입한 MCP 도구(`create_agent`·`send_agent_prompt` 등)로 발주한다. 헤드리스 `codex exec`·companion `--background`·`agy -p`·`opencode run`·`nohup`, Claude `Agent` 서브에이전트로 다른 모델 몫을 대신 돌리는 방식은 기본 경로가 아니다. Paseo 를 쓸 수 없을 때(Paseo MCP 도구 없음, daemon 장애)만 §2~§5의 기존 경로를 쓰고 그 이유를 작업 기록에 남긴다.

**권한 — 사용자 명시 승인(2026-10-26: "권한 차단당하지 말고", opencode 호출 포함).** 권한 질문이나 샌드박스 때문에 작업자가 멈추거나, 질문이 자동 거부돼 빈 결과로 끝나지 않도록 아래 모드로 시작한다. 모델은 항상 명시한다.

**에이전트 표 — 이 표가 유일한 정본이다**(2026-11-09 사용자 지시). Paseo 에이전트 프로필(`list_profiles`)은 쓰지 않는다 — 비어 있어도 정상이고, 생겨도 이 표가 우선한다. 에이전트 이름은 모든 저장소에서 같은 provider/model 을 가리키고 역할만 저장소마다 다르다. `create_agent` 에는 `provider`=`<provider>/<model>`, `settings.modeId`, `settings.thinkingOptionId` 로 그대로 옮겨 적는다.

| 에이전트 | `provider`(provider/model) | `modeId` | `thinkingOptionId` | 이 프로젝트의 역할 |
|---|---|---|---|---|
| Muse | `opencode/opencode-go/muse-spark-1.3-contributor` | `build` | (기본) | **주 구현**(우선 배정). 실제 ID 를 `muse_runtime_id` 와 대조한다. Muse 는 codex 로 띄울 수 없다 |
| Sol | `codex/gpt-6.1-sol` | `full-access` | `high` | 보조 구현(Muse 불가 시), 정식 검수 기본(Muse·Sonnet 구현분) |
| Sonnet | `claude/claude-sonnet-5-5` | `bypassPermissions` | (기본) | Claude 작업자 구현, Sol 구현분 정식 검수(대척점 교차) |
| Astra | `codex/gpt-6-astra` | `full-access` | `high` | `!계획!`·`!계획만!` 계획 기술 검토, 같은 지적 3회 수정 실패 시 추가 검토, 총괄(Claude) 부재 시 대리 총괄(2026-11-10 사용자 지시) |
| Gemini | `antigravity/gemini-4-argon-high` | `full-access` | — | 조사·원문 수집·시각 검토. Paseo `create_agent` 로 띄운다(2026-11-10 사용자 지시). 실제 한도 초과 확인 시 `antigravity/gemini-3.8-flash-high` 로 재호출, 그것도 한도 초과면 Luna. 작은 전용 작업 폴더만 작업 공간으로 준다(아래 메모리 주의) |
| Luna | `codex/gpt-6-luna` | `full-access` | `high` | Gemini 두 모델(argon·3.8 Flash) 모두 실제 한도 초과 시 조사 대체만. DART 원문·판정·검증물 열람 금지(2026-11-09 사용자 확인: Luna 최신은 `gpt-6-luna`) |

- 모드 대응: OpenCode `build`(호스트 `~/.config/opencode/opencode.jsonc` 의 edit·bash·webfetch allow)는 기존 `--auto`, Codex `full-access` 는 `--dangerously-bypass-approvals-and-sandbox`, Claude `bypassPermissions`·antigravity `full-access` 는 `--dangerously-skip-permissions` 와 같은 취지다.
- 총괄 자신은 사용자가 Paseo 앱에서 Fable(없으면 실제 확인한 Opus)로 띄운다. Claude 사용량이 다해 총괄이 없으면 대리 총괄은 표의 Astra 값으로 띄우고 작업서에 대리 총괄 역할을 적는다(2026-11-10 사용자 지시).
- 에이전트 제목은 `<에이전트>-<작업>`(예: `muse-<작업>`, `sol-review-<작업>`, `sonnet-review-<작업>`, `astra-plan-<작업>`)으로 해 구현 세션과 검수 세션을 구분한다.
- 권한 모드와 아래 「최대 허용」 범위를 따른다(2026-10-31). 남기는 금지는 아래 목록뿐이며 작업서와 사후 검사(`git status --short`, `find <경로> -newer <marker>`)로 지킨다.

**권한 범위 — 최대 허용(2026-10-31 사용자 지시 「권한은 최대한 허락하는 쪽으로 모두 맞추고」).** 위 모드로 띄운 작업자는 작업서의 일을 끝내는 데 필요한 명령을 질문 없이 실행한다.
- 허용: 자기 worktree·작업 브랜치의 파일 쓰기와 커밋(총괄 대리 커밋이 기본이 아니다), 네트워크, 작업 공간 안 패키지·도구 설치, docker·`sudo`, 운영 데이터·로그·컨테이너 상태 읽기, 시험용 일회용 서비스·컨테이너 기동과 정리, 작업서가 지정한 운영 단계(출고·재적재·스냅샷·기기 시험 등)의 실행.
- 남기는 금지(되돌릴 수 없거나 바깥에 영향이 가는 것만): 비밀값·토큰 출력·전송, 실주문·실결제·주문 API, 사용자 승인 없는 원격 push·출고·스토어 업로드, 운영 데이터 삭제·수동 수정(작업서가 지정한 운영 단계 제외), 다른 작업의 worktree 쓰기, 전역 설정(`~/.claude`·`~/.codex`·`~/.paseo`·셸 rc 등) 변경, 여러 에이전트가 함께 쓰는 공용 서비스(adb 서버·운영 Redis·Paseo daemon 등) 재시작.
- 지킨 여부는 작업서의 사후 검사(`git status --short`, `find <경로> -newer <marker>`, 운영 기록)로 확인한다.

### 절차

총괄 Claude 는 Paseo 에이전트로 실행 중이어야 한다(`PASEO_AGENT_ID` 가 있고 `mcp__paseo__*` 도구가 보임). 하나라도 어기면 소환하지 않는다: Paseo 도구 없음·대상 worktree 없음·모델 ID 불일치. 아니면 바깥에서 사용자의 Paseo 세션을 조작하지 말고 Paseo 안에서 Claude 를 다시 열어 달라고 요청한다. 도구 문법의 정본은 Paseo MCP 도구 설명과 `paseo --help` 다.

1. 작업 공간: 총괄이 작업 worktree 를 준비한 뒤 `create_workspace(isolation="local", path=<WT 절대경로>, title=<작업>)` 로 등록하고 `workspaceId` 를 받는다. 이미 등록된 경로는 `list_workspaces` 로 찾아 재사용한다. Paseo 관리 worktree(`isolation="worktree"`)로 브랜치를 만들지 않는다.
2. 기동: `create_agent(title="sol-<작업>", provider="codex/gpt-6.1-sol", settings={modeId:"full-access", thinkingOptionId:"high"}, workspaceId=<id>, initialPrompt="작업서 $WT/docs/jobs/todo/<파일>.md 를 읽고 수행하라. 결과는 $WT/<결과경로> 에 쓰고, 끝나면 그 경로와 한 줄 요약만 답하라.", notifyOnFinish=true)`. agentId 를 작업 기록·`.team/ledger.md` 에 남긴다.
3. 대기·완료: `notifyOnFinish` 알림(완료·오류·권한 요청)을 받는다. 짧은 폴링·`pgrep`·로그 grep 대기 루프를 만들지 않는다. 필요할 때 `get_agent_status`·`get_agent_activity`(셸에서는 `paseo wait`·`paseo logs`)로 본다.
4. 후속: 같은 작업의 후속은 같은 agentId 로 `send_agent_prompt` 해 세션을 잇는다. 다른 작업·다른 worktree 는 새 에이전트.

- 질문·멈춤: 권한 요청 알림이 오거나 입력 대기·질문에서 멈추면 `list_pending_permissions` 로 읽고, 작업서 범위 안이면 `respond_to_permission`·`send_agent_prompt` 로 답하고 밖이면 사용자에게 묻는다.
- 완료 판정: idle·완료 알림은 입력 대기일 뿐이다. 결과 파일·diff·검사 출력으로 확인한다. agy 는 내부 백그라운드 작업이 남아 있어도 idle 로 보일 수 있다. 응답이 늦다고 같은 프롬프트를 바로 다시 보내지 말고 상태부터 본다.
- 정리: 결과를 회수해 보고한 뒤 **자기가 만든 에이전트만** 곧바로 `archive_agent` 로 정리한다(2026-11-09 사용자 지시). 다른 에이전트·작업 공간·Paseo daemon 은 건드리지 않는다.
- 검수자 배정(2026-11-02): 정식 결과 검수는 Muse·Sonnet 구현분은 Sol, Sol 구현분은 Sonnet, `!계획!`·`!계획만!` 계획 검토와 같은 지적 3회 수정 실패 시 Astra 다(`PROJECT_RULES.md` 「검수자 배정」). 같은 모델이라도 구현·검수는 별도 에이전트다.
- 묶음 검수: Paseo 로 띄운 정식 검수는 `agent_ops.py dispatch-review`/`finish-review`(companion 잡 ID 기반)를 거치지 않는다. 검수 프롬프트에 정식 결과 JSON 경로를 지정하고, agentId·worktree·고정 후보·결과 경로를 `docs/jobs`에 기록한다. `agent_ops.py`의 Paseo 연동은 없다.

### Gemini(agy) 메모리 주의·빈 결과

- **Gemini 도 Paseo `create_agent` 로 띄운다(2026-11-10 사용자 지시).** Paseo 는 agy 를 직접 띄우므로 `systemd-run` 메모리 상한(`MemoryMax=8G`, `MemorySwapMax=0`)을 씌울 수 없다. 2026-10-13 OOM(agy 가 작업 폴더의 git 미추적 파일마다 diff 를 만들어 수십 GB 로 커짐)을 다시 내지 않도록 다음을 지킨다: 저장소 전체가 아니라 **필요한 범위의 작은 전용 폴더(전용 worktree)만 작업 공간으로 준다**, 운영 데이터 폴더(`artifacts/`)는 로컬 `.git/info/exclude` 로 미추적 목록에서 뺀다, 대용량 미추적 자료가 있는 폴더는 작업 공간으로 주지 않는다. 큰 미추적 자료를 피할 수 없는 조사만 §3 의 상한 셸 경로로 돌리고 그 이유를 기록한다.
- 호출 순서: `antigravity/gemini-4-argon-high` → 실제 한도 초과가 로그·상태로 확인되면 `antigravity/gemini-3.8-flash-high` 로 같은 작업을 다시 호출 → 그것도 한도 초과면 Luna. 한도 초과가 아닌 오류를 이 전환으로 처리하지 않는다.
- `--sandbox`(셸이 `connecting to sandbox server ... connection reset by peer`로 전부 실패)와 `--mode plan`은 쓰지 않는다.
- 기동 직후 꺼지거나 빈 결과면 `get_agent_activity`·agy 로그로 원인(인증·한도·모델 ID·신뢰 질문)을 확인하고, 고칠 수 있는 원인을 고친 뒤 같은 값으로 한 번만 다시 띄운다.

## 1. 실행 유형과 worktree

| 유형 | 모델·용도 | 실제 권한 |
|---|---|---|
| 조사/순수 원문 대조 | Gemini(argon, 한도 초과 시 3.8 Flash), 둘 다 한도 초과 시 조사 대체 Luna(`gpt-6-luna`), 순수 계획 판독 Astra | 원문 읽기·검색·허용 조사 스크립트. 제품 수정 없음. Luna의 DART 원문·판정·검증물 열람 금지 |
| 격리 검수 재현 | 정식 검수자(Reviewer) | 검수 worktree의 임시 빌드·테스트·보고 쓰기. 제품 원본·커밋·push·배포 금지 |
| 구현 | Muse(주) 또는 Sol(보조) | 승인된 자기 구현 worktree의 제품 수정·국소 검사·보존 커밋. Muse 우선 배정 |

쓰기 sandbox와 제품 구현 허가는 별개다. 검수에 필요한 쓰기를 막아 증거가 0개인 상태를 정상 검수로 만들지 않는다. 반대로 `--write`를 주고 ‘수정하지 마’라는 프롬프트만으로 운영·다른 worktree까지 보호됐다고 주장하지 않는다.

발주·상태·결과·취소의 cwd는 **해당 작업의 worktree**로 고정한다. 주 저장소로 무조건 복귀하지 않는다. `git rev-parse --show-toplevel`, `git worktree list --porcelain`, 대상 HEAD·dirty·소유 범위를 확인한다. 구현·검수는 별도 공간이고 검수 후보는 고정한다.

worktree를 사용할 때 실제 호스트의 trusted 프로젝트 설정, linked gitdir, 필요한 임시/의존성 캐시 쓰기 경로를 확인한다. 상위 프로젝트 신뢰가 하위 worktree에 자동 적용됐다고 가정하지 않는다. `.codex/config.toml` 같은 gitignored 설정은 확인된 필요한 사본만 전달한다. Paseo 작업자는 §0의 사용자 승인 모드로 실행한다. companion 대체 경로의 권한 오류는 실제 mount·설정·로그로 진단하며 전역 설정의 sandbox 해제·무제한 writable_roots로 고치지 않는다. 제품 원본·다른 worktree를 쓰기 가능 범위에 넣지 않는다.

필요한 의존성 준비는 지정 준비 담당이 실제 lock·설치 상태를 확인한 후 수행한다. 매 호출 무조건 재설치하지 않으며, 병렬 작업이 변경 가능한 node_modules·fixture를 공유하지 않는다. 준비 미완료를 테스트 통과로 바꾸지 않는다.

## 2. Codex — Paseo를 못 쓸 때: 공식 플러그인 companion 직접 호출

기본은 §0의 Paseo 에이전트(`codex/...`)다. 이 절은 Paseo를 쓸 수 없을 때의 대체 경로와 `agent_ops.py dispatch-review` 자동 발주용이다. 대체 경로에서는 기존 **공식 Claude용 Codex 플러그인**을 유지한다. `Agent(codex:codex-rescue)`를 거치는 LLM 포워더 대신 그 플러그인의 `scripts/codex-companion.mjs`를 직접 부른다. 별도 Codex API·`nohup codex exec`·다른 하네스로 바꾸지 않는다.

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

## 3. Gemini — argon 우선·한도 초과 시 3.8 Flash, 셸 허용, 결과 회수(Paseo 대체 경로는 상한 셸 `agy -p`)

기본은 §0 의 Paseo 에이전트다(2026-11-10 사용자 지시). 아래 상한 셸 경로(`agy -p`·`scripts/gemini_research.py`)는 Paseo 를 쓸 수 없거나 큰 미추적 자료를 피할 수 없는 조사에 쓰는 대체 경로다. 대체 경로에서도 셸이 필요한 조사는 `--dangerously-skip-permissions`를 붙인다(인쇄 모드의 권한 질문 자동 거부로 빈 출력이 되는 것을 막는다, 2026-10-26 사용자 승인).

Gemini 는 `gemini-4-argon-high`로 먼저 호출하고, 실제 한도 초과가 로그·상태로 확인되면 `gemini-3.8-flash-high`로 같은 작업을 다시 호출한다(2026-11-10 사용자 지시; 이력: 2026-10-30 argon 고정). 3.8 Flash 도 한도 초과면 Luna 로 대체한다. 값은 `docs/agent-ops-config.json`의 `models.gemini`·`models.gemini_on_quota_exceeded`이며 `scripts/gemini_research.py`는 `models.gemini`(argon)만 `--model`로 넘긴다(자동 전환 없음). 모델 ID는 `agy models`로 대조한다. 실제 사용 모델을 기록한다. `--mode plan`은 기본값으로 쓰지 않는다. 모델에 따라 `--effort`를 거부하므로 붙이지 않는다. 기존 agy·구독 연결을 유지한다. 구 gemini CLI나 별도 API 과금으로 조용히 바꾸지 않는다.

**상한 셸 경로에서는 메모리 상한 필수(2026-10-13 사고):** agy는 작업 폴더의 git 미추적 파일마다 diff를 만든다. 대용량 미추적 운영 데이터가 있는 폴더를 `--add-dir`로 주면 수십 GB까지 커져 시스템 전체 OOM이 나고 편집기·Claude 세션까지 죽는다. 항상 `systemd-run --user --scope --collect -p MemoryMax=8G -p MemorySwapMax=0`으로 감싸고, 저장소 전체 대신 필요한 범위의 작은 폴더를 준다. 운영 데이터 폴더(`artifacts/`)는 로컬 `.git/info/exclude`로 미추적 목록에서 뺀다.

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
- 수집 → 부족한 자료 재수집은 **외부의 명시적인 순차 단계**로 연결한다. 첫 agy 호출의 실제 결과를 저장하고 `agent_ops.py check` 결과를 읽은 후, 필요 항목과 기존 증거 경로를 다음 agy 호출에 전달한다. 인쇄 모드의 가상의 ‘다음 턴’에 의존하지 않는다.
- 결과가 완결됐는데 agy가 유휴 상태로 남는 경우는 실제 최종 산출물을 확인한 뒤 소유한 실행만 종료한다. 출력 0바이트·타임아웃·부분 출력은 미확인이다. 회수되지 않은 내부 배경 작업을 완료로 간주하지 않는다.

셸·git 읽기·검색·조사 스크립트는 허용한다. 과거 ‘셸 전면 금지’·특정 allowlist 개수·일괄 짧은 인자 제한은 폐기한다. 비밀값·실주문·운영 데이터/서비스 변경·다른 작업트리 변경 금지는 유지한다. 실제 환경 거부는 stderr·현재 설정·해당 대화 로그로 진단하고, 고칠 수 있는 원인을 고친 뒤 같은 Gemini 모델로 재실행한다. 한도 초과가 아닌 오류를 3.8 Flash·Luna 전환으로 처리하지 않는다.

## 4. 정식 검수 발주

`check`는 모델을 호출하지 않고 원문 범위 해시·테스트 영수증·소스 불변을 확인해 누적/보충/수리/검수 필요를 반환한다(요구사항 판정은 `not_assessed`). `boundary`는 영역 전환 또는 최종 단계에서 묶음을 닫는다. 검수할 때만 고정 후보의 별도 review worktree를 준비하고 `dispatch-review`를 실행한다. `--dispatch --review-worktree ...`를 주면 check가 검수 필요로 판정한 경우 같은 발주기를 호출한다. companion 대체 경로의 담당 모델은 `agent-ops-config.json`의 `models.review`(`gpt-6.1-sol`)다. Sol 구현분은 §0 의 Sonnet 검수 에이전트로 발주한다. 정식 검수 결과는 `finish-review`로 회수한다. 일반 단계에 Claude의 재승인을 끼워 넣지 않는다.

이 코드 설치는 전역 Stop hook·MCP·새 daemon을 설치하지 않는다. 구현 종료/영역 전환 단계가 해당 명령을 실제 호출해야 작동한다. 기존 플러그인의 자동 review gate가 켜져 있으면 건별 중복 검수가 발생할 수 있으므로 현재 설정을 확인해 이번 묶음 정책과 충돌하는지 기록한다. 관련 설정을 조용히 바꾸거나 CI 필수 검사와 혼동하지 않는다.

## 5. WorklazyTools 전용 — Muse / OpenCode

기본은 §0의 Paseo 에이전트(`opencode/opencode-go/muse-spark-1.3-contributor`, `build`)다. Paseo 에서는 같은 agentId 에 `send_agent_prompt` 를 보내 세션을 잇는다. 아래 `opencode run`은 Paseo를 쓸 수 없을 때의 대체 경로다.

Muse Spark 1.3은 Sol과 함께 정식 구현자이며 Muse 우선 배정이다. MyTradingDesk에는 이 실행기를 추가하지 않는다. Muse의 실제 provider/model ID는 호스트 `opencode models`에서 확인해 작업지시서와 `docs/agent-ops-config.json`의 `muse_runtime_id`에 기록한다. 표시 이름으로 ID를 추정하거나 Codex 명령의 모델 문자열만 바꾸지 않는다. 기존 OpenCode·구독 연결을 유지한다.

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

Paseo 작업자는 `notifyOnFinish` 완료 알림으로 기다린다(§0). 그 밖에도 가능하면 하네스가 완료를 통지하는 실행을 사용한다. 일회성 종료 대기에 만료되는 감시기만 의존하지 않는다. 완료 알림이 없는 별도 `nohup`만 띄워 놓고 대화를 끝내지 않는다. 대기 루프가 필요하면 별도 스크립트와 정확한 잡 ID/PID를 사용하고 `pgrep -f`·넓은 `pkill -f`로 자기 감시기·다른 잡을 잡지 않는다.

상태 문자열·로그 갱신·프로세스·실제 결과를 함께 확인한다. 단순 running·종료 알림·로그 정체만으로 성공을 판정하지 않는다. 실행기 종료·모델 답변·검수 통과·최종 승인·배포는 다르다. 제공 코드의 `completed`는 프로세스 terminal 상태이지 검수 통과가 아니다.

오류는 한도/인증/모델 부재/권한/도구/입력/불완전 결과로 나눈다. 수정 가능한 원인이 확인된 도구 실패만 한 번 재시도하며 동일 실패를 쌓지 않는다. 이 제한은 근거 있는 추가 반박 횟수와 다르다. 실패·모델 교체 시 기존 diff·staged/unstaged·필요한 새 파일·로그·완료 범위를 보존한다. reset·clean으로 지우지 않는다.

정상 질문에는 확인된 같은 세션을 안전하게 잇고, 죽은 잡은 종료·남은 작업을 확인한 뒤 새 잡에 인계한다. 발주/예약/결과를 잃은 경우 상태부터 복구하며 자동으로 동일 작업을 새로 띄우지 않는다. 실행 도구의 내부 스키마가 바뀌면 확인된 스키마로 작은 어댑터를 고치고, 가짜 모델/경로/옵션을 쓰지 않는다.

계획만 종료는 정본화·구현 대기다. 구현 단계 종료는 해당 단계의 필수 검사·차단 해소, 최종 단계는 남은 묶음 검수·최종 통합·승인된 배포 확인까지 구분한다. 문서·운영 도구 유지보수만으로 제품 배포를 시작하지 않는다.
