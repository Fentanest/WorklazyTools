U4 PDF 마무리 v8 — Codex astra 7차 반박 (Codx, 2026-09-06)

**판정: 잔여 이견 2건(D3·D4) · [재왕복 필요]. N3는 [동의·해소]. Claude–Codex 간 이견 0에 도달하지 않았다.**

| 항목 | 판정 | 실행 결과 | 잔여 이견 |
|---|---|---|---|
| D3 | **[부분 동의·이견 1]** | 200MiB 등록 전 검사 4행 PASS. abort→용량→등록 순서 PASS. photo-scan 계수 집계는 포맷·DPI별로 결정적. 실제 Chrome OPFS의 미완료 파일 정리·기등록 보존·메모리 전환 0 확인 | **OPFS quota/write 실패 후 다음 파일을 시작할지**가 빠져 있다. 같은 v8 조건을 만족하는 두 루프가 A만 / A·C로 갈림 |
| D4 | **[이견 1]** | 원문 그대로의 6차 7종은 **4 허용(RGBA SHA 동일)·3 제외**. 기존 cm/path 전파 2종은 변환 전에 제외됨 | **5조건을 모두 통과하는 새 incoming-path 반례가 Poppler·PDF.js 각각 1,600픽셀 차이**. 또한 `lexical-decoy`와 별도 5차 원본은 q/Q가 없어 PASS 기대와 충돌 |
| N3 | **[동의·해소]** | 허용 5·오류 4, 보충 14형식, 각 100회 결정성 PASS. Chrome에서도 동일 9골든 PASS | 없음. 날짜 화이트리스트의 이전 선택지 분기는 해소됨 |

동의한 200MiB 수치·계수 식·날짜 문법을 다시 미정으로 취급하지 않는다. 남은 두 건은 동일한 계획을 구현해도 **완료 파일 집합 또는 출력 픽셀/지원 판정**이 달라지는 부분이다. 상한 변경을 제안하지 않는다.

**범위·실행 게이트**

첫 실행은 `cat PROJECT_RULES.md`였다. 이어 AGENTS, 지정 dispatch 전문, PDF 계획 전문(v8 우선), 상위 roadmap §2·§3 S3·결정 10/11, 3~6차 REPORT, review-notes의 QR 폰트 기각·번들 기록을 읽었다. 큰 출력의 절단 구간은 나누어 다시 읽었다.

시작 HEAD는 **`f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e`**, 브랜치 main으로 dispatch와 일치한다. 번들 baseline **`1a04f2571109495a76b8468af95b2f4edcd862cf`**와 HEAD의 차이는 `CLAUDE.md` 한 파일이다(`git diff … HEAD --name-status`). 이번 라운드에서 번들 baseline을 바꾸거나 새 번들 빌드를 하지 않았다.

열린 계획 16개를 열거하고 공통 PDF/폰트 표면을 검색했다(`logs/open-plans-scan.txt`). S2b v3는 전체 OTF·`QR_LABEL_FONT_PATH` 의미 보존, U4의 공용 `pdfFontEmbed` import 우선 및 QR selector/fallback 보존을 명시한다. 이번 실험과 충돌하는 지시는 없다. 동시 세션의 gitignore 계획 갱신은 이견으로 계산하지 않는다.

시작·종료 git status는 동일하다.

```text
 M AGENTS.md
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html
```

새 스크립트·로그·PDF·PNG·Chrome 프로필은 `/tmp/worklazy-u4-r7/`에만 생성했다. 저장소/계획서/사용자 파일/기존 3~6차 산출물 수정, 커밋, push, dist 변경, npm 설치는 수행하지 않았다. 기존 설치 의존성은 읽기 재사용했다. 서브에이전트나 sol 제품 구현은 실행하지 않았다. 저장소 기록 금지에 따라 CHANGELOG·review-notes 대신 이 REPORT에 판정을 남긴다.

**명령·출력 색인**

