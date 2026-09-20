# S2b QR 라벨 PDF 폰트 감량 — 3차 검수

작성: **Codx**, 2026-09-07 KST. 브랜치 `s2b-qr-font`, HEAD **`71a6200aaefed34a8fbf4524faf4e4068370decc`**, main `f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e`.

**판정: [수정 후 재검수] — 보통 1건, F2-R: QR 스모크의 재생성 완료 대기 누락.**

요청한 **F1-R은 해소**됐다. 새 unit은 실제 PDF handler를 실행하고, 최종 task 양보 제거 시 **15 pass/1 fail, `1 !== 0`**으로 실패한다. 기존 소유권 가드 제거도 **14 pass/2 fail, `'' !== 'pdf'`**으로 검출한다. Claude 서명 문단은 지시서와 **1,377 UTF-8 bytes 전부 일치**하며 내용 변경 0이다. 전체 unit **247/247**, tsc·static·CSS·registry·diff 검사, 자산 SHA, subset 계측 **1,450,793B**, 렌더 **17페이지·33,561,324픽셀 차이 0**, 번들 5종을 재현했다. 두 수정 커밋의 **제품 코드 변경은 0**이다.

그러나 커밋된 `npm run test:qr-bulk`는 **두 번 모두 exit 1**이었다. 둘째는 다른 테스트를 병행하지 않은 단독 실행이다. 실패는 `tests/qr-bulk-smoke.mjs:218`의 `{present:true, disabled:false}` 단언에서 실제 `disabled:true`가 관측된 것이다. 제품은 결과를 먼저 표시하고 manifest 생성 완료 뒤 busy를 해제한다. 스모크는 결과 개수만 기다려 이 중간 상태를 export lease 미해제로 오판한다. `/tmp` 사본에서 **생성 완료 대기를 추가하고 기존 단언을 유지**하면 모든 HTTP·취소·청크 검사가 끝까지 통과한다. 이 사본의 성공을 커밋된 스모크 통과로 대체하지 않는다.

## 1. 우선 검수 및 수정 필요 사항

