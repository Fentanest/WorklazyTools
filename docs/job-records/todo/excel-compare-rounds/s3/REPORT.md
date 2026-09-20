# Excel Compare S3 구현 보고서

## 결론

- 판정: **S3 구현 및 지정 범위 검증 통과**
- 작업 위치: `/tmp/worklazy-xd`
- 브랜치: `excel-dupkey-20260907`
- 시작 기준: `bdd09a7d6bc10da74db8fd3b2b8565da9c3f054e`
- 결과 커밋: `657dec8bb6b7479ee93e54708544aef7b559ebc1` (`Add Excel header row suggestions`)
- 커밋 뒤 상태: clean
- main 병합·push·배포: 수행하지 않음

대상 worktree에는 열린 `docs/jobs/todo`가 없었다. S0에 보존된 열린 계획서 19개 스캔과 같은 기준의 S2 최종 통과 문서를 교차해 충돌 없음을 확인했다. 사용자 지시로 접근 금지된 원 워킹트리는 live 재스캔하지 않았다.

## 구현 결과

초기 파일 검사 한 번에서 모든 시트의 보수적 머리글 후보와 기본/후보 행의 열 이름을 함께 반환한다. 제안 행을 받기 위한 두 번째 parse/worker 요청은 없다. 판정하지 못하면 1행을 fallback으로 선택하되 감지 성공이라고 표현하지 않고, 사용자가 고른 행은 시트별로 제안보다 항상 우선한다.

감지 경계는 다음과 같이 고정했다.

- 후보는 물리 1~20행, 지지도 표본은 아래 최대 5행을 포함한 25행까지다.
- raw 값이 null이 아니고 trim 뒤 비어 있지 않은 셀만 센다.
- 가로 병합 행은 건너뛴다.
- 세로 병합이 아닌 한 셀 행만 다음 5행에 두 셀 이상 행이 있을 때 제목으로 건너뛴다.
- 그 뒤 처음 만난 행 하나만 `2셀 이상`, 비수식·비오류 문자열 `>= 1/2`, trim 값 중복 없음, 후보 열 40% 이상을 채운 아래 행 2개 이상, 세로 병합 없음으로 판정한다.
- 첫 판정 행이 조건을 어기면 뒤 행을 찾지 않고 `uncertain`, 후보가 없을 때만 `none`이다.
- `suggested`만 정수 row를 가지며 `uncertain/none`은 `row:null`이다.

파일·시트 상태는 `{row, source:suggested|manual|fallback}`으로 분리했다. 시트 전환은 수동→제안→1행 순으로 복원하고 새 파일은 이전 파일의 수동 값을 물려받지 않는다. 좌우 교환은 파일·inspection·시트·행 입력·source·열 연결·대사 열을 함께 바꾼다.

검사 요청에는 pair+side AbortController, 단조 token과 File identity를 함께 둔다. 새 파일, 파일 제거, 쌍 제거, unmount에서 취소하며 완료·오류·finally는 현재 소유 요청만 반영한다. 이미 취소된 요청과 파일 읽기 직후 취소된 요청은 worker를 만들지 않는다. 검사 중 compare와 swap은 비활성화되고 stale finally는 새 busy를 해제하지 않는다.

ko/en 후보·fallback·수동 안내와 영구 도움말을 추가했다. 머리글 입력은 현재 안내와 도움말 모두를 `aria-describedby`로 참조하고, 최초 비동기 결과는 polite status로 한 번 알린다. 가이드·FAQ·도구 메타·SEO 설명/featureList/static FAQ 입력도 함께 갱신했다. URL·canonical·hreflang·사이트맵 key, 광고 경계, 서버 전제와 의존성은 바꾸지 않았다.

## 23개 원형 판정표

