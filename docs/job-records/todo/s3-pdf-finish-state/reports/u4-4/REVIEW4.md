# U4-4 fix-3 재검수 4차 — e30018d

검수자: Codex / gpt-6-astra. 2026-09-08 KST. Worklazy Tools 자체 제품의 품질 검증.

**판정: [수정 후 재검수].** 표시 런타임 중복은 제거됐으며, schema-v3 기준선 재생성과 5종 증분 예산 통과는 독립 재현됐다. 상한이나 기준선 내용을 유리하게 조작해 통과시켰다는 증거는 없다. 그러나 첫 표시 모듈 로드 실패의 복구·오류 안내에 P2가 있고, 배포 전체 계측에 누락이 남는다. 추가 상태 검사에서 F2 오류 UI의 대비 위반도 확정했다. 128MiB 전체 처리 heartbeat는 최초 측정에서 상한을 넘겨 무조건 통과로 기록하지 않는다.

## 실행 경계와 재현 환경

- 대상 HEAD `e30018dd2d4801c5abba54a88f200e9ac69325d3`, 브랜치 `s3-pdf-finish`. `git archive` 사본인 이 디렉터리의 `repo/`에서 실행했다. 구현·커밋·push·브랜치 전환은 수행하지 않았다.
- 선독: PROJECT_RULES.md → AGENTS.md → 3차·2b 검수 → fix-3 지시서·sol 보고/산출물 → 정본 `docs/jobs/todo/pdf-finish-20260905.md` 및 관련 review-notes. 열린 작업계획 목록은 [open-plans.json](evidence/open-plans.json). 다른 구현 작업과 충돌하는 저장소 수정은 없다.
- 금지된 다른 작업 디렉터리에는 접근하지 않았다. 서버는 4271·4272, 렌더 프로브는 4274, 기존 테스트의 임의 포트는 [shim](probes/strict-legacy-port.cjs)으로 4279에 고정했다. Vite 서버는 모두 `--strictPort`. 시작 시 존재하던 4270 리스너는 사용하거나 종료하지 않았다.
- 빌드·브라우저·시각 회귀는 직렬, `NODE_OPTIONS=--max-old-space-size=4096`. Node 22.17.1, Chrome 152.0.7977.64, Poppler 24.02.0, Playwright 1.63.0/axe-core 4.13.0. 성능은 1280×900/DPR1, CPU·네트워크 throttle 없음, 각 입력마다 새 context다.
- 기존 검수의 의존성·벤더 캐시를 **복사**하고 현행 prebuild 검증/패치를 실행했다. 새 `npm ci` 결과라고 주장하지 않는다. PDF.js 패키지 전체 비교와 네 파일 최소 변경 검증을 별도로 수행했다.
- 본문에서 `node probes/…`는 `/tmp/worklazy-u4-4-review4` 기준이다. npm 명령은 그 아래 `repo` 기준이며, 브라우저 프로브에는 해당 production/QA 빌드와 `TEST_BASE_URL=http://127.0.0.1:4272`를 사용했다. 실행별 환경·명령·exit code는 [regression](evidence/regression.json), [stage2](evidence/stage2.json), [stage3](evidence/stage3.json), [stage4](evidence/stage4.json), [stage5](evidence/stage5.json), [stage6](evidence/stage6.json), [stage7](evidence/stage7.json)에 보존했다.

