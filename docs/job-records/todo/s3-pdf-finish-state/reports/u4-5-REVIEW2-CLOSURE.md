# U4-5 fix-1 최소 범위 재검수 — Codx

**[검수 통과] — R1·R2 해소를 확인했으며 U4-5를 종결한다.** 이번 수정이 만든 미해결 차단 결함은 0건이다. U4-5 최초 구현의 P3 및 기존 부채는 백로그 이월로 유지한다. U4-6 구현 착수·main 병합·배포를 수행한 보고가 아니다.

검수일: 2026-09-08. 대상 `s3-pdf-finish`, HEAD **`79c20710b756d58d87fe2e0bdb9cc51782855c82`**, 부모 `8ec3e4edd97439dfc5b7807645d22c8373d69d11`.

## 실행 게이트·격리

첫 도구 호출로 주 저장소 `PROJECT_RULES.md` 전문을 읽고 AGENTS, review2/fix1 지시서, 이전 astra/sol 보고와 원본 세 probe·원수치, 관련 review-notes/기각 이력, PDF 정본, 누적 이월 checklist를 확인했다. 기준 branch/HEAD가 일치하며 열린 계획서의 PDF 및 공용 감사 관련 지시와 이번 검수의 상반된 실행 지시는 없었다. [열린 계획 검색 증거](evidence/open-plan-gate.txt).

`git archive 79c2071 | tar -x -C /tmp/worklazy-u4-5-review2/repo`로 검증 사본을 만들었다. 부모 출력 대조용 `git archive 8ec3e4e`도 같은 산출물 루트의 `parent/`에 두었다. 의존·vendor는 복사본을 사용했다. 단위 검사의 git 읽기는 원본 object DB와 `/tmp`의 별도 index/archive worktree를 연결했다. 원본 index/refs 쓰기는 없었다. 모든 검증은 `NODE_OPTIONS=--max-old-space-size=4096`, TMPDIR를 이 디렉터리 아래로 고정하고 직렬 실행했다.

4270의 기존 listener를 확인한 뒤 건드리지 않고 **4271 `--strictPort`**에서 자체 QA 서버를 사용했다. production 검증·번들 측정 후 `VITE_LOCAL_QA=1 npm run build`로 추적 없는 브라우저 검수용 빌드를 따로 만들었다. 접근 금지 `/tmp/worklazy-xd*`, `/tmp/worklazy-xr*`, `/tmp/worklazy-dc-impl` 및 주 저장소 미추적 사용자 4항목의 내용에 접근하지 않았다.

아래 실행명은 [commands.jsonl](evidence/commands.jsonl)의 정확한 명령 배열·종료 코드·소요 시간과 연결된다. 공통 실행기는 [run.py](run.py)이며 각 명령의 cwd는 archive `repo/`다.

