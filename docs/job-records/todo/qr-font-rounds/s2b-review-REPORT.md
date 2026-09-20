# S2b QR 라벨 PDF 폰트 감량 — astra 코딩 완료 후 검수

작성: **Codx**, 2026-09-07 KST. 검수 기준: `s2b-qr-font`, **HEAD `93a2318d445d78e5283b48be993578f7f061b96c`**, main `f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e`.

**최종 판정: [수정 후 재검수].** 정본이 지정한 회귀 테스트에서 **보통 2건(F1·F2)**이 남는다. 실제 제품 구현은 이번 동작 재현에서 통과했으나, export 토큰 테스트가 정적 문자열 검사이고 폰트 HTTP 404의 reload 예산 검증이 커밋된 스모크에 없다. 검수용 `/tmp` 실험을 제품의 지속적인 회귀 테스트 구현으로 간주하지 않았다.

감량·고정 자산·렌더·번들 수치는 재현됐다. unit **241/241**, QR PDF **3 scenario** 기대 폰트 SHA, TypeScript 진단 0, production static, CSS/registry/diff 검사는 통과했다. subset PDF 단계는 보고값과 같은 **1,450,793B(차이 0%)**, 렌더는 **17페이지·33,561,324픽셀 차이 0**, PDF.js 전체/서브셋 추출 동일이다. **추적 2,373파일·원본 dist 537파일·QR 정본·사용자 3파일 SHA 및 HEAD/main/git status는 불변**이다. 전체 3,078파일 중 병행 세션의 오프라인 U4 계획서·로드맵 2개 변경을 관측했으며, 전체 불변 검사는 최종 exit 1로 기록한다(§8). 임시 worktree는 제거했다.

## 1. 수정할 항목

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| **F1. export 토큰 동작 회귀 테스트 누락** — `tests/unit/qr-label-font.test.ts:164` | **[결함] 보통 · 정본 R2-1/D5 검증 누락** | `python3 /tmp/worklazy-s2b-review/mutation-check.py` → 제품 함수 `finishExport`의 `if (!owned) return;`만 제거한 `/tmp` 사본에서도 커밋된 QR unit **10/10 PASS**. 같은 사본의 실제 handler 본문을 실행하면 **exit 1, `'' !== 'pdf'`**: 이전 ZIP finally가 새 PDF의 exporting 상태를 지움. 현행 무변조 handler는 `runtime-probe.mjs` **24/24 PASS**. 로그 `logs/mutation-lease-unit.log`, `logs/mutation-lease-runtime.log`. | 정적 정규식 단언을 보조 검사로 남기되, **제품 handler를 실제 실행하는 unit**을 추가한다. ZIP 대기→cleanup→새 PDF 대기→옛 ZIP reject/finally 순서에서 새 exporting=`pdf`, 옛 오류 표시 0, 새 작업 완료 전 ref 유지 등을 단언한다. cancel·unmount·파일 교체/결과 폐기·지연 import/storage/save·마지막 download task 경계·동기 중복 클릭도 실제 결과(다운로드/오류/상태/요청 횟수)로 고정한다. 독립적으로 다시 쓴 상태기계가 아니라 실제 제품 함수를 시험한다. 기존 TypeScript 도구와 `/tmp` probe의 함수 추출 방법으로 새 의존 없이 가능하다. 위 owner-guard 제거 음성 대조가 반드시 실패해야 한다. |
| **F2. 폰트 404와 S0 reload 예산의 브라우저 단언 누락** — `tests/qr-bulk-smoke.mjs:120`, `tests/qr-font-scenarios.mjs:62` | **[결함] 보통 · 정본 D3/D5 검증 누락** | `sed -n '114,151p' tests/qr-bulk-smoke.mjs` 및 scenario server 전체 확인: subset/full/corrupt 3종뿐이며 corrupt는 **HTTP 200** 1바이트 변조. unit의 `http`도 `ok:false` mock이고 브라우저 navigation/sessionStorage를 검사하지 않는다. `node /tmp/worklazy-s2b-review/browser-probe.mjs`에서 현 제품 helper+현 S0를 실제 Vite/browser로 실행 → **font404: reloads=0, retryKeys=[], full=4,644,748B; 실제 청크404: reloads=1**. `browser-results.json`, `logs/browser-font404.log`. | 기존 3 scenario를 유지하고 브라우저 스모크에 **실제 HTTP subset 404→full 1회**, reload 0, S0 retry key/예산 불변을 추가한다. 실제 helper 청크 실패와 구별되는 단언이어야 한다. 커버리지/자산 mock만으로 대체하지 않는다. 지연 자산 응답 중 결과 폐기·unmount의 다운로드 0도 D5 지정 브라우저 분기에 고정한다. 기존 일반 QR 생성 취소 검사는 export 진행 중 취소를 시험하지 않는다. |

두 항목은 **현재 제품이 깨졌다는 판정이 아니라 합의한 검증 구현이 빠졌다는 판정**이다. 특히 F1은 테스트 이름에 적힌 “one synchronous … lease / every stale-result boundary”를 regex 존재 여부만으로 보증할 수 없음을 실제 결함 주입으로 확인했다. astra의 일회성 검증을 근거로 sol의 테스트 구현 누락을 통과 처리하지 않는다.