아래 명령은 모두 실제 실행했다. 로그에는 전체 stdout/stderr를 보존했다. cwd는 저장소 루트이며 각 스크립트의 출력 경로는 `/tmp`로 고정했다.

| ID | 명령 | 결과·산출물 |
|---|---|---|
| E7-1 | `node /tmp/worklazy-u4-r7/probes/ocg-classify.mjs` | exit **0**. `logs/ocg-classify.log`, `ocg-classify.json`, `pdf/`. 4/3 분류 및 새 반례의 **예상 불일치 재현**을 단언한 성공이지, v8 계약 전체 PASS가 아님 |
| E7-2 | `node /tmp/worklazy-u4-r7/probes/policies.mjs` | exit **0**. `logs/policies.log`, `policies.json`. 보유 ledger·task abort·계수·날짜 순수 함수 |
| E7-3 | `node /tmp/worklazy-u4-r7/probes/browser-checks.mjs` | exit **0**. `logs/browser-checks.log`, `browser-checks.json`. Chrome **152.0.7977.64**, 실제 OPFS·PDF.js 렌더·날짜 골든. 외부 요청 0, OPFS 임시 항목 정리 후 0 |
| E7-4 | `source-evidence.json`의 `argv` 10명령 | **10/10 exit 0**. HEAD/기준 차이·v8 문안·OPFS 관련 전체 계획 문구·S2b 경계·설치 PDF.js 소스·Poppler/Node 버전. `logs/source-evidence.log` |
| E7-5 | `python3 /tmp/worklazy-u4-r7/probes/verify-unchanged.py` | 초기 exit 0, **최종 exit 1**. 동시 세션의 gitignore 계획서 2개 갱신. 실패를 `logs/unchanged.log`, `unchanged.json`에 보존. 아래 구분 |
| E7-6 | `python3 /tmp/worklazy-u4-r7/probes/scope-integrity.py` | exit **0**. 추적 파일·제품·dist·사용자 파일·U4 계획 불변, 변경 2개는 사용자 지시가 허용한 gitignore 계획서임을 검증. `logs/scope-integrity.log`, `scope-integrity.json` |

`ocg-lib.mjs`는 6차 `ocg.mjs`의 라이브러리 부분을 새 경로로 복제하고 출력 경로만 r7로 바꾼 것이다. 기존 실행 루프를 제거해 import 시 6차 산출물이 재생성되지 않게 했다. 계획의 최종 npm build/unit/browser/static 게이트는 **미구현 제품의 완료 기준**이다. 저장소 불변 실험인 이번 라운드에서 그 게이트를 실행하거나 통과했다고 주장하지 않는다. 초기 functions 호출의 JavaScript 문법 오류 1회는 shell 실행 전에 실패했으며 실험 재현 실패나 저장소 변경으로 계산하지 않았다.

**D4 — 6차 7종을 원문 그대로 분류한 결과**

`classifyOff(ops)`와 `classifyPage(ops, visibility)`는 파일명·SHA·renderer 결과를 참조하지 않는 **순수 분류 함수**다. 모든 입력을 100회 반복해 결과 동일과 입력 불변을 단언했다. 6차 lexer의 comment·escaped/nested string·hex·array/dictionary·escaped name 처리를 재사용하며, 가짜 BDC 문자열을 실제 operator로 세지 않았다. OCMD/AS/Form 사전 제외는 6차 preflight를 그대로 사용했다.

조건 ①은 약한 q/Q 개수 동률 대신 **첫 q가 마지막 Q까지 유지되는 정상 외곽 wrapper**로 읽었다(중간 depth 0 또는 음수 거부). 조건 ②는 path 생성 `m/l/c/v/y/h/re` 뒤 `S/s/f/F/f*/B/B*/b/b*/n`으로 닫히는지 검사한다. 조건 ③은 BT/ET 균형과 지정 text-state operator의 BT 내부 사용, ④는 중첩 없음, ⑤는 inline image 없음이다. 각 조건을 단독 위반하는 8개 보충 단언도 실행했다.

