# FolioTrace 데이터 전달·키 규정·배포 워크플로 전환

작성 2026-10-25, 같은 날 사용자 결정으로 개정 · 계획 P3-2(키 규정)·P3-3(워크플로). 확정: D2 변경본(공개 데이터는 WorklazyTools에 직접 커밋하지 않고 **별도 비공개 저장소**에 둔다), D6(관문 통과 시 자동 공개), 옛 총액 이력은 이어받지 않고 새로 시작.

## 흐름
1. 로컬 오케스트레이터가 수집·판정·조립·평가·공개 관문을 끝내고, 관문을 통과한 JSON만 **`Fentanest/foliotrace-site-data`(비공개, main)** 의 `v1/manifest.json`·`v1/snapshots/<버전>.json`에 커밋·push한다(`deliver.py`, 데이터 저장소 전용 클론, `delivery.target_subpath = v1`). 구조 확정은 생산자(P2) 쪽 담당이며, 이 저장소의 워크플로는 `v1/manifest.json`과 `v1/snapshots/`가 없으면 중단한다.
2. WorklazyTools의 `.github/workflows/deploy-site.yml`이 읽기 전용 키로 데이터 저장소를 체크아웃해 `public/data/foliotrace/v1/`로 복사하고(저장소에는 이 경로를 커밋하지 않는다), 검증·빌드·테스트·배포만 한다. DART 호출·DART 키·상태 저장·가격 수집은 워크플로에 없다.
3. 화면 코드 push(main)는 데이터 저장소의 **그 시점 main**으로 배포되므로 로컬 장비가 꺼져 있어도 배포된다.
4. 데이터 저장소 push가 끝나면 오케스트레이터가 같은 단계에서 이 워크플로를 `workflow_dispatch`(mode=deploy, data_revision=방금 push한 커밋)로 시작한다(아래 "배포 시작 방식"). FolioTrace 수집 관문은 유지한다. 이 호출과 별도로 사이트는 아래 일일 예약으로 이미 공개된 데이터를 다시 읽는다(repository_dispatch는 쓰지 않는다).

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

## 배포 시작 방식 (2026-10-25 dispatch + 2026-10-28 독립 일일 예약)
- 시작 호출(전달 단계 마지막, 데이터 저장소 push 성공 후):
  `gh api -X POST repos/Fentanest/WorklazyTools/actions/workflows/deploy-site.yml/dispatches -f ref=main -f 'inputs[mode]=deploy' -f 'inputs[data_revision]=<방금 push한 커밋 40자리>'`
  (생산자 P2의 전달 단계가 이 호출을 구현했다(P2 55a9eba). 이 저장소는 받는 쪽이다.)
- 워크플로 입력: `mode` = `validate`(기본, Pages 미변경) | `deploy`(명시적 실배포), `data_revision`(선택). `data_revision`이 오면 빌드가 체크아웃한 데이터 저장소 HEAD와 비교해 같으면 그대로, 다르면 알림을 남기고 **HEAD(더 최신 데이터)로 진행**한다(`scripts/foliotrace-source-meta.mjs compare`).
- 게이트 `FOLIOTRACE_DEPLOY_V2`: **main push와 일일 예약 자동 배포에** 적용한다(전환 전에는 두 실행 모두 건너뛰어짐). dispatch는 사람이나 오케스트레이터가 명시적으로 부르는 것이므로 게이트하지 않는다. 따라서 전환 4단계(옛 워크플로 비활성)가 끝나기 전에는 오케스트레이터가 mode=deploy를 부르지 않게 한다(오케스트레이터 설정으로 dispatch를 꺼 둔 채 시작).
- 출처 리비전 표지(`/data/foliotrace-source.json`)는 추적용으로 유지한다(빌드가 체크아웃한 데이터 저장소 커밋과 datasetVersion; 계약 폴더 밖).
- 알림이 누락되거나 FolioTrace 수집이 중단돼도 다음 일일 예약·main push·수동 dispatch 때 이미 공개된 각 데이터 HEAD를 읽는다.

