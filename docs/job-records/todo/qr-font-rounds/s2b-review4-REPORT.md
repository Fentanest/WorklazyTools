# S2b QR 라벨 PDF 폰트 감량 — 4차 검수

작성: **Codx**, 2026-09-07 KST. 브랜치 `s2b-qr-font`, HEAD **`2f59a44737e87019fd90ca84f23e75c7d297ef97`**, main **`f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e`**.

**판정: [검수 통과] — F2-R 해소, F1-R·F1 유지, 수정 필요 결함 0건.**

커밋된 QR 스모크를 같은 HEAD의 임시 checkout에서 변경 없이 연속 두 번 실행해 **exit 0 / 0**을 재현했다. 추가된 대기는 생성 버튼 활성 상태를 보는 `waitForFunction`이며 고정 sleep 추가·기존 단언 삭제는 **0**이다. 전체 unit **247/247**, 다운로드 직전 양보 제거 및 소유권 가드 제거 mutation의 기대 실패, tsc·static, 자산 공급·SHA, subset 전송 **1,450,793B**, 17페이지 렌더 픽셀 차이 **0**, 번들 5종을 확인했다. `93a2318..HEAD`의 제품 코드·빌드 입력 변경은 **0**이다.

추적 파일·dist·QR 정본·사용자 파일은 SHA 불변이다. 전체 파일 불변 검사는 병행 세션의 **U4 계획서·로드맵 2개 변경** 때문에 exit 1이며, 이를 통과로 덮지 않았다. 과거 광역 로그의 별도 OS exit 메타가 없는 한계도 아래에 명시한다. 이번 필수 재실행의 종료 코드는 직접 기록했다.

## 1. 우선 검수 판정

| 항목 | 판정 | 재현 명령·출력 | 수정 필요 시 지시 문안 |
|---|---|---|---|
| **F2-R 원본 스모크 연속 2회** | **[통과]** | `npm run test:qr-bulk` → **52.551s/exit0**, 바로 이어 **52.050s/exit0**. 두 회 모두 현 `tests/qr-bulk-smoke.mjs:219`의 releasedState `{present:true,disabled:false}` 단언을 통과하고 종료 footer까지 도달. `logs/qr-bulk-{1,2}.{log,json}` | 없음 |
| **F2-R 상태 조건·단언 보존** | **[통과] [일치]** | `python3 f2r-audit.py` → 원본 `71a6200` 전체 텍스트에 `:213` 호출 한 줄만 추가한 것과 exact equality. 추가1/삭제0, 직접 assert 호출15→15, 삭제0, 새 고정sleep0. helper `:333–338`는 `page.waitForFunction` + 실제 생성 버튼 `!disabled`. | 없음 |
| F1-R 실제 handler·최종 task 경계 | **[통과] [일치]** | unit `:202–225`가 PDF Blob 반환 직전에 cancel task를 큐에 넣고 download0/message0/exporting빈값/active없음/dispose1 검사. harness `:341`는 현 제품 handler 본문을 추출·변환한다. 제품 `QrBulkPanel.tsx:360–362`의 양보→검사→download를 실제 실행. | 없음 |
| F1-R 양보 제거 mutation | **[통과]** | `python3 final-task-mutation.py` → 변이 QR unit **exit1, 15pass/1fail**, **`1 !== 0`**; 실제 handler 보조 runtime도 exit1. wrapper exit0은 두 기대 실패를 확인했다는 뜻. | 없음 |
| F1 공용 lease 가드 mutation | **[통과]** | `python3 mutation-check.py` → `finishExport`의 `if (!owned) return` 한 줄만 제거한 변이 unit **exit1, 14pass/2fail**, **`'' !== 'pdf'`**. 실제 handler runtime도 exit1. 두 번째 unit 실패는 unit 내부 mutation 준비 조건의 가드 개수 단언. | 없음 |
| Claude 서명 문단 원문 | **[통과]** | `python3 paragraph-check.py` → **1,377 UTF-8 bytes/equal:true/changes:0**. fix-2 dispatch의 인용 표시 `> `만 제외한 원문과 `docs/review-notes.md:103` exact equality. SHA `80192cb2ccf8721957848ba432ccf5c0d1e44008b2c51381b850d0249a7437cb`. | 없음 |
| F2 실제 HTTP 폰트404/S0 | **[통과]** | 두 원본 스모크 모두 subset404 1회→full1회, full OTF4644748B/`69975a0a…148d68`, reload0/retry key0. 정확한 OTF 경로에 서버가 404를 반환한다(`qr-font-scenarios.mjs:81`). | 없음 |
| F2 결과 교체 취소·청크404 대조 | **[통과]** | 두 회 모두 취소 stale download0/full요청0/lease해제, 실제 빌드 QR PDF청크404 injection1/reload1/PDF없음/외부요청0. `qr-bulk-smoke.mjs:175–264`. | 없음 |
| 기존 3 scenario·QR 계약 | **[통과]** | subset/full/corrupt 각25라벨/2p/OTTO stream1/decoded size·SHA 검사 완주. 생성취소·재실행·7payload·투명/로고 read-back·ZIP PNG2·manifest2sheet 유지. | 없음 |
| 수정 범위·기록 | **[통과]** | `git diff 93a2318..HEAD -- src/ scripts/ package.json package-lock.json vite.config.ts` 빈 출력. fix-3는 테스트1줄+review-notes문단2줄 추가뿐. `CHANGELOG.md:7`의 S2b 코드 변경 기록과 이전 Codx/Claude 기록 보존. | 없음 |

