# 작업지시서 — U4-2 F0b: PDF worker lifecycle facade·취소 계약 (2026-09-07, Claude → Codex **gpt-5.6-sol**)

## 0. 선독(순서대로)
1. `PROJECT_RULES.md` → `AGENTS.md`(sol 코딩: 미정의는 「범위 밖 발견」).
2. **정본** `docs/jobs/todo/pdf-finish-20260905.md` — 「정본화」 절 → U4-2 관련 절: **확정 2**(worker 취소 = 신설 아니라 공용 `src/utils/workerLifecycle.ts` 로 이관, envelope adapter, signal 은 마지막 optional 인자, 기존 4모드 동작·오류 code·warnings·transfer 완전 동일) · **확정 19 + D5(v6·v7)**(협력적 취소: `setTimeout(0)`/MessageChannel 양보 helper — `await Promise.resolve()` 금지, abort 검사 지점 = load 전후·폰트 전후·페이지/타일 루프 매 반복·save 전·**결과 등록 전(양보 후 재검사)**, 동기 단위 즉시 중단 미보장 명시; PDF.js `renderTask.cancel()` → promise rejection 정착 대기 → `page.cleanup()` → `loadingTask.destroy()`, 공유 preview 문서 소유권) · **v7 D5 "adapter 범위 하나로"**: F0b = 실제 `pdfWorkerClient` 호출을 공용 lifecycle **facade**(공용 helper·Excel client 무수정)로 이관, finish 는 legacy-organize 엔진을 쓰지 않으므로 facade 를 직접 소비하지 않고 finish 자체는 협력적 취소 + PDF.js cancel · **v5 V3-4**(PDF 소유 facade — nested error→flat code·progress→phase 변환·PDF client 현지화·ko/en 성공/오류 결과·warnings·code·transfer identity 일치·terminate 1회, pre-abort·늦은 result·timeout·post 예외·중복 terminal·error event·생성 예외 11검사) · **확정 3·16**(legacy-organize 불변 — U4-0 oracle 3종 비교).
3. U4-0 산출: `tests/fixtures/pdf-finish/legacy-oracle/` + `npm run fixtures:pdf-legacy-oracle` 비교 절차(U4-0 보고 참조) · U4-1 산출 `src/features/pdf-editor/finish/`(취소 helper 를 여기 두거나 `src/utils/` 공용으로 — 정본 미지정이면 `src/utils/cooperativeCancel.ts` 로 두고 「범위 밖 발견」에 기록).
4. 3차 반박 E3(`/tmp/worklazy-u4-r3/`, 사본 `docs/jobs/todo/pdf-finish-rounds/`) facade 프로토타입·11검사 · 5차 E5-5 취소 반례 probe · 6차 E6-4 facade 대조.

## 1. 성격·기준
- **파일 수정이 필요한 구현 작업(쓰기 모드).** 브랜치 `s3-pdf-finish`(HEAD = U4-1 검수 통과 커밋 `f56dc68d4c53d58cad520fe41973cd2699a4f548`) 위에 커밋. **main 병합·push 금지.** 착수 시 브랜치·HEAD·`git rev-parse main`(`5bc6854…`) 대조.
- **기존 4모드(organize·image-to-pdf·pdf-to-image·convert) 의 UI·문구·동작·출력 불변** — 「명시 제외」(취소 버튼 추가 금지). 변경은 `pdfWorkerClient.ts` 내부 경로(facade 도입)·신규 취소 helper·테스트·기록. `src/utils/workerLifecycle.ts`·Excel client 파일 **무수정**(`git diff` 0 단언).

