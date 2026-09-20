U4 PDF 마무리 v10 — Codex astra 9차 반박 (Codx, 2026-09-07)

**판정: 잔여 이견 1건(D4: OCMD 가시성의 지원 문법) · [재왕복 필요]. Claude–Codex 간 이견 0 아님.**

요청한 **fixture 10종은 허용 4·제외 6으로 일치**했고, 허용 4는 **Poppler·PDF.js 각각 원본/결과 전체 RGBA SHA 동일**이다. `/Usage` 반례는 v10에서 제외된다. 그러나 **v10 지원 범위를 통과하는 새 OCMD 입력**에서 원본부터 두 렌더러 표시가 갈리고, 현재 변환은 Poppler 원본 대비 6,400픽셀을 바꾼다. **`/P != /AnyOn`만 제외하는 보완은 불충분**하다. `/P /AnyOn` 또는 P 생략도 `/OCGs`가 **배열을 가리키는 간접 참조**이면 같은 문제가 발생한다.

| 대상 | 판정 | 실행 결과·근거 | 잔여 |
|---|---|---|---|
| v10 `/Usage`·Intent·AS·Configs 및 기존 제외 조건 | **[동의]** | 실제 키 존재 검사 추가. Usage null/빈 dict/Print/orphan, AS null/빈 배열, Configs 빈 배열, Design/mixed/empty Intent 및 VE·중첩·Form 내부 감지 | 이 부분 0 |
| fixture manifest 10종 | **[동의·해소]** | 10/10 일치, **허용 4·제외 6**, 제외 6 변환 시도 0 | 0 |
| 허용 4의 두 렌더러 oracle | **[동의·해소]** | 원본/결과 RGBA SHA 각각 동일, 실제 PNG 바이트에서 재검산. OC 잔여 0 | 0 |
| `/D` BaseState·ON·OFF 및 OCMD 탐색 | **[일부 동의 / D4 이견 1]** | 직접 배열 4정책×4상태×2사용처 **32/32 PASS**. **단일 OCG 참조+AnyOff/AllOff**, **간접 배열 참조+AnyOn 포함**은 새 반례 | 원시 참조 형태와 정책을 결합한 지원 범위 결정 필요 |
| sol U4-0~8 인계 | **[재왕복 필요]** | U4-0 manifest·U4-6 preflight의 OCMD 지원 분기가 미확정. 다른 단계의 기존 해소 유지 | 총 **1건** |

**범위·선독·실행 게이트**

첫 명령은 `cat PROJECT_RULES.md`였다. 이어 지정 dispatch 전문, AGENTS 모델 역할, PDF 계획 전문(최신 「v10 확정」 우선), roadmap §2·§3 S3·결정 10/11, 3~8차 REPORT, 관련 review-notes의 폰트/번들 기각 이력과 자산 표를 읽었다. 큰 출력의 절단 구간은 나눠 재독했다. 열린 계획 16개와 PDF/폰트 공통 표면을 검색했다(`logs/open-plans-scan.txt`). S2b의 QR 자산 selector/fallback 보존과 U4 전체 OTF·향후 공용 import 경계는 정합하며 이번 이견으로 세지 않는다.

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

최신 사용자 지시대로 **main만 기준 해시로 대조**했고, 체크아웃된 S2b와 main의 PDF 편집기 표면 동일을 확인했다. 브랜치 전환 없음. 번들 baseline은 과거 1a04f25 자료 그대로이며 이번에 번들 빌드·재측정은 하지 않았다.

새 쓰기는 **`/tmp/worklazy-u4-r9/`에 한정**했다. r3~r8 산출물·현 node_modules는 읽기 재사용했다. 저장소·계획서·사용자 파일·dist 수정, npm 설치, build/prebuild/generator, 커밋·push·브랜치 전환, 제품 구현·서브에이전트 호출은 수행하지 않았다. 저장소 기록 금지 지시에 따라 판정도 이 REPORT에만 남긴다. 미구현 U4의 build/unit/browser/static/C-D 9게이트 완료를 주장하지 않는다.

**재현 명령·출력 색인**