| 항목 | 판정 | 재현 명령·출력 | 수정 필요 시 지시 문안 |
|---|---|---|---|
| F1-R 실제 handler·완성 Blob 뒤 취소 task | **[통과] [일치]** | `npm run test:unit` → 247/247. `tests/unit/qr-label-font.test.ts:202`는 PDF helper에서 Blob 반환과 함께 `setTimeout(panel.cancel,0)`을 큐에 넣고 download0/message0/exporting빈값/active없음/dispose1을 검사. harness `:341`가 현행 제품 함수 본문을 추출·변환해 실행한다. | 없음 |
| F1-R 양보 제거 mutation | **[통과]** | `python3 final-task-mutation.py` → 자식 QR unit **exit1, 15 pass/1 fail**, `logs/mutation-final-task-unit.log:77,86`; 실제 handler 보조 runtime도 **exit1, `1 !== 0`**. 제거 대상은 panel `:360` 한 줄뿐. | 없음 |
| F1 공용 lease mutation | **[통과]** | `python3 mutation-check.py` → `finishExport` 소유권 가드만 제거한 자식 unit **exit1, 14 pass/2 fail**; 실제 새 PDF 상태 assertion `'' !== 'pdf'` 실패. 두 번째 실패는 unit 내부 mutation 준비 조건의 가드 개수 assertion이다. 무변조 runtime24/24. | 없음 |
| Claude 문단 원문 보존 | **[통과]** | `python3 paragraph-check.py` → `equal:true, changes:0, utf8Bytes:1377`; SHA `80192cb2ccf8721957848ba432ccf5c0d1e44008b2c51381b850d0249a7437cb`. fix-2 dispatch의 인용 표시 `> `만 제외하고 `docs/review-notes.md:101`과 exact equality. | 없음 |
| F2 폰트404→full1·reload0·retry key0 | **[통과]** | 원본 스모크의 `:130–172`가 실제 HTTP 응답/요청·OTF SHA를 검사하고 이후 `:218`까지 진행. 진단 사본의 완주 로그도 `[subset,full]`, full4644748B/69975a0a…, reload0/key0 기록. 서버 `qr-font-scenarios.mjs:81`의 정확한 OTF 경로만 404, page.route/fetch mock 없음. | 없음 |
| F2 결과 교체 export 취소·청크404 대조 | **기능 [통과], 원본 전체 검증은 아래 [결함]** | 대기 보강 사본에서 취소 stale0/full요청0/lease해제, 실제 qrLabelPdf chunk404 injection1/reload1/PDF없음/외부요청0. 원본 실행은 그 이전 `:218`에서 중단돼 뒤의 단언 완주를 주장할 수 없다. | F2-R |
| **F2-R 재생성 완료 대기 누락** | **[결함] 보통** | 원본 `npm run test:qr-bulk` **45.713s/exit1**, 단독 재실행 **43.124s/exit1**, 둘 다 `qr-bulk-smoke.mjs:218` actual `{present:true,disabled:true}`. `node run-order-probe.mjs`는 실제 run/disabled 식으로 results1/status running/disabled true → manifest완료/status success/disabled false 재현. | `tests/qr-bulk-smoke.mjs:212–218`에서 결과1개 확인 뒤 **생성 작업 완료를 상태 조건으로 기다리고**, 그 다음 기존 releasedState 단언을 유지한다. 예: `[data-testid="qr-bulk-generate"] button` enabled 대기 후 PDF 버튼 상태 단언. 고정 sleep 추가·busy 제품 가드 제거·stale0/요청/reload 단언 삭제는 하지 않는다. 제품 수정 없이 테스트·review-notes만 보강하고 unit·qr-bulk·tsc·static·diff를 재실행한다. |
| 기존 subset/full/corrupt 보존 | **[통과]** | 각 25라벨/2p/OTTO stream1/decoded size·SHA; 기존 생성 취소/재실행·7payload·투명/로고·ZIP PNG2·manifest2sheet도 유지. 진단 사본 전체 완주 로그에 모두 기록. | 없음 |
| 수정 범위·기록 | **[통과]** | `git diff 93a2318..HEAD -- src/ package.json scripts/ vite.config.ts` 빈 출력. `249e172..HEAD`는 QR unit25줄+review-notes4줄만 추가. CHANGELOG 기존 S2b 항목 유지, Codx unit/mutation 기록과 Claude 문단 모두 보존. | F2-R의 신규 결과를 review-notes에 추가 |

### F2-R 재현과 원인 경계

```sh
python3 /tmp/worklazy-s2b-review3/prepare-checkout.py
python3 /tmp/worklazy-s2b-review3/run.py qr-bulk /tmp/worklazy-s2b-review3/wt npm run test:qr-bulk
# exit 1: tests/qr-bulk-smoke.mjs:218
# actual:   { present: true, disabled: true }
# expected: { present: true, disabled: false }

node /tmp/worklazy-s2b-review3/run-order-probe.mjs
# beforeManifestComplete: results=1, status=running, pdfDisabled=true
# afterManifestComplete:  results=1, status=success, pdfDisabled=false
```

실제 제품 `QrBulkPanel.tsx:229`의 `setResults`는 `:237`의 `await createManifest`보다 앞이며, `:238`에서야 `operation.succeed`를 호출한다. `busy`는 `:118`에서 status running으로 정의되고 PDF disabled 식 `:469`에 포함된다. `createManifest:572`는 `writeXlsxReport`의 비동기 완료를 기다린다. **결과 개수는 생성 완료 신호가 아니다.** 같은 스모크의 정상 PDF 시나리오 `:141–145`, 취소 시나리오 최초 생성 `:186–187`, 청크 시나리오 `:239–240`은 이미 버튼 enabled를 기다린다. 교체 후 재생성 `:212–218`에만 그 경계가 빠졌다.

