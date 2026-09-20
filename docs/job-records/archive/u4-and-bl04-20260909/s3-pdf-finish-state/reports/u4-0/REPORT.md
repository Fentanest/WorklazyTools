# U4-0(F-fix) 구현 보고

## 착수 게이트

- `PROJECT_RULES.md` 전문을 첫 행동으로 읽고 `AGENTS.md`, 디스패치 전문, 정본 `docs/jobs/todo/pdf-finish-20260905.md`의 「정본화」 절과 지정 절, 관련 review-notes·라운드 산출물을 확인했다.
- 시작 시 `HEAD`, `main`, `origin/main`은 모두 `5bc6854175331bdd73b267784d9633cdccda8446`이었다.
- 시작 시 추적 변경은 없었다. 사용자 미추적 파일 `after.docx`, `before.docx`, `naver05161fb06bc9701a23cfc09ad5773578.html`은 건드리지 않았다.
- 열린 계획서 충돌은 없었다. `s3-pdf-finish`를 기준 해시에서 분기했다.
- 제품 `src/` 변경 0, UI/동작 변경 0, 새 npm 의존 0, 계획서 변경 0, main 병합·push·배포 0이다.

## A. 번들 측정기 모듈 귀속

변경 파일:

- `scripts/bundle-module-attribution.mjs`
- `scripts/measure-bundle-budget.mjs`
- `tests/unit/bundle-budget.test.ts`
- `vite.config.ts`

`schemaVersion=2`, `moduleAttributionSchema=independent-rendered-gzip-largest-remainder-v1-main-opaque-workers`로 고정했다. measure 빌드에서만 Vite 플러그인이 main 청크의 모듈 코드를 수집한다. 독립 rendered gzip 가중치, largest-remainder 정수 배분, canonical id/realm, 동일 category 우선 잔존 대응과 `min(previousRemaining,currentNeed)` 이동, category `net=gross-movedIn+movedOut`, shared/app net gate, entry/route/CSS gross gate를 유지했다. F1 수정으로 전체 JS inventory를 main 58/worker 21/public 1로 기록해 main 빈·부분 metadata를 양쪽에서 오류 처리하고 worker/public만 근거가 명시된 SHA opaque로 허용한다. F2 수정으로 동률은 `<`/`>` 코드포인트 순을 사용해 en-US/sv-SE에서 동일하다. 기존 5종 상한·multiplier·override는 바꾸지 않았다.

기준선: `/tmp/s3-bundle-baseline.json`; F1 수정 후 최종 보고: `/tmp/worklazy-u4-0-fix1/bundle-current.json`.

| 지표 | main baseline | 최종 | delta | 상한 |
|---|---:|---:|---:|---:|
| entry JS gzip | 299,287 B | 299,287 B | 0 B | +20,480 B |
| 선택 PDF route JS gzip | 171,864 B | 171,864 B | 0 B | +61,440 B |
| shared JS gzip(net) | 2,716,473 B | 2,716,473 B | 0 B | +30,720 B |
| app JS gzip(net) | 5,466,587 B | 5,466,587 B | 0 B | +81,920 B |
| CSS gzip | 37,687 B | 37,687 B | 0 B | +10,240 B |

module chunk 58개, module record 1,012개, inventory main 58/worker 21/public 1, 포함 파일 80 JS/1 CSS이며 최종 movement는 `[]`, app net은 0이다.

## B. 결정적 fixture 생성기

변경 파일:

- `.gitattributes`
- `package.json`
- `scripts/assets/pdf-finish/ocg-snapshots.json.gz`
- `scripts/generate-pdf-finish-fixtures.mjs`
- `tests/fixtures/pdf-finish/**`
- `tests/helpers/pdf-finish-ocg-preflight.mjs`
- `tests/unit/pdf-finish-fixtures.test.ts`

Node 내장 모듈만 사용해 총 104개를 생성한다: 암호 4, 손상 3, 배경 Contents 4, 위험 3, 제거 검증 1, 일반 Properties/Resources 경계 2, OCG 87. OCG는 허용 4, 제외 31, 직접 배열 회귀 32, 대표 20이며 허용+직접 배열+대표 56개가 픽셀 oracle 대상이다. OCG snapshot은 라운드 원본 SHA를 전개 전·후 확인하며 v13 객체 그래프 preflight는 파일명/SHA allowlist에 의존하지 않는다.

두 독립 출력 트리의 PDF 104개+manifest 1개 SHA 목록은 동일하며 그 목록 파일 SHA는 `ab2613266c71a079b3a07f96a5c1244a533169ddeafca0d2e58fda718b50a207`이다.

전체 이름·bytes·SHA-256·기대값 표는 다음 두 파일에 있다.

- 추적 정본: `tests/fixtures/pdf-finish/manifest.json` — 104행
- 통합 보고표: `/tmp/worklazy-u4-0-fix1/fixture-table.json` — fixture 104행 + legacy 7행 = 111행, SHA-256 `73fb78da10c5b5f550736189d271e8498eacb52068f8a53fb5214016a8a558fb`

