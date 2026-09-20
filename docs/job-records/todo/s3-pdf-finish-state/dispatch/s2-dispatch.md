# 작업지시서 — S2 하네스 확장(S2-H) + 성능 묶음 측정·CLS 수정(S2-P 1차) (2026-09-06, Claude → Codex gpt-6-astra)

## 0. 선독(순서대로)
1. `PROJECT_RULES.md` 전문 — 「검증은 실행이다」·「생성물 직접 수정 금지」·「실행 게이트」(광역 금지 계약: 최소 허용목록, glob 자기 생성 금지)·「현지화·SEO·AdSense 동시 검토」·「내부 구현 비노출」.
2. `AGENTS.md`.
3. **정본** `docs/jobs/todo/roadmap-completion-20260906.md` §2 공통 계약 · **§3 S2 절 전문**(S2-H ①~④ · S2-P) · 「완료 기준 검증 명령 총람」 S2 행 · 「진행 기록」 S0·S1 절(직전 두 단위의 결과·기존 결함 목록).
4. `docs/backlog.md` — 「ZIP 출력 공통」(2건) · 「배포 후 라이브 감사에서 나온 기존 결함」(3건 — 이 중 접근성 2건은 S2-H ③ 의 판단 입력).
5. 자신의 앞선 왕복 실측(1~4차): CLS=1 주입도 통과 · a11y 기본 10·페이지 하드코딩 · `tool-registry-routes.mjs:48` `!== 20` · NaN 거짓 통과 · 중복 ID 통과 · ExcelJS 정적 import(`inputAdapter.ts:2`) · CLS 0.114199 후보(`App.tsx` fallback 클래스·`min-height:55vh`·Outlet 뒤 footer).

## 1. 성격·기준
- **파일 수정이 필요한 구현 작업(쓰기 모드).** 브랜치 커밋 필수, **main 병합·push 금지**(§8).
- 저장소 루트 `/home/better0101/projects/worklazytools`. **기준 해시 `main` = `15b31c1a38a6f39628046e988ae2b1ce92881fe9`**(S1 병합·사후 기록 후 — Claude 실측). 착수 시 `git rev-parse main origin/main` 대조, 다르면 중단·보고.
- 브랜치: `git checkout -b s2-harness-perf main`. untracked 사용자 파일 3개 수정·추적·삭제 금지.
- 열린 계획서 충돌 검사는 Claude 가 수행했다(측정기·QR·CLS 표면에 상반 지시 0). 발견 시 보고.
- S0 에서 생긴 `tests/blank-page-recovery-smoke.mjs`·`RouteErrorBoundary`·`startup-help` 와 S1 의 CSS 541 rules 를 전제로 한다(라인 인용은 착수 시 재grep).

