# 작업계획서 — Excel 병합기 시트 선택 가로 그리드 (2026-09-02)

**상태: 정본 (2026-09-02 정본화 — 2차 왕복에서 Codex "[정본화 가능] 이견 0" 판정. 10건 전부 해소·새 모순 없음·열린 계획 충돌 없음 확인.)**
기준 해시: `b98efdea71626d26a32ec2f202b96a56a812dc83`
발동: 사용자 `!계획!`.

## 0. 배경 (실측 근거)

- 시트 선택기: 세로 flex(`global.css:621`), 파일별 전체 폭 그룹 스택(`ExcelMergerPage.tsx:745-798`) — 세로로 길어짐.
- **가용 폭(Codex 실측)**: `.tool-page` 최대 1030px에서 우측 summary 275px+gap 차감 후 섹션 내부 폭 599~693px — `minmax(260px,1fr)`로는 **최대 2열**(3~4열 불가). 821px 부근에는 폭 역전(내부 186px)으로 260px 최소 트랙 overflow 위험.
- 선택 모드 의미(Codex 실측): `all`→전체, `custom`→`selectedSheetNames`(toggleSheet가 이것만 변경), `positions`→패턴 계산(`:955-991`). 데스크톱 우측 summary는 **이미 sticky**이며 파일 수·선택 시트 수 표시(`global.css:496`, `:669-683`); 820px 이하에서 static 전환(`global.css:2054`).
- 공용 경로: `/tools/excel-merger`와 `/tools/excel-merger/xls-preserve`가 같은 `ExcelMergerPage` 사용(App.tsx:48-49). 대상 CSS 클래스의 타 도구 재사용 없음(rg 실측).

## 1. 변경 내용

### E1. 파일 카드 그리드 — **목표: 가용 폭 기준 1~2열** (Codex 실측 수용)
- `repeat(auto-fill, minmax(min(100%, 260px), 1fr))` — 821px 부근 overflow 방지 계약 포함. 2열만으로도 세로 길이 약 절반. Excel 전용 페이지 폭 확대는 범위 밖(별건).

### E2. 시트 칩 — **custom 모드만 인터랙티브** (Codex 반박 수용)
- `custom`: `<button type="button" aria-pressed>` 칩 토글. `all`/`positions`: **동일 칩 모양의 비인터랙티브 상태 표시**(버튼 아님 — 클릭해도 모드 로직과 어긋나는 조작 방지). 전체 선택/해제는 custom 전용 유지.
- 접근성: 파일 카드 `<section>`에 heading/`aria-labelledby` 부여, 긴 이름은 CSS ellipsis+`title`(aria-label은 전체 이름 유지), `:focus-visible` 스타일, 모바일 44px 터치 타깃.

### E3. 카드 높이 — **목록 viewport에만 max-height** (헤더 상시 노출)
- `max-height`/`overflow:auto`는 `.sheet-name-list`(또는 신규 목록 viewport)에만 적용 — 파일명·선택 수·전체 선택 버튼은 고정. 칩은 wrap 배치.
- 검증: 20+칩에서 `clientHeight < scrollHeight`, 키보드 포커스 이동 시 내부 스크롤 동작, 모바일 1열에서 내부/페이지 스크롤 비충돌.

### E4. 선택 요약 — **모바일 전용으로 축소** (Codex 반박 수용)
- 데스크톱: 기존 우측 sticky summary 재사용(중복 추가 없음). 820px 이하에서만 Step 2 내부 compact sticky 요약(모바일 header 고려 top offset+safe-area). 신규 문구 ko/en.

## 2. 명시 제외

- 1단계 파일 목록(`ExcelFileList`) 레이아웃 / 시트 선택 모드 로직 / 병합 로직·워커.
- SEO·정적 페이지: 기능 변화 없음 → **변경 불필요 판단을 여기 기록**(「현지화·SEO·AdSense 동시 검토」 점검 완료).

## 3. 검증·완료 기준 (Codex 실측 확정 명령)

