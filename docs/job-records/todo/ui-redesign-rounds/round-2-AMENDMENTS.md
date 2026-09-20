# v2 → 정본 반영 문안 (Claude 수용 대기)

2026-09-07 · Codx. 사용자 결정 ①shadcn 전면 제거 ②셸/홈/도구 전체 ③WebP/AVIF ④홈ko20/en19 전부 ⑤HOW IT WORKS 유지에 대한 이의0. 아래 N1~N7은 구현 계약 확정·문안 정정 단위다. 보고서를 쓴 것만으로 Claude 수용이나 이견0을 주장하지 않는다.

## N1. 1차 수용 문안의 누락·오기 정정

- v2 R4의 "CSP 있는 RHWP vendor entry/print 3문서"를 **"RHWP vendor 2문서와 별도 인증1문서"**로 교체한다. 예외 정본:
  - vendor/rhwp-studio/0.8.6/index.html: vendor editor entry, rhwp upstream 소유, CSP 있음.
  - vendor/rhwp-studio/0.8.6/print.html: vendor print, rhwp upstream 소유, CSP 있음.
  - naver05161fb06bc9701a23cfc09ad5773578.html: 검색 소유권 인증, Worklazy 운영 소유, CSP 없음.
  이 정확한3경로는 bootstrap 삽입 대상에서 제외한다. vendor wildcard 예외로 새 HTML을 자동 제외하지 않는다. 나머지 모든 제품 HTML은 재귀 검사해 bootstrap1회·module이전·native scheme·단일 theme-color를 확인한다. main 실측104는 착수 S3통합 hash에서 다시 산출한다.
- 1차 보고서도 총107/제품104 설명 뒤 CSP 문장에 예외3개를 섞어 썼다. 이는 Codx 자기 정정을 포함한다. 잘못된 1차 문장을 그대로 계승했다는 이유로 v2를 통과시키지 않는다.
- R4에 storage write 실패 시 현재 탭 테마 유지, init와 React 순환의 네 값/default 명세 일치, slow/fail module·JS-off·404/격리 복구 테스트를 명시한다. startup-help는 white/#222 CSS 비의존 고정 fallback을 택한다.
- R5/R12에 tests/unit/ui-legacy-isolation.test.ts의 rules>=541 및 OS-media/source-count oracle 교체를 추가한다. 숫자를 낮추는 것이 아니라 global/theme 합산 CSS owner·충돌·scope 검증으로 대체한다. p1b-components의 node_modules 파일 읽기 외 six-accent 구현 강제 assertion도 단일 primary 제품 행위로 교체한다. 원래155 legacy rule의 historical manifest를 현행 CSS 최소개수와 혼동하지 않는다.
- "data-slot/ARIA 전부 보존"은 공용 프리미티브/도구 테스트 표면 기준이다. native language select·home trust article처럼 승인된 구조 변경은 SELECTORS.md에 적힌 대체 계약을 따른다. old group role·hero feedback anchor를 테스트용으로 숨겨 유지하지 않는다.

## N2. 단계 소유권·검증·실행 게이트

v2 단계표와 완료 기준은 GATES.md를 정본의 완료 판정 표로 편입한다. §6-B의 "이 계획 W5(도구 화면)에 포함"은 **W4 구현·W5 최종 검증**으로 바꾼다. U1~U6 모든 항목을 작업 체크리스트에 각각 등록하고 UI이관을 일괄 생략하지 않는다.

새 header 규격은 N7. U2 rail sticky top80은 desktop header64+gap16으로 표현한다. U1 529px은 이전 셸에서 잰 값이므로 새248px sidebar와 padding을 차감한 최종 폭을 재측정한다. 문서최소폭940·rail156/52·gap12/8·320EN수리·상태유지·결과ARIA·합성DOCX helper·axe/render 등록은 그대로 필수다. 엔진 잡/사용자 입력문서 원본을 수정하지 않는다.

