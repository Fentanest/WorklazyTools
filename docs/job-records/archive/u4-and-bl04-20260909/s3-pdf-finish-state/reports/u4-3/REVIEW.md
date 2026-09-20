**[수정 후 재검수] — U4-3(F1) 구현 검수, Codx, 2026-09-07**

지정 HEAD를 정본·sol 지시서와 대조하고 검증 명령을 직접 실행했다. 공통 자동 게이트는 최종 실행에서 모두 통과했지만, 입력 중 도구 중단, 업로드 오류 안내 소실, 미리보기 파손, 일부 PDF에서 장식 소실, 텍스트 사전 안내 누락, 취소 계약 누락, QR 출력 변경, 821px navigation 파손이 재현됐다. 아래 F1~F8을 수리하고 F9의 제품 계약·기록을 정리한 뒤 재검수가 필요하다. 자동 테스트 통과만으로 구현 검수 통과를 선언할 수 없다.

| 기준 | 확인값 |
|---|---|
| 원본 저장소 | `/home/better0101/projects/worklazytools` |
| 브랜치·HEAD | `s3-pdf-finish` · `c8bff1fd1ab64f89afb7240778e0a373c953d1a3` |
| 구현 기준 | `446a1e35ba60ebc308a32a13f8b675a02b095365` · 이후 9커밋 |
| main | `5bc6854175331bdd73b267784d9633cdccda8446` |
| 정본 | `docs/jobs/todo/pdf-finish-20260905.md`의 정본화 우선순위 및 S2b `qr-font-20260906.md` |
| 지시서 | 지정 scratchpad의 `u4-3-review-dispatch.md`, `u4-3-dispatch.md` |
| 환경 | Node 22.17.1 · Google Chrome 152.0.7977.64 · Poppler 24.02.0 |
| 실행 방식 | 모든 build·browser·visual 직렬, `NODE_OPTIONS=--max-old-space-size=4096`, visual concurrency 1 |
| 저장소 불변 | 시작·종료 status 동일, HEAD/main 동일, 추적 2,587개 SHA-256 전부 동일, 변경 경로 `[]` |

첫 행동으로 `PROJECT_RULES.md` 전문을 읽었다. 실행 기준 해시와 열린 계획을 검사했으며, 다른 계획 반박 작업과 원본 워킹트리를 공유해 쓰지 않았다. `/tmp/worklazy-u4-3-review/repo`에 HEAD archive와 의존성·vendor의 독립 복사본을 만들고 그 안에서 빌드·테스트했다. main도 별도 `/tmp/worklazy-u4-3-review/main`에 archive했다. symlink로 원본에 쓰지 않았고, 설치·원본 추적 파일 수정·커밋·push·브랜치 전환은 하지 않았다. preview는 검수 후 종료했다. 복사본 안의 빌드/fixture/manifest 생성은 원본 저장소 변경이 아니다.

시작 `02:57:26 UTC`, 종료 확인 `03:53:11 UTC`의 status는 모두 다음과 같다. 기존 미추적 사용자 파일은 그대로 보존했다.

```text
## s3-pdf-finish
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html
?? newui/
```

증거: [start.json](start.json), [end.json](end.json), [invariance.json](invariance.json), [시작 SHA](tracked-sha-start.json), [종료 SHA](tracked-sha-end.json), [git·도구 확인 출력](final-static-checks.json). 작업 이력과 정본을 원본에서 읽은 것 외의 모든 검수 산출물은 이 디렉터리에 있다.