## 판정표

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| A1 원본 골든 무수정 | 통과 | `node --import ../probes/astra-adapter.mjs ../probes/golden-ui.mjs`, 같은 어댑터의 `../probes/verify-golden.mjs`: 16/16, max **1 CSS px**, 두 명령 exit 0. [원출력](evidence/original-golden.log), [verify](evidence/original-verify.log) | 없음 |
| A2 이미지/model DOM | 통과 | 원본·정규 골든 모두 border 0px, image/model x/y/w/h 일치, DPR 1/2와 canvas backing 520/1040. [정규 원수치](evidence/stamp-golden/metrics.json) | 외부 outline 유지 |
| A3 정규 실제 픽셀 골든·mutant | 통과 | 정규 `test:pdf-finish`의 실제 16조합 pass. `border:2px;outline:none` 주입은 정규 검사 exit 1. 구조 단언 3개만 제외한 별도 사본도 실제 픽셀 `[5,2,-8,-3]`로 exit 1. [정규 mutant](evidence/mutant-official.log), [픽셀 mutant](evidence/mutant-pixel-only.log) | 계산 사각형으로 대체하거나 임계치를 완화하지 말 것 |
| A4 출력 무변경 | 통과 | 부모/HEAD에서 같은 정규 fixture·배치 실행, **PDF 2개·렌더 PNG 12개 byte-identical**. 실제 UI도 두 테마×desktop/mobile 4쌍에서 같은 canvas-relative drag/resize → 같은 모델·PDF SHA. [바이트 증명](evidence/output-byte-equivalence.json), [UI 대조](evidence/output-and-outline/metrics.json) | 좌표/출력 엔진 보존 |
| A5 가시성·대비·초점·겹침·터치 | 통과, 기존 P3 이월 | 선택선 2px·PDF 흰 배경 대비 **5.894956:1**, 인접 실제 버튼/input 교차 0, 외부 outline의 포인터 가로채기 false. 8프로필×6대체버튼 **48 Tab/Enter**·visible focus·≥44×44 통과. 직접 핸들 **24×24 유지**. [DOM](evidence/output-and-outline/metrics.json), [키보드/고지](astra-original/evidence/contracts-settled/metrics.json) | 기존 작은 resize/24px 핸들 P3는 백로그 유지 |
| A6 시각 기준선 9장 | 통과 | 부모→HEAD 차이는 도장 이미지 경계/선택선/핸들 영역으로 한정. 파일별 아래 표·9장 직접 열람. 영향 visual **45/45** 기준선 갱신 없이 통과. [원출력](evidence/visual-corrected.log) | 이번 기준선 수용; 검사기 자체의 픽셀 근거와 함께 보존 |
| B7 원본 접근성 probe | 통과 | 원본 SHA 그대로, 실제 unresolved F3 **2노드**를 `F3 stamp editing incomplete node lost ownership`으로 거부. probe exit 0. [원출력](evidence/original-a11y.log), [노드](astra-original/evidence/a11y-gate-probe.json) | 없음 |
| B8 F3 분류·원근거 유지 | 통과 | `f3-stamp`/`[data-pdf-stamp-owned]` 등록. `resolvedIncomplete`에 target/reasons/owner/measurementTarget 유지. 미해결 F3를 shared-existing으로 면제하지 않음. [감사 결과](evidence/a11y.json) | 통합 시 Excel/F2/F3 소유 범주 모두 보존 |
| B9 기본 편집 상태 생성 | 통과 | 기본 pages에 ko/en×light/dark 4상태. 정규 감사가 실제 PDF/PNG 업로드 후 tab/notice/settings/overlay marker 각 1개를 측정, 각 상태 axe passes24/violations0. 총 지정10상태 exit0 | 이 등록을 최종 full 감사에 포함 |
| B10 음성 4종 | 통과 | 실제 DOM marker 제거, 실제 axe target 변경, 측정 결과 1개 누락, 실제 F3 unresolved 노드 잔존을 **각각 exit 1**로 거부. [판정 목록](evidence/negative-verdicts.json) | 단위검사 결과만으로 대체하지 않고 이번 주입 증거 보존 |
| B11 대비·미확정 보존 | 통과 | 이전과 같은 8프로필 측정법에서 본문 light **5.864846**/dark **13.079018**, 제목 light **14.656725**/dark **17.380519** 그대로. 정규 감사 F3 unresolved0, pixel-resolved14, inherited247 유지 | 기존247을 전체 접근성 해소로 표기하지 말 것 |
| C12 되돌림 4항 | 통과 | legacy **totalDiffs0**, watermark **128+32=160**, 의존6.2.109 주입 **Vite 전 exit1**, smoke 완료 로그/내부분기 확인 **조용한 skip0**. [legacy](evidence/legacy.log), [smoke/golden](evidence/pdf-finish.log), [의존음성](evidence/dependency-negative.log), [완료목록](evidence/smoke-completeness.json) | 없음 |
| C13 좌표·5예산·4모드·20도구·고지 | 통과 | 모델/engine/geometry/selection/watermark 및 예산 스크립트·의존·locale·registry 부모와 동일. 기존4모드 legacy oracle, 정규화/네모서리/1회 inverse 유지, 20도구. 5종 예산 아래 표. [소스 대조](evidence/code-contracts.json) | 잔여 예산을 다음 정본에 반영 |
| D14 좁은 회귀 | 통과 | tsc0, unit **327/327 skip0**, production/QA build0, pdf-finish0, legacy0, scoped bundle0, scoped a11y0, 영향visual45/45, diff-check0. diff **16파일 +441/−25**. [diff stat](evidence/change-stat.txt), [diff-check](evidence/diff-check.log) | 전량은 U4-8 뒤 1회 |