원문+NFC 테스트는 이와 다르다. 같은 `mutation-check.py`에서 selector를 단순 원문 cmap 검사로 바꾸면 기존 unit이 **2건 실패(U+AC02 등)**한다. 따라서 D2 음성 대조에는 실제 검출력이 있고 F1과 혼동하지 않는다.

## 2. 정본 항목별 대조

위치는 저장소 상대 경로와 현재 HEAD의 행 번호다. D5의 1차 예외표는 2차에서 build/runtime coverage 행을 나눠 19행으로 정리한 계약까지 대조했다.

| 항목 | 판정 | 구현 위치·재현 명령/출력 | 수정 필요 시 지시 |
|---|---|---|---|
| D1 fonttools 4.59.2·retain-gids·layout/name/notdef/timestamp 고정 | **[통과] [일치]** | `scripts/build-qr-label-font-subset.py:53,128,155`, `scripts/requirements-fonts.txt:1`. `/tmp` worktree에서 기존 임시 venv Python으로 생성기를 실행: **cmap=3394 size=931704 gzip=561161 glyph-differences=0**, exit 0 (`logs/regenerate.log`). 새 설치 없음. | 없음 |
| D1 cmap/GID/hmtx/outline 및 Poppler/PDF.js oracle | **[통과] [일치]** | 생성기 `:103`의 실제 cmap exact equality 및 RecordingPen 비교. `tests/qr-font-render-regression.mjs:93` 이후 제품 `createQrLabelPdf` 사용. `npm run test:qr-font-render` → 3 fixture/17p/픽셀 0/추출 동일. `qrLabelPdf.ts:20` **subset:false**. GS는 기존 결함으로 oracle 제외. | 없음 |
| D2 문자 집합 3,394·원문+NFC·말줄임·음성 대조 | **[통과] [일치]** | `qrLabelFont.ts:31,57`; unit `:18,37,47,63`. 입력 전체와 NFC 양쪽, 공백 정리, codepoint 순회, U+2026 및 exact schema. draw 입력은 NFC로 변환하지 않음. NFD 11,172 전수 PASS, runtime 실제 shaping 비교 raw-only 오판 **8,822→0**, raw-only mutation unit **exit 1/2 failures**. | 없음 |
| D2 coverage JS 귀속 | **[통과] [일치]** | production을 `/tmp` 재빌드하고 `bundle-audit.mjs`로 재측정. helper **22,278B / gzip 9,679B**, `category=route`, `routeOwners=[qr-studio]`. 3,394개 실제 JSON 배열이 해당 출력 JS에 들어 있음. | 없음 |
| D3 클릭 시 lazy factory·snapshot·검증·메모리 캐시·HTTP 기본값 | **[통과] [일치]** | `QrBulkPanel.tsx:309,318`, `qrLabelFont.ts:89,98`. panel별 factory, font ArrayBuffer만 최대 2개, 성공 size/SHA 후 cache, dispose 후 재설정 방지, cachebuster/no-store 없음. runtime probe의 성공/404/503/network/HTML/empty/truncated/wrong SHA/cache/abort PASS. | 없음 |
| D3 8,192 codepoint·8ms task 양보 및 optional signal | **[통과] [일치]** | `qrLabelFont.ts:57,73,93,98`, unit `:63,74`. signal 생략 선택/load/cache 통과, 양보 후 abort 관측. | 없음 |
| D3/S0 폰트404 reload 0·청크 실패 catch 분리 | **구현 [일치], 검증 [누락]/[결함]** | handler `:318,343,365`, loader acquire `qrLabelFont.ts:128`. 검수용 browser probe는 font404 reload 0·청크404 reload 1 확인. 커밋된 스모크에 해당 단언 없음. | **F2** |
| D4 생성 입력→Node 전개·전체/OFL 보존 | **[통과] [일치]** | `scripts/vendor-qr-label-font.mjs:25,32,36,43,61,75`. gz/coverage/provenance SHA, bounded gunzip, schema/참조 검증, full/OFL 캐시 또는 고정 fetch, 전부 staging 후 소유 snapshot 2개 교체. 두 번 SHA 동일, 손상 4종 실패 시 public 불변. | 없음 |
| D4 재생성 경계·해시표 | **[통과] [일치]** | 생성기 `:92,103,128,248`에서 원본·목록·tool lock·cmap/outline·모든 출력 SHA 통과 후 입력 교체. `OFFICE_EDITOR_ASSETS.md:35` 역할별 9행에 전체/OFL/목록/gz/raw/coverage/schema/provenance/wheel 모두 있음. | 없음. `:47`의 “원자적으로”는 생성기의 **파일별 os.replace**로 한정해 읽어야 함; 4파일 전체 transaction은 아님. |
| D5 예외/오류/폴백 분류 | **구현 [일치], 일부 검증 [누락]/[결함]** | `qrLabelPdf.ts:13`에서 create는 catch 밖, register/embed만 typed; PNG/draw/save 밖. `QrBulkPanel.tsx:349` selected subset+typed일 때만 evict→full 1회, entries 재사용. 실제 handler/실제 pdf-lib probe 24/24; 음성 font/PNG/save/import/abort 분류 PASS. 영구 token/browser 회귀 테스트는 F1/F2. | **F1·F2** |
| D6 B 미채택·C 클릭 이후 병렬화 | **[통과] [일치]** | `QrBulkPanel.tsx:318,334,343` font/helper/PNG Promise.all, 클릭 전 prefetch 없음. `docs/review-notes.md:49` B “전면 불가”가 아닌 미채택 기록. 현 Chrome의 brotli 미지원도 local probe 확인. 다른 브라우저 지원 표를 새 웹 조사한 것은 아님. | 없음 |
| R2-1 ZIP/PDF 공용 lease | **구현 [일치], 검증 [결함]** | `QrBulkPanel.tsx:277,309,370,377,391,399`. 첫 await 전 active ref 점유, 소유 finally, results/storage/preset snapshot, abort+dispose. 무변조 실제 handler runtime 24/24. | **F1** |
| R2-1 세 분기 즉시 rejection·최종 task 재검사·2,400 상한 | **[통과] [일치]** | `QrBulkPanel.tsx:343,359,313`, `qrLabelPdf.ts:30`. unmount 중 import/storage/save·최종 task 취소 다운로드 0, 중복 클릭·preset 변경·0/2,400/2,401 probe PASS. 동기 font/layout/save 한 단위의 즉시 중단은 보장하지 않는 기존 계약. | 동작을 F1 지속 테스트에도 편입 |
| R2-2 기존 PDF 1MB 하한 삭제·구조/SHA 단언 | **[통과] [일치]** | `tests/qr-bulk-smoke.mjs:120,143`, `tests/qr-font-scenarios.mjs:36`. `%PDF`·PDFDocument.load·2p·OTTO stream 1·decoded size/SHA, 새 임의 크기 하한 없음. 신규 smoke 정상 subset PDF **852,246B** 통과. | 없음 |
| 보강 ① busy 비활성 | **[통과] [일치]** | `QrBulkPanel.tsx:469`; `lifecycle-probe.cjs` 실제 JSX 식 평가 busy PDF disabled **true**. | 없음 |
| 보강 ② storageRef 선행 분리 | **[통과] [일치]** | `QrBulkPanel.tsx:243,252,488,107`. abort/error 두 clear를 지연한 실제 본문 실행 → export 재진입 false, 새 storage 보존 true. | F1에서 지속 검사 |
| 보강 ③ selector/loader optional signal | **[통과] [일치]** | `qrLabelFont.ts:59,93,98,128`; unit 생략 signal load/cache/dispose 및 PDF helper optional signal 통과. | 없음 |
| 스모크 3 scenario·공용 fixture·손상 주입 | **[통과] [일치]** | `qr-font-scenarios.mjs:15,27,62`; `qr-bulk-smoke.mjs:120`. 25행 `Primary,Label`, `{{Label}}`, 첫 title에만 똠 1자. 실제 HTTP proxy 정확한 subset 경로 byte 50 XOR, 같은 크기/200. scenario별 navigation/cache off/이전 PDF 삭제. 기존 7 payload·취소/재실행·ZIP/manifest 보존. | F2 추가 시 기존 3종 유지 |
| 계측 --scenario·NetLog·출력 분리 | **[통과] [일치]** | `qr-stage-metrics.mjs:13,14,88,157,191,215,217`. subset fresh browser/NetLog 1회 재실행. `--scenario=typo` → **exit 1 Unknown QR font scenario**. full/corrupt 원문 JSON·로그 수치 대조. | 없음 |
| 고정 산출표·backlog 2건·기록 분리 | **[통과] [일치]**, backlog 문안 주의 | 아래 전수 pin 대조. CHANGELOG 1행 Codx, review-notes 실측/기각, backlog `:28,29` GS/PDF.js 기존 결함 기록. | U4의 현재 승인 범위를 확대하는 지시로 읽지 않도록 §6 참고. |

