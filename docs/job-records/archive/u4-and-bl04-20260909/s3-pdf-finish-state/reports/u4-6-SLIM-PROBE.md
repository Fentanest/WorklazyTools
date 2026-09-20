**U4-6 앱 용량 조사 — 측정·판정 보고 (2026-09-08, Codx)**

**권고: ③ 구조 변경 필요.** 현재 고정 상한으로 U4-8까지 마치려면 실제 PDF 실행 코드의 중복을 줄이는 방향을 먼저 탐색하는 것이 타당하다. 967B만의 해소는 **가능**하다. 이번 최선 조합 `verdict-and-static`은 후보 대비 **1,410B**를 줄여 app 증분 **81,477B**, 잔여 **443B**다. 다만 추가 정적 JSON **1,390B**까지 세면 JS+데이터 합계 감량은 **20B**뿐이다. 남은 F4b/F5의 계획 기반 추정은 **+3,411~10,188B**여서, 이 조합을 그대로 채택해도 **추정상 다시 2,968~9,745B 초과**한다. 상한 상향이 수학적으로 불가피하다는 증거는 없다. 단순한 route 분리나 lazy 전환으로 전체 합계 예산을 해결할 수 있다는 주장도 성립하지 않는다.

사용자 보고에 바로 쓸 수 있는 수치:

| 항목 | 수치 |
|---|---:|
| 기준선 앱 JS 절대값 | 5,843,715B |
| 현재 HEAD 앱 JS 절대값 / 기준선 대비 증분 | 5,917,822B / +74,107B |
| U4-6 원 후보 앱 JS 절대값 / 증분 | 5,926,602B / +82,887B |
| 증가 허용량 / 현재 절대 환산 한계 | +81,920B / 5,925,635B |
| 초과 | 967B |
| 967B ÷ 후보 앱 절대값 | **0.016316%** |
| 이번 단계 추가량 | 8,780B |
| 최선 조합의 앱 JS 절감 / 남는 여유 | 1,410B / 443B |
| 새 단계 예상: F4b / F5 | +2,691~8,388B / +720~1,800B |

**기준·재현성.** 브랜치 `s3-pdf-finish`, 기준 HEAD `79c20710b756d58d87fe2e0bdb9cc51782855c82`. `PROJECT_RULES.md` 전문을 첫 도구 호출로 읽고 `AGENTS.md`, 원 SCOPE-OUT/착수 지시서, 정본의 확정 5·11·27 및 최신 D4, review-notes의 기각 이력을 확인했다. 열린 계획서 중 같은 표면을 언급하는 8문서를 스캔했으며, 이번 무수정 조사와 충돌하는 실행 지시는 없다. 과거 구현 지시는 이번 사용자 지시의 측정 전용 범위로 대체된다. 근거: `evidence/open-plan-scan.json`, `source-references.json`.

원 후보는 저장소에서 되돌려져 소스가 없었다. 해당 U4-6 로컬 실행 기록의 성공한 패치 10개만 추출해 기준 HEAD의 `git archive` 사본에 재적용했다. 실패했던 패치와 이후 되돌림은 적용하지 않았다. 복원 후 **다섯 절대값, 모든 배포 파일 SHA, 모듈 귀속 메타데이터까지 원 `candidate-ui.json`과 일치**한다. 따라서 이후 비교는 임의 재구현과의 비교가 아니다. 근거: `evidence/candidate-source-calls.json`, `evidence/candidate-reproduction.json`, `candidate-sources/sha.json`.

사용 기준선은 schema-v3 `/tmp/worklazy-u4-4-review5/evidence/bundle-baseline.json`, SHA-256 `4caaa9c6c48df99dd740664d7991c995ffff7e8b6deaa7a1d87e982d302c30ea`. 모든 유효 탐색에서 entry 20,480 / PDF route 72,000 / shared 30,720 / app 81,920 / CSS 10,240B, override `{}`, multiplier 1을 그대로 사용했다. baseline JSON에 기록된 과거 route 한도 61,440B는 baseline 크기 자료이며 현 비교 한도는 지시된 72,000B다. 어느 파일도 상한을 고치지 않았다.

