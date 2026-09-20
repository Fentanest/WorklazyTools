# U4-4 fix-5 최소 범위 재검수 6차 — 89873f7

**[검수 통과] — fix-4의 새로고침 버튼 대비 회귀가 해소됐다. 이번 수정의 신규 결함 및 검수 잔여는 0건이며, 지정한 U4-4 종결 조건을 충족한다.** 다음 단계 구현·병합·배포는 이 보고서에서 실행하지 않았다.

검수자: Codex / gpt-6-astra, 2026-09-08 KST. Worklazy Tools 자체 제품의 품질 검증. 실행 위치는 `/tmp/worklazy-u4-4-review6/repo`, 기준은 `git archive 89873f7b1e0c4a32e41b0acb8120e5e289c60fcb`이다.

## 실행 경계·기준

- 원본: `/home/better0101/projects/worklazytools`, 브랜치 `s3-pdf-finish`, HEAD **89873f7b1e0c4a32e41b0acb8120e5e289c60fcb**. 시작·종료 일치.
- 첫 행동으로 PROJECT_RULES.md 전문을 읽고 AGENTS.md, 5차 보고서의 신규 대비 결함·수정 문안, fix-5 지시서와 sol 보고서를 순서대로 읽었다. PDF 정본·관련 review-notes·열린 계획 19개를 대조했으며, 이번 저장소 불변 검수와 상반된 지시는 없다. [선독 원문·SHA](evidence/source-documents.json), [열린 계획 검사](evidence/open-plan-gate.json).
- 모든 빌드·브라우저 검증은 직렬, `NODE_OPTIONS=--max-old-space-size=4096`. Vite 포트는 **4280·4281·4282·4283**, 모두 `--strictPort`. Chrome **152.0.7977.64**, Node **22.17.1**, Playwright **1.63.0**, Axe **4.13.0**.
- 이전 PDF 검수의 node_modules·미추적 vendor 캐시를 이번 사본으로 **복사**하고 현행 prebuild 패치·검증을 실행했다. 원본 node_modules에 쓰거나 새 `npm ci`를 수행했다고 주장하지 않는다. 모든 산출물·임시 캐시·로그는 이 보고서 디렉터리 안에 있다.
- 추적 파일 수정·커밋·push·브랜치 전환을 하지 않았다. 지정된 접근 금지 worktree에 접근하지 않았으며 사용자 미추적 파일 내용을 읽거나 변경하지 않았다.
- **main 참조 차이:** 지시서의 고정 동기화 대상 `597a92ff56ed9c3eb23755a58df2580b0269b8bd`는 존재하지만, 이번 세션의 로컬 `main`은 **cdb4007faea277ffc3ae9f3f7f4fe6fd8b8ba7be**다. 이를 이동시키지 않았다. 두 대상을 별도로 읽기 전용 비교했으며 이 차이는 고정된 PDF 검수 HEAD의 전제를 깨지 않는다. 실제 통합 시 대상 해시를 다시 확정해야 한다.

## 항목별 판정

아래 `node probes/…`·`python3 probes/…`는 `/tmp/worklazy-u4-4-review6` 기준이고 npm 명령은 `repo/` 기준이다. 환경·명령·exit·실행 시간은 [빌드 실행표](evidence/build-commands.json), [범위 검사 실행표](evidence/scoped-commands.json), [브라우저 실행표](evidence/browser-commands.json), [공통 환경](evidence/environment.json)에 보존했다.

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| 4조합 × 3상태 실제 픽셀 대비 | 통과 | `python3 probes/browser.py`의 `independent.mjs` → `pixels.py`: **12/12 ≥4.5**, 최저 **12.0215:1**. 배경 PNG와 독립 Python 계산 보존 | 없음 |
| marker·분류·상한 회피 및 공용 영향 | 통과 | `git diff c328885..89873f7`; F2 marker **15→15**, 공용 palette/Button/locale/의존성 변경 0. 제품 diff를 세 색 클래스 추가만 제거하면 부모 파일과 byte 동일 | 없음. 이 범위 유지 |
| 새 검사 실제 실행·실패 능력 | 통과 | 등록 4조합 실제 실행. 색 되돌림 **exit 1, 4.2746:1**. normal/hover/focus만 각각 저대비로 만든 실행 **각 exit 1**. 원래 집계기 미달·누락 음성 **28/28 거부** | 없음 |
| dark 판단 불가 노드 분리 | 통과 | `resolvedIncomplete` **2노드**, `measured-pixel`; 실제 `.bg-background` selector가 각각 유일한 `pdf-display-reload`임을 DOM 재현. shared 수치 혼입 0 | 없음 |
| 버튼 계약 | 통과 | 한/영 문구·Tab 접근·focus-visible·Enter reload, **ko 142.09375×36 / en 132.0625×36px**. 색 되돌림 전후 6상태 크기 동일 | 없음 |
| R-C 두 오류 요소 유지 | 통과 | 공식 a11y **7.6428 / 6.9595 / 8.9891 / 8.3795** 재현. 독립 8bit 배경 픽셀 계산도 전부 ≥4.5 | 없음 |
| R-A 복구 유지 | 통과 | `node probes/display-recovery.mjs`: ko/en 첫 자산 중단 뒤 1.2초 자동 재시도·reload **0**, 명시적 reload 후 파일 0, 재선택 preview·저장 **성공**, `%PDF-` | 없음 |
| tsc·production/QA build | 통과 | `npx tsc -b` exit 0; `npm run build` 및 `VITE_LOCAL_QA=1 npm run build` exit 0, **2,847 modules·정적 69페이지** | 없음 |
| watermark 접근성 | 통과, 공용 미확정 부채는 별도 | 지정 **9상태**, violations 0 / F2 incomplete 0 / shared incomplete **451** / pixel-resolved **2** / 외부 요청 0. 공용 451을 pass로 세지 않음 | 기존 공용 부채는 UI 재설계 백로그 |
| watermark 시각 | 통과 | `VISUAL_ONLY=pdf-finish-watermark--interaction VISUAL_CONCURRENCY=1 VISUAL_TEST_PORT=4283 npm run test:visual`: **8/8**, 기준선 변경 0 | 없음 |
| 변경 범위·공백·원본 불변 | 통과 | `git diff --stat c328885..89873f7`: **5파일 +185/−6**. `git diff --check`, 커밋간 diff check exit 0. 원본/검증 사본 추적 **2,621파일 SHA 변화 0** | 없음 |