**지시서 12개 항목별 판정**

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안·심각도 |
|---|---|---|---|
| 1. 범위·기존 기능 불변 | [결함] | `git diff --stat 446a1e3..HEAD`: 72파일, +1,619/-43. 기존 패널/worker/lifecycle/Excel·기존 locale 값 diff 0, legacy oracle totalDiffs 0, QR 두 회귀 명령 통과. 자체 고정 시각 QR 비교는 byteEqual=false, PopplerEqual=true. | F7: QR document 생성 옵션을 이전과 동일하게 보존. P2 |
| 2. route/preset/navigation | [결함] | 타입 5/4값, route 3개·구현 탭 2개, 동일 PdfRoute+typed preset 확인. 자체 탭 전환 URL/history 2→2. 320/390/820 active·fade 정상. en 821px nav 523/532px, 문구 겹침/잘림. | F8: 실제 가용 폭에서 다섯 항목을 수용하도록 반응형 전환을 수정하고 821px 영어 회귀를 추가. P2 |
| 3. SEO/static/광고/비노출 | [통과] | production build/static 통과. 6개 localized canonical 모두 해당 언어 `/finish`; FAQ·sitemap·1200×630 소셜 6개. production 3route 광고 loader 각 1, QA 외부 요청 0. repo-wide 광고 allowlist unit 통과, 새 사용자 문자열 150개 내부 명칭/원시 예외 노출 0. | 없음. 업로드 오류가 보이지 않는 것은 F2로 별도 판정. |
| 4. S0 상속·복구 | [통과] | 외부 PdfRoute 경계 재사용, 별도 lazy FinishPanel, 내부 loading/ToolReady. 자체 3route 청크 404: reload 각 1, guard `[]`, ready 1. `test:recovery` 147 cases 통과, 기존 harness diff 0. | 없음. |
| 5. 장식 엔진 | [결함] | U4-1 토큰·선택·text·geometry와 U4-2 취소 helper 재사용. 4회전×6영역 24건 위치/upright 양 렌더러 통과. Helvetica/Noto·D2 산식 통과. 특수 CropBox 장식 픽셀 0, 취소 시 반환 결과 0/다음 파일 read 1, 필드 위치 손실. | F4/F5/F6: 유효 표시 영역, preflight/오류 상세, 취소·부분 결과 계약 수리. P2 |
| 6. 화면·선택·미리보기 | [결함] | 토큰 5종·6영역, N1 `2-8+even`→3쪽 toggle=`2-4,6,8`/all/{2,3,4,6,8}; 빈 선택/하한 테스트 통과. 시작 쪽 빈 값 등 4건 routeError=1. 암호 4fixture error DOM `[]`. 자체 loaded 24건 중앙/비율 오류. | F1 P1, F2/F3/F5 P2. |
| 7. 하네스·visual/a11y/CLS | [결함] | 전용 smoke/갱신 unit 통과. visual ko/en 각각 203/203, 총 14분41.24초. a11y 11페이지 위반 0. CLS finish 3route 각 max 0.0001480365514755249≤0.1. 그러나 F1~F8 반례는 현행 harness가 잡지 못함. | 실패 반례를 의미 있는 단언으로 추가. 파손 상태를 담은 새 visual baseline은 먼저 UI를 수정하고 리뷰한 뒤 생성기로 갱신. P2 |
| 8. 번들 | [통과] | 고정 baseline+PDF route 정규 측정 5종 PASS, override `{}`, multiplier 1. QR→shared 이동 509,380B, shared 순증분 +2,081B. | 없음. F7 수리 후 다시 게이트 확인. |
| 9. 공통 검증·production 비교 | [통과] | 아래 실행표 전부 최종 exit 0. main/HEAD production 정규화 비교에서 PDF/QR/entry/CSS/신규 정적 표면 및 참조 이름 전파 외 변경 없음. | 자동 게이트 범위의 통과이며 F1~F8을 상쇄하지 않음. |
| 10. 시각 육안·DOM 실측 | [결함] | sol 12장 해상도 확인; 자체 QA 24개 light/dark 진입 + 24개 업로드 화면 + 오류·집중 캡처. 중앙/비율 오류 24/24, landscape overlay outsideCanvas=true, en821 nav 파손. 전체 bodyOverflow 0, 측정한 초기 switch thumb 이탈 0. | F3/F8. P2 |
| 11. 미정의 기본값 판정 | [결함] | [product-decisions.md](product-decisions.md)에 항목별 노출·현지화·SEO·문안 판정. `opacity=.9`는 출력에도 적용. 파일명은 노출 계약. 추가 6~72pt/0~144pt/300 UTF-16 제한은 보고에서 누락. | F9: Claude 판정용 문안 확정, 파일명 현지화/정리 정책과 제한 근거 기록. P2 |
| 12. 기록·범위 밖 발견 | [결함] / [미검증] | CHANGELOG 1줄·review-notes 55줄, Codx 서명. 재실행 수치는 대체로 일치. 보호 안내/geometry/취소/기본값 설명에는 아래 반례가 존재. 지정 sol REPORT.md·logs는 존재하지 않아 원실행 이력은 미검증. bundle JSON·shots는 존재. | 현재 재현 사실과 누락 계약을 review-notes에 정정하고 원보고서/로그 경로를 복구 또는 정확히 안내. P2, 원로그 누락 P3 |

**F1 · P1 — 시작 페이지를 편집하는 정상 입력 과정에서 도구 전체가 중단된다.**

위치: 원본 `src/features/pdf-editor/PdfFinishPanel.tsx:139`, `:270`. PDF 업로드 후 시작 쪽 입력을 지우거나 `0`, `-1`, `1.5`로 바꾸면 4건 모두 `routeError=1`, `finishPresent=0`, console `RangeError: invalid-start-page`였다. 사용자 화면은 일반 로드 실패 화면으로 바뀌어 파일·설정을 잃는다. 공통 오류 경계가 raw 예외를 숨기더라도 폼 오류 처리 계약을 만족하지 못한다.

원인은 `Number(event.target.value)`로 빈 입력을 0으로 만든 뒤 `selectionEvaluation`에서 `createPageSelection`을 먼저 호출하는 것이다. `fieldError`의 정수/하한 검사는 그 뒤에 있어 렌더 예외를 막지 못한다. 썸네일 하한 판정에도 잘못된 lowerBound를 전달하지 않아야 한다.

수정 지시: 입력 중 임시 문자열을 보존하거나, 유효 lowerBound가 확인되기 전에는 selection/thumbnail 순수 함수를 호출하지 않도록 한다. 파일과 폼을 유지한 채 시작 쪽 필드에 ko/en 오류를 연결하고 실행을 비활성화한다. 빈 값→정상 값 복귀, 음수, 소수 반례를 추가한다. [브라우저 결과](browser-results.json)의 `start-page-*`, [빈 입력 화면](shots/error-start-page-empty.png).

**F2 · P2 — 암호·권한 제한 PDF의 검사 실패가 화면에 나타나지 않는다.**

