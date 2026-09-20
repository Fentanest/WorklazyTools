# S2b QR 라벨 PDF 폰트 감량 — astra 재검수

작성: **Codx**, 2026-09-07 KST. 대상: `s2b-qr-font`, **HEAD `249e1727b44fa84ca8635741e1214cc1a9902591`**, main `f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e`.

**판정: [수정 후 재검수] — 보통 1건(F1-R: 마지막 다운로드 task 경계의 지속 회귀 테스트 누락).**

요청한 우선 확인 결과는 모두 재현됐다. 실제 제품 handler를 실행하는 새 unit은 소유권 가드 제거를 검출한다. 폰트 OTF 404→full 1회·reload 0·S0 retry key 0·실제 청크 404 reload 1·export 결과 교체 취소 stale 다운로드 0도 실제 HTTP/브라우저 스모크에서 통과했다. 기존 subset/full/corrupt 3 scenario, 제품 코드 변경 0, CHANGELOG/review-notes 보강을 확인했다.

그러나 **1차 F1 수정 인계가 명시한 마지막 download task 경계**는 지속 unit에 들어오지 않았다. 해당 제품 코드 한 줄을 제거한 사본에서도 QR unit **15/15**가 통과한다. 같은 사본에서 PDF 완료와 함께 취소 task를 큐에 넣는 실제 handler 재현은 **stale 다운로드 1건, 기대 0건**으로 실패한다. 무변조 제품은 같은 검사를 포함해 runtime **24/24**로 통과했다. 현재 제품 결함으로 오인하지 않도록, 테스트 누락과 실제 구현 판정을 분리한다.

전체 unit **246/246**, QR bulk, tsc, static, CSS, registry, diff 검사는 통과했다. subset PDF 단계 **1,450,793B(보고 대비 오차 0%)**, 렌더 **17페이지·33,561,324픽셀 차이 0·PDF.js 추출 동일**, 고정 자산과 번들 5종도 재현됐다. 원본 저장소의 **추적 2,373파일·dist 537파일·QR 자산·열린 계획서·사용자 파일을 포함한 2,934파일 SHA 및 HEAD/main/status는 불변**이다. 임시 worktree를 제거했다.

## 1. F1·F2 판정