## 실제 배경 픽셀 재측정

sol의 측정 결과를 그대로 판정에 사용하지 않았다. 별도 Playwright 프로브가 정상 PDF의 최초 표시 자산 요청을 중단한 뒤 실제 버튼에 normal·hover·**키보드 Tab으로 focus-visible**을 적용했다. 각 상태 적용 여부를 DOM에서 단언했다. DPR 1, 1280×800, ko-KR/en-US, light/dark, reduced motion이며 전환을 끄고 프레임을 정착시켰다.

전경색을 브라우저 canvas로 sRGB RGBA에 변환하고, 해당 버튼의 전경만 투명하게 해 배경 PNG를 채취했다. 배경·레이아웃·상호작용 상태는 유지했다. 테두리·둥근 모서리·focus ring을 제외한 내부 사각형의 **모든 픽셀**에 대해 별도 Python/Pillow 코드로 WCAG 상대 휘도를 계산하고 최저값을 취했다. 버튼에 포함된 아이콘도 currentColor이므로 배경 채취 때 함께 사라진다. 전경은 전부 불투명이다. [프로브](probes/independent.mjs), [독립 계산](probes/pixels.py), [전경·DOM·파일 경로 원자료](evidence/independent-raw.json), [픽셀별 배경 분포·최저값](evidence/independent-pixels.json).

| 언어·테마 | 수정 후 normal | 수정 후 hover | 수정 후 focus-visible | 색 되돌림 normal / hover / focus-visible |
|---|---:|---:|---:|---:|
| ko light | 15.8771 | 12.0215 | 15.8771 | 4.2746 / 12.0215 / 4.2746 |
| en light | 15.8771 | 12.0491 | 15.8771 | 4.2746 / 12.0491 / 4.2746 |
| ko dark | 17.4330 | 15.8803 | 17.4330 | 6.5720 / 15.8803 / 6.5720 |
| en dark | 17.5118 | 15.8803 | 17.5118 | 6.6017 / 15.8803 / 6.6017 |

예를 들어 light normal의 실제 배경은 **(242,242,247)**, ko light hover의 최저 대비 배경은 **(227,208,213)**, ko dark normal은 **(26,13,11)**이다. dark를 단일 CSS 배경색으로 가정하지 않았다. 픽셀 측정값은 공식 새 하네스의 12값과 일치한다. 버튼의 실제 글자·아이콘·focus ring 화면도 직접 열어 확인했다. [ko light focus](shots/ko-light-fixed-focus-visible.png), [en light focus](shots/en-light-fixed-focus-visible.png), [ko dark](shots/ko-dark-fixed-normal.png), [en dark 전체 오류 화면](shots/en-dark-error-page.png).

**좁은 R-C 확인:** 공식 기존 방법의 textarea/notice 대비는 ko/en light **7.6428/6.9595**, dark **8.9891/8.3795**로 이전과 같다. 추가 독립 PNG 방법은 light **7.6430/6.9587**, dark **8.9563/8.3498**이다. 후자는 색·합성이 8bit 렌더 픽셀로 양자화된 측정이며, CSS 실수 합성값과 동일하다고 표기하지 않는다. 두 방법 모두 충분히 4.5 이상이고 관련 제품 파일은 부모와 byte 동일하다. 이 차이를 제품 색 변경이나 대비 회귀로 세지 않는다.

## 음성 주입·귀속·버튼 보존