| # | 패턴 | 의도 행 | 고정 결과 | 의미 판정 |
|---:|---|---:|---|---|
| 1 | merged-title | 3 | 3 / suggested | 일치 |
| 2 | two-level-vertical | 2 | null / uncertain | 보수적 미제안 |
| 3 | three-level-vertical | 3 | null / uncertain | 보수적 미제안 |
| 4 | left-empty-column | 1 | 1 / suggested | 일치 |
| 5 | numeric-header-after-title | 2 | null / uncertain | 보수적 미제안 |
| 6 | header-reappears | 1 | 1 / suggested | 일치 |
| 7 | filter-row | 2 | 1 / suggested | **의미상 오탐** |
| 8 | description-row | 2 | 1 / suggested | **의미상 오탐** |
| 9 | summary-block | 5 | 1 / suggested | **의미상 오탐** |
| 10 | empty | null | null / none | 일치 |
| 11 | real-row1 | 1 | 1 / suggested | 일치 |
| 12 | single-column-title | 2 | null / uncertain | 보수적 미제안 |
| 13 | single-column-row1 | 1 | null / uncertain | 보수적 미제안 |
| 14 | sparse-header-dense-text-body | 1 | 1 / suggested | 일치 |
| 15 | unmerged-title-one-column | 2 | 2 / suggested | 일치 |
| 16 | note-merge-outside-table | 1 | null / uncertain | 보수적 미제안 |
| 17 | header-at-row21 | 21 | null / none | 범위 밖 |
| 18 | same-word-in-other-column | 1 | 1 / suggested | 일치 |
| 19 | no-header-all-text | null | 1 / suggested | **의미상 오탐** |
| 20 | header-only | 1 | null / uncertain | 지지도 부족 |
| 21 | dense-numeric-header | 1 | null / uncertain | 보수적 미제안 |
| 22 | three-level-no-vertical | 3 | 2 / suggested | **의미상 오탐** |
| 23 | vertical-prefix | 3 | null / uncertain | 세로 병합 즉시 중단 |

원형 22개 합계는 suggested 12, uncertain 8, none 2이며 suggested 12개 중 의미상 오탐은 5개다. 23번째 세로 병합 접두는 uncertain이다. 다단 머리글 합성, 20행 밖 탐색, 단일 열 의미 판별, 숫자 머리글 확인, 머리글 없는 표 모드는 지원 범위 밖이다.

## 형식 어댑터 판정

| 형식 | 명시 기대/실행 | 결과 | 원형과 다른 사례 |
|---|---:|---|---|
| XLSX | 23/23 | 통과 | 없음 |
| XLSM | 23/23 | 통과 | 없음 |
| BIFF8 XLS | 23/23 | 통과 | 없음 |
| XLSB | 23/23 | 통과 | 없음 |
| SpreadsheetML XLS | 23/23 | 통과 | 없음 |
| CSV | 23/23 | 통과 | 5개 |

총 138조합을 실제 직렬화→형식별 production 파서→감지로 검증했다. CSV의 명시적 차이는 병합 정보 소실과 숫자 문자열화에 따른 다음 5개다.

| 사례 | 원형 | CSV |
|---|---|---|
| merged-title | 3 / suggested | null / uncertain |
| numeric-header-after-title | null / uncertain | 2 / suggested |
| dense-numeric-header | null / uncertain | 1 / suggested |
| three-level-no-vertical | 2 / suggested | null / uncertain |
| vertical-prefix | null / uncertain | 3 / suggested |

## 브라우저 상태 증거

- 두 XLSX 최초 요청: 파일당 inspect 1개, `headerRows=[1]`, `detectHeader=true`.
- 최초 결과: 두 파일 모두 4행 suggested, 열 이름 즉시 사용 가능, status 2개.
- 캐시 수동 1행: 추가 inspect 0개.
- 미캐시 수동 5행: inspect 1개, `headerRows=[5]`, `detectHeader=false`; 검사 중 swap disabled.
- 시트 전환: `Candidate` 수동 5행, `Second` 제안 2행/수동 1행을 각 시트에서 복원.
- swap: `[manual 5, suggested 4]`와 파일·시트가 `[suggested 4, manual 5]`로 함께 교환.
- 교체 경합: 새 CSV는 이전 수동 5행을 상속하지 않고 자기 suggested 1행 사용, stale 오류 0.
- 쌍 삭제: 진행 중 worker 종료 증가, 삭제 뒤 stale 오류 0.
- `aria-describedby`: 입력마다 현재 안내와 영구 도움말 두 ID 모두 실재.

## 사용자 파일 비게이팅 확인

읽은 사본만 사용했으며 저장소 fixture로 넣지 않았다.