**8,780B의 구성 요소별 분해.** 정본 계측기의 `buildModuleContributions`를 사용했다. 각 모듈의 독립 rendered-gzip을 가중치로 삼아 실제 청크 gzip을 largest-remainder로 배분한 값이다. 아래 합계는 정확히 8,780B지만, 개별 행은 그 모듈을 삭제했을 때의 절감액과 같지 않다. gzip 사전·코드 축약·청크 경계를 공유하기 때문이다.

| 순위 / 구성 요소 | 이전 귀속 | 후보 귀속 | 증분 | 8,780B 중 비율 | 역할 |
|---|---:|---:|---:|---:|---|
| 1 `finish/preflight.ts` | 0 | 4,485 | **4,485** | 51.08% | OCG/OCMD 지원 문법, Type3 도달성, content lexer·graph 검사, ON/OFF·태그 변환 |
| 2 `finish/structure.ts` | 0 | 1,934 | **1,934** | 22.03% | 주석 subtype/양식/첨부/메타데이터 처리, 링크·카탈로그 루트, 페이지 참조 선할당 재구축 |
| 3 `PdfFinishPanel.tsx` | 8,508 | 9,171 | 663 | 7.55% | 옵션 상태·사전 고지·보존표·실행 연결 |
| 4 한글 `features.json` | 34,122 | 34,598 | 476 | 5.42% | 새 한국어 고지/표/옵션 문구 |
| 5 영어 `features.json` | 30,813 | 31,220 | 407 | 4.64% | 새 영어 고지/표/옵션 문구 |
| 6 `finish/engine.ts` | 4,552 | 4,767 | 215 | 2.45% | 구조 옵션·오류 연결 및 로딩 분기 |
| 같은 rendered 코드의 gzip 배분 변동 합계 | — | — | 600 | 6.83% | React·watermark·기존 shared 등. 실제 소스 추가라고 해석하면 안 됨 |
| **합계** | | | **8,780** | **100%** | |

상위 2모듈이 73.11%다. 변경된 rendered SHA는 위의 6모듈뿐이다. 청크 분류 기준 증분은 entry +1,254, PDF 전용 +7,512, shared +20, 기타 기존 청크의 해시/압축 변동 −6B이며 합계 +8,780B다. 다른 route를 고쳐 상쇄하지 않았다. 전체 모듈 목록은 `evidence/module-delta.json`에 있다.

기능별 경계는 별도 제거 실험으로 확인했다. 판별 호출만 제거하면 **2,639B**, 가시성/태그 변환 호출만 제거하면 **615B**가 줄었다. 전자는 OCG/Type3 제외 계약, 후자는 기본 가시성·태그 제거 계약을 깨므로 **기여도 확인용 음성 대조이며 채택 후보가 아니다**. 두 수치를 합하거나 4,485B에서 빼서 독립 모듈 크기로 해석할 수 없다. 공용 lexer·prepare/graph 코드와 압축 상호작용이 남는다.

**각 감량 안의 실제 탐색 빌드.** 절감 양수는 원 후보보다 작아짐, 음수는 커짐이다. 잔여 음수는 여전히 app 한도 초과다. 모든 안은 독립적으로 원 후보에서 시작했고, 조합은 조합 자체를 재빌드했다. 기능 완성·배포 승인 판정이 아닌 바이트 측정이다.

