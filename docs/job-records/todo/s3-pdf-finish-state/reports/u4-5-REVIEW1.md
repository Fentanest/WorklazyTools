# U4-5(F3 도장·서명) 범위 한정 검수 — Codx

**판정: [수정 후 재검수]. 새 P2 2건(R1 실제 미리보기 크기 불일치, R2 F3 접근성 게이트 누락).** 새 P3 1묶음과 기존 P3 1건은 백로그 귀속으로 분리하며 단계 차단 근거에 더하지 않는다. 구현 수리·커밋·push·브랜치 전환은 수행하지 않았다.

검수일: 2026-09-08. 대상 `s3-pdf-finish` / `8ec3e4edd97439dfc5b7807645d22c8373d69d11`. 착수 시 `main=2d0ff3a8280bdd1c3149946306d0ca394244fd5c`. 주 저장소의 PROJECT_RULES 전문을 첫 도구 호출로 읽고 AGENTS, 검수/착수 dispatch, 정본 확정 8·22·26/N2/명시 제외, SCOPE-OUT 사본, sol REPORT, 관련 review-notes와 누적 이월 checklist를 대조했다. 열린 계획의 PDF 관련 지시에서 이번 검수와 충돌하는 실행 지시는 발견하지 않았다. 사용자 결정 7조건이 착수 지시서의 옛 일반 금지 문구보다 우선한다.

검증 소스는 `git archive 8ec3e4e | tar -x -C /tmp/worklazy-u4-5-review/repo`. 파일/의존 사본·fixture·빌드·브라우저 결과는 이 디렉터리 아래에 두었다. `NODE_OPTIONS=--max-old-space-size=4096`로 빌드와 브라우저 작업을 직렬 실행했다. 4270이 이미 사용 중이어서 **해당 서버를 변경하지 않고** 4271을 `--strictPort`로 열어 사용했다. 금지된 `/tmp/worklazy-xd*`, `/tmp/worklazy-xr*`, `/tmp/worklazy-dc-impl`에 접근하지 않았다.

