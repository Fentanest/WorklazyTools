# 지시서 — U4-0 구현 **재검수** (2026-09-07, Claude → Codex **gpt-6-astra**)

## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md`(「모델 역할 분담」 검수: 지시서·정본 대비 누락·왜곡·검증 미실행을 **재현 명령**으로 판정) → 정본 `docs/jobs/todo/pdf-finish-20260905.md`(「정본화」 절 → U4-0 관련 절: 확정 4·5·16·17·25, v6 D1·D5(확정 28), v9~v13 D4, v5 V3-3) → sol 지시서 `/tmp/claude-1000/-home-better0101-projects-worklazytools/f5cf1bca-6bf0-442b-b9d4-e7cb45f9c96d/scratchpad/u4-0-dispatch.md` → sol 보고 `/tmp/worklazy-u4-0/REPORT.md`·`fixture-table.json`·`logs/` → 자신의 3~12차 반박 산출물(`/tmp/worklazy-u4-r3..r12`, 사본 `docs/jobs/todo/pdf-finish-rounds/`).

## 1. 성격·기준
- **검수 잡(쓰기 모드·저장소 불변)** — 저장소 파일 수정·커밋·push·`dist` 변경·브랜치 전환·저장소 안 npm/pip 설치 금지. 산출물 `/tmp/worklazy-u4-0-review2/`. 현재 브랜치 `s3-pdf-finish` HEAD = 현재 브랜치 최신(`git rev-parse HEAD`, 18001be + sol fix-1 커밋), `main` `5bc6854`. 시작·종료 `git status`·HEAD 불변 증명(untracked 사용자 파일 3개만).

## 2. 검수 항목(재현 필수)
**재검수 우선(1차 검수 `/tmp/worklazy-u4-0-review/REPORT.md` F1~F5 + sol fix-1 보고 `/tmp/worklazy-u4-0-fix1/REPORT.md`)**: F1 `metadata-guard-probe.mjs` 8케이스 전부 거부·worker/public opaque·이동·5종·E6 수치 유지 / F2 `collation-probe.mjs` en-US·sv-SE 동일·4차 순서·`sum=G_c` / F3 `plain-properties-probe.mjs` 정상 문서 허용(두 렌더러 SHA 동일)·`ordinary-no-resources` TypeError 해소·477 분류 불변·조기 성공 우회 없음 / F4 `test:pdf-finish-oracle` 이 허용 집합 변환 전후 SHA·deep residual 0·제외 변환 0·음성 대조 실패를 실제 실행 / F5 기록 3건 정정. 제품 `src/` 변경 0. **빌드·측정은 직렬로**(1차 검수의 병렬 빌드 OOM 재발 금지, `NODE_OPTIONS=--max-old-space-size=4096`). 이하 1차 항목은 변경 범위만 재실행:
1. **번들 측정기 모듈 귀속(커밋 `9e3acb5`)**: 확정 28 + 4차 계산식 1~8 과의 정합 — 독립 rendered gzip 가중·정수 배분(`sum=G_c`)·canonical id realm·이동 `min` 규칙·shared/app 순증분·entry/route/CSS 총 Δ·schema 버전·구 schema **오류**(SHA 폴백 금지)·worker/public opaque·5종 상한·multiplier·override 불변. **`vite.config.ts` 변경 36줄**이 measure 빌드(`dist-measure`) 전용 계측인지 — production `dist` 산출 byte 가 main 과 동일한지(`npm run build` 후 entry/route 파일 SHA 대조). unit(`tests/unit/bundle-budget.test.ts`) 두 방향(이동만 → 순증분 0 · 상한 도달+1B 실패 · 구 schema 오류) 실행. 4차 E6 빌드 산출(`/tmp/worklazy-u4-r3/builds`, r4 계측 자료)에 새 측정기를 적용해 **lazy-fontkit shared 순증분 +80B·app +13,264B** 가 재현되는지(가능한 범위).
2. **fixture 생성기·manifest(`1723550`)**: 결정성 2회 SHA 동일 재실행 · 암호 R2/R6 4종 oracle(v6 D1 표: PasswordException code·permissions 배열·`permissions !== null` 거부) · 손상 3종 기대(InvalidPDFException / 복구 OPEN / 경고 OPEN) · **OCG manifest**: 정본 v13 "허용 4 · 제외 31 + 직접 배열 32 + 대표 20" 대비 sol 의 "허용 56 / 제외 31" 구성(4+32+20=56 인지, 이름·SHA 가 라운드 fixture 와 일치하는지 — 특히 대표 반례 SHA `e4b526bd…`·`18ae5a0d…`·`5a8f061e…`·`72f2d2a6…`·`4da6e14f…`·`aa836834…`·`5a99469a…`·`a4718041…`·`328886f3…`) · preflight 분류기(`tests/helpers/pdf-finish-ocg-preflight.mjs`)가 v11+v12+v13 문법(OCMD 원시 값 규칙·catalog 경계·조건 ①~⑧·비페이지 OC 제외·Type3 도달 제외·Name `#xx`)을 구현했는지 — 12차 `final-assertions` 방식으로 허용 56 두 렌더러 SHA 동일 재실행.
3. **legacy-organize 3종 oracle(`main` 기준)**: 옵션 4조합 × 2회 byte·구조·Poppler 픽셀 diff 0 · client PNG 는 실제 Chrome · 환경 기록(의존 버전·OS·폰트·renderer·DPI·배경) 존재.
4. **두 렌더러 oracle 하네스** `tests/pdf-finish-oracle.mjs` + `test:pdf-finish-oracle` script — 실행 1회, 매 unit 에 포함되지 않는지.
5. **제품 불변**: `git diff main..s3-pdf-finish -- src/` 가 0 · production build 후 `test:static`·`TEST_SCOPE=pdf test:browser`·`test:rendering` 통과 · 시각 회귀 미실행 근거(UI 변경 0) 타당성.
6. **기록**: CHANGELOG·review-notes U4-0 절(baseline 5종 수치·fixture 표·oracle 환경) 정합, 보고 수치 ↔ 로그 원문.
7. **범위 밖 변경**: 정본·지시서에 없는 변경 열거·판정(예: `.gitignore`·package.json script·vite.config).

## 3. 판정 형식
| 항목 | 판정([통과]/[결함]/[미검증]) | 재현 명령·출력 | 수정 지시 문안 | · 심각도 · 마지막 **[검수 통과] / [수정 후 재검수]**. 산출물 `/tmp/worklazy-u4-0-review2/REPORT.md`.