| 안 | app JS 절감(B) | 기준선 대비 app 증분(B) | app 잔여(B) | 대가·위험 |
|---|---:|---:|---:|---|
| 고지·보존표 UI + 한·영 문구 lazy 청크 (`lazy-ui`) | -932 | 83,819 | -1,899 | entry −1,036B, 옵션 진입 요청 +1. 분할 압축·로더 비용 증가; 첫 진입 대기와 실패 복구 필요. |
| 보존표 행을 import JSON 키 테이블로 (`json-table`) | -149 | 83,036 | -1,116 | 원래 번역 문구도 JSON이다. 행의 키 해석 코드가 추가됨; 키 누락·상태 선택 오류 위험. |
| lazy UI + 고지/표 번역을 정적 JSON fetch (`fetched-data`) | +145 | 82,742 | -822 | 추가 JS 청크 + JSON 요청. 필수 고지가 로드되기 전에 관련 옵션을 실행할 수 없어야 함. |
| UI 유지 + 고지/표 번역만 정적 JSON fetch (`inline-static-copy`) | +913 | 81,974 | -54 | 추가 JSON 요청 1개. 문구/로더 실패 상태, 언어 전환·캐시·배포 원자성 검증 필요. |
| 판별기 직접 import → 기존 index 재수출 참조 (`barrel-ref`) | +0 | 82,887 | -967 | 실제 참조 대상과 배포 바이트가 동일. 복제 제거 효과 없음. |
| 구조/판별기의 create/load를 공용 PDF facade로 (`shared-loader`) | -50 | 82,937 | -1,017 | 기존 워터마크·도장 로더를 실제 참조. 감쌀 호출만 바뀌고 재구축 알고리즘 중복은 없음. |
| 판별기의 반복 load를 PDFDocument 1개로 (`one-document`) | +22 | 82,865 | -945 | 검사 조건 유지. 파싱/메모리 개선 가능성은 있으나 이 잡에서는 바이트만 측정; 가변 문서 재사용 회귀 위험. |
| 내부 진단 문자열·객체 경로 간소화 (`compact-diagnostics`) | +384 | 82,503 | -583 | 허용/거부 조건 유지. 정밀 거부 사유·witness 경로 상실; 테스트 진단 계약 조정 필요. |
| 판별 결과를 최종 판정 중심으로 간소화 (`verdict-only`) | +543 | 82,344 | -424 | 조건은 유지하고 과거 라운드별 조건표·페이지 결과·witness 배열 구성 제거. 유지보수·진단 능력의 대가. |
| 진단 문자열 간소화 + lazy UI/정적 JSON (`compact-and-data`) | +586 | 82,301 | -381 | 조합값을 별도 실측. 각 단독 절감액의 합으로 계산하지 않음. |
| 진단 문자열 간소화 + UI 유지/정적 JSON (`compact-and-static`) | +1,231 | 81,656 | +264 | 내부 진단 정보 감소와 JSON 지연 로딩의 위험을 함께 부담. |
| 최종 판정 중심 간소화 + UI 유지/정적 JSON (`verdict-and-static`) | +1,410 | 81,477 | +443 | 기능 조건을 유지하는 조사 조합. 정밀 진단 축소·정적 문구 로딩 계약을 별도 구현/검증해야 함. |

정적 JSON은 **고지·보존표를 포함하는 structure 한·영 문구 전체**이며 3,127B, 독립 gzip **1,390B**다. JSON 키 테이블 안은 보존표 행만 옮겼다. 원래의 모든 문구·선택 결과를 그대로 유지했으며 문구 축약으로 얻은 절감이 아니다. 정적 JSON은 실행 JS가 아니므로 현 app 지표에는 들어가지 않는다. 따라서 최선 조합의 **JS+해당 JSON 합계 절감은 +20B**다. JSON을 뺀 JS 절감과 전체 전송량 절감을 혼동하지 않아야 한다. JSON 없이 코드만 바꾼 최선은 `verdict-only`의 **543B**다. 단순 lazy 분리는 entry에는 유리할 수 있어도 전체 app에는 추가 로딩 코드와 압축 단절 비용이 붙었다.

이번 탐색은 실제 브라우저 첫 진입 지연을 ms로 측정하지 않았다. 요청 수는 생성된 import/fetch 경계에 근거한다. 정적 파일/청크 실패 시 옵션 실행 차단, 고지 표시 전 실행 금지, 언어 전환·접근성·적절한 한/영 로딩 실패 문구는 제품 채택 시 검증할 비용이다. 이 probe의 간단한 실패 fallback을 최종 제품 문안으로 승인한 것이 아니다.

