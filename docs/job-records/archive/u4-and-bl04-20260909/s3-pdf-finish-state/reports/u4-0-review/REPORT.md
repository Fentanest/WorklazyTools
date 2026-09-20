# U4-0(F-fix) 구현 검수 — Codx

**판정: [수정 후 재검수].** 현재 제품 회귀는 재현되지 않았다. 다만 번들 metadata 누락 시 SHA 폴백, 로케일 의존 정수 배분, 일반 PDF의 OCG 오분류, 변환 전후 oracle 검증 누락을 수정해야 한다. 기록 정정도 필요하다. 아래 F1~F4는 P2, F5는 P3이다. 원 저장소는 수정하지 않았다.

## 기준·실행 경계

- 원 저장소: `/home/better0101/projects/worklazytools`, 브랜치 `s3-pdf-finish`.
- 검수 HEAD: `18001be7b00ee662390526a2906bc1d6f1b9d7f5`; 기준 main: `5bc6854175331bdd73b267784d9633cdccda8446`. 요청값과 일치한다.
- 첫 실행은 `cat PROJECT_RULES.md`. AGENTS·검수/sol 디스패치·정본 「정본화」 및 지정 절·review-notes U4-0/기각 이력·3~12차 관련 증거를 대조했다. 열린 계획 16개의 같은 표면을 검색했고, QR의 전체 OTF 보존 및 U4 공용 import 우선과 상반되는 새 지시는 없었다. 검색 증거: `logs/open-plans.txt`.
- 원 저장소에서 build/generator/install/commit/push/checkout을 실행하지 않았다. `git archive`로 `/tmp/worklazy-u4-0-review/head`와 `main`을 만들고, node_modules/public은 쓰기가 전파되지 않는 독립 사본으로 복사했다. 설치는 하지 않았다.
- 아래 npm 명령의 cwd는 별도 표시가 없으면 `/tmp/worklazy-u4-0-review/head`. git 정보가 필요한 테스트는 `GIT_DIR=/home/better0101/projects/worklazytools/.git GIT_WORK_TREE=/tmp/worklazy-u4-0-review/head`로 **git show/ls-files 읽기만** 사용했다.
- 브랜치 산출물 3커밋은 `9e3acb5`(측정기), `1723550`(fixture/oracle), `18001be`(기록)이다. 검수 probe와 보고서는 이 보고서 디렉터리에 있다. 재현을 위해 추가한 probe는 브랜치의 구현으로 계산하지 않았다.

## 항목별 판정