**실제 색 되돌림:** [외부 preload](probes/inject.mjs)가 브라우저 DOM에서 새 `text-foreground`·`focus-visible:text-foreground`만 제거했다. 부모 Button primitive에 이미 있었던 `hover:text-foreground`는 남겨 **c328885의 계산 색 계약**을 복원했다. 제품 소스·생성물·검사 소스는 바꾸지 않았다. 그 상태에 **이번 커밋의 원래 `tests/accessibility-audit.mjs`**를 실행했다. 4조합을 실제 수집한 뒤 light normal **4.27458950673584** 때문에 `PDF display reload contrast is below 4.5:1`로 **exit 1**이었다. raw Axe도 light 위반 2건을 보존한다.

정상 상태 이외도 실제 검사하는지 보기 위해 ko light에서 **한 상태에만 `rgb(176,176,176)`**를 적용했다. 각 실행의 다른 두 상태는 정상 대비를 유지한다.

| 실제 브라우저 주입 | normal | hover | focus-visible | 원래 검사 결과 |
|---|---:|---:|---:|---|
| normal만 저대비 | 1.9435 | 12.0215 | 15.8771 | normal 지목, exit 1 |
| hover만 저대비 | 15.8771 | 1.4716 | 15.8771 | hover 지목, exit 1 |
| focus-visible만 저대비 | 15.8771 | 12.0215 | 1.9435 | focus 지목, exit 1 |

[원시 실행·오류 요약](evidence/negative-summary.json), [되돌림 원결과](evidence/negative-revert.json), [실행 명령](evidence/browser-commands.json). 따라서 Axe가 normal 시점만 읽는다고 hover/focus 위반이 빠져나가지 않는다.

**상태 누락 음성:** 실제 통과 보고서를 복제하여 4조합×3상태의 ratio 하나를 **4.49**로 바꾸는 12건, 상태 하나를 제거하는 12건, 페이지 하나를 제거하는 4건을 **원래 `assertAccessibilityResults`**에 전달했다. 전부 해당 대비/상태/등록 오류로 거부했다. [프로브](probes/aggregate-negatives.mjs), [28건 결과](evidence/aggregate-negatives.json). 이것은 보고서 집계 음성이고 앞의 실제 색 주입과 구별한다.

**dark 2노드:** ko/en dark의 Axe 원 target은 `['.bg-background']`, reason은 background gradient이다. target 문자열에 testid가 없다는 이유로 버리거나 다른 노드로 간주하지 않았다. 별도 브라우저 조회에서 각 selector의 일치 수가 **1**, 그 요소가 **pdf-display-reload**임을 확인했다. [실제 DOM 확인](evidence/resolved-targets.json), [프로브](probes/resolved-targets.mjs). 하네스는 정확한 버튼·표시 실패 scenario·color-contrast 조합만 `measured-pixel`로 별도 보존하며 세 상태 대비 검사를 통과해야 전체 게이트가 통과한다.

공용 부채 수치는 실행 범위별로 구분한다. 이전과 같은 **5상태의 incomplete 노드·target·reason·owner 원문은 완전히 동일**, shared **253**이다. 새 표시 실패 4상태를 포함한 9상태 shared는 **451**이며, 이는 상태 표본 추가분 **198**을 포함한다. 별도로 보존한 버튼 **2**를 451에 넣지 않았다. 과거 전체 12페이지 **925**와 이번 451을 동일 범위 수치처럼 비교하지 않으며, 둘 다 “해소된 위반”으로 바꾸지 않는다.

**코드와 다른 소비처:** [전체 diff](evidence/scope.diff), [범위 증명](evidence/scope-proof.json). 제품 변경은 `pdfUi.tsx`의 한 버튼 className에 세 전경색 utility를 추가한 것뿐이다. marker **15개 불변**, 한도 critical/serious/total **0**, 공용 CSS·Button primitive·locale·package/lock 무변경이다. 접근성 단위 검사 파일 1개는 새 게이트의 직접 회귀이며 범위 밖 제품 수정이 아니다.

`PdfError`는 Finish/Organize/Image/Convert에서도 소비된다. 따라서 **이 동일한 표시 실패 새로고침 버튼에는 같은 색 교정이 적용된다**는 점을 명시한다. 일반 Button 소비처, 오류 제목·설명, 다른 오류의 버튼 표시 조건에는 변화가 없다. 이번에는 지시대로 다른 모드의 전체 스모크를 재실행하지 않았고, source diff 및 부모 byte 대조로 영향 경계를 확인했다.

**R-A·기하:** 양 언어 모두 첫 요청 중단 후 1.2초 동안 자동 retry/reload 0, 안내는 연결 확인→새로고침→PDF 재선택이고 내부 예외·자산 경로 노출 0이다. Tab/Shift+Tab의 focus-visible에서 Enter로 reload한 뒤 input.files·선택 목록 0, 같은 정상 PDF 재선택으로 preview와 저장을 완료했다. 출력 header `%PDF-`, route error 0, 고유 표시 자산 URL 1개이다. [복구 결과](evidence/display-recovery.json), [실측 크기](evidence/geometry.json). 정상/hover/focus 및 되돌림 대조의 모든 크기는 ko **142.09375×36**, en **132.0625×36**이다. 36px 계약을 44px로 바꿨다고 주장하지 않는다.