| 항목 | 판정 | 재현 명령·출력 | 수정 필요 시 지시 문안 |
|---|---|---|---|
| F1 실제 제품 handler 실행 | **[통과]** | `tests/unit/qr-label-font.test.ts:166,287,316`이 현행 `QrBulkPanel.tsx`의 ZIP/PDF/cancel/cleanup/export helper 본문을 추출하고 `ts.transpileModule`·`new Function`으로 실행한다. import와 외부 입출력만 시험 의존으로 대체한다. 실제 `downloadZip`→cleanup→`downloadPdf`→옛 ZIP 실패/finally 순서를 실행하고 새 exporting/ref·옛 오류 0·다운로드를 단언한다. 전체 unit 246/246. | 없음 |
| F1 소유권 가드 제거 음성 대조 | **[통과]** | `python3 /tmp/worklazy-s2b-review2/mutation-check.py` → lease unit **exit 1, 13 pass/2 fail**, 실제 assertion **`'' !== 'pdf'`**. `logs/mutation-lease-unit.log:59`. 동일 변조 runtime도 exit 1. 두 unit 실패 중 하나는 실제 소유 상태 assertion, 다른 하나는 내부 mutation-control 준비 조건의 가드 개수 assertion이다. | 없음 |
| F1 cancel·cleanup·run 폐기·storage 분리·busy | **[통과]** | unit `:180,202,232,252`에서 저장 중 cancel, clear 지연 중 storage 선행 분리·교체 storage 보존, run abort/error 실제 분기의 controller abort/dispose/ref/results, 실제 JSX disabled 식을 실행한다. `logs/unit-final.log` 해당 테스트 전부 PASS. | 없음 |
| **F1-R 마지막 다운로드 task 회귀 누락** | **[결함] 보통 · 검증 [누락]** | `python3 /tmp/worklazy-s2b-review2/final-task-mutation.py` → 제품 `QrBulkPanel.tsx:359`의 마지막 `await new Promise<void>((resolve) => setTimeout(resolve, 0));`만 제거. 커밋된 QR unit은 **exit 0, 15/15**. 같은 제품 handler의 queued cancellation 재현은 **exit 1, `1 !== 0`**, stale 다운로드 1. 무변조는 `runtime-probe.mjs` 24/24. 아래 재현 설명 참조. | 새 의존·제품 변경 없이 지속 unit에 “PDF helper가 Blob을 반환하면서 `setTimeout(() => panel.cancel(), 0)`을 큐에 넣음 → download 0·message 0·export lease 해제”를 추가한다. 현재 제품에서 통과하고 마지막 task 양보 제거 사본에서 **다운로드 결과 단언이 실패**하도록 한다. 1차 F1이 함께 지정했던 unmount·지연 import/storage·동기 중복 클릭도 누락 여부를 점검하여 실제 결과 단언으로 남긴다. |
| F2 실제 OTF 404 / S0 분리 | **[통과]** | `npm run test:qr-bulk` → font404 fontRequests=`[subset,full]`, full raw embedded **4,644,748B / 69975a0a…148d68**, reloads=0, retryKeyCount=0. `tests/qr-font-scenarios.mjs:62,82` Node HTTP 서버의 정확한 OTF 경로에 404; `qr-bulk-smoke.mjs:130,152,167` navigation/sessionStorage 단언. page.route/fetch mock 없음. | 없음 |
| F2 청크 404 양성 대조 | **[통과]** | smoke `:228` 이후 실제 `dist/assets/qrLabelPdf-BDBIICEl.js` 요청만 HTTP 404로 응답. injection 1회·top-frame reload **1**·PDF 다운로드 없음. 수동 reload 호출이나 synthetic preloadError 대체가 아니다. | 없음 |
| F2 export 진행 중 결과 교체 취소 | **[통과]** | smoke `:176` 이후 subset 응답을 HTTP 서버에서 보류, export 준비/disabled 확인, 새 CSV 선택으로 제품 cleanup 실행, 응답 release, 새 결과 생성. staleDownloads=0, exportingReleased=true, 요청은 **subset 1회뿐(full 0)**, retry key 0. | 없음 |
| 기존 3 scenario 보존 | **[통과]** | smoke subset/full/corrupt 각각 25라벨·2p·OTF stream 1개·decoded size/SHA 통과. 기존 생성 취소/재실행·7 payload·PNG ZIP 2개·2-sheet manifest·외부 요청 0도 통과. metrics의 공개 scenario는 여전히 3종이며 font404는 별도 browser scenarios에만 추가. | 없음 |

**F1-R의 근거 범위:** 1차 보고 `/tmp/worklazy-s2b-review/REPORT.md:13`은 “마지막 download task 경계·동기 중복 클릭도 실제 결과…로 고정”하도록 명시했다. 정본 R2-1과 D5에도 최종 Blob 뒤 task 양보·취소 시 stale 0 계약이 있다. `s2b-fix1-dispatch.md` §2에 열거된 핵심 항목은 반영됐지만, 재검수 지시의 정본/1차 소견 누락 대조까지 완료됐다고 판정할 수는 없다. 새 제품 정책이나 일반적인 mutation 점수 상향 요구가 아니다.

현재 cancel unit은 **미완료 save promise를 먼저 취소하고 나중에 resolve**한다(`:180–200`). 마지막 task를 삭제해도 그보다 앞선 `assertExport`에서 종료되므로 해당 회귀를 검출하지 못한다. 새 harness의 mountedRef는 true로 고정되고 제품 effect cleanup은 추출하지 않으며(`:316–365`), 동기 중복 호출도 실행하지 않는다. 이 관찰을 별도 결함 수로 부풀리지 않았다. 차단 근거로 제시한 구체 재현은 마지막 task 한 줄이다.

