# FolioTrace 데이터 전달·배포 키·배포 워크플로 전환

작성 2026-10-25 · 계획 P3-2(키 규정)·P3-3(워크플로). 확정: D2(데이터 경로 직접 커밋), D6(관문 통과 시 자동 공개).

## 흐름
로컬 오케스트레이터가 수집·판정·조립·평가·공개 관문을 끝낸 뒤 관문을 통과한 JSON만 `public/data/foliotrace/v1/`에 커밋해 `main`에 push한다(`deliver.py`, 전용 클론). 그 push가 `.github/workflows/deploy-site.yml`을 실행하고, 워크플로는 데이터를 **검증·빌드·배포만** 한다. DART 호출·DART 키·상태 저장·가격 수집은 워크플로에 없다. 로컬 장비가 꺼져 있어도 화면 코드 push는 마지막으로 전달된 데이터로 배포된다.

## 배포 키 규정 (P3-2 — 문서만, 키 생성·등록은 하지 않음)
| 항목 | 규정 |
|---|---|
| 종류 | 이 저장소 전용 GitHub **Deploy key**(SSH, 쓰기 허용). 개인 토큰·사용자 SSH 키·다른 저장소와 공유 금지 |
| 권한 범위 | 저장소 전용 쓰기(키 자체는 경로를 제한하지 못한다). 경로 제한은 **푸시 주체의 코드**가 강제한다: `deliver.py`는 `public/data/foliotrace/v1/` 밖 변경이 스테이징되면 중단·되돌리고, 강제 push를 하지 않으며, 빨리감기가 아니면 멈춘다 |
| 보호 | main 브랜치 보호에서 이 키가 통과할 수 있어야 하므로, 보호 규칙은 "force push 금지·삭제 금지"를 유지하고 필수 검사는 배포 워크플로 안에서 한다(데이터가 잘못되면 build 단계 검증이 배포를 막고 사이트는 이전 값 유지) |
| 보관 | 오케스트레이터 호스트의 사용자 전용 파일(권한 0600, 홈 `.ssh/` 아래 전용 이름). 저장소·로그·백업 목록·이 문서에 키 내용 금지. `delivery.ssh_key`에 경로만 기록 |
| push 주체 | 로컬 오케스트레이터의 전달 단계 **하나**. 사람·다른 도구가 이 키로 push하지 않는다 |
| 켜는 조건 | `delivery.push_enabled=true`와 `--deliver-push`가 둘 다 있어야 하며, 처음 3일은 꺼 둔 채 `published/data`와 관문 결과를 눈으로 확인한 뒤 켠다 |
| 회전 | 90일마다, 그리고 호스트 교체·유출 의심 즉시: 새 키 생성 → GitHub에 새 Deploy key 등록 → `delivery.ssh_key` 교체 → 전달 1회 성공 확인 → 옛 키 삭제. 옛 키 삭제 전까지 두 키가 공존 |
| 유출 대응 | 즉시 Deploy key 삭제(전달만 멈추고 사이트는 마지막 값 유지) → 새 키 → 최근 전달 커밋 내용 점검 |
| 서명자 | 커밋 저자는 `delivery.commit_author`(고정 이름). 데이터 커밋 메시지는 `FolioTrace data <날짜> <버전12자리>` |

## 워크플로 전환 (P3-3)
새 파일 `deploy-site.yml`을 추가했고 기존 `deploy-pages.yml`(cron·self-hosted `Ubuntu24-Git`·DART 수집)은 **아직 손대지 않았다**. 새 워크플로는 main push 때 저장소 변수 `FOLIOTRACE_DEPLOY_V2 == 'true'`일 때만 돈다(그전엔 push 실행이 건너뛰어짐). 수동 실행은 항상 가능하고 기본값이 "검증만(Pages 미변경)"이다.

1. (이 브랜치 통합) 코드·워크플로가 main에 들어간다. 이 시점에 `public/data/foliotrace/v1/`가 없으면 새 워크플로는 검증 단계에서 실패한다 = 정상(배포 안 함). 옛 cron은 계속 사이트를 갱신한다.
2. 오케스트레이터 첫 전달(또는 사람이 검증된 스냅샷을 같은 경로에 커밋)로 데이터 경로가 생긴다.
3. Actions에서 `Deploy site`를 `validate_only=true`로 수동 실행해 build·검증·테스트 통과를 확인한다(GitHub 호스팅 러너).
4. 한 번 실제 배포로 확인: 같은 워크플로를 `validate_only=false`로 수동 실행 → 사이트 값·날짜 확인. 이때 옛 cron이 같은 날 더 최신 데이터를 올리지 않도록 직전에 옛 워크플로를 비활성(`gh workflow disable "Deploy GitHub Pages"`)한다.
5. 전환: 저장소 변수 `FOLIOTRACE_DEPLOY_V2=true` 설정. 이후 main push마다 새 워크플로가 배포한다. 옛 워크플로는 비활성 상태로 둔다.
6. 안정 확인(예: 연속 정상 배포 3일) 뒤 P4: `deploy-pages.yml`·`foliotrace-*.yml`(수집·백필 워크플로)·`foliotrace-data` 브랜치 정리, `Ubuntu24-Git` 러너 해제(사용자 결정), DART 시크릿 삭제.

**되돌리기**: 변수를 지우거나 false로 하고 `gh workflow enable "Deploy GitHub Pages"` 후 수동 실행하면 옛 경로가 복구된다(`foliotrace-data` 브랜치와 상태는 P4 전까지 보존).

**안전 장치**: 새 데이터가 검증(계약·해시·크기·비공개 내용·평가 가능 행)에 실패하면 빌드 단계에서 멈춰 사이트는 이전 배포를 유지한다. 배포 직전 `main`이 더 새로워졌으면 이 실행은 배포하지 않고(새 실행이 배포) 알림만 남긴다.

## 화면 쪽에서 끊은 것
새 워크플로는 `scripts/foliotrace/folio.py`·`pipeline/foliotrace/publish.py`·`nps_pipeline_adapter.py`를 호출하지 않는다(정적 요약 삽입은 `scripts/foliotrace-static-summary.mjs`로 대체). 파일 삭제와 시험 이전은 P4(옛 워크플로가 비활성화·퇴역된 뒤)에서 한다. `npm run test:foliotrace`(옛 파이프라인 시험)는 옛 워크플로 전용으로 남고, 새 워크플로는 `tests/unit/foliotrace-*.test.ts`(계약·검증기·화면)를 `test:unit`으로 돌린다.
