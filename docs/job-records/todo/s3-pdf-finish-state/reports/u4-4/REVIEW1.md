# U4-4(F2 워터마크) 1차 검수 — Codx

**최종 판정: [수정 후 재검수].** 지정 128렌더·legacy oracle·번들 5종이 통과해도, 일반 PDF/텍스트 입력에서 재현되는 멈춤·글자 손실·빈 워터마크 결과와 UI 회귀가 남는다. U4-5 착수 승인은 내리지 않는다.

기준 `s3-pdf-finish` / `5767f135443f113e655fbb0801a01e4d3c11de23`. 구현 비교 `3152957..5767f13`. 검증 위치는 이 커밋의 `git archive` 사본 [repo](repo/), 산출물은 이 디렉터리만 사용했다. 원본 추적 파일·커밋·push·브랜치는 수정하지 않았으며 금지된 다른 작업 트리와 사용자 미추적 4항목을 열지 않았다.

첫 행동은 `PROJECT_RULES.md` 전문 읽기였다. AGENTS, PDF 정본의 우선순위·v7 N3·배경 계약·H4~H6, 구현/검수 dispatch, sol REPORT·골든·로그·기록, U4-3 4차 보고를 대조했다. 열린 계획 19개를 스캔했고 이번 불변 검수와 충돌하는 실행 지시는 없었다([계획 스캔](evidence/open-plan-scan.json)). 이 보고의 수정 문안은 후속 구현용이며 이번 검수에서 수리하지 않았다.

## 제품 결함과 수정 지시