### 독립 일일 예약 (market-calendar 배포 공백 수리)

- `.github/workflows/deploy-site.yml`의 `0 22 * * *`는 매일 **07:00 KST(전날 22:00 UTC)**다. 06:00 calendar 시작 후 한 시간 여유를 두며, FolioTrace 전달 완료 여부와 무관하게 실행된다. 수집·판정·공개 관문을 우회하지 않고 이미 발행된 데이터만 읽는다.
- 예약은 기본 브랜치 main의 코드·워크플로를 빌드한다. `market-calendar-data`는 별도 체크아웃으로 읽으므로 데이터 전용 브랜치의 코드를 실행하지 않는다. main push에서 이미 허용한 코드와 동일한 검증·빌드·시험을 거친 **전체 사이트 재배포**다. calendar 파일만 교체하는 방식은 아니다.
- `FOLIOTRACE_DEPLOY_V2 == 'true'`일 때만 자동 빌드·배포한다. 기존 명시 dispatch의 게이트 예외와 mode=validate/deploy 의미는 유지한다. 예약 표시 이름은 `Site deploy (daily data refresh)`다.
- 기존 `pages` 그룹(`cancel-in-progress: false`)으로 오케스트레이터 호출과 동시 배포를 막는다. 예약 빌드 중 main이 바뀌면 최신 main 검사로 낡은 빌드를 배포하지 않는다. 새 secret·토큰·publisher의 Actions 권한은 필요하지 않다.
- 선택 이유: 데이터 branch push 트리거는 기본 event ref 체크아웃과 main 가드를 추가로 바꿔야 하고, publisher dispatch는 별도 Actions 토큰 권한·재시도·중복 처리 연결을 늘린다. 예약은 기존 기본 main 실행 경로를 그대로 재사용한다.
- 한계: GitHub 예약은 정시 실행·복구를 보장하지 않는다. calendar가 07:00 이후 끝나면 다음 예약 또는 기존 수동 dispatch가 필요하다. 데이터 변경 없는 날에도 재배포할 수 있다. 기존 calendar fallback 때문에 workflow 성공만으로 신선도 회복을 판단하지 않고, 실제 공개 manifest의 generation·scope.last_checked_at 및 파일 해시를 확인한다. 러너 정지·FolioTrace 공개 데이터 검증 실패는 여전히 배포를 막는다.
- 국소 검사: `python3 -m unittest discover -s tests/market_calendar -p test_deploy_schedule.py -v` (설치된 PyYAML 사용). workflow YAML 파싱과 예약·게이트·dispatch 모드·최신 main·동시성·calendar 체크아웃을 오프라인으로 대조한다. GitHub 실행을 뜻하지 않는다.

### 시작용 토큰
| 항목 | 규정 |
|---|---|
| 종류 | GitHub **세분화(fine-grained) 개인 액세스 토큰** |
| 대상 | `Fentanest/WorklazyTools` **한 저장소만** |
| 권한 | **Actions: 읽기·쓰기만**(워크플로 dispatch에 필요). Contents·Pull requests·Secrets·Variables 등 **코드 쓰기·비밀값 권한 없음** |
| 보관 | 오케스트레이터 호스트 `~/.config/foliotrace/keys/worklazytools-dispatch-token`(0600, 디렉터리 0700). 저장소·로그·백업 목록·문서에 값 금지. 설정에는 경로만 기록 |
| 만료 | 발급일로부터 **1년** |
| 갱신 | 만료 2주 전(달력에 표시)에 새 토큰 발급(같은 대상·권한) → 파일 교체 → dispatch 1회 성공(mode=validate로 시험) 확인 → 옛 토큰 삭제. 호스트 교체·유출 의심 시 즉시 삭제 후 재발급 |
| 사용 주체 | 로컬 오케스트레이터 전달 단계 하나(사람·다른 도구는 쓰지 않음) |
| 유출 시 영향 | 코드는 바꿀 수 없다. 다만 Actions 쓰기로 이 저장소의 `workflow_dispatch` 워크플로를 실행·취소할 수 있다. 보호: `deploy-site.yml`은 검증 통과 데이터만 배포하고 DART 키를 쓰지 않는다. 옛 `deploy-pages.yml`(DART_API_KEY 사용, Pages 배포)은 2026-10-25 사용자 결정으로 삭제됐다. 현재 dispatch 가능한 워크플로는 `deploy-site.yml`과 `product-banner-tests.yml` 둘뿐이다.** 옛 FolioTrace 수집·백필 워크플로(`foliotrace-*.yml`)는 origin/main에서 이미 삭제됐다 |

