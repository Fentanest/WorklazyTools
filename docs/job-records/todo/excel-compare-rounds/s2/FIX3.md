# Excel S2 fix-3 구현 보고서

Codx · 2026-09-08 · `/tmp/worklazy-xd` · `excel-dupkey-20260907`

## 결론

S2-R05·R06·R07을 수정하고 검증했다. 마우스/터치의 펼침·50개 추가·닫힘은 읽던 세로 위치를 유지하고, 키보드 가시 초점과 모달 Escape 복귀는 유지한다. 가로 보정은 모든 폭에 적용하며 세로 보정은 실제 고정 header/tab이 보일 때만 적용한다. 320px 과대 버튼은 LTR 시작 모서리에 한 방향으로 한 번 수렴한다.

커밋은 **`bdd09a7d6bc10da74db8fd3b2b8565da9c3f054e`** (`fix(excel-compare): stabilize result focus correction`)이다. 작업 브랜치는 clean이며 main 병합·push·배포·S3 착수는 하지 않았다.

## 착수 게이트와 범위

- 지정 기준 HEAD `5dfe4139cf042090ef6a5207f67843e2e4ef9ce3`, 브랜치 `excel-dupkey-20260907`, 시작 추적 변경 0을 확인했다.
- `PROJECT_RULES.md`, `AGENTS.md`, fix-3 디스패치, astra 3차/2차 검수와 관련 원본 probe·기각 이력을 선독했다. 대상 worktree에는 충돌하는 열린 계획서가 없었다.
- 제품 수정은 `src/features/excel-compare/ExcelComparePage.tsx`, 회귀는 `tests/excel-compare-smoke.mjs`, 기록은 `CHANGELOG.md`와 `docs/review-notes.md`뿐이다.
- 원본 검수 probe는 읽기 전용으로 실행하고 출력만 이 디렉터리에 bind했다. 사용자 파일은 `/tmp/worklazy-userfiles/` 사본만 읽었다.
- 브라우저/빌드는 직렬 실행했다. 제품 preview는 `127.0.0.1:4350 --strictPort`, QR fixture는 strict 4351을 사용했다. 종료 뒤 4350~4359 listener는 0이다.

## 구현

### R05 — 포인터와 키보드 초점 경계 분리

기존 코드는 결과 컨트롤이 `activeElement`인지만 확인했기 때문에 포인터로 받은 비가시 초점까지 예약 보정이 따라갔다. 예약 시점과 즉시/두 rAF 실행 시점에 모두 `:focus-visible`을 확인하도록 바꿨다. 새 pointerdown, touchmove, wheel, 스크롤 키 입력이 오면 이전 예약은 `AbortController`로 취소한다. `instant`는 키보드 접근성 보정에 그대로 유지했고 전체 보정을 제거하지 않았다.

원본 `side-effects.mjs`의 현재 제품 원출력은 다음과 같다.

| 실제 입력 | ΔscrollY | 제품 보정 호출 | 결과 항목 | 늦은 이동 |
|---|---:|---:|---:|---:|
| mouse Show 50 more | **0px** | **0** | **100** | 0px |
| touch Show 50 more | **0px** | **0** | **100** | 0px |
| mouse 펼침/닫힘 표본 | **0px** | **0** | 0 | 0px |
| touch 펼침/닫힘 표본 | **0px** | **0** | 0 | 0px |

제품 스모크는 mouse/touch 각각 펼침 → 50개 추가 → 닫힘 세 동작을 별도로 단언했다. 여섯 동작 모두 `ΔscrollY=0`, `:focus-visible=false`, 제품 보정 호출 0이고, 추가 직후 `Source row 52`가 화면에 보였다. 실제 mouse 추가 뒤 화면도 Source row 51 다음에 52·53이 이어져 읽던 위치가 유지됨을 직접 확인했다. 원자료는 [side-effects.json](evidence/side-effects.json), [집계](evidence/side-effects-summary.json), [제품 스모크](evidence/smoke-compare.log)에 있다.

### R06 — 실제 고정 chrome과 전 폭 가로 경계 분리

`(max-width: 820px)` 가드를 제거했다. 가로는 모든 화면 폭에서 실제 결과 scroll region의 `clientLeft/clientWidth`와 4px 여백을 사용한다. 활성 초점 상태로 viewport가 바뀌면 resize에서 다시 검사한다. 세로는 `.mobile-header`/`.bottom-tabs`가 실제로 존재하고 계산 스타일이 `position: fixed`, 표시 상태, 양의 rect, viewport 교차를 모두 만족할 때만 실제 bottom/top을 경계로 쓴다.

