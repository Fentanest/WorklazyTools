# Excel 비교 S4 fix-1 — 보고·귀속·증거 보완

## 판정

**R01~R04 보완 완료, astra 재검수 대기.** 제품 기능·공용 UI·백로그 기능은 수정하지 않았다. 누락됐던 중복 2:3 엔진 형상과 머리글 검사 완료 역전/unmount 브라우저 경로를 이번 Codx 실행으로 보충했고, 원 S4 보고의 실행 범위·주체·접근성 귀속과 백로그 우선순위를 정정했다.

- 대상: `/tmp/worklazy-xd`
- 브랜치: `excel-dupkey-20260907`
- 기준 HEAD: `3131258cb36d8f052b393abe4c6ec7b60547431d`
- 보완 커밋: `953ff66aaeddc80b76fdbc87c79ed80828f1c4a6`
- main 병합·push·배포: 수행하지 않음
- 시각 기준선 갱신·전체 회귀 재실행: 수행하지 않음

## R01 — new-tools 내부 건너뜀 경계

원 S4의 `npm run test:new-tools`는 116.862초 뒤 exit 0이었지만, [원 로그](</tmp/worklazy-xd-s4/evidence/new-tools.log>) 80행에 다음 내부 건너뜀이 있다.

- 미실행: 이 Chrome 호스트에 호환 경로가 없어 **Dolby Vision base-layer 실제 streaming**을 실행하지 않았다. 따라서 그 뒤의 실제 streaming/target-encode 검증도 실행되지 않았다.
- 실행: fallback 결과 안내와 deterministic capability unit은 통과했다.
- 판정: 명령 exit 0은 실행된 세부경로의 성공만 뜻하며 전 세부경로 실행을 뜻하지 않는다. 기존 기능·호스트 제약으로 기록하며 영상 기능은 이번 범위에서 수리하지 않았다.

정정 위치는 [docs/review-notes.md](</tmp/worklazy-xd/docs/review-notes.md>)의 「전체 회귀와 스모크 경계 정정」과 이 보고서의 아래 전 회귀 표다.

## 원 S4 전체 회귀 — 실제 실행 경계

아래는 **원 S4 Codx 실행**의 명령·원출력이다. fix-1에서 전체를 재실행한 표가 아니다. 검수자 재실행도 이 표에 섞지 않았다.

| 원 S4 검사 | 실제 결과 | 원출력 |
|---|---:|---|
| `./node_modules/.bin/tsc -b` | exit 0, 18.605s | `s4/evidence/tsc.log` |
| `npm run test:unit` | 396/396, exit 0, 4.346s | `s4/evidence/unit.log` |
| production `npm run build` | 2,836 modules·정적 61페이지, exit 0, 93.483s | `s4/evidence/build-production.log` |
| `npm run test:static` | 104문서, exit 0, 0.814s | `s4/evidence/static.log` |
| `npm run test:browser` | exit 0, 53.760s | `s4/evidence/browser.log` |
| `npm run test:excel-compare` | exit 0, 70.406s | `s4/evidence/excel-compare.log` |
| `npm run test:excel-cleaner` | exit 0, 55.474s | `s4/evidence/excel-cleaner.log` |
| `npm run test:qr-bulk` | exit 0, 51.050s | `s4/evidence/qr-bulk.log` |
| `npm run test:new-tools` | **exit 0, 116.862s; Dolby Vision base-layer streaming/target-encode 미실행** | `s4/evidence/new-tools.log:80` |
| `npm run test:utilities` | exit 0, 100.556s | `s4/evidence/utilities.log` |
| `npm run test:office` | exit 0, 26.232s | `s4/evidence/office.log` |
| `npm run test:recovery` | desktop/android 147사례, exit 0, 279.436s | `s4/evidence/recovery.log` |
| QA `npm run build` | 2,836 modules·정적 61페이지, exit 0, 96.927s | `s4/evidence/build-qa.log` |
| 첫 `npm run test:visual` | 178/183, mismatch 5, exit 1, 442.340s | `s4/evidence/visual.log` |
| 기준선 5장 교정 후 `npm run test:visual` | 183/183, exit 0, 417.092s | `s4/evidence/visual-rerun.log` |
| `A11Y_MAX_TOTAL=0 npm run test:a11y` | 16페이지·자동 violation 0·incomplete 1,274, exit 0, 67.902s | `s4/evidence/a11y.log` |
| 머리글 접근성 probe | 16프로필·48측정, exit 0, 20.714s | `s4/evidence/header-a11y.log` |
| 사용자 1행/B | exit 0, 5.504s | `s4/evidence/user-row1.log` |
| `HEADER_PHASE=user` 사용자 4행/B·A | `profiles=0`·`races=0`·`user=2`, exit 0, 16.769s | `s4/evidence/user-row4.log` |
| 사용자 XLSX XML/rels 재개방 | 보고서 2개, exit 0, 0.092s | `s4/evidence/user-report-xml.log` |
| `npm run bundle:measure` | 5종 예산 통과, exit 0, 76.862s | `s4/evidence/bundle.log` |
| `npm run css:orphans` | orphan 0, exit 0, 0.627s | `s4/evidence/css.log` |
| registry route 검사 | 20도구·누락/중복 0, exit 0, 0.529s | `s4/evidence/routes.log` |
| `git diff --check` | exit 0, 0.021s | `s4/evidence/diff-check.log` |
| 기록 뒤 `npm run test:unit` | 396/396, exit 0, 3.706s | `s4/evidence/unit-final.log` |

