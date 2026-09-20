# U4-3 fix-2 구현 보고

- 작성: Codx
- 작업 브랜치: `s3-pdf-finish`
- 기준 HEAD: `ff0452b3ad171bfba920f41ec0789612e5ec2001`
- 범위: astra 재검수 잔여 R1(P2)·R2(P3)와 회귀 시험
- 금지 준수: main(`cdb4007`) 병합·push·배포 없음, 검수 산출물·계획서·기존 4모드·사용자 미추적 파일 변경 없음, `/tmp/worklazy-xr`·`/tmp/worklazy-dc-impl` 접근 없음

## 실행 게이트

`PROJECT_RULES.md`, `AGENTS.md`, fix-2 dispatch, `/tmp/worklazy-u4-3-review2/REPORT.md`, 1차 검수 보고, fix-1 dispatch, PDF finish 정본의 N3·확정 26과 열린 계획을 선독했다. 브랜치와 HEAD는 지시값에 일치했고 열린 계획 충돌은 없었다. 시작·종료에 사용자 소유 미추적 `after.docx`, `before.docx`, 네이버 확인 HTML, `newui/`를 그대로 보존했다.

## R1 — 동일 선택 뒤 preflight 영구 idle

### 원인

`updateForm`과 tab click handler가 실제 입력값이 같은 경우에도 preflight를 `idle`로 초기화했다. preflight effect의 의존성은 실제 탭·폼 값이므로 동일 선택에는 effect가 다시 실행되지 않았고 만들기 버튼의 `preflightBlocked`가 계속 참으로 남았다.

### 수리

- `selectTab`은 현재 탭과 같으면 상태를 전혀 바꾸지 않는다.
- `updateForm`은 현재 활성 탭 필드와 새 값을 `Object.is`로 비교해 같은 값이면 상태를 전혀 바꾸지 않는다.
- 시작 번호·시작 페이지·표지 제외·범위·홀짝도 공용 `updatePreflightInput`으로 같은 불변식을 적용했다.
- 실제 값이 바뀌면 기존처럼 result를 지우고 `idle`로 전환한다. effect 의존성도 함께 바뀌므로 새 검사가 예약되어 `checking → ready`로 진행한다.

회귀 단언은 `tests/pdf-finish-smoke.mjs`의 `testPreflightReselection`, `waitForReadyPreflight`, `assertReadyPreflight`에 편입했다. ko/en 각각 아래를 검증해 총 6/6이다.

1. 이미 선택된 `page-numbers` 탭 재클릭: 1.5초 뒤 `ready`, 만들기 활성, alerts 0, route errors 0.
2. 이미 선택된 `bottom-center` 위치 재클릭: 동일 단언.
3. `top-left`로 실제 변경: MutationObserver가 `idle → checking`을 관측한 뒤 `ready`, 만들기 활성, alerts 0, route errors 0 및 실제 PDF 생성.

관련 원출력:

```text
PDF finish smoke passed: 12 direct entries, one-reload chunk recovery, protected/corrupt upload errors, input recovery, preflight guidance, 6 preflight reselection/change combinations, 4 localized edge-name downloads, 48 preview placements, four-rotation boundary CropBox pixels, output, cancel and retry.
```

## R2 — 끝 공백 앞 `.pdf`와 빈 이름 fallback 누락

### 원인·수리

기존 코드는 `sourceName`의 `.pdf`를 먼저 제거하고 `normalizeOutputName`에서 나중에 trim했다. 끝 공백이 확장자 정규식의 `$` 일치를 막았다. 이제 trim·금지 문자 정리를 먼저 적용하고, 그 결과에서 반복 `.pdf`와 기존 접미사를 제거한다. 결과가 비면 기존 F9의 ko/en fallback으로 간다.

`tests/unit/pdf-finish-engine.test.ts`는 다음 8개 입력을 ko/en 각각 고정해 16/16을 검사한다: `"  report.pdf  "`, `" .pdf "`, `"report.pdf.pdf"`, `".pdf"`, 보통 `.pdf` 이름, 확장자 없는 이름, Unicode 앞뒤 공백, 기존 `-finished` 접미사. 기존 한글 금지 문자 정리도 별도 단언한다.

`testOutputNameDownloads`는 실제 Chrome의 `download` 속성으로 4/4를 확인했다.

| 입력 | ko | en |
|---|---|---|
| `"  report.pdf  "` | `report-마무리.pdf` | `report-finished.pdf` |
| `" .pdf "` | `Worklazy-PDF-마무리.pdf` | `Worklazy-PDF-finished.pdf` |

## 검증

모든 빌드·브라우저·시각 명령은 `NODE_OPTIONS=--max-old-space-size=4096`로 직렬 실행했고 서버는 4250~4255 범위에서 `--strictPort`로 실행했다. 원문은 `logs/`에 있다.

