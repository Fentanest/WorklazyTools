# 작업지시서 — U4-0 F-fix: fixture 생성기·oracle 채취·번들 측정기 모듈 귀속 (2026-09-07, Claude → Codex **gpt-5.6-sol**)

## 0. 선독(순서대로)
1. `PROJECT_RULES.md` 전문 → `AGENTS.md`(「모델 역할 분담」 — 이 잡은 sol 코딩: 계획에 없는 판단은 임의 결정 말고 「범위 밖 발견」으로 보고).
2. **정본** `docs/jobs/todo/pdf-finish-20260905.md` — **「정본화」 절(우선순위·완료 기준 총람·명시 제외) 을 먼저**, 그 다음 U4-0 관련 절: 확정 4·5·16·17·25(fixture·oracle) · v6 D1(암호 oracle 4행 표) · v6 D5 + 4차 보고 계산식 1~8(번들 측정기 모듈 귀속) · v9~v13 D4(OCG fixture manifest 허용 4 · 제외 31 + 직접 배열 32 + 대표 20 회귀 · 지원 문법) · H4 단계표 · v5 V3-3(legacy oracle 채취 조건).
3. 상위 `roadmap-completion-20260906.md` §2 C-A~C-D · §결정 11.
4. 라운드 산출물(**재사용 권장 — 새로 발명하지 말 것**): 암호/손상 생성기 `/tmp/worklazy-u4-r3/`·`r4/probes/r2.mjs`·`r6.mjs` · legacy oracle `/tmp/worklazy-u4-r3/legacy/` + E2/E13 절차 · 번들 계측 플러그인·계산식 `/tmp/worklazy-u4-r4/project/scripts/module-attribution.mjs`·`measure-bundle-budget.mjs` 복제본, `r5/` 재현 · OCG fixture 생성기·분류기 `/tmp/worklazy-u4-r9..r12/probes/`(`candidate-guard.mjs`·`proposed-guard.mjs`·`explore*.mjs`·`final-assertions.mjs`·`exploration-matrix.json`) · 보고서 사본 `docs/jobs/todo/pdf-finish-rounds/`(probe 사본 포함). `/tmp` 가 비어 있으면 사본에서 복원.

## 1. 성격·기준
- **파일 수정이 필요한 구현 작업(쓰기 모드).** 브랜치 커밋 필수, **main 병합·push 금지**.
- 저장소 루트 `/home/better0101/projects/worklazytools`. **기준 해시 `main` = `5bc6854175331bdd73b267784d9633cdccda8446`**(S2b 병합·사후 기록 후, `origin/main` 동일 — Claude 실측). 착수 시 대조·다르면 중단·보고. 정본 「기준 해시」 절에 이 값을 기입하는 것은 Claude 가 한다(계획서 편집 금지).
- 브랜치: `git checkout -b s3-pdf-finish main`. 사용자 untracked 파일 3개 금지 동일.
- 열린 계획서 충돌: Claude 확인 — S2b 정본은 U4 전체 OTF·공용 `pdfFontEmbed` import 우선을 명시(qr-font 「v3 확정」 D4). 발견 시 보고.