위치: `PdfFinishPanel.tsx:171`, `:181`, `:300`. R2/R6 각각 open-password/permission-restricted 4fixture 업로드 후 모두 오류 DOM `[]`, routeError=0이었다. 파일 선택 전 화면으로 돌아가며 해당 업로드가 왜 거부됐는지 설명하지 않는다. 처음 잘못된 파일을 넣는 경우도 같은 표시 구조의 영향을 받는다.

`replaceFile`이 `file=null`로 바꾼 후 catch에서 현지화 오류를 저장하지만, 유일한 `<PdfError message={error}/>`는 `{file && ...}` 안에 있다. 앞선 오류 sanitization 커밋은 문구를 안전하게 만들었지만 실제 표시 경로를 복구하지 못했다.

수정 지시: 업로드/검사 오류를 파일 유무와 독립적으로 항상 표시할 수 있는 위치에 둔다. 암호·제한 문서는 정본 D1의 “편집 불가” 안내, 손상 문서는 읽기 실패 안내를 ko/en으로 보여주고 재업로드를 허용한다. 원시 예외 allowlist 경계는 유지한다. [암호 입력 결과](browser-results.json), [R2 제한 화면](shots/encrypted-r2-restricted.png).

**F3 · P2 — 중앙 정렬 미리보기의 텍스트가 잘리고 페이지가 세로로 늘어난다.**

위치: `PdfFinishPanel.tsx:353`~`:364`, 기존 `renderPdfThumbnail` 호출부. 중앙일 때 style key가 `center:"50%"`가 된다. 이는 CSS 위치 속성이 아니므로 브라우저가 버리고, `translateX(-50%)`만 남아 텍스트가 캔버스 왼쪽에서 반쯤 잘린다. 또한 thumbnail helper의 inline width/height 중 width만 `max-w-full`에 의해 축소되고 height=780px가 남는다. overlay가 페이지 자체가 아니라 패딩/min-height가 있는 바깥 frame에 붙는다.

실측 en header-footer/mobile/light: frame 324×796, canvas intrinsic 520×780, 표시 308×780(비율 보존 시 높이 462), canvas 중심 x195에 비해 overlay 중심 x41로 **154px 이탈**. 자체 loaded 24개 조합 전부 중앙 오정렬·비율 오류. 가로 PDF는 canvas bottom 1018.719px, overlay bottom 1097.719px로 페이지 밖이었다. 근사 안내는 이 정도의 잘림/오배치·원본 페이지 왜곡을 허용하는 계약이 아니다.

수정 지시: 가운데 위치를 `left:50%`로 계산하고, 원본 aspect ratio가 유지되는 실제 canvas 영역을 기준으로 6영역 overlay를 배치한다. helper의 inline 치수와 반응형 CSS 충돌을 해소하되 기존 모드의 thumbnail 동작은 유지한다. portrait/landscape·6영역·ko/en·light/dark·mobile에서 중심, 종횡비, canvas 내부 포함을 단언한다. [실측](visual-metrics.json), [영어 모바일](shots/focus-en-header-footer-390-light.png), [한국어 다크](shots/focus-ko-header-footer-390-dark.png), [가로형](shots/focus-landscape.png). 기존 신규 visual baseline에도 같은 파손이 들어 있어 회귀 테스트가 통과했다.

**F4 · P2 — CropBox가 MediaBox를 벗어나면 출력 장식이 보이지 않을 수 있다.**

위치: `src/features/pdf-editor/finish/engine.ts:140`의 `pdfPageViewport`. 정본 U4-0 입력의 회전 4종·비영점 CropBox는 24/24 통과했다. 추가 유효 PDF에서 MediaBox=(0,0,400,600), CropBox=(-50,-80,600,850)를 지정하면 PDF.js의 실제 표시 영역은 400×600인데 엔진은 600×850을 사용한다. bottom-center MARK가 y=-56 부근에 그려져 PDF.js와 Poppler 모두 장식의 빨간 픽셀 수가 **0**이다.

수정 지시: raw CropBox 대신 MediaBox와 교집합/무효 교집합 fallback을 포함하는 실제 표시 영역을 산출한다. PDF.js와 viewport 원점·치수·회전의 의미를 맞춘다. 기존 24건에 경계를 벗어난 CropBox와 각 회전을 추가하고 두 렌더러에서 가시성과 upright를 검증한다. [engine-results.json](engine-results.json)의 `extraViewports[0]`/`extraRender[0]`, [문제 출력](engine/crop-outside-media.pdf). UserUnit=2의 transform 비교는 별도로 일치했으나 이것을 모든 UserUnit 렌더러 동등성 검증으로 확대 해석하지 않는다.

**F5 · P2 — 필드 오류 위치와 실행 전 overflow·폰트 크기 안내가 빠졌다.**

위치: `PdfFinishPanel.tsx:200`~`:237`, `engine.ts:301`, `:310`, `:317`, 두 locale의 `pdf.finish.warnings`. N3는 제어문자·누락 scalar의 위치 안내, 수평 말줄임/수직 생략의 실행 전 경고를 요구한다. 확정 1⑥은 출력당 약 3.8MB 증가 가능성을 명시한다.