**판별기 재사용 판정.** `structure.ts`는 기존 `./preflight.ts`의 함수를 실제 import한다. 복사본을 만든 것이 아니다. 이전 HEAD의 535줄짜리 판별 모듈은 제품에서 live consumer가 없어 최종 main 번들에서 **0B로 tree-shake**되었고, 테스트 helper만 재수출하고 있었다. 후보에서 처음 제품 실행 참조가 생기며 기존 535줄과 새 변환 85줄, 합계 620줄이 포함됐다. `index.ts` 재수출 경유로 바꿔도 출력 바이트가 동일하고 절감 0B인 이유다. 반복 PDF 파싱은 존재하지만 코드 복제와는 다른 문제이며 1문서 재사용 탐색의 JS 절감은 22B에 그쳤다.

**재구축 재사용 판정.** 현 finish의 워터마크·도장 경로는 `loadDocument → analyzeDocument → decorateDocument → save`다. 문서 로더는 공유하지만 새 문서 페이지 복사는 하지 않는다. `watermark.ts`의 독립 content stream 삽입과 `stamp.ts`의 좌표/history를 F4a graph 복사의 중복이라고 볼 근거가 없다. 기존 organize worker의 `createPlannedPdf`는 `copyPages`를 쓰며 legacy 호환 계약상 현 동작을 유지해야 한다.

`PDFObjectCopier` 구현은 이전과 후보 모두 main 공용 `pdfFontEmbed` 청크에 **정확히 1개**, rendered 5,128B / 독립 rendered gzip 1,340B / SHA `6ec0873db8ed7a564761115247847597c888a9e6d9b88d650ef3079b00202e2b`로 동일하다. 이 1,340B는 이번에 추가된 중복도, 그대로 줄일 수 있는 값도 아니다. F4a의 새 비용은 허용 루트·ref 매핑·필터 orchestration에 있다.

기존 방식으로 새 문서의 `copyPages`만 호출하는 음성 대조(`copy-pages-negative`)는 **147B 절감**에 불과했다. 2페이지 named-destination fixture에서 원 후보는 Names·PageLabels·ViewerPreferences가 모두 true, 기존 API 대체는 모두 false다. 페이지 수 2만 같았다. 따라서 이 대체는 요구된 D4 보존을 깨며 채택 불가다. 근거: `logic-checks.json`의 `copyPages`, `probes/check-logic.mjs`. 새 문서 없이 delete만 하는 방식은 정본에서 orphan payload 잔존으로 이미 기각되어 재제안하지 않는다.

**앱 예산의 정확한 뜻.** `scripts/measure-bundle-budget.mjs:102` 이후 배포 디렉터리의 `.js`와 `.mjs` 파일을 재귀 수집하고, `:111` 이후 파일 SHA-256이 같은 복사본을 한 번만 세며, 파일별 `gzipSync` 크기를 더한다. `:248`의 `appJsGzip: sumGzip(jsRecords)`가 절대값이다. 전체를 하나로 연결해 gzip하는 방식이 아니다. main/entry, 모든 lazy route와 그 하위 lazy 청크, Worker와 배포된 모듈 자산을 포함한다. `vendor/**`·각 `runtime/**`는 명시 제외이고 JSON/폰트/이미지, HTML 내부 inline script, 원격 광고/분석 스크립트의 응답 크기도 이 파일 집계에 포함되지 않는다.

PDF route 지표는 route 그래프의 정적·동적 import를 모두 따라가고, 배포 Worker/URL 자산에도 소유권을 전파한 뒤 **owner가 오직 pdf-editor인 JS**만 합친다. shared는 owner가 여러 개인 코드와 owner를 찾지 못한 코드다. **shared도 모든 페이지가 받는 공통 코드와 동의어가 아니다.** entry 지표는 `index.html`의 entry 파일이다. 따라서 app 수치를 한 페이지의 초기 네트워크 다운로드로 설명하면 틀리며, PDF route 역시 공용 의존성을 모두 합한 실제 PDF 첫 로드 총량은 아니다.

