# 메인 UI·4테마·shadcn 제거 — 반박 1차

2026-09-07 · Codx (astra 검토 역할). 대상: `docs/jobs/todo/ui-theme-redesign-20260907.md` v1, §7 (a)~(j). **정본화 전 잔여 이견 12건(R1~R12).** 아래 문안은 Claude의 수용·정본 반영을 요청하는 제안이며, 합의 완료를 뜻하지 않는다. shadcn 전면 제거·전체 UI 개편·WebP/AVIF라는 기존 사용자 결정에 대한 이의는 **0건**이다.

실험은 `/tmp/worklazy-ui-r1/main`의 `git archive 5bc6854175331bdd73b267784d9633cdccda8446` 사본에서 수행했다. 제품 저장소의 추적 파일 수정·브랜치 전환·커밋·push·npm 설치는 하지 않았다. 시작/종료 증명은 아래 불변성 절과 `evidence/git-*.txt`, `sha-*.json` 참조. 병행 S3 잡이 HEAD와 일부 파일을 변경하므로 전체 저장소 SHA 동일을 주장하지 않는다.

## 판정 요약

| §7 | 판정 | 핵심 근거 | 연결 이견 |
|---|---|---|---|
| (a) | **[반박]** | 지정 main은 dark 50파일·소비 61파일·175장. 51·62·203은 S3 수치. 843줄·5카테고리·ko 헤드라인은 일치 | R1 |
| (b) | **[보완]**, custom variant 자체 [동의] | 실제 dark/hover/aria-invalid 변형 작동. 별칭만 붙이면 흰 히어로에 흰 글자, OS 변경 시 배경·destructive 값 변화 | R2·R3 |
| (c) | **[보완]** | 초기화는 104개 제품 HTML에 정확히 1회 전파. 오류·저장소 차단 복구 작동. 61은 crawlable 수 | R4 |
| (d) | **[반박]**, 제거 결정 [동의] | import만 바꾸는 작업이 아님. Base UI 동작·타입·CSS 상태 변형·의존 패키지 직접 읽는 테스트까지 대체 필요 | R5 |
| (e) | **[보완]** | 검색 기능은 ToolsPage에 이미 존재. 전역 검색은 새 계약. 기존 색인만으로 “엑셀”·초성 실패 재현 | R6 |
| (f) | **[반박]**, 변환 실행 가능 [동의] | 12종 실제 변환·캡처·LCP/CLS 완료. 이미지 바이트는 현행 JS/CSS 5지표에 포함되지 않음 | R7 |
| (g) | **[반박]** | LANG 필터 없음, partial update도 예상 밖 baseline 전역 삭제. 4테마 확장 방식에 따라 350/406 또는 훨씬 많음 | R8·R9 |
| (h) | **[보완]** | 시안 픽셀 대비 측정 가능하나 CSS 적합성 증명과 구분. 코랄 CTA·라이트 태그 등 보정 필요. axe incomplete를 성공으로 세면 안 됨 | R3·R12 |
| (i) | **[보완]** | 행위 대체를 작은 단위로 먼저 검증하는 것은 타당. 7종 제거·62 import·셸 재설계를 한 단계에 묶는 순서는 분해 필요 | R10 |
| (j) | **[보완]** | 레이아웃·문구·카드/태그 수·언어 선택기·격리 화면·PWA/하단 탭·검증 명령 미확정 | R9·R11·R12 |

## (a) 기준 해시와 현행 실측 — [반박]

재현:

```sh
cd /home/better0101/projects/worklazytools
git rev-parse HEAD main
git archive 5bc6854175331bdd73b267784d9633cdccda8446 | tar -x -C /tmp/worklazy-ui-r1/main
python3 /tmp/worklazy-ui-r1/inventory.py
```

시작 출력: HEAD `002732a7d79b0a0a5851bf2e20ccdd83d6bdedfc`, main `5bc6854175331bdd73b267784d9633cdccda8446`, 브랜치 `s3-pdf-finish`. 지정 해시를 실험 기준으로 사용했으므로 현재 HEAD 차이는 실험 중단 사유가 아니다. 구현 착수 기준으로 이 사본을 재사용해서는 안 된다.

| 항목 | 지정 main 실측 | 판정 |
|---|---:|---|
| TS/TSX에 `dark:` 포함 | **50파일**, scanner의 dark 후보 **89개** | 초안 51 정정. S3 신규 `PdfFinishPanel.tsx`가 차이 |
| `ui/*.tsx` | 7파일 **545줄** | 동의 |
| `ui.tsx` | **298줄**, 합계 **843줄** | 동의 |
| UI import 소비 | **61파일(내부 포함)**, 58파일(해당 8개 구현 파일 제외), primitive subpath 직접 소비 51파일 | “62소비”는 기준·분모 모두 명시 필요 |
| global / tailwind CSS | 937 / 126줄 | 동의 |
| AppShell / Home / registry | 265 / 58 / 433줄 | 동의 |
| registry | 20도구, 5카테고리, 6 accent 값 | 동의. 화면 노출 **ko 20 / en 19** |
| 카테고리별 도구 | documents 7 / media 3 / text-data 4 / work 3 / security-share 3 | 3그룹 메뉴로 표현하면 **7 / 3 / 10**, en은 **6 / 3 / 10** |
| baseline | **80 scenario / 175 PNG**, 홈 8 PNG | 초안 203은 S3의 85 scenario 값 |
| ko 홈 헤드라인 | `귀찮은 파일 작업은` / `도구에게 맡기세요.` | 두 JSON 문자열 동의. 시안은 “도구에게”만 강조하지만 현행 span은 둘째 문장 전체를 감쌈 |
| 검색 | `ToolsPage`의 제목·shortTitle·설명·eyebrow·카테고리·highlights 부분일치 필터 | “검색 없음”은 **데스크톱 전역 검색**에만 맞음 |
| 격리 화면 | AppShell 아래에서 `aside/header/main/footer/bottom-tabs` 공통 렌더 | “셸을 우회”는 틀림. video 브라우저에서 isolation=true, sidebar=true, appShell=true |

근거 JSON: [inventory](evidence/inventory.json), [catalog](evidence/catalog.json), [S3 대비](evidence/s3-conflicts.json), [baseline DOM](evidence/baseline-browser.json). 캡처: [격리 video](captures/baseline-video.png).

**정본 반영 문안 (R1):**

> 실측표의 기준은 main 5bc6854이며 dark 사용 50파일·UI import 소비 61파일(내부 3개 포함)·시각 기준선 175장이다. S3의 51/62/203 수치는 별도 표로 유지한다. 실제 구현은 S3 완료·병합 뒤 새 기준 해시를 정본에 고정하고 모든 수치를 다시 산출한다. 도구 개수는 ko 20·en 19이며 HWP 영어 제외 정책을 보존한다.

## (b) 3층 토큰·manual dark — [보완]

재현: `prepare-prototype.py` → `VITE_LOCAL_QA=1 NODE_OPTIONS=--max-old-space-size=4096 npm run build` → `node r1-theme-browser.mjs`, `node r1-dark-probes.mjs`.

원시 팔레트 → 의미 토큰 → 기존 별칭의 **3층 구조는 빌드 가능**하다. 실험의 별칭은 legacy와 utility 양쪽 변수에 같은 의미 값을 공급했다. `@custom-variant dark (&:where([data-theme^="dark"], [data-theme^="dark"] *));`를 사용한 실제 컴파일 결과에서 다음을 확인했다.

- `bg-green-100 dark:bg-green-950/70`: light는 `oklch(.962 .044 156.743)`, dark는 `oklab(.266 -.0578814 .0295761 / .7)`. OS light/dark 변경과 무관하게 **data-theme**를 따름.
- `dark:hover:bg-input/30`: 실제 hover에서 manual dark의 입력 토큰 /30 적용.
- `dark:aria-invalid:border-destructive/50`: 변형은 작동하지만 **--destructive를 별칭에 빠뜨리면** OS light `.577…` → OS dark `.704…`로 색이 바뀜. 모양만 연결했다고 의미 토큰 완료가 아니다.
- dark 부모 안에 `data-theme=light-coral`을 중첩한 요소에도 dark variant가 붙는다. 현재 요구는 html 단일 테마이므로 **중첩 테마 지원 제외**를 명시하면 수용 가능. selector가 dark-임의값도 수용하므로 초기화 값은 네 가지 whitelist로 제한한다.
- 실제 50파일의 utility를 다시 쓰지 않고 selector 연결은 가능하나, hardcoded blue/green/violet primary와 error/success 의미를 자동 재분류하지는 않는다. `ui.tsx`의 `PrimaryButton`도 여전히 six accent mapping으로 버튼·hover·focus를 바꾼다. 이 부분은 도구 카드 배지와 별도로 교체해야 한다.

