# 작업지시서 — P2 기존 도구 내부 UI 전환 (2026-09-04)

**상태: 정본 (2026-09-04 정본화 — 5차 왕복에서 Codex "이견 0"·[정본화 가능] 선언. "v2 확정 사항"(v3~v5 정정 포함)이 우선 계약.)**
기준: `ui-migration` 브랜치 `4a8405c`(main `311c59e`에서 분기). **전 작업 브랜치 전용 — main push 금지, 묶음마다 로컬 시각 검수(Gemini 브라우저) 통과가 다음 묶음 착수 조건**(`PROJECT_RULES.md` 「배포 전 로컬 시각 검수」).

## 진행 현황 (2026-09-05 기준 — 묶음 완료 시 Claude 갱신)

| 묶음 | 대상 | 커밋 | legacy(removed/active) | 검수 | 상태 |
|---|---|---|---|---|---|
| B1 | 소형 6종 | — | — | Gemini 2차 144장 [배포 가능] | ✅ 통과 |
| B2 | 변환·시차·병합·HWP·오피스 | `4ecda00` | 17 / 136 | 108장 [배포 가능] | ✅ 통과 |
| B3 | 문서 비교·Excel 정리 ← **사고 지점** | `84e8091` | 31 / 121 | 80장 [배포 가능] · 증상 3종 미관찰 | ✅ 통과 |
| B4 | Excel 병합·비교·QR | `c60f221` | 82 / 68 | 96장 [배포 가능] · 개선 2건 채택 | ✅ 통과 |
| B5a | 오디오·PDF | `9c2b38c` | 96 / 50 | 80장 [배포 가능] · 개선 1건 채택 | ✅ 통과 |
| B5b | 비디오 | `2b1aabd` | 98 / 48 | 32장 [배포 가능] · **엔진 diff 0** | ✅ 통과 |
| B6 | 이미지 | `a2d74ba` → `556a8b1` | 110 / 37 | 1차 56장 [수정 필요] → **재검수 64장 차단 0·회귀 0** | ✅ 통과(검증 공백 1건 이관) |
| B-shared | 공용 화면 + 접근성 + 개선 3건 + 이관 6건 | `3588eba` | 149 removed·1 split·5 active | **160장 [배포 가능]** · 접근성 **9→0** · 개선 3건 전부 개선 확인 | ✅ 통과 |
| P-final | 잔여 legacy·토큰 단일화·orphan | `3f0cf3b` → `0663c74` | 149 removed·1 split·5 active · **orphan 0** | P-QA 검수에 통합 | ✅ 통과 |
| P-QA | 전수 검수 + 접근성 게이트 + 렌더링 기준선 | `3807644` → `6fc458f` | — | **604장 [수정 필요] → 차단 2건 수정 → 재검수 36장 [배포 가능]** | ✅ 통과 |
| 배포 | main 병합 (**merge commit** — 2026-09-06 사용자 결정) | `1ff9187` · 기록 `4d0bae9` | — | 게이트 ⑥ 라이브 5페이지 axe 0 · 7화면 검수 통과 | ✅ **라이브 배포·검증 완료** |

**legacy CSS 진척**: 155개 중 **149 제거 · 1 split · 5 active**(B-shared 구현 종료, P-final 인계 6엔트리).

**⚠ 인계 수치 확인 필요**: B6 보고의 B-shared 인계 목록은 "공용 21 + 교차 공용 23 + AppShell compact 1 = **45**"인데 active 는 **37**이다. **8개 차이**가 split 규칙 중복 계상인지 다른 분류인지 **B-shared 착수 시 첫 산출물로 대조·확정**할 것. 인계 목록이 틀리면 P-final 이 잔여를 놓친다.

**누적 예산**(묶음별 통과 ≠ 누적 통과 — P-final 에서 분기점 `4a8405c` 대비 재측정 필수): entry 계열은 묶음마다 ±수십B~+1.8KiB, CSS 는 지속 감소(B5a −2,140B · B5b −1,733B).

**미해결 부채**: B-shared 구현 후 지정 5페이지 axe 0건, 토글 `aria-describedby`·라벨 클릭 공백 해소. P-final legacy 인계 6엔트리.

## 범위

P1까지 전환된 것은 **공용 표면**뿐(ui.tsx 8종·ToolGuide·OperationProgress·ToolCard·LanguageSwitcher·AppShell). P2는 **각 도구 전용 화면 내부**를 shadcn 기반으로 전환하고 그 도구가 소비하던 legacy CSS를 소유권 규칙에 따라 제거한다.

## v2 확정 사항 (1차 왕복 6건 — 우선 계약)

1. **legacy 잔여 수치 정정·소유권 manifest 선행**: `HEAD` 실측은 **class 규칙 2,104개**(전체 rule 2,132)이며, adapter exact token 52개 적용 시 잔여는 **155개**다(초안의 143은 `compact` 12개 규칙 누락분 — L192·730·731·1224·1364~1366·1794·1877·1967·2265·2324 포함해 계약). **선행 산출물: owner/refcount manifest** — 각 규칙에 소비 도구·공용 화면·마지막 제거 묶음을 기록. **삭제 계약**: 도구 전환 시 그 도구의 legacy class 방출은 0으로 만들되, **CSS 규칙 삭제는 refcount 0일 때만**. `.primary-button, .ui-primary-button` 같은 혼합 selector는 규칙 전체 삭제 금지 — **legacy selector arm만 분리 제거**. 분포(실측·합계 143 기준, compact 12 별도): 교차 공용 31 · AppShell 등 P2 비대상 공용 21 · orphan 2(`.drop-hint-segment` L589·`.file-list` L609 — 선행 정리) · excel-compare 26 · excel-merger 17 · 문서 비교 스택 13 · image-studio 7 · pdf-editor 5 · office-editor 4 · audio-studio 4 · text-merger 3 · hwp-editor 2 · video-studio 2 · excel-cleaner 2 · qr-studio 2 · timezone 1 · security 1. **21개 공용 규칙은 P2-shared 묶음이 처리**(v3 정정 — 아래 확정 8항에 실행 단계 신설). 교차 공용 31개는 마지막 소비 도구 묶음에서 refcount 0 도달 시 삭제.
2. **도구 수·묶음 재정의**: 등록 가용 route는 **20개**(초안 22는 feature 디렉터리 수). `/word-compare`·`/hwp-compare`는 독립 도구가 아니라 **`/document-compare` redirect**이며, `HwpComparePage`(231줄)·`HwpCompareResultPage`(19줄)·`WordComparePage`(318줄)는 **route 도달성 없음** — **판정: P2 명시 제외 + 별도 "도달 불가 컴포넌트 제거" 검토 항목으로 backlog 이관**(제거는 사용처 재확인 후 별도 단위). 살아 있는 결과 화면은 `DocumentCompareResultPage → WordCompareResultPage`.
3. **묶음 분할(재조정 — TSX 줄 수 실측 반영)**: B1(289줄·6개 — 소형이라 6개 예외 명시) · B2(1,281줄·5개) · B3(1,986줄) · B4(1,883줄) · **B5a: audio-studio+pdf-editor** · **B5b: video-studio 단독**(feature 전체 TS/TSX 7,870줄 — B6보다 큼) · B6: image-studio 단독(3,312줄).
   - B1: text-formatter · work-calculator · payroll-calculator · security-tools · image-privacy · text-tools
   - B2: data-converter · timezone-calculator · text-merger · hwp-editor · office-editor
   - B3: **document-compare 제품 화면 + Word 결과 화면 + HWP/Word 처리 시나리오 + excel-cleaner** ← 라이브 사고 지점, 증상 3종 부재 단언 필수
   - B4: excel-merger · excel-compare · qr-studio(U3 신규 화면 정합)
4. **묶음별 스모크 고정(실측 매핑)**: B1·B2 소형 = `npm run test:utilities` / hwp-editor = `TEST_ONLY_HWP=1 npm run test:new-tools`(+영문 redirect는 utilities) / office-editor = `test:office` / 문서 비교 = `TEST_SCOPE=word npm run test:browser` + `TEST_ONLY_HWP=1 test:new-tools` + **`test:ui-migration`**(사고 증상) / excel-cleaner = `test:excel-cleaner` / excel-merger = `TEST_SCOPE=excel test:browser`+`test:xls-preserve`+`test:xls-first-load` / excel-compare = `test:excel-compare` / qr-studio = `test:utilities`(+U3 후 `test:qr-bulk`) / audio = `TEST_ONLY_AUDIO=1 test:new-tools` / pdf = `TEST_SCOPE=pdf test:browser` / video = `TEST_ONLY_VIDEO=1 test:new-tools`+`test:video-hybrid` / image = `TEST_ONLY_IMAGE=1 test:new-tools`(+`TEST_ONLY_IMAGE_SIZING=1`). **보강 필요**: work-calculator 스모크가 기본 결과 문자열만 확인 — 모드 변경 후 결과 단언 추가.
5. **예산 측정 확장·합격 기준(v3 수치 고정·v4 집계 계약 확정)**: **고정 집계 스크립트 `scripts/measure-bundle-budget.mjs` 신설**(npm script `bundle:measure` — 수기 집계 금지) — `npm run build` 후 실행.
   - **포함 경로**: `dist/assets/**/*.js` · `dist/*.js`(service-worker 포함) · **`dist/tools/video-studio/workers/**/*.js`**(v4 추가 — vite worker 출력이 이 경로라 v3 범위에서 누락 실측) · CSS는 `dist/assets/**/*.css` + `dist/**/*.css`.
   - **제외 경로**: `dist/vendor/**`(벤더 런타임) · 비디오 `runtime/**` · **정적 생성기가 만든 ko/en 페이지의 복제 자산**(동일 해시 파일은 1회만 집계 — 중복 계상 금지).
   - **분류 규칙(v5 정정 — 매니페스트 확보·worker 귀속)**: 측정은 **배포 산출물을 건드리지 않는 별도 빌드**로 수행 — `vite build --manifest --outDir dist-measure`(측정 후 `dist-measure` 삭제, `dist/`·배포 파이프라인 불변, `test:static` 영향 없음). 분류: **entry** = `index.html`이 직접 로드하는 진입 청크 / **route chunk** = 매니페스트(`dist-measure/.vite/manifest.json`)의 dynamic import 관계로 해당 도구 lazy 진입점에서 도달하는 청크 / **shared chunk** = 2개 이상 route 진입점에서 도달하는 청크. **worker 청크 귀속**: 출력 경로가 도구 하위인 워커(`dist/tools/<tool>/workers/**`)는 **해당 도구의 route chunk로 귀속**, 경로로 소유 도구를 판정할 수 없는 워커는 **shared로 분류**하고 판정 근거를 측정 리포트에 기록.
   - **상한(직전 묶음 종료 커밋 대비)**: ① entry JS gzip +20KB ② 영향 route chunk gzip 합 +60KB ③ **shared chunk gzip 총합 증분 +30KB**(v4 정정 — 신규 청크만이 아니라 **기존 shared 증가분 포함 합계**) ④ 전체 앱 JS gzip +80KB ⑤ 전체 CSS gzip +10KB(묶음 단위 — 전역 단일 import라 도구별 귀속 불가).
   - 초과 시 push 금지 — 원인(신규 primitive·상쇄된 legacy 크기)을 기록하고 사용자 판단 없이 면제하지 않는다. 한 묶음에 여러 도구가 있으면 **도구별 커밋 단위 측정** 기본, 불가 시에만 묶음 합산(사유 기록).