## 좁은 회귀·미실행 범위

| 실행 | exit / 결과 | 로그 |
|---|---|---|
| `npx tsc -b` | 0, 21.14초 | [tsc](logs/tsc.log) |
| `npm run build` | 0, 111.18초 | [production](logs/build.log) |
| `VITE_LOCAL_QA=1 npm run build` | 0, 95.69초 | [QA](logs/build-qa.log) |
| 지정 9상태 `npm run test:a11y` | 0, 47.37초 | [a11y](logs/a11y.log) |
| watermark interaction `npm run test:visual` | 0, 31.68초, 8/8 | [visual](logs/visual.log) |
| 독립 픽셀·복구 | 각 0 | [픽셀](logs/pixels.log), [복구](logs/display-recovery.log) |
| 실제 색 음성 4실행 | 예상 exit 1을 각각 확인 | [되돌림](logs/negative-revert.log), [normal](logs/negative-normal.log), [hover](logs/negative-hover.log), [focus](logs/negative-focus.log) |
| 집계 음성·실제 selector 확인 | 각각 통과 | [28음성](logs/aggregate-negatives.log), [selector](logs/resolved-targets.log) |
| `git diff --check` 및 `git diff --check c328885..89873f7` | 0, 출력 없음 | [현재](evidence/diff-check.log), [커밋간](evidence/commit-diff-check.log) |

시각 8개는 `pdf-finish-watermark__interaction__{ko,en}__{light,dark}__{desktop,mobile}.png` 전부다. 각 파일이 기존 임계 **≤0.100%**를 통과했으며, **변경 파일·기준선 갱신 0**이므로 파일별 변경 사유는 없다. 성공 캡처를 하네스가 별도 actual 산출물로 남기지는 않으므로 해당 8개 실행 증거는 로그이며, 새 버튼·오류 화면 PNG는 별도 독립 프로브의 `shots/`에 있다. 시각 pass를 모든 픽셀 byte equality라고 확대하지 않는다.

**이번에 하지 않은 검사:** full unit, full browser, PDF finish, 성능 재측정, bundle:measure, static, full a11y, css:orphans, legacy:manifest, tool-registry-routes, legacy oracle, 골든 160 및 기타 전 스코프. 위 실행표 이외의 과거 통과는 아래 종결 참고 이력이며 **이번 재실행 결과가 아니다**.

프로브 실패도 숨기지 않는다. 집계 검토 첫 실행은 Axe target에 `pdf-display-reload` 문자열이 들어 있어야 한다는 잘못된 가정으로 실패했다([첫 로그](logs/aggregate-negatives-first.log)). 원 target `.bg-background`를 보존하고 실제 DOM의 유일한 버튼임을 추가 재현한 뒤 통과했다. 음성 로그 요약 첫 시도는 마지막 줄(Node 버전)을 오류 문장으로 잘못 골라 실패했으며, 실제 `Error: PDF display reload contrast…` 행을 선택해 재집계했다. 둘 다 제품/검사 코드를 바꾸지 않은 증거 처리 보정이고 신규 제품 결함으로 세지 않는다.

## U4-4 종결·U4-5 착수 조건

이번에 지정된 유일 잔여 P2 대비 결함은 해소됐고 U4-4 검수 잔여는 **0**이다. U4-5는 다음 조건으로 이어간다.

1. Claude가 이 **astra 검수 통과**를 입력으로 U4-4 잔여 0·종결을 취합한다. 본 작업의 기술 검수는 완료됐으며 추가 U4-4 코드 수리 지시는 없다.
2. 아래 **128MiB 대체 판정**, 의존 패치 유지 방침, 공용 부채와 통합 회귀 이월분을 후속 정본·백로그에 인계한다. 추적 문서 수정 금지이므로 이번에는 REPORT에만 종결 문안을 저장했다. 이전 목표 미달 기록을 pass로 덮지 않는다.
3. U4-5 **F3 도장·서명, `/stamp`, undo/redo, 비전자서명 고지, 골든⑤**의 기준 HEAD·완료 명령·명시 제외 목록이 있는 정본 지시서를 sol에 전달한다. 새 결정이 필요하면 Claude–Codex 이견 0을 먼저 확보한다. 이 대화만으로 코딩에 착수하지 않는다.
4. 좁은 잔여 예산, 특히 **PDF route 3,017B / app 13,391B**를 반영해 F3를 진행한다. 이는 아래 과거 확정 측정의 잔여이며 새 단계 변경 비용을 0으로 가정하지 않는다. 계획이 기존 예산·계약 밖의 결정을 요구하면 범위 밖 발견으로 보고한다.
5. main/Excel 통합 순서와 실제 기준 해시를 다시 고정하고 열린 계획 충돌 게이트를 적용한다. 이 검수는 main 동기화·배포 권한 행사나 전체 U4 완료 선언이 아니다.