821px 결함은 부모 `ab00de3`에서도 ko/en × light/dark의 왼쪽 toggle 접힘/Enter가 **8/8 실패**했으므로 fix-2 회귀가 아닌 기존 미해소 결함으로 귀속한다.

| 폭 | 프로필 | 키보드 단계 | 중앙 가시 실패 | 판정 |
|---:|---:|---:|---:|---|
| 819 | 4 | 72 | **0** | 72/72 |
| 820 | 4 | 72 | **0** | 72/72 |
| 821 | 4 | 72 | **0** | 72/72 |
| 1365 | 4 | 72 | **0** | 72/72, 정상 상태 제품 보정 0 |

활성 오른쪽 toggle의 820→821 resize는 네 프로필 모두 정확히 가로 보정 1회, window 보정 0이었다. 821px에는 고정 header/tab rect가 없으므로 제품 세로 보정도 없다. 부모의 821px 8개 실패와 현재 결과는 [side-effects-parent.json](evidence/side-effects-parent.json), 폭 경계 resize는 [side-effects-resize.json](evidence/side-effects-resize.json), 전체 단계는 [side-effects.json](evidence/side-effects.json)에 있다.

### R07 — 과대 대상 시작 모서리 단방향 수렴

대상 폭이 사용 가능 폭보다 크면 양쪽 경계를 번갈아 맞추지 않고 LTR 시작 모서리를 `visibleLeft`에 맞춘다. 1px 미만 차이는 재보정하지 않는다.

| 프로필 | 대상/사용 폭 | Enter 뒤 제품 가로 보정 | 최종 시작 간격 | 반대 방향 호출 | 중앙/높이 |
|---|---:|---:|---:|---:|---|
| ko light/dark | 283.984 / 252px | **−42px 1회** | **4px** | **0** | 가시 / 44px |
| en light/dark | 264.781 / 252px | **−22.797px 1회** | **4.203px** | **0** | 가시 / 44px |

시작쪽 라벨과 3px 초점 링이 보이며 반대편 초과만 scroll region 안에 남는다. `motion-contract.py` 결과는 빈 실패 배열 `[]`이다. [원자료](evidence/side-effects.json), [계약 결과](evidence/motion-contract-failures.json).

## 키보드·레이아웃·되돌림 확인

- R04 원본 overlap 대조는 현재 4프로필×16단계에 부분/전체 가림 0이고, 이전 실패 대상 20/20 및 현재 버튼 48/48 가시 계약을 유지했다. `focus-contract-failures.json`은 `[]`이다.
- 390px smooth 경로는 ko/en × light/dark 72/72 중앙 가시다. 연속 Tab, Shift+Tab, Enter, 양측 전체 값 모달, Escape 원래 trigger 복귀가 유지된다.
- a11y 수동 키보드 8프로필 모두 159/160/161 code point 경계, 무손실 모달, trap 안정, Escape 객체 복귀를 통과했다.
- 독립 레이아웃은 합성+사용자 2조합 × ko/en × light/dark × desktop/mobile = 24프로필, 접힘/좌측/양측 **72상태**다. 상태/판정 줄바꿈 실패 0, 문서 overflow 0, Tab 중앙 가림 0, 직접 초점 중앙 가림 0, 페이지 오류 0이다.
- Excel 비교 시각 기준선은 Chrome 152에서 **16/16 일치**, 기준선 변경 0이다. 포인터 유지, 320px, 821px 결과 화면도 직접 열어 확인했다.
- 마지막 더보기 페이지를 키보드로 소진해 버튼 DOM이 사라질 때 초점이 `BODY`가 되는 기존 경로는 디스패치의 세 결함 밖이며 변경하지 않았다. 일반 50개 추가 뒤 남아 있는 버튼의 키보드 가시성과 포인터 위치 유지와 구분한다.

## 사용자 파일·S1/S2 계약

| 머리글/키 | duplicate | matched | changed | added | 최초 500행 내부 키 노출 |
|---|---:|---:|---:|---:|---:|
| 1행/B열 | **1** | 713 | 37 | 48 | **0** |
| 4행/A열 | **6** | 486 | 134 | 31 | **0** |
| 4행/B열 | **0** | 703 | 37 | 48 | **0** |

- 사용자 최초 화면은 각 500행·3,500셀이고 initial/duplicate/matched/changed/added/removed 필터에도 내부 토큰 노출 0이다. [user-text.json](evidence/private/user-text.json).
- 엔진 부모 의미 대조 245개, 독립 계약 8/8, supplement, ko/en 독립 UI가 모두 통과했다. 0~8 실제 XLSX 243조합, 정규화 21조합, 다른 모드 5개, 분할/문자 한도/4,096 취소/30,000행/report 불변, 사용자 보고서 재개방을 포함한다.
- 독립 UI는 숫자 `1`/문자 `1`의 내부 identity를 분리하면서 공개 표시는 둘 다 `1`이고, 필터·검색 화면 내부 토큰과 외부 요청·페이지 오류가 0임을 확인했다.