cwd는 저장소 루트. 아래 명령은 실제 실행했고 모두 **exit 0**이었다. 파일 경로는 `/tmp/worklazy-u4-r9/` 기준이다. 스크립트의 입출력 경로가 고정돼 있으므로 같은 명령으로 재현 가능하다.

| ID | 명령 | 출력·검증 범위 |
|---|---|---|
| E9-1 | `node /tmp/worklazy-u4-r9/probes/ocg-checks.mjs` | `ocg-checks.json`, `logs/ocg-checks-final.log`: 원본 10종 + 신규 103입력, v10 분류·Poppler |
| E9-2 | `node /tmp/worklazy-u4-r9/probes/extra-checks.mjs` | `extra-checks.json`, `logs/extra-checks.log`: 간접 배열/단일 원소 배열/표현 변형 71입력, Poppler |
| E9-3 | `node /tmp/worklazy-u4-r9/probes/pdfjs-checks.mjs` | `pdfjs-checks.json`, `logs/pdfjs-final.log`: 실제 Chrome PDF.js의 위 113입력, 허용 결과 원본/결과 비교 |
| E9-4 | `node /tmp/worklazy-u4-r9/probes/pdfjs-extra.mjs` | `pdfjs-extra.json`, `logs/pdfjs-extra.log`: 추가 71입력 PDF.js |
| E9-5 | `node /tmp/worklazy-u4-r9/probes/pdfjs-repeat.mjs` | `pdfjs-repeat.json`, `logs/pdfjs-repeat.log`: AnyOn 간접 배열 반례 2개 및 직접 단일 원소 배열 대조 2개 재실행 |
| E9-6 | `node /tmp/worklazy-u4-r9/probes/candidate-guard.mjs` | `candidate-guard.json`, `logs/candidate-guard.log`: **미채택 문안 후보** 적용 시 manifest 유지, 새 반례 사전 제외 |
| E9-7 | `python3 /tmp/worklazy-u4-r9/probes/source-evidence.py` | `source-evidence.json`, `logs/source-evidence.log`: 설치 소스·계획·환경·git **12명령 전부 exit 0** |
| E9-8 | `node /tmp/worklazy-u4-r9/probes/final-assertions.mjs` | `final-assertions.json`, `logs/final-assertions.log`: 실제 184개 입력 PDF 및 양쪽 PNG의 SHA·픽셀 차이·OC 잔여·반례 3개 생성 결정성·후보 범위 검산 |
| E9-9 | `python3 /tmp/worklazy-u4-r9/probes/verify-unchanged.py` | `snapshot-start/end.json`, `unchanged.json`, `logs/unchanged.log`: 시작/종료 git·SHA·크기·mtime·파일 집합 |

Poppler 명령은 `pdftoppm -r 72 -png -singlefile <input.pdf> <prefix>`다. PDF.js는 **scale=1·흰 배경·200×200 캔버스**로 전체 RGBA SHA-256을 계산했다. **Node v22.17.1 · pdf-lib 1.17.1 · PDF.js 6.2.108 · Poppler 24.02.0 · Chrome 152.0.7977.64 · puppeteer-core 25.6.0 · pngjs 7.0.0**. 데스크톱 호스트의 renderer 실험이며 실 모바일 측정이 아니다. 브라우저 3개 실행의 외부 요청은 각각 0이다. 로컬 미제공 리소스 404와 잘못된 group 참조 warning은 로그에 보존했다.

exit 0은 **예상 반례의 재현 단언 성공도 포함**한다. 모든 탐색 입력이 픽셀 oracle을 통과했다는 뜻이 아니다. 초기 결과/로그는 `*-initial.json`, `logs/*-initial.log`로 보존했다. 초기 guard가 `PDFDict.has()`를 써서 null 값의 키를 놓치는 것을 발견해 **keys() 열거로 수정**했고, 초기 Form 내부 음성 fixture의 잘못된 Subtype 생성도 고쳐 실제 Form으로 재생성했다. 두 보정 뒤 E9-1/3을 재실행했다. 최종 분류는 현재 JSON과 final 로그 기준이며 초기의 잘못된 양성 판정을 반례로 세지 않는다.

**D4 — v10 preflight와 지정 10종**