핵심 SHA:

| fixture | bytes | SHA-256 | 기대 |
|---|---:|---|---|
| R2 open | 897 | `c2c0980bba892379f7fd1c2c26eb23044cc570327e9fd400c87c08553fc14425` | 무암호/빈값 code 1, 오답 code 2, 정답·owner OPEN, permissions 비-null로 finish 거부 |
| R2 restricted | 898 | `fab73fc6c94fbc5d9ed5eaf0215ad33c6fd58de71bc30fca92cd1be198cd92b9` | 무암호/빈값 OPEN, 오답 code 2, permissions 비-null로 거부 |
| R6 open | 1,361 | `df27b10756e7987ec9db49b5f732099eab355f9bc4a9dd694bc450951d25b56` | 무암호/빈값 code 1, 오답 code 2, 정답·owner OPEN, permissions 비-null로 거부 |
| R6 restricted | 1,380 | `774e4b10044af92fe94907424647cdd5c7e94dc12f59e41132d5445ecdb6b694` | 무암호/빈값 OPEN, 오답 code 2, permissions `[]`도 거부 |
| truncated | 297 | `4599115b60c4e4a7651d77ef4967e88933e71f4d14c8932e82b496702cfdd12c` | `InvalidPDFException` |
| xref offsets all 9 | 595 | `223e92970c9f16eb09b98ad2d40049f9aa3376004a18741872c65efee4ffd6f7` | recovery OPEN, 1쪽 |
| malformed Contents | 602 | `aecaaedf4b6be1a50591117d6e8ac8eae3a4db65ab25bb7e03927eba18057ac3` | OPEN, 1쪽, `Unknown command` 경고 |
| 제거 검증 | 5,202 | `85ee688709c0182e2b0023da0f1d97506d40317f12c4a795bd7ea54e6d623136` | 첨부/XMP/form/Widget/Outlines/Names/Dests/PageLabels/ViewerPreferences/Link 3종/15 annotation subtype/Popup·IRT 존재 |

## C. main 기준 legacy-organize oracle

변경 파일:

- `tests/capture-pdf-legacy-oracle.mjs`
- `tests/fixtures/pdf-finish/legacy-oracle/**`

기준 commit의 `pdfWorkerClient.ts`와 `pdf.worker.ts` blob SHA를 먼저 단언한 뒤 실제 Chrome client canvas와 현재 legacy worker를 실행했다. 입력은 회전 0/90/180/270, 비영점 CropBox, 혼합 page size 4쪽이다. none/numbers/watermark/both를 각 2회 실행해 output byte·구조·Poppler 픽셀·PDF.js 픽셀 diff 0을 확인했다.

| mode | bytes | SHA-256 | 2회 결과 |
|---|---:|---|---|
| none | 1,729 | `f95081d4c456d4fedd2d4618649d54b8848d2d71e0421fcfbb1d2973118861ff` | byte/structure/pixel diff 0 |
| numbers | 2,766 | `ebc4d35a7505d6b392ab73eca29a5acec8045d163744df5908cb3266d032b4be` | byte/structure/pixel diff 0 |
| watermark | 7,590 | `6c671eb4415e6097111e92ea127e09ffe879e1868567ab2df96e9c14e1339507` | byte/structure/pixel diff 0 |
| both | 7,990 | `2089693bbb78e7fc4255a8debf1d7e15fb7c8dbf0ae2cc6c2fcc335191a0024f` | byte/structure/pixel diff 0 |

client PNG는 short 420×92 `480f0f9e…5c65`, wide 1800×92 `741931f9…d17`, surrogate 1800×92 `ed37b7e2…da1f`; 최대 alpha 209, fill alpha 0.82, UTF-16 120단위 slice다. legacy output과 client PNG는 round 3 산출물과 byte-identical이다.

환경: Linux 7.0.0-30-generic x64, Node 22.17.1, Chrome 152.0.7977.64, Poppler 24.02.0, pdf-lib 1.17.1, PDF.js 6.2.108, `system-ui=Noto Sans (/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf)`. Poppler는 기본 150 DPI에 `-scale-to 650`, PDF.js scale 1, 흰 배경, unpremultiplied RGBA SHA-256이다.

## D. Poppler·PDF.js 픽셀 oracle 하네스

변경 파일:

- `tests/pdf-finish-oracle.mjs`
- `package.json`의 `test:pdf-finish-oracle`

