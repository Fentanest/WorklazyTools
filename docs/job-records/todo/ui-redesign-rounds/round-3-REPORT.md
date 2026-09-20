# UI 개편 정본 v3 — 확인 라운드 3차

2026-09-07 · Codx(astra). 대상: `docs/jobs/todo/ui-theme-redesign-20260907.md` 「정본화 (2026-09-07 13:25, v3)」, L178 이후.

**Claude–Codex 간 이견 0 · [정본화 가능]**

**착수는 S3(U4) main 통합 → 새 해시에서 실측·profile·bundle baseline 및 아래 착수 입력 재산출 → 갱신 정본의 이견 0 재확인 → sol W0 디스패치 후다. 현재 3차 판정은 v3 계약의 합의 확인이며, 아직 존재하지 않는 통합 해시의 실행 게이트 통과를 뜻하지 않는다.**

N1~N7 계약군 7건 모두 [반영 확인]. 미반영 0건, 신규 구현 판단이 필요한 잔여 이견 0건, 사용자 결정 재확인 항목 0건이다. [문장 대조 129행](SENTENCE-CROSSWALK.md), [원문·대조문 포함 JSON](sentence-crosswalk.json), [첨부 SHA 전체표](ATTACHMENTS.md)에 근거를 보존했다.

## 1. 기준·실행 경계

첫 행동으로 `PROJECT_RULES.md` 전문을 읽었다. 이어 `AGENTS.md`, 지정 dispatch, 정본 v3와 v2/§6-B, 2차 AMENDMENTS/REPORT와 첨부 문서·원자료, 관련 `docs/review-notes.md`의 shadcn 파손·복원/소유권/대비·시각 검수 기각 이력을 읽었다.

- 시작·종료 HEAD: `c8bff1fd1ab64f89afb7240778e0a373c953d1a3`, 브랜치 `s3-pdf-finish`. v3의 406개 관측 기준 `c8bff1f`와 일치한다.
- 현재 main: `5bc6854175331bdd73b267784d9633cdccda8446`. main의 옛 175개와 S3의 203개를 혼용하지 않았다. **S3 main 통합 조건은 현재 미충족**이다.
- 열린 최상위 작업 문서 18개를 스캔했다([실제 파일별 결과](open-plan-scan.json)). P2/shadcn 문서에는 종전 팔레트·source-count·baseline 지시가 남아 있다. v3 N2/GATES는 통합 직전 그 표면별 대체 소유권을 갱신 정본에 기록하도록 요구한다. 이 요구를 삭제하거나 지금 충돌 검사 완료로 간주하지 않았다.
- 문서 비교 엔진은 별도 잡, §6-B U1~U6 UI는 이 계획의 W4 구현/W5 검증 소유다. `/tmp/worklazy-dc-impl`에는 접근·수정 명령을 실행하지 않았다.
- 모든 작성물은 `/tmp/worklazy-ui-r3/`에만 생성했다. 저장소 파일 수정·커밋·push·브랜치 전환·패키지 설치·빌드·브라우저·서버 실행은 하지 않았다. `review-notes.md`도 수정하지 않고 이 보고서를 Claude 취합 입력으로 남긴다.

## 2. N1~N7 반영 정확성

정본 L181은 **v3 > v2 > v1** 우선순위, 관련 v1 문장 폐기, **첨부는 정본의 일부이며 요약이 전문을 대체하지 않음**, `round-2-AMENDMENTS.md` N1~N7 전문 채택을 모두 명시한다. 따라서 요약에 압축된 고정값을 다시 선택지로 읽지 않았다. 2차 원문 N1~N7의 모든 비어 있지 않은 본문행과 제품 규칙 3항, 총 41행/문단을 129문장 단위로 대조했다.

