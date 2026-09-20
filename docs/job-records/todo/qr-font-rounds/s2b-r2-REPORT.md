**S2b QR 라벨 PDF 폰트 감량 v2 — astra 2차 반박 보고서**

작성: Codx, astra 반박 역할. 기준: `f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e`. 대상: `docs/jobs/todo/qr-font-20260906.md` 전문 중 「v2 확정」 D1~D6. 산출물: `/tmp/worklazy-s2b-r2`.

**판정: 잔여 이견 2건 · [재왕복 필요].** D3의 export 생명주기 연결 범위와 D5의 기존 PDF 크기 단언 교체를 정본에 명시해야 한다. 두 건 모두 수정 위치와 실행 가능한 diff 초안을 준비했다. D1·D2·D4·D6의 설계에는 동의한다. D4 공급 경계는 「생성물 직접 수정 금지」와 정합한다. 요청된 목록/schema/SHA의 구체화, 아래 사실 정정, 코드 삽입 위치 제시는 새로운 대안 선택이나 독립 이견으로 중복 집계하지 않았다. 이 보고서가 구현 착수 지시나 Claude의 미승인 문안에 대한 합의 선언은 아니다.

**실행 게이트와 변경 제한**

첫 도구 호출은 `cat PROJECT_RULES.md`였다. AGENTS, 갱신된 dispatch, QR 계획 전문, 상위 S2-P·결정 10·11, R4, OFFICE_EDITOR_ASSETS QR 절, review-notes의 WOFF2/runtime subset 기각 기록, 1차 보고서를 읽었다.

```text
git rev-parse HEAD main origin/main
f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e
f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e
1a04f2571109495a76b8468af95b2f4edcd862cf

git diff 1a04f2571109495a76b8468af95b2f4edcd862cf..f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e --stat
 CLAUDE.md | 8 +++++---
 1 file changed, 5 insertions(+), 3 deletions(-)
```

QR 계획 본문 머리의 `1a04f25`는 아직 구 기준이나, 이번 사용자의 명시 갱신 및 dispatch가 `f29d249`를 확정하므로 게이트를 통과했다. 정본 작성 때 머리도 동기화할 것. `origin/main`이 뒤에 있는 것은 정상이며 fetch/reset/checkout을 하지 않았다.

`rg -n 'qrLabelPdf|qr-label-font|QR_LABEL_FONT|S2b|S2-P|subset' docs/jobs/todo --glob '*.md'` 결과는 `logs/open-plan-scan.log`. R4는 런타임 subset 금지, 최신 사용자 결정은 사전 생성 OTF 허용, U4는 전체 OTF 보존이다. 폰트 선택 정책의 상반 지시는 없다. 다만 U4 v6/v7은 QR도 공용 `pdfFontEmbed` 청크를 쓰도록 한다. 이 라운드의 `qrLabelPdf.diff`는 **현재 f29d249 코드 기준**이며, U4 병합 때 그 공용 import를 원래 direct import로 되돌리는 근거로 사용하면 안 된다. QR 전용 selector·coverage·fallback은 QR 쪽에 남기고, typed 오류는 공용 font 초기화 호출을 감싸는 QR 경계에 유지한다. 공용 API/번들 게이트의 정본화·구현은 U4 소관이며 이 라운드에서 그 구현 완료를 주장하지 않는다.

저장소 파일 편집·계획서 편집·커밋·push·dist 변경·저장소 설치를 하지 않았다. Python은 1차 venv/fonttools 4.59.2를 재사용했고 npm/pip 설치와 외부 인터넷 조사도 하지 않았다. 실험 코드는 전부 `/tmp/worklazy-s2b-r2`에 기록했다. 저장소 모듈·node_modules는 읽기/실행만 했다. React 제품 전체 빌드 대신 TypeScript CompilerHost에 /tmp 초안을 가상 주입하여 `noEmit` 검사했다.

**항목별 판정**

