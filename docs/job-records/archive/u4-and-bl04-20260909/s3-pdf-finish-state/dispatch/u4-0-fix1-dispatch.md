# 수정 지시서 — U4-0 검수 소견 F1~F5 반영 (2026-09-07, Claude → Codex **gpt-5.6-sol**)

## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md` → **검수 보고 `/tmp/worklazy-u4-0-review/REPORT.md`**(F1~F5 정의·재현 probe·「수정 지시」 절 전문 — 이 지시서는 그 절을 그대로 이행한다) → 정본 `docs/jobs/todo/pdf-finish-20260905.md` 해당 절(v6 확정 28 "구 schema 오류·SHA 폴백 금지"·4차 계산식 2 "동률 canonical id 사전순" · v11~v13 D4 "일반 Properties 와 OC 구분" · 12차 final-assertions 방식 "허용 집합 변환 전후 두 렌더러 SHA 동일·deep residual 0·제외 변환 0").

## 1. 성격·기준
- **파일 수정이 필요한 구현 작업(쓰기 모드).** 브랜치 `s3-pdf-finish`(HEAD `18001be`) 위에 커밋(논리 단위별). **main 병합·push 금지.** 착수 시 브랜치·HEAD·`git rev-parse main`(`5bc6854…`) 대조. **제품 `src/` 변경 0 유지**(측정기·fixture 생성기·하네스·테스트·기록만).
- 메모리: 검수에서 병렬 production 빌드가 OOM(exit 137)을 냈다. **빌드·측정은 직렬로**, `NODE_OPTIONS=--max-old-space-size=4096`.

## 2. 수정(검수 「수정 지시」 절 그대로)
- **F1(P2)** `scripts/bundle-module-attribution.mjs`·`measure-bundle-budget.mjs`: schema v2 에서 **main 청크 모듈 metadata 가 비어 있거나(`modules=[]`) 일부 청크가 누락되면 오류로 차단**(SHA opaque 폴백 금지). worker/public JS 만 명시적 opaque 허용(목록 근거 기록). unit: 빈 배열·main 청크 1개 제거 → baseline/current 양쪽 오류.
- **F2(P2)** 정수 나머지 동률 정렬을 **로케일 비의존**(`<`/`>` 코드포인트 비교, `localeCompare` 금지)으로 고정. unit: `a.ts`/`Z.ts`·`ä.ts`/`z.ts` 동률에서 en-US·sv-SE 동일 결과.
- **F3(P2)** `tests/helpers/pdf-finish-ocg-preflight.mjs`: **OC 가 없는 일반 marked-content Properties(`/Span /TextInfo BDC` 등)를 OCG 로 오분류하지 않도록** — property 가 `/Type /OCG`·`/OCMD` 로 해석될 때만 OC 로 취급, 그 외 `/Properties` 항목은 무시(비-OC). 전객체·Type3 제외 규칙은 유지. fixture 추가: 검수 `plain-properties-probe.mjs` 의 정상 문서(허용 기대·두 렌더러 SHA 동일). 477 분류 기대 불변 확인.
- **F4(P2)** `tests/pdf-finish-oracle.mjs`: 현재 원본만 렌더 → **허용 집합에 대해 구조 제거 변환(12차 변환기 이관)을 실행하고 원본=결과 두 렌더러 RGBA SHA 동일·deep OC residual 0·제외 집합 변환 0** 을 단언. 검수 `before-after.mjs`(허용 56/57페이지 통과) 방식을 추적 하네스로 이관. 출력 row 에 `transformed·residual·shaMatch` 추가. 음성 대조(출력 파손 시 검출) 1건 포함.
- **F5(P3)** 기록 정정 3건: review-notes/CHANGELOG 의 "page AF 존재" → 실제(부재)로 · OCG 지원표 구문 정정 · bundle 재현 명령을 실제 env 문법(`BUNDLE_ROUTES`·`BUNDLE_BASELINE`·`BUNDLE_MEASURE_OUTPUT`·`BUNDLE_MODULE_ATTRIBUTION_OUTPUT`)으로. sol REPORT 도 갱신.

## 3. 검증(실행·기록)
`npx tsc -b` · `npm run test:unit`(F1·F2·F3 unit 포함) · `node scripts/generate-pdf-finish-fixtures.mjs` 2회 SHA 동일(F3 fixture 추가 후 manifest 갱신) · `npm run test:pdf-finish-oracle`(F4: 허용 전후 SHA·residual·제외 변환 0·음성 대조) · `BUNDLE_ROUTES=pdf-editor BUNDLE_BASELINE=/tmp/s3-bundle-baseline.json … npm run bundle:measure`(5종 delta 0 유지, 4차 E6 재현 +80B/+13,264B) · `npm run test:static` · `git diff main..HEAD -- src/` 출력 0 · `git diff --check`.

## 4. 정지점·보고
커밋 후 브랜치 상태로 정지 → astra 재검수. 보고: F1~F5 변경 파일:라인·재현 probe 결과(수정 전 실패/후 통과)·검증표·git 상태. 산출물 `/tmp/worklazy-u4-0-fix1/`.

## 5. 금지
main 병합·push · 제품 `src/` 변경 · 5종 상한 변경 · 병렬 빌드 · 계획서 편집 · 사용자 파일 조작 · 검수 probe 결과를 재현 없이 인용.
