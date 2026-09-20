U4 PDF 마무리 v9 — Codex astra 8차 반박 (Codx, 2026-09-07)

**최종 판정: 잔여 이견 1건(D4) · [재왕복 필요]. D3는 [동의·해소]. Claude–Codex 간 이견 0에 도달하지 않았다.**

v9가 요청한 기존 검증은 통과했다. 원본 fixture 9종은 **허용 4·지원 제외 5**, 허용 4종의 전체 RGBA SHA는 **Poppler·PDF.js 각각 원본/출력 동일**이다. OPFS `createWritable`/`write`/`close`의 B 실패는 모두 **A만 등록·C 미시작·메모리 전환 0·B 정리·안내**로 결정된다.

새 잔여는 **가시성 사전 검사의 `/Usage` 누락**이다. `/AS`가 없어도 OCG 자체의 `/Usage /View /ViewState /OFF`를 PDF.js가 적용한다. 기존 preflight와 안전 조건 ①~⑥을 통과하는 입력에서 OC 구조를 제거하면 PDF.js의 숨겨진 빨강 **6,400픽셀**이 드러났다. **Poppler는 이 입력의 원본부터 빨강을 표시하므로 차이 0**이다. 두 renderer가 모두 달라졌다고 주장하지 않는다. 입력 단계부터 표시가 다른 이 유형을 “현재 보이는 상태로 고정” 지원 범위에 둘지, 보수적으로 제외할지를 sol에게 남겨서는 안 된다.

| 대상 | 판정 | 실행 근거 | 잔여 |
|---|---|---|---|
| D3 OPFS 배치 일괄 중단 | **[동의·해소]** | 실제 Chrome OPFS 3개 실패 경계 모두 A만·시작 수 2·C trace 없음·B 제거·fallback 0·안내. 정상 A/B/C 및 등록 직전 취소도 통과 | 0 |
| D4 조건 ⑥·기존 fixture 기대 | **[동의·해소]** | 9/9 분류 일치, 허용 4 RGBA 동일 × 두 renderer, 제외 5 변환 시도 0. 논리적 Contents/clip/text 진입 검사 15개 보충 단언 | 이 부분 0 |
| D4 신규 반례·지원 범위 | **[이견 1]** | OCG `/Usage` 입력은 기존 preflight 및 6조건 PASS, PDF.js 픽셀 변화 6,400. Poppler 0, 전체 indirect-object OC 잔여 0 | `/AS` 외 OCG `/Usage`의 지원 제외 또는 표시 의미를 명시해야 함 |
| sol U4-0~8 인계 | **[재왕복 필요]** | 이전 해소 사항은 유지. 새 입력의 지원 분류와 renderer 간 표시 차이를 처리하는 정책만 미확정 | 총 **1건(D4)** |

**범위·선독·실행 게이트**

첫 명령은 `cat PROJECT_RULES.md`였다. 이어 지정 dispatch 전문, AGENTS의 모델 역할, PDF 계획 전문(최신 「v9 확정」 우선), roadmap §2·§3 S3·결정 10/11, 3~7차 REPORT, 관련 review-notes의 기각 이력과 자산 정본을 읽었다. `docs/jobs/todo` 열린 문서 16개를 열거하고 PDF/폰트 공통 표면을 검색했다(`logs/open-plans-scan.txt`). S2b의 QR 선택 자산·fallback과 U4의 전체 OTF 보존·향후 공용 import 우선 계약은 정합한다. QR/Scripts/Tests 변경을 이번 이견이나 PDF 불변 실패로 세지 않았다.

시작과 종료:

```text
$ git status --short --branch
## s2b-qr-font
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html
$ git rev-parse HEAD main
93a2318d445d78e5283b48be993578f7f061b96c
f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e
$ git diff main --name-only -- src/features/pdf-editor
(출력 없음, exit 0)
```

최신 사용자 지시대로 **main만 기준 대조**했다. 브랜치를 전환하지 않았다. `1a04f25` 번들 baseline도 유지했고 이번에 번들 재빌드/재측정을 하지 않았다. 기존 PASS 수치를 이번 새 실행으로 포장하지 않는다.

