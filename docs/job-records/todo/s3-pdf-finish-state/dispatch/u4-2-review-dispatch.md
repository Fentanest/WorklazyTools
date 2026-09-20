# 지시서 — U4-2 구현 검수 (2026-09-07, Claude → Codex **gpt-6-astra**)

## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md`(「모델 역할 분담」 검수: 지시서·정본 대비 누락·왜곡·검증 미실행을 **재현 명령**으로 판정) → 정본 `docs/jobs/todo/pdf-finish-20260905.md`(「정본화」 절 → 확정 2·19 · v6 D5 확정 28 finish 실행 경계 · **v7 D5**(realm 정정·협력적 취소 계약·adapter 범위 하나로) · v5 V3-4(facade 11검사·Excel 무변경) · 확정 3·16 + V3-3(legacy 불변)) → sol 지시서 `/tmp/claude-1000/-home-better0101-projects-worklazytools/f5cf1bca-6bf0-442b-b9d4-e7cb45f9c96d/scratchpad/u4-2-dispatch.md` → sol 보고 `/tmp/worklazy-u4-2/REPORT.md`·`bundle.json`(나머지 소실) → 자신의 3차 E3 facade 프로토타입·5차 E5-5 취소 반례·6차 E6-4(사본 `docs/jobs/todo/pdf-finish-rounds/round-3·5·6-REPORT.md`·`probes-r*/` — `/tmp` 원본은 소실).

## 1. 성격·기준
- **검수 잡(쓰기 모드·저장소 불변)** — 추적 파일 수정·커밋·push·브랜치 전환·저장소 안 설치 금지. 산출물 `/tmp/worklazy-u4-2-review/`. 브랜치 `s3-pdf-finish` HEAD `47c0f2286887111e3573d5efaec0af57165d7d0d`(커밋 `47c0f22`, 기준 `f56dc68`), `main` `5bc6854175331bdd73b267784d9633cdccda8446`. 시작·종료 `git status`·추적 파일 SHA 불변 증명.
- 빌드·브라우저는 **직렬**, `NODE_OPTIONS=--max-old-space-size=4096`(메모리 증설 후 — 이전 exit 137 은 호스트 문제였음, 기록에 남길 것).
- **검수 재현 스크립트는 자신의 것**(sol 산출 스크립트를 판정 근거로 쓰지 않음).

- **재부팅 후 재개**: 앞선 워커 3개는 호스트 OOM 으로 죽었고 `/tmp` 는 비워졌다(메모리는 64GiB 로 증설됨). sol 산출 중 남은 것은 `/tmp/worklazy-u4-2/REPORT.md`·`bundle.json` 만이다(`legacy-oracle-current/`·`protected.diff` 는 소실 — 재채취·diff 는 **자신이** 수행). 자신의 라운드 산출물(`/tmp/worklazy-u4-r*`) 도 소실 — 사본 `docs/jobs/todo/pdf-finish-rounds/`(`round-*-REPORT.md`·`probes-r*/`) 를 쓴다. 번들 baseline 은 `/tmp/s3-bundle-baseline.json`(복원됨, U4-0 착수 시 main 빌드).
- 앞선 워커가 검토 중이던 단서 — **"늦은 오류 메시지가 먼저 확정된 취소·오류 결과를 덮어쓸 가능성"**(facade 의 terminal 상태 경합) — 는 항목 2 에 반례 시도로 포함한다.

