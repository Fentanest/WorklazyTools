# 지시서 — U4-1 구현 검수 (2026-09-07, Claude → Codex **gpt-6-astra**)

## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md`(「모델 역할 분담」 검수: 지시서·정본 대비 누락·왜곡·검증 미실행을 **재현 명령**으로 판정) → 정본 `docs/jobs/todo/pdf-finish-20260905.md`(「정본화」 절 → U4-1 관련 절: 확정 1·7·8·9·10·12·18·21·22·24 + v5 D7·D8 + v6 D2·D3·N1·N2 + v7·v8 N3 + v9 D3 + H2) → sol 지시서 `/tmp/claude-1000/-home-better0101-projects-worklazytools/f5cf1bca-6bf0-442b-b9d4-e7cb45f9c96d/scratchpad/u4-1-dispatch.md` → sol 보고 `/tmp/worklazy-u4-1/REPORT.md`·logs → 자신의 라운드 산출물(`/tmp/worklazy-u4-r3..r12`, 사본 `docs/jobs/todo/pdf-finish-rounds/probes-r*` — E5 좌표/토큰/glyph·E6-2 전처리·date parser·N1 상태 전이·7차 메모리 표).

## 1. 성격·기준
- **검수 잡(쓰기 모드·저장소 불변)** — 저장소 추적 파일 수정·커밋·push·`dist` 변경·브랜치 전환·저장소 안 npm/pip 설치 금지. 산출물 `/tmp/worklazy-u4-1-review/`. 현재 브랜치 `s3-pdf-finish` HEAD `fd37ceab057ced2941fb752b2511124dbeaafda4`, `main` `5bc6854175331bdd73b267784d9633cdccda8446`. 시작·종료 `git status --porcelain`·HEAD 불변 증명(untracked 사용자 파일 3개만: `after.docx`·`before.docx`·`naver…html`).
- 빌드는 **직렬**, `NODE_OPTIONS=--max-old-space-size=4096`(병렬 vite 빌드 메모리 압박 실측).

## 2. 검수 항목(재현 필수 — 정본 표의 값을 직접 unit 또는 node 로 재계산)
1. **범위 준수**: `git diff --stat main..HEAD -- src/` 가 `src/features/pdf-editor/finish/**` **만**인가(preflight 이관에 따른 `tests/helpers/pdf-finish-ocg-preflight.mjs` 의 import 전환 허용). React/worker/pdf-lib 그리기 호출 0(`rg` 로 `pdf-lib` draw*, `react`, `Worker` 검색). route·registry·locale 변경 0.
2. **geometry**: 회전 4종 × CropBox 비영점 → 6영역 앵커·upright 회전각이 3차 E5 골든과 일치. 혼합 크기 페이지 별 산출.
3. **selection**: N1 골든(`2-8+even` 3쪽 토글 → `{2,3,4,6,8}`·`2-4,6,8`), `anchor=max(startPage, excludeCover?2:1)`, `displayNumber`, `{pages}`=물리 총수, 빈 set 플래그, 하한 disabled 판정(D2 산식 대입 검산).
4. **tokens**: 단일 pass(치환 결과 재해석 금지 — `{{page}}`·`{da{page}te}` 류 반례 직접 시도), 알 수 없는 토큰 리터럴+경고, date 화이트리스트 허용 5·오류 4·보충 14 전수, clock 1회 캡처(주입 clock 호출 횟수 단언).
5. **text**: 전처리 순서(토큰→CRLF/CR→TAB→C0/DEL/C1→LF 분리) E6-2 골든 전수(`A\tB\r\nC\rD`, NUL/VT/U+0085, `A×80+🙂`, 12pt `…` 3사례, 50×28.8 2줄, 높이 10). coverage 순서 Helvetica `encodeText` → Noto `getCharacterSet`, 문서당 단일 폰트 결정, D8 3사례(`Résumé €`·`Русский`·`ή U+03AE`). width 계산 입력 = draw 입력 동일 run 인지 코드로 확인. 여백 합 ≥ 치수 필드 오류.
6. **tiles**: 400/420/361 골든, 401번째 **생성 전** 중단(루프 카운트 단언), gap<0·폭 0 오류.
7. **canvasPolicy**: A 판정(scale=DPI/72·rotation·UserUnit → ceil·면적·RGBA·maxSide/maxArea 4,096²) + DPI 하향 300→200→150 + 150 위반 판정, B 는 지표만(판정 없음 — 코드에 throw/flag 없는지), 사전 경고식 계수 주입, 메모리 폴백 `retained+current>200MiB` 7차 표 4행.
8. **stamp**: N2(400×600→600×400 종횡비 불변·100×10 clamp), D7 16조합(DPR×CSS 축소×회전) — fixture viewport 로 재실행, `convertToPdfPoint` 주입.
9. **plan**: 확정 12 순서(구조 제거/양식 → background → 원문 → foreground → 번호·머리말 → 도장 → raster) 순수 객체, 실행 부작용 0.
10. **preflight 이관**: 제품 모듈 ↔ `tests/helpers` 두 사본 없음(helper 가 import), `npm run test:pdf-finish-oracle` 허용 56/제외 31 동일, 사유 코드 사용자 비노출(locale 문자열 미참조).
11. **검증 재현**: `npx tsc -b` · `npm run test:unit`(신규 unit 개수·전수 통과) · `npm run build` · `npm run test:static` · `TEST_SCOPE=pdf npm run test:browser` · `npm run bundle:measure`(U4-0 baseline 대비 5종 delta — tree-shaking 0 여부 실측) · `npm run css:orphans` · `node tests/tool-registry-routes.mjs` · `git diff --check`. production `dist` entry/route SHA ↔ main 빌드 대조(순수 모듈 미연결 → 동일 기대).
12. **범위 밖 발견 — strip-only `.ts` loader**: sol 이 `tests/helpers/pdf-finish-ocg-preflight.mjs` 에 제품 `preflight.ts` 하나만 처리하는 타입 제거 loader 를 두었다(`/tmp/worklazy-u4-1/oracle-bootstrap-failure.log`·`oracle-import-smoke.log`). 판정: ① 저장소에 이미 있는 `.ts` 실행 경로(unit 러너·`tsx`·`vitest`·Node `--experimental-strip-types` 등 `package.json`/기존 tests 관행)를 재사용하지 않은 이유가 타당한가 ② 손수 만든 strip 이 `preflight.ts` 문법 변화(enum·generics·`satisfies`)에 깨질 위험·회귀 신호가 있는가 ③ 두 사본 금지 계약이 실질적으로 지켜지는가(helper 가 제품 모듈의 **동일 코드**를 실행하는지 — 변형 후 로직 diff 0 증명). 더 단순한 정본 경로가 있으면 수정 지시로.
13. **unit 밀도**: 신규 12 case 가 지시서의 골든 전수(date 허용 5·오류 4·보충 14, D7 16조합, 7차 메모리 표 4행, E6-2 전수, E5 회전×CropBox, N1·N2)를 **실제로 단언**하는지 케이스 ↔ 골든 매핑표를 만들어 누락을 열거한다.
14. **기록**: CHANGELOG·review-notes U4-1 절 ↔ 코드·로그 원문 정합. 「범위 밖 발견」 각 항 판정(정본 미정의 임의 결정이 코드에 들어갔는지).

## 3. 판정 형식
| 항목 | 판정([통과]/[결함]/[미검증]) | 재현 명령·출력 | 수정 지시 문안 | · 심각도 · 마지막 **[검수 통과] / [수정 후 재검수]**. 산출물 `/tmp/worklazy-u4-1-review/REPORT.md`.
