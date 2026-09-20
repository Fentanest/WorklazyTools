# 작업지시서 초안 — 메인 UI 개편·4테마 시스템·shadcn 제거 (2026-09-07, v1 Claude 초안 — 정본 아님)

> 사용자 `!계획!` 발동(2026-09-07 11:30). 시안 원본: `newui/`(gitignore, PNG 7장 — 라이트 코랄·다크 코랄·라이트 민트·다크 민트 시안 4 + 코랄/민트 히어로 에셋 2 + 핸드오프 문서 1). **알림종 버튼은 제외**(사용자 지시).

## 0. 사용자 요구·결정 (원문 요지 — 임의 축소 금지)
- 목표: "IT-Tools 처럼 단정한 레이아웃 + WorklazyTools 브랜딩 + 가벼운 카드 UI". 과한 다색 금지, 동일 레이아웃 위에서 테마만 바뀜.
- 레이아웃: ① 좌측 고정 사이드바(브랜드 / 홈 / 모든 도구 / **카테고리 목록**: 문서·미디어·기타 / 하단 안내 카드 + 정보·문의) ② 상단 바(햄버거 · 넓은 검색창 · 언어 드롭다운 · 테마·GitHub 유틸 — **알림종 제외**) ③ 히어로(카피 + CTA 2개 + 우측 일러스트) ④ **4열 도구 카드 그리드**(아이콘·제목·1~2줄 설명·태그 1~3개·우측 하단 화살표).
- 테마 4종: 라이트 코랄(기본) → 다크 코랄 → 라이트 민트 → 다크 민트 → 순환. `localStorage` 키 `worklazy-theme`, 값 `light-coral|dark-coral|light-mint|dark-mint`. 새로고침 후 유지.
- 스타일: 라운드 12~16px, 얇은 보더·은은한 그림자, 넉넉한 여백, 카드 배경 뉴트럴, 카테고리 구분은 아이콘 컬러 + 아주 약한 틴트만.
- 토큰화 필수: background·surface·surface-muted·border·text-primary·text-secondary·accent·accent-strong·accent-soft·sidebar-background·hero-background·card-background·icon tints·button colors·shadow/glow.
- 히어로 에셋: 코랄/민트 2종, 다크는 같은 계열에 glow·대비 강화.
- 요구 산출: 변경 파일 목록 · 테마 구조 설명 · 순환 로직 설명 · 에셋 연결 방식 · 테마 추가 방법.
- **사용자 결정(11:32)**: ① shadcn **전면 제거** ② 적용 범위 **셸 + 홈 + 도구 화면 전체** ③ 히어로 에셋 **WebP/AVIF 변환 + 반응형**.

## 1. 현행 실측 (2026-09-07 11:25~11:35 Claude, `main` `5bc6854` 기준 — 전부 재현 명령 병기)
| 사실 | 값 | 산출 |
|---|---|---|
| 테마 시스템 | **없음**. 다크는 `@media (prefers-color-scheme: dark)` 두 곳뿐(`global.css:882`, `tailwind.css:91`) — 수동 전환·저장 없음 | `grep -n "prefers-color-scheme" src/styles/*.css` |
| Tailwind `dark:` 변형 | **51개 파일**이 사용. v4 기본 변형이라 OS 설정에 묶임 → 수동 4테마면 `@custom-variant` 재정의 필요 | `grep -rln "dark:" src --include=*.tsx --include=*.ts \| wc -l` |
| shadcn 프리미티브 | `src/components/ui/` **7파일**(button·card·progress·sheet·switch·toggle·toggle-group) + `src/components/ui.tsx` 298줄, 합계 843줄. **소비 파일 62개** | `wc -l src/components/ui/*.tsx src/components/ui.tsx` |
| 관련 의존성 | `@base-ui/react ^1.7.0`(헤드리스 동작), `shadcn 4.20.1`(CLI), `clsx`, `tailwind-merge`, `lucide-react` | `package.json` |
| 레거시 CSS | `src/styles/global.css` **937줄**(`.hero`·`.sidebar`·`.ui-tool-card`·다크 블록 등) + `tailwind.css` 126줄 | `wc -l src/styles/*.css` |
| 셸 | `AppShell.tsx` 265줄. 사이드바(브랜드·홈/모든도구·**도구 평면 목록**·하단 안내/정보/피드백) + **모바일 전용 헤더**. **데스크톱 상단바·검색 없음** | 판독 |
| 홈 | `HomePage.tsx` 58줄(히어로·도구 그리드·PrivacyBanner·HOW IT WORKS 3단계). 카드 = `ToolCard.tsx` 45줄 | 판독 |
| 도구 등록 | `toolRegistry.ts` 433줄. **카테고리 5종 이미 존재**(documents·media·text-data·work·security-share), 도구 **20개**, `accent` 6색(green·blue·violet·orange·pink·sky) | 판독 |
| 홈 카피 | ko 헤드라인은 시안과 **동일**(`귀찮은 파일 작업은` / `도구에게 맡기세요.`), 서브카피만 다름. en 별도 존재 | `src/locales/{ko,en}/common.json` `home.*` |
| 시각 기준선 | **203장**(홈 8장 포함), 시나리오 config·scenarios 분리 | `ls tests/visual-baselines \| wc -l` |
| 접근성 | `accessibility-audit.mjs` 8+페이지(홈·모바일 홈 포함), 게이트 `A11Y_MAX_TOTAL=0` | 판독 |
| 렌더링 | `rendering-baseline.mjs` CLS ≤0.1 차단 게이트, 홈 포함 | 판독 |
| 테스트 셀렉터 | `data-testid` 다수(`document-*`·`excel-*`·`image-editor-*` 등)와 `data-ui-component` 를 스모크가 직접 잡음 | `grep -rho 'data-testid="[a-z-]*' tests/*.mjs` |
| 격리 경로 | video/office/excel-preserve 는 셸을 우회하는 격리 문서(광고 제외) | `AppShell.tsx` 판독 |