새 쓰기는 `/tmp/worklazy-u4-r8/`에 한정했다. r3~r7 산출물과 기존 node_modules는 읽기 재사용했다. 저장소 파일·계획서·사용자 파일·dist 수정, npm 설치, 커밋, push, build/prebuild/generator, sol 제품 구현이나 서브에이전트 호출은 수행하지 않았다. 판정 기록도 저장소 CHANGELOG/review-notes 대신 이 REPORT에만 남긴다. 미구현 제품의 build/unit/browser/static/C-D 9게이트를 완료한 작업이 아니다.

**재현 명령·출력 색인**

cwd는 저장소 루트. 아래 명령은 실제 실행했고 출력 파일은 `/tmp/worklazy-u4-r8/` 기준이다. 실행 스크립트의 출력·Chrome 프로필·PDF/PNG 경로는 모두 같은 `/tmp` 아래로 고정했다.

| ID | 명령 | exit·결과·원문 |
|---|---|---|
| E8-1 | `node /tmp/worklazy-u4-r8/probes/ocg-checks.mjs` | **0**; `ocg-checks.json`, `logs/ocg-checks-final.log`. 원본 9종·15단언·44개 탐색 입력 |
| E8-2 | `node /tmp/worklazy-u4-r8/probes/extra-checks.mjs` | **0**; `extra-checks.json`, `logs/extra-checks-final.log`. Usage/Intent 추가 7입력 및 Poppler 비교 |
| E8-3 | `node /tmp/worklazy-u4-r8/probes/pdfjs-checks.mjs` | **0**; `pdfjs-checks.json`, `logs/pdfjs-final.log`. 실제 Chrome의 PDF.js 원본/결과 **46쌍** 비교(기존 허용 4 + 최종 허용 탐색 42) |
| E8-4 | `node /tmp/worklazy-u4-r8/probes/opfs.mjs` | **0**; `opfs.json`, `logs/opfs-final.log`. 실제 OPFS 정상/실패 3경계/등록 전 취소 |
| E8-5 | `node /tmp/worklazy-u4-r8/probes/usage-guard.mjs` | **0**; `usage-guard.json`, `logs/usage-guard.log`. **미채택 보완 후보** 적용 시 기존 9종 유지·새 반례 제외 |
| E8-6 | `python3 /tmp/worklazy-u4-r8/probes/source-evidence.py` | **0**, 내부 11명령 전부 exit 0; `source-evidence.json`, `logs/source-evidence.log` |
| E8-7 | `node /tmp/worklazy-u4-r8/probes/final-assertions.mjs` | **0**; `final-assertions.json`, `logs/final-assertions.log`. 판정 입력·실제 파일 hash·분류·renderer 수치·OPFS 전이 교차 단언 |
| E8-8 | `python3 /tmp/worklazy-u4-r8/probes/verify-unchanged.py` | **0**; `snapshot-start/end.json`, `unchanged.json`, `logs/unchanged.log`. 아래 불변 증명 |

E8-1/2 내부 Poppler 명령은 `pdftoppm -r 72 -png -singlefile <input.pdf> <output-prefix>`다. PDF.js도 scale=1·흰 배경·200×200 캔버스의 전체 RGBA를 비교했다. 환경: **Node v22.17.1 · pdf-lib 1.17.1 · PDF.js 6.2.108 · Poppler 24.02.0 · Chrome 152.0.7977.64 · puppeteer-core 25.6.0**. E8-3/4에서 관측한 외부 요청은 각각 0이다. 이 renderer 측정은 데스크톱 호스트이며 실 모바일 측정이 아니다.

명령 exit 0에는 **예상 반례 재현 단언 성공**이 포함된다. 모든 탐색 입력의 픽셀 oracle PASS라는 뜻이 아니다. 초기 탐색 로그(`ocg-checks.log`, `extra-checks.log`, `pdfjs-initial.log`, `pdfjs-checks.log`)와 `extra-checks-initial.json`도 보존했다. 최종 판정은 `*-final.log`와 현재 JSON에 근거한다.

**D4 — 조건 ⑥과 기존 9종**

