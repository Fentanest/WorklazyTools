# 에이전트 운영 도구 — 설치·Jev 실호출·묶음 검수

## 적용과 전제

프로젝트 루트에 ZIP 내용을 그대로 합쳐 덮어쓴다. 제품 코드·기존 의존성·배포 스크립트·전역 설정·API 키는 포함하지 않는다. Python 3.10+·git이 필요하며 Codex 발주에는 기존 Node·공식 Claude용 Codex 플러그인이 필요하다. Python 추가 패키지는 설치하지 않는다.

사용자는 Linux 터미널에 `TYPESAFE_API_KEY`를 이미 export했다. **그 터미널에서 시작한 Claude/Gemini/실행기**가 값을 상속받아야 한다. 이미 떠 있는 다른 프로세스에 나중에 한 export가 전달됐다고 가정하지 않는다. 키를 이 문서·작업 JSON·명령 인자·로그·Git에 적거나 값을 출력하지 않는다.

```bash
python3 -m unittest discover -s tests/agent_ops -v
python3 scripts/agent_ops.py doctor --live
python3 scripts/codex_direct.py doctor
```

`doctor --live`는 합성 코드 한 조각으로 **실제 Jev API**를 호출한다. 저장소 소스는 보내지 않는다. 성공하면 실제 응답 모델·사용 토큰을 보여주고 키는 보여주지 않는다. 일반 doctor·단위 테스트만 통과한 것은 실제 계정 인증 성공이 아니다. Codex doctor는 설치 계약 확인이며 유료 Codex 잡을 발주하지 않는다.

## 어떤 파일이 실제로 실행되는가

| 파일 | 기능 |
|---|---|
| `scripts/jev_client.py` | 공식 REST 요청·응답 검증, 환경변수 인증, 비밀값 추가 검사, 오류 시 fail-unverified |
| `scripts/agent_ops.py` | 원문 추출·계획 해시·테스트 영수증·Jev 대조·누적 상태·조건 판정·묶음 검수 발주/회수 |
| `scripts/codex_direct.py` | 설치된 companion 직접 실행·실제 모델/cwd/sandbox 확인·발주 예약·중복 방지 |
| `scripts/gemini_research.py` | Gemini 3.1 Pro 명시·셸 허용·전경 실행·결과/오류 영속 보관 |
| `docs/agent-ops-config.json` | 모델 매핑, 5개/800줄 초기 상한, 고위험 경로·줄 수 제외 목록 |

프로그램은 Jev에 수정 명령 생성·배포 승인·모델 선택을 맡기지 않는다. shell 문자열을 eval하지 않는다. 자동 Stop hook·daemon은 설치하지 않는다. 모델이 작업 종료/영역 전환 때 아래 명령을 호출하는 방식으로 기존 협업에 연결한다.

## 1. 조사와 입력표

정본 계획에 있는 요구사항을 Gemini가 작은 항목으로 나누고, 각 항목에 실제 코드 범위와 관련 검사 입력을 연결한다. `docs/agent-ops-examples/task.example.json`을 형식으로 사용하되 경로·SHA·완료 기준은 실제 값으로 채운다. 샘플을 통과 증거로 사용하지 않는다. 승인 계획 파일의 SHA는 셸에서 계산할 수 있으며 비밀 파일을 읽지 않는다.

```bash
python3 scripts/gemini_research.py --prompt-file "$PROMPT_FILE" --task-id "$TASK_ID"
```

입력 JSON은 기존 gitignored `docs/jobs/todo`에 둔다. `approved_plan`은 승인 원문의 정확한 범위·파일 해시다. `requirements`에는 원문에서 도출된 완료 기준과 실제 파일 범위를 넣는다. 구현자의 ‘완료했다’ 보고만 증거로 쓰지 않는다. 요구사항 전체 포함 여부도 Jev에 묻는다. `area`는 같은 묶음에서 유지하는 기능 식별값이며 모델/폴더 이름이 아니다.

`tests[].input_paths`는 검사에 관계된 코드·테스트·설정·fixture·의존성 계약을 포함한다. 프로그램은 입력 목록 자체의 완전성을 증명하지 못하므로 Gemini/구현자와 정식 검수자가 의존 관계를 확인해야 한다. 검사 실행기·기대값·필터 변경도 목록에서 누락하지 않는다.