| ID·심각도·도달성 | 판정·재현 명령과 출력 | 수정 지시 문안 |
|---|---|---|
| **R1 P1 — 정상 inline image PDF 업로드** | **멈춤.** `node --experimental-strip-types probes/engine-boundaries.mjs`, `probes/browser-inline-hang.mjs`. **566B 정상 1px grayscale inline image**의 데이터 바이트 `0x29`(`)`)에서 위험 scanner가 index를 전진시키지 않는다. Node preflight 3,000ms ETIMEDOUT, 실제 watermark 화면도 업로드 후 메인 스레드 응답 3,000ms timeout. PDF.js/Poppler는 원본을 정상 렌더(검은 영역 6,400/6,561px). [원본 PDF](evidence/valid-inline-image.pdf), [브라우저](browser-inline-hang.json), [렌더](render-boundaries.json). | `finish/watermark.ts:71,105`의 scanner가 모든 입력에서 전진/종료하도록 보장하고 inline image 데이터와 연산자를 구별한다. 파싱 불확실성은 정본대로 경고로 귀결시키며 사전 일괄 거부하지 않는다. 정상 inline image·닫는 괄호·문자열/주석/hex·복수 stream 반례와 실제 업로드 후 응답·취소/재시도 회귀를 추가한다. |
| **R2 P2 — 일반 텍스트 `gypqj`** | **글자 하단 손실.** `probes/render-boundaries.mjs`의 동일 Helvetica 36pt/동일 baseline 비교: PDF.js red **521 vs 659**, Poppler **610 vs 741**. 대문자 대조 `MARK`는 Poppler **874 vs 874**. 마지막 줄 기준선 y=0과 Form `BBox=[0,0,w,h]`가 descender를 자른다. [잘린 출력](render-boundaries/descenders-gypqj-poppler-1.png), [정상 대조](render-boundaries/descenders-reference-gypqj-poppler-1.png). | `engine.ts:456,467` 및 `watermark.ts:288`: glyph 하단 공간을 포함한 Form 좌표·BBox를 일관되게 계산한다. 글자 크기를 줄여 덮지 않는다. 소문자 descender·다중 줄 마지막 줄·Noto·회전·단일/타일을 두 렌더러로 재검증한다. |
| **R3 P2 — 작은 PDF + 허용된 타일 offset** | **아무 워터마크도 없는 성공 결과.** 200×200pt, tile, offsetX=300: preflight `errors=[]`, `warnings=[]`, 실행 활성. 엔진 결과 **1,190B**, ko/en UI 실제 다운로드 각 **1,194B**. content에는 `q /Artifact BMC EMC Q`만 있고 `Do=0`; 두 렌더러 red=0. [엔진](engine-boundaries.json), [실제 화면 경로](browser-boundaries.json), [다운로드](browser-boundaries/en-zero-output.pdf). | `tiles.ts:39~58`·`createWatermarkPlacements`: 선택 페이지의 유효 배치가 0이면 사전 필드 오류 또는 정본화된 안내로 실행을 막는다. offset/페이지 치수·회전 경계를 다루고 조용한 clamp/축소는 하지 않는다. 결과 validator에도 marker-only 무효 결과를 통과시키지 않는 검사를 둔다. |
| **R4 P2 — ko/en 320px, en 390px 내부 탭** | **기준선 갱신이 회귀를 수용.** `[data-finish-tab]`의 320px 실제 버튼 폭 **93.33px**, en label+icon 내용 폭 **113.06/120.84px**, ko 머리글 **107.33px**. en 390px header도 **120.84 >116.67px**. 인접 label이 겹친다. 상위 **5칸 navigation은 정상**이며 이 결함은 새 내부 3개 탭이다. [DOM](browser-boundaries.json), [20개 변경 전후 직접 비교](visual-diff/INSPECTION.md), [문제 탭 diff](visual-diff/sheet-3.png). | `PdfFinishPanel.tsx:436`: 모바일에서 내부 탭의 label·icon이 자기 버튼 안에 들어오도록 레이아웃을 수정한다. 320/390 ko/en에 내용 bbox/인접 겹침 단언과 직접 캡처를 추가한다. 수정 후 실제 변화만 기준선을 갱신한다. 상위 5칸 navigation/fade 단언은 유지한다. |
| **R5 P2 — 기존 F1 여러 줄 미리보기** | **F1 회귀.** 머리말 `FIRST\nSECOND`의 두 단어 y가 모두 **293.03125px**; DOM `white-space:normal`, opacity1, weight400. 이전 wrapper의 `whitespace-pre-wrap`, 줄높이, font-medium, opacity0.9가 삭제됐다. [실제 한 줄 화면](browser-boundaries/f1-multiline.png), [DOM](browser-boundaries.json). | `PdfFinishPanel.tsx:616`: 기존 번호/머리말 wrapper의 여러 줄·정렬·스타일 계약을 복원한다. 워터마크와 공용화하면서 F1 의미를 바꾸지 않는다. 입력 여러 줄이 미리보기에서도 여러 줄인지 단언한다. PDF 출력 자체의 F1 엔진은 별개로 유지된다. |
| **R6 P2 — 타일 미리보기 크기 변경** | **크기 제어를 반영하지 않는 고정 그림.** `20%→60%`에서 ko/en 모두 overlay HTML 동일·타일 **18개 고정**, 미리보기 PNG **SHA 동일·diffPixels=0**. 코드가 3열×18개와 width82%를 고정하고 sizePercent를 사용하지 않는다. 근사 한계 안내로 크기 무반응까지 정당화할 수 없다. [픽셀 대조](preview-pixel-comparison.json), [실제 20%](browser-boundaries/en-tile-size-20.png), [60%](browser-boundaries/en-tile-size-60.png). | `PdfFinishPanel.tsx:615`: 실제 배치 계획과 viewport 비율을 사용해 위치·크기·간격·offset을 근사 표시한다. 픽셀 동일성을 요구하지 않되 유효한 설정 변경에는 대응해야 한다. 고정 18개 샘플을 실제 출력 예상처럼 표시하지 않는다. |
| **R7 P2 — 정본의 레이아웃/범위 계약 미준수** | **7이라는 개수 자체는 중앙 단일 배치 요구로 설명 가능하나, 6영역 계약을 대체한 구현은 근거가 없다.** 400×600pt, margin20, top-left: 정본 영역 폭120pt는 30자리 숫자를 `1234567890123456789…`로 줄이고 경고해야 한다. 실제 F2는 전체 유효폭×60%=216pt를 사용해 경고 없이 인접 영역까지 사용한다. 또 새 `opacity≥.05`, size5~100%, gap≤300, offset0~300 제한은 정본 근거 없음. .01/4%/301/-1 입력이 `invalid-field`로 차단됨. [6영역 대조](render-boundaries.json), [범위 반례](undocumented-limits.json). | 중앙 배치를 삭제하지 말고, 중앙 배치와 나머지 6영역의 폭·높이·overflow 관계를 정본과 맞춘다. 새 하한/상한의 근거는 Claude가 정본으로 확정한 뒤 구현한다. 알려진 상한400과 미정의 수치를 혼동하지 않는다. 타일 루프의 매 반복 양보/abort 계약도 현재 동기 loop(`watermark.ts:256`)에 빠져 있으므로 이 계약을 구현하거나 정본에서 명시적으로 재판정한다. |
| **R8 P2 — 접근성 게이트 판정** | `A11Y_MAX_TOTAL=0` 자동 명령은 12페이지 위반0으로 끝나지만, 별도 원결과는 **color-contrast incomplete 930노드 + aria-prohibited-attr incomplete 3노드**. 전부 삭제하고 passes/violations만 저장하는 하네스 때문에 수동 확인 없이 게이트 통과로 보고됐다. 상세 수동 판정은 아래 접근성 절. | `tests/accessibility-audit.mjs:141`의 결과에 incomplete·대상·사유를 보존하고, 미확인 항목을 통과로 세지 않는다. 기존 공통 UI 결함은 이번 F2 신규 회귀와 구별해 Claude가 별도 정본/게이트 처리를 판정해야 한다. 기존이라는 이유로 이 검수에서 자동 면제하지 않는다. |
| **R9 P3 — 오류 문구의 내부 용어** | malformed Contents에서 실제 ko/en 안내가 **“내부 구조…워터마크 스트림” / “A watermark stream…internal structure”**. `Worker`/runtime/원시 예외는 없지만 PDF content stream 구현 명칭이 노출된다. 양 언어 `pdf.finish.preflightErrors.background-placement` 1쌍. [전수 locale 대조](evidence/locale-audit.json), [브라우저 원문](browser-boundaries.json). | 원인 구현 대신 “이 페이지에 워터마크를 안전하게 추가하지 못했습니다. 다른 PDF 사본으로 시도해 주세요.”와 대응 영어처럼 사용자 행동·결과 중심으로 바꾼다. 원시 예외를 노출하지 않는 현재 오류 경계는 유지한다. |