| 항목 | 판정 | 근거(실행 명령·출력) | 정본 반영 문안 |
| --- | --- | --- | --- |
| D1 레시피·oracle | **[동의]** | `regenerate.py regen-a`, `regenerate.py regen-b`: OTF 931,704B, SHA `b84d27a5…3a252be` 동일, 3,394자 GID/hmtx/RecordingPen outline 차이 0. `oracle.mjs`: 3 fixture·17p·33,561,324px, Poppler 차이 0, PDF.js 추출 동일 | 현 v2 유지. Poppler 경고 및 기존 GS/PDF.js 결함을 숨기지 않는다. PDF 바이트 동일을 새 게이트로 추가하지 않는다. |
| D2 목록·coverage | **[동의]** | 같은 재생성에서 목록 SHA `ac8fefb5…978b0c`, 1차 배열 JSON SHA `63a25fe8…d1ded`까지 exact 일치. 새 schema JSON 19,686B, SHA `58f24844…8eafea`. `runtime-probe.mjs`: NFD 11,172 전수 raw-only 오판 8,822 → 양쪽 검사 0 | 아래 고정 경로·직렬화·schema·전체 SHA를 편입한다. 19,616B는 1차 bare array이며 새 schema에는 사용하지 않는다. |
| D3 helper·token·cleanup | **[이견 R2-1]**, 선택/fetch/cache/S0 설계는 동의 | `runtime-probe.mjs`: 현 ZIP finally + PDF-only token 조합은 새 PDF 실행 중 `exporting=''`, 오래된 ZIP 오류 1. shared lease 초안은 `exporting='pdf'`, 오래된 오류 0. 현 cancel은 부분 PDF stale 다운로드 1, 보완 후 0. `browser-probe.mjs`: 폰트 404 reload 0·retry key 0, 실제 Vite 청크 404 reload 1 | PDF/ZIP 공용 동기 export token을 채택한다. `cleanupResults`, unmount뿐 아니라 `cancel`, run의 abort/error 결과 폐기에도 무효화를 연결한다. PDF 최종 다운로드 직전 task 양보 후 token 재검사를 명시한다. 아래 diff를 위치 계약으로 편입한다. |
| D4 생성 입력·Node 전개 | **[동의]** | `vendor-probe.py`: builtins-only Node, fetch 차단·기존 full/OFL cache 고정 상태에서 2회 exit 0·9개 파일 SHA 동일. gzip/coverage/provenance 손상·coverage 누락은 exit 1·public 불변. schema 직접 음성 12건 거부. `vendor-old-boundary` 실험: 원래 full snapshot 안 sentinel만 삭제, v2의 형제 snapshot은 유지 | 생성 입력과 public 산출 역할을 아래처럼 구분한다. 현재 vendor 삭제 범위는 full snapshot 내부로 사실 정정한다. GNU gzip `-n -9`를 그대로 사용하고 새 Python gzip으로 바꾸지 않는다. 전체 build의 완전 offline을 주장하지 않는다. |
| D5 예외표·검증 위치 | **[이견 R2-2]**, 예외 정책 자체는 동의 | `smoke-size-probe.mjs`: 실제 현행 QR worker·기존 스모크 설정/25 payload로 852,244B·2p PDF 생성, 임베드 subset SHA 일치. 현 `tests/qr-bulk-smoke.mjs:128`의 `<1_000_000` 조건 때문에 FAIL. 아래 표에서 모든 행의 코드 위치를 지정 | 기존 “PDF ≥1MB” 단언을 삭제하고 `%PDF`·재열기·2p·고정 subset font stream size/SHA 검증으로 교체한다. 원본 대비 렌더/추출 게이트는 별도 유지. D3 관련 예외는 R2-1로만 집계한다. |
| D6 B/C | **[동의]** | 실제 Chrome 152.0.7977.64의 `DecompressionStream('brotli')`는 Unsupported. `/tmp` Vite/browser probe는 PDF 클릭 전 font 요청 0, 클릭 뒤 helper 로드. 1차 Brotli 자산 비교는 기존 산출을 재사용 | B 미채택·C 클릭 뒤 병렬화 유지. “브라우저 전면 불가”로 회귀하지 않는다. 타 브라우저 표준/지원 수치는 이번에 웹 재조사하지 않았다. |

**R2-1 — 생명주기 반례와 닫을 문안**