요청의 “6차 자기완결 5종”에 해당하는 **6차 성공 5행**은 `on`, `xobject-off`, `xobject-on`, `balanced-state`, `lexical-decoy`다. 여기에 `state-leak`, `path-leak`을 더한 7종의 **기존 PDF bytes**를 읽고 6차 JSON의 input SHA와 일치함을 먼저 단언했다. 5차 원본은 계획이 별도로 명시하므로 추가 8번째 입력으로 검사했다.

| 기존 fixture | v8 기대 | 실제 분류 | 이유 / 이번 RGBA 결과 |
|---|---|---|---|
| `on` | 허용 | **허용** | ON 내용·OC 마크 제거 경로. OFF 5조건 대상 없음. SHA 동일, 차이 0 |
| `xobject-off` | 허용 | **허용** | 별도 OFF Form `/OC`·Do 제거 계약. SHA 동일, 차이 0 |
| `xobject-on` | 허용 | **허용** | ON Form `/OC` 제거·내용 유지. SHA 동일, 차이 0 |
| `balanced-state` | 허용 | **허용** | 실제 OFF `q…cm…re f Q`, 5조건 전부 충족. SHA 동일, 차이 0 |
| `lexical-decoy` | 허용 | **지원 제외** | OFF 본문은 `1 0 0 rg 60 60 80 80 re f`로 **q/Q 없음 → 조건 ① 실패** |
| `state-leak` | 제외 | **지원 제외** | q/Q 없음 → 조건 ① 실패. **변환 시도 0** |
| `path-leak` | 제외 | **지원 제외** | `q … re Q` 뒤 열린 path → 조건 ② 실패. **변환 시도 0** |
| 별도 5차 `ocg-off-original.pdf` | 허용 | **지원 제외** | SHA `dc951e2c18523b4e37b1fd07421fc09283fd7b6d2f67afb797ef05d33bd2f6af`. 이 OFF 본문도 **q/Q 없음** |

허용 4행은 새로 Poppler **24.02.0**, `pdftoppm -r 72 -png -singlefile`로 원본/변환을 렌더했다. 전체 RGBA SHA는 ON 두 행 `69aad151b00084ed779374a0d19f81a0c3ff64f268c3662022a3d688bee4c1e6`, OFF 두 행 `1439513bc5a20bc9b43d240593413d949d7774d5601f949b63eeca7f61defb0a`로 각 원본/결과가 같다. 전체 indirect-object의 OC 관련 잔여 0도 재확인했다. 제외된 기존 세 행과 별도 5차 원본은 이번에 변환하지 않았다.

따라서 **원문 7종의 5 허용·2 제외 기대는 성립하지 않는다.** 이전에 픽셀이 보존된다는 사실이 그 입력에 q/Q가 있다는 뜻은 아니다. 기존 fixture에 몰래 q/Q를 덧붙인 뒤 같은 fixture라고 집계하지 않았다. 지원 범위를 보수적으로 좁히는 결정 자체는 가능하지만, 그러면 PASS 기대와 fixture manifest도 그 범위에 맞아야 한다.

**D4 — 5조건 전부 PASS인데 틀리는 새 반례**

새 fixture는 단일 OFF OCG, `/D /BaseState /ON /OFF [Hidden]`, VE·중첩·Form·AS·inline image가 없는 200×200pt 페이지다. 본문은 다음과 같다.

```pdf
10 10 40 40 re
/OC /Hidden BDC
q 1 0 0 rg 60 60 80 80 re f Q
EMC
0 0 1 rg f
```

OFF **블록 내부**만 보면 q/Q wrapper·마지막 path의 f 종결·BT/ET 0/0·depth 1·inline 없음으로 **조건 ①~⑤ 전부 true**다. 실제로 `classifyPage`는 허용한다. 그러나 블록 내부 `f`는 **블록에 들어오기 전 생성된 current path까지 소비**한다. 블록을 없애면 그 외부 path가 살아남아 마지막 보이는 `f`에서 파란 사각형을 그린다. q/Q는 그 path를 저장·복원하지 않는다.