6. **시각 하네스 scenario 계층 선행(P2 착수 전 작업)**: 현행 하네스는 route당 4 profile·캡처 전 항상 `scrollTo(0,0)`·상태 모델 없음·파일명에 상태 개념 없음(실측 `visual-regression.mjs:84-95,122-134`) → **`tests/visual-regression.scenarios.mjs` 신설**: 각 항목 필드 **(v3 정정)** `scenarioId`·**`routeId`(하네스 route 연결)**·`stateId`·**`profiles`(상태별 조합 지정)**·**`profileReductionReason`(축약 사유 필수)**·`fixture`·`actions`·`ready/assert selector`·`bottomTargetSelector`·locale N/A 사유. **파일명에 `stateId`를 포함해 상태별 고유 파일 생성**(현행은 route+profile만이라 상태 간 덮어쓰기 발생). 상태는 **첫 화면·스크롤 최하단·상호작용(도구별 복수 허용)**. 대표 상호작용 상태 목록(실측 제안 채택): B1 포맷 결과·영업일 변경·급여 2모드·비밀번호 강도·이미지 정리 결과·텍스트 정돈 / B2 CSV→JSON·도시 추가 지도·혼합 병합·HWP 로드·Office workspace / B3 토글 ON·OFF·DOCX 결과·HWP 결과·cleaner 규칙/결과 / B4 병합 시트 선택·비교 모드/쌍·QR 생성·스캔 / B5 파형·효과·PDF 모드별 썸네일·비디오 그룹/트림 / B6 캔버스 로드·주요 패널·batch/collage/GIF(한 장으로 4탭 대표 금지). **규모 주의**: 완전 직곱 시 최소 496장 — profile 조합은 상태별로 축약 규칙을 두되 축약 사유를 manifest에 기록.
7. **모바일 최하단 기계적 assertion**(브랜치 QA 1회차 미확정 항목 해소): `excel-compare-smoke.mjs:158~197` 선례를 공용화해 **모든 등록 도구의 mobile bottom scenario에 적용** — ① `abs(scrollHeight − clientHeight − scrollTop) ≤ 1`(실제 최하단 도달) ② `.main-content` bottom padding ≥ `.bottom-tabs` 높이 ③ `.global-footer` bottom ≤ bottomTabs top + 1 ④ **(v3 추가) footer가 N/A인 화면은 `bottomTargetSelector`가 가리키는 마지막 조작부에 대해 `bottomTarget.bottom ≤ bottomTabs.top + 1` 단언**(대체 대상 없이 통과하는 구멍 차단 — N/A 사유만으로 면제 금지) ⑤ 수평 overflow ≤ 1px ⑥ assertion 후 `captureBeyondViewport:false` 캡처. **HWP 영문 redirect는 도구 하단 통과로 계산하지 말고 `/tools` redirect 검증으로 별도 기록**.
8. **P2-shared 묶음 신설(v3 — 실행 단계 부여)**: 도구 묶음(B1~B6) 종료 후 **P-final 이전에 `B-shared` 묶음 실행** — 대상: 공용 21개 규칙의 소비 화면(AppShell 주변·도구 목록·홈 등 P1에서 다루지 않은 공용 화면 조각)과 교차 공용 31개 중 잔존분. 스모크: `test:utilities`+`test:browser`(전 스코프)+`test:ui-migration`, scenario: 홈·도구 목록·대표 도구 3종의 3상태, 예산·검수 게이트는 도구 묶음과 동일. **B-shared 종료 시 legacy 잔여 규칙 목록을 P-final에 인계**(0이면 P-final은 토큰 단일화·orphan 검사만).
9. **상위 정본에서 이관된 개선 6건 편입(v3 — 담당 묶음 지정)**: ① PDF 도구 모바일 탭 가로 스크롤 단서(페이드 등) → **B5a** ② excel-compare 다크 선택 카드 테두리 대비 → **B4** ③ 카드 선택 상태 배경 틴트 보강 → **B-shared**(공용 카드 토큰) ④ 사이드바 활성 항목 대비 상향 → **B-shared** ⑤ Swap/Add 버튼 체급·affordance → **B4**(swap은 excel-compare 소유) ⑥ 라이트 테마 accent 채도 톤다운 검토 → **B-shared**(전역 토큰). 각 항목은 해당 묶음 완료 기준에 포함하고, 채택/기각 판정을 review-notes에 기록.

## 묶음 공통 계약

① legacy 방출 0 + refcount 기반 규칙 삭제(확정 1항) ② add는 실소비만·사유 기록 ③ 기능 계약 불변(확정 4항 스모크 통과) ④ 상태 커버리지 3종 채집(확정 6항) ⑤ **검수 게이트**: 추적 코드 제외 로컬 빌드 → Gemini 브라우저 검수(차단 결함 0) → 수정 → 재검수 통과해야 다음 묶음 ⑥ 접근성(role/aria·키보드·WCAG AA) 유지.

## 검증(묶음마다)

`npm run build` · `test:unit` · `test:visual`(scenario 확장) · 확정 4항 해당 스모크 · `test:static` + 확정 5항 예산 측정 + Gemini 검수 보고. 전 도구 묶음 종료 후 **B-shared**(확정 8항) → **P-final**(잔여 legacy·토큰 단일화·orphan 검사) → **P-QA**(전수 상호작용 검수) → main 병합·배포.

## 명시 제외

기능·문구 변경 · 신규 기능 추가 · 레이아웃 재설계 · 캔버스/엔진 내부 로직 · **도달 불가 컴포넌트 3종**(확정 2항 — backlog 이관).

## 하네스 재현성 결함 (2026-09-04 Claude 실측 — scenario 계층 작업에 편입)

브랜치 `62f9031`에서 `npm run test:visual` 전체 실행 시 **57건 실패(en 48·ko 9, 5~7%)**. 코드 회귀가 아니라 **하네스가 브라우저 UI 로케일을 고정하지 않아** 실행 셸의 `LANG`에 따라 결과가 달라지는 결함: `LANG=ko_KR.UTF-8`에서 Chrome UI가 한국어가 되어 **영어 페이지에도 네이티브 file input 라벨이 "파일 선택/선택된 파일 없음"으로 렌더** → 폭 변화 → 이하 레이아웃 전체 밀림(증거: `data-converter-empty__en__light__mobile.diff.png`). `visual-regression.mjs:63-72` launch args에 `--lang` 없음.

**계약 추가**: scenario 계층 작업에서 **로케일별 브라우저 인스턴스(또는 동등한 결정적 방법)로 UI 로케일 고정 + Accept-Language·타임존·폰트·애니메이션 고정**, 그리고 **두 로케일 셸(`ko_KR.UTF-8`·`en_US.UTF-8`)에서 각각 통과함을 재현성 증명으로 요구**. 이 수정 전의 기준선은 신뢰할 수 없으므로 **전 기준선 재생성**.

## 시각 회귀 실행 비용 (2026-09-04 Claude 실측 — 착수 전 개선 필요)

scenario 계층 확장 후 캡처 규모가 **151장/로케일 세트**로 늘어, 전체 `test:visual` 1회가 **3시간 내외**(실측: 25분에 20장 진행, 다른 태스크와 CPU 경합 시 더 느림). 두 로케일 재현성 검증까지 하면 6시간대. **P2는 묶음마다 이 검증을 돌리므로 그대로 두면 일정이 비현실적.**

**착수 전 개선 계약(B1 이전 선행)**: ① **캡처 병렬화**(브라우저 컨텍스트/페이지 동시 실행 — 결정성 유지 조건 하) ② **변경 영향 범위 한정 실행**(`VISUAL_ONLY=<scenarioId|routeId>` 등 필터로 묶음별 부분 실행, 전체 실행은 B-shared·P-final·P-QA에서만) ③ 실행 시간 측정치를 리포트에 기록. 개선 후 목표: **묶음 검증 1회 ≤ 20분**.

**달성 기록 (2026-09-04, Codx)**: 16코어 호스트 기본 동시성 4(`min(4, floor(core/2))`, `VISUAL_CONCURRENCY` 조정 가능)로 locale 전용 Chrome의 최대 12장 배치를 병렬 처리하고, 기존 locale·UTC·font·DPR·paint 계약을 유지했다. `VISUAL_ONLY`는 쉼표 다중 `scenarioId|routeId|toolId`를 지원하며 미지정 시 151장 전량이다. 전체는 개선 전 KO 5:16.32/EN 5:14.96에서 개선 후 KO **1:33.35**, EN **1:35.84**(각 151/151)로 평균 3.34배 단축됐다. `excel-compare,document-compare` 부분 실행은 해당 14장만 **16.53초**, 연속 재실행 **16.05초**에 14/14 동일 결과로 통과해 ≤20분 목표를 달성했다. 모든 실행 말미에 duration·captures·설정/실제 concurrency·filter를 기록한다. 상세 판정은 `docs/review-notes.md`의 같은 작업 단위에 있다.

## B1 검수 판정 (2026-09-04, Claude — Gemini 2회 검수 + Codex DOM 실측 교차)

- **1차 검수 무효**: 캡처 세트에 `bottom`(스크롤 최하단) 상태가 0장이라 "전 도구 모바일 하단 가림" 판정이 성립 불가(Claude 실측 — initial 48+interaction 48뿐). **검수 입력 결함**으로 판정하고 캡처 절차를 3상태 필수로 수정(공용 적용) 후 재채집(144장).
- **토글/탭 썸 이탈 지적 → 오탐 확정**: Codex DOM 실측 4도구·60 샘플 전부 **이탈 0px·수직 중심 오차 0px**(썸이 트랙 안쪽 사방 2~4px 여유), legacy 클래스 방출 0건. `test:control-geometry`(60/60)로 회귀 고정.
- **2차 검수(144장 전수) → 차단 결함 0·[배포 가능]**. 개선 권고도 없음.
- 검증: 시각 42/42(모바일 bottom 12 포함)·QA 재채집 144/144·unit 187/187·utilities·static·음성 대조 통과. 번들 예산 5종 통과(entry +64B·전체 앱 JS +3,566B·CSS −33B).
- **B1 통과 → B2 착수 조건 충족.**

## B2 검수 판정 (2026-09-04, Claude — Gemini 검수)

- Gemini 전수 검수 108장(initial 36·bottom 36·interaction 36) → **차단 결함 0·개선 권고 0·[배포 가능]**. `timezone-calculator`의 3상태(초기·하단·기준 도시 상호작용)를 포함해 모바일/데스크톱·다크/라이트 전 조합 확인.
- **B2 통과 → B3 착수 조건 충족.**

## B3 검수 판정 (2026-09-05, Claude — Gemini 검수 + Codex DOM 실측 + Claude 육안 교차)

- **사고 증상 3종 부재를 세 경로로 교차 확인**(라이브 파손 지점이라 단언 필수):
  - Codex DOM 실측 — 토글 32표본 이탈 0px·수직 중심 오차 0px·최소 내부 여백 2px, 문서 쌍 텍스트 폭 747px·전부 `horizontal-tb`·세로 낙하 0건·overflow 0px, 버튼 190×48px·`w-full` 충돌 0건·legacy selector match 0건.
  - Gemini 전수 검수 80장(initial 16·bottom 16·interaction 48) — 글자 쏠림/세로 낙하 **미관찰**, 버튼 비정상 확장 **미관찰**, 토글 썸 이탈 **미관찰**. 차단 결함 0·개선 권고 0·[배포 가능].
  - Claude 육안 — `document-compare-empty__interaction-toggle-on__ko__light__desktop.png`에서 토글 6개 전부 썸이 트랙 내부, 좌우 카드 텍스트 정상 가로쓰기 확인.
- 예산 5종 통과(entry +16B·route +4,303B·shared −26B·전체 +4,286B·CSS −835B). legacy 155개 중 31 removed·3 split·121 active, B3 소스 6개 × 전역 legacy token 564개 교집합 0건.
- **B3 통과 → B4 착수 조건 충족.**

## B4 검수 판정 (2026-09-05, Claude — Gemini 검수 + Codex 실측 + Claude 육안 교차)

- Gemini 전수 검수 96장(initial 24·bottom 24·interaction 48 — 시트 선택·비교 쌍/키 모드·QR 생성/스캔/일괄) → **차단 결함 0·[배포 가능]**. 사고 증상 3종 전부 **미관찰**.
- **이관 개선 2건(확정 9항 ②⑤) 채택 판정**:
  - **excel-compare 다크 선택 카드 테두리 대비** — Codex 실측 **14.29:1**, Gemini 판정 "충분"(다크 배경 대비 녹색 테두리 선명). **채택.**
  - **Swap/Add 버튼 체급·affordance** — Codex 실측 Add `128.25×44px`·Swap `44×44px`·focus-visible ring 3px, Gemini 판정 "충분"(모바일 터치 영역 확보·원형/알약 형태로 클릭 가능성 전달). **채택.** Claude 육안(`excel-compare-empty__interaction-pair__ko__{dark__desktop,light__mobile}.png`)으로 사용자 원 요청(2개 파일 좌우 자동 분배 + `⇄` 위치 교환)이 화면에서 실제로 작동함을 확인했다.
- legacy manifest **82 removed·5 split·68 active**(B3 시점 31 removed 에서 크게 진전), B4 화면 legacy class 방출 0.
- 예산 5종 통과(entry +1.82KiB·route +2.24KiB·shared −0.80KiB·전체 JS +3.00KiB·CSS −2.31KiB). 검증: build·unit 190/190·Excel browser·XLS 보존/최초 진입·Excel 비교·utilities·QR bulk·UI migration·control geometry 92표본·static·visual 24/24.
- **B4 통과 → B5a 착수 조건 충족.**

## B5a 검수 판정 (2026-09-05, Claude — Gemini 검수 + Claude 육안 교차)

- Gemini 전수 검수 80장(initial 16·bottom 16·interaction 48) → **차단 결함 0·[배포 가능]**. 사고 증상 3종 전부 **미관찰**.
- **이관 개선 1건(확정 9항 ①) 채택 판정**: **PDF 도구 모바일 탭 가로 스크롤 단서** — 모바일 탭 컨테이너 우측 끝에 페이드 그라데이션이 표시되어 스크롤 가능성을 알리며, 탭 글자를 과도하게 가리지 않는다는 Gemini 판정. **채택.**
- **묶음 고유 확인**: 오디오 파형은 컨테이너 클리핑 없이 렌더되고 다크 모드에서 배경과 대비 확보. PDF 썸네일 그리드는 4개 모드(organize·image-to-pdf·pdf-to-image·convert)가 일관된 카드 디자인을 유지하며, 모바일에서 겹침·과소 축소 없음. organize 모드의 선택 상태는 테두리+체크로 구별됨. **정본 확정 6항의 "한 장으로 4탭 대표 금지"를 지켜 모드별 상태를 각각 채집**(각 8장)한 것이 이 판정의 근거가 됐다.
- legacy manifest **96 removed·9 split·50 active**(B4 시점 82 removed 에서 진전), B5a 소스 × 전역 legacy token 교집합 0건. CSS 1,106 rules·3,986 declarations.
- 예산 5종 통과(entry +14B·route +5,668B·shared −39B·전체 JS +5,594B·CSS −2,140B). 검증: build·unit 191/191·PDF/오디오 스모크·UI migration·control geometry 92표본·visual 18/18·static·manifest.
- **B5a 통과 → B5b(video-studio) 착수 조건 충족.**