자체 Chrome 반례: `A😀Z`, `ok\nABC\u0001DEF`, `{date:foo}` 모두 실행 전 버튼 활성·alert 없음. 실행 후 결과 생성은 차단되지만 일반 오류 한 문장만 나오며 문제가 있는 필드/줄/문자 위치가 없다. emoji 엔진 상세에는 line=1/column=2/codePoint=128512가 있지만 UI가 버린다. 제어문자·날짜 오류는 엔진에서부터 details={}로 손실된다. `W` 200개와 75줄 텍스트는 사전 안내 없이 결과가 생성된 뒤에야 “말줄임/줄 생략” 경고가 표시된다. Noto 안내도 결과 카드의 정성적 “파일이 커질 수 있음”만 있고 약 3.8MB 수치가 없다. 자체 출력은 `Résumé €` 2,807B, `Русский` 3,835,122B였다.

수정 지시: 토큰 치환→전처리→coverage→layout의 동일 결과를 사전 판정과 실제 draw가 공유하도록 연결한다. 잘못된 텍스트는 폼에 ko/en 필드 오류와 scalar 위치를 표시하고 결과 생성을 막는다. 말줄임/생략·지원되는 확장 글꼴의 약 3.8MB 증가는 실행 전에 안내한다. 없는 문자·너무 좁은 영역·무효 여백·잘못된 날짜 형식, 알 수 없는 토큰의 literal+warning을 구별한다. source/field/line/column 상세를 사용자에게 이해할 수 있는 문구로 번역하되 내부 error code를 노출하지 않는다. [브라우저 반례](browser-results.json)의 `validation-*`, [엔진 상세](engine-results.json)의 `errors`/`fonts`.

**F6 · P2 — 배치 취소 시 앞서 완료된 결과가 호출자에게 보존되지 않고 다음 파일 read도 시작된다.**

위치: `engine.ts:295`~`:330`, `loadDocument:215`. 두 파일 중 첫 파일의 save·양보·`outputs.push`를 지난 뒤, 두 번째 파일 reading 진행 이벤트에서 abort했다. 결과는 `AbortError`, `returnedOutputs=0`, `partialOutputs=null`, `secondReads=1`이었다. 첫 출력은 내부 배열에만 있고 함수 전체 rejection으로 접근할 수 없다. 파일 시작의 yield/report 뒤 load 전에 재검사가 없어 취소된 두 번째 파일의 `arrayBuffer()`도 호출된다.

수정 지시: D5가 지정한 파일 load 전후·font fetch/embed 전후·반복 양보 뒤·save 전·등록 전 경계에 abort 검사를 둔다. 이미 등록된 결과를 반환/등록 callback/명시적 부분 결과 중 정본 계약에 맞는 수단으로 보존하고 다음 파일 처리를 시작하지 않는다. 공개 반환 계약 변경이 필요하면 Claude와 문안을 닫아 sol이 재해석하지 않도록 한다. 현재 엔진은 파일 목록 API를 이미 구현했고 sol B절도 이를 요구하므로 이 판정은 U4-8의 다중 업로드 UI/ZIP을 앞당기라는 요구가 아니다. 단일 파일 UI의 취소→stale 결과 0→재시도는 기존 smoke에서 통과했다. [취소 실측](engine-results.json)의 `cancellation`.

**F7 · P2 — 공용 폰트 helper 이관으로 기존 QR PDF의 메타데이터가 사라졌다.**

위치: `src/utils/pdfFontEmbed.ts:14`, `src/features/qr-studio/qrLabelPdf.ts`의 문서 생성. main은 `PDFDocument.create()`의 기존 동작을 쓰지만 새 helper는 `updateMetadata:false`를 강제한다. 같은 입력·같은 글꼴·고정 Date `2026-09-05T03:00:00Z`의 subset/full 모두 byteEqual=false다.

| QR fixture | main bytes | HEAD bytes | 바이트 동일 | Poppler 2페이지 PNG |
|---|---:|---:|---|---|
| subset | 661,064 | 660,901 | false | 두 페이지 SHA 동일 |
| full | 3,911,538 | 3,911,384 | false | 두 페이지 SHA 동일 |

main에는 serialized `/Info 3 0 R`, Producer/Creator 및 고정 CreationDate/ModDate가 있고 HEAD에는 모두 null이다. 메타데이터 getter가 객체를 만들기 **전** serialized Info 참조를 읽어 확인했으며 날짜 차이로 인한 오탐이 아니다. QR의 `test:qr-bulk`와 3fixture `test:qr-font-render`는 통과하고 시각 출력은 유지된다. 따라서 glyph/render 회귀로 부풀리지 않되 지시서 1항의 byte 불변은 실패로 판정한다.

수정 지시: 공용 helper가 생성 옵션을 받을 수 있게 하거나 QR에서 이전 생성 기본값을 보존한다. finish의 기존 문서 load 옵션과 QR의 신규 문서 create 옵션을 혼동하지 않는다. 동일 고정 시각 fixture로 byte·Poppler 두 축을 재검증한다. GS descriptor/tofu 후속, QR selector 정책은 이번 수리 범위에 추가하지 않는다. [고정 시각 비교·SHA·메타데이터](qr-byte-compare.json), [재현 스크립트](probes/qr-compare.mjs).

**F8 · P2 — 영어 821px에서 다섯 navigation 항목이 겹치고 잘린다.**

