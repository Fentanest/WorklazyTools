# 작업지시서 — shadcn/ui 기반 UI 마이그레이션 (2026-09-03)

**상태: 정본 (2026-09-03 정본화 — 5차 왕복에서 Codex "이견 0" 명시 선언 + 기준 재측정 실기입. "v2 확정 사항"(3~5차 정정 포함)·P-QA 절이 우선 계약.)**
기준(정본화 시점 재측정 — Claude 실측): **기준 해시 `dac13bb55e4d727c02b604d7a326d35d3edd838d`**(`git rev-parse HEAD`=`origin/main`) · global.css **2,648줄·245,070B** · 정식 `npm run build` 기준선: **app CSS 215,660B/37,148B gz · entry JS 793,774B/245,738B gz**(전체 CSS 단일 파일 동일 — vendor 제외 앱 산출 기준, 이후 예산 비교는 동일 측정 방식). 1차 실측치(da8aa18)는 부속 보존.
근거: 사용자 지시(2026-09-03) — shadcn Create preset `b1aK6UEDo`(Full preset+npm) 기반 전면 개편, "셋이서 충분히 재현검증".

## v2 확정 사항 (1차 왕복 11건 — 우선 계약)

1. **기준 재측정**: 정본화 직전 HEAD·global.css 줄 수·번들 기준선 재측정 실기입(1차 실측치는 부속 보존).
2. **CLI 확정은 P0 첫 체크포인트**: 읽기 전용 샌드박스는 npm 네트워크 차단(ENOTFOUND 실측)이라 사전 확정 불가 — **P0 구현 태스크(네트워크 가능)가 최초 작업으로 `shadcn init --help`·preset 적용을 실행해 정확한 CLI 버전 고정·유효 플래그·preset 해석 결과·생성 파일·dependency diff를 지시서 실행 기록에 기록**한 뒤 진행. "지원 시/아니면" 조건문 금지 — 실측 후 명령 확정. preset ID TTL 미확인이므로 P0을 대기열 도달 즉시 실행.
3. **P0 2분할**: **P0a = preflight 미적용 기반 설치**(Tailwind theme/utilities만 — 시각 회귀 0이 현실적인 유일한 구성. 실측: 현행 CSS는 `@layer` 0개·전역 reset 27줄뿐, `.page-header h1` 등 heading weight·리스트 marker가 브라우저 기본값 의존이라 전역 preflight 즉시 회귀) + cascade layer 소유권 계약 **(3차 정정)**: `theme < base < legacy < components < utilities`(Tailwind v4의 theme layer 포함 — P0a 실측에서 theme이 cascade layer가 아니면 그 사실을 기록하고 순서표에서 제외). 현행 global.css는 `legacy` layer로 이동. **P0b = reset 활성화**(P0a 기준선·generated preflight 원문 확보 후 별도 배포 단위 — scoped/전역 여부는 P0a 실측으로 확정).
4. **시각 회귀 하네스 선행(P-V, 프레임워크 변경 전 최우선)**: `test:visual` 신설 — 고정 route/state 목록·ko/en·light/dark·desktop/mobile viewport·애니메이션 비활성·diff 임계값·허용 영역 정의. **"시각 회귀 0" = 임계값 이내(0 pixel 아님)** 정의. **before 기준선은 P0a 이전에 채집·커밋**. 기존 하네스에는 screenshot diff 없음(실측 — `page.screenshot()`은 아이콘/소셜 생성 스크립트뿐).
5. **P1 = API·DOM·행동 호환 adapter**(시그니처만이 아님): **(3차 정정) 8종 전부 계약 열거** — ① `PageHeader`(eyebrow/title/description/children — header 구조·제목 계층 유지) ② `SectionCard`(`<section>` 시맨틱·custom className 11회·step) ③ `SegmentedControl`(`role="group"`/`aria-pressed`) ④ `ToggleRow`(`role="switch"`/`aria-checked`/disabled) ⑤ `FileDropZone`(파일 누적·async onFiles·완료 후 input reset·키보드/drag·accent) ⑥ `FileList`(files/onRemove/accent — 목록 시맨틱) ⑦ `PrimaryButton`(loading spinner·disabled·accent) ⑧ `ResultCard`(title/message/accent/children·`<section>`·**`aria-live="polite"`**). `PageHeader`·`FileDropZone`·`FileList`는 **custom composite 유지**(primitive는 내부 부품만). NavigationRow(0회)는 제거 검토. 호출 수치(측정 시점 216~217)는 정본화 직전 재측정 원칙 적용. 접근성 검증은 P1에 포함.
6. **6색 accent·다크 모드 계약**: `ToolAccent` 6종(green/blue/violet/orange/pink/sky — 공개 타입 `toolRegistry.ts:37`, PrimaryButton 27회 전부 accent 사용 실측)을 adapter variant로 **보존**(단일 primary 흡수 금지). 다크 모드는 **현행 `prefers-color-scheme` 유지**(.dark class 전환 안 함 — 저장소에 클래스 토글 부재 실측), shadcn 변수를 media query 내에서 기존 변수에 브리지.
7. **P1 3분할(독립 배포)**: **P1a** ui.tsx 8종 adapter / **P1b** ToolGuide(21파일)·OperationProgress(13파일)·ToolCard·LanguageSwitcher / **P1c** AppShell 단독(275줄 — SEO·분석·광고 격리 렌더·모바일 focus trap·격리 경로 redirect 소유 — 광고 격리 회귀 검증 필수).
8. **add 목록 단계화**: P1a = button·card·switch(+`SegmentedControl` 대응은 CLI 실측 후 tabs/toggle-group 중 선택). progress→P1b, sheet→P1c. input·select·table·dialog·dropdown-menu·tooltip·checkbox·badge·accordion·command·popover는 **실소비자가 생기는 P2 단계로 지연**(**(3차 정정) 사용자 제시 목록의 일괄 생성 금지** — 열거 합계는 tabs/toggle-group 택1 기준 17종, 미사용 생성물의 Tailwind scan 오염 방지).
9. **번들 기준선·예산**(1차 실측 — da8aa18 고정 사본, tsc+vite 직접 빌드): app CSS 211,435B/36,446B gz · entry JS 763,413B/237,396B gz · 전체 CSS 301,529B/51,902B gz · 전체 JS 14,876,937B/4,664,930B gz. **(3차 정정) 단계별 예산 완결 — 비교 기준은 전 단계 공통 "직전 배포 단계 대비"**(초과 시 원인 기록 없이는 push 금지·왕복 조정 가능): P0a 전체 CSS gzip +20KB·entry JS gzip +10KB / **P0b 전체 CSS gzip +10KB·entry JS +0KB(리셋은 CSS만)** / P1 각 단계 entry JS gzip +50KB·**전체 CSS gzip +10KB** / **P2 도구당 entry JS gzip +20KB·전체 CSS gzip +10KB**(신규 컴포넌트 add 동반 시 초과 사유 명시 기록으로 면제 가능) / **P-final만 예외적으로 정본 HEAD 기준 총량 평가**: 전체 CSS gzip ≤ 현행 대비 +30%. 측정은 고정 명령·환경(정식 `npm run build` — vendor 네트워크 필요)으로 동일 조건 재측정.
10. **로드맵 접합(사용자 결정 확정 — 2026-09-03)**: **U2 완료(이행됨) → P-V·P0a·P0b·P1a~c → U3부터 신규 도구는 shadcn 기반으로 구현, 기존 도구 전면 마이그레이션(P2)은 U 단위 사이 인터리브, P-final로 전면 전환 완성.** 사용자 원문 취지: "U3~U9까지 싹 다 + 현존 사이트 UI 전부 shadcn 기반으로". 신규 도구 로드맵 정본에 선행 의존 반영(동시 갱신 — 이행됨).
11. **종료 단계 P-final**: legacy selector 제거(현행 컴포넌트 규칙 2,049개·7,515 declarations 제거 계약)·잔존 adapter 목록·CSS token 단일화·orphan selector 검사·번들 최종 비교. 검증 명령은 "등" 없이 전체 명시: `build`·`test:unit`·`test:browser`·`test:office`·`test:xls-preserve`·`test:xls-first-load`·`test:excel-compare`·**`test:excel-cleaner`(4차 정정 — U2 추가분)**·`test:new-tools`·`test:video-hybrid`·`test:utilities`·`test:static` + 신설 `test:visual`.