## 워크플로 전환 (P3-3)
새 `deploy-site.yml`로 전환했고 기존 `deploy-pages.yml`(cron·self-hosted `Ubuntu24-Git`·DART 수집)은 2026-10-25 사용자 결정으로 **삭제됐다**(이하 전환 절차는 이력). 새 워크플로는 main push 때 저장소 변수 `FOLIOTRACE_DEPLOY_V2 == 'true'`일 때만 돈다(그전엔 건너뜀). dispatch는 항상 가능하고 기본값이 `mode=validate`(Pages 미변경)이다.

사전 준비(사용자): 데이터 저장소 생성, 두 Deploy key 등록, `FOLIOTRACE_SITE_DATA_READ_KEY` 비밀값 설정, 시작용 세분화 토큰 발급·호스트 보관, (권고) 데이터 저장소 main 보호.
1. 코드·워크플로가 main에 들어간다. 비밀값·데이터가 아직 없으면 새 워크플로는 수동 실행 때 키 확인 또는 체크아웃/검증에서 실패한다 = 정상(배포 안 함). 옛 cron은 계속 사이트를 갱신한다(이 변경은 옛 검증기도 공개 개정 1 실데이터로 통과 확인).
2. 오케스트레이터 첫 전달로 데이터 저장소에 `v1/`이 생긴다.
3. `Deploy site`를 `mode=validate`로 수동 실행해 키·체크아웃·검증·빌드·테스트 통과를 확인한다(기본 `Ubuntu24-Git`, 장애 시 수동 `runner=github-hosted`).
4. (이력: 옛 워크플로 비활성 단계는 `deploy-pages.yml` 삭제(2026-10-25)로 불필요해졌다.) `deploy-site.yml`을 `mode=deploy`로 수동 1회 실배포 → 사이트 값·날짜 확인.
5. 전환: 저장소 변수 `FOLIOTRACE_DEPLOY_V2=true`(main push 자동 배포 켬), 시작용 토큰을 호스트에 두고 오케스트레이터 dispatch를 켠다. 이후 main push·일일 예약·오케스트레이터의 dispatch(mode=deploy)로 배포된다.
6. 안정 확인(예: 연속 정상 배포 3일) 뒤 P4: 옛 서버 수집 코드(`pipeline/foliotrace/`·`scripts/foliotrace/`·`tests/foliotrace/`)는 2026-10-26 삭제됐다(수집·판독·평가·게시는 별도 저장소 `foliotrace-pipeline`로 이동). 저장소 소유자가 직접 해야 할 일: `foliotrace-data` 브랜치 삭제와 Actions 시크릿 `DART_API_KEY` 삭제(Claude는 삭제하지 않음). `Ubuntu24-Git` 러너는 해제하지 않고 아래 규정으로 계속 쓴다.

**되돌리기**: 옛 `deploy-pages.yml` 삭제(2026-10-25)로 옛 워크플로 재활성 경로는 없다. 문제가 생기면 변수를 지우거나 false로 해 main push·일일 예약 자동 배포를 끄고 `deploy-site.yml`을 `mode=validate`로 확인한다(옛 `foliotrace-data` 브랜치는 소유자 삭제 전까지 남아 있으나 사이트는 쓰지 않는다).