## 판정표

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| A1 골든⑤ 실제 미리보기↔출력 | **R1, 새 P2** | `node golden-ui.mjs`로 실제 DPR 1/2 × CSS 정상/축소 × 4회전 **16/16 불일치**, 최대 **8.5 CSS px**. `node verify-golden.mjs` exit 1 | 아래 R1대로 이미지 자체의 사각형을 출력과 일치시키고 실제 화면 픽셀 골든을 등록 |
| A2 선택 페이지 상대 위치 | 통과 | 동일 혼합 문서의 4쪽 전체 출력에서 4context × 4쪽의 정규화 중심/상대 폭 일치; 공식 `1,3` 출력은 `[true,false,true,false]` | 없음 |
| B3 저장 좌표 계약 | 통과 | `stamp.ts:15`의 `cx,cy,rw,aspect`, `PdfFinishPanel` history·engine 전달 확인 | 화면 픽셀/raw PDF 좌표 저장으로 바꾸지 말 것 |
| B4 이중 배율 보정 | 통과 | `PdfStampOverlay.ts:58`의 부모 canvas-area bounding rect → source visual viewport 정규화; 출력 때 `viewportPointToPdf` inverse **1회**. 144대조 통과 | 현재 좌표 경로 보존 |
| B5 네 모서리 affine | 통과 | `stampPdfCorners` TL/TR/BL/BR 각각 변환 → `engine.ts:657` → `watermark.ts:671` 네 점으로 가로/세로 벡터·평행사변형 검사 | 중심점만 변환하는 방식으로 바꾸지 말 것 |
| B6 CropBox·UserUnit·회전·scale | 통과 | `node --experimental-strip-types geometry-probe.mjs`: **144/144**. 정상/MediaBox 걸침/교집합 없음 CropBox, 비영점 MediaBox, 4 UserUnit, 4회전, scale .35/1/2.7 | 없음 |
| C7~11 상한·baseline·기록 | 통과 | scoped/full `bundle:measure` 독립 재현, 아래 예산표. 스크립트 diff는 정확히 1줄 | 이후 초과 시 추가 상향 대신 SCOPE-OUT 조건 유지 |
| D12 비전자서명 고지 | 통과 | 실제 ko/en × light/dark × desktop/mobile 8화면, [문구·캡처](evidence/contracts-settled/metrics.json) | 고지 보존 |
| D13 undo/redo 범위 | 통과 | drag/resize/버튼 undo·redo 공식 스모크 통과. 8상태에서 새 세로 이미지로 교체 후 aspect=.5, undo/redo disabled | 현재 이미지의 이동·크기만 소유, 교체 시 새 기록이라는 화면 안내 보존 |
| D14 키보드·초점·타깃 | 기능 통과, **P3 별도** | 8프로필 × 6버튼 **48회 Tab/Enter** 동작, 모든 대체 버튼 ≥44×44, focus-visible 실측. 직접 resize 핸들은 24×24 | 아래 P3 묶음 참조. “모든 포인터 타깃이 44px”라고 확대 판정하지 않음 |
| D14/E17 a11y incomplete·게이트 | **R2, 새 P2** | 기본 6페이지 exit 0/violations 0/incomplete 253. 편집 상태 F3 노드에 대한 실제 게이트 대조에서 **미해결 2노드를 shared-existing으로 허용** | F3 소유 분류·편집 상태 등록·미확정/귀속 누락 음성 게이트 추가 |
| D15 stamp 등록·20도구 | 통과 | ko/en self canonical, hreflang/sitemap/FAQ/application/social 검증; `test:static` startup recovery **119**. `expectedToolIds` 부모와 문자열 동일, **20** | 없음 |
| E16 legacy oracle | 통과 | `fixtures:pdf-legacy-oracle`: client3/structure4/render32/output4/input1 **totalDiffs=0** | 없음 |
| E16 watermark 160 | 통과 | PDF.js/Poppler image **128** + text/descender **32**, Contents fixture4 | 없음 |
| E16 의존 패치 음성 | 통과 | private fixture `pdfjs-dist=6.2.109` → **exit 1**, `expected ...6.2.108, received 6.2.109`; build 전 patch script 거부. unit 4변형 SHA 통과 | 없음 |
| E16 응답성·취소 | 통과 | 16/32/64MiB 각 3회, 매 실행 ≤200ms. 취소 **82.845ms**, 늦은 canvas/result 0, 재시도 성공, Worker 없는 fallback preview/save 성공 | 128MiB 목표 미달의 기존 후속은 유지, 이번 pass로 덮지 않음 |
| E16 표시 런타임·4모드·CLS | 통과 | 표시 자산 **pdf-CCjkBPdx.mjs 1개**, main/thumbnail worker 같은 URL. 계측107/실로드24/누락0. PDF scoped browser 통과. 6 PDF 경로×3 CLS 최대 **0.0001480365514755249** | 없음 |
| E17 스모크 조용한 건너뜀 | 지정 범위 통과, 기존 문구 P3 | 공식 로그에 direct20, raw8, tab2, fresh output10, preview48, watermark160, stamp16 완료. PDF branch와 내부 함수에서 조건부 테스트 생략 경로 없음 | 전역 성공 문구가 Excel/Word까지 주장하는 기존 문제는 백로그 |
| F18 좁은 회귀 | 실행 완료 | tsc 0, unit **323/323 skip0**, production/QA build, static, PDF finish, PDF browser, scoped/full budget, 영향 visual **45/45 diff0**, a11y6, PDF CLS6×3, diff-check | R1/R2 수정 영향만 재검수; 전량은 U4-8 뒤 |

## R1 — 선택 테두리가 실제 이미지 영역을 줄임 (새 P2)

위치/크기 모델과 출력 엔진은 올바르지만 **DOM 선택 사각형 안에서 보이는 이미지가 더 작다.** `src/features/pdf-editor/PdfStampOverlay.tsx:127`의 `border-2`가 모델의 width/height 안쪽을 차지하고, `:147`의 `h-full w-full object-contain`이 줄어든 내부 비율에 맞춰 이미지를 다시 축소한다. 원본 비율 2:1의 불투명 PNG로 보면 왼쪽 빨간 경계는 출력보다 4~5px 오른쪽, 폭은 7~8.5px 작다. 단순 안티앨리어싱 오차보다 크다. 기준선 이미지가 이 상태를 포함하므로 visual diff0은 이 골든의 대체 증거가 아니다.