비교기는 절대값이 아니라 기준선 대비 **증분**을 한도와 대조한다. `compareWithBaseline`의 app은 `compareModuleAttribution(...).appNet`이며 전체 앱 합계 차와 일치한다. shared는 모듈 귀속 이동을 제외한 net이다. 이번 후보 shared 절대 차 **512,387B** 중 **509,960B**는 분류 이동이고 순증분이 **2,427B**다. 이 큰 gross shared 증가를 새 코드 증가로 보고 app을 다시 더하면 중복 계산이다.

| gzip 지표 | baseline 절대값 | 현재 HEAD 절대값 | 원 후보 절대값 | 원 후보 예산 증분 / 한도 |
|---|---:|---:|---:|---:|
| entry | 299,277 | 308,155 | 309,409 | 10,132 / 20,480 |
| PDF 전용 route | 1,077,287 | 1,139,210 | 1,146,722 | 69,435 / 72,000 |
| shared | 863,384 | 1,375,751 | 1,375,771 | 순증분 2,427 / 30,720 |
| app 전체 JS | 5,843,715 | 5,917,822 | 5,926,602 | **82,887 / 81,920** |
| CSS | 37,687 | 38,080 | 38,087 | 400 / 10,240 |

baseline JSON의 `affectedRouteJsGzip=4,681,054`는 당시 전체 route 선택의 합계다. 위 PDF 기준점은 정확히 `perRouteJsGzip['pdf-editor']=1,077,287`을 사용했다. 967B는 baseline 절대값의 **0.016548%**, 현재 HEAD의 **0.016340%**, 후보 절대값의 **0.016316%**, 허용 증분 81,920B의 **1.180420%**, 이 단계 증분 8,780B의 **11.013667%**다. 서로 다른 분모를 섞지 않았다.

“PDF 화면 예산을 올렸으니 app도 자동으로 올려야 한다”는 논리는 성립하지 않는다. 두 지표는 겹치지만 별도 조건이고, route 증가에는 shared→route 이동도 포함될 수 있기 때문이다. 다만 이번 +8,780B는 실제 앱 순증분이고 app은 초기 공통 코드가 아닌 전체 합계이므로, **과거 작성량 추정이 부족했는지 앱 성장 정책을 재평가할 근거**는 된다. 그것이 상향의 자동 승인이나 이번 조사에서의 상한 변경은 아니다.

**U4-7/U4-8 전망 — 실측과 추정의 구분.** 정본 `pdf-finish-20260905.md:252~254`는 F4a/F4b 합계 production TS/TSX **700~1,100줄**, F4b는 “위와 분할”, F5는 **80~150줄**로 기록했다. F4b만 700~1,100줄이라고 인용하면 잘못이다. 현재 원 후보가 새로 쓰는 production TS/TSX는 preflight +85, structure +254, engine +16, panel +46 = **401줄**이다. 기존에 있었지만 처음 배포되는 판별기 535줄은 새 작성량에서 중복 차감하지 않는다.

잔여 배분을 가정하면 F4b는 **299~699줄**이다. 이는 정본에 확정된 독립 F4b 수치가 아니라, 합계 행에서 현 F4a 순증을 뺀 **조사용 배분 가정**이다. v13 보강 이후에도 원 줄수 계획이 현실적이라는 보장은 없으며 이 점이 추정의 주요 불확실성이다.

압축 밀도는 (a) F4a 실제 활성화 production 401+535=936줄에 app 8,780B → **9.38B/줄**, (b) U4-5 `89873f7 → 8ec3e4e` production TS/TSX 순증 457줄에 app 5,487B → **12.01B/줄**로 교차했다. 번역·연결 비용을 포함하는 앱 증분으로 보정해 **9~12 gzip B/줄** 범위를 사용한다. 줄 수를 gzip으로 정확히 환산할 수 있다는 주장이 아니다.

