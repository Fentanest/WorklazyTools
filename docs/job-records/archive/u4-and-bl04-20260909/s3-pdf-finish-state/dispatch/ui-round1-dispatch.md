# 반박 1차 지시서 — 메인 UI 개편·4테마·shadcn 제거 계획 초안 (2026-09-07, Claude → Codex **gpt-6-astra**)

## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md`(반박: 작업 중 발생·인지될 예외 상황과 구성의 흠결까지 sol 이 감당할 수 있을 만큼 고려해 반박; 증거 없는 반박은 무게 0) → 계획 초안 **`docs/jobs/todo/ui-theme-redesign-20260907.md`**(§7 (a)~(j)) → 시안 `newui/`(PNG 7장 — 4테마 화면 4·히어로 에셋 2·핸드오프 1; **알림종 버튼 제외**가 사용자 지시) → 관련 코드: `src/styles/{global.css,tailwind.css}` · `src/components/{AppShell.tsx,ToolCard.tsx,toolAccentStyles.ts,ui.tsx,ui/*}` · `src/pages/{HomePage.tsx,ToolsPage.tsx}` · `src/app/{toolRegistry.ts,seo.ts}` · `src/i18n/*` · `index.html` · `scripts/generate-static-pages.mjs`·`validate-static-output.mjs` · `tests/{visual-regression.*,accessibility-audit.mjs,rendering-baseline.mjs,browser-smoke.mjs}` · `scripts/measure-bundle-budget.mjs` → `docs/backlog.md` 「UI 색 체계」(사용자 1안: 컨트롤 단일 primary·도구색은 카테고리 배지) · `docs/review-notes.md` 의 P2 shadcn 전환·S2 CLS·a11y 이력.

## 1. 성격·기준
- **실험 작업(쓰기 모드 필요) — 저장소 불변.** 추적 파일 수정·커밋·push·브랜치 전환 금지. 현재 워킹트리는 `s3-pdf-finish`(U4-3 구현 병행 중 — **절대 건드리지 말 것**). 실험은 `git archive 5bc6854175331bdd73b267784d9633cdccda8446`(main) 사본 `/tmp/worklazy-ui-r1/main/` 에서(의존성은 기존 `node_modules` 복사/링크, 설치 금지). 산출물 `/tmp/worklazy-ui-r1/`. 시작·종료 `git status`·관련 파일 SHA 로 불변 증명(병행 잡 때문에 전체 트리 동일은 성립하지 않음 — 그 사실을 명시).
- 빌드·브라우저 직렬, `NODE_OPTIONS=--max-old-space-size=4096`. 시안 PNG 는 읽기만.
- 사용자 결정 3건(shadcn 전면 제거 · 셸+홈+도구 화면 전체 · 히어로 WebP/AVIF)은 **되돌리는 제안 금지**. 실행 가능성·비용·위험만 증거로 반박하고, 결정 자체에 이의가 있으면 "★사용자 확인" 항으로 분리.

## 2. 반박 항목 = 초안 §7 (a)~(j) 전부 (각 항목에 재현 명령·출력·프로토타입)
(a) §1 실측표 재현·정정(특히 `dark:` 51파일·프리미티브 843줄/62소비·기준선 203장·카테고리 5종·홈 카피 일치).
(b) **토큰 3층 + `@custom-variant dark`** 프로토타입: `/tmp` 사본에 4테마 블록과 커스텀 변형을 넣고 실제 빌드 → 기존 `dark:` 51파일이 수동 테마에 붙는지, 반례(중첩 `dark:` 조합·`prefers-color-scheme` 잔재 2곳·`color-scheme` 폼 컨트롤·`forced-colors`/인쇄) 열거. 레거시 `global.css` 다크 블록(882~937)과 shadcn 토큰 블록(tailwind.css 57~124)을 의미 토큰으로 재지정했을 때 깨지는 화면 표본 캡처.
(c) FOUC 방지 인라인 스크립트: `index.html` + 정적 61페이지(`generate-static-pages.mjs`) + 격리 문서(video·office·excel-preserve) + `chunkRecovery`/`#startup-help` 와의 충돌·순서 문제. 스크립트 삽입 후 `npm run test:static` 통과 여부, CSP·`validate-static-output` 허용목록 영향.
(d) 프리미티브 7종 자체 구현: `@base-ui/react` 가 실제로 제공하는 동작(Sheet 포커스 트랩·ESC·스크롤 잠금·`aria-modal`·Switch/Toggle 키보드·Progress `aria-valuenow`)을 코드로 확인하고, 자체 구현 시 필요한 계약을 열거. **제거 후 번들 delta 실측**(사본에서 의존성 제거 대신 import 스텁으로 근사해도 되나 방법을 명시). `shadcn` 4.20.1 패키지가 런타임에 쓰이는지(devDependency 여야 하는지) 판정.
(e) 검색 UI: a11y 패턴(`combobox` vs 필터+`aria-live`), `Ctrl/⌘+K` 충돌(브라우저·기존 단축키), 모바일 처리, 도구 20개 로컬 필터의 ko/en 매칭(초성·부분일치) 범위 제안.
(f) 에셋: `newui/` PNG 2종을 `/tmp` 에서 AVIF/WebP × 폭 3종으로 변환(가용 도구 확인 — sharp/squoosh/ffmpeg/ImageMagick 중 저장소에 이미 있는 것 우선, 새 npm 설치 금지) → 실제 바이트·시각 손실·`<picture>` 로 1920/1440/390 렌더 캡처, LCP·CLS 실측, entry/CSS 예산 영향 추정.
(g) 시각 기준선 203장 일괄 갱신 절차(`VISUAL_ONLY`·`UPDATE_VISUAL_BASELINES` 범위 한정 가능 여부)와 S3(`s3-pdf-finish`) 와의 충돌 파일 목록 재산출, 4테마 축을 추가하면 기준선이 몇 장이 되는지·상한 20분 영향.
(h) 4테마 × 주요 화면 **대비비 실측 가능성**: 실제 계산 스크립트로 시안 색을 추출해 본문/보조/버튼/틴트의 WCAG AA 충족 여부 표. 미달 색은 보정안 제시.
(i) 단계 분할 순서 위험: W1(프리미티브 제거)을 W2(셸 재구성)보다 먼저 두는 것이 맞는지, 병합·회귀 관점 대안 순서 제시.
(j) sol 재해석 지점 열거 + 정본 반영 문안. 규칙 4(ko/en·SEO·AdSense)·5(내부 구현 비노출)·19(배포 전 시각 검수) 영향 점검. 홈 `HOW IT WORKS`·`PrivacyBanner` 처리와 카드 개수(20 vs 12)의 SEO 손익.

## 3. 판정 형식
항목별 `[동의] / [반박: 증거] / [보완 제안]` + 재현 명령·출력 + 정본 반영 문안 + **잔여 이견 수**. 산출물 `/tmp/worklazy-ui-r1/REPORT.md`(+ 캡처·JSON).