| oracle | 원본 | v8 허용 후 통삭제 결과 |
|---|---|---|
| Poppler 전체 RGBA SHA | `cdbf6c0880cfbeebfa8480444fef83685e70091bf1f23a5e8a71564d1f8be33a` | `1439513bc5a20bc9b43d240593413d949d7774d5601f949b63eeca7f61defb0a` |
| PDF.js / 실제 Chrome 전체 RGBA SHA | 위 원본과 동일 | 위 결과와 동일 |
| 파랑 픽셀 | **0** | **1,600** |
| 전체 changed pixels | Poppler **1,600** | PDF.js **1,600** |
| 개방·렌더 / 제거 대상 잔여 | 성공 | 성공 / 잔여 0 |

입력 PDF SHA = **`14f52bb31eecd0753407370b93bc5f3ff9d1a722a7c494ab4d7cafe2885da0d6`**. 원문/결과는 `pdf/incoming-path-original.pdf`·`pdf/incoming-path-fixed.pdf`. 같은 이름의 PNG는 Poppler 출력이다. 원본을 손대지 않고 새 문서로 저장했으며, 두 renderer의 RGBA 차이를 독립적으로 확인했다.

6차 반례는 **블록 안에서 생성한 path가 밖으로 나가는 경우**, 이번 것은 **밖에서 들어온 path를 블록이 소비하는 경우**다. “블록 종료 시 열린 path 없음”은 후자를 차단하지 못한다. 현재 5조건은 **지원 기대보다 엄격한 입력이 있는 동시에, 허용하면 안 되는 입력도 통과**시킨다.

**닫히는 최소 결정 후보:** OFF 블록의 출구뿐 아니라 **진입 시 current path가 비어 있는지**를 원본 페이지의 논리적 Contents 순서 전체에서 검사하고, 비어 있음을 확인하지 못하면 구조 제거를 사전 지원 제외한다. Contents 배열의 stream 경계에서 path 상태를 임의 초기화하면 안 된다. 정상 외곽 q/Q wrapper 해석도 명시해 둘 수 있다. 별도로 기존 q/Q 없는 두 원본의 기대를 제외로 바꿀지, 그것들을 허용하는 추가 안전 문법을 도입할지를 Claude가 정해야 한다. 보수적 조건을 유지하고 새 wrapped positive fixture를 별도 SHA로 등록하는 후보가 가장 좁다. 이번 보고서는 어느 선택도 대신 정본화하지 않는다. 이 사항들은 **D4 한 건**으로 집계한다.

**D3 — 200MiB 등록 전 검사·취소 순서는 해소**

E7-2는 실제 크기 단위 **MiB=1,048,576B**, LIMIT=209,715,200B를 사용하는 결과 ledger 루프다. 큰 PDF를 할당한 메모리 벤치라고 주장하지 않는다.

| 출력 후보 크기 MiB | 실제 등록 결과 MiB | 시작한 파일 수 | 판정 |
|---|---|---:|---|
| 200 | **200** | 1 | PASS, 정확히 상한은 허용 |
| 199, 2, 1 | **199** | 2 | PASS, 2 폐기·마지막 1 시작 안 함 |
| 201 | **결과 0** | 1 | PASS, 현재 출력 폐기 |
| 100, 100, 1 | **100+100=200** | 3 | PASS, 마지막 1 폐기 |

LIMIT−1 뒤 1B는 등록, LIMIT 뒤 1B와 단일 LIMIT+1B는 제외하는 바이트 경계도 PASS다. `199,2,1`에서 둘째 결과 직전 0ms abort를 예약하고 실제 `setTimeout(0)` 양보를 하면 trace는 다음과 같다.

```text
save:1 → yield:1 → abort-check:1 → discard:1
```

둘째 `capacity-check`와 `register`는 실행되지 않았고 이전 199MiB만 남았다. 정상 경로는 `yield → abort-check → capacity-check → register`다. 따라서 용량보다 취소가 우선이며, save 일시 버퍼까지 200MiB로 보장하지 않는다는 v8 한정도 정합한다. OPFS 경로에는 이 메모리 보유 cap을 잘못 적용하지 않았다.