위치: `src/features/pdf-editor/PdfEditorPage.tsx:115`, `:137`. viewport 821px에서는 sidebar가 차지하는 폭 때문에 nav 가용 폭이 523px인데 `min-[821px]:grid-cols-5`로 각 항목을 약 99.8px까지 줄인다. 첫 링크 scrollWidth=124/clientWidth=100, 마지막 113/100. “PDF → ImageDocument & OCR”처럼 인접 문구가 붙고 양 끝이 잘린다. nav 자체도 scrollWidth=532로 9px overflow인데 fade는 `min-[821px]:hidden`으로 모두 숨겨진다.

수정 지시: viewport 숫자만으로 다섯 균등 칸을 강제하지 말고 sidebar를 제외한 가용 폭에서도 레이블이 수용되도록 최소 폭/전환 지점을 정한다. overflow가 남으면 스크롤과 fade를 실제 상태에 맞게 유지한다. 정본의 5항목·순서·data 속성·직접 진입 active 가시성은 보존하고 en 821px 레이블 간 비겹침을 단언한다. 320/390px는 active가 보이며 시작/끝 fade도 올바르다. 사용자가 끝으로 직접 스크롤한 뒤 active 항목이 화면 밖인 것은 결함으로 세지 않았다. [821px 캡처](shots/focus-en-nav-821.png), [치수](focused-visual.json), [8조건×3상태](browser-results.json)의 `navigation`.

**F9 · P2/P3 — 미정의 기본값의 제품 계약·기록을 확정해야 한다.**

각 기본값의 노출 여부·ko/en·SEO 필요성·정본 문안은 [product-decisions.md](product-decisions.md)에 분리했다. 다음은 판정자가 승인할 수 있는 구체 제안이며 이미 정본이 승인한 정책이라고 주장하지 않는다.

번호 `{page} / {pages}`/아래 가운데, 머리말 `{filename} · {date}`/위 가운데, 글자 크기 10pt·여백 24pt·색 `#34343a`는 현행 초기값을 정본에 명시할 수 있다. `opacity=.9`는 preview만의 값이 아니라 실제 PDF에도 적용되므로 출력 계약으로 기록해야 한다. `-finished.pdf`는 사용자에게 직접 노출되는 파일명이다. 기존 organize의 ko `Worklazy-PDF-편집`/en `Worklazy-PDF-edited`와 `normalizeOutputName` 관례에 맞춰 **원본 basename + ko `-마무리.pdf`/en `-finished.pdf`**, 기존 이름 정리 정책·확장자 1회·빈 이름 fallback 현지화를 제안한다. 이 수치/파일명 때문에 새로운 SEO 설명을 억지로 추가할 필요는 없으나 catalog·정본·관련 기대값은 함께 반영해야 한다.

추가로 font 6~72pt, margin 0~144pt, textarea maxLength=300은 단순 초기값이 아니라 입력 제한이다. 정본·sol 범위 밖 발견 목록에 없는 제약이며 특히 300 UTF-16 한도는 사용자 안내 없이 입력을 제한한다. 이를 승인받을 계약으로 근거·초과 안내와 함께 기록하거나 정본이 요구한 유효 기하·overflow 정책으로 처리한다. “비계약 UI 초기값”이라는 하나의 설명으로 파일명·출력 opacity·입력 제한을 묶어 처리하지 않는다.

route 3개·보이는 탭 2개·타입 4값은 sol 지시서의 단계 경계와 일치한다. 미구현 watermark/stamp·F4/다중 ZIP은 누락으로 세지 않았다. U4 전체 OTF 유지, QR selector 미전파, GS tofu 교정 제외도 지켰다.

**통과한 계약의 구체 증거와 검사 범위**

`scope.json`의 72파일을 sol A~F에 대조했다. 기존 organize/image-to-pdf/pdf-to-image/convert의 패널 구현과 `pdf.worker.ts`, `pdfWorkerClient.ts`, 공용 lifecycle, Excel Cleaner/Compare, legacy fixture는 diff 0이다. `PdfThumbnail`의 변경은 finish 체크박스용 optional prop이며 기본 경로를 유지한다. locale의 기존 키 값 변경/삭제는 ko/en 모두 `[]`이고 finish만 추가됐다. 의존성 추가·lockfile 변경·서버 전제 신규 경로도 없다.

`rg 'pdf-tool-navigation a:nth-child'`의 **저장소 전체 literal 결과는 1건**이다. `docs/review-notes.md:54`가 검사식을 인용한 문서 기록이며 실행 selector가 아니다. 실행 경로 `src tests scripts`에서는 0건이다. 따라서 기능적인 확정 15항은 통과하되 원지시의 문자 그대로 “전체 rg 0”을 거짓으로 기록하지 않는다. 문서 인용 예외의 소유자는 Codx다. [literal grep](navigation-literal-grep.txt).

광역 금지 검사는 executable 확장자 `.js/.jsx/.ts/.tsx/.mjs/.cjs`의 repository 후보 297개를 조사하고 변경된 `.message` 두 지점을 검토했다. finish inspection은 catalog 문자열 3개 일치만 허용하고 그 외 일반 오류로 수렴한다. engine은 password/encryption 분류에만 원문을 사용한다. vendor는 고정 생성 산출물 예외, 사용자 미추적 newui는 배포 입력 밖이다. 새 finish 사용자 문자열 150개 내부 Worker/code/Error/fontkit/pdf-lib/AbortError 노출 0. unit의 repository-wide 광고 allowlist·격리 경계와 production utility 양성 대조도 통과했다. [raw audit](raw-audit.json), [후보 목록](repo-wide-raw-candidates.txt), [내부 명칭 후보](internal-name-candidates.txt).

