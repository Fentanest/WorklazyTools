# 작업지시서 — S0 빈 페이지 결함 수정 (2026-09-06, Claude → Codex gpt-6-astra)

## 0. 선독 (필수 · 순서대로)
1. `PROJECT_RULES.md` 전문 — 특히 「백엔드 없음」·「GitHub Pages 스택」·「현지화·SEO·AdSense 동시 검토」·「내부 구현 비노출」·「작업 기록」·「검증은 실행이다」·「생성물 직접 수정 금지」·「실행 게이트」(광역 금지 계약 포함)·「커밋·업로드·배포는 Codex」.
2. `AGENTS.md`.
3. **정본 계획서** `docs/jobs/todo/roadmap-completion-20260906.md` — §2 공통 계약(C-A~C-G)·**§3 S0 절 전문**. 이 지시서는 그 S0 절의 착수판이다. 두 문서가 어긋나면 **정본 계획서 S0 절이 우선**하고 어긋난 점을 보고에 적어라.
4. A/B 재현 산출물 `/tmp/worklazy-blank-page/repro-20260906-p11gvn05/`의 `REPORT.md`·`MECHANISM.md`·`METHOD.md`·`build-both.py` — 검증 하네스의 출발점이다(읽기만).
5. `docs/review-notes.md` 최근 S0/빈 페이지 관련 항목·`CHANGELOG.md` 상단 형식.

## 1. 작업 성격 · 기준
- **파일 수정이 필요한 구현 작업(쓰기 모드)**. 이전 전달 과정의 "커밋 금지" 제약이 있었다면 무효 — 이 지시서는 **브랜치 커밋을 요구**한다. 단 **`main` 병합·push 는 금지**(§8).
- 저장소 루트 `/home/better0101/projects/worklazytools`.
- **기준 해시: `main` = `5485fadc43677902c51fbc2d13579e8c1a26db0e`**(정본 기준 `4d0bae93…` 위에 docs 커밋 1개 `5485fad` 만 얹힘 — 2026-09-06 16:06 Claude 실측, `origin/main` 동일, Actions run 34017945567 성공). 착수 시 `git rev-parse main` 으로 대조하고 다르면 중단·보고(「실행 게이트」).
- **브랜치**: `git checkout -b s0-blank-page main`. 모든 작업은 이 브랜치에서. 착수 시 `git status --porcelain` 을 기록하라 — untracked 3파일(`after.docx`·`before.docx`·루트 `naver0516….html`)은 사용자 파일이다. **수정·추적·삭제 금지.**
- 열린 계획서 충돌 검사는 Claude 가 완료했다(S0 코드 표면과 겹치는 열린 지시 0건). 실행 중 상반된 지시를 발견하면 보고.
- 코드 위치 인용은 전부 `4d0bae9` 기준 Claude 실측(2026-09-06)이다. 착수 시 다시 grep 해 라인이 어긋나면 어긋난 값을 보고에 적고 실제 위치로 작업한다.

## 2. 문제 정의 (계획서 S0 「사실」·「회귀 판정」 요약 — 상세는 정본)
- 사용자 환경 Android · Samsung Internet · 모바일에서 도구 진입 시 빈 화면. 시작 시점 미상.
- A/B 실측: 정상 진입 빈 화면 0/477·0/459·0/477. **배포 교체(stale document) 서빙에서 두 빌드 모두 129/153 빈 화면**(옛 청크 404 → 로딩 표시 → React 루트 제거). 옛 HTML 고정 312/312 entry 미기동. P2 이전 `073da56` 도 동일 → **회귀 아님 · 롤백 없음 · fix-forward**.
- 현행 코드: 오류 경계 없음, `unhandledrejection`·`vite:preloadError` 처리 없음(`grep -rn 'preloadError\|ErrorBoundary\|componentDidCatch\|unhandledrejection' src` = 0건). 등록 도구 20개 중 19개 lazy. Suspense fallback 은 `src/app/App.tsx` 의 `PdfRoute`·`QrRoute`·`LazyToolRoute`("{{tool}} 준비 중…" / "Loading {{tool}}…", `src/locales/{ko,en}/common.json:103 status.loadingTool`).
- 처리 경계: 앱 내부 경계·재시도는 **실행 중 문서의 lazy 청크 실패와 초기화 예외**만. entry 404(옛 HTML 고정)·오프라인 전체 reload·렌더러 crash 는 경계 밖 → ⑤ 정적 경로.