**부정 대조:** CSS 두 OS media 블록은 남기고 root 별칭만 재지정했다. dark-coral + OS light에서 히어로가 밝은 gradient인 채 글자는 `#f5f7fa`가 되어 읽기 어렵다. OS dark로 바꾸면 같은 저장 테마의 히어로가 어두워진다. `.glass-panel`, `.hero`, `.hero h1 span`, `.primary-link`, `.hero-kicker`, privacy/consent 배경, select/disabled, operation log, image/collage checkerboard 등 직접 선언이 남아 있다.

캡처: [dark-coral 부정 대조](captures/dark-coral-no-consent-negative.png), [dark-mint 모바일](captures/hero-dark-mint-390.png), [4테마 DOM/OS 교차](evidence/theme-browser.json), [유효한 utility 상태 probe](evidence/dark-probes.json). 초기 `theme-browser.json`의 `bg-white dark:bg-black` probe는 해당 dark 클래스가 기존 소스에 없어 컴파일되지 않은 **하네스 실수**이며 판정에 사용하지 않았다. 후속 `dark-probes.json`은 기존 소스에서 실제 사용하는 클래스로 교정했다.

인쇄 모드에서도 dark body·glow가 남음을 재현했다. forced colors는 Chromium이 Canvas/CanvasText로 바꾸고 shadow를 제거하지만, border 없는 컨트롤과 색만으로 상태를 전달하는 부분까지 자동 보장하지 않는다. 인쇄 전용 색·레이아웃과 forced-colors focus/control 경계 계약이 필요하다. 폼 `color-scheme`은 html에서 지정하되 커스텀 select 배경도 semantic 값으로 통일해야 한다.

**정본 반영 문안 (R2/R3):**

> W0에서 기존 두 `prefers-color-scheme: dark` 블록의 토큰과 직접 selector 규칙을 모두 새 semantic 테마 소유로 옮긴다. CSS layer 순서 `theme/base/legacy/components/utilities`와 호환 reset을 유지하며, 의미 토큰 alias가 뒤의 legacy :root나 OS media에 덮이지 않게 한다. dark variant는 html의 네 값에 연결하고 중첩 테마는 지원하지 않는다. 테마 선택과 OS 밝기를 교차한 8조건에서 색·native form scheme을 확인한다. print는 흰 바탕/검정 글자·장식 제거, forced-colors는 시스템 색과 식별 가능한 focus/control 경계를 사용한다.
>
> brand accent와 UI primary, on-primary, on-soft, hover/active, control-border, focus, disabled, success/warning/error/info를 각각 명시한다. 컨트롤은 단일 primary를 사용하고 카테고리 틴트는 배지/아이콘에 한정한다. diff의 삽입/삭제·PDF 선택·오류/성공 같은 의미 색은 카테고리 색으로 치환하지 않는다. `--accent` 호환 별칭은 기존 “soft surface” 의미로 유지한다.

## (c) FOUC·정적 HTML·복구 — [보완]

실험은 `index.html`의 charset 바로 뒤, 스타일과 module보다 앞에 독립 IIFE를 넣었다. storage try/catch 안에서 whitelist만 읽고 html data-theme와 native colorScheme를 설정한다. React·chunkRecovery·동의·격리 SW에 의존하지 않는다. 생성기를 직접 수정하지 않아도 현행 **sourceHtml template**을 통해 전파된다.

재현: `npm run build`; `npm run test:static`; `evidence/bootstrap-static.json` 생성 루프; `node r1-theme-browser.mjs`의 초기화 네 case.

출력: HTML 총 107, vendor RHWP 2문서·네이버 인증 1문서를 제외한 **제품 HTML 104**, **104/104 정확히 한 번** script 존재, **104/104 module 앞**, 제품 CSP meta **0**. Crawlable 61이라는 생성기 출력은 이 총수와 다른 개념이다. localized 페이지·redirect·루트 언어 랜딩·404·video·Office app·XLS preserve와 unprefixed redirect 문서를 모두 포함한다.

브라우저: 저장 `dark-mint` → 첫 paint부터 dark-mint; 잘못된 값 → light-coral; 테마 storage getItem 예외 → light-coral; entry module 요청 실패 + dark-coral → **#startup-help 표시·focus 복귀 성공**, 정상 기동은 도움말 없음. 500ms module 지연에도 first-paint의 data-theme가 이미 정해졌다. 테마 IIFE는 원시 예외를 출력하지 않았다.

QA 빌드에 대한 `npm run test:static`은 **exit 1**: `Google or Naver Analytics configuration is missing from the application bundle.` 기존 정적 검사가 production 분석 구성을 요구해서 난 실패다. 이를 테마 오류로 세거나 validator를 느슨하게 만들어 통과시키지 않았다. production 재빌드의 실제 결과는 마지막 검증표에 기록한다. `startup-help`의 white/#222 하드코딩은 정상 테마 대비와 별개로 명시적 예외 유지 또는 CSS-independent fallback 색으로 정해야 한다.

CSP 관련: 현재 일반 제품 문서는 inline 허용목록/nonce/hash enforcement가 없다. “허용목록 변경 불필요”는 **현재 코드에서만** 맞다. CSP가 있는 RHWP vendor entry/print에 테마 스크립트를 삽입하지 않는다. 새 전체 HTML validator는 해당 3개 예외를 정확한 경로·목적·소유자로 유지하고 script 수·허용값·module 선행을 별도로 검사해야 한다.

또한 `index.html`의 OS 기반 `theme-color` meta 2개가 남으면 브라우저 chrome 색은 저장 테마와 어긋난다. 여러 render 함수가 `<html…>` 전체를 바꾸므로 기본 data-theme 속성을 추가할 때 그 속성 보존도 함께 확인해야 한다.

**정본 반영 문안 (R4):**

> theme 초기화는 charset 뒤 최초 실행 script로 한 번만 넣고 생성기 전체 제품 HTML에 전파한다. 61을 hardcode하지 않고 생성된 HTML 전체를 재귀 검사한다. invalid/missing/storage-blocked는 light-coral, React 초기값은 이미 정해진 html 값에서 읽는다. html root나 앱에 theme key를 주어 파일·편집 상태를 remount하지 않는다. 단일 theme-color meta도 해당 theme 배경과 동기화한다. storage write 실패 시 현재 탭 테마는 유지한다. 초기 script·순환 로직의 허용값/기본값을 같은 명세로 검사한다. 복구 module 실패/느린 로딩/JS-off·격리/404에서도 사용자 안내가 유지되어야 한다.

## (d) 자체 primitive 7종·제거 비용 — [반박]

코드 증거: `rg -n '@base-ui/react' src`; `node_modules/@base-ui/react/dialog/root/useDialogRoot.js`의 scroll lock·topmost ESC, `dialog/popup/DialogPopup.js`의 FloatingFocusManager, switch/toggle/progress 및 composite 구현. `tests/unit/p1b-components.test.ts`는 **node_modules/@base-ui/react 파일을 직접 읽어 단언**한다. 의존성을 제거하면 이 테스트는 기능과 무관하게 ENOENT가 된다.

브라우저 재현: `node r1-baseline.mjs`, `node r1-lab-browser.mjs`.

- 현재 Sheet: role=dialog, aria-modal=true, 제목 ID 연결, open 중 body overflow=hidden, 닫기 autofocus, 닫기에서 Shift+Tab→마지막 링크→Tab→닫기, Escape 뒤 `mobile-navigation-trigger` focus 복귀를 확인했다. 최초 focus guard 즉시 샘플은 transient span이었으며 100ms settle 재측정으로 실제 순환을 확인했다.
- 현재 Switch: true → Space false → Enter true. track **43×25**, thumb **21×21**, 세로 중심 일치. 이 geometry는 상태 selector와 reset 경계를 보존해야 유지된다.
- 대안 실험의 native dialog는 modal background 접근은 막지만 마지막 Tab이 browser chrome 쪽으로 나갔다(`trapForward.inside=false`). **명시적 양방향 Tab wrap 추가 후 true**. `showModal()`만으로 기존 DOM focus-loop 계약을 완료했다고 할 수 없다.
- 자체 switch 버튼의 Space/Enter, ToggleGroup ArrowRight·Space·disabled 제외·단일 tab stop, progress 42/0/100 ARIA, combobox 포함 실험 페이지의 axe violations 0 확인. 이는 bounded prototype의 증거이며 7종 전체 구현 완료를 뜻하지 않는다.

