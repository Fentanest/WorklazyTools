# 검색·native select: 변경 표면과 정본 문안

## 실제 재현

NODE_OPTIONS=--max-old-space-size=4096 node /tmp/worklazy-ui-r2/probes/routing-browser.mjs

| 실제 기존 화면 입력 | 기존 영어 전환 출력 |
|---|---|
| /ko/tools?category=media&q=pdf#sample | /en/tools?category=media&q=pdf#sample |
| /ko/tools/hwp-editor?category=documents&q=pdf#sample | /en/tools?category=documents&q=pdf#sample |
| /ko/tools/hwp-editor/?category=documents&q=pdf#sample | **/en/tools** (query/hash 소실) |

코드 근거: src/components/LanguageSwitcher.tsx의 currentPath strict equality는 끝 slash를 제거하지 않는다. fallback LocalizedNavigate는 search/hash를 붙이지 않는다. 새 select는 이 결함을 보존할 필요가 없으며, 제품의 HWP 영어 제외 정책을 보존하면서 직접 목적지를 정규화한다.

## 파일·selector별 변경

| 파일/현행 위치 | 현행 계약 | 대체 계약 |
|---|---|---|
| src/components/LanguageSwitcher.tsx | ToggleGroup/Button aria-pressed, compact prop | compact/public path 유지; select[data-ui-component=language-switcher]. value ko/en, option text KO/EN, 이름은 language.switchLabel. 별도 role 부착 금지(native combobox 의미). onChange에서 value whitelist 후 기존 navigation 함수 호출. |
| tests/utility-tools-smoke.mjs:39~55 | .ui-language-switcher tagName DIV/role group/button pressed, .desktop-language-switcher button nth-child(2), ArrowRight+Space | select[data-ui-component=language-switcher]의 SELECT/name/options/value를 단언. Puppeteer page.select(selector,'en'/'ko'); lang/path/query/hash/storage 확인. 키보드 사례는 select focus→ArrowDown→Enter(플랫폼 실제 native 변경시점 확인), toggle의 Space 규약을 강제하지 않음. 반환 후 focus는 같은 select. |
| tests/utility-tools-smoke.mjs:90~116 | OS dark를 emulate하면 도구 카테고리가 dark라고 간주 | actual UI 테마 전환 또는 공용 helper로 상태 변경 후 data-theme 단언. OS emulate는 독립성 부정대조에만 사용. 카테고리 선택 버튼도 single primary·onPrimary 조합 확인. |
| tests/utility-tools-smoke.mjs:118 | .tool-search input[aria-label="도구 검색"] | 기존 ToolsPage input은 .tool-search 아래 유지. 더 명확한 data-testid=tools-search-input 추가. 전역 input은 data-testid=global-tool-search로 분리. getByRole('combobox') 무범위 사용은 language select와 충돌하므로 금지. |
| src/pages/ToolsPage.tsx | .tool-category-groups[aria-live=polite] 전체 목록 | 카드 컨테이너 live 제거; [data-testid=tools-search-status][role=status][aria-atomic=true]에 개수만. 전체 등록/쿼리 category/registry順 유지. |
| tests/utility-tools-smoke.mjs:133~177 | bottom sheet 10px/role/21 .sheet-tool-item/마지막 link→close wrap | W1b까지 old geometry. W2부터 left drawer의 panel rect와 menu role 유지; 도구 링크20/19의 ID/href 집합을 검사하고 Home/AllTools/정보/문의/PWA는 별도. last-child가 PWA/푸터 추가 후 마지막 focusable이 아닐 수 있으므로 실제 visible enabled tabbables의 first/last로 wrap 확인. |
| tests/utility-tools-smoke.mjs:178 이후 | 메뉴를 닫은 후 .app-install-button이 보임 | W2는 drawer를 다시 열고 PWA 설치 진입과 성공/취소 상태 검증. 기존 앱설치 stub/사용자 제스처 계약 유지. |
| tests/utility-tools-smoke.mjs:56~67 | .hero-kicker 카피, .hero-feedback 안 링크/설명 | kicker fixedko/en 유지. trust는 [data-testid=home-local-processing] noninteractive article; feedback은 footer 또는 drawer 문의 링크에서 동일 destination 검증. 이전 hero-feedback 링크를 의미 없는 hidden anchor로 남겨 테스트를 속이지 않음. |
| tests/unit/p1b-components.test.ts:63~77 | ToggleGroup source·BaseUI node_modules role/aria-pressed | 순수 destination/whitelist 테스트 + browser native select 행위. compact export는 유지, library 소스 접근 제거. Progress/6색 source oracle도 함께 의미검사로 이동. |
| tests/unit/app-shell.test.ts:21 등 | aside class="sidebar glass-panel"·소스 구조 regex | host landmarks·tool href 집합·route boundary·현재 위치 aria-current·광고 owner allowlist의 실질 보존 검사로 갱신. |
| tests/new-tools-smoke.mjs:195~200 | HWP focus top≤10, sidebar 오른쪽부터 1435이상 | 새 topbar의 bottom 기준으로 focus.top=header.bottom, sidebar expanded/collapsed별 left, viewport right와의 여백 계약. header를 덮는 이전 top0 수치를 유지하지 않음. |
| tests/control-geometry-smoke.mjs:50; tests/ui-migration-layout-smoke.mjs:33; tests/excel-compare-smoke.mjs:279 | OS brightness만 theme으로 사용 | tests/ui-theme-fixture.mjs + 캡처 전 DOM assert. focus/선택/scroll 시나리오는 기존 동작 그대로. |
| tests/visual-regression.scenarios.mjs:home/tools/HWP loaded | .home-page .hero, tools .ui-tool-card, HWP desktop language collision | .hero/.ui-tool-card는 유지 가능. 새로운 data-testid=app-topbar/desktop-sidebar/global-tool-search/global-search-results/global-search-status를 고정. 검색 open/empty/active + sidebar collapsed + drawer open 등록. HWP 영어 redirect 기존2profile 유지. |
| tests/visual-artifacts/pqa-fix-evidence/probe.mjs:39 | mobile-header 또는 desktop-language-switcher 좌표 | 보존된 과거 증거라 덮어쓰지 않는다. 신규 geometry probe는 [data-testid=app-topbar] select의 rect 사용. |
| tests/accessibility-audit.mjs | 모든 페이지 ko/OS light, placeholder 단일변수 | theme/locale/baseId 분리, target별 result row. named native select+named global combobox+ToolsPage textbox 구별. HWP iframe exact exception만. |
| tests/rendering-baseline.mjs | observer가 storage locale ko 덮어씀 | metric observer에서 storage mutation 제거. seedTheme를 먼저 같은 init에 넣고 실제 DOM값 기록. 새 검색/드로어 오버레이가 page CLS를 만들지 않는지 추가. |
| §6-B U4 browser-smoke.mjs | 문서 모든 role=row를 본문으로 선택 | [role=row][data-document-kind]. columnheader wrapper row 추가와 함께 교체; PDF U4와 다른 UI 이관 항목임. |