## B5b 검수 판정 (2026-09-05, Claude — Gemini 검수 + Claude 육안 교차)

- Gemini 전수 검수 32장(initial 8·bottom 8·group-editing 8·trim-range 8) → **차단 결함 0·개선 권고 0·[배포 가능]**. 사고 증상 3종 전부 **미관찰**.
- **비디오 고유 확인 4종 전부 정상**: 구간 선택 핸들이 모바일에서 충분한 크기·시간 표시 잘림 없음 / 그룹 구간 복사 패널의 체크박스·버튼 겹침 없음 / 미리보기가 컨테이너를 넘치지 않고 다크에서 배경과 구별 / 긴 파일명(`video-vp9-benchmark.mp4`)이 레이아웃을 밀어내지 않음. Claude 육안 교차 확인.
- **엔진 불변 증명**: 엔진·worker 관련 `.ts` diff **0건**(Codex 보고). 지시서의 「캔버스/엔진 내부 로직 불가침」 계약이 지켜졌다 — 비디오는 인코딩·코덱 폴백·concat 이 가장 예민한 영역이라 이 증명이 이 묶음의 핵심이었다.
- legacy manifest **98 removed·9 split·48 active**(B5a 시점 96 removed 에서 진전).
- 예산 5종 통과(entry −6B·video route +3,784B·shared +34B·전체 JS +3,852B·CSS −1,733B). 검증: build 2,829 modules/61페이지·unit 192/192·video 스모크·hybrid·UI migration·control geometry 92표본·visual 8/8·static.
- **B5b 통과 → B6(image-studio) 착수 조건 충족.** 커밋 `2b1aabdc840ea01458ddefef46241130a587dd9d`, `origin/main` 불변.

## B6 검수 판정 (2026-09-05, Claude — Gemini 검수 + Claude 육안 교차) — **[수정 필요]**

커밋 `a2d74ba`, 캡처 56장(initial 8·bottom 8·interaction 5종 각 8 — canvas-loaded·size-panel·batch·collage·gif).

- **사고 증상 3종 전부 미관찰**. 모바일 100% 폭 버튼은 **의도된 블록 레벨 디자인**으로 판정(다른 요소를 밀어내지 않음).
- **정상 확인**: 캔버스·패널 경계(다크에서 투명 체크무늬 구별) · **모드별 개별 캡처**(batch/collage/GIF 를 한 장으로 퉁치지 않음 — 정본 확정 6항 준수) · 뷰포트 컨트롤 위치.
- **차단 결함 1건 — 모바일 도구 모음 상단 잘림.** Claude 육안 확인(`interaction-canvas-loaded__ko__light__mobile`): 도구 모음 탭 행("조정·효과·그리기·텍스트·도형·스티커")이 **세로 절반 이상 잘린 채** 뷰포트 상단에 걸치고 sticky 헤더가 그 위에 겹친다 → 모바일에서 편집 수단 접근 불가. `canvas-loaded`·`size-panel` 모바일에서 재현. **데스크톱·bottom 상태는 정상**(하단 FAQ·푸터가 탭바에 가려지지 않음 — Claude 확인).
  - **원인 미확정 — 단정하지 않고 판정을 지시했다**: (A) 도구 모음이 sticky 가 아니어서 스크롤 시 헤더에 덮이는 **실제 UX 결함** vs (B) 시나리오의 `scroll-into-view offset:-88` 이 도구 모음을 밀어낸 **캡처 아티팩트**. **`origin/main` 대비 회귀 여부를 먼저 가르고**, 회귀면 수정·기존 문제면 좁은 수정으로 되는지 판단(구조 변경 필요 시 B-shared 이관 보고).
- **검증 불가 1건 — 레이어 패널 상태 캡처 부재.** `ImageEditorLayersPanel.tsx` 가 이번 전환 대상인데 **활성 상태 캡처가 없어 말줄임·스크롤 영역을 검증할 수 없다**(검수자 지적 타당). `interaction-layers-panel` 시나리오 추가 + **말줄임이 실제로 발생하도록 fixture 파일명을 길게** 지시했다. 재검수는 **64장**.
- **판정: 수정 후 재검수 통과 전까지 B-shared 착수 금지.**

### B6 수정 결과 (커밋 `556a8b1`) — **원인 확정: 가설 A(실제 회귀)**

- **결함 1 원인**: 캡처 아티팩트가 아니라 **이번 전환이 만든 실제 회귀**였다. **toolbar · viewport 컨트롤 · 레이어 행 · 미니바가 가로 배치여야 하는데 세로로 쌓여** 높이가 늘어났고, 그 결과 도구 모음이 화면 밖으로 밀려 헤더에 가렸다. 원래 grid/flex-row 구조로 복구했다.
  - **관찰과 원인이 달랐다**: 검수자는 "도구 모음이 잘림"을 보고했으나 실제 원인은 **배치 붕괴**였다. 원인을 단정하지 않고 두 가설을 제시해 판정을 지시한 것이 맞았다 — 잘림만 보고 오프셋을 조정했다면 배치 붕괴는 그대로 남았을 것이다.
  - 이는 사고 증상 2·3종과 같은 계열(**flex/grid 방향 붕괴**)이다. B1~B5b 에서 잡히지 않다가 B6 에서 처음 나왔다 — **편집기처럼 컨트롤이 조밀한 화면일수록 배치 붕괴가 드러난다.**
- **결함 2 해소**: `interaction-layers-panel` 추가 + **기계적 단언으로 고정**(`assert-truncated` 액션 신설). 실측 — 긴 파일명 말줄임 **clientWidth 130px vs scrollWidth 2,345px**, 레이어 목록 스크롤 **420/596px**, base+9개 = **10행**. 육안 판정이 아니라 하네스가 매번 검사한다.
- 검증: build·unit 193/193·이미지 스모크 2종·UI migration·control geometry 92표본·B6 visual 12/12·static. 번들 5종 통과(entry −10B·route +28B·shared −14B·전체 +10B·CSS +24B — 수정 영향 미미).
- 캡처 **64장**(initial 8·bottom 8·interaction 48). `origin/ui-migration=556a8b1`, `origin/main` 불변.
### B6 재검수 판정 (2026-09-05, Claude) — **통과 + 검증 공백 1건 B-shared 이관**

Gemini 재검수 64장(8상태 × 8조합): **차단 결함 0 · 회귀 0**. Gemini 자체 판정은 `[수정 필요]`였으나 그 사유는 파손이 아니라 **검증 공백**이므로, Claude 는 **게이트 통과로 판정**한다. 근거는 아래와 같다.

- **지적 1 해소 확인**: 모바일 도구 모음이 sticky 헤더 **아래**에 정상 위치하고 잘림·겹침 없음, 탭 텍스트·아이콘 온전, 터치 가능 크기.
- **회귀 없음**: 사고 증상 3종 미관찰 · 캔버스/패널 경계 정상 · 모드별 개별 캡처 유지 · 뷰포트 컨트롤 정상 · 모바일 하단 가림 없음.
- **지적 2는 부분 해소**: Codex 가 `assert-truncated` 로 기계 검증한 것은 **상단 정보 표시줄의 파일명**(130 / 2,345px)이고, Gemini 가 보려던 것은 **레이어 목록 항목의 이름**이다. 후자는 fixture 레이어 이름이 "Shape"·"도형" 등 짧아 **말줄임이 발생하지 않아 여전히 미검증**이다.

**판정 근거 — 왜 세 번째 수정 사이클을 돌리지 않는가**: ① 묶음 공통 계약 ⑤의 게이트 조건은 **"차단 결함 0"** 이고 실제로 0이다 ② 미검증 항목은 **실제 파손이 아니라 커버리지 공백**이다(파손이 확인된 것이 아니라, 확인할 조건이 안 만들어진 것) ③ 말줄임 CSS 계약은 파일명 쪽에서 이미 기계 검증으로 고정됐고 같은 토큰을 공유할 가능성이 높다 ④ B-shared 가 공용 컴포넌트를 다루므로 처리 자리로 자연스럽다.

**→ B-shared 완료 기준에 편입(잊히지 않도록 명시)**: 레이어 목록 항목에 **말줄임이 실제로 발생하는 긴 이름 레이어**를 fixture·시나리오에 추가하고, 파일명과 동일하게 `assert-truncated` 로 기계 검증한다. **이 검증 없이 P-final 로 넘어가지 않는다.**

**B6 통과 → B-shared 착수 조건 충족.** 커밋 `556a8b1`.

## 접근성 — 코드 실측 소견 (2026-09-05, Claude — B-shared 후보)

지금까지의 묶음 검수는 **전부 스크린샷 육안**이라 키보드·보조기술 계약이 검증되지 않았다. 코드로 판정 가능한 부분을 먼저 실측했다.

**충족 확인**(`src/components/ui/switch.tsx` · `src/components/ui.tsx:132-152`):
- Base UI `Switch.Root` 사용 → `role="switch"`·`aria-checked` 자동. `nativeButton` + `render={<button type="button" />}` 로 네이티브 버튼 렌더 → **Space/Enter 키 조작 지원**.
- `aria-label={label}` 로 접근 가능한 이름 제공. `disabled` 전달.
- 포커스 표시 존재: `focus-visible:ring-3 focus-visible:ring-ring/30`.
- 터치 타깃 확장: `after:absolute after:-inset-x-3 after:-inset-y-2`(시각 크기 43×25px 를 넘는 히트 영역). B3 DOM 실측(track 43×25·thumb 21×21)과 코드가 일치한다.

**공백 2건 — B-shared 처리 후보**(둘 다 접근성 보강이지 기능 변경이 아니다):
1. **`description` 이 스위치에 연결되지 않는다.** `ToggleRow`(`ui.tsx:141`)는 설명을 `<small>` 로만 그리고 `aria-describedby` 가 없다 → **스크린리더 사용자는 옵션 설명을 듣지 못한다.** 문서 비교처럼 옵션마다 설명이 붙는 화면에서 영향이 크다.
2. **시각 라벨 클릭으로 토글되지 않는다.** `aria-label` 방식이라 `<label for>` 연결이 없어, 마우스 사용자가 라벨 글자를 눌러도 반응하지 않는다.

**아이콘 전용 버튼은 양호**(B4 전환 결과 실측 — `ExcelComparePage.tsx:293,299`): Swap `aria-label` + `size-11`(44px), 쌍 제거는 **번호를 포함한** 라벨(`pairs.remove {number}`), 파일 제거 X 는 **파일명을 포함한** 라벨(`common:files.remove {name}`)로 스크린리더에서 서로 구별된다. 전환된 화면의 접근 가능한 이름은 오히려 개선됐다.

**포커스 링 대비는 미판정** — `ring-ring/30`(불투명도 30%)이 배경 대비 3:1 을 만족하는지는 렌더 측정이 필요하다. 라이브 접근성 감사 결과와 함께 판정한다.

**video-studio 는 "드래그의 버튼 대안" 계약을 초과 달성**(B5b 캡처 육안 — `video-studio-empty__interaction-trim-range__ko__light__mobile.png` · `__interaction-group-editing__ko__dark__desktop.png`): 구간 선택이 슬라이더 드래그 전용이 아니라 ① 시작/종료 **숫자 입력 + 스텝 버튼** ② "현재 위치→시작/종료" 버튼 ③ `−0.1s`/`+0.1s` 버튼 ④ **화면에 표시된 키보드 단축키 안내**("미세 트림 1프레임: Alt+←/→ 시작 · Alt+Shift+←/→ 종료")를 함께 제공한다. 정밀 조작이 필요한 컴포넌트의 참고 사례로 남긴다.

**미확인 범위**: image-studio(B6)는 접근성 실측 전이다. B-shared 착수 시 포함해 재점검한다.

### 라이브 접근성 기준선 (2026-09-05, Gemini 측정 — axe-core 4.13.0 · Playwright · 1280×800 라이트)

**측정 대상은 `origin/main`(UI 전환 전) 라이브다.** 전환 후 같은 측정을 반복해 회귀 여부를 판정한다.

| 페이지 | passes | violations |
|---|---:|---|
| 홈 | 20 | **1** — `color-contrast`(serious, 2 노드, `.recommended > strong`) |
| 문서 비교 | 40 | **2** — `nested-interactive`(serious, 2 노드, `div[aria-label="수정 전 · 0개 선택 또는 드롭"]`) · `region`(moderate, 1 노드, `.desktop-language-switcher`) |
| 도구 목록 | 37 | **1** — `region`(moderate, `.desktop-language-switcher`) |
| Excel 비교 | 46 | **2** — `nested-interactive`(serious, `.drop-zone`) · `region`(moderate) |
| PDF 도구 | 42 | **4** — **`label`(critical, `#_r_0_`)** · `color-contrast`(serious, `.pdf-tool-navigation > .active … > span`) · `nested-interactive`(serious, `.drop-zone`) · `region`(moderate) |

**통합 기준선: 위반 10건 — critical 1 · serious 5 · moderate 4.**

