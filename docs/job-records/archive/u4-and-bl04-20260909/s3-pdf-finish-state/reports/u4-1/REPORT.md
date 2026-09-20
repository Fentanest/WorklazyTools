# U4-1(F0a) 구현 보고

- 브랜치: `s3-pdf-finish`
- 기준: `5ee9b1a4af1e5611cee8f86ba3f177801225dc97`
- 구현 커밋: `fd37ceab057ced2941fb752b2511124dbeaafda4`
- main: `5bc6854175331bdd73b267784d9633cdccda8446` (불변)
- push/main 병합: 수행하지 않음

## 산출물

| 파일 | 계약 |
|---|---|
| `geometry.ts` | PDF.js viewport 역변환, 회전/CropBox/6영역/upright 회전 |
| `selection.ts` | 파일별 물리 exact set, range/canonical/parity/하한/anchor/displayNumber/토글 |
| `tokens.ts` | clock·locale 주입, 단일 pass token, date whitelist |
| `text.ts` | 전처리, Helvetica→Noto 전체 coverage, 문서 폰트, scalar 위치, 6영역 layout/overflow |
| `tiles.ts` | gap/offset/rotation, 배치 전 400 상한 |
| `canvasPolicy.ts` | A와 DPI 하향, B 지표, 계수 주입 경고, 200MiB 등록 전 검사 |
| `stamp.ts` | CSS→viewport→PDF, `{cx,cy,rw,aspect}`, 균등 축소/clamp |
| `plan.ts` | 확정 12의 7단계 순수 실행 계획 |
| `preflight.ts` | U4-0 OCG classifier 제품 이관, 내부 reason code |
| `index.ts` | 위 순수 모듈 export 경계 |
| `tests/unit/pdf-finish-modules.test.ts` | 정본/probe 골든과 반복 결정성 12건 |
| `tests/helpers/pdf-finish-ocg-preflight.mjs` | 제품 preflight 단일 import 경계 |

정본 대응과 수치 표는 `docs/review-notes.md`의 U4-1 절에 기록했다. UI·route·locale·registry·worker·기존 4모드·pdf-lib 그리기 변경은 0이다.

## 검증

| 검증 | 결과 | 로그 |
|---|---|---|
| `npx tsc -b --pretty false` | exit 0, 진단 0 | `tsc.log` |
| `npm run test:unit` | exit 0, 271/271; 신규 finish 12/12 | `unit.log` |
| serial production build, 4096MiB | exit 0, 2,834 modules·정적 61페이지 | `build.log` |
| `npm run test:static` | exit 0, 61페이지·startup 104문서 | `static.log` |
| `TEST_SCOPE=pdf npm run test:browser` | exit 0, 기존 PDF edit/range/conversion 포함 | `pdf-browser.log` |
| PDF route bundle vs U4-0 | exit 0, 다섯 delta 0B | `bundle-compare.log`, `bundle-current.json` |
| `npm run css:orphans` | exit 0, orphan 0 | `css-orphans.log` |
| registry | exit 0, 20/누락 0/예상 외 0/중복 0 | `registry.log` |
| `git diff --check` | exit 0 | `diff-check-final.log` |
| PDF finish oracle 실제 분류 1회 | exit 0, 87=56 allowed+31 excluded; 양 renderer SHA 56, residual 0 | `oracle.log` |

번들 절대값은 entry 299,287B, PDF route 171,864B, shared 2,716,473B, app 5,466,587B, CSS 37,687B이며 기준선 대비 전부 0B다.

## 범위 밖 발견

plain Node 22.17.1의 기존 oracle runner는 제품 `.ts` 이관 뒤 첫 import에서 `ERR_UNKNOWN_FILE_EXTENSION`으로 분류 전에 종료됐다(`oracle-bootstrap-failure.log`). `package.json`이나 제품 범위를 늘리지 않고 허용된 test helper에 해당 제품 파일 하나만 처리하는 strip-only loader를 두었다. 실제 fixture oracle은 그 뒤 한 번만 수행해 56/31을 확인했다. plain helper import는 실행 없이 별도 smoke로 확인했다(`oracle-import-smoke.log`). 다른 범위 밖 정책은 추가하지 않았다.

## 종료 상태

`s3-pdf-finish`는 기준보다 커밋 1개 앞선 `fd37cea`에 정지했다. 추적 변경은 없고, 기존 사용자 미추적 `after.docx`, `before.docx`, `naver05161fb06bc9701a23cfc09ad5773578.html`만 남아 있다.