아래 상대 경로는 `/tmp/worklazy-u4-0-review/` 기준이다. 실제 실행 명령과 stdout/stderr를 보존했다.

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안·심각도 |
|---|---|---|---|
| 기준 해시·열린 계획 충돌 | [통과] | `git rev-parse HEAD main`, `git branch --show-current`, 열린 16계획 검색. 요청 HEAD/main/branch 일치 | 없음 |
| 모듈 독립 rendered gzip 가중·정수 합 보존·realm·이동 min·same-category 우선·5종 gate 의미 | [통과] | `node --test --experimental-strip-types tests/unit/bundle-budget.test.ts`: **22/22**, `logs/bundle-unit.log`. 전체 unit **255/255**, `logs/unit-rerun.log`. 이동만 shared/app net=0, 5종 각각 limit PASS/+1B FAIL, NaN/누락/비정수·override·신규 route 검사 포함 | 단 동률 정렬과 metadata 완전성은 아래 별도 결함 |
| schema v1·modules 속성 없음 거부 | [통과] | `node metadata-guard-probe.mjs`: baseline/current 양쪽 모두 unsupported schema 오류, `metadata-guard.json` | 구 schema를 읽는 일반 경로의 거부는 정상 |
| schema v2 빈/부분 modules 거부 | **[결함]** | 같은 probe: `modules=[]` 및 main 청크 1개 제거 모두 양쪽 **accepted=true**, delta 전부 0. `bundle-probe.json`: 빈 배열일 때 main **58청크**가 opaque/unattributed로 폴백 | **F1 / P2**: main metadata 누락은 오류로 차단; worker/public만 명시적 opaque 허용 |
| 정수 나머지 동률의 canonical id 사전순 | **[결함]** | `bundle-probe.mjs`: 1B 동률에서 `a.ts`가 `Z.ts`보다 앞선다. `collation.json`: 동일 입력 `ä.ts/z.ts`의 1B 수령자가 en-US와 sv-SE에서 반대 | **F2 / P2**: 4차의 locale 비의존 순서(`<`/`>`)로 고정 |
| main production byte 불변·계측 env 게이트 | [통과] | main/HEAD 각각 `npm run build`; **537/537 파일 SHA 동일**, `production-comparison.json`. production JS/CSS와 계측 산출물 **81/81 SHA 동일**, `instrumentation-byte-comparison.json` | Vite 플러그인은 `BUNDLE_MODULE_ATTRIBUTION_OUTPUT`가 있을 때만 등록된다. env 미설정 production byte 영향 0 |
| 새 schema 기준선·현재 5종 상한·multiplier/override | [통과] | `BUNDLE_ROUTES=pdf-editor BUNDLE_BASELINE=/tmp/s3-bundle-baseline.json BUNDLE_MEASURE_OUTPUT=/tmp/worklazy-u4-0-review/bundle-current.json TMPDIR=/tmp/worklazy-u4-0-review NODE_OPTIONS=--max-old-space-size=4096 npm run bundle:measure`: 5종 **delta=0**, multiplier=1, overrides={}, `logs/bundle-current.log` | 상한 변경 없음. CLI 옵션으로 잘못 적힌 sol 보고 명령은 F5로 정정 |
| 4차 E6 실측 재현 | [통과] | `node bundle-probe.mjs`: r3/builds 실파일+r4 계측. lazy shared **+80B**, app **+13,264B**, QR→shared **507,267B**. integrated **+90/+14,029B**. `logs/bundle-probe-rerun.log` | 재계측 결과와 r4 기대 일치 |
| fixture 생성 결정성·Node 내장 의존 | [통과] | `node scripts/generate-pdf-finish-fixtures.mjs /tmp/worklazy-u4-0-review/fixture-first` 및 `fixture-second`; **PDF 102+manifest 1=103파일**의 두 생성 및 tracked SHA 전부 동일. `fixture-determinism.json`; fixture unit도 통과 | OCG 압축 seed 전개 방식은 exact SHA 계약을 충족하며 새 npm 의존 없음 |
| 암호 R2/R6 4종·손상 3종 | [통과] | `PDF_FINISH_ORACLE_OUTPUT=/tmp/worklazy-u4-0-review/oracle.json TMPDIR=/tmp/worklazy-u4-0-review npm run test:pdf-finish-oracle`: 암호 **20 attempt** 기대 일치, Poppler 본문 교차 일치. truncated InvalidPDFException, xref recovery OPEN, malformed Unknown command+OPEN. `oracle.json` | `permissions !== null` 거부 경계와 4/0원소 restricted 배열이 일치. 이 단계는 fixture oracle이며 finish 제품 구현을 검증했다고 확대하지 않음 |
| 배경·위험·제거 fixture 구성 | [통과] | 위 oracle에서 Contents/위험 모두 리오픈·operator list, 제거 catalog/attachment/outline/page label/annotation 확인. `manifest.json`과 생성 코드에서 Contents 4종·q/Q·tagged·OCG·Link 3종·Info/XMP/form·비대상 구조 확인 | page AF 존재라는 **기록**은 실제와 달라 F5. 배경 삽입/구조 제거 제품 구현은 U4-0 범위가 아님 |
| OCG manifest 4+32+20 허용 /31 제외·라운드 SHA | [통과] | `node classification-probe.mjs`: **87/87 이름·SHA 일치**, 대표20 목록도 r12와 동일. 직접 배열 2위치×4정책×4상태=32. 기존 427+추가50의 **477/477 분류 일치**, `classification-probe.json` | 지정 대표 반례 SHA도 전부 일치 |
| v11~v13 preflight 문법 | **[결함]** | 고정 477입력에서는 OCMD raw 값·catalog·①~⑧·non-page OC·Type3·escaped Name 기대 일치. 하지만 `node plain-properties-probe.mjs`: **OC가 없는 정상 `/Span /TextInfo BDC` 문서를 unknown-OC-type으로 제외**. `plain-properties-render.mjs`: 양쪽 renderer 1페이지 정상 렌더·동일 SHA | **F3 / P2**: 일반 Properties와 OC visibility를 구분. 전객체/Type3 제외 규칙 유지 |
| 브랜치 두 렌더러 하네스 자체 실행·unit 분리 | [통과] | `test:pdf-finish-oracle`: **preflight87=56/31**, source snapshot **56문서/57페이지** PASS, 외부 요청0. package의 `test:unit`은 `tests/unit/*.test.ts`만 실행 | 원본 snapshot 재현 기능은 정상 |
| 하네스의 원본→구조제거 결과 검증 | **[결함]** | `node record-probe.mjs`: 하네스의 변환 호출 **0**, 출력 row는 `file/cohort/preflight/poppler/pdfjs`만. `tests/pdf-finish-oracle.mjs:246` 루프가 원본만 렌더한다 | **F4 / P2**: 12차 final-assertions에 있던 allowed-only 변환, 두 renderer 안의 원본=결과 SHA, deep residual=0, 제외31 변환0을 추적 하네스에 이관 |
| 검수자가 보완 실행한 허용56 전후 oracle | [통과] | `node before-after.mjs`: r12 변환기를 사용해 **허용56/57페이지** 양쪽 renderer 원본=결과, **deep OC residual=0**, 제외31 변환0, 외부요청0. 출력 파손 negative control 양쪽 검출. `before-after.json`, `logs/before-after.log` | 브랜치에 없는 검수 보완 실행이다. F4의 재현 가능한 하네스 누락을 대신 완료한 것으로 간주하지 않음 |
| legacy main 3종 oracle | [통과] | git 읽기 env를 붙인 `npm run fixtures:pdf-legacy-oracle`: Chrome client 실제 생성, 4옵션×2회 byte/구조/Poppler/PDF.js diff0. 다시 만든 **45/45 파일**이 tracked와 동일, `legacy-comparison.json`. r3 4개 PDF도 byte 동일 | 환경·CropBox·회전·PNG·ExtGState·Helvetica/operator 자료 보존. 새로운 baseline으로 바꾸지 않음 |
| 제품 src/의존/static/PDF smoke | [통과] | `git diff main..HEAD -- src/ package-lock.json` 출력0. `npm run test:static` startup104 PASS; `TEST_SCOPE=pdf TEST_BASE_URL=http://127.0.0.1:4273 TMPDIR=/tmp/worklazy-u4-0-review npm run test:browser` PASS; `npx tsc -b` PASS | UI/번역/SEO/광고 제품 변경0. full visual 생략은 디스패치의 U4-0 예외와 정합 |
| rendering | [통과] | `NODE_OPTIONS=--max-old-space-size=4096 VITE_LOCAL_QA=1 npm run build` 후 `RENDER_TEST_PORT=4279 RENDER_REPORT_PATH=/tmp/worklazy-u4-0-review/rendering.json TMPDIR=/tmp/worklazy-u4-0-review npm run test:rendering`: **3페이지×3회 CLS max0·외부요청0**, `logs/rendering.log` | full visual 생략 대체 조건 충족 |
| 부가 완료 명령 | [통과] | registry20, CSS orphan0, legacy manifest155(removed153/split0/active2), `git diff --check main..HEAD` exit0. `logs/routes.log`, `logs/css.log`, `logs/legacy-manifest-rerun.log` | 없음 |
| CHANGELOG/review-notes/sol 보고 정합 | **[결함]** | 주요 수치·fixture-table **109/109 bytes/SHA** 일치. 단 page AF 부재·OCG 지원표 구문·bundle 재현 env 누락, `record-probe.json` | **F5 / P3**: 아래 3개 기록 정정. 로그상의 PASS 자체가 조작되었다는 증거는 없음 |
| 범위 밖 변경 | [통과] | 변경162파일, fixture 산출148. `.gitattributes` PDF binary 1행·package scripts3개·Vite 계측36줄은 exact fixture/하네스/측정에 필요한 구현. `.gitignore`·lock·src diff0. `scope.json` | 계획에 없는 제품 기능·의존·상한 변경 없음. 기록의 “범위 밖 없음”은 이 의미에서 타당 |

