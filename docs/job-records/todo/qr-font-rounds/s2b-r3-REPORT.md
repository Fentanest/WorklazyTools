# S2b QR 라벨 PDF 폰트 감량 v3 — astra 3차 반박

작성: **Codx**, astra 반박 역할. 대상: `docs/jobs/todo/qr-font-20260906.md` 「v3 확정」. 기준 HEAD/main: `f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e`.

**잔여 이견 0건. Claude–Codex 간 이견 0 · [정본화 가능].**

v3는 R2-1·R2-2의 필요한 결정을 명시했고 고정 산출과 D4 정정도 실측에 맞는다. 다만 **2차 drafts를 무수정 복사하면 v3 구현이 되지는 않는다**. 아래의 초안 누락 세 항목을 v3 문안 그대로 `/tmp` 사본에 반영했다. 이는 새로운 정책 선택이나 재해석이 아니라 이미 적힌 요구의 적용이다. 최종 구현 참고는 이 보고서의 `drafts/`와 v3 문안이다. 이 판정은 계획 정본화 가능 판정이며 제품 구현·배포 완료 판정은 아니다.

## 항목별 판정

아래 명령은 별도 cwd 지정이 없으면 저장소 루트에서 실행했다. 산출 경로의 기준은 `/tmp/worklazy-s2b-r3`이다.