## R1 검증의 범위와 재현

세 원본 probe는 내용을 바꾸지 않은 복사본이며 SHA-256을 대조했다. 고정된 이전 출력 경로를 `astra-original/`로 연결하는 fs/Playwright 경로 어댑터만 사용했다. 포트 4271은 그대로이며, a11y의 상대 import는 `probes/repo` 심볼릭 링크를 통해 이번 archive의 정규 감사 코드로 연결했다. 수치 계산·단언·fixture·반복 수·임계치는 수정하지 않았다. 이전 검수 원본 파일·metrics는 보존했다. [원본 SHA](evidence/original-probe-sha256.json), [경로 어댑터](probes/astra-adapter.mjs).

`PdfStampOverlay.tsx:127`은 `outline-solid outline-2 outline-violet-600`, 내부 img는 `h-full w-full object-contain`이다. outline은 레이아웃 content box를 줄이지 않는다. 정규 `tests/pdf-stamp-golden.mjs:222`의 **canvas-area screenshot(device scale)** → 다운로드 Blob의 PDF → `renderDownloadedStampPage`에서 **css.width×DPR / output viewport width**로 렌더 → 같은 bitmap 크기의 실제 적색 픽셀 경계 비교 경로를 확인했다. 기존 순수 좌표 16조합도 별도로 유지한다. 이 골든은 위치·크기·비율 경계 검증이며 사진의 모든 RGB 픽셀 동일성 검사로 확대하지 않는다.

아래 벡터는 `[x,y,width,height]`, preview−output, CSS px다.

| DPR | CSS 폭 배율 | 회전 | 부모 원본 probe | 수정본 원본 probe | 수정본 max |
|---:|---:|---:|---|---|---:|
| 1 | 1 | 0° | `[5, 2, -8, -3]` | `[1, 0, 0, 1]` | 1 |
| 1 | 1 | 90° | `[5, 2, -8, -4]` | `[1, 0, 0, 0]` | 1 |
| 1 | 1 | 180° | `[5, 3, -8, -5]` | `[1, 0, 0, 0]` | 1 |
| 1 | 1 | 270° | `[5, 2, -8, -3]` | `[1, 1, 0, -1]` | 1 |
| 1 | 0.5 | 0° | `[5, 2, -8, -4]` | `[1, 0, 0, 0]` | 1 |
| 1 | 0.5 | 90° | `[4, 3, -7, -5]` | `[0, 0, 1, 1]` | 1 |
| 1 | 0.5 | 180° | `[5, 2, -8, -4]` | `[1, 0, 0, 0]` | 1 |
| 1 | 0.5 | 270° | `[4, 2, -7, -4]` | `[0, 0, 1, 0]` | 1 |
| 2 | 1 | 0° | `[5, 2.5, -8.5, -4]` | `[1, 0.5, -0.5, 0]` | 1 |
| 2 | 1 | 90° | `[4.5, 2, -8, -4]` | `[0.5, 0, 0, 0]` | 0.5 |
| 2 | 1 | 180° | `[5, 2.5, -8.5, -4]` | `[1, 0, -0.5, 0]` | 1 |
| 2 | 1 | 270° | `[4.5, 2, -8, -3.5]` | `[0.5, 0.5, 0, 0]` | 0.5 |
| 2 | 0.5 | 0° | `[5, 2, -8.5, -3.5]` | `[1, 0, -0.5, 0.5]` | 1 |
| 2 | 0.5 | 90° | `[4, 2.5, -7.5, -5]` | `[0, 0.5, 0.5, 0]` | 0.5 |
| 2 | 0.5 | 180° | `[4.5, 2, -8, -3.5]` | `[0.5, 0, 0, 0]` | 0.5 |
| 2 | 0.5 | 270° | `[4, 2.5, -7.5, -4.5]` | `[0, 0, 0.5, 0]` | 0.5 |

Mutant는 [브라우저 CSS 주입기](probes/mutant-adapter.mjs)로 실제 선택 표시만 `border`로 되돌렸다. **무수정 정규 골든**은 먼저 DOM 구조 단언에서 실패한다. 그 실패가 픽셀 비교를 가리는지 확인하기 위해 별도 `repo/tests/review2-pixel-only.mjs`에서 DOM 구조 단언 세 개만 제외했다. 캡처/다운로드/렌더/비교/2px 임계는 그대로이고, 첫 조합의 실제 픽셀 8px 차이로 실패했다. 이 보충 사본을 원본 probe 무수정 결과와 혼동하지 않는다. 주입은 개별 browser context에만 적용되어 정상 서버/제품 소스에 남지 않는다.

