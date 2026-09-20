# 작업지시서 — U4-1 F0a: finish 순수 모듈 (2026-09-07, Claude → Codex **gpt-5.6-sol**)

## 0. 선독(순서대로)
1. `PROJECT_RULES.md` → `AGENTS.md`(sol 코딩: 계획에 없는 판단은 「범위 밖 발견」으로 보고).
2. **정본** `docs/jobs/todo/pdf-finish-20260905.md` — 「정본화」 절 → U4-1 관련 절만: 확정 1(glyph coverage) + N3(v7·v8: 전처리·개행·제어문자·coverage 순서·overflow·타일 400) + D8(v5 사실 정정) · 확정 7·9 + D2(v6 `startPage`/`startNumber`/`anchor` 산식) + N1(v6 exact set·parity·canonical text) · 확정 24 + N3 date 화이트리스트(v8) · 확정 10(clock 1회 캡처·locale) · 확정 18 + D3(v6~v9: 캔버스 A 정책 함수, B 는 측정 지표 산출만) · 확정 21(여러 줄 좌표·6영역 정렬) · 확정 8·22 + D7(v5)·N2(v6: CSS viewport 좌표·정규화 중심·상대 폭·고유 종횡비·clamp) · 확정 12(복합 실행 순서 — 순수 계획 함수로) · H2(S0/S2 전제).
3. U4-0 산출(브랜치 `s3-pdf-finish` HEAD 검수 통과 커밋): `tests/fixtures/pdf-finish/`·`tests/helpers/pdf-finish-ocg-preflight.mjs`·oracle 하네스 — **재사용**(순수 모듈의 unit 은 이 fixture 를 입력으로).
4. 라운드 probe 사본 `docs/jobs/todo/pdf-finish-rounds/probes-r*`(E5 좌표/토큰/glyph probe·E6-2 전처리·date parser·N1 상태 전이 산술) — 골든 값의 출처.

## 1. 성격·기준
- **파일 수정이 필요한 구현 작업(쓰기 모드).** 브랜치 `s3-pdf-finish` 위에 커밋(HEAD = U4-0 검수 통과 커밋 `5ee9b1a4af1e5611cee8f86ba3f177801225dc97`). **main 병합·push 금지.** 착수 시 `git branch --show-current`·HEAD·`git rev-parse main`(`5bc6854…`) 대조.
- **제품 UI·route·기존 모드 동작 변경 0** — 이 단계는 `src/features/pdf-editor/finish/` (신설 디렉터리) 아래 **순수 TypeScript 모듈 + unit** 만. React·worker·pdf-lib 그리기 호출 없음(pdf-lib 는 폰트 `encodeText`/`getCharacterSet` 검사용 타입·인스턴스 주입만).
- 정본 문안이 이미 결정한 것을 코드로 옮긴다. 미정의를 만나면 임의 결정 금지 → 「범위 밖 발견」.