**D3 — 계수 집계는 해소; 전체 벤치 수치와 구분**

`coefficient(rows,dpi,format)`은 photo-scan·해당 DPI·선택 포맷·기록 반복만 골라 `max(finalPdfBytes/selectedPixels)`를 적용한다. warm-up과 text-vector를 제외한다. 5차 실측 JSON을 읽어 계산한 원시값은 다음과 같다.

| 실제 셀 | 반복 | finalPdfBytes | selectedPixels | coefficient B/px |
|---|---|---:|---:|---:|
| Pixel 7 에뮬레이션·300DPI·1쪽·PNG | 1/2/3 각각 | 24,008,775 | 8,703,348 | **2.758567737381063** |
| 같은 셀·JPEG q85 | 1/2/3 각각 | 3,100,959 | 8,703,348 | **0.35629495683729984** |

같은 입력을 100회, 순서를 뒤집어 다시 집계해 같은 값임을 단언했다. 포맷을 섞어 전체 max를 쓰는 6차의 두 번째 해석은 v8에 의해 제외된다. 사전 경고는 `estimated > min(input×10,100MiB)`이며 정확히 임계와 +1B의 판정 `[false,true]`도 두 임계 사례에서 확인했다. 적용 DPI가 섞이면 해당 DPI·포맷별 픽셀 합을 나누어 각각 계수를 적용하는 산술로 표현할 수 있다. 새 계수 선택 정책을 도입할 필요는 없다.

**5차 원자료는 300DPI·1쪽·Pixel 7·3쌍뿐**이다. 따라서 이 값은 U4-7의 `1/4/16쪽 × 두 환경 × 3반복` **18셀 전체 실측 최댓값이 아니다**. 각 포맷에서 나머지 15셀, 다른 DPI의 실측은 이 자료에 없다. 그것을 복제해 관측값으로 채우지 않았다. 18셀 집합의 집계/순서 검사는 별도 **합성 데이터**로 실행하고 JSON에 synthetic=true를 표시했다. 실측이 없는 150DPI를 요청하면 명시 오류이며 300DPI 계수로 조용히 폴백하지 않는다. 실제 최종 상수는 계획대로 전체 F4b 벤치 후 고정해야 한다. 이 한계는 미실행 벤치를 정직하게 구분한 것이며 **계수 산식의 새 이견이 아니다**.

**D3 — OPFS 정리 경계는 구현 가능, 다음 파일 정책은 잔여**

E7-3은 실제 Chrome secure localhost의 OPFS handle/writable stream에 8B probe marker를 썼다. **실제 저장 API를 사용하되 `QuotaExceededError`는 createWritable/write/close 경계에서 주입**했다. 디스크를 채워 실제 quota를 소진하지 않았고, marker를 유효 PDF fixture라고 부르지 않는다. 미완료 stream abort·임시 항목 제거·close 완료 전 등록 금지를 검사했다. 최종 probe는 `close/getFile 완료 → task 양보 → abort 재검사 → 동기 등록` 순서다. `getFile`을 최종 검사 앞으로 옮겨 그 사이 await를 없앤 뒤 Chrome 검사를 재실행해 exit 0을 확인했다. 이전 실행 로그도 `logs/browser-checks-initial.log`에 보존했다.

| 경계/분기 | 등록 결과 | 실패 파일 | 메모리 전환 | 판정 |
|---|---|---|---:|---|
| 정상 A/B/C | A·B·C | 없음 | 0 | PASS |
| B createWritable 실패 | A | B 제거 | 0 | 정리·보존 PASS |
| B write 실패, 배치 중단 | **A** | B abort·제거 | 0 | v8의 명시된 조건 충족 |
| B close 실패 | A | B abort·제거 | 0 | 정리·보존 PASS |
| B close 뒤 등록 전 취소 | A | 닫힌 B도 제거·미등록 | 0 | 취소 경계 PASS |
| B write 실패, 다음 파일 계속 | **A·C** | B abort·제거 | 0 | 역시 v8의 명시된 조건 충족 |