## 항목별 판정

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| 구 schema-2 기준선 음성 주입 | 통과: 실제 거부 | `BUNDLE_BASELINE=/tmp/s3-bundle-baseline.json BUNDLE_ROUTES=pdf-editor npm run bundle:measure` → **exit 1**, unsupported schema | 이 실패 계약 유지 |
| S3 기준선 재생성·상한 | 통과 | `node probes/baseline-build.mjs` + `node --experimental-strip-types probes/meter-audit.mjs` → 기존 파일 SHA/gzip·모듈 동일, 독립 v3와 sol v3 일치 | 기준선 코드 해시와 생성 환경을 함께 고정 |
| 배포 전체 inventory | **P3 수정 필요** | full production 142 JS/MJS 경로 중 포함 대상105, 공식 meter에는87. 8경로의 생성 스크립트2 SHA/gzip **2,221B 누락** | 정상 정적 생성까지 실행한 배포 산출물을 계측하고 독립 파일/네트워크 census와 대조 |
| vendor/runtime 제외 | 현행 PDF 변경 범위에서 정당, 미래 전면 면제는 불가 | [전수 목록](evidence/all-deployed-execution.json), 제외37경로 검토. 새 PDF 자산을 제외 트리로 숨긴 사례 없음 | 고정 외부 런타임만 예외로 관리하고 신규 실행 파일·버전 변화는 별도 검증 |
| route 재귀 소유권 | 현행 표본 통과 | `node --experimental-strip-types probes/meter-injections.mjs`; 실제 PDF·QR·audio·video·공용 worker 참조 대조 | 상대 import/일반 문자열의 합성 반례는 계측기 유지보수 회귀로 추가 |
| 동일 SHA 1회·실제 증분 | 통과 | 같은 내용 별칭 추가→5종 delta0; 내용 변경→gzip+108,344B, shared/app 상한 실패 | 내용 SHA와 모든 경로 별칭을 함께 보존 |
| 번들 5종 / 기존 probe 무수정 | 통과 | 원본 probe SHA 동일, bwrap 경로 매핑으로 무수정 실행→`correctedPassed:true`; 공식 scoped 비교도 exit0 | 아래 잔여 예산으로 후속 작업 판단 |
| 무범위 표준 비교 | **실패, PASS 아님** | `BUNDLE_ROUTES='' npm run bundle:measure` → exit1, `baseline.perRouteJsGzip.audio-studio` 오류 | 별도 기준선 완전성 문제로 유지, scoped PASS와 혼합 금지 |
| 기록 오기 정정 | 통과 | 현행 review-notes 상단에서 이전 “중복 없음/5종 통과”를 폐기하고 fix-2 기록도 정정 | 새 검수의 실제 범위·잔여도 반영 |
| 표시 런타임 단일 배포 | 통과 | `runtime-browser.mjs`, `runtime-assets.json`: `pdf-CCjkBPdx.mjs` 한 파일, main/thumbnail worker가 동일 URL 참조 | URL 공유·두 worker 유지 |
| 최초 로드·콜드 캐시 | 정상 통신 경로 통과 | 새 context3회: 첫 preview 약463–503ms, heartbeat 최대48.700ms, 오류0·다운로드 성공 | 최초 fetch 실패 분기는 아래 P2 수리 |
| main 동적 import 실패 복구 | **P2 수정 필요** | ko/en×4경로에서 최초 실패 후 재선택도 실패·새 요청0. 복구 후 fetch200이어도 동일 URL import 거부 | 실패 캐시와 브라우저 모듈 캐시를 고려한 유한 복구 경로 및 ko/en 오류 정상화 |
| worker/OffscreenCanvas fallback | 기능 통과 | Worker 미지원·생성 오류·OffscreenCanvas 미지원·worker 측 import 실패→preview/저장 성공 | 큰 입력 fallback의 200ms 보장으로 확대 해석 금지 |
| 11+128MiB·취소·결과 | 부분 통과, **전체 heartbeat 검증 잔여** | 11입력·128MiB 곡선, 전체12회·paired6회. 최초128MiB heartbeat 중앙값202.080/max227.195ms | 전체 작업 구간을 고정하고 초과 표본을 지우지 않은 채 원인·안정성 재확인 |
| 의존 패치 네 항목 | 통과 | 4빌드×180, scalar 차이0; 4파일×2치환만; 5음성 빌드 exit1; lock6.2.108 | exact-version/hash·변환/렌더 oracle 유지 |
| A3 정상 파일·공백·배치·clip | 통과 | ko/en14개 UI 입력, 정상 inline corpus101, 회전 이탈 차단/1픽셀 양성, empty-text, 위험 동의 | 기각된 과잉 차단을 복원하지 말 것 |
| 접근성 marker/selector/집계 | 통과 | 미귀속 target0, 실제 gradient2개 F2 귀속·원래 집계기 거부, 미발견/invalid selector와6음성 거부 | marker·오류 처리 유지 |
| F2 오류 상태 접근성 | **P2 잔여, fix-3 신규 회귀는 아님** | `a11y-error-settled.mjs`: ko/en light2노드·dark1노드, 대비4.36/3.98/4.20<4.5; 실제 gate 거부 | 오류 색/배경 대비 수정, 오류 상태도 접근성 게이트에 등록 |
| P3 Poppler 상단·내부 명칭 | 통과 | `bbox-controls.mjs` 상단+20pt 양성 대조에서 Poppler 잉크 증가0; disclaimer ko/en 내부 명칭 없음 | 기존 경계와 사용자 문구 유지 |
| 골든/legacy/기존4모드/도구20 | 통과 | `test:pdf-finish` 160골든, legacy diff0, browser/new-tools/registry 통과 | 유지 |
| CLS·광고·시각 회귀 | 통과 | CLS max0.00014804≤0.1; 일반 PDF 광고1·격리3경로0; 211/211 두 회, 영어320/390 DOM 폭 일치 | 기준선 재생성 없음 |
| 전체 명령의 실패 이력 | 숨기지 않음 | QR 최초 실패 및 검수 준비 오류를 아래 별도 기록 | 보정 재실행과 원래 실패 로그를 모두 보존 |

## R1 — P2: 표시 모듈 첫 로드 실패 후 복구 불가와 원시 오류 노출

제품 도달 경로는 **정상 PDF를 처음 선택하는 순간 발생한 일시적 자산 요청 실패**다. 파일을 손상시키거나 제품 소스를 바꾸지 않았다. 597B `adversarial/inline-ei-delimiter.pdf`를 사용해 첫 `assets/pdf-*.mjs` 요청만 `route.abort('failed')`로 막았다. 차단을 해제하고 같은 내용의 새 파일명을 선택해도 ko/en의 watermark·organize·pdf-to-image·convert **8/8경로**에서 실패가 유지됐다. 재선택 시 새 표시 모듈 요청은0이며, 새로고침 후 같은 파일은 성공한다.

[초기·재시도·reload 상태](evidence/runtime-browser.json), [복구 상세](evidence/import-recovery-detail.json), [영어 organize 화면](shots/import-failed-en-organize.png), [한국어 watermark 화면](shots/import-failed-ko-watermark.png). 재현: `node probes/runtime-browser.mjs`, `node probes/import-recovery-detail.mjs`.

`pdfPreview.ts:17–23`은 거부된 `pdfDisplayModulePromise`를 보존한다. `getPdfDocument`의 import await(`:78`)는 기존 `loadingTask.promise.catch(normalizePdfOpenError)` 밖에 있다. 기존3모드의 catch는 `reason.message`를 그대로 오류 패널과 작업 로그에 넣어서 `Failed to fetch dynamically imported module: http://…/assets/pdf-CCjkBPdx.mjs`가 노출된다. watermark는 “파일을 확인하고 다시 선택”하라고 안내하지만 그 조작으로 복구되지 않는다.

**단순 Promise 초기화만으로 충분하다는 수정안은 기각한다.** 추가 프로브에서 차단 해제 뒤 `fetch`는200/853,555B였지만, 같은 document의 **직접 동일 URL import도 실패**했다. 진단용 별도 query의 import는6.2.108로 성공했다. 따라서 애플리케이션 Promise와 브라우저의 실패 모듈 캐시 양쪽을 고려해야 한다. 진단용 query 실험은 제품 수정이나 정상 경로 URL 변경이 아니다.

수정 지시 문안: “표시 런타임 로더의 실패를 공통 경계에서 식별·현지화하고, 정상 파일을 손상 파일로 오인 안내하지 않는다. 실패한 공유 Promise와 브라우저 모듈 캐시를 고려한 **유한 재시도 또는 명시적인 새로고침 복구** 정책을 정본화한다. 기존의 bounded chunk recovery를 재사용할 경우 반복 reload·선택 파일 손실과 재선택 안내까지 계약에 넣는다. 정상 경로의 main/worker 동일 URL·단일 배포, 정상 worker fallback과 취소를 보존한다. 최초 요청 실패→통신 복구→사용자에게 안내한 복구 조작→미리보기·저장 성공을 ko/en에서 검증하고, 원시 예외·아셋 경로 노출이 없어야 한다.”