`run-order-probe.mjs`는 실제 run 본문과 PDF disabled 식을 추출하며 외부 I/O/상태 setter만 대체한다. manifest promise를 보류해 위 순서를 결정적으로 관측한다. React DOM 전체 시험으로 확대 해석하지 않는다. 원본 브라우저 실패 2회와 함께 원인을 판정한 증거다.

`qr-diagnostic/tests/qr-bulk-smoke.mjs`는 `/tmp` 사본이다. `qr-diagnostic.diff`에 상태 관측 및 생성 버튼 enabled 대기 추가만 담았다. 모든 기존 assertion을 유지한 채 **exit0, 52.390s**로 완주했다. 이 실행에서는 첫 관측 때 이미 PDF가 enabled여서 추가 대기는 3ms였다. 따라서 이 로그 자체가 브라우저에서 busy→idle 전이를 직접 관측한 것이라고 주장하지 않는다. 전이 재현은 위 실제 handler 실험이며, 진단 사본은 나머지 HTTP 계약을 검증했다.

F2-R은 새 제품 정책 요구가 아니라 이번 필수 재실행에서 실제 실패한 **테스트 동기화 결함**이다. 현재 export 취소 제품 결함으로 분류하지 않는다.

### mutation 실행의 기대값 처리

1차 mutation을 재검수용으로 바꾼 `/tmp/worklazy-s2b-review2/mutation-check.py`를 복사해 출력 BASE만 review3로 옮겼다. 실제 제거 대상/함수 재현은 동일하다. 이 스크립트의 사람이 읽는 옛 요약 문자열에는 13pass/15tests가 남아 있으나 이번 **자식 TAP 원문은 16tests/14pass/2fail**이다. 판정은 TAP 원문을 따른다.

`final-task-mutation.py`는 2차의 옛 기대값(unit0/15pass) 때문에 새 회귀가 정상 검출돼도 wrapper가 중단된다. review3에서는 **출력 경로와 기대값만 unit1/15pass/1fail/`1 !== 0`으로 갱신**하여 runtime 음성 대조까지 실행했다. 수정 전 사본 `final-task-mutation-original.py`, 변경점 `final-task-harness.diff`를 보존했다. 제품 변조는 최종 양보 한 줄만이다. wrapper exit0은 **두 자식 실행이 기대대로 실패했다**는 의미다.

## 2. 정본 대비 구현 대조

아래 위치는 HEAD 71a6200 기준이다. 단순 과거 판정 복사가 아니라 source 대조와 이번 unit/runtime/vendor/hash/HTTP 실행 결과에 연결했다.