8차 `ocg-lib.mjs`와 `classifier.mjs`를 r9로 복제했다. lexer·조건 ①~⑥·가시성 평가·변환은 유지하고, `prepare()` 시작에 v10 guard를 연결했다. guard는 **파일명·fixture SHA·renderer 결과를 입력으로 사용하지 않으며 문서를 변경하지 않는다**. 직접/간접 dictionary와 stream dictionary를 visited set으로 순회해 OCG/OCMD 조건을 검사한다. `/Usage`는 orphan OCG에서도 발견한다. `/AS`·`/Configs`는 길이가 아니라 키 존재로 판단한다.

`/Intent` 생략은 기존 기본 View 취급, `/View`와 비어 있지 않은 View-only 배열을 허용했다. 그 밖의 명시 Intent는 제외했다. 이 해석으로 Design·View/Design 혼합·빈 배열을 제외했다. 키 존재는 **`PDFDict.has`와 다르다**: 설치본 `PDFDict.js:38`은 값이 PDFNull이면 false를 반환한다. v10의 “내용 무관, 키 존재”를 구현하려면 `keys()` 또는 null을 보존하는 원시 접근이 필요하다. 이 함정은 이미 명시된 v10 계약의 구현 주의이며 별도 이견이 아니다.

| fixture | 기대/실제 | 이유 | 변환·oracle |
|---|---|---|---|
| `on` | 허용/허용 | ON 마크 제거 | 두 renderer 각각 동일 |
| `xobject-off` | 허용/허용 | OFF Form 자체 OC·호출 제거 | 두 renderer 각각 동일 |
| `xobject-on` | 허용/허용 | ON Form 내용 유지·OC 제거 | 두 renderer 각각 동일 |
| `balanced-state` | 허용/허용 | OFF 안전 조건 ①~⑥ 전부 true | 두 renderer 각각 동일 |
| `lexical-decoy` | 제외/제외 | q/Q wrapper 없음 | 변환 0 |
| `state-leak` | 제외/제외 | q/Q wrapper 없음 | 변환 0 |
| `path-leak` | 제외/제외 | 출구 current path 열림 | 변환 0 |
| r5 `ocg-off-original` | 제외/제외 | q/Q wrapper 없음 | 변환 0 |
| r7 `incoming-path` | 제외/제외 | 진입 current path 열림 | 변환 0 |
| r8 `usage-viewstate-off` | 제외/제외 | OCG Usage 키 존재 | 변환 0 |

기존 bytes를 그대로 읽고 이전 SHA와 대조했다. q/Q를 덧붙여 기대값을 맞추지 않았다. Usage fixture SHA는 `abf7c0cdda4202944da44f0d6fac7bbd343a846a88fb59889601bc2cae92e3d6`이다. 기존 10종의 전체 입력 SHA는 `ocg-checks.json`에 기록했다.

허용 4의 **원본=결과**, 그리고 이번 단순 사각형 표본에서는 **Poppler=PDF.js**도 같은 SHA다.

| 행 | 원본/결과 RGBA SHA-256, 양쪽 renderer |
|---|---|
| `on`·`xobject-on` | `69aad151b00084ed779374a0d19f81a0c3ff64f268c3662022a3d688bee4c1e6` |
| `xobject-off`·`balanced-state` | `1439513bc5a20bc9b43d240593413d949d7774d5601f949b63eeca7f61defb0a` |

**D4 — 새 탐색 174입력의 결과**

서로 다른 입력 SHA 174개를 생성했다. v10 preflight **허용 151·제외 23**. 허용 151을 양쪽 renderer에서 원본/결과 비교했다. **Poppler 변환 후 변화 30개**, **PDF.js 변환 후 변화 2개**다. 30개 중 **28개는 원본부터 renderer 간 표시가 다른 OCMD 표현 사례**, 나머지 **2개는 catalog 등록 밖 OCG를 ON/OFF map에 추가한 preflight 허점**으로 두 renderer 모두 바뀐다. 이 숫자를 잔여 이견 30건으로 부풀리지 않고 **D4 한 건**에 묶는다.