메인 모듈이 이미 로드된 뒤 **thumbnail worker 쪽 import만** 실패시키는 대조는 preview·download가 성공했다. 이를 main 최초 import 실패의 복구 성공으로 대체할 수 없다.

## R2 — P3: 배포 생성 단계 뒤의 실행 스크립트가 계측되지 않음

`scripts/measure-bundle-budget.mjs:49–76`의 표준 실행은 Vite `dist-measure`까지만 만든다. 실제 `npm run build`는 이후 `generate-static-pages.mjs`가 격리 페이지와 실행 스크립트를 더한다. 따라서 확장자 predicate가 맞아도 **수집 시점이 실제 배포보다 이르다**.

독립 파일 순회는 meter의 제외 함수를 사용하지 않고 production의 `.js`·`.mjs`를 전부 수집했다. 총142경로, 계약상 포함105경로, 제외37경로다. 공식 계측의87 JS 경로와 비교하면18경로가 빠진다. 그중10개는 video worker의 locale 복제(기존 SHA)이고, 나머지8개는 다음 **새 고유 SHA2개**다.

| 생성 자산 | 실제 경로 수 | 원본 bytes | gzip bytes | SHA-256 |
|---|---:|---:|---:|---|
| video `coi-serviceworker.js` | unprefixed/ko/en 3 | 2,271 | 962 | `6d741d2e590aaf66c9e8e5c57abb3d865aba80631913e4f07e6e094f5bd2802a` |
| office/xls `coi-serviceworker.js` | office ko/en2 + xls unprefixed/ko/en3 | 3,360 | 1,259 | `52f0af64cc9b5012cac2616cfb888d8cdd4f292e4a131a3dce3a597d1f32f827` |

이들은 `vendor/`나 `runtime/` 아래가 아니다. 독립 브라우저 네트워크 기록에서 `/en/tools/video-studio/coi-serviceworker.js`, `/en/tools/office-editor/app/coi-serviceworker.js`, `/en/tools/excel-merger/xls-preserve/coi-serviceworker.js`가 실제 요청된다. DOM script src와도 일치한다. [누락 SHA·경로](evidence/generated-script-gap.json), [원시 네트워크](evidence/runtime-browser.json)의 `isolated`, [전체 inventory 재계측](evidence/full-production-current.json).

완전 생성 출력의 보완 `measureOutput` 호출에는, 정상 production 빌드가 manifest를 보관하지 않아 동일 production 자산을 낸 측정 빌드의 manifest와 최초 production의 모듈 메타데이터를 입력했다. 외부 프로브에서 그 manifest 파일의 읽기만 매핑했고, 자산 내용·gzip·비교 함수·상한은 변경하지 않았다. 공식 계측 자산과 production의 공통 경로 SHA 불일치는0이며, 최종 재빌드142경로도 최초 census와 일치한다. 이 보완 호출을 공식 `npm run bundle:measure`가 원래 완전했다는 증거로 사용하지 않았다.

S3의 완전 생성 산출물에도 **같은 두 SHA**가 있다. 두 시점을 동일 범위로 보정하면 고유 JS89개/105경로가 되고, current app gzip5,911,840B·baseline5,843,655B로 **증분68,185B는 불변**이다. shared도 양쪽에2,221B씩 더해져 순증분2,152B가 유지된다. 현재 PDF 예산을 거짓 PASS로 만든 누락이라는 판정은 하지 않는다. 다만 fix-3의 “모든 배포 실행 자산” 완전성 계약은 충족하지 않는다.

수정 지시 문안: “정상 배포의 정적 생성까지 마친 출력과 같은 파일 집합을 측정한다. 생성 스크립트의 output directory 계약을 정리하고, 현재 출력·기준선에 같은 절차를 적용한다. locale 복제는 모든 경로를 inventory에 남기고 SHA당 gzip은1회만 센다. 네트워크 실제값과 기대 inventory 양쪽을 같은 제외 함수로 필터링하지 않는다. 새 생성 JS/MJS를 넣는 음성 대조로 누락을 잡는다. 상한·override·multiplier는 유지한다.”

**제외 트리 검토.** S3의 기존 앱 번들 계약과 기존 계측기부터 외부 vendor/runtime을 분리했다. 정본 H2·v5 D5/v6의 앱/모듈 증분 예산과 PROJECT_RULES §9의 고정 벤더 SHA 검증을 함께 적용해야 한다. 제외37경로는 tesseract7, pyodide2, rhwp4, Zeta6, video runtime18(6×3locale)이다. 현행34경로는 S3 동일 경로/내용과 대조됐고, 나머지3경로는 복사 캐시에 남은 **Zeta 2026-08-25** 자산이다. 이3개는 현재 원본 워크스페이스 public/vendor와 이전 fix-2 검수에서도 같은 SHA이며, 현행 참조 버전은2026-08-26이다. [캐시 출처](evidence/legacy-vendor-provenance.json). 이 로컬 캐시 잔재를 fix-3 신규 코드로 판정하지 않았다. sol의 scratch `repo/`는 이미 비어 있어 그 dist의 부재로부터 CI 배포 파일 수를 추론하지 않았다([확인 결과](evidence/sol-dist-comparison.json)).

OCR의 Tesseract처럼 실제 실행되는 벤더는 존재한다. “제외 트리에 실행 자산이 없다”는 뜻의 통과가 아니다. 고정 외부 런타임의 기존 제외로 설명할 수 있고 **PDF 변경을 숨긴 신규 자산은 없다**는 제한된 판정이다. 앞으로 임의 `runtime/` 경로에 앱 코드를 넣으면 자동 면제되는 정책은 충분하지 않으므로 예외 자산 목록/버전/SHA의 변화도 검토해야 한다.

## 기준선·소유권·중복 방지의 독립 검증