| 항목 | 판정 | 확인 근거 |
|---|---|---|
| N1 문안·CSP·oracle·selector | [반영 확인] | 정본 L187~190. 예외는 RHWP entry/print 2개와 별도 Naver 인증 1개이며 정확한 경로·소유자·CSP 유무가 맞다. 실제 원본 HTML에서도 CSP는 `true,true,false`였다. 제품 HTML 재귀 검사·104 재산출·storage write 실패의 탭 상태·init/React 명세 일치·slow/fail module/JS-off/404/격리 복구·CSS owner 검사·6색 oracle 교체·승인된 selector 대체를 보존했다. |
| N2 단계·U1~U6·착수 | [반영 확인] | 정본 L193~194 및 GATES. 옛 §6-B W5 표기를 **W4 구현/W5 최종 검증**으로 명시 교체하고 U1~U6 개별 체크리스트 등록을 요구한다. 529px은 확정 결과가 아니라 새 셸 재측정 대상으로 바뀌었다. 940/156/52/12/8, 320 EN, 상태·ARIA·DOCX helper·axe/rendering, 엔진/입력 원본 보존을 유지한다. |
| N3 상태색·대비·preview | [반영 확인] | 정본 L197~205. JSON/CSS 토큰표·의미 별칭, 모든 CTA 상태의 불투명 색과 disabled 4.5, **3px outline+2px 간격/대비 3**, clipping 실측, 문서 종이 `previewText=#101827` scope와 별도 preview diff, 원본 raster/canvas 무필터, checker 양색 검사, 실제 DOM 합성 최저값의 최종 우선성을 보존한다. |
| N4 프리미티브 | [반영 확인] | 정본 L208과 PRIMITIVES 전문. 7종 API/props/ARIA/ref/event/controlled 계약, Sheet 8항, 양방향 Tab wrap·중첩 stack·scroll 복원·route/resize/unmount/StrictMode·native dialog 실패 fallback까지 편입된다. **CVA 유지**, Base UI/shadcn 의존 종료는 **W4**다. |
| N5 profile·fixture·shard | [반영 확인] | 정본 L211~215. 406 sparse family 확장, 추가 app70/총476, primitive16 별도, desktop-1920=1920×1080 추가, mobile-320=320×844 유지, 기존 fixture/state 보존, 문서결과 helper 진입, **저장값만 seed**, 두 driver 동일 adapter와 capture 직전 DOM 단언, a11y/rendering 집계, **238/238 직렬·각20분·full manifest 합집합·UPDATE 없는 전수**를 정확히 채택한다. |
| N6 검색·언어 | [반영 확인] | 정본 L218과 SELECTORS 전문. HWP trailing slash 정규화와 query/hash 보존, ToolsPage/topbar 공유 matcher와 eyebrow/category corpus, 분리된 query 상태, 초성 전용 질의·IME·pointer·visual viewport, 검색 ID/name scope, native select 실제 선택/경로/storage/lang 검사를 보존한다. |
| N7 레이아웃·카피·에셋 | [반영 확인] | 정본 L221~226. desktop sidebar248/header64/padding24, mobile drawer·**topbar104**/padding16, safe area·sticky·새 셸 폭 실측, 고정 ko/en 카피, **생성물 커밋+CI SHA verify**, ImageMagick **6.9.12-98 Q16 x86_64 (18038)**·quality82/50·strip·width·thread1·delegate/입출력 manifest·실제 slot/DPR2/throttle·가족별 source 동시 갱신·glow scope를 모두 반영한다. |

원문 전문 채택으로 함께 고정되는 세부도 확인했다. `startup-help`는 white/#222이며 다른 고정색을 임의 선택하지 않는다. 종이 preview의 내부 diff와 앱 결과 diff는 별개다. 문서 rail의 sticky 계약은 desktop에 해당하고 §6-B U2의 모바일 쌓임/새 스크롤 추종 약속 없음은 유지한다. PRIMITIVES/SELECTORS의 과거 “제안” 표제나 2차 보고서의 “잔여7건”은 역사적 작성 상태이며, v3의 명시 채택을 뒤집지 않는다.