현 `QrBulkPanel.tsx:94`의 `exporting`은 ZIP과 PDF가 공유한다. `downloadZip:260–277`은 동기 ref 가드가 없고, `finally`가 무조건 `setExporting('')`, catch가 무조건 ZIP 오류를 쓴다. 따라서 PDF 함수에만 token을 넣고 `cleanupResults`에서 PDF 상태를 초기화하면 이전 ZIP 작업이 새 PDF 상태를 훼손한다. 상태를 초기화하지 않는 대안은 정리 후 새 PDF 실행을 이전 작업 종료까지 막는다. 이 선택을 sol에게 남기면 안 된다.

현 PDF 버튼 `:361`은 `busy`를 검사하지 않으므로 QR 생성 중 부분 결과에서 PDF를 시작할 수 있다. `cancel:250–253` 및 run의 결과 폐기 `:229–242`는 `cleanupResults`를 호출하지 않는다. 그 표면을 빠뜨리면 생성 취소 뒤에도 이미 PNG를 읽은 PDF가 다운로드된다.

재현은 `runtime-probe.mjs`가 **현재 ZIP/cancel 함수 본문 또는 제안 diff의 함수 본문을 실제 파일에서 추출·TypeScript 변환해 실행**한 것이다. 독립적으로 상태기계를 다시 써서 가설을 확인한 것이 아니다. React DOM 전체의 E2E는 아니므로 그 범위를 넘어 주장하지 않는다.

```text
current ZIP finally + PDF-only lease:
  new PDF pending -> exporting="", stale ZIP message=1
shared lease draft:
  new PDF pending -> exporting="pdf", stale ZIP message=0
current generation cancel -> stale PDF downloads=1
draft generation cancel -> stale PDF downloads=0
queued cancellation task at PDF completion -> draft downloads=0
```

정본 반영 문안:

> `exporting`의 소유 token/ref는 ZIP·PDF 공용이다. 두 함수 모두 첫 await 전 동기 점유, results/storage/preset 스냅샷, 소유 token의 finally만 상태 해제/오류 표시를 적용한다. ZIP 알고리즘·파일명·출력 형식은 유지한다. `cleanupResults`와 effect cleanup, `cancel`, run의 abort/error 결과 폐기에서 export를 abort·무효화하고 폰트 캐시를 dispose한다. storageRef를 undefined로 분리하고 기존 storage 스냅샷을 clear하여 새 storage를 이전 await 뒤에 지우지 않는다. 오래된 import/fetch/digest 완료로 cache ref를 재설정하지 않는다. PDF helper는 optional AbortSignal을 받고 각 await 뒤·페이지 경계 task 양보 뒤 검사한다. 마지막 Blob 생성 뒤에도 `setTimeout(0)` task 양보 후 token을 재검사하고 download한다. 단일 동기 font/layout/save 내부의 즉시 중단을 보장하지 않는다.

위치 초안:

- `drafts/QrBulkPanel.diff` / 완전 파일 `drafts/QrBulkPanel.tsx`: refs(현 :67–69 뒤), effect(현 :96), ZIP(현 :260), PDF(현 :280), cancel(현 :250), run 결과 폐기(현 :231·238), cleanup(현 :373).
- `drafts/qrLabelFont.diff` / `drafts/qrLabelFont.ts`: 메인 스레드 선택, JSON schema 방어, 검증된 ArrayBuffer만 두 자산별 캐시하는 **panel별 lazy factory**. module 전역의 dispose 불가능 캐시는 쓰지 않는다. pending promise 공유 없음.
- `drafts/qrLabelPdf.diff`: `PDFDocument.create`는 font catch 밖, `registerFontkit`/`embedFont`만 `QrLabelFontInitError`로 감싼다. PNG read/embed·draw·save는 밖에 둔다. 실제 font parsing 오류는 typed, 실제 PNG 오류는 untyped임을 실행 확인했다. save에서 뒤늦게 드러나는 font 문제도 이 좁은 초기화 단계 밖이면 일반 PDF 오류로 끝낸다.
- `Promise.all`의 세 분기(helper→선택→자산, PDF import, PNG read)에 즉시 rejection handler를 연결한다. import 오류를 font 오류로 포장하지 않는다. 한 분기가 실패한 뒤 finally의 controller.abort로 다른 분기를 정리한다.
- `selected.kind==='subset'`이고 typed font-init 실패일 때만 subset byte cache를 evict하고 full을 1회 load, 새 PDFDocument로 다시 생성한다. 이미 full로 폴백한 뒤의 실패에는 재시도하지 않는다. PNG는 스냅샷 entries를 재사용하여 재독하지 않는다.