## 2. S2-H — 하네스 확장(먼저 · 각 항목 unit 은 "현행 통과 + 초과 주입 실패" 두 방향 단언)
### ① 번들 측정기 `scripts/measure-bundle-budget.mjs`
- `budgetLimits`(:18)·`compareWithBaseline()`(:213): 지표별 override(예: 환경변수 `BUNDLE_LIMIT_<METRIC>` 또는 JSON) — 기본값은 현행 5종(entry +20 · route +60 · shared +30 · app +80 · CSS +10 KB) 유지, override 는 **기록에 남는 형태**로만(지시서·CHANGELOG 에 사유 없이 상한을 올리는 용도 금지 — 스크립트가 override 사용 시 출력에 명시).
- `measureOutput()`(:47): **신규 route 기준점 처리** — 현재 빌드에 존재하는 route 만 기준 기여 0 으로 처리, `BUNDLE_ROUTES` 오타·비 lazy route 는 계속 거부(:125 유지).
- **`appJsGzip` 등 지표 누락 시 NaN 거짓 통과 수정** — 5종 전부 유한 정수 검증(baseline·current 양쪽), 아니면 throw.
- **route→shared 귀속 변경과 실제 증분 분리 리포트** — 동일 청크가 route 에서 shared 로 이동한 경우 "이동"과 "순증분"을 따로 출력.
- unit(`tests/unit/bundle-budget.test.ts` 신설): 5종 각각 상한 통과 · +1B 실패 · NaN/누락 실패 · 신규 route 기준 0 · 오타 route 거부 · 이동/증분 분리 — 실제 함수 import(측정기를 함수 export 형태로 리팩터해도 됨, 실행 진입점 동작 불변).
### ② 렌더링 기준선 `tests/rendering-baseline.mjs`
- 현행은 **CLS=1 주입도 통과**(판정 없음). `targets`(:16) 데이터화 + layout-shift observer 에 **`sources`(요소·전후 rect) 수집** + **판정**(`RENDER_MAX_CLS`, 기본 **0.1**, 페이지별 실측 최댓값으로 차단).
- unit: CLS **0.1 통과 · 0.100001 실패** · sources 수집 내용 단언 · 페이지 등록 누락 검사(등록 목록과 실제 측정 결과 대조).
- **S2-H 완료 시점에는 문서 비교·PDF(0.114199)가 이 게이트에 걸리는 것이 정상** — S2-P CLS 수정으로 해소한 뒤 브랜치 완료 기준에서 ≤0.1 실측.
### ③ 접근성 감사 `tests/accessibility-audit.mjs`
- `pages`(:20) 등록과 집계·판정(:111~:132) 분리. unit: 기존 결과 JSON total=0 통과 · 위반 1건 주입 실패 · 페이지 등록 누락 검사.
- **판단 입력(backlog 2건)**: (a) 모바일 하단 탭 대비 3.06 — mobile viewport 를 감사에 넣으면 즉시 실패. (b) HWP 편집기 페이지 — 벤더 iframe 내부 위반 4노드. **이번 단위 결정**: 감사에 **mobile viewport(Pixel 7 폭 412) 홈·도구 목록 ko** 를 추가하고, 하단 탭 라벨 색 토큰을 **4.5:1 이상**으로 조정하는 **1줄 수정**을 S2-P 에 포함(UI 변경 → 시각 기준선 갱신 사유 기록 · Gemini 로컬 검수 대상). HWP 페이지는 **등록하되 벤더 iframe(`iframe[title="rhwp HWP 문서 편집기"]`) 을 목적·소유자 명시 예외로 제외**(axe `exclude`; 광역 wildcard 금지, 예외 목록에 "rhwp Studio 0.8.6 상류 소유 · backlog 항목 참조" 주석). 예외 목록은 최소 허용목록 형태로 데이터화하고 unit 에서 항목 수·사유 존재를 단언.
- 완료 기준에 **현 HEAD 새 브라우저 측정 `A11Y_MAX_TOTAL=0`** 포함(기존 JSON 재사용 금지).
### ④ 도구 목록 `tests/tool-registry-routes.mjs`
- `:48` `!== 20` 하드코딩 → **독립 기대 목록 데이터**(도구 id 배열 — 레지스트리에서 자기 생성 금지) + **누락·중복 검사**(현행은 동일 개수 중복 ID 통과). unit: 현행 통과 · 누락 1 실패 · 중복 1 실패.

## 3. S2-P — 성능 묶음(측정 → 정지점 → 구현)
### QR 4단계 브라우저 계측(측정만 — 감량 구현은 사용자 목표 확정 후 별도 디스패치)
- 번들 측정기는 dynamic import 합산이라 단계별 비용 불가 → 기존 QR 스모크(`tests/qr-bulk-smoke.mjs`·`utility-tools-smoke.mjs` 의 QR 경로) 조작 경로에 Playwright/CDP 계측 스크립트 신설(`tests/qr-stage-metrics.mjs` 류, npm script `measure:qr`).
- 단계 = **진입 → 파일 선택 완료 → 생성·manifest 완료 → PDF 완료**. 새 context · SW 차단 · 캐시 고정. 단계별로 **페이지+worker 요청 URL·전송량·캐시 여부, JS gzip 별도, PDF 폰트 요청 포함**. 사실 정정 반영: `inputAdapter.ts:2` 정적 import 로 **ExcelJS 는 파일 선택 단계에서 로드** — 표에 그 귀속을 명시.
- 산출: 단계 × (요청 수·전송 B·JS gzip B·누적) 표 + 상위 10 청크 표 + "감량 여지 후보(근거 포함)" 3개 이내. **목표 수치는 제안하지 말고 사실만** — 목표는 사용자 정지점.
### CLS(구현 포함 — 목표 ≤0.1 은 정본 확정)
- S2-H ② 의 `sources` 로 문서 비교·PDF(0.114199)·홈 원인 확정(후보: `App.tsx` Suspense fallback 클래스·`min-height:55vh` 예약 부족·Outlet 뒤 footer 밀림·폰트 스왑) → 레이아웃 예약 수정 → **3페이지 ≤0.1 실측**(3회 반복 최댓값). S0 의 `RouteErrorBoundary`/`startup-help` 55vh 예약과 정합 유지.
- UI 영향 있는 수정(예약 높이 등)은 시각 회귀 결과에 나타날 수 있다 — 기준선 갱신은 사유·diff 이미지 경로와 함께.
### ZIP
- `jszip` 패키지 제거는 **제외**(명시). C3 출력 통합 판정을 위한 **소비 표**(어느 도구가 `@zip.js/zip.js` vs `jszip` 을 쓰는지·한글 파일명·zip64·스트리밍 여부) + 같은 입력(한글 파일명 fixture)으로 두 구현 산출 ZIP 을 `unzip -l`·Python `zipfile` 로 이름 보존 대조 → 판정은 보고(통합 구현은 하지 않음).
- `src/utils/zipArchive.ts` `zipWriter.add(...)` 에 **`useUnicodeFileNames: true` 명시**(방어적) + 한글 파일명 fixture unit/스모크 1건.
### 하단 탭 대비(③ 결정에 따른 1줄 수정)
- `.bottom-tab > span` 비활성 색 토큰을 `#fbfbfd` 배경 대비 ≥4.5:1 로(예: `--label-secondary` 계열 실측값 기록). 활성/비활성 구분이 유지되는지 스크린샷.

