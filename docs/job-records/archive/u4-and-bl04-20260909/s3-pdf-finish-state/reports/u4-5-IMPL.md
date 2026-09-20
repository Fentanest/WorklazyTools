# U4-5 PDF 도장·서명 이미지 구현 보고

날짜: 2026-09-08  
브랜치/기준: `s3-pdf-finish` / `89873f7b1e0c4a32e41b0acb8120e5e289c60fcb`  
판정: **완료 — 단계 커밋 후 정지**  
구현 커밋: `8ec3e4edd97439dfc5b7807645d22c8373d69d11`

## 결론

`/tools/pdf-editor/stamp`에 PNG/JPEG 도장·서명 이미지 삽입을 구현했다. 저장 좌표는 화면 픽셀이나 raw PDF 좌표가 아니라 회전된 visual viewport의 정규화된 중심 `(cx, cy)`, 상대 폭 `rw`, 원본 비율 `aspect`다. 각 선택 페이지에서 사각형의 네 모서리를 복원한 뒤 기존 `viewportPointToPdf` 변환에 각각 통과시켰으며, 변환 결과를 scale로 다시 나누지 않았다.

미리보기에서 포인터 이동과 오른쪽 아래 핸들의 비율 고정 크기 조절, 선택 페이지 전체의 동일 상대 위치 적용, undo/redo, 키보드 사용자를 위한 방향 이동·확대·축소 버튼을 제공한다. 이미지 교체 시 해당 이미지의 history를 새로 시작한다. ko/en 화면에는 이미지 삽입일 뿐 공인 전자서명이나 인증서 기반·암호학적 디지털 서명을 만들거나 검증하지 않는다는 경고를 표시한다.

## 실행 게이트와 보호 범위

- `PROJECT_RULES.md`, `AGENTS.md`, 정본 `docs/jobs/todo/pdf-finish-20260905.md`, U4-5 디스패치와 선행 보고를 구현 전에 전문 확인했다.
- 시작 브랜치와 HEAD가 지시값과 일치했고, 열린 계획서에 동일 표면의 상충 지시는 없었다.
- 유효 baseline은 schema v3 `/tmp/worklazy-u4-4-review5/evidence/bundle-baseline.json`, SHA-256 `4caaa9c6c48df99dd740664d7991c995ffff7e8b6deaa7a1d87e982d302c30ea`다. schema v2 `/tmp/s3-bundle-baseline.json`은 사용하지 않았다.
- `CLAUDE.md`, `PROJECT_RULES.md`, `after.docx`, `before.docx`, 네이버 확인 HTML, `newui/`는 기존 사용자 변경 그대로 두고 수정·stage하지 않았다.
- 금지된 다른 worktree에는 접근하지 않았고, 포트는 4280~4289에서 `--strictPort`로만 사용했다.
- main 병합, push, 배포는 수행하지 않는다.

## 구현 계약

1. `PdfStampSettings`와 history 모델은 정규화 placement와 이미지 바이트를 보관한다.
2. CSS 포인터 좌표는 preview `getBoundingClientRect()` 기준 viewport 좌표로 한 번 변환한다.
3. 대상 페이지마다 `applyNormalizedStamp`가 회전된 visual viewport의 TL/TR/BL/BR 네 모서리를 만든다.
4. 네 점은 PDF.js viewport의 기존 inverse transform인 `viewportPointToPdf`에 각각 들어간다. CropBox, UserUnit, 회전, scale 처리는 이 단계에 포함되므로 별도 scale 나눗셈은 없다.
5. 네 PDF 점으로 affine image matrix를 만들고 독립 foreground Artifact content stream에 PNG/JPEG XObject를 그린다.
6. 페이지 선택은 기존 전체/범위/썸네일 선택 계약을 재사용하며, 선택된 모든 페이지에 같은 상대 좌표를 적용한다.
7. history 범위는 현재 업로드 이미지의 위치·크기다. drag/resize/방향 이동/확대·축소는 commit되고, 새 이미지를 선택하면 초기 placement로 history가 재설정된다.

