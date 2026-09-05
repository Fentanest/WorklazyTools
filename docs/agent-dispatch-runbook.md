# 에이전트 디스패치 런북 — Codex · Gemini(agy) · 이벤트 감시

> **누구를 위한 문서인가**: 이 저장소에서 오케스트레이터로 일하는 Claude 세션. 세션이 바뀌면 이 절차를 잊는다.
> **작업을 걸기 전에 이 문서를 먼저 읽어라.** 규칙 정본은 `PROJECT_RULES.md`, 역할은 `CLAUDE.md`.
>
> 원본은 `../mytradingdesk/docs/agent-dispatch-runbook.md`(2026-09-05, Fable 작성). 이 사본은 **worklazytools 경로·규칙 번호로 현지화**하고,
> 이 저장소에서 실제로 겪은 실패(§5)를 덧붙였다. 각 절의 「틀린 방식」은 전부 한 번씩 실제로 틀렸던 것이다.

---

## 0. 한 장 요약

| 하고 싶은 것 | 명령 | 절대 하지 말 것 |
|---|---|---|
| Codex 에 작업 걸기 | `Agent(subagent_type="codex:codex-rescue", prompt="--background --fresh <지시>")` | `nohup codex … &`, 포그라운드 `codex exec` |
| Codex 잡 상태·결과 | `node <companion> status\|result\|cancel <job-id>` | 서브에이전트 transcript 파일 tail |
| Codex 잡 끝났는지 알기 | **`Monitor`(persistent)** 로 **잡 디렉터리** 감시 → 종료마다 알림 | 개별 job ID 폴링, 알림 없이 기다리기 |
| Gemini 에 웹 조사 시키기 | `agy --effort high --print-timeout 50m --dangerously-skip-permissions --log-file …` | `gemini` CLI, `agy --mode plan` |
| 반박 라운드(읽기 전용) | 위 Codex 디스패치 + 지시서에 **기준 HEAD** 명시 | 라운드 도중에 커밋하기 |

- `<companion>` = `~/.claude/plugins/cache/openai-codex/codex/1.0.6/scripts/codex-companion.mjs`
- 이 저장소 workspace hash: **`worklazytools-94623798f26c92c2`**
- 잡 기록: `~/.claude/plugins/data/codex-openai-codex/state/worklazytools-94623798f26c92c2/jobs/task-XXXX.{json,log}`

---

## 1. Codex 디스패치

### 1-1. 올바른 형태

```
Agent(
  subagent_type = "codex:codex-rescue",
  description   = "P2 B4 묶음 착수",
  prompt        = "--background --fresh <한 문장 요약>. 지시 전문은 <절대경로>/b4-dispatch.md 에 있다 "
                  "(파일 수정이 필요한 구현 작업 | 읽기 전용 검증 라운드, 저장소 루트 /home/better0101/projects/worklazytools, "
                  "기준 HEAD <전체 해시>)"
)
```

- **`--background`**: 잡을 띄우고 즉시 돌아온다. `Codex Task started … as task-XXXX` 의 잡 ID 를 적어 둬라.
- **`--fresh`**: 새 스레드. 빼면 "이전 스레드 이어갈까요?" 를 **사용자에게 묻고 멈춘다.**
- **지시 전문은 파일로** 쓰고 **경로만** 넘긴다. 프롬프트에 본문을 통째로 넣으면 서브에이전트가 요약하다 왜곡한다.
  파일 위치: 세션 scratchpad. **저장소 안에 두지 않는다**(`docs/jobs/todo` 는 gitignore 라 예외).
- **지시서 첫 절은 항상 `PROJECT_RULES.md` 선독 지시**다. Codex 는 임포트 기제가 없다(`CLAUDE.md` 역할 절).
- 구현 작업이면 프롬프트에 **"파일 수정이 필요한 구현 작업이다"** 를 넣어라 — 그래야 서브에이전트가 `--write` 를 붙인다.

### 1-2. 상태 · 결과 · 취소

```bash
C=~/.claude/plugins/cache/openai-codex/codex/1.0.6/scripts/codex-companion.mjs
node $C status  task-XXXX      # running|completed|failed|cancelled, phase, pid
node $C result  task-XXXX      # 완료된 잡의 최종 보고 전문
node $C cancel  task-XXXX
```

- `.log` 의 마지막 몇 줄이 **지금 무엇을 하는지** 가장 빨리 알려준다.
- **잡 기록은 사라질 수 있다.** `result` 가 "No job found" 면 레코드 소실이다 — `git log`·산출물 디렉터리로 확인하라(§5-1).