## 2. 설계 초안
### 2-1. 테마 토큰 계층(3층)
1. **원시 팔레트**(`--wl-coral-500`…): 코랄·민트 각 스케일 + 뉴트럴 스케일. 테마와 무관.
2. **의미 토큰**(사용자 요구 목록 그대로): `--wl-bg`·`--wl-surface`·`--wl-surface-muted`·`--wl-border`·`--wl-text`·`--wl-text-muted`·`--wl-accent`·`--wl-accent-strong`·`--wl-accent-soft`·`--wl-sidebar-bg`·`--wl-hero-bg`·`--wl-card-bg`·`--wl-icon-tint-*`·`--wl-button-*`·`--wl-shadow`·`--wl-glow`·`--wl-radius-*`. **4테마 = 이 층만 교체.**
3. **호환 별칭**: 기존 `--background`/`--primary`/`--card` 등 shadcn 토큰과 `--bg`/`--label`/`--separator` 등 레거시 토큰을 의미 토큰으로 **재지정**해, 도구 화면 62파일을 한 번에 바꾸지 않고도 새 테마를 상속시킨다(단계적 제거).
- 적용 방식: `<html data-theme="light-coral">` 속성 + `:root[data-theme="…"]` 블록 4개. `color-scheme` 동반 지정(폼 컨트롤·스크롤바).
- Tailwind: `@custom-variant dark (&:where([data-theme^="dark"], [data-theme^="dark"] *))` 로 기존 `dark:` 51파일을 **수동 테마에 재연결**(1단계 호환), 이후 단계에서 accent 의존 부분만 토큰으로 치환.
### 2-2. 테마 순환·저장·FOUC
- 순환: `light-coral → dark-coral → light-mint → dark-mint → light-coral`. 버튼 1개(현재 테마 아이콘 + `aria-label` 에 다음 테마 이름), `aria-live` 없이 라벨 갱신.
- 저장: `localStorage["worklazy-theme"]`, 잘못된 값·차단 환경이면 기본 `light-coral`(try/catch).
- **FOUC·CLS 방지**: `index.html` 에 인라인 스크립트로 첫 페인트 전 `data-theme` 설정(`chunkRecovery` 정적 안내와 같은 위치). 정적 생성 HTML 61페이지에도 동일 스크립트가 들어가야 하므로 `generate-static-pages.mjs` 입력에 반영.
- 시스템 다크 선호는 **초기값에 반영하지 않는다**(사용자 요구: 기본은 라이트 코랄). 단 `prefers-reduced-motion` 은 전환 애니메이션에 반영.
### 2-3. 셸 재구성
- **사이드바**: 브랜드(로고+CLIENT SIDE 배지+태그라인) / 홈·모든 도구 / **카테고리 그룹**. 시안은 3그룹(문서·미디어·기타)이나 레지스트리는 5종 → **매핑 필요**: 문서 = documents, 미디어 = media, 기타 = text-data + work + security-share. 그룹 라벨·순서는 i18n 키로. 하단: 안내 카드 + 정보 + 문의.
- **상단바(데스크톱 신설)**: 햄버거(사이드바 접기) · 검색 · 언어 드롭다운(기존 `LanguageSwitcher` 재사용) · 테마 버튼 · GitHub 링크. **알림종 없음.**
- **검색**: 도구 이름·설명·태그를 로컬 필터(레지스트리 기반, 외부 요청 0). `Ctrl/⌘+K` 포커스, `Esc` 해제, 결과 키보드 이동. 신규 기능이므로 ko/en 문구·a11y(`role="combobox"` 또는 단순 필터+목록) 계약 필요.
- **모바일**: 사이드바 드로어(기존 Sheet 대체 컴포넌트), 상단바 축약. 격리 경로(video·office·excel-preserve)는 셸 미적용 유지.
### 2-4. 홈 재구성
- 히어로: 배지 + 헤드라인(현행 ko 카피 유지, 서브카피는 시안 문구로 갱신 — en 동반) + CTA `도구 둘러보기` + 상태 카드 `파일 업로드 없음` + 우측 에셋.
- 카드 그리드: 4열(1440↑) / 3열 / 2열 / 1열. 카드 = 아이콘(카테고리 틴트) · 제목 · 1~2줄 설명 · 태그 1~3 · 우측 하단 화살표. 현행 `highlights`(아이콘+라벨)를 **태그 텍스트**로 축소 표시.
- 마지막 카드 `안전한 로컬 처리`(시안) = 현행 `PrivacyBanner` 를 카드 형태로 편입. `HOW IT WORKS` 3단계 섹션 존치 여부 **결정 필요**(시안에 없음 — 삭제하면 SEO 본문이 줄어듦).
### 2-5. 프리미티브 자체 구현(shadcn·base-ui 제거)
- 대체 대상 7종: Button·Card·Progress·Sheet(드로어)·Switch·Toggle·ToggleGroup. `@base-ui/react` 제거 시 **포커스 트랩·ESC·스크롤 잠금·`aria-*`** 를 직접 구현해야 한다(Sheet 가 최대 위험).
- `clsx`+`tailwind-merge` 는 유지(빌드 도구가 아니라 런타임 유틸, 제거 이득 적음). `shadcn` CLI 패키지는 제거.
- 62개 소비 파일은 import 경로만 바꾸는 것이 원칙(prop 계약 동일). **`data-slot`·`data-ui-component`·`data-testid` 는 전부 보존**(스모크가 잡음).
### 2-6. 도구 화면 정합
- 20개 도구 화면은 **토큰 상속으로 자동 반영**되게 하고, 직접 색을 쓴 자리(`toolAccentStyles.ts` 6색·`dark:` 하드코딩·레거시 `.ui-accent-*`)만 카테고리 틴트 토큰으로 치환. 사용자 앞선 결정("1안": 컨트롤은 단일 primary, 도구색은 카테고리 배지)과 정합.
- 레거시 `global.css` 는 **죽은 규칙 제거**(`css:orphans` 게이트)와 남은 규칙의 토큰 치환을 단계로 나눈다.
### 2-7. 에셋 파이프라인
- 입력 PNG 2종(코랄 1.03MB·민트 1.21MB)을 `scripts/` 빌드 스크립트로 **AVIF+WebP × 2~3 폭** 생성, `<picture>` + `width/height` 고정(CLS 0). 원본 PNG 는 저장소에 커밋하되 산출물은 생성물 규칙(「생성물 직접 수정 금지」) 적용. 다크는 CSS(밝기·glow·overlay)로 처리.
- 홈은 **entry 청크**에 붙으므로 이미지·CSS 증가가 5종 예산의 entry/CSS 항목에 직결 — 사전 측정 필요.

## 3. 단계 분할(초안 — 각 단계 = 커밋 묶음, 배포는 마지막 1회)
| 단계 | 내용 | 게이트 |
|---|---|---|
| W0 | 토큰 3층 + 4테마 CSS + `data-theme` + 순환 버튼 + localStorage + FOUC 스크립트(정적 61페이지 포함) + `@custom-variant dark` | unit(순환·저장·복구) · static · 대비비 측정 |
| W1 | 프리미티브 7종 자체 구현 + 62파일 import 치환 + `shadcn`·`@base-ui/react` 제거 | 전 스코프 스모크 · 번들 5종(감소 기대) · a11y 0 |
| W2 | 셸 재구성(사이드바 카테고리·상단바·검색·모바일 드로어) | `test:browser` 셀렉터 · a11y · CLS |
| W3 | 에셋 파이프라인 + 히어로 | 번들 entry/CSS · CLS · LCP 기록 |
| W4 | 홈 재구성(히어로·4열 카드·태그·안전 카드) | 시각(홈 8장 갱신) · SEO/정적 · a11y |
| W5 | 도구 화면 20개 토큰 정합 + 레거시 CSS 정리 | 시각 203장 갱신 · `css:orphans` · 전 스코프 |
| W6 | 최종 게이트·육안 검수(규칙 19)·배포 1회 | 9게이트 전항 |

## 4. 완료 기준(초안)
`npm run build` · `npx tsc -b` · `npm run test:unit` · `npm run test:static` · 전 스코프 스모크(`test:browser`·`test:new-tools`·`test:utilities`·`test:office`·`test:qr-bulk`·`test:recovery`·`TEST_SCOPE=pdf`) · `test:excel-*` · `LANG=ko/en npm run test:visual`(**203장 갱신 — 이번 회차는 회귀 탐지력이 0 이므로 육안 검수와 DOM 단언이 게이트**) · `A11Y_MAX_TOTAL=0 npm run test:a11y`(4테마 × 홈·도구 표본) · `npm run test:rendering`(CLS ≤0.1, 테마 전환·히어로 포함) · `npm run bundle:measure`(5종 상한 — shadcn 제거 감소 vs 에셋 증가 순증분) · `css:orphans` · `legacy:manifest` · `tool-registry-routes` · `git diff --check`. 추가: **테마 4종 × ko/en × 라이트/다크 대비비 WCAG AA**(본문 4.5:1·큰 글자 3:1) 실측표.

## 5. 명시 제외(초안)
알림종 버튼 · 도구 기능·경로 변경 · 새 도구 추가 · 다국어 추가 · 시스템 다크 선호 자동 적용 · 검색의 서버·인덱스 API · PWA/설치 UI 재설계 · 격리 경로(video·office·excel-preserve) 내부 UI · U4(PDF finish) 화면.

