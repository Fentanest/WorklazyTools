# Excel S2 fix-1 구현 보고서

## 결과

- 상태: **구현·검증·커밋 완료, astra 재검수 대기**
- worktree: `/tmp/worklazy-xd`
- branch: `excel-dupkey-20260907`
- 시작 HEAD: `ebba5203d2984b9ddcb8b321beaf80f4b953f2a4`
- 완료 commit: `ab00de3a6c47e07a15e8554c5ff0a466a130c209` (`fix(excel-compare): hide normalized keys in results`)
- 종료 상태: 추적/미추적 변경 없음, 4350~4359 listening socket 없음
- main 병합·push·배포: 하지 않음

## R01 — 일반 키 결과의 공개 표시값

일반 레코드에 비교 identity인 `key`와 별도의 필수 `displayKey`를 추가했다. `displayKey`는 해당 레코드의 왼쪽 원본 행, 왼쪽이 없으면 오른쪽 원본 행에서 선택 키 열을 `cellText`로 읽고 열 순서대로 ` | `로 연결한다. `secondary` 정책은 실제 identity에 참여하는 기본키+보조키 열을 같은 순서로 사용한다. `string:`/`number:` 접두사를 잘라 복원하는 코드는 없다.

- 내부 `key`: 그룹 identity와 React identity에만 유지
- 공개 `displayKey`: 결과 UI, 검색, 보고서 `Key` 열에서 사용
- 보고서 9시트·13열 이름/순서와 비교 판정/레코드 순서 불변
- 숫자 `1`과 문자열 `1`: 화면 표시는 모두 `1`, 내부 identity는 `number:1`과 `string:1`로 독립

혼합 XLSX 실브라우저 전수 결과:

| 범위 | 렌더 Key | 내부 접두사 노출 |
|---|---|---:|
| 필터 전 8행 | `1, 1, 2, 2, 1, 1, Unique, Unique` | 0 |
| changed 필터 후 4행 | `1, 1, 2, Unique` | 0 |
| 다운로드 Changed 시트 | `1, 1, 2, Unique` | 0 |

원출력: `evidence/smoke-excel.log`의 `standardKeyDisplay`, `evidence/ui-review-original-final.log`의 `typedCollision`, 캡처 `evidence/mixed-key-exposure.png`.

## R02 — 결과 표 열 안정화

원인은 좌우 목록의 최소 폭만 보장한 자동 표 레이아웃이 짧은 상태·판정 열을 압축한 것이었다. 표 최소 폭을 1,040px로 고정하고 상태 96px, 판정 112px, 키 128px 및 짧은 머리글/위치/쌍 열에 최소 폭과 `nowrap`을 적용했다. 키·좌우 값의 긴 내용은 해당 셀에서 줄바꿈하며, 뷰포트보다 넓으면 기존 이름 있고 focusable인 가로 스크롤 영역을 사용한다.

합성 fixture + 사용자 1행/B + 사용자 4행/A를 접힘/왼쪽 펼침/양쪽 펼침으로 검사한 24화면·72상태 결과:

| 언어/테마/뷰포트 | 상태 줄 | 판정 줄 | 상태 최소 폭 | 판정 최소 폭 | 키 최소 폭 | 영역 폭 |
|---|---:|---:|---:|---:|---:|---:|
| ko/light/desktop | 1 | 1 | 96px | 112px | 128px | 987px |
| ko/dark/desktop | 1 | 1 | 96px | 112px | 128px | 987px |
| ko/light/mobile | 1 | 1 | 96px | 112px | 128px | 332px |
| ko/dark/mobile | 1 | 1 | 96px | 112px | 128px | 332px |
| en/light/desktop | 1 | 1 | 114.266px | 112px | 128px | 987px |
| en/dark/desktop | 1 | 1 | 114.266px | 112px | 128px | 987px |
| en/light/mobile | 1 | 1 | 114.266px | 112px | 128px | 332px |
| en/dark/mobile | 1 | 1 | 114.266px | 112px | 128px | 332px |