**핵심 발견 — 10건 중 7건이 공용 컴포넌트 2개에서 나온다.** 개별 화면 문제가 아니라 **한 곳을 고치면 여러 페이지가 함께 해소되는 구조**다:
- **`region` 4건 = 전부 `.desktop-language-switcher`**(언어 전환기가 랜드마크 밖) → 1곳 수정 → 4건 해소.
- **`nested-interactive` 3건 = 전부 `.drop-zone`**(드롭존 안에 버튼 중첩) → 공용 드롭존 1곳 수정 → 3건 해소.
- 나머지 3건은 개별: `label`(critical, PDF 입력 필드 레이블 누락) · `color-contrast` 2건(홈 강조 텍스트 · PDF 활성 탭).

**아이콘 전용 버튼은 전수 통과**: 좌우 교환 `왼쪽과 오른쪽 파일 및 설정 교환` · 파일 제거 `dummy.csv 제거`(파일명 포함) · 도구 메뉴 `도구 메뉴 열기` · 옵션 스위치 12개 각각 고유 라벨. **이름 누락 버튼 0건.**

**⚠ 이 측정은 전환 전 라이브다 — selector 가 legacy 클래스(`.drop-zone`·`.ios-switch`·`.icon-button`)로 나온 것이 그 증거다.** 브랜치에서는 B1~B5b 전환으로 이미 해소된 항목이 있을 수 있다. **브랜치 재측정 없이 이 10건을 그대로 작업 목록으로 삼지 말 것.**

**토글 7개 DOM 실측 — 코드 실측과 일치**: 전부 `<button role="switch">`, `aria-label` 보유, `aria-checked` 가 실제 상태와 일치, **Space 키로 상태 전환 동작 확인**. 그리고 **7개 전부 `aria-describedby` 없음** — 위 「공백 2건」의 1번이 실측으로 확정됐다.

**색 대비(문서 비교 라이트)**: 본문 17.72:1 · 보조 설명 5.45:1 · placeholder 4.61:1 — 3종 모두 4.5:1 통과. **placeholder 4.61:1 은 여유가 0.11 뿐이므로 전환 후 토큰이 바뀌면 탈락할 수 있다 — 재측정 필수 항목.**

### 이관 개선 3건 진단 (2026-09-05, Gemini 측정 + Claude 실측 판정)

**⑥ 라이트 accent 톤다운 → 판정: 톤다운 불필요. 작업을 재정의한다.**

Gemini 는 라이브 accent 가 흰 텍스트와 대비 미달이라며 팔레트 톤다운을 제안했다. **진단(라이브가 미달)은 맞지만 처방이 틀렸다** — Claude 실측 대비비(sRGB 상대휘도 계산):

| 색 | 값 | 흰 텍스트 대비 | 판정 |
|---|---|---:|---|
| legacy `--blue` | `#007aff` | **4.02:1** | 미달(4.5 기준) |
| legacy `--orange` | `#f58b00` | **2.45:1** | 심각 미달 |
| legacy `--pink` | `#ff375f` | **3.52:1** | 미달 (Gemini 의 3.01 은 부정확) |
| **shadcn `--primary`(라이트)** | `oklch(0.457 0.24 277.023)` = `rgb(67,45,215)` | **8.09:1** | **통과(여유 큼)** |
| **shadcn `--primary`(다크)** | `oklch(0.398 0.195 277.366)` = `rgb(55,42,172)` | **10.05:1** | **통과** |

**즉 shadcn 전환 자체가 이 문제를 해결한다.** 전환된 표면은 이미 8:1 이상이므로 **팔레트를 톤다운하면 오히려 과교정**이다. → **작업 재정의: "accent 톤다운"이 아니라 "legacy accent 잔존 사용처 제거 확인"이다.** `var(--blue)` 는 `global.css` 에 **35곳** 쓰인다. 전환 후 남은 사용처를 grep 으로 세고, **특히 `--orange`(2.45:1)가 흰 텍스트와 함께 남아 있으면 반드시 제거**한다.

**axe 홈 위반의 정체 확정**: `global.css:156` `.language-landing-actions button.recommended { color: white; background: var(--blue); }` → 4.02:1. 앞선 axe `color-contrast`(serious, `.recommended > strong`)와 정확히 일치한다. **홈이 B-shared 담당이므로 이 규칙 제거가 곧 위반 해소**다.

**③ 카드 선택 배경 틴트 → 개선 필요(라이브 기준)**: 선택 시 `rgba(0,122,255,0.12)` 틴트가 배경 대비 **1.05:1**(다크 1.1:1 미만)로 사실상 구분되지 않아, 사용자가 **테두리 색 변화에만 의존**하게 된다 — 색각 이상·저시력 사용자에게 불충분(WCAG 1.4.1). 도구 카드는 hover/focus 에서 배경 변화조차 없다.
**④ 사이드바 활성 항목 → 개선 필요(라이브 기준)**: 라이트 `#f2f2f7` vs 활성 `#ffffff` = **1.11:1**, 다크는 **1:1**(배경 동일, shadow 만 차이). UI 구성요소 3:1 기준에 크게 미달.

**③④ 는 브랜치 재측정 후 확정**한다(전환으로 이미 달라졌을 수 있다 — ⑥ 에서 겪은 오판을 반복하지 않는다). 남아 있으면 배경 틴트 상향 또는 좌측 인디케이터 바를 쓰되, **테두리 단독 의존은 금지**한다.

### B-shared 접근성 실측 결과 (2026-09-05, Claude 확인 — `/tmp/worklazytools-a11y-bshared-{before,final}.json`)

| 시점 | 총계 | critical | serious | moderate | 항목 |
|---|---:|---:|---:|---:|---|
| 라이브(전환 전, main) | **10** | 1 | 5 | 4 | region 4 · nested-interactive 3 · color-contrast 2 · label 1 |
| 브랜치 재측정(수정 전) | **9** | 1 | 3 | 5 | region 5 · nested-interactive 3 · label 1 |
| **B-shared 수정 후** | **0** | **0** | **0** | **0** | — |

**0단계가 요구한 3종 산출이 이 표로 나왔다.**
- **전환으로 해소된 것**: `color-contrast` **2건**(홈 `.recommended > strong` · PDF 활성 탭). **Claude 의 사전 판정이 실측으로 확인됐다** — "shadcn `--primary` 는 흰 텍스트와 8.09:1 이므로 전환 자체가 해결하며 팔레트 톤다운은 과교정"이라는 판단(정본 「이관 개선 3건 진단」 ⑥)이 맞았다. **Gemini 권고대로 톤다운했다면 불필요한 색 변경 + 과교정이었다.**
- **전환이 새로 만든 것**: `region` **1건 증가**(4→5). 회귀였으나 이번 묶음에서 해소됐다.
- **남아 있던 것**: `nested-interactive` 3건 · `label` 1건 · `region` 5건 → **전부 해소.**

**배포 게이트 조건 충족**: critical **0** · serious **0** · 총계가 전환 전(10건) 대비 **증가 없음**(10 → 0). 정본 「배포 계약」 2항 ③ 통과.

**B-shared 작업 순서 (브랜치 재측정 → 판정 → 수정)**:

**⚠ 브랜치 재현 확인(2026-09-05, Codex B6 실측 — 재측정 전 부분 확인)**: **공용 FileDropZone 과 언어 전환기 문제가 브랜치에서도 재현됐다.** 즉 라이브 위반 10건 중 이 두 공용 컴포넌트가 만드는 **7건은 전환으로 해결되지 않았다.** B-shared 1단계의 두 항목이 실제 작업으로 확정된다(0단계 재측정으로 수치를 확정할 것).

**B6 가 추가로 보고한 image-studio 접근성 공백**(전부 B-shared 후보 — B6 에서는 고치지 않고 기록만):
- 상위 4모드의 **aria 상태 부재**(현재 어느 모드인지 보조기술이 알 수 없음)
- **캔버스 generic div 의 잘못된 `aria-label`**
- 도움말 텍스트 대비
- **crop/effect · pan · 레이어 재정렬이 드래그 전용** ← 공통 완료 기준의 **"드래그의 버튼 대안" 위반**. B5b 비디오가 키보드 단축키까지 제공한 것과 대조된다(위 「video-studio 는 계약을 초과 달성」 참조) — **같은 저장소 안에서 기준이 갈리지 않게 맞춘다.**
- 중복 레이어·GIF 버튼의 **대상 식별 라벨 부재**(B4 Excel 비교가 번호·파일명을 넣어 구별한 선례를 따를 것)

**0단계 — 브랜치 재측정 선행(필수).** B6 종료 후 추적 제외 로컬 빌드에서 5개 페이지를 **위와 동일 조건**(axe-core 4.13.0 · Playwright · 1280×800 · light)으로 재측정한다. 산출: ① 전환으로 해소된 항목 ② 남은 항목 ③ **전환이 새로 만든 항목**(가장 중요 — 회귀 판정). 이 결과가 실제 작업 목록이다.

**1단계 — 공용 컴포넌트 2건 우선**(재측정 후에도 남으면):
1. `.desktop-language-switcher` 랜드마크 귀속 — 1곳 수정으로 `region` 4건 해소.
2. 공용 드롭존의 상호작용 중첩 해소 — 1곳 수정으로 `nested-interactive` 3건 해소. 드롭 영역과 "파일 선택" 버튼의 역할을 분리한다.

**2단계 — 개별 3건**: PDF 입력 필드 레이블(critical) · 홈 `.recommended > strong` 대비 · PDF 활성 탭 대비.

**3단계 — 공백 2건**(코드 실측): `ToggleRow` 의 `aria-describedby` 연결 · 라벨 클릭 토글.

**B-shared 완료 기준**: 처리 후 **동일 명령으로 재측정해 ① critical 0 ② serious 0 ③ 전환 전 대비 violations 총계가 늘지 않음**을 출력으로 증명한다. **placeholder 대비 4.61:1 은 여유 0.11 이므로 재측정 값을 반드시 기록**한다.

## 배포 계약 (2026-09-05, Claude — P-QA 이후 단계. 착수 전 사용자 확인 필요)

정본 「검증(묶음마다)」 절은 마지막을 "**main 병합·배포**"로만 적고 있다. **이번 배포는 6개 도구 묶음 + 공용 + 전역 정리가 한 번에 나가는 대규모 변경이고, 같은 성격의 작업이 이미 한 번 라이브를 파손시킨 이력이 있다.** 아래를 계약으로 둔다.

**1. 병합 방식 — 롤백 가능성이 기준이다.**
지난 사고 때는 main 에 단계별로 push 한 커밋 6개를 각각 revert 해야 했다(`311c59e`). 이번에는 **되돌리기가 한 번에 되는 형태**로 병합한다: `--squash` 또는 merge commit(revert 시 `-m 1`). **rebase 로 다수 커밋을 main 에 풀어놓지 않는다.** 최종 선택은 사용자 결정 사항으로 남긴다.

**2. 배포 전 필수 게이트**(순서대로):
- ① 전 묶음 검수 통과(B1~B6·B-shared·P-final 각각 [배포 가능])
- ② **P-QA 전수 상호작용 검수** — 20개 route 전부, 3상태
- ③ **접근성 재측정** — critical 0 · serious 0 · 총계가 전환 전(10건) 대비 증가 없음(「라이브 접근성 기준선」 절)
- ④ 예산 5종 — **누적 기준**(`4a8405c` 분기점 대비)으로도 측정해 기록. 묶음별 통과가 누적 통과를 보장하지 않는다.
- ⑤ 전 스코프 스모크 · `test:static` · 정적 61페이지 생성 확인
- ⑥ **라이브 기준선 대조** — 「라이브 배포 검증」 절의 5개 페이지를 배포 후 같은 방법으로 재확인

**3. 배포 후 확인**(`PUBLISHING_CHECKLIST.md` 4항 연계): 404 · 모바일 사용성 · **Core Web Vitals**. CSS/JS 구조가 크게 바뀌므로 **렌더링 지표는 이번 배포에서 처음 재는 항목**이다 — 배포 전 로컬 측정치를 남겨 비교 기준을 만든다.

**4. 롤백 트리거와 절차**: 라이브에서 ① 레이아웃 파손 ② 조작 불가 ③ 데이터 손실 가능성 중 하나라도 확인되면 **즉시 되돌린다**. 판단을 미루고 hotfix 를 시도하지 않는다 — 지난 사고에서 원복이 정답이었다. 되돌린 뒤 원인을 브랜치에서 고친다.

**5. 배포 주체**: 「커밋·업로드·배포는 Codex」 규칙에 따라 병합·push·배포는 Codex 가 수행한다. Claude 는 게이트 판정만 한다.

## 반박 기록

### Codex 1차 (2026-09-04, 완료 — 6건 전원 수용 → v2 확정 사항. 실측 기여: class 규칙 2,104·잔여 155(compact 12 누락)·소유권 분포 143 분류·공유 selector 31개 목록, route 20개·redirect 구조·도달 불가 3종, 스모크 매핑 표, lazy chunk 구조·CSS 전역 귀속 불가, harness scrollTo(0,0)·상태 모델 부재·496장 규모, excel-compare-smoke 하단 assertion 선례. 판정 "재왕복 필요")
### Codex 2차 (2026-09-04, 완료 — 7건 문서 반영 확인, 신규 차단 공백 4건(P2-shared 실행 단계 부재·상위 정본 이관 개선 6건 누락·JS 지표 합격 기준 부재·scenario 필드/하단 대체 대상 단언 미완) → v3 정정)
### Codex 3차 (2026-09-04, 완료 — 8·9·6·7항 해소 확인, 잔여 1건(번들 집계 계약: worker 출력 경로 `dist/tools/video-studio/workers/` 누락·집계 스크립트 부재·shared 증분이 신규만 제한) → v4 정정)
### Codex 4차 (2026-09-04, 완료 — 잔여 1건(현행 빌드에 `build.manifest`·`--manifest` 부재로 dynamic import 판정 불가·worker 청크 귀속 규칙 없음) → v5 정정: 측정 전용 `--manifest --outDir dist-measure` 빌드·worker 경로 귀속)
### Codex 5차 (2026-09-04, 완료 — 잔여 1건 해소 확인·신규 공백 없음, **"이견 0"·[정본화 가능] 선언** → 정본 확정. 착수는 U3 완료 후 scenario 계층 선행 작업부터).