## 6. 열린 쟁점(사용자 결정 필요 ★)
1. `HOW IT WORKS` 3단계 섹션과 `PrivacyBanner` 존치/편입 방식(시안에 없음, SEO 본문 영향).
2. 사이드바 카테고리 3그룹 매핑(문서=documents / 미디어=media / 기타=text-data+work+security-share) 승인 여부.
3. 홈 카드 개수(현행 20개 전부 vs 시안처럼 12개 + "전체 보기").
4. 시각 기준선 203장 일괄 갱신 승인(이번 회차 회귀 탐지력 0).
5. S3(U4 PDF finish) 와의 순서 — U4 배포 후 착수 vs 병행 브랜치.

## 6-B. 문서 비교 계획에서 **이관된 UI 항목**(2026-09-07 11:52 사용자 결정 5 — "문서 비교는 엔진만, UI 는 개편에 합치기")
근거·문안 원문: `docs/jobs/todo/document-compare-rounds/round-2-AMENDMENTS.md` D·E 절(astra 실측·캡처). 이 계획의 W5(도구 화면) 에 포함한다.
- **U1 결과 폭**: 문서 비교 결과 페이지 `UtilityPage` 호출에만 `min-[821px]:max-w-[1480px]`(공용 기본폭·셸 padding 불변). 1920px 본문 한 열 388 → **529px**(rail 차감 후 최종 실측; 613px 은 rail 미차감 수치).
- **U2 이동 rail**: 결과 문서 x-scroll 과 형제 배치, nav 는 DOM 상 먼저·rail 안 `sticky top:80px`. ≥1600px rail 156/gap 12(텍스트), 821~1599px rail 52/gap 8(아이콘 + sr-only ko/en 이름 + tooltip, 카운터 유지). 문서 최소폭 940 보존. **가로 스크롤 증가(1280px 48→108px) 사용자 승인(11:52).** 모바일은 nav 가 문서 앞에 쌓이고 페이지 스크롤 추종을 새로 약속하지 않는다. MutationObserver·resize 복제 금지.
- **U3 모바일 수리**: 320 EN toolbar 잘림(page overflow 13px·Next hit=false) → nav `minmax(0,1fr) 44px minmax(0,1fr)` + 버튼 줄바꿈 + toolbar wrap, 결과 toolbar ≤1200 세로 배치.
- **U4 결과 ARIA 수리(사용자 승인 11:52)**: 두 columnheader 를 `role=row` 로 묶고 `article role=cell` → 유효한 `div role=cell`(내부 `DocumentTable` 실제 table 의미론 유지), 가로 스크롤 영역·넘칠 수 있는 legend 에 `role=region`+현지화 이름+`tabIndex=0`. 실제 결과 상태 axe **0**(현행 실측 위반 desktop 71·mobile 72). `browser-smoke.mjs` 본문 행 선택자를 `[role=row][data-document-kind]` 로 교체.
- **U5 상태 계약**: `resultTab`·`showFullContent` 는 결과 페이지 상태로 문서 쌍 전환 시 유지, 선택 index 는 쌍·tab·전체내용 토글 때 −1 초기화, `key` 는 결과 영역에만(App/세션 provider remount 금지). 초기 previous=마지막·initial next=첫 변경, 경계 disabled, 변경 0/내용 0 이면 nav 미렌더, resize 는 index·focus 유지.
- **U6 하네스 등록**: 공용 진입 helper `tests/document-result-entry.mjs`(합성 DOCX 메모리 생성 → 파일 input → 비교 → 결과 링크; 34문단·본문 변경 12·표 변경 1·header 변경 1·빈 notes·동일 내용 두 번째 쌍; timeout worker 240s·DOM 30s·폰트+2RAF·안정화 3s; 결과 URL 직접 goto 금지). a11y 에 result KO1920 light·EN320 light·EN1920 dark **3 ID** 추가(각 axe 0), rendering 에 `document-result` 추가(입력 페이지와 결과 진입 metric phase 분리, 결과 mount 직전 CLS reset), 시각 fixture 는 장문·다중 변경으로 등록. 기존 등록·S3 등록 보존.

## 7. 반박 1차 요청(astra, 실험 모드·저장소 불변)
(a) §1 실측 재현·정정 (b) 토큰 3층 + `@custom-variant dark` 로 51파일을 수동 4테마에 재연결했을 때의 반례(중첩 `dark:` · `prefers-color-scheme` 잔재 · 인쇄/강제 색 모드) 프로토타입 (c) FOUC 스크립트가 정적 61페이지·격리 문서·`chunkRecovery` 와 충돌하지 않는지 (d) 프리미티브 7종 자체 구현의 a11y 계약(특히 Sheet 포커스 트랩·스크롤 잠금)과 `@base-ui/react` 제거 시 번들 delta 실측 (e) 검색 UI 의 a11y 패턴·키보드 계약·모바일 처리 (f) 에셋 AVIF/WebP 변환 후 실제 크기·LCP·CLS 실측(1920/1440/390) (g) 시각 기준선 203장 갱신 절차와 S3 와의 충돌 (h) 4테마 × 주요 화면 대비비 실측 가능성 (i) 단계 분할 순서의 위험(특히 W1 프리미티브 제거를 셸 재구성보다 먼저 두는 것) (j) sol 재해석 지점 열거.

## 왕복 기록
- v1 초안 2026-09-07 11:40 Claude. 기준 HEAD(main) `5bc6854175331bdd73b267784d9633cdccda8446`. 반박은 main 사본에서 읽기·실험(현재 워킹트리는 `s3-pdf-finish` — U4-3 구현 병행 중, 건드리지 않는다).

---

## v2 반영 (2026-09-07 12:20, Claude — astra 1차 반박 R1~R12 **전건 수용** + 사용자 결정 2건. 근거 `docs/jobs/todo/ui-redesign-rounds/round-1-REPORT.md`·`probes-r1/`)

**사용자 추가 결정(12:18)**: ④ 홈 카드는 **전부 표시**(ko 20 / en 19, registry 순서, 전체 보기 CTA `/tools` 유지). ⑤ `HOW IT WORKS` 3단계는 **하단에 간결하게 유지**(새 토큰으로 재작성). — 앞선 결정 ①shadcn 전면 제거 ②셸+홈+도구 전체 ③WebP/AVIF 는 그대로.

### R1 — 실측 기준 정정 [수용]
v1 §1 의 `dark:` 51파일·소비 62·기준선 203장은 **S3 브랜치 수치**였다. **정본 기준은 `main` `5bc6854`**: `dark:` **50파일**(스캐너 후보 89) · UI import 소비 **61파일**(내부 3 포함, primitive subpath 직접 소비 51) · 시각 **80 scenario / 175 PNG**(홈 8) · 도구 **ko 20 / en 19**(HWP 영어 제외 정책 보존) · 카테고리별 documents 7·media 3·text-data 4·work 3·security-share 3(3그룹 표기 시 ko 7/3/10, en 6/3/10). `ui/*.tsx` 545 + `ui.tsx` 298 = **843줄**, global 937 / tailwind 126, AppShell 265 / Home 58 / registry 433 은 확인. **구현 착수 시 S3 통합 후 새 기준 해시로 전 수치 재산출.**
- **정정 2건**: (i) "검색 없음" 은 **데스크톱 전역 검색**에만 해당 — `ToolsPage` 에 이미 부분일치 필터가 있다. (ii) "격리 경로는 셸 우회" 는 **틀림** — video/office/XLS 격리 문서도 `AppShell` 아래에서 aside/header/main/footer/bottom-tabs 를 공통 렌더한다.