## 배포 방식 정정 (2026-09-04 사용자 지시 — 기존 "단계별 main 배포" 폐지)

- **경위**: P-V~P1c를 단계별로 main에 배포한 결과, 시각 기준선 밖 도구(문서 비교)에서 라이브 파손 발생(스위치 얼룩·텍스트 세로 낙하 — 실측). 사용자 지시로 **라이브 UI 원상 복구**(U1·U2 도구는 유지, UI 커밋 6개 revert).
- **새 계약**: ① 이후 모든 UI 작업은 **전용 브랜치**에서 수행(main push 금지 — Pages 배포 차단) ② **시각 기준선을 전 도구 화면으로 확장**(3화면 표본의 커버리지 실패가 사고 원인) ③ 브랜치 상태를 로컬 프리뷰(QA 플래그 — 애널리틱스 차단)로 띄워 **메뉴별 3자 전수 검수·수정 루프(P-QA 절차)를 병합 전 게이트로 적용** ④ main 병합·배포는 검수 통과 후 일괄. 단계(P0~P-final) 구조와 검증·예산 계약은 브랜치 내에서 동일 적용. **⑤ (2026-09-04 사용자 지시 — `PROJECT_RULES.md` 「배포 전 로컬 시각 검수」 신설로 정본화)**: 검수는 Gemini가 브라우저로 페이지를 직접 보며 수행, "깨짐"의 정의에 글자 쏠림·세로 낙하·**토글 썸의 트랙 이탈/상하 오정렬** 같은 컴포넌트 내부 오정렬 포함. **⑥ adapter 전환 시 legacy 클래스명 잔존 금지**(라이브 사고 원인 — `.ios-switch`×Switch 유틸리티·`.tool-action-bar` 190px×`w-full` 충돌 실측): 컴포넌트를 전환하면 해당 legacy 클래스를 같은 커밋에서 분리·제거한다.

## 단계 요약 (각 단계 = 독립 배포 단위 → **브랜치 내 작업 단위로 정정**)

**P-V** 시각 하네스+기준선 → **P0a** shadcn init+preset(preflight 미적용·layer 계약·CLI 실측 기록) → **P0b** reset 활성화 → **P1a** ui.tsx adapter 8종 → **P1b** 공용 컴포넌트군 → **P1c** AppShell → **P2~** 도구별 정리(add는 소비자 등장 시) → **P-final** legacy 제거·토큰 단일화 → **P-QA** 3자 병렬 전수 상호작용 검수(아래 절 — 사용자 지시 2026-09-03).

## P-QA. 3자 병렬 전수 상호작용 검수 (P-final 후 종결 단계 — 사용자 지시)