부모·수정본의 정규 출력 SHA:

| 파일 | 두 커밋 공통 SHA-256 |
|---|---|
| `stamp-all-pages.pdf` | `3831baa3abd1817e83f56928be578a7061f3686179e670475a43abf789568156` |
| `stamp-selected-pages.pdf` | `12ad29d42e992cd545ca78129f45ebffc5c6d0997ec5c6f4ea038f5850df8548` |

실제 UI의 같은 canvas-relative 포인터 조작은 desktop의 전후 SHA `e158428bcd863c8a5d8da916ff2504f15f82d353d9c84019ccd97a93dfe0e449`, mobile은 `86181ea46acc149c3d8fb62e42cb8beb539e4a60a7307b4acb7123fa3ed0628c`로 light/dark 모두 같다. 직접 overlay의 tabindex는 부모와 같이 −1이며 키보드 조작/초점 검증은 실제 대체 버튼 6개를 대상으로 했다. 24px resize 핸들을 44px로 통과시켜 쓰지 않았다. [UI 원출력](evidence/output-and-outline-settled.log).

## R2 음성 주입과 대비

| 주입 | 실제 거부 지점·출력 | 증거 |
|---|---|---|
| F3 소유 표식 제거 | 업로드 후 실제 overlay DOM에서 속성 제거 → required marker matches0 → `F3 stamp editing ownership marker is missing or ambiguous` | [로그](evidence/a11y-negative-marker.log) |
| target 미발견 | 실제 axe 노드의 target을 존재하지 않는 selector로 바꿈 → `Accessibility incomplete target is missing` | [로그](evidence/a11y-negative-target.log) |
| 결과 누락 | 정상 측정10상태 결과를 먼저 통과시킨 뒤 `pdf-stamp-editing-en-dark` 결과만 제거 → `Accessibility page registration mismatch` | [로그](evidence/a11y-negative-result.log) |
| 미해결 잔존 | 실제 고지 노드/reasons를 보존해 픽셀 해소 대상 외 incomplete rule로 주입 → `f3IncompleteNodes:1` → `F3 accessibility incomplete nodes must be resolved` | [로그](evidence/a11y-negative-unresolved.log) |

[주입기](probes/a11y-injection.mjs)는 정규 감사 코드/한도를 수정하지 않는다. [결과 누락 probe](probes/a11y-result-missing.mjs)도 실제 정상 보고서를 사용한다. 모든 음성은 단순 exit1 확인에 더해 예상한 거부 문구를 별도로 단언했다.

정규 감사의 1280px·전 배경 픽셀 측정은 편집 본문 light5.8648/dark13.0790, 제목 ko14.6179/17.3805·en14.5232/17.2436이다. 이전 1365/390px·가장자리2px 제외 측정법과 비교하려고 같은 [기존 contracts probe](probes/contracts-ui.mjs)를 다시 실행했으며 8프로필에서 이전 본문/제목 네 수치가 소수점까지 재현됐다. 표본/측정법 차이를 화면 대비 회귀로 판정하지 않는다. 16개 실제 F3 incomplete 원근거를 보존했고, 정규 결과에서는 측정값과 연결된 `resolvedIncomplete`로 분리했다.

## 시각 기준선 파일별 판정

아래 수치는 안티앨리어싱을 제외하지 않은 **정확한 RGB 차이 픽셀 수**라 sol 보고의 pixelmatch 유의 차이 수(782/587)와 지표가 다르다. bbox 밖 변화는 0이다. [9장 전후/차이 합성](evidence/visual-baseline-diff/nine-pairs.png)을 직접 열람했다. 각 파일은 이미지가 모델 전체를 채우면서 선택선이 외부로 옮겨지고 핸들 기준 위치가 바뀐 실제 변화만 포함한다.