### R2·R3 — 테마 토큰·다크 연결·상태색 [수용]
W0 에서 기존 두 `prefers-color-scheme: dark` 블록의 **토큰과 직접 selector 규칙을 모두 새 semantic 테마 소유로 이관**한다(별칭만 붙이면 dark-coral + OS light 에서 밝은 히어로에 흰 글자 — 부정 대조 재현됨). CSS layer 순서 `theme/base/legacy/components/utilities` 와 호환 reset 유지, 의미 토큰 별칭이 뒤의 legacy `:root`·OS media 에 덮이지 않게 한다. `@custom-variant dark (&:where([data-theme^="dark"], [data-theme^="dark"] *))` 로 html 의 **네 값 whitelist** 에만 연결하고 **중첩 테마는 미지원**(명시). 테마 4 × OS 밝기 2 = **8조건** 교차로 색·native form scheme 확인. `--destructive` 등 상태 토큰을 별칭에서 빠뜨리면 OS 를 따라가므로 전부 semantic 소유로. print 는 흰 바탕/검정 글자·장식 제거, forced-colors 는 시스템 색 + 식별 가능한 focus/control 경계.
- **상태색 분리**: brand accent / UI primary / on-primary / on-soft / hover·active / control-border / focus / disabled / success·warning·error·info 를 각각 명시. **컨트롤은 단일 primary**, 카테고리 틴트는 배지·아이콘 한정(backlog 「UI 색 체계」 1안 정합). diff 삽입·삭제, PDF 선택, 오류/성공 같은 **의미 색은 카테고리 색으로 치환 금지**. `--accent` 호환 별칭은 기존 "soft surface" 의미 유지. `ui.tsx` `PrimaryButton` 의 6색 매핑도 교체 대상.
- **대비 보정(시안 원색 다수 미달 — 실측)**: light-coral 보조 4.36·CTA 3.30·태그 3.08·틴트 3.82 / dark-coral CTA 3.04 / light-mint 보조 4.11·태그 3.12 미달. 출발 팔레트는 astra 보정표 채택 — light-coral `#f2f6fa`/`#fff`·`#101827`/`#56657c`·`#d53228`/`#fff`·on-soft `#b9251e`/`#ffedea` · dark-coral `#10171e`/`#1a232c`·`#f5f7fa`/`#b8c7db`·`#ff8278`/`#201619`·`#ff8278`/`#382323` · light-mint `#f2f6fa`/`#fff`·`#101827`/`#56657c`·`#007d65`/`#fff`·`#006451`/`#e2f5ef` · dark-mint `#0d181e`/`#18242c`·`#f5f7fa`/`#b8cdd9`·`#59efce`/`#06241e`·`#59efce`/`#153a34`. **`hover:bg-primary/80` 류 opacity 감산 금지**(보정 primary 로도 3.69/3.56 실패) → hover 는 별도 strong 배경. 반올림 전 기준 적용.

### R4 — FOUC·정적 HTML [수용]
초기화 IIFE 는 `index.html` charset 직후 **최초 실행 script 1회**, storage try/catch + whitelist 만 읽어 `data-theme` 와 native `colorScheme` 설정. React·chunkRecovery·동의·격리 SW 비의존. 실측: 제품 HTML **104개 전부 1회·module 앞**, 제품 CSP meta 0(생성기 sourceHtml 템플릿으로 전파 — 61 은 crawlable 수이지 총 문서 수가 아니다). 검증은 **생성된 HTML 전체 재귀**(61 하드코딩 금지). 잘못된 값·storage 차단 → `light-coral`, React 초기값은 이미 정해진 html 값에서 읽고 **theme key 로 앱을 remount 하지 않는다**. `theme-color` meta 를 단일화해 테마 배경과 동기화. `#startup-help` 의 white/#222 하드코딩은 명시 예외 또는 CSS 비의존 fallback 으로 결정. **CSP 있는 RHWP vendor entry/print 3문서에는 삽입 금지**(경로·목적·소유자로 예외 유지).

### R5 — 프리미티브 대체 범위 [수용]
"import 경로만 바꾸기" 는 **틀림**. 공용 컴포넌트 **public import 경로는 유지**하고 내부 구현을 자체 코드로 교체한다(62파일 기계적 경로 변경은 목표 아님). `data-slot`·`data-ui-component`·`data-testid`·상태 ARIA 보존. **`tests/unit/p1b-components.test.ts` 가 `node_modules/@base-ui/react` 파일을 직접 읽어 단언**하므로 제품 행위 검증으로 교체. **`src/styles/tailwind.css` 가 `shadcn/tailwind.css` 를 실제 import**(data-open/closed/checked/disabled 등 커스텀 변형 포함) — 제거 시 이 import·`components.json`·CLI 흔적·package/lock·license 생성 입력까지 정리. `class-variance-authority` 는 유지/자체 유틸 교체를 명시. `clsx`·`tailwind-merge`·lucide·Tailwind 는 유지.
- **7종 계약표**(완료 기준): Button(type·disabled/busy·ref·render polymorphism·중첩 금지) · Card(`as` polymorphism·heading 구조·geometry) · Progress(value null=indeterminate·clamp·ARIA 일치) · **Sheet**(controlled open·trigger ID·portal/top layer·ESC 최상위만·바깥 클릭 vs 내부 drag·focus initial/loop/**양방향 Tab wrap**/restore·inert 배경·nested scroll-lock refcount·route/820px 교차·unmount cleanup) · Switch(label click·Space/Enter·track 43×25·thumb 21×21 중심 일치) · Toggle(aria-pressed) · ToggleGroup(**value 배열 API**·SegmentedControl 어댑터의 빈 배열 거부·roving tabIndex·arrow/home/end·disabled skip).
- **번들 절감 상한 근사**(stub 측정, 확정값 아님): entry **−28,769B**, app **−28,858B**, CSS −325B. main 측정기는 schema v1, S3 는 v2 이므로 **서로의 baseline 비교 금지** — 착수 기준에서 동일 측정기로 전후 재생성.

### R6 — 전역 검색 [수용]
topbar 는 **labelled combobox**(`aria-expanded/controls/autocomplete=list/activedescendant`) + 이름 있는 listbox. 포커스는 input 유지, option 안에 중첩 링크·버튼 금지. ArrowDown/Up 첫·마지막 진입 및 wrap, Enter 는 활성 결과만 이동, Tab 은 popup 닫고 자연 이동, Escape 는 popup 만 닫고 query·focus 유지, 빈 결과는 **count status**(결과 목록 전체 `aria-live` 금지 — 현행 ToolsPage 문제). IME 조합 중 이동 금지·`compositionend` 후 갱신. blur/route/language 변경 시 invalid active ID 비움. 모바일 popup 은 visual viewport·키보드 고려.
- matcher: NFKC·소문자·공백 정규화, 공백 AND 부분일치. 현재·상대 언어의 이름/shortTitle/설명/highlight + **명시 별칭**(Excel↔엑셀 등) + **초성 전용 질의**(ko 이름·shortTitle·별칭 초성 부분일치). fuzzy·오타 보정 제외. registry 순서·ko 20/en 19 유지. (현행 색인만으로는 "엑셀" 0건·"ㅁㅅ" 0건 — 재현됨.)
- `Ctrl/⌘+K` 는 본문 도달 이벤트에서만 preventDefault, defaultPrevented·IME·Alt/Shift·다른 편집 요소·열린 modal 에서는 가로채지 않는다. 브라우저 chrome 선점은 보장하지 않으며 **항상 보이는 검색 input 제공**. 기존 audio undo/redo·image 단축키와 충돌 없음을 단언.