- **환경(5차 확정)**: 로컬 프리뷰 서버 기동. **전용 opt-in QA 빌드 플래그 신설**로 애널리틱스·AdSense 로더 차단 — 실측 근거: 현행 로더는 `!import.meta.env.PROD`만 차단이라 `vite preview`(프로덕션 번들)에서는 동의 granted 시 GA·네이버·AdSense 스크립트가 실제 로드됨(`AnalyticsLoader.tsx:42`·`AdSenseLoader.tsx:14` esbuild 마운트 실측). **hostname 기반 자동 차단 금지**(현행 스모크 3종이 로컬 프로덕션 빌드에서 로더 존재를 명시 요구 — `utility-tools-smoke.mjs:25` 등 회귀 파손). 완료 기준: **QA 플래그 빌드에서 동의 상태 무관 로더 DOM 0·비로컬 네트워크 요청 0**(네트워크 로그 기록) + **일반 프로덕션 빌드의 동의 기반 동작 불변 검증**.
- **3자 병렬 검수(각자 접속·독립 수행)**:
  - **(2026-09-04 추가) 상태 커버리지 필수 3종**: 각 도구마다 ① 첫 화면 ② **스크롤 최하단**(모바일 하단 네비게이션에 마지막 콘텐츠가 가리지 않는지 — 상단 뷰만으로는 판정 불가, Claude 표본에서 비디오 스튜디오 경고 문구가 nav에 겹쳐 보임) ③ **상호작용 상태**(토글 ON/OFF·선택 활성 — 라이브 사고가 토글 ON에서 드러났음)를 반드시 채집·검수한다.
  - **(5차 확정) QA 매트릭스 선행 산출물**: 검수 실행 전에 **전 도구 × 직접 진입 route × 모드 × fixture × 행동 × 기대 결과 × ko/en 적용 여부**를 열거한 매트릭스를 확정(도구마다 기능 상이 — 일률 열거 불가: 계산기류는 업로드 없음, HWP 편집기 영어 경로는 의도적 redirect(`App.tsx:122`) 등 **N/A 항목은 사유 명기**). "전 항목 통과"는 이 매트릭스 기준으로 판정·재현.
  - **Codex**: 브라우저 자동화(CDP/puppeteer)로 **매트릭스 전 항목 상호작용 순회** — 업로드·옵션 변경·실행·취소·재실행·다운로드·탭/모드 전환·언어 전환(해당 도구에 존재하는 행동만). 콘솔 오류·레이아웃 파손·기능 실패를 도구별 목록으로 보고.
  - **Gemini**: 페이지·상태별 스크린샷 세트(ko/en × light/dark × desktop/mobile)를 **시각·UX 검토** — 깨짐뿐 아니라 "어색한 곳"(정렬·간격·대비·문구 잘림·비일관 스타일) 판정 보고(「Gemini 산출물은 단서다」 — 지적은 Claude/Codex 실측 확인 후 반영).
  - **Claude**: 자체 브라우저 순회로 표본 교차 확인 + 양측 보고 취합·중복 제거·판정(증거 기준) → 수정 지시서 작성.
- **수정 루프**: 판정된 결함·어색함 → Codex 수정 → 시각 하네스·해당 스모크 재실행 → **3자 재검수**(수정 영향 범위) — **잔여 결함 0 도달까지 반복**(어색함 항목은 판정에서 수용/기각 사유 기록, 기각분은 review-notes에). **(5차 확정) 종결 게이트**: P-QA에서 코드가 한 줄이라도 변경됐으면 종결 직전 **P-final 전체 검증 명령·번들 예산·orphan selector 검사를 재통과**해야 트랙 종결.
- **완료 기준**: 전 도구 상호작용 체크리스트 전 항목 통과 기록 · 콘솔 오류 0 · 시각 하네스 통과 · 3자 보고서와 수정 내역이 review-notes에 정리. 이 단계 통과 후에만 마이그레이션 트랙 종결.

## 제품 규칙 게이트 (전 단계)

ko/en 문구 불변 · SEO 정적 페이지·소셜 이미지 영향 검토 · AdSense: 광고 배치 CLS·격리 경로 무영향(P1c 필수 검증)·번들 예산(확정 9항) · 내부 명칭 비노출 · 원본 불변·모바일·드래그 버튼 대안 유지 · shadcn 생성 컴포넌트 소스는 커밋 대상(벤더 런타임 아님 — 커밋 후 수정 가능).

## 브랜치 QA 1회차 판정 (2026-09-04, Claude — Gemini 82장 전수 검수 + Claude 실측 교차)

**해소 확인(양측 일치)**: 라이브 사고 증상 2종 — 토글 썸 트랙 이탈(썸 21px·트랙 43px·left 20px·우측 여백 2px·수직 오차 0px)·문서 비교 글자 세로 낙하(`horizontal-tb`·폭 316px) 모두 부재.

**Gemini 차단 결함 주장 2건 판정:**
1. **"모바일 40장 전체 하단 네비 가림" → 미확정(판정 보류·실측 필요)**: 해당 스크린샷은 전부 **390×844 뷰포트 첫 화면**(Claude 실측 — PNG 헤더 치수)이라 콘텐츠가 화면 하단에서 nav 아래로 지나가는 것은 스크롤 가능한 페이지의 정상 렌더다. **판정 가능한 증거는 "스크롤 최하단에서 마지막 콘텐츠가 가리는가"** — P1-polish 실측(콘텐츠 padding 80px ≥ nav 62px·footer 하단 763.64px < nav 상단 773px)은 반증 근거이나 excel-compare 1개 화면 기준. **전 도구 모바일 스크롤 최하단 실측을 다음 검증 태스크에 편입**(상태 커버리지 필수 3종의 ②항).
2. **"hwp-editor 영문 진입 시 도구 목록 표시" → 오탐 확정(수정 불요)**: `App.tsx`의 `KoreanOnlyRoute`가 영어 언어에서 `/tools`로 보내는 **의도된 설계**(HWP 편집기는 한국어 전용). Codex 선행 분석의 "의도적 redirect" 기록과도 일치.

**개선 권고 수용 → P2 처리**: PDF 도구 모바일 탭의 가로 스크롤 단서(페이드 등) 부재 · excel-compare 다크 모드 선택 카드 초록 테두리 대비 과다.

## P1a 시각 검토 판정 (2026-09-03, Claude — Gemini 12장 전수 검토 + Claude 표본 실측 교차)

**수용 — P1-polish(P1b 직후 소형 배포)로 반영:**
1. 모바일 드롭존 확장자 문구 줄바꿈 깨짐(Claude 실측 확인 — "SpreadsheetML"/".xls·CSV" 어색 분리) — 줄바꿈 방어.
2. 드롭존 점선 테두리 radius가 카드 radius와 불일치(데스크톱 실측 확인) — large radius 정합.
3. **모바일 하단 네비게이션이 페이지 하단 버튼을 가림**(Claude 추가 발견 — "파일 쌍 추가" 버튼이 bottom nav 뒤로 잘림) — 콘텐츠 하단 패딩 ≥ nav 높이 확보.

**수용 — P2 정리 목록(도구별 정리 시 토큰 수준 조정):** 카드 선택 상태 배경 틴트 보강 · 사이드바 활성 항목 대비 상향 · Swap/Add 버튼 체급(패딩·affordance) 조정 · 라이트 테마 accent 채도 톤다운 검토.

**기각:** 없음(전 지적이 실측과 부합 또는 P2 검토 타당). 상세 원문: 스크래치 `agy-p1a.md`, 요지는 review-notes에 P1-polish 구현 시 함께 기록.