| 명령/범위 | 결과 | 로그 |
|---|---|---|
| `npx tsc -b` | exit 0, 진단 0 | `logs/01-tsc.log` |
| `npm run build` | exit 0, 2,845 modules, 정적 67페이지 | `logs/02-build.log` |
| `npm run test:pdf-finish` | exit 0, R1 6/6·R2 Chrome 4/4와 기존 finish 계약 통과 | `logs/03-pdf-finish.log` |
| `npm run test:unit` | exit 0, 301/301, fail 0, skip 0 | `logs/04-unit.log` |
| `npm run test:static` | exit 0, startup recovery 113 | `logs/05-static.log` |
| `TEST_SCOPE=pdf npm run test:browser` | exit 0 | `logs/07-browser-pdf.log` |
| `npm run test:browser` | exit 0 | `logs/08-browser.log` |
| `npm run test:new-tools` | exit 0; Dolby Vision host capability skip은 기존 환경 분기, 결정적 fallback 통과 | `logs/09-new-tools.log` |
| `npm run test:utilities` | exit 0 | `logs/10-utilities.log` |
| `npm run test:office` | 첫 실행 exit 1: Calc 저장값 `["Arrow navigation verified","이동 전"]`; 소스 무변경 동일 명령 재실행 exit 0, 94 download·7 cached·한글 Calc keyboard·5,088B DOCX | `logs/11-office.log`, `logs/11-office-rerun.log` |
| `npm run test:qr-bulk` | exit 0, 취소/정리/재실행·7 payload·subset/full/corrupt/font404·외부 요청 0 | `logs/12-qr-bulk.log` |
| `npm run test:qr-font-render` | exit 0, 3 fixtures, Poppler changed pixels 0, PDF.js 추출 동일 | `logs/13-qr-font-render.log` |
| `npm run test:recovery` | exit 0, 147 cases | `logs/14-recovery.log` |
| `npm run fixtures:pdf-legacy-oracle` | exit 0, client 3·structure 4·render 32·output 4·input 1, total diffs 0 | `logs/15-legacy-oracle.log` |
| `npm run test:excel-cleaner` · `npm run test:excel-compare` | 모두 exit 0 | `logs/16-excel-cleaner.log`, `logs/17-excel-compare.log` |
| `LANG=ko_KR.UTF-8 npm run test:visual` | exit 0, 203/203, 7분 17.54초, concurrency 1 | `logs/18-visual-ko.log` |
| `LANG=en_US.UTF-8 npm run test:visual` | exit 0, 203/203, 7분 14.83초, concurrency 1 | `logs/19-visual-en.log` |
| `VITE_LOCAL_QA=1 npm run build` | exit 0, 정적 67페이지 | `logs/20-build-qa.log` |
| `A11Y_MAX_TOTAL=0 npm run test:a11y` | exit 0, 11페이지 violations 0, 외부 요청 0 | `logs/21-a11y.log`, `a11y.json` |
| `npm run test:rendering` | exit 0, 6대상×3회, 외부 요청 0, finish 최대 CLS 0.0001480366 | `logs/22-rendering.log`, `rendering.json` |
| `npm run bundle:measure` | exit 0 | `logs/23-bundle.log`, `bundle.json` |
| 기준 `ff0452b3` PDF route bundle | exit 0, 다섯 상한 통과 | `logs/28-bundle-pdf.log`, `bundle-pdf.json` |
| `npm run css:orphans` | exit 0, zero-reference selector arms 0 | `logs/24-css-orphans.log` |
| legacy manifest | exit 0, 155 rules/153 removed/0 split/2 active | `logs/25-legacy-manifest.log` |
| `node tests/tool-registry-routes.mjs` | exit 0, count 20, 누락/초과/중복 0 | `logs/26-registry.log` |
| `git diff --check` | exit 0, 출력 없음 | `logs/27-diff-check.log` |

기준 `ff0452b3` 대비 gzip 증분은 아래와 같고 override `{}`·multiplier 1이다.

| 지표 | 증분 | 상한 | 판정 |
|---|---:|---:|---|
| entry | 4,834B | 20,480B | 통과 |
| affected PDF route | 13,791B | 61,440B | 통과 |
| shared | 2,062B | 30,720B | 통과 |
| app | 21,143B | 81,920B | 통과 |
| CSS | 118B | 10,240B | 통과 |

QR→shared 귀속 이동 509,380B는 순증분에서 분리됐다. PDF.js `standardFontDataUrl`, Poppler OTF font-type, vm-browserify eval과 큰 청크 메시지는 기존 경고이며 기능·픽셀 oracle과 예산 판정은 통과했다.

## 시각 기준선·최종 변경 범위

- 시각 기준선 변경: **없음**.
- 추적 변경: `PdfFinishPanel.tsx`, `outputName.ts`, PDF finish browser smoke, PDF finish engine unit, `CHANGELOG.md`, `docs/review-notes.md`.
- locale·SEO·정적 페이지·광고 격리·의존성 변경: 없음.

## 커밋·최종 상태

- 커밋: `37470534a28b1bf1752a6d659820240fc3bc1b2a` (`fix(pdf): preserve finish preflight on reselection`)
- `git diff HEAD^ --check`: exit 0, 출력 없음
- 추적 워킹트리: clean
- 최종 `git status --short --branch`:

```text
## s3-pdf-finish
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html
?? newui/
```

위 네 항목은 착수 전부터 있던 사용자 소유 미추적 파일이며 열거나 stage하지 않았다. 이 보고서와 raw 산출물 사본은 ignored state report에 보존한다.