S3 `5bc6854175331bdd73b267784d9633cdccda8446`을 새로 archive했다. baseline의 소스를 수정하지 않고 외부 Vite observer plugin으로 main 모듈 메타데이터를 채취했다. 새 meter를 **호출하는 외부 프로브**로 같은 범위의 baseline을 작성했다. sol의 baseline-source에서 S3 대비 변경된 추적 파일은 meter와 vite.config뿐이며, 본인의 새 archive에는 그 변경도 하지 않았다. [sol baseline source 비교](evidence/sol-baseline-source-diff.json), [독립 baseline](evidence/baseline-independent.json), [원시 모듈](evidence/baseline-modules-raw.json), [검증](evidence/meter-audit.json), [독립/sol 직접 동등 비교](evidence/baseline-equality.json).

| S3 기준선 지표 | 기존 v2 | 독립 v3 | 사유 |
|---|---:|---:|---|
| entry gzip | 299,287 | 299,287 | 동일 |
| PDF route gzip | 171,864 | 1,077,287 | 기존 PDF workers 530,576B의 소유권 이동 + 누락 internal worker374,847B |
| shared gzip | 2,716,473 | 861,123 | 기존 여러 route worker의 귀속 복원 |
| app gzip | 5,466,587 | 5,841,434 | 이미 S3에 배포됐던 `pdf.worker.min-CHFwMXne.mjs` 374,847B 포함 |
| CSS gzip | 37,687 | 37,687 | 동일 |

기존 경로의 내용 SHA/gzip 변화0, 제거0, 모듈 메타데이터 동일이다. 추가 고유 자산은 위 internal worker1개다. 독립 v3의 파일·모듈은 sol v3와 동일했다. 기존 v2와 새 v3 수치를 직접 빼면 S3부터 있던 비용을 이번 증가로 오인하므로 **기준선 재생성은 범위 확장에 필요한 절차**다. 구 v2를 실제 표준 명령에 넣었을 때 exit1로 중단되는 것도 확인했다([로그](logs/stage2-bundle-old-schema.log)).

현행 표본: 표시 모듈·thumbnail worker·PDF internal worker·PDF office worker는 pdf-editor 소유, QR worker는 qr-studio, audio worker는 audio-studio, FFmpeg 공통 wrapper는 audio+video의 shared다. entry가 직접 만드는 Excel 공용 worker는 shared/소유자 빈 집합으로 남아 PDF에 끌려오지 않는다. [참조 문자열 문맥 포함 표본](evidence/meter-audit.json)의 `routeSamples`.

합성 fixture는18개 route를 만들어 실제 guard를 통과한 뒤 측정했다. PDF→worker→display의 재귀 전파, audio/video→공통 worker→깊은 자산의 다중 소유권을 확인했다. 같은 SHA 별칭은 path2개/계산1개이고, 같은 내용만 추가하면5종 delta0이다. 한 별칭의 내용을 바꿔 gzip108,344B를 추가하면 실제 comparator가 shared30,720B/app81,920B 상한 위반으로 거부한다. **내용이 바뀐 비용을 동일 SHA 논리로 숨기지 못했다.** [합성 음성 주입](evidence/meter-injections.json).

보수적으로 남길 유지보수 반례: URL 문자열 정규식은 상대 `import('./deep-relative.mjs')`를 shared/미귀속으로 남기고, 단순 진단 문자열 `'assets/unrelated.worker.js'`를 PDF 소유로 끌어온다. 현재 배포 PDF 표본에서 이 오귀속은 발견되지 않았다. 지금 예산을 뒤집는 제품 결함으로 부풀리지 않되, import/URL 문법 파싱 또는 명시 메타데이터 계약의 회귀 세트로 남겨야 한다.

## 확정 번들 예산과 단일 표시 런타임

| 지표 | 순증분 gzip B | 고정 상한 B | 잔여 B |
|---|---:|---:|---:|
| entry | 7,178 | 20,480 | **13,302** |
| PDF route | 58,079 | 61,440 | **3,361** |
| shared | 2,152 | 30,720 | **28,568** |
| app | 68,185 | 81,920 | **13,735** |
| CSS | 235 | 10,240 | **10,005** |

override `{}`, multiplier1. shared gross 증가 511,944B 중509,792B는 기존 모듈의 route→shared 이동이며 순증분은2,152B다. 정본의 모듈 이동 계약대로 분리했다. 앱 전체 증가68,185B는 이동과 무관하다. 생성 스크립트2종을 양쪽에 포함한 보완 측정에서도 표는 같다.

[공식 scoped 결과](evidence/bundle-current.json), [이전 원본 probe 무수정 결과](evidence/bundle-review.json), [probe SHA](evidence/original-bundle-probe-sha.txt). 원본 probe는 경로가 review3와 구 baseline에 고정되어 있어 bwrap 안에서 **입력 경로만 이번 사본/독립 v3로 매핑**했다. probe 바이트는 변경하지 않았다. 그 probe의 옛 `pdf.min-*` 검색만으로 완전성을 판정하지 않고 별도 전수·네트워크 검사를 수행했다. **무범위 비교는 두 경로 모두 audio-studio baseline 값 누락으로 실패**했다([로그](logs/stage2-bundle-unscoped.log)).

| 자산 | fix-2 gzip B | fix-3 gzip B | 관찰 |
|---|---:|---:|---|
| PdfEditorPage | 167,297 | 25,357 | 내장된 표시 API가 빠짐 |
| 별도 display | 130,427 (`pdf.min-DNQlQ5cq.mjs`) | 176,363 (`pdf-CCjkBPdx.mjs`) | patched full build 한 파일 공유 |
| thumbnail worker | 906 | 904 | 유지 |
| PDF.js internal worker | 374,847 | 374,847 | 동일 SHA로 유지 |

현재 display는853,555B, SHA `e0fac5c8abfe978d550ea1efc23bcd384bb4c9e1e5c91e13084cbb6d0ca69812`. main 모듈 목록에 PDF.js 본체 대신49 rendered bytes의 URL proxy만 남았다. [정적 비교](evidence/display-artifact-comparison.json), [main 모듈](evidence/pdfjs-main-modules.json).