### 1-3. 잡이 끝났는지 아는 법 — 이벤트 감시기

**틀린 방식**: 개별 job ID 를 `while … sleep 600` 으로 폴링. 잡마다 감시기를 새로 걸어야 하고, 상태 문자열만 믿으면 죽은 잡을 못 본다.

**맞는 방식**: `Monitor`(persistent) 로 **잡 디렉터리 전체**를 30초마다 훑어 **종료 상태마다 한 줄씩** 낸다. 잡을 새로 걸어도 감시기를 다시 만들 필요 없다.

```bash
JD=~/.claude/plugins/data/codex-openai-codex/state/worklazytools-94623798f26c92c2/jobs
declare -A seen
while true; do
  for f in "$JD"/*.json; do
    [ -f "$f" ] || continue
    line=$(python3 -c "
import json,os,sys
try: d=json.load(open('$f'))
except Exception: sys.exit()
jid=d.get('id'); st=d.get('status'); ph=d.get('phase'); pid=d.get('pid')
summ=(d.get('summary') or '').replace(chr(10),' ')[:60]
if st=='running':
    if pid:
        try: os.kill(int(pid),0)
        except Exception: print(f'DEAD {jid} 상태={st}/{ph} 프로세스 없음 | {summ}')
    else:
        print(f'NOPID {jid} 상태={st}/{ph} pid 없음 | {summ}')
else:
    print(f'{str(st).upper()} {jid} {ph} | {summ}')
" 2>/dev/null)
    [ -z "$line" ] && continue
    key="$(echo "$line" | awk '{print $2}'):$(echo "$line" | awk '{print $1}')"
    if [ -z "${seen[$key]}" ]; then seen[$key]=1; echo "[$(date +%H:%M:%S)] $line"; fi
  done
  sleep 30
done
```

**왜 `DEAD` 를 따로 내는가**: 상태 파일은 `running` 인데 프로세스가 없는 경우가 실제로 있다. 그걸 안 보면 영원히 기다린다.
**`pgrep -f <잡ID>` 로 프로세스를 찾지 마라** — 감시기 자신의 명령줄에 잡 ID 가 들어 있어 **자기 자신을 찾아 "살아 있다"고 읽는다**. `kill -0 <pid>` 를 써라.

이벤트가 오면 **즉시** `result` 를 읽고 다음 라운드를 건다.

### 1-4. 잡이 죽었을 때

1. `node $C cancel <잡ID>` 로 상태 파일 정리.
2. **작업물이 살아 있는지 먼저 본다**: `git status --porcelain | wc -l`, `git diff --stat`.
3. `git diff > <scratchpad>/xxx-inflight.diff` 로 스냅샷을 남긴다.
4. **`--resume` 을 쓰지 마라** — 죽은 잡의 resume 은 즉시 실패한다.
5. `--fresh` 로 다시 걸되 지시서에 **"`git diff` 를 읽고 이미 된 것을 자체 감사한 뒤 이어서 하라"** 를 넣는다.

### 1-5. 반박 라운드(읽기 전용)의 기준 해시 게이트

- 지시서에 **기준 HEAD 전체 해시**를 박는다(「실행 게이트」 규칙).
- **라운드가 도는 동안 커밋하지 마라.** 지금 도는 라운드가 중단된다.
- 읽기 전용 라운드는 **병렬 가능**(같은 기준 해시). 구현 잡은 커밋을 만들므로 **혼자** 돈다.
- 저장소 추적 파일(`CHANGELOG.md`·`docs/review-notes.md`)을 라운드 도중에 고치면 Codex 의 무변경 확인이 헷갈린다.
  **라운드가 끝난 뒤 고쳐라.** `docs/jobs/todo/*.md` 는 gitignore 라 도중에 고쳐도 되지만 **그 라운드가 읽는 계획서는 고치지 마라.**

### 1-6. 모델 (2026-09-05 갱신)

`~/.codex/models_cache.json` 실측 목록:

| slug | 비고 |
|---|---|
| **`gpt-6-astra`** | **최상위 모델. 사용자 지시로 이 저장소의 기본 선택**(2026-09-05) |
| `gpt-5.6-sol` | 이전 기본 |
| `gpt-5.6-terra` · `gpt-5.6-luna` | 균형 · 경량 |
| `gpt-5.5` · `gpt-5.4-mini` | 이전 세대 |
| `gpt-5.3-codex-spark`(별칭 `spark`) | 경량 코딩 |
| `gpt-reserve` · `gpt-daybreak-blue-latest` · `codex-auto-review` | 특수 |