| Primitive | 보존/대체 계약 |
|---|---|
| Button | 기본 type=button, native disabled·busy, ref, event 합성, render(Link/button)과 className 합성, consumer aria/data 속성, 링크/버튼 중첩 금지 |
| Card | `as={Link}`·section/article/ul polymorphism, ref/props 전달, heading 구조, 기본 padding·gap·overflow/geometry |
| Progress | value null은 indeterminate(aria-valuenow 없음), min/max·clamp·0/100·aria-label/labelledby, track/indicator/value/label, visual width와 ARIA 일치 |
| Sheet | controlled open/onOpenChange, trigger ID·title/description, portal/top layer, ESC 최상위만, 바깥 클릭과 내부 drag 구분, focus initial/loop/restore, inert background, nested modal/scroll-lock refcount·기존 style 복원, route·820px crossing·unmount cleanup, hidden/disabled tabbable 제외 |
| Switch | controlled/uncontrolled, role/screen reader 이름·설명, label click, Space/Enter, disabled, 체크 상태 attributes와 thumb geometry, 필요 시 native form name/value/reset |
| Toggle | aria-pressed, value·disabled·ref, Space/Enter·controlled state, 다중 사용 consumer 확인 |
| ToggleGroup | 현재 **value 배열** API·single/multiple, 빈 배열 거부하는 SegmentedControl adapter 의미 보존, arrow/home/end·orientation·loop·roving tabIndex·disabled skip, 새 선택과 포커스 이동의 구분 |

`shadcn`은 앱 JS에서 직접 import하지 않는 CLI지만 **`src/styles/tailwind.css`가 `shadcn/tailwind.css`를 실제 import**한다. CSS에는 data-open/closed/checked/unchecked/disabled/horizontal/vertical 등 Base UI/Radix 호환 custom variant가 있다. 설치 분류만 바꾸면 현행 빌드 입력으로 계속 필요하다. 제거 완료 시 이 import와 components.json·CLI 흔적·package/lock·생성 license 입력도 정리한다. `class-variance-authority`는 현재 button/toggle에서 쓰이므로 유지/자체 유틸 교체를 명시한다. lucide·Tailwind 자체를 제거하는 작업은 아니다. `clsx`, `tailwind-merge` 유지에 동의한다.

**제거 근사 번들:** QA theme 빌드와 동일한 소스에서 Base UI **6 import subpath를 measurement-only React DOM stub으로 alias**, shadcn CSS import만 제거하고 Vite 빌드했다. 패키지 설치/삭제는 없으며 타입 검증·행동 검증용 빌드가 아니다. 같은 구형 main 측정기로 계산한 gzip:

| 지표 | theme 포함 대조 | stub | delta B |
|---|---:|---:|---:|
| entry JS | 298,569 | 269,800 | **−28,769** |
| affected route JS 합 | 2,450,899 | 2,450,845 | −54 |
| shared JS | 2,716,519 | 2,716,484 | −35 |
| app JS | 5,465,987 | 5,437,129 | **−28,858** |
| CSS | 38,941 | 38,616 | −325 |

이는 새 구현의 focus/keyboard code가 추가되기 전 **절감 가능한 상한 근사**이며 배송 bundle 확정값이 아니다. main 측정기는 schema v1, S3 측정기는 개선된 v2이므로 서로의 baseline을 비교해서는 안 된다. 실제 구현 기준에서 같은 최종 측정기·QA/production 모드로 전후 값을 재생성한다.

**정본 반영 문안 (R5):**

> 공용 컴포넌트 public import 경로는 가능하면 그대로 유지하고 내부 구현을 자체 코드로 바꾼다. 소비 62파일의 기계적 path 변경은 필수 목표가 아니다. `data-slot`·`data-ui-component`·`data-testid`와 상태 ARIA를 유지하되 기존 라이브러리 소스/6색 구현을 직접 요구하는 테스트는 제품 행동 검증으로 교체한다. 7종별 props·상태·키보드·geometry 계약 표를 완료 기준으로 삼고, Sheet는 기존 native-dialog 실험에서 발견한 Tab wrap까지 포함한다. shadcn CSS 및 모든 @base-ui import의 repo-wide 0건을 코드·CSS·설정/lock 생성 경로에서 검증한다.

## (e) 전역 검색 — [보완]

기존 ToolsPage 단순 필터는 유지 가능한 패턴이다. `aria-live`가 현재 결과 목록 전체에 붙어 있어 입력할 때 전체 카드 내용을 알릴 수 있다. 결과 **개수만 별도 status**로 제공하는 쪽이 명확하다. 새 topbar는 어느 도구 화면에서도 페이지를 떠나지 않고 검색한 뒤 목적지로 이동하므로, **combobox + listbox navigation popup**을 제안한다. 기존 ToolsPage의 필터와 같은 matcher를 공유하되 active tool의 상태를 검색 도중 바꾸지 않는다.

실험: `/tmp/worklazy-ui-r1/lab`의 standalone HTML, `node r1-lab-browser.mjs`. 음성 결과 [lab-browser-negative.json](evidence/lab-browser-negative.json): 기존 색인만으로 ko/en “엑셀”=0, “ㅁㅅ”=0. 최종 보완 결과 [lab-browser.json](evidence/lab-browser.json): “엑셀” → Excel 3도구, “ㅁㅅ” → 문서 비교, 전각 `ＥＸＣＥＬ` 부분일치, PDF → PDF/QR, en HWP 검색은 한국어 전용 편집기 제외. Ctrl+K focus, ArrowDown→active descendant result-0, Enter→`/ko/tools/pdf-editor`, empty 0, Escape popup 닫힘·input focus/문자 유지, axe 0. 실험의 Enter는 URL 의도만 출력하므로 실제 route navigation 및 진행 작업 상태 보존 검증은 구현 게이트에 남는다.

**정본 반영 문안 (R6):**

> topbar는 labelled combobox(aria-expanded/controls/autocomplete=list/activedescendant) + 이름 있는 listbox를 쓴다. 포커스는 input에 유지하고 option에는 중첩 링크/버튼을 두지 않는다. ArrowDown/Up는 첫/마지막 진입 및 wrap, Enter는 활성 결과만 이동, Tab은 popup을 닫고 자연 이동, Escape는 popup만 닫고 query/focus 유지, 빈 결과는 count status로 알린다. IME 조합 중 Enter/화살표로 이동하지 않고 compositionend 뒤 갱신한다. blur·route·language 변경 시 invalid active ID를 비운다. 모바일 popup 최대 높이는 visual viewport/키보드를 고려하고 바깥으로 넘치지 않게 한다.
>
> matcher는 NFKC·소문자·앞뒤/연속 공백 정규화, 공백 구분 AND 부분일치. 현재·상대 언어의 이름/shortTitle/설명/highlight와 소수의 명시적 검색 별칭(Excel↔엑셀 등)을 포함한다. 초성-only query는 ko 이름·shortTitle·별칭의 초성을 대상으로 부분일치하며 자동완성 오타 보정/fuzzy ranking은 제외한다. registry 순서 유지, ko 20/en 19 availability는 보존한다.
>
> Ctrl/⌘+K는 본문에 도달한 이벤트에서만 preventDefault하고, defaultPrevented·IME·Alt/Shift·다른 editor/input/contenteditable·열린 modal에서는 가로채지 않는다. browser chrome/OS/iframe의 단축키 전달은 보장하지 않으며 눈에 보이는 검색 input을 항상 제공한다. 본 실험의 Playwright 키 입력은 브라우저 주소창 단축키 선점을 증명하지 않는다. 기존 audio undo/redo·image shortcuts와 충돌하지 않는지 별도 단언한다.

캡처: [검색 모바일](captures/search-lab-mobile.png). 현재 언어 선택기는 dropdown이 아니라 ToggleGroup이다. 그대로 재사용하면서 dropdown이라고 기술할 수 없다. `<select>` 대체 시 ko/en 이름·값·HWP redirect·query 유지 정책과 기존 smoke selector 변경을 함께 명시한다.

## (f) 히어로 AVIF/WebP·LCP/CLS·예산 — [반박 / 변환 가능 동의]