- `npm run build` · `npm run test:unit` · `TEST_SCOPE=excel npm run test:browser` · `npm run test:xls-preserve`(공용 컴포넌트 회귀) · `npm run test:static`.
- **기존 스모크 갱신**: `browser-smoke.mjs:422`의 checkbox 셀렉터 → aria-pressed 버튼 기반으로 교체(개편과 동시).
- 신규 fixture·검증: 이름이 다른 6개+ 파일(동일 파일 반복은 key 중복 제외됨 — `:139-169`), 20+시트 파일, 데스크톱 실제 열 수·selector 전체 높이·목록 scrollHeight/clientHeight 계측, 모바일 1열·가로 overflow 없음, custom `aria-pressed`·전체 선택/해제, all/positions 비인터랙티브·패턴 표시 유지, 긴 이름 ellipsis·accessible name.
- `CHANGELOG.md` 기록(Codx).

## 4. 반박 기록

### Codex 1차 (2026-09-02, 완료 — 수정 목록 10건 전원 수용, 판정 "재왕복 필요" → v2 반영)
- 핵심 수용: "2~4열" 목표를 실측 기반 "1~2열"로 정정(E1) / 821px overflow 계약(E1) / custom만 토글·나머지 상태 칩(E2) / 접근성 기준(E2) / max-height는 목록 한정(E3) / E4 모바일 전용 축소 / checkbox 스모크 갱신 / 6파일·20시트 fixture / xls-preserve 회귀 명시 / SEO 불필요 판단 기록.
- 규모 재평가: "CSS만 바꾸는 초소형"이 아니라 DOM·접근성·스모크를 함께 바꾸는 소형~중소형 UI 변경.

### Codex 2차 (2026-09-02, 완료 — 10건 전부 해소 확인, 새 모순 없음, **"[정본화 가능] 이견 0" 선언** → 정본 확정)
- 착수는 비디오 계획 1단계(진행 중) 완료 후 순차(코드 단일 작성자 직렬화).

## 실행 게이트 기록 (2026-09-02, Codx)

- 기준 해시 게이트: `git diff b98efde..HEAD --stat` 결과는 `CHANGELOG.md`, `CLAUDE.md`, `scripts/benchmark-video-vp9.mjs`, `src/features/video-studio/videoEncoding.ts`, `tests/fixtures/video-vp9-benchmark.mp4`, `tests/unit/video-encoding.test.ts`의 6개 파일(206 insertions, 2 deletions)뿐이었다. Excel 코드·스타일·테스트 표면 변경은 0건으로 계획 전제가 유지됨을 확인했다.
- 열린 계획서 충돌 검사: `docs/jobs/todo`의 정본 계획은 본 Excel 계획 외에 `video-studio-performance-plan-20260902.md`, `image-studio-ux-plan-20260902.md` 두 건이다. 두 계획의 대상 표면은 각각 video-studio와 image-studio 전용 코드·자산·테스트이며, 본 계획의 `ExcelMergerPage`·Excel selector CSS·Excel browser smoke 표면과 겹치지 않아 충돌 없음으로 판정했다.

## 구현·검증 기록 (2026-09-02, Codx)

- 구현: E1 1~2열 grid와 821px min-width 수축, E2 custom `aria-pressed` 버튼/all·positions 상태 칩·heading·ellipsis·focus·44px, E3 목록 전용 204px 내부 스크롤과 wrap, E4 820px 이하 Step 2 sticky 요약 및 ko/en 문구를 반영했다. 390px 실측에서 긴 파일명의 intrinsic 폭이 상위 grid를 778px로 늘리는 결함을 신규 스모크가 검출해 Excel `.workflow-main { min-width: 0; }`으로 수리했다.
- `npm run build` → exit 0, 2,336 modules transformed, 55 localized crawlable pages generated.
- `npm run test:unit` → exit 0, 58 tests / 58 pass / 0 fail.
- `TEST_SCOPE=excel npm run test:browser` → exit 0. 첫 시도는 Vite 최초 dependency optimization 재로드로 실패했고 준비 완료 후 재실행; 390px intrinsic overflow 수리 뒤 최종 실행에서 Excel 범위 전체 통과.
- `npm run test:xls-preserve` → exit 0, four XLSX states / three XLS preservation states / 83 progress states. 첫 시도는 4173 preview 미기동으로 `ERR_CONNECTION_REFUSED`; 최신 재빌드·preview 기동 후 최종 통과.
- `npm run test:static` → exit 0, localized pages·hreflang·self-hosted runtimes·ads.txt·robots.txt·sitemap.xml 통과. `git diff --check`도 exit 0.