## 수정 지시

### F1 — main 모듈 metadata가 누락되어도 조용히 SHA로 대체됨 (P2)

위치: `scripts/bundle-module-attribution.mjs:132`의 `buildModuleContributions`, `:234`의 `assertMeasurementSchema`.

`measureOutput`는 새 측정 시 Vite manifest와 main 목록을 비교하지만, JSON baseline/current를 비교하는 경로는 schema 번호와 `Array.isArray(modules)`만 확인한다. `modules=[]`나 main 청크 한 행을 제거한 schema v2 보고서가 정상 보고서와 비교되어 delta0으로 통과한다. 배열을 아예 삭제하면 오류가 나는데 빈 배열은 58개 main 청크를 `opaque:unattributed:sha256:*`로 만든다. worker/public에만 허용한 opaque 예외가 main metadata 손실을 덮고 있으며, review-notes의 “누락 metadata는 SHA 폴백 없이 오류”와 다르다.

수정: 계측 보고서에 main chunk inventory/realm을 검증 가능하게 보존하고, 비교 시 양쪽의 main 청크 metadata 완전성·중복·필수 weight를 검증한다. main의 빈/부분 metadata는 오류여야 한다. worker/public의 명시적으로 식별된 opaque 항목만 예외로 둔다. 기준 main을 바꾸지 말고 필요한 metadata를 같은 기준에서 재생성한다. `metadata-guard-probe.mjs`의 8케이스가 모두 거부되고, 정상 worker/public opaque·이동·5종 gate 및 E6 수치가 유지되어야 한다.