문제의 v8 원문(`pdf-finish-20260905.md:484`): **“해당 미완료 파일 폐기 + 기등록 결과 보존 + 안내(partial success) — 메모리 폴백으로 조용히 전환하지 않음.”** 메모리 cap 문장에는 “다음 파일 시작 안함”이 있지만 OPFS 문장에는 없다. 계획 전체의 OPFS/실패/다음 파일 문구도 E7-4에서 검색했다. 공통 다중 파일의 개별 실패 격리와 저장소 공통 실패의 일괄 중단 중 어느 쪽을 적용할지 확정돼 있지 않다.

두 실제 루프는 **미완료 B 폐기·A 보존·no-memory-fallback**을 모두 만족한다. 일시적/해당 파일의 write 실패 뒤 C 저장이 가능할 때 결과 집합이 달라지므로 단순 변수명 선택이 아니다. **Claude가 “quota/write 실패 시 배치도 중단, 다음 파일 시작 안 함” 또는 “실패 파일 격리 후 같은 OPFS로 다음 파일 계속” 중 하나를 한 문장으로 고정해야 한다.** 가장 좁은 후보는 전자의 일괄 중단이다. cleanup 과정에서 어떤 wrapper를 쓰느냐는 일반 구현 선택으로 남길 수 있다. 이 **남은 배치 전이만 D3 한 건**이며 이미 해소된 검사 시점·계수 문제와 중복 집계하지 않는다.

**N3 — 날짜 parser 골든 [동의]**

순수 parser의 문법은 `token (separator token)*`, token=YYYY/MM/DD 중 하나·중복 없음, separator=`-`/`.`/`/`/ASCII 공백 하나다. 토큰 하나만 사용하는 것, 순서 변경, 서로 다른 허용 구분자의 조합도 같은 문법으로 결정된다. trim·소문자 자동 교정·라이브러리 폴백은 하지 않는다. 날짜 parts는 외부에서 받은 고정 `{YYYY:'2026',MM:'09',DD:'06'}`다.

| format | 실제 결과 |
|---|---|
| `YYYY-MM-DD` | `2026-09-06` |
| `YYYY.MM.DD` | `2026.09.06` |
| `DD/MM/YYYY` | `06/09/2026` |
| `YYYY MM DD` | `2026 09 06` |
| `MM-DD` | `09-06` |
| `yyyy-MM-DD` | 필드 오류 |
| `HH` | 필드 오류 |
| `foo` | 필드 오류 |
| 빈 형식 | 필드 오류 |

보충 14형식에는 6차 `YYYY/MM/DD → 2026/09/06`, `DD.MM.YYYY → 06.09.2026`, 단일 토큰·mixed separator, 중복 토큰·연속 구분자·선행/후행 구분자·탭·리터럴·구분자 없는 인접 토큰을 포함했다. 입력별 100회 동일, Node와 Chrome 9골든 동일이다. 1회 캡처한 로컬 날짜 2026-09-05로 ko `2026. 9. 5.` / en `9/5/2026`도 일치했다.

단일 pass 토큰 치환에서 파일명 `file{date:HH}`를 다시 parser에 넣지 않았고, 원래 입력의 알 수 없는 `{foo}`만 리터럴+경고, `{date:}`만 필드 오류로 분리했다. 제어문자/coverage/레이아웃/400타일의 기존 6차 동의는 유지한다. 사용자 오류 문구가 공백 구분자를 나열하지 않는 편집상 보완은 가능하지만 실행 계약 이견으로 세지 않는다.

**sol 인계 판정·이견 원장**