```sh
# 소유권 가드 제거: 이제 지속 unit이 검출한다.
python3 /tmp/worklazy-s2b-review2/mutation-check.py
# {"lease":{"unitExit":1,"runtimeExit":1},"raw":{"unitExit":1}}
# lease: 13 pass / 2 fail; '' !== 'pdf'

# 마지막 task 제거: 아직 지속 unit이 검출하지 못한다.
python3 /tmp/worklazy-s2b-review2/final-task-mutation.py
# unitExit: 0, unitPass: 15
# runtimeExit: 1, queued cancel task: stale download 1, expected 0
```

원문: `logs/mutation-final-task-unit.log`(15 pass/0 fail), `logs/mutation-final-task-runtime.log:29`(`1 !== 0`), `final-task-mutation-results.json`. 생성/변조는 모두 이 검수 폴더의 사본에서만 했다. 1차 `mutation-check.py`는 출력 경로와 “옛 unit이 통과한다”는 기대값만 현 재검수 목적에 맞춰 바꿨다. 변조 대상과 실제 함수 재현은 유지했으며, 원 기대값 버전도 `mutation-check-original.py`에 보존했다.

## 2. 정본 대비 대조

아래 행 번호는 HEAD 249e172 기준이다. 재검수에서 제품 코드가 93a2318과 동일함을 먼저 확인했다.