## 3. 재실행한 검증

로그 경로는 모두 `/tmp/worklazy-s2b-review/logs/` 아래다. `run.py`는 원문 stdout/stderr와 별도 JSON의 **command/cwd/start/end/seconds/exit**를 보존한다. TMPDIR와 npm cache도 이 검수 폴더 안으로 고정했다. 표의 worktree는 같은 HEAD의 `/tmp/worklazy-s2b-review/wt`이며 종료 시 제거했다.

| 명령 | cwd/대상 | exit·출력 | 로그 |
|---|---|---|---|
| `npm run test:unit` | 원본 repo 읽기, fixture는 검수 TMPDIR | **0 · 241/241**, 실패/skip 0 | `unit.log` |
| `npm run test:qr-bulk` | /tmp worktree, 원본 QA dist를 읽기 전용으로 서빙 | **0 · subset/full/corrupt 25행/2p 기대 size/SHA**, 취소/재실행·7 payload·ZIP 2 PNG·2-sheet manifest·외부 요청 0 | `qr-bulk.log` |
| `npx --no-install tsc -b --pretty false` | /tmp worktree, 별도 node_modules/.tmp | **0 · 진단 0**, 17.886s | `tsc.log` |
| `npm run test:static` | 원본 최종 QA dist | **1 · Analytics configuration is missing** | `static.log` |
| `node node_modules/vite/bin/vite.js build --manifest` | /tmp worktree production | **0**, 72.875s, 원본 dist 쓰기 없음 | `production-build.log` |
| `node --experimental-strip-types scripts/generate-static-pages.mjs` | 위 /tmp production | **0 · 61 pages** | `production-static-pages.log` |
| `npm run test:static` | 위 /tmp production | **0 · startup 104 docs·localized/runtime/ads/robots/sitemap** | `static-production.log` |
| `node tests/tool-registry-routes.mjs` | 원본 repo | **0 · 기대 20, missing/unexpected/duplicate 0** | `registry.log` |
| `npm run css:orphans` | 원본 repo | **0 · 0 zero-reference selector arms** | `css.log` |
| `npm run legacy:manifest` | /tmp worktree만 출력 | **0 · 153 removed/0 split/2 active**, 생성 후 tracked diff 0 | `legacy.log` |
| `git diff --check main..s2b-qr-font`, `git diff --check` | 원본 repo | **0 / 0** | `diff-check.log`, `diff-working.log` |
| `npm run measure:qr -- --scenario=subset` | /tmp worktree가 원본 QA dist 서빙, port 4282 | **0 · PDF 단계 1,450,793B**, 10.729s | `metrics-subset.log` |
| `npm run test:qr-font-render` | 원본 제품 helper, 출력은 검수 render/ | **0 · 3 fixtures, 17p, 33,561,324px, diff 0, extraction 동일**, 37.877s | `render.log` |
| `python3 …/vendor-probe.py` | /tmp clean detached checkout | **0**, 내부 vendor 2회 0, 음성 5종은 기대 exit 1/public 불변 | `vendor-probe.log`, `vendor-*.log` |
| `/tmp/worklazy-s2b/font-venv/bin/python scripts/build-qr-label-font-subset.py` | /tmp worktree, bytecode 쓰기 금지 | **0 · cmap3394 / glyph-differences0 / 모든 고정 size/SHA** | `regenerate.log` |
| `node …/bundle-audit.mjs` | /tmp production + sol baseline per-file 기록 | **0 · 5종 재계산·재빌드 값 완전 일치** | `bundle-audit-final.log` |
| `node --experimental-strip-types …/runtime-probe.mjs` | 현행 handler 추출 + 실제 helper/pdf-lib | **0 · 24/24**. React 제품 E2E로 주장하지 않음 | `runtime-probe.log` |
| `node …/lifecycle-probe.cjs` | 실제 abort/error 본문·JSX | **0 · busy true, old storage 차단/new storage 보존** | `lifecycle.log` |
| `node …/browser-probe.mjs` | 실제 Vite helper + S0, 실제 Chrome/HTTP | **0 · font404 reload0, retryKeys0; chunk404 reload1** | `browser-font404.log` |
| `python3 …/mutation-check.py` | /tmp 사본만 변조 | **0 · F1 검출 공백 재현**, 자식 exit는 lease unit0/runtime1, raw-only unit1 | `mutations.log`, `mutation-*.log` |