### 연속 실행 원문과 의미

두 실행 사이에 checkout 파일이나 테스트를 수정하지 않았다. QR 두 회 동안 다른 브라우저·CPU 검증을 병행하지 않았다. 첫 실행 종료 후 같은 셸의 순차 루프가 둘째 명령을 시작했다. 각 테스트는 자체 preview/브라우저를 기동·종료했다.

```sh
python3 /tmp/worklazy-s2b-review4/prepare-checkout.py
python3 /tmp/worklazy-s2b-review4/run.py qr-bulk-1 /tmp/worklazy-s2b-review4/wt npm run test:qr-bulk
python3 /tmp/worklazy-s2b-review4/run.py qr-bulk-2 /tmp/worklazy-s2b-review4/wt npm run test:qr-bulk
```

| 실행 | UTC 시작 → 종료 | OS exit | 로그 SHA-256 |
|---|---|---:|---|

| 1 | 2026-09-06T17:59:57.079779+00:00 → 2026-09-06T18:00:49.630770+00:00 | 0 | `a326825d3fbc2546c34ac68244cce624f1154dd9cf3a267a16d38a58383bf747` |

| 2 | 2026-09-06T18:00:49.665262+00:00 → 2026-09-06T18:01:41.715230+00:00 | 0 | `c712e0d71b15ba5294cd962bd9bad36474f645b159dc07623ab0ef41865f0559` |

원본 전체 문자열을 비교했으므로 기존 `assert`뿐 아니라 `throw` 기반 검사도 삭제되지 않았음을 확인했다. 기존 취소 후 750ms·청크 후 500ms 관측 대기는 보존돼 있다. **이번 F2-R에 추가된 대기**는 그 고정 시간 대기가 아니라 생성 완료를 관찰하는 상태 조건이다. 결과 개수만 기다리던 3차 검수의 문제 경계를 올바르게 보강했다.

mutation 스크립트는 3차 검수의 재현기를 복사해 산출 BASE를 review4로 옮겼다. lease 스크립트의 오래된 요약 문자열만 현재 TAP 수(14/2, 16건)에 맞췄다. 제품에서 제거하는 대상과 기대 실패 조건은 그대로다. 변이 산출은 `mutant-*`에만 있으며 저장소 코드를 변조하지 않았다. runtime 24/24는 실제 handler와 helper 실험이며 React DOM 전체 시험을 대체한다고 주장하지 않는다.

## 2. 정본 v3·정본화 보강 대비

