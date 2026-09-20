# 수정 지시서 — U4-1 fix-2 (2026-09-07, Claude → Codex **gpt-5.6-sol**)

## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md` → **astra 재검수 보고 `/tmp/worklazy-u4-1-review2/REPORT.md`(F5-R 표·R-DOC) + `UNIT-MAPPING.md` + `mutation-audit.py`·`mutants/<name>/`(변이 7종의 제품 변경 한 식·독립 probe)** → 정본 `docs/jobs/todo/pdf-finish-20260905.md` 해당 절(N1 D2 하한·E6 6영역 좌표·N3 타일 offset·D3 캔버스 A DPI 하향/maxArea·coverage 순서).

## 1. 성격·기준
- **파일 수정이 필요한 구현 작업(쓰기 모드).** 브랜치 `s3-pdf-finish` HEAD `ba762b4b1cf38b13bef3013aa465e59e33eb9146` 위에 커밋. **main 병합·push 금지.** 커밋 금지 제약 없음 — 커밋은 완료 기준.
- **제품 코드(`src/`) 변경 0.** 이번 수정은 `tests/unit/pdf-finish-modules.test.ts` 와 `docs/review-notes.md`(필요 시 CHANGELOG 한 줄)만. 정상 계산은 이미 맞다 — 빠진 **회귀 단언**을 리터럴 기대값으로 추가한다.

## 2. 수정 항목
- **F5-R 회귀 7건** — astra 표의 문안대로, 각 단언은 해당 mutant 를 **실패시켜야** 한다:
  1. canvasPolicy A DPI 하향: `viewportAtDpi: dpi => ({width:1600*dpi/72,height:1000*dpi/72})` 요청 300 → attempts `[300,200,150]`, applied 150, supported=true, `use-lower-dpi` 리터럴.
  2. canvasPolicy `maxAreaExceeded` 독립: 100×100·maxSide 4096·maxArea 9999 → pixels 10000, side=false, area=true, allowed=false; 4096² 허용·한 변 4096.01 초과 경계.
  3. selection startPage 4 + excludeCover: 2·3쪽 disabled, 선택 `[4,6,8]`, 3쪽 toggle 은 동일 상태 객체 유지, 표지 제외 empty 경계.
  4. text 6영역 x/y·줄간격 리터럴(`[768,753.6]` 등), `80A/B/C` 50×10 → runs=[] + `['horizontal-overflow','vertical-overflow']`, 50×28.8 두 run 의 text/width/y 고정. box 로 재계산 금지.
  5. tiles offset/rotation: 20×20·타일 10×10·gap 0·offset 5/5·rotation 30 → `(5,5),(15,5),(5,15),(15,15)` 각 rotation 30.
  6. stamp corners 좌표: stamp(10,20,30,40)·주입 변환 (x+1,y+2) → `(11,22),(41,22),(11,62),(41,62)`.
  7. text coverage 호출 trace: 후보 `['Русский','ASCII']` → `['H:Русский','H:ASCII','N']`(Helvetica 전수 후 Noto 1회), 기존 noFallback 0회 단언 유지.
- **R-DOC**: review-notes U4-1 절 — 원구현(unit 271, `/tmp/worklazy-u4-1/`)·fix-1(272, 원로그 부재 사실)·fix-2(이번, 원로그 경로) 를 구분해 기록하고, 이번 실행의 명령/cwd/env/exit/원출력을 `/tmp/worklazy-u4-1-fix2/logs/` 에 보존해 경로를 적는다. Codx 서명.

## 3. 검증(전부 실행·기록)
`npx tsc -b` · `npm run test:unit`(finish case 수·전수) · **`python3 /tmp/worklazy-u4-1-review2/mutation-audit.py` 를 현행 워킹트리(또는 HEAD 사본) 대상으로 조정해 재실행 — 7 mutant 각각 unit exit≠0(원출력 보존)**; 스크립트가 사본 경로를 고정 참조하면 그 부분만 조정하고 조정 내용 기록 · `git diff --stat ba762b4..HEAD` 가 unit·기록만인지 · `git diff --check`. 제품 코드 무변경이므로 build·bundle·oracle·스모크는 생략하고 그 근거(`src/` diff 0)를 기록.

## 4. 금지
main 병합·push · `src/` 변경 · 새 의존 · 정본 미정의 임의 결정 · 계획서 편집 · 사용자 파일 조작.

## 5. 정지점·보고
커밋 후 정지 → astra 재검수. 보고: 7건 단언 ↔ mutant 실패 표·unit 수·git 상태. 산출물 `/tmp/worklazy-u4-1-fix2/`.