공식 `tests/pdf-stamp-golden.mjs`를 그대로 재현하면 통과한다. 하지만 DPR·CSS-shrink 반복에서 **실제 브라우저 미리보기를 렌더하지 않고 계산한 expected rectangle을 기존 출력 렌더와 비교**한다. 공식 스모크도 선택 div의 bounding box만 검사한다. 이 빈틈 때문에 구현 보고의 “실제 미리보기 위치 일치” 결론이 과도했다.

보충 fixture는 서로 다른 MediaBox 400×600/800×500/600×400/500×800, 비영점 CropBox, rotation 0/90/180/270, UserUnit 1/1.25/1.5/2인 하나의 4쪽 문서다. **실제 browser devicePixelRatio=1/2**를 확인하고 preview canvas backing width 520/1040도 기록했다. 정상 CSS 표시(컨테이너 제약으로 실폭 약461px)와 축소 실폭260px에서 실제 포인터 이동·크기 조절을 수행하고, DOM 캡처의 빨간 픽셀과 다운로드 PDF의 PDF.js 렌더를 동일 표시 배율로 비교했다. 독립적인 정규화 위치 복제도 함께 단언했다.

아래 값은 **preview − output, CSS px**다. [16개 원수치](evidence/ui-golden/metrics.json), [실행 로그](evidence/golden-ui-complete.log), [실패 단언](evidence/golden-verdict.log), [미리보기 표본](evidence/ui-golden/dpr-2-shrink-0.5-rotation-0-preview.png), [출력 표본](evidence/ui-golden/dpr-2-shrink-0.5-rotation-0-output.png).

| DPR | CSS 조건 | 회전 | x | y | 폭 | 높이 |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1 | 0° | +5 | +2 | -8 | -3 |
| 1 | 1 | 90° | +5 | +2 | -8 | -4 |
| 1 | 1 | 180° | +5 | +3 | -8 | -5 |
| 1 | 1 | 270° | +5 | +2 | -8 | -3 |
| 1 | 0.5 | 0° | +5 | +2 | -8 | -4 |
| 1 | 0.5 | 90° | +4 | +3 | -7 | -5 |
| 1 | 0.5 | 180° | +5 | +2 | -8 | -4 |
| 1 | 0.5 | 270° | +4 | +2 | -7 | -4 |
| 2 | 1 | 0° | +5 | +2.5 | -8.5 | -4 |
| 2 | 1 | 90° | +4.5 | +2 | -8 | -4 |
| 2 | 1 | 180° | +5 | +2.5 | -8.5 | -4 |
| 2 | 1 | 270° | +4.5 | +2 | -8 | -3.5 |
| 2 | 0.5 | 0° | +5 | +2 | -8.5 | -3.5 |
| 2 | 0.5 | 90° | +4 | +2.5 | -7.5 | -5 |
| 2 | 0.5 | 180° | +4.5 | +2 | -8 | -3.5 |
| 2 | 0.5 | 270° | +4 | +2.5 | -7.5 | -4.5 |

**원인 대조:** 소스는 그대로 둔 채 브라우저 CSS에서 선택 border만 제거하고 outline으로 바꾼 DPR2·축소 대조는 최대 **1 CSS px**로 축소, 2px 단언 통과. [대조 로그](evidence/border-control.log), [대조 수치](evidence/border-control/metrics.json). 이미지 내용/좌표 엔진/저장 정규화/상한은 바꾸지 않았다.

**수정 지시:** 모델 사각형의 전체 영역을 원본 이미지가 사용하도록 선택 표시를 별도 overlay 또는 outline으로 분리한다. 좌표 엔진에 보정량을 더하거나 scale을 재차 나눠서 해결하지 않는다. 공식 골든에 실제 DOM 이미지 픽셀↔다운로드 렌더 비교 16조건을 등록하고, 선택 div 경계만 맞아도 통과하는 빈틈을 닫는다. 부모 `89873f7`에는 `PdfStampOverlay.tsx`/공개 stamp 기능이 없으므로 **이번 변경의 결함**이다.