명령 호출 누락 0과 내부 건너뜀/증거 공백 0은 다른 주장이다. 원 S4는 전자를 충족했지만 R01과 R02 때문에 후자를 충족하지 못했다.

## R02 — 누락 실행과 정본 5군 연결

### 이번 Codx 보완 실행 2건

| 명령 | exit | 세부 단언·출력 | 증거 |
|---|---:|---|---|
| `env NODE_OPTIONS=--max-old-space-size=4096 node --experimental-strip-types /tmp/worklazy-xd-s4-fix1/probes/shape-23.mjs` | 0 | 실제 CSV 2:3 → 중복 1그룹·레코드 1개, 좌 행 `[2,3]`, 우 행 `[2,3,4]`, 좌 값 `L1/L2`, 우 값 `R1/R2/R3` 보존 | [log](</tmp/worklazy-xd-s4-fix1/evidence/shape-23.log>) · [JSON](</tmp/worklazy-xd-s4-fix1/evidence/shape-23.json>) · [meta](</tmp/worklazy-xd-s4-fix1/evidence/shape-23.meta>) |
| `env NODE_OPTIONS=--max-old-space-size=4096 node /tmp/worklazy-xd-s4-fix1/probes/header-lifecycle-browser.mjs` | 0 | old 5행 완료를 먼저 풀어도 row 6·busy/swap-disabled 유지, new 6행 완료 뒤에만 busy 해제; 보류 응답 상태에서 `/en/tools` unmount 뒤 terminate 4→5·늦은 응답 무효·file/page 오류 0·외부 요청 0 | [log](</tmp/worklazy-xd-s4-fix1/evidence/header-lifecycle-browser.log>) · [JSON](</tmp/worklazy-xd-s4-fix1/evidence/header-lifecycle-browser.json>) · [meta](</tmp/worklazy-xd-s4-fix1/evidence/header-lifecycle-browser.meta>) |

### 정본 회귀 5군 ↔ 명령·단언·출처