production의 finish 3route는 consent granted에서 광고 loader 각 1회 요청했다. 이 자체 재현은 외부 요청을 intercept해 빈 응답으로 처리했으므로 실제 광고 경매/노출 성공을 주장하는 측정이 아니다. QA 빌드의 브라우저·axe·CLS 외부 요청은 0이다. 신규 route의 canonical/FAQ/sitemap/소셜 검사는 [static-routes.json](static-routes.json), 광고는 [ads-production.json](ads-production.json).

장식 엔진은 U4-1 모듈의 `preprocessText`, `prepareFontDecision`, `layoutTextLines`, selection, geometry를 import하며 순수 모듈을 복제하지 않았다. U4-2 helper를 사용하고 실행 코드에 `await Promise.resolve()` 양보는 없다. 전체 Noto asset 4,644,748B/고정 SHA를 확인하고 `subset:false`로 문서당 임베드한다. `Русский` loadFontAsset 1/clock 1, `Résumé €` load 0/clock 1, LF 두 줄 추출 통과. 동일 크기의 OTF byte 변조를 주입한 브라우저 검사는 요청 1/현지화 font 오류/다운로드 0이었다. 정본의 startPage=4/startNumber=5/excludeCover=true/물리4·6은 `['','','','5','','7','','']`로 출력됐다. 다만 구현 순서는 일부 전처리를 load보다 앞에서 수행하며 D5 load 직전 검사·오류 상세·부분 결과 보존은 F5/F6처럼 완결되지 않았다.

시각 하네스는 신규 두 탭 16장+navigation 12장의 28개 상태를 포함한다. mobile-320과 Date 고정 unit, toolReasons, a11y desktop/412/en, rendering 3route 등록을 확인했다. sol shots는 요구된 12장(1365×900/390×844)이지만 업로드 전 초기 화면이어서 미리보기 오류를 증명하지 못한다. 자체 QA에서는 같은 12조건의 light와 dark를 각각 촬영했고, 각 조건에서 PDF를 업로드한 상태도 전부 촬영했다. `shots/`의 집중 캡처는 실제 DOM을 고치지 않고 full-page clip으로 찍어 고정 헤더의 가림을 피했다. 별도 iframe/디자인 재현물이 아니다.

visual ko/en은 각 203/203, baseline 변경 0으로 실행했다. 하네스 보고 시간은 ko **7m24.05s**, en **7m17.19s**, 합계 **14m41.24s≤20m**다. 여기서 통과는 저장소의 기존 pixel threshold 0.1/허용 다른 픽셀 비율 0.1% 및 AA/기존 footer 처리 규칙 아래 실패 0이라는 뜻이다. 정확한 모든 픽셀 차이 0을 주장하지 않는다. 새 baseline에 F3 파손이 포함된 점이 핵심이다. axe는 정적 11페이지 0건에 더해 자체 업로드 상태 ko/en×desktop/mobile 4개도 0건이었다. 이는 텍스트 위치·기하를 대신 검증하지 않는다.

production main 537파일·HEAD 555파일을 별도 빌드해 Vite hash만 정규화하면 동일 500그룹, 변경 50그룹이다. 기존 1:1 JS 변경 29개 중 binding/import alias의 minifier 이름 전파를 정규화하면 **24개 동일**, 남은 5개는 PdfEditorPage/QrBulkPanel/QrStudioPage/qrLabelFont/qrLabelPdf다. 이름이 같은 index JS 3개는 덮어쓰지 않고 다중 항목으로 비교해 2개 동일, entry만 변경임을 확인했다. 나머지는 신규 FinishPanel/pdfFontEmbed/qrBulk, PDF/QR 참조 이동, entry/locale, CSS, finish의 9개 정적 진입 문서·6소셜·sitemap으로 귀속된다. 정규화는 원본 literal·property·연산자까지 지우는 비교가 아니며 외부 모듈 export 축약 이름과 lexical binding 이름만 대응시켰다. source scope diff와 합쳐 PDF/QR/참조 전파 밖 변화를 찾지 못했다. [hash 비교](dist-comparison.json), [JS 정규화](dist-alpha-normalization.json), [정규화 스크립트](probes/compare-alpha.mjs).

**번들 재실측**

고정 baseline `/tmp/s3-bundle-baseline.json` SHA-256은 `2605437e04a5d77ed41c2dbfac4fae864a6a9c8b5e56941e696a80b7f76ac692`다. [정규 비교 JSON](bundle-pdf.json)은 sol 기록의 수치와 일치한다.

| gzip 지표 | 순증분 B | 상한 B | 판정 |
|---|---:|---:|---|
| entry JS | 4,211 | 20,480 | 통과 |
| PDF route JS | 11,509 | 61,440 | 통과 |
| shared JS | 2,081 | 30,720 | 통과 |
| app JS | 18,274 | 81,920 | 통과 |
| CSS | 82 | 10,240 | 통과 |

