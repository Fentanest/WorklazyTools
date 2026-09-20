U4 PDF 마무리 v5 — Codex astra 4차 반박 (Codx, 2026-09-06)

**판정: [재왕복 필요]. 잔여 이견 7건 = 기존 D1·D3·D4·D5 4건 + 신규 N1·N2·N3 3건. Claude–Codex 간 이견 0에 도달하지 않았다.**

**D5의 수치 가설은 성립한다.** `/tmp` 복제본의 측정기에 모듈 귀속 비교를 실제 연결하고 **3차 E6 산출물 자체**를 다시 읽었다. 아래는 청크의 실제 gzip 크기를 보존하면서, 독립적으로 gzip한 rendered module code 크기를 가중치로 배분하는 **이번 라운드의 명시적 계산식**을 적용한 값이다. 원래 5종 상한과 기준점은 변경하지 않았다.

| E6 설계 | entry Δ B | PDF route Δ/순증분 B | shared 총 Δ B | QR→shared 이동 B | shared 순증분 B | app 순증분 B | CSS Δ B | 실험 게이트 |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| lazy-fontkit | +3 | +12,994 | +507,347 | 507,267 | **+80** | **+13,264** | 0 | PASS |
| integrated-fontkit | +22 | +13,718 | +507,357 | 507,267 | **+90** | **+14,029** | 0 | PASS |

다만 **v5에 계산식·측정 자료 수집/스키마·실행 realm이 고정돼 있지 않다.** `renderedLength`를 가중치로 쓰면 shared는 +20/+30B다. gzip 기여도는 모듈의 유일한 고유값이 아니다. 따라서 “숫자가 통과했으니 정본화 가능”이라고 결론내리지 않는다. D5를 **“예산 해법 미발견”에서 “성립하는 해법을 실증했으나 계산·구성 계약 채택 필요”로 좁힌다.** 실제 U4 제품 코드의 최종 게이트 통과를 뜻하지도 않는다.

**범위와 실행 게이트**

- 첫 명령은 `cat PROJECT_RULES.md`. 이어 AGENTS, 지정 dispatch 전문, PDF 계획 전문 및 v5 우선 절, 상위 roadmap §2·§3 S3·결정 10/11, 3차 REPORT 전문, 관련 review-notes(번들 귀속·QR 폰트 기각), 열린 계획 목록을 읽었다.
- 시작 HEAD·origin/main은 모두 `1a04f2571109495a76b8468af95b2f4edcd862cf`, 브랜치는 main. AGENTS.md·CLAUDE.md는 알려진 Claude 변경. 사용자 미추적 `before.docx`·`after.docx`·네이버 인증 HTML도 보존했다.
- 열린 계획은 16개. `qr-font-20260906.md`는 QR 전송 폰트만 대상으로 하고 U4 전체 OTF 보존을 명시한다. 이번 읽기/실험과 충돌하는 실행 지시는 없었다. 이후 실제 U4 착수 시 S2b 병합·기준 HEAD·폰트 descriptor 변경을 다시 대조해야 한다. 과거 P2/B5a 문구는 완료된 선행 범위이며 최신 S3·v5가 우선이다. 검색 원문 `logs/open-plan-scan.txt`, 관련 직접 읽기 `logs/source-evidence.log`.
- 기존 r4 디렉터리에 초기 snapshot/불완전 파일만 있었고, 판정 산출물은 재사용하지 않았다. 이번 시작 상태를 새로 채취했다. 유효한 3차 E1~E13 산출물은 지시대로 재사용했다.
- 쓰기는 `/tmp/worklazy-u4-r4/`만 사용했다. 원본 저장소 파일·계획서·dist·3차 산출물은 수정하지 않았다. 설치·커밋·push·배포·원본의 build/prebuild/generator 실행 없음. 기존 node_modules는 읽기 symlink로 사용했다.
- 반박용 코드 작성은 이번 사용자 지시의 실험 범위다. 제품 구현/sol 디스패치/정본 편집은 수행하지 않았다. 저장소 기록 금지 지시에 따라 판정 기록도 이 REPORT에만 남긴다.

**실행 증거 색인**

모든 새 산출물은 `/tmp/worklazy-u4-r4/` 아래. 특별한 표시가 없으면 실행 cwd는 원본 저장소 루트다. 각 스크립트가 생성하는 파일 경로는 `/tmp`로 고정했다.

| ID | 실제 실행 명령 | 결과·원자료 |
|---|---|---|
| E4-1 | `NODE_OPTIONS=--max-old-space-size=4096 node /tmp/worklazy-u4-r4/probes/capture-builds.mjs` | exit 0. baseline/lazy-fontkit/integrated-fontkit **3개 production 탐색 재빌드**. 각 파일명·SHA·5지표가 E6와 동일, 추가/불일치 0. `logs/capture-builds.log`, `capture-*.json` |
| E4-2 | `node /tmp/worklazy-u4-r4/probes/measure-modules.mjs` | exit 0. E6 renderedLength 비교 + E4-1 rendered gzip 가중치 비교, 귀속 unit **12개 성공**. `logs/module-measure.log`, `module-summary.json`, `attribution-*.json` |
| E4-3 | `node /tmp/worklazy-u4-r4/probes/meter-integration.mjs` | exit 0. **복제본 `scripts/measure-bundle-budget.mjs`의 `measureOutput`·`compareWithBaseline` 호출로 E6 디렉터리 재측정**. baseline 및 두 안 PASS. 5종 상한/상한+1 **10검사**, 양쪽 잘못된 수치 **60거부**. `logs/meter-integration.log`, `meter-integration.json` |
| E4-4 | `node /tmp/worklazy-u4-r4/probes/pdf-contracts.mjs` | 최종 exit 0. catalog/link/form/orphan/metadata/토큰/좌표/glyph probe. `logs/pdf-contracts.log`, `pdf-contracts.json`, `pdf/*.pdf`. 첫 시도는 flatten 후 dangling ref를 정상 dict로 읽어 TypeError, 실제 node exit 1; `logs/pdf-contracts-attempt1.log` 보존. 누락 ref를 측정하도록 고친 뒤 재실행 |
| E4-5 | `node /tmp/worklazy-u4-r4/probes/memory.mjs` | exit 0. Chrome 152의 실제 page/worker/canvas 계측 + 모바일 viewport 대조. `logs/memory.log`, `memory.json` |
| E4-6 | `node /tmp/worklazy-u4-r4/probes/r2.mjs` | exit 0. R2 2종 결정적 생성/암호 4입력씩/PDF.js 검증. `logs/r2.log`, `r2.json`, `pdf/r2-*.pdf` |
| E4-7 | `node /tmp/worklazy-u4-r4/probes/r6.mjs` | exit 0. 3차 생성기에서 출력 디렉터리만 r4로 바꿔 재실행. R6 2종·PDF.js·pdf-lib 거부·Poppler 성공. `logs/r6.log`, `r6/*.pdf` |
| E4-8 | `pdfinfo -upw '' /tmp/worklazy-u4-r4/pdf/r2-restricted.pdf` 및 `pdftotext -upw '' /tmp/worklazy-u4-r4/pdf/r2-restricted.pdf -` | 각각 exit 0. RC4/본문 교차. `logs/r2-poppler.log` |
| E4-9 | `node --test --experimental-strip-types tests/unit/bundle-budget.test.ts tests/unit/visual-clock.test.ts tests/unit/visual-config.test.ts` | exit 0, **현행 unit 21/21**. `logs/current-unit.log`. 수정된 제품의 전체 unit이라고 쓰지 않음 |
| E4-10 | `source-evidence.json`의 12개 명령 | 전부 exit 0. 설치된 pdf-lib API/구현·PDF 클라이언트·clock·계획 문안의 파일/줄 증거. `logs/source-evidence.log` |
| E4-11 | `python3 /tmp/worklazy-u4-r4/probes/verify-unchanged.py` | 종료 불변 증명. 아래 종료 절 및 `unchanged.json`, `logs/unchanged.log` |