| 항목 | 판정 | 근거(명령·출력) | 정본 반영 문안 |
|---|---|---|---|
| R2-1 공용 export 소유권·취소·폰트 오류 경계 | **[동의·해소]** | `node --experimental-strip-types /tmp/worklazy-s2b-r3/runtime-probe.mjs` → **TOTAL PASS 24**. 2차 원형과 v3 적용본 각각 재실행. ZIP/PDF 경합: 이전 ZIP 오류 1→0, 새 PDF 상태 `""`→`"pdf"`; 생성 취소 stale 다운로드 1→0. `node .../check-drafts.cjs` → **TypeScript diagnostics: 0** | 현 v3 유지. ZIP/PDF 공용 동기 점유, 소유자만 오류/상태 해제, cancel·cleanup·unmount·run abort/error 무효화, 최종 Blob 뒤 task 양보+재검사를 구현한다. 구현 참고 초안은 이번 `drafts/QrBulkPanel.tsx`, `qrLabelFont.ts`, `qrLabelPdf.diff`를 사용한다. |
| R2-1 문안 대 2차 drafts의 누락 | **[동의] — 기존 초안 보완 필요, 신규 이견 아님** | `node .../lifecycle-alignment-probe.cjs`: 2차는 busy PDF `false`, abort/error clear 대기 중 export 진입 가능, 다음 storage 보존 `false`. v3 문안 적용 후 각각 `true`, 진입 불가, 보존 `true`. `node --experimental-strip-types .../optional-signal-probe.mjs` → PASS | v3의 `busy` 비활성·**storageRef 분리를 clear await보다 먼저**·optional AbortSignal을 빠뜨리지 않는다. 24개 probe만으로 이 세 요구의 반영 완료를 주장하지 않는다. 아래 위치 표는 구현 전달용이며 계약 변경이 아니다. |
| R2-2 스모크 하한 교체 | **[동의·해소]** | `node --experimental-strip-types .../smoke-size-probe.mjs` → 실제 QR worker PNG 25개, PDF **852,244B/2p**, 현 하한 `currentSmokePass:false`, embedded OTF 1개·931,704B·subset SHA 일치. `node .../scenario-probe.mjs` → 세 scenario 모두 새 SHA 단언 PASS, 잘못된 기대 폰트 음성 대조 3건 거부 | `%PDF`·재열기·2p 유지, 1MB 하한 삭제, 임베드 폰트 count/decoded size/SHA 단언. full과 손상 폴백도 전체 OTF pin으로 검사한다. 새로운 PDF 파일 크기 하한 없음. |
| R2-2 `qr-stage-metrics` scenario 분리 | **[동의]** | `node --check .../drafts/qr-stage-metrics.mjs` 등 3파일 exit 0. `scenario-probe.mjs` 실제 Chrome+HTTP+CDP+NetLog에서 subset 1회 / full 1회 / subset→full 각 1회, 캐시·SW 0. 25라벨 2p 및 2라벨 1p SHA 검사 PASS | `--scenario=subset\|full\|corrupt`, 기본 subset, 오타 거부. 밖 문자는 **라벨에 `똠` 정확히 1회**; payload는 그대로. 손상은 테스트 HTTP 서버의 정확한 subset 경로에서만 동일 크기 1바이트 변조. scenario별 출력 디렉터리와 새 브라우저 유지. |
| 고정 산출표 7행 + wheel | **[동의]** | `python3 .../verify-pins.py` → `tableRows:7`, 파일 8개(전체 OTF/OFL 분리 계수), wheel 1개, `allMatch:true`. 신규 자산 6개는 2차 `regen-a/b` 실물 byte equality 및 v3 size/SHA 모두 일치 | 현 표 유지. raw OTF는 검증/전개 산출이고 추적 공급 입력은 gz·coverage·provenance·재생성 목록이다. `coverage.schema.json`은 문서화용 schema라는 역할도 유지한다. |
| D4 현 vendor 삭제 범위 정정 | **[동의]** | `python3 .../old-vendor-boundary.py` → exit 0, full 내부 sentinel `false`, 형제 subset sentinel `true`. 현 `scripts/vendor-qr-label-font.mjs:9,40`과 일치 | 현 v3 정정 유지. “현 prebuild가 형제 snapshot까지 삭제한다”로 되돌리지 않는다. |
| D4 Node 전개·실패 시 보존 | **[동의]** | `python3 .../vendor-probe.py` → fetch 차단, full/OFL cache 존재 시 **2회 exit 0·9파일 SHA 동일**. gz·coverage·provenance 손상 및 coverage 누락 4종 **exit 1·public 불변**. full/OFL cache 누락+network 차단도 exit 1·public 불변 | 검증 후 staging·소유 snapshot 2개 교체, 기존 full 경로/바이트 보존. Python/network 비의존은 **subset 공급**의 경계이며 원본 full/OFL까지 완전 offline이라는 주장은 하지 않는다. |
| U4 충돌·sol 재해석 지점 | **[동의]** | 열린 계획서 `rg` 스캔, 종료 시 U4 v8 전문 재확인. U4 v8 추가 결정은 메모리 보유 상한·OCG 지원 조건·date 문법이며 QR selector 변경 없음. U4 공용 `pdfFontEmbed` 우선 계약 유지 | v3의 U4 공용 import 우선 문안을 유지한다. QR selector·coverage·fallback은 QR에 두고 U4는 전체 OTF를 쓴다. 이 초안의 direct import는 현재 HEAD용이며 U4 import를 되돌리는 근거가 아니다. |

## R2-1 — 문안과 초안의 정합을 확인한 방법

처음에는 2차 `drafts`를 내용 변경 없이 복사하고 `runtime-probe.mjs`의 BASE 경로만 바꾸어 실행했다. **24/24**였고 로그는 `logs/runtime-r2-identical.log`, 결과는 `runtime-results-r2-identical.json`에 보존했다. 기존 probe는 실제 panel 함수 본문을 추출·TypeScript 변환해 실행하고 font helper와 실제 pdf-lib를 사용한다. React 제품 전체 E2E는 아니다.

이어 v3를 줄별 대조하면서 다음을 적용했다. 이 세 항목은 v3에 이미 결정돼 있으므로 sol에게 정책 판단을 남기지 않는다.