`sharp`는 설치되지 않았고 ImageMagick `convert`는 AVIF/libheif·WebP를 지원했다. 기존 도구만 사용했다. 재현: `python3 /tmp/worklazy-ui-r1/assets.py`. 내부 명령은 `MAGICK_THREAD_LIMIT=1 convert INPUT -resize WIDTHx -strip -quality Q OUTPUT`, WebP Q82 / AVIF Q50. 두 원본 PNG는 읽기만 했고 모든 산출물은 tmp에 있다. 원본·decoded alpha 확인에서 12종 모두 범위 0~255.

| 계열 | 폭 | WebP B | AVIF B |
|---|---:|---:|---:|
| coral | 480 | 27,602 | 13,150 |
| coral | 960 | 71,546 | 21,944 |
| coral | 1440 | 131,898 | 32,916 |
| mint | 480 | 30,572 | 13,493 |
| mint | 960 | 79,102 | 27,319 |
| mint | 1440 | 147,218 | 35,641 |

[assets.json](evidence/assets.json)에 원본 byte·command·시간·alpha·흰색/어두운색 합성 PSNR을 저장했다. 리사이즈 reference 대비 PSNR은 약 **33.2~38.9dB**, codec 손실과 리사이즈 필터 차이를 함께 포함한다. 숫자만으로 육안 적합성을 판정하지 않았다. [원본 리사이즈/WebP/AVIF 대조](captures/asset-comparison.png)를 직접 확인한 결과 960→480 표시에서 아이콘/로고의 명백한 파손은 없고 AVIF에 부드러워진 세부가 있다. 민트의 우측 한글 장식·회색 halo는 원본에도 존재한다. 소형 화면에서 읽을 기능 설명으로 사용해서는 안 된다. 두 asset의 바깥 장식·문구는 서로 동일하지 않으므로 “동일 에셋의 색만 변환”으로 기술하지 않는다.

실제 `<picture>` 순서는 AVIF source → WebP source → WebP img fallback. 세 srcset 폭, eager/high fetch priority, width/height=1672/941, aspect ratio를 명시했다. sizes=`(max-width:820px) calc(100vw - 72px), (max-width:1440px) 420px, 620px`를 사용했다. 390에서 실제 slot은 **320px**, sizes 선언은 **318px**로 2px 어긋났다. 둘 다 480 asset을 선택했으므로 이번 전송량 결과에는 영향이 없었지만 정본은 최종 padding에 맞춘 **동일 공식**을 써야 한다.

재현: `NODE_OPTIONS=--max-old-space-size=4096 node r1-theme-browser.mjs`. Chrome 152.0.7977.64 / Linux, DPR1, 로컬 무스로틀, QA build, SW block, 매 표본 새 context·CDP cache disabled, image decode + 1초 settle, theme×폭×3회. **36/36 CLS 0, horizontal overflow 0**. first-pass 실패는 도구 화면 ready selector를 `.page`로 가정한 하네스 timeout이며 `data-ui-component=page-header`로 교정 후 전체 재실행했다.

| 테마 | 폭 | LCP 중앙값 / 최대 ms | 선택 이미지 |
|---|---:|---:|---|
| light-coral | 1920 | 356.71 / 379.38 | coral-960.avif |
| light-coral | 1440 | 95.11 / 120.94 | coral-480.avif |
| light-coral | 390 | 100.16 / 121.34 | coral-480.avif |
| dark-coral | 1920 | 335.74 / 336.69 | coral-960.avif |
| dark-coral | 1440 | 100.10 / 471.48 | coral-480.avif |
| dark-coral | 390 | 69.54 / 268.94 | coral-480.avif |
| light-mint | 1920 | 95.58 / 97.47 | mint-960.avif |
| light-mint | 1440 | 87.22 / 476.52 | mint-480.avif |
| light-mint | 390 | 96.64 / 100.03 | mint-480.avif |
| dark-mint | 1920 | 317.65 / 321.26 | mint-960.avif |
| dark-mint | 1440 | 109.76 / 486.54 | mint-480.avif |
| dark-mint | 390 | 92.80 / 289.55 | mint-480.avif |

캡처 이름: `captures/hero-{theme}-{1920|1440|390}.png`. 여기서 측정한 것은 **기존 홈+picture+token prototype의 page LCP**이며 완성된 시안 전체 또는 실제 이용자의 네트워크 LCP가 아니다. 모바일에서는 이미지가 fold 아래로 내려갈 수 있다. 최종 검증에서 LCP element·CPU/network throttle·DPR2까지 분리해 보고해야 한다. `width/height`는 이미지 기인 shift를 줄이지, 폰트/초기 fallback/셸/동의창까지 포함한 총 CLS=0을 보증하지 않는다.

**예산 정정:** `measure-bundle-budget.mjs`의 includeRules는 JS/CSS이며 image는 포함하지 않는다. 이미지 바이트가 entry JS 예산에 직접 더해진다는 §2-7은 틀리다. URL 참조 JS와 추가 CSS만 영향이 있다. baseline→token/picture QA prototype: entry **+277B**, CSS **+1,254B**, app JS **+342B**. 이미지 payload는 별도: 이 DPR1 실험에서 13,150~27,319B/진입이다. 전체 variant 파일 합계와 실제 한 번의 전송량도 구분한다.

**정본 반영 문안 (R7):**

> 원본 2 PNG를 scripts/assets 아래 고정 입력으로 관리하고 SHA·폭·codec·quality·encoder 버전을 기록한다. 이번 가용 도구는 ImageMagick이며 CI의 encoder 설치/버전 검증 또는 이미 생성한 산출물의 검증·재생성 위치를 정본에서 고정한다. 환경에 없는 sharp를 암묵적으로 가정하지 않는다. 입력→생성 script→public 파생 asset으로만 갱신한다. `<picture>`는 실제 slot과 동일한 sizes·고정 비율·적절한 eager/high 우선순위를 사용한다. light↔dark는 동일 family asset, family 전환은 React state와 picture source를 함께 갱신하되 파일/도구 상태를 재마운트하지 않는다. 장식 img는 alt=""; 기능 설명은 ko/en HTML로 제공한다. 민트의 한글 장식은 번역할 기능 안내로 취급하지 않는다는 정책을 명시한다.
>
> JS/CSS 5종 예산 외에 실제 선택 이미지 bytes·다운로드 중복·LCP/CLS를 별도 기록한다. 권장 초기 경계는 AVIF 각 파일 50KiB 이하, WebP 각 파일 160KiB 이하(이번 12종 통과)이며, 최종 이미지 slot/DPR2와 throttle 표본을 측정한 뒤 확정한다. 총 CLS는 max≤0.1 기준으로 검증하고 단순 width/height 선언만으로 CLS 0을 주장하지 않는다.

## (g) 기준선 갱신·4테마 축·S3 충돌 — [반박]

재현: `node r1-matrix.mjs`, `bash /tmp/worklazy-ui-r1/run-visual.sh`. 원본 생성기·시나리오를 그대로 사용한 main 사본의 `LANG=ko VISUAL_CONCURRENCY=1 TEST_BASE_URL=http://127.0.0.1:4191 UPDATE_VISUAL_BASELINES=1 VISUAL_ONLY=home-default npm run test:visual`은 **ko/en 8장**, **22.48초**였다. LANG은 suite 선택 인자가 아니다. 실제 교체로 hash가 바뀐 것은 mobile 4장; 나머지 167개의 기대 baseline hash는 그대로였다. 실험용 `r1-unexpected.png`는 **선택 범위 밖임에도 삭제**되었다. `removeUnexpectedBaselines(baselineNames)`가 선택 전의 전체 manifest를 기준으로 실행되기 때문이다.

따라서 `VISUAL_ONLY`는 scenarioId/routeId/toolId 필터이지 locale/theme/file 필터가 아니다. `UPDATE_VISUAL_BASELINES`도 특정 파일명의 허용목록이 아니다. QA capture directory는 `tests/visual-artifacts` 자식으로 제한되고 `VISUAL_ARTIFACT_DIR`과 다르므로 tmp archive 내부 경로를 써야 한다. QA capture-only는 initial/bottom/interaction 모두 필요하여 home-only로 호출하면 실패한다.

| 확장 정의 | main | 현재 S3 |
|---|---:|---:|
| 현재 scenario / baseline | 80 / 175 | 85 / 203 |
| 현행 각 profile에 coral/mint만 2배(기존 locale/brightness sampling 유지) | **350** | **406** |
| 현행 각 scenario의 locale/viewport pair마다 4테마 전부 | **668** | **748** |
| 모든 scenario의 가용 locale×desktop/mobile×4 + 기존 추가 320px pair 보존 | **968** | **1,072** |