이번 보고서에서 build는 **새 instrumentation을 추가한 Vite API 탐색 빌드**를 가리킨다. 아직 없는 finish 구현에 대해 npm build·전체 unit·browser/static/9게이트를 통과했다고 주장하지 않는다. 원본에서 build를 실행하지 말라는 금지와도 구분한다.

**D1~D8 항목별 판정**

| ID | 판정 | 실측·잔여 사항 | 정본 반영 문안 후보 |
|---|---|---|---|
| D1 암호 fixture | **[부분 해소·이견 1]** | R6를 Node로 생성하고 qpdf를 없애는 결정은 재확인. 다만 v5 공통 oracle의 `restricted → permissions []`는 기존 R2 oracle에 맞지 않는다. E4-6 R2 `/P=-64`는 **[256,512,1024,2048]**, E4-7 R6 `/P=-3904`는 **[]**. 둘 다 현행 `inspectPdf`의 `permissions !== null`로 편집 거부된다. `[]`를 R6에만 적용한다고 읽을지, R2 생성 값을 바꿀지 sol이 결정하면 안 됨 | 세대별 4행 표로 파일의 R/V/P·비밀번호 입력·기대 permissions·해시를 고정한다. 기존 oracle 유지 후보: R2 restricted는 위 4원소, R6 restricted는 []. 제품 거부 단언은 배열 길이가 아니라 `!== null`. 아래 표 참조 |
| D2 토큰 산식 | **[동의·해소]** | E4-4: startPage=4/startNumber=5/표지 제외/4·6→**5·7**. 표지 제외만 켠 3쪽→2:1,3:2. startPage가 전체쪽 초과→선택 없음. 산식이 3차의 세 갈래를 해소한다. 별도의 썸네일 동기화 공백은 N1로만 집계 | v5 산식 유지. p<anchor는 출력 대상 아님을 명시하고 빈 결과를 빈 PDF로 만들지 않음. 선택 UI 상태 의미는 N1에서 고정 |
| D3 F4b | **[부분 해소·이견 1]** | A/B 구분 및 300DPI 포맷 기준은 개선. 그러나 `performance.memory`/`deviceMemory`가 탭의 총 자원 한계를 제공한다는 절차는 성립하지 않는다. E4-5에서 64MiB worker 버퍼 추가가 page 지표에는 약 24KB만 증가. canvas 16MiB도 해당 지표에 잡히지 않는다. 기기 2개의 300DPI 셀 집계·반복·품질·출력 사전 추정·누적 결과 저장 정책도 미고정 | 아래 지표별 계측 표와 결정 순서 채택 필요. 실기기 명세/측정 가능 여부와 별개로 API 값을 “기기 한계”로 바로 나누지 않음. 기기 자료가 없으면 교정 불가로 보고하고 임의 기본값을 확정하지 않음 |
| D4 재구축 | **[부분 해소·이견 1]** | 필수 구조 목록·3종 링크 구분은 맞음. **표를 U4-0에서 채우라**는 것은 지원 범위 결정을 sol에게 넘긴다. E4-4: named link 소실뿐 아니라 직접 Dest가 실제 2쪽 대신 PDF.js index 0을 가리킴, Widget는 남으나 form fields 0, 기본 새 문서 Info 자동 생성, flatten의 dangling Widget ref 확인 | 아래 구조별 초안을 구현 전에 채택/수정해 확정. 제거 옵션별 선택성·복사 전 필터·페이지 ref 매핑·unsupported 처리·최종 검사를 명시. API 존재를 의미 보존으로 간주하지 않음 |
| D5 모듈 귀속 | **[수치 가설 확인·이견 1]** | E4-1~3에서 lazy +80 shared/+13,264 app, integrated +90/+14,029. 계산식 후보로 통과. 다만 module gzip의 비가산성·수집/스키마·중복/realm·원래 route 게이트 의미·실제 finish 폰트 실행 위치는 아직 v5로 결정되지 않음 | 아래 D5 계약 후보를 채택하고 fontkit/main·worker 경계까지 고정. 현행 상한 모두 유지. 측정기 수정만으로 실제 worker 중복을 감량했다고 쓰지 않음 |
| D6 clock unit | **[동의·해소]** | E4-9 현행 관련 unit 통과. config+양쪽 unit 갱신과 메인에서 1회 날짜/locale 캡처→worker 전달이면 기존 실패 원인 해소. v5의 줄번호 일부는 파일을 혼동하지만 두 파일을 모두 명시하므로 실행 선택의 이견은 아님 | 파일의 현재 assertion 이름을 기준으로 갱신. `visual-clock.test.ts:47~70`에 3도구/9scenario/21·72capture, `visual-config.test.ts`에 175/79/620 등의 고정 단언. runtime 하네스는 무변경. pdf-editor의 기존 상태도 tool 단위 고정됨 |
| D7 포인터 좌표 | **[동의·해소]** | E4-4의 CSS viewport 방식은 **16/16** 일치. DPR을 bitmap transform에 따로 적용하는 현행 코드와 맞음. 이 변환이 혼합 종횡비에서 이미지 비율까지 보존하는 것은 아니며 N2에서 분리 집계 | `u=(clientX-left)/rect.width`, `v=(clientY-top)/rect.height`, 입력점은 `(u*viewport.width,v*viewport.height)`. 여기서 viewport는 CSS scale로 만든 동일 객체. 저장/대상 복제 규칙은 N2 |
| D8 사실 오기 | **[동의·해소]** | E4-4 Résumé € Helvetica 성공, Русский Noto 성공, Greek 누락 **ή U+03AE(942)**. 3차 E5 multiline operator 증거 재대조. 200DPI 1654×2339 정정 타당. 별도 새 다중 행 glyph 순서 결함은 N3 | v5 정정 유지. newline/폭 줄바꿈과 자체 6영역 정렬·overflow 책임을 구분 |

