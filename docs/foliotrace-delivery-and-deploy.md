# FolioTrace 데이터 전달·키 규정·배포 워크플로 전환

작성 2026-10-25, 같은 날 사용자 결정으로 개정 · 계획 P3-2(키 규정)·P3-3(워크플로). 확정: D2 변경본(공개 데이터는 WorklazyTools에 직접 커밋하지 않고 **별도 비공개 저장소**에 둔다), D6(관문 통과 시 자동 공개), 옛 총액 이력은 이어받지 않고 새로 시작.

## 흐름
1. 로컬 오케스트레이터가 수집·판정·조립·평가·공개 관문을 끝내고, 관문을 통과한 JSON만 **`Fentanest/foliotrace-site-data`(비공개, main)** 의 `v1/manifest.json`·`v1/snapshots/<버전>.json`에 커밋·push한다(`deliver.py`, 데이터 저장소 전용 클론, `delivery.target_subpath = v1`). 구조 확정은 생산자(P2) 쪽 담당이며, 이 저장소의 워크플로는 `v1/manifest.json`과 `v1/snapshots/`가 없으면 중단한다.
2. WorklazyTools의 `.github/workflows/deploy-site.yml`이 읽기 전용 키로 데이터 저장소를 체크아웃해 `public/data/foliotrace/v1/`로 복사하고(저장소에는 이 경로를 커밋하지 않는다), 검증·빌드·테스트·배포만 한다. DART 호출·DART 키·상태 저장·가격 수집은 워크플로에 없다.
3. 화면 코드 push(main)는 데이터 저장소의 **그 시점 main**으로 배포되므로 로컬 장비가 꺼져 있어도 배포된다.
4. 데이터가 바뀌었다는 알림(repository_dispatch)은 아래 "갱신 알림 방식" 참조.

## 키 규정 (문서만 — 키 생성·등록·비밀값 설정은 사용자가 한다)
| 키 | 위치 | 권한 | 용도 |
|---|---|---|---|
| 쓰기 Deploy key (SSH) | 오케스트레이터 호스트 사용자 전용 파일(0600, `.ssh/` 아래 전용 이름), `delivery.ssh_key`에 경로만 기록. 공개 키는 **`foliotrace-site-data` 저장소**의 Deploy key(쓰기 허용)로 등록 | **데이터 저장소 전용 쓰기.** WorklazyTools 저장소에는 쓰기 키가 없다 | 로컬 전달 단계의 push 하나 |
| 읽기 Deploy key (SSH, 읽기 전용) | 개인키는 WorklazyTools 저장소 비밀값 **`FOLIOTRACE_SITE_DATA_READ_KEY`**, 공개 키는 `foliotrace-site-data`의 Deploy key(읽기 전용)로 등록 | 데이터 저장소 읽기만 | `deploy-site.yml` 체크아웃 |

- 쓰기 키 유출의 영향은 데이터 저장소 내용 변경으로 제한된다: WorklazyTools 코드는 바꿀 수 없고, 잘못된 데이터는 워크플로의 검증(계약·해시·크기·비공개 내용·평가 가능 행)이 배포 전에 막아 사이트는 이전 값을 유지한다. 단 검증을 통과하는 그럴듯한 값은 막지 못하므로 키 보관 규정을 지킨다.
- 경로 제한: `deliver.py`는 `target_subpath` 밖 변경이 스테이징되면 중단·되돌리고, 강제 push를 하지 않으며, 빨리감기가 아니면 멈춘다. 데이터 저장소의 main에는 force push·삭제 금지 보호를 걸 것을 권고한다(**사용자 권한·결정 사항**; 조회 시점 2026-10-25에는 WorklazyTools main에 보호·ruleset·Deploy key·저장소 변수·비밀값이 없었다).
- 읽기 키 비밀값은 `deploy-site.yml`의 체크아웃 단계에서만 쓰이고(`persist-credentials: false`), 비밀값이 없으면 빌드 앞 단계에서 실패해 배포하지 않는다. 포크 PR에는 비밀값이 전달되지 않는다.
- push 주체: 로컬 오케스트레이터 전달 단계 **하나**. 사람·다른 도구가 이 키로 push하지 않는다.
- 켜는 조건: `delivery.push_enabled=true`와 `--deliver-push`가 둘 다 있어야 하며, 처음 3일은 꺼 둔 채 `published/data`와 관문 결과를 눈으로 확인한 뒤 켠다.
- 회전: 두 키 모두 90일마다, 그리고 호스트 교체·유출 의심 즉시. 새 키 생성 → 데이터 저장소에 새 Deploy key 등록 → (읽기 키는 비밀값 교체) → 전달·배포 1회 성공 확인 → 옛 키 삭제.
- 유출 대응: 즉시 해당 Deploy key 삭제(쓰기 키: 전달만 멈추고 사이트는 마지막 값 유지; 읽기 키: 다음 배포부터 체크아웃 실패로 중단, 사이트는 마지막 값 유지) → 새 키 → 데이터 저장소 최근 커밋 점검.
- 서명자: 커밋 저자는 `delivery.commit_author`(고정 이름), 메시지 `FolioTrace data <날짜> <버전12자리>`.

## 갱신 알림 방식 (repository_dispatch `foliotrace-data-updated`)
워크플로는 이 이벤트로도 실행되도록 준비돼 있다(`FOLIOTRACE_DEPLOY_V2=true`일 때만 배포). 누가 보내느냐가 문제이며, repository_dispatch는 대상 저장소(WorklazyTools)에 **Contents 쓰기 권한 토큰**이 있어야 보낼 수 있다.