| 입력군 | 실제 판정·관측 |
|---|---|
| **직접 `/OCGs [A B]` 배열**, 4정책 × 00/01/10/11 × marked/Form | **32/32 허용·양쪽 원본/결과 SHA 동일**. `/AllOn`·`/AnyOff`·`/AllOff` 자체가 항상 문제라는 가설은 기각 |
| **`/OCGs A` 단일 OCG 참조**, 정책 생략/AnyOn/AllOn/AnyOff/AllOff × 0/1 × marked/Form | 앞 3정책 12개 동일. **AnyOff·AllOff 8개는 Poppler 6,400px 변화·PDF.js 0** |
| **직접 `[A]` 단일 원소 배열**, 같은 5정책 × 0/1 × marked/Form | **20/20 동일**. `A`와 `[A]`를 dereference 후 한 배열로 정규화하기 전에 원시 표현 검사 필요 |
| **배열을 가리키는 간접 참조**, 5정책 × 4상태 × marked/Form | 40개 중 **18개**에서 Poppler 6,400px 변화·PDF.js 0. **P 생략과 AnyOn도 포함**. 추가 기본 mixed 사례 2개까지 합계 20개 |
| BaseState OFF + ON 배열 / BaseState ON + OFF 배열 / 중복 ON | 허용·두 renderer 원본/결과 동일 |
| 같은 OCG가 ON·OFF 양쪽에 존재, BaseState ON/OFF 각각 | 기존 평가 순서 **BaseState → ON → OFF**, OFF 최종 우선으로 양쪽 동일. 이 실측을 모순 입력의 규격 적합성 인증으로 확대하지 않음 |
| `/D` 없음 / BaseState Unchanged | 기존 6~8차 preflight의 `missing-default-config` / `BaseState-unsupported`로 제외·변환 0. 이번에 지원 범위를 넓히지 않음 |
| BaseState 생략 / D Intent Design / OCG View·[View] / Order·RBGroups·Locked·ListMode·Creator | 이번 표본에서 양쪽 동일. 이미 무시하기로 한 표시 외 정보로 새 이견을 만들지 않음 |
| ON/OFF 배열 간접 참조 / **catalog의** OCGs 배열 간접 참조 | 이번 표본 동일. 아래 반례의 제외 대상은 **OCMD의 OCGs 원시 값**이며 catalog 배열까지 일반화하지 않음 |
| Usage/Intent/AS/Configs·VE·중첩·Form 내부 | v10 및 기존 조건으로 사전 제외. null 키도 최종 guard에서 제외 |
| OCMD 빈/missing 배열·직접 dict 멤버·잘못된 P 등 | 결과는 JSON에 기록. 원시 구조 유효성을 사전 검증하는 후보 범위에 포함. 이 입력들을 정상 문법으로 보장하지 않음 |

**새 반례 A — 단일 OCG 참조 + `/P /AllOff`**

대표 `pdf/marked-single-AllOff-1-original.pdf` (**692B**, SHA **`e4b526bd9dad3dae822f728a3898f75e99018181869b15e755849e3ffb43b4ab`**).

```pdf
% 4 0 R = A (OCG), 5 0 R = B (OCG)
/OCProperties << /OCGs [4 0 R 5 0 R]
  /D << /BaseState /OFF /ON [4 0 R] /OFF [] >> >>
% 6 0 R = OCMD
<< /Type /OCMD /OCGs 4 0 R /P /AllOff >>
% page Resources
<< /Properties << /Target 6 0 R >> >>
% Contents
0 0 1 rg 10 10 40 40 re f
/OC /Target BDC q 1 0 0 rg 60 60 80 80 re f Q EMC
```

A는 ON이고 기존 evaluator는 AllOff=false로 평가한다. v10 guard를 통과하며 대상 OFF 블록의 **①~⑥은 전부 true** (`path=false, clipPending=false, textDepth=0`)。Usage·Intent·AS·Configs·VE·中첩·Form 내부 OC는 없다. 변환은 빨강 블록을 제거한다.

| renderer | 원본 red/blue | 결과 red/blue | changed pixels | 원본→결과 RGBA SHA 축약 |
|---|---|---|---:|---|
| Poppler | **6,400/1,600** | **0/1,600** | **6,400** | `69aad151…c1e6` → `1439513b…fb0a` |
| PDF.js | **0/1,600** | **0/1,600** | **0** | `1439513b…fb0a` → 동일 |