실제 검증: `node check-drafts.cjs` **진단 0**, `node --experimental-strip-types runtime-probe.mjs` **24개 실험 PASS**. 결과와 케이스별 출력은 `runtime-results.json`, `logs/runtime.log`. 변경하는 완료 기준에 대해 실제 제품 브라우저/스모크 검증을 이 결과로 면제하지 않는다.

**R2-2 — 기존 스모크의 크기 단언은 감량 성공을 실패 처리한다**

`smoke-size-probe.mjs`는 저장소의 `qr-bulk.worker.ts`를 임시 Vite 빌드(write:false)로 실제 Chrome worker에서 실행했다. payload는 기존 스모크의 `한글 라벨 경계 1`…`25`, 기본 설정은 size=640·quietZone=4·M·foreground=#111118·background=#ffffff·불투명, 제목은 `한글 라벨 제목`, 설명은 빈 문자열이다. worker가 생성한 PNG 25개(합 295,864B)를 **저장소 현행 `createQrLabelPdf`**에 넣었다.

```text
PDF bytes: 852244
pages: 2
existing smoke predicate: false
embedded OTF streams: 1
embedded bytes: 931704
embedded SHA: b84d27a582d3f3e660db728e7913af3061d4e825e93cabdb6802f0ce23a252be
```

정본 반영 문안:

> `tests/qr-bulk-smoke.mjs:128`의 1,000,000B 하한은 전체 OTF를 가정한 휴리스틱이므로 제거한다. `%PDF`, `PDFDocument.load`, 기대 2페이지는 유지한다. 이 **subset 정상 fixture**에는 raw embedded OTF stream 정확히 1개, decoded size 931,704 및 subset SHA 일치를 단언한다. full 선택/손상 폴백 fixture는 각 기대 전체 SHA를 따로 단언한다. 파일 크기에 새 임의 하한을 두지 않는다. Poppler·PDF.js의 원본 대비 비회귀는 기존 3 fixture 게이트에서 계속 검증한다.

초안: `drafts/qr-bulk-smoke.diff`. 새 raw-stream SHA 검증은 위 실험에서 실행했지만 전체 `npm run test:qr-bulk`를 변경 제품에 대해 실행했다는 뜻은 아니다. 측정기 `tests/qr-stage-metrics.mjs:149–155`의 현재 입력은 정상 subset 1종으로 고정돼 있으므로 정본의 3종 측정을 위해 scenario 입력(정상/밖 문자/손상)을 인자로 분리한다. 기존 CDP·NetLog·cache-disabled·SW 차단 조건은 유지하며 손상 주입은 테스트 서버의 해당 자산 응답에서만 수행한다. 이는 이미 v2 완료 기준이 요구한 검증 확장의 구체 위치이며 별도 이견은 아니다.

**D2 — 목록과 JSON의 고정 방식**

고정 source 폴더 제안은 `scripts/assets/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/`이다. `unicodes-alias.txt`도 이곳의 **재생성 입력**으로 추적한다. 샘플의 단순 복사만 한 것이 아니라 KS 매핑→3,095 base subset→layout glyph 이름을 원본 cmap에 역대응→299개 alias 추가→3,394개 목록을 이번 라운드에서 두 번 새로 생성했다.