## 3. 수정 범위 (①~⑥ 전부 필수 · 순서 권고 ①→②→③→⑤→④→⑥)

### ① route-level 오류 경계
- **삽입점: `src/components/AppShell.tsx:129` 의 `<Outlet />` 를 감싸는 위치**(`<main className="main-content" id="main-content">` 안). 대안으로 `src/app/App.tsx:48` `<Route element={<AppShell />}>` 아래 경계용 중첩 Route 도 허용 — 어느 쪽이든 **`:lang → LanguageLayout → AppShell → [경계] → Outlet` 아래에** eager Excel 병합·XLS 보존, `PdfRoute` 4, `QrRoute` 2, `LazyToolRoute` 전부·문서 비교 중첩, PDF split·Word/HWP alias·`LocalizedNavigate` 가 전부 들어와야 한다(4차 왕복 AST 확인: AppShell 바깥 배치 0건). `LazyToolRoute` 만 감싸는 방식은 금지.
- 경계 밖(의도): 루트 언어 랜딩·`InvalidLanguageRedirect`. 이를 "모든 redirect 포괄"로 쓰지 말 것.
- 경계 UI: 사용자 행동 중심 ko/en 문구(예: "도구를 불러오지 못했습니다. 새로고침하면 다시 시도합니다." / "This tool could not be loaded. Refresh to try again."). **원시 예외 메시지·스택·청크명·"Worker"·"런타임" 등 내부 명칭 노출 금지**(「내부 구현 비노출」). 문구 키는 `src/locales/ko/common.json`·`src/locales/en/common.json` 에 동시 추가(feature-locales unit 이 있으니 키 동형 확인).
- **"다시 시도" 버튼은 문서 reload 로 연결**한다(React.lazy 는 실패 결과를 보관하므로 상태 초기화만으로는 청크 재시도가 안 된다). 접근성: 버튼은 실제 `<button>`, 경계 컨테이너는 `role="alert"` 또는 동등, 포커스 이동 처리. 라우트 이동 시 경계 상태는 초기화(경로 key 로 reset) — 다른 도구로 이동하면 정상 렌더.
- 경계 화면의 레이아웃은 기존 `tool-route-loading` fallback 과 같은 높이 예약을 유지해 CLS 를 늘리지 않는다(C-D CLS 비회귀 ≤0.114199).

### ② 청크 실패 1회 자동 재시도
- 등록 위치: `src/main.tsx`(entry) — `window.addEventListener("vite:preloadError", …)`. 처리: `sessionStorage` 가드 확인 → 가드 기록 → `location.reload()`.
- **가드 계약(4항 — 전부 구현·전부 검증)**:
  (a) 실패가 이어지면(가드가 이미 같은 대상에 대해 기록되어 있으면) **자동 새로고침을 반복하지 않고** ① 의 안내 상태로 종료한다 — `event.preventDefault()` 를 호출하지 않아 Suspense 경로로 오류가 전달되게 하거나, 명시적으로 경계를 트리거한다(구현 방식은 자유, 결과는 "① 안내 표시").
  (b) **성공 확인 전 가드 초기화 금지** — 가드는 "대상 도구가 준비 DOM 까지 렌더된 뒤"에만 지운다(예: 도구 페이지 mount 후 또는 경계 하위가 정상 commit 된 뒤). 로드 직후·`pageshow`·시간 경과로 지우지 않는다.
  (c) **`sessionStorage` 접근 예외 처리** — 격리 스크립트 VM 실행처럼 저장소 접근이 throw 하는 환경에서는 자동 reload 를 **생략**하고 ① 안내로 종료(예외 → reload 0회). try/catch 로 감싸고 예외 시 "가드 불가" 분기.
  (d) 재시도 후에도 실패하면 ① 의 안내 화면.
- 가드 키에는 **실패한 대상(경로 또는 청크 URL) 과 현재 문서 경로**를 넣어 다른 도구 진입이 다른 도구의 가드에 막히지 않게 한다. 키 이름은 내부용 — 화면 노출 없음.
- 오피스/XLS 격리 문서(`renderOfficeApp`·`renderExcelPreserveApp` 산출)는 별도 `reloadOnce` 흐름(④)이 있다. ② 와 ④ 가 같은 문서에서 **동시에 reload 를 걸지 않도록** 상호 배제 조건을 명시하고 검증에 포함.

