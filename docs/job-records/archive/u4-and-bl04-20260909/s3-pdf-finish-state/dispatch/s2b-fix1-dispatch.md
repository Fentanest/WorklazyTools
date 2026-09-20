# 수정 지시서 — S2b 검수 소견 F1·F2 반영 (2026-09-07, Claude → Codex **gpt-5.6-sol**)

## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md`(브랜치 버전) → 정본 `docs/jobs/todo/qr-font-20260906.md`(「v3 확정」·「정본화 보강」) → **astra 검수 보고 `/tmp/worklazy-s2b-review/REPORT.md` 전문**(F1·F2 정의·재현 명령·「수정 인계」 절·비차단 문구 권고) → 자신의 구현 보고 `/tmp/worklazy-s2b/REPORT.md`.

## 1. 성격·기준
- **파일 수정이 필요한 구현 작업(쓰기 모드).** 브랜치 `s2b-qr-font`(HEAD `93a2318`) 위에 커밋 추가. **main 병합·push 금지.** 착수 시 `git branch --show-current` = `s2b-qr-font`, `git rev-parse HEAD` = `93a2318…`, `git rev-parse main` = `f29d249…` 확인, 다르면 중단·보고. untracked 사용자 파일 3개 금지 사항 동일.
- 동시에 U4 9차 반박(읽기 전용 실험, pdf-editor 표면)이 돌 수 있다 — QR 표면만 건드리므로 무관.

## 2. 수정 범위(검수 보고 「수정 인계」 그대로 — 새 정책 판단 금지)
- **F1** `tests/unit/qr-label-font.test.ts:164` 근방: export 토큰 검사가 **정적 문자열 패턴**이라 `finishExport` 의 소유권 가드(`if (!owned) return` 류) 제거 변조를 잡지 못함(검수 `mutation-check.py` 재현). → **실제 `QrBulkPanel` export lease 동작을 실행하는 회귀 테스트**로 교체/추가: 공용 토큰 점유·비소유 finally 무시·cancel/run 폐기/cleanup 무효화·storageRef 선행 분리·busy 비활성을 **함수 실행으로** 단언(검수 보고의 `lifecycle-probe.cjs`·3차 `runtime-probe.mjs` 24 실험 방식 참고 — 제품 함수 본문을 실제로 호출). 가드 제거 변조(mutation) 시 실패함을 확인해 보고에 원문 포함.
- **F2** `tests/qr-bulk-smoke.mjs:120`·`tests/qr-font-scenarios.mjs:62`: 브라우저 단언 누락 — ① **폰트 OTF 404 주입 시 `location.reload` 0회·`worklazy_tool_reload` 가드 키 0**(S0 청크 재시도 예산 불변) + 대조로 실제 lazy 청크 404 는 reload 1 ② **export 취소**(PDF 진행 중 결과 정리/취소 → stale 다운로드 0·`exporting` 상태 해제) 브라우저 단언. scenario server 에 `font404` 주입 분기 추가(정확한 OTF 경로만, page.route 금지). 기존 3 scenario 보존.
- 비차단 권고: review-notes 의 "모든 font request" → "QR 라벨 OTF 요청" 으로 구체화, 생성 입력 원자성 문구를 "파일별 replace" 로 정정.

## 3. 검증(실행·출력 기록)
`npm run test:unit`(mutation 음성 포함) · `npm run test:qr-bulk`(3 scenario + font404 + 취소 단언) · `npx tsc -b` · `npm run test:static` · `git diff --check` · 변경 범위에 해당하는 `npm run test:utilities`. unit 수·검증 범위가 바뀌므로 `CHANGELOG.md` 기존 S2b 항목 한 구절 보강(항목 신설 금지)·`docs/review-notes.md` S2b 절 끝에 "검수 소견 반영" 소절(F1·F2·mutation 결과) 추가, 서명 Codx. `dist/` 는 `VITE_LOCAL_QA=1` 빌드 유지(변경 없으면 재빌드 불필요 — 테스트 전용 변경이면 명시).

## 4. 정지점·보고
커밋 후 브랜치 상태로 정지(재검수는 astra). 보고: 착수 게이트 · F1/F2 변경 파일:라인 · mutation 음성 원문 · 브라우저 단언 원문 · 검증표 · `git status --porcelain`·`git log --oneline main..s2b-qr-font`. 산출물 `/tmp/worklazy-s2b-fix1/`.

## 5. 금지
main 커밋·병합·push · 제품 코드 동작 변경(검수는 구현 [일치] 판정 — 테스트·기록만; 테스트 작성 중 실제 결함을 발견하면 고치지 말고 「범위 밖 발견」으로 보고) · page.route/fetch mock · 계획서 편집 · 사용자 파일 조작.