## 접근성 수동 판정

QA build 후 `A11Y_MAX_TOTAL=0` 공식 16페이지는 violations 0, 외부 요청 0이다. `incomplete` 1,265개를 자동 통과로 세지 않았다. 공식 대상 누락은 0이며, 수동 측정의 기존 대비 미달 selector는 153개로 이전과 동일하고 신규 미달은 0이다. 배경 이미지 때문에 자동 확정하지 않은 대상 535개도 통과로 세지 않고 상속 보류로 남겼다.

이번 S2 소유 incomplete 14개는 미달 0, 최소 12.800:1이다. 결과 텍스트 608개도 실패 0, 최소 5.273:1이다. 원자료는 [a11y.json](evidence/a11y.json), [수동 측정](evidence/a11y-manual.json), [판정](evidence/a11y-adjudication.json)에 있다.

## 번들 5종

S0 기준선 대비 gzip 증분/상한은 모두 통과했다.

| 지표 | 현재 bytes | 증분 | 상한 |
|---|---:|---:|---:|
| entry JS | 300,696 | +1,408 | 20,480 |
| affected routes JS | 2,453,850 | +2,269 | 61,440 |
| shared JS | 2,715,901 | +1,393 | 30,720 |
| app JS | 5,470,447 | +5,070 | 81,920 |
| CSS | 37,839 | +146 | 10,240 |

Excel 비교 route는 gzip 12,315B다. 기준선·예산·override는 변경하지 않았다. [bundle.json](evidence/bundle.json).

## 실행 검증

전체 원명령·exit·시간은 [checks.jsonl](evidence/checks.jsonl), 각 stdout/stderr는 `evidence/*.log`에 있다.

| 검증 | 결과 |
|---|---|
| `./node_modules/.bin/tsc -b --pretty false` | exit 0, 진단 0 |
| `npm run test:unit` | exit 0, **381/381** |
| final production `npm run build` | exit 0, **2,835 modules**, 정적 **61페이지** |
| `VITE_LOCAL_QA=1 npm run build` | exit 0, 2,835 modules, 정적 61페이지 |
| `npm run test:static` | exit 0; final build 뒤 재실행도 exit 0 |
| `npm run test:excel-compare` | exit 0; pointer/821/320 신규 회귀 포함 |
| `npm run test:excel-cleaner` | exit 0 |
| strict 4351 `npm run test:qr-bulk` | 첫 실행 detached-node 경합 exit 1, **동일 무수정 재실행 exit 0** |
| `npm run test:browser` | exit 0 |
| `VISUAL_ONLY=excel-compare npm run test:visual` | **16/16 일치** |
| `A11Y_MAX_TOTAL=0 npm run test:a11y` | exit 0, 공식 violations 0 |
| `BUNDLE_BASELINE=<S0> npm run bundle:measure` | exit 0, 5종 예산 통과 |
| `npm run css:orphans` | exit 0, orphan 0 |
| `node tests/tool-registry-routes.mjs` | exit 0, 기대 route 집합 통과 |
| 원본 overlap/focus/motion/side-effects/resize/parent probe | 계약 통과; motion 실패 배열 `[]` |
| S1 engine/independent/supplement/UI | 245, 8/8, supplement, ko/en UI 모두 exit 0 |
| 독립 layout 24프로필/72상태 | exit 0, 위 실패 수 모두 0 |
| `git diff --check` / cached check | exit 0 |

QR의 첫 strict 실행은 취소 후 생성 버튼을 클릭하는 동안 `tests/qr-bulk-smoke.mjs:217`의 기존 ElementHandle이 교체되어 `Node is detached from document`로 끝났다. 같은 strict 4351 명령을 제품·테스트 무수정으로 즉시 재실행해 전체 QR 계약과 외부 요청 0을 통과했다. 이 Excel 변경은 QR 코드/페이지를 수정하지 않는다. 그 전에 fixture가 임의 포트를 고른 비-strict 실행 1회는 통과했지만 지정 포트 규칙을 만족하지 않아 완료 증거에서 제외했다.

## 최종 상태

- HEAD: `bdd09a7d6bc10da74db8fd3b2b8565da9c3f054e`
- 브랜치: `excel-dupkey-20260907`
- `git status --porcelain`: 빈 문자열
- 4350~4359 listening socket: 0
- main 병합: 안 함
- push/배포: 안 함
- S3: 착수 안 함