### ③ 초기화 예외의 상태 UI 귀결 — 직접 보강 11곳(확정 목록 · 가감 시 근거 보고)
| # | 파일:라인 | 대상 |
|---|---|---|
| 1 | `src/features/audio-studio/AudioStudioPage.tsx:131` | `RegionsPlugin.create()` |
| 2 | `…/AudioStudioPage.tsx:132` | `TimelinePlugin.create({…})` |
| 3 | `…/AudioStudioPage.tsx:137` | `WaveSurfer.create({…})` |
| 4 | `…/AudioStudioPage.tsx:284` | `new BroadcastChannel(…)` |
| 5 | `src/features/image-studio/ImageStudioPage.tsx:594` | `new Canvas(canvasElement.current, …)` |
| 6 | `src/features/data-converter/DataConverterPage.tsx:39` | `new Worker(new URL("./data-converter.worker.ts", …))` |
| 7 | `src/features/text-tools/TextToolsPage.tsx:34` | `new Worker(…text-tools.worker.ts…)` |
| 8 | `src/features/text-formatter/TextFormatterPage.tsx:37` | `new Worker(…text-formatter.worker.ts…)` |
| 9 | `src/features/video-studio/video-probe.worker.ts:15` | `new FFmpeg()` |
| 10 | `src/features/video-studio/video.worker.ts:92` | `new FFmpeg()` |
| 11 | `src/features/video-studio/VideoStudioPage.tsx:434` | `new BroadcastChannel(…)` |
- 규칙: **동기 예외는 route 경계(①)로, 비동기 rejection·Worker `error`/`messageerror` 이벤트·워커 내부 생성 실패는 각 도구의 상태 UI(기존 상태/진행 표시 컴포넌트)로** 귀결시킨다. 워커 내부(9·10)는 생성 실패를 메시지로 메인에 보고하고 메인 페이지가 상태 UI 로 표시한다. 문구는 ko/en·행동 중심·내부 명칭 비노출.
- **건드리지 않는 곳**: HWP `src/features/hwp-editor/HwpEditorPage.tsx:56`(Promise catch 존재) · AudioContext(`AudioStudioPage.tsx:261` 호출자 try/catch) · Excel 공용 Worker `src/utils/workerLifecycle.ts:23`. grep 31곳 중 나머지 20곳은 이미 처리됨 — 재검토 결과 "미처리"로 판단되는 곳이 있으면 **고치지 말고 목록·근거를 보고**(범위 변경은 Claude 판정).
- BroadcastChannel(4·11)은 미지원/실패 시 기능 저하(핸드오프 비활성)로 처리하고 페이지 자체는 렌더되어야 한다.

### ④ 오피스/XLS 격리 `reloadOnce` 재검토
- `src/features/office-editor/office_coi_serviceworker.js:46` `reloadOnce`: 현행은 `sessionStorage` 키가 `reloadTarget` 과 같으면 스킵. 재검토 항목: (a) 동일 대상 재시도 억제가 실제로 성립하는지(경로+search 기준) (b) **격리 성공 시(`crossOriginIsolated && SharedArrayBuffer`)에만 키 삭제** — 현재 삭제 경로가 없으면 추가 여부 판단·근거 (c) `sessionStorage` 접근 예외 시 동작 (d) ② 와의 상호 배제(위).
- **HWP·오디오 빈 화면의 원인으로 확정하지 않는다.** 변경이 필요 없다는 결론도 허용 — 단 실측 근거(콘솔·sessionStorage 상태·reload 횟수) 첨부.
- 이 파일은 `public/vendor/**` 가 아니라 `src/features/office-editor/` 의 소스다 — 「생성물 직접 수정 금지」 대상 아님을 확인하고 진행. 격리 문서에 광고 코드가 들어가지 않는 현 계약(`scripts/validate-static-output.mjs:150-155`)을 깨지 않는다.