“4테마”를 추가하면서 종전 dark/light 두 축을 또 곱하지 않는다. 홈 full matrix는 8→**16장**이다. 406안은 전체 상태마다 4테마를 모두 검사한다는 뜻이 아니라 종전 sparse brightness coverage에 family를 늘린 것이다. 전체 4테마 요구를 어디에 적용할지 이 표의 **정확한 profile set**으로 고정해야 한다.

기존 하네스는 `prefers-color-scheme`만 설정한다. 테마 스크립트가 기본 light-coral을 선택하면 이름이 dark인 baseline도 실제로 light-coral을 캡처할 수 있다. **localStorage/data-theme 사전 주입 + 캡처 전 실제 DOM값 단언**, 이름의 theme 필드 확장이 필수다. a11y/rendering도 같은 theme fixture를 공유해야 한다.

전체 main 175장 단일 browser 동시성 실행 결과와 시간은 마지막 검증표에 기록한다. 이 실측으로 350/406 확대의 대략 비용을 계산하되 특정 도구·worker wait 비용이 같다고 보장하지 않는다. 20분 상한은 timeout으로 실제 강제하고, 축약 시 사유/누락 profile 목록을 남긴다. 이 실험은 자원 지시대로 build와 browser를 직렬화했고 VISUAL_CONCURRENCY=1을 사용했다.

S3는 진행 중이어서 비교 시점도 고정했다. 시작 main→S3 직접 파일 diff 252개 중 예상 UI 공통 표면 **28개**, baseline **35개**가 겹친다(28 신규+7 기존 변경). 전체 목록은 [s3-conflicts.json](evidence/s3-conflicts.json). 주요 충돌:

- package.json, CHANGELOG.md, docs/review-notes.md.
- generate-static-pages / validate-static-output / measure-bundle-budget / bundle-module-attribution.
- App.tsx, seo.ts, PdfEditorPage/PdfFinishPanel/PdfThumbnail, ko/en features.json.
- visual config/scenarios, accessibility/rendering/browser harness, 대응 unit(visual-clock/config·a11y·rendering·bundle·seo·p1b·legacy), vite.config.ts.

**정본 반영 문안 (R8/R9):**

> S3가 main에 통합된 뒤 UI 구현 브랜치를 분기하고 기준 해시·scenario manifest·bundle baseline을 다시 고정한다. 준비 조사/asset 실험은 tmp에서 계속 가능하지만 공통 파일 구현을 병행하지 않는다. 기존 감소 profile을 유지하며 family만 늘리는 기본안은 406장(현시점 S3 기준), 홈/검색/셸·주요 컨트롤은 4테마×ko/en×desktop/mobile full coverage로 별도 보강한다. 전체 모든 상태 4테마 coverage가 필요하면 748/1,072 중 정확한 범위를 별도 채택하며 “406=모든 상태 4테마”라고 쓰지 않는다.
>
> 기준선 갱신 전 예상 생성·교체·삭제 파일 목록을 저장한다. 갱신 후 동일 commit/build/browser로 UPDATE 없이 전수 재실행한다. baseline 갱신은 이번 UI 변경을 위해 필요한 검증 작업이며 임의 일괄 승인을 새로 요청하는 절차로 취급하지 않는다. pixel regression은 새 의도된 모습 대비의 oracle이 되며, 기존과의 diff도 육안 검토 자료로 보존한다. “회귀 탐지력 0”이라는 표현을 “갱신된 픽셀 영역에서 종전 UI와의 자동 동등성 검증이 불가능”으로 정정한다. DOM·기능 단언과 갱신 후 재실행의 회귀 탐지력은 남아 있다.

## (h) 대비비 실측 — [보완]

재현: `python3 /tmp/worklazy-ui-r1/colors.py`, `python3 /tmp/worklazy-ui-r1/contrast-final.py`. 원본 4시안의 텍스트/버튼/태그/틴트 ROI 좌표와 RGB, WCAG 상대휘도 계산(감마 선형화 뒤 `(Lmax+.05)/(Lmin+.05)`)을 JSON으로 남겼다. 텍스트 anti-alias 가장자리로 허위 실패를 만들지 않도록 배경과 대비 1.5 이상인 픽셀 중 **대비 높은 상위 10%의 중앙 샘플**을 사용했다.

PNG는 raster 생성 시안이므로 단일 CSS foreground를 복원할 수 없다. 아래는 **지정 픽셀 샘플의 4.5:1 기준 판정**, 페이지 전체 WCAG 적합성 인증이 아니다. 버튼 배경도 gradient 위치에 따라 달라지므로 최종 CSS에서 가장 불리한 위치를 다시 확인한다.

| 시안 | 본문/제목 | 보조 글자 | CTA 글자 | 태그 | 틴트 글자 |
|---|---:|---:|---:|---:|---:|
| light-coral | 20.69 통과 | **4.36 미달** | **3.30 미달** | **3.08 미달** | **3.82 미달** |
| dark-coral | 16.63 통과 | 9.61 통과 | **3.04 미달** | 6.22 통과 | 5.61 통과 |
| light-mint | 20.48 통과 | **4.11 미달** | 4.89 통과 | **3.12 미달** | 6.43 통과 |
| dark-mint | 16.72 통과 | 10.14 통과 | 15.61 통과 | 7.45 통과 | 10.43 통과 |

일반 CTA/태그는 large text가 아니므로 3:1로 완화하지 않는다. large text는 실제 CSS 크기·굵기가 기준을 만족하는 경우에만 3:1, interactive boundary/focus는 비텍스트 3:1도 별도 확인한다.

보정 토큰 제안(화면 원색을 완전히 재현하는 최종 디자인 승인이 아니라 접근성 하한을 지키는 출발값):

| theme | bg / surface | text / secondary | primary / on-primary | on-soft / soft |
|---|---|---|---|---|
| light-coral | #f2f6fa / #fff | #101827 / #56657c | #d53228 / #fff | **#b9251e / #ffedea** |
| dark-coral | #10171e / #1a232c | #f5f7fa / #b8c7db | #ff8278 / **#201619** | #ff8278 / #382323 |
| light-mint | #f2f6fa / #fff | #101827 / #56657c | #007d65 / #fff | **#006451 / #e2f5ef** |
| dark-mint | #0d181e / #18242c | #f5f7fa / #b8cdd9 | #59efce / #06241e | #59efce / #153a34 |

첫 보정안도 on-soft를 primary와 같게 쓰면 light-coral **4.299**, light-mint **4.499**로 실패했다. 소수점 반올림해서 4.5 통과로 처리하지 않았다. light의 on-soft는 strong 값으로 분리해 최종 계산표에서 통과시켰다. 기존 `hover:bg-primary/80`는 이 보정 primary라도 light-coral **3.687**, light-mint **3.559**로 실패한다. hover는 opacity 감소가 아니라 별도 strong 배경을 써야 한다. 처음 실패값도 [contrast-first-pass.json](evidence/contrast-first-pass.json)에 보존했다.

또 다른 중요 부정 대조: unreadable dark-coral 화면의 axe `violations=[]`이었으나 **color-contrast incomplete 195노드**였다. gradient/복잡한 배경을 판정하지 못한 상태를 총 위반 0으로 통과시키면 이번 사고를 잡지 못한다. [dark-probes.json](evidence/dark-probes.json)의 incomplete target 목록과 육안 캡처가 증거다.

**정본 반영 문안 (R3/R12):**

> 4테마 각각 본문·보조·button normal/hover/active/disabled·on-soft·placeholder·선택/포커스·toast/error/success·diff/preview를 계산한다. 색 선언값뿐 아니라 합성 배경/opacity/gradient의 최저 대비를 확인한다. 본문 4.5, 해당 large text 3, 상태를 식별하는 control/focus 경계 3 기준을 반올림 전에 적용한다. axe total=0 외에 color-contrast incomplete를 명시적으로 수동 검토하여 판정표에 근거를 붙인다. 예외는 vendor iframe 같은 정확한 경로/노드·소유자로 한정하고 기존 HWP 예외를 확대하지 않는다.

## (i) 단계 순서 — [보완]

W1을 W2보다 앞에 두어 공용 행동을 고정하는 방향은 타당하다. 문제는 W1 안에서 7종·전체 import·스타일/의존성을 한 번에 바꾸고 뒤에 셸을 다시 설계한다는 점이다. `AppShell`은 Sheet와 언어 ToggleGroup을 동시에 소비하고, ToolCard/Card는 홈·도구 목록 모두에 영향이 있다. 현재 unit은 Base UI 소스·six accent mapping을 oracle로 갖는다. 최종 토큰/언어 dropdown 설계를 정하지 않은 채 전체 source contract를 먼저 바꾸면 같은 소비 표면을 두 번 수정하게 된다.