## 지시서 A~E 항목별 판정

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| A1 타일400 | **정본 근거 있음; 조용한 축소 없음** | 정본 **v7 N3 470줄**, round6 160줄에 상한400·초과 필드 오류 명시. 실제 A4 UI는 ko/en “크기나 간격을 늘려 주세요”·실행 차단. 400이 정본에 없다는 이번 dispatch 전제를 반박한다. | 지시서의 전제를 정정. 상한을 제거/완화하지 않는다. |
| A1 7영역/UserUnit | **범위 분리 필요** | 중앙은 원요구 3항에 명시. 6영역 폭·높이와 미정의 범위는 R7. UserUnit1/2×4회전×2layer×2pattern 추가 렌더에서 워터마크는 보이지만 PDF.js unit2 viewport400×360, Poppler200×180. | 지원 표기를 “회전/CropBox 및 PDF.js식 UserUnit viewport 좌표 처리”로 한정. 전 renderer 전체 픽셀/치수 동일성으로 확대하지 않는다. |
| A2 배경①~③·중복 ref | **통과** | `engine-boundaries.mjs`의 중복 원본 ref가 `[new,q,original,original,Q]`로 두 번 그대로 유지. 새 ref는 register로 고유 할당되므로 `indexOf(newRef)`가 원본 중복을 제거하지 않음. 별도 실험에서도 기존 foreground stream을 배경으로 함께 이동하지 않음([보충 구조](supplementary-contracts.json)). | 없음. 새 ref 자체를 강제 중복시키는 라이브러리 변조를 제품 입력 반례로 세지 않음. |
| A2 fixture/픽셀/실패 통지 | **지정 fixture 통과** | 정상3종 저장·재개방, 비정상형 preflight `background-placement`, ko/en 현지화·결과0. 128렌더/독립 픽셀 재집계는 아래. | 잘못된 Contents 타입 차단은 저수준 조작 불가 경계(확정4⑥)이며 q/Q·OCG·태그 사전 거부와 다르다. 문구 R9 수정. |
| A3 확정25 경고 후 허용 | **6개 기본 경계 통과; R1 예외 있음** | q/Q·태그·OCG×앞/뒤: 사전 오류0+위험 warning, 미동의 `risk-confirmation-required`, 동의 후 선택 layer 결과 생성. | 정상 inline image 멈춤 R1을 고친다. 위험군을 일괄 거부하지 않는다. |
| A4 재개방 실패 시 미제공 | **검출된 실패는 차단; 검출 범위 한정** | throwing stub 대신 **실제 결과 바이트 절단/Contents 삭제**를 기본 validator로 검사: 둘 다 `output-validation`, 반환 결과 없음. 단 marker-only 결과 R3는 통과. 추가 위험 입력 `Q + empty clip`은 두 renderer foreground red0인데 결과 제공; XObject 삭제는 검사 자체가 통과([음성 대조](supplementary-contracts.json)). | 재개방 성공을 출력 가시성 보증이라고 보고하지 않는다. R2/R3 및 위험 결과 음성 대조를 보강하되 사전 거부/조용한 foreground 폴백으로 대체하지 않는다. |
| A5 리소스 | **통과** | PNG116B; single1,175B/12tile1,270B(+95B), **300tile1,881B**·이미지1·Do300. 폰트는 한 문서 Noto descriptor1·4forms가 같은 `7 0 R` 참조·asset fetch1. | 없음. Form이 페이지별 토큰/크기에 따라 생성되는 것과 타일별 중복 embed를 구별한다. |
| A6 glyph/말줄임 | **coverage/공유 통과, glyph 렌더 R2** | Русский Noto 성공, ή U+03AE/😀은 2행2열 오류·ko/en 실행 차단. 긴 W는 말줄임 경고·font size 유지. 4쪽 Noto 출력3,835,199B, descriptor1. | R2 수정. 머리말/번호/워터마크 공통 font 경로는 유지. 현재 UI는 탭별 단일 실행이며 F5 복합 실행에서 실제 단일 인스턴스 공유를 재확인해야 함. |
| A7 근사 안내/선택 동기 | **안내·선택 통과, R5/R6 미리보기 미달** | ko/en 화면에 근사 안내 있음. 범위1-3+even→선택[2]; 썸네일3 toggling→[2,3], parity all, text2-3. | R5/R6 수정. |
| B8 128 골든 | **독립 재현 통과** | `npm run test:pdf-finish` + `python3 probes/recount-golden.py`:128PNG,32고정수치/sol metrics 완전 일치. 원본 있는48쌍 모두 blue→red 실제 겹침>0; 빈 원본16쌍은 원본 없음. | 골든을 이미지/정상 fixture 범위 증거로 유지. 일반 텍스트 R2를 덮는 전체 F2 보증으로 쓰지 않는다. |
| B9 이미지 배율 수리 | **통과** | `engine.ts:676` image object size1×1. 지정128 및 추가 UserUnit/4회전/단일/타일 행렬에서 이미지 비가시 재발 없음. | 없음. 텍스트 Form BBox 문제 R2와 구별. |
| C10 legacy-organize | **통과** | `npm run fixtures:pdf-legacy-oracle`: client3·structure4·render32·output4·input1, **totalDiffs0**. PNG .82×.2·MediaBox 비보정·−32°·Helvetica9pt y12 보존. | 없음. 원 fixture/기준선 수정0. |
| C11 기존4모드/F1~F9/도구수 | **4모드/20도구 통과, F1 UI R5 미달** | 기존4모드 blob 불변, PDF/전체 browser 및 F1 스모크 통과; `tool-registry-routes`20. 취소 UI는 finish 소유. | 기존 스모크의 통과를 여러 줄 미리보기까지 확장하지 않음. R5 수리. |
| D12 시각28개 | **일괄 정당화 불가** | 신규8/수정20 전부 직접 열어 비교. 수정16은 안내문+F1 glyph 스타일·하단 흐름, 수정4는 내부3탭. [각 파일 판정](visual-diff/INSPECTION.md). | R4/R5 관련 기준선을 수리 뒤 다시 검토. “모두 세 번째 탭만”이라는 기록 정정. |
| D13 접근성 | **수동 측정 미달; 게이트 불통과** | 자동12페이지0위반과 raw930+3은 모두 직접 실행. 아래 실제 배경 수동 판정 참조. | R8. |
| D14 번들 | **통과; scoped 게이트 약화 아님** | 전체19lazy route 측정과 scoped의 전체 `files/modules` 완전 동일, 4전역 metrics 동일. 선택PDF 증가18,881B 및 전체route 합계−490,157B 각각 상한 통과. raw baseline과 full 직접 비교는 누락 audio baseline값으로 정확히 거부됨. | 같은 고정SHA·5상한·override{}·multiplier1 유지. 전체 합계가 QR 감소로 PDF 증가를 가리지 않도록 scoped PDF 게이트도 유지. |
| D15 CLS | **통과** | watermark 등록 포함7대상×3회, max **0.0001480365514755249**≤0.1, 외부요청0. | 없음. |
| D16 광고/격리 | **공통 경계 통과** | repo-wide 실행파일 최소 허용목록 unit, 일반/격리 browser·Office·QR·recovery 통과. 별도 production watermark 로더 재현은 아래 최종 실행표. | 없음. QA 렌더/검수는 추적 제외 build 사용. |
| D17 현지화/SEO/정적 | **현재 U4-4 등록 통과** | 새 locale41키씩 대응. watermark ko/en canonical자기경로, FAQ2쌍·social2PNG·sitemap·정적69페이지(67+2)·startup116문서. a11y11→12, rendering6→7. | `/stamp`는 정본 U4-5 예정이므로 현재 미등록을 이번 누락으로 세지 않음. 최종5경로 전수는 U4-8에서 재검증. |
| D18 구현 비노출 | **원시 예외/Worker 없음, R9 미달** | 새 locale 전수 및 실제ko/en malformed 안내 확인. | R9. |
| E19 공통 명령 | **실행 완료 결과는 아래 표** | 원출력 [commands.jsonl](commands.jsonl), [실행표](command-table.md). 시각 최초 경로 설정 실패도 보존. | 실패를 삭제하거나 성공으로 세지 않는다. |
| E20 범위 | **통과** |56파일 +1,383/−82; 제품F2·등록·검증·기록·social/시각 생성물만. Office/vendor/dist·기존4모드·package-lock blob 불변; 새 의존/폰트0. [diff](evidence/implementation.diff), [보호blob](evidence/protected-blobs.json). | 없음. |
| E21 기록 | **있으나 사실 정정 필요** | CHANGELOG간결/Codx·review-notes측정 기록 존재. 이미지 이중scale 발견과 첫 bundle 거부도 기록됨. 다만 시각20개 이유, “ASCII/Latin-1 vs 나머지” 글꼴 설명, 이동509,794B 전부QR 주장은 부정확. | glyph coverage 기준으로 서술. 이동은 **QR509,380B + image-studio414B**. “UserUnit 지원”은 위 제한을 병기. |
| E22 종결 | **[수정 후 재검수]** | 재현 가능한 제품 결함과 접근성 게이트 판정 잔여 있음. | R1~R9 수정/정본 판정 후 astra 재검수, Claude U4-4 종결 판정이 U4-5 착수 입력. |