- **원본 런북의 "`gpt-6*` 는 400 으로 거부된다"는 낡았다** — 2026-09-05 22:21 캐시 갱신으로 `gpt-6-astra` 가 등록됐다.
- 지정 방법: 디스패치 프롬프트에 `--model gpt-6-astra`. 기본은 미지정이지만 **이 저장소는 사용자 지시로 astra 를 명시**한다.
- 없는 모델을 요청받으면 **불가 사유와 실측 목록을 함께 보고**하고 기본값으로 진행한다.

---

## 2. Gemini(agy) — 조사 · 시각 검수 담당 (「부하 분산과 대체 경로」 규칙)

### 2-1. 올바른 형태

```bash
SP=<scratchpad>
agy --effort high --print-timeout 50m --dangerously-skip-permissions \
    --add-dir /home/better0101/projects/worklazytools \
    --model gemini-3.1-pro-high \
    --log-file $SP/gemini-xxx.log \
    -p "$(cat $SP/gemini-xxx-prompt.md)" \
    > $SP/gemini-xxx-out.md 2> $SP/gemini-xxx-err.log
```

- 명령은 **`agy`**(`~/.local/bin/agy`, Antigravity CLI). 구 `gemini` CLI 는 `IneligibleTierError` 로 죽는다 — **한도 초과가 아니라 클라이언트가 바뀐 것**이다.
- **`--add-dir` 필수.** 빼면 저장소가 워크스페이스에 안 잡혀 "파일이 존재하지 않습니다"가 온다(`CLAUDE.md` 호스트 참고).
- **`--mode plan` 을 붙이지 마라.** 읽기 전용 모드가 명령 실행을 soft-deny 해 **0바이트**로 끝난다.
- **`--print-timeout` 은 Go duration**(`50m`·`10m30s`). 숫자만 주면 "missing unit" 으로 즉사한다. 기본 5분이라 조사는 반드시 상향.
- **`--effort high`**: 조사·검수 품질을 올린다(원본 런북 권장 — 이 저장소도 채택).
- **`--log-file`**: 실패 시 `grep soft-denying <log>` 로 진단.

### 2-2. 프롬프트에 반드시 넣는 것

- **저장소 파일 생성·수정·삭제 금지**, 임시 파일은 `/tmp` 에만.
- **`package.json`·`package-lock.json` 변경 금지, 저장소에서 `npm install`·`npm i`·`npm ci` 실행 금지.**
  도구가 필요하면 `npx` 일회 실행 또는 `/tmp` 에 별도 프로젝트(§5-2 — 이 저장소에서 실제로 오염됐다).
- **공식 URL · 확인일**을 요구하라. 근거 없는 답은 무게 0 이다.
- **출력 스키마**를 표 열 이름까지 지정하라. 자유 서술은 검증이 안 된다.
- 시각 검수는 **먼저 `ls` 로 총 장수·상태 구성을 확인**하게 하고 **전수 열람**을 요구하라.
- 막힌 문제를 넘길 때는 **증거 번들**(시도 내역·측정 결과·계약 원문)을 붙여라.

### 2-3. 산출물은 단서다 (「Gemini 산출물은 단서다」 규칙)

- 수치·경로·해시는 **실측 검증 전에 계획·코드에 넣지 않는다.**
- 이 저장소 실례(§5-3): Gemini 가 "라이트 accent 톤다운 필요"로 진단했으나, shadcn `--primary` 는 이미 흰 텍스트와 8.09:1 이라
  **전환만으로 해소되는 문제**였다. 권고대로 했으면 과교정이었다. 실측이 판정을 뒤집었다.
- **검색 결과를 버리지 마라.** 틀린 것 같아도 단서로 저장하고 검증하라.

### 2-4. 감시

`agy` 는 포그라운드 명령이므로 Bash `run_in_background` 로 걸면 **끝날 때 알림이 온다.** 별도 감시기 불필요.
산출물이 0바이트면 `err.log` 에 `jetski: no output produced — a tool required the "command" permission` 이 있는지 본다 →
`--dangerously-skip-permissions` 로 재실행. **0바이트를 "못 찾았다"로 읽지 마라 — 도구 거부다.**

---

## 3. 세션이 죽었다 살아났을 때