## 실행 기록 — scenario 계층·재현성·모바일 하단 선행 작업 (2026-09-04, Codx)

- `ui-migration`의 `62f9031`에서만 작업했다. 수정 전 launch에 browser UI locale 고정이 없음을 확인했고, Claude의 57건 실패 artifact와 영어 화면의 한국어 native file-input 문구로 원인을 확정했다. 이 실행 호스트에서는 수정 전 두 LANG 셸이 우연히 모두 96/96이라 직접 실패하지 않았다는 환경 차이도 `docs/review-notes.md`에 함께 기록했다.
- locale별 browser group에 `--lang`, 중립 browser `LANG/LC_ALL`, `LANGUAGE`, `Accept-Language`, CDP locale override와 `navigator.language` 단언을 적용했다. UTC, 저장소 Noto CJK font, DPR 1, animation/transition/caret/smooth-scroll 제거, 200ms+2 RAF paint settle, 12장 단위 동일-locale browser recycle을 고정했다.
- manifest는 59 scenario/151 capture(initial 22·bottom 20·interaction 16·HWP EN redirect 1)다. 20개 등록 도구의 mobile bottom을 공용 6개 assertion으로 검사하며 HWP 영어 redirect 2장은 도구 하단 통과에서 제외한다.
- 기준선은 Chrome 152.0.7977.64로 96장/16,635,920B에서 151장/21,823,497B로 전면 재생성했다(+55장/+5,187,577B, +31.18%). 대표 native file label·상호작용·최하단 화면의 로컬 육안 검수를 완료했다.
- 음성 대조는 padding 0px에서 tabs 62px 미만과 footer 844.34375px > tabs top 773px를 검출해 실패했고, 복원 뒤 bottom distance 0·padding 80px·footer 764.34375px·overflow 0으로 통과했다.
- 최종 검증: `LANG=ko_KR.UTF-8 npm run test:visual` 151/151(5:16.32), `LANG=en_US.UTF-8 npm run test:visual` 151/151(5:14.96), build 2,827 modules/정적 61페이지, unit 182/182, static·negative control·Excel 비교 모바일 스모크·문법·diff check 통과.
- 커밋·push: `7b3222b`(`test: make visual scenarios deterministic`)를 `origin/ui-migration`에 push했다. `origin/main=311c59e`는 불변이며 main push 금지 계약을 유지했다.

## 실행 기록 — owner/refcount manifest + B1 묶음 (2026-09-04, Codx)

- 실행 게이트는 `HEAD=origin/ui-migration=454d7c8964d1a2f301c8661a6c6cc00f6304b49f`에서 통과했고, 다른 worktree와 사용자 소유 미추적 파일 3개를 제외했다. `main`에는 손대지 않았다.
- `docs/legacy-css-owner-manifest.json`에 기준 155개(143 non-compact + compact 12)의 selector·line·token·범주·consumer·refCount·lastRemovalBundle·현재 상태를 기록했다. orphan 2개와 B1 소유 2개는 제거, 모바일 혼합 selector 1개는 B1 arm만 분리 제거되어 150 active/4 removed/1 split이다. 전체 CSS rule은 2,132→2,052(-80)다.
- B1 6개 도구를 기존 shadcn Button/Card/ToggleGroup과 공통 UtilitySurface 기반으로 전환했다. 새 primitive 설치는 없으며, work-calculator 스모크는 연차 모드 전환 뒤 결과 단언까지 확장했다.
- 번들 예산 기준→B1 증분은 entry +64B, 영향 route +2,656B, shared +837B, 앱 JS +3,566B, CSS -33B로 5종 모두 고정 상한 이내다.
- 검증은 build(2,828 modules·정적 61페이지), unit 186/186, utilities 전체, static, manifest, diff check, B1 visual 42/42(26.15초), 추적 제외 B1 QA 캡처 96/96(53.23초)를 통과했다. QA 입력은 `tests/visual-artifacts/p2-b1/`; Gemini 판정 전에는 B2를 시작하지 않는다.
- 커밋·push: `5298c13`(`feat: migrate P2 B1 utility tool surfaces`)을 `origin/ui-migration`에 push했다. 단일 커밋은 manifest current-state·CSS refcount 제거·화면 전환·기준선을 같은 검증 단위로 원자화하기 위해 채택했다.

## 실행 기록 — B1 검수 입력 3상태 교정 (2026-09-04, Codx)

- 기존 B1 검수 세트가 initial 48 + interaction 48 + bottom 0인 결함을 확인했다. B1 전용 QA 파생 경로를 폐기하고 `npm run test:visual:qa` 공용 경로가 선택 묶음의 initial·bottom·interaction을 제품상 적용 가능한 locale의 ko/en × light/dark × mobile/desktop으로 확장하게 했다. `VISUAL_ONLY`와 세 stateType은 QA 모드의 실행 전 필수 조건이다.
- **향후 B2~B6·B-shared 캡처 계약**: 먼저 `VITE_LOCAL_QA=1 npm run build`, 이어 `VISUAL_ONLY=<묶음의 toolId/routeId 목록> VISUAL_CAPTURE_DIR=tests/visual-artifacts/<묶음> VISUAL_CONSENT_GRANTED=1 npm run test:visual:qa`를 실행한다. B-shared는 home/tools initial과 함께 대표 도구 3종의 세 상태를 같은 `VISUAL_ONLY`에 넣는다. 출력의 stateType 분포에 initial·bottom·interaction이 모두 있고, 정확한 stateId별 장수 합이 디렉터리 PNG 수와 같은지 검수 입력 전달 전에 대조한다.
- bottom은 desktop/mobile 모두 실제 최하단 거리 ≤1px를 단언한 뒤 캡처하며, mobile은 공용 하단 네비 여백 assertion까지 추가 적용한다. B1 재채집은 144/144(initial 48·bottom 48·interaction 48), mobile bottom 24장 모두 통과했다.
- 네 도구 모바일 기하 60 samples에서 security Switch 이탈/중심 오차 0/0px, work/payroll/text SegmentedControl 이탈/중심 오차 0/0px였다. 옛 컨트롤 class 방출도 0건이므로 오탐으로 판정하고 제품 CSS는 변경하지 않았다. 상세 수치·검증은 `docs/review-notes.md`의 같은 작업 단위에 기록했다.
- 커밋·push: `4180f88`(`test: require three-state bundle QA captures`)를 `origin/ui-migration`에 push했다. push 출력은 `5298c13..4180f88 ui-migration -> ui-migration`이며 main에는 commit·push하지 않았다.

## 실행 기록 — B2 묶음 (2026-09-04, Codx)

- 기준 `4180f88580a868bfe4270925ec1c2bb210b659a7`에서 fetch 후 `origin/main=073da56226f7bc1bdbef682a477e05ec28862074`를 `ui-migration`에 선행 병합했다. CHANGELOG·review-notes·package manifest/lock 충돌은 B1 shadcn/QR와 main RHWP 0.8.6·SEO 의도를 모두 보존했고 merge commit은 `26eb56ea5e2eff771f438d6c18d381da6af13474`다. `main`과 별도 RHWP worktree는 건드리지 않았다.
- data-converter·timezone-calculator·text-merger·hwp-editor·office-editor의 내부 화면을 기존 shadcn Button/Card와 UtilitySurface·Tailwind로 전환했다. HWP 실제 문서 로드 focus와 Office 격리 workspace를 포함하며 새 primitive add는 없고 엔진·문구·SEO·정적 route·광고 격리 경계는 불변이다.
- B2 소스의 기준 legacy token·동적 prefix·현재 전역 class 교집합은 0건이다. manifest는 155개 중 17 removed·2 split·136 active이고, B2에서 13개 완전 제거와 1개 PDF 혼합 arm 분리를 반영했다. `global.css`는 250줄 삭제·2줄 추가(순감 248줄), 최종 1,807 rules/6,550 declarations다.
- 예산 기준→B2는 entry JS gzip 295,065→295,063B(−2B), 영향 route 101,867→107,457B(+5,590B), shared 2,717,095→2,717,343B(+248B), 앱 JS 5,427,141→5,432,960B(+5,819B), CSS 49,275→49,003B(−272B)로 5종 모두 통과했다.
- 검증은 build 2,829 modules·RHWP 77개/60,680,448B·정적 61페이지, unit 188/188, static, manifest, utilities, HWP 3,584B 저장/core 파싱/Studio 재개방, Office 95 download states·7 cached states·5,089B DOCX, TypeScript, diff check를 통과했다. 일반 B2 시각 회귀는 HWP 영문 redirect 포함 34/34(25.76초)였다.
- 추적 제외 QA 입력은 `tests/visual-artifacts/p2-b2/`의 108/108(1분 6.20초)이며 initial 36·bottom 36·interaction 36이다. interaction은 JSON 8·기준 도시 8·쉼표 8·HWP 문서 로드 4·Office workspace 8장이다. Codx contact-sheet 육안 검수의 차단 결함은 0이며, 별도 Gemini 판정을 대체하지 않으므로 다음 묶음 착수 전 해당 108장을 인계한다.
- 커밋·push: `4ecda007163d41866f099a5a473962c262f02a06`(`feat: migrate P2 B2 utility tool surfaces`)을 merge commit과 함께 `origin/ui-migration`에 push했다. push 출력은 `4180f88..4ecda00 ui-migration -> ui-migration`이며 main push는 하지 않았다.

## 실행 기록 — B3 묶음 (2026-09-04, Codx)

- 실행 게이트는 `HEAD=origin/ui-migration=4ecda007163d41866f099a5a473962c262f02a06`에서 통과했고 B1·B2 Gemini `[배포 가능]` 판정과 열린 계획서 무충돌을 확인했다. `origin/main=073da56226f7bc1bdbef682a477e05ec28862074`는 전 과정에서 불변이며 사용자 미추적 파일 3개를 제외했다.
- 도달 가능한 document-compare 제품 화면·`DocumentCompareResultPage → WordCompareResultPage`·실제 Word/HWP 처리와 excel-cleaner 화면을 기존 shadcn Button/Card/Switch·UtilitySurface·Tailwind로 전환했다. 새 primitive add는 없고 도달 불가 `HwpComparePage`·`HwpCompareResultPage`·`WordComparePage`의 diff는 0건이다.
- 사고 증상 실측은 문서 토글 32 samples에서 track 43×25px·thumb 21×21px·사방 이탈 0px·수직 중심 오차 0px·최소 inset 2px, 문서 쌍 작업 문구 폭 747px·`horizontal-tb`·1~2자 세로 낙하 0·페이지 overflow 0px, 작업 버튼 190×48px·`w-full` 충돌 0·화면 legacy match 0건이다. Excel Cleaner 버튼은 미리보기/실행 158.890625/142.265625px, 부모 1,016px, 좌우 이탈 0px다.
- B3 전용 legacy 14개를 refcount 0에서 제거하고 혼합 selector 1개에서 B3 arm만 분리했다. Excel Cleaner로 오분류됐던 `legacy-150`은 B4 Excel Compare 소비로 소유권을 정정해 보존했다. manifest는 155개 중 31 removed·3 split·121 active, PostCSS는 1,634 rules/5,973 declarations다. B3 소스 6개와 전역 legacy token 564개의 교집합은 0건이다.
- 예산 기준→B3는 entry JS gzip 295,063→295,079B(+16B), 영향 route 24,264→28,567B(+4,303B), shared 2,717,343→2,717,317B(−26B), 앱 JS 5,432,960→5,437,246B(+4,286B), CSS 49,003→48,168B(−835B)로 5종 모두 통과했다.
- 검증은 build 2,829 modules·RHWP 77개/60,680,448B·정적 61페이지, unit 189/189, Word browser, HWP 3,584B 저장/core 파싱/Studio 재개방, ui-migration 사고 기하, Excel Cleaner 기능·버튼 기하, static, control geometry 92 samples/20 pages, manifest, diff check, B3 일반 시각 18/18을 통과했다.
- 추적 제외 QA 입력은 `tests/visual-artifacts/p2-b3/`의 80/80이며 initial 16·bottom 16·interaction 48이다. interaction은 toggle-on/off·DOCX 결과·HWP 결과·Cleaner 규칙/결과가 각 8장이고 외부 요청·tracking request는 모두 0건이다. 영문 모바일 결과 탭 겹침을 캡처로 찾아 보정한 뒤 전량 재채집했다. Gemini B3 검수 판정 전에는 B4를 시작하지 않는다.
- 커밋·push: `84e80918815309f7ee911339a60b94649963f0bf`(`feat: migrate P2 B3 document and cleaner surfaces`)을 `origin/ui-migration`에 push했다. push 출력은 `4ecda00..84e8091 ui-migration -> ui-migration`이며 push 후 `origin/main=073da56226f7bc1bdbef682a477e05ec28862074` 불변을 다시 확인했다.