## 접근성 수동 판정

**자동 위반0을 게이트 통과로 인정하지 않는다.** 같은12페이지를 원 axe 결과까지 보존해 다시 실행했다. contrast incomplete는930개이고, 모든 해당 노드는 body의 radial gradient 때문에 `bgColor` 판정이 불완전했다. aria incomplete3개는 별도다. [원결과](a11y-full-summary.json), [원 axe JSON](a11y-full/).

검수 사본의 실제 화면을 촬영하고, DOM의 글자 채움만 일시 투명하게 바꿔 배경을 촬영했다(저장소 파일 변경0). 먼저 각 text rect의 배경9점을 검사한 뒤 **두 캡처의 차이로 실제 글자가 있던 픽셀을 찾아 그 위치의 배경색·computed 전경색·opacity로 대비를 재계산**했다. AA 픽셀의 혼합색을 글자 원색으로 오인하지 않았다. 일반 글자4.5:1, 24px 이상/18.666px 이상 bold3:1을 적용했다. 숨겨진/스크롤 밖 노드와 경계값22건은 실제 스크롤 후 별도 재촬영했고 input은 `::placeholder` 색상도 확인했다. [전930개 측정](a11y-glyph-contrast.json), [추가22개](a11y-visible-recheck.json), [노드별 판정](a11y-manual-adjudication.json), [재현 코드](probes/a11y-pixel-backgrounds.mjs).