| 항목 | 판정 | 구현 위치·재현 명령·출력 | 수정 지시 |
|---|---|---|---|
| D1 고정 도구·레시피·glyph oracle | **[통과] [일치]** | `requirements-fonts.txt:1`, 생성기`:40,57,103,128,155`: fonttools4.59.2/retain-gids/원본SHA/GID·hmtx·RecordingPen. `pins.py` 고정표·wheel 전수일치, `test:qr-font-render`17p/차이0. 생성기는 이후 수정0으로 이번 재생성 실행은 생략. | 없음 |
| D1 PDF 비회귀 정의 | **[통과] [일치]** | `qrLabelPdf.ts:20` subset:false, render script`:87–148` 실제 제품 helper→Poppler/PDF.js. 이번3fixture/33561324px/변경0/추출동일. GS와 입력 대비 추출 기존 결함은 oracle 제외·backlog 명시. | 없음 |
| D2 문자 집합·원문+NFC·schema | **[통과] [일치]** | `qrLabelFont.ts:31,57,69`, unit`:20,39,49`: coverage3394/정렬/scalar/U+2026/목록exact. 전체unit+runtime NFD11172전수/raw-only mutation2fail, shaping 거짓양성8822→0. draw 원문 NFC 변경없음. | 없음 |
| D2 coverage 번들 포함 | **[통과] [일치]** | `node bundle-audit.mjs` 실제 JS의 coverage3394 배열 확인. helper22278B/gzip9679B, category route/owner qr-studio. 5종 안에 포함. | 없음 |
| D3 lazy factory·캐시·snapshot | **[통과] [일치]** | panel`:316–343`, font helper`:89–142`: 클릭 뒤 import/3분기 즉시 rejection 연결, panel별 검증성공 ArrayBuffer 최대2, 실패cache0/dispose/기본HTTPcache. unit/runtime24/24 및 HTTP스모크. | 없음 |
| D3 양보·optional signal·S0 분리 | **[통과] [일치]** | selector`:59,72–76`, loader`:93,98`, PDF`:13,30`, panel`:360–362`. await뒤/페이지경계/최종task abort 검사. unit·mutation·font404 reload0/chunk404 reload1. 동기 font/layout/save 한 단위 즉시 중단 보장 제외는 정본 유지. | 없음 |
| D4 Node 공급·staging | **[통과] [일치]** | vendor`:25,32,36,43,61,75`: 입력/gunzip/OTF/coverage/provenance/full/OFL검증 후 두 snapshot교체. `vendor-probe.py` Node-only2회 SHA동일, 손상4종 exit1/public불변. | 없음 |
| D5 typed 폴백·실패·취소 | **[통과] [일치]** | PDF`:15,18–25` create는 밖/register+embed만 typed/PNG·draw·save는 밖; panel`:352–357` subset typed만 full1회/PNG재독0/새PDF. runtime24/24와 unit·HTTP 모두 통과. | 없음 |
| D6 B/C 판정 | **[통과] [일치]** | review-notes`:49` B의 비교 근거·미채택, 클릭 전prefetch기각. panel`:323–345` 클릭 후 병렬화. 이번 판정은 기록·구현 정합 검사이며 외부 표준의 최신성 재조사는 아님. | 없음 |
| R2-1 공용 lease·무효화 | **[통과] [일치]** | panel`:99,240,249,264,277,309,370,391,399,481`: ZIP/PDF 첫await전점유, 소유자finally, cancel/cleanup/unmount/run폐기 무효화. 실제handler unit+두mutation+HTTP취소. | 없음 |
| R2-2 PDF 구조·SHA·계측 입력 | **[통과] [일치]** | scenarios`:39–51` %PDF/load/2p/OTTO1/size·SHA; 임의1MB하한없음. metrics`:14,154,212` `--scenario`/NetLog/cacheoff/SWblock 유지. | 없음 |
| 복사 금지① busy | **[통과] [일치]** | panel`:469`, unit`:277`: 실제 JSX식 busytrue→disabledtrue/idlefalse. 이번 F2-R은 이 정상 경계를 기다린다. | 없음 |
| 복사 금지② storage 선행 분리 | **[통과] [일치]** | panel`:243,252,488`, unit`:227,257`: clear await전undefined/지연clear중분리/새storage보존. | 없음 |
| 복사 금지③ optional signal | **[통과] [일치]** | helper selector/loader는 optional, panel은 active.signal전달. 신호생략·abort unit/runtime 통과. | 없음 |
| 스모크3종·fixture 정의 | **[통과] [일치]** | scenarios`:15,24,31,62`: subset기본/오타거부/full첫Label에만똠1/titleTemplate지정/HTTP200동일길이1byte손상. 두스모크+subset계측 실행. | 없음 |
| 고정7행·역할별 해시표·backlog2건 | **[통과] [일치]** | `pins.py`, `OFFICE_EDITOR_ASSETS.md:35–44`, `backlog.md:28–29`. 소스입력5파일/606249B·전개raw·원본full/OFL·wheel 전수SHA일치. | 없음 |

## 3. 검증 재실행 목록