## 2. 범위(U4-0 만 — 제품 UI 변경 0)
A. **번들 측정기 모듈 귀속(별도 논리 단위·첫 커밋들)**: `scripts/measure-bundle-budget.mjs` 에 v6 확정 28 + 4차 계산식 1~8 구현(독립 rendered gzip 가중·정수 배분·canonical id realm·이동 min 규칙·shared/app 순증분 게이트·entry/route/CSS 총 Δ·schema 버전·구 schema 오류·worker/public SHA opaque) — Vite 계측 플러그인은 measure 빌드에만. unit: 현행 통과·이동만 → 순증분 0·상한 도달+1B 실패·구 schema 오류. 기준점: 착수 시 main production 빌드 → `/tmp/s3-bundle-baseline.json`(새 schema). **5종 상한·multiplier 불변.**
B. **fixture 생성기 `scripts/generate-pdf-finish-fixtures.mjs`**(Node 내장만): 암호 R2/R6 open·restricted 4종(v6 D1 표 oracle) · 손상 3종(truncated·xref·malformed, 확정 17 기대표) · 배경 stream fixture(빈/단일/다중/비정상 Contents, 확정 4) · 위험 문서(`q/Q` 불균형·OCG·tagged, 확정 25) · **OCG manifest**(v13: 허용 4 · 제외 31 + 직접 배열 32 + 대표 20 — 라운드 fixture 이름·SHA 그대로 재생성, `exploration-matrix.json` 축 유지) · 제거 검증 fixture(첨부·XMP·주석 subtype·form·Link 3종·Outlines·Names·PageLabels·ViewerPreferences). **결정성 2회 생성 SHA 동일 단언**(unit). 생성물은 `tests/fixtures/pdf-finish/`(추적) + manifest JSON(기대값: 열기 결과·permissions·허용/제외·두 렌더러 SHA).
C. **legacy-organize 3종 oracle 채취(`main` 기준, 리팩터링 전)**: 확정 16·v5 V3-3 — 구조 oracle(페이지 수·회전·행렬·PNG XObject·ExtGState·Helvetica 9pt·색/opacity/operator 순서) · 렌더 oracle(Poppler 24.02.0 픽셀, 옵션 none/numbers/watermark/both × 2회 = byte·구조·픽셀 diff 0 확인) · client oracle(PNG 420~1800×92·alpha 0.82·120 UTF-16 절단 — **실제 Chrome** 152 로 생성). 환경(의존 버전·OS·폰트·renderer·DPI·배경) 기록. 산출 `tests/fixtures/pdf-finish/legacy-oracle/`.
D. **두 렌더러 픽셀 oracle 하네스** `tests/pdf-finish-oracle.mjs`(Poppler `pdftoppm` + PDF.js 렌더 → RGBA SHA 비교) — 폰트 snapshot·fixture 변경 시 실행(매 unit 금지), npm script `test:pdf-finish-oracle`.
E. 기록: CHANGELOG 코드 변경(측정기·fixture·oracle) · review-notes U4-0 절(계산식·baseline 수치·fixture 표·oracle 환경) 서명 Codx.

## 3. 검증(전부 실행·출력 기록)
`npm run build` · `npx tsc -b` · `npm run test:unit`(신규 unit 포함) · `npm run test:static` · `npm run bundle:measure`(새 schema, 5종 순증분 게이트 PASS, 이동 리포트) · `node tests/tool-registry-routes.mjs` · `npm run css:orphans` · `npm run legacy:manifest` · `git diff --check` · `TEST_SCOPE=pdf npm run test:browser`(4모드 불변) · 신규 `test:pdf-finish-oracle`(manifest 허용 4·회귀 52 두 렌더러 동일 · 제외 31 preflight 분류 일치) · fixture 생성 2회 SHA 동일 · 시각 회귀·a11y·CLS 는 제품 UI 변경 0 이므로 `npm run test:rendering` 1회로 대체(변경 없음 확인) — 전체 시각은 U4-3 부터.

## 4. 금지
main 커밋·병합·push · 제품 UI/동작 변경 · 새 npm 의존(Poppler 는 호스트 도구, 테스트 전용) · 5종 상한 변경 · 계획서 편집 · 사용자 파일 조작 · `/tmp` 산출물을 검증 없이 복사(SHA 대조 후).

## 5. 정지점·보고
커밋 후 브랜치 상태로 정지 → astra 검수(쓰기 모드·저장소 불변). 보고: 착수 게이트 · A~E 변경 파일 · baseline 5종 수치 · fixture 표(이름·SHA·기대) · oracle 환경·수치 · 검증표 · 범위 밖 발견 · git 상태 원문. 산출물 `/tmp/worklazy-u4-0/`.