## 2. 범위
A. **PDF 소유 facade**: `src/features/pdf-editor/pdfWorkerLifecycle.ts`(제안) — 공용 `runModuleWorker`(`workerLifecycle.ts`) 를 호출하되 PDF envelope(`{type:"error", error:{message,code}}` · progress 메시지) 을 공용 flat 형식으로 변환하고 PDF client 의 현지화·warnings 처리를 보존. `pdfWorkerClient.ts` 의 organize/image-to-pdf/export-groups 호출을 facade 로 이관. **signal 은 마지막 optional 인자**(미전달 시 현행과 완전 동일: 결과·오류 code·warnings·transfer 목록·terminate 횟수). `file.arrayBuffer()` 전후·파일 loop 사이 abort 검사(signal 전달 시에만 동작).
B. **협력적 취소 helper** `yieldToEventLoop()`(`setTimeout(0)` 기반, MessageChannel 대안 허용 — `Promise.resolve()` 금지) + `throwIfAborted(signal)` + "결과 등록 전 양보 후 재검사" 패턴 함수. unit: 5차 반례(12/12 → 1/12) 재현.
C. **PDF.js 취소 순서 helper**: `cancelRender(renderTask)` → rejection 정착 대기 → `page.cleanup()` → `loadingTask.destroy()`; `RenderingCancelledException` 삼킴; 공유 preview 문서는 소유자 플래그 없으면 destroy 금지. `pdfPreview.ts` 의 내보내기 렌더(`:210–238`·`:356–363` 부근)에 **signal optional** 추가(미전달 시 동작 불변). unit/스모크: 렌더 중 cancel → 정착 → cleanup 순서 로그 단언.
D. **불변 증명**: `TEST_SCOPE=pdf npm run test:browser`(4모드) · `npm run fixtures:pdf-legacy-oracle` 비교(구조·렌더·client 3종 diff 0 — 리팩터링 후 재채취 vs U4-0 baseline) · `npm run test:excel-cleaner` · `npm run test:excel-compare` · `git diff main..HEAD -- src/utils/workerLifecycle.ts src/features/excel-*` 출력 0. facade unit: V3-4 11검사 + ko/en 성공/오류 identity(3차 E3·6차 E6-4 방식 이관).
E. 기록: CHANGELOG · review-notes U4-2 절(facade 계약·취소 순서·불변 증명 표) 서명 Codx.

## 3. 검증(전부 실행·기록)
`npx tsc -b` · `npm run test:unit` · `npm run build`(직렬, `NODE_OPTIONS=--max-old-space-size=4096`) · `npm run test:static` · `TEST_SCOPE=pdf npm run test:browser` · `npm run test:browser`(전체 — Word/Excel 회귀) · `npm run test:excel-cleaner` · `npm run test:excel-compare` · `npm run test:new-tools`(HWP·이미지·오디오·비디오 worker 사용처 회귀) · `npm run fixtures:pdf-legacy-oracle`(diff 0) · `npm run bundle:measure`(U4-0 baseline 대비 5종 순증분 — facade 는 route 기여 소량 예상, 기록) · `npm run test:rendering`(CLS 불변) · `npm run css:orphans` · `git diff --check`. 시각 회귀는 UI 변경 0 이므로 `test:rendering` 1회로 대체(근거 기록).

## 4. 금지
**검수(astra) 재현 스크립트·probe 를 수정해 재실행하지 않는다** — 재사용이 필요하면 원본은 그대로 두고 경로만 주입하는 별도 드라이버를 쓰고, 원본 단언이 실패하면 그 사실을 보고한다(U4-1 fix-2 에서 대조군 삭제·종료코드 단언 변경이 지시 이탈로 기록됐다). · main 병합·push · 4모드 UI/문구/동작 변경 · `workerLifecycle.ts`·Excel client 수정 · 새 npm 의존 · 정본 미정의의 임의 결정 · 계획서 편집 · 사용자 파일 조작.

## 5. 정지점·보고
커밋 후 브랜치 상태로 정지 → astra 검수. 보고: 변경 파일·facade 계약·불변 증명 표(oracle diff·Excel diff·스모크)·취소 unit 원문·검증표·범위 밖 발견·git 상태. 산출물 `/tmp/worklazy-u4-2/`.