`classifier.mjs`는 7차 `classifyOff/classifyPage`를 복제하고 조건 ⑥을 추가했다. 파일명·fixture SHA·renderer 결과는 분류 함수의 입력이 아니다. ① 첫 q가 마지막 Q까지 살아 있는 wrapper, ② 블록 출구 path 종결, ③ BT/ET 균형·text-state 위치, ④ 중첩 없음, ⑤ inline image 없음은 유지했다.

⑥은 원본 페이지의 **논리적 Contents 전체 순서**에서 검사한다. `m/l/c/v/y/h/re` 뒤 painting/n까지 path를 유지하고, `q/Q`와 stream 경계에서 초기화하지 않는다. `W/W*` 미정착과 열린 BT도 진입 문맥으로 추적했다. v9의 “BT…ET 안의 text 상태” 문구는 **OFF 진입 시 열린 text object가 있으면 보수적으로 제외**하는 강한 의미로 적용했다. 이 부분을 단순 path-construction bool만으로 약화시키지 않았다. 블록 내부에서 완결되는 BT/ET는 허용한다. 원본 상태 순회이므로 OFF 내부 연산도 상태에 반영된다.

기존 PDF bytes를 그대로 읽었다. r6 7파일의 SHA는 r6 `ocg.json`과 대조했고, 별도 r5/r7 입력은 고정 SHA를 단언했다. q/Q를 원본에 덧붙여 기대표를 맞추지 않았다.

| fixture | v9 기대/실제 | 근거 | 변환·RGBA |
|---|---|---|---|
| `on` | 허용/허용 | ON 마크 제거 | Poppler·PDF.js 각각 동일 |
| `xobject-off` | 허용/허용 | 별도 OFF Form `/OC`·Do 제거 계약 | 양쪽 동일 |
| `xobject-on` | 허용/허용 | ON Form 내용 유지·OC 참조 제거 | 양쪽 동일 |
| `balanced-state` | 허용/허용 | ①~⑥ 모두 true | 양쪽 동일 |
| `lexical-decoy` | 제외/제외 | ① q/Q 없음 | 변환 0 |
| `state-leak` | 제외/제외 | ① q/Q 없음 | 변환 0 |
| `path-leak` | 제외/제외 | ② 출구 path 열림 | 변환 0 |
| r5 `ocg-off-original` | 제외/제외 | ① q/Q 없음 | 변환 0 |
| r7 `incoming-path` | 제외/제외 | ⑥ 진입 path 열림 | 변환 0 |

허용 결과 전체 indirect-object의 OC 관련 잔여도 0이다. 원본/결과 RGBA SHA는 두 renderer에서 각각 다음 값으로 동일했다.

- ON 두 행: `69aad151b00084ed779374a0d19f81a0c3ff64f268c3662022a3d688bee4c1e6`
- OFF 두 행: `1439513bc5a20bc9b43d240593413d949d7774d5601f949b63eeca7f61defb0a`

15개 보충 단언에는 incoming re/m, 미정착 clip·빈 path 뒤 W, W n/W* n 종결, 열린 text object, painting 종결, 외곽 wrapper 유무, q/Q의 path 비초기화, OFF 두 블록, **실제 Contents 배열 3종**이 포함된다. stream 1에 path 또는 `re W`가 있고 stream 2에서 OFF로 들어오면 제외, stream 1이 `re W n`으로 끝나면 허용했다. 모든 `classify(bytes)`는 순수 함수 결과와 입력 불변을 100회 확인한다.

**D4 — 새 반례 탐색과 기각한 후보**

총 **51개 신규 입력**을 탐색했다: text/clip/색·선·alpha/Form 44개 + OCG Usage/Intent 7개. 최종 사전 검사에서 42개 허용, 9개 제외였다. 허용 42개는 Poppler와 PDF.js에서 각각 원본/결과를 비교했다.

- text 8종: Td·TD·Tm·T*·Tj·TJ·작은따옴표·큰따옴표, 외부 BT 문맥.
- text rendering mode 0~7의 블록 내부 완결 BT/ET·clipping, W/W*×painting/n 18조합.
- RGB/gray/CMYK·명시 color space·line state·ExtGState alpha/blend.
- Form 안 text/path/text clip, OCG Intent와 config Intent, View/Print Usage.