### R7 — 에셋·예산 정정 [수용]
**v1 §2-7 의 "이미지가 entry 예산에 직결" 은 틀림** — `measure-bundle-budget.mjs` 는 JS/CSS 만 센다. 토큰+picture 프로토타입의 실제 증분은 entry **+277B**·CSS **+1,254B**·app **+342B** 이고 이미지 payload 는 별도(DPR1 진입당 13,150~27,319B).
- 변환 도구는 환경에 **sharp 없음, ImageMagick(AVIF/libheif·WebP) 사용**. 원본 2 PNG 를 `scripts/assets/` 고정 입력으로 두고 SHA·폭·codec·quality·encoder 버전 기록, CI 의 encoder 설치·버전 검증 또는 생성물 검증·재생성 위치를 정본에 고정. 실측 산출(12종): coral 480/960/1440 = WebP 27,602/71,546/131,898 · AVIF 13,150/21,944/32,916; mint = WebP 30,572/79,102/147,218 · AVIF 13,493/27,319/35,641. PSNR 33.2~38.9dB.
- `<picture>` = AVIF → WebP → WebP img fallback, 3폭 srcset, eager/high, `width/height` 1672/941. **`sizes` 는 최종 padding 과 동일 공식**(실험에서 390px slot 320 vs 선언 318 로 2px 어긋남). light↔dark 는 동일 family, family 전환은 React state + picture source 동시 갱신(파일·도구 상태 remount 금지). 장식 img `alt=""`, 기능 설명은 ko/en HTML. **민트 에셋의 한글 장식은 번역 대상 아님**(두 에셋의 바깥 장식·문구가 서로 다르므로 "색만 다른 동일 에셋" 으로 기술 금지).
- 별도 이미지 예산: AVIF 파일당 ≤50KiB·WebP ≤160KiB 출발값, 최종 slot·DPR2·throttle 측정 후 확정. 총 CLS max ≤0.1 로 검증하고 `width/height` 선언만으로 CLS 0 을 주장하지 않는다(실험 36/36 CLS 0·가로 overflow 0, LCP 중앙값 69~357ms 는 로컬 무스로틀 DPR1 값).

### R8·R9 — 시각 기준선·S3 순서·적용 범위 [수용]
- `VISUAL_ONLY` 는 **scenario/route/tool 필터이지 locale·theme·파일 필터가 아니다**. `UPDATE_VISUAL_BASELINES` 는 허용목록이 아니며 **선택 범위 밖 baseline 도 삭제**된다(`removeUnexpectedBaselines` 가 전체 manifest 기준). QA capture dir 는 `tests/visual-artifacts` 자식으로 제한. 갱신 전 **예상 생성·교체·삭제 목록을 저장**하고, 갱신 후 동일 commit/build/browser 로 UPDATE 없이 전수 재실행.
- 4테마 확장은 **기존 sparse profile 에 family 만 2배**하는 기본안 = main 350 / S3 기준 **406장**(홈 full matrix 는 8→16). 전체 상태 4테마는 748/1,072 이므로 "406=모든 상태 4테마" 로 쓰지 않는다. 홈·검색·셸·주요 컨트롤만 4테마 × ko/en × desktop/mobile full coverage 로 보강. **하네스가 `prefers-color-scheme` 만 설정하므로 localStorage/`data-theme` 사전 주입 + 캡처 전 DOM 값 단언 + 이름의 theme 필드 확장 필수**(a11y·rendering 도 같은 fixture 공유).
- 표현 정정: "회귀 탐지력 0" → **"갱신된 픽셀 영역에서 종전 UI 와의 자동 동등성 검증이 불가"**. DOM·기능 단언과 갱신 후 재실행의 탐지력은 남는다.
- **착수 순서 = S3(U4) 가 main 에 통합된 뒤 분기**(사용자 결정 대기 항목 해소). 그 전에는 tmp 조사·에셋 실험만. S3 공통 표면 28파일 + baseline 35장이 겹친다(package.json·CHANGELOG·review-notes·정적/번들 스크립트·App.tsx·seo.ts·PDF 화면·features.json·시각/a11y/rendering 하네스와 대응 unit·vite.config).
- **범위 모순 정리**: v1 의 "격리 문서는 셸 미적용"·"U4 화면 영향 없음" 을 **삭제**. video/office/XLS/PDF finish 도 공통 셸·전역 CSS 를 공유하므로 새 테마가 적용되고 그 영향을 테스트한다. 이 작업에서 제외하는 것은 **도구 기능·경로·엔진 수정과 외부 vendor iframe 자체**. 광고/분석 로더의 경로·document marker 조건은 유지(video 는 analytics 허용·office/XLS 는 제외 — "격리=전부 제거" 로 단순화 금지).

### R10 — 단계 재분해 [수용, v1 §3 단계표 대체]
| 단계 | 내용 | 비고 |
|---|---|---|
| **W0** 기반 | S3 통합 해시 고정, 현행 smoke/bundle/visual 목록 저장 → semantic 토큰·상태색·FOUC·manual theme fixture·4테마 순환. **legacy 직접 배경까지 최소 일관성 교정**(깨진 다크 중간 상태를 완료로 보고 금지) | R1·R2·R3·R4 |
| **W1a** 일반 프리미티브 | Button/Card/Progress/Switch/Toggle/ToggleGroup 을 public path 에서 교체·기존 셸과 대표 도구에서 키보드/ARIA/geometry 검증. library 소스를 읽는 테스트를 제품 행위로 교체. **Base UI 패키지 전체 제거는 아직 강제하지 않음** | R5 |
| **W1b** Drawer | 자체 drawer 를 기존 셸에 넣어 controlled state·포커스·ESC·scroll lock·nested·route·resize 독립 검증(**public Sheet 어댑터 유지**로 레이아웃 변경과 장애 원인 분리) | R5 |
| **W2** 셸 | 검증된 Drawer 로 sidebar/topbar/search/언어 select/모바일 배치·PWA 설치 위치·하단 탭 재구성. 카드에 단일 category 매핑. **격리 문서·PDF finish 도 시각·광고 회귀 대상** | R6·R9·R11 |
| **W3** 홈+에셋 | 히어로 slot·heading markup·카피·CTA·privacy 카드·**ko20/en19 카드**·how-to 를 한 묶음으로. 에셋 변환 script 는 W0 이전 tmp 실험 가능하나 히어로를 두 단계에 중복 구현하지 않는다 | R7·R11 |
| **W4** 도구·의존성 종료 | 도구의 의미 색·단일 primary 정합 완료 후 미사용 Base UI/shadcn/CSS/설정 의존성 제거. repo-wide import scan·license 재생성·최종 budget | R5 |
| **W5** 최종 게이트 | 검토된 baseline 목록 갱신 → UPDATE 없는 전수 → QA 실화면/geometry·대비비·성능·격리 → astra 검수·Claude 판정·**Gemini 육안 검수(규칙 19)** → production 복원·static → 배포 1회 | R8·R12 |