## 실행 기록 — B4 묶음 (2026-09-05, Codx)

- 실행 게이트는 `HEAD=origin/ui-migration=84e80918815309f7ee911339a60b94649963f0bf`에서 통과했고 B3 Gemini의 80장 전수 `[배포 가능]` 판정과 열린 계획서 무충돌을 확인했다. `origin/main=073da56226f7bc1bdbef682a477e05ec28862074`는 불변이며 사용자 미추적 파일 3개를 제외했다.
- excel-merger·excel-compare·qr-studio 내부 화면을 기존 shadcn Button/Card/SegmentedControl·UtilitySurface와 Tailwind로 전환했다. 새 primitive add는 없고 기능·문구·SEO·정적 route·광고 격리·엔진 로직은 불변이다.
- 개선 ②는 다크 선택 카드의 green 토큰 경계 대비 14.29:1로 채택했고, 개선 ⑤는 Add 128.25×44px·Swap 44×44px와 hover/focus-visible affordance로 채택했다. 전역 토큰·레이아웃 재설계는 기각했다.
- B4 종료 manifest는 155개 중 82 removed·5 split·68 active다. `legacy-150`을 이번 소비 종료와 함께 제거했고 혼합 selector는 arm만 분리했다. PostCSS는 1,394 rules/5,128 declarations, B4 소스의 전역 legacy class 방출은 0건이다.
- `84e8091` 대비 번들 gzip 증분은 entry +1.82KiB, 영향 lazy route 합 +2.24KiB, shared −0.80KiB, 전체 앱 JS +3.00KiB, CSS −2.31KiB로 5종 모두 통과했다. Excel 병합은 eager import라 route 합이 아니라 entry에 귀속하고, Excel Compare·QR Studio만 `BUNDLE_ROUTES`에 지정했다.
- 검증은 build(2,829 modules·정적 61페이지), unit 190/190, Excel browser, XLS 보존, XLS 최초 진입, Excel 비교, utilities, QR bulk, ui-migration, control geometry 92 samples/20 pages, static, manifest, diff check, B4 일반 시각 24/24(25.22초·동시성 4/유효 3)를 통과했다.
- 추적 제외 QA 입력은 `tests/visual-artifacts/p2-b4/`의 96/96이며 initial 24·bottom 24·interaction 48이다. interaction은 병합 시트 선택·비교 key 모드/파일 쌍·QR bulk/create/scan 각 8장이고 외부 요청·tracking loader는 모두 0건이다. Gemini B4 검수 판정 전에는 B5a를 시작하지 않는다.
- 커밋·push: `c60f221aa9d309025315d97b8f8378b0d0f66acd`(`feat: migrate P2 B4 Excel and QR surfaces`)을 `origin/ui-migration`에 push했다. push 출력은 `84e8091..c60f221 ui-migration -> ui-migration`이고 `HEAD=origin/ui-migration`을 재확인했으며 `origin/main=073da56226f7bc1bdbef682a477e05ec28862074`는 불변이다.

## 실행 기록 — B5a 묶음 (2026-09-05, Codx)

- 실행 게이트는 `HEAD=origin/ui-migration=c60f221aa9d309025315d97b8f8378b0d0f66acd`에서 통과했다. 열린 U4 PDF 마무리 초안은 비정본이며 최신 사용자 결정에 따라 B5a 순수 UI 전환을 먼저 수행했고 U4 기능·오디오/PDF 엔진·문구·route·SEO·정적 페이지·광고 격리 경계는 건드리지 않았다. 사용자 미추적 파일 3개와 선행 Claude의 `docs/review-notes.md` B4 검수 기록을 보존했다.
- audio-studio·pdf-editor의 파형/효과/내보내기와 PDF 4모드 탭/썸네일/출력 workspace를 기존 shadcn Button/Card/Switch·UtilitySurface와 Tailwind로 전환했다. 새 primitive add는 없으며 B5a 소스 8개와 전역 CSS 394 class token의 교집합은 0건이다.
- PDF 모바일 탭 단서는 실제 overflow 방향에만 페이드를 표시하는 방식으로 채택했다. Chrome 152·390×844에서 `scrollWidth/clientWidth=500/366px`, 시작 오른쪽·끝 왼쪽 페이드, 끝 remaining 0px, 페이지 overflow 0px였다. 탭 재배치·상시 페이드는 범위 확대와 거짓 단서 때문에 기각했다.
- B2에서 PDF arm을 남긴 `legacy-121`은 refcount 0에서 완전 제거했다. B5a 완전 제거 14개, 신규 split 5개, 기존 split 2개의 arm 추가 제거를 반영해 manifest는 **96 removed·9 split·50 active**다. PostCSS는 **1,106 rules·3,986 declarations**, `global.css`는 10줄 추가·322줄 삭제(순감 312줄)다.
- `c60f221` 대비 gzip은 entry **+14B**, 영향 route 합 **+5,668B**(audio +1,644B·PDF +4,024B), shared **−39B**, 전체 앱 JS **+5,594B**, CSS **−2,140B**로 5종 모두 통과했다.
- 검증은 표준 build(2,829 modules·정적 61페이지), unit 191/191, `TEST_ONLY_AUDIO=1 test:new-tools`, `TEST_SCOPE=pdf test:browser`, ui-migration, control geometry 92 samples/20 pages, static, manifest, bundle, diff check를 통과했다. 일반 visual은 filter `audio-studio,pdf-editor`로 **18/18·25.80초·동시성 4/실제 2**였다. 서버/QA 빌드 전제와 썸네일 지연 렌더 순서를 먼저 위반한 사전 실패는 각각 명시 서버·`VITE_LOCAL_QA=1`·card→scroll→image 대기로 교정 후 동일 검증을 통과했다.
- 추적 제외 QA 입력은 `tests/visual-artifacts/p2-b5a/`의 **80/80·47.87초·동시성 4/4**다. initial 16·bottom 16·interaction 48이며 interaction은 오디오 파형/robot 효과와 PDF organize/image-to-pdf/pdf-to-image/convert 썸네일 각 8장이다. 모바일 bottom 8장에 공용 assertion 6종을 적용했고 전 캡처 외부 요청 0, B5a 두 route tracking loader 0을 확인했다. Gemini B5a 검수 판정 전에는 B5b를 시작하지 않는다.
- 커밋·push: `9c2b38c35887f1defb7dfcfb01fd443ba724c1e9`(`feat: migrate P2 B5a audio and PDF surfaces`)을 `origin/ui-migration`에만 push했다. push 출력은 `c60f221..9c2b38c ui-migration -> ui-migration`이며 재확인한 `HEAD=origin/ui-migration=9c2b38c`, `origin/main=073da56226f7bc1bdbef682a477e05ec28862074`로 main은 불변이다.

## 실행 기록 — B5b 묶음 (2026-09-05, Codx)

- 실행 게이트는 fetch 뒤 `HEAD=origin/ui-migration=9c2b38c35887f1defb7dfcfb01fd443ba724c1e9`에서 통과했다. 구현 완료 비디오 후속 문서는 기능 회귀 계약으로 유지했고 열린 계획서 충돌은 없었다. 사용자 DOCX 2개·네이버 확인 파일과 병행 Claude 기록을 보존했으며 main에는 손대지 않았다.
- Video Studio의 입력, 그룹/미리보기·트림, 출력 설정·진행, 결과 화면을 기존 shadcn Button/Card/Switch·UtilitySurface·Tailwind로 전환했다. 새 primitive add는 없다. `9c2b38c` 대비 feature diff는 TSX 3개뿐이고 `src/features/video-studio/*.ts`는 diff 0이라 인코딩·WebCodecs/FFmpeg·concat·오디오 폴백·worker 오케스트레이션·진행률 산출은 불변이다.
- B5b 소유 `legacy-076`·`legacy-110`을 제거하고 교차 규칙에서는 video 소비자만 내렸다. manifest는 **98 removed·9 split·48 active**, PostCSS는 **873 rules·3,123 declarations**, B5b TSX와 전역/legacy class 교집합은 0건이다.
- scenario interaction을 `interaction-group-editing`과 `interaction-trim-range`로 분리했다. 일반 visual은 filter `video-studio`, 포트 4230에서 **8/8·14.21초·concurrency 4/실제 2**다. interaction 일반 profile은 initial/bottom의 축 보완을 근거로 EN/dark/desktop 1개로 축약하고 `profileReductionReason`을 기록했다.
- 추적 제외 QA 입력은 `tests/visual-artifacts/p2-b5b/`의 **32/32·34.98초·concurrency 4/4**다. initial 8·bottom 8·interaction 16(group-editing 8·trim-range 8)이며 네 mobile bottom profile에 assertion 6종을 적용했다. ko/en 외부 요청 각 0, Google/Naver/AdSense loader 각 0이다. 전수 육안에서 발견한 모바일 트림 숫자 필드 과축소를 보정·재채집했고 최종 차단 결함·사고 증상 3종은 0이었다.
- `9c2b38c` 대비 gzip은 entry **−6B**, worker 포함 video route **+3,784B**, shared **+34B**, 전체 앱 JS **+3,852B**, CSS **−1,733B**로 5종 상한을 모두 통과했다. 단독 도구의 화면 커밋 합산으로 측정했다.
- 검증은 build(2,829 modules·정적 61페이지), unit 192/192, `TEST_ONLY_VIDEO=1 test:new-tools`, `test:video-hybrid`, UI migration, control geometry 92 samples/20 pages, visual 8/8, static, manifest, bundle, diff check를 통과했다. stale 시각/스모크 selector 2건의 사전 실패는 제품 오류가 아니며 안정 data 속성으로 교정 후 동일 명령을 통과했다.
- 화면 책임과 회귀 범위를 분리하려 입력 `5d7848e`, 그룹/트림 `27da026`, 출력/진행 `f932ddc`, 결과·manifest/scenario `aac3b2c`, 모바일 트림 QA 보정·기준선 `d0d0b89`의 5개 논리 커밋으로 나눴다. B5b 검수 판정 전에는 B6를 시작하지 않는다.
- 기록 커밋 `2b1aabdc840ea01458ddefef46241130a587dd9d`(`docs: record P2 B5b video migration`)까지 `origin/ui-migration`에만 push했다. push 출력은 `9c2b38c..2b1aabd HEAD -> ui-migration`이며 재-fetch 뒤 `HEAD=origin/ui-migration=2b1aabd`, `origin/main=073da56226f7bc1bdbef682a477e05ec28862074`로 main 불변을 확인했다.

## 실행 기록 — B6 묶음 (2026-09-05, Codx)

- 실행 게이트는 `HEAD=origin/ui-migration=2b1aabdc840ea01458ddefef46241130a587dd9d`에서 통과했고 B5b `[배포 가능]`과 열린 계획서 무충돌을 확인했다. 사용자 미추적 파일 3개와 `p2-b5b` 캡처를 제외했으며 main에는 손대지 않았다.
- Gemini 감사 부산물의 `@axe-core/playwright`·`playwright`는 정본 접근성 재측정 재현을 위해 유지하되 **4.13.0/1.63.0 exact** devDependency와 `npm run test:a11y`로 고정했다. 기존 Puppeteer 제품/시각 하네스는 유지하고 Playwright는 5페이지 axe 감사에만 쓴다. 추적 제외 분기 재측정은 9 violations(critical 1·serious 3·moderate 5), 외부 요청 0으로 라이브 기준 10건 이내다.
- Image Studio의 편집 toolbar/viewport/미니바/패널/레이어/스티커와 batch/collage/GIF 표면을 기존 shadcn Button/Card/Switch·UtilitySurface·Tailwind로 전환했다. 새 primitive add는 없다. `src/features/image-studio/*.ts` diff 0이며 TSX도 import/render 표면만 변경해 캔버스/처리/worker/GIF/배치 엔진은 불변이다.
- legacy manifest는 **98 removed·9 split·48 active → 110 removed·8 split·37 active**다. B6에서 `legacy-001`, `105`, `114`~`120`, `133`, `143`, `145` 12개를 제거했다. CSS는 **795 rules·2,756 declarations**, B6 TSX 10개의 legacy token/dynamic prefix 방출은 0이다.
- **B-shared 인계 목록(비제거 45개)**: p2-shared 21개 = `002`, `009`~`023`, `098`, `152`~`155`; cross-shared 23개 = `004`~`008`, `024`, `065`~`069`, `077`~`085`, `132`, `134`, `151`; AppShell brand compact 1개 = `003`. split은 `024`, `065`~`069`, `132`, `151`의 8개이며 혼합 selector는 현재 arm만 보존했다. 실제 selector·baseline consumer/refCount는 `docs/legacy-css-owner-manifest.json`을 B-shared 입력 정본으로 한다.
- scenario는 initial·bottom·canvas-loaded·size-panel·batch·collage·GIF **7상태**다. interaction 일반 profile은 EN/dark/desktop 1개로 축약하고 initial/bottom이 나머지 축을 보완한다는 `profileReductionReason`을 기록했다. 일반 visual은 포트 4242·filter `image-studio`에서 **11/11·18.12초·concurrency 4/실제 2**다.
- 추적 제외 QA는 `VITE_LOCAL_QA=1 npm run build` 후 `VISUAL_TEST_PORT=4246`에서 `tests/visual-artifacts/p2-b6/`에 **56/56·32.94초·4/4**를 채집했다. initial 8·bottom 8·interaction 40이며 interaction 5개 stateId가 각각 8장이다. 모바일 bottom 4장은 assertion 6종, 전 캡처 외부 요청 0·tracking loader 0을 통과했다. Codx 상태별 contact sheet/모바일 원본 육안의 차단 결함은 0이며 Gemini 판정 전에는 B-shared를 시작하지 않는다.
- 접근성 충족: toolbar `aria-pressed`, Switch role/checked, 단일 아이콘 버튼 이름, GIF 위/아래 순서 버튼, 모바일 44px 타깃. **B-shared 판정 후보(이번에는 미수정)**: 상위 4모드 aria 상태 없음; generic canvas div의 금지 aria-label; 빈 선택 도움말 대비; crop/effect 영역과 pan의 drag 전용; layer 재정렬 drag 전용; 중복 레이어/GIF 프레임 아이콘 라벨에 대상 이름·번호 없음; 공용 FileDropZone label/nested-interactive와 desktop language region. image axe는 initial 5건(critical 1·serious 3·moderate 1), 레이어 로드 후 공용 3건이다.
- `2b1aabd` 대비 gzip은 entry **+9B**, image route **+2,697B**, shared **−7B**, 전체 앱 JS **+2,672B**, CSS **−887B**로 예산 5종을 통과했다. 검증은 build(2,829 modules·61페이지), unit 193/193, 이미지 전체/크기 스모크, UI migration, control geometry 92표본, visual 11/11, static, manifest, bundle, diff check를 통과했다. UI/control은 추적 제외 빌드에서, static은 표준 빌드에서 실행해 각 전제를 지켰다.
- 커밋·push: `a2d74ba64866ddb5db5fabbeb430c875d84c6acc`(`feat: migrate P2 B6 image studio surface`)를 `origin/ui-migration`에만 push했다. 재-fetch 뒤 `HEAD=origin/ui-migration=a2d74ba`, `origin/main=073da56226f7bc1bdbef682a477e05ec28862074`로 main 불변을 확인했다. Gemini B6 판정 전에는 B-shared를 시작하지 않는다.