## 2. 국소 검사와 1차 대조

```bash
python3 scripts/agent_ops.py run-test --task "$TASK_JSON" --id unit-search --kind unit -- \
  python3 -m unittest tests.test_search
python3 scripts/agent_ops.py check --task "$TASK_JSON"
```

위 단위 검사 명령은 예시다. 실제 프로젝트 진입점은 verification-guide.md와 후보 소스에서 확인한다. `--kind unit/browser`는 실행 로그에서 실제 양수 테스트 건수를 확인하며, 현재 파서는 unittest·pytest/Playwright·Node TAP·Go JSON·Rust cargo·Vitest의 지원되는 요약 형식을 해석한다. 알 수 없는 출력/0건은 통과시키지 않는다. build/static은 실제 종료 코드·입력 불변·로그 존재로 기록하고 테스트 수행으로 표시하지 않는다. 기존 검사 출력을 지원하려면 파서를 근거 있게 확장하고 도구 단위 테스트를 먼저 추가한다.

영수증·키 없는 원장·예약은 `<git-common-dir>/agent-ops`에 저장된다. HEAD가 같아도 실제 입력 바이트가 달라지면 검사가 무효다. 반대로 같은 바이트를 보존 커밋으로 저장했다는 이유만으로 무효화하지 않는다. 검사 환경·외부 입력 변화가 있는 결과는 목록 해시만 보고 재사용하지 않는다.

`check`는 실제 HTTP 호출을 사용한다. 입력 과대·응답 불일치·키 부재·인증/한도/네트워크 실패에는 전체를 통과시키지 않는다. 긴 입력은 조용히 잘라 보내지 않고 범위를 나눌 대상으로 반환한다. 로컬 요청 크기 제한 48KiB는 제공자 token limit을 정확히 계산한 값이 아니라 보수적인 전송 한도다.

Jev의 출력은 `continue_accumulating`, `collect_evidence`, `repair_or_run_required_tests`, `review_required`로 주변 코드가 연결한다. 근거 부족에는 지정 원문만 보충하고 다시 check한다. 명확한 누락은 해당 구현 항목만 확인한다. 같은 오류로 끝없는 조사·검수 재호출을 하지 않는다. confidence/확률의 기본 0.80은 분류 보류용 초기값이지 80% 실측 정확도 보증이 아니다.

## 3. 영역 전환·검수 시점

```bash
python3 scripts/agent_ops.py boundary --batch "$BATCH" --event area \
  --next-description "다음 승인 작업의 기능·입출력·의존 관계"
python3 scripts/agent_ops.py boundary --batch "$BATCH" --event final
python3 scripts/agent_ops.py status
```

5개/800줄과 고위험 경로·최종 단계는 일반 코드가 적용한다. 영역의 의미상 연결은 Jev 분류를 참고한다. 미확인 범위는 누적 허가로 만들지 않는다. 명백한 generated/vendor는 줄 수에서만 제외하고, 불확실한 포맷 전용 변경은 포함한다. 고위험 경로 목록은 보수적 신호이지 모든 고위험 변경을 완전하게 찾아내는 보증이 아니다. 실제 공유 계약·주문·금액·파일/데이터·권한 영향은 추가로 표시한다.

## 4. 후보 고정과 정식 검수

검수 필요 시 보존용 커밋으로 후보를 고정하고, 그 커밋을 별도의 검수 worktree에서 checkout한다. 자동 발주기가 작업트리를 무단 checkout·reset하거나 환경 설정을 고치지 않도록 이 준비는 지정 담당이 수행한다. 필요한 의존성·규칙·접근 범위도 준비한다. 생성 예시:

```bash
git worktree add --detach "$REVIEW_WORKTREE" "$CANDIDATE_COMMIT"
python3 scripts/agent_ops.py dispatch-review --batch "$BATCH" \
  --review-worktree "$REVIEW_WORKTREE"
```