### R11 — 레이아웃·콘텐츠 계약 [수용]
- **사이드바**: 표시 그룹 3개(문서=documents / 미디어=media / 기타=text-data+work+security-share), registry 5 ID·`?category=` 유지. 그룹 안에 **실제 도구 링크 나열**, "기타" 는 존재하지 않는 `category=other` 로 연결하지 않는다. active link/`aria-current` 와 그룹 표시 상태 구분. **시안의 "Excel 도구·PDF 도구·온라인 유틸리티" 처럼 여러 도구를 가리키는 가짜 통합 도구를 새로 만들지 않는다.** 폭 **248px**, 데스크톱/모바일 경계 **820px**, 데스크톱 접힘 = **완전 숨김**(세션 메모리에만 저장, theme storage 와 분리). main `min-width:0`.
- **그리드**: ≥1440 4열 / 1100~1439 3열 / 621~1099 2열 / ≤620 1열(출발 계약). expanded sidebar 에서 긴 영어 제목이 넘치지 않음을 1100·1440 경계 양쪽과 320/390 에서 실측.
- **카드**: ko 20 / en 19 전부·registry 순서(사용자 결정 ④). 태그는 현행 highlights(대부분 4개, video 5개)에서 **`slice(0,3)` 결정 규칙**, 전체 highlights 는 registry/SEO/가이드에 보존. 제목·본문은 DOM 에 전체 문자열 유지하고 시각 줄 제한만. 카드 heading 은 섹션 h2 아래 **h3**, 단일 링크 root, 장식 아이콘·화살표 `aria-hidden`, 내부 버튼·링크 없음. **privacy 카드는 도구 수에 포함하지 않고 noninteractive article**.
- **PrivacyBanner** 는 그리드 마지막 "안전한 로컬 처리" 카드로 편입. **`PrivacyConsentBanner` 는 다른 기능이므로 삭제·동일시 금지**(거부·동의·푸터 재열기·광고 격리 그대로 검증). 실제 storage key 는 **`worklazy_privacy_consent`**.
- **HOW IT WORKS**: 하단에 간결한 3단계 유지(사용자 결정 ⑤). 정적 SEO 본문은 `staticBody(page)` 가 `seo.ts` 로 생성하므로 React DOM 복사가 아니며, 삭제해도 자동으로 함께 사라지지 않는다.
- **히어로 카피**: ko 두 문장 유지하되 **"도구에게" 만 accent span**(현행 span 은 둘째 문장 전체). en 은 문장 순서에 맞는 키/Trans markup. 시안 4장의 kicker·서브카피·상태 문구가 서로 다르고 오타성 문구도 있으므로 **테마가 문구를 바꾸지 않게 ko/en 각 1세트 고정**. ko 제안: kicker "작지만 유용한 업무 도구", 서브 "문서와 데이터부터 이미지·영상까지, 설치도 로그인도 필요 없습니다. 필요한 도구를 고르면 복잡한 작업이 간단해집니다.", 신뢰 "파일 업로드 없음 / 모든 작업은 내 브라우저에서 처리됩니다." 상태 카드는 두 번째 CTA 가 아니므로 button/link role 부여 금지.
- **모바일·PWA**: `AppInstallControl` 은 drawer 하단으로 이동(설치 진입점 상실 금지), bottom-tabs 유지 + main 하단 safe area 예약. image editor sticky top 72px·모바일 bottom 78/80px 상수 재검토.
- **언어 선택기**: 현행은 ToggleGroup 이라 시안 dropdown 과 양립 불가 → **native `select`** 로 교체하고 기존 언어 routing 재사용(경로·검색어·category query 보존, HWP 영어 대체 목적지 명시, 기존 smoke selector 변경 동반). **테마 버튼**은 현재·다음 테마를 포함한 ko/en 이름 갱신·focus 유지·반복 클릭 순서 동작·저장 실패/재로드 복구 테스트.

### R12 — 완료 기준 명령 정정 [수용, v1 §4 대체]
`LANG=ko/en` 은 **locale 반복 문법이 아니고 이 러너에 locale 필터가 없다** → 정확한 profile 로 구성한 suite 를 **1회** 실행. `test:excel-*` wildcard 대신 `test:excel-compare`·`test:excel-cleaner`·`test:xls-preserve`·`test:xls-first-load` 를 각각 나열. `TEST_SCOPE=pdf` 는 단독 명령이 아니라 `TEST_SCOPE=pdf npm run test:browser`. registry 는 `node tests/tool-registry-routes.mjs`, `npm run css:orphans`·`npm run legacy:manifest`.
전체: production `build`·`static`·`tsc -b`·`unit` → 전 스코프 실제 smoke → 4테마 fixture 가 연결된 visual/a11y/rendering → **동일 schema** bundle baseline 비교 → CSS owner/orphan → registry → `git diff --check`. `A11Y_MAX_TOTAL=0` 에 더해 **color-contrast incomplete 를 수동 검토해 판정표에 근거를 붙인다**(부정 대조: 읽을 수 없는 dark-coral 화면이 violations 0 인데 incomplete 195노드였다). 20분 visual 상한·`NODE_OPTIONS=4096`·빌드/브라우저 직렬. baseline update 는 실제 출력·SHA manifest 보존, QA 빌드와 production static 검사를 혼동하지 않는다(QA 는 분석 구성 부재로 static 이 exit 1 — 정상). 모든 script 의 artifact/fixture/report/cache 경로는 작업 전용 디렉터리로 명시.

### 열린 쟁점 처리(v1 §6)
1. HOW IT WORKS·PrivacyBanner → **사용자 결정 ⑤ + R11**(유지 / 카드 편입, 동의 배너는 별개). 2. 3그룹 매핑 → **R11 수용**. 3. 홈 카드 수 → **사용자 결정 ④(전부)**. 4. 기준선 갱신 → **R8**(검토된 갱신 + 전수 재실행, 표현 정정). 5. S3 순서 → **R9(S3 통합 후 착수)**. **→ 열린 쟁점 0.**

### 2차 반박 요청(astra)
(i) v2 문안이 R1~R12 권고를 누락·왜곡 없이 반영했는지 문장 단위 대조. (ii) 단계 W0~W5 각각의 **완료 판정 가능한 게이트**(무엇을 실행해 무엇이 통과해야 그 단계가 끝나는가) 와 단계 간 회귀 위험. (iii) 보정 팔레트로 4테마 × 주요 표면(본문·보조·CTA normal/hover/active/disabled·태그·틴트·focus·diff/preview·toast)의 대비를 **CSS 값 기준**으로 재계산 — 미달 시 보정. (iv) 7종 계약표를 sol 이 그대로 구현할 수 있는 수준인지, 빠진 상태·이벤트. (v) 4테마 visual profile **정확한 집합**(406 기본안의 scenario·locale·viewport·theme 조합 목록)과 하네스 주입 방식 프로토타입. (vi) 검색 combobox 와 native select 언어 전환이 기존 스모크 selector·라우팅에 주는 변경 목록. (vii) sol 재해석 지점 잔여. **잔여 0 이면 [정본화 가능]**(단 착수는 S3 통합 후).

---

# 정본화 (2026-09-07 13:25, Claude — v3. 근거: astra 1·2차 반박 `ui-redesign-rounds/round-{1,2}-REPORT.md`·`round-2-AMENDMENTS.md`·`probes-r2/`)

## 우선순위·읽는 법
**정본화 v3 > v2 반영 > v1 본문** 순으로 우선하며, 충돌 시 v3 가 정본이다. v1 §1 실측표(51/62/203)·§2-7 이미지 예산 문장·§3 단계표·§4 완료 기준·§5 "격리 경로·U4 화면 제외" 는 **폐기**한다. **아래 첨부 문서는 정본의 일부**로 채택한다(요약이 원문을 대체하지 않는다): `probes-r2/GATES.md`(W0~W5 완료 판정) · `probes-r2/PRIMITIVES.md`(7종 계약·Sheet 8항) · `probes-r2/CONTRAST.md`+`palette-proposed.json`+`lab/palette.css`(4테마 토큰·144쌍 대비) · `probes-r2/visual-profiles-406.{csv,json}`+`visual-profiles-additions-proposed.json`(정확한 profile 집합) · `probes-r2/SELECTORS.md`(검색·select 변경표) · `probes-r2/probes/theme-fixture.mjs`(공통 테마 fixture adapter) · `round-2-AMENDMENTS.md` N1~N7 전문.