## 골든 ⑤ 렌더 픽셀 원출력

fixture는 비영점 CropBox, UserUnit `1/1.25/1.5/2`, 회전 `0/90/180/270`인 혼합 4페이지다. DPR `1/2` × CSS 표시 배율 `1/0.5` × 회전 4종의 16조합에서 CSS→viewport 모델과 실제 출력 픽셀 경계의 위치·크기·비율을 비교했다.

| 검증 | 결과 | 원출력 |
|---|---|---|
| 좌표 조합 | PASS — 16/16 | `/tmp/worklazy-u4-5/golden/metrics.json` |
| PDF.js 출력 | PASS — 4/4 페이지 | `stamp-all-pages-pdfjs-{1..4}.png` |
| Poppler 출력 | PASS — 4/4 페이지 | `stamp-all-pages-poppler-{1..4}.png` |
| 선택 페이지 `1,3` | PASS — `[true,false,true,false]` | `stamp-selected-pages.pdf`, `stamp-selected-pages-pdfjs-{1..4}.png` |

원본 PDF는 `/tmp/worklazy-u4-5/golden/stamp-all-pages.pdf`와 `stamp-selected-pages.pdf`에 있다. 기존 워터마크 골든도 PDF.js/Poppler 160개 렌더를 함께 재실행해 통과했다.

## 번들 5종

사용자 결정에 따라 `scripts/measure-bundle-budget.mjs`의 `affectedRouteJsGzip` 한 줄만 `60 * 1024`에서 `72000`으로 바꿨다. 다른 네 상한, override `{}`, multiplier `1`은 불변이다. 다른 route 감소는 PDF route 증가의 상쇄로 쓰지 않았다.

| 지표(gzip) | schema v3 대비 증분 | 상한 | 잔여 | 결과 |
|---|---:|---:|---:|---|
| entry JS | 8,888B | 20,480B | 11,592B | PASS |
| PDF route JS | **61,879B** | **72,000B** | **10,121B** | PASS |
| shared JS, 귀속 이동 제외 | 2,400B | 30,720B | 28,320B | PASS |
| app JS | **74,059B** | **81,920B** | **7,861B** | PASS |
| CSS | 376B | 10,240B | 9,864B | PASS |

scoped PDF route 절대값은 1,139,166B다. 시작 app 증분 68,572B/잔여 13,348B에서 이번 단계가 5,487B를 사용해 7,861B를 남겼다. app 상한은 올리지 않았다. scoped 증거는 `/tmp/worklazy-u4-5/bundle-scoped.json`, full route 교차 확인은 `/tmp/worklazy-u4-5/bundle-full.json`이다. 이후 U4-6~U4-8에서 다시 상한을 넘으면 추가 상향을 요청하지 않고 SCOPE-OUT으로 보고한다.

## C-D 9게이트 단계 결과

| 게이트 | U4-5 결과 |
|---|---|
| ① 시각 ko/en | PASS — 영향 45/45 diff 0; stamp 9장 포함 |
| ② 접근성 | PASS — local-QA 6페이지, violations 0, F2 incomplete 0, 기존 상속 incomplete 253, 외부 요청 0 |
| ③ 번들 5종 | PASS — 위 표, schema v3, override `{}`, multiplier 1 |
| ④ CLS ≤0.1 | PASS — 8대상×3회, stamp 최대 `0.0001480365514755249`, 외부 요청 0 |
| ⑤ 광고 격리·로더 | PASS — production static 및 local-QA 외부 요청 0; 기존 광고/정적 검증 유지 |
| ⑥ ko/en·SEO·정적·FAQ·소셜 | PASS — `/stamp` 양 로케일, self canonical, 정적 71페이지, sitemap/소셜 등록 |
| ⑦ build·unit·smoke·static | PASS — 단계 범위 명령은 아래 표; 전 스코프 항목은 정본대로 U4-8 병합 직전 이월 |
| ⑧ 로컬 검수 | Codx DOM/기준선 육안 PASS; Gemini·Claude 검수는 후속 감사 게이트 |
| ⑨ 배포 후 라이브 | 이 단계는 배포 금지; U4-8 단일 배포 뒤 수행 |