### ⑤ entry 미기동 안내(경계 밖 경로 — 정적 생성기 입력)
- `scripts/generate-static-pages.mjs:5` 가 빌드된 `dist/index.html` 을 공통 입력으로 받아 일반 페이지·언어 랜딩·Office/XLS 격리·redirect·404 를 생성한다. 여기(생성기 또는 그 입력 템플릿 `index.html`)에 **entry·외부 CSS 에 의존하지 않는 ko/en 안내 + 복구 동작(새로고침 유도)** 을 넣는다.
- 요구: (a) `noscript` 만으로는 JS 활성 상태의 entry 404 를 처리하지 못한다 → **인라인 스크립트로 entry 모듈 로드 실패(`<script type=module>` `error` 이벤트 또는 일정 시간 내 앱 mount 신호 부재)를 감지**해 정적 안내를 노출하는 방식. 감지 시간 상한은 실측으로 정하고 근거 기록(느린 모바일 정상 로드를 오탐하지 않을 것 — 정상 로드에서는 절대 표시되지 않아야 한다). (b) 안내는 인라인 CSS 만 사용, 외부 요청 0. (c) 앱이 정상 mount 되면 안내는 제거/비표시. (d) 문구 ko/en(문서 `lang` 기준, 루트 랜딩은 양어 병기), 행동 중심, 내부 명칭 비노출. (e) **격리 문서(office/xls-preserve)·redirect·404 에서도 광고 스크립트·외부 리소스가 추가되지 않아야 한다** — `npm run test:static` 이 통과하고, 광고 코드 부재 단언이 유지되는지 확인. (f) `dist/` 를 손으로 고치지 않는다 — 생성기·템플릿·`src` 만.
- **범위 밖(명시)**: 이미 캐시된 옛 HTML 에 새 안내를 소급 삽입 · HTML 자체를 못 받는 완전 오프라인.
- SEO 영향: 정적 본문(`staticBody()`)의 기존 SEO 텍스트를 줄이지 않는다. 안내 요소는 초기에 `hidden` 이며 검색 스니펫에 영향이 없음을 `test:static`·산출 HTML 직접 확인으로 기록.

### ⑥ 실패 주입 스모크(신규 테스트 파일 + npm script)
- 신규 `tests/blank-page-recovery-smoke.mjs`(이름은 조정 가능) + `package.json` `test:recovery`. **세 사례를 별도 케이스·별도 기대 결과로**:
  - **A. lazy 청크 404**: 서버가 특정 lazy 청크에 404 → 기대: ② 자동 reload 1회 → 복구(정상 DOM) **또는** 반복 실패 시 ① 안내(reload 는 최대 1회). 가드 (a)~(d) 각각을 별도 단언으로: 반복 실패 시 reload 횟수 1 · 성공 전 가드 유지 · 저장소 예외 주입 시 reload 0 + 안내 · 재시도 후 실패 → 안내.
  - **B. entry 404**: 옛 HTML 고정(A/B `stale-html` 방식) → 기대: ⑤ 정적 안내 노출·앱 mount 없음·광고/외부 요청 0.
  - **C. 초기화 예외**: 11곳 중 최소 각 도구군 1개(Audio·Image·Worker 계열 1·Video) 에 예외 주입(예: 생성자 throw 를 init 스크립트로 주입) → 기대: 도구 상태 UI 에 안내, 빈 화면 아님, 원시 메시지 비노출.
- 주입은 **서버 측**(A/B 하네스처럼 정적 서버가 응답을 바꾸는 방식)으로 한다. **`page.route`/`context.route` 는 HTTP 캐시를 비활성화하므로 ⑥-A 와 §5 의 stale-document 실측에서 금지**(C 의 예외 주입에는 `addInitScript` 허용).
- 정상 진입 회귀 단언(빈 화면 0) 도 같은 파일에 최소 표본으로 포함(20 도구 ko/en 직접 진입 1회씩).

## 4. 제품 규칙 점검(「현지화·SEO·AdSense 동시 검토」 — 완료 기준에 포함)
- 신규 문구 전부 ko/en 동시 추가 · `feature-locales`·`seo` unit 통과.
- 광고 격리: 경계 UI·⑤ 안내·② 스크립트가 격리 문서(office/xls-preserve/video 격리)에 **광고 스크립트·외부 요청을 새로 넣지 않는다**. 광역 검사: `grep -rn "adsbygoogle\|googlesyndication" dist/ --include=*.html` 결과가 변경 전(main 빌드)과 **동일 집합**임을 diff 로 증명(전후 파일 목록 비교).
- 내부 명칭 비노출 광역 검사: 신규 문구 파일·경계·안내 HTML 에 `Worker|worker|chunk|청크|런타임|runtime|Error:|TypeError|stack` 이 사용자 노출 문자열로 들어가지 않음을 grep 으로 증명(코드 식별자 제외 — 결과를 사람이 읽고 판정한 표를 첨부).
- SEO: 사이트맵·정적 페이지 수·FAQ 변화 0(`test:static`) — 변화가 있으면 사유.
- CLS: 경계·안내가 정상 진입 시 렌더되지 않으므로 CLS 변화 0 이 기대 — `npm run test:rendering` 으로 비회귀(≤0.114199) 확인.

