# 수정 지시서 — U4-1 fix-1 (2026-09-07, Claude → Codex **gpt-5.6-sol**)

## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md` → 정본 `docs/jobs/todo/pdf-finish-20260905.md`(N3 v7 타일 400·좁은 영역 오류 / v6 D3 캔버스 B raw ledger) → 원 지시서 `<scratchpad>/u4-1-dispatch.md` → **astra 검수 보고 `/tmp/worklazy-u4-1-review/REPORT.md` + `UNIT-MAPPING.md` + 재현 스크립트 `defects.mjs`·`loader-check.mjs`·`goldens.mjs`·`source-audit.mjs`** (`<scratchpad>` = `/tmp/claude-1000/-home-better0101-projects-worklazytools/f5cf1bca-6bf0-442b-b9d4-e7cb45f9c96d/scratchpad`).

## 1. 성격·기준
- **파일 수정이 필요한 구현 작업(쓰기 모드).** 브랜치 `s3-pdf-finish` HEAD `fd37ceab057ced2941fb752b2511124dbeaafda4` 위에 커밋. **main 병합·push 금지.** 이전 전달 과정의 임의 "커밋 금지" 제약은 무효 — 커밋은 완료 기준이다.
- 판정은 Claude 가 채택한 F1~F5 그대로. 반박이 있으면 **재현 명령과 출력**으로 보고에 적되 수정은 수행한다(정본 문안 우선).

## 2. 수정 항목
- **F1 `tiles.ts`**: 공개 인자 `maximumTiles` 제거, 400 을 모듈 상수 불변 상한으로. 401번째 **생성 전** 중단 유지(생성 횟수 계측 단언). 회귀 unit: 상한 완화 인자·경로 부재(타입 레벨 + 420 입력 거부·생성 0회).
- **F2 `text.ts`**: 유효 ellipsis 폭 산출 직후 **입력 줄 길이와 무관하게** 영역 폭 < ellipsis 폭이면 `narrow-region` 필드 오류. unit: 폭 5pt 에서 긴 줄·짧은 `i`(2.664pt)·빈 줄 모두 오류, 폭 12pt 는 `…` 만 출력, 50×28.8 2줄 경고·높이 10 0줄 경고 골든 유지.
- **F3 `canvasPolicy.ts`**: raw ledger 계약을 타입·주석으로 완결 — entry = **한 시점에 동시 생존하는 canvas/bitmap 자원 목록**(각 pixels·bytes·장수), 시점 합계 = Σbytes·Σ장수, `peakRawRgbaBytes` = **시점별 합계의 max**(entry 별 max 아님). 문서 누적 pixels 는 지표로만 두고 peak·차단 게이트에 쓰지 않는다. unit 골든: 크기 다른 동시 자원 2개(100px+200px → 1,200B), 단일 자원 복사 2개, 해제 후 다음 시점.
- **F4 loader**: `tests/helpers/pdf-finish-ocg-preflight.mjs` 의 전용 `register` loader 제거 → 제품 모듈 **정적 re-export 한 줄**. `package.json` `test:pdf-finish-oracle` 스크립트에 기존 관행(`test:unit`·`test:qr-font-render`·정적 생성기)과 같은 `node --experimental-strip-types` 적용 — **이 한 줄은 이번 지시로 범위에 포함**. plain Node 지원 요구는 만들지 않는다. 증거: native flag 로 oracle 56/31·두 렌더러 SHA 56, helper/제품 export identity.
- **F5 unit**: `UNIT-MAPPING.md` 의 누락을 채운다 — E5 중앙 앵커·여백·혼합 visual 크기(astra `mixed.mjs` 방식의 4쪽 fixture), E6-2 전처리·coverage 10입력 전수(`가\r나`·`{date:foo}`·`\n\n` 리터럴 포함), D7 **실제 PDF.js viewport fixture** 로 독립 16조합(DPR 1·2 × CSS 축소 1·0.5 × 회전 4, 기대값은 정본/probe 수치를 리터럴로), canvas A rotation/UserUnit/RGBA/150 성공, B raw ledger, 타일 생성 횟수, F1~F3 반례. **기대값은 정본·probe 표의 리터럴** — 테스트 대상 함수의 재계산으로 대체 금지.
- **기록**: review-notes U4-1 절에 F1~F5 사유·실제 회귀 범위·"정본 미정의 정책 없음" 문구 정정·oracle 실행 flag 사실 기록(Codx 서명). CHANGELOG 는 간결히. `TEST_SCOPE=pdf` 의 고정 성공 메시지를 Excel/Word 실행 증거로 쓰지 않는다.

## 3. 검증(전부 실행·기록, 빌드 직렬 `NODE_OPTIONS=--max-old-space-size=4096`)
`npx tsc -b` · `npm run test:unit`(신규 case 수·전수) · `npm run build` · `npm run test:static` · `TEST_SCOPE=pdf npm run test:browser` · `npm run test:pdf-finish-oracle`(native flag, 56/31) · `npm run bundle:measure`(5종 Δ0 유지) · `npm run css:orphans` · `node tests/tool-registry-routes.mjs` · `git diff --check` · astra 재현 스크립트 `node --experimental-strip-types /tmp/worklazy-u4-1-review/defects.mjs` 가 **결함 재현 실패(즉 수정 확인)** 로 바뀌는 출력 기록(스크립트가 제거된 인자를 참조하면 그 사실을 기록).

## 4. 금지
main 병합·push · UI/route/기존 모드 변경 · `package.json` 의 다른 줄 변경·새 의존 · 정본 미정의 임의 결정 · 계획서 편집 · 사용자 파일 조작.

## 5. 정지점·보고
커밋 후 정지 → astra 재검수. 보고: F별 수정 요지·회귀 unit 이름·검증표·git 상태. 산출물 `/tmp/worklazy-u4-1-fix1/`.