### F2 — 동률 정수 배분이 실행 로케일에 의존함 (P2)

위치: `scripts/bundle-module-attribution.mjs:96`, `:108`.

4차 계산식의 구현은 canonical id의 `<`/`>` 순서를 사용했다. 현재 `localeCompare()`는 같은 1B 동률 입력에서도 `LANG=en_US.UTF-8`이면 `ä.ts`, `LANG=sv_SE.UTF-8`이면 `z.ts`에 1B를 배분한다. ASCII `A/a`도 4차 순서와 반대다. `sum=G_c`는 보존되지만 이동 공제와 경계 +1B 판단의 재현성이 손상된다. 현재 E6 fixture에서는 우연히 기대 +80B가 유지되므로 그것만으로 계약 충족을 판정할 수 없다.

수정: 두 정렬 지점 모두 locale 비의존 canonical id 비교로 통일한다. 대소문자·비ASCII 동률 입력과 서로 다른 locale을 포함한 unit으로 4차 순서 및 `sum=G_c`를 단언한다. 재현 명령은 `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 node collation-probe.mjs` 및 `LANG=sv_SE.UTF-8 LC_ALL=sv_SE.UTF-8 node collation-probe.mjs`다. 자료는 `collation.json`, `logs/collation-en.log`, `logs/collation-sv.log`와 `bundle-probe.json`이다.

### F3 — 일반 marked-content Properties를 OCG로 오인해 정상 문서를 제외함 (P2)

위치: `tests/helpers/pdf-finish-ocg-preflight.mjs:292`~`:294` 및 `literal()`의 resource 처리.

`classifyMarkedContent()`는 페이지 `/Resources /Properties`의 **모든 항목**에 `preflight.visible()`을 호출한다. 그러나 `/Span /TextInfo BDC`용 일반 속성 dict(`/Lang`, `/MCID`)는 OCG/OCMD가 아니다. 재현 PDF에는 `/Resources`가 정상 존재하고 OCProperties/OCG/OCMD가 전혀 없으며, Poppler와 Chrome PDF.js가 모두 200×200으로 정상 렌더한다(RGBA SHA `04ce6cfbce82aad25e57dc2c640efdad56a16de829925daa0fdbaf473c9a101b`). preflight는 `allowed=false, reason=unknown-OC-type`이다. v12의 “OC가 전혀 없는 일반 문서는 허용”과 충돌한다.

