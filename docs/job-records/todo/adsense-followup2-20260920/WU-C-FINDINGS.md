# WU-C 판정 조사 — p1b 컴포넌트 계약

- 작업 ID: `adsense-followup2-20260920 / WU-C`
- 조사 기준: `2fe293d` (`work/followup2-c-20260920`), PLAN v0.2 (`c4d8e761c96d18f7`)
- 수정 전 재현: `node --experimental-strip-types --test tests/unit/p1b-components.test.ts` → exit 1, 4개 subtest 중 3개 실패. 첫 실패에서 중단되는 subtest 구조이므로 아래 5개 낡은 단언은 소스·이력과 항목별로 대조했다. 원시 로그: `/tmp/wl-followup2/c/logs/p1b-before.log`.

## 실패 단언 5개 재확인

1. **ToolGuide 소비자 수 `21` → 명시 목록 24개**
   - 낡은 단언: `tests/unit/p1b-components.test.ts:16-17`의 길이 21.
   - 현재 근거: `src/features`에서 `<ToolGuide`를 포함하는 TSX는 24개다. 기존 21개에 `src/features/document-redactor/DocumentRedactorFallback.tsx:18`, `src/features/document-redactor/DocumentRedactorPage.tsx:90,116`, `src/features/pdf-compare/PdfComparePage.tsx:91`가 추가됐다.
   - 유입: document redactor 2파일은 `eea9b1e`, PdfComparePage는 `33d529e`.
   - 판정: 승인된 소비자 추가를 놓친 수치 단언이다. WU-C에서는 현재 24개 전체 파일명을 정렬된 배열로 단언하고 길이도 배열에서 도출한다. WU-D의 `OfficeEditorAppPage.tsx`는 통합 단계에서 목록에 추가해 25개로 만든다.

2. **OperationProgress coral indicator `bg-red-700` → 모든 accent의 `bg-primary`**
   - 낡은 단언: `tests/unit/p1b-components.test.ts:45-52`, 특히 `coral: "bg-red-700"`.
   - 현재 근거: `src/components/OperationProgress.tsx:13-21`의 7개 indicator 값은 모두 `bg-primary`; `:23-31`의 7개 state 값은 모두 `bg-[var(--brand-soft)] text-[var(--brand-on-bg)]`다. 오류는 `:82`의 red 상태 타일과 `:97`의 `bg-red-700` indicator로 별도 분기한다.
   - 유입: `92925e8`이 per-accent 색을 승인된 단일 primary/brand 토큰으로 전환했다.
   - 판정: 제품 계약이 아니라 테스트가 낡았다. 7 accent의 공통 primary/brand 토큰과 오류 상태색 분리를 각각 단언한다. 소비자 수 16(`src/features` 내 `<OperationProgress`)은 현재와 일치한다.

3. **ToolCard 루트 class 정규식에 `group` 누락**
   - 낡은 단언: `tests/unit/p1b-components.test.ts:61-63`은 class 문자열이 곧바로 `ui-tool-card`로 시작한다고 가정한다.
   - 현재 근거: `src/components/ToolCard.tsx:21-26`, 특히 `:24`의 ``group ui-tool-card ui-accent-${tool.accent}``.
   - 유입: `eea9b1e`.
   - 판정: 상호작용 스타일용 `group`이 추가된 현재 루트 계약에 맞춰 정규식을 갱신한다. `as={Link}`, 링크 경로와 추적 단언은 보존한다.

4. **ToolCard 아이콘 class lookup `toolIconAccentClasses[tool.accent]` → `getToolIconTone(tool.id)`**
   - 낡은 단언: `tests/unit/p1b-components.test.ts:66`.
   - 현재 근거: `src/components/ToolCard.tsx:8,29`; tone 매핑 구현은 `src/components/toolAccentStyles.ts:3-35`.
   - 유입: `eea9b1e`.
   - 판정: 도구 ID 기반 4개 icon tone 계약으로 승인된 변경이다. 함수 호출을 직접 단언한다.

5. **ToolCard 아이콘 attribute `data-accent` → `data-icon-tone`**
   - 낡은 단언: `tests/unit/p1b-components.test.ts:67`.
   - 현재 근거: `src/components/ToolCard.tsx:29`의 `data-icon-tone={getToolIconTone(tool.id)}`.
   - 유입: `eea9b1e`.
   - 판정: icon tone 선택자를 노출하는 현재 계약으로 단언을 갱신한다.

## 유지 계약과 별도 회부

- 유지: ToolGuide 구조/현지화 eyebrow, OperationProgress stage·spinner·percentage·progressbar·로그 접근성, ToolCard 링크·추적·태그 최대 3개·arrow, KO/EN switcher 접근성.
- 7색 registry 및 `toolAccentStyles.ts` 키 존재 단언은 유지한다. 이는 registry 계약의 완전성 검사이며 실제 색 렌더링 증명은 아니다.
- 별도 회부: `src/components/ToolCard.tsx:34`와 현재 테스트 `tests/unit/p1b-components.test.ts:68-70`은 제목을 `h2`로 고정하지만, PLAN이 인용한 `ui-theme-redesign-20260907:159` 정본은 `h3`다. merge `c5b64f6`에서 해당 브랜치의 `h3`가 `h2`로 바뀐 이력이 확인된다. WU-C 범위에서는 제품과 기대값을 모두 변경하지 않고 사용자 결정 대상으로 남긴다.

## Excel checkbox 원인 판정

- `src/features/excel-cleaner/ExcelCleanerPage.tsx:231`의 `accent-primary`는 Tailwind가 `accent-color: var(--primary)`로 생성하는 유효 utility이며 죽은 클래스가 아니다.
- `tests/unit/ui-legacy-isolation.test.ts`의 광역 `accent-` 금지 접두어와 이름이 충돌한다. 제품 동작을 유지하면서 금지 토큰만 제거하기 위해 같은 CSS 선언의 arbitrary utility `[accent-color:var(--primary)]`로 치환한다. React 상태·이벤트·렌더 구조는 바꾸지 않는다.