| 단계 | 유지할 해소 사항 / 남은 일 |
|---|---|
| U4-0 | 기존 암호·legacy·번들 계측 계약 유지. **D4 fixture 기대/명시 manifest와 새 incoming-path 제외 oracle**를 확정해야 함 |
| U4-1/3/4/5 | N1 선택 set, N2 도장 비율/중심, N3 전처리/날짜, glyph/clock/5경로/미리보기 계약에 이번 새 이견 없음 |
| U4-2 | 6차 D5 facade·협력적 취소·PDF.js 정착 순서 동의 유지. 이번 OPFS 취소 probe도 결과 등록 전 재검사와 정합 |
| U4-6 | **D4는 블록 외부에서 들어오는 path 의존을 제외해야 함**. 조건 5개를 통과했다는 이유만으로 OFF 통삭제 불가 |
| U4-7/8 | 등록 cap·경고 계수식 동의. **OPFS 실패 뒤 배치 전이 D3** 한 문장 확정 필요. 전체 벤치/제품 최종 게이트는 실제 구현 뒤 실행 |

기존 D1·D2·D5·D6·D7·D8·N1·N2, 5경로/canonical·ToolReady/recovery·clock unit·219캡처 예측·legacy oracle·9단계/1회 배포·전체 OTF/공용 import 경계는 다시 이견으로 세지 않았다. 문서의 구 버전 잔재는 명시적 최신 절 우선순위로 읽었으며 단독 이견으로 만들지 않았다.

**잔여 이견 2건 = D3(OPFS 실패 뒤 다음 파일 정책) + D4(진입 path 안전성·fixture 기대 정합). [재왕복 필요]. Claude–Codex 간 이견 0 아님. 정본화·sol 제품 구현 착수 조건 미충족.**

**종료 불변 증명 — 전체 실패와 허용 범위 검증을 분리**

6차 verifier의 출력 경로만 r7로 바꾸어 실행했다. 초기 검사는 exit 0이었으나, 보고서 최종 대조 후 재실행에서는 **동시 세션의 S2b 정본화/진행 기록 갱신** 두 개를 감지해 **exit 1**이었다. 엄격한 verifier를 바꾸지 않았고 최종 실패 로그를 보존했다.

```json
{"snapshotFiles":2912,"verifiedFiles":2910,"distFiles":531,"changed":["docs/jobs/todo/qr-font-20260906.md","docs/jobs/todo/roadmap-completion-20260906.md"],"extraDist":[],"excluded":["AGENTS.md","CLAUDE.md"],"excludedChanged":[],"headEqual":true,"origin-mainEqual":true,"git-statusEqual":true,"diffIncludingClaudeEqual":true,"indexEqual":true,"nonExcludedWorktreeDiffExit":0}
```

사용자는 **“gitignore 계획서의 동시 세션 갱신은 이견 아님”**을 명시했다. 별도 E7-6은 변경 두 파일 모두 `git check-ignore -q` exit 0임을 확인하고 전후 SHA·크기·mtime를 `scope-integrity.json`에 남겼다. 끝 내용도 S2b 정본화·3차 결과 기록으로 대조했다. 이 세션이 그 계획서를 수정한 것은 아니다.

- 지정 제외 외 **추적 파일 2,360개 SHA·크기·mtime 불일치 0**.
- **dist 531파일 내용·크기·mtime·집합 불변, 추가 0**.
- **U4 v8 계획 불변**, 사용자 미추적 DOCX 2개·네이버 HTML 불변.
- HEAD·origin/main·git status·Claude 변경 포함 worktree diff·index 모두 시작과 동일.
- 지정 제외 AGENTS.md·CLAUDE.md 자체도 이번 시작 이후 변화 0, 위 계획 두 개 외 추가 변화 0.

따라서 “저장소 전체 불변”이라고 확대하지 않으며, 사용자 지시로 허용한 동시 계획 갱신과 **실험 대상·추적 파일·dist·사용자 파일 불변**을 구분한다. 이 갱신은 U4 판정의 잔여 이견 수에 포함하지 않는다. 범위 불변 검사 E7-6의 exit는 **0**이다.

**최종: N3 해소 · 잔여 D3·D4 2건 · [재왕복 필요]. — Codx**