## 사용자 결정(전건 유지, 이의 0)
① shadcn 전면 제거 ② 적용 범위 셸+홈+도구 화면 전체 ③ 히어로 WebP/AVIF 반응형 ④ 홈 카드 전부(ko 20 / en 19) ⑤ HOW IT WORKS 하단 유지. **알림종 버튼 제외.**

## N1 — 문안 정정 [수용]
- v2 R4 의 "CSP 있는 RHWP vendor entry/print 3문서" 를 **"RHWP vendor 2문서 + 별도 인증 1문서"** 로 교체. bootstrap 삽입 **제외 정본 3경로**: `vendor/rhwp-studio/0.8.6/index.html`(vendor entry·rhwp upstream 소유·CSP 있음) · `vendor/rhwp-studio/0.8.6/print.html`(vendor print·동일) · `naver05161fb06bc9701a23cfc09ad5773578.html`(검색 소유권 인증·Worklazy 운영 소유·CSP 없음). **vendor wildcard 예외로 새 HTML 을 자동 제외하지 않는다.** 나머지 모든 제품 HTML 은 재귀 검사로 bootstrap 1회·module 이전·native scheme·단일 theme-color 확인. main 실측 104는 **착수 시 S3 통합 해시에서 재산출**.
- R4 보강: storage write 실패 시 현재 탭 테마 유지 · init 와 React 순환의 네 값·기본값 명세 일치 · slow/fail module·JS-off·404/격리 복구 테스트. `#startup-help` 는 **CSS 비의존 고정 fallback 색**.
- R5/R12 보강: `tests/unit/ui-legacy-isolation.test.ts` 의 `rules>=541`·OS-media·source-count oracle 을 **global/theme 합산 CSS owner·충돌·scope 검증으로 교체**(숫자 하향이 아니다). `p1b-components` 의 node_modules 파일 읽기와 6색 강제 단언을 **단일 primary 제품 행위**로 교체. 원래 155 legacy rule 의 historical manifest 를 현행 CSS 최소 개수와 혼동하지 않는다.
- "`data-slot`/ARIA 전부 보존" 은 **공용 프리미티브·도구 테스트 표면 기준**이다. native language select·home trust article 처럼 승인된 구조 변경은 `SELECTORS.md` 의 대체 계약을 따르고, 옛 group role·hero feedback anchor 를 테스트용으로 숨겨 유지하지 않는다.

## N2 — 단계 소유권·게이트 [수용]
`GATES.md` 를 **완료 판정 표로 정본 편입**. §6-B 의 "이 계획 W5(도구 화면)에 포함" 은 **"W4 구현 · W5 최종 검증"** 으로 정정하고 **U1~U6 를 각각 체크리스트 항목으로 등록**(일괄 생략 금지). U2 rail `sticky top:80px` 은 **desktop header 64 + gap 16** 으로 표현. **U1 의 529px 은 이전 셸 기준이므로 새 248px 사이드바·padding 차감 후 재측정**. 문서 최소폭 940·rail 156/52·gap 12/8·320 EN 수리·상태 유지·결과 ARIA·합성 DOCX helper·axe/rendering 등록은 필수 유지. 엔진 잡 산출물·사용자 입력 문서 원본은 수정하지 않는다.
- **착수 조건**: S3(U4) 가 main 에 통합된 뒤 **새 해시의 단일 정본을 받은 다음**. 통합 직전 열린 P2/shadcn 계획의 과거 source-count·palette·baseline 지시를 **이 계획이 대체한다는 표면별 소유권을 정본에 명시**. 문서 비교 엔진은 별도 잡 소유, U1~U6 화면은 이 작업 소유.

## N3 — 4테마 토큰·대비 [수용]
`palette-proposed.json`·`lab/palette.css` 의 4테마 상태 값을 **정본 토큰 표로 채택**(계산 근거 `contrast-calculated.json`, computed 대조 `browser.json`).
- 의미 별칭: `--wl-sidebar-bg`·`--wl-card-bg` = surface, `--wl-hero-bg` = hero. brand accent 와 UI primary 는 **별도 토큰**(이번 값은 동일). 호환 `--accent` = soft(브랜드 primary 아님), `--ring` = focus, `--destructive` = errorText.
- 토큰 분리 목록: bg/surface/surface-muted/hero · text/secondary · primary/onPrimary · hover/active · disabledBg/disabledText · soft/onSoft · controlBorder · focus · success/error/warning/info · documents/media/other tint · **문서 preview paper/text·insert/delete·checkerboard 두 칸**.
- CTA normal/hover/active/disabled 글자는 **불투명 값**. 비활성 컨트롤도 이 계획의 제품 하한은 **4.5**. `opacity:.5` 로 부모 전체를 흐리게 하지 않는다.
- **`ring-primary/30`·`ring-ring/30` 단독 focus 표시 금지** → **3px solid focus outline + 2px 배경 간격**, 인접 배경 대비 3 이상. shadow/glow 는 장식이며 경계를 대체하지 않는다. focus outline 을 자르는 부모 overflow 도 실측.
- 본문·보조·placeholder·CTA·tag·tint·toast·diff 모두 **4.5**, 실제 large CSS 확인된 경우만 3.
- **문서/PDF 종이 preview 는 테마 독립** — `previewText=#101827` 과 쌍으로 scope 지정해 다크 테마의 흰 본문색이 흰 종이에 상속되지 않게 한다. 앱 결과 diff 는 테마별 success/error 토큰, **흰 종이 내부 diff 는 별도 previewInsert/Delete 토큰**. 둘 다 추가/삭제를 텍스트·ARIA·기호로도 식별.
- raster/canvas 의 문서·이미지 원본 색에는 필터 미적용(도구 처리 의미). preview 바깥 toolbar/host 는 테마 소유. checkerboard 위 안내 글자는 두 색 모두 검사.
- 임의 opacity/gradient/직접 색 override 가 생기면 계산표 통과를 제품 통과로 재사용하지 않는다. **실제 DOM 합성 최저값이 최종 게이트.**

## N4 — 프리미티브 계약 [수용]
`PRIMITIVES.md` 의 공통 규칙·7종 표·**Sheet 8항**을 W1a/W1b 계약으로 채택(v2 키워드 목록을 대체). native dialog 는 배경 inert·top layer 를 제공하지만 **명시적 양방향 Tab wrap · controlled state 동기화 · nested stack · scroll lock 복원**이 필요하다. React/DOM/ref/event merge 동작을 소비자마다 다르게 구현하지 않는다. **CVA 유지.** Base UI/shadcn 제거는 **W4** 에서 repo-wide 실행 import·CSS·설정/package/lock·license 입력 검사로 종료하며, 문서·CHANGELOG·fixture 의 과거 명칭까지 지우는 문자열 0건 검사는 아니다(예외는 exact file/purpose/owner 기재).

