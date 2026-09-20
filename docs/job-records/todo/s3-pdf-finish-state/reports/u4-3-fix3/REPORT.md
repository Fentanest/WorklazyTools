# U4-3 fix-3 구현 보고 — Codx, 2026-09-07

## 결과

- 브랜치: `s3-pdf-finish`
- 기준 HEAD: `37470534a28b1bf1752a6d659820240fc3bc1b2a`
- 완료 커밋: `31529570059efe2478fb0326baf7740bc4861783` (`Fix PDF finish preflight and Office smoke`)
- 범위: 7파일, +168/−6
- main `cdb4007` 병합·push·배포: 수행하지 않음
- 사용자 미추적 DOCX 2개·네이버 확인 HTML·`newui/`: 미접근·미stage
- 금지 작업 트리 `/tmp/worklazy-xr`·`/tmp/worklazy-dc-impl`: 미접근

## R1 잔여 원인·수리

`updateForm`·`updatePreflightInput`·`selectTab`은 원시 문자열 또는 탭이 실제로 바뀌면 preflight를 `idle`로 초기화했다. 그러나 effect는 숫자로 변환된 `fontSize`·`margin`·`startingNumber`·`startingPage`만 의존하고 `activeTab`을 의존하지 않아 `10→10.0`, `1→01`, 동일 검사 설정의 탭 전환에서는 재실행되지 않았다.

기존 동일 탭·위치 재클릭 무시 가드를 유지하고 effect 의존성에 `form.fontSize`·`form.margin`·`startNumber`·`startPage`·`activeTab`을 추가했다. 파일 없음·무효 입력의 정상 `idle`은 그대로이며 상태 은닉·버튼 강제 활성화는 없다.

전용 단언 이름은 `testPreflightRawInputAndTabChanges`다. 원출력:

```text
[preflight raw] PASS ko/font-size-10.0: idle -> checking -> ready; create enabled; fresh PDF generated
[preflight raw] PASS ko/margin-24.0: idle -> checking -> ready; create enabled; fresh PDF generated
[preflight raw] PASS ko/start-number-01: idle -> checking -> ready; create enabled; fresh PDF generated
[preflight raw] PASS ko/start-page-01: idle -> checking -> ready; create enabled; fresh PDF generated
[preflight tab] PASS ko/equal-settings-tab: idle -> checking -> ready; create enabled; fresh PDF generated
[preflight raw] PASS en/font-size-10.0: idle -> checking -> ready; create enabled; fresh PDF generated
[preflight raw] PASS en/margin-24.0: idle -> checking -> ready; create enabled; fresh PDF generated
[preflight raw] PASS en/start-number-01: idle -> checking -> ready; create enabled; fresh PDF generated
[preflight raw] PASS en/start-page-01: idle -> checking -> ready; create enabled; fresh PDF generated
[preflight tab] PASS en/equal-settings-tab: idle -> checking -> ready; create enabled; fresh PDF generated
PDF finish smoke passed: 12 direct entries, one-reload chunk recovery, protected/corrupt upload errors, input recovery, preflight guidance, 6 preflight reselection/change combinations, 8 raw numeric representation changes, 2 equal-settings tab changes, 10 fresh PDF outputs for those changes, 4 localized edge-name downloads, 48 preview placements, four-rotation boundary CropBox pixels, output, cancel and retry.
```

전체 원문: `logs/pdf-finish-focused.log`.

## Office 스모크 동기화

Office 제품 코드는 수정하지 않았다. 스모크가 실제 worker `documentModel`에서 Ctrl+Home 뒤 A1, ArrowDown 뒤 A2, Enter 뒤 A2 편집 반영과 A1 한글 보존을 조건 대기한 뒤 다음 navigation·저장을 수행한다. 고정 sleep·기대 완화는 없다.

4250 `--strictPort` production preview에서 연속 실행 원출력 끝:

```text
[office-repeat 20/20]
> worklazytools@0.1.0 test:office
> node tests/office-editor-smoke.mjs
Office editor smoke passed: 96 download states, 7 cached states, Korean Calc keyboard edit and 5088 saved DOCX bytes.
Office consecutive summary: 20/20 passed, failures=0
```

전체 20회 원문: `logs/office-repeat-20.log`. 완료 기준의 별도 `test:office` 1회도 `logs/office-final.log`에서 통과했다.

## 기록 정정