산출물 기준 경로는 `/tmp/worklazy-s2b-review4`다. `run.py`가 cwd·argv·UTC 시작/종료·소요·OS exit를 `logs/<이름>.json`, stdout/stderr를 `.log`로 저장했다. 의존 설치 없이 기존 `node_modules`의 패키지를 읽기 링크하고 TypeScript `.tmp`는 임시 checkout 안에 따로 뒀다. TMPDIR·npm cache·다운로드·렌더·NetLog 쓰기는 이 검수 폴더 안이다.

| 명령 | OS exit / 실측 | 로그 이름 |
|---|---|---|

| `npm run test:unit` | **0**, 2.541s; 247pass/0fail/0skip | unit |

| `npm run test:qr-bulk` | **0**, 52.551s; 전체 HTTP·취소·청크·3scenario | qr-bulk-1 |

| `npm run test:qr-bulk` | **0**, 52.050s; 동일 단언 연속 재통과 | qr-bulk-2 |

| `npx --no-install tsc -b --pretty false` | **0**, 18.473s; 진단0 | tsc |

| `npm run test:static` | **0**, 1.726s; startup104문서 포함 | static |

| `node tests/tool-registry-routes.mjs` | **0**, 0.487s; 20개/누락0/예상외0/중복0 | registry |

| `npm run css:orphans` | **0**, 0.427s; orphan0 | css |

| `git diff --check main..HEAD` | **0**, 0.012s; main..HEAD 공백오류0 | diff-check |

| `git diff --check` | **0**, 0.004s; 워킹트리 공백오류0 | diff-working |

| `npm run measure:qr -- --scenario=subset` | **0**, 10.637s; PDF1450793B/편차0% | metrics-subset |

| `npm run test:qr-font-render` | **0**, 38.011s; 3fixture/17p/33561324px/차이0 | render |

| `python3 vendor-probe.py` | **0**, 1.780s; vendor2회0/SHA동일; 음성4종기대1 | vendor-probe |

| `python3 pins.py` | **0**, 0.127s; 고정표·wheel·원본full/OFL일치 | pins |

| `node bundle-audit.mjs` | **0**, 0.538s; 5종delta·coverage귀속일치 | bundle-audit |

| `node --experimental-strip-types runtime-probe.mjs` | **0**, 3.345s; 24/24 | runtime |

| `python3 mutation-check.py` | **0**, 5.524s; 변이자식exit1/14pass2fail; raw-only도2fail | mutation |

| `python3 final-task-mutation.py` | **0**, 4.368s; 변이자식exit1/15pass1fail | final-task-mutation |

| `python3 paragraph-check.py` | **0**, 0.037s; 1377bytes동일 | paragraph |

| `python3 scope.py` | **0**, 0.061s; 제품·의존·문구diff0 | scope |

| `python3 f2r-audit.py` | **0**, 0.041s; 추가1/삭제0·두스모크원문재파싱 | f2r-audit |

| `python3 numbers.py` | **0**, 0.800s; 전송·gzip·렌더·과거캡처수대조 | numbers |

| `python3 sol-log-audit.py` | **0**, 0.038s; 과거명령banner/성공footer/SHA/mtime감사 | sol-log-audit-complete |

| `git worktree remove --force wt` | **0**, 0.056s; 임시checkout제거 | worktree-remove |

| `python3 scope-invariance.py` | **0**, 0.046s; 추적·dist·QR·사용자불변 | scope-invariance |

**빌드·static 범위:** 이번 수정은 테스트·기록뿐이다. 제품·빌드 입력이 `93a2318` 이후 동일함을 diff로 확인하고, production static과 실제 번들 gzip는 보존 `/tmp/worklazy-s2b-review/production`을 읽었다. static validator/source/package는 현 HEAD다. QR 스모크·계측은 원본의 analytics 제외 QA dist를 읽기만 했다. **이번에 npm run build를 재실행하거나 원본 dist를 바꿨다는 주장은 하지 않는다.** 기존 production/QA/clean build 로그는 §5에서 감사했다.

검수 도구 자체의 두 실패도 보존했다. `sol-log-audit`는 legacy footer를 잘못 적어 exit1, `sol-log-audit-final`은 보존돼 있지 않은 fix1 unit 로그 경로를 가정해 exit1이었다. 원로그를 읽고 footer를 정정했으며 없는 로그는 미검증으로 명시한 후 `sol-log-audit-complete`가 exit0이다. 제품 테스트 실패를 덮은 것이 아니다. 전체 불변 `invariance`의 exit1은 §6에 별도 기록한다.