착수는 S3 main 통합 후 새 hash의 단일 정본이 전달된 뒤다. 통합 직전 열린 P2/shadcn 계획의 과거 source-count/palette/baseline 지시를 이 계획이 대체한다는 표면별 소유권을 정본에 명시한다. 문서 비교 엔진은 별도 잡 소유, U1~U6 화면은 이 작업 소유. 아무 충돌도 없다고 암묵 가정하지 않는다.

## N3. CSS 대비와 상태 토큰

v2 R2/R3의 출발값은 유지하고 **evidence/palette-proposed.json 및 lab/palette.css**의 4테마 상태 값을 정본 token 표로 추가한다. 케이스별 계산은 evidence/contrast-calculated.json, 실제 computed CSS 대조는 evidence/browser.json이다.

- 의미 별칭: --wl-sidebar-bg/--wl-card-bg는surface, --wl-hero-bg는hero. brand accent와UI primary는 별도token이되 이번값은 같은primary값. 호환 --accent는soft(브랜드primary가 아님), --ring은focus, --destructive는errorText에 연결한다.
- bg/surface/surface-muted/hero, text/secondary, primary/onPrimary, hover/active, disabledBg/disabledText, soft/onSoft, controlBorder, focus, success/error/warning/info, documents/media/other tint, document preview paper/text·insert/delete·checkerboard 두 칸을 분리한다.
- CTA normal/hover/active/disabled 글자는 **불투명 값**을 쓴다. 비활성 컨트롤은 규정상 대비 예외일 수 있으나 이 계획의 제품 하한은4.5로 유지한다. opacity .5로 부모 전체를 흐리게 하지 않는다.
- 기존 ring-primary/30·ring-ring/30은 단독 focus 표시로 금지. 3px solid focus outline + 2px 배경색 간격을 써서 adjacent 배경과3이상. shadow/glow는 장식이며 필수 경계를 대체하지 않는다. focus outline을 clipping하는 부모 overflow도 실측한다.
- 본문/보조/placeholder/CTA/tag/tint/toast/diff 모두 4.5 기준, 실제 large CSS임을 확인한 경우만3. 144쌍의 실험은 전부14px/500 텍스트와 비텍스트 경계로 분리했으며 large 예외를 사용하지 않았다.
- 문서/PDF 종이 내용의 white preview는 테마 독립이 필요하므로 반드시 previewText=#101827과 쌍으로 scope 지정한다. 흰 종이 위에 dark theme의 white 본문색이 상속되지 않게 한다. 앱 결과 diff는 테마별 success/error 토큰, 흰 종이 내부 diff는 별도 previewInsert/Delete 토큰. 둘 다 추가/삭제를 텍스트/ARIA/기호로도 식별한다.
- raster/canvas의 문서·이미지 원본 색은 도구 처리 의미이므로 필터를 적용하지 않는다. preview 바깥 toolbar/host는 theme 소유. checkerboard 위 안내 글자는 두 색 모두에서 검사.
- source theme CSS 외 임의 opacity/gradient/직접 색 override가 생기면 계산표 통과를 제품 통과로 재사용하지 않는다. 실제 DOM 합성 최저값이 정본 최종 게이트다.

## N4. 프리미티브 계약

PRIMITIVES.md의 공통 규칙·7종 표·Sheet8항을 W1a/W1b 계약으로 채택한다. v2의 키워드 목록을 이 표로 대체한다. native dialog는 브라우저가 배경 inert/top layer를 제공하지만 **명시적인 양방향 Tab wrap·controlled state 동기화·nested stack·scroll lock 복원**이 필요하다. React/DOM/ref/event merge 동작을 소비자마다 임의로 다르게 구현하지 않는다.

CVA는 유지한다. BaseUI/shadcn 제거는 W4에서 repo-wide 실행 import·CSS·설정/package/lock·license 입력 검사로 종료한다. documentation/changelog/명시 fixture의 과거 명칭까지 억지로 지우는 문자열0건 검사는 아니며 예외는 exact file/purpose/owner를 적는다.