## 실행한 검증

| 명령/범위 | 결과 |
|---|---|
| `npx tsc -b` | PASS |
| `npm run test:unit` | PASS — 323/323, fail 0, skip 0 |
| `NODE_OPTIONS=--max-old-space-size=4096 npm run build` | PASS — 2,849 modules, 정적 71페이지 |
| `npm run test:static` | PASS — startup recovery 119 documents |
| `PDF_FINISH_TEST_PORT=4280 ... npm run test:pdf-finish` | PASS — 20 direct entries, upload/drag/resize/undo/redo/대체 버튼/회전 페이지 동일 상대 좌표/3페이지 출력 + 양 렌더러 골든 |
| `TEST_SCOPE=pdf TEST_BASE_URL=http://127.0.0.1:4283 npm run test:browser` | PASS |
| `npm run fixtures:pdf-legacy-oracle` | PASS — client 3, structure 4, render 32, output 4, input 1, total diff 0 |
| local-QA stamp+finish a11y, port 4282 | PASS — 6페이지, violations 0, 외부 요청 0 |
| rendering, port 4284 | PASS — 8대상×3회, 절대 CLS 한도 통과 |
| 영향 visual, port 4281 | PASS — 45/45 diff 0 |
| scoped/full schema-v3 bundle compare | PASS — 5종 모두 통과 |
| `node scripts/apply-dependency-patches.mjs` | PASS — pdfjs-dist 6.2.108 patch |
| `git diff --check`, ko/en JSON parse | PASS |

중간에 local-QA build의 `dist`에 production static 검증을 실행했을 때 analytics 식별자가 의도적으로 제거되어 fail-closed한 것은 QA 모드 음성 대조다. 최종 `dist`는 production build로 다시 생성했고 `test:static`을 통과했다. smoke의 초기 오프스크린 마우스/비동기 attribute 대기는 하네스에서 `scrollIntoView`와 조건 대기로 교정했으며 최종 제품 실행은 전항 통과했다.

## 시각 기준선과 육안 확인

기준선 변경은 총 13장이다.

- 신규 stamp: `pdf-finish-stamp__interaction__{ko,en}__{light,dark}__{desktop,mobile}.png` 8장
- 영어 light 320px: `pdf-finish-stamp__interaction__en__light__mobile-320.png` 1장
- 3→4탭 전환 영향: `pdf-finish-navigation__active__{ko,en}__light__{mobile,mobile-320}.png` 4장

ko/en desktop/mobile/light/dark와 영어 320px 기준선을 직접 열어 도장, resize 핸들, 선택 썸네일, 작업 버튼, 비전자서명 고지의 겹침·잘림이 없음을 확인했다. 상호작용 캡처는 `/tmp/worklazy-u4-5/shots/en-stamp-edited-desktop.png`, 다른 ko/en 캡처는 같은 `shots/` 디렉터리에 있다.

## 병합 직전 1회 이월

정본 checklist에 따라 U4-8 뒤 한 번 실행한다: 전체 `test:browser`, `test:new-tools`, `test:utilities`, `test:office`, `test:qr-bulk`, `test:qr-font-render`, `test:recovery`, `test:excel-*`, a11y 전체, visual 전량, `test:rendering` 전체, `css:orphans`, `legacy:manifest`, `tool-registry-routes`, 성능 12입력, Gemini/Claude 최종 검수와 배포 후 라이브 확인. 이번 단계에서는 PDF scoped browser, finish smoke/golden, 등록된 a11y/rendering, 영향 visual을 실행했다.

## 최종 저장소 상태

- 의도한 구현·테스트·기록·기준선만 한 커밋으로 stage한다.
- 보호 대상 기존 변경은 working tree에 그대로 남긴다.
- 커밋 후 push/merge/deploy 없이 정지한다.
- 상세 JSON, PDF/PNG 렌더 원출력, 화면 캡처는 `/tmp/worklazy-u4-5/`에 보존한다.