| 기준선 파일 (`pdf-finish-stamp__interaction__` 뒤) | 정확한 차이 픽셀 | 변화 bbox `(x0,y0,x1,y1)` | 판정 |
|---|---:|---|---|
| `en__dark__desktop.png` | 1,657 | `[1161, 527, 1276, 593]` | 도장/선택선/핸들만 변경, 수용 |
| `en__dark__mobile.png` | 1,441 | `[227, 413, 327, 471]` | 도장/선택선/핸들만 변경, 수용 |
| `en__light__desktop.png` | 1,657 | `[1161, 527, 1276, 593]` | 도장/선택선/핸들만 변경, 수용 |
| `en__light__mobile-320.png` | 1,169 | `[184, 340, 265, 388]` | 도장/선택선/핸들만 변경, 수용 |
| `en__light__mobile.png` | 1,441 | `[227, 413, 327, 471]` | 도장/선택선/핸들만 변경, 수용 |
| `ko__dark__desktop.png` | 1,657 | `[1161, 527, 1276, 593]` | 도장/선택선/핸들만 변경, 수용 |
| `ko__dark__mobile.png` | 1,441 | `[227, 413, 327, 471]` | 도장/선택선/핸들만 변경, 수용 |
| `ko__light__desktop.png` | 1,657 | `[1161, 527, 1276, 593]` | 도장/선택선/핸들만 변경, 수용 |
| `ko__light__mobile.png` | 1,441 | `[227, 413, 327, 471]` | 도장/선택선/핸들만 변경, 수용 |

영향 visual은 stamp/navigation/page-numbers/header-footer/watermark 5군, **45/45**를 실행했다. 기준선 update 옵션은 사용하지 않았다. [실제 캡처](repo/tests/visual-artifacts/review2), [원출력](evidence/visual-corrected.log).

## 번들 잔여 예산

고정 schema-v3 baseline `/tmp/worklazy-u4-4-review5/evidence/bundle-baseline.json`, SHA-256 `4caaa9c6c48df99dd740664d7991c995ffff7e8b6deaa7a1d87e982d302c30ea`. `BUNDLE_ROUTES=pdf-editor`, override **{}**, multiplier **1**. 상한 스크립트는 부모와 동일하며 다른 route 감소로 PDF 증가를 상쇄하지 않았다.

| gzip 지표 | baseline 대비 증가 | 상한 | 잔여 |
|---|---:|---:|---:|
| entry JS | 8,878B | 20,480B | **11,602B** |
| PDF route JS | 61,923B | 72,000B | **10,077B** |
| shared JS (귀속 이동 제외) | 2,407B | 30,720B | **28,313B** |
| app JS | 74,107B | 81,920B | **7,813B** |
| CSS | 393B | 10,240B | **9,847B** |

앱 잔여는 직전 **7,861→7,813B (48B 소비)**, PDF route 잔여는 **10,121→10,077B (44B 소비)**다. PDF route 절대 gzip은 **1,139,210B**. 이 값은 검수 대상 `79c2071`의 측정이며 main 통합본은 병합 직전 다시 측정한다. [scoped 원자료](evidence/bundle-scoped.json).

## U4-6 착수 조건

U4-5의 R1/R2 차단은 해소됐다. 다음 **U4-6(F4a 구조 제거·양식 flatten·링크 보존 고지)**는 정본 **확정 5·11·27 및 D4 최종 v13 보정**을 반영한 단계 지시서와 Claude–Codex 이견0 확인 후 착수할 수 있다. 기준 해시·최신 main·열린 계획 충돌 게이트를 다시 고정해야 한다.

- **골든④: 제거 후 문서 전체 indirect-object 검사로 orphan 부재 증명.** 제거 대상의 본문/annotation/metadata/ref 잔여와 미사용 객체까지 검사한다.
- AcroForm 미선택 시 보존, **제거/flatten 배타 모드**, flatten 후 dangling Widget ref 정리와 최종 재구축을 고정한다. **XFA·서명 필드·AP 없는 필드는 flatten 지원 제외**로 사전 고지한다. 일반 주석은 subtype별로 처리하며 임의 annotation flatten은 지원하지 않는다. Info+XMP 제거 시 `updateMetadata:false`, 첨부는 복사 전 필터 후 전체 indirect stream의 payload sentinel 부재를 단언한다.
- Link의 URI·직접 Dest·이름 Dest를 보존하고 새 page ref로 재매핑한다. 실행 전에 **“하이퍼링크는 유지됩니다”**를 고지한다. 문서 구조 보존/지원 제외표도 함께 적용한다.
- OC 문법·전객체 탐색·Type3 지원 제외와 허용집합의 **PDF.js/Poppler 원본/결과 RGBA SHA**를 게이트에 둔다. 현 정본 manifest **허용4·제외31 + 직접배열32 + 대표20** 회귀를 유지한다.
- 위 **app7,813B/PDF10,077B** 및 나머지 고정 잔여를 다음 정본의 출발값으로 쓴다. 다시 초과하면 추가 상향 대신 **SCOPE-OUT**으로 감량/구조 변경 판정에 넘긴다.