1. `git log --oneline -5` · `git status --porcelain | wc -l` — 커밋됐는가, 작업트리에 남았는가.
2. 이 저장소는 배포가 **`main` push → GitHub Actions Pages** 다. `git log origin/main` 과 라이브를 대조한다.
3. Codex 잡 디렉터리는 비어 있을 수 있다. scratchpad 의 지시서·진행 기록이 "남은 마무리"를 말해 준다.
4. 감시기(`Monitor`)는 세션과 함께 죽는다. **다시 걸어라.**
5. 사용자에게 **무엇이 어디까지 갔는지 표로** 보고한 뒤 이어서 한다.

---

## 4. 보고 습관

- **변화가 있을 때 보고한다** — 커밋·오류·완료·결정 필요. "돌고 있습니다"만 반복하지 않는다.
- 비개발자가 읽는다. 라벨(`B5a`·`P-final`)만 던지지 말고 **그 자리에서 내용을 한 줄로** 붙인다.
- 측정과 추정을 나눈다. 산식을 보인다.
- **안 된다고만 하지 않는다** — 이유와 대안을 함께.

---

## 5. 이 저장소에서 겪은 실패 (2026-09-05)

### 5-1. Codex 잡이 "완료" 로 보고되는데 산출물이 0 — **2회**

- **B6 1차**(`task-mtnvm1uy`): `completed / Duration 56m` 인데 커밋 없음·캡처 없음·**로그 파일 자체 부재**.
- **P-final 1차**(`task-mtoa08ot`): 40분간 `running/verifying` 인데 **저장소 파일 변경 0·빌드 흔적 0**, 이후 레코드 소실.
- **판정법(빠른 순)**: ① 잡 `.log` 파일이 존재하고 **크기가 자라는가** ② `git status`·산출물 디렉터리에 흔적이 있는가 ③ `status` 가 "No job found" 인가.
- **두 번 다 앞선 태스크가 끝난 직후 디스패치**했다. 디스패치 후 5분 시점에 로그 생성을 확인하는 습관을 둔다.
- 완료 알림을 받으면 **결과 요약을 읽기 전에 산출물로 먼저 확인**한다. 이걸 안 하면 존재하지 않는 캡처를 검수시키고 한 사이클을 더 버린다.

### 5-2. Gemini 가 저장소에 의존성을 설치했다

접근성 감사 위임 프롬프트에 "저장소 파일 수정 금지"를 명시했는데도 `npm i -D` 로 `@axe-core/playwright`·`playwright` 가 devDependencies 에 추가되고 lock 에 54줄이 붙었다.
**"파일 수정 금지"가 npm install 을 막지 못한다** — §2-2 의 npm 금지 문구를 반드시 넣고, 위임 결과 수거 시 `git status --porcelain` 으로 오염을 확인한다.
(이 건은 되돌리지 않고 Codex 판단으로 정식 채택했다 — 접근성 재측정이 배포 게이트라 도구가 저장소에 있는 편이 재현에 일관적이다. `npm run test:a11y` 로 고정.)

### 5-3. 검수·조사 결과를 그대로 믿으면 안 된다

- **검수 입력 결함**: B1 1차 검수에서 "전 도구 모바일 하단 가림" 차단 결함 10건이 왔으나, 캡처 세트에 **하단 상태가 0장**이라 판정이 성립 불가였다. 결함이 아니라 하네스 버그였다. → **차단 결함이 오면 고치기 전에 검수 입력이 그 판정을 뒷받침하는지 본다.**
- **오탐**: 토글 썸 이탈 지적은 DOM 실측 60샘플에서 이탈 0px·중심 오차 0px 로 오탐 확정.
- **원인 오진**: B6 "도구 모음 잘림" 은 증상이고 원인은 **가로 배치가 세로로 붕괴**한 것이었다. 원인을 단정하지 않고 두 가설을 제시해 판정을 지시한 것이 맞았다.
- **처방 오류**: §2-3 의 accent 톤다운 건. 진단은 맞고 처방이 틀렸다.

### 5-4. 계획 왕복이 값을 한다

U4 계획에서 **Claude 판단 9건이 뒤집혔다**(Codex 반박 2회에서 6건, Gemini 제3자 검토에서 3건) — 폰트 분기 무의미·취소 계약 이미 존재·기존 화면 수정안이 규칙 위반·단계 순서 오류·암호 fixture 에 도구 불필요·용량 논거 부정확·기능 조용한 축소 자리·SEO 표면 손실·좌표 오류 원인.
**하나라도 그대로 구현에 들어갔으면 되돌리는 비용이 훨씬 컸다.**