## 최신 확정 번들 잔여 예산

**최신 확정값은 c328885의 5차 검수**에서 동일 절차로 독립 재현한 값이다. 이번 89873f7에서는 지시대로 번들 재측정을 하지 않았다. 따라서 아래를 “89873f7 재측정값” 또는 “이번 색 변경 비용 0B”로 쓰지 않는다. [원측정 provenance·상한·증분](evidence/latest-confirmed-budget.json), [5차 원보고](evidence/source-docs/06-REPORT.md).

| gzip 지표 | 확정 증분 B | 상한 B | 잔여 B |
|---|---:|---:|---:|
| entry JS | 7,288 | 20,480 | **13,192** |
| PDF route JS | 58,423 | 61,440 | **3,017** |
| shared JS, 귀속 이동 제외 | 2,095 | 30,720 | **28,625** |
| app JS | 68,529 | 81,920 | **13,391** |
| CSS | 300 | 10,240 | **9,940** |

상한·multiplier **1**·override **{}**를 유지한다. 기준 소스는 `5bc6854175331bdd73b267784d9633cdccda8446`, schema-v3이며 baseline/current 모두 **현행 계측 build → 현행 정적 생성 → 같은 output tree**이다. 모든 포함 `.js/.mjs` 경로를 보존하고 동일 SHA에 gzip을 한 번 부과한다. 예전 불완전 schema2나 중복 `.mjs`를 누락한 낮은 예산으로 돌아가지 않는다. 현재의 full 비교 통과 이력도 보존하며, 다른 route 감소로 PDF route 증가를 상쇄하는 해석은 허용하지 않는다.

## 병합 직전 전체 회귀 — 누적 이월 목록

다음은 **이번 검수에서 실행하지 않은, 병합 직전 통합 게이트에서 1회 취합할 목록**이다. 과거 회차에서 통과했더라도 최종 통합본의 결과가 필요하다. production 검증 후 추적을 제거한 QA 빌드로 시각·a11y를 수행하고, production용 static/광고 검사를 QA 산출물에 적용하지 않는다. `TEST_SCOPE`, `A11Y_PAGE_IDS`, `VISUAL_ONLY` 같은 이번 축소 필터를 full 실행에 남기지 않는다.