반대 상태의 `marked-single-AnyOff-0`는 Poppler의 빨강이 **0→6,400**으로 노출된다(PDF.js는 6,400→6,400). Form XObject 자체 `/OC`가 이 OCMD를 가리키는 경우도 같은 8행 행태를 확인했다. **Form 내부 marked content와 Form 자체 OC는 구분**한다. 후자는 기존 허용 경로이므로 전자의 제외 조건으로 이 반례를 이미 차단했다고 볼 수 없다.

**새 반례 B — `/P /AnyOn`도 간접 배열이면 실패**

대표 `pdf/extra-marked-indirect-AnyOn-00-original.pdf` (**698B**, SHA **`18ae5a0df2670c4f93e749a840ce988693863a69aadc7a9d6293fc6889a54c74`**).

```pdf
/OCProperties << /OCGs [4 0 R 5 0 R]
  /D << /BaseState /OFF /ON [] /OFF [] >> >>
% 6 0 obj — 간접 배열
[4 0 R 5 0 R]
% 7 0 obj — OCMD
<< /Type /OCMD /OCGs 6 0 R /P /AnyOn >>
% page Resources
<< /Properties << /Target 7 0 R >> >>
% Contents
0 0 1 rg 10 10 40 40 re f
/OC /Target BDC q 1 0 0 rg 60 60 80 80 re f Q EMC
```

양쪽 OCG가 OFF다. 기존 evaluator는 OCMD의 OCGs를 dereference하여 배열로 읽고 AnyOn=false를 계산한다. **v10 지원 제외 조건 없음 + OFF 안전 조건 ①~⑥ 전부true**인데 변환 후 Poppler의 빨강 **6,400픽셀이 소실**된다. PDF.js는 원본부터 빨강을 표시하지 않아 차이 0이다. 원본/결과 SHA와 픽셀 표는 반례 A와 동일하다.

Form 버전 `extra-form-indirect-AnyOn-00-original.pdf`는 **863B**, SHA **`5a8f061eb5b5d1f92bb188b70be67a51fef40c41db78a89198b032f710cdb86f`**, Form 자체 OCMD/Do 경로에서도 같은 결과다. **P 생략도 동일**하다. 두 AnyOn 반례는 별도 Chrome 실행에서 재검산했고, 직접 `[A]` 배열 대조 2개는 계속 픽셀 동일이었다. 대표 반례 3개는 같은 생성기로 두 번 새 생성해 기존 SHA까지 동일함을 단언했다. Poppler/PDF.js 원본 PNG도 직접 열어 빨강 표시 차이를 확인했다.

이것으로 **“AnyOn 이외 정책을 제외하면 닫힌다”는 후보는 기각**한다. `/P` 이름만 보거나 `/OCGs`를 dereference한 뒤 원시 단일 참조/직접 배열/간접 배열의 차이를 지우면 필요한 제외를 놓친다.

설치 PDF.js 근거(E9-7): `pdf.worker.mjs:32378`의 `parseMarkedContentProps`는 `get('OCGs')`로 dereference한 array/dict에서 group IDs를 만들고 P를 전달한다. `pdf.mjs:14381` 이후 `isVisible()`는 AnyOn/AllOn/AnyOff/AllOff 정책을 적용한다. Poppler의 내부 구현 원인을 외부 문서 없이 단정하지 않는다. **위 원시 표현별 렌더 차이는 실제 실행 결과**다.

**보충 — catalog 밖 OCG를 ON/OFF로 등록해 버리는 함정**

`empty-catalog-OCGs`·`unlisted-off` 두 입력은 전체 catalog OCG 등록이 비었거나 Target A가 그 목록에 없고, D/OFF에는 A가 있다. 기존 `prepare()`는 catalog 목록에서 Map을 만든 뒤 ON/OFF의 ref를 무조건 `state.set()`해 **새 group으로 추가**한다. 따라서 뒤의 `unlisted-OCG` guard도 우회된다. 두 renderer는 이 원본에서 빨강을 표시하고, 변환은 OFF로 오판해 **양쪽 모두 6,400px를 없앤다**.