- KS X 1001은 1차에 보존한 Unicode 매핑 파일 SHA `d8d2a35206ac0ea2865f5d801c9d6717f735bf46f263a658a64a960abe59e371`를 먼저 검증, Python euc_kr 행렬의 현대 한글 2,350자와 독립 대조했다. 신규 네트워크 다운로드 없음.
- 목록: ASCII `U+0020,U+0021,...`, 대문자 4자리 이상 hex, 숫자 오름차순, 중복 없음, **마지막 LF 없음**. 요청 3,218에서 원본 cmap 없는 123 제외, 3,095+299=3,394. U+2026 포함.
- coverage: UTF-8 JSON, 키 순서 `schema`, `snapshot`, `codepoints`, 공백 없는 직렬화, **마지막 LF 1개**. `{"schema":1,"snapshot":"noto-cjk-sans-2.004-ksx1001-v1","codepoints":[32,33,...]}`.
- schema: 정확한 세 필드·additionalProperties=false·schema=1·snapshot exact·3,394 integers·0…0x10FFFF·surrogate 제외·unique·U+2026 포함. 숫자 **엄격 오름차순**은 별도 vendor validator로 검사한다(JSON Schema의 uniqueItems만으로 순서를 보장하지 않음). 동일 guard를 runtime에 두되 schema/version 불일치 시 full 선택한다.
- 폰트 parser로 얻은 실제 최종 cmap에서 coverage를 만든다. 원본 요청 목록으로 자기충족 검사를 하지 않는다. 최종 cmap과 목록의 exact equality도 단언한다.

| 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| `unicodes-alias.txt` | 23,757 | `ac8fefb54a969022fc1b139a3a7a1937f711e71280fb992683eb0d4d43978b0c` |
| 1차 bare array 재생성 `coverage-r1-array.json` | 19,616 | `63a25fe8084daf6f58b6596294186a80dbe0e582124000fa50339784600d1ded` |
| 새 `coverage.json` | 19,686 | `58f248442d4e8e5726559644a746740bd0066cebabf154956e0bb7e1458eafea` |
| 초안 `coverage.schema.json` | 444 | `919d01b6713b3438f6cd36091d3244a04a28822b031a5cdd7ac135ff3d17e6b0` |
| `NotoSansKR-Regular.ksx1001.otf` | 931,704 | `b84d27a582d3f3e660db728e7913af3061d4e825e93cabdb6802f0ce23a252be` |
| `NotoSansKR-Regular.ksx1001.otf.gz` | 561,161 | `e1db3cdcbb8d76fc0546ec582bed773b3b7ef3da60867b6828493a6b342c7e66` |
| 초안 `provenance.json` | 1,201 | `30e10e1815835b8076a100ecdc9804c2613b115b555cbcc0b122150b92f77667` |

두 번 재생성의 `results.json` 전체가 동일했다. 1차 목록·OTF·gzip·bare array도 byte equality를 단언했다. 위 새 coverage/provenance SHA는 **이번 명시한 schema/직렬화에만** 적용한다. 최종 문서의 “위 5행”은 고정 행 수 대신 역할별 해시표로 바꿀 것: 전체 OTF·OFL, 목록, subset OTF·gz, coverage·provenance, 도구 lock을 누락하지 않는다.

실물은 `regen-a/`, `regen-b/`, 정본 편입용 폴더 모양은 `drafts/scripts/assets/.../`에 있다. `coverage-r1-array.json`은 재현 비교용이며 제품 runtime의 별도 두 번째 목록이 아니다. `coverage.schema.json`은 문서화용 schema 초안이고 작은 직접 validator로 검증하므로 Ajv 등 의존 추가가 필요 없다.

**D4 — 공급 경계·vendor diff·재생성 계약**

「생성물 직접 수정 금지」는 생성 스크립트 및 입력을 고쳐 산출을 만들라고 요구한다. `.otf.gz`·coverage·provenance를 개발자 재생성 도구가 만드는 **버전 고정 공급 입력**으로 추적하고, 일반 Node vendor가 검증·전개하여 public을 작성하는 두 단계는 이 규칙에 맞는다. “입력”이라고 이름만 붙여 사람이 바이너리를 바꾸는 것은 허용하지 않는다. 명시 regen만 source 산출을 교체하고 vendor는 그 입력을 수정하지 않는다.