수정: 실제 `/OC ... BDC` 및 지원 위치의 XObject `/OC`가 소비하는 참조에만 visibility 검사를 적용하고 일반 Properties는 OC로 해석하지 않는다. 전체 객체 탐색·catalog 없는 orphan OC 제외·금지 경로·Type3 제외를 우회하는 조기 성공으로 고치지 않는다. ordinary named Properties fixture를 추가하고 기존 477입력/허용56 전후 렌더를 유지한다. 추가 방어 사례로 `/Resources`가 생략된 빈 페이지에서 현재 `lookupMaybe` TypeError도 재현되었다(`ordinary-no-resources.pdf`); 빈 resource를 허용하는 읽기 경계도 함께 다룬다. 이 보충 파일의 엄격한 PDF 규격 적합성을 본 검수의 주된 결함 근거로 삼지는 않는다.

### F4 — 추적 oracle 하네스에 “원본=변환 결과” 검증이 없음 (P2)

위치: `tests/pdf-finish-oracle.mjs:246`~`:258`.

현행 하네스는 source fixture를 두 renderer로 렌더해 source SHA snapshot을 비교한다. 따라서 원본 회귀 검사는 맞지만, 정본 v11 및 12차 `final-assertions`의 핵심인 **구조 제거 후 표시 보존**과 **깊은 OC 잔여 0**을 검증하지 않는다. 결과 PDF를 입력받거나 만드는 경로도 없다. sol 로그의 56/57은 원본 snapshot 비교 횟수이며 변환 결과 56/57을 실행한 기록이 아니다.

검수에서는 기존 r12 test prototype `flatten`을 읽어 사용한 `before-after.mjs`로 허용56 전후 픽셀·residual 및 제외31 변환0을 실제 재현했고 전부 통과했다. 현재 fixture/지원 문법의 실패를 발견했다는 뜻은 아니다. 하지만 이 `/tmp` 보완 실행은 브랜치가 제공해야 할 반복 가능한 하네스가 아니다.

수정: 이미 검증된 라운드 변환기를 **테스트 전용 helper**로 이관해 U4-0 oracle을 완성한다(제품 구조 제거 구현은 U4-6 범위로 유지). 허용에만 변환을 실행하고 각 renderer 안에서 전체 페이지 width/height/RGBA SHA 원본=결과, 깊은 OC 잔여0, 제외에는 변환 시도0을 단언한다. `on` 결과 content를 비우는 등 **출력만 파손**하는 negative control이 실패해야 한다. 원본 snapshot 검사와 매 unit 미실행 원칙은 유지한다.

### F5 — 기록의 실제 구현/재현 조건 불일치 (P3)

1. `docs/review-notes.md` U4-0의 제거 fixture 설명은 “catalog/page AF”라고 하지만 실제 `removal-structures.pdf`는 catalog AF만 있고 두 page 모두 AF가 없다(`record-probe.json`). 현재 생성 입력에 맞게 기록을 고친다. page AF는 이번 디스패치의 필수 목록이 아니므로 검수자가 fixture SHA 변경을 요구하지 않는다.
2. 같은 절의 OCG/tagged 보존표가 “지원 제외 고지 후 진행 시 구조 제거”로 묶여 있다. 최종 v11~v13에 맞게 **지원 OCG만 기본 표시 고정, preflight 제외 OCG는 구조 제거 옵션 비활성, 장식/raster 가능, tagged 정보 제거는 별도 고지**로 분리한다. 현재 classifier가 제외31을 거부한다는 사실과 표를 일치시킨다.
3. sol REPORT의 `npm run bundle:measure -- --baseline ... --report ...`는 이 스크립트가 지원하지 않는 CLI 문법이다. 실제 스크립트는 `BUNDLE_ROUTES`, `BUNDLE_BASELINE`, `BUNDLE_MEASURE_OUTPUT` 환경변수를 읽고 `process.argv`에서는 직접 실행 여부만 본다. 현재 원로그에는 gate PASS가 있어 실행 자체를 미실행으로 판정하지는 않는다. 정확한 재현 가능한 env 포함 명령으로 기록한다. F4 수정 전의 “원본 snapshot 비교”와 “변환 전후 비교” 실행 범위도 구분한다.