1. **빌드·기본 정합성:** `npx tsc -b`, production `npm run build`, **전체 `npm run test:unit`**, `npm run test:static`, `git diff --check`.
2. **전 스코프 스모크:** **전체 `npm run test:browser`**, `npm run test:new-tools`, `npm run test:utilities`, `npm run test:office`, `npm run test:qr-bulk`, **`npm run test:qr-font-render`**, `npm run test:recovery`. legacy PDF 4모드는 full browser의 PDF 실행을 확인하고, 정본 명시 명령 `TEST_SCOPE=pdf npm run test:browser`의 커버리지를 기록한다.
3. **Excel·공동 기반 회귀:** `npm run test:excel-cleaner`, `npm run test:excel-compare`(PDF F0b facade와 공용 하네스 회귀 포함). Excel 통합과 기존 전역 스택 계약에 맞춰 **`npm run test:xls-preserve`**, **`npm run test:xls-first-load`**, **`npm run test:video-hybrid`**도 취합한다. 금지 worktree에서 지금 실행한다는 뜻이 아니다.
4. **PDF finish와 실제 출력:** `npm run test:pdf-finish`(**smoke + PDF.js/Poppler image128·text32=160골든**), `npm run fixtures:pdf-legacy-oracle`(**totalDiffs 0**), U4-0 fixture 생성 결정성 **2회**와 `npm run test:pdf-finish-oracle`. 기존 4모드·F1 다중 줄·단일 표시 URL·직접 진입/SPA·청크404·파일 수명주기·취소/재시도·영어 모바일 계약을 보존한다.
5. **U4-4에서 실제 깨졌던 출력/파싱 경계:** 정상 inline `)` 및 EI 유사 payload, descender·다중 줄·회전·single/tile·Noto, 0개 배치·회전 이탈 차단과 1픽셀 양성, 공백/줄바꿈, 6영역·범위·400타일/401거부, 확실한 zero clip/결과 재개방 실패, 불확실 clip 경고·동의 유지, marker/DOM 소유 귀속 음성, 원시 구현 명칭 비노출. 하네스 기본 등록에 없는 것은 기존 보존 프로브의 명령을 최종 통합 실행표에 명시한다.
6. **성능·취소:** `npm run test:pdf-watermark-performance`의 현행 **12입력×3 새 context** 및 cold 경로. 16/32/64MiB는 각 실행의 최대 heartbeat **≤200ms**를 확인하고 중앙값으로 초과를 숨기지 않는다. 128MiB는 아래 대체 요구(실제 진행 paint, 외부 취소 **≤250ms**, 늦은 결과0, 같은 탭 재시도, 준선형 총시간)를 확인한다. Worker 생성 불가 fallback preview/save를 함께 보존하며, 호환 경로 전체에 200ms를 보장했다고 확대하지 않는다.
7. **의존 패치:** exact 6.2.108·lock·4변형 원본/패치 SHA와 멱등성을 확인한다. 최소 한 건의 미지 버전/hash 주입이 실제 **build/Vite 전에 fail-closed**하는지 재현한다. 패치/의존성이 통합 중 바뀌면 4빌드×180 렌더, LE/BE scalar/tail oracle, 5음성, worker/fallback·기존 소비처까지 아래 유지 방침의 전체 갱신 게이트를 적용한다.
8. **시각 전량:** `VITE_LOCAL_QA=1 npm run build` 후 `LANG=ko_KR.UTF-8 VISUAL_CONCURRENCY=1 npm run test:visual` 및 `LANG=en_US.UTF-8 VISUAL_CONCURRENCY=1 npm run test:visual`. 필터 없이 현재 전체 등록을 실행하고 영어 모바일·navigation·finish 신규 상태를 포함한다. 과거 실측 **211/211×2**와 정본 예측 219를 혼동하지 말고 최종 통합본의 실제 캡처 수·시간(정본 상한20분)·임계·기준선별 변경 사유를 기록한다. 기준선 갱신만으로 깨진 상태를 승인하지 않는다.
9. **접근성 전량:** `A11Y_MAX_TOTAL=0 npm run test:a11y`(critical/serious도0), finish desktop/mobile 및 기존 오류4·표시 실패4조합을 포함한다. reload 세 상태의 실제 픽셀 대비·색 되돌림·누락 음성 유지. `incomplete` target/reason/owner 보존, F2 신규0, shared 부채 별도, dark 버튼 measured-pixel 별도 보존을 재확인한다.
10. **렌더링:** `npm run test:rendering`, finish 경로 등록 및 **CLS ≤0.1 절대**. 전체 시각/CLS를 이번 watermark8 결과로 대체하지 않는다.
11. **번들 전체:** production 환경에서 `npm run bundle:measure`를 **검증된 schema-v3 기준선 + `BUNDLE_ROUTES=pdf-editor`**와 **route 필터 없는 full 비교**로 실행한다. entry/route/shared/app/CSS 5상한·multiplier/override 불변, baseline/current 같은 생성 절차, 모든 배포 실행 자산 physical census·raw network 대조, SHA 1회 비용·전체 경로 보존, 양방향 inventory, 누락 `.mjs`·같은 SHA 별칭/내용 변경 음성을 확인한다. 측정 범위/도구가 바뀌면 양쪽 기준선을 같은 절차로 재생성하고 provenance와 기존 bytes 변동을 설명한다.
12. **정적·레지스트리/잔존 소유:** `npm run css:orphans`, `npm run legacy:manifest`, `node tests/tool-registry-routes.mjs`(**20 도구 불변**) 및 생성물 diff 검토. locale `features.json`·SEO/정적/FAQ/소셜·canonical/hreflang/sitemap 및 일반 PDF 광고 로더 정상, 광고 제외 경로 0의 계약도 확인한다. 광역 금지 계약은 실행 확장자 전체 재귀 탐색과 목적·소유자 있는 최소 허용목록을 유지한다.
13. **통합 육안 게이트:** 추적 없는 로컬 QA에서 Gemini 실제 브라우저 검수 + Claude 육안 + Codex DOM 실측. 모바일 한글 세로 낙하, label 잘림, Tab 초점/고정 하단 탭 가림, 토글 내부 정렬을 포함한다. 자동 시각 일치로 대체하지 않는다.

아직 구현하지 않은 **U4-5~8**이 완료되면 정본 총람의 골든①~⑦, F4b 벤치(4fixture×3쪽수×3DPI×2포맷×2환경)·가독성/포맷 oracle, 재구축/OC 제거 허용 집합 두 렌더러 RGBA SHA·전체 indirect-object orphan 부재, F5 복합 실행·공유 font 단일 임베드까지 **최종 U4 통합 게이트**에 합류한다. 이를 이번 U4-4의 미해결 결함으로 세지 않는다. 배포 후 라이브 점검·Gemini 라이브 재검수는 별도의 **배포 후** 게이트로 유지한다.

## main 동기화 예상 충돌 표면

[고정 main 및 실제 로컬 main 교집합](evidence/main-overlap.json), [597a92f 충돌 판정](evidence/main-597a92f-conflicts.json), [로컬 main 충돌 판정](evidence/main-main-conflicts.json). `git merge-tree --trivial-merge <공통기준> <main해시> 89873f7`로 읽기 전용 계산했으며 merge/index 갱신은 없다.