`test:static` 최초 실패는 숨기지 않는다. validator가 production의 Analytics 구성을 요구하는 반면 sol 지시서는 마지막 dist를 `VITE_LOCAL_QA=1`로 남기라고 했다. `/tmp` production에서 동일 validator가 통과하므로 QA/production 대상 차이로 판정한다. 이 검수에서 원본 repo에 `npm run build`를 실행했다고 주장하지 않는다. sol의 production/QA/clean `npm run build` 원문을 감사했고, 추가로 /tmp에서 vendor·tsc·Vite production·정적 생성·static을 각각 실행했다. 원본 dist는 불변이다.

초기 검수 하네스 실패도 보존했다: checkout 중인 브랜치에 literal `git worktree add … s2b-qr-font`는 exit 128 → **같은 HEAD의 `--detach`**로 해결; 첫 mutation 사본은 gz fixture 누락으로 9/10 → 입력 복사 후 10/10 재현; 첫 bundle 확인은 minifier 출력이 `JSON.parse`인데 `codepoints:[`을 기대한 검사 오류 → 실제 3,394 숫자 배열 내용 대조로 수정. 각각 `worktree-add.log`, `mutant-unit.log`, `bundle-audit.log`에 원문이 있으며 제품 결함으로 계산하지 않는다.

## 4. 전송·렌더·번들 수치 대조

| scenario | sol PDF 단계 전송 B | 이번 결과 | 임베드 OTF |
|---|---:|---|---|
| subset | 1,450,793 | **새 NetLog 측정 1,450,793 · 오차 0%**, ±5% 요구 충족 | 931,704B / `b84d27a5…a252be` |
| full | 5,163,839 | sol `qr/full/metrics.json`의 table/request 합계·로그 일치; smoke는 새로 실행 | 4,644,748B / `69975a0a…148d68` |
| corrupt | 6,095,694 | sol `qr/corrupt/metrics.json`의 table/request 합계·로그 일치; smoke는 새로 실행 | 4,644,748B / `69975a0a…148d68` |

새 subset 단계 표는 entry 409,892 → file-selected 446,426 → generated-manifest 58,485 → pdf-complete 1,450,793B, 누적 **2,365,596B**다. PDF 단계 JS gzip은 **517,854B**, PDF helper 508,174 + font helper 9,680B(QA)다. 보고의 이전 5,153,562B 대비 **−3,702,769B/−71.848733%**가 맞다. 출력 PDF 크기는 폰트 raw byte/HTTP byte와 별도다.

문구 정밀도: sol 보고의 “모든 font request는 PDF 단계”는 **QR 라벨 OTF 요청**으로 한정해야 정확하다. 실제 `fontRequests` 배열에는 entry 단계 UI WOFF2 **36,226B**와 PDF 단계 subset OTF **932,057B**의 2건이 있다. PDF 단계 OTF는 1회이며 이 사실은 감량 수치나 lazy 계약을 깨지 않는다. `qr/subset/metrics.json`에서 직접 확인했다.