브라우저의 raw JS/MJS 요청을 **제외 predicate 없이** 채취하면 정상 PDF 작업의 고유20경로가 inventory에 모두 있다. 표시 모듈 URL은 main과 thumbnail worker 산출물 양쪽에서 동일하게 참조되고, 네트워크에도 그 한 URL만 있다. 여러 worker realm에서 같은 URL을 다시 요청하는 것은 다른 배포 파일의 중복과 구분했다. 내부 worker와 thumbnail worker 생성도 실제 worker 목록으로 확인했다. [기본 smoke 자산](evidence/runtime-assets.json), [독립 원시 네트워크](evidence/runtime-browser.json).

## 성능과 최초 로드

`test:pdf-watermark-performance`는 12입력×3회, 자체 취소 91.062ms·fallback 보존을 통과했다. 다만 이 테스트의 heartbeat는 preview 시점에서 수집되므로 전체 처리까지 통과했다고 확대하지 않았다. [표준 측정](evidence/performance-standard.json).

본인 이전 검수의 유효 원본 11개를 그대로 사용하고 128MiB·폭 변형 2개를 추가했다. [48회 측정](performance/measurements.json), [입력 SHA](performance/fixtures.json), [중앙값](performance/summary.json). 일반 경로 14입력×3=42회, fallback 32/64MiB×3=6회다. 일반 preview heartbeat 중앙값은 최대 174.565ms(128MiB)였다. fallback은 220.150/402.970ms로 큰 입력의 200ms 목표를 넘는다. 이는 기존 fallback의 기능적 한계와 같은 방향이며 worker 제거로 예산을 절약해서는 안 되는 근거다.

아래는 별도로 **마지막 다운로드 bytes를 확인한 뒤** heartbeat를 읽은 production 전체 12회다. 각 3회의 중앙값이며 최초 결과를 보존했다.

| decoded 크기 | upload→preview ms | upload→download ms | 전체 최대 heartbeat 중앙값 ms | 최대 Long Task 중앙값 ms |
|---|---:|---:|---:|---:|
| 16MiB | 788.440 | 1,755.275 | 127.385 | 0 |
| 32MiB | 1,059.760 | 2,021.055 | 56.175 | 0 |
| 64MiB | 1,580.530 | 3,182.845 | 71.825 | 0 |
| 128MiB | 2,537.095 | 5,849.510 | **202.080** | 88 |

128MiB 3회는 heartbeat **227.195 / 158.535 / 202.080ms**, 12회 전체 max 227.195ms로, ≤200ms를 모두 달성하지 못했다. 초과는 생성 단계 구간이었다. `node probes/performance-total.mjs`는 측정 완료 시 exit0으로 끝나는 프로브이므로, exit0을 목표 PASS로 해석하지 않았다. [전체 구간 원시값](evidence/performance-total.json), [중앙값](evidence/performance-total-summary.json).

추가로 fix-2/fix-3을 번갈아 각 3회, 128MiB 단독의 새 브라우저로 대조했다. 입력과 프로브 본문은 같으며, 대상을 128MiB 1회로 좁히고 출력 이름과 서버의 dist를 전환했다. [프로브](probes/performance-paired.mjs), stage4의 6회 실행에 원시값을 보존했다.

| 대조 | heartbeat 3회 ms | 총 처리 중앙값 ms |
|---|---|---:|
| fix-2 | 157.460 / 149.045 / 150.475 | 5,675.510 |
| fix-3 | 168.070 / 121.210 / 103.315 | 5,782.780 |

단독 새 브라우저 대조에서는 초과가 재현되지 않아, **이번 중복 제거가 지속적인 응답성 회귀를 만들었다고 확정하지 않는다**. 다만 12 context를 순서대로 처리한 최초 실행과 브라우저 수명이 다르므로, 나중의 좋은 값으로 최초 초과를 취소하지 않는다. **성능 검증 잔여**로서 최초 사용·연속 사용·생성까지의 측정 범위를 고정해 원인과 여유를 확인해야 한다. preview만 측정하거나 상한을 완화해 닫지 않는다.

16→64MiB 비 1.8133, 16→128 비 3.3325, 선형 적합 `37.5919ms/MiB + 946.657ms`, R² 0.99080이다. 측정 범위의 준선형성은 유지했다. 이전 sol의 1.46을 이번에도 재현했다고 쓰지 않는다. [곡선](performance/curves.png), [SVG](performance/curves.svg), [적합값](evidence/performance-fit.json).

콜드 HTTP 캐시 3회의 최초 preview는 503.250/463.000/499.435ms, heartbeat 최대값은 43.905/48.700/44.545ms, Long Task는0이었다. 각 회의 preview와 다운로드 성공을 확인했다. 표시 모듈 요청마다 750ms의 인위적 지연을 넣어도 화면은 “Checking pages…”와 취소 버튼을 표시하고, 마지막에 정상 preview로 전환됐다. 정상 통신에서 백지화·오류·중복 표시는 관찰하지 못했다. [콜드 preview](shots/cold-preview-0.png), [대기 화면](shots/delayed-import-pending.png). 이는 회선 지연 중의 응답성과 화면 상태를 측정한 결과다.

취소는 표준 91.062ms, 독립 CDP의 mouse press→UI 소거가 검사 13.676ms·preview 16.390ms로 ≤250ms다. 독립 프로브의 준비 시작부터 잰 값은 108.391/264.215ms로, 뒤의 값에는 버튼으로 스크롤·좌표 확보·CDP 준비가 들어 있다. **264.215를 250 이하로 반올림하지 않고, 실제 취소 입력부터의 시간과 구분한다.** staleResult=false, detachedDraws=[], 재시도 성공이다. 파일 교체 322.815ms는 새 입력 준비 시간이고, unmount는 62.638ms/canvas0이다. [lifecycle](performance/lifecycle.json).

내부 scanner/inflater의 현행 함수 본문을 바꾸지 않고 import 경로와 private export만 추가한 진단에서도 6종 모두 macrotask 타이머가 실행되고 AbortError로 끝났다. 취소 신호 후 응답은 1.425–3.819ms였다. [yield](evidence/yield-inner.json), [프로브 출처](evidence/private-probe-provenance.json). 256B token/64KiB scan/1MiB inflate 경계, 1,256개 fuzz, 400tile 취소·결과 미등록/재시도 계약도 유지했다.

## 의존 패치 네 항목과 출력 정확성