| 항목 | 판정 | 구현 위치·명령/출력 | 수정 지시 |
|---|---|---|---|
| D1 고정 도구·retain-gids·glyph oracle | **[통과] [일치]** | `scripts/requirements-fonts.txt:1`, 생성기 `:40,60,103,128,155`. 기존 /tmp venv로 생성기 재실행 **cmap3394/size931704/gzip561161/glyph-differences0**. 실제 cmap exact equality·GID/hmtx/RecordingPen 비교 후 고정 SHA 검사. | 없음 |
| D1 Poppler/PDF.js | **[통과] [일치]** | `tests/qr-font-render-regression.mjs:93`, `qrLabelPdf.ts:20` subset:false. 렌더 스크립트 3 fixture/17p/픽셀 차이0/추출 동일. GS와 입력 대비 PDF.js 오류는 기존 한계·backlog. | 없음 |
| D2 3,394·원문+NFC·schema·U+2026 | **[통과] [일치]** | `qrLabelFont.ts:31,57,69`, unit `:20,39,49`. 목록/coverage exact equality. NFD 11,172 전수, raw-only mutation 2건 실패. runtime shaping 오판 8,822→0. draw 문자열은 NFC로 바꾸지 않음. | 없음 |
| D2 coverage JS 귀속 | **[통과] [일치]** | `bundle-audit.mjs`: helper 실제 JS에 3,394 배열 포함, **22,278B/gzip9679B**, category route, owner qr-studio. | 없음 |
| D3 lazy factory·snapshot·캐시·HTTP | **[통과] [일치]** | `QrBulkPanel.tsx:309,318`, `qrLabelFont.ts:89,98,128`: 클릭 후 import, panel별 cache, 검증 성공 ArrayBuffer 최대2개, dispose, 실패 cache 금지, 기본 HTTP cache. unit/runtime 재현 PASS. | 없음 |
| D3 양보·optional signal | **[통과] [일치]** | `qrLabelFont.ts:59,73,93,98`: 8,192코드/8ms·양보 후 abort, 생략 signal도 허용. `qrLabelPdf.ts:12,30` 페이지 경계 signal 검사. | 없음 |
| D3 폰트/S0 실패 분리 | **[통과] [일치]** | HTTP font404 reload0/key0, 실제 helper chunk404 reload1. F2 신규 브라우저 실행 증거 확보. | 없음 |
| D4 공급·staging·고정 자산 | **[통과] [일치]** | vendor `:25,32,36,43,61,75`: 입력/gunzip/OTF/coverage/provenance/full/OFL 검증 후 소유 snapshot2개 교체. Node-only clean vendor 2회 SHA 동일, 손상4종 실패/public불변. | 없음 |
| D5 typed 폴백·예외 | **구현 [통과] [일치], 지속 검증 일부 [누락]** | `qrLabelPdf.ts:13,18`: create는 catch 밖, register/embed만 typed; PNG/draw/save 밖. panel `:343,349,352` Promise.all·typed subset만 full1회·entries 재사용. 현재 runtime24/24. 마지막 task 지속 회귀는 F1-R. | F1-R |
| D6 B/C 판정 | **[통과] [일치]** | `docs/review-notes.md:49` B 미채택 사유, panel `:318,329,340` 클릭 이후 3분기 병렬화. 클릭 전 prefetch 없음. 외부 표준 최신성을 새로 조사한 판정은 아님. | 없음 |
| R2-1 공용 lease·무효화·최종 task | **구현 [통과] [일치], 지속 검증 일부 [누락]** | panel `:99,240,249,264,277,309,359,370,391,399,481`. owner mutation 검출, cancel/cleanup/run 동작 unit PASS. 최종 task 무변조 runtime PASS/제거 mutation에서 지속 unit 검출 실패. | F1-R |
| R2-2 PDF 구조와 폰트 pin | **[통과] [일치]** | `qr-font-scenarios.mjs:44`, smoke `:154`: %PDF·load·2p·OTTO1·size/SHA, 임의1MB 하한 없음. full/corrupt도 full SHA. | 없음 |
| 복사 금지 ① busy | **[통과] [일치]** | panel `:469`, unit `:252` 실제 JSX 식: busy true→disabled true, idle→false. | 없음 |
| 복사 금지 ② storageRef 선행 분리 | **[통과] [일치]** | panel `:243,252,488`, unit `:202,232`: clear 지연 중 undefined, 새 storage 보존, export 무효화. | 없음 |
| 복사 금지 ③ optional signal | **[통과] [일치]** | selector/loader 내부 모두 optional, 신호 생략 load/cache/dispose unit 통과. panel은 active controller.signal 전달. | 없음 |
| 스모크/계측 3 scenario | **[통과] [일치]** | `qr-font-scenarios.mjs:15,24,31,37`, metrics `:13,14,88,157,215`: 기존 subset/full/corrupt·기본subset·오타 거부·25행 Label의 똠1자·실제 HTTP200 동일크기1byte변조·NetLog/cacheoff/SWblock 유지. subset 계측 재실행 PASS. | 없음 |
| 해시표·backlog·기록 | **[통과] [일치]** | `OFFICE_EDITOR_ASSETS.md:35` 역할별 해시표, backlog `:28,29` GS/PDF.js2건, CHANGELOG `:7`, review-notes `:21,37,93–97`. | F1-R 보강 후 실제 테스트 수·결과 추가 |

## 3. 실제 재실행 명령

모든 새 검증은 `run.py`가 command/cwd/start/end/seconds/exit를 `logs/<name>.json`에 저장하고 stdout/stderr를 `.log`에 보존했다. TMPDIR/npm cache는 이 검수 폴더 안이다. `/tmp/.../wt`는 동일 HEAD의 detached checkout이며 제거 완료했다.

