# 지시서 — S2b 구현 **4차 검수** (2026-09-07, Claude → Codex **gpt-6-astra**)

## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md`(브랜치 버전 — 「모델 역할 분담」 검수 항: **지시서·정본 대비 누락·왜곡·검증 미실행을 재현 명령으로 증거와 함께 판정**) → 정본 `docs/jobs/todo/qr-font-20260906.md`(「v3 확정」+「정본화 보강」) → sol 지시서 `/tmp/claude-1000/-home-better0101-projects-worklazytools/f5cf1bca-6bf0-442b-b9d4-e7cb45f9c96d/scratchpad/s2b-impl-dispatch.md` → sol 보고 `/tmp/worklazy-s2b/REPORT.md` + `logs/` → 브랜치 diff `git diff main..s2b-qr-font` → 자신의 1~3차 반박 산출물(`/tmp/worklazy-s2b-r1..r3`).

## 1. 성격·기준
- **검수 잡(쓰기 모드 실험)** — 저장소 파일 수정·커밋·push·`dist` 변경·저장소 안 npm/pip 설치 절대 금지. 산출물은 `/tmp/worklazy-s2b-review4/` 에만. **브랜치를 바꾸지 마라**(현재 `s2b-qr-font` 체크아웃, HEAD = 현재 브랜치 최신(`git rev-parse HEAD`, 93a2318 + sol 수정 커밋 3개)). 시작·종료 `git status --porcelain`·`git rev-parse HEAD main` 으로 불변 증명(untracked 사용자 파일 3개만).
- 동시에 U4 8차 반박(읽기 전용 실험)이 pdf-editor 표면을 읽는다 — 무관.

## 2. 검수 항목(전부 재현 명령 실행 — 보고서 기록값을 믿지 말 것)
**4차 검수 우선 항목(3차 검수 `/tmp/worklazy-s2b-review3/REPORT.md` F2-R + sol fix-3 보고 `/tmp/worklazy-s2b-fix3/REPORT.md`)**: (00) F2-R — `npm run test:qr-bulk` 를 **연속 2회** 실제 실행해 exit 0 인지(원본 3차에서 2회 exit 1 이었던 `:218` 단언 포함), 대기가 상태 조건(`waitForFunction`)이고 고정 sleep 이 아닌지, 기존 단언 삭제 0. (0) F1-R — 새 unit 이 다운로드 직전 task 양보 경계를 실제 handler 로 단언하고, 양보 제거 mutation(`final-task-mutation.py`) 에서 **실패**하는지; review-notes 에 Claude 문단이 원문대로 추가됐는지(내용 변경 0). 이하 이전 항목:: (a) F1 — 새 unit 이 제품 handler 를 실제 실행하는지, `finishExport` 소유권 가드 제거 mutation 에서 **실패**하는지(1차 `mutation-check.py` 재실행) (b) F2 — 브라우저 스모크에 폰트 OTF 404→full 1회·reload 0·S0 retry key 0·(대조) 청크 404 reload 1·export 취소 stale 0 단언이 실제 HTTP 경계에서 실행되는지 (c) 기존 3 scenario 보존 (d) 제품 코드 동작 변경 0(`git diff 93a2318..HEAD -- src/` 가 있으면 사유 판정) (e) CHANGELOG/review-notes 보강. 이하 1차 항목은 변경된 파일 범위만 재실행하되 unit·qr-bulk·tsc·static 은 전체 실행.

1. **정본 대비 누락·왜곡**: 「v3 확정」 D1~D6 + R2-1·R2-2 + 「정본화 보강」의 "복사 금지 3곳"(busy 비활성·storageRef 선행 분리·optional signal)·스모크 3 scenario·계측 `--scenario`·고정 산출 SHA 7행·`OFFICE_EDITOR_ASSETS.md` 역할별 해시표·backlog 2건 — 항목별 구현 위치(파일:라인)와 [일치]/[누락]/[왜곡].
2. **고정 자산 byte 검증**: `scripts/assets/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/` 5파일 + 목록의 size·SHA-256 을 정본 표와 대조(`sha256sum`). 전체 OTF·OFL 불변. `public/vendor/.../ksx1001-v1/` 은 vendor 산출인지(추적 여부·.gitignore 항목 확인 — 브랜치가 `.gitignore` 에 1줄 추가함: 그 항목이 무엇이고 정당한지 판정).
3. **검증 재실행(핵심 — 시간이 걸려도 실행)**: `npm run test:unit` · `npm run test:qr-bulk`(3 scenario 로그에서 subset/full/corrupt 각 폰트 SHA 단언 확인) · `npm run test:static` · `npx tsc -b` · `node tests/tool-registry-routes.mjs` · `npm run css:orphans` · `git diff --check` · `npm run measure:qr -- --scenario=subset` 1회(PDF 단계 전송량이 보고값 1,450,793B 와 ±5% 내인지) · 렌더 회귀 스크립트 1회(3 fixture Poppler 픽셀 0). 시각 회귀·a11y·recovery·browser 전체는 sol 로그(`/tmp/worklazy-s2b/logs/`)의 **명령·exit·캡처 수·타임스탬프**를 검사해 실제 실행됐는지 판정(재실행은 선택).
4. **clean checkout 공급**: `git worktree add /tmp/worklazy-s2b-review4/wt s2b-qr-font` → `npm run vendor:qr-font` 2회 SHA 동일 · Python/network 없이 subset 공급되는지(`PATH` 에서 python3 제거·fetch 차단 환경) · worktree 제거.
5. **제품 규칙**: 사용자 문구 변화 0(`git diff main..s2b-qr-font -- src/locales`) · 격리 영향 0 · `QR_LABEL_FONT_PATH` 의미·전체 OTF 경로/바이트 불변 · 내부 명칭 비노출(폴백 조용히) · 새 런타임/개발 의존 0(`package.json` 변경은 script 1줄만인지).
6. **번들 5종**: `/tmp/worklazy-s2b/bundle-final.json` 의 baseline·delta 재계산, coverage JSON 이 QR route 에 포함됐는지.
7. **범위 밖 변경**: diff 에 정본·지시서에 없는 변경(`.gitignore`·backlog 문안 등)이 있으면 열거·판정.
8. **sol 보고서 주장 대조**: 보고서의 수치(전송량·gzip·픽셀·unit 수)와 로그 원문 일치 여부.

## 3. 판정 형식
| 항목 | 판정([통과]/[결함]/[미검증]) | 재현 명령·출력 | 수정 필요 시 지시 문안 | · 결함은 심각도(차단/보통/경미). 마지막에 **[검수 통과] / [수정 후 재검수]** 선언. 산출물 `/tmp/worklazy-s2b-review4/REPORT.md`.

## 4. 금지
저장소 변경 일체 · 브랜치 전환 · 계획서 편집 · 사용자 파일 3개 조작 · 보고서 기록값을 재현 없이 "통과"로 옮기기.