## 부속 — Gemini 조사 (2026-09-03, 「Gemini 산출물은 단서다」 — P0a CLI 실측으로 교차 확정)

- S1: `init --template vite`·`init --preset` 실재(공식 문서). `--base`=primitive 선택(base=Base UI/radix/aria — 커뮤니티 출처, **P0a 실측 필수**·preset의 primitive 전제와 정합 확인). preset=테마 토큰 JSON(컴포넌트 코드 아님).
- S2: preset은 CLI 1회 fetch→로컬 내재화, **런타임 외부 요청 없음**(정적 스택 무영향). TTL 미확인 — 조기 실행.
- S3: Tailwind v4(CSS-first)·React 19 완전 호환.
- S4: preflight 모듈 제외 임포트 가능(v4)·`@layer` 격리 — **preflight 없는 shadcn 컴포넌트 스타일 온전성은 P0a 실측**.
- S5: 다크 모드 변수 브리지(확정 6항 반영).

## 검증

확정 4항 시각 하네스 + 확정 11항 전체 명령 + 단계별 번들 예산(확정 9항) + Gemini 시각 검토 보고(도구별 판정 기록 — "셋이서 재현검증") + 기록 이원 체계.

## 반박 기록

### Codex 1차 (2026-09-03, 완료 — 11건 전원 수용 → v2 확정 사항. 실측 기여: PostCSS AST 분류(컴포넌트 규칙 92.4%·전역 reset 27줄·@layer 0), ui.tsx 217호출 AST(NavigationRow 0회·6색 전사용), preflight 충돌 후보(heading weight·list marker), 번들 기준선 5종, CLI 네트워크 차단 확인, AppShell 소유권. 판정 "재왕복 필요")
### Codex 2차 (2026-09-03, 완료 — 9건 반영·⑤⑨ 부분반영·신규 2건(theme layer 소유권·add 수치 17종). ⑩은 의도적 미해소(사용자 결정 대기) 확인. 실측 기여: ResultCard aria-live 계약·현 HEAD 호출 216·CSS 2,611줄 변동 → v3 정정)
### Codex 3차 (2026-09-03, 완료 — 정정 5건 전건 OK(확정 10항 사용자 결정 반영·로드맵 정합 포함), 신규 2건(P-final 검증 목록 `test:excel-cleaner` 누락·기록의 낡은 조건부 표현) → v4 정정. ⑩ 조건부 표현은 사용자 결정 확정으로 해소됨)
### Codex 4차 (2026-09-03, 완료 — 정정 2건 OK(P-final 11개 test 전수 대조), P-QA 공백 3건(vite preview에서 로더 활성 실측 → QA 빌드 플래그 필요·hostname 차단 금지 / 매트릭스 산출물 부재 / 수정 후 최종 게이트 약화) → v5 정정)
### Codex 5차 (2026-09-03, 완료 — 4차 잔여 3건 해소 확인·신규 모순 없음, **"Claude–Codex 간 이견 0" 명시 선언·[정본화 가능]** → 정본 확정. 즉시 착수: P-V → P0a).

## 실행 기록

### 실행 게이트 (Codx, 2026-09-03)

- 기준 해시 대조: `git rev-parse HEAD` = `git rev-parse origin/main` = `dac13bb55e4d727c02b604d7a326d35d3edd838d` — 통과.
- 열린 계획서 충돌 검사: `docs/jobs/todo/*.md`에서 shadcn·Tailwind·`global.css`·`test:visual`·패키지 구성 표면을 재귀 검색했다. 다른 문서에 P-V/P0a와 상반된 지시는 없고, `new-tools-roadmap-20260903.md`의 U3 선행 의존은 본 정본의 P-V→P0→P1 순서와 일치한다.
- 착수 전 워킹트리의 미추적 `2026_0820_074240_000094F.MP4`·`2026_0820_074240_000095T.MP4`·`2026_0820_074240_000096R.MP4`·`after.docx`·`before.docx`는 사용자 자산으로 보존하며 스테이징에서 제외한다. `dummyfortest/`·`.codex/`도 명시 제외한다.

### P-V 완료 (Codx, 2026-09-03, 커밋 `10a4b72`)

- 하네스: `npm run test:visual` → `tests/visual-regression.mjs`가 로컬 Vite와 Chrome을 자체 기동한다. route/state는 홈 기본·도구 `category=media`·Excel 비교 빈 상태 3개, 축은 ko/en·light/dark·desktop 1365×900/mobile 390×844(DPR 1)로 고정했다. 애니메이션/전환/smooth scroll/caret 비활성, 외부 요청·서비스워커 차단, consent denied, 폰트 준비+2 RAF를 적용한다.
- 회귀 0: per-pixel threshold 0.1·antialiasing 제외 상태에서 전체 diff pixel ratio ≤0.100%. 크기 불일치와 기준선 누락/잉여는 즉시 실패한다. 허용 영역은 연도 의존 `.global-footer > span:first-child` 한 곳이다.
- before 기준선: Chrome 152.0.7977.64로 viewport PNG 24장(4,979,977B, `tests/visual-baselines/`) 채집. 갱신은 `UPDATE_VISUAL_BASELINES=1 npm run test:visual`로 재현하며, 일반 실행 2회 모두 24/24 일치했다.
- 의존성: exact dev dependency `pixelmatch@7.1.0`·`pngjs@7.0.0`. 기본 npm cache는 `EROFS`였고 `npm_config_cache=/tmp/worklazytools-npm-cache` 지정 설치는 성공했다. 생성된 라이선스 목록도 빌드 생성기로 갱신했다.
- 검증: `npm run build` exit 0(2,429 modules·정적 59페이지), `npm run test:unit` 158/158, `npm run test:static` exit 0, `npm run test:visual` 24/24, `git diff --check` exit 0. 제품 코드·문구·SEO·광고/격리 경로는 변경하지 않았다.

### P0a 완료 (Codx, 2026-09-03, 커밋 `c43e1a7`)