`gzip`도 실제 재계산했다: full `gzip -9 -c` **3,733,457B**, full `gzip -n -9 -c` **3,733,434B**, subset `gzip -n -9 -c` **561,161B**와 고정 SHA 일치. 두 full 값의 23B 차이는 헤더 조건 차이며 어느 비교에서도 반올림 **84.97%** 감량이다. raw 감량 **79.940699%**. `gzip.json` 참조.

| fixture | 페이지 | 비교 픽셀 | 변경 픽셀 | PDF.js | 이번 full/subset PDF B |
|---|---:|---:|---:|---|---:|
| sample/A4, 25 | 2 | 4,011,288 | 0 | 동일 | 3,979,131 / 728,659 |
| inventory/A4, 155 | 7 | 14,039,508 | 0 | 동일 | 4,742,244 / 1,491,805 |
| expanded/Letter, 170 | 8 | 15,510,528 | 0 | 동일 | 4,829,716 / 1,579,295 |

sol의 expanded PDF 크기 4,829,717/1,579,298B와 재실행 저장 크기는 −1/−3B 다르지만 폰트·렌더·추출은 같다. PDF 전체 byte equality는 정본 게이트가 아니다. 기존 Poppler descriptor 경고를 그대로 기록했으며 GS 또는 PDF.js의 **입력 문자열 대비** 오류를 고쳤다고 주장하지 않는다.

| 번들 gzip 지표 | baseline | branch 재빌드 | delta | 상한 | 판정 |
|---|---:|---:|---:|---:|---|
| entry | 299,283 | 299,287 | +4 | +20,480 | 통과 |
| affected routes | 2,440,427 | 2,450,827 | +10,400 | +61,440 | 통과 |
| shared | 2,716,489 | 2,716,473 | −16 | +30,720 | 통과 |
| app JS | 5,456,199 | 5,466,587 | +10,388 | +81,920 | 통과 |
| CSS | 37,687 | 37,687 | 0 | +10,240 | 통과 |

baseline `/tmp/s2b-bundle-baseline.json`와 sol `bundle-final.json`의 **각 file gzip/category/route owner**로 합계를 다시 계산했다. branch는 /tmp 새 production 출력에서도 같은 값이다. multiplier 1, override `{}`, 신규 route 0, 동일 SHA의 route→shared 이동 **0B**. `bundle-audit.json`. 이번에는 main 전체를 새로 빌드하지 않았으며 baseline은 보존된 per-file 원자료의 재집계다.

## 5. 고정 자산 전수 대조 및 clean 공급

`sha256sum` 원문은 `logs/sha256sum.log`, size/SHA/2차 regen-a byte equality는 `pins.json`에 있다. 추적 파일은 **5개(목록 포함)**, 합계 **606,249B**다. raw subset OTF는 vendor 전개 산출이다. 정본의 신규 파일 6행(raw 포함)+기존 full/OFL 합산 1행을 8개의 실물 파일로 검사하고 wheel을 별도로 검사했다.

| 파일 | 바이트 | SHA-256 | 결과 |
|---|---:|---|---|
| `scripts/assets/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/NotoSansKR-Regular.ksx1001.otf.gz` | 561,161 | `e1db3cdcbb8d76fc0546ec582bed773b3b7ef3da60867b6828493a6b342c7e66` | 일치 |
| `scripts/assets/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/coverage.json` | 19,686 | `58f248442d4e8e5726559644a746740bd0066cebabf154956e0bb7e1458eafea` | 일치 |
| `scripts/assets/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/coverage.schema.json` | 444 | `919d01b6713b3438f6cd36091d3244a04a28822b031a5cdd7ac135ff3d17e6b0` | 일치 |
| `scripts/assets/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/provenance.json` | 1,201 | `30e10e1815835b8076a100ecdc9804c2613b115b555cbcc0b122150b92f77667` | 일치 |
| `scripts/assets/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/unicodes-alias.txt` | 23,757 | `ac8fefb54a969022fc1b139a3a7a1937f711e71280fb992683eb0d4d43978b0c` | 일치 |
| `public/vendor/qr-label-font/noto-cjk-sans-2.004/NotoSansKR-Regular.otf` | 4,644,748 | `69975a0ac8472717870aefeab0a4d52739308d90856b9955313b2ad5e0148d68` | 일치 |
| `public/vendor/qr-label-font/noto-cjk-sans-2.004/OFL.txt` | 4,301 | `6a73f9541c2de74158c0e7cf6b0a58ef774f5a780bf191f2d7ec9cc53efe2bf2` | 일치 |
| `public/vendor/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/NotoSansKR-Regular.ksx1001.otf` | 931,704 | `b84d27a582d3f3e660db728e7913af3061d4e825e93cabdb6802f0ce23a252be` | 일치 |
| fonttools 4.59.2 wheel / requirements lock | 4,912,766 | `738f31f23e0339785fd67652a94bc69ea49e413dfdb14dcb8c8ff383d249464e` | 일치 |