| v3의 명시 요구 | 2차 초안 상태 | 이번 `/tmp` 적용 및 증거 |
|---|---|---|
| PDF 버튼은 `busy`에도 비활성 | `disabled`에 `busy` 없음 | `QrBulkPanel.tsx`의 PDF 버튼에 `busy ||` 추가. 실제 JSX의 disabled 식을 추출해 busy=true로 평가: false→true. |
| storageRef 분리 후 기존 snapshot clear | `cleanupResults`·effect는 반영, run abort/error 두 분기는 **await clear 뒤** undefined | run 두 분기의 undefined 대입을 await 앞으로 이동. 실제 두 분기 본문을 추출해 clear를 지연: 오래된 storage 재진입 방지, clear 대기 중 등록한 새 storage 보존을 단언. `drafts/v3-text-alignment.diff`. |
| helper optional AbortSignal | selector/loader 내부 함수는 required signal, PDF 생성 함수만 optional | helper의 signal도 optional로 수용하고 검사에 `?.` 적용. panel은 계속 active controller.signal을 반드시 전달한다. 신호 생략 선택·캐시 재사용·dispose 뒤 AbortError PASS. `drafts/v3-font-optional-signal.diff`. |

최종 사본에 대해 **24/24와 TypeScript 진단 0을 다시 확인**했다. `runtime-results.json`, `logs/runtime.log`, `logs/typecheck.log`가 최종 결과다. `lifecycle-alignment-results.json`은 2차/v3 대조 여섯 행, `logs/optional-signal.log`는 신호 생략 호환 검사다. 최종 `drafts/QrBulkPanel.diff`, `qrLabelFont.diff`, `qrLabelPdf.diff`도 현 HEAD 기준으로 재작성했다.

핵심 예외는 기존 24개 실험에서 그대로 통과했다: 원문+NFC 검사/NFD 11,172 전수(raw-only 거짓 양성 8,822→0), 자산 404·503·network·HTML·빈 body·잘림·동일 크기 다른 SHA, 양쪽 실패, abort 뒤 fallback/cache 부활 방지, 중복 클릭·preset 스냅샷·2,400 상한, typed font-init만 full 1회 재시도, PNG/save와 import 오류의 font 재시도 금지, unmount·생성 취소·최종 다운로드 task 경계.

`PDFDocument.create`는 typed catch 밖이고 `registerFontkit`/`embedFont`만 typed 오류로 감싼다. 따라서 PNG read/embed·draw·save 실패는 일반 PDF 오류로 끝난다. 원래 이 경계, panel별 cache factory, Promise.all 즉시 rejection 연결, 최종 task 양보는 2차 초안과 v3가 정합한다. 페이지 경계 양보는 실제 PDF 생성 helper에, 커버리지 양보는 font selector에 둔다. 동기 font/layout/save 한 단위의 즉시 중단은 보장하지 않는다.

## R2-2 — 현행 테스트에 들어갈 실행 초안

`drafts/qr-bulk-smoke.mjs`와 `.diff`, `drafts/qr-stage-metrics.mjs`와 `.diff`, 공용 `drafts/qr-font-scenarios.mjs`를 작성했다. 구현 시 공용 파일의 위치는 **`tests/qr-font-scenarios.mjs`**다.

스모크의 기존 취소/재실행·7 payload·ZIP·manifest 검사는 보존하고 마지막 PDF 경계 검사를 세 scenario 루프로 교체한다. 매 scenario에서 navigation으로 panel을 다시 만들고 HTTP cache를 끈다. 같은 다운로드 파일명을 쓰므로 클릭 전에 이전 PDF를 삭제하여 이전 성공 파일을 새 성공으로 오인하지 않는다. 25행 CSV는 `Primary,Label`, title template은 `{{Label}}`이고 full fixture의 첫 Label에만 `똠` 1자를 추가한다. **payload만 바꾸면 커버리지 검사 대상이 아니므로 full 선택 실험이 되지 않는다.**

측정기는 다음 호출을 각각 새 프로세스/브라우저로 실행할 수 있게 했다. 명령은 **구현 후 제품 계측용**이며 이번에 이 명령으로 제품 4단계 전송량을 측정한 것은 아니다.

```sh
npm run measure:qr -- --scenario=subset
npm run measure:qr -- --scenario=full
npm run measure:qr -- --scenario=corrupt
```