대표 `unlisted-off` SHA: `72f2d2a6c5ce72679c9e5707b6baa2af58506bdc6d7d6f809c6524ea63220804`.

이는 정상적인 catalog 완결성을 주장하는 반례가 아니라 **잘못된 입력을 허용하는 기존 prototype의 결함**이다. 별도 제품 정책 이견으로 추가하지 않는다. sol에 넘길 때 ON/OFF가 catalog 등록 집합 밖 ref를 새로 만들지 않도록 사전 검증해야 한다. missing/D/Type·배열 원소 형태도 같은 구조 검증 경계다.

모든 허용 변환 155개(필수 4+신규 151)는 save/reopen 성공, 페이지 1, **전체 indirect-object OC 잔여 0·Contents OC 마크 0**을 통과했다. 새 반례도 이 검사에 성공한다. 따라서 v10의 **런타임 구조 검사만으로 이 표시 손실을 발견할 수 없으며**, U4-0 사전 fixture와 지원 문법을 보강해야 한다. 테스트 oracle을 런타임 Poppler 의존으로 바꾸자는 제안은 아니다.

**닫히는 문안 후보 — Claude 채택 대기**

`candidate-guard.mjs`로 다음 **하나의 후보 지원 문법**을 적용했다. v10 정본으로 이미 채택됐다고 표시하지 않는다.

> v10 가시성/블록 제외 조건을 유지한다. OCMD는 `/VE`가 없고 `/P` 생략(AnyOn) 또는 Name `/AnyOn`·`/AllOn`·`/AnyOff`·`/AllOff`만 인식한다. **OCMD `/OCGs`의 원시 값**이 ① **비어 있지 않은 직접 배열**이면, 모든 원소가 catalog `/OCProperties /OCGs`에 등록된 OCG 간접 참조일 때만 네 정책을 허용한다. ② **단일 OCG 간접 참조**이면, 그 참조가 같은 등록 집합에 있고 P가 생략/AnyOn/AllOn일 때만 허용한다. 단일 참조+AnyOff/AllOff, **간접 배열 참조**, 누락/빈 배열/직접 dict 멤버/중첩 OCMD/잘못된 정책은 파일 단위 구조 제거 지원 제외한다. Form XObject 자체 OC도 동일한 OCMD 평가 함수를 사용한다. 미지원 고지·구조 제거 옵션 비활성·장식/raster 허용은 기존 문구를 유지한다.
>
> catalog OCGs는 유효한 OCG ref 집합으로 검증한다. ON/OFF의 원소는 그 집합의 ref만 허용하고, 등록 밖 ref를 state map에 추가하지 않는다. 기존 `/D` 없음·BaseState Unchanged 제외를 유지한다. BaseState 생략→ON, BaseState 적용→ON 배열→OFF 배열의 기존 평가 순서를 명시한다. 같은 ref가 두 배열에 있으면 이번 검증과 동일하게 OFF 최종 우선이다.

이 후보는 **직접 배열의 AllOn/AnyOff/AllOff를 이유 없이 전부 배제하지 않으면서** 재현된 차이를 원시 표현에서 차단한다. Claude가 더 좁은 AnyOn-only 정책을 택할 수는 있지만, 그 경우에도 **간접 배열·잘못된 catalog 참조 제외는 필요**하다. 위 후보와 별도로 미채택 선택지를 구현자에게 넘기는 결론은 내리지 않는다.

후보 실험 결과(E9-6/8): **기존 10종 = 허용 4·제외 6 유지**. 신규 174종은 **허용 84·제외 90**으로 분류됐고, 후보 허용 84는 이미 실행한 두 renderer의 **원본/결과 SHA 모두 동일**이다. v10에서 허용됐던 새 반례 30개를 전부 사전 제외한다. 후보에서 제외한 파일의 변환은 실행하지 않았다(`transformAttemptedWithCandidate=false`); 원래 v10 허용 변환과 후보 사전 제외를 혼동하지 않는다. 이 표본이 모든 PDF의 완전한 지원 증명은 아니다.