D1의 권고 oracle은 다음과 같다. 아래 bytes는 이번 생성기의 결과이며 다른 생성기에 그대로 기대 크기로 강제하지 않는다. R2는 Node crypto MD5와 스크립트의 RC4 루프, R6는 3차 Node crypto 생성기를 썼다. 외부 생성 프로그램/패키지 설치는 없다.

| 파일 유형 | PDF.js 무암호/빈 암호 | 오답 | 정답·owner | permissions | finish 편집 |
|---|---|---|---|---|---|
| R2 open, P=-4 | PasswordException 1 | code 2 | OPEN | [4,8,16,32,256,512,1024,2048] | 거부 |
| R2 restricted, P=-64 | OPEN | code 2 | OPEN | [256,512,1024,2048] | 거부 |
| R6 open, P=-4 | PasswordException 1 | code 2 | OPEN | [4,8,16,32,256,512,1024,2048] | 거부 |
| R6 restricted, P=-3904 | OPEN | code 2 | OPEN | [] | 거부 |

“무암호→code 1”은 **암호화된 open fixture를 암호 없이 여는 경우**다. 암호화되지 않은 일반 PDF가 code 1이라는 뜻으로 쓰지 않는다. R6 1,361/1,380B·AES-256·Poppler 본문은 3차와 동일했다.

**D5 구현·수식·한계**