## 누적 이월 목록 — U4-8 뒤 통합본에서 1회

주 저장소의 checklist/backlog 수정은 금지되어 이 보고서가 **Claude 취합용 갱신 문안**이다. 기존 checklist 13묶음을 빠짐없이 보존하고 U4-5에서 추가한 실제 골든/게이트/음성을 아래에 합쳤다. 이번 scoped 통과를 최종 통합 결과로 대체하지 않는다.

1. 최종 통합본 tsc, production build, unit 전체, **test:static**, diff-check.
2. **전체 test:browser**, new-tools, utilities, office, QR bulk/font 2종, recovery. 기존 PDF4모드와 `TEST_SCOPE=pdf` 실행군 확인.
3. **Excel cleaner/compare 2종**, xls-preserve, xls-first-load, video-hybrid 및 공용 기반 회귀.
4. 전체 PDF finish/공식 골든, legacy diff0, fixture 결정성2회, pdf-finish-oracle. **U4-5 추가: 실제 preview↔download16조합, 선택페이지 상대복제, 이미지교체 history, keyboard48, border mutant(구조·실제픽셀)**.
5. inline payload/EI, descender/Noto/회전, 0배치·1픽셀·공백·6영역·400/401타일, zero/불확실 clip, 재개방, 소유/원시 구현명 비노출 경계.
6. **성능12입력×3** 및 cold 경로. 16/32/64MiB 각 실행 ≤200ms, 128MiB 기존 미달/진행 paint·외부취소≤250ms·늦은결과0·retry/fallback 대체 계약.
7. 의존 exact/lock/4SHA/멱등성/음성. 의존 변경 시 4빌드×180렌더·scalar/tail·5음성·worker/fallback 전체 갱신.
8. **visual ko/en 전량**, 등록 전체·양 테마·320/390px·모바일 하단·시간 상한. 최종 실행에서는 이번 filter를 제거.
9. **a11y 전량**: F2 오류4/표시실패4 및 reload3상태. **U4-5 추가: F3 기본 편집ko/en×light/dark, 오류/history/keyboard, target/reasons/owner와 픽셀근거, 표식제거·target미발견·결과누락·미해결잔존 4음성**. 공용 부채 별도 유지.
10. **rendering 전량**, CLS≤0.1 절대 게이트와 새 경로 등록.
11. 최종 production schema-v3 **scoped+full bundle**, physical census/raw network/양방향 inventory/같은 SHA별칭·내용변경·누락mjs 음성. 5상한/override/multiplier 유지.
12. **css:orphans, legacy:manifest, tool-registry-routes** 전량,20도구·locale/SEO/FAQ/정적/social/canonical/hreflang/sitemap/광고 격리.
13. 추적 없는 QA에서 **Gemini 실제 브라우저·Claude 육안·Codex DOM 통합 검수**. 모바일 정렬/label/Tab가림/하단탭/토글 내부정렬 포함.

U4-6~8 완료 후 골든①~⑦, F4a 구조/양식/링크 및 전체 indirect-object, OC 허용집합 두 렌더러 SHA, F4b **4fixture×3쪽수×3DPI×2포맷×2환경**·가독성/용량/메모리·포맷 oracle, F5 복합 실행·공유 font 단일임베드·다중결과/ZIP을 최종 게이트에 합류시킨다. 배포·라이브 검수는 이후 1회 배포 단계다.

이번에는 금지된 full browser/new-tools/utilities/office/QR/recovery/Excel2종/full a11y/full visual/full rendering/css:orphans/legacy:manifest/standalone tool-registry-routes/성능12입력을 실행하지 않았다. 정규 pdf-finish 스모크 안의 청크 재로딩/취소는 지시된 검사 자체의 일부다.