| 명령 | 대상 | exit·출력 | 로그 이름 |
|---|---|---|---|
| `npm run test:unit` | /tmp checkout | **0, 246/246**, fail/skip0, 3.497s | unit-final |
| `npm run test:qr-bulk` | /tmp checkout·원본 QA dist 읽기 | **0**, 기존3종+font404/cancel/chunk404, 56.057s | qr-bulk |
| `npx --no-install tsc -b --pretty false` | /tmp checkout·별도 node_modules/.tmp | **0**, 진단0, 20.544s | tsc |
| `npm run test:static` | 보존 production + 현행 validator | **0**, localized/runtime/ads/robots/sitemap/startup104, 1.069s | static |
| `node tests/tool-registry-routes.mjs` | /tmp checkout | **0**, expected20/missing0/unexpected0/duplicate0 | registry |
| `npm run css:orphans` | /tmp checkout | **0**, orphan selector arm0 | css |
| `git diff --check main..HEAD` / `git diff --check` | checkout / 원본 | **0 / 0** | diff-check / diff-working |
| `npm run measure:qr -- --scenario=subset` | /tmp checkout·원본 QA dist 읽기 | **0**, PDF transfer1,450,793B, 11.271s | metrics-subset |
| `npm run test:qr-font-render` | /tmp 제품/helper·벤더 자산 | **0**, 3fixtures/17p/33,561,324px/diff0/textEqual, 39.789s | render |
| `python3 .../vendor-probe.py` | clean detached checkout | **0**, vendor양성2회0·9파일 동일, 손상4종/캐시누락은 기대1/public불변 | vendor-probe, vendor-* |
| `env PYTHONDONTWRITEBYTECODE=1 /tmp/worklazy-s2b/font-venv/bin/python scripts/build-qr-label-font-subset.py` | /tmp checkout | **0**, cmap3394/glyph-differences0, 3.806s | regenerate |
| `python3 .../pins.py` / `sha256sum` | 원본 파일 읽기 | **0**, 표7행+wheel 전수일치, source5개606,249B | pins, sha256sum |
| `node .../bundle-audit.mjs` | 보존production 실제 바이트+baseline per-file | **0**, 5종 재계산·coverage귀속 PASS | bundle-audit |
| `node --experimental-strip-types .../runtime-probe.mjs` | 현재 실제 handler 본문·helper | **0**, 24/24 | runtime |
| `python3 .../mutation-check.py` | /tmp 변조사본 | **0**, 내부 lease/unit1·runtime1, raw/unit1(기대 실패) | mutation, mutation-* |
| `python3 .../final-task-mutation.py` | /tmp 변조사본 | **0**, 검증 공백 재현: unit0/15pass, runtime1/stale1 | final-task-mutation |
| `python3 .../scope.py` / `python3 .../numbers.py` | 원본/sol로그 읽기 | **0 / 0**, 변경범위·수치 직접 대조 | scope / numbers |

**정적 검사/빌드 범위:** 테스트·기록만 바뀌었으므로 production은 1차 검수에서 93a2318의 제품으로 만든 `/tmp/worklazy-s2b-review/production`을 읽었다. `src/`·빌드 스크립트·자산·package.json은 그 HEAD와 byte 동일하다. 현 QA dist는 analytics를 제외하므로 production static validator의 대상으로 혼용하지 않았다. 이번에 `npm run build`를 새로 실행했다고 주장하지 않는다. production/QA/clean build의 과거 로그는 아래 감사 범위이고, static 전체 validator와 번들 바이트 집계는 이번에 실제 실행했다.

**숨기지 않은 최초 실패:** 첫 unit은 **242 pass/4 fail, exit1**이었다(`logs/unit.log`). 검수자가 같은 /tmp checkout에서 vendor 음성 입력 변조와 unit을 동시에 실행해 coverage 스냅샷을 읽는 시점이 겹쳤다. 네 실패는 coverage/schema/NFC/양보 단언이다. vendor 음성 실험 종료·입력 원복 및 git tracked diff0 확인 후 다른 source 변조 없이 전체 unit을 다시 실행하여 **246/246**으로 통과했다. 검수 하네스의 격리 오류이며 제품 수정으로 해결하지 않았다. 원 실패 로그를 보존한다.

## 4. 자산·공급·제품/범위 규칙

`pins.json`과 `logs/sha256sum.log`가 정본의 실물 byte 대조다. 아래 신규6행(raw 산출 포함)+기존full/OFL 합산1행을 검사하고 wheel을 별도로 검증했다.