재현 증거: (d)의 focus negative/positive와 bundle stub, `tests/unit/p1b-components.test.ts`의 node_modules 직접 read, (g)의 S3 28 공통 파일. 공용 코드 변경을 “나중 W5에서 도구 검증”으로 미루는 것은 2026-09-04 라이브 정렬 사고 이력과도 맞지 않는다. 기존 P2의 preflight scope/토큰 톤다운/선택 배경 판정은 `evidence/prior-decisions.txt`에 따로 보존했다.

**정본 반영 문안 (R10), 권장 실행 순서:**

1. **W0 기반**: S3 통합 해시 고정, 현재 smoke/bundle/visual 목록 저장 → semantic 토큰·상태색·FOUC·manual theme fixture·4테마 순환. legacy 직접 배경은 이 단계에서 최소 일관성까지 교정한다. broken dark 상태를 중간 완료라고 하지 않는다.
2. **W1a 일반 primitive**: Button/Card/Progress/Switch/Toggle/ToggleGroup을 공용 public path에서 교체하고 각 컴포넌트의 실제 keyboard/ARIA/geometry를 기존 셸·대표 도구에서 검증한다. test가 특정 library 소스를 읽는 계약을 제품 행위로 바꾼다. 이때 Base UI 패키지 전체 제거를 강제하지 않는다.
3. **W1b Drawer 행동**: 자체 drawer를 기존 셸에 넣어 controlled state/포커스/ESC/scroll lock/nested modal/route/resize를 독립 검증한다. 기존 public Sheet adapter를 유지해 셸 레이아웃 변경과 장애 원인을 분리한다.
4. **W2 셸**: 검증된 Drawer로 sidebar/topbar/search/언어 select/모바일 배치·PWA 위치·하단 탭을 재구성한다. 카드에는 단일 category mapping을 적용한다. 공통 셸이 적용되는 격리 문서와 PDF finish도 시각/광고 회귀 대상으로 포함한다.
5. **W3 홈+asset**: 최종 hero slot·heading markup·카피·CTA·privacy card·20/19 카드·how-to를 **한 묶음**으로 연결한다. asset 변환 script 준비는 W0 이전 tmp 실험으로 가능하지만 화면 히어로를 W3/W4에 중복 구현하지 않는다.
6. **W4 도구·패키지 종료**: 도구의 의미 색/단일 primary 정합을 완료하고 사용 없는 Base UI/shadcn/CSS/설정 의존성을 제거한다. repo-wide import scan·license 재생성·최종 budget을 통과시킨다. orphan/owner manifest 정리는 여기서 소유자별로 한다.
7. **W5 최종 게이트**: reviewed baseline 목록 갱신 → UPDATE 없는 전수 → QA 실화면/geometry·대비비·성능·격리 → astra 검수/Claude 판정/Gemini 육안 검수 → 마지막 production 복원·static → 배포 1회. 이 반박 작업에는 커밋/배포가 없다.

각 구현 묶음은 sol, 사후 검수는 astra라는 프로젝트 역할을 유지한다. 이 순서는 새 라이브러리 도입이나 사용자 제거 결정을 되돌리는 제안이 아니다.

## (j) sol이 재해석할 지점·제품 규칙 — [보완]

다음 제안을 정본에서 명시적으로 수용/변경해야 한다. 대화 중 결정이 있다고 가정하고 sol이 알아서 고르게 해서는 안 된다.

**R11 — 레이아웃·콘텐츠 계약 제안**

- sidebar는 **표시 그룹** 3개(문서=documents / 미디어=media / 기타=text-data+work+security-share), registry의 5개 ID와 현재 `?category=`는 유지한다. 3그룹 안에 실제 도구 링크를 나열한다. “기타”는 기존 `category=other`가 아니므로 없는 query로 연결하지 않는다. active tool link/aria-current와 그룹 표시 상태를 구분한다. 시안의 Excel/PDF/온라인 유틸처럼 여러 실제 도구를 가리킬 수 있는 가짜 통합 도구를 새로 만들지 않는다.
- 알림종 제외를 유지한다. sidebar 폭 **248px**, expanded desktop/모바일 경계 **820px**, desktop 접힘은 아이콘 rail 또는 완전 숨김 중 **완전 숨김**을 제안한다. 접힘 상태는 세션 메모리에만 저장하고 theme storage와 혼합하지 않는다. main은 min-width:0, header/hero도 수축 가능해야 한다. grid는 viewport 기준 1440 이상 4열, 1100~1439 3열, 621~1099 2열, 620 이하 1열을 출발 계약으로 제안하되 expanded sidebar에서 긴 en 제목이 넘치지 않음을 1100/1440 경계 양쪽·320/390px에서 실제 확인한다.
- 홈 카드는 **ko 20/en 19 전부**, 기존 registry 순서. 기능이 20개인데 시안 12개라는 이유로 임의 8개를 숨기지 않는다. 전체 보기 CTA는 `/tools`로 유지한다. 만일 12개를 제품 결정으로 채택하려면 locale별 ID whitelist·순서·나머지 도구 도달 경로를 정본에 써야 하며 클릭/검색/SEO 효과를 실측 없이 유리/불리한 순위 변화로 단정하지 않는다.
- 카드의 current highlights는 대부분 **4개, video 5개**다. “1~3개 태그”는 `slice(0,3)`처럼 결정적인 선택 규칙을 정한다. 전체 highlights는 registry/SEO 상세/도구 guide에 보존한다. 제목과 본문은 DOM에 전체 문자열을 유지하고 시각 줄 제한만 적용한다. 카드 heading은 섹션 h2 아래 h3, 단일 링크 root, decorative arrow/icon은 hidden, 내부 버튼/링크 없음. privacy card는 도구 수에 넣지 않고 noninteractive article로 렌더한다.
- `PrivacyBanner`는 그리드 마지막의 **안전한 로컬 처리** 카드로 편입한다. 기존 `PrivacyConsentBanner`는 방문 분석·광고 설정을 위한 다른 기능이므로 삭제/동일시하지 않는다. 거부·동의·푸터의 설정 재열기와 광고 격리를 그대로 검증한다. screenshot prototype에 나타난 동의창은 잘못된 테스트 storage key(`worklazy-privacy-consent`) 주입 때문에 unset인 상태였다. 실제 key는 **worklazy_privacy_consent**이며 후속 대조에서 이를 교정했다. QA build 자체는 추적 비활성이라 외부 전송이 발생하는 조건은 아니었다.
- `HOW IT WORKS`는 **하단에 간결한 3단계로 유지**하는 안을 제안한다. 현재 작업 방식 설명이라는 실제 효용을 근거로 하며 검색 순위 보장을 근거로 하지 않는다. 삭제를 선택하더라도 정적 SEO/FAQ가 자동으로 함께 사라지는 것은 아니다. `staticBody(page)`는 seo.ts의 heading/description/highlights/FAQ로 생성하며 React 홈 DOM을 복사하지 않는다. 실제 DOM과 fallback의 제품 설명은 함께 검토한다.
- ko hero의 두 문장은 유지하되 **“도구에게”만 accent span**으로 분리한다. en은 별도 문장 순서에 맞춘 키/Trans markup을 사용한다. 시안 4장 자체의 kicker/서브카피/상태 문구가 서로 다르고 원본에는 오타성 “작업 업로드 없음”도 있다. 테마가 문구를 바꾸지 않게 ko/en 카피를 각 1세트로 고정한다. 제안 ko: kicker “작지만 유용한 업무 도구”, subtitle “문서와 데이터부터 이미지·영상까지, 설치도 로그인도 필요 없습니다. 필요한 도구를 고르면 복잡한 작업이 간단해집니다.”, 신뢰 안내 “파일 업로드 없음 / 모든 작업은 내 브라우저에서 처리됩니다.” en 번역도 같은 의미로 제공한다. 상태 카드는 두 번째 실행 CTA가 아니므로 button/링크 role을 주지 않는다.
- 기존 모바일 `AppInstallControl`과 bottom-tabs, 푸터 법적 링크·동의 설정·contact 경로를 보존할 배치를 정한다. 제안: 설치 컨트롤은 drawer 하단으로 이동, bottom-tabs는 유지하고 main 하단 safe area 예약도 유지. 접는 sidebar/header 높이 때문에 image editor sticky top 72px·모바일 bottom 78/80px 같은 상수를 검토한다. 단순히 PWA 재설계 제외라고 쓰고 설치 진입점을 잃으면 안 된다.
- 언어 선택기는 현행 ToggleGroup 재사용과 시안 dropdown이 양립하지 않는다. **native select**로 바꾸되 기존 언어 routing을 재사용한다. 경로/검색어/category query 보존과 HWP en 대체 목적지를 명시한다. theme 버튼은 현재/다음 테마를 포함한 ko/en 이름을 갱신하고 focus 유지, 반복 클릭은 지정 순서대로 동작한다. 저장 실패와 재로드 복구를 테스트한다.