## 결함 귀속·백로그 문안

이번 fix1이 만든 새 차단 결함은 없다. 아래는 이번 수정 전부터 있는 항목이며 종결을 막지 않는다.

| 항목 | 귀속·우선순위 | 이월 문안 |
|---|---|---|
| BL-U4-5-01 작은 resize·핸들 | U4-5 최초 구현의 **P3**, fix1 생성 아님 | 직전 실폭260px에서 1px 조작 시 폭72.796875→69.78125px. grab offset/delta 후속과 **24×24 핸들**의 hit area44 검토. 이번에는 resize 알고리즘 무변경·타깃24 유지 확인, 작은 조작 재탐색은 범위 밖 |
| BL-U4-5-02 scoped browser 성공 문구 | 기존 **P3** | PDF scope의 로그가 Excel/Word 수행도 주장하는 기존 문구. 실제 실행 scope에 맞춰 출력하도록 별도 처리 |
| 공용 UI incomplete | 기존 UI 재설계 부채 | 이번 기본 scoped 결과 **247 inherited** 보존. F3 해결14를 이 부채로 면제하지 않음 |
| 128MiB heartbeat | 기존 U4-4 후속 | 이전347.185ms 등 목표 미달 수치와 대체 계약 유지. 이번에는 재측정하지 않았으며 통과로 변경하지 않음 |
| 의존 패치 장기 유지 | 기존 후속 | exact6.2.108/4변형SHA 유지, 의존 갱신 때 전체 갱신 게이트 |

## 최신 main 동기화 충돌 표면

착수 시 로컬 main/origin/main과 `git ls-remote origin refs/heads/main`을 실측했다. 모두 **`2d0ff3a8280bdd1c3149946306d0ca394244fd5c`**이며 Excel 병합 `a002c0c`를 포함한다. 이전 보고의 main과 같은 해시임을 다시 확인했으며, 추가 Excel 커밋이 있다고 추정해 쓰지 않았다. merge-base는 **`5bc6854175331bdd73b267784d9633cdccda8446`**. branch 변경306파일/main변경94파일, 교집합12파일이다. [원격 확인](evidence/main-refs.txt), [전체 교집합·3방향 실험](evidence/main-conflict-surfaces.json).

원본 refs/index를 바꾸지 않고 각 공통 텍스트 파일의 ours/base/theirs를 `/tmp`에 추출해 **`git merge-file -p`**로 대조했다. 파일별 텍스트 병합 모의이며 실제 merge/빌드 성공을 주장하지 않는다.

| 공통 파일 | 충돌 hunk 수 |
|---|---:|
| `CHANGELOG.md` | 1 |
| `docs/backlog.md` | 0 |
| `docs/review-notes.md` | 1 |
| `package.json` | 0 |
| `src/app/seo.ts` | 0 |
| `src/locales/en/features.json` | 0 |
| `src/locales/ko/features.json` | 0 |
| `tests/accessibility-audit.mjs` | 7 |
| `tests/unit/accessibility-audit.test.ts` | 2 |
| `tests/unit/seo.test.ts` | 0 |
| `tests/unit/visual-config.test.ts` | 1 |
| `tests/visual-regression.scenarios.mjs` | 0 |

**5파일·12hunk**가 텍스트 충돌한다. 접근성의 Excel 소유/시나리오와 PDF F2/F3 소유·측정근거·편집4상태를 모두 보존해야 한다. 문구/SEO/package/visual scenario의 자동 텍스트 병합 가능 여부와 제품 의미 보존은 구분하고 최종 통합 게이트로 확인한다. 현재 branch의 `CLAUDE.md`·`PROJECT_RULES.md` dirty 내용도 main에 이미 반영된 규칙과 파일별로 대조해 처리해야 한다. 이 검수에서는 해당 변경을 stage하거나 덮어쓰지 않았다.

## 실행 로그·실패 이력