## R2 — F3 접근성 소유 분류와 편집 상태가 기본 게이트에서 빠짐 (새 P2)

`tests/accessibility-audit.mjs:60,63,255`는 `[data-pdf-watermark-owned]`/`f2-watermark`만 알고 나머지를 `shared-existing`으로 분류한다. 새 컴포넌트의 `[data-pdf-stamp-owned]`는 인식하지 않는다. 이번 diff는 stamp URL 세 항목만 등록했으며, 업로드 후 실제 도장 이미지·버튼·오버레이가 생긴 상태를 기본 감사에서 만들지 않는다. 따라서 기본 결과 **253 incomplete 전부 inherited**라는 숫자로 F3 상태의 접근성을 보장할 수 없다.

`node a11y-gate-probe.mjs`는 실제 stamp 파일/이미지 업로드 후 F3 범위의 axe를 실행하고 현행 selector로 소유권을 정했다. 고지 본문/제목 **2개 실제 F3 노드**가 background-gradient incomplete인데 **owner=shared-existing**이 됐다. 그 결과를 현행 `assertAccessibilityResults`에 넣으면 거부하지 않는다. 검수자의 “미해결 F3면 거부해야 한다” 단언은 **exit 1**로 실패했다. [원수치](evidence/a11y-gate-probe.json), [실패 로그](evidence/a11y-gate-probe-focused.log).

**실제 화면 대비는 별도 확인했다.** 상태 안정·버튼 활성화를 기다린 ko/en × light/dark ×1365/390 8프로필은 violations 0. F3 고지 16개 미확정 노드를 그대로 보존하고, 브라우저 canvas로 계산 색을 sRGB로 변환한 뒤 텍스트만 투명화하여 배경 픽셀과 비교했다. 본문 최소 light **5.864846:1**, dark **13.079018:1**; 제목 최소 light **14.656725:1**, dark **17.380519:1**. [측정·키보드·history 원수치](evidence/contracts-settled/metrics.json). 이 보고서가 고지의 현재 대비를 해소했다는 것과 저장소의 게이트가 F3 누락을 잡는다는 것은 별개의 판정이다. **R2를 화면 대비 불량으로 보고하지 않는다.**

**수정 지시:** F3 소유 범주와 실제 target/reason/owner를 유지하며, stamp 편집 상태 및 한/영·양 테마를 기본 범위에 등록한다. 미확정 F3를 기존 부채로 면제하거나 삭제하지 말고 실제 픽셀 근거로 해소하도록 한다. F3 소유 표식 제거/target 미발견/결과 누락/미해결 incomplete를 각각 fail-closed하는 좁은 음성 검증을 추가한다. 범용 분류기는 부모에도 존재했지만 **새 F3 상태를 추가하며 소유/게이트 등록을 하지 않은 회귀는 이번 변경 귀속**이며 기존 공용 부채로 면제하지 않는다.

## 제품 계약과 P3/기존 부채 귀속

실제 ko 고지: “이 기능은 도장이나 서명 이미지를 PDF에 삽입할 뿐이며, 공인 전자서명이나 암호학적 디지털 서명을 만들거나 검증하지 않습니다.” en도 “This feature only inserts a stamp or signature image into the PDF. It does not create or verify a certified electronic or cryptographic digital signature.”라고 명시한다. 실제 화면에는 “인증서 기반”이라는 별도 구절은 없지만, 공인 전자서명·암호학적 서명을 만들거나 검증하지 않는다는 정본 명시 제외의 취지에 부합한다. [한글 화면](evidence/contracts-settled/ko-light-1365-notice.png), [영문 모바일](evidence/contracts-settled/en-dark-390-notice.png).

history 안내는 현재 이미지 선택 이후 이동·크기 조절만 되돌리고 다른 이미지 선택 시 기록을 새로 시작한다고 설명한다. 8프로필에서 6개의 대체 버튼을 실제 **Tab으로 찾아 Enter**로 작동시켰고 모델 변화·visible focus·≥44×44를 단언했다. 공식 스모크는 포인터 이동/크기 조절 및 undo/redo까지 확인한다. 이미지 교체 후 과거 이미지로 돌아가지 않는 것은 코드와 화면이 일치하는 의도된 계약이다.