OCG 87개를 preflight해 허용 56/제외 31, 기대 불일치 0을 확인했다. 원본 56 fixture 57쪽의 고정 snapshot을 먼저 검사하고, 허용 56개에만 12차 test 변환기를 실행해 각 renderer 안에서 원본=변환 결과 SHA 56/56·deep residual 0을 확인했다. 제외 31개 변환 시도는 0이며 `on.pdf` 변환 결과 Contents를 비운 음성 대조는 Poppler/PDF.js가 모두 차이를 검출했다. 일반 `/Span /TextInfo BDC`와 Resources 없음 fixture도 비-OC 허용·두 renderer 동일이다. 같은 실행에서 암호 20개 시나리오, 손상 기대, 배경/위험 open, 제거 fixture 구조를 검사했다. 외부 요청은 0이다. 결과 JSON은 `/tmp/worklazy-u4-0-fix1/pdf-finish-oracle.json`이다.

## E. 기록·커밋

변경 파일:

- `CHANGELOG.md`
- `docs/review-notes.md`

커밋:

- `9e3acb5` `test: attribute bundle growth by module`
- `1723550` `test: add PDF finish fixtures and oracles`
- `18001be` `docs: record U4-0 fixture and oracle evidence`
- `14a3c6f` `fix: validate bundle module attribution metadata`
- `a8dcf60` `fix: distinguish ordinary PDF properties from OCG`
- `93c01d9` `test: verify OCG transform rendering invariants`
- `5ee9b1a` `docs: correct U4-0 verification records`

## 검증표

| 명령 | 결과 | 로그 |
|---|---|---|
| `npm run test:unit` | PASS, 259/259 | `/tmp/worklazy-u4-0-fix1/logs/unit-final.log` |
| `npx tsc -b` | PASS | `/tmp/worklazy-u4-0-fix1/logs/tsc-final.log` |
| `BUNDLE_ROUTES=pdf-editor BUNDLE_BASELINE=/tmp/s3-bundle-baseline.json BUNDLE_MEASURE_OUTPUT=/tmp/worklazy-u4-0-fix1/bundle-current.json TMPDIR=/tmp/worklazy-u4-0-fix1 NODE_OPTIONS=--max-old-space-size=4096 npm run bundle:measure` | PASS, 5종 delta 0; meter가 build child에 임시 `BUNDLE_MODULE_ATTRIBUTION_OUTPUT`을 주입 | `/tmp/worklazy-u4-0-fix1/logs/bundle-current.log` |
| `node tests/tool-registry-routes.mjs` | PASS, 20 | `logs/tool-registry-routes.log` |
| CSS orphan audit | PASS, 0 | `logs/css-orphans.log` |
| `npm run legacy:manifest` | PASS, 155 = removed 153/split 0/active 2 | `logs/legacy-manifest.log` |
| fixture 생성 2회 + tree SHA | PASS, 104 PDF+manifest 1의 SHA 목록 동일 | `/tmp/worklazy-u4-0-fix1/logs/fixture-first.log`, `fixture-second.log`, `fixture-sha-diff.log` |
| fixture unit | PASS, 5/5 | `/tmp/worklazy-u4-0-fix1/logs/fixture-unit-f3-f4.log` |
| `npm run test:pdf-finish-oracle` | PASS, 원본 snapshot 56/57쪽·변환56·residual0·제외 변환0·음성 대조 양쪽 검출 | `/tmp/worklazy-u4-0-fix1/logs/pdf-finish-oracle-f3-f4.log` |
| `TEST_SCOPE=pdf npm run test:browser` | PASS | `logs/browser-pdf-final.log` |
| `VITE_LOCAL_QA=1 npm run build` + `npm run test:rendering` | PASS, 3페이지×3회, CLS max 0, 외부 요청 0 | `logs/build-local-qa.log`, `logs/rendering-final.log` |
| production `npm run build` | PASS, 2,834 modules, 정적 페이지 61 | `/tmp/worklazy-u4-0-fix1/logs/build-final.log` |
| `npm run test:static` on final production build | PASS, startup recovery 104 | `/tmp/worklazy-u4-0-fix1/logs/static-final.log` |
| `git diff --check 5bc6854..HEAD` | PASS | 최종 셸 출력 |
| 기준 ref·`src/` 불변 확인 | PASS, `main=origin/main=5bc6854`, `src/` diff 없음 | 최종 셸 출력 |

재시도 기록:

- 첫 browser 실행은 서버 미기동으로 connection refused였다. dev 서버 첫 실행은 Vite dependency optimize hot reload 뒤 180초 timeout이었고, 동일하게 최적화된 서버 재실행은 15.6초에 통과했다.
- 첫 rendering은 production 분석/광고 외부 요청 126건을 검출해 실패했다. 요구된 QA build로 재실행해 외부 요청 0으로 통과했다.
- QA build 뒤 static을 바로 실행하면 분석 설정 부재를 정확히 검출해 실패했다. production build로 복원한 뒤 static은 통과했다.

## 범위 밖 발견

없음.

## 최종 git 상태 원문

```text
## s3-pdf-finish
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html
```

HEAD는 `5ee9b1a`, 브랜치는 기준보다 7커밋 앞이다. main 병합·push·배포는 하지 않았다.
