# UI 전면 재설계 W0 사전 측정 — Gemini 조사 + Claude 실측 검증 (2026-09-09, main `2d0ff3a`)

> 원문 `gemini-ui-w0-RAW.md`. **「Gemini 산출물은 단서다」 규칙에 따라 실측 재현한 값만 채택.**

## ✅ 재현 일치 (Claude 가 같은 명령으로 확인)
| 항목 | 값 | 비고 |
|---|---:|---|
| `dark:` 사용 파일 | **50** | 일치 |
| 시각 회귀 기준선 PNG | **183** | 일치. **Excel 배포 후 값**(이전 로드맵의 175·203 은 낡음) |
| ko `features.json` 최상위 키 | **18** | 일치 |
| `src/app/seo.ts` route 등록 | **45** | 일치 |

## ⚠️ 정의 차이 (오류 아님 — 세는 기준을 먼저 정할 것)
**UI 프리미티브 소비 파일**: Gemini **61** vs 내 초기 측정 **51**. 원인은 정규식이다.
- Gemini 패턴 `from '.*/ui(/.*)?'` → **61** (경로가 `/ui` 로 끝나는 것 포함)
- 내 패턴 `from '.*components/ui'` → **51**
- 차이 **10개**는 전부 `src/components/*.tsx` 가 **`src/components/ui.tsx`**(단일 파일 프리미티브)를 import 하는 경우다: `AppShell`·`FileShareButton`·`LanguageSwitcher`·`OperationProgress`·`PrivacyConsentBanner`·`RouteErrorBoundary`·`ToolCard`·`ToolGuide`·`UtilitySurface`·`ui.tsx` 자신.
- **→ 이 프로젝트의 프리미티브는 `components/ui.tsx` 단일 파일이다. 61 이 맞는 수치**이고 내 초기 패턴이 그것을 놓쳤다. **W0 지시서에는 "61(=`components/ui.tsx` 소비 포함)" 로 정의를 명시**할 것.

## 📋 색 토큰 현황(원문 인용 — 착수 시 재확인)
- `src/styles/global.css`: `--bg`·`--bg-elevated`·`--bg-solid`·`--bg-muted`·`--label`·`--label-secondary`·`--label-tertiary`·`--separator`·`--glass-border`·`--glass-shadow`·`--card-shadow`·`--blue-soft`·`--green`·`--green-soft`·`--orange-soft`·`--pink-soft`·`--sky`·`--sky-soft`·`--success`
- `src/styles/tailwind.css`: `--primary`·`--sidebar-primary`·`--destructive`
- 하드코딩 색이 남은 파일·줄 목록은 원문 참조. **토큰화 대상 산정의 출발점**이며 W0 에서 재확인한다.

## 🔴 도구 수 — 원문 주장 확인 필요
Gemini: **ko 20 / en 19**, 차이는 `useToolCatalog.ts` 의 `language === "ko" || tool.id !== "hwp-editor"` — 즉 **한글 편집기가 영어에서 제외**. 이 수치는 로드맵의 기존 기록(ko 20 / en 19)과 일치하므로 **정합**하나, W0 착수 시 `tool-registry-routes` 로 재확인한다.

## W0 착수 시 할 것
1. **프리미티브 소비 파일 정의를 61 기준으로 고정**하고 지시서에 명시.
2. 기준선 **183** 을 시작점으로 삼는다(U4 병합 후 다시 늘어나므로 **U4 배포 직후 재측정**).
3. 색 토큰 목록·하드코딩 위치를 **그 시점 main 에서 재확인**.
4. 정본 `ui-theme-redesign-20260907.md` 가 전제한 수치와 위 실측이 다른 항목을 정본에 반영.