- full OTF/OFL은 `git show main:public/vendor/qr-label-font/noto-cjk-sans-2.004/...`와 현재 public/dist의 **byte equality**까지 검사했다. full manifest 및 `qrBulk.ts`도 branch diff 0이다.
- clean detached worktree를 만든 직후 vendor를 실행했다. 원본 full/OFL의 검증된 바이트만 해당 worktree의 `.cache/qr-label-font/...`에 넣었다. **subset 공급에는 public 사전 복사나 Python/pip 설치를 사용하지 않았다.**
- vendor 자식 프로세스 PATH는 검수 폴더의 `node/npm/sh`만 남기고 **python3 없음**을 확인했다. NODE_OPTIONS의 사전 import가 fetch를 `NETWORK_DISABLED`로 막는다. 실제 vendor는 Node builtins만 사용한다.
- `npm run vendor:qr-font` **2회 exit 0**, full 3파일+subset 5파일+다른 snapshot sentinel 1파일 = **9 SHA 전부 동일**. `vendor-1.json`, `vendor-2.json`.
- gz 손상, coverage 손상, provenance 손상, coverage 누락은 각각 **exit 1/public 9파일 불변**. full/OFL cache 중 OFL을 없애고 fetch 차단해도 **exit 1/public 불변**. 실패를 통과로 바꾸지 않았고 실패가 기대 결과인 음성 검증으로 기록했다.
- 따라서 보장 범위는 **Node만으로 subset 공급**이다. full/OFL cache까지 없는 완전 offline build를 주장하지 않는다. 원본 upstream/cache 계약은 정본의 명시 제외 그대로다.
- 이후 /tmp worktree의 기존 의존은 읽기 전용 symlink로 재사용하고 `.tmp`/Vite 임시 폴더는 worktree 안에 분리했다. npm/pip 설치는 하지 않았다. 원본 public의 다른 generated runtime은 추가 production 검증을 위해 읽기 전용 링크로만 재사용했다. offline QR vendor 2회 실험은 이 링크 추가 **이전**에 실행했다.
- /tmp production 산출은 검수 폴더의 `production/`에 보존했다. worktree 추적 diff가 비어 있음을 확인하고 임시 worktree만 제거했다. 다른 기존 worktree는 그대로다.

## 6. 제품 규칙 및 범위 밖 변경

`branch.diff`는 전체 `git diff main..s2b-qr-font` 원문이다. `scope-results.json`은 변경 23파일과 불변 범위의 재현 결과이며 `logs/repo-contract-search.log`는 실행 확장자 `ts/tsx/js/mjs/cjs` 재귀 탐색 결과다. 탐색 제외는 Git 메타데이터, 설치 의존(node_modules), generated dist, 벤더 snapshot, docs로 한정했다. 소유자는 각각 Git/npm/build/vendor scripts/문서 작성자이며, 테스트의 내부 오류 주입과 벤더 스크립트 진단은 최종 사용자 화면이 아니므로 별도로 판정했다.

| 항목 | 판정 | 근거·범위 판정 |
|---|---|---|
| GitHub Pages·사용자 파일 전송 없음 | **[통과]** | 제품 변경은 QR TS/TSX 3파일. fetch는 고정 같은 origin 폰트 URL, 입력 텍스트/파일의 서버 전송이나 SSR/API 추가 없음. Node HTTP proxy는 `tests/qr-font-scenarios.mjs`의 검증용 코드로 제품 runtime과 구분. |
| ko/en·SEO·사이트맵·FAQ·광고/분석 격리 | **[통과]** | `git diff … -- src/locales` 0, src/app/public/THIRD_PARTY_NOTICES 및 lock diff 0. 기존 번역키 `features:qr.bulk.errors.pdf/zip` 사용. 경로/도구/SEO 추가 0. production static 통과, 새 QR smoke/계측 외부 요청 0; sol QA a11y/CLS 외부 요청 0. |
| 내부 이름·원시 오류 비노출 | **[통과]** | asset/init 오류는 helper 내부 typed error, panel catch `QrBulkPanel.tsx:365`가 기존 localized PDF 오류로만 표시. 폴백 안내 추가 없음. worker/asset/hash 이름을 렌더하는 추가 JSX 없음. |
| 전체 OTF 상수·경로·바이트 | **[통과]** | `qrBulk.ts:18`의 `QR_LABEL_FONT_PATH` 여전히 전체 OTF. subset은 별도 상수/경로. full/OFL/main byte equality. U4 font 경계 소스 변경 0. |
| 의존·package.json | **[통과]** | baseline/current JSON에서 `scripts.test:qr-font-render`만 제거하면 완전 동일. npm runtime/devDependencies·package-lock 변경 0. `requirements-fonts.txt`는 정본이 승인한 임시 재생성 도구 lock. |
| **.gitignore 1줄** | **[통과] 범위상 정당** | `.gitignore:14`는 **`public/vendor/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/`**만 제외. `git check-ignore -v` 일치, subset public tracked 0. `scripts/assets` 5개는 추적됨. 주의: 기존 full snapshot 3파일은 실제로 **추적 중**이므로 “full도 동일 ignore 방식”은 사실이 아님. 새 subset을 vendor 산출로 비추적하고 gz 입력만 추적하는 정본 공급 계약에는 부합한다. |
| AGENTS.md 8줄 | **[통과] 명시 위임** | 첫 커밋 `c680030`의 모델 역할 분담 절은 sol dispatch가 명시한 기존 Claude 변경 커밋이며 sol의 임의 범위 추가가 아님. |
| CHANGELOG/review-notes | **[통과]** | 코드 변경 1행 Codx와 판정/실측 기록 86행을 분리. 수치는 본 검수와 대체로 일치. 아래 표현 정밀도는 보완 권고. |
| **backlog 2건** | **[통과] 항목 추가는 승인 범위**, 문안 주의 | `docs/backlog.md:28,29` GS descriptor/추출 후속은 정본이 요구한 기록. 다만 “U4 … 구현할 때 … 교정하고”라는 확정형 문장은 **현재 U4 정본을 확대하는 착수 지시가 아니다**. U4와 관련된 별도 후속이라는 원래 취지로 읽어야 한다. 보완 시 “U4 관련 별도 후속으로 범위 확정 후 검증” 정도로 명확히 하는 것이 좋다. 현 S2b 제품 코드에서 GS/PDF.js 수리나 U4 코드 변경은 0. |
| backlog 마지막 빈 줄 삭제 | **[통과] 무해한 부수 변경** | 정본 기능과 무관한 EOF blank-line 1개 삭제. 제품/후속 범위 변경 없음. |
| 생성물 손수정·제외 범위 | **[통과]** | branch의 public/dist/THIRD_PARTY_NOTICES diff 0, source 생성 입력은 pinned regen-a와 byte equality. CSV ExcelJS/JSZip 분리, QR helper 본체 감량, U4 공용 경계 변경, jszip 제거, runtime subset/B/prefetch 추가 없음. |

