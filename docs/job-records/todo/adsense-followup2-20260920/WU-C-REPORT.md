# WU-C 구현 보고

- 작업 ID: `adsense-followup2-20260920 / WU-C`
- 구현자/기록 서명: Codx (Sol)
- worktree/브랜치: `/home/better0101/projects/wt-followup2-c` / `work/followup2-c-20260920`
- 기준 커밋: `2fe293d`
- 최종 고정 SHA: `a1330411173815de0ccbd3ab7ff5a5f3fcfe4d64`
- push/통합/배포: 미수행(WU-C 범위 밖)

## 커밋과 변경 파일

1. `e21b5ff21ad183f0f157e63b61acf4881ead214d` — `test(p1b): refresh contracts to current shell`
   - `tests/unit/p1b-components.test.ts`
2. `a1330411173815de0ccbd3ab7ff5a5f3fcfe4d64` — `fix(excel-cleaner): express checkbox accent with arbitrary utility`
   - `src/features/excel-cleaner/ExcelCleanerPage.tsx` (`:231` className 한 토큰만 변경)

오프라인 작업 기록 `WU-C-FINDINGS.md`와 이 보고서는 `docs/jobs` ignore 정책에 따라 강제 add/커밋하지 않고 지정 경로에 보존했다. `global.css`, `tests/unit/ui-legacy-isolation.test.ts`, WU-D 소유 파일은 수정하지 않았다.

## 갱신 단언(이전 → 이후)

1. ToolGuide 소비자 `length === 21` → 현재 24개 파일명을 정렬된 명시 배열로 `deepEqual`하고 배열 길이도 확인. 기존 21개 + `DocumentRedactorFallback.tsx`, `DocumentRedactorPage.tsx`, `PdfComparePage.tsx`. 통합 시 WU-D의 `office-editor/OfficeEditorAppPage.tsx`를 추가해 25개로 조정할 위치를 주석으로 명시.
2. OperationProgress `coral: "bg-red-700"` → 7 accent 모두 indicator `bg-primary`, state `bg-[var(--brand-soft)] text-[var(--brand-on-bg)]`임을 전수 확인하고, error tile/indicator의 red 분기를 별도로 확인. 소비자 수 16은 유지.
3. ToolCard root `ui-tool-card ...` → `group ui-tool-card ...`.
4. ToolCard icon `toolIconAccentClasses[tool.accent]` → `getToolIconTone(tool.id)`.
5. ToolCard icon `data-accent={tool.accent}` → `data-icon-tone={getToolIconTone(tool.id)}`.

접근성, 진행률, 링크, 추적, 표시 태그 최대 3개, arrow 및 7색 registry/key 단언은 보존했다. 7색 키 검사는 실제 렌더 색 증명이 아니라 registry 완전성 검사임을 주석으로 명시했다.

## Excel checkbox 변경과 동등성

- `accent-primary` → `[accent-color:var(--primary)]`.
- React 상태, event handler, DOM 구조 및 다른 class는 불변이다.
- 기준/수정 후 모두 합성 `formula.xlsx` 1개를 `/ko/tools/excel-cleaner/`에 업로드했다.
- Chrome `/usr/bin/google-chrome` 153.0.8010.36, viewport 1440×1100, preview `127.0.0.1:4291`, `XDG_CACHE_HOME=/tmp/wl-followup2/c/playwright`.
- computed `accent-color`:
  - 변경 전: checked `rgb(232, 80, 47)`, unchecked `rgb(232, 80, 47)`.
  - 변경 후: checked `rgb(232, 80, 47)`, unchecked `rgb(232, 80, 47)`.
- 전후 PNG는 byte-identical(`cmp` exit 0), 공통 SHA-256 `c29b861238048de810eff279426ae8a601b772e0ce1bf8d425a7e6b9b5242fb0`. 두 캡처 모두 직접 열어 시트 행 표시를 확인했다.
- 캡처: `/tmp/wl-followup2/c/shots/excel-cleaner-accent-before.png`, `/tmp/wl-followup2/c/shots/excel-cleaner-accent-after.png`.
- 측정 JSON: `/tmp/wl-followup2/c/logs/accent-before.json`, `/tmp/wl-followup2/c/logs/accent-after.json`.
- `tests/helpers/ad-stub.mjs`의 `installAdFirewall`/`assertNoRealNetwork`를 재사용했고 전후 모두 `allowedExternal=0`; 실제 외부 광고·분석 요청은 허용하지 않았다.