- **597a92f → s3-pdf-finish:** 공통 변경은 `CHANGELOG.md`, `docs/review-notes.md`, `package.json` **3파일**. 문서 **2개 textual conflict**, package.json은 해당 3-way에서 자동 합성된다. 이 고정 비교에서는 제품 src 교집합이 없다. 로컬 main cdb4007 비교도 같은 세 파일·두 문서 충돌이다.
- **Excel S4가 통합된 이후의 잠재 공동 표면:** ko/en `src/locales/{ko,en}/features.json`; `src/app/seo.ts`와 locale SEO/tools·FAQ/정적 생성 입력; `tests/accessibility-audit.mjs`·대응 unit; `tests/visual-regression.mjs`·config/scenarios·기준선; `tests/browser-smoke.mjs`; rendering 하네스·unit; `package.json` scripts/prebuild 패치 훅; `CHANGELOG.md`·`docs/review-notes.md`·`docs/backlog.md`. 이는 **열린 Excel 정본과 PDF 변경 목록으로 예측한 표면**이지 접근 금지 작업트리의 실측 conflict 목록이 아니다.
- locale는 Excel/PDF key namespace를 각각 보존하고, SEO/FAQ는 두 기능의 입력을 합친 뒤 생성기로 재생성한다. a11y는 양 작업의 등록 상태·owner·음성 게이트와 unit 기대 목록을 모두 남긴다. visual/browser는 scenario·선택자·고정 locale/clock 계약을 파일별로 합친다. 기록은 양쪽 내용을 보존하고, `package.json`의 자동 merge도 scripts/patch hook 의미를 검토한다. 한쪽 파일 전체 선택으로 해결하지 않는다.

## U4-4 전체 요약·백로그·후속 정본

F2는 벡터 텍스트/PNG·JPEG 워터마크, 전경/배경의 독립 content stream, 단일/반복 타일, 페이지·영역·회전 배치, 위험 구조 경고와 동의, 근사 미리보기 및 결과 재개방 검증을 구현했다. 검수는 멈춤·출력 손실·UI·검사 누락을 드러냈고 다섯 번의 수리 뒤 이번에 종결한다. 과거 통과 사실은 선독 자료의 기록이며 이번 최소 검수에서 전량 재현한 것이 아니다.

**결함 수는 회차별 판정 단위로 집계한다.** 재발·미해소·세부 반례가 있으므로 아래 합을 서로 다른 고유 결함 수로 부풀리지 않는다.

| 검수 회차 | 당시 판정 수 | 성격·최종 귀속 |
|---|---:|---|
| 1차 | **9건: P1 1 + P2 7 + P3 1** | R1 정상 inline scanner 무한 정지, R2 descender 손실, R3 0개 배치 성공, R4 모바일 탭 겹침, R5 F1 다중 줄 회귀, R6 고정 타일 미리보기, R7 정본 범위/영역/취소 미준수, R8 incomplete 폐기, R9 내부 용어. 후속 수리·검수로 해소 |
| 2b | **6묶음: P2 4 + P3 2** | 유효 65,820B PDF의 52초 응답 정지/취소 불가, 정상 EI 오탐, 비가시 출력 성공, F2 DOM 귀속 누락, Poppler 상단 glyph 경계, 안내 내부 명칭. A3 빈 성공 묶음에는 회전 이탈·공백/줄바꿈 세부 반례가 포함됨 |
| 3차 | **P2 1건** | 응답성 수리가 추가한 표시 런타임 중복 `.mjs`가 예산 계측에서 누락. 실제 중복 제거 및 전체 자산 계측으로 해소 |
| 4차 | **수리 대상 3건 + 성능 판단 1건** | R-A 첫 표시 자산 실패 복구/오류 안내, R-B 정적 생성 후 계측 누락, R-C F2 오류 두 요소 대비, R-D 128MiB heartbeat 목표 초과. 원 astra 보고의 R-B는 P3이고 Claude 후속 지시에서 P2로 처리됐음을 구분. R-C는 fix-3 이전에도 있었던 F2 잔여이며 공용 UI 부채가 아님 |
| 5차 | **P2 1건** | fix-4 신규 새로고침 버튼 light 4.2746:1. 이번 6차에서 해소 |
| 이번 6차 | **신규0·잔여0** | 12조합 대비·실제/집계 음성·R-C·R-A·좁은 회귀 통과 |

합계는 **회차별 결함 판정 20건 + 성능 판정 1건의 이력**이며 중복 없는 21개 독립 결함이라는 뜻이 아니다. 1차 566B 무한 정지와 2b 52초 유한 정지를 구분하고, 4차 목표 미달을 코드 수리로 완전 해결했다고 세지 않는다.

다음은 종결을 막는 이번 신규 결함이 아니라 살아 있는 후속이다. 이번에는 추적 문서 편집 금지에 따라 여기 인계하며, 실제 `docs/backlog.md`·정본을 수정했다고 주장하지 않는다.