`drafts/vendor-qr-label-font.diff`와 완전 파일 `drafts/vendor-qr-label-font.mjs`는 현재 스크립트를 기준으로 작성했다. 동작은 local input size/SHA→bounded gunzip→OTF size/SHA→coverage schema→provenance 참조 검증→기존 전체 OTF/OFL cache 또는 고정 원격 응답 검증→모든 출력 staging→두 소유 snapshot만 교체→manifest 생성이다. 전체 snapshot의 OTF/OFL/manifest는 기존과 동일하다. 다른 snapshot sentinel도 유지했다. rename 실패에는 정상 JS 예외 경로의 rollback을 둔 초안이며 강제 프로세스 종료·전원 장애까지 원자적이라고 주장하지 않는다.

```text
python3 /tmp/worklazy-s2b-r2/vendor-probe.py
2 vendor runs (global fetch throws NETWORK_DISABLED): exit [0, 0]
public files including unrelated sentinel: 9, SHA identical
corrupt gz / coverage / provenance; missing coverage: exit 1, public unchanged
full or OFL cache missing + NETWORK_DISABLED: exit 1, public unchanged
```

Python/npm 신규 도구 없이 **subset 공급**이 가능하다는 증명이다. clean checkout에서 원본 전체 OTF/OFL까지 네트워크 없이 공급된다는 뜻은 아니다. 그 두 자산의 기존 원격/cache 경로는 그대로다.

v2 도입 문장 사실 정정: 현 스크립트의 `destinationRoot`는 `.../noto-cjk-sans-2.004/`다. 이번 `vendor-old-boundary.json`의 현행 스크립트 복사 실행은 `insideFullSnapshotSurvives=false`, `separateV2SnapshotSurvives=true`였다. 따라서 별도 `...-ksx1001-v1/`를 “현 prebuild가 지운다”는 설명은 정확하지 않다. 그래도 clean checkout에는 수기로 놓은 자산이 없고 공급/검증 계약도 없으므로 Node vendor 확장 결론은 유지된다. 기존 1차 실험은 full snapshot **내부**에 놓은 subset을 지운 것이었다.

재생성 문안은 다음으로 구체화한다:

> `scripts/build-qr-label-font-subset.py`는 고정 원본 OTF·목록 SHA와 fonttools 4.59.2를 검증하고 v2의 모든 옵션으로 임시 OTF를 생성한다. 원본 대비 cmap/GID/hmtx/RecordingPen 및 고정 OTF SHA 통과 후 `gzip -n -9 -c`로 압축한다. 재생성 환경의 압축 구현은 이번 기준 `gzip 1.12`이며 결과 SHA가 최종 기준이다. Python `gzip.compress`·Node gzip으로 조용히 치환하지 않는다. coverage/provenance는 위 정규 직렬화로 생성하고 최종 SHA가 모두 일치한 뒤 scripts/assets 입력을 교체한다. 다른 환경에서 해시가 다르면 실패하고 임의로 snapshot/hash표를 올리지 않는다. requirements는 `scripts/requirements-fonts.txt`, 고정 wheel hash는 아래와 같다.

```text
fonttools==4.59.2 --hash=sha256:738f31f23e0339785fd67652a94bc69ea49e413dfdb14dcb8c8ff383d249464e
```

이번 wheel은 CPython 3.12/Linux x86_64용이며 모든 OS의 설치 가능성·결정성을 보장하지 않는다. 압축 방식 고정은 실질적이다: 같은 OTF를 현재 Python `gzip.compress(..., mtime=0)`로 압축하면 **558,007B / SHA `8e4c5f1f8848552c14b0b6b37ceb996300ea88404fbed5484c4abaa96da7707d`**, GNU gzip은 **561,161B / `e1db…c7e66`**였다. 1차의 `gzip -n -9` 레시피를 유지하면 된다.

`regenerate.py`는 이번 `/tmp` 실험용 완전 재현 스크립트다. 그 hardcoded `/tmp/worklazy-s2b-r1` 경로를 제품 생성기에 복사하라는 뜻이 아니다. 제품 생성기는 위 입력·출력 경계로 구현하고, 코드 옵션 또는 schema를 바꾸면 새 해시/회귀 검증을 거쳐야 한다.

**D5 — 예외표의 코드 위치**