## 5. 검증 계약(전부 실행 · 출력 기록 — 「검증은 실행이다」)
### 5-1. 공통(계획서 「완료 기준 검증 명령 총람」)
`npm run build` · `npm run test:unit` · `npm run test:static` · `npm run test:browser` · `npm run test:new-tools` · `npm run test:utilities` · `npm run test:office` · `LANG=ko_KR.UTF-8 npm run test:visual` · `LANG=en_US.UTF-8 npm run test:visual` · `VITE_LOCAL_QA=1 npm run build` 후 `A11Y_MAX_TOTAL=0 npm run test:a11y` · `npm run test:rendering` · `npm run bundle:measure`(기준점: 착수 시 `main` 빌드 측정 JSON 을 `/tmp/s0-bundle-baseline.json` 으로 저장하고 `BUNDLE_BASELINE=` 로 비교 — 5종 상한 entry +20 · route +60 · shared +30 · app JS +80 · CSS +10 KB) · `npm run css:orphans` · `npm run legacy:manifest` · `git diff --check` · 신규 `npm run test:recovery` · `node tests/tool-registry-routes.mjs`.
- 시각 회귀는 **전체 2로케일**(상한 20분 — 초과 시 사유·축약 범위 기록). 경계·안내가 정상 화면에 나타나지 않으므로 기준선 갱신 0 이 기대다 — 갱신이 필요하면 사유와 diff 이미지 경로.

### 5-2. S0 전용
- **Android 에뮬레이션**: Playwright 모바일 Chromium(예: Pixel 7 디바이스 프로파일·터치·모바일 UA) 로 ⑥ A/B/C 와 정상 진입 표본을 재실행. 보고에는 **"Android 에뮬레이션(모바일 Chromium) — Samsung Internet 실측 아님"** 을 그대로 표기.
- **청크 404 주입** — lazy 청크 실패(기대: 재시도 → 복구 또는 안내) 와 entry 실패(기대: ⑤ 정적 안내) **별도 사례**.
- **네트워크** — 실행 중 문서의 청크 fetch 실패(스로틀·중단 주입 — 서버 측 지연/연결 끊기, 기대: ②→①) 와 오프라인 전체 reload(entry 미기동, 기대: ⑤ 또는 "보장 범위 밖" 명시) 분리.
- **`Page.crash`** — CDP `Page.crash` 후에는 앱 안내를 단언하지 않는다. **crash 확인 → 명시적 `page.reload()` → 그 이후 DOM 정상 렌더** 로 판정 시점 고정.
- wasm 메모리 상한 — **이번 계획에서 제외**(정의 불가). ③ 으로 대체. 시도하지 말 것.
- **데스크톱 stale-document 자동 복구 실측(결정적 — 4차 확정 측정 조건 그대로)**:
  - 대상: **S0 수정이 포함된, 해시가 다른 두 빌드**(예: 브랜치 HEAD 빌드와 그 위에 무해한 문자열 1개를 바꾼 빌드 — 두 빌드 모두 S0 수정 포함)를 **같은 origin** 에서 교체. `073da56`·`4d0bae9` 빌드는 **수정 전 대조군**으로 같은 절차를 1회 돌려 "자동 복구 없음(129/153 류 빈 화면)" 이 재현되는지 대비 기록.
  - 조건: 동일 context · **HTTP 캐시·SW·sessionStorage 유지** · 서버 `Cache-Control: max-age=600` 유지 · 캐시 삭제·강제 우회(`Network.clearBrowserCache`·hard reload)·수동 `page.reload()` **제거** · **`page.route`/`context.route` 금지**(HTTP 캐시 비활성화) — 교체·실패는 서버에서 주입.
  - 절차: 홈 로드(옛 빌드) → 서버 dist 교체 → **아직 받지 않은 lazy 청크의 도구로 진입** → 옛 해시 404 확인 → **자동 처리만 관측**.
  - 단언: 배포 교체 → 결과가 **600초 이내** · 자동 reload **≤1회** · 성공 = **최신 HTML/entry 식별값(새 빌드 해시) + 해당 도구 준비 DOM** · 반복 실패 시 안내로 종료 · 가드는 대상 도구 성공 전까지 유지 · 저장소 예외 주입 시 자동 reload 생략·안내 종료.
  - 기록: 요청별 응답 상태·캐시 출처(`fromCache`/disk/memory·`Age`)·시각·reload 횟수·최종 DOM·스크린샷. 표본: 최소 5개 도구 × ko/en × 3회(HWP·오디오 5회) — 축약 시 사유.
  - **실패하면 ② 는 "조건부"로 문서화하고 ① 안내가 보장**임을 review-notes 에 명시 — 실패 자체는 이 지시서의 실패가 아니다. 실측 없이 "복구된다"고 쓰는 것이 실패다.