1. **128MiB heartbeat 목표 미달 — 성능 백로그 및 정본 후속.** 이전 실측 **347.185 / 161.810 / 154.410ms**, 1회가 200ms를 넘었다는 이력은 유지한다. 5차의 다른 세 표본이 200ms 이하여도 전체 보장을 뜻하지 않는다. Claude가 승인한 문안: “16/32/64MiB는 모든 실행의 최대 heartbeat ≤200ms를 유지한다. 128MiB decoded 입력은 그 상한 보장 대상에서 제외하고, 실제 저장 진행 paint·외부 취소 ≤250ms·늦은 결과0·같은 탭 재시도·준선형 총시간으로 판정한다.” pdf-lib 단일 stream 직렬화 구간의 재설계는 별도 성능 과제다. **‘목표 미달’ 기록을 삭제하거나 목표 달성으로 정정하지 않는다.** 5차 대체 요구 통과(진행 프레임3회, 취소 최대46.571ms, 재시도6/6)는 기존 확정 증거로 인계한다.
2. **의존 패치 장기 유지 방침 — 별도 갱신 정본.** `pdfjs-dist` **6.2.108 exact-version/lock**과 modern/legacy×full/minified **4파일·각2치환**, 원본/결과 SHA manifest, prepare/dev/prebuild의 멱등/fail-closed 훅을 유지한다. upstream 수정판 채택은 별도 조사·계획으로 하고 **4빌드×180렌더, LE/BE scalar/tail, 미지 hash/version·치환 수·결과 hash의 5음성, worker/fallback, 기존 소비처·API 호환성**을 통과한 뒤 패치·훅을 제거한다. 이번에는 upstream 최신성을 재조회하거나 버전을 갱신하지 않았다. “최신판으로 올리면 해결”을 전제로 삼지 않는다.
3. **공용 접근성 부채 — 기존 UI 재설계 정본 귀속.** 과거 전체 12페이지 shared925, 초기 수동 판정의 대비 미달183·미확정4·ARIA 보류3을 보존한다. 이번 9상태의451과 별도 pixel2는 다른 범위 집계다. 전역 palette를 F2 수리로 임의 변경하지 않으며 UI 재설계에서 실제 표시/스크롤 상태를 포함해 해결한다. 기존 항목은 이미 `docs/backlog.md`에 있고, 이번 결과의 범위 구분을 후속 기록에 합친다.
4. **Worker 불가 호환 경로의 대형 입력 지연 — 기존 성능 부채.** fallback의 기능·취소/늦은 결과 차단을 유지하되 해당 경로까지 작은 heartbeat를 보장했다고 표현하지 않는다. worker 제거안은 기존 32/64MiB **219/387ms** 회귀로 기각된 이력을 유지한다.
5. **가시성·좌표 지원 한계 — 기존 계약 및 후속 검증.** 불확실 clip/path는 위험 경고·동의와 결과 확인 안내를 유지하며 완전한 가시성 보증을 하지 않는다. 확실한 zero clip/0개 배치/빈 glyph는 거부한다. UserUnit은 PDF.js viewport 좌표 범위이며 두 렌더러 전체 치수 일치를 뜻하지 않는다. 미리보기는 설정에 반응하는 근사이며 저장 PDF 픽셀 완전 동일성을 뜻하지 않는다. F5 복합 실행에서 공유 font 단일 임베드를 다시 확인한다. 기존 subset 재시도 금지와 폰트 백로그도 유지한다.
6. **계측기 유지보수 — 후속 정본.** worker/public JS의 SHA opaque 귀속을 향후 worker realm 모듈 계측으로 확장하는 항목, URL 문법/재귀 소유권 합성 음성, 고정 vendor 제외목록 변경 검토를 유지한다. 물리 배포 census와 raw network를 같은 제외 함수로 필터링해 누락을 가리는 방식, 생성 전 측정, 불완전 schema2 baseline 복귀는 기각된 길이다.
7. **정본·기록 종결 인계.** Claude가 U4-4 종결·128MiB 수정 기준·패치 유지·누적 회귀·다음 단계 기준 해시를 정본화하고, 핵심 결과는 간결한 CHANGELOG 및 수치/기각 사유는 review-notes, 살아 있는 후속은 backlog, jobs 원문은 오프라인 아카이브로 정리한다. 이 REPORT가 해당 문안과 증거의 인계물이다.

## 저장소 불변·보고서 보존

[시작 상태·SHA](evidence/start.json), [종료 상태·SHA](evidence/end.json), [불변 결과](evidence/invariance.json). 재현: `python3 probes/invariance.py`.

원본 HEAD·브랜치·status 동일, **추적 2,621파일 SHA 변화 0**, 검증 archive 사본의 같은 추적 파일 **변화 0**이다. 사용자 기존 미추적 `after.docx`, `before.docx`, 네이버 확인 HTML, `newui/` 상태도 동일하다. 검수 서버는 종료했고 **4280~4289 리스너 0**이다. 원본 저장소의 추적 파일 수정·커밋·push·브랜치 전환은 없다.

이 `REPORT.md`와 로그·JSON·배경 PNG·버튼/오류 화면을 지정 경로에 저장했다. 보고서 존재·바이트·SHA와 상대 링크 확인은 [저장 검증](evidence/report-verification.json)에 기록한다.

**[검수 통과] — U4-4 최소 재검수 완료, 잔여 0.**