| 실행명 | exit | 초 | 원출력 |
|---|---:|---:|---|
| `tsc` | 0 | 19.05 | [로그](evidence/tsc.log) |
| `unit` | 0 | 5.85 | [로그](evidence/unit.log) |
| `build` | 0 | 107.99 | [로그](evidence/build.log) |
| `bundle-scoped` | 0 | 76.72 | [로그](evidence/bundle-scoped.log) |
| `build-qa` | 0 | 95.58 | [로그](evidence/build-qa.log) |
| `original-golden` | 0 | 38.82 | [로그](evidence/original-golden.log) |
| `original-verify` | 0 | 0.57 | [로그](evidence/original-verify.log) |
| `original-a11y` | 0 | 4.54 | [로그](evidence/original-a11y.log) |
| `pdf-finish` | 0 | 190.99 | [로그](evidence/pdf-finish.log) |
| `legacy` | 0 | 4.87 | [로그](evidence/legacy.log) |
| `a11y` | 0 | 28.38 | [로그](evidence/a11y.log) |
| `mutant-official` | 1 | 5.75 | [로그](evidence/mutant-official.log) |
| `mutant-pixel-only` | 1 | 6.11 | [로그](evidence/mutant-pixel-only.log) |
| `a11y-negative-marker` | 1 | 4.04 | [로그](evidence/a11y-negative-marker.log) |
| `a11y-negative-target` | 1 | 4.00 | [로그](evidence/a11y-negative-target.log) |
| `a11y-negative-unresolved` | 1 | 4.08 | [로그](evidence/a11y-negative-unresolved.log) |
| `a11y-negative-result` | 1 | 0.69 | [로그](evidence/a11y-negative-result.log) |
| `dependency-negative` | 1 | 0.06 | [로그](evidence/dependency-negative.log) |
| `parent-output` | 0 | 1.19 | [로그](evidence/parent-output.log) |
| `output-and-outline` | 1 | 7.89 | [로그](evidence/output-and-outline.log) |
| `contracts-ui` | 0 | 53.84 | [로그](evidence/contracts-ui.log) |
| `visual` | 1 | 1.04 | [로그](evidence/visual.log) |
| `output-and-outline-settled` | 0 | 30.92 | [로그](evidence/output-and-outline-settled.log) |
| `visual-corrected` | 0 | 120.41 | [로그](evidence/visual-corrected.log) |

음성 주입 7건의 exit1은 예상 실패이며 모두 예상 오류 문구도 확인했다. 별도로 하네스 준비 오류 2건을 보존한다. (1) 첫 UI 전후 대조는 두 context의 **스크롤 위치 차이31px**까지 절대 client 좌표로 같아야 한다고 단언해 실패했다. 실제 모델과 PDF SHA는 당시에도 같았으며, 비교 기준을 같은 canvas-relative 입력 좌표로 명시한 `output-and-outline-settled` 4쌍이 통과했다. (2) 첫 visual은 `VISUAL_CAPTURE_DIR`이 하네스가 요구하는 `tests/visual-artifacts` 하위가 아니어서 **캡처0/45**에서 거부됐다. 허용되는 archive 내부 하위 경로로 바꾼 `visual-corrected`는 **45/45** 통과했다. 제품 수리나 기준선 갱신으로 이 실패를 처리하지 않았다.

표준 PDF.js fontDataUrl/Node strip-types/Vite 대형 청크 경고는 로그에 보존했으며 테스트 실패로 숨기거나 검사 누락으로 우회하지 않았다.

## 저장소 불변·종결

주 저장소 추적 **2,634파일 SHA-256 시작=종료**, git status/branch/HEAD 동일. 시작부터 있던 `CLAUDE.md`·`PROJECT_RULES.md` 수정과 미추적4항목 목록도 그대로다. 커밋·push·브랜치 전환·원본 추적 파일 수정은 없다. [시작](evidence/source-start.json), [종료](evidence/source-end.json), [불변 판정](evidence/immutability.json). 원본 probe3개와 이전 evidence3개의 SHA도 그대로다.

자체 4271 서버는 종료했으며 4270의 기존 listener를 보존했다. [종료 포트](evidence/ports-end.txt), [종료 시 원격 main](evidence/main-refs-end.txt), [working-tree diff-check](evidence/worktree-diff-check.log). `REPORT.md`를 저장하고 비어 있지 않음·증거 링크의 존재를 별도 확인한 뒤 완료 보고한다.

**[검수 통과] — U4-5 종결. Codx**