실제 실험 구현은 `project/scripts/module-attribution.mjs`와 복제본 `project/scripts/measure-bundle-budget.mjs`. 후자는 `measureOutput(..., moduleChunks)`가 수집 데이터를 report에 넣고, `compareAttribution()`가 모듈 비교를 호출하며, `compareWithBaseline()`가 gross를 별도 보존한 다음 shared/app 순증분으로 판정한다. 원본 파일은 읽기만 했다. `meter-integration.mjs`는 이 두 함수를 통해 **r3/builds/**를 직접 재측정했다.

E6 JSON은 main chunk별 `{id, renderedLength}`만 저장했고 module code/gzip은 저장하지 않았다. Vite manifest 자체에도 모듈별 rendered code가 없다. 따라서 같은 source·config를 `/tmp/worklazy-u4-r4/project`에서 빌드하고 Rollup `generateBundle`의 `chunk.modules[id].code`로 `renderedGzip`·SHA를 수집했다. **측정 계측을 넣은 세 빌드가 E6와 모든 파일 SHA 및 5지표에서 동일**함을 단언한 뒤에만 자료를 연결했다. module code를 못 얻은 양수 길이 모듈은 0건이었다. 기존 vm-browserify eval/큰 청크 경고는 로그에 그대로 남았다.

**계산식 후보(승인된 정본이 아니라, 이번 수치를 재현하는 명시적 사양)**

1. 실제 파일의 압축 크기 `G_c = gzipSync(final chunk bytes).length`와 기존 SHA 중복 제거·소유 route 판정을 유지한다. 예산의 실제 전체 app 크기를 모듈별 gzip 합으로 교체하지 않는다.
2. 모듈 가중치 `w_m = gzipSync(rendered module code).length`, 빈 rendered module은 0. 청크 내 기여 `g_cm = G_c*w_m/sum(w)`를 내림한 뒤 **나머지가 큰 순·동률 canonical id 사전순**으로 1B씩 배분한다. 정수 연산/BigInt로 `sum(g_cm)=G_c`를 단언한다. import/export wrapper·minify·청크 간 압축 효과는 이 배분 규칙에 포함되는 회계상의 배분이다. 원래 압축 바이트의 정확한 “소유 모듈”을 알아낸 것이 아니다.
3. canonical id는 source root와 node_modules realpath root를 상대화하되 패키지 경로·virtual prefix·query를 보존한다. **서로 다른 realm/main/worker의 같은 라이브러리를 같은 사본으로 보지 않는다.** 동일 id의 이전 기여는 같은 category 잔존분부터 대조하고, 남은 양을 다른 category로 이동시킨다. 각 이전 바이트는 한 번만 쓸 수 있다. 동일 모듈이 기존 route에도 남고 새 shared 사본이 생겼다면 새 사본은 증가다.
4. 이동 `T`는 위 규칙으로 기존 잔여/현재 필요의 `min`만 배정한다. category 순증분 = 총 Δ − 유입 이동 + 유출 이동. 모든 category 순증분 합 = 실제 app Δ. **app에는 이동량을 다시 빼지 않는다.** app는 본래 이동에 불변이다. 삭제/감량은 음수 그대로 기록한다. 신규/증가 양수 합과 삭제 음수 합을 보여줄 수 있지만 순증분과 혼동하지 않는다.
5. **v5 그대로** shared/app만 이 순증분 게이트로 전환하고 entry·선택 route·CSS는 원래 총 Δ로 판정한다. 동시에 모든 route의 gross/movement/net을 기록한다. route까지 이동 보정 게이트로 바꾸려면 그것은 별도 계약 결정이다. 이번 PDF route에는 이동이 없어 gross=net.
6. 예산은 entry **20,480**·선택 route **61,440**·shared **30,720**·app **81,920**·CSS **10,240B**, multiplier=1, override={} 유지. `신규 +1B 실패`는 **해당 상한까지 도달한 상태에서 +1B**를 뜻한다. 아무 증가가 없는 baseline에 1B를 더하면 당연히 통과해야 한다.
7. main module metadata가 없는 old schema를 0으로 취급하거나 SHA 방식으로 조용히 폴백하지 않는다. 분기점과 current를 같은 계측 플러그인/의존 버전/압축 설정으로 재측정하고 schema를 버전 고정한다. 원래 기준 HEAD를 새 HEAD로 리셋하지 않는다. 신규 route의 baseline=0, 기존 route 수치 누락 거부, 유한 정수 검사를 보존한다.
8. **이번 prototype의 명시적 범위**: E6에는 worker/public JS 22파일의 module metadata가 없다. main은 모듈 비교, worker/public은 기존 SHA로만 식별하는 opaque contribution이다. worker가 바뀌면 실제 전체 증감을 세고, 모듈 이동 공제는 하지 않는다. 따라서 데이터 부재가 거짓 통과를 만들지 않는다. 운영 측정기에서 이를 유지할지, `worker.plugins`로 worker별 realm id를 수집할지 정본에서 고정해야 한다. prototype root 정규화는 r3/r4/repo 경로의 명시 매핑이며 일반 배포용 구현 완성본이 아니다.

실제 main shared fontkit 청크는 **507,328B gzip**, 모듈들을 독립적으로 gzip한 값의 합은 **723,984B**다. 작은 gzip 반례도 합 78B, 합쳐서 gzip 53B였다(E4-3). 따라서 “manifest/modules의 rendered gzip 기여”라는 문구만으로 sol이 더하기/가중배분/길이배분 중 하나를 고를 수 없다.

| 계산식 비교 | lazy shared net | integrated shared net | QR→shared 이동 | 평가 |
|---|---:|---:|---:|---|
| renderedLength 가중치 | 20B | 30B | 507,327B | E6 저장 자료만으로 가능. 길이 비례 **추정 배분**, gzip 기여라고 단독 표현하면 부정확 |
| 독립 rendered gzip 가중치 | **80B** | **90B** | **507,267B** | 계측 재빌드 필요. 이번 권고 후보. 여전히 회계 배분이나 실제 청크 합 보존 |

QR route는 gross **−507,103/−507,107B**, 순증분 **+164/+160B**다. 이동이 QR 쪽 음수에 나타나는 사실도 숨기지 않았다. 172개 모듈 이동을 기록했다. 새 shared 최종 귀속 크기 **3,223,836/3,223,846B**도 그대로 report에 유지한다.

**구성상의 미해결점도 D5 한 건에 포함한다.** 두 PASS 안의 fontkit와 PDFDocument는 **메인 스레드의 합성 PdfFinishPanel**에서 사용했다. v5는 아직 실제 finish engine을 어디서 실행하고, lifecycle 취소와 어떻게 합치는지 고정하지 않았다. 현행 pdf.worker에 fontkit를 넣은 3차 E7을 길이배분으로 다시 검사해도 **shared +329,507/app +342,364B, FAIL**이다. 기존 QR fontkit가 남고 worker 복제가 늘기 때문이다. 그 반례는 새 측정기로 사라지지 않는다. U4-2의 worker 이관과 U4-3 이후 엔진이 이 PASS 그래프를 쓰는지를 확정해야 한다. 메인 스레드안은 synchronous embed/save 중 취소·응답성 계약, worker안은 중복/공유 산출물 계약을 증명해야 한다. 현재 합성 build만으로 그 둘까지 해결했다고 주장하지 않는다.

최종 U4 문구·CSS·UI 의존·실제 엔진의 전체 비용은 이 3,002줄 합성 표본 밖이다. 따라서 이 숫자는 **해법 실현 가능성**의 증거이고 완성품 예산 보장은 아니다.

**D3: A/B를 실제 측정할 수 있는 계약으로 만드는 방법**

E4-5 환경은 Chrome/152.0.7977.64, precise-memory-info, desktop host. 두번째 실행은 viewport 412px/mobile/touch/DPR2를 바꾼 **모바일 에뮬레이션**이다. 실기기 benchmark가 아니다.

| 직접 관찰 | page performance.memory used | CDP Runtime usedSize | 의미 |
|---|---:|---:|---|
| 빈 page | 1,069,922B | 1,092,384B | 서로도 같은 계측 범위가 아님 |
| page Uint8Array 32MiB 후 | 34,648,781B | 1,094,944B | CDP `backingStorageSize`가 별도로 33,554,449B. 같은 이름의 heap 숫자를 섞으면 누락/중복 |
| 2048² canvas 채움 후 | 34,774,679B | 1,220,820B | raw RGBA 16,777,216B가 page JS heap 증가로 나타나지 않음 |
| worker Uint8Array 64MiB 후 | 34,799,310B | 1,245,140B | page 측 증가는 24,631B뿐. worker는 67,108,864B 보유를 응답했으나 worker `performance.memory`는 undefined |

desktop/mobile 에뮬레이션 모두 `jsHeapSizeLimit=4,395,630,592B`, `navigator.deviceMemory=16`. `crossOriginIsolated=false`, `measureUserAgentSpecificMemory`는 undefined였다. 이것으로 탭 전체의 50% 안전 한계나 실 모바일 한계를 구할 수 없다. 특히 현재 Excel benchmark의 page CDP `JSHeapUsedSize`만 복사해 “PDF 전체 peak”라 쓰면 worker/bitmap/출력 보유를 놓친다.

| A/B 지표 | 고정해야 할 계측 방법 | 사용 범위·주의 |
|---|---|---|
| A width/height/maxSide | 선택 페이지마다 PDF.js viewport(scale=DPI/72, rotation/UserUnit 포함), `ceil(width)`, `ceil(height)`를 계산. 생성 직전 같은 정책 재실행 | finite/양수·정수 범위 검사. preview DPR과 출력 DPI를 혼용하지 않음. geometry 전체 preflight 후 실제 할당 직전 재검사 |
| A area | 페이지별 `w*h` | `maxSide`, `maxArea`를 둘 다 검사. 8쪽 누적 17.4M은 개별 캔버스 위반 아님 |
| B 누적 pixels | 해당 출력 **실제 선택 페이지**들의 ceil 면적 합. 문서별 값과 배치 합을 별도 기록 | 처리 작업량 지표. 직렬 처리 시 peak 메모리와 같지 않음 |
| B raw RGBA | 페이지 raw=`4*w*h`, 누적 raw=sum, 별도로 동시 살아있는 canvas/bitmap의 장수·합계 ledger | 누적 raw를 peak heap으로 쓰지 않음. input buffers/encoded images/폰트/source+output PDF/미리보기/retained results를 별도로 관리 |
| B 최종 PDF bytes | `save()` 반환 Uint8Array.byteLength, Blob.size를 검산. 중간 PNG/JPEG도 별도 기록 | bytes/입력·페이지·pixel 비율을 기록. 실행 전 경고에 쓰려면 fixture 유형별 보수 추정식·불명 유형 처리·추정 오차를 정해야 함. 결과 저장 후 실제 크기로 경고하는 것은 사전 경고 대체가 아님 |
| B peak JS·backing storage | main 및 **실제로 쓰는 각 worker**를 별도 attach해 동일 시각 표본을 수집. 예: 50ms 주기 + load/render/encode/embed/save/retain/release 경계. `usedSize`, `backingStorageSize`, page API를 구분 | 관측 peak라고 이름 붙임. polling 사이 peak는 놓칠 수 있으므로 계측 ledger/단계 스냅샷 필요. page performance.memory와 CDP backing을 중복 더하지 않음 |
| B native/renderer/canvas | 실기기 OS/browser 계측이 가능하면 renderer 프로세스 계측과 GPU/bitmap 범위를 명시, 불가능하면 미측정 표시 + 보수 raw ledger | JS heap나 `deviceMemory`를 이 값의 대리 한계로 선언하지 않음. 실기기 없이 모바일 한계 확정 금지 |
| 시간 | file read 시작~final save/검증 완료의 wall time과 단계별 time, 자원 정리 완료 별도 | 워밍업·cold cache/font fetch 포함 여부·기기·브라우저·반복/집계를 동일하게 고정 |

**F4b 정본에 아직 필요한 결정**:

- fixture 4종의 크기/페이지 수/내용 seed/투명 합성 배경·해시와 반복 횟수. 현재 48셀은 페이지 수 축이 없으므로 입력 증가에 따른 **문서/배치 한계**를 교정할 수 없다. 같은 fixture의 1/다페이지/다파일 증대열과 retained results/ZIP 경로를 함께 고정해야 한다.
- 후보 절차: warm-up 1회·기록 3회, bytes·시간은 중앙값과 원시값, 자원은 반복 중 최대. 전역 포맷은 **모바일 photo-scan 300DPI의 paired PNG/JPEG 최종 bytes 중앙값 비율**을 기준으로 하는 등 **기기 한 셀 또는 두 기기 집계 규칙**을 명시한다. 현재 “300DPI 셀”만으로는 기기 2개의 판정이 갈릴 수 있다. JPEG q85는 유지하고 투명도 fixture의 배경색을 고정한다. 이는 채택을 요청하는 절차 후보다.
- 포맷 결정 뒤 그 포맷의 모바일 fixture 전부에서 자원/가독성 기준을 만족하는 최대 DPI를 택하도록 **선택 순서와 all/any 집계**를 고정한다. text-vector 작은 글자 등 가독성 oracle을 사전에 정의해야 하며 peak만 작다고 가독성이 합격하지는 않는다.
- 50%의 분모인 **실측 기기 한계**는 어떤 측정으로 얻는지 아직 없다. 장치 RAM·V8 heap limit을 그대로 쓰는 안은 E4-5로 기각한다. 실제 장치와 계측을 확보할 때까지 한계를 교정하지 못한 것으로 보고하고, 미지원 API/실기기 없음/150DPI 불합격은 지원 제외+범위 축소 안내로 귀결한다. 보편적인 모바일 한계 숫자를 새로 발명하지 않는다.
- B 상한의 입력 사전 추정과 실제 실행 중 예산 확인, 누적 결과를 메모리 Blob로 보유할지 OPFS로 내릴지, OPFS 불가/할당 실패/취소 시 partial success를 어떻게 보존할지 정해야 한다. concurrency 1만으로 이전 출력/ZIP 버퍼가 사라지지는 않는다.

위 내용은 D3 한 건으로 집계했다. A/B 분리 자체에 이견을 다시 제기하는 것이 아니라 **F4b 구현자가 측정기·한계·결정기를 다시 설계해야 하는 부분**이다.

**D4: 재구축 보존/지원 제외 표 초안**

E4-4는 설치된 pdf-lib 1.17.1의 실제 exported API를 사용했다. `PDFObjectCopier`, `PDFDict`, `PDFArray`, `PDFRef`, `PDFRawStream`, `PDFName`, `PDFString/HexString`, `context.nextRef/assign/register`, `catalog.get/set/delete`가 존재한다. `copyPages`는 **페이지 subtree 복사**이며 catalog 전체 보존 API가 아니다. `PDFObjectCopier.traversedObjects`라는 private map에 의존하지 않고 별도 `Map<old page ref,new page ref>`를 먼저 만드는 저수준 graph copy probe로 named Dest·outline target **index 1**, PageLabels **['i','7']**, ViewerPreferences **HideToolbar/DisplayDocTitle true**를 실제 저장·PDF.js 재개방해 확인했다. PDF.js v6의 ViewerPreferences 반환은 Map이므로 JSON 직렬화 전에 변환했다.

이 작은 probe는 PDF 원문 렌더/OCG/태그/양식의 완전 보존 구현이 아니다. **아래 표는 채택 대기 초안**이며 U4-0에서 fixture를 만드는 사람에게 새 지원 범위 판단을 떠넘기지 않도록 지금 확정할 대상이다.

| 구조 | 표 초안: 보존/제거/지원 제외 | 실재 API·필요 절차 | U4-0/최종 oracle |
|---|---|---|---|
| 페이지 트리·Contents·Resources·Media/Crop/Rotate | 비대상은 보존 | 모든 실제 출력 page ref를 먼저 배정하고 동일 map으로 subtree 복사. Parent 재구성, page ref를 임의 새 ghost page로 복제하지 않음 | 실제 페이지 집합·수/geometry·렌더·참조 무결성 |
| `/Outlines` | 정상 로컬 목적지 트리 보존 후보 | 저수준 Dict/Array/Ref graph, Parent/Prev/Next/First/Last와 Dest 또는 A/GoTo page ref 매핑. E4-4 단일 항목 index 1 성공 | 다단 트리/이름 및 직접 목적지/순환 손상·외부 action 구분. 검증 범위 밖 action은 사전 unsupported 표시 |
| `/Names`의 `/Dests`, 구식 catalog `/Dests` | 정상 name tree 보존 후보 | `/Kids`·`/Names`·`/Limits`, Name/String/HexString 키, dictionary의 `/D` 또는 destination array 해석. 새 page ref로 매핑. E4-4 named target index 1 성공 | leaf/다단 name tree·양식 목적지·중복/없는 이름·직접/간접 array |
| `/Names`의 `/EmbeddedFiles`, `/EmbeddedFile`, `/Filespec`, catalog/page `/AF` | **첨부 제거 선택 시 제거**, 선택하지 않았으면 지원 범위 내 보존 | 참조를 **복사하기 전에** 모든 허용 경로에서 필터. `attach` 존재는 제거 API가 아님. 무차별 Filespec 삭제는 외부 링크 파일 spec과도 충돌하므로 포함 파일 용도 구분 필요 | payload sentinel의 전체 indirect stream 부재, Names+catalog/page AF+FileAttachment 및 대상 구조 경로 검사 |
| `/Names`의 기타 항목 | 열거 후 보존/unsupported를 명시 | Dests/EmbeddedFiles만 복사하면서 나머지를 조용히 버리지 않음. 각 항목의 용도를 allowlist에 기입 | JS·AP·기타 이름트리가 있는 fixture의 실제 지원 표시와 사전 고지 |
| `/PageLabels` | 페이지 수/순서 불변 범위 보존 | number tree를 저수준 복사. E4-4 ['i','7'] 성공. 선택 범위는 장식/래스터 대상 여부이며 페이지 삭제로 해석하지 않음 | style·prefix·start·Kids 보존. 최종 raster가 페이지를 선택 추출하는 제품이라면 index 재매핑을 별도 결정 |
| `/ViewerPreferences` | 보존 후보 | catalog dictionary의 알려진 값 복사. API `getOrCreateViewerPreferences` 실재. E4-4 boolean 보존 확인 | Bool/Name/array/print range. 무지원 값 사전 명시 |
| `/OCProperties` 및 resource `/Properties`·OCG/OCMD | **현재 의미 보존 미검증. 구조 재구축의 지원 제외 후보** | catalog만 붙이면 충분하지 않다. content/resource OCG ref·기본 ON/OFF·Order·usage도 함께 매핑해야 함. 저수준 API로 객체를 옮길 수 있다는 사실만 확인 | 실제 visible/hidden 레이어의 PDF.js/Poppler 렌더·상태. 검증 전 “보존” 표시 금지. 단순 장식 경고 후 진행 계약과 구조 제거 지원을 구분 |
| `/StructTreeRoot`·ParentTree·MarkInfo·페이지 StructParents | **현재 tagged 의미 보존 미검증. 지원 제외 또는 명시적 태그 제거 정책 채택 필요** | content MCID·page ref·OBJR/annotation 관계 전부 맞아야 한다. root 하나 삭제/복사로 reading order가 보존되지 않음 | tag tree·reading order·page/annotation cross ref. 제거를 허용한다면 사전 “문서 접근성 태그 제거” 고지와 관련 index 정리까지 하나의 정책으로 확정 |
| Info dictionary + `/Metadata` XMP | metadata 제거 시 둘 다 제거; 미선택이면 보존 | 새 문서/재개방 모두 `updateMetadata:false`, trailer Info와 지정 metadata 경로 필터. **기본 PDFDocument.create는 Info를 새로 만든다**(E4-4 true vs false) | 출력 전체 object에서 원래 metadata sentinel 없음; remove 옵션이면 새 Producer/CreationDate 자동 재생성도 없음. 최종 raster 문서에도 동일 정책 |
| `/AcroForm` 일반 필드·Widget | 미선택이면 필드 트리/Widget/AP 관계 보존 후보; 제거와 flatten은 별도 배타 모드 | `getForm/getFields/removeField/flatten` 실재. `copyPages` 단독은 Widget가 남아도 getFields=0. flatten 전에 AP/필드 지원범위 확인, flatten 후 Annots dangling 제거 및 최종 재구축 | 한글/다중 줄/checkbox/radio/dropdown/회전 Widget. **E4-4 flatten은 fields 0이지만 7 0 R dangling을 남겼고 명시 정리 후 0**. fields=0 단언만으로 합격 금지 |
| XFA·깨진/없는 AP·서명 필드 등 검증 밖 form | flatten 지원 표시 제외 후보 | `hasXFA`·`deleteXFA`는 존재하지만 XFA 읽기/수정은 pdf-lib 지원이 아님. `updateFieldAppearances` 기본 Helvetica로 한글 값을 재생성하지 않음 | flatten 지원 목록 밖은 사전 고지. remove를 선택한 경우 제거 의미와 flatten 의미를 혼용하지 않음 |
| `/Annots /Link`: URI | 보존 | `/A /S /URI` 값을 보존. E4-4 URL 유지 | URL·Rect·border·외형, 원시 내부 코드 사용자 비노출 |
| `/Annots /Link`: 직접 Dest·A/GoTo | 보존 후보, 반드시 새 page map 사용 | 복사 전 목적지 해석/새 ref 연결. **copyPages 원형은 두번째 페이지 ref가 실제 page tree 밖으로 복사되어 PDF.js index 0을 반환** | 실제 목적 page index가 원래 1임을 단언. 존재하는 ref인지 검사하는 것으로 대체 불가 |
| `/Annots /Link`: 이름 Dest | 보존 후보, 이름트리 동반 | String/Name 키로 Dests를 resolve하고 새 ref로 매핑. E4-4 원형 null, 명시 graph 후 index 1 | named target, destination array의 남은 zoom/좌표/fit 값도 보존 |
| `/Annots /Text`·FreeText·Highlight·Underline·StrikeOut·Squiggly·Ink·Stamp·Square/Circle·Line·Polygon/PolyLine·Caret·Popup·Redact 등 | **주석 제거 선택 시 제거**, 미선택이면 subtype별 검증 범위 보존; 임의 annotation flatten 지원 금지 | Popup/IRT/Parent 연결까지 정리. Redact “주석 제거”는 실제 본문 내용을 삭제하는 redaction이 아님. 지원 의미를 혼동하지 않음 | subtype 기대 목록, related refs·AP/private contents까지 orphan 부재 |
| `/Annots /Widget` | form 정책을 따름 | 주석 제거만으로 form을 부분 파괴하지 않도록 form 옵션과 우선순위를 명시 | “주석 제거 + 양식 유지/flatten” 각각의 기대값 |
| `/Annots /FileAttachment` | 첨부 제거 또는 주석 제거 선택 시 제거 후보 | EmbeddedFiles·AF와 같은 포함 payload를 공유할 수 있으므로 정책 합성 후 복사 | attachment-only와 annotation-only 각각 payload 의미를 고정 |
| Sound/Movie/Screen/RichMedia/3D 및 알 수 없는 subtype | 보존 보장 미검증, unsupported를 사전 표시 | “Link 아닌 것은 무조건 삭제”는 remove 미선택 때 허용되지 않음. 최소 명시 목록·복합 자원 graph 필요 | 감지/고지/사용자 선택·원래 option 의미 고정 |
| 최종 페이지 raster flatten | 픽셀 보존 범위 + 검색/태그/양식/링크 등 상호작용 손실을 별도 지원 표시에 명시 | PDF.js 렌더→이미지 embed, 선택 페이지 처리. raster 뒤 Link를 되붙일지(벡터 링크 보존 계약) 현재 명시 없음 | 최종 결과의 실제 텍스트·Annots·form·metadata·첨부 여부. “주석 제거에서 Link 보존”을 raster 전체 보장으로 확대하지 않음 |

**D4 구현 순서 후보**: 원본 File 불변 → 별도 작업 문서 load(updateMetadata:false) → 입력 구조 목록/preflight → 선택 제거/flatten 모드 확정 → 위험/미지원 고지 → **복사 전** 대상 및 참조 필터·필드/AP 처리 → 출력 page ref 사전 생성 → 비대상 graph의 허용 경로만 새 문서로 복사/매핑 → 장식 → 필요시 최종 raster → 최종 새 문서의 전체 indirect-object/대상 없음/링크 목적지/열기·페이지·렌더 검증. 복사 후 삭제만 하면 E4-4처럼 payload가 orphan으로 남는다.

정본에는 “지원 제외”의 효과도 고정해야 한다. **경고 후 손실을 허용해 결과를 만들지, 해당 구조 제거만 비활성화할지, 해당 파일을 실패로 격리할지**는 다른 제품 동작이다. OCG·tagged를 예고 없이 버리거나, 단지 리오픈 성공으로 의미 보존을 판정하는 안은 채택하지 않는다. 실제 임의 입력에서 픽셀 완전 보존을 런타임이 알아낼 수 있다는 보장도 하지 않는다.

**sol 관점 신규 이견 3건**

| ID | 코딩 중 재해석이 필요한 지점·재현 | 구체적 정본 문안 후보 / 검증 |
|---|---|---|
| **N1 선택 상태 정본** (U4-1/3/8) | 확정 26은 텍스트 범위/홀짝과 썸네일이 “양방향 동기”라고만 한다. E4-4: `2-8 + even = {2,4,6,8}`에서 3쪽을 토글하면 홀짝 유지로 토글 무효, parity 해제+정확 집합 {2,3,4,6,8}, parity만 해제해 {2,3,4,5,6,7,8}의 서로 다른 동작이 가능. D2 산식으로는 해결되지 않음 | 후보: 텍스트/홀짝을 수정하면 물리 선택 집합을 다시 계산. 썸네일 토글은 exact set을 정본으로 만들고 parity=all로 전환하며 canonical range text를 `2-4,6,8`로 갱신. startPage/excludeCover는 별도 하한으로 유지하여 제외된 페이지는 toggle disabled. 선택 규칙이 번호/머리말/워터마크/도장 각각인지 전역인지도 typed options 표에 고정. 다중 파일의 페이지 수 차이·빈 집합은 파일별 안내/부분 결과 보존. 위 전이와 역전이 unit/DOM 골든 |
| **N2 도장 비율 vs 정규화 rectangle** (U4-1/5) | D7은 점 변환을 고쳤지만 확정 8/22는 normalized x/y/w/h 4개를 대상 viewport에 그대로 적용한다. E4-4: 400×600에서 rect w=.2/h=.1 → **80×60, ratio 4/3**. 600×400으로 복제하면 **120×40, ratio 3**. 사용자 요구 “가로세로 비율 고정”과 동시에 만족하지 않음 | 후보: 중심/anchor와 폭의 상대 척도 + 이미지 고유 종횡비를 저장. 대상 visual viewport에서 폭을 정한 뒤 높이는 이미지 비율로 재계산. 넘치면 두 변을 같은 비율로 축소하고 위치 clamp. “같은 위치”는 정규화 중심/anchor, 상대 폭을 기준으로 정의하고 normalized h는 파생값으로 둔다. 혹은 최소변 기준 크기 등 다른 단일 규칙을 Claude가 선택. 0/90/180/270·혼합 크기·DPR·복제·undo/redo에서 비율·센터·네 모서리 검증 |
| **N3 여러 줄과 glyph/layout 전처리** (U4-1/3/4) | 확정 1은 치환 완료한 모든 문자열을 encodeText/getCharacterSet에 넣으라 하고 확정 21은 여러 줄을 허용한다. E4-4: **`Line 1\nLine 2`도 Helvetica 실패**, Noto missing **U+000A**; `가\n나`도 Noto missing U+000A. 그대로 구현하면 다중 행 입력을 지원하지 않는 문자로 막거나 불필요하게 폰트를 가져옴. D8의 drawText API 정정만으로는 순서가 정해지지 않음 | 후보: token expansion → CRLF/CR을 LF로 정규화 → 명시 newline을 layout delimiter로 분리 → **실제 그리는 line/glyph run만** coverage 검사 → 문서당 폰트 결정/1회 embed → 실제 font metrics로 좌중우/6영역 layout. 빈 줄은 높이를 소비하지만 coverage 대상이 아님. 탭/기타 제어문자/알 수 없는 token·date format은 정규화 또는 필드 오류 중 정책을 고정. 6영역 폭/충돌/overflow·max lines/text length·타일 최소 간격/최대 연산량도 유효성 정책 표에 명시하여 sol이 조용한 축소·잘림·무제한 반복 중 택하지 않도록 한다. ASCII/CJK multiline·빈 줄·CRLF·overflow 골든 필수 |

N1의 상태 예시는 계약의 비결정성을 드러내는 산술 probe이며 아직 없는 UI의 실동작이라고 주장하지 않는다. N2/N3은 실제 라이브러리 좌표/폰트 사용 규칙과 요구사항이 맞물리는 직접 반례다. D2/D7/D8과 중복 집계하지 않았다.

**v5가 함께 채택한 3차 [동의] 항목 재확인**

| 항목 | 판정 / 정본화 때 유지할 상세 |
|---|---|
| recovery/ToolReady | [동의]. v5는 “3차 상세 문안 그대로 채택”하므로 내부 Suspense 여부에 따른 **조건부** 계약으로 읽는다. 바깥만 쓰면 기존 경계 재사용, 내부 boundary를 두면 `.tool-route-loading` + 예약 공간 + 내부 ToolReady 둘 다. 3차 E9의 준비 전 guard 유지/성공 후 해제 증거 유효. 20개 정상 진입뿐 아니라 Page/FinishPanel 각각 404·지속 실패·reload≤1 테스트 문안을 최종 정본에 남길 것 |
| a11y/rendering/SEO/광고 | [동의]. finish desktop+412 mobile, rendering 5 route 독립 ID/실제 ready, 목록 unit 갱신, tool IDs 20 유지. 5경로 ko/en/static/FAQ/social/canonical /finish와 일반 광고 로더 확인. CLS 0은 목표, **≤0.1**이 차단 기준 |
| H6 시각 규모 | [동의]. 4탭 32캡처+nav 12=219/실행, scenario 87. mobile-320 신설은 해당 nav 표본만; 기존 mobile=390과 전역 중복 금지. 820/821 DOM 단언. 5.6분은 3차 산식의 **예측**, 이번 새 실측 시간이 아님 |
| 9단계·브랜치·배포 | [동의]. s3-pdf-finish 하나, U4-0~8 commit 단위, 최종 1회 배포·9게이트. D5 측정기 변경은 U4-0의 별도 논리 단위. S2b main 변경은 merge로 따라가되 예산 baseline 임의 변경 없음 |
| navigation selector | [동의]. navigation 위치 의존 4건만 교체. 내부 page-card/출력 모드의 순서를 의도한 nth-child는 범위 밖. 광역 탐색과 최소 제외 목록 유지 |
| F0b adapter | [동의]. 공용 helper/Excel client 무변경, PDF 소유 facade adapter. 공용 helper 변경을 임의 확대하지 않음. 기존 4모드 오류/warnings/transfer·PDF oracle + Excel cleaner/compare 스모크/소스 diff 필요. fontkit 실행 realm의 후속 결정은 D5 |
| legacy oracle | [동의]. U4-0 현재 main에서 먼저 채취, 구조/렌더/client 3종·환경 기록, U4-2/F5 실제 브라우저 PNG 경로와 비교. none/numbers/watermark/both 4조합, byte equality 보조. 3차 E2/E13을 이번 라운드 새 브라우저 비교로 표기하지 않음 |
| QR 폰트 경계 | [동의]. 상위 결정10·S2b의 제외와 정합. U4는 pinned 전체 OTF·subset:false 유지, QR 선택 자산과 공용 고정 descriptor 분리 필요 시 반영. 3차 보고서 상세 문안대로 원본 OTF/경로/벤더 manifest를 제거하거나 덮어쓰지 않음 |
| 1회 clock·복합 순서·취소 정착 | [동의]. 메인 캡처를 worker로 전달, 구조 처리→배경→원문→전경→번호/머리말→도장→최종 raster. cancel→render promise 정착→cleanup→destroy. runtime 구조/렌더 성공과 fixture 픽셀 oracle을 구분 |

**잔여 원장 및 다음 왕복의 완료 조건**

| 잔여 ID | 닫히는 조건 |
|---|---|
| D1 | R2/R6별 /P·암호·permissions·제품 거부 oracle 4행 확정 |
| D3 | 지표의 계측 범위·실기기/한계의 근거·48셀 및 누적 입력 축·집계/품질/사전 추정/저장 정책·미교정 분기 확정 |
| D4 | 위 구조표의 실제 지원 범위와 고지/실패/허용 동작을 **U4-0 전** 확정. ref/flatten/orphan/metadata 재생성 반례의 처리·검증 포함 |
| D5 | 모듈 가중치/배분/ID·realm/스키마/누락 metadata·gate 의미 채택, 실제 finish 폰트 실행 그래프와 취소 계약까지 일치하는 탐색 증거 |
| N1 | 텍스트/홀짝/썸네일의 상태 전이와 옵션별/파일별 선택 범위 정본화 |
| N2 | 혼합 크기에서 정규화 위치·크기 척도·고유 종횡비·clamp 우선순위 하나로 확정 |
| N3 | 개행/coverage/layout 순서와 다중 행/overflow·비정상 입력·타일 자원 제약 확정 |

일반적인 변수 이름·파일 분리·컴포넌트 선택까지 이견으로 만들지 않았다. 위 7건은 동일 문안을 따라도 결과/지원 범위/게이트 판정이 달라지는 부분이다. **잔여 이견 7건 · [재왕복 필요].**

**종료 불변 증명**

종료 검증 결과는 `unchanged.json` 및 `logs/unchanged.log`에 기록한다. 검증 대상은 시작에 채취한 추적 파일·열린 계획·사용자 미추적 3파일·dist이고, 지시서대로 AGENTS.md·CLAUDE.md는 차단 판정에서 제외하되 전후 상태는 별도 기록한다. 최종 검증을 실제 실행한 결과는 다음과 같다.

```json
{
  "snapshotFiles": 2912,
  "verifiedFiles": 2910,
  "distFiles": 531,
  "changed": [],
  "extraDist": [],
  "excluded": [
    "AGENTS.md",
    "CLAUDE.md"
  ],
  "excludedChanged": [],
  "headEqual": true,
  "origin-mainEqual": true,
  "git-statusEqual": true,
  "diffIncludingClaudeEqual": true,
  "indexEqual": true,
  "nonExcludedWorktreeDiffExit": 0
}
```

시작 snapshot 2,912파일 중 지시된 2파일을 제외한 **2,910파일의 SHA-256·크기·mtime 및 파일 집합 불변**, **dist 531파일 불변·추가 0**이다. 제외한 AGENTS.md·CLAUDE.md 자체도 이번 시작 이후 변화 0이었다. HEAD/origin/main·git status·Claude 변경을 포함한 git diff·index가 모두 시작과 동일하다. 사용자 3파일과 열린 계획서도 불변이다. 종료 검증 exit 0.

**최종: 잔여 이견 7건 · [재왕복 필요]. — Codx**