| 페이지 | contrast incomplete | 수동 기준 이상 | 수동 기준 미달(일부 포함) | 측정 미확정 | aria incomplete |
|---|---:|---:|---:|---:|---:|
|home|5|5|0|0|0|
|document-compare|43|28|15|0|0|
|tools|198|169|28|1|1|
|excel-compare|64|53|11|0|0|
|pdf-editor|47|31|16|0|0|
|pdf-finish-ko|49|31|18|0|0|
|pdf-finish-mobile-ko|33|18|12|3|0|
|pdf-finish-en|49|31|18|0|0|
|pdf-watermark-ko|49|31|18|0|0|
|hwp-editor|43|29|14|0|1|
|home-mobile-ko|171|162|9|0|0|
|tools-mobile-ko|179|155|24|0|1|
|**합계**|**930**|**743**|**183**|**4**|**3**|

**미달183 = 전 측정 배경에서 미달182 + 일부 배경에서 미달1.** 이는 수동 화면 측정 수이며 axe 자동 violation 개수로 바꿔 적지 않는다. 743개는 이번 viewport·표시 상태의 측정값이 기준 이상이라는 뜻이며 모든 상태/브라우저 보증은 아니다. 4개는 재촬영에서도 글자 차이 픽셀을 분리하지 못해 **미확정으로 남겼고 통과에 합산하지 않았다**: tools의 sidebar text-tools, mobile finish의 organize/convert label·안내 heading. 대비 미달이 확정된 반복 공통 요소만으로도 게이트는 이미 실패한다.