**초기 text 후보 7개의 Poppler 차이는 최종 반례로 세지 않았다.** path-construction만 보는 초기 버전에서는 ①~⑤+path bool을 통과하며 1,096~1,341픽셀 차이가 났지만, PDF.js에서는 차이 0이었다. 무엇보다 v9의 text 진입 문구를 위처럼 보수적으로 적용하면 외부 BT 안의 8입력과 Form-text 호출 1입력이 사전 제외된다. 따라서 이 후보로 “최종 6조건을 통과한다”고 주장하거나 별도 이견을 추가하지 않는다. q/Q가 text object 안에 들어가는 이런 입력을 정상 PDF 문법의 보편 사례라고도 주장하지 않는다.

남은 **결정적 반례**는 다음이다.

**D4 잔여 — `/AS` 없는 OCG `/Usage`**

입력: `pdf/ocg-usage-view-off-original.pdf`

SHA-256: **`abf7c0cdda4202944da44f0d6fac7bbd343a846a88fb59889601bc2cae92e3d6`**.

```pdf
% OCG 4 0 R: /D 기준 ON이나 표시 용도는 OFF
<< /Type /OCG /Name (Hidden red)
   /Usage << /View << /ViewState /OFF >> >> >>
% OCG 6 0 R: 일반 OFF 레이어
<< /Type /OCG /Name (Safe hidden) >>
% catalog /OCProperties — /AS 없음
<< /OCGs [4 0 R 6 0 R]
   /D << /BaseState /ON /OFF [6 0 R] >> >>
% page Resources
<< /Properties << /Hidden 4 0 R /SafeHidden 6 0 R >> >>
% Contents
/OC /SafeHidden BDC q 0 1 0 rg 0 0 20 20 re f Q EMC
/OC /Hidden BDC q 1 0 0 rg 60 60 80 80 re f Q EMC
0 0 1 rg 10 10 40 40 re f
```

기존 preflight가 평가 불가로 거르는 OCMD VE·중첩·Form 내부 OC·AS·inline image가 전부 없다. 실제 OFF 블록 `SafeHidden`이 있으므로 빈 조건표의 형식적 PASS도 아니다. 이 블록의 진입은 `path=false, clipPending=false, textDepth=0`이고 ①~⑥ **모두 true**다. 두 번째 블록도 동일한 완결 q…re f Q 문법이며, 기존 evaluator가 `/D`만 보고 ON으로 읽는다.

기존 저수준 변환은 첫 블록을 제거하고 두 번째는 OC 마크만 벗겨 내용을 유지한다. 저장·재개방 성공, OC 관련 indirect-object 잔여 0이다. 문제는 블록의 path 누출이 아니라 **변환 전 가시성 평가의 누락**이다.

| renderer, 72DPI/scale 1 | 원본 red/blue | 결과 red/blue | changed pixels | 원본/결과 RGBA SHA |
|---|---|---|---:|---|
| Poppler 24.02.0 | 6,400/1,600 | 6,400/1,600 | **0** | 양쪽 `69aad151…bee4c1e6` |
| PDF.js 6.2.108 / Chrome | **0/1,600** | **6,400/1,600** | **6,400** | `1439513b…1defb0a` → `69aad151…bee4c1e6` |

전체 SHA는 위 허용 fixture 절과 `pdfjs-checks.json`에 있다. 이 결과를 새로 생성/렌더한 두 실행에서 확인했다(`logs/pdfjs-checks.log`, `logs/pdfjs-final.log`; Poppler는 extra 초기/최종 로그와 JSON). PDF.js PNG `pdf/ocg-usage-view-off-pdfjs-original.png`·`…-fixed.png`도 저장하고 직접 열어 확인했다. 원본은 파랑만, 결과에는 빨강 사각형이 추가된다.

**설치된 실제 코드 근거**(E8-6, 네트워크 조사 아님):

- `node_modules/pdfjs-dist/build/pdf.worker.mjs:40637`은 group의 `/Usage`를 읽고 `:40655` 이후 `/View /ViewState`를 전달한다. 이 코드는 `/D /AS` 존재를 전제하지 않는다.
- `node_modules/pdfjs-dist/build/pdf.mjs:14249`의 `OptionalContentGroup.visible`는 기본 visible 값이 true여도 display intent이면 `view?.viewState !== "OFF"`를 반환한다(`:14261`).
- 재사용한 `probes/ocg-lib.mjs`의 `prepare()`는 config의 **AS 배열**을 제외하고 BaseState·ON·OFF만으로 Map을 만든다. **OCG의 Usage 검사는 없다**. 이 소스와 호출 결과를 `source-evidence.json`·`usage-guard.json`에 보존했다.