1. `docs/review-notes.md`에 새 R1 숫자 표기 8건·탭 전환 2건의 원인·수리·10/10 재검증을 추가했다.
2. fix-2 번들 수치 기준을 `ff0452b3`가 아닌 고정 S3 `/tmp/s3-bundle-baseline.json`으로 정정했다.
3. fix-2 시각 표현을 정확한 픽셀 동일 주장이 아닌 `기준선 파일 변경 0`으로 정정했다.
4. ko/en F9 300자 안내를 현재 개수 초과가 아니라 입력 시도 중 일부가 한도를 넘어 반영되지 않았다는 문구로 바꾸고 브라우저에서 실제 값 300자·새 문안 양쪽을 단언했다.

## 검증

모든 build·browser·visual은 직렬, `NODE_OPTIONS=--max-old-space-size=4096`로 실행했다. 서버는 4250~4255에서 `--strictPort` 또는 recovery 고정 포트를 사용했다.

| 명령 | 결과 | 원출력 |
|---|---|---|
| `npx tsc -b` | exit 0, 진단 0 | `logs/tsc.log` |
| `npm run test:unit` | 301/301, fail 0, skip 0 | `logs/unit.log` |
| production `npm run build` | 2,845 modules, 정적 67페이지 | `logs/build-production.log` |
| `npm run test:static` | 통과, startup recovery 113 | `logs/static-production.log` |
| `npm run test:pdf-finish` | R1 10/10·새 PDF 10/10, 기존 회귀 통과 | `logs/pdf-finish-focused.log` |
| `TEST_SCOPE=pdf npm run test:browser` | 통과 | `logs/browser-pdf.log` |
| `npm run test:browser` | 통과 | `logs/browser-full.log` |
| `npm run test:new-tools` | 통과; 기존 DV host capability skip 보존 | `logs/new-tools.log` |
| `npm run test:utilities` | 통과 | `logs/utilities.log` |
| `npm run test:office` 연속 20회 | 20/20, 실패 0 | `logs/office-repeat-20.log` |
| `npm run test:office` 별도 1회 | 통과 | `logs/office-final.log` |
| `npm run test:qr-bulk` | 4 scenario·취소·404 통과 | `logs/qr-bulk.log` |
| `npm run test:qr-font-render` | 3 fixture, Poppler changed pixels 0, PDF.js 동일 | `logs/qr-font-render.log` |
| `npm run test:recovery` | 147 cases | `logs/recovery.log` |
| `npm run fixtures:pdf-legacy-oracle` | client 3·structure 4·render 32·output 4·input 1, totalDiffs 0 | `logs/pdf-legacy-oracle.log` |
| `npm run test:excel-cleaner` | 통과 | `logs/excel-cleaner.log` |
| `npm run test:excel-compare` | 통과 | `logs/excel-compare.log` |
| `LANG=ko_KR.UTF-8 npm run test:visual` | 203/203, 7분 28.31초 | `logs/visual-ko.log` |
| `LANG=en_US.UTF-8 npm run test:visual` | 203/203, 7분 25.36초 | `logs/visual-en.log` |
| 시각 기준선 파일 목록 | 전·후 0파일 변경 | `visual-baselines-before.txt`, `visual-baselines-after.txt` |
| `VITE_LOCAL_QA=1 npm run build` | 2,845 modules, 정적 67페이지 | `logs/build-qa.log` |
| `A11Y_MAX_TOTAL=0 npm run test:a11y` | 11페이지 violations 0, 외부 요청 0 | `logs/a11y.log` |
| `npm run test:rendering` | 6대상×3회, 외부 요청 0, finish max CLS 0.0001480366 | `logs/rendering.log`, `rendering.json` |
| `npm run bundle:measure` | 고정 S3 baseline 대비 5종 상한 통과 | `logs/bundle.log`, `bundle-pdf.json` |
| `npm run css:orphans` | zero-reference 0 | `logs/css-orphans.log` |
| `npm run legacy:manifest` | 155 rules/153 removed/0 split/2 active | `logs/legacy-manifest.log` |
| `node tests/tool-registry-routes.mjs` | 20, missing/unexpected/duplicates 0 | `logs/tool-registry.log` |
| `git diff --check` | exit 0, 출력 없음 | `logs/git-diff-check.log` |

고정 S3 baseline SHA-256은 `2605437e04a5d77ed41c2dbfac4fae864a6a9c8b5e56941e696a80b7f76ac692`다. 최종 번들 증분은 entry `+4,860B`, PDF route `+13,801B`, shared net `+2,051B`, app `+21,152B`, CSS `+118B`; override `{}`, multiplier 1이다.

## 종료 상태

`HEAD=31529570059efe2478fb0326baf7740bc4861783`. 추적 워킹트리는 깨끗하고 기존 사용자 미추적 4항목만 남았다. astra 재검수 정지점이며 main 병합·push는 수행하지 않았다.