| 항목 | 판정 | 구현 위치·재현 근거 | 수정 지시 |
|---|---|---|---|
| D1 고정 레시피·도구·glyph oracle | **[통과] [일치]** | `requirements-fonts.txt:1`; 생성기 `:40,57,103,128,155` fonttools4.59.2/retain-gids/원본 SHA/GID·hmtx·RecordingPen. `/tmp` checkout에서 기존 venv로 재생성 → cmap3394/OTF931704/gzip561161/glyph차이0. | 없음 |
| D1 PDF 비회귀 | **[통과] [일치]** | `qrLabelPdf.ts:20` subset:false; `qr-font-render-regression.mjs` 직접 실행 → sample/inventory/expanded 17p, Poppler차이0/PDF.js동일. GS와 입력 대비 추출 기존 결함은 oracle에서 제외·backlog 명시. | 없음 |
| D2 문자 집합·원문+NFC·schema | **[통과] [일치]** | `qrLabelFont.ts:31,57,69`, unit `:20,39,49`. coverage3394/정렬/scalar/U+2026/목록exact equality; NFD11172전수. raw-only mutation2fail, runtime shaping 거짓양성8822→0. draw원문 NFC 변경없음. | 없음 |
| D2 coverage 번들 비용 | **[통과] [일치]** | `bundle-audit.mjs` 실제 JS에서 coverage3394배열 확인; helper22278B/gzip9679B, category route, owner qr-studio. 5종 지표 포함. | 없음 |
| D3 lazy factory·캐시·snapshot·HTTP | **[통과] [일치]** | panel `:316–343`, font helper `:89,98,128`: 클릭 후 import/3분기 즉시 rejection 연결, panel별 검증 성공 ArrayBuffer최대2, 실패cache0/dispose/HTTP기본cache. unit/runtime 실험PASS. | 없음 |
| D3 양보·신호 | **[통과] [일치]** | selector `:59,72–76`, loader `:93,98`, PDF `:13,30`: optional signal, 8192코드/8ms·페이지경계 task 양보/await뒤 abort 검사. panel최종 task `:360–362` 새 unit/mutation으로 검증. | 없음 |
| D3 S0 분리 | **[통과] [일치]** | HTTP OTF404 reload0/key0, 실제 PDF청크404 reload1; 독립 catch 경계. 원본 스모크 완주 문제는 F2-R로 별도 판정. | F2-R |
| D4 Node 공급·staging | **[통과] [일치]** | vendor `:25,32,36,43,61,75` 입력/gunzip/OTF/coverage/provenance/full/OFL 검증 후 두 snapshot교체; clean vendor2회 동일SHA·손상4종 exit1/public불변. | 없음 |
| D5 typed 폴백·실패·취소 예외 | **구현 [통과] [일치]** | PDF `:15,18–25` create는 밖/register+embed만 typed, PNG/draw/save밖; panel`:352–357` subset typed만 full1회/PNG재독0/새PDF. runtime24/24, cancel/cleanup/run폐기 unit과 F1-R PASS. | 원본 HTTP스모크는 F2-R |
| D6 B/C | **[통과] [일치]** | review-notes`:49` B의 비교 기반 미채택 사유·클릭 전 prefetch기각, panel`:323–345` 클릭 후 병렬화. 외부 표준의 최신성을 새 인터넷 조사한 판정은 아님. | 없음 |
| R2-1 공용 lease·무효화 | **[통과] [일치]** | panel`:99,240,249,264,277,309,370,391,399,481`; owner/cancel/cleanup/run폐기/busy unit, runtime지연import/storage/save/unmount·중복호출·최종task 실험PASS. | 없음 |
| R2-2 PDF 구조/SHA·scenario | **[통과] [일치]** | scenario helper`:39–51` %PDF/load/2p/OTTO1/size·SHA; 임의1MB하한없음. metrics `--scenario`와 subset/full/corrupt 유지. | 없음 |
| 복사 금지① busy | **[통과] [일치]** | panel`:469`, unit`:277` 실제 JSX식 busytrue→disabledtrue/idlefalse. F2-R은 이 정상 가드를 기다리지 않은 시험 오류. | 제품 가드 보존 |
| 복사 금지② storage 선행 분리 | **[통과] [일치]** | panel`:243,252,488` clear await전 undefined, unit`:227,257` 지연clear중 분리/새storage보존. | 없음 |
| 복사 금지③ optional signal | **[통과] [일치]** | selector/loader 내부 optional, panel은 active signal전달. 신호생략/Abort unit·runtimePASS. | 없음 |
| 스모크3종·계측 입력 | **[통과] [일치]** | scenario`:15,24,31,62`; default subset/오타거부/첫Label에만 똠1/titleTemplate설정/실제HTTP200 동일길이1byte손상. NetLog/cacheoff/SWblock 유지. | F2-R 완주 동기화 |
| 고정7행·역할별 해시표·backlog2건 | **[통과] [일치]** | `pins.py`, `OFFICE_EDITOR_ASSETS.md:35`, `backlog.md:28,29`, CHANGELOG`:7`, review-notes`:13,39,93–101`. 목록을 포함한 추적 입력5개/606249B, raw는 vendor산출. | 없음 |

## 3. 실제 실행 결과

