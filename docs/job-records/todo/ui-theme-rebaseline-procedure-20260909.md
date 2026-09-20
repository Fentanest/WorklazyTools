# UI 전면 개편 — U4 이후 기준 재설정 절차 v2

상태: **기준 재설정 절차 정본 — sol R2 이견 0. UI 구현 기준 정본화 아님.** 작성 Codx.
절차 작성 기준 HEAD d9c79b7a16f5b99fa7cddfde741b8d10f08f07d0, s3-pdf-finish. 지시 d3a8d89 이후 U4 통합 상태 변화 존재. **U4 main 병합·배포·배포후 확인 완료가 선행 조건**이다. 현재 작업 브랜치에 main을 합친 것은 이 조건 충족이 아니다. U4가 끝나기 전에 ui-theme-redesign-20260907.md의 구현 기준 HEAD나 W0 숫자를 교체하지 않는다.

## 유지할 정본·열린 계획 충돌
기존 ui-theme-redesign-20260907.md v3 이견0 및 첨부 GATES/PRIMITIVES/CONTRAST/SELECTORS/theme fixture의 설계 결정은 유지한다. 우선순위 v3>v2>v1 유지. 이 절차는 디자인을 새로 승인하지 않는다. 과거 shadcn/P2의 source-count·palette·baseline 강제는 미래 UI 정본의 동일 표면에서 대체하고, U4·QR 폰트·문서비교/Excel 엔진의 출력 계약은 그대로 보존한다. UI 문서의 U1~U6 라벨은 문서결과 화면 개선6항이며 신규도구 U6와 별개임을 새 단일 정본에서 풀어 쓴다. U6와 UI가 AppShell/registry/locale를 공유하면 병렬 구현하지 말고 먼저 착수한 단위 종결 해시로 후속을 재측정한다.

## 절차 정의
R0=U4 종결 증거 고정, R1=현행 입력/하네스 실측, R2=시각·접근성·예산 재산정, R3=단일 문서 재작성과 실제 반박 왕복. 이 라운드에서는 R0~R3 실행 절차만 확정한다.
R0: `git rev-parse HEAD`, `git log -1 --format=fuller`, `git status --short`, `git ls-remote origin refs/heads/main`을 U4 종결 보고서의 배포 SHA와 대조. Actions 성공 및 실제 배포 asset SHA·사후검수까지 확인. 다른 작업 이동이면 차이를 문서로 기록하고 재기준화 범위를 판단한다. U4 미회수 검증이 남으면 R1 실행·UI 착수로 대신하지 않는다.
R1: 별도 /tmp 깨끗한 사본에서 아래 명령으로 값과 **원본 목록**을 저장한다. dark50파일/183 baseline/18 feature key/45 seo route/61 primitive 소비자는 과거 관측일 뿐. 더 뒤의 v3 본문은 203 PNG/406 family 확장+70=476이므로 183 또는476을 고정 기대치로 복사하지 않는다.
```sh
git rev-parse HEAD
rg -l 'dark:' src --glob '*.ts' --glob '*.tsx'
node --input-type=module -e 'import fs from "node:fs"; for(const l of ["ko","en"]) console.log(l,Object.keys(JSON.parse(fs.readFileSync(`src/locales/${l}/features.json`,"utf8"))))'
node --experimental-strip-types --input-type=module -e 'import {seoByPath} from "./src/app/seo.ts"; console.log(Object.keys(seoByPath).sort())'
node --input-type=module -e 'import fs from "node:fs"; console.log(fs.readdirSync("tests/visual-baselines").filter(p=>p.endsWith(".png")).sort())'
rg -l '(components/ui|from ["\x27].*/ui/)' src --glob '*.ts' --glob '*.tsx'
node tests/tool-registry-routes.mjs
```
primitive 소비자는 import AST로 확인하고 `src/components/ui.tsx` wrapper 자체를 포함하는 정의로 고정; ui/ 구현7파일과 단순 명칭 언급 파일은 소비자수에서 빼고 별도 목록. regex는 후보 수집이며 최종수는 실제 import AST 기준. src 전체 .ts/.tsx/.js/.jsx/.mjs/.cjs/.mts/.cts의 실행 import를 열거해 신규 확장자 소비자를 놓치지 않는다. baseline PNG 파일 개수와 actual scenario×profile manifest 개수·누락/고아·duplicate를 별개로 기록. 새 U4 상태·Excel grouped 결과·document result entry helper와 pending UI6항을 전부 대조한다.
R2: 추적 제외 `VITE_LOCAL_QA=1 npm run build` 후 다음 기존 명령을 새 전용 사본에서 실행. 원래 하네스에는 VISUAL_SHARD가 없으므로 임의 환경값으로 축약하지 않는다.
```sh
A11Y_REPORT_PATH=/tmp/worklazy-ui-rebaseline/a11y.json npm run test:a11y
RENDER_REPORT_PATH=/tmp/worklazy-ui-rebaseline/rendering.json npm run test:rendering
LC_ALL=ko_KR.UTF-8 VISUAL_ARTIFACT_DIR=/tmp/worklazy-ui-rebaseline/visual-ko-host npm run test:visual
LC_ALL=en_US.UTF-8 VISUAL_ARTIFACT_DIR=/tmp/worklazy-ui-rebaseline/visual-en-host npm run test:visual
VISUAL_CAPTURE_DIR=tests/visual-artifacts/ui-rebaseline VISUAL_CONSENT_GRANTED=1 npm run test:visual:qa
```
incomplete 최근125는 새 판정의 합격0이 아니다. 위반/incomplete node/동일 selector 중복/각 profile/baseId/소유 feature를 기록. 기존 automatic incomplete는 실제 rendered contrast/ARIA 수동 대조로 해결하거나 미해결 부채로 보존. 미해결 부채 보존은 R2의 관측 기록이며 W5 완료의 면제가 아니다. W5는 기존 GATES대로 axe0·incomplete 미판정0을 실증해야 한다. 공용 UI 귀속은 W1~W4 개선 항목으로 포함, primitive 교체 후 늘어난 incomplete를 inherited로 자동 합산 금지. 새 CSS token 하에서 새로 생긴 위반은 차단. HWP vendor exact 예외 유지. JSON에서 누락 page/unknown verdict/빈 capture가 통과로 보이지 않는 음성 검증 유지.
production 번들은 LOCAL_QA 없이 별도 재빌드하고 고정 schema3 baseline SHA 4caaa9c6c48df99dd740664d7991c995ffff7e8b6deaa7a1d87e982d302c30ea와 U4 종결 관측을 각각 비교. 새 분기점 보고서 저장은 과거 고정 상한을 지우는 baseline reset이 아니다. override{}/multiplier1.
R3: 모든 목록·SHA·새 해시·측정값·이월목록을 하나의 UI 구현 정본으로 다시 정리. gpt-5.6-sol 구현자 반박→수정→재반박→이견0 후에만 그 구현 정본을 확정. 이번 절차 승인으로 미래 R3 이견0을 미리 선언하지 않는다.