- `2026년 설 선물 발송처_20260204_취합중.xlsx`
- `2026년 설 선물 발송처_20260204_취합_송창훈.xlsx`

두 파일의 `최종` 시트 모두 `{row:4, reason:suggested}`였다.

| 머리글/키 | 중복 그룹 | matched | changed | added | removed |
|---|---:|---:|---:|---:|---:|
| 4행/A열 | 6 | 486 | 134 | 31 | 0 |
| 4행/B열 | 0 | 703 | 37 | 48 | 0 |

A열 표시 키 1~6은 각각 한 결과 레코드에 좌우 두 원본 행을 보존했다. 재시작 행은 왼쪽 73, 오른쪽 79다.

## 검증 결과

| 명령/검사 | 결과 |
|---|---|
| `./node_modules/.bin/tsc -b` | exit 0, 진단 0 |
| `npm run test:unit` | 396/396 통과 |
| `npm run build` | exit 0, 2,836 modules, 정적 61페이지 |
| `VITE_LOCAL_QA=1 npm run build` | exit 0, 2,836 modules, 정적 61페이지 |
| `npm run test:excel-compare` | 통과; 기존 9시트/ZIP/중복/취소 + 새 머리글 상태 |
| `UPDATE_VISUAL_BASELINES=1 VISUAL_ONLY=excel-compare VISUAL_CONCURRENCY=1 npm run test:visual` | Excel 기준선 16장만 갱신 |
| `VISUAL_ONLY=excel-compare VISUAL_CONCURRENCY=1 npm run test:visual` | 16/16 재일치 |
| `A11Y_ONLY=excel-compare A11Y_MAX_TOTAL=0 npm run test:a11y` | 9페이지, 위반 0, 외부 요청 0 |
| 사용자 사본 로컬 비교 | 두 파일 4행 suggested, A/B 결과 일치 |
| `git diff --check` / cached diff check | 통과 |

axe `incomplete`은 각 9페이지에 color-contrast 1건씩 총 9건이며 통과로 세지 않았다. 시각 기준선은 ko/en·light/dark·desktop/mobile의 Excel 결과 상태를 포함하며 대표 initial, interaction-pair, duplicate-result 모바일 이미지를 직접 확인했다.

실행 중 보정 기록:

- 첫 전체 unit 실행은 새 static FAQ를 4개로 고정한 기존 test 때문에 395/396이었다. Excel FAQ 기대를 5개로 올리고 머리글 FAQ 존재 단언을 추가한 뒤 396/396으로 재실행했다.
- 첫 production build 호출은 도구의 30초 출력 경계에서 session id를 보존하지 못해 Vite 변환 중 프로세스가 남지 않았다. 같은 명령을 추적 가능한 세션으로 다시 실행해 exit 0을 기록했다.
- 첫 강화 smoke는 숫자 input을 triple-click으로 교체하는 테스트 조작이 값을 바꾸지 못해 timeout이었다. production 코드가 아니라 브라우저 harness를 native value setter→render 대기→실제 blur 순으로 고쳐 같은 전체 smoke를 통과했다.

증거 파일:

- `evidence/tsc.log`
- `evidence/unit.log`
- `evidence/build.log`
- `evidence/qa-build.log`
- `evidence/excel-smoke.log`
- `evidence/visual-update.log`
- `evidence/visual.log`
- `evidence/a11y.json`, `evidence/a11y.log`
- `evidence/user-files.log`

## S4로 명시 이월

이번 S3에서는 다음을 실행하지 않았으며 위 부분 검증으로 대체하지 않는다.

- 전체 `npm run test:browser`
- `npm run test:excel-cleaner`
- `npm run test:qr-bulk`
- production `npm run test:static`
- full `npm run test:a11y`
- `npm run bundle:measure`
- `npm run css:orphans`
- 전체 tool registry 검사
- main 병합·push·배포

AGENTS가 강제한 공통 `PROJECT_RULES.md` 최초 로드 외에는 원 워킹트리 `s3-pdf-finish`를 조회·변경하지 않았고, `/tmp/worklazy-xr*`, `/tmp/worklazy-dc-impl`에도 접근하지 않았다. 허용 포트 `4350 --strictPort`만 사용했다.