| production 청크 | gzip B | realm·귀속 |
|---|---:|---|
| PdfFinishPanel | 9,996 | main · route pdf-editor |
| pdfFontEmbed | 509,313 | main · shared [pdf-editor, qr-studio] |
| qrBulk | 2,101 | main · shared [pdf-editor, qr-studio] |
| qrLabelFont | 9,585 | main · route qr-studio |
| qrLabelPdf | 932 | main · route qr-studio |

fontkit 모듈은 pdfFontEmbed shared main 청크에 포함된다. 모듈 귀속 기준으로 QR→shared **509,380B**가 이동했으며 shared gross +511,461B에서 빼면 net +2,081B다. fontkit 단일 모듈 raw renderedGzip(376,793B)과 이동에 배분된 값(264,074B)은 측정기에서 사용하는 서로 다른 지표이므로 청크 gzip/이동 전체와 혼합하지 않는다. override는 없고 multiplier는 1이다.

**재현 방법과 실행 원출력**

모든 명령의 cwd/env/exit/소요 시간은 [commands.jsonl](commands.jsonl), stdout/stderr 원문은 [logs/](logs/)에 있다. 자동 suite와 달리 자체 probe는 결과를 JSON에 모으는 조사 스크립트이므로 exit 0을 제품 합격으로 읽으면 안 된다. F1~F8은 JSON의 실패 관측값으로 판정했다.

핵심 독립 재현 명령은 다음과 같다. browser probe를 다시 실행하려면 아래 preview를 먼저 별도 터미널에서 시작한다. 보존된 `repo/dist`는 `VITE_LOCAL_QA=1` 빌드이며 production 비교본은 `production-dist/`에 따로 있다.

```bash
cd /tmp/worklazy-u4-3-review/repo
export NODE_OPTIONS=--max-old-space-size=4096
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4283 --strictPort
```

```bash
cd /tmp/worklazy-u4-3-review/repo
export NODE_OPTIONS=--max-old-space-size=4096
node /tmp/worklazy-u4-3-review/probes/browser.mjs
node /tmp/worklazy-u4-3-review/probes/focused-browser.mjs
node --experimental-strip-types /tmp/worklazy-u4-3-review/probes/engine.mjs
node --experimental-strip-types /tmp/worklazy-u4-3-review/probes/qr-compare.mjs
node /tmp/worklazy-u4-3-review/probes/ads-production.mjs
BUNDLE_BASELINE=/tmp/s3-bundle-baseline.json BUNDLE_ROUTES=pdf-editor BUNDLE_MEASURE_OUTPUT=/tmp/worklazy-u4-3-review/bundle-pdf.json npm run bundle:measure
python3 /tmp/worklazy-u4-3-review/probes/compare-dist.py
node /tmp/worklazy-u4-3-review/probes/compare-alpha.mjs
```

실행 중 두 번의 명령 실패는 원인과 함께 보존했다. 최초 archive에 `.git`이 없어 unit 2개가 git fixture/allowlist 조회에 실패했다. 독립 `.git` 복사 후 같은 unit이 297/297, fail/skip 0으로 통과했다. 첫 bundle 명령에는 검수자가 baseline에 없는 qr-studio까지 `BUNDLE_ROUTES`로 지정해 비교 입력 검증에서 실패했다. 지시된 pdf-editor만 지정한 정규 명령은 exit 0으로 통과했으며 상한/override를 바꾼 재실행이 아니다. 정규화 조사 스크립트의 초기 비효율적 문자열 비교는 중단 후 선형 편집 방식으로 고쳤고 최종 실행이 완료됐다. 이는 제품 코드나 baseline을 고친 것이 아니다.

반복된 PDF.js standardFontDataUrl 및 Poppler OTF 경고, new-tools의 Dolby Vision 호환 경로 skip은 기존 환경 한계로 원출력에 남아 있다. GS 렌더 회귀의 기존 제외를 이번 단계에서 해제하지 않았다. 최초 엔진 조사에서 PDF.js가 전달 ArrayBuffer를 detach하여 기록한 bytes=0 필드는 파일 저장 후 stat으로 재측정해 정정했다. 최종 engine-results.json 및 engine-independent-final.log의 실제 파일 크기를 사용했다.

아래 표는 원출력에서 수집한 전 실행 결과다.