1차 보고서 §3의 표는 실제 **18개 데이터 행**이다(`R1_EXCEPTION_ROWS=18`). v2/dispatch의 “19행”은 개수 오기다. 아래에서는 기존 “coverage 입력 파손·runtime 불일치” 한 행을 build/runtime 두 행으로 분리하여 **19행**으로 표시했다. 누락된 새 정책을 임의로 보충한 것이 아니다. `P`는 현행 QrBulkPanel, `F`는 제안 qrLabelFont, `D`는 제안 qrLabelPdf를 뜻한다.

| # | 상황 | 코드 위치·처리 | 실행 증거 / 구현 게이트 |
| ---: | --- | --- | --- |
| 1 | 모든 title/description 지원 | F `selectQrLabelFont` → loader.acquire(subset), P :280 가드 | 실제 helper subset/full 선택·byte cache 검증; browser 요청 횟수 |
| 2 | 빈 라벨/결과 0개 | F 빈 문자열 true, P :281 결과 없음 return | 빈 문구 subset, 결과 0 request/PDF 0 |
| 3 | 밖 문자·잘릴 긴 꼬리 | F 원문 전체 title/description 검사, 밖이면 full | 똠/힣/漢字/긴 꼬리 full, payload/fileName은 판정 제외 |
| 4 | NFD/combining | F cleaned 및 NFC, draw 문자열 변경 없음 | 11,172 전수·거짓 양성 0, e+U+0301 full |
| 5 | emoji/VS/ZWJ/surrogate | F codepoint 검사 → full | 선택만 확인; 원본 미지원 정상 렌더 주장은 하지 않음 |
| 6 | subset 404/503/네트워크 | F load의 자산 오류만 acquire에서 full 1회 | 각 주입: subset→full, 다음 시도 subset 재요청·실패 cache 0 |
| 7 | HTML/empty/truncated/wrong snapshot | F body size→SHA→cache 순서 | 4종 주입 통과, 같은 크기의 한 바이트 손상 포함 |
| 8 | parsing/embed 초기화 실패 | D `registerFontkit`/`embedFont` 좁은 try → typed, P selected.kind 검사 | 실제 invalid font typed, subset typed→full 1회 |
| 9 | 둘 다 실패/full parsing 실패 | P generic PDF 오류·소유 finally | 다운로드 0, full 재귀 재시도 없음 |
| 10 | PNG/storage/draw/save 실패 | font catch 밖, P generic | 실제 PNG untyped, generic 실패에 full 재시도 0 |
| 11 | abort/unmount/file 교체/재생성/생성 취소 | **R2-1**: P :96·112·149·229–253·373 + D await/page yield/최종 다운로드 전 task | 늦은 helper/storage/save·생성 취소 stale 0, 메모리 cache dispose |
| 12 | 오래된 finally vs 새 작업 | **R2-1**: P ZIP/PDF shared lease·소유 토큰 비교 | 이전 ZIP finally의 새 PDF 상태 파손 재현 및 수정 |
| 13 | 중복 클릭 | P 두 export 모두 await 전 active ref 점유 | PDF 중복 1회; shared lease로 ZIP/PDF 상호 가드 |
| 14 | helper/PDF 청크 import 실패 | P Promise.all 바깥 generic, F의 asset catch와 분리 | 실제 Vite chunk404 reload 1, font404 reload 0; S0 코드 변경 0 |
| 15 | coverage source 누락/손상 | Node vendor 시작 단계 hash/schema 실패 | corruption/missing exit 1, public 불변 |
| 16 | runtime schema/version 불일치 | F `qrCoverageSet` undefined → full | invalid schema module을 실제 import해 full 확인; import 실패와 구별 |
| 17 | base/path/cache | F `${baseUrl}${asset.path}` + origin, Map asset별 | `/`·`/demo/`, subset→full→subset 2 requests, dispose 뒤 AbortError |
| 18 | 2,400/OPFS | P :282 limit, storage snapshot 1회 read→entries 재사용 | 0/2400/2401 handler 경계; OPFS와 실제 UI 완료 게이트는 구현 때 재실행 |
| 19 | U4 통합 | QR selector는 QR에만, full constant/path/OFL 불변; U4 공용 font 청크 변경 보존 | vendor full SHA/manifest 불변·열린 U4 계획 확인. 병합 후 QR/U4 회귀는 구현 게이트 |