§6-B의 개별 등록 내용은 다음과 같이 보존된다. 아래는 구현 완료 표시가 아닌 채택된 작업 항목의 대조다.

| UI 이관 ID | W4 구현 / W5 검증에 남은 계약 |
|---|---|
| U1 | 결과 페이지의 1480px 상한, 새 sidebar/padding/rail 차감 후 최종 본문 폭 재측정. |
| U2 | nav가 DOM에서 먼저인 형제 rail, 156/52 폭·12/8 gap·문서 최소폭940, desktop header+16 sticky, 모바일 쌓임. |
| U3 | 320 EN nav/toolbar 줄바꿈과 클릭 가능성, ≤1200 결과 toolbar 세로 배치. |
| U4 | columnheader row·유효한 cell·명명된 focusable scroll region·본문 row selector 교체·결과 axe0. **PDF U4와 다른 UI 이관 번호**다. |
| U5 | tab/full-content 유지, 선택 index 초기화·경계·0변경·resize/focus·국소 key 및 provider remount 금지. |
| U6 | 명시된 장문/다중 변경 합성 DOCX helper·정확한 timeout/안정화·직접 result URL 금지·a11y/rendering/visual 등록 및 기존/S3 등록 보존. |

## 3. 첨부 채택·실존·원본 동일성

**[반영 확인]** 채택 문구는 L181 및 각 N절에 명시돼 있다. 원문 `/tmp/worklazy-ui-r2/`와 저장소의 사본을 직접 SHA-256으로 비교해 **42/42 동일**, 원본의 역사적 SHA manifest에 등재된 **41/41 동일**을 확인했다. manifest 자체는 자기 hash 항목이 없으므로 직접 원본 대조에만 포함된다. 필요한 첨부가 빠진 항목은 없다.

실제 경로의 공통 루트는 `docs/jobs/todo/ui-redesign-rounds/`다. 필수 채택 사본은 다음과 같다.

- `probes-r2/GATES.md`, `probes-r2/PRIMITIVES.md`, `probes-r2/SELECTORS.md`.
- `probes-r2/CONTRAST.md`, `probes-r2/palette-proposed.json`, `probes-r2/lab/palette.css`.
- `probes-r2/visual-profiles-406.csv`, `probes-r2/visual-profiles-406.json`, `probes-r2/visual-profiles-additions-proposed.json`.
- `probes-r2/probes/theme-fixture.mjs`.
- `round-2-AMENDMENTS.md` 전체. 같은 내용의 `probes-r2/CANONICAL-AMENDMENTS.md`도 원본과 동일하다.

원본의 `evidence/*.json/csv`는 사본에서 `probes-r2/*.json/csv`로 평탄화됐다. `SENTENCE-CROSSWALK.md`, `contrast-calculated.json`, `browser.json` 등 보조 근거도 동일하다. 전체 원본→사본 경로와 SHA는 [ATTACHMENTS.md](ATTACHMENTS.md)에서 확인할 수 있다. 원본 보고서의 상대 링크는 원본 폴더 구조를 가리키므로, 사본에서 읽을 때 이 대응표를 사용한다.

검산 결과:

- **406개 CSV/JSON 행·순서·내용 일치**, unique name406. light-coral88/dark-coral115/light-mint88/dark-mint115, home16.
- 추가 app70 = 검색3상태×16=48 + collapsed8 + drawer8 + 문서결과6. 기존406과 합쳐 **476 unique**, index modulo2로 **238/238**. primitive fixture16은 별도다.
- 현재 config로 읽기 전용 재생성해도 85 scenario/203 profile→406으로 저장 목록과 완전히 일치했다. `desktop-1920`은 아직 없으며 N5의 향후 구현 항목임을 확인했다.
- JSON 팔레트와 CSS custom property의 값 전부 일치. 채택된 144쌍을 독립 재계산해 **미달0**, 텍스트 최저 **4.8654946736318125**, 비텍스트 경계 최저 **3.577889300803163**. 보존된 computed browser 수치와 오차 <1e-12. 이번에 제품 DOM 대비를 새로 측정했다는 뜻은 아니다.
- fixture의 직렬화 함수를 Node VM에서 실행해 저장 key3개만 쓰고 document를 건드리지 않음, iframe 쓰기0, Puppeteer/Playwright adapter의 함수·인자 동일성을 확인했다. `assertTheme` 정상1/필드 불일치 거부4도 통과했다. 브라우저 실행은 없었다.
- 히어로 입력2개/보존 산출12개의 SHA·바이트 예산이 manifest와 일치하고, 현재 `convert -version`의 전체 encoder/delegate 출력도 보존 signature와 같았다. 새 변환이나 이미지 수정은 하지 않았다.

## 4. 잔여 재해석 지점

**[반영 확인] 잔여 0.** v3 요약뿐 아니라 채택된 전문을 함께 읽으면 2차에서 열거한 구현 선택지는 닫혀 있다. 새 설계 결정을 요구하는 문안은 제안하지 않는다.

**[보완: 전달 시 경로 명료화, 비차단]** W0 디스패치에서는 줄인 `probes-r2/` 표기 앞에 `docs/jobs/todo/ui-redesign-rounds/`를 붙이고, 평탄화된 JSON/CSV 경로를 그대로 적으면 된다. 현재 dispatch가 보존 사본 위치를 지정했고 SHA로 동일한 입력을 확인했으므로 채택 누락이나 구현 계약의 이견으로 세지 않는다. 문안 예: “첨부 경로의 공통 루트는 `docs/jobs/todo/ui-redesign-rounds/`이며, `evidence/` 원문 참조는 첨부 대응표의 `probes-r2/` 사본으로 해석한다.”

현재 S3 작업 코드에 신규 테마·프리미티브·desktop-1920·VISUAL_SHARD가 아직 없는 사실은 이번 확인 라운드의 미반영이 아니다. GATES는 신규 검증 파일이 sol의 구현 산출물임을 명시하고 있다.

## 5. 착수 조건·재산출 대상

**[반영 확인]** 정본 말미의 순서와 N2, v2 R1/R5/R8~R12, GATES 공통 실행/W0/시각·a11y·rendering을 합쳐 읽으면 실행 가능하며 필수 재산출 대상의 계약상 누락은 0이다. 아래는 이미 채택된 요구를 한곳에 정리한 **[보완: 착수 체크리스트]**다. 현재 미실행 항목을 통과로 표시하지 않는다.