| 실행 이름 | 명령 | exit | 초 | 원출력 |
|---|---|---:|---:|---|
| tsc | `./node_modules/.bin/tsc -b` | 0 | 17.988 | [tsc](logs/tsc.log) |
| unit | `npm run test:unit` | 1 | 4.471 | [unit](logs/unit.log) |
| build-production | `npm run build` | 0 | 105.789 | [build-production](logs/build-production.log) |
| static-production | `npm run test:static` | 0 | 0.808 | [static-production](logs/static-production.log) |
| unit-with-git | `npm run test:unit` | 0 | 3.852 | [unit-with-git](logs/unit-with-git.log) |
| pdf-finish | `npm run test:pdf-finish` | 0 | 41.862 | [pdf-finish](logs/pdf-finish.log) |
| browser-pdf | `TEST_SCOPE=pdf npm run test:browser` | 0 | 9.177 | [browser-pdf](logs/browser-pdf.log) |
| browser | `npm run test:browser` | 0 | 51.268 | [browser](logs/browser.log) |
| new-tools | `npm run test:new-tools` | 0 | 112.219 | [new-tools](logs/new-tools.log) |
| utilities | `npm run test:utilities` | 0 | 100.523 | [utilities](logs/utilities.log) |
| office | `npm run test:office` | 0 | 24.692 | [office](logs/office.log) |
| qr-bulk | `npm run test:qr-bulk` | 0 | 47.307 | [qr-bulk](logs/qr-bulk.log) |
| qr-font-render | `npm run test:qr-font-render` | 0 | 38.164 | [qr-font-render](logs/qr-font-render.log) |
| recovery | `npm run test:recovery` | 0 | 291.366 | [recovery](logs/recovery.log) |
| legacy-oracle | `npm run fixtures:pdf-legacy-oracle` | 0 | 5.740 | [legacy-oracle](logs/legacy-oracle.log) |
| excel-cleaner | `npm run test:excel-cleaner` | 0 | 53.793 | [excel-cleaner](logs/excel-cleaner.log) |
| excel-compare | `npm run test:excel-compare` | 0 | 21.031 | [excel-compare](logs/excel-compare.log) |
| visual-ko | `npm run test:visual` | 0 | 445.106 | [visual-ko](logs/visual-ko.log) |
| visual-en | `npm run test:visual` | 0 | 438.141 | [visual-en](logs/visual-en.log) |
| css-orphans | `npm run css:orphans` | 0 | 0.634 | [css-orphans](logs/css-orphans.log) |
| legacy-manifest | `npm run legacy:manifest` | 0 | 0.354 | [legacy-manifest](logs/legacy-manifest.log) |
| registry | `node tests/tool-registry-routes.mjs` | 0 | 0.531 | [registry](logs/registry.log) |
| bundle | `npm run bundle:measure` | 1 | 74.551 | [bundle](logs/bundle.log) |
| engine-independent | `node --experimental-strip-types /tmp/worklazy-u4-3-review/probes/engine.mjs` | 0 | 4.059 | [engine-independent](logs/engine-independent.log) |
| qr-byte-independent | `node --experimental-strip-types /tmp/worklazy-u4-3-review/probes/qr-compare.mjs` | 0 | 6.301 | [qr-byte-independent](logs/qr-byte-independent.log) |
| build-main | `npm run build` | 0 | 100.464 | [build-main](logs/build-main.log) |
| dist-compare | `python3 /tmp/worklazy-u4-3-review/probes/compare-dist.py` | 0 | 2.283 | [dist-compare](logs/dist-compare.log) |
| build-qa | `VITE_LOCAL_QA=1 npm run build` | 0 | 93.036 | [build-qa](logs/build-qa.log) |
| a11y | `A11Y_MAX_TOTAL=0 npm run test:a11y` | 0 | 35.936 | [a11y](logs/a11y.log) |
| rendering | `npm run test:rendering` | 0 | 80.895 | [rendering](logs/rendering.log) |
| browser-independent | `node /tmp/worklazy-u4-3-review/probes/browser.mjs` | 0 | 116.444 | [browser-independent](logs/browser-independent.log) |
| bundle-pdf-canonical | `npm run bundle:measure` | 0 | 76.986 | [bundle-pdf-canonical](logs/bundle-pdf-canonical.log) |
| engine-independent-final | `node --experimental-strip-types /tmp/worklazy-u4-3-review/probes/engine.mjs` | 0 | 4.306 | [engine-independent-final](logs/engine-independent-final.log) |
| qr-byte-independent-fixed-clock | `node --experimental-strip-types /tmp/worklazy-u4-3-review/probes/qr-compare.mjs` | 0 | 6.538 | [qr-byte-independent-fixed-clock](logs/qr-byte-independent-fixed-clock.log) |
| ads-production-independent | `node /tmp/worklazy-u4-3-review/probes/ads-production.mjs` | 0 | 4.251 | [ads-production-independent](logs/ads-production-independent.log) |
| visual-focused-independent | `node /tmp/worklazy-u4-3-review/probes/focused-browser.mjs` | 0 | 12.856 | [visual-focused-independent](logs/visual-focused-independent.log) |
| visual-focused-final | `node /tmp/worklazy-u4-3-review/probes/focused-browser.mjs` | 0 | 12.031 | [visual-focused-final](logs/visual-focused-final.log) |

원본 `git diff --check` 및 `git diff --check 446a1e3..HEAD`는 둘 다 exit 0/출력 없음이었다. CSS orphan=0, legacy manifest=155 rules/153 removed/0 split/2 active, registry=20이며 legacy oracle client 3/structure 4/render 32/output 4/input 1에서 총 diff=0이었다. 두 LANG visual의 shell 전체 시간 합계도 883.247초로 20분 이내다.

**재검수 종료 조건:** F1~F8 재현 입력이 기대 동작으로 바뀌고, F9의 출력·입력 계약 문안과 기록이 Claude 판정으로 닫혀야 한다. 수정 범위의 unit·전용 smoke·실제 미리보기·출력 oracle·QR 고정 시각 byte/Poppler·821px 영어를 재실행하고, 공통 build/static·번들·visual/a11y/CLS 게이트를 유지한다. source 수리 없이 baseline만 파손 화면으로 갱신하는 것은 해소가 아니다. 본 검수는 수리 코드·정본·기록을 저장소에 작성하지 않았다.

**최종 판정: [수정 후 재검수] — Codx**