## 미래 구현 단계·시각 예산
W0 입력/fixtures **및 semantic 토큰·상태색·FOUC·4테마 순환·legacy 직접 배경 최소 일관성 구현**, W1a 기본 primitive, W1b Sheet/상태기계, W2 셸/검색/select, W3 홈/히어로, W4 도구 전수/문서결과 개선/옛 의존 제거, W5 종합검수라는 기존 정의를 유지한다. 단계 상세는 첨부 GATES.md를 따른다.
예산 영향 설계 추정: W0 +2~6KiB JS/+1~3KiB CSS(테마 bootstrap·토큰 구현 포함); W1a/b 이행기간 기존+대체 공존 +2~8KiB JS; W2 +3~8KiB JS/+0.5~2KiB CSS; W3 +1~4KiB JS 및 기존 AVIF≤50KiB/WebP≤160KiB 제한; W4 의존 제거 회수량 미측정(감량 보장 금지); W5 0. 중간 피크도 고정 예산을 넘기면 숨기지 않고 단계 재설계, 상한 상향 금지. 숫자는 실제 build로 갱신하고 route/shared 재귀속과 순증분 분리.
시각예산: R1 actual scenario manifest M의 각 기존 profile에 family coral/mint를 확장하고 승인 추가70 중 이미 존재/중복을 대조한 **정확한 새 집합 N**을 산출(단순 183×2나476 고정 금지). U4 전체 추가 상태는 생략하지 않는다. 기존 v3 238/238은 N=476일 때만 유효. 두 shard를 ceil(N/2)/floor(N/2)로 **직렬** 실행하고 각각 timeout20분. 실제 시간이 초과하면 원인/실측을 미통과로 보고, 임의 profile 제거 금지. shard 구현 시 full manifest 합집합=정본 집합·교집합0·누락0·중복0. baseline 갱신은 old/new/same-state evidence+허용된 의도 변화 판정 뒤에만, UPDATE없는 검증을 양 locale에서 실행.
각 단계는 영향 profile만 검증(되돌림/legacy oracle/게이트 건전성/사용자 신고경로4항 제외불가), W5에서 이월된 모든 profile+공용화 영향 전수 회수. **Gemini가 광고·분석 제외 로컬 빌드를 직접 순회**하고 screenshot/manifest entry/고유route/locale/theme 수를 대조한다. 자동 pixel 비교는 시각 판정을 대체하지 않는다. 글자세로낙하·control thumb이탈·하단겹침·320EN·1920문서 rail 확인. 전수 N장 Gemini 리뷰 + Codx 의심표면 DOM/원본PNG 교차. 최종 단일 배포 전까지 중간 배포 없음.