| 순서·시점 | 갱신 정본/착수 패킷에 고정할 내용 |
|---|---|
| 1. S3 main 통합 후 기준 고정 | 통합 commit SHA, 문서 비교 엔진 통합 상태, 전용 UI worktree의 기준, 열린 작업 문서의 표면별 소유권. P2/shadcn의 옛 source-count/palette/baseline 지시는 이 UI 정본으로 대체함을 파일·표면별 명시. 엔진 소유권은 별도 유지. |
| 2. 소스 실측 재산출 | v1/v2의 모든 현행 수치: dark 변형 파일·OS media·직접 색 후보, global/theme 및 legacy owner/refcount/scope, UI public import·실제 소비 props/상태속성·selector, 7종 파일/의존/CSS/설정/license 입력, 셸/홈/registry·도구/locale/category 수. 138/31·50/51·61/62·541 같은 과거 숫자를 새 oracle로 복사하지 않음. |
| 3. HTML/정적 경로 재산출 | 새 production 산출 HTML 전체 재귀 inventory, 제품/정확한 예외3경로·목적·소유자·CSP 구분, crawlable 수와 총 HTML 수, module/초기화/theme-color/native scheme·404/격리 복구 경로. 기존104를 상수화하지 않음. W0 이후 bootstrap/OS 독립성/실제 표면 검증으로 이어짐. |
| 4. 시각 manifest 및 하네스 재산출 | 새 config/scenarios **내용·fixture/actions/ready 조건 SHA**와 baseline PNG SHA, 원래 sparse profile/locale/viewport/state, family 확장 CSV/JSON·정확한 추가 app/primitive 목록, full ordered manifest와 생성/교체/삭제 계획. 새 전체 수에 맞는 shard별 기대 집합·합집합을 정본에 다시 고정하고 각각20분/직렬/UPDATE 없는 전수를 유지. 현재476/238은 잠정 관측값이므로 통합 이후 추가 profile을 버려 숫자를 맞추지 않음. |
| 5. a11y/rendering 등록 재산출 | 현재11/6 target과 S3 신규 필수 등록의 실제 집합·locale/viewport/ready 조건, baseId/exception·placeholder별 집계, home/검색/drawer/문서결과 확장 목록, theme fixture/init 순서, 결과 mount 직전 CLS reset과 단계 구분. 기존 target을 삭제하지 않음. |
| 6. bundle baseline 재산출 | 통합 BASE_SHA에서 같은 production mode·측정기/schema·route 집합으로 baseline 생성. 현재 S3 schema는2이며 옛 main schema1 값과 비교 금지. JS/CSS의 entry/affected routes/shared/app/CSS 5종을 **누적** +20,480/+61,440/+30,720/+81,920/+10,240B 한도로 비교하고 단계별 baseline reset 금지. source/build/schema/선택 route를 baseline과 같이 보존. |
| 7. 실행 명령·실측 근거 고정 | 통합된 package scripts의 필수 smoke·S3 추가 검사, stdout/stderr/exit/시간/browser/source/build SHA·작업별 artifact 경로. 기존 기능 baseline과 오류를 보존. 4테마 토큰표·HTML/surface matrix·에셋 입력/12개 hash는 검증 입력으로 연결하고, 구현 뒤 W0/W3/W5에서 실제 합성 대비·geometry/slot·DPR2/throttle·CLS·Gemini 육안 검수 수행. 미구현 테마의 실제 DOM 값이나 새 셸의 529px 대체값을 착수 전 실측했다고 쓰지 않음. |
| 8. 확인·디스패치 | 위 산출물을 새 해시의 단일 정본과 첨부에 반영하고 astra가 변화/충돌 및 이견0을 재확인한 뒤 sol에 W0 전달. 단계 후 astra 검수, 최종 Gemini 육안+Codx 수치 교차 및 production 복원/static을 유지. |

재산출이 필요한 실제 증거도 있다. [2차와 현재 source 대조](r2-current-source-check.json)에서 시각 scenarios의 SHA가 달라졌다. [diff](r2-current-scenarios.diff)는 PDF page-numbers/header-footer 2개 상태에 `pdf-finish-preflight-ready` 대기가 추가됐음을 보여준다. profile 이름·개수는 여전히406이다. 따라서 **개수 동일만으로 옛 fixture/state/PNG/bundle 기준을 통합 해시에 재사용할 수 없다**. N5의 기존 fixture/state 보존과 GATES의 source/build SHA 기록이 이를 이미 포괄한다.

## 6. 실제 실행 결과와 한계

실행 위치는 저장소 루트이며 아래 스크립트의 출력은 모두 작업 전용 폴더로 제한했다.