직접 원캡처를 열어 대상 텍스트와 상태를 확인했다([watermark 실제 화면](a11y-pixels/pdf-watermark-ko-original.png)). 대표 수동 판정은 다음과 같다.

| 대상 | 실제 전경/배경 대비 | 판정·귀속 |
|---|---:|---|
| 하단 정책 링크·광고 설정·copyright(14px) | **2.839:1** | 미달. 비활성 컨트롤·로고 예외가 아닌 정상 읽기/조작 텍스트. 기존 AppShell/global.css |
| sidebar 둘러보기/도구(14px bold) | **2.954~2.991:1** | 미달. 14px bold에 큰 글자3:1 예외를 적용할 수 없음 |
| 파일·암호 로컬 처리 안내(14px bold) | **약2.899~3.110:1** | 미달. 녹색 안내도 정상 텍스트 |
| 내부 비선택 finish 탭(14px, weight500) | **최대4.466:1** | 미달. 새 워터마크 탭도 포함; 4.466을4.5로 반올림해 통과시키지 않음 |
| 도구 검색 placeholder | **2.524:1** | 양 desktop/mobile 미달. placeholder 전경 별도 확인 |
| 도구 카테고리 숫자(11px bold) | **2.341:1** | 스크롤해서 드러난 항목도 미달 |
| home mobile GitHub 문의 안내 | **4.485~4.855:1** | 일부 배경에서 기준 미달. 그라디언트 때문에 최고값만 채택하지 않음 |