## 완료 명령·동시 검토
이번 문서 완료는 sol 실제 반박 이견0/기준불일치 기록/추적SHA불변/조건과 명령 존재 확인. 미래 R3 완료는 build/unit/static, 위 시각/a11y/rendering, production bundle, `npm run css:orphans` 및 첨부 GATES 전체를 실제 실행한 보고. 추가 command는 구현단계 만들어진 후에만 존재로 표시한다.
ko/en 모든 새 UI·오류·검색 안내, SEO/canonical/hreflang/FAQ/sitemap/정적 초기테마, 광고 격리 및 동의재열기·추적정책, 내부 명칭/원시예외 비노출을 checklist에서 각각 판정. 문서/PDF 원본 색은 테마 필터 적용 금지.

## 명시 제외
현재 U4 종료 판정/병합·push/제품 UI 수정/구현 기준 해시 갱신/기존 v3 디자인 재의결/원본 newui 접근/사용자 자료 fixture/예산 상향/기준선 무근거 UPDATE. 기존 결함은 부모 대조 backlog; 이번 UI 회귀는 차단. 지금 docs/review-notes·CHANGELOG 추적 기록은 수정하지 않고 결과는 ignored 계획서에만 남긴다.

## 반박에서 뒤집힌 것
R1 3항 검토, 뒤집힌 판단 3건: (UI-01) 과거 숫자만 나열하던 입력을 AST/manifest 정의와 현행 증거로 구체화. (UI-02) W0=입력만이라는 축소를 철회하고 v3/GATES의 토큰·FOUC 구현 복구. (UI-03) 외부 /tmp CAPTURE_DIR를 철회하고 하네스 허용 사본 하위 경로 및 host-locale별 artifact 분리.
UI-02 중 "현행 4테마 이미 구현" 주장은 root 독립 `rg -n 'worklazy-theme|light-coral|data-theme' src scripts tests --glob '*.{ts,tsx,mjs,js,css}'` → 0건/exit1로 기각. 상위 정본의 W0 계약 복구와 현행 구현 존재는 구별한다. R2 재확인 대기.

## R1 재현·정의 보강
현재(미래 U4 완료 baseline 아님) `node /tmp/worklazy-canon/inventory.mjs` → primitive 소비62(wrapper포함),90scenarios/246profiles/246PNG,missing0/orphan0. dark51파일,feature ko18/en18, `Object.keys(seoByPath)`36. 과거 SEO45와 같은 정의인지 자동 추정하지 않는다: 미래 입력에는 `seoByPath keys`, `localized route set`, `generated HTML count`, `canonical unique count`를 별도 필드로 정의한다. JSON schema 필수 필드 head/command/sourceSha/lists/count/definition를 갖추고 count=list.length 단언. 미래 실제 작업시 다시 실행할 보조 AST inventory 코드는 신규 `tests/ui-rebaseline-inventory.mjs`에 이식하여 독립 expected와 대조(현재 존재한다고 주장하지 않음).
`tests/visual-regression.mjs:26-32,90,263`: LC_ALL은 scenario 필터가 아니고 브라우저 locale 환경은 C.UTF-8 고정. 상위의 host-locale 두 실행 계약을 유지하되 두 번 모두 전체 ko/en manifest를 검증하며 서로 다른 artifactDirectory로 기록한다. captureOnly는 tests/visual-artifacts 하위만 허용하므로 R2의 전용 /tmp 사본 안 그 경로를 사용; 종료시 /tmp 보고 위치로 복사. 제품 저장소의 baseline/capture를 쓰지 않는다. 현재 미구현4테마용 old probe의406 assert를 실행해 통과 기대하지 않고 새 R1 inventory에서 정확 집합을 산출한다.
R3에서 GATES 각 행은 구현존재+재검증/기준변경+수정/미구현으로 source path와 함께 판정. 4테마·FOUC 구현은 현재 미구현, UI 관련 부채는 현재 위반/보류를 독립 측정 후 행별 연결. GATES 옛 app81920/route61440의 수치는 현 고정 schema3 app96000/route82000과 충돌하므로 미래 단일 정본에서 **이미 사용자 결정된 현행 상한으로 정정**(상한 신규 상향 아님). entry20480/shared30720/CSS10240·override{}·multiplier1 유지.


## 최종 정본화 기록 — 2026-09-09, Codx

실제 `gpt-5.6-sol` 구현자 반박 2회, 수정/철회한 판단 3건. 마지막 독립 판정: `/tmp/worklazy-canon/sol/ui-r2.md`. **이견 0의 범위: U4 main 병합·배포·사후확인 뒤에 실제 재측정과 UI 구현 정본 재확인을 한다. 기존 UI v3 구현 기준 해시를 지금 갱신하지 않는다.**
상단 정본 상태와 이 최종 기록이 본문의 과거 “재확인 대기” 기록보다 우선한다. 상세 계약은 최종 v3/v4의 추가 정정이 같은 항목의 이전 문안보다 우선한다. 제품 구현에는 착수하지 않았다. 공통 기준 해시 게이트·열린 계획 소유권·고정 예산은 `canon-rounds-20260909/GATES.md`를 함께 읽는다.