| 실제 명령 | 결과·로그 |
|---|---|
| `python3 /tmp/worklazy-ui-r3/audit.py` | exit0. 사본42/역사 SHA41, 406+70/별도16, 144 대비 통과. [audit.log](audit.log) |
| `python3 /tmp/worklazy-ui-r3/crosswalk.py` | exit0. 원문41행/문단·129문장, N1~N7 미대조 본문행0·미반영0. 의미 판정은 문서 직접 대조, 스크립트는 행 보존/보고서 생성과 누락검사다. [crosswalk.log](crosswalk.log) |
| `node /tmp/worklazy-ui-r3/profile-current.mjs` | exit0. 현재85/203→406, 저장 목록과 exact deep equality. [profile-current.log](profile-current.log) |
| `node /tmp/worklazy-ui-r3/fixture-check.mjs` | exit0. storage-only·iframe guard·두 adapter·DOM 값 불일치 거부. Node VM/adapter 검사이며 브라우저 검증 아님. [fixture-check.log](fixture-check.log) |
| `python3 /tmp/worklazy-ui-r3/supporting-check.py` | exit0. 열린 문서18개·원본2/산출12 SHA·encoder signature·CSP3경로 확인. [supporting-check.log](supporting-check.log) |
| `python3 /tmp/worklazy-ui-r3/final-check.py` | exit0. 아래 불변성 관측. [final-check.log](final-check.log) |

보조 검사 작성 중 실패 2건도 보존했다. 첫 audit는 필수 첨부가 아닌 원본 실험실의 `lab/cases.json`이 사본에도 있다고 가정해 FileNotFoundError로 exit1이었다([원로그](audit-first-missing-optional-lab-input.log)). 사본의 공개 대비표에 있는 36개 케이스를 검사 스크립트에 명시해 4테마 재계산으로 수정했다. 첫 crosswalk는 v3 제목/채택문의 행을 한 줄 앞서 지정해 assert가 exit1이었다([원로그](crosswalk-first-line-anchor-failure.log)). 실제 `nl -ba` 출력 L178/L181로 바로잡고 N1/N2 행 참조도 정정한 최종 대조가 통과했다. 둘 다 검토 보조 스크립트의 입력/행 지정 실수이며 제품 또는 정본 실패로 보고하지 않는다.

빌드·unit·static·전체 visual·a11y·rendering·실제 native dialog/IME/soft keyboard·제품 DOM 대비·에셋 재인코딩/새 decode는 이번 읽기 중심 확인 범위에서 실행하지 않았다. 기존 2차 computed 측정과 신규 산술/함수 검사를 구분했다. 구현 완료나 배포 가능 판정은 하지 않는다.

## 7. 불변성 관측

[시작 상태](start-status.txt), [종료 상태](end-status.txt), [시작 추적 SHA](start-tracked-sha256.json), [종료 추적 SHA](end-tracked-sha256.json), [판정 JSON](immutability.json)을 보존했다.

- HEAD·브랜치와 `git status --short --branch` 출력은 시작/종료 동일했다.
- 추적 파일 **2,587개**의 SHA를 대조했다. 그중 검토 중 **3개 변화**를 관측했다: `src/features/pdf-editor/PdfEditorPage.tsx`, `src/features/pdf-editor/PdfFinishPanel.tsx`, `tests/pdf-finish-smoke.mjs`.
- 위 파일은 시작부터 병행 PDF 잡의 수정 상태였으며 이 세션에서 쓰지 않았다. 변화는 보존했고 원상복구하지 않았다. **저장소 전체 불변이라고 주장하지 않는다.** status만 같아도 bytes가 달라질 수 있음을 SHA로 구분했다.
- 정본·첨부·역할/공통 규칙·newui를 포함한 별도 검토 입력 **82개는 SHA 변경0**이었다. 이번 검사 입력과 산출물의 출처가 안정됐음을 확인했다.
- 모든 mutation 명령의 대상은 `/tmp/worklazy-ui-r3/`뿐이다. 병행 두 작업트리 수정, 커밋·push·branch 전환, 포트 점유는 0회다.

## 최종 선언

**잔여 이견 0건. Claude–Codex 간 이견 0 · [정본화 가능].**

**구현 착수는 S3 main 통합 후 새 해시의 실측·profile·bundle baseline과 실행 게이트를 재산출하고, 갱신 정본에 대한 이견 0을 재확인하여 sol W0 디스패치를 받은 뒤다.**

— Codx