공통 CSS·AppShell·ToolsPage·HwpEditorPage는 `3152957..5767f13` **blob 동일**([증거](evidence/a11y-common-blobs.json)). 따라서 기존 전역 미달을 F2가 새로 만든 것으로 보고하지 않는다. 새 탭은 기존 스타일 문제를 함께 사용한다. 후속 수리는 F2 범위와 기존 공통 UI 범위를 분리해 Claude가 정본화해야 하며, 이번에 타 제품 코드를 임의 수정하지 않았다.

**ARIA3개 수동 판정:** tools desktop/mobile의 `.tool-category-filter`와 HWP의 호스트 wrapper는 역할 없는 `div aria-label`. Chrome AX tree를 직접 읽으면 `role=generic`이면서 이름 자체는 노출되므로 “이름이 무조건 사라진다”는 주장은 하지 않는다. 다만 유효 역할/지원 근거가 없는 axe의 우려를 Chrome 한 번의 노출만으로 면제하지도 않는다. 목적에 맞는 group/region 등의 역할 결정 또는 불필요한 label 제거가 필요하며, **3건 모두 수동 보류**다. HWP 대상은 제외된 vendor iframe 내부가 아닌 앱 호스트다([AX tree 포함 원측정](a11y-pixel-summary.json)).


## 번들 예산

고정 `/tmp/s3-bundle-baseline.json`의 SHA-256은 **2605437e04a5d77ed41c2dbfac4fae864a6a9c8b5e56941e696a80b7f76ac692**. 원본 기준선은 편집하지 않았다. 전체 route 비교에 필요한 baseline perRoute값은 이미 들어 있는 중복 제거 `files[].routeOwners/gzipBytes`에서 정확히 재집계했다. PDF값171,864B 일치 및 각 파일/모듈 불변을 단언했다. 새 기준 빌드로 교체하거나 누락 route를0으로 간주하지 않았다([전체 비교](bundle-full-comparison.json)).

| 지표 gzip | 현재 | 고정 기준 대비 게이트 증분 | 상한 | 잔여 |
|---|---:|---:|---:|---:|
| entry |306,237B|+6,950B|20,480B|**13,530B**|
| 선택 PDF route |190,745B|+18,881B|61,440B|**42,559B**|
| shared net |3,228,428B|+2,161B|30,720B|**28,559B**|
| app |5,495,335B|+28,748B|81,920B|**53,172B**|
| CSS |37,905B|+218B|10,240B|**10,022B**|

전체 route 합계 증분은 **−490,157B**이며 다른4지표는 위와 동일하다. QR route 총감소−508,957B가 있으므로 전체 합계만 보았다면 PDF 증가를 희석한다. **scoped PDF + 4전역 게이트는 정본 확정28의 선택route 계약이며 오히려 해당 증가를 계속 드러낸다.** U4-3도 같은 `BUNDLE_ROUTES=pdf-editor`를 사용했음을 당시 commands.jsonl로 확인했다. 상한·override·multiplier 변경0.

## 검증 실행·환경·불변

요구 공통 명령을 전부 직접 실행했다. tsc·unit **306/306**·production build **2,847modules/69정적 페이지**·static **116문서**·PDF finish·PDF/전체 browser·new-tools·utilities·Office·QR2종·recovery **147cases**·Excel2종·CSS/manifest/registry/diff가 모두 exit0. QA build 후 axe **12페이지/자동위반0(수동판정은 위 실패)**, rendering **7대상×3회/maxCLS0.0001480365514755249**. legacy oracle **totalDiffs0**. 원명령·환경·exit·초·원출력은 [실행표](command-table.md)에 있다.