| 백로그 항목 | 귀속·우선순위 | 증거와 후속 |
|---|---|---|
| BL-U4-5-01 작은 resize 조작·핸들 타깃 | **이번 변경, P3 묶음. 단계 차단에 추가하지 않음** | 실폭260px에서 핸들 중심을 오른쪽 **1px** 이동하면 도장 폭이 **72.796875→69.78125px (−3.015625px)**. `rw .28→.26842548`. start pointer의 grab offset을 크기 계산에 반영하지 않아 첫 작은 이동에서 역방향 변화. 핸들도 **24×24**, 대체 버튼은44×44. 후속: 최초 grab 위치 대비 delta로 크기 조절하고 포인터 hit area 44px 검토. [재현](evidence/resize-small.json), `node resize-small.mjs`. 새 파일 `PdfStampOverlay.tsx:99,149` 귀속 |
| BL-U4-5-02 PDF scoped browser 성공 문구 과장 | **기존, P3. 단계 차단 안 함** | `TEST_SCOPE=pdf`여도 최종 문구가 Excel/Word도 통과했다고 쓴다. `git show 89873f7:tests/browser-smoke.mjs` 54/82줄에도 동일. 실제 PDF 실행은 생략되지 않았다. 후속: scope에 맞는 실제 수행군만 출력 |
| 공용 UI incomplete 부채 | **기존 UI 재설계 백로그 유지** | 공식 6페이지에서 미확정253을 보존했다. 이를 접근성 전체 통과로 승격하지 않으며 F3 신규 항목을 여기에 포함시키는 것은 R2로 별도 차단 |
| 128MiB heartbeat | **기존 U4-4 후속 유지** | 선행 347.185ms 등 목표 미달과 pdf-lib 단일 stream 직렬화 원인/진행 표시·취소·늦은 결과 차단 대체 계약 유지. 이번에는 재측정하지 않았고 통과라고 쓰지 않음 |
| 의존 패치 장기 유지 | **기존 후속 유지** | exact6.2.108/4변형 SHA/멱등성/미지 버전 fail-closed. 의존 변경 시 4빌드×180 render+scalar/tail+5음성 전체 갱신 게이트 유지 |

주 저장소 추적 문서 편집 금지 때문에 `docs/backlog.md`는 수정하지 않았다. 위 표가 Claude가 반영할 **백로그 귀속 문안**이다. 기존 결함을 이 단계의 차단 사유로 사용하지 않았다.

## 번들 예산 독립 재현

유효 baseline SHA-256 **4caaa9c6c48df99dd740664d7991c995ffff7e8b6deaa7a1d87e982d302c30ea**, schema **3**, attribution `independent-rendered-gzip-largest-remainder-v1-main-opaque-workers`. 원본 `/tmp/worklazy-u4-4-review5/evidence/bundle-baseline.json`의 그대로인 사본을 사용했다. schema2를 주입한 검수 음성은 거부됐다. `scripts/measure-bundle-budget.mjs`의 부모 대비 diff는 `affectedRouteJsGzip: 60 * 1024`→`72000` **한 줄뿐**이며 나머지 네 상한/override `{}`/multiplier1은 불변이다. [diff](evidence/budget-script.diff), [scoped](evidence/bundle-scoped.json), [full](evidence/bundle-full.json), [독립 inventory/음성](evidence/bundle-audit.log).

| 지표(gzip B) | baseline 대비 증가 | 상한 | 잔여 |
|---|---:|---:|---:|
| entry JS | 8,888 | 20,480 | 11,592 |
| PDF route JS | 61,879 | 72,000 | 10,121 |
| shared JS (귀속 이동 제외) | 2,400 | 30,720 | 28,320 |
| app JS | 74,059 | 81,920 | 7,861 |
| CSS | 376 | 10,240 | 9,864 |