[최소 범위/음성 주입/lock](evidence/dependency.json), [패키지 전체 비교](evidence/pdfjs-entire-package-diff.json), [4×180 매트릭스](evidence/render-matrix.json), [독립 scalar 대조](evidence/render-scalar.json). 실행: `node --experimental-strip-types probes/dependency.mjs`, `render-matrix.mjs`, `render-scalar.mjs`.

- 네 빌드의 원본/패치180개씩 =1,440렌더, Poppler180, LE/BE·offset 변환504개. **새 회귀0**, 네 빌드 동일 결과. 원본의33fixture/77 tail pixel 차이는 의도한 교정이며 원본↔패치 전체 픽셀0이라고 쓰지 않는다. 패치↔scalar oracle 차이0, raw oracle 오류0.
- `build/pdf.mjs`, `build/pdf.min.mjs`, `legacy/build/pdf.mjs`, `legacy/build/pdf.min.mjs` 각2치환만. 원본/결과 SHA 모두 선언과 일치. 패키지550파일 전수에서 다른 변경0, 추가/제거0.
- 원본 적용 및 재적용 exit0. unknown hash, version6.2.109, 원본 치환 횟수, 패치본 치환 횟수, 잘못된 output SHA의 **5개 실제 `npm run build`가 모두 Vite 이전 exit1**. 패치 성공만 시뮬레이션한 판정이 아니다.
- package.json·lock의 정확한6.2.108, resolved/integrity 유지, 타 패키지 lock 변경0.

유효 inline corpus101페이지는 Poppler exit0·stderr0이며,14성능 입력을 독립적으로 판독했다. 다섯 대형 source/download를 PDF.js·Poppler 양쪽으로 렌더하면 각각1,798/1,936픽셀 변화로 워터마크가 추가되고 기존 도형을 보존한다. 흰 결과를 성공으로 세지 않았다. [출력 판독](evidence/output-validity.json), [대표 결과](render/validity/flate-16MiB-output-poppler.png).

## A3·P3·접근성 재확인

ko/en 각각 7개 UI 사례를 실행했다([browser-contracts](evidence/browser-contracts.json)). 597B EI-delimiter 정상 파일은 risk0·결과1,433B다. 공백/줄바꿈은 empty-text로 버튼이 비활성화된다. 회전 이미지 이탈은 empty-placement로 차단하고, 1픽셀 이미지 양성은 PDF.js·Poppler 모두 1픽셀이다. 불확실 clip은 위험 동의 후 처리되며, 확실한 zero clip은 결과0/검증 오류로 끝난다. 원래 불확실 line clip은 동의해도 잉크0일 수 있는 기존 한계를 유지한다. 이를 이유로 새로운 과잉 차단을 도입하지 않는다.

정상 corpus 101개 중 보수 경고 5개는 hardblock으로 올라가지 않았다. validator 4음성·중복 reference 순서·단일 XObject의 single/tile/300tile 재사용(Do1/18/300), Noto 1회 임베드, glyph 누락의 정확한 위치, 위험 무동의 거부·동의 후 생성도 재현했다([contracts](contracts-new.json), [engine corpus](evidence/engine-corpus.json), [fuzz](cancel-fuzz.json)).

P3 상단 경계는 Helvetica/Noto/descender 표본×회전4의 BBox top+20pt 대조에서 Poppler 잉크 증가0이다. [bbox-controls](bbox-controls.json)와 [render-new](render-new.json)에 남긴 작은 PDF.js antialias/경계 픽셀 차이를 “두 렌더러 전부 byte equality”로 오기하지 않는다. `previewDisclaimer`의 ko/en 문구에는 PDF.js/Poppler/Canvas 같은 내부 명칭이 없다. R1의 오류 노출은 이 disclaimer 통과와 별개다.

접근성 일반 QA 12페이지는 violations0, F2 incomplete0, inherited925, 외부 요청0, placeholder 대비4.8871이다([a11y](evidence/a11y.json)). text/image/risk/error의 F2 고유 target 미귀속은0이다. 실제 image label+helper에 gradient를 주입하면 incomplete2개가 F2로 분류되고, 이를 원래 12페이지 보고에 넣은 **원래 assertAccessibilityResults가 거부**한다. selector 미발견/invalid, 소유자·reason·target·nodes 누락 등 6음성도 거부한다. 귀속을 공유 부채로 되돌린 흔적은 없다.

**R3 — P2 잔여: 오류 상태의 실제 대비 위반.** 정상 PDF를 선택하고 내용에 공백만 넣는 제품 입력으로 도달한다. 전환 효과를 끄고 1초 뒤 검사해도 ko/en light에서 textarea4.36:1/empty-text notice3.98:1, dark에서 notice4.20:1로 4.5:1에 미달한다. 모두 F2 marker 내부이며, 1개 color-contrast rule에 light2노드/dark1노드다([정착 후 실측](evidence/a11y-error-settled.json)). 실제 violation을 표준 보고에 넣으면 `Accessibility limits exceeded`로 거부한다. **집계기를 완화한 것이 아니라 기본 시나리오가 오류 상태를 검사하지 않는 구멍**이다.

3차 원시 `browser-contracts.json`의 light 오류 상태에도 같은 2노드가 있었으므로 **fix-3가 새로 만든 회귀라고 주장하지 않는다**. 당시 보고가 이 원시 위반을 별도 잔여로 설명하지 않은 점은 이번에 바로잡는다. inherited925개의 incomplete와 이 확정 위반을 섞어 면제할 수 없다.

수정 지시 문안: “F2의 invalid textarea·empty-text 오류 안내가 light/dark에서 최소4.5:1을 만족하도록 색/배경을 수정한다. ko/en의 정착된 오류 상태를 기본 접근성 검사에 추가하고, marker를 빼거나 shared-existing으로 재분류하거나 limit을 올려 통과시키지 않는다. 같은 공용 스타일을 고칠 경우 영향 소비처의 시각·접근성 회귀도 확인한다.”

영어 320/390px에서 documentWidth가 각 viewport와 같고 finish3탭의 text scrollWidth≤clientWidth이며 active 탭이 보였다. [320px](browser-contracts/mobile-en-320.png), [390px](browser-contracts/mobile-en-390.png). 두 시각 회귀 실행은 각211/211이다. LANG=ko/en을 설정했지만 **실행 내 시나리오 자체가 두 언어를 섞으므로 “언어별로 각각 독립211개”라고 주장하지 않는다**. 추적 시각 기준선은 재생성하지 않았다.