U4-0에는 최소한 **단일 OCG 참조+AllOff(ON 상태)**, **간접 배열+AnyOn(둘 다 OFF)**, 그 **Form OCMD 버전**, **직접 배열 네 정책 진리표**를 골든으로 추가하고, 잘못된 catalog 참조를 제외 fixture로 고정해야 한다. 기존 10종을 대체하지 않는다. 새 제외 fixture를 사후 filename 예외로 넣는 방식은 금지하고 위 구조 조건으로 분류해야 한다.

**sol U4-0~8 최종 점검**

| 단계 | 판정 |
|---|---|
| U4-0 | 기존 암호·legacy·bundle 계측·기존 10종 계약은 실행 가능. **새 OCMD 지원 문법과 fixture 기대를 확정해야 함** |
| U4-1/3/4/5 | 선택 exact set·번호 anchor·도장 중심/비율·glyph/전처리/date·clock·route/canonical·미리보기·400타일 등 과거 해소 유지. 이번 새 이견 없음 |
| U4-2 | facade 실제 이관·공용 helper/Excel 불변·협력적 취소·PDF.js 정착 순서 유지. 이번에 과거 테스트를 새 실행했다고 표기하지 않음 |
| U4-6 | **OCMD 표현 차이 처리의 제품 지원 분류가 남음**. 원시 객체 형태를 잃기 전 검사, null 키 존재, catalog ref 검증을 구현 지침에 남길 것 |
| U4-7/8 | D3 OPFS 배치 중단/메모리 cap·경고 계수·벤치·복합 golden·최종 C-D 게이트는 기존 계약 유지. 이번 전체 벤치/제품 게이트 실행 없음 |

과거 D1·D2·D3·D5·D6·D7·D8·N1·N2·N3를 다시 이견으로 세지 않는다. 일반 변수명·파일 분리 같은 구현 선택도 이견이 아니다. **남은 것은 D4의 OCMD 지원 분기 하나이며, 같은 v10을 구현해도 허용 입력과 출력 표시가 달라진다는 실행 증거가 있다.** 정본화·sol 구현 착수 조건 미충족.

**종료 불변 증명**

아래에 E9-9 실제 최종 결과를 기록한다. 알려진 AGENTS.md·CLAUDE.md 예외를 이용해 다른 변경을 숨기지 않았으며, 이번에는 그 두 파일까지 관측상 불변이다.

```json
{
  "snapshotFiles": 2929,
  "endFiles": 2929,
  "changed": [
    "docs/jobs/todo/roadmap-completion-20260906.md"
  ],
  "trackedFilesChanged": [],
  "pdfFiles": 12,
  "pdfChanged": [],
  "pdfDiffFromMain": "",
  "distFiles": 537,
  "distChanged": [],
  "u4PlanUnchanged": true,
  "userFilesChanged": [],
  "mainMatches": true,
  "gitStateAllEqual": true
}
```

**추적 파일·PDF 편집기 12파일·dist 537파일·U4 v10 계획·사용자 3파일 불변**이다. HEAD·main·브랜치·git status·worktree diff·index도 시작/종료 동일하다.

전체 snapshot에서는 **gitignore 로드맵 문서 1개가 동시 세션에서 갱신**됐다. 현재 문서의 S2b astra 검수 결과·수정 지시서 준비 기록을 확인했고 `git check-ignore -q` exit 0, 전후 SHA·크기·mtime는 `concurrent-changes.json`에 기록했다. 이 세션은 해당 문서를 수정하지 않았다. 로드맵 진행 기록의 해시 표기가 직접 조회와 어긋나는 부분은 이번 기준으로 사용하지 않았으며, 실제 `git rev-parse main`의 `f29d249…`를 유지한다. 따라서 **저장소 전체 불변이라고 확대하지 않는다**. 최신 사용자 지시의 PDF 표면/main 기준 검사는 통과했고, 이 문서 갱신은 PDF 이견 수에 포함하지 않는다.

**최종: 지정 10종·허용 4 두 렌더러 SHA 검증 통과. 새 OCMD 반례의 지원 문법 결정이 남아 잔여 이견 1건(D4) · [재왕복 필요]. Claude–Codex 간 이견 0 아님. — Codx**