**수동 실행 주의**: `workflow_dispatch` 실배포(`mode=deploy`)는 "최신 main" 가드를 일부러 우회한다(선택한 ref를 그대로 배포). 옛 워크플로가 비활성인지 확인하고, main이 아닌 ref로 실배포하지 않는다.

**안전 장치**: 비밀값 없음·체크아웃 실패·구조 불일치·검증 실패는 모두 빌드 단계에서 멈춰 사이트는 이전 배포를 유지한다. main push·일일 예약 실행은 배포 직전 `main`이 더 새로워졌으면 배포하지 않고(새 실행이 배포) 알림만 남긴다.

## 이력(총액 그래프) 새로 시작
옛 공개본의 `history`(8건)는 이어받지 않는다. 새 생산자는 첫 전달부터 새 이력을 쌓는다. 화면은 이미 "같은 방식으로 계산한 기록이 더 쌓이면 추이를 보여 드립니다"(기록 1건) / "같은 계산 기준의 실제 기록이 두 번 이상 쌓이면 표시합니다"(설명)를 쓰므로 별도의 "집계 기준 변경" 표기를 추가하지 않았다.

## 화면 쪽에서 끊은 것
옛 수집 파이프라인(`scripts/foliotrace/folio.py`, `pipeline/foliotrace/*`)과 파이썬 시험(`tests/foliotrace`, `npm run test:foliotrace`)은 2026-10-26 P4로 이 저장소에서 삭제했고 `foliotrace-pipeline` 저장소로 옮겼다. 사이트는 공개 JSON만 읽으며 정적 요약 삽입은 `scripts/foliotrace-static-summary.mjs`가 한다. 새 워크플로는 `tests/unit/foliotrace-*.test.ts`를 `test:unit`으로 돌린다.

## 러너 규정 (사용자 결정 2026-10-25)
- `deploy-site.yml`의 build·deploy 두 잡과 `product-banner-tests.yml`은 자체 러너 `Ubuntu24-Git`(라벨 self-hosted, Linux, X64, 235)에서 돈다. 수동 실행의 `runner=github-hosted` 입력은 이 장비가 꺼졌을 때의 우회로이며 두 잡이 같은 선택을 따른다(오케스트레이터는 mode/data_revision만 보내 기본값을 쓴다).
- 공개 저장소이므로 포크 PR 보호의 실제 경계는 저장소 설정 "Require approval for all external contributors"(approval_policy=all_external_contributors, 2026-10-25 설정)이며 반드시 유지한다. `product-banner-tests.yml`의 head 저장소 비교 식(포크면 ubuntu-latest)은 편의 장치일 뿐 보안 경계가 아니다(포크 PR은 수정한 워크플로 파일을 실행한다). 승인자는 포크 PR의 `.github/workflows` 변경을 읽고 나서 승인한다. `Ubuntu24-Git`은 비밀번호 없는 sudo가 있어 포크 PR 승인 = 그 코드를 이 장비에서 root로 실행하는 것이다. `deploy-site.yml`에는 pull_request 트리거를 추가하지 않는다.
- 읽기 키는 `persist-credentials: false`인 actions/checkout이 첫 fetch 직후 키·known_hosts·sshCommand 설정을 지우고 post 단계에서 다시 지운다. `if: always()` 단계는 `RUNNER_TEMP`에 한정한 세 번째 안전장치다. 매 실행 시작에 이전 실행 잔재(`foliotrace-site-data`, `public/data/foliotrace`, `dist` 등)를 지운다. 배포 잡의 최신 main 확인은 gh CLI 대신 토큰 없는 `git ls-remote`를 쓴다(Ubuntu24-Git의 gh는 미확인).
- 아티팩트는 `retention-days: 1`, 저장소 설정의 보존 기간도 1일이다.
- 위험: 러너가 꺼져 있으면 배포가 대기열에 머문다(우회: `runner=github-hosted`). 러너가 하나라 `pages` 동시성 그룹과 함께 순차 실행된다.