## 4. 제품 규칙 점검
- 신규 사용자 노출 문구 없음(있으면 ko/en·비노출 검사). 하단 탭 색 변경은 ko/en 공통.
- SEO·정적·사이트맵 변화 0(`test:static`). 광고 격리 영향 0.
- 측정 스크립트가 `page.route` 로 캐시를 끄는 경우 QR 계측에서만 허용하고 문서화(S0 의 stale-document 실측 계약과 혼동 금지).

## 5. 검증(전부 실행·기록)
공통 총람 전부: `npm run build` · `npx tsc -b` · `npm run test:unit`(신규 unit 포함) · `npm run test:static` · `npm run test:browser` · `npm run test:new-tools` · `npm run test:utilities` · `npm run test:office` · `npm run test:qr-bulk` · `npm run test:recovery` · `node tests/tool-registry-routes.mjs` · `LANG=ko_KR.UTF-8 npm run test:visual` · `LANG=en_US.UTF-8 npm run test:visual`(갱신 시 사유) · `VITE_LOCAL_QA=1 npm run build` 후 `A11Y_MAX_TOTAL=0 npm run test:a11y`(**확장된 페이지 목록으로 새 측정**) · `npm run test:rendering`(**절대 게이트 ≤0.1 통과 실측**) · `npm run bundle:measure`(착수 시 main production 빌드 기준 `/tmp/s2-bundle-baseline.json`, 5종 상한 내 + 이동/증분 분리 출력) · `npm run css:orphans` · `npm run legacy:manifest` · `git diff --check` · 신규 `npm run measure:qr`(표 산출).
- 마지막에 `dist/` 는 `VITE_LOCAL_QA=1` 빌드로 남기고 검수 서버 기동 명령·검수 경로(홈 ko/en 모바일 하단 탭 · 문서 비교 · PDF 도구 · QR 스튜디오) 보고.

## 6. 기록(브랜치, 병합 전)
`CHANGELOG.md` 코드 변경 요약(하네스 4항·CLS 수정·하단 탭·zip 옵션), 서명 Codx. `docs/review-notes.md` S2 절: 각 unit 의 두 방향 단언 표 · CLS sources 원인표(전후 수치) · QR 4단계 표 · ZIP 소비 표·대조 결과 · a11y 예외 목록과 사유 · 번들 5종 delta. 서명 Codx. 정본 계획서는 수정하지 않는다.

## 7. 커밋
브랜치 `s2-harness-perf` 에 논리 단위 커밋(S2-H ①~④ 각각 또는 묶음 / CLS / a11y 확장+하단 탭 / zip / QR 계측 / 기록). 영어 한 줄. `git add -A`·squash·rebase·force 금지. dist·로그·사용자 파일 커밋 금지. **새 npm 의존 추가 금지**(필요하면 사유와 함께 먼저 보고).

## 8. 정지점 — main 병합·push 금지 · QR 목표는 사용자 결정
완료 기준 통과 후 브랜치 상태로 멈춘다. **QR 감량 구현은 이 지시서 범위 밖** — 계측 표를 보고하면 Claude 가 사용자에게 목표를 묻고 별도 디스패치한다. 종료 시 `git status --porcelain`·`git log --oneline main..s2-harness-perf`·`git diff --stat main..s2-harness-perf` 원문.

## 9. 보고 형식
착수 게이트 · S2-H 4항목별 변경·unit 두 방향 결과 · CLS 원인표·전후 수치(3페이지×3회) · a11y 확장 목록·예외 목록·새 측정 결과 · 하단 탭 대비 전후 · QR 4단계 표 + 상위 청크 표 + 감량 여지 후보(사실만) · ZIP 소비 표·대조 결과·판정 제안 · 번들 5종 delta(이동/증분 분리) · §5 검증표 · 제품 규칙 점검표 · 범위 밖 발견 · 검수 기동 안내 · §8 정지 상태.