| 단계 | 정본/현재 소스에 근거한 새 production 예상 | 앱 추가 추정 | 이미 있는 재사용 기반 / 빠뜨리면 안 되는 비용 |
|---|---:|---:|---|
| U4-7 F4b | 299~699줄(배분 가정) | **2,691~8,388B** | PDF.js·pdf-lib·canvasPolicy 재사용. 150/200/300 DPI·포맷 UI, 최종 PDF raster, 경고 계수, 200MiB 등록 전 검사, OPFS/부분 결과·취소 연결 |
| U4-8 F5 | 80~150줄(정본 행) | **720~1,800B** | 파일 직렬 loop·C2/C3·ZIP 라이브러리는 이미 있음. 복합 실행 순서, 다중 파일 UI/결과·ZIP 연결·부분 성공 처리 |
| 합계 | 379~849줄 | **3,411~10,188B** | 새 PDF.js/ZIP/fontkit 전체 라이브러리를 또 더하는 추정은 하지 않음 |

복합 golden·legacy oracle·벤치·회귀 테스트 파일 자체의 app 기여는 **0B**다. F5의 위 수치는 제품 연결 코드에 대한 것이다. 현 UI는 단일 `file` 상태와 선택 탭 중심 실행이고 `analyzeDocument`의 stamp 분기도 일찍 반환하므로, F5 전체가 “테스트만 남음”이라는 해석은 맞지 않는다. 원 후보의 구조 출력 검증 연결도 완성 검증을 받지 않았으므로 이 계산은 완성 기능의 확정 상한이 아니다.

967B를 정확히 줄이면 여유가 0B이므로 다음 단계가 곧바로 다시 막힌다. 이번 최선 조합도 여유 443B에 그쳐 최소 전망 3,411B보다 작다. 원 후보 그대로의 앱 최종 증분 추정은 **86,298~93,075B**, 초과는 **4,378~11,155B**다. 현재 원 후보 PDF route 잔여도 **2,565B**뿐이라 새 PDF 전용 코드가 대부분인 F4b는 이 별도 게이트도 압박한다. 앱만 맞추었다고 PDF route까지 해결된 것은 아니다.

**근본 해법의 방향·예상 비용 — 의견이며 이번에 구현하지 않음.**

| 방향 | 예상 효과 | 예상 비용 / 위험 |
|---|---|---|
| finish를 별도 lazy route로 분리 | 초기 진입/소유권 격리에는 도움. **app 실제 합계 감량은 원칙적으로 0**, 청크 비용으로 증가 가능 | 대략 1~3인일 + route/한·영/SEO/직접 진입 회귀. 현 app 한도의 근본 해법으로 선택하지 않음 |
| preflight를 단일 문서·단일 traversal/공통 lexer 기반으로 재정리 | 실제 중복 절차를 줄일 여지. 현재 모듈 귀속 4,485B 전체가 상한이므로 수 KB 전망만 가능하며 아직 미실측 | 대략 2~4인일 + OCG/Type3 전 fixture·두 렌더러·큰 입력 응답성 검증. 다른 지원 문법인 watermark lexer와 단순 치환 금지; 다음 10KB까지 충분하다고 보장할 수 없음 |
| **PDF 생성 라이브러리의 main/legacy Worker 중복 배포를 동일 ESM 실행 자산으로 통일** | 현재 main의 `pdf-lib` 귀속 **118,977B**, legacy `pdf.worker` **219,622B** 안에도 `pdf-lib`가 별도 bundle됨. **순감량 목표 약 80~120KB**를 검토할 규모의 근거가 있음 | **설계·연결 3~6인일 + 회귀/계측 2~4인일(총 5~10인일)** 의견. Vite main/Worker 출력을 공유 자산으로 연결, 동적 초기화·오류·버전/SHA·캐시·동일 클래스 참조 점검 필요. legacy byte oracle·QR 공용 폰트·취소·5개 예산 모두 재검증 |