| 파일 | bytes | SHA-256 |
|---|---:|---|
| unicodes-alias.txt | 23,757 | ac8fefb54a969022fc1b139a3a7a1937f711e71280fb992683eb0d4d43978b0c |
| subset OTF | 931,704 | b84d27a582d3f3e660db728e7913af3061d4e825e93cabdb6802f0ce23a252be |
| subset OTF.gz | 561,161 | e1db3cdcbb8d76fc0546ec582bed773b3b7ef3da60867b6828493a6b342c7e66 |
| coverage.json | 19,686 | 58f248442d4e8e5726559644a746740bd0066cebabf154956e0bb7e1458eafea |
| coverage.schema.json | 444 | 919d01b6713b3438f6cd36091d3244a04a28822b031a5cdd7ac135ff3d17e6b0 |
| provenance.json | 1,201 | 30e10e1815835b8076a100ecdc9804c2613b115b555cbcc0b122150b92f77667 |
| full OTF | 4,644,748 | 69975a0ac8472717870aefeab0a4d52739308d90856b9955313b2ad5e0148d68 |
| OFL | 4,301 | 6a73f9541c2de74158c0e7cf6b0a58ef774f5a780bf191f2d7ec9cc53efe2bf2 |
| fonttools4.59.2 wheel | 4,912,766 | 738f31f23e0339785fd67652a94bc69ea49e413dfdb14dcb8c8ff383d249464e |

신규6개 실물은 R2 regen-a와도 byte 일치한다. full/OFL은 `git show main:<path>`와 byte 일치한다. 목록 LF없음·coverage3394/정렬/중복0/U+2026·gunzip→raw 일치도 검사했다.

clean supply는 `git worktree add --detach .../wt 249e172...`로 시작했다. 원 브랜치는 이미 체크아웃돼 있으므로 다른 브랜치 전환 없이 같은 커밋을 detached로 읽었다. 기존 의존을 읽기 링크하고 TypeScript cache는 별도 디렉터리로 뒀으며 npm/pip 설치는 하지 않았다. full/OFL의 기존 검증 cache만 복사했다. **node/npm/sh만 있는 PATH(python3 없음), global fetch 차단** 상태에서 `npm run vendor:qr-font` 2회 exit0·전체/서브셋8파일+소유외sentinel1개 SHA 동일. gz/coverage/provenance 손상과 coverage 누락4종은 각각 exit1/public불변. full/OFL cache가 없으면 네트워크가 필요하다는 기존 제외도 음성 대조로 확인했다. Python/network 독립 주장은 **subset 공급**에 한정한다.

수정 커밋의 전체 diff는 **5파일 +502/−30**, 테스트3개와 기록2개뿐이다(`fix.diff`, `scope.json`). `git diff 93a2318..HEAD -- src/`는 빈 출력이다. main 대비 제품 변경도 QR3파일뿐이고 locales/package-lock/격리 경로/SEO입력은 변경0이다. package.json은 **test:qr-font-render script1개** 외에 구조적으로 동일해 신규 runtime/devDependency0이다. `QR_LABEL_FONT_PATH` 전체OTF 의미·경로·바이트 불변, 기존 현지화 오류만 사용한다. QR helper 호출을 실행 확장자별 repo-wide rg로 검사했고 명시 허용 파일은 QR제품3개+QRunit1개뿐이다(`scope.py`, `logs/qr-callers.log`). docs/generated/vendor/dependencies는 각각 기록/생성/벤더/설치물이라는 소유 목적의 비제품 예외다.

범위상 설명할 추가 변경은 다음과 같다.

- `.gitignore:14`의 **`public/vendor/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/` 1줄**: D4의 Node 생성물을 추적하지 않기 위한 정당한 변경. 새 subset public 추적0, source 입력5개 추적. 기존 full snapshot의 추적 상태까지 새 subset과 같다고 주장하지 않는다.
- `AGENTS.md` 모델 역할8줄: 초기 구현 dispatch가 별도 첫 커밋으로 명시한 위임 변경이다.
- backlog2건과 끝 빈 줄1개 삭제: GS/PDF.js 후속은 정본 지시, 빈 줄은 동작 영향0. “U4에서 교정” 문안은 후속 후보이며 현재 U4 범위의 추가 승인으로 해석하지 않는다.
- review-notes의 “QR 라벨 OTF 요청”·“파일별 os.replace” 정정과 F1/F2 기록 추가, CHANGELOG 기존항목 한 구절 보강은 수정 dispatch와 일치한다. 기존241 결과는 당시 실행 기록이고 appended246 결과와 구분돼 있다.