| 방식 | 장점 | 단점 |
|---|---|---|
| A. 데이터 저장소 쪽 워크플로(push 시 `gh api repos/Fentanest/WorklazyTools/dispatches`) | 로컬 호스트에 새 비밀값 없음, 전달 성공 즉시 알림 | 데이터 저장소 비밀값에 WorklazyTools Contents 쓰기 토큰(세분화 PAT)이 들어감 — 유출 시 WorklazyTools 코드 쓰기로 이어져 "쓰기 키는 데이터 저장소 전용" 원칙을 깸 |
| B. 로컬 오케스트레이터가 push 후 직접 `gh api` dispatch | 데이터 저장소에 워크플로 불필요 | 같은 토큰이 로컬 호스트에 상주(쓰기 키와 같은 위험 + 더 큼), 토큰 만료 관리 |
| C. WorklazyTools에서 주기 확인(예: 30분마다 `ls-remote`로 데이터 저장소 HEAD와 배포된 값의 출처 리비전을 비교, 다르면 배포) | 추가 쓰기 토큰 0, 원칙 유지 | 최대 지연 약 30분, 비교용 출처 리비전을 배포물에 싣는 작은 구현 필요(아직 없음), 빈 실행 소모 |

**권고: C** (일일 1회 갱신이라 지연이 문제 아니고, 쓰기 토큰을 만들지 않는다). C를 택하면 이 저장소에서 `schedule` 트리거와 리비전 비교 단계를 추가하는 후속 작업이 필요하다(사용자 승인 후). 즉시성이 꼭 필요하면 A를 세분화 PAT(WorklazyTools 단일 저장소, Contents 쓰기만, 만료 90일)로 하되 위험을 수용한다. 어느 쪽이든 알림이 없어도 다음 main push나 수동 실행 때 최신 데이터로 배포된다. 이 결정 전에는 이벤트를 보내는 쪽이 없다.

## 워크플로 전환 (P3-3)
새 `deploy-site.yml`을 추가했고 기존 `deploy-pages.yml`(cron·self-hosted `Ubuntu24-Git`·DART 수집)은 **아직 손대지 않았다**. 새 워크플로는 main push·repository_dispatch 때 저장소 변수 `FOLIOTRACE_DEPLOY_V2 == 'true'`일 때만 돈다(그전엔 건너뜀). 수동 실행은 항상 가능하고 기본값이 "검증만(Pages 미변경)"이다.

사전 준비(사용자): 데이터 저장소 생성, 두 Deploy key 등록, `FOLIOTRACE_SITE_DATA_READ_KEY` 비밀값 설정, (권고) 데이터 저장소 main 보호.
1. 코드·워크플로가 main에 들어간다. 비밀값·데이터가 아직 없으면 새 워크플로는 수동 실행 때 키 확인 또는 체크아웃/검증에서 실패한다 = 정상(배포 안 함). 옛 cron은 계속 사이트를 갱신한다(이 변경은 옛 검증기도 공개 개정 1 실데이터로 통과 확인).
2. 오케스트레이터 첫 전달로 데이터 저장소에 `v1/`이 생긴다.
3. `Deploy site`를 `validate_only=true`로 수동 실행해 키·체크아웃·검증·빌드·테스트 통과를 확인한다(GitHub 호스팅 러너).
4. 옛 워크플로를 비활성(`gh workflow disable "Deploy GitHub Pages"`)한 뒤 같은 워크플로를 `validate_only=false`로 수동 1회 실배포 → 사이트 값·날짜 확인.
5. 전환: 저장소 변수 `FOLIOTRACE_DEPLOY_V2=true`. 이후 main push마다(그리고 알림이 구성되면 그 이벤트로) 배포된다.
6. 안정 확인(예: 연속 정상 배포 3일) 뒤 P4: `deploy-pages.yml`·`foliotrace-*.yml`·`foliotrace-data` 브랜치 정리, `Ubuntu24-Git` 러너 해제(사용자 결정), DART 시크릿 삭제.

**되돌리기**: 변수를 지우거나 false로 하고 `gh workflow enable "Deploy GitHub Pages"` 후 수동 실행(옛 `foliotrace-data` 브랜치와 상태는 P4 전까지 보존).

**수동 실행 주의**: `workflow_dispatch` 실배포(`validate_only=false`)는 "최신 main" 가드를 일부러 우회한다(선택한 ref를 그대로 배포). 옛 워크플로가 비활성인지 확인하고, main이 아닌 ref로 실배포하지 않는다.

**안전 장치**: 비밀값 없음·체크아웃 실패·구조 불일치·검증 실패는 모두 빌드 단계에서 멈춰 사이트는 이전 배포를 유지한다. 배포 직전 `main`이 더 새로워졌으면 이 실행은 배포하지 않고(새 실행이 배포) 알림만 남긴다.

## 이력(총액 그래프) 새로 시작
옛 공개본의 `history`(8건)는 이어받지 않는다. 새 생산자는 첫 전달부터 새 이력을 쌓는다. 화면은 이미 "같은 방식으로 계산한 기록이 더 쌓이면 추이를 보여 드립니다"(기록 1건) / "같은 계산 기준의 실제 기록이 두 번 이상 쌓이면 표시합니다"(설명)를 쓰므로 별도의 "집계 기준 변경" 표기를 추가하지 않았다.

## 화면 쪽에서 끊은 것
새 워크플로는 `scripts/foliotrace/folio.py`·`pipeline/foliotrace/publish.py`·`nps_pipeline_adapter.py`를 호출하지 않는다(정적 요약 삽입은 `scripts/foliotrace-static-summary.mjs`로 대체). 파일 삭제와 시험 이전은 P4. `npm run test:foliotrace`는 옛 워크플로 전용으로 남고, 새 워크플로는 `tests/unit/foliotrace-*.test.ts`를 `test:unit`으로 돌린다.