**R9 — 범위 모순 정리 제안**

> “격리 문서는 셸 미적용”, “U4 화면은 완전히 영향 없음”을 삭제한다. 실제 AppShell과 전역 CSS를 공유하는 video/office/XLS/PDF finish에는 새 공통 셸·테마가 적용되며 그 영향은 테스트한다. 이 UI 작업에서 제외하는 것은 도구 기능/경로/엔진 수정과 외부 vendor iframe 자체이다. 기존 광고/분석 로더의 경로·document marker 조건은 유지한다. 특히 video isolation에서 analytics를 허용하고 office/XLS에서 제외하는 현재 차이를 ‘격리=전부 로더 제거’로 단순화하지 않는다. S3 완료 후 통합 상태에서 검증한다.

규칙 4(ko/en·SEO·AdSense): 새 search/테마/언어/header·sidebar·hero/card/privacy 카피의 양 언어를 함께 반영한다. route registry 20·en HWP 제외·canonical/hreflang/sitemap/FAQ·JSON-LD는 데이터 정합을 검증한다. 홈 전수 카드가 static fallback에도 20링크를 보장하는 것은 아니므로 크롤링 링크 정책은 generator 관점에서 따로 확인한다. 기존 AdSense loader/document boundary와 동의 관리 경로를 그대로 검사하고 광고 slot이 새 search/CTA를 겹치지 않게 한다. 이번 정적 실험은 외부 검색 랭킹/AdSense 정책 변경을 조사하거나 배포하지 않았다.

규칙 5(내부 구현 비노출): theme/storage 오류·검색 오류에서 예외 문자열을 사용자에게 보여주지 않는다. 사용자 안내는 행동·결과로 쓴다. 시안의 CLIENT SIDE는 브랜드 보조문구로 유지하되 새 사용자 설명에 Worker·runtime·chunk·광고 제외 내부 상태를 넣지 않는다. 테마별로 광고 상태 badge를 만들지 않는다.

규칙 19(배포 전 시각 검수): 이 보고서의 Codx 표본 캡처는 **Gemini 최종 육안 검수를 대체하지 않는다**. 최종 QA build에서 전체 변경 페이지/주요 상태를 Gemini가 직접 확인하고, 글자 세로 낙하·폭 overflow·switch track/thumb·선택 indicator geometry를 Codex 수치로 교차한다. 최종 production build와 같은 소스임을 SHA로 확인하고 마지막에만 push한다.

**R12 — 완료 명령을 실행 가능한 형태로 정정**

> `LANG=ko/en`은 locale 반복 문법이 아니며 이 visual runner에는 locale 필터도 없다. 정확한 profiles로 구성한 suite를 **한 번** 실행한다. `test:excel-*` wildcard 대신 `test:excel-compare`, `test:excel-cleaner`, `test:xls-preserve`, `test:xls-first-load`를 각각 나열한다. `TEST_SCOPE=pdf`는 단독 명령이 아니므로 `TEST_SCOPE=pdf npm run test:browser`로 쓴다. registry는 `node tests/tool-registry-routes.mjs`, CSS/manifest는 `npm run css:orphans`, `npm run legacy:manifest`다.
>
> production build/static·tsc·unit·전 스코프 실제 smoke·4테마 fixture가 연결된 visual/a11y/rendering·동일 schema bundle baseline 비교·CSS owner/orphan·registry·diff check를 각각 기록한다. `A11Y_MAX_TOTAL=0`에 더해 incomplete 대비 검토 결과를 기록한다. 20분 visual 상한과 NODE_OPTIONS=4096·빌드/브라우저 직렬을 준수한다. baseline update는 실제 출력과 SHA manifest를 남기고, QA build와 production static 검사를 혼동하지 않는다. 모든 script의 artifact/fixture/report/cache 경로는 작업 전용 디렉터리로 명시한다.

## 잔여 이견 관리표

항목을 중복 합산하지 않았다. 각 행은 연결된 세부 조건들을 정본에서 하나의 계약으로 확정해야 하는 단위다. 제안 수용 후 재현/정본 대조로 닫으며, 이 반박 보고서 작성만으로 0이 되지 않는다.

| ID | 미확정 계약 | 관련 절 |
|---|---|---|
| R1 | main/S3 기준 분리·정본 해시·실측 분모 | a |
| R2 | OS media 제거·manual selector·native scheme·print/forced/nested 범위 | b |
| R3 | 단일 primary·상태색·on-soft/hover/focus 대비 | b,h |
| R4 | 전체 HTML 초기화·104문서·meta·storage/복구·초기값 일치 | c |
| R5 | 7종 public API/행위/상태 CSS·dependency/test 제거 범위 | d |
| R6 | 전역 검색·matcher/별칭/초성·keyboard/IME/mobile·route | e |
| R7 | 변환 도구/CI·source/size/priority·이미지 별도 budget·문구 | f |
| R8 | 정확한 visual profile·theme 주입·update/delete 목록 | g |
| R9 | S3 통합 순서·실제 공유 셸/격리/U4 적용 범위 | g,i,j |
| R10 | 검증 가능한 단계 분해·dependency 종료 시점 | i |
| R11 | 화면 breakpoint·카테고리·20/19 카드·태그·how/privacy·모바일/PWA·언어/문구 | j |
| R12 | 실제 완료 명령·incomplete 판정·성능 측정·QA/production·artifact 경로 | h,j |

**잔여 12건.** 초안 §6의 다섯 ★항목에는 각각 구체적인 기본 제안을 제시했다(3그룹 매핑, 20/19개, how-to 유지+privacy 카드 편입, 검토된 baseline 갱신, S3 병합 후 구현). 새로운 필수 사용자 승인 흐름을 만들지 않았다. Claude가 기존 사용자 의도와 다르다고 판정한 제품 선택만 좁혀 올리면 된다. 이번 세 사용자 결정 자체를 되돌리는 “★사용자 확인” 항목은 없다.

## 실제 검증 결과·부정 대조·실험 한계

모든 build/browser는 **직렬**, Node 호출은 `NODE_OPTIONS=--max-old-space-size=4096`. 설치된 node_modules는 패키지별 읽기 링크로 공유하고 `.tmp/.vite/.vite-temp/.cache`는 원본 링크에서 제외해 tmp 사본이 직접 소유한다. vendor/cache는 기존 파일을 tmp로 복사했으며 vendor 생성 스크립트의 입력으로 사용했다. 의존성 설치는 없다.