## 실행 기록 — B6 수정 (2026-09-05, Codx)

- 실행 게이트는 `HEAD=origin/ui-migration=a2d74ba64866ddb5db5fabbeb430c875d84c6acc`, `origin/main=073da56226f7bc1bdbef682a477e05ec28862074`에서 통과했고 열린 계획서 무충돌을 확인했다. 사용자 파일·기존 B5b 캡처는 제외했고 B-shared에는 착수하지 않았다.
- 결함 1은 **가설 B(캡처 아티팩트)**다. 실제 업로드 위치에서는 전환 전/후 모두 헤더 겹침 0이었다. 문제의 workspace `offset -88`은 전환 전에도 도구 모음 53.03px를 헤더 아래에 넣고 10.97px만 노출했으며, 브랜치도 54px 겹침·11.14px 노출이었다. 헤더는 fixed `top 9 / height 54 / z-index 50`, 도구 모음은 static/z-index auto, 캔버스 열은 sticky `top 72 / z-index 8`이다. 구조적 sticky 재설계는 기각하고 canvas toolbar·size panel을 헤더 아래 `offset -72`로 교정했다.
- 교정 캡처에서 확인한 실제 전환 회귀는 Card 기본 세로 방향이 toolbar·viewport·layer row·minibar의 구조를 덮은 4건이다. 소유 컴포넌트에 grid/flex-row를 명시해 최종 toolbar `top 72.14 / bottom 136.14 / height 64px`, 헤더 간격 9.14px, viewport **230.53×44px**를 확보했다.
- `interaction-layers-panel`은 긴 fixture 이름과 base+별 9개를 사용한다. 파일명 `130/2,345px` 말줄임, 레이어 목록 `420/596px` 세로 overflow, 모바일 행 3열 `166/44/44px`, 미니바 **298×58px** 가로 배치를 기계적으로 단언한다.
- 추적 제외 QA 입력은 `tests/visual-artifacts/p2-b6/` **64/64·41.93초·4/4**, initial 8·bottom 8·interaction 48이며 canvas/size/layers/batch/collage/GIF가 각 8장이다. 전수 contact sheet에서 차단 결함·사고 증상·하단 가림 0을 확인했다.
- `a2d74ba` 대비 gzip은 entry −10B, image route +28B, shared −14B, 전체 앱 JS +10B, CSS +24B로 5종 상한을 통과했다. build 2,829 modules/61페이지, unit 193/193, 이미지 전체·크기 스모크, UI migration, control geometry 92표본, B6 visual 12/12, static, bundle, diff check가 통과했다. 기능·문구·SEO·정적 route·광고 격리·엔진은 불변이다.
- 커밋 `556a8b169752a1496599655ab6ae071afbf16da5`(`fix: correct P2 B6 image editor layouts`)을 `origin/ui-migration`에만 push했다(`a2d74ba..556a8b1`). 재-fetch 뒤 `HEAD=origin/ui-migration=556a8b1`, `origin/main=073da56226f7bc1bdbef682a477e05ec28862074` 불변을 재확인했으며, 재검수 통과 전 B-shared는 시작하지 않는다.

## 실행 기록 — B-shared 묶음 (2026-09-05, Codx)

- 실행 게이트는 `HEAD=origin/ui-migration=556a8b169752a1496599655ab6ae071afbf16da5`, `origin/main=073da56226f7bc1bdbef682a477e05ec28862074`에서 통과했고 B6 재검수 차단 결함 0·회귀 0과 열린 계획서 무충돌을 확인했다. `pdf-finish`는 B-shared 선행을 명시한 비정본 초안이고 네이버 랜딩 작업은 메타/정적 생성기 소유라 충돌하지 않았다.
- 0단계에서 기존 a11y 하네스의 홈 표본이 `/ko`라 루트 언어 랜딩을 빠뜨리는 오류를 교정했다. 브랜치 기준선은 9건(critical 1·serious 4·moderate 4): 홈 20/1, 문서 42/2, 도구 39/1, Excel 47/2, PDF 44/3. 라이브 10건 중 PDF 활성 탭 대비 1건 해소·9건 잔존·신규 0이었다. placeholder는 4.8871:1이었다.
- 공용/Excel 전용 드롭존의 중첩 상호작용과 file input 이름, desktop 언어 전환기 landmark, ToggleRow label/description, 홈 추천 버튼 대비, 사이드바 활성 상태, PDF 선택 카드 인디케이터를 보강했다. 완료 axe는 지정 5페이지 전부 0건·외부 요청 0이며 Image Studio 별도 감사도 0건이다.
- 개선 ③은 PDF 선택 카드 4px 인디케이터(light 6.27:1·dark 9.81:1), ④는 sidebar current 인디케이터(17.72:1·14.05:1)로 채택했다. ⑥은 shadcn primary 톤다운을 기각하고 legacy accent 호출만 35/16/8→0/0/0으로 제거했다.
- Image Studio 상위 4모드 상태, named canvas region, Enter/방향키/Shift+방향키 영역 조작, 방향키 pan, Alt+↑/↓ 레이어 재정렬과 화면 안내, 번호·이름이 든 레이어/GIF 라벨을 추가했다. 긴 텍스트 레이어 이름은 모바일 104/409px로 실제 말줄임되고 `assert-truncated`가 시각/QA 8프로필에서 통과한다.
- manifest의 45개는 37 active+8 split으로 대조됐다. B-shared 종료는 149 removed·1 split·5 active다. **P-final 인계 6개**: `legacy-004`, `005`, `006`, `007`, `132`, `134` — 도달 불가 Word/HWP 컴포넌트의 eyebrow/content-heading/raw tool arm 때문에 refcount가 남는다.
- B6 기준→B-shared 번들 gzip은 entry +951B, 영향 route +959B, shared +4B, 전체 앱 JS +1,914B, CSS −76B로 5종 통과했다. 검증은 build 2,830 modules/정적 61페이지, unit 193/193, utilities, browser 전 스코프, UI migration, control geometry 92표본, static, 대표 visual 46/46, Image sizing·접근성 스모크를 통과했다.
- 추적 제외 QA는 `VITE_LOCAL_QA=1`, `VISUAL_TEST_PORT=4252`, `tests/visual-artifacts/p2-bshared/`에 160/160(initial 40·bottom 24·interaction 96)을 채집했고 외부 요청 0, contact sheet/대표 원본 차단 결함 0이다. Gemini B-shared 판정 전에는 P-final을 시작하지 않는다.
- 커밋 `3588ebafab3dd876746e356ea652d923eda0f5e5`(`feat: complete P2 shared accessibility migration`)을 `origin/ui-migration`에만 push했다(`556a8b1..3588eba`). fetch 뒤 `HEAD=origin/ui-migration=3588eba`, `origin/main=073da56226f7bc1bdbef682a477e05ec28862074` 불변을 재확인했다.

## 실행 기록 — P-final (2026-09-05, Codx)

- 실행 게이트는 `HEAD=origin/ui-migration=3588ebafab3dd876746e356ea652d923eda0f5e5`에서 통과했고 B-shared `[배포 가능]`, 열린 계획서 무충돌, 사용자 파일/기존 캡처 제외를 확인했다.
- 인계 6엔트리 `004·005·006·007·132·134`는 정적 SEO fallback과 명시 제외된 도달 불가 Word/HWP 화면이 실제 소비해 refcount 0이 아니었다. `.ui-eyebrow`와 primary-link arm만 refcount 0에서 분리 제거했으며 manifest는 **149 removed·1 split·5 active**다.
- `--blue`·`--orange`·`--pink`·`--legacy-radius-sm/md`는 repo-wide 소비 0을 확인해 정의를 제거했다. 나머지 legacy 변수는 AppShell/공개 화면/명시 제외 비교 화면이 소비하고 shadcn `--primary`를 포함한 `tailwind.css`는 diff 0이다.
- `npm run css:orphans`를 추가해 확장자별 저장소 전체 재귀 탐색과 owner/목적이 있는 명시 예외 8개·exact 동적/runtime class 허용 17개를 고정했다. **63 classes/152 selector arms**를 제거해 최종 **238 tokens·263 runtime sources·orphan 0**, PostCSS **612 rules/2,126 declarations**다. 정본 orphan `.drop-hint-segment`·`.file-list` legacy class도 0이다.
- B-shared에서 승인됐으나 전체 baseline에 누락된 35장은 기준 커밋 actual과 현재 actual의 픽셀 교차(33장 동일·2장 0.0050%/0.0028%)로 P-final 영향이 아님을 확인한 뒤 갱신했다. `ko_KR`·`en_US` 전체 visual은 각각 **172/172** 통과했다.
- build 2,830 modules/정적 61페이지, unit 193/193, utilities, browser 전 스코프, new-tools 전 도구, office, Excel Cleaner/Compare, QR bulk, XLS 보존/최초 진입, video hybrid, UI migration, control geometry 92표본, static, legacy manifest/orphan을 통과했다. 전체 실행이 드러낸 stale/race 3건은 제품 변경 없이 하네스의 실제 B-shared DOM/포커스/격리 완료 조건으로 교정했다.
- 누적 예산 `4a8405c→P-final`, 6묶음 합산 상한: entry **+8.13/+120KiB 통과**, route **+910.68/+360KiB 실패**, shared **+98.34/+180KiB 통과**, app JS **+1,017.15/+480KiB 실패**, CSS **−10.22/+60KiB 통과**. **push 금지**로 판정했다. P-final 자체는 B-shared 대비 CSS −2,446B 등 5종 통과다.

## 실행 기록 — P-QA (2026-09-05, Codx)

- `VITE_LOCAL_QA=1`, `VISUAL_TEST_PORT=4270`, `tests/visual-artifacts/p2-final/`에 20도구·77상태 **604/604장**을 채집했다. 분포는 initial 156·bottom 156·interaction 292이고 도구별 표는 `docs/review-notes.md` 같은 작업 단위에 기록했다. PDF 4모드와 Image batch/collage/GIF는 각각 독립 상태다.
- 전 캡처 외부 요청 0, QA bundle의 Google/Naver/AdSense loader marker **0/0/0**이다. PDF 썸네일 1회 race는 PDF 48장 재채집에서 해당 프로필을 통과시켜 누락·잉여 0으로 완성했다.
- axe-core 4.13.0·Playwright 1.63.0·1280×800·light에서 홈 25/0·문서 41/0·도구 39/0·Excel 46/0·PDF 43/0, 합계 **0(critical/serious/moderate 0/0/0)**이다. 라이브 10건 대비 −10, placeholder **4.8871:1**이다.
- 렌더 기준선은 QA production·Chrome 152·1280×800·light·ko-KR·cache off·SW block·무스로틀·cold 3회 median이다. 홈 LCP/CLS/blocking **91.34ms/0.038332/146ms**, 문서 **90.67/0.114199/49**, PDF **512.32/0.114199/52**, 외부 요청 0이다.
- 캡처·접근성·렌더링 산출물은 Gemini 최종 검수 입력으로 준비했지만 누적 예산 실패 때문에 `origin/ui-migration` push와 main 병합·배포는 수행하지 않는다.