보고 문구 보완 권고(비차단): “모든 font request”를 “QR 라벨 OTF 요청”으로 구체화한다(§4). 생성 입력의 원자성은 파일별 replace이며 다파일 transaction으로 확대해서 설명하지 않는다. backlog의 U4 관련성도 현재 U4 구현 범위 승인으로 읽히지 않게 한다. 이 세 문구는 F1/F2와 별개의 제품 동작 결함으로 세지 않았다.

열린 계획서 16개를 스캔했다(`logs/open-plan-scan.log`). QR selector와 U4 전체 OTF/미래 공용 import 우선 계약에 구현상 충돌은 없다. 다만 로드맵의 진행 기록 말미에 `3672fc7`/`5485fad`라는 현재 HEAD/main과 다른 해시가 적혀 있다. 검수 기준은 최신 사용자 지시·dispatch·QR 정본의 **93a2318/f29d249**로 고정했고 그 오프라인 문서를 수정하거나 다른 브랜치를 검수하지 않았다.

## 7. sol의 기존 실행 기록 감사

`/tmp/worklazy-s2b/logs` 전 파일의 npm command banner, 마지막 결과, size/SHA 및 mtime을 `sol-log-audit.json`에 저장했다. 숫자 원자료 대조는 `sol-numbers.json`, `sol-request-sums.json`, `sol-recovery-audit.json`에 있다.

| 항목 | 판정 | 원문/아티팩트·시각 |
|---|---|---|
| unit·QR 3종·tsc·static | **[통과] 실행 결과 재확인** | sol unit footer 241/241, qr-bulk-final 3종 expected SHA, static startup104. 빈 tsc.log만으로 과거 실행을 증명하지 않고 이번 tsc 실제 exit0으로 보강. |
| 시각 회귀 | **[통과] 실행·캡처 수 확인** | `visual-ko.log` mtime **2026-09-06T15:50:18.355Z**, `visual-en.log` **15:52:09.763Z**. 각각 고유 capture 이름 175개, footer matched175/175, duration **105.75s/105.33s**. 각 실행은 고정 browser locale의 **ko71/en104** 전체 집합을 돌므로 합계 350은 전체 집합 두 번이다. LANG별로 ko175/en175를 따로 캡처한 것은 아니다. 실패 artifact PNG 0은 정상: `tests/visual-regression.mjs:359`에서 캡처는 수행하되 성공 비교 이미지는 별도 capture 설정 없으면 저장하지 않음. baseline branch diff 0. |
| a11y | **[통과] 실행·원자료 확인** | `a11y.log`와 `a11y.json` measuredAt **15:54:24.498Z**, 8페이지/violations0/external0, limits total0, placeholder 4.8871:1 일치. |
| rendering/CLS | **[통과] 실행·원자료 확인** | rendering JSON mtime **15:54:40.446Z**. 3페이지×3회, maxCLS 모두0, 외부0. |
| recovery | **[통과] 실행·개별 원자료 확인** | log PASS **147**, `/tmp/worklazy-s0/recovery/summary.json` 147 pass:true, 각 case JSON147 존재(+summary1), PNG153. summary 시작 **15:43:50.347Z**, 종료 **15:48:22.457Z**. 검수에서 이 외부 디렉터리는 읽기만 했다. |
| browser·utilities·new-tools·office | **[통과] 실행 로그 확인** | 각 npm banner/성공 footer와 **00:40~00:43 KST** mtime 연속성. browser Excel/Word/PDF, utilities ko/en, new-tools HWP/image/audio/video. new-tools의 DV 실제 호스트 분기는 원문에 skip이며 전 환경 통과로 부풀리지 않음. office 96 download/7 cached/DOCX5089B 일치. |
| production·QA·clean build | **[통과] 실행 로그 확인** | `build-production-final.log`(00:36 KST), `build-qa-final.log`(00:53), `clean-build.log`(00:34) 각각 npm prebuild/build, Vite 성공, **61 localized pages** footer. 이번 /tmp production 재현으로 추가 확인. |
| clean npm ci·vendor | **[통과] 로그 및 추가 재현** | 최초 home-cache EROFS와 /tmp-cache retry를 구분한 원문 존재. vendor 양성/음성은 이번 clean worktree에서 독립 재현(§5). 이번 검수는 npm/pip 설치를 실행하지 않음. |
| sol 주장 “모든 command exit0”의 **과거 프로세스 원시 exit 메타** | **[미검증] 기록 형식 한계** | sol stdout/stderr log는 raw process exit와 환경 전체를 별도 저장하지 않는다. 성공 footer·개별 JSON·mtime으로 실제 수행/성공 경로를 확인했지만 과거 OS exit0 자체를 로그에서 추출했다고 주장하지 않는다. 새 검수 명령은 모두 exit/time JSON을 별도 기록했다. sol의 미실행/조작으로 단정할 근거는 없다. |