## 5. 감량·렌더·번들 수치 대조

`numbers.py`가 sol metrics의 request별 전송량을 다시 합산하고 로그·보고값과 비교했다. subset은 새 NetLog 측정까지 재현했다.

| scenario | sol PDF 단계 B | 이번 검수 | embedded raw OTF |
|---|---:|---|---|
| subset | 1,450,793 | **새 측정1,450,793, 오차0%**, ±5% 충족 | 931,704B / b84d27a5…a252be |
| full | 5,163,839 | 원자료 request합계·로그 일치, 새 smoke SHA 통과 | 4,644,748B / 69975a0a…148d68 |
| corrupt | 6,095,694 | 원자료 request합계·로그 일치, 새 smoke SHA 통과 | 4,644,748B / 69975a0a…148d68 |

새 subset 누적은 2,365,596B, PDF 단계 JS gzip은 517,854B다. 이전 S2 5,153,562B 대비 **−3,702,769B/−71.85%**. full gzip -9는3,733,457B, -n -9는3,733,434B로 헤더조건23B 차이, subset -n -9는561,161B/고정SHA 일치. 반올림 gzip감량84.97%, raw79.94%를 재계산했다. UI WOFF2 entry 요청은 QR 라벨 OTF의 PDF단계 계약과 구분한다.

| 새 렌더 fixture | pages | pixels | changed | PDF.js |
|---|---:|---:|---:|---|
| sample/A4/25 | 2 | 4,011,288 | 0 | 동일 |
| inventory/A4/155 | 7 | 14,039,508 | 0 | 동일 |
| expanded/Letter/170 | 8 | 15,510,528 | 0 | 동일 |

PDF 전체 저장 크기는 실행에 따라 sol 대비 1–4B 차이가 있지만 전체 PDF byte equality는 게이트가 아니다. 폰트 pin·렌더·추출 oracle은 충족했다. Poppler descriptor 경고는 로그에 보존했고 GS tofu/PDF.js 입력대비 오류를 해결했다고 주장하지 않는다.

| 번들 gzip 지표 | baseline | branch 실제 집계 | delta | 상한 |
|---|---:|---:|---:|---:|
| entryJsGzip | 299,283 | 299,287 | +4 | +20,480 |
| affectedRouteJsGzip | 2,440,427 | 2,450,827 | +10,400 | +61,440 |
| sharedJsGzip | 2,716,489 | 2,716,473 | −16 | +30,720 |
| appJsGzip | 5,456,199 | 5,466,587 | +10,388 | +81,920 |
| cssGzip | 37,687 | 37,687 | 0 | +10,240 |

baseline `/tmp/s2b-bundle-baseline.json`과 sol `/tmp/worklazy-s2b/bundle-final.json`의 file별 gzip/category/owner를 재집계했다. branch는 보존production의 실제 JS/CSS 바이트에서도 재측정해 동일했다. override없음/multiplier1/신규route0/route→shared이동0B. coverage JSON의 실제 숫자 배열이 QR helper JS에 포함된 것도 확인했다. 이번에 main/branch를 새 빌드한 값으로 표기하지 않는다.

## 6. 기존 광역 게이트 로그 감사

`sol-log-audit.json`에 원본 로그별 command banner·SHA·mtime·결과 footer를 새로 기록했고, `numbers.json`으로 구조화 원자료를 대조했다. 아래 시각은 UTC(한국시간+9시간)다.

