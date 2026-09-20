# 수정 지시서 — U4-2 fix-1 (2026-09-07, Claude → Codex **gpt-5.6-sol**)

## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md` → **astra 검수 보고 `/tmp/worklazy-u4-2-review/REPORT.md`(F1 절 + 수정 지시 1~4) + 재현 `probes/lifecycle.mjs`·`logs/lifecycle.log`·`terminal-races.jsonl`** → 정본 `docs/jobs/todo/pdf-finish-20260905.md` v5 V3-4(중복 terminal·늦은 result 무시·terminate 1회)·확정 2 → 원 지시서 `<scratchpad>/u4-2-dispatch.md`(`<scratchpad>` = `/tmp/claude-1000/-home-better0101-projects-worklazytools/f5cf1bca-6bf0-442b-b9d4-e7cb45f9c96d/scratchpad`).

## 1. 성격·기준
- **파일 수정이 필요한 구현 작업(쓰기 모드).** 브랜치 `s3-pdf-finish` HEAD `47c0f2286887111e3573d5efaec0af57165d7d0d` 위에 커밋. **main 병합·push 금지.** 커밋 금지 제약 없음 — 커밋은 완료 기준.
- 변경 범위: `src/features/pdf-editor/pdfWorkerLifecycle.ts`(PDF 소유 facade) · `tests/unit/pdf-lifecycle.test.ts` · 기록. **공용 `src/utils/workerLifecycle.ts`·Excel client·기존 4모드 UI 무수정**(diff 0 단언). **astra 재현 스크립트는 수정하지 않는다** — 원본 그대로 실행해 49/49 를 증명하고, 경로 조정이 필요하면 별도 드라이버.

## 2. 수정 항목(F1 · P2)
- 결함: `pdfWorkerLifecycle.ts:88–96` 무조건 `captureError(data.error)`, `:83–85` 종료 시 입력 미차단, `:54–67` rejection handler 가 변경 가능한 외부 변수 `envelopeError` 를 읽음 → 같은 턴에 abort/첫 error/error-event/post-throw 뒤 늦은 error 가 오면 확정된 오류가 `LATE/LATE_CODE` 로 바뀜.
- 수정(astra 문안 채택): ① 공용 helper 가 호출하는 `terminate()` 에서 adapter 종료 상태를 **먼저 확정**하고 이후 원 Worker message/error callback 의 외부 상태 갱신·전달을 **차단**(`envelopeError ??=` 만으로는 abort/error-event/post-throw 뒤 첫 late error 를 못 막음). ② 최초 수락된 PDF error 의 name/message/code 고정 — AbortError·시작 실패에 다른 envelope 를 붙여 새 Error 로 바꾸지 않음. ③ unit 추가: 반례 4(abort→late error · error→late error · error-event→late error · post-throw→late error)에서 첫 오류 name·message·code 유지, terminate 1회, abort listener 0 단언 + 다음-task 대조군 + 기존 result→late error 보존. ④ 기존 E3 11검사·공개 client 20 대조(ko/en × 성공/중첩 오류) 불변.
- 기록: review-notes U4-2 절에 F1 사유·수리·"11검사 중 timeout 은 공용 helper 대상" 정정·생성물 SHA 참조 전파(entry preload 에 `workerLifecycle` 청크 추가 → 156 파일은 자산 참조 해시만 변경) 사실 추가. CHANGELOG 한 줄. Codx 서명.

## 3. 검증(전부 실행·기록, 빌드 직렬 `NODE_OPTIONS=--max-old-space-size=4096`)
`npx tsc -b` · `npm run test:unit`(신규 케이스 수·전수) · **`node /tmp/worklazy-u4-2-review/probes/lifecycle.mjs` 를 현행 워킹트리 대상으로 실행 → 49 PASS/0 FAIL**(스크립트가 `/tmp/worklazy-u4-2-review/current` 사본을 고정 참조하면 원본 무수정으로 사본만 현행 HEAD 로 갱신하거나 별도 드라이버 — 조정 내용 기록) · `npm run build` · `npm run test:static` · `TEST_SCOPE=pdf npm run test:browser` · `npm run test:excel-cleaner`·`test:excel-compare` · `npm run fixtures:pdf-legacy-oracle`(diff 0) · `npm run bundle:measure`(5종 — 47c0f22 대비 변화 기록) · `git diff main..HEAD -- src/utils/workerLifecycle.ts src/features/excel-cleaner src/features/excel-compare` 0바이트 · `git diff --check`.

## 4. 금지
main 병합·push · 공용 helper·Excel·4모드 변경 · 새 의존 · 검수 스크립트 수정 · 정본 미정의 임의 결정 · 계획서 편집 · 사용자 파일 조작.

## 5. 정지점·보고
커밋 후 정지 → astra 재검수. 보고: 수정 요지·반례 4 unit 이름·49/49 원출력·검증표·git 상태. 산출물 `/tmp/worklazy-u4-2-fix1/`(REPORT.md·logs 는 `docs/jobs/todo/s3-pdf-finish-state/reports/u4-2-fix1/` 에도 복사).