| 군 | 실제 명령·세부 assertion | 출처와 판정 |
|---|---|---|
| ① 중복 엔진 | 원 S4 `npm run test:unit`·`npm run test:excel-compare`: 2:1·2:0·0:2·1:1, 빈 키·정규화·복합키·복수 쌍·그룹 순서. fix-1 `shape-23.mjs`: 빠졌던 2:3을 중복 1그룹·좌2/우3 전체 행·값으로 단언 | 원 S4 실행 + **이번 Codx 보완 실행**. 2:3 공백 해결 |
| ② 결과 화면 | 원 S4 `npm run test:excel-compare`: 초기500/총501, 접힌 DOM0, 마지막값·원본행 검색, 좌50→100·우50 독립 전개, 0건 버튼0, dialog 이름·Escape·초점복귀 | 원 S4 실행. fix-1 production-host 재검증도 같은 상세 출력으로 exit0 |
| ③ 보고서 | 원 S4 unit/Excel smoke/사용자 XML probe: 16,000/16,001·32,767/32,768, multiline·LF/CRLF·surrogate 안전 분할, 9시트·Duplicates13열·Summary/Parameters·주입문자열, direct2+ZIP2와 사용자 XML/rels 재개방, 폭12~48 | 원 S4 실행·원출력. 검수자 결과를 자기 실행으로 옮기지 않음 |
| ④ 감지·수명주기 | 원 S4 unit: 원형23·6형식×23=138, controller `finish(old)=false`·`cancelAll`·pre-abort. 원 S4 `HEADER_PHASE=user` probe는 `profiles=0`·`races=0`라 실제 완료 역전/unmount 미실행. fix-1 browser probe가 old5/new6 역전과 unmount 뒤 늦은 응답을 실제 Chrome에서 단언 | unit·원 S4 user-only·**이번 Codx 브라우저 실행**을 분리. 공백 해결 |
| ⑤ 결과 시각·접근성 | 원 S4 `npm run test:visual` 183/183 및 `A11Y_MAX_TOTAL=0 npm run test:a11y` 16페이지·자동 violation0; ko/en×desktop/mobile×light/dark 실제 중복 결과 8프로필 포함, 빈 상태 대체 아님 | 원 S4 실행. 시각 기준선은 fix-1에서 재실행·재갱신하지 않음 |

### 검수자 실행과 이번 실행의 분리

- S3 astra 독립 검수는 과거 `node ../probes/header-browser.mjs`에서 완료 역전·stale finally·unmount 단언까지 도달했지만 뒤의 캡처 오류 때문에 명령 전체 exit 1이었다. 이것은 **S3 검수자 실행**이다.
- S4 astra 검수자는 `env -u HEADER_PHASE node /tmp/worklazy-xd-s4-review/lifecycle/probes/header-browser.mjs`를 사본에서 실행해 2언어 프로필·10 race 상태·user 2프로필을 exit 0으로 보충했다. 이것은 **S4 검수자 실행**이다.
- 원 S4 Codx 실행은 `HEADER_PHASE=user`였으므로 lifecycle을 건너뛰었다. 위 두 검수자 실행을 원 S4의 자기 실행으로 소급하지 않는다.
- fix-1 표의 두 명령만 이번 Codx 실행이다.

## R03 — 새 접근성 노드 6개 귀속 정정

원 axe 결과는 16페이지·자동 violations 0, `incomplete` 1,274(color-contrast 1,271 + aria 3)다. `incomplete`는 자동 통과로 세지 않는다.

| 안정 selector | axe에서 빠졌던 프로필·노드 | 올바른 귀속 | 보충 측정·판정 |
|---|---|---|---|
| `[data-testid=excel-duplicate-row] .max-w-56` | mobile ko/en × light/dark = 4노드 | S1~S3 새 결과의 display key cell | astra 검수자가 8프로필 전체 측정; 모두 기준 충족, 최소 포함 전체 최저 12.799508:1 → 해결 |
| `[data-testid=excel-duplicate-toggle][data-side=right] span` | dark mobile ko/en = 2노드 | S1~S3 새 결과의 오른쪽 duplicate side | astra 검수자가 8프로필 전체 측정; 모두 기준 충족, 전체 최저 12.799508:1 → 해결 |

원 S4의 6종×8프로필 48측정은 왼쪽 toggle과 대표 원본행 항목 중심이라 위 6노드를 덮지 못했다. [검수자 귀속 원자료](</tmp/worklazy-xd-s4-review/evidence/a11y-attribution.json>)와 [요약](</tmp/worklazy-xd-s4-review/evidence/a11y-summary.json>)의 8프로필×2대상 보충값을 **검수자 실행 증거**로 채택했으며 Codx 측정으로 소급하지 않는다. 새 결과 노드 두 종류는 해결로 판정한다. 남은 incomplete 1,268노드는 공용 shell·기존 표/guide/footer·모바일 탭·기존 ARIA 보류로 유지하고 공용 UI는 수리하지 않았다.