전 상태에서 표 폭은 1,040px, 머리글/상태/판정 `nowrap`, 최소 버튼 높이는 44px였다. 좌우 목록 DOM과 lazy 50/50 동작은 독립성을 유지했다. 원출력: `evidence/layout-matrix.json`, `evidence/layout-matrix-final.log`, 원본 astra probe `evidence/layout-review-original.log`.

사용자 좌우 동시 펼침 캡처:

- `evidence/private/user-h1-c2-fixed-side-by-side.png`
- `evidence/private/user-h4-c1-fixed-side-by-side.png`

## R03 — 시각 기준선

수리 전 전체 16개 실행은 정확히 10개가 실패했다. 중복 결과 8장은 세로 열 결함 수리 영향이고, 기존 bottom 2장은 S2 FAQ 추가 영향이다. 나머지 6개는 일치했다. update 모드 뒤 무관한 6개는 시작 HEAD의 bytes로 복원했고 다음 10개만 커밋했다.

- FAQ 위치 변경:
  - `excel-compare-empty__bottom__ko__dark__mobile.png`
  - `excel-compare-empty__bottom__en__light__mobile.png`
- 열 수리 결과: `excel-compare-empty__interaction-duplicate-result__{ko,en}__{light,dark}__{desktop,mobile}.png` 8장

수리된 actual을 기하 단언과 육안으로 확인한 뒤 최종 전체는 Chrome 152에서 **16/16 일치**했다. 결함이 든 기존 신규 기준선은 승인하지 않았다. 원출력: `evidence/visual-before.log`, `evidence/visual-update.log`, `evidence/visual-final.log`, 캡처 보존 디렉터리 `evidence/visual-before/`·`evidence/visual-update/`·`evidence/visual-final/`.

## N01 — 160 code point

160 code point를 결정적 미리보기 경계로 유지했다.

- 159/160 code point: 원문 전체, 모달 trigger 없음
- 161 이상: 160 code point + 말줄임, 전체 원문 모달 필수
- code point 단위라 surrogate pair를 가르지 않음
- 모달은 이름·Enter·Escape·focus trap·trigger 초점 복귀를 유지

실제 렌더 높이 연동은 접힌/lazy DOM에서 측정 시점과 뷰포트에 따라 trigger 존재 여부가 변해 키보드 경로가 불안정해지므로 기각했다. 이 판정과 수치 근거는 `docs/review-notes.md`에 기록했다.

## 사용자 파일 재현

`/tmp/worklazy-userfiles/`의 사본만 읽었고 저장소 fixture로 넣지 않았다.

| 머리글/키 | duplicate | matched | changed | added | 최초 내부 접두사 |
|---|---:|---:|---:|---:|---:|
| 1행/B열 | 1 | 713 | 37 | 48 | 0 |
| 4행/A열 | 6 | 486 | 134 | 31 | 0 |
| 4행/B열 | 0 | 703 | 37 | 48 | 0 |

원출력: `evidence/user-review-original.log`, `evidence/s1-preservation-after-displaykey.json`.

## S1 보존과 원본 probe 충돌 기록

지시된 S1 원본 `independent.mjs`와 `supplement.mjs`를 수정 없이 실행했다. 두 probe는 S1 정본의 “일반 레코드에는 `displayKey`가 없어야 한다”와 부모 결과의 필드 단위 완전 일치를 직접 단언하므로 R01의 필수 표시 필드 추가와 양립하지 않는다.

- 원본 `independent.mjs`: 4 pass / 4 fail. D 분할, E Key 한도, F 4,096 취소/30,000행, G 전체 보고서는 pass. A/B/A4/I는 새 `displayKey` 하나 때문에 fail.
- 원본 `supplement.mjs`: 첫 secondary ambiguous deep-equal에서 새 `displayKey: "A"` 때문에 종료.
- 호환 의미 대조: 새 필드만 제거한 뒤 0~8행 243조합, 정규화 21조합, 다른 모드 5개, 사용자 파일 3조합이 S1 부모와 동일. 모든 일반 레코드의 네 중복 배열 부재도 유지.