## N5. 정확한 profile集合·공통 fixture·20분 상한

- 시작 관측 c8bff1f의 85scenario/203 PNG에 family만2배한 **406개 전체 조합을 CSV/JSON으로 첨부**한다. light-coral88/dark-coral115/light-mint88/dark-mint115, home16. 모든 상태의 full4theme라는 표현을 쓰지 않는다.
- 새로운 검색·drawer/collapsed state와 이관 문서결과6profile은 별도70app 항목(visual-profiles-additions-proposed.json). app476을 현재 잠정 전체집합으로, 7종 실제 public primitive fixture16은 별도 행동suite로 정한다. 새 검색 등은 scenario ID·정확한 locale/viewport/theme가 지정된 목록대로 등록한다.
- profile 확대 시 tests/visual-regression.config.mjs의 viewport에 desktop-1920=1920×1080을 추가한다. mobile-320은 기존320×844 유지. existing scenario의 원 fixture/state를 보존한다. doc-result 새 상태는 §6-B 장문·다중변경 입력으로만 진입, direct result URL goto 금지.
- tests/ui-theme-fixture.mjs는 probes/theme-fixture.mjs의 adapter API를 채택한다. 같은 serialized seed를 Puppeteer evaluateOnNewDocument와 Playwright addInitScript에 쓰고 **캡처 직전 actual html dataset/theme/colorScheme/lang/localStorage**를 단언한다. vendor iframe에 root 강제주입 금지. seed가 HTML값까지 강제로 덮으면 제품bootstrap 미실행을 가리므로 저장값만 seed하고 제품이 root를 설정하게 한다.
- a11y/rendering의 init·baseId·exception·placeholder 집계와 등록 확장은 GATES.md대로 변경한다. 저장 실패 복구는 seed 없는 별도context.
- 기존 하네스에는 VISUAL_SHARD 옵션이 없다. 새 exact shard 계약을 구현하여476개를238/238로 직렬 실행하고 각20분을 timeout으로 강제한다. full manifest 합집합과 UPDATE 없는 전수검증으로 모든 조합 통과를 입증한다. 406 또는476 전체1회가 반드시20분이라는 문구는 제거한다. 도중 timeout을 suite축소로 덮지 않는다.

## N6. 검색/select·기존 테스트·라우팅

SELECTORS.md의 파일·selector별 변경표와 상태 소유권을 편입한다. 핵심은 HWP trailing slash 정규화, search/hash 보존, 현재 ToolsPage 필터와 topbar matcher 공유(기존 eyebrow/category 검색 보존), 검색 자체의 초성/IME/pointer/visible-viewport 계약이다.

native select는 combobox의 한 종류이므로 전역 검색을 찾는 test는 반드시 global-tool-search ID 또는 accessible name으로 scope한다. 언어 변경의 source-string test는 실제 선택·경로·storage·document.lang 테스트로 교체한다. 기존 ToolCard/도구 button selectors는 유지한다.

## N7. 구현 선택지가 남은 layout·copy·asset 결정