출력은 `${QR_METRICS_OUTPUT || '/tmp/worklazy-qr-stage-metrics'}/<scenario>/`에 나뉜다. 단계 4개, page/worker CDP·NetLog, worker auto-attach, cache-disabled, SW 차단, 단계 완료+700ms quiet, 실제 HTTP 전송과 dist JS gzip의 분리는 현행 그대로다. 결과 JSON에 scenario·라벨 template·font injection·embedded font 결과를 추가한다.

테스트 서버는 로컬 preview 앞의 HTTP proxy다. 일반 응답은 원본 body/status/headers를 전달하고 **corrupt에서만 정확한 subset OTF 경로**의 검증된 바이트를 1바이트 바꾸어 같은 크기/HTTP 200으로 보낸다. page.route/브라우저 fetch mock을 사용하지 않으므로 NetLog의 실제 body bytes로 측정 가능하다. 저장소 자산·HTTP 캐시 정책을 바꾸지 않는다.

초안의 함수들을 실제 브라우저에서도 실행했다. `scenario-probe.mjs`는 `/tmp`에서 Vite **write:false**로 font/PDF helper를 묶고, 실제 저장소 QR worker로 만든 PNG를 사용하여 다음을 확인한다. 제품 화면/4단계 전체 E2E는 아니며, 2라벨 출력은 25라벨 fixture의 앞 2개를 사용한 페이지/폰트 구조 검사다.

| scenario | 최초 선택→실제 자산 | 실제 HTTP 폰트 요청 | 폰트 body B 합(identity) | 폰트 NetLog 전송 B 합(headers 포함) | 25라벨 PDF B / 페이지 | embedded OTF |
|---|---|---|---:|---:|---:|---|
| subset | subset→subset | subset 1회 | 931,704 | 931,855 | 852,244 / 2 | 1개, subset size/SHA 일치 |
| full | full→full | full 1회 | 4,644,748 | 4,644,900 | 4,102,724 / 2 | 1개, full size/SHA 일치 |
| corrupt | subset→full | subset 1회→full 1회 | 5,576,452 | 5,576,755 | 4,102,716 / 2 | 1개, full size/SHA 일치 |

세 scenario의 2라벨 출력도 모두 1페이지·기대 font SHA였다. 잘못된 기대 폰트를 넣은 음성 대조 3건은 전부 실패했다. 로그 `logs/scenarios.log`, 구조 결과 `scenario-results.json`, 실제 PDF/NetLog는 `scenario-subset/`, `scenario-full/`, `scenario-corrupt/`에 있다. 이 표는 **실험 서버의 폰트 요청만** 나타낸다. 운영 gzip 전송량이나 QR 제품 PDF 단계 전체 전송량의 전후 표로 사용하면 안 된다.

## 고정 산출 및 D4

`verify-pins.py`는 문서의 6개 신규 파일 행을 직접 파싱하고 2차 `regen-a/b`의 실물 바이트를 비교했다. 전체 OTF/OFL 합친 7번째 행은 두 파일로 분리하여 현 public과 2차 vendor cache를 비교했다. wheel은 1차에 보존한 실물의 전체 SHA를 다시 계산했다. 모든 값은 `pin-results.json`에 전체 64자리 SHA로 기록되어 있다.

- 목록: 23,757B, `ac8fefb5…978b0c`.
- subset OTF: 931,704B, `b84d27a5…3a252be`.
- GNU gzip 산출: 561,161B, `e1db3cdc…c7e66`.
- coverage: 19,686B, `58f24844…8eafea`.
- coverage.schema: 444B, `919d01b6…17e6b0`.
- provenance: 1,201B, `30e10e18…f77667`.
- 전체 OTF/OFL: 4,644,748B/4,301B, 기존 전체 SHA 유지.
- wheel: 4,912,766B, `738f31f23e0339785fd67652a94bc69ea49e413dfdb14dcb8c8ff383d249464e`.