마지막 안의 80~120KB는 **실측 절감액이 아니라 중복 위치/규모에 근거한 탐색 목표**다. main의 118,977B는 모듈 배분치이며 Worker 내부 모듈은 현 schema에서 opaque이므로 이를 그대로 뺄 수 없다. 공유 asset은 계측되는 `.js/.mjs`로 남기고 모듈 귀속을 보존해야 하며, `vendor/runtime` 제외 경로 이동으로 숨기는 방식은 해법이 아니다. shared의 30,720B 및 PDF route 상한까지 통과하는지는 후속 탐색에서 판정해야 한다. 폰트 엔진을 Worker에 넣어 app +342KB가 된 기각안을 다시 제안하는 것도 아니다. **실행 realm은 유지하고 배포된 라이브러리 복사본을 합치는 방향**이다. 인일 범위는 1명의 숙련 구현자·기존 fixture 활용 가정의 의견이며 공정 견적이 아니다.

고정 상한에서 다음 두 단계까지 감당할 수 있는 실제 감량 규모를 찾는다는 목적에는 이 구조 조사가 맞다. ①만 권고하면 이번에 수백 B를 남긴 뒤 다음 단계에서 같은 중단을 반복한다. ②의 정책 변경은 비용 대비 선택지일 수 있지만, 실제 중복을 줄이는 대안이 있으므로 **불가피**하다고 단정할 수 없다.

**검증·증거와 한계.** `compact-diagnostics`: 109개 입력, 허용/거부 차이 0, 공개 reasonCode 차이 0, 상세 진단 결과 변화 27; `one-document`: 109개 입력, 허용/거부 차이 0, 공개 reasonCode 차이 0, 상세 진단 결과 변화 0; `verdict-only`: 109개 입력, 허용/거부 차이 0, 공개 reasonCode 차이 0, 상세 진단 결과 변화 104. 원판별기 대비 결과를 실제 109개 fixture 전체(정본 manifest 104개 + 기존 추가 fixture 5개)에서 비교했지만, 모든 PDF에 대한 의미 동등성 증명이나 제품 완성 검수는 아니다. 상세 진단의 변화는 의도된 대가로 기록했고 숨기지 않았다. `copyPages`의 보존 상실도 합성 2페이지 fixture로 재현했다. 검사 삭제 probe의 예산 exit 0을 기능 통과로 세지 않는다. 실제 파일 목록 대조는 `fixture-inventory.json`에 있다.

실행 명령은 `probes/run-probes.py`가 고정하며, 각 안마다 아래와 동등한 명령을 **직렬** 실행했다. 실제 원출력은 `evidence/<안>.log`, 측정값은 `<안>.json`, 변경한 사본의 입력은 `variants/<안>/`에 있다. `NODE_OPTIONS=--max-old-space-size=4096`, 모든 임시 파일은 이 작업 디렉터리. 서버는 실행하지 않아 포트 사용 0개다.

```bash
NODE_OPTIONS=--max-old-space-size=4096 TMPDIR=/tmp/worklazy-u4-6-slim \
 BUNDLE_SOURCE_ROOT=/tmp/worklazy-u4-6-slim/candidate \
 BUNDLE_ROUTES=pdf-editor \
 BUNDLE_BASELINE=/tmp/worklazy-u4-4-review5/evidence/bundle-baseline.json \
 BUNDLE_MEASURE_OUTPUT=/tmp/worklazy-u4-6-slim/evidence/<안>.json \
 node scripts/measure-bundle-budget.mjs

NODE_OPTIONS=--max-old-space-size=4096 node --experimental-transform-types \
 /tmp/worklazy-u4-6-slim/probes/check-logic.mjs
node /tmp/worklazy-u4-6-slim/probes/summarize.mjs
```