PDF route 절대값 **1,139,166B** = baseline1,077,287 +61,879. full affected route 합계는 **−447,189B**지만 PDF route의 +61,879B를 깎는 데 쓰지 않았다. app 상한81,920은 미상향. 이전 시도 보존 `bundle-current-scoped.json`의 물리 app 총량과 baseline 총량 차이는68,572이며, 이번 app74,059까지 **5,487B**를 소비했다. 이 단계 실측은 sol 수치와 동일하다. `docs/review-notes.md:7–31`에 상향 사실·날짜·수치·원 추정 실패 사유·PDF 1건 한정·다음 초과 SCOPE-OUT·app 잔여가 기록돼 있다.

실행 확장자에 대해 독립적인 디스크 census를 작성했다. 배포 JS/MJS **107개**의 경로가 측정 inventory와 양방향 일치하고, 명시 vendor/runtime 예외37개는 별도 소유 설명으로 보존했다. 워터마크 실제 네트워크가 로드한24개 모두 inventory에 있다. 표시 모듈은 `pdf-CCjkBPdx.mjs` 한 개이고 editor/thumbnail worker가 동일 자산을 참조한다. [디스크 census](evidence/production-census.json), [브라우저 요청](evidence/runtime.json).

## 응답성 원수치

전체 성능12입력은 실행하지 않았다. 원 하네스의 계측/완료/취소/fallback 함수를 유지한 [범위 어댑터](performance-scoped.mjs)로 16/32/64MiB만 각각 새 context 3회 실행했다. 입력12개의 manifest SHA 확인은 입력 건전성 확인이며 12입력 성능 실행과 구분한다. 중앙값으로 초과를 가리지 않고 **각 실행의 최대 heartbeat**를 아래처럼 확인했다.

| 입력 | 각 실행 최대 heartbeat(ms) | 판정 |
|---|---|---|
| curve-16MiB-w8192 | 92.595 / 148.490 / 178.910 | ≤200ms, 3/3 |
| curve-32MiB-w8192 | 56.935 / 52.910 / 62.780 | ≤200ms, 3/3 |
| curve-64MiB-w8192 | 185.180 / 181.225 / 73.035 | ≤200ms, 3/3 |

외부 취소→UI **82.845ms**, staleCanvas=false, staleResult=false, retrySucceeded=true. Worker 생성 불가 대조도 preview/output 보존. [원수치](evidence/performance.json).

## 실행 기록·하네스 적응

정확한 명령 배열·환경 변수·시간·종료 코드는 [commands.jsonl](evidence/commands.jsonl)에 있다. `run.py`는 모든 명령을 archive 사본에서 실행하며 위 NODE_OPTIONS와 `/tmp` 전용 TMPDIR를 고정한다. Git 메타데이터를 요구하는 단위 검사에는 원본 object DB의 읽기와 **별도 `/tmp` index + archive worktree**를 제공했다. 원본 index/refs에는 쓰지 않았다.

| 실행명 | exit | 소요 | 출력 |
|---|---:|---:|---|
| `tsc` | 0 | 20.32s | [원출력](evidence/tsc.log) |
| `unit` | 1 | 6.40s | [원출력](evidence/unit.log) |
| `unit-archive` | 0 | 6.10s | [원출력](evidence/unit-archive.log) |
| `build` | 0 | 110.54s | [원출력](evidence/build.log) |
| `static` | 1 | 0.82s | [원출력](evidence/static.log) |
| `build-vendor-corrected` | 0 | 93.94s | [원출력](evidence/build-vendor-corrected.log) |
| `static-vendor-corrected` | 0 | 0.84s | [원출력](evidence/static-vendor-corrected.log) |
| `pdf-finish` | 0 | 188.01s | [원출력](evidence/pdf-finish.log) |
| `legacy` | 0 | 4.96s | [원출력](evidence/legacy.log) |
| `browser-pdf` | 0 | 9.37s | [원출력](evidence/browser-pdf.log) |
| `golden-ui` | 1 | 14.03s | [원출력](evidence/golden-ui.log) |
| `performance` | 0 | 35.95s | [원출력](evidence/performance.log) |
| `golden-ui-complete` | 0 | 39.82s | [원출력](evidence/golden-ui-complete.log) |
| `geometry` | 0 | 1.09s | [원출력](evidence/geometry.log) |
| `bundle-scoped` | 0 | 76.47s | [원출력](evidence/bundle-scoped.log) |
| `bundle-full` | 0 | 75.96s | [원출력](evidence/bundle-full.log) |
| `build-qa` | 0 | 94.89s | [원출력](evidence/build-qa.log) |
| `a11y` | 0 | 15.95s | [원출력](evidence/a11y.log) |
| `contracts-ui` | 0 | 51.15s | [원출력](evidence/contracts-ui.log) |
| `visual` | 0 | 119.98s | [원출력](evidence/visual.log) |
| `rendering` | 0 | 75.84s | [원출력](evidence/rendering.log) |
| `border-control` | 0 | 5.96s | [원출력](evidence/border-control.log) |
| `golden-verdict` | 1 | 0.05s | [원출력](evidence/golden-verdict.log) |
| `bundle-audit` | 0 | 0.09s | [원출력](evidence/bundle-audit.log) |
| `contracts-ui-settled` | 0 | 53.78s | [원출력](evidence/contracts-ui-settled.log) |
| `a11y-gate-probe` | 1 | 35.62s | [원출력](evidence/a11y-gate-probe.log) |
| `a11y-gate-probe-focused` | 1 | 4.42s | [원출력](evidence/a11y-gate-probe-focused.log) |
| `resize-small` | 0 | 3.08s | [원출력](evidence/resize-small.log) |