명령별 정확한 cwd·argv·UTC 시작/종료·초·OS exit는 `logs/<이름>.json`, stdout/stderr는 `.log`, 집계는 `commands.json`에 둔다. TMPDIR/npm cache/브라우저 다운로드/렌더/NetLog는 이 검수 폴더 안이다. 의존 설치 없이 기존 패키지를 읽기 링크했고 TypeScript `.tmp`는 `/tmp` checkout에 따로 뒀다.

| 명령 | exit·출력 | 로그 이름 |
|---|---|---|
| `npm run test:unit` | **0, 247pass/0fail/0skip**, 3.447s | unit |
| `npm run test:qr-bulk` 원본 | **1**, disabledtrue≠false, 45.713s | qr-bulk |
| 같은 명령 단독 재실행 | **1**, 같은`:218` 실패, 43.124s | qr-bulk-serial |
| `npm run test:qr-bulk` 대기보강 진단사본 | **0**, 전체 HTTP/취소/청크/3scenario, 52.390s | qr-bulk-diagnostic |
| `npx --no-install tsc -b --pretty false` | **0**, 진단0, 20.190s | tsc |
| `npm run test:static` | **0**, localized/runtime/ads/robots/sitemap/startup104, 1.002s | static |
| `node tests/tool-registry-routes.mjs` | **0**, count20/missing0/unexpected0/duplicates0 | registry |
| `npm run css:orphans` | **0**, orphan selector arms0 | css |
| `git diff --check main..HEAD` / `git diff --check` | **0 / 0** | diff-check / diff-working |
| `npm run measure:qr -- --scenario=subset` | **0**, PDF1450793B, 12.528s | metrics-subset |
| `npm run test:qr-font-render` | **0**, 3fixtures/17p/33561324px/diff0/textEqual, 40.487s | render |
| `python3 vendor-probe.py` | **0**, Node-only 2회 exit0/SHA동일; 음성 실험은 기대exit1 | vendor-probe / vendor-* |
| `env PYTHONDONTWRITEBYTECODE=1 /tmp/worklazy-s2b/font-venv/bin/python scripts/build-qr-label-font-subset.py` | **0**, cmap3394/glyph차이0, 3.623s | regenerate |
| `python3 pins.py` / `sha256sum` | **0**, 고정표7행+wheel 전수일치 | pins / sha256sum |
| `node bundle-audit.mjs` | **0**, 실제 바이트gzip·baseline집계·delta·coverage귀속 일치 | bundle-audit |
| `node --experimental-strip-types runtime-probe.mjs` | **0, 24/24** | runtime |
| `python3 mutation-check.py` / `python3 final-task-mutation.py` | wrapper **0/0**, mutation 자식은 기대 **1** | mutation / final-task-mutation |
| `node run-order-probe.mjs` | **0**, 결과표시와 생성완료 경계 차이 재현 | run-order |
| `python3 paragraph-check.py` / `scope.py` / `numbers.py` | **0/0/0**, 원문/범위/수치 대조 | paragraph / scope / numbers |

**빌드·static 범위:** 이번 변경은 테스트·기록뿐이다. production static과 번들 바이트 집계에는 93a2318의 제품으로 생성된 보존 `/tmp/worklazy-s2b-review/production`을 읽었다. 제품·빌드입력·자산·package.json이 이후 두 커밋에서 동일함을 확인했다. 현재 원본 QA dist는 analytics 제외 산출이므로 production static validator와 혼용하지 않았다. **이번 검수에서 npm run build를 새로 실행했다고 주장하지 않는다.** 이전 production/QA/clean build의 실행 로그는 §5에서 감사했다. QA dist는 브라우저/계측에서 읽기만 했다.

## 4. 자산·공급·수치·제품 범위

### 고정 bytes

`pins.json`/`logs/sha256sum.log`는 정본 표를 파싱해 실물 size·SHA를 대조한 결과다. 신규6행(전개 raw포함)은 R2 regen-a와도 byte equality, 기존full/OFL은 `git show main:<path>`와 byte equality다.