따라서 “6조건은 모두 충족했다”는 안전한 block 삭제 전제만으로는 **파일 전체 구조 제거 지원 판정**이 닫히지 않는다. 원본부터 두 renderer의 기본 표시가 다르므로, OC 기능을 완전히 없앤 한 출력이 이 두 원본을 동시에 보존할 수 있다고 가정해서도 안 된다. Poppler 0이라는 사실만으로 PDF.js 기반 미리보기의 “현재 보이는 상태”를 보존했다고 판단하면 안 된다.

**닫히는 최소 문안 후보 — 아직 Claude가 채택한 정본 아님**:

> 기존 VE·중첩·Form 내부 OC·AS 제외와 별도로, 평가에 참여하는 OCG 자체의 `/Usage`가 있으면 구조 제거를 파일 단위 지원 제외한다. 장식/raster 허용과 기존 고지는 유지한다. `/D`의 ON/OFF만으로 가시성을 확정하지 않는다. 해당 입력을 U4-0의 제외 fixture에 추가한다.

`usage-guard.mjs`는 이 **보수적인 후보**(OCG에 Usage key 존재)를 실제 적용했다. 기존 9종은 **4허용·5제외 그대로**, 신규 입력은 **사전 제외·변환 시도 0**이었다. 빈 Usage나 일부 안전한 Usage까지 지원하는 추가 문법을 임의 도입하지 않았다. 더 넓은 Usage 평가 지원을 택하려면 renderer/표시 intent 의미와 oracle을 먼저 정해야 한다. 이번 보고서는 완전 OCG 평가기 구현이나 그 범위 확대를 요구하지 않는다.

v8/v9의 짧은 “AS usage”를 모든 Usage 제외를 이미 뜻한 것으로 sol이 확장 해석하도록 두는 대신, **OCG 자체 Usage와 AS를 구별하는 이 한 문장 및 신규 제외 oracle을 정본에 넣으면** 이 반례의 정책 공백을 닫을 수 있다. 현행 계획이 채택한 6차 preflight는 실제로 이 입력을 허용하므로, 현재 문안만으로 해소를 선언하지 않는다.

**D3 — OPFS 실패 뒤 일괄 중단 [동의·해소]**

E8-4는 7차 probe의 실제 OPFS handle/writable 경로를 r8에 복제하고 v9가 선택한 `stop`만 실행했다. secure localhost의 Chrome에서 각 파일에 8B marker를 썼다. `QuotaExceededError`는 지정 API 경계에 **주입**했으며 실제 디스크를 가득 채우거나 물리 quota 한계를 측정한 것이 아니다. marker를 유효 PDF 결과라고 부르지 않는다.

| 분기 | 등록·남은 항목 | 시작 파일 수 | 미완료 정리 | 메모리 전환 | 안내/결과 |
|---|---|---:|---|---:|---|
| 정상 | A·B·C | 3 | 없음 | 0 | 완료 |
| B createWritable 실패 | **A** | **2** | writer 생성 전 B 임시 항목 제거 | **0** | v9 저장 공간 안내 |
| B write 실패 | **A** | **2** | B writer abort·항목 제거 | **0** | 같은 안내 |
| B close 실패 | **A** | **2** | B writer abort·항목 제거 | **0** | 같은 안내 |
| B close/getFile 후 등록 전 취소 | **A** | **2** | 닫힌 B도 제거·미등록 | **0** | 취소 |

실패 3행 모두 C 관련 trace 0을 단언했다. 정상 등록은 `close → getFile → task 양보 → abort 검사 → 동기 등록` 순서다. 실패 catch에서 기등록 A를 보존하고 B를 정리한 뒤 안내를 선택하고 배치를 중단한다. createWritable 실패는 writer 자체가 없으므로 stream.abort 호출은 0이며 임시 항목 제거가 그 경계의 정리다.

B write 실패 trace의 핵심:

```text
A: create → write → close → yield → abort-check → register
B: create → write → writer-abort → remove
종료: registered=[A], started=2, remaining=[A], memoryFallbacks=0
```

실패 안내는 catch 경로에서 다음으로 선택해 단언했다: **“저장 공간 문제로 남은 파일은 처리하지 않았습니다 — 완료된 파일은 내려받을 수 있습니다”**. 미구현 제품 UI를 렌더한 시험이 아니라 저장/결과/메시지 선택 orchestration probe다. ko/en 제품 문구 반영은 기존 구현 완료 기준대로 수행해야 한다. 실행 후 probe 전용 OPFS 디렉터리를 제거했고 leftovers=0이었다.

7차에서 갈렸던 A만/A·C 중 v9는 전자로 명시했다. 이제 sol이 다음 파일 정책을 새로 정할 지점은 없다. 200MiB 등록 전 검사·abort→용량→등록 순서·계수 집계·전체 F4b 매트릭스의 과거 해소를 다시 이견으로 만들지 않았다. 이번에 그 전체 벤치나 실제 대용량 메모리 상한을 새 측정했다고도 주장하지 않는다.

**sol 인계 판정**

| 단계 | 판정 |
|---|---|
| U4-0 | 기존 암호/legacy/bundle/fixture 계약 유지. 기존 OCG 9종 manifest는 v9 그대로 가능. **Usage 신규 제외 fixture와 preflight 범위 결정 필요** |
| U4-1/3/4/5 | 선택 set·도장 비율·전처리/coverage/date·clock·route/canonical·미리보기·타일 등 기존 해소 유지. 이번 추가 이견 없음 |
| U4-2 | facade·협력적 취소·PDF.js 정착 순서·기존 모드/Excel 불변 계약 유지 |
| U4-6 | **D4 Usage 처리의 지원 분류가 남음**. q/Q/path 조건만 통과한 파일을 일괄 안전으로 승격하지 말 것 |
| U4-7/8 | D3 저장 실패 전이 해소. 일반 파일 실패 격리와 OPFS 실패 일괄 중단의 차이는 v9가 결정함. 전체 벤치/통합 golden/최종 9게이트는 구현 후 실행 |

과거 D1·D2·D5·D6·D7·D8·N1·N2·N3, 5경로/canonical·ToolReady/recovery·clock unit·219캡처 예측·legacy oracle·9단계/1회 배포·전체 OTF 경계를 새 이견으로 세지 않는다. S2b의 별도 QR 변경도 이견 0이다. 변수명/파일 분리/일반적인 유효성 처리 선택은 구현 판단으로 남긴다.

**잔여는 D4 한 건이다. [재왕복 필요]. Claude–Codex 간 이견 0 아님. 정본화·sol U4 구현 착수 조건 미충족.**

**종료 불변 증명**

3차 방식의 SHA-256·크기·mtime·파일 집합 snapshot과 git 상태 대조를 실행했다. 차단 범위는 최신 사용자 지시에 따라 PDF 편집기 표면·main 기준이며, 더 넓은 실제 관측 결과도 숨기지 않고 기록했다.

```json
{"snapshotFiles":2929,"endFiles":2929,"changed":[],
 "pdfFiles":12,"pdfChanged":[],"pdfDiffFromMain":"",
 "distFiles":537,"distChanged":[],"u4PlanUnchanged":true,
 "userFilesChanged":[],"mainMatches":true,"pass":true}
```

HEAD·main·브랜치·git status·worktree diff·index 모두 시작/종료 동일하다. **PDF 12파일 불변**, **dist 537파일 내용·크기·mtime·집합 불변**, U4 계획과 사용자 미추적 3파일도 불변이다. 전체 snapshot 2,929파일에서도 실제 변화 0이었다. 알려진 AGENTS/CLAUDE 및 동시 QR/scripts/tests 표면을 예외로 소거해서 이 수치를 만든 것이 아니다. 시작부터 체크아웃된 S2b 상태를 그대로 대조한 값이다.

**최종: D3 해소 · 기존 9종/허용 4 RGBA 재확인 · 신규 D4 Usage 반례 1건 · 잔여 이견 1건 · [재왕복 필요]. — Codx**