시각은 **ko 실행211/211, en 실행211/211 일치**, 각각 약7분42초, 합계 **15.43분**(20분 이내), 전체 matrix/filter all/concurrency1. “언어별211”은 LANG을 바꿔 전체211시나리오를 각각 실행한 수치이며211개의 한국어 전용/영어 전용 시나리오를 만들었다는 뜻이 아니다. threshold0.100%·pixel threshold0.1·AA 제외·기존 footer 시계 허용 영역 그대로. 기준선이 회귀를 이미 수용한 R4/R5는 이 자동 일치와 별도로 실패 판정한다.

생성된 골든128PNG를 원픽셀에서 독립 전수 집계해 고정32지표와 sol128metrics를 모두 대조했다([독립 재집계](golden-independent-recount.json)). 정상 배경48쌍의 겹침은 전부 원본 blue가 위, foreground는 watermark red가 위였고, 빈 Contents16쌍은 원본이 없다는 기대와 일치한다.

광고의 별도 production 빌드에서 ko/en `/watermark`는 ready1·광고 script1·`adsbygoogle.js` 요청1씩. **이 추가 검수는 외부 요청을 기록한 뒤 stub 응답**해 실제 외부 서비스를 접촉하지 않고 로더 호출을 확인했다([측정](production-ads.json)). 격리 경로는 공통 production browser·Office·QR·recovery/정적·repo-wide unit 결과로 검증했다.


최초 시각 ko/en은 캡처0/211, `VISUAL_CAPTURE_DIR must be a child of tests/visual-artifacts`로 각각 exit1이었다. 이는 검수자가 지정한 산출 경로 오류다. 원로그를 보존하고 capture 경로만 archive의 `tests/visual-artifacts/{ko,en}/captures`로 정정해 재실행했다. 제품·기준선·threshold·AA/허용 영역은 바꾸지 않았다. 독립 PNG 재집계의 첫 Python 실행은 numpy 미설치로 중단됐고, 추가 설치 없이 Pillow로 동일 원PNG를 전수 집계했다. 이것을 제품 실패나 성공 캡처로 세지 않는다.

Node22.17.1 / Chrome152.0.7977.64 / Poppler24.02.0, `NODE_OPTIONS=--max-old-space-size=4096`, build/browser/visual은 직렬·visual concurrency1. 모든 Vite는4270 `--strictPort`, recovery는4271 정확 bind. legacy oracle의 원 하네스 `listen(0)`만 `/tmp` preload로4279 정확 bind에 대응시켰다([포트 shim](probes/strict-legacy-port.cjs)); oracle 소스와 기대값은 무수정이다. 의존성·벤더 cache는 원본에서 독립 복사했으며 새 다운로드 결과를 정본에 채택하지 않았다.

시작·종료 HEAD **5767f135443f113e655fbb0801a01e4d3c11de23**, branch **s3-pdf-finish** 동일. 원본 추적 **2,601파일 SHA-256 전부 동일**, 시작·종료 status 동일(기존 사용자 미추적4항목만 존재). 검증 archive도 추적2,601파일 변경0이며 **시각 기준선211PNG SHA 동일**. 고정 bundle baseline SHA도 동일. [불변 결과](invariance.json), [시작 SHA](evidence/start-sha.json), [종료 SHA](evidence/end-sha.json), [시작 status](evidence/start-status.txt), [종료 status](evidence/end-status.txt). 커밋·push·브랜치 전환 없음. 참조 정본/지시서는 읽은 원문을 [evidence](evidence/instructions-sha.json)에 SHA와 함께 보존했다.

**U4-5 착수 조건:** R1~R9와 사후 검증/정본 경계 판정 잔여를 해소하고 재검수 통과 → Claude가 U4-4 종결 및 F3 정본 dispatch를 발행. main 동기화는 기존 Claude 결정에 따르며 이번 검수에서 하지 않았다.

**번들 잔여:** entry13,530B · PDF route42,559B · shared28,559B · app53,172B · CSS10,022B. 각각 동시 준수할 게이트로, 서로 합산해 사용할 예산이 아니다.

**[수정 후 재검수] — Codx**