## 공통 검증과 실패 이력

검증 출력은 성공 여부에 관계없이 보존했다. `test:pdf-finish`에는 16직접경로·48preview·오류/취소/재시도와 128image+32text=160골든의 PDF.js·Poppler 검사가 포함된다. legacy oracle은 diff0, 도구 등록20 불변이다. CLS7페이지×3의 최대는0.0001480366으로 0.1 이하이지만 **정확한0은 아니다**. 일반 PDF ko/en은 광고 script1, video/office/xls 격리 경로는0이다. 광고 요청은 검증용 interception으로 내용을 대체했다.

다음은 통과로 숨기지 않은 실행 오류다.

1. **구 schema2 비교 exit1**은 기대한 음성 주입 성공이다. **무범위 audio-studio 비교 exit1**은 기존 실패이며 PASS가 아니다.
2. 독립 S3 첫 빌드는 Vite/계측 뒤 정적 생성에서 runtime 입력 부재로 exit1이었다. 원래 vendor generator를 실행한 뒤 같은 빌드/생성을 재실행해 exit0이었다. 기준선 소스를 고치지 않았다([준비 보정](evidence/baseline-preparation-recheck.json)).
3. `contracts-new` 첫 실행은 원본 duplicate-reference.pdf 복사 누락, `output-validity` 첫 실행은 브라우저 출력 생성보다 먼저 실행한 순서 오류, `yield-inner` 첫 실행은 private 진단 모듈 누락이었다. 입력/선행 작업을 준비한 동일 프로브 재실행은 각각 exit0이다. 옛 출력을 복사해 성공으로 채우지 않았다.
4. QR 최초 production 스모크는 `qr-bulk-smoke.mjs:211`에서 enabled 확인 후 click 사이에 selector가 사라져 exit1이었다([원로그](logs/regression-qr-bulk.log)). QA 동일 명령 재실행은 exit0이다. 이 최초 실패의 제품 원인을 확정하지 않았으며, 간헐적 테스트 실패 이력으로 남긴다.
5. 별도 보존 production-dist를 서빙한 QR 재검사에서는 검사기가 `repo/dist`의 QA 청크명을 읽어 다른 경로에404를 주입했고, :245의 navigation이90초 timeout이었다. [해시 경로 불일치](evidence/qr-recheck-path-mismatch.json). 이후 읽기 전용 mount 대조도30초 timeout으로 완료되지 않았다. 둘을 제품 회귀의 증거로 세지 않았다. 최종적으로 원래 위치에서 production을 다시 빌드하고 무수정 `npm run test:qr-bulk`를 실행해 **exit0/49.088초**를 확인했다([최종 로그](logs/stage7-qr-bulk-production-final.log)). 초기 실패를 삭제하거나 처음부터 전량 통과한 것으로 쓰지 않는다.

`test:new-tools`가 보고한 Dolby Vision base-layer streaming은 이 Chrome에서 호환 경로가 없어 해당 브라우저 분기를 건너뛰었다. capability unit과 fallback 안내 검사는 통과했다. 해당 하드웨어 경로까지 검증했다고 주장하지 않는다.

## 후속 게이트와 유지 방침

U4-5(F3 도장·서명)는 **R1복구·R2계측 누락·R3대비 위반과 성능 검증 잔여에 대한 Claude–Codex 정본화 → sol 구현/필요한 재검증 → astra 재검수 → Claude 잔여0 게이트 판정** 후 착수해야 한다. 이번 보고는 F3 착수 승인이 아니다. 현재 PDF route 잔여는3,361B로 작다. 계획의 가용 예산은 위5종 모두로 판단하고, 앞으로 생기는 복구/접근성 수정의 비용도 먼저 차감해 재측정해야 한다.

main `597a92ff…`와의 read-only 3-way 비교는 공통 수정 파일 `CHANGELOG.md`, `docs/review-notes.md`, `package.json`을 검출했다. textual conflict는 앞의 문서2개이고 package.json은 이 비교에서 자동 합성됐다. 실제 병합·index 수정은 하지 않았다([교집합](evidence/main-overlap.json), [merge-tree](evidence/main-merge-tree.log)). 이후 main 변경과 package scripts/patch hook의 의미 충돌은 실제 동기화 때 다시 확인해야 한다.

의존 패치는 6.2.108 exact-version/hash의 좁은4파일 수정을 유지한다. 향후 upstream 수정판을 검토할 때4빌드·LE/BE·180렌더·tail픽셀·5음성 빌드·worker/fallback·기존 소비처를 갱신 게이트로 삼고, API 호환성까지 확인한 별도 계획에서 패치/훅을 제거한다. 이번 검수에서 버전 갱신·외부 이슈 발송은 하지 않았다.

schema-v3는 옛 불완전 baseline을 거부하는 방향과 SHA/모듈 이동 계약이 타당하다. 장기적으로는 다음을 유지한다.

- 실제 배포 생성 단계와 계측의 파일 집합 동일성.
- 기준선 commit/lock/toolchain/환경 provenance와 기존 파일 SHA/gzip 대조.
- 예외 vendor/runtime 고정 목록의 변화 검토.
- URL 문법과 재귀 소유권의 합성 음성 주입.
- 모듈 합계와 독립 physical/network census의 교차 확인.

새로운 범위 변경은 양쪽 같은 범위로 재생성하고 기존 파일의 바이트 변동을 설명해야 한다. 실패한 구 기준선이나 무범위 비교를 대체 PASS로 감추지 않는다.


## 실제 실행 명령 표

아래 표는 최초 전체 검증과 필요한 보정 재실행을 구분한다. 상세 프로브의 명령·환경·시간·실패 로그는 위 단계별 JSON에 모두 남아 있다. 성공 로그에 나온 경고나 호스트 기능상 skip도 본문에 설명했다.