## 실행 결과와 로그

| 명령/확인 | 상태 | 결과 및 로그 |
|---|---:|---|
| `sha256sum docs/jobs/todo/adsense-followup2-20260920/PLAN.md` | exit 0 | `c4d8e761c96d18f7…`, v0.2 정본 일치 |
| 수정 전 `node --experimental-strip-types --test tests/unit/p1b-components.test.ts` | exit 1(예상 재현) | 4 subtest 중 3 실패; `/tmp/wl-followup2/c/logs/p1b-before.log` |
| 기준 `npm run build` | exit 0 | 기준 preview 산출물; `/tmp/wl-followup2/c/logs/build-before.log` |
| `node scripts/generate-excel-cleaner-fixtures.mjs /tmp/wl-followup2/c/fixtures` | exit 0 | 합성 fixture 생성; `/tmp/wl-followup2/c/logs/fixture-generation.log` |
| `node --experimental-strip-types --test tests/unit/p1b-components.test.ts tests/unit/ui-legacy-isolation.test.ts` | exit 0 | 14/14 pass, 0 fail; `/tmp/wl-followup2/c/logs/unit-targeted.log` |
| 수정 후 `npm run build` | exit 0 | Vite 2914 modules, 정적 페이지 101개 생성; chunk-size 경고만 존재; `/tmp/wl-followup2/c/logs/build-after.log` |
| `npx vite preview --port 4291 --strictPort --host 127.0.0.1` | startup 성공, 검사 뒤 SIGINT 종료 | 기준/수정 후 빌드 각각 같은 포트에서 별도 실행 |
| 변경 전 Playwright 측정 | exit 0 | `/tmp/wl-followup2/c/logs/playwright-before.log` |
| 변경 후 Playwright 측정 | exit 0 | `/tmp/wl-followup2/c/logs/playwright-after.log` |
| 전후 JSON 값 비교 + `cmp -s` PNG 비교 | exit 0 | computed color와 픽셀 캡처 일치 |
| `git diff --check 2fe293d..HEAD` | exit 0 | whitespace 오류 없음 |

Playwright CLI wrapper는 `open about:blank`에서 성공을 반환했으나 브라우저 PID가 즉시 종료되어 다음 명령에서 세션을 찾지 못했다(`playwright-cli list`: 열린 브라우저 0, 후속 `run-code`: exit 1). 자동 설치 없이 저장소의 Playwright 라이브러리로 일회성 임시 스크립트(`/tmp/wl-followup2/c/playwright/check-accent.mjs`)를 실행하는 방식으로 전환했고, 동일한 지정 Chrome·cache·ad-stub·preview 조건에서 필수 측정과 캡처를 완료했다. 제품/테스트 실패나 권한 오류는 아니다.

## 별도 회부와 이월

- ToolCard 제목은 현재 `src/components/ToolCard.tsx:34`와 보존된 테스트 단언 모두 `h2`이나, PLAN이 인용한 `ui-theme-redesign-20260907:159` 정본은 `h3`; merge `c5b64f6`에서 `h3` → `h2`가 확인된다. WU-C에서는 제품·기대값을 바꾸지 않았으며 사용자 결정 대상으로 회부한다.
- WU-D의 `OfficeEditorAppPage.tsx` 소비자 추가와 통합 시 ToolGuide 목록 25개 조정은 §5 통합 담당에게 이월한다.
- 전체 unit/static/ads/office-editor smoke 및 최종 통합 시각 표본은 PLAN §5의 통합 후보 검사다. WU-C에서는 실행하지 않았다.

## 완료 판정

WU-C §3-1~§3-3의 수정·국소 테스트·빌드·브라우저 동등성 확인을 완료했다. WU-C 범위의 차단 결함은 없다.