## N5 — profile 집합·공통 fixture·20분 [수용]
- 관측 `c8bff1f` 의 85 scenario / 203 PNG 에 family 만 2배한 **406개 전체 조합**을 `visual-profiles-406.{csv,json}` 로 정본 첨부(light-coral 88 / dark-coral 115 / light-mint 88 / dark-mint 115, home 16). **"모든 상태 full 4테마" 표현 금지.**
- 신규 검색·drawer/collapsed 상태와 이관 문서결과 6 profile 은 별도 **70 app 항목**(`visual-profiles-additions-proposed.json`) → **잠정 전체 476**. **7종 public primitive fixture 16 은 별도 행동 suite.** 신규 등록은 scenario ID·정확한 locale/viewport/theme 목록대로.
- `visual-regression.config.mjs` 에 **`desktop-1920` = 1920×1080 추가**, `mobile-320` 은 기존 320×844 유지, 기존 scenario 의 원 fixture/state 보존. 문서 결과 새 상태는 §6-B 장문·다중 변경 입력으로만 진입(직접 result URL goto 금지).
- **공통 테마 fixture** `tests/ui-theme-fixture.mjs` 는 `probes/theme-fixture.mjs` 의 adapter API 채택 — 같은 serialized seed 를 Puppeteer `evaluateOnNewDocument`·Playwright `addInitScript` 에 쓰고 **캡처 직전 실제 `html` dataset/theme/colorScheme/lang/localStorage 단언**. vendor iframe 에 root 강제 주입 금지. **seed 는 저장값만** 넣고 제품 bootstrap 이 root 를 설정하게 한다(HTML 값까지 덮으면 bootstrap 미실행을 가린다). a11y/rendering 의 init·baseId·exception·placeholder 집계 확장은 `GATES.md` 대로. 저장 실패 복구는 seed 없는 별도 context.
- **기존 하네스에 `VISUAL_SHARD` 옵션이 없다** → 새 exact shard 계약을 구현해 476개를 **238/238 로 직렬 실행**하고 각 **20분을 timeout 으로 강제**. full manifest 합집합과 UPDATE 없는 전수 검증으로 전 조합 통과 입증. **"406/476 전체 1회가 20분" 문구 제거.** 도중 timeout 을 suite 축소로 덮지 않는다.

## N6 — 검색·언어 select·기존 테스트 [수용]
`SELECTORS.md` 의 파일·selector 변경표와 상태 소유권을 편입. 핵심: **HWP trailing slash 정규화 · search/hash 보존 · ToolsPage 필터와 topbar matcher 공유**(기존 eyebrow/category 검색 보존) · 검색의 초성/IME/pointer/visual-viewport 계약. native select 도 combobox 의 일종이므로 **전역 검색 테스트는 `global-tool-search` ID 또는 accessible name 으로 scope**. 언어 변경의 source-string 테스트는 **실제 선택·경로·storage·`document.lang` 테스트로 교체**. 기존 ToolCard·도구 button selector 는 유지.

## N7 — 레이아웃·카피·에셋 확정 [수용]
- **desktop ≥821**: sidebar expanded **248px** / hidden 0, topbar **64px**, content 좌우 padding 24px. **mobile ≤820**: sidebar 는 left drawer(폭 `min(360px, 100vw−20px)`, 상하 10px 여백, 자체 스크롤), topbar 는 **두 행**(8 + 40 controls + 8 gap + 40 search + 8 = **104px**), 좌우 16px. 첫 행 menu40/logo32/select64/theme40/GitHub40 + gap 4×8 = 248px 이라 320px 에서 40px 여유. 알림종 없음, **검색 항상 노출**.
- `--wl-header-height` = 64px 또는 104px + safe-area-inset-top, `--wl-bottom-nav-height` = 72px + safe-area-inset-bottom. main 은 실제 fixed header·bottom nav 만큼 공간 예약. **문서 rail sticky = header + 16px**, image editor sticky = header + 8px, HWP focus shell 은 topbar/side 를 뺀 공간. 예외 확대 대신 새 geometry 를 계측.
- 홈 그리드 breakpoint 는 v2 유지(≥1440 4열 / 1100~1439 3열 / 621~1099 2열 / ≤620 1열). **문서 결과 본문 폭은 새 셸에서 재실측**(legacy padding 불변 약속 금지). 카드 `min-width:0`·영문 clamp·DOM 전문 유지·하단 탭 여유 보존.
- topbar/drawer 의 route·role label·키보드 안내는 ko/en. **히어로는 테마별 문구 변경 0.** ko 는 v2 제안 그대로. **en**: kicker "Small tools for everyday work" / subtitle "From documents and data to images and video, no installation or sign-in is needed. Choose a tool to make complex tasks simpler." / trust "No file uploads / Everything is processed in your browser." 기존 en headline 의미·순서 유지하고 강조 구간은 전용 i18n markup 으로 분리. footer 법적 링크·동의 재열기·문의 destination 유지.
- **에셋: 생성물 커밋 + CI SHA 검증** 채택. source `scripts/assets/hero-coral.png`·`hero-mint.png`, generated `public/assets/hero/{coral,mint}-{480,960,1440}.{avif,webp}`, 생성기만 출력 수정. encoder signature = **ImageMagick 6.9.12-98 Q16 x86_64 (18038)**, WebP quality 82 / AVIF 50 · strip · width · `MAGICK_THREAD_LIMIT=1`. encoder/delegate signature 와 원본·12개 SHA·dimensions·명령을 manifest 에 고정. 로컬 재생성은 명시 generate 모드에서만, 고정 encoder 검사 실패 시 출력 교체 0. **CI verify 는 원본 hash·산출 hash·개수·byte budget 검사**라 새 encoder 설치에 의존하지 않는다. 브라우저 decode 로 codec·intrinsic 치수 검증. W3 완료 조건 = AVIF ≤50KiB · WebP ≤160KiB **그리고** 실제 slot/DPR2/throttle 측정(임의 상향 금지).
- `sizes` 는 위 레이아웃과 **같은 CSS 변수/계산**을 써 실제 slot 차 ≤1px. light/dark 는 같은 family source, family 전환 시 `<picture>` source + img srcset 동시 갱신·앱 상태 remount 금지. 장식 img `alt=""`, 민트 한글 장식은 원본 장식으로 명시. **히어로 glow 가 텍스트 뒤로 번져 대비를 바꾸지 않도록 이미지 영역에 제한.**

## 제품 규칙
규칙 4: 로컬 검색·ko/en·정적 SEO/FAQ/sitemap/canonical/hreflang·동의 재열기·AdSense 격리·추적 host 조건을 source/static/browser 로 검증. **video analytics 허용 / office·XLS 제외** 유지. 검색 popup·CTA·광고 겹침을 geometry 로 검사. 백엔드·SSR 의존 0. 규칙 5: 테마·storage·에셋 오류의 원시 예외·Worker/runtime·광고 상태를 UI 에 노출하지 않는다(진단은 테스트 artifact 로만). CLIENT SIDE 는 브랜드 보조 문구. 규칙 19: **Codx 캡처는 Gemini 최종 육안 검수를 대체하지 않는다** — 글자 잘림·세로 낙하·control/thumb 정렬·하단 안전영역까지 Gemini 육안 + Codx 수치 교차 후 최종 production/static·배포 1회.

## 착수 조건
① S3(U4) main 통합 → ② 새 해시로 이 정본의 실측·profile·bundle baseline 재산출 → ③ astra 3차 확인에서 **이견 0** → ④ W0 부터 sol 디스패치(각 단계 후 astra 검수).

## 정본화 선언
**2026-09-07 13:47 — Claude–Codex 간 이견 0 · [정본화 가능]**(astra 3차 확인 `task-mtqqg5q3-utwrjv`: 129문장 대조 미반영 0, 첨부 사본 42개 SHA 일치, 잔여 재해석 지점 0). 보고서 `docs/jobs/todo/ui-redesign-rounds/round-3-REPORT.md`.
**착수는 아직 불가** — 위 「착수 조건」 ①~④ 순서대로: S3(U4) main 통합 → 새 해시로 실측·406/476 profile·bundle baseline 재산출 → 갱신 정본의 이견 0 재확인 → W0 부터 sol 디스패치.