| 파일 | bytes | SHA-256 |
|---|---:|---|
| unicodes-alias.txt | 23757 | ac8fefb54a969022fc1b139a3a7a1937f711e71280fb992683eb0d4d43978b0c |
| subset OTF | 931704 | b84d27a582d3f3e660db728e7913af3061d4e825e93cabdb6802f0ce23a252be |
| subset OTF.gz | 561161 | e1db3cdcbb8d76fc0546ec582bed773b3b7ef3da60867b6828493a6b342c7e66 |
| coverage.json | 19686 | 58f248442d4e8e5726559644a746740bd0066cebabf154956e0bb7e1458eafea |
| coverage.schema.json | 444 | 919d01b6713b3438f6cd36091d3244a04a28822b031a5cdd7ac135ff3d17e6b0 |
| provenance.json | 1201 | 30e10e1815835b8076a100ecdc9804c2613b115b555cbcc0b122150b92f77667 |
| full OTF | 4644748 | 69975a0ac8472717870aefeab0a4d52739308d90856b9955313b2ad5e0148d68 |
| OFL | 4301 | 6a73f9541c2de74158c0e7cf6b0a58ef774f5a780bf191f2d7ec9cc53efe2bf2 |
| fonttools4.59.2 wheel | 4912766 | 738f31f23e0339785fd67652a94bc69ea49e413dfdb14dcb8c8ff383d249464e |

목록3394/엄격정렬/중복0/LF없음/U+2026, coverage와 목록exact equality, gunzip→raw 동일도 단언했다. `git ls-files`상 source5파일 추적/public새subset0파일. `.gitignore:14`의 정확한 subset snapshot 한 줄은 D4의 vendor 산출 비추적 계약을 위한 정당한 변경이다. 기존 full snapshot은 추적 상태이므로 두 snapshot의 추적 상태가 같다고 주장하지 않는다.

clean 공급은 같은 HEAD의 **detached worktree**로 재현했다. 현재 브랜치가 이미 checkout돼 있어 `git worktree add --detach ... 71a6200`을 사용했다. node/npm/sh만 있는 PATH(python3없음), global fetch가 `NETWORK_DISABLED`로 실패하는 환경에서 기존full/OFL검증cache를 공급하고 `npm run vendor:qr-font` 2회 exit0, **8출력+소유외sentinel1개 SHA 동일**. gz/coverage/provenance손상 및 coverage누락4종은 exit1/public불변. full/OFLcache누락도 예상exit1/public불변이다. **Python/network독립은 subset 공급에 한정**되며 full/OFL완전offline은 명시제외다.

### 전송·렌더·번들 수치

이번 subset PDF 단계 **1,450,793B**, 기존 보고 대비 **0%**(요구 ±5% 이내), 이전S2 5,153,562B 대비 **−71.85%**. 누적2,365,596B. 폰트는 PDF 단계에서만 요청됐고 cache/SW/외부요청0을 실제 metrics assertion으로 검사했다. 원 sol subset/full/corrupt JSON의 요청별 합계도 각 **1450793/5163839/6095694B**로 보고/로그와 일치한다. full/corrupt의 새 4단계 계측을 실행한 것은 아니며 HTTP/PDF구조는 이번 스모크 진단사본에서 재실행했다.

`gzip -n -9` 재실측은 full3733434B/subset561161B. 원 보고의 full3733457B는 파일명 헤더를 보존한 `gzip -9`로 다시 일치했고 차이는23B다. 감량84.97%는 반올림상 동일하다. raw는4644748→931704B/−79.94%. 실전 네트워크전송·gzip상당량·PDF파일크기를 혼합하지 않았다.

렌더 재실행 결과는 sample2p/4011288px, inventory7p/14039508px, expanded8p/15510528px, **합17p/33561324px/변경0/PDF.js동일**이다. PDF 전체파일크기는 이전 보고와1–3B 다르며 전체 PDF byte equality는 계약이 아니다. embedded font pins와 렌더/추출 비교가 모두 통과했다. Poppler descriptor 경고는 원문에 남겼고 GS정상/입력문자와PDF.js완전일치를 주장하지 않는다.