표 자체에서 sol이 위치를 새로 고를 필요는 없도록 위 초안에 대응시켰다. 다만 R2-1의 **수정 범위 결정** 및 R2-2의 **기존 검증 대체 결정**은 문서에 합의되지 않았으므로 현재 v2만으로 착수 가능한 상태는 아니다.

**실측과 인계 범위**

`commands.json`은 핵심 실행 명령/로그 연결표다. 재생성 2회, vendor 양성/음성, oracle, virtual typecheck, runtime 24실험, 브라우저 S0, 실제 QR worker 경계 실험은 최종 실행 exit 0이었다. 음성 vendor 자식 실행의 예상 exit 1 및 기존 스모크 판정 false는 성공으로 덮지 않았다.

| fixture | 라벨/페이지 | Poppler 비교 픽셀 | 바뀐 픽셀 | PDF.js 추출 |
| --- | --- | ---: | ---: | --- |
| sample A4 | 25 / 2 | 4,011,288 | 0 | 원본과 동일 |
| inventory A4 | 155 / 7 | 14,039,508 | 0 | 원본과 동일 |
| expanded Letter | 170 / 8 | 15,510,528 | 0 | 원본과 동일 |

`oracle-results.json`, `oracle/*.pdf`, `oracle/*.png`, `oracle/*.text.json`을 보존했다. Poppler는 양쪽 모두 `Mismatch between font type and embedded font file` 경고를 냈다(`logs/oracle.log`). v2가 제외한 GS 정상화나 PDF.js의 기존 잘못된 텍스트 매핑을 고쳤다고 주장하지 않는다. 이번 PDF 크기가 1차와 1–3B 달라지는 사례는 문서 생성 시각 등 PDF 저장 바이트의 비결정성 범위이며, 폰트 바이너리는 동일하다. PDF 바이트가 다른 정확한 원인을 새로 분석한 것은 아니다.

브라우저 소규모 탐색 빌드는 helper 청크 **22,115B identity**를 만들었다. 이는 전체 QR route/번들 5종 측정값이 아니며 새로운 coverage 비용을 면제하는 근거도 아니다. `measure:qr`의 제품 3종×4단계 전송량, full build·unit·스모크·static·C-D 9게이트는 **구현 후 실제로 실행할 작업**이다. 저장소 변경 금지인 이번 반박에서 npm build/prebuild, 제품 전체 스모크, 배포를 실행하지 않았다. SEO/ko·en/AdSense/UI 문구는 이번에 변경하지 않았고 구현 시 현행 지정 게이트를 유지한다.

**종료 불변 대조**

`status.start.txt`와 `status.end.txt`는 동일하다. HEAD/main은 끝까지 `f29d249…`, origin/main은 `1a04f25…`이다. 추적 파일 **2,362개 변경 0**, src **247개 변경 0**, dist **531개 변경 0**, QR 계획 및 사용자 파일 3개 변경 0이다. 기존 AGENTS.md 워킹트리 변경도 시작 SHA 그대로 보존했다.

다만 전체 SHA 목록 **2,912개 중 2개는 실행 중 외부 변경을 관측했다**: `docs/jobs/todo/pdf-finish-20260905.md`, `docs/jobs/todo/roadmap-completion-20260906.md`. 둘 다 git에서 제외한 다른 열린 계획서이며, U4 5차 결과·v7 및 6차 dispatch 진행 기록이 추가된 상태를 종료 때 다시 읽었다. 이번 실행은 이 경로에 쓰지 않았다. 그러므로 “저장소 2,912개 전부 불변”이라는 허위 선언은 하지 않는다. source/QR 계획의 전제 변경은 없어 이번 판정에 영향이 없다. 변경 경로·각 파일 SHA·manifest SHA는 `sha.start.json`, `sha.end.json`, `invariance.json`에 모두 있다.

**최종: D3(R2-1)·D5(R2-2), 잔여 이견 2건 · [재왕복 필요].** Claude가 위 두 결정과 고정 산출/사실 정정을 정본에 반영한 뒤 확인할 수 있다. 현 시점에는 “Claude–Codex 간 이견 0” 또는 “[정본화 가능]”을 선언하지 않는다.