| 실행 | exit | 출력·해석 | 로그 |
|---|---:|---|---|
| `npm run build` | 0 | production 빌드·정적69페이지 | [build](logs/regression-build.log) |
| `npx tsc -b` | 0 | 타입 검사 통과 | [tsc](logs/regression-tsc.log) |
| `npm run test:unit` | 0 | 319/319 | [unit](logs/regression-unit.log) |
| `npm run test:static` | 0 | 정적 검증 통과 | [static](logs/regression-static.log) |
| `npm run test:pdf-finish` | 0 | 기능 + 골든160 통과 | [pdf-finish](logs/regression-pdf-finish.log) |
| `npm run test:browser` | 0 | 기본 스모크 통과 | [browser](logs/regression-browser.log) |
| `npm run test:new-tools` | 0 | 통과; 호환 불가 Dolby Vision 분기 skip 별기 | [new-tools](logs/regression-new-tools.log) |
| `npm run test:utilities` | 0 | 유틸리티 스모크 통과 | [utilities](logs/regression-utilities.log) |
| `npm run test:office` | 0 | Office 소비처 통과 | [office](logs/regression-office.log) |
| `npm run test:qr-bulk` | 1 | 최초 실패; 원인 미확정 간헐적 selector 실패 | [qr-bulk](logs/regression-qr-bulk.log) |
| `npm run test:qr-font-render` | 0 | 3 fixture 폰트 렌더 통과 | [qr-font-render](logs/regression-qr-font-render.log) |
| `npm run test:recovery` | 0 | 147사례 통과 | [recovery](logs/regression-recovery.log) |
| `npm run test:excel-cleaner` | 0 | 통과 | [excel-cleaner](logs/regression-excel-cleaner.log) |
| `npm run test:excel-compare` | 0 | 통과 | [excel-compare](logs/regression-excel-compare.log) |
| `TEST_SCOPE=pdf npm run test:browser` | 0 | 기존 PDF4모드 통과 | [browser-pdf](logs/regression-browser-pdf.log) |
| `npm run fixtures:pdf-legacy-oracle` | 0 | oracle totalDiffs0 | [legacy](logs/regression-legacy.log) |
| `npm run css:orphans` | 0 | orphan0 | [css](logs/regression-css.log) |
| `npm run legacy:manifest` | 0 | 155/153removed/0split/2active | [legacy-manifest](logs/regression-legacy-manifest.log) |
| `node tests/tool-registry-routes.mjs` | 0 | 도구20 | [registry](logs/regression-registry.log) |
| `LANG=ko_KR.UTF-8 npm run test:visual` | 0 | 211/211, 473.879초 | [visual-ko](logs/regression-visual-ko.log) |
| `LANG=en_US.UTF-8 npm run test:visual` | 0 | 211/211, 479.760초 | [visual-en](logs/regression-visual-en.log) |
| `npm run bundle:measure` (bundle-current) | 0 | 독립 v3 scoped 5종 통과 | [bundle-current](logs/stage2-bundle-current.log) |
| `npm run bundle:measure` (bundle-old-schema) | 1 | 기대한 schema2 거부 | [bundle-old-schema](logs/stage2-bundle-old-schema.log) |
| `npm run bundle:measure` (bundle-unscoped) | 1 | audio-studio 기준값 누락 실패, PASS 아님 | [bundle-unscoped](logs/stage2-bundle-unscoped.log) |
| `npm run test:pdf-watermark-performance` (performance-standard) | 0 | 표준 측정 명령 통과; 전체 구간 판정은 본문 참조 | [performance-standard](logs/stage2-performance-standard.log) |
| `npm run build` (build-qa) | 0 | QA 빌드 통과 | [build-qa](logs/stage2-build-qa.log) |
| `npm run test:a11y` (a11y) | 0 | 일반12페이지: violations0/F2 incomplete0/inherited925 | [a11y](logs/stage2-a11y.log) |
| `npm run test:rendering` (rendering) | 0 | 7페이지×3; CLS max0.00014804 | [rendering](logs/stage2-rendering.log) |
| `node probes/bundle-review.mjs (bwrap 입력 경로 매핑)` (original-bundle-probe) | 0 | 원본 probe 바이트 무수정; correctedPassed=true | [original-bundle-probe](logs/stage3-original-bundle-probe.log) |
| `npm run test:qr-bulk` (qr-bulk-recheck) | 0 | QA 동일 명령 재검증 통과 | [qr-bulk-recheck](logs/stage3-qr-bulk-recheck.log) |
| `npm run build` (build-production-final) | 0 | 최종 production 동일 위치 재빌드/스모크 통과 | [build-production-final](logs/stage7-build-production-final.log) |
| `npm run test:qr-bulk` (qr-bulk-production-final) | 0 | 최종 production 동일 위치 재빌드/스모크 통과 | [qr-bulk-production-final](logs/stage7-qr-bulk-production-final.log) |


## 저장소 불변과 산출물 확인

시작·종료의 HEAD/브랜치/status가 같고, **추적 파일2,621개 SHA-256 변화0**이다. 원본 저장소의 기존 미추적 항목도 status가 그대로다. 검증 사본2,621파일과 독립 S3 사본2,373파일은 각 최초 archive의 내용 SHA와 전부 일치한다. 빌드/진단을 위해 추적 소스에 손댄 것이 없다. [시작](evidence/start.json), [종료](evidence/end.json), [불변 판정](evidence/invariance.json), 재현 `python3 probes/final-invariance.py`.

`git diff --stat 5a9d5b7..e30018d`는12파일/232삽입/37삭제다. [변경 범위](evidence/scope-stat.txt), [diff](evidence/scope.diff), [diff-check](evidence/diff-check.log). 마지막 production 재빌드의 실행 자산142경로 SHA도 최초 production census와 모두 같다([최종 산출물 비교](evidence/final-production-equality.json)). 본 검수가 연 서버는 모두 종료했고, 기존4270 리스너는 그대로 두었다.

이 문서와 원시 로그·PDF·PNG·성능 곡선은 `/tmp/worklazy-u4-4-review4/`에 저장했다. 보고서 존재·비어 있지 않음·본문 링크 대상 검사는 `evidence/report-verification.json`에 기록한다. 저장소 수정·커밋·push·브랜치 전환은 없다.

**최종 판정: [수정 후 재검수].**