| 번들 gzip 지표 | main baseline | 현 production 실제바이트 | delta | 상한 | 판정 |
|---|---:|---:|---:|---:|---|
| entryJsGzip | 299283 | 299287 | +4 | 20480 | 통과 |
| affectedRouteJsGzip | 2440427 | 2450827 | +10400 | 61440 | 통과 |
| sharedJsGzip | 2716489 | 2716473 | −16 | 30720 | 통과 |
| appJsGzip | 5456199 | 5466587 | +10388 | 81920 | 통과 |
| cssGzip | 37687 | 37687 | 0 | 10240 | 통과 |

baseline·sol per-file 합계를 독립 재집계하고 보존 production 실제gzip와 sol값을 비교했다. override없음/multiplier1/신규route0/route→shared이동0B. coverage배열을 포함한 helper는 **22278B/gzip9679B**, QR route소유로 실제 분류됐다. `bundle-audit.json`에 근거를 보존했다.

### 제품 규칙·범위 밖 변경 대조

`scope.py`는 main 대비 src변경을 QR제품3파일로, 93a2318뒤 수정변경을 테스트3+기록2파일로 한정해 exact list 대조했다. `git diff main..HEAD -- src/locales package-lock.json`은 비어 있다. package.json은 **test:qr-font-render script1줄 추가**를 제외하면 구조적으로 동일하다. 새 npm runtime/devDependency0, 서버/API/SSR도입0, SEO/사이트맵/광고·분석격리경계 변경0. `QR_LABEL_FONT_PATH` 전체OTF의 의미·경로·bytes는 main과 동일하다. 제품 메시지는 기존 현지화 PDF오류만 사용하며 폰트 오류의 내부명칭/raw exception을 표시하지 않는다.

QR helper 참조는 실행확장자별 repo-wide `rg`와 명시적4파일 허용목록으로 검사했다(`logs/qr-callers.log`, `scope.json`). 문서/생성물/vendor/dependencies는 각 소유목적에 따라 비제품 예외를 명시했다. 이번 변경범위에서 광역 호출 유출은 없다.

범위상 설명할 추가 변경: `.gitignore` 한 줄은 위 D4공급계약에 필요; `AGENTS.md` 모델역할8줄은 초기dispatch의 첫 위임커밋; backlog GS/PDF.js2건은 정본지시이며 끝빈줄삭제는 동작영향0. backlog의 U4문구는 후속 후보이며 아직 U4구현/범위합의를 대체하지 않는다. 전체OTF/CSV import분리/JSZip제거/런타임subset/GS수리 등 명시제외는 유지됐다.

## 5. 기존 sol 광역 로그 감사

지시가 허용한 과거 로그 감사이며 아래 명령들을 이번에 재실행한 것으로 적지 않는다. `sol-log-audit.json`에 로그SHA·mtime·npm명령banner·footer를 새로 기록했고 `numbers.json`으로 구조화 원자료/개수를 확인했다. 시각은 UTC, KST는+9시간이다.

| 항목 | 판정 | 직접 확인한 원문·원자료 |
|---|---|---|
| visual ko/en | **[통과] 실행/캡처증거** | 로그mtime15:50:18.355Z/15:52:09.763Z, 각index1–175고유175개/matched175/175/105.75s·105.33s. 각 실행은 ko71+en104 전체집합이므로 2로케일포함전체집합2회. captureDirectory없는 성공시PNG미저장(`visual-regression.mjs:360`)이라 산출PNG0은 정상. baseline변경0. |
| a11y | **[통과] 로그/JSON** | 15:54:24.498Z, pages8/위반0/외부0/total상한0/placeholder대비4.8871:1. |
| recovery | **[통과] 로그/개별자료** | 147PASS, summary147개모두pass, 개별JSON147+summary1/PNG153, 15:43:50.347Z–15:48:22.457Z. |
| rendering | **[통과] 로그/JSON** | 15:54:40.446Z, 3페이지×3samples/CLS최대0/외부0. |
| browser/utilities/new-tools/office | **[통과] 실행로그** | npm banner·성공footer·mtime순서 확인. Excel/Word/PDF·ko/enutilities·HWP/Image/Audio/Video·Office96download/7cache/DOCX5089B. 호스트미지원DV분기는 원문상skip이며 전환경성공으로 확대하지 않는다. |
| production/QA/clean build | **[통과] 실행로그** | prebuild/build/Vite성공/61localized pages footer. production15:36:44Z/QA15:53:54Z/clean15:34:39Z. |
| 과거 OS raw exit0 | **[미검증] 원로그형식한계** | 별도raw exit/env메타가 없다. 성공경로footer/결과JSON/시각은 확인했지만 과거프로세스exit를 직접 복원했다는 주장은 하지 않는다. 1·2차 검수에 있던 동일 한계이며 미실행으로 단정할 근거는 없다. 이번 모든 새 명령은exit/timeJSON보존. |