원문 hit는 evidence/selector-hits.json(53개). 위 목록은 파일별 의미판정이며 저장소 전체 text hit를 자동 allowlist로 쓴 결과가 아니다. shared data-testid/data-slot은 기존값 유지가 기본이고, 언어·hero처럼 제품 구조를 의도적으로 바꾸는 곳은 문서화한 대체 계약만 허용한다.

## 검색·언어 상태 소유권: sol 재해석 제거 제안

- topbar query와 ToolsPage query는 AppShell 내부 SearchState context의 별도 필드로 보관한다. ToolsPage를 입력할 때 전역 popup을 동기화하지 않는다. 두 필드는 언어 전환 때 유지, 일반 route 이동 때 topbar popup만 닫는다. 임의 서버/URL 검색 API 없음.
- ToolsPage의 현행 검색은 local state이고 URL의 q를 해석하지 않는다. 기존 q 등 알 수 없는 query는 language 전환 때 byte string 그대로 보존하되, 이번에 새 URL검색 기능을 도입하지 않는다. category는 기존 useSearchParams 계약.
- matcher는 공유 순수 함수. v2의 name/shortTitle/description/highlight + 명시 aliases와 함께 **기존 ToolsPage가 검색하던 eyebrow·category label/shortLabel도 유지**한다. 내부 ID와 JSON property name은 검색어 corpus에 넣지 않는다. locale별 availability를 먼저 적용하고 순서는 registry.
- alias는 repo 고정 데이터: excel-merger/compare/cleaner에 엑셀/xls/xlsx, document-compare에 문서/워드/한글/docx/hwp, hwp-editor에 한글/hwp/hwpx, pdf-editor에 피디에프/pdf, image-studio에 사진/이미지/png/jpg. 그 외 이름/설명으로 검색. 매칭 수를 시안에서 추정하지 말고 fixture exact ID로 고정.
- NFKC+lowercase+공백 정규화 후 AND 부분일치. **초성 전용 질의는 전체 질의가 공백 제외 초성인 경우**에 한정한다. Ko title/shortTitle/alias의 초성도 NFKC로 바꾸어 query와 같은 문자공간에서 비교한다. EN UI에서도 ko corpus를 찾는다. mixed "ㅁㅅ pdf"는 초성 전용 취급하지 않는다(프로토타입은 token별 초성을 허용했으므로 제품 복사 시 이 차이 고정). fuzzy/오타보정 제외.
- Excel 검색 결과는 세 Excel도구 외 **문서 비교의 Excel보고서 설명**도 맞는다. 이번 프로토타입은 전각ＥＸＣＥＬ→4 ID, 엑셀 alias→3 ID. 3개만 기대해 잘못 축소하지 않음.
- 초기 빈 query popup 닫힘. focus만으로 목록을 열지 않음; ArrowDown/Up로 현재 locale의 전체20/19 목록을 열어 첫/끝 진입 가능. query 갱신은 active=-1. 닫힐 때 aria-activedescendant 제거, controls가 가리키는 hidden listbox DOM은 유지. option ID는 tool ID 기반으로 locale/route 렌더 중 dangling ID 방지.
- Enter는 열린 목록의 활성 옵션만 이동. pointer 선택은 mouse down에서만 blur를 막고 touch scrolling에는 preventDefault하지 않음. 리스트 touch drag/scroll을 selection으로 오인하지 않도록 이동거리와 pointer cancel을 확인한 후 click 동작. Escape는 query/focus 유지, Tab은 preventDefault 없이 닫음. outside blur/route/locale 변경은 active 지움.
- IME compositionstart는 active/popup 닫음, compositionend에서 matcher1회 갱신. composing/isComposing/keyCode229에는 Enter/arrow navigation 금지. 결과 개수 role=status만 live; locale별 0/1/N 복수형.
- Ctrl/Meta+K는 defaultPrevented, IME, Alt/Shift, textarea/input/contenteditable/**select**, 열린 modal에서 무시. preventDefault는 실제 검색 focus가 가능할 때만. iframe/browser chrome 선점 보장 없음. 항상 보이는 search input 유지.
- 모바일 popup은 input rect와 visualViewport offsetTop/height에서 남은 높이 계산. max-height=min(320px, available space-8), overflow:auto, soft keyboard resize에 갱신. trigger/header/modal unmount 때 viewport listener cleanup. field가 keyboard에 가려지면 scrollIntoView(nearest), backdrop/modal stack보다 앞에 그리지 않음.
- language select는 현재 locale 값의 native control 하나만 활성 렌더. options KO/EN, compact prop은 모양만 바꿈. onChange whitelist; 같은값이면 navigate/store0회. HWP 검사 때 trailing slash 제거 후 /tools/hwp-editor와 비교; EN 대체는 /en/tools에 원 search/hash 보존. 다른 경로는 기존 localizedPath. navigate state provider를 locale/theme key로 remount하지 않음. HWP영어 unavailable 폴백도 같은 search/hash 규칙으로 일치시킨다.

— Codx