| 항목 | 판정 | 실제 확인한 근거 |
|---|---|---|
| visual | **[통과] 실행/캡처 로그** | ko 로그 15:50:18.355Z, en 로그15:52:09.763Z, 각각 고유175개·index1–175·matched175/175·105.75s/105.33s. 각 실행의 구성은 ko71/en104 전체집합이므로 전체집합2회다. 성공 PNG는 captureDirectory 없으면 저장하지 않는 `visual-regression.mjs:359`에 따라 산출PNG0이 정상. baseline diff0. |
| a11y | **[통과] 로그/JSON** | 15:54:24.498Z, 8페이지/violations0/external0/total limit0, contrast4.8871:1 일치. |
| recovery | **[통과] 로그/개별 원자료** | 147 PASS, summary147 pass:true, case JSON147+summary1, PNG153. 시작15:43:50.347Z~종료15:48:22.457Z. |
| rendering | **[통과] 로그/JSON** | 15:54:40.446Z, 3페이지×3samples, 페이지별 maxCLS0, 외부0. |
| browser/utilities/new-tools/office | **[통과] 실행 로그** | npm banner와 성공 footer·mtime 순서 확인. Excel/Word/PDF, ko/en utilities, HWP/image/audio/video, office96download/7cache/DOCX5089B. 호스트 미지원 Dolby Vision 실제 분기는 원문상 skip이며 전환경 성공으로 확대하지 않음. |
| production/QA/clean build | **[통과] 실행 로그** | prebuild/build banner, Vite 성공, 61localized pages footer. production15:36:44Z/QA15:53:54Z/clean15:34:39Z. |
| 과거 OS 프로세스의 raw exit0 | **[미검증] 로그 형식 한계** | sol 로그에는 별도 raw exit/env 메타가 없다. 성공 footer·결과 JSON·타임스탬프로 실행 성공경로는 확인하지만 과거 OS exit코드를 직접 복원했다는 주장은 하지 않는다. 1차에서 이미 기록한 한계이며 미실행으로 단정할 근거는 없다. 새 검수 명령은 모두 exit/time JSON 보존. |

위 광역 브라우저 게이트들을 이번에 다시 실행했다고 표기하지 않았다. 지시가 허용한 기존 로그 감사다. 재검수 의무 unit/qr-bulk/tsc/static 전체와 표3의 명령은 새로 실행했다.

## 7. 종료 상태·인계

`PROJECT_RULES.md`를 첫 도구 호출로 전문 읽고 branch AGENTS/정본v3·보강/dispatch/구현 및 수정·1차 검수 보고/반박 산출/관련 운영·기각 기록을 확인했다. 열린 계획16개를 스캔했다. U4의 미래 공용 `pdfFontEmbed` 우선·전체OTF 유지와 현재 QR selector 사이에 상반된 구현 지시는 없다. 로드맵의 말미 `3672fc7`/`5485fad`는 현 ref와 불일치하므로 최신 사용자 dispatch의 **249e172/f29d249**로 고정해 검수했고 계획서는 수정하지 않았다.

`python3 /tmp/worklazy-s2b-review2/invariance.py` → **exit0**. 비교 범위2,934파일의 변경0, 추적2,373변경0, dist537변경0, QR정본/사용자3파일불변. `before.json`, `after.json`, `invariance.json`에 파일별 SHA와 Git 원문을 보존한다. 원본 저장소 파일 수정·커밋·push·dist 변경·브랜치 전환·저장소 안 설치는 하지 않았다. worktree 추가/제거에 필요한 Git 관리 메타만 사용했다.

시작/종료 출력:

```text
$ git status --porcelain
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html

$ git rev-parse HEAD main
249e1727b44fa84ca8635741e1214cc1a9902591
f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e

$ git branch --show-current
s2b-qr-font
```

수정 인계는 **F1-R의 지속 동작 테스트 보강**이다. 이미 통과한 제품 코드와 자산을 변경할 필요는 없다. 현행 제품/owner mutation/final-task mutation을 구분해 양성·음성 결과를 남기고, unit·QR·tsc·static 및 기록 수치를 갱신한 뒤 재검수한다.

**[수정 후 재검수] — 보통 1건: F1-R.**