## 4. 자산·공급·수치·제품 범위

### 고정 자산

`pins.py`는 정본 표를 파싱해 실물 size/SHA를 대조하고 `sha256sum` 원문을 `logs/sha256sum.log`에 저장했다. 신규6행(raw전개 포함)은 R2 regen-a와 byte equality, full/OFL은 main과 byte equality다.

| 파일 | bytes | SHA-256 |
|---|---:|---|

| unicodes-alias.txt | 23757 | `ac8fefb54a969022fc1b139a3a7a1937f711e71280fb992683eb0d4d43978b0c` |

| NotoSansKR-Regular.ksx1001.otf | 931704 | `b84d27a582d3f3e660db728e7913af3061d4e825e93cabdb6802f0ce23a252be` |

| NotoSansKR-Regular.ksx1001.otf.gz | 561161 | `e1db3cdcbb8d76fc0546ec582bed773b3b7ef3da60867b6828493a6b342c7e66` |

| coverage.json | 19686 | `58f248442d4e8e5726559644a746740bd0066cebabf154956e0bb7e1458eafea` |

| coverage.schema.json | 444 | `919d01b6713b3438f6cd36091d3244a04a28822b031a5cdd7ac135ff3d17e6b0` |

| provenance.json | 1201 | `30e10e1815835b8076a100ecdc9804c2613b115b555cbcc0b122150b92f77667` |

| NotoSansKR-Regular.otf | 4644748 | `69975a0ac8472717870aefeab0a4d52739308d90856b9955313b2ad5e0148d68` |

| OFL.txt | 4301 | `6a73f9541c2de74158c0e7cf6b0a58ef774f5a780bf191f2d7ec9cc53efe2bf2` |

| fonttools4.59.2 wheel | 4912766 | `738f31f23e0339785fd67652a94bc69ea49e413dfdb14dcb8c8ff383d249464e` |

목록3394/엄격정렬/중복0/마지막LF없음/U+2026, coverage와목록exact equality, gunzip→raw동일을 단언했다. `git ls-files`상 source5파일추적/public새subset0파일이다. `.gitignore:14`의 **`public/vendor/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/`** 한 줄은 D4의 vendor산출 비추적 계약에 필요한 정당한 변경이다. 기존 full snapshot은 추적 상태로 보존됐다.

clean 공급은 현재 브랜치를 전환하지 않고 **같은 HEAD의 detached worktree**를 만들어 검증했다. 이미 원본에서 checkout된 브랜치를 중복 checkout할 수 없어 `git worktree add --detach ... 2f59a44`를 사용했다. node/npm/sh만 있는 PATH(python3없음), global fetch가 `NETWORK_DISABLED`로 실패하는 환경에서 검증된 full/OFL cache를 공급했다. vendor2회 exit0, **8출력+소유외sentinel1개 SHA동일**. gz·coverage·provenance손상/coverage누락4종은 기대exit1/public불변, full/OFLcache누락도 기대exit1/public불변이다. **Python/network독립은 subset 공급에 한정**된다. worktree는 검증 후 제거 완료했다.

### 전송·렌더·번들

subset PDF 단계 **1,450,793B**, 기존 sol 보고 대비 **0%**(요구±5% 안), 이전 S2 **5,153,562B 대비 −71.85%**, 누적 **2,365,596B**다. QR OTF는 PDF 단계에서만 요청됐다. metrics footer의 일반 `font requests=2`는 진입 시 UI용 WOFF2까지 포함한 수이고, QR OTF는 subset1/full0이다. `assertQrFontRequests`가 정확한 QR OTF 경로·단계·cache/SW0을 검사했다. full/corrupt는 이번에 4단계 계측을 다시 실행하지 않았으며 두 원본 스모크에서 HTTP/PDF구조·SHA를 재검증했다.

원 sol subset/full/corrupt의 요청별 합계는 **1450793/5163839/6095694B**로 보고·원로그와 일치했다. `gzip -n -9` 재실측은 full3733434B/subset561161B. 원보고의 full3733457B는 파일명헤더를 보존한 `gzip -9`로 재현됐으며 차이는23B다. 감량84.97%는 반올림상 동일하다. identity전송·gzip상당량·PDF파일크기를 구분했다.