## 실측 수치·환경

| 지표 | main/current | delta | 상한 |
|---|---:|---:|---:|
| entry JS gzip | 299,287B | 0 | 20,480B |
| PDF route JS gzip | 171,864B | 0 | 61,440B |
| shared JS gzip | 2,716,473B | 0 net | 30,720B |
| app JS gzip | 5,466,587B | 0 net | 81,920B |
| CSS gzip | 37,687B | 0 | 10,240B |

schemaVersion2, module chunk58·module record1,012, 80JS/1CSS, multiplier1·override{}다. `bundle-current.json`과 sol `/tmp/s3-bundle-baseline.json`을 대조했다. E6 재현에서는 r4의 `renderedSha` 필드명을 현행 `renderedSha256`으로 매핑했고, renderedLength/gzip=0인 code-unavailable 항목 1개는 현행 플러그인과 같은 empty-string SHA를 넣었다. 실제 파일·weight는 변경하지 않았다. 첫 미매핑 실행의 schema 오류도 `logs/bundle-probe.log`에 보존했다.

Node22.17.1, Linux7.0.0-30-generic x64, Chrome152.0.7977.64, Poppler24.02.0, pdf-lib1.17.1, PDF.js6.2.108이다. legacy client는 실제 Chrome Canvas, system-ui=Noto Sans(`/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf`), alpha0.82(max209), short420×92·wide/surrogate1800×92, UTF-16 120단위 절단이다. legacy Poppler는 `-scale-to 650`(기본150DPI), PDF.js scale1; OCG Poppler72DPI/PDF.js scale1, 흰 배경 unpremultiplied RGBA다. legacy 기준45파일은 재채취 후 전부 SHA가 같았다.

## 실행 실패·재시도 구분

- 최초 전체 unit은 archive 사본에 `.git`이 없어 광고 allowlist 테스트의 `git ls-files`만 실패했다(**254/255**, `logs/unit.log`). 위 읽기 전용 git env를 설정한 재실행은 **255/255**. 테스트/기대값을 수정하지 않았다.
- `legacy:manifest`도 같은 사본의 git 이력 미연결로 첫 실행 실패 후 읽기 env를 붙여 성공했다. `logs/legacy-manifest.log`와 `logs/legacy-manifest-rerun.log` 보존.
- 처음 두 production build를 병렬 실행할 때 main 프로세스가 `Killed`, **exit137**로 끝났다. 자원 압박 가능성이 있으나 원로그 이상 원인을 확정하지 않는다. HEAD 빌드 완료 뒤 main을 `NODE_OPTIONS=--max-old-space-size=4096`으로 단독 재실행해 성공했고, 최종 산출537개 전부 동일했다. `logs/build-main.log`, `logs/build-main-rerun.log` 보존.
- 그 외 현재 브랜치 oracle·PDF smoke·static·tsc·targeted bundle unit·E6·fixture 결정성·legacy 재채취는 실제 성공했다. 검수용 반례의 `allowed=false`/metadata `accepted=true`는 실패를 숨긴 출력이 아니라 결함 재현 결과다.

## 종료 불변 증명

`python3 /tmp/worklazy-u4-0-review/verify-unchanged.py` **exit0**. 시작/종료 **3191파일**의 경로 집합·SHA 전부 동일, 그 중 원 저장소 `dist` **537파일**도 동일하다. HEAD·main·branch·git status가 시작과 같다. `start-state.json`, `end-state.json`, `unchanged.json`, `logs/unchanged.log`를 보존했다. preview는 종료했고 rendering/oracle의 서버도 정리했다.

```text
HEAD   18001be7b00ee662390526a2906bc1d6f1b9d7f5
main   5bc6854175331bdd73b267784d9633cdccda8446
branch s3-pdf-finish
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html
```

원 저장소 추적 파일 수정·커밋·push·dist 변경·브랜치 전환·설치는 0이다.

**최종 판정: [수정 후 재검수].**