sol 초기 unit241, fix-1 unit246, fix-2 unit247 보고는 각각 원 TAP 수와 일치한다. F1-R수정 및 Claude문단보고도 재현됐다. fix-2의 과거 qr-bulk성공 기록을 부정하는 것은 아니지만, **이번 HEAD의 원본 스모크 재실행은 두 번 실패**했으므로 현재 전체게이트 통과를 인정할 수 없다.

## 6. 종료 불변·실행 게이트

첫 도구 호출은 `cat PROJECT_RULES.md` 전문이었다. branch AGENTS·정본v3/보강·구현 및 fix-2 dispatch·sol보고·2차재검수·R1~R3자료·운영/기각기록을 읽고 열린계획을 스캔했다. HEAD/main은 요청값과 일치했다. 로드맵 말미의 `3672fc7`/`5485fad`는 실제 ref와 달라 최신 사용자 dispatch의 **71a6200/f29d249**를 검수 기준으로 사용했다.

전체 snapshot **3,078파일**의 시작/종료 SHA를 대조한 `invariance.py`는 **exit1**이다. 이를 전체 불변 성공으로 덮지 않는다. 변경은 아래 **비추적 열린 계획서2개**뿐이다.

- `docs/jobs/todo/pdf-finish-20260905.md`
- `docs/jobs/todo/roadmap-completion-20260906.md`

이 검수 작업은 두 파일에 쓰지 않았다. 종료시 재독한 내용에는 Claude 서명의 **U4 10차 결과·v12/11차반박 지시**가 추가돼 있으며, 병행 세션 변경으로 판단한다. U4의 clipping/비페이지OC지원경계 보강으로 QR selector/자산/현재제품 범위와 상반된 지시는 없다. 미래 공용 `pdfFontEmbed` 우선·U4전체OTF유지 계약도 유지된다. 변경 전후SHA는 `scope-invariance.json`에 기록했다.

범위별 `python3 scope-invariance.py`는 **exit0**: **추적2,373파일 변경0·dist537파일 변경0·public벤더자산 변경0·QR정본 변경0·사용자3파일 변경0**. HEAD/main/branch/status도 모두 동일하다. 위 두 계획서 외 나머지3,076파일은 SHA동일하다. 전체불변 실패와 검수제품범위 불변을 구분한다.

```text
$ git status --porcelain
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html

$ git rev-parse HEAD main
71a6200aaefed34a8fbf4524faf4e4068370decc
f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e

$ git branch --show-current
s2b-qr-font
```

임시 detached worktree는 추적diff0을 확인하고 **제거 완료**했다(`logs/worktree-remove.json`). 원본 저장소 파일 수정·커밋·push·dist변경·브랜치전환·저장소안npm/pip설치를 하지 않았다. worktree등록/제거에 필요한 Git관리메타만 사용했다. 산출물과 실험용 수정은 `/tmp/worklazy-s2b-review3` 안에 있다.

**최종: [수정 후 재검수] — F1-R·Claude원문반영은 통과. 남은 보통1건은 F2-R(원본 QR스모크의 생성완료 대기 누락)이다.**