이번 검수에서 visual/a11y/recovery/browser 전체를 재실행한 것으로 쓰지 않았다. 지시서가 허용한 기존 로그 감사 범위다. **새로 발견한 F1/F2의 회귀 항목은 기존 로그에 존재하지 않는다.** 기존 포괄 스모크나 이전 계획 반박의 probe 실행은 이 커밋에서 해당 테스트가 구현되었다는 증거를 대신하지 않는다.

## 8. 저장소 불변 증명·인계

첫 도구 호출은 `cat PROJECT_RULES.md`였다. AGENTS/정본 v3+정본화 보강/sol dispatch·REPORT/branch diff/1~3차 반박/운영·기각 기록을 확인했다. 검수 보고서는 이 `/tmp` 파일에만 썼으며 계획서·추적 파일·사용자 파일·원본 dist를 편집하지 않았다. 커밋·push·원본 브랜치 전환·저장소 안 설치 없음.

`python3 /tmp/worklazy-s2b-review/check-invariance.py`의 **최종 실행은 exit 1**이다 (`logs/invariance-final.log`). 16:18:38 UTC 중간 검사에서는 전체 3,078파일이 같았지만, 보고서 작성 중 16:22:30 UTC에 오프라인 문서 2개가 바뀌었다. 최종 16:26:33 UTC 검사가 이를 검출했다. 이 실패를 통과로 덮지 않는다.

```json
{
  "gitEqual": true,
  "startFiles": 3078,
  "endFiles": 3078,
  "changed": [
    "docs/jobs/todo/pdf-finish-20260905.md",
    "docs/jobs/todo/roadmap-completion-20260906.md"
  ],
  "trackedCount": 2373,
  "trackedChanged": [],
  "distCount": 537,
  "distChanged": [],
  "startManifestSha256": "732d11f0f89bf3b4f7c1fbfd2b59b354431c54305e5886105cafff44c5093f08",
  "endManifestSha256": "65f0dadac2916e970d56841b04924d8d3cbdb626591fe6746361b15936eb3aa0"
}
```

변경 2개는 `docs/jobs/todo/pdf-finish-20260905.md`와 `docs/jobs/todo/roadmap-completion-20260906.md`다. 이 검수는 두 경로에 쓰지 않았다. 종료 문서의 Claude 서명 **U4 v10 결정·8차 반박 결과/9차 디스패치** 및 mtime으로 보아 병행 세션의 문서 갱신으로 판단한다(프로세스 작성자를 직접 추적한 것은 아님). 새 내용은 OCG `/Usage`·`/Intent`·`/AS`·`/Configs` 지원 제외와 두 렌더러 oracle이며, QR 폰트 선택/공급이나 S2b 기준 HEAD를 바꾸지 않는다. 원문은 `logs/concurrent-plan-update.log`, 전후 파일별 SHA는 `concurrent-plan-changes.json`에 보존했다.

별도 `scope-audit.py`는 **추적 2,373파일·원본 dist 537파일·QR 정본·사용자 3파일 불변** 및 변경 경로가 위 명시한 오프라인 문서 2개뿐임을 단언한다. 전체 snapshot과 이 범위 판정을 구분한다. 범위는 처음부터 추적 전체 + 원본 dist/public vendor + jobs + 사용자 3파일이었다.

시작/종료 Git 출력도 동일하다:

```text
$ git status --porcelain
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html

$ git rev-parse HEAD main
93a2318d445d78e5283b48be993578f7f061b96c
f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e

$ git branch --show-current
s2b-qr-font
```

`git worktree list --porcelain`도 시작/종료 완전 동일하다. 임시 worktree 추가/제거에 필요한 `.git/worktrees` 관리만 수행했고 원본 브랜치를 옮기지 않았다. 2개의 기존 타 worktree도 그대로다. `start-git.json`, `end-git.json`, `start-files.json`, `end-files.json`, `invariance.json`, `scope-audit.json`이 증거다.

**수정 인계:** sol은 F1/F2의 누락된 회귀 테스트를 추가하고 기존 3 scenario를 보존한 채 unit·QR smoke·tsc·static 및 변경에 필요한 게이트를 실제 실행한다. unit 수/검증 범위가 달라지므로 CHANGELOG·review-notes·구현 보고도 맞춘다. 제품 동작이나 자산을 임의로 다시 설계할 필요는 없다. 재검수에서는 실제 제품 함수/HTTP 경계를 시험하는지와 owner-guard 제거 음성 대조가 실패하는지를 우선 확인한다.

**[수정 후 재검수] — 보통 2건: F1 export 수명주기 동작 회귀 테스트, F2 폰트404/S0 및 export 취소 브라우저 회귀 단언.**