초기 실패를 숨기지 않았다. (1) 순수 archive의 unit2건은 `.git` 부재였고 별도 index/읽기 환경 보충 후323/323. (2) vendor 사본 준비에서 잘못 생긴 `vendor/vendor`를 빌드 정적 검사가 거부했다. 검수 디렉터리 안에서 별도 보관하고 정확한 경로로 사본을 준비·재빌드한 최종 static119 통과. (3) 골든 최초 probe는 축소 상태의 작은 resize에서 확대 단언이 실패했다. 충분한 드래그로16조건을 끝까지 재현한 뒤 작은 조작 자체도 별도로 측정해 위 **새 P3**로 남겼다. (4) 첫 수동 a11y probe의 OKLCH 문자열을 RGB처럼 읽은 대비 계산은 무효이며, 입력 후 preflight 전환 중의 순간 색 샘플도 확정 결함으로 세지 않았다. 계산 색의 실제 sRGB 변환·상태 안정 대기를 적용한 `contracts-settled`만 최종 대비 판정에 사용했다. (5) 첫 게이트 probe는 광역 axe 검사 중 사라진 thumbnail placeholder target 때문에 timeout했다. 생략해 통과시키지 않고 F3라는 검수 대상 범위를 명시한 axe 실행으로 재현을 마쳤다. 최종 두 exit1(`golden-verdict`, `a11y-gate-probe-focused`)은 **새 결함을 직접 입증하는 실패**다.

## U4-6 착수 조건과 다음 검증

현재는 R1/R2 수정 후 astra 재검수가 필요하다. **U4-6(F4a 구조 제거·양식 flatten) 착수 가능으로 판정하지 않는다.** R1의 실제 픽셀16조건과 R2의 상태/귀속/음성 게이트를 닫은 후, 이 단계에서 건드린 표면과 필수 되돌림만 재검수한다. 새 P3와 기존 부채는 위 백로그로 따로 취합한다. 다음 정본은 이 보고서의 잔여 예산(PDF10,121/app7,861B)을 사용하고, 어느 상한이든 다시 초과하면 상향 요청 대신 SCOPE-OUT을 보고해야 한다.

## U4-8 뒤 1회로 남긴 누적 이월 목록

이번 지정 범위가 끝났어도 최종 통합본에 대한 다음 목록은 남아 있다. 정본 `MERGE-GATE-CHECKLIST.md`의13묶음을 보존했다. 아래 항목의 전량 실행은 **이번에 하지 않았다**.