## 2. 검수 항목(재현 필수)
1. **범위·불변**: `git diff --stat f56dc68..HEAD` 12파일이 지시 범위(facade·helper·pdfPreview signal optional·client 이관·oracle 비교 스크립트·unit·기록·package.json 1스크립트)인지. `git diff main..HEAD -- src/utils/workerLifecycle.ts src/features/excel-cleaner src/features/excel-compare` 0바이트. **4모드 UI/문구/동작 변경 0**(locale json·panel 컴포넌트 diff 0, 취소 버튼 미추가). `package.json` 변경은 **`fixtures:pdf-legacy-oracle` 를 capture → compare 스크립트로 재지정**한 1줄이다 — 판정: (a) U4-0 baseline 재채취 경로(capture)가 여전히 호출 가능한가(스크립트 부재/사장 여부) (b) compare 가 capture 를 재사용하는지(두 사본 금지) (c) 이 재지정이 지시서 §2-D 의 "재채취 vs baseline 비교" 범위 안인지, 아니면 범위 밖 발견으로 보고돼야 했는지.
2. **facade(V3-4 11검사)**: `pdfWorkerLifecycle.ts` 가 공용 `runModuleWorker` 를 호출하고 PDF envelope(nested error→flat code·progress→phase·현지화·warnings·transfer identity·terminate 1회)을 보존하는지 — **자신의 3차 E3 프로토타입 검사 11개를 현행 facade 에 대입**해 재실행(pre-abort·늦은 result·timeout·post 예외·중복 terminal·error event·생성 예외 포함). signal 이 **마지막 optional 인자**이고 미전달 시 organize/image-to-pdf/export-groups/office 호출 결과·code·warnings·transfer 목록·terminate 횟수가 기준 f56dc68 과 동일한지(두 커밋에서 동일 unit/스모크 실행 후 대조).
3. **협력적 취소(v7 D5)**: `cooperativeCancel.ts` 양보가 `setTimeout(0)`/MessageChannel 이고 `Promise.resolve()` 가 아님(코드 + **5차 E5-5 반례 재현**: 미세과제 12/12 vs 과제 양보 1/12). abort 검사 지점 — 파일 load 전후·폰트 전후·루프 매 반복·save 전·**결과 등록 전 양보 후 재검사** — 가 helper 계약/문서에 있는지(finish 엔진은 U4-3 이라 helper 계약·단위 검증만).
4. **PDF.js 취소 순서(확정 19)**: `pdfRenderLifecycle.ts` — `renderTask.cancel()` → rejection 정착 대기 → `page.cleanup()` → 소유 문서만 `destroy`; `RenderingCancelledException` 삼킴; 공유 preview 문서 destroy 금지. 순서 로그 unit 재실행 + **렌더 중 cleanup 오류 반례**(api.d.ts 경고) 직접 시도. `pdfPreview.ts` 변경 41줄이 signal 미전달 시 기존 동작·출력 byte 동일인지.
5. **legacy 불변(확정 3·16)**: `npm run fixtures:pdf-legacy-oracle` 재채취 vs U4-0 baseline — client·structure·render·output·input diff 0 을 **자신이** 재실행. `TEST_SCOPE=pdf npm run test:browser` · `npm run test:excel-cleaner`·`test:excel-compare`(취소 경로 포함) · `npm run test:new-tools`(HWP·이미지·오디오·비디오 worker 사용처).
6. **공통 검증**: tsc · unit(289) · 직렬 build · static · `npm run test:rendering`(CLS) · bundle 5종(sol 보고 entry +18B·route +758B·shared +37B·app +867B·CSS 0 — 재측정 일치·상한 내·override 없음; **facade 가 왜 entry 에 +18B 를 주는지** 귀속 확인) · css:orphans · registry 20 · `git diff --check`. production dist 대 main: PDF 관련 청크 외 파일 SHA 동일.
7. **기록·범위 밖 발견**: CHANGELOG·review-notes U4-2 절 ↔ 로그 원문(특히 exit 137 사실 기록·최종 빌드 heap 3GiB 조건). 정본 미정의 임의 결정이 코드에 들어갔는지(예: cooperativeCancel 위치 `src/utils/` — 지시서가 허용한 기본값; 그 외).

## 3. 판정 형식
| 항목 | 판정([통과]/[결함]/[미검증]) | 재현 명령·출력 | 수정 지시 문안 | · 심각도 · 마지막 **[검수 통과] / [수정 후 재검수]**. 산출물 `/tmp/worklazy-u4-2-review/REPORT.md`.