초기 archive 빌드는 git에 없는 video runtime 입력 부재로 정적 생성에 실패했다(`rebuilt-current.log`). 기존 고정 runtime을 읽기 입력으로 연결한 뒤 다시 측정했다. 초기 개별 package symlink 구성은 절대 코드/파일 해시는 같지만 canonical 모듈 ID가 달라 shared가 잘못 귀속됐다(`rebuilt-candidate.log`, 510,323B). 의존성을 `/tmp`로 복사해 정규 realpath를 맞춘 **`candidate-control`은 원 모듈 메타데이터까지 일치**하고 shared 2,427B다. 앞의 두 불완전 실행을 정상 예산 결과로 쓰지 않았다. hardlink 복사는 파일시스템 경계에서 불가하여 일반 복사를 사용했다. 의존·vendor·생성물 소스를 손으로 수정하지 않았다.

유효 탐색 전체의 다섯 증분(바이트):

| 실험 ID | entry | PDF route | shared net | app | CSS | 계측 exit |
|---|---:|---:|---:|---:|---:|---:|
| candidate-control | 10,132 | 69,435 | 2,427 | 82,887 | 400 | 1 |
| lazy-ui | 9,096 | 71,399 | 2,421 | 83,819 | 400 | 1 |
| json-table | 10,120 | 69,486 | 2,484 | 83,036 | 400 | 1 |
| fetched-data | 9,102 | 70,250 | 2,472 | 82,742 | 400 | 1 |
| barrel-ref | 10,132 | 69,435 | 2,427 | 82,887 | 400 | 1 |
| shared-loader | 10,120 | 69,448 | 2,450 | 82,937 | 400 | 1 |
| compact-diagnostics | 10,119 | 69,002 | 2,454 | 82,503 | 400 | 1 |
| one-document | 10,101 | 69,384 | 2,455 | 82,865 | 400 | 1 |
| copy-pages-negative | 10,112 | 69,251 | 2,448 | 82,740 | 400 | 1 |
| ablate-classifier | 10,132 | 66,724 | 2,468 | 80,248 | 400 | 0 |
| ablate-transform | 10,110 | 68,817 | 2,442 | 82,272 | 400 | 1 |
| compact-and-data | 9,115 | 69,829 | 2,439 | 82,301 | 400 | 1 |
| inline-static-copy | 9,102 | 69,587 | 2,403 | 81,974 | 400 | 1 |
| compact-and-static | 9,122 | 69,162 | 2,456 | 81,656 | 400 | 0 |
| verdict-only | 10,131 | 68,833 | 2,453 | 82,344 | 400 | 1 |
| verdict-and-static | 9,119 | 68,999 | 2,458 | 81,477 | 400 | 0 |

모든 유효 보고서에서 배포 `.js/.mjs` inventory 누락 0, 모듈 배분 합계 = app 절대값, 상한/override/multiplier 불변을 재확인했다(`results.json`). `head-control.json`은 현재 HEAD 재빌드 대조다. 이 조사는 제품 구현이 아니므로 full unit/browser/visual/a11y, 골든 렌더 전체, 성능 benchmark, npm prebuild/vendor 갱신을 실행하지 않았고 통과라고 쓰지 않는다. 탐색 계측기는 production Vite와 정적 페이지 생성까지 실제 실행했다. 향후 구현 채택 시 정본 골든④·간접 객체/링크/두 렌더러, 한·영 UI·접근성·응답성, legacy 및 5종 예산 게이트가 그대로 남는다.

**저장소 불변.** 시작/종료 status: `evidence/start-status.txt`, `end-status.txt`. HEAD/브랜치 동일: True/True. 추적 파일 SHA 대상 2634개, 변경 0개; status 동일 True; 외부 입력 SHA 변경 0개. 시작부터 있던 `CLAUDE.md`·`PROJECT_RULES.md` 변경 및 미추적 DOCX 2개/네이버 HTML/`newui/`의 상태를 유지했다. 사용자 파일 내용이나 금지된 다른 worktree를 열지 않았다. 추적 파일 수정·커밋·push·브랜치 전환 0회. 기록은 사용자 지시대로 이 REPORT에만 두며 저장소의 CHANGELOG/review-notes/계획서는 편집하지 않았다.

— Codx