이번 라운드는 요청대로 2차 독립 재생성 산출을 재사용하여 byte equality를 재확인했다. FontTools 재생성 두 번이나 Poppler/PDF.js 17페이지 oracle을 이번에 새로 실행했다고 주장하지 않는다. 원래 그 게이트는 구현/자산 교체 완료 기준에 남는다. Python/Node gzip으로 바꾸지 않는 계약, 모든 SHA 일치 후 source 공급 입력 교체, 손수정 금지, 빌드에서 subset 공급에 Python/pip/npm 추가 의존이 필요 없다는 D4 경계에 이견이 없다.

## 실행 제한·저장소 종료 검사

첫 도구 호출은 `cat PROJECT_RULES.md`였다. AGENTS, dispatch, QR 계획 전문, 상위 결정 10·11/S2-P, R4, OFFICE_EDITOR_ASSETS QR 절, review-notes WOFF2/subset 기각 기록을 읽었다. 설치·인터넷 조사·서브에이전트 호출은 하지 않았다. 저장소 파일/계획서를 편집하지 않았고 커밋·push·저장소 dist 변경도 하지 않았다. 실험 쓰기는 `/tmp/worklazy-s2b-r3`에만 했다. 기존 1·2차 산출과 저장소 node_modules는 읽기/실행 용도로 재사용했다. 사용자 파일 세 개는 열거나 조작하지 않았다.

시작/종료 `git status --porcelain`은 동일하다.

```text
 M AGENTS.md
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html
```

HEAD=main=`f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e`, origin/main=`1a04f2571109495a76b8468af95b2f4edcd862cf`로 유지됐다.

**전체 snapshot 불변 검사는 exit 1이다. 이 실패를 통과로 덮지 않는다.** 시작/종료 2,909개 파일을 비교했을 때 아래 비추적 계획서 2개가 작업 도중 바뀌었다.

- `docs/jobs/todo/pdf-finish-20260905.md`: 종료 내용에 Claude 서명의 U4 v8 결정이 추가되어 있다.
- `docs/jobs/todo/roadmap-completion-20260906.md`: U4 6차 결과와 v8/7차 디스패치 기록이 추가되어 있다.

두 파일은 이 작업의 쓰기 대상이 아니며 직접 수정하지 않았다. 관측 시점과 문서의 작성 표기상 병행 세션 변경으로 판단한다. 정확한 before/after SHA는 `scope-audit-results.json`에 기록했다. `logs/unchanged.log`에는 **AssertionError와 실패 원문**이 있다.

별도 범위 감사 `python3 /tmp/worklazy-s2b-r3/scope-audit.py`는 exit 0: **추적 파일 2,362개 변경 0, dist 531개 변경 0, QR v3 계획서 SHA 동일**. `AGENTS.md`의 기존 워킹트리 내용도 SHA 동일하다. 전체 불변과 이 범위 불변을 구분한다. 시작/종료 전체 SHA 목록은 `sha-start.json`, `sha-end.json`, status는 `status-start.txt`, `status-end.txt`다.

최신 U4 v8을 다시 읽은 기록은 `logs/u4-v8-reread.txt`다. 바뀐 결정은 S2b의 폰트 선택/공급 계약과 충돌하지 않고, 상위 결정 10·11 및 U4의 공용 import 우선·전체 OTF 유지도 유효하다. 따라서 기준 해시와 S2b 판단 전제는 유지된다.

제품 build·전체 unit·`test:qr-bulk`·`test:utilities`·`test:static`·번들 5종·시각 게이트는 이번 반박 라운드에서 실행하지 않았다. 이번 실행은 24개 runtime probe, TypeScript noEmit, 실제 QR worker/PDF 자산 probe, scenario HTTP/NetLog 실험, hash/vendor 검증이다. 제품 완료 게이트는 sol 구현 후 그대로 실행해야 한다.

**최종 판정: 잔여 이견 0건 · Claude–Codex 간 이견 0 · [정본화 가능].**