실패를 통과로 세지 않았으며 원본 로그는 `evidence/s1-independent-original.log`, `evidence/s1-supplement-original.log`, 호환 대조는 `evidence/s1-preservation-after-displaykey.log`에 있다.

## 접근성

- QA build axe 4.13.0: 16페이지, violations 0, 외부 요청 0
- 공식 `incomplete`: 현재 1,265 selector 전부 측정, missing 0
- inherited 수동 대비 미달: 171개. 읽기 전용 S2 기준의 171개와 동일하며 **통과로 세지 않음**
- 이번 Excel 중복 결과 소유 공식 측정: 14개, 미달 0, 최소 12.800:1
- 결과/모달 전체 가시 텍스트: 608개, 미달 0, 최소 5.273:1
- ko/en × light/dark × desktop/mobile 8개에서 159/160/161 경계, 무손실 모달, focus trap, Escape, 초점 복귀 통과

판정 JSON: `evidence/a11y-manual-adjudication.json`. 원출력: `evidence/a11y-report.json`, `evidence/official-incomplete-manual.json`, `evidence/a11y-manual.json`.

## 번들

S0 기준선 SHA-256 `726a2d5be21ca250c76a5a9c9220affb8931da9286769f762f3531fd64d002c8` 대비 모두 통과했다.

| 지표 | 현재 gzip | 증분 | 상한 |
|---|---:|---:|---:|
| entry JS | 300,692B | +1,404B | +20,480B |
| affected routes JS | 2,453,104B | +1,523B | +61,440B |
| shared JS | 2,715,918B | +1,410B | +30,720B |
| app JS | 5,469,714B | +4,337B | +81,920B |
| CSS | 37,839B | +146B | +10,240B |

원출력: `evidence/bundle-final.log`, `evidence/bundle.json`.

## 완료 검증

| 검증 | 결과 |
|---|---|
| `./node_modules/.bin/tsc -b --pretty false` | 진단 0 |
| `npm run test:unit` | **381/381** |
| production `npm run build` | 2,835 modules, 정적 61페이지 생성 |
| `npm run test:static` | 통과, startup 104문서 |
| `npm run test:excel-compare` | 통과, 공개 키/필터 전후/보고서/열 기하 포함 |
| `npm run test:excel-cleaner` | 통과 |
| `npm run test:qr-bulk` | 통과, fixture proxy 4351 strict |
| `npm run test:browser` | 전체 통과 |
| Excel visual 전체 | **16/16 일치** |
| QA build + `A11Y_MAX_TOTAL=0 npm run test:a11y` | 16페이지 violations 0 |
| `npm run bundle:measure` | 5종 예산 통과 |
| `npm run css:orphans` | orphan 0 |
| `node tests/tool-registry-routes.mjs` | 도구 20, 누락/예상 밖/중복 0 |
| `git diff --check` | 통과 |

원본 S2 `ui-review.mjs` 첫 실행은 읽기 전용 `/tmp`에서 Playwright 임시 디렉터리를 만들지 못해 제품 진입 전 EROFS로 종료했다. 전용 writable TMPDIR만 추가한 무수정 재실행은 통과했다. 외부 보조 `layout-matrix.mjs`의 첫 실행도 제품 진입 전 보조 스크립트 구문 오류였고, 저장소/원본 probe를 바꾸지 않고 보조 스크립트를 고친 재실행을 채택했다. 두 초기 실패 로그도 삭제하지 않았다.

전체 명령·exit code: `evidence/checks.jsonl`. 구현 기록: `CHANGELOG.md`, `docs/review-notes.md`. — Codx