이번 렌더는 sample2p/4011288px, inventory7p/14039508px, expanded8p/15510528px, 합 **17p/33561324px/변경0/PDF.js동일**이다. 원 sol render-final JSON의 여섯 PDF파일크기·픽셀수도 원보고와 exact equality를 확인했다(`sol-render-audit.json`). 이번 PDF 전체파일크기는 일부1–2B 달랐으며 전체 PDF byte equality는 계약이 아니다. Poppler descriptor 경고는 원로그에 보존했고 GS정상·입력대비PDF.js완전일치를 주장하지 않는다.

| 번들 gzip 지표 | main baseline | production 실물 | delta | 상한 | 판정 |
|---|---:|---:|---:|---:|---|

| entryJsGzip | 299283 | 299287 | +4 | 20480 | 통과 |

| affectedRouteJsGzip | 2440427 | 2450827 | +10400 | 61440 | 통과 |

| sharedJsGzip | 2716489 | 2716473 | -16 | 30720 | 통과 |

| appJsGzip | 5456199 | 5466587 | +10388 | 81920 | 통과 |

| cssGzip | 37687 | 37687 | +0 | 10240 | 통과 |

baseline·sol JSON의 per-file 합계를 독립 재집계하고 production 실물 gzip와 비교했다. override없음/multiplier1/신규route0/route→shared이동0B. 실제 coverage 배열을 포함한 helper **22278B/gzip9679B**는 QR route 소유로 분류됐다.

### 제품 규칙·범위 밖 변경

`scope.py`의 exact list 검사는 main 대비 src변경을 **QR 제품3파일**, `93a2318` 이후 변경을 **테스트3+기록2파일**로 확인했다. 최근 `71a6200..HEAD`는 QR스모크·review-notes 두 파일뿐이다. 사용자문구·locales·package-lock변경0; package.json은 **렌더회귀 npm script1줄** 외 구조적으로 동일하므로 runtime/devDependency추가0이다. 서버/API/SSR·route/SEO/사이트맵·광고/분석 격리 경계 변경0. 기존 전체 `QR_LABEL_FONT_PATH`의 의미·경로·바이트와 OFL 보존. 폴백은 조용히 수행하고 실패는 기존 현지화 PDF오류로만 표시한다.

QR helper 참조는 실행확장자별 repo-wide `rg`와 명시적4파일 허용목록으로 검사했다(`scope.json`, `logs/qr-callers.log`). 문서·생성물·vendor·dependencies는 비제품 소유목적으로 제외했다. 새 호출 표면 유출은 없다.

범위상 별도 설명: `.gitignore`는 위 D4공급계약에 필요; `AGENTS.md` 모델역할8줄은 최초dispatch의 위임커밋; backlog GS/PDF.js2건은 정본 요구다. backlog의 U4 문안은 후속 후보이며 별도 U4 정본·구현 범위를 대체하지 않는다. 끝빈줄삭제는 동작영향0. CSV import분리·JSZip제거·런타임subset·전체OTF변경·GS/PDF.js수리 등 명시제외는 유지됐다.

## 5. 기존 sol 광역 로그 감사

아래는 지시서가 허용한 **과거 로그 감사**이며 이번 재실행으로 표기하지 않는다. `sol-log-audit.json`에 command banner/성공footer/SHA/mtime, `numbers.json`에 원자료 개수를 기록했다. 타임스탬프는 UTC이며 KST는+9시간이다.

| 항목 | 판정 | 원문·원자료 확인 |
|---|---|---|
| visual ko/en | **[통과] 실행·캡처 근거** | mtime15:50:18.355Z/15:52:09.763Z, 각175고유캡처/175·105.75s/105.33s. 각각ko71+en104 전체집합이므로 2로케일전체집합2회. 성공시PNG를 별도 저장하지 않는 모드로 PNG0, 기준선 변경0. |
| a11y | **[통과]** | measuredAt15:54:24.498Z, 8페이지/위반0/외부0/total상한0/placeholder대비4.8871:1. |
| recovery | **[통과]** | 147PASS/summary147개모두pass/개별JSON147+summary1/PNG153, 15:43:50.347Z–15:48:22.457Z. |
| rendering | **[통과]** | 15:54:40.446Z, 3페이지×3samples/CLS최대0/외부0. |
| browser/utilities/new-tools/office | **[통과] 실행로그** | 각npm명령banner·성공footer·mtime확인. Excel/Word/PDF, ko/enutilities, HWP/Image/Audio/Video, Office96download/7cache/DOCX5089B. 호스트미지원DV분기는 명시skip. |
| production/QA/clean build | **[통과] 실행로그** | `build-production-final`, `build-qa-final`, `clean-build`: prebuild/build/Vite성공/61localized pages footer. |
| 원 sol unit·fix2/fix3 unit | **[통과] 원 TAP 대조** | 각각241/247/247이 보고와 일치. fix3 QR두로그 SHA도 fix3보고와 일치. 현재HEAD는 이번247/247+QR두회0으로 독립 재검증. |
| 과거 OS raw exit·fix1 unit 원로그 | **[미검증] 보존형식 한계** | 과거 로그에는 별도OS exit/env메타가 없어 raw exit0을 직접 복원할 수 없다. fix1폴더에는 현재unit로그가 없어 과거246을 이번에 원문대조했다고 주장하지 않는다. 원 sol/fix2/fix3의 실재로그와 이번필수재실행 근거는 확보. |