- 빈 페이지 0 · 안내 단언 · C-D CLS 비회귀 — 조건별 적용 시점을 구분해 기록.
- Gemini 라이브 재검수는 **배포 후** Claude 가 별도 위임한다 — 이 잡의 범위 아님. 대신 **로컬 시각 검수용 `VITE_LOCAL_QA=1` 빌드를 `dist/` 에 남기고**, 검수 경로 목록(경계 강제 표시 상태를 볼 수 있는 방법 — 예: 테스트 서버 스크립트 + 옵션)을 보고에 적어라.

## 6. 기록(브랜치에서 병합 전 — C-A)
- `CHANGELOG.md`: 코드 변경 요약 몇 줄(무엇이 바뀌었나), 서명 Codx.
- `docs/review-notes.md`: S0 작업 단위 제목 아래 — 판정·실측 수치·가설 검증(stale-document 자동 복구 결과 표·대조군·⑥ A/B/C 결과·Android 에뮬레이션 결과·④ 재검토 결론·11곳 처리표·범위 밖 명시). 서명 Codx.
- `docs/jobs/todo/roadmap-completion-20260906.md` 는 **수정하지 않는다**(Claude 가 갱신). 진행 기록은 보고에.

## 7. 커밋
- 브랜치 `s0-blank-page` 에 논리 단위별 커밋(예: 경계+재시도 / 초기화 예외 11곳 / 정적 안내 / 스모크+기록). 영어 한 줄 요약 관례. **squash·rebase·force push 금지.**
- 커밋에 `dist/`·jobs 원문·측정 로그·untracked 사용자 파일 3개·`/tmp` 산출물을 넣지 않는다. `git add -A`·`git add .` 금지 — 파일 명시.
- 테스트 하네스가 생성한 스크린샷 등 대용량 산출물은 `/tmp/worklazy-s0/` 아래에 두고 경로만 review-notes 에 적는다(visual-artifacts 관례를 따라야 하는 시각 회귀 캡처는 기존 관례대로).

## 8. 정지점 — **`main` 병합·push 금지**
- 완료 기준 전부 통과 후 **브랜치 상태로 멈춘다.** `--no-ff` 병합과 push 는 Claude 의 게이트 ①~⑧ 판정 → 사용자 배포 승인 뒤 별도 지시로 수행한다.
- 종료 시 `git status --porcelain`(untracked 사용자 파일 3개만 남아야 함)·`git log --oneline main..s0-blank-page`·`git diff --stat main..s0-blank-page` 원문.

## 9. 보고 형식(반드시 산출물 경로·명령·출력 원문 병기)
1. 착수 게이트: `git rev-parse main`·상태·브랜치 생성 확인 · 라인 인용 재검(어긋난 곳 표).
2. 구현 요약: ①~⑥ 각각 변경 파일·핵심 결정(특히 ② 가드 키 설계·⑤ 감지 방식과 시간 상한 근거·④ 결론).
3. 검증표: 5-1 각 명령 → 통과/실패·소요·출력 요약(실패는 원문). 5-2 각 항목 → 조건·표본 수·결과 표·산출물 경로.
4. stale-document 자동 복구 실측 결과 표(대조군 vs S0 빌드 · 도구 × 언어 × 회차 · reload 수 · 복구 시각 · 캐시 출처) + **판정: ② 무조건 / 조건부**.
5. 제품 규칙 점검표(§4).
6. 번들 5종 delta 표.
7. 범위 변경 제안·미해결(고치지 않고 보고한 것) 목록.
8. Claude 육안 검수 안내: 로컬 QA 빌드 기동 명령·경계/안내 강제 표시 방법·검수 경로 목록.
9. §8 정지 상태 원문.

## 10. 금지 요약
`main` 커밋·병합·push · squash/rebase/force · `dist/`·`public/vendor/**` 손수정 · `page.route` 로 캐시 실측 · 새 npm 의존 추가(필요하면 사유와 함께 **먼저 보고**, 설치는 승인 후) · 계획서 정본 편집 · 사용자 untracked 파일 3개 조작 · 원시 예외·내부 명칭의 사용자 노출 · 광고 스크립트를 격리 문서에 추가.