- 첫 체크포인트: `npx shadcn@latest init --help` 실측 CLI는 **4.20.1**이고 `--template`은 `vite`, `--base`는 `base|radix|aria`, `--preset [name]`을 지원한다. `preset decode b1aK6UEDo --json`은 version `b`·style `luma`·baseColor `olive`·theme `indigo`·chartColor `blue`·iconLibrary `lucide`·font `noto-sans`·fontHeading `inherit`·radius `large`·menuAccent `subtle`·menuColor `default`로 해석됐다.
- 확정 적용 명령: `npm_config_cache=/tmp/worklazytools-npm-cache npx --yes shadcn@4.20.1 init --template vite --base base --preset b1aK6UEDo --yes`. 첫 시도는 Tailwind/alias 부재, 두 번째는 CLI가 모듈별 import를 CSS 진입점으로 탐지하지 못해 변경 없이 중단됐다. 앱에서 import하지 않는 임시 탐지 CSS로 세 번째 적용에 성공한 뒤 제거했다. 최종 `shadcn info`는 `style=base-luma`·`base=base`·Tailwind v4·alias `@`·동일 preset·**Installed Components: No components installed**를 반환했다.
- 생성/변경 파일: 최종 생성 `components.json`, `src/lib/utils.ts`, `src/styles/tailwind.css`; 변경 `package.json`, `package-lock.json`, `public/legal/third-party-licenses.txt`(생성기 산출), `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `src/main.tsx`, `src/styles/global.css`. init이 자동 생성한 `src/components/ui/button.tsx`는 P1 이전 component 금지에 따라 제거했고 별도 `shadcn add`는 실행하지 않았다.
- dependency diff: `@base-ui/react@1.7.0`, `@fontsource-variable/noto-sans@5.3.0`, `class-variance-authority@0.7.1`, `clsx@2.1.1`, exact `shadcn@4.20.1`, `tailwind-merge@3.6.0`, `tw-animate-css@1.4.0`, exact dev `tailwindcss@4.3.3`, `@tailwindcss/vite@4.3.3`. 기존 npm audit 상태 6 low/4 moderate는 범위 외 자동 fix하지 않았다.
- CSS 계약: `tailwindcss/theme.css`→`layer(theme)`, `tailwindcss/utilities.css`→`layer(utilities)`만 import해 preflight를 제외했다. `theme < base < legacy < components < utilities`를 선언하고 현행 global CSS 전체를 legacy에 배치했다. theme은 실제 cascade layer이며 Tailwind 내부 `properties` layer는 custom property 초기화 전용으로 별도 존재한다. `.dark`는 0건이고 `prefers-color-scheme: dark` 안에서 shadcn 변수를 기존 색상/표면 변수에 브리지했다.
- source scan: 최초 build가 `public/vendor`의 `[file:*]` 로그를 arbitrary CSS로 오인한 경고를 실측해 자동 scan을 기각했다. `source(none)` + 소유 `src/` 전용 `@source "../"`로 고정한 재빌드는 해당 경고·산출 selector 0건, preflight reset 패턴 0건이다.
- 회귀/예산: production preview 시각 기준선 **24/24 일치**(각 diff ≤0.100%). 전체 CSS 단일 파일 **228,206B / 39,730B gz** = 정본 37,148B 대비 **+2,582B**(한도 +20KB), entry JS **793,774B / 246,773B gz** = 정본 245,738B 대비 **+1,035B**(한도 +10KB) — 통과.
- 검증: `npm run build` exit 0(2,430 modules·정적 59페이지), `npm run test:unit` 158/158, `test:browser`·`test:office`·`test:xls-preserve`·`test:xls-first-load`·`test:excel-compare`·`test:excel-cleaner`·`test:new-tools`·`test:video-hybrid`·`test:utilities`·`test:static`·`test:visual` 모두 exit 0, `git diff --check` exit 0. ko/en 문구·SEO/정적 route·AdSense 배치/격리 경로·GitHub Pages 구조는 불변이다.

### P0b 완료 (Codx, 2026-09-03, 커밋 `df8e85c`)

- 실행 게이트: 작업 시작 시 `git rev-parse HEAD` = `git rev-parse origin/main` = `c43e1a7ea7f1edcf64de1903ca7ccd2a76721382`로 기준 해시가 일치했다. 열린 `docs/jobs/todo/*.md`에서 shadcn·Tailwind·preflight/reset·`global.css`·cascade layer 표면을 검색했고 상반 지시는 없었다. 미추적 MP4 3개와 DOCX 2개는 사용자 자산으로 보존하고 스테이징에서 제외했다.
- scoped/전역 확정: Tailwind 4.3.3 generated `preflight.css`는 398줄·SHA-256 `ace8310eed6dc5568a56fc16e1d695cf58da7528d81d66d81649e93cce644df6`이며 `:host`·`::backdrop`·`::file-selector-button`·브라우저 폼 pseudo-element·`[hidden]`까지 한 reset 계약으로 갖는다. Base UI 1.7.0 portal이 기본 `document.body`를 쓰는 원문과, 브라우저에서 `#root` 밖 body 직속 임시 `<p>`가 `margin-block: 0px`·`border-style: solid`로 계산되는 전역 적용을 확인했다. scoped는 portal/host/pseudo 계약을 누락하므로 기각하고 `@import "tailwindcss/preflight.css" layer(base)` 전역 적용으로 확정했다.
- 충돌 실측·보정 8개: 무보정 전역 활성화는 P-V 24/24 실패(diff 2.3848%~12.2323%). legacy layer에 ① pseudo-element `content-box`, ② `h1`~`h6` UA size/weight, ③ `small` font size, ④ tool-guide/prose ul disc marker, ⑤ prose ol decimal marker, ⑥ button/input/select/optgroup/textarea/file-selector-button 기존 기본값, ⑦ textarea resize, ⑧ html normal line-height를 명시했다. 보정 뒤 hero/page heading weight 700, prose ul disc·동적 ol decimal, hero pseudo content-box를 computed style로 확인했다. 다크 모드 브리지와 `theme < base < legacy < components < utilities` 순서는 불변이다.
- 회귀/예산: Chrome 152 production preview의 `test:visual` **24/24 일치**(전 항목 ≤0.100%). 전체 CSS 단일 파일 **232,664B / 40,929B gz** = P0a 39,730B 대비 **+1,199B**(한도 +10KB), entry JS **793,774B / 246,772B gz** = P0a 246,773B 대비 **-1B**(원시 크기 동일, 한도 +0KB) — 통과.
- 검증: `npm run build` exit 0(2,430 modules·정적 59페이지), `npm run test:unit` 158/158, `test:browser`·`test:office`·`test:xls-preserve`·`test:xls-first-load`·`test:excel-compare`·`test:excel-cleaner`·`test:new-tools`·`test:video-hybrid`·`test:utilities`·`test:static`·`test:visual` 모두 exit 0, `git diff --check` exit 0. 공개 문구·route·SEO/정적 페이지·AdSense 배치/격리 경로·GitHub Pages 구조는 불변이다.
- git: 명시 경로 `src/styles/tailwind.css`·`src/styles/global.css`·`CHANGELOG.md`·`docs/review-notes.md`만 커밋했다. `git push origin main`은 `c43e1a7..df8e85c`로 성공했고 재-fetch 뒤 `HEAD` = `origin/main` = `df8e85c32054f849428ccbd92efb7b0b497cbd9b` 동기화를 확인했다.

### P1a 실행 게이트 (Codx, 2026-09-03)

- 기준 해시 대조: `git rev-parse HEAD` = `git rev-parse origin/main` = `df8e85c32054f849428ccbd92efb7b0b497cbd9b` — 지시 기준 `df8e85c`와 일치해 통과했다.
- 열린 계획서 충돌 검사: `docs/jobs/todo/*.md`에서 `ui.tsx`·shadcn·8종 adapter·button/card/switch·tabs/toggle-group 표면을 재귀 검색했다. `new-tools-roadmap-20260903.md`의 U3 선행 의존은 본 정본의 P1 완료 순서와 일치하고, 나머지 열린 문서에는 P1a와 상반된 지시가 없다.
- 착수 전 워킹트리는 추적 파일 변경 없이 `main...origin/main` 동기 상태다. 미추적 MP4 3개와 DOCX 2개는 사용자 자산으로 보존하고 스테이징에서 제외한다.

### P1a 완료 (Codx, 2026-09-03)

- CLI 실측: `shadcn 4.20.1 view tabs`는 `tablist`/`tab`·`aria-selected`, `view toggle-group` 및 Base UI 설치 원문은 `role="group"`·`aria-pressed`를 제공했다. 기존 계약과 일치하는 toggle-group을 선택했다. 실행 add는 `button card switch toggle-group`뿐이며 registry 의존 `toggle.tsx`를 포함해 button/card/switch/toggle/toggle-group 5개가 생성됐다. tabs 파일은 없다.
- adapter: PageHeader(header/h1), SectionCard(Card `<section>`·className), SegmentedControl(group/pressed), ToggleRow(switch/checked), FileDropZone(누적·async·reset·Enter/Space·drag), FileList(`<ul>`/`<li>`), PrimaryButton(loading/disabled/`aria-busy`), ResultCard(`<section>`/`aria-live="polite"`) 8종과 6색 accent를 보존했다. 호출 0인 NavigationRow와 전용 CSS 2개는 제거했다.
- 공개 계약: 기준 해시와 현재 8개 prop type 텍스트를 TypeScript AST로 대조해 동일했다. U2 이후 실제 호출 파일은 지시서의 39개가 아니라 40개이며 호출부 수정 0 상태로 `npx tsc -b` exit 0이었다.
- 행동·화면: Chrome 실동작에서 FileDrop Enter 업로드+async input reset, segmented ArrowLeft/Right+Space, switch Space+Enter를 통과했다. Excel 모바일 sticky와 HWP focus padding/overflow 충돌을 보정했고 변경 16행렬의 document/adapter overflow·clipped text는 모두 0이다. 대표 텍스트 최소 대비 4.73:1, 6색 primary 최소 4.95:1로 AA를 통과했다.
- 시각: P-V 대비 의도한 최초 차이는 24개 중 16개, 최대 11.3402%였다. 대표 4화면의 before/after/diff 12장은 `tests/visual-artifacts/p1a/`에 저장했다. Chrome 152.0.7977.64로 기준선 24장을 갱신한 뒤 일반 `test:visual` 24/24(≤0.100%)를 통과했다.
- 예산: CSS 271,697B/46,844B gzip = P0b 대비 +5,915B(한도 +10KB), entry JS 859,382B/268,432B gzip = +21,660B(한도 +50KB)로 통과했다.
- 검증: `npm run build` exit 0(2,522 modules·정적 59페이지), `npm run test:unit` 163/163, `test:browser`·`test:office`·`test:xls-preserve`·`test:xls-first-load`·`test:excel-compare`·`test:excel-cleaner`·`test:new-tools`·`test:video-hybrid`·`test:utilities`·`test:static` exit 0, `test:visual` 24/24. ko/en 문구·SEO/정적 route·AdSense 배치/격리 경로·GitHub Pages 구조는 불변이다.
- git: P1a 명시 경로 48개만 커밋했다. `git push origin main`은 `df8e85c..fdfb6c3`로 성공했고 재-fetch 뒤 `HEAD` = `origin/main` = `fdfb6c389692272e6c49143be7a8fb04639116c1` 동기화를 확인했다. 사용자 MP4 3개와 DOCX 2개는 끝까지 제외했다.

### P1b 실행 게이트 (Codx, 2026-09-03)

- 기준 해시 대조: `git rev-parse HEAD` = `git rev-parse origin/main` = `fdfb6c389692272e6c49143be7a8fb04639116c1` — 지시 기준 `fdfb6c3`와 일치해 통과했다.
- 열린 계획서 충돌 검사: `docs/jobs/todo/*.md`에서 `ToolGuide`·`OperationProgress`·`ToolCard`·`LanguageSwitcher`·shadcn `progress` 표면을 재귀 검색했다. `video-dv-guidance-20260903.md`는 OperationProgress의 stage key 로그·`activeStageKey` 스피너·행 `%` W-D 계약을 선행 확정하며 본 P1b의 보존 요구와 일치하고, `new-tools-roadmap-20260903.md`의 U3 선행 의존도 본 정본의 P1 순서와 일치한다. 그 밖의 열린 문서에는 P1b와 상반된 지시가 없다.
- 착수 전 워킹트리는 추적 파일 변경 없이 `main...origin/main` 동기 상태다. 미추적 MP4 3개와 DOCX 2개는 사용자 자산으로 보존하고 스테이징에서 제외한다.

### P1b 완료 (Codx, 2026-09-03)

- CLI·범위: `npm_config_cache=/tmp/worklazytools-npm-cache npx --yes shadcn@4.20.1 add progress --yes`만 실행해 `src/components/ui/progress.tsx` 하나를 추가했다. package/lock diff와 다른 add는 없다.
- 구현: ToolGuide는 Card section/article와 현지화 `안내`·guide/FAQ 구조, OperationProgress는 Card/Button/Progress와 6색 accent·stage-key current/spinner/행 %, ToolCard는 polymorphic Card의 실제 Link anchor·analytics·accent, LanguageSwitcher는 ToggleGroup의 KO/EN group/pressed·키보드 계약을 보존했다. 기준/현재 TypeScript AST의 네 공개 API는 동일하다. U2 뒤 실사용처는 지시서 수치보다 하나씩 많은 ToolGuide 22·OperationProgress 14파일이며 중앙 전환으로 전부 포함했다.
- W-D: `npm run test:excel-compare` exit 0. `npm run test:new-tools`의 512MiB×2 sparse 비디오 실동작에서 14개 bounded stage 행의 퍼센트와 마지막 행이 아닌 active stage의 spinner를 관측해 exit 0이었다. browser smoke도 progress slot/aria value/log %를 전 완료 상태에서 통과했다.
- 시각: Chrome 152.0.7977.64 기준선 24장을 갱신하고 일반 `npm run test:visual` 24/24(≤0.100%)를 통과했다. before/after/diff 12장은 `tests/visual-artifacts/p1b/`에 저장했다. 8개 locale/theme/viewport 조합에서 overflow·clipped text 0, 보조 텍스트 대비 최소 light 4.89:1/dark 6.04:1이었다.
- 예산: CSS 273,707B/47,198B gzip = P1a 대비 +354B(한도 +10KB), entry JS 863,110B/271,025B gzip = +2,593B(한도 +50KB)로 통과했다.
- 검증: `npm run build` exit 0(2,537 modules·정적 59페이지), `npm run test:unit` 167/167, `test:browser`·`test:office`·`test:xls-preserve`·`test:xls-first-load`·`test:excel-compare`·`test:excel-cleaner`·`test:new-tools`·`test:video-hybrid`·`test:utilities`·`test:static` exit 0, `test:visual` 24/24. 제품 문구·SEO/정적 route·광고/격리·서버리스 계약은 불변이다.
- git: P1b 명시 경로 49개만 `d998afab3c6774f765e59cf6604d11129e5d0398`로 커밋했다. `git push origin main`은 `fdfb6c3..d998afa`로 성공했고 재-fetch 뒤 `HEAD` = `origin/main` = `d998afab3c6774f765e59cf6604d11129e5d0398` 동기화를 확인했다. 사용자 MP4 3개와 DOCX 2개는 끝까지 제외했다.

### P1-polish 실행 게이트 (Codx, 2026-09-03)

- 기준 해시 대조: `git rev-parse HEAD` = `git rev-parse origin/main` = `d998afab3c6774f765e59cf6604d11129e5d0398` — 사용자 지시 기준 `d998afa`와 일치해 통과했다.
- 열린 계획서 충돌 검사: `docs/jobs/todo/*.md`에서 `P1-polish`·`P1c`·`AppShell`·하단 네비게이션·드롭존·shadcn `sheet`·AdSense/광고 격리 표면을 재귀 검색했다. `new-tools-roadmap-20260903.md`의 U3 선행 의존은 본 정본의 P1 순서와 일치하고, 나머지 열린 문서에는 두 배포 단위와 상반된 지시가 없다.
- 착수 전 워킹트리는 추적 파일 변경 없이 `main...origin/main` 동기 상태다. 미추적 MP4 3개와 DOCX 2개는 사용자 자산으로 보존하며 `dummyfortest/`·`.codex/`와 함께 스테이징에서 제외한다.

### P1-polish 완료 (Codx, 2026-09-03)

- 수용 3건: 구분자를 앞선 파일 형식 항목에 포함하고 항목 사이에만 `wbr`를 두는 `DropZoneHint`로 `SpreadsheetML .xls`를 한 덩어리로 보존했다. 드롭존·카드 radius는 computed **36.4px**로 일치했고, 모바일 공통 `.main-content` 하단 padding **80px + safe-area**는 nav **62px** 이상이며 최하단 footer 763.64px < nav 상단 773px로 겹침이 없었다.
- 시각: Chrome 152 기준선 24장을 갱신하고 `tests/visual-artifacts/p1-polish/`에 대표 before/after/diff 12장을 고정했다. 일반 `test:visual`은 24/24(≤0.100%) 통과했다.
- 예산: CSS 273,854B/**47,225B gzip** = P1b 대비 **+27B**(한도 +10KB), entry JS 863,742B/**271,292B gzip** = **+267B**(한도 +50KB)로 통과했다.
- 검증: `npm run build` exit 0(2,538 modules·정적 59페이지), `npm run test:unit` 167/167, `test:excel-compare`·`test:browser`·`test:static` exit 0, `test:visual` 24/24, `git diff --check` exit 0. ko/en 문구·SEO/정적 route·AdSense 배치/격리 경로·서버리스 계약은 불변이다.
- git: 명시 경로 28개만 `00bd3fd7223aea75fa4cefdec2cacd63ed3aa437`로 커밋했다. `git push origin main`은 `d998afa..00bd3fd`로 성공했고 재-fetch 뒤 `HEAD` = `origin/main` = `00bd3fd7223aea75fa4cefdec2cacd63ed3aa437` 동기화를 확인했다. 사용자 MP4 3개와 DOCX 2개는 제외했다.

### P1c 실행 게이트 (Codx, 2026-09-03)

- 기준 해시 대조: `git rev-parse HEAD` = `git rev-parse origin/main` = `00bd3fd7223aea75fa4cefdec2cacd63ed3aa437` — 직전 P1-polish 배포와 일치해 통과했다.
- 열린 계획서 충돌 검사: `docs/jobs/todo/*.md`에서 P1c·`AppShell`·shadcn `sheet`·sidebar/bottom nav·AdSense/광고 격리 표면을 재귀 검색했다. `new-tools-roadmap-20260903.md`의 U3 선행 의존만 본 정본의 P1 순서와 일치하고, 나머지 열린 문서에는 P1c와 상반된 지시가 없다.
- 착수 전 워킹트리는 추적 파일 변경 없이 `main...origin/main` 동기 상태다. 미추적 MP4 3개와 DOCX 2개는 사용자 자산으로 보존하며 `dummyfortest/`·`.codex/`와 함께 스테이징에서 제외한다.

### P1c 완료 (Codx, 2026-09-03)

- CLI·구현: `npm_config_cache=/tmp/worklazytools-npm-cache npx --yes shadcn@4.20.1 add sheet --yes`만 실행해 `src/components/ui/sheet.tsx`를 생성했고 동일한 button은 건너뛰었다. package/lock diff는 없다. AppShell 수동 모달을 제어형 Sheet로 바꾸고 Base UI modal focus trap·Escape·trigger 복귀, route/desktop 전환 닫힘과 21개 항목 내부 스크롤을 고정했다.
- 소유권·격리: RouteSeo→3개 isolation boundary→AnalyticsLoader→조건부 AdSenseLoader 순서와 video/office/XLS redirect 세 목적지, sidebar/mobile header/bottom nav를 source test로 고정했다. `granted` 동의 실브라우저에서 일반 화면 AdSense DOM/요청 1/1, video·office·XLS 격리 문서 각각 0/0이며 marker와 nav가 유지됐다. repo-wide 실행 파일 광고 참조는 generated `public/vendor/`만 제외한 명시 allowlist와 일치했다. AdSenseLoader는 기존 위치에서 null을 반환하고 head async script만 삽입하므로 layout/CLS 영향은 없다.
- 시각·접근성: 닫힌 상태 기준선 24개를 재생성했으나 기존과 pixel diff 0이라 동일 PNG를 유지했다. 열린 시트 before/after/diff 12장은 `tests/visual-artifacts/p1c/`에 저장했다. light/dark 최소 대비 5.45:1/5.62:1, 390×844 안정 여백 약 10px, 수평 overflow·의도하지 않은 text clipping 0, 목록 내부 스크롤과 focus loop를 확인했다.
- 예산: CSS 280,255B/**48,261B gzip** = polish 대비 **+1,036B**(한도 +10KB), entry JS 918,640B/**289,140B gzip** = **+17,848B**(한도 +50KB)로 통과했다.
- 검증: `npm run build` exit 0(2,629 modules·정적 59페이지), `npm run test:unit` 170/170, `test:browser`·`test:office`·`test:xls-preserve`·`test:xls-first-load`·`test:excel-compare`·`test:excel-cleaner`·`test:new-tools`·`test:video-hybrid`·`test:utilities`·`test:static` exit 0, `test:visual` 24/24, `git diff --check` exit 0. 사용자 MP4 3개·DOCX 2개와 `dummyfortest/`·`.codex/`는 스테이징하지 않는다.
- git: 명시 경로 18개만 `415e35b6fc9f860bc1193da6018bbfcb7411629e`로 커밋했다. `git push origin main`은 `00bd3fd..415e35b`로 성공했고 재-fetch 뒤 `HEAD` = `origin/main` = `415e35b6fc9f860bc1193da6018bbfcb7411629e` 동기화를 확인했다. 사용자 MP4 3개와 DOCX 2개는 끝까지 제외했다.

### 라이브 복구 (Codx, 2026-09-03)

- **라이브 복구(사용자 지시) — 이후 전 UI 작업은 브랜치에서 진행하고, 병합 전 3자(Claude·Codex·Gemini) 전수 검수를 거친다.**
- P1c `415e35b` → P1-polish `00bd3fd` → P1b `d998afa` → P1a `fdfb6c3` → P0b `df8e85c` → P0a `c43e1a7`를 역순 revert했다. 6건 모두 충돌 없이 적용됐고 P-V `10a4b72` 및 U1·U2는 유지됐다.
- P-V 원본 기준선 `test:visual` 24/24 일치와 `/tmp/worklazytools-live-recovery/document-compare-restored-ko-desktop.png` 실측에서 캡슐형 스위치·문서 영역 가로 텍스트 배치를 확인했다. 추적 제외 dev 검수 캡처는 `/tmp/worklazytools-live-recovery/document-compare-restored-ko-dev-no-tracking.png`이며 분석·광고 DOM과 외부 요청은 모두 0이었다. 전체 검증 명령과 상세 판정은 `docs/review-notes.md`의 「shadcn 마이그레이션 라이브 UI 복구」 항목에 기록했다.

### 브랜치 재적용·사고 원인 교정 (Codx, 2026-09-04)

- 라이브 복구 기준 `main=origin/main=311c59e`에서 `ui-migration`을 분기하고 P0a~P1c 6개를 원래 순서대로 revert-of-revert(`72632c9`·`932c5eb`·`4804a45`·`7ba78b0`·`c3b2acd`·`f866bed`)했다. `main`에는 커밋·push하지 않았다.
- adapter 12종에서 52개 legacy token·3개 prefix 방출을 0으로 만들고 `.ios-switch`×Switch와 `.tool-action-bar` 190px×`w-full` 충돌을 제거했다. unique legacy selector rule은 281→143이며 남은 143개는 raw legacy DOM 전용이다.
- 추적 제외 QA build에서 문서 비교 Switch 7개 43×25/21×21px·수직 중심 오차 0, action button 190px·옆 문구 horizontal·overflow 0, Google/Naver/AdSense/외부 요청 0을 단언했다. 전 도구 96 baseline은 96/96 일치했고 `tests/visual-artifacts/branch-qa-r1/`에 82 PNG와 계산 JSON 1개를 고정했다.
- 표준 build·unit 174/174·static·UI migration·visual 96/96·브라우저 스모크 9종·diff check가 모두 통과했다. 사고 교정은 `0ba96ed`, 전 도구 시각 QA는 `5e6ec7c`, 규칙·검토 기록은 `4a8405c`다. 구현과 Codx 로컬 육안 검수는 완료했으며 상태는 **Gemini 검수 대기**다.