- desktop≥821: sidebar expanded248px, hidden0, topbar64px. content horizontal padding24px. mobile≤820: sidebar는 left drawer, 폭min(360px,100vw-20px), 세로 available viewport에10px 상하 여백, 자체 스크롤. topbar는 두 행(8px top+40px controls+8px gap+40px search+8px bottom=104px), horizontal16px. 첫행 menu40/logo32/select64/theme40/GitHub40 + gap 4×8=248px, 좌우32를 더해320에서도40px 여유. 알림종 없음. 검색항상 노출.
- --wl-header-height=64px 또는104px+safe-area-inset-top, --wl-bottom-nav-height=72px+safe-area-inset-bottom. main은 실제 fixed header와 bottom nav 만큼 공간을 예약. desktop document rail sticky=header+16px, image editor sticky=header+8px. HWP focus shell은 topbar/side area를 뺀 공간으로 한정. 별도 예외 확대 대신 새 geometry를 계측.
- Home grid는 v2 viewport breakpoint를 유지. 문서 결과의 과거 최종본문폭은 재실측하며 legacy padding을 불변이라고 약속하지 않는다. card의 min-width0·영문 clamp·실제 DOM全文·하단 탭 여유 보존.
- topbar/drawer의 route·role labels·키보드 안내는ko/en. hero는 테마별 문구변경0. ko는 v2 제안 그대로. en kicker "Small tools for everyday work"; subtitle "From documents and data to images and video, no installation or sign-in is needed. Choose a tool to make complex tasks simpler."; trust "No file uploads / Everything is processed in your browser." 기존 en headline 의미/순서는 유지하고 강조구간을 전용 i18n markup으로 분리. footer 법적링크·동의 재열기·문의 destination 유지.
- Asset 파이프라인의 두 선택지 중 **생성물 커밋+CI SHA 검증**을 채택한다. source scripts/assets/hero-coral.png·hero-mint.png, generated public/assets/hero/{coral,mint}-{480,960,1440}.{avif,webp}. generator만 출력 수정. 현재1차 변환의 encoder signature=ImageMagick6.9.12-98 Q16 x86_64(18038), WebP quality82/AVIF50·strip·width·MAGICK_THREAD_LIMIT=1. encoder/delegate signature와 원본/12개SHA·dimensions·명령을 manifest에 고정한다.
- local 재생성은 명시 generate 모드에서만 하고 고정encoder 검사에 실패하면 출력 교체0. CI verify는 원본hash/산출hash/개수/byte budget를 검사하므로 새encoder 설치에 의존하지 않는다. 브라우저 decode 검사로 codec·intrinsic尺寸 검증. W3 완료 조건은 AVIF≤50KiB/WebP≤160KiB와 실제slot/DPR2/throttle 측정 모두이며 임의 상향 금지.
- sizes는 위 레이아웃과 같은 CSS 변수/계산을 사용하여 브라우저에서 actual slot차≤1px. dark/light는 같은 family source, family 바뀔 때 picture source+img srcset 동시 갱신, 앱 상태 remount 금지. 장식이미지 alt="", 민트 한글장식은 원본장식으로 명시. hero 그림의 glow가 텍스트 뒤로 번져 대비를 바꾸지 않도록 이미지영역에 제한.

## 제품 규칙 재점검·현재 결론

규칙4: local search·ko/en·static SEO/FAQ/sitemap/canonical/hreflang·consent 재열기·AdSense 격리/추적 host 조건을 실제 source/static/browser로 검증한다. video analytics 허용/office·XLS 제외는 그대로. 새 검색 popup·CTA·광고가 겹치지 않음을 geometry로 검사. backend/SSR 의존0.

규칙5: theme/storage/asset 오류의 원시 예외·Worker/runtime/광고상태를 사용자 UI에 추가하지 않는다. diagnostics는 테스트 artifact로만 저장. CLIENT SIDE 브랜드 보조문구는 기존시안 의미 범위.

규칙19: 이번 Codx 프로토타입 캡처는 Gemini의 최종 QA 육안검수를 대체하지 않는다. 글자 잘림/세로낙하·control/thumb 정렬·하단 안전영역까지 Gemini 육안과 Codx 수치로 교차한 뒤 최종production/static·배포1회.

**현재 잔여 이견7건(N1~N7).** 위 문안의 Claude 수용·정본 반영을 확인하면 새 쟁점이 없는지 다시 대조하여0 여부를 판정할 수 있다. 지금은 **[정본화 보류]**. 사용자 결정을 뒤집는 ★사용자 확인 항목은0. 이후 이견0에 도달해도 **구현 착수는 S3 main 통합 뒤의 갱신 정본 수령 후**다.

— Codx