## 2. 모듈(파일명은 제안 — 디렉터리·export 계약은 유지)
- `geometry.ts`: 페이지 회전(0/90/180/270)·CropBox 원점·혼합 크기 → 6영역(상/하 × 좌/중/우) 앵커 좌표 + "글자가 똑바로 보이는 방향" 회전각. 입력은 PDF.js viewport 정보(순수 값). 골든: 3차 E5 회전 4종 × CropBox 비영점 표.
- `selection.ts`: 파일별 **물리 페이지 exact set** 정본, `parseRange`/`formatCanonicalRange`(`2-4,6,8`), parity 필터, `startPage`·`excludeCover` 하한(disabled 판정), `anchor = max(startPage, excludeCover?2:1)`, `displayNumber(p) = startNumber + p − anchor`, `{pages}` = 물리 총수, 빈 set → 실행 불가 플래그, 썸네일 토글 → exact set·parity=all·canonical text 재생성(N1 골든 `2-8+even` 3쪽 토글 → `{2,3,4,6,8}`·`2-4,6,8`).
- `tokens.ts`: `{page}`·`{pages}`·`{filename}`·`{date}`·`{date:<fmt>}` 단일 pass 치환(치환 결과 재해석 금지), 알 수 없는 `{foo}` → 리터럴+경고, `date` 화이트리스트 parser(`YYYY`·`MM`·`DD` 각 ≤1회, 구분자 `-`·`.`·`/`·공백 1개, 그 외 필드 오류) — 골든 허용 5·오류 4 + 보충 14(6차 E6-2·7차). `clock` 은 주입(`(clock: () => Date, locale)` — 1회 캡처 값 전달).
- `text.ts`: 전처리 순수 함수(토큰 치환 → CRLF/CR→LF → TAB→4공백 → C0(LF 제외)/DEL/C1 필드 오류 → LF 분리) → 후보 run 전체 coverage(Helvetica `encodeText` 시도 → 실패 시 Noto `getCharacterSet` — 폰트 인스턴스 주입) → 문서당 폰트 결정(하나라도 Noto 필요 → Noto 단일) → 누락 scalar 위치 보고(필드 오류) → 레이아웃(좌/중/우 × 6영역, 줄높이 size×1.2, 폭 초과 줄 말줄임 `…`+경고, `…` 조차 안 들어가면 필드 오류, 수직 초과 줄 제거+경고, 여백 합 ≥ 페이지 치수 → 필드 오류). width 계산 입력 = draw 입력(동일 run). 골든: D8(`Résumé €` Helvetica 성공·`Русский` Noto·`ή U+03AE` 누락), E6-2(`A\tB\r\nC\rD` → `["A    B","C","D"]`, NUL/VT/U+0085 오류, `A×80+🙂` 누락 차단, 12pt `…` 폭 12pt/영역 5pt 오류/12pt 말줄임만, 50×28.8 2줄 경고, 높이 10 0줄 경고).
- `tiles.ts`: 타일 워터마크 배치 목록(간격·오프셋·회전), **페이지당 400 초과 시 필드 오류**(401번째 전에 중단), gap<0·타일 폭 0 오류. 골든: 200×200/10×10/gap 0 → 400 허용, 폭 201 → 420 오류, gap 1 → 361.
- `canvasPolicy.ts`: A(단일 캔버스) — viewport(scale=DPI/72, rotation·UserUnit) → `ceil(w)·ceil(h)`·면적·RGBA bytes·`maxSide`/`maxArea`(보수 후보 4,096²) 검사 결과 + DPI 하향 제안(300→200→150) + 150 도 위반 시 "지원 제외·범위 축소" 판정 · B 측정 지표 산출(누적 pixels·raw ledger — 판정 없음) · 사전 경고식(`Σpixels × coefficient(dpi, format)`, 계수는 주입) · 메모리 폴백 등록 전 검사 `retained + current > 200MiB` 순수 함수(7차 표 4행 골든). 
- `stamp.ts`: 포인터 CSS 좌표 → `u=(clientX−left)/rect.width`, `v=…` → CSS scale viewport 좌표 → `convertToPdfPoint`(주입) · 저장 모델 `{cx, cy, rw, aspect}` · 대상 viewport 적용(폭 = rw×폭, 높이 = 폭/aspect, 넘치면 균등 축소 후 중심 clamp). 골든: N2(400×600 → 600×400 종횡비 불변, 100×10 clamp), D7(DPR 1·2 × CSS 축소 1·0.5 × 회전 4 = 16조합 — PDF.js viewport 는 fixture 로).
- `plan.ts`: 복합 실행 순서(확정 12: 구조 제거/양식 → background → 원문 → foreground → 번호·머리말 → 도장 → raster) 를 **순수 계획 객체**로 산출(실행은 U4-3 이후).
- `preflight.ts`: U4-0 의 `pdf-finish-ocg-preflight` 헬퍼를 **제품 모듈로 이관**(tests/helpers 는 그것을 import 하도록 — 두 사본 금지). 지원 제외 사유 코드는 내부 열거형(사용자 비노출).

## 3. 검증(전부 실행·기록)
`npx tsc -b` · `npm run test:unit`(신규 unit — 각 모듈 골든 + 결정성; **정본 표의 값을 그대로 단언**) · `npm run build` · `npm run test:static` · `TEST_SCOPE=pdf npm run test:browser`(4모드 불변) · `npm run bundle:measure`(U4-0 baseline 대비 — 순수 모듈은 route 에 아직 미연결이므로 delta ≈ 0 기대; tree-shaking 으로 0 이면 그 사실 기록) · `npm run css:orphans` · `node tests/tool-registry-routes.mjs` · `git diff --check` · `test:pdf-finish-oracle` 1회(preflight 이관 후 동일 분류 56/31).
- 기록: CHANGELOG 한 줄 · review-notes U4-1 절(모듈 표·골든 출처·범위 밖 발견) 서명 Codx.

## 4. 금지
main 병합·push · UI/route/기존 모드 변경 · pdf-lib 그리기·worker 호출 · 새 npm 의존 · 정본 미정의 사항의 임의 결정 · 계획서 편집 · 사용자 파일 조작.

## 5. 정지점·보고
커밋 후 브랜치 상태로 정지 → astra 검수. 보고: 모듈별 파일·export 계약·골든 표 ↔ 정본 절 대응 · 검증표 · 범위 밖 발견 · git 상태. 산출물 `/tmp/worklazy-u4-1/`.