미검증 표시는 과거 메타데이터의 보존 한계에 한정하며 현 HEAD의 필수검증 미실행을 뜻하지 않는다. 수치·성공footer·결과JSON·시각의 실제 근거를 확인했고 새 결함이나 미실행으로 단정할 증거는 없다.

## 6. 실행 게이트·종료 불변

첫 도구 호출은 `cat PROJECT_RULES.md` 전문이었다. 브랜치 AGENTS·정본v3/보강·구현dispatch·sol보고·3차검수/fix3·R1~R3·운영해시표/기각기록을 읽고 열린계획16개를 스캔했다. 요청 HEAD2f59a44/mainf29d249가 일치했다. 로드맵에 남은 과거기준은 최신 사용자dispatch와 QR정본을 검수 기준으로 적용했다. 현재U4는 QRselector를 바꾸지 않으며 미래 공용pdfFontEmbed우선·U4전체OTF유지 계약과 충돌하지 않는다.

`invariance.py` 전체 **3078파일** 대조는 **exit1**이다. 바뀐 것은 아래 비추적 계획서2개다. 이 검수 작업은 두 파일에 쓰지 않았다. 종료 재독에서 Claude서명 **U4 v13/11차결과·12차반박 요청**을 확인해 병행세션 변경으로 판단했다. 추가내용은 Type3글꼴의 구조제거 지원제외이며 QR폰트선택/공급과 충돌하지 않는다. 재독원문은 `u4-v13-reread.txt`에 보존했다.

| 병행 변경 문서 | 시작 SHA-256 | 종료 SHA-256 |
|---|---|---|

| `docs/jobs/todo/pdf-finish-20260905.md` | `ccef3cc2bf6d6bf60b69de10fb776a6783f4ff6f90eb7ad51949940e0d9cab7e` | `ab55ae25ee89b2503b4a0f9141007db5190f6160b84ee14e9a8a0094afb1d77e` |

| `docs/jobs/todo/roadmap-completion-20260906.md` | `fd917debafa54e61d700af585789cd8bf75d8c13de1d363f061b199177ae4c84` | `fb7af0de89a0496e8763891ac9cf122e27556852e0d203ce8bff3af0b18a63fe` |

`scope-invariance.py`는 **exit0**: **추적2373파일변경0·dist537파일변경0·public/vendor변경0·QR정본변경0·사용자3파일변경0**. 나머지3076파일SHA동일이다. HEAD/main/branch/status도 시작과 동일하다.

```text
$ git status --porcelain
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html

$ git rev-parse HEAD main
2f59a44737e87019fd90ca84f23e75c7d297ef97
f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e

$ git branch --show-current
s2b-qr-font
```

임시checkout의 추적diff0·정확한HEAD를 확인하고 자체dist링크와sentinel을 제거한 뒤 worktree를 제거했다. 원본 저장소 파일 수정·커밋·push·dist변경·브랜치전환·저장소안npm/pip설치는 하지 않았다. worktree등록/제거에 필요한 Git관리메타만 사용했다. 산출물·실험용변이는 `/tmp/worklazy-s2b-review4` 안에 있다. 재현하려면 `prepare-checkout.py`로 같은HEAD checkout을 다시 만든 뒤 기록된cwd/명령을 실행하면 된다.

**최종: [검수 통과] — 3차 F2-R 해소. F1-R·F1·HTTP 회귀·제품 코드 변경0을 재확인했으며 수정 후 재검수가 필요한 결함은 없다. 이 판정은 Claude 게이트의 입력이며 병합·push·배포를 수행한 상태는 아니다.**