## R04 — 백로그 우선순위

기능을 수리하지 않고 [docs/backlog.md](</tmp/worklazy-xd/docs/backlog.md>)의 기존 측정·재현·귀속을 유지한 채 우선순위만 명시했다.

| 항목 | 우선순위 | 수리 |
|---|---|---|
| BL01 마지막 더보기 소진 뒤 초점 목적지 | 낮음(P3) | 없음 |
| BL02 한국어 guide 긴 시트명 나열 잘림 | 낮음(P3) | 없음 |
| BL03 desktop 결과 컨트롤 상단 부분 가림 | 낮음(P3) | 없음 |
| BL04 XLSX/XLSM 오류 셀 타입 소실 | **높음**, `spreadsheet-core` | 없음; 실제 오류 타입 보존·문자열 blacklist 금지 방침 유지 |
| BL05 결과 검색 입력의 고정 모바일 헤더 가림 | 낮음(P3) | 없음 |

## fix-1 검증

| 명령 | 결과 | 증거 |
|---|---:|---|
| `./node_modules/.bin/tsc -b` | exit 0 | [meta](</tmp/worklazy-xd-s4-fix1/evidence/tsc.meta>) |
| `npm run test:unit` | 396/396, fail/skipped 0, exit 0 | [log](</tmp/worklazy-xd-s4-fix1/evidence/unit.log>) · [meta](</tmp/worklazy-xd-s4-fix1/evidence/unit.meta>) |
| production-host `npm run test:excel-compare` | exit 0 | [log](</tmp/worklazy-xd-s4-fix1/evidence/excel-compare.log>) · [meta](</tmp/worklazy-xd-s4-fix1/evidence/excel-compare.meta>) |
| record/source attribution audit + 추적 파일 allowlist | exit 0 | [log](</tmp/worklazy-xd-s4-fix1/evidence/record-audit.log>) · [meta](</tmp/worklazy-xd-s4-fix1/evidence/record-audit.meta>) |
| `git diff --check` | exit 0 | [meta](</tmp/worklazy-xd-s4-fix1/evidence/diff-check.meta>) |

`test:excel-compare`의 production 경계를 제공하기 위해 `env -u VITE_LOCAL_QA ... npm run build`를 준비 단계로 한 번 실행했고 2,836 modules·정적 61페이지·exit0이었다. 이는 전체 회귀 재실행 주장에 포함하지 않는다. 첫 smoke는 Vite dev 서버, 두 번째는 남아 있던 QA dist를 잘못 사용해 둘 다 광고 경계 `ads=false`에서 exit1이었다. [dev 실패](</tmp/worklazy-xd-s4-fix1/evidence/excel-compare.dev-server-failed.log>)와 [QA dist 실패](</tmp/worklazy-xd-s4-fix1/evidence/excel-compare.qa-dist-failed.log>)를 제외·보존하고 production build+strict preview 재실행만 최종 검증으로 채택했다.

browser lifecycle probe의 첫 작성본은 snapshot 인자 이름 오류(`currentLabel is not defined`)로 exit1이었다. [실패 로그](</tmp/worklazy-xd-s4-fix1/evidence/header-lifecycle-browser.first-failed.log>)를 보존하고 probe 자체를 고친 뒤 동일 제품 경로를 exit0으로 실행했다. 첫 실패를 제품 결함이나 통과 증거로 세지 않는다.

## 변경·정지 상태

커밋 `953ff66`의 추적 변경은 기록 파일 세 개뿐이다.

- `CHANGELOG.md`
- `docs/review-notes.md`
- `docs/backlog.md`

제품 코드·시각 기준선·생성물·vendor·사용자 fixture는 커밋하지 않았다. 종료 시 브랜치 `excel-dupkey-20260907`, HEAD `953ff66aaeddc80b76fdbc87c79ed80828f1c4a6`, worktree clean, 4350~4359 listener 0이다. main 병합·push·배포 없이 이 지점에서 정지한다.