| 실행 | 실제 결과 | 원문 |
|---|---|---|
| baseline QA `npm run build` | exit 0, Vite 1m12s, 61 localized pages | [build-baseline.log](evidence/build-baseline.log) |
| token/picture QA `npm run build` | exit 0, Vite 1m12s, 61 pages | [build-theme.log](evidence/build-theme.log) |
| import stub Vite build | exit 0, Vite 1m11s, 근사 측정용·행동/타입 통과 의미 아님 | [build-stub.log](evidence/build-stub.log) |
| corrected prototype production `npm run build` | exit 0, Vite 1m14s, tsc 포함, 61 pages | [build-production.log](evidence/build-production.log) |
| QA `npm run test:static` | exit 1, 기존 Google/Naver config 부재 검사 | [static-theme.log](evidence/static-theme.log) |
| production `npm run test:static` | **exit 0, Startup recovery 104 documents** | [static-production.log](evidence/static-production.log) |
| prototype 전체 unit, `node --test --test-concurrency=1 --experimental-strip-types tests/unit/*.test.ts` | **245/247, exit 1**, 20.97초 | [unit-prototype.log](evidence/unit-prototype.log) |
| registry | **20, 누락/예상 밖/중복 0**, exit 0 | [registry.log](evidence/registry.log) |
| baseline 기존 셸/스위치/격리 DOM | exit 0, 6화면, Base UI focus guard 후속 재측정 포함 | [baseline-browser.json](evidence/baseline-browser.json), [lab-browser.json](evidence/lab-browser.json) |
| theme/picture browser | 첫 ready-selector 하네스 실패 후 재실행 exit 0, 36 perf + 24 page/OS 조합 + 4 bootstrap + 2 media | [theme-browser.json](evidence/theme-browser.json) |
| 유효한 dark candidate probe | **89/89 컴파일, 누락 0**, plain/hover/aria-invalid 및 nested 대조 | [dark-probes.json](evidence/dark-probes.json), [remedy-browser.json](evidence/remedy-browser.json) |
| 보완 surface CSS prototype 캡처 | 4테마×본문/보조/CTA/kicker/card-title 20쌍 **최저 4.865 이상**, overflow 0 | [remedy-browser.json](evidence/remedy-browser.json), `captures/remedy-*.png` |
| 검색/native dialog 부정→보완 대조 | 별칭·초성 매칭, Tab wrap 교정 후 동작, axe 0 | [lab-browser-negative.json](evidence/lab-browser-negative.json), [lab-browser.json](evidence/lab-browser.json) |
| home 부분 baseline update | 8/8, 22.48초, 기대 baseline 175 유지, mobile 4 hash 변경·unexpected sentinel 삭제 | [visual-update-home.log](evidence/visual-update-home.log), [baseline-update.json](evidence/baseline-update.json) |
| 기존 main 전체 visual | **171/175 통과**, 8m16.20s, 두 목록 mobile pixel diff와 두 영어 HWP 서버 fallback 실패 | [visual-baseline-full.log](evidence/visual-baseline-full.log) |
| 실패 관련 Vite preview 재실행 | **10/10 matched**, 27.86초, baseline 추가 갱신 없음 | [visual-retry.log](evidence/visual-retry.log) |

unit 2실패의 원인을 숨기지 않는다.

1. `app-shell.test.ts`의 repo-wide allowlist 테스트가 `git ls-files`를 호출한다. 요구된 **git archive 사본에는 .git이 없어** `fatal: not a git repository`로 실패했다. 실제 product 검사 통과를 주장하지 않았고 원본 저장소에서 이 unit을 돌려 fixture/부작용을 일으키지 않았다.
2. `ui-legacy-isolation.test.ts`는 global.css의 rules≥541을 요구한다. OS dark 블록을 의미 CSS로 옮긴 prototype은 **516 rules**로 source-count assertion 실패. 구조를 옮기는 이번 작업은 이 수치를 무조건 낮춰 통과시킬 것이 아니라 global+theme CSS 전체의 소유/legacy 충돌 검증으로 계약을 바꿔야 한다. 이는 R5/R12에 추가하는 실행 증거다.

전체 visual 실패 중 목록 모바일 diff는 ko 399px/0.1212%, en 456px/0.1385%였고 이후 동일 baseline에 Vite preview로 10/10 통과했다. 첫 결과를 삭제하거나 “처음부터 전체 175 통과”로 정리하지 않았다. 두 HWP 실패는 일반 Python static server가 존재하지 않는 영어 HWP 경로에 app fallback을 제공하지 않아 title=Error response였으며 Vite로 재현 조건을 교정했다. 전체 suite를 다시 1회 모두 통과시킨 결과는 **없다**. 기존 main 175장 실행 시간을 단순 비례시키면 350장 **16m32s**, 406장 **19m11s**, 748장 **35m21s**, 1,072장 **50m40s** 수준이다(실패 timeout 포함 추정, 합격 시간 보장 아님). 406은 이 환경의 20분 상한에 여유가 적어 최종 suite 실측이 필요하다.

**산출물 경로 이탈 기록:** 최초 partial/full visual 두 호출에서 `VISUAL_ARTIFACT_DIR`을 빠뜨려 runner 기본값 **`/tmp/worklazytools-visual-regression`**이 사용됐다. 이 runner는 시작 시 디렉터리를 비우므로 작업 전용 경로 계약을 지키지 못한 실험 실행 오류다. 발견 당시 파일을 [visual-artifacts-observed](evidence/visual-artifacts-observed/)로 복사했으며, 공용 경로의 사전 내용/타 잡 사용 여부는 확인할 수 없다. 그 디렉터리를 더 정리하지 않았고 이후 retry·보존한 `run-visual.sh`는 `/tmp/worklazy-ui-r1/evidence/...`를 명시한다. **제품 워킹트리 추적 파일 수정과는 별개**이며 아래 SHA 증명은 그대로 성립한다.

이 실험은 Chromium/Linux에서 수행했다. 실제 Safari/iOS/Firefox native dialog·IME·mobile virtual keyboard, 운영 CSP 헤더, 필드 LCP·검색 순위·새 primitive 전체 구현의 브라우저 호환성을 완료했다고 주장하지 않는다. 최종 제품용 프리미티브·전체 UI 설계를 구현하지 않았으므로 전 기능 smoke/최종 4테마 전체 baseline/a11y 게이트의 배송 승인은 후속 구현에 남는다. 서비스 운영에 대한 배포·외부 메시지 전송은 없었다.

## 저장소 불변 증명

시작/종료 `git status --porcelain=v1 --branch`는 동일하다.

```text
## s3-pdf-finish
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html
?? newui/
```

- 시작 HEAD: `002732a7d79b0a0a5851bf2e20ccdd83d6bdedfc`.
- 종료 관측 HEAD: `c8bff1fd1ab64f89afb7240778e0a373c953d1a3` (병행 S3 커밋).
- main은 지정 `5bc6854175331bdd73b267784d9633cdccda8446`.
- 추적 파일 2,587개 SHA 전수 비교에서 달라진 파일은 **CHANGELOG.md, docs/review-notes.md, tests/pdf-finish-smoke.mjs 3개**. 세 파일 모두 시작→종료 HEAD의 병행 커밋 diff와 정확히 일치하며 그 외 변화는 **0개**.
- `src/styles/**`, `src/components/**`, `src/i18n/**`, HomePage/ToolsPage/toolRegistry/index/PROJECT_RULES/AGENTS의 **보호 파일 43개 변경 0**.
- `newui/` 원본 PNG **7/7 SHA 동일**.
- 추적 파일을 수정하는 명령은 tmp 사본에만 실행했다. 원본 git checkout/switch/commit/push 명령은 없다. 원본 docs/review-notes에는 쓰지 않았으며 이 보고서의 판정·수치/정본 문안이 취합 입력이다.
- 실험용 Python 서버(4191/4192/4193)와 Vite preview(4195)는 종료했다.

원문: [git-start.txt](evidence/git-start.txt), [git-end.txt](evidence/git-end.txt), [sha-start.json](evidence/sha-start.json), [sha-end.json](evidence/sha-end.json), [immutability.json](evidence/immutability.json), [newui-end.json](evidence/newui-end.json).

## 증거 재현 안내

현재 `/tmp/worklazy-ui-r1/main`은 최종 corrective prototype 소스와 production dist를 보존한다. 같은 경로에 archive를 다시 덮으면 실험 소스가 섞일 수 있으므로 재현할 때는 **새 빈 tmp 디렉터리**에 지정 hash를 푼다. 실험 script가 사용하는 경로 상수도 새 디렉터리로 바꾼다. 원래 입력 파일은 `evidence/original/`에 보존했다. npm 설치 없이 기존 package link/cache 복사, manifest 설정과 tmp-owned 빌드 캐시를 동일하게 구성한다.

순서: 기준 inventory → QA baseline build/measure/capture → `prepare-prototype.py`+`assets.py` → QA theme build/measure/캡처 → `run-stubs.sh`(대체 import 제거 근사, 종료 시 config/CSS 복원) → `run-visual.sh`(Vite preview URL·명시 artifact dir 권장) → `r1-fix-themes.mjs`+QA dist 위 CSS/OS-media 부정 대조/보완 캡처 → production build/static → 기록·SHA 비교. 이미 저장된 capture/JSON만 읽는 검토에는 재빌드가 필요 없다.

`r1-base-ui-stub.tsx`, `R1HeroPicture.tsx`, lab HTML은 실험 전용이며 product로 복사할 완성 구현이 아니다. `buildCommand` 자동 필드가 dist-measure라고 적힌 최초 baseline JSON은 실제로 QA `npm run build`의 manifest 산출물을 `measureOutput({directory:dist})`로 읽은 것이다. 비교 양쪽은 같은 main 측정기·같은 QA 모드이며 이 방법 차이를 숨기지 않는다.

— Codx