## 재개 실행 게이트 — OOM 인계 감사·4점 예산 귀속 (2026-09-06, Codx)

- 기준 HEAD `3588ebafab3dd876746e356ea652d923eda0f5e5`, 브랜치 `ui-migration`, 미커밋 58건 일치. 인계 diff 75,923B는 현행 `git diff`와 byte-identical이다. 열린 14문서 검사: U4 PDF는 비정본 후속이며 기능 변경 제외, 상위 shadcn/P2 및 완료 기능 문서와 상반 지시 없음. 최신 재개 디스패치에 따라 commit만 수행하고 모든 push를 금지한다.
- 지시서 전제 불일치: `5298c13^=454d7c8`에는 RHWP/SEO가 없고, 해당 main 변경은 B1 뒤 `26eb56e`에서 병합됐다. 따라서 기능 전부 포함·UI 0인 실제 S2 커밋은 존재하지 않는다. 임의 기준 변경 없이 요청한 B1 직전 해시를 S2로 측정하고 기능 병합을 별도 대조해 귀속을 보완한다. 계획 상단의 P-final/P-QA 대기 상태는 아래 완료 실행 기록보다 낡았으며 Gemini 최종 판정은 별도다.

## 재개 완료 — 감사 커밋·4점 귀속 분해 (2026-09-06, Codx)

- 작업물 보존 커밋 `3f0cf3bc1fa84fc8554724ce8c3b2f6d906b464a`, 911파일(시각 기준선 35·QA 860 PNG 포함). 개인 파일 3개 제외·SHA-256 보존. 재검증 build/61페이지·unit193·static·orphan0·manifest149/1/5·QA UI·a11y0 통과; 일반 build에 QA 스모크를 실행한 첫 실패와 재실행은 review-notes에 기록했다.
- S0=`4a8405c7458ca72e454326e798592330478c67e4`, S1=`62f9031ecc87fef37ca55b3d64f511cfc9b2b407`, S2=`454d7c8964d1a2f301c8661a6c6cc00f6304b49f`, S3=`3f0cf3bc1fa84fc8554724ce8c3b2f6d906b464a`. 같은 worktree/설치/측정기로 4점 + 병합 전후 2점 새 빌드. 원시 수치·청크 각 상위10·명령/출력·제외 자산은 docs/review-notes의 같은 작업 단위에 수록했다.
- U3만으로 route +883.64/app JS +987.05KiB로 상한 실패. S1→S2 5종0. S2→S3는 entry +2.85/route +27.04/shared +0.21/app JS +30.10/CSS −10.53KiB로 5종 통과. 기능 병합 전후 +8/−3/−18/−13/0B를 제외한 실제 UI 구간 합도 +2911/+27689/+238/+30838/−10780B로 5종 통과. OTF/RHWP vendor는 예산에서 제외되며 동일 설치라 RHWP 패키지 교체 비용은 추정하지 않는다.
- 판정: 누적 실패의 P2 귀속 기각, U3만으로 실패 확정. 상한·정본 기준점 변경 없음. Gemini 최종 육안·배포는 별도 단계이며 이번 모든 push 금지 유지.

- 귀속 기록 커밋 `0663c7449f94f8d046e36c8ec16502582dd4f001`. 최종 `git status -sb`: ui-migration ahead 2, 사용자 미추적 3파일만 남음. `origin/ui-migration=3588ebafab3dd876746e356ea652d923eda0f5e5`, `origin/main=073da56226f7bc1bdbef682a477e05ec28862074` 불변. push 미수행.


## P-QA 검수 판정 (2026-09-06, Claude — Gemini 전수 검수 + Claude 육안 교차 + Codex DOM 실측)

**1차 전수 검수(604장, Gemini)**: 20도구 중 **18도구 차단·개선 0건**, 2도구에서 차단 2건 → `[수정 필요]`.

**차단 2건 — Claude 육안 교차로 증상 확정(1건은 Gemini 서술 정정)**:

1. **Excel 병합 · 영어 모바일 분절 컨트롤 충돌** 【Gemini 서술 정확】 — 「병합 방식」 3분절이 390px 폭을 넘겨 `Stack vertically`·`Join horizontally` 사이 간격이 사라져 `verticallyJoin` 으로 붙고 좌측 분절이 잘림. **결정적 대조: 한국어(`시트별|세로|가로`)는 정상** → 레이아웃 결함이 아니라 **영어 라벨 길이 미수용**(「현지화·SEO·AdSense 동시 검토」 규칙 위반 자리).
2. **HWP 편집 · 액션 바가 고정 언어 전환기에 가려짐** 【Gemini 서술 오탐 → 정정】 — Gemini 는 "주황 `HWP 저장` 버튼이 `다른 문서` 를 완전히 덮는다"고 기술했으나 원본 캡처에서 `다른 문서` 는 온전히 읽힌다. **실제 증상**: 문서 로드 후 전체 폭 레이아웃으로 바뀌며 액션 바가 고정 KO/EN 전환기 아래로 들어가 데스크톱 1365px 에서도 `HWPX`·`HML` 에 도달 불가, 모바일에서는 우측 잘림. **대조군**: 로드 **전** 캡처에는 충돌 없음. → 원인을 단정하지 않고 DOM 실측 확정을 지시(§5-3 교훈 적용).

**수정 결과** (`3807644`): Excel 은 라벨 2줄 접힘·간격 유지, HWP 는 액션 바가 전환기 앞에서 종료(데스크톱)·3단 분리 후 2줄 접힘(모바일).
- **Claude 육안 교차**: 4개 대표 캡처 직접 열람, 두 결함 모두 해소 확인. 한국어 회귀 없음.
- **Codex DOM 실측**: 320·390·620·621·820·821·1020·1365px 8폭 × 전 24표본. Excel KO 모바일·EN 데스크톱 픽셀 차이 0.
- **Gemini 재검수(36장 전후 대조)**: 결함 2건 해소 확인, **신규 결함·회귀 0건** → `[배포 가능]`.

**판정: [배포 가능]**

## 시각 하네스 시계 비결정성 (2026-09-06, Claude 발견 → Codx 수정 `6fc458f`)

전체 시각 회귀가 **174/175** 로 실패해 원인을 실측했다. `TimezoneCalculatorPage.tsx:29` 가 `DateTime.now().setZone("Asia/Seoul")` 로 날짜·시각 상태를 초기화하는데, 하네스는 **시간대만 고정하고 시계는 고정하지 않았다**. 즉 **기준선 채집일이 지나면 매일 실패하는 구조**였다(전날 172/172 통과 → 익일 174/175 실패가 이 진단과 일치).

제품 동작("오늘 날짜가 기본값")은 의도된 기능이므로 **하네스만 수정**하도록 지시하고, 「광역 금지 계약」 규칙의 정신에 따라 **같은 원인의 다른 시나리오를 저장소 전체에서 찾도록** 요구했다. 결과 **시차·근무·급여 계산기 3도구 9시나리오**가 발견돼 전부 고정됐다 — 실패한 1장만 막았다면 8건이 나중에 터졌다.

검증: KO **175/175**·EN **175/175**, 날짜·연도 변경 반복 비교 **24건 픽셀 차이 0**(통과가 아니라 결정성 자체를 증명).

## 사용자 결정 기록 (2026-09-06)

**결정 1 — 누적 번들 예산 게이트 면제 승인**
- 계획서 「예산 측정 확장·합격 기준」의 **"초과 시 push 금지 — 사용자 판단 없이 면제하지 않는다"** 조항에 대한 사용자 판단이다.
- 근거: 누적 초과의 **97%가 U3 QR 일괄 생성 귀속**(route +883.64 · app JS +987.05KiB)이고, P2 UI 전환 자체 구간은 **5종 전부 통과**(route +27.04/+360 · app JS +30.10/+480 · CSS −10.53). 초과분은 **해당 도구를 열 때만 받는 지연 청크**이며 전체 방문자 공통 증가(entry)는 U3 +5.28 · P2 +2.85KiB 다.
- **면제 범위는 `4a8405c` 기준 누적 게이트 1건에 한정한다. 묶음별 상한과 기준점 계약 자체는 변경하지 않는다.**
- → 배포 계약 2항 게이트 ④ 충족.

**결정 2 — 병합 방식: merge commit**
- `ui-migration` → `main` 은 **merge commit** 으로 병합한다. `--squash` 는 채택하지 않는다. rebase 로 다수 커밋을 main 에 풀지 않는다(계약 1항 유지).
- 롤백은 `git revert -m 1 <merge-commit>` 단일 명령(계약 4항 트리거 적용).
- 선택 근거: 30개 커밋 이력이 main 에 보존돼 사후에 어느 묶음이 원인인지 추적 가능하다.

**결정 3 — QR 번들 무게 축소 착수 지시**
- 사용자가 착수를 지시했다. 「계획 정본화」 규칙상 `!계획!` 발동 후 초안 설계 → Codex 반박 왕복 → 정본화로 진행한다. `docs/backlog.md` 반영 대상.
- 후보(전부 **측정으로 확인해야 할 가설**): ① `qrLabelPdf.js` 496KiB 를 "도구 열기"가 아니라 "PDF 내보내기 누를 때"로 더 쪼갤 수 있는가 ② `exceljs.min.js` 265KiB 가 기존 Excel 도구의 스프레드시트 라이브러리와 중복인가 ③ `inputAdapter.js` 132KiB 가 실제 추가인가 중복 계상인가. **폰트 파일 자체는 이 예산 집계 제외 대상이므로 폰트 서브셋은 이 수치를 낮추지 못한다.**

## 배포 게이트 판정 (2026-09-06, Claude)

| 게이트 | 근거 | 판정 |
|---|---|---|
| ① 전 묶음 검수 통과 | B1~B6·B-shared 각 `[배포 가능]`, P-final 은 P-QA 검수에 통합 | ✅ |
| ② P-QA 전수 상호작용 검수 | 20 route · 77상태 · **604장**(initial 156·bottom 156·interaction 292), 외부 요청 0, 광고 marker 0/0/0 | ✅ |
| ③ 접근성 재측정 | axe-core 4.13.0 · 5페이지 **violations 0**(critical 0·serious 0·moderate 0), 라이브 10건 대비 **−10** | ✅ |
| ④ 누적 예산 5종 측정·기록 | 4점 귀속 분해 기록 + **사용자 면제 승인**(결정 1) | ✅ |
| ⑤ 전 스코프 스모크 · `test:static` · 정적 61페이지 | build 2,830 modules·61페이지, unit **195/195**, static, 전 스코프 스모크, 시각 회귀 **KO 175/175 · EN 175/175** | ✅ |
| ⑥ 라이브 기준선 대조 | **배포 후 항목** | ⏳ |

**판정: 배포 가능. 게이트 ①~⑤ 충족.** 배포 주체는 「커밋·업로드·배포는 Codex」 규칙대로 Codex 이며, 병합 방식은 사용자 결정대로 merge commit 이다.

## 실행 기록 — P2 라이브 배포 완료 (2026-09-06, Codx)

- 사용자 승인 디스패치의 fetch/HEAD/원격/워킹트리 게이트를 통과하고 `origin/ui-migration` 백업 push(`3588eba..6fc458f`) 후 main에 `--no-ff`로 병합했다. merge commit **`1ff9187e655575ea49bac327560861632bdf2815`**, 첫 부모 `073da56`, 둘째 부모 `6fc458f`. 지시의 30커밋은 `0663c74`까지이며 수정 2개를 포함한 실제 승인 HEAD의 이력은 32커밋이다.
- main의 `npm run build`(2,830 modules·61페이지)와 `test:static` exit 0 후 push. Pages **33981007120 success**. 라이브 접근성은 홈/문서/도구/Excel/PDF **0/0/0/0/0**, critical·serious 0, 전환 전 10건 대비 −10, placeholder 4.8871:1로 **게이트 ⑥ 통과**.
- 라이브 7화면 13프로필 육안·가로 overflow 0·모바일 최하단 비가림, Excel EN 분절 3개 클릭·2줄 라벨, HWP 3,584B 편집 저장·문구 재파싱·재개방 통과. URL 69/69 및 진입 자산 2/2 HTTP 200, 의도된 미존재 경로 404. 롤백 증상 없음·롤백 미실행.
- 렌더링 3회 median(LCP ms/CLS/blocking ms): 홈 **508/0.038332/109**, 문서 **732/0.114199/85**, PDF **168/0.114199/32**. KO/EN 일반 광고 로더 HTTP 200·실행 확인 2/2, 격리 경로 광고 DOM·요청 0/0 **6/6**. 필드 INP/CrUX 28일 집계는 측정하지 않았으며 실험실 표본과 구별한다.
- 상세 측정·원출력 명령은 `docs/review-notes.md`의 P2 main 배포 절, 배포 사실은 CHANGELOG에 Codx 서명으로 기록했다. 기록 커밋 **`4d0bae93c141d5e3607e2be757a0e1ceee61d5d6`**도 main push했고 Pages **33981779257 success**, 라이브 JS/CSS 참조 불변. 최종 **HEAD=origin/main=4d0bae93c141d5e3607e2be757a0e1ceee61d5d6**, `origin/ui-migration=6fc458f`. 개인 미추적 3파일만 남았으며 제품 코드·예산 계약을 수정하지 않았다. 원본 증거: `/tmp/worklazytools-p2-deploy-20260906/`.