실행기는 후보 HEAD·dirty·같은 저장소 여부를 확인하고, 필요한 승인 요구사항·1차 결과·테스트 로그를 검수 공간에 복사한 뒤 companion을 한 번 호출한다. 전체 요구사항·누적 diff를 검수하게 하며 Jev 의심 부분만 주지 않는다. 준비된 검수 공간이 있을 때 `check --dispatch --review-worktree ...`로 판정부터 발주까지 연결할 수 있다.

```bash
python3 scripts/codex_direct.py result "$JOB"
python3 scripts/agent_ops.py finish-review --batch "$BATCH" --job "$JOB"
```

정식 결과 JSON은 자동 생성한 프롬프트에 지정된 경로에 Astra가 쓴다. 필수 필드·후보·검수 키·근거·차단·필수 누락을 확인하고, 검수 중 원본 소스/HEAD가 달라졌으면 통과를 적용하지 않는다. `finish-review`는 해당 묶음의 기술 검수 상태만 갱신하며 **Claude 최종 승인·배포 권한을 생성하지 않는다.**

A+B 검수 중 C가 추가되면 A+B만 통과로 기록하고 C는 남긴다. 동일 소스·요구사항·묶음은 중복 발주하지 않는다. 발주 응답 유실·예약 중단·취소 실패는 자동 만료/재실행하지 않으며 native 상태·실제 프로세스·기존 diff를 먼저 대조한다. 제출 후 복구에는 원장을 백업하고 확인한 기존 잡을 연결하거나, 실제 미발주/종료가 확인된 예약만 정정한다. 미확정 예약을 지워 무조건 새 잡을 띄우는 명령은 제공하지 않는다.

## 5. 일반 Codex 구현·순수 조사 호출

`docs/agent-ops-examples/dispatch.example.json`의 필드를 실제 승인 작업으로 채운다. 역할과 실행 유형을 따로 지정한다. `implementation`은 구현 허가·linked worktree, `verification`은 격리 검수 worktree가 필요하다. `research` 역할의 Luna는 `fallback_reason=gemini_quota_exceeded`와 실제 실패 증거 참조가 있어야 한다.

```bash
python3 scripts/codex_direct.py --repo "$WORKTREE" dispatch --request "$REQUEST_JSON"
```

새 잡 발주와 초기 실행값 검증까지만 수행하며, 실제 장기 작업의 완료는 기존 하네스의 완료 알림·상태/결과 회수로 관리한다. 사용자에게 나중에 이 ChatGPT가 알아서 전달한다고 약속하는 기능은 아니다.

## 적용 범위·검증 한계

이 패키지는 실제 Jev HTTP 코드와 실제 companion 호출 경로를 제공한다. 오프라인 모의 테스트가 실제 API 인증·모델의 코드 판단 정확도·사용자 호스트의 plugin/agy 권한·처리 속도를 증명하지는 않는다. API 응답 구조는 공식 Python SDK의 OpenAPI 생성 모델·전송 코드를 확인했다. 실제 키는 사용자 프로세스 환경에서 사용하며 ChatGPT에 복사할 필요가 없다.

운영 효과는 잘못 통과한 요구사항·조기/늦은 검수·작업당 상위 모델 사용량·재작업으로 측정한다. 신규 high-risk 검수·기존 CI·실계좌·배포 보호는 유지한다. 처음에는 정식 묶음 검수에서 1차 판정의 오류를 함께 기록하고 임계값을 근거 있게 조정한다.

공식 근거(2026-09-22 확인):
- https://github.com/typesafe-ai/typesafe-sdk-python/blob/main/README.md
- https://github.com/typesafe-ai/typesafe-sdk-python/blob/main/src/typesafe_sdk/_core/endpoints.py
- https://github.com/typesafe-ai/typesafe-sdk-python/blob/main/src/typesafe_sdk/_core/transport.py
- https://github.com/typesafe-ai/typesafe-sdk-python/blob/main/src/typesafe_sdk/_schemas/models.py
- https://github.com/openai/codex-plugin-cc/blob/main/plugins/codex/agents/codex-rescue.md
- https://github.com/openai/codex-plugin-cc/blob/main/plugins/codex/scripts/codex-companion.mjs