1. 최종 통합본 tsc, production build, unit 전체, static, diff-check.
2. **전체 browser**, new-tools, utilities, office, qr-bulk, qr-font-render, recovery.
3. Excel cleaner/compare, xls-preserve, xls-first-load, video-hybrid 등 공동 기반 회귀.
4. 전체 PDF finish/공식 골든, legacy diff0, fixture 결정성2회, pdf-finish-oracle. **이번에 추가된 실제 stamp 미리보기16조건·선택 페이지 복제·이미지 교체 history·키보드 동작·F3 게이트**도 최종 통합에 포함.
5. 기존 inline payload/EI/descender/Noto/회전/0배치·1픽셀/공백/400타일·401거부/zero clip·불확실 clip/소유 귀속/원시 구현 비노출 경계.
6. **성능12입력×3** 및 cold 경로. 16/32/64 각 ≤200ms, 128MiB는 기존 미달 수치와 대체 요구를 유지하고 late result/retry/fallback까지.
7. 의존 패치 exact/4SHA/멱등성/음성. 의존 변경 시 4빌드×180·scalar/tail·5음성 전체 갱신.
8. **시각 ko/en 전량**, 모든 등록/320·390px/양 테마/모바일 하단 포함. 이번45개 결과로 전량을 갈음하지 않음.
9. **a11y 전량**, F2 오류4+표시 실패4·reload3상태, F3 편집·오류·history/keyboard, incomplete target/reason/owner 보존·수동 근거·음성.
10. **rendering 전량** CLS≤.1. 이번6 PDF 경로 범위 어댑터와 구분.
11. 최종 production schema-v3 scoped/full bundle, physical census/raw network/양방향 inventory/같은 SHA 별칭·변경 내용 음성. PDF 상한72,000 외 네 상한 불변.
12. **css:orphans, legacy:manifest, tool-registry-routes** 전량,20도구, locale/SEO/FAQ/정적/social/canonical/hreflang/sitemap/광고 격리. 이번 `expectedToolIds` 확인은 정적 읽기와 unit이며 standalone routes 검사는 미실행.
13. 추적 없는 QA의 **Gemini 실제 브라우저·Claude 육안·Codex DOM 통합 검수**. 이번 Codx 표본 열람은 그 최종 게이트의 대체가 아니다.

U4-6~8 이후 구조 제거/양식 flatten/orphan 부재/OC 허용집합 두 렌더러 SHA, F4b의4fixture×3쪽수×3DPI×2포맷×2환경·가독성·용량/메모리, F5 복합 실행·공유 font·다중 결과/ZIP 및 최종 골든①~⑦를 추가한다. 배포/라이브 검증은 U4-8 후 단일 배포 단계다. 이번에는 `test:browser` 전체, new-tools/utilities/office, QR2종, recovery, Excel2종, a11y전체, visual전량, rendering전체, orphans/manifest/routes, 성능12입력을 실행하지 않았다.

## main 동기화 예상 충돌과 불변 증명

main과의 merge-base는 `5bc6854175331bdd73b267784d9633cdccda8446`. 양쪽이 고친 교집합은 CHANGELOG, docs/backlog·review-notes, package.json, src/app/seo.ts, ko/en features.json, tests/accessibility-audit.mjs 및 unit, unit/seo·visual-config, visual-regression.scenarios.mjs다. 특히 Excel과 공유하는 **접근성 소유 분류·상태 등록, locale/SEO, 시각 scenario**를 통합 시 보존해야 한다. 이는 충돌 가능 표면의 정적 비교이며 merge를 실행하거나 충돌 해결 결과를 주장하지 않는다. [교집합](evidence/main-conflict-surfaces.json). 동기화 직전 움직인 main을 다시 확인해야 한다.

주 저장소 **추적 2,634파일 SHA-256 전부 시작=종료**, git status도 동일, HEAD/branch 불변. Claude의 CLAUDE.md·PROJECT_RULES.md 미커밋 내용 및 사용자 미추적 파일은 변경하지 않았다. [SHA/상태 증명](evidence/immutability.json), [시작 상태](evidence/status-start.txt), [종료 상태](evidence/status-end.txt), [시작 refs](evidence/refs-start.txt), [종료 refs](evidence/refs-end.txt). `git diff --stat 89873f7..8ec3e4e`:43파일,+984/−68; `git diff --check` exit0. 검수용 4271 서버는 종료했고 해당 포트 listener 부재를 확인했다. REPORT는 이 검수 디렉터리에 저장했으며 존재·비어 있지 않음과 문서 내 증거 링크의 존재를 확인했다.

**[수정 후 재검수] — Codx**
