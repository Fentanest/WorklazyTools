# 문서 비교 입도·결과 UI 반박 1차 — Codx

대상: `docs/jobs/todo/document-compare-granularity-20260907.md` v1, §7 (a)~(h). 실험 기준은 `5bc6854175331bdd73b267784d9633cdccda8446`의 git archive 사본이다. **정본화 불가, 잔여 이견 8건.** 아래 문안은 Claude의 반영·회신 대상이며, 구현 착수 승인이 아니다.

가장 먼저 정정할 사실: **현재 사용자 `비교.docx`도 `을` 삭제 + `자금을` 삽입이다. 현행 웹과 같다. `자금`만 삽입하는 것은 우리 추적 DOCX 생성기다.** 초안 F1의 Word XML 요약, F2의 Word 동작 단정, F3의 일치/불일치 열, §2 원인 판정은 이 증거와 맞지 않는다. 최종 문장의 `등)자금을`은 v1.4 원문 자체에 있으며 강조 입도를 바꿔도 없어지지 않는다.

## 실험·증거 범위

- 원본 저장소에서는 규칙·계획·코드·사용자 DOCX 읽기 및 git 상태 조회만 했다. 브랜치 전환·커밋·push·추적 파일 수정은 하지 않았다. 모든 실험·생성·빌드·캡처는 `/tmp/worklazy-dc-r1/` 안에서 수행했다.
- `PROJECT_RULES.md` 전문 → 디스패치 → `AGENTS.md` → 초안 → backlog의 문서 비교 → review-notes의 S1 제거·P2 파손·S2 CLS 기각 이력과 관련 코드를 읽었다. 열린 계획서 스캔은 [open-plan-scan.txt](logs/open-plan-scan.txt)에 있다. 종료 상태와 SHA 대조는 아래 불변성 절의 별도 산출물에 있다.
- `main.tar`는 지정 해시의 `git archive`다. `main/node_modules`는 패키지별 기존 의존성 링크이고 `.tmp`·Vite 캐시 디렉터리는 사본 안에 따로 둬 공유 캐시에 빌드 정보를 쓰지 않도록 했다. 설치하지 않았다. Node v22.17.1, Chrome 152.0.7977.64. 빌드와 브라우저 잡은 직렬, 모든 Node 잡은 `NODE_OPTIONS=--max-old-space-size=4096`.
- 실제 사용자 DOCX 3개는 원위치에서 읽었다. 전체 모델과 사용자 문서로 생성한 추적 DOCX는 메모리에서만 처리했다(`BytesIO`); 사용자 문서 사본·전체 파생 문서를 디스크에 쓰지 않았다. 인용·저장 범위는 제14조 ④이다. 화면 실험은 별도로 만든 합성 문서다.
- Microsoft Word를 실행한 실험은 아니다. **사용자가 제공한 Word 산출물의 XML**을 직접 판독했다. 일반 반례의 `SequenceMatcher`는 추적 생성기의 텍스트 알고리즘 대조군이며, MS Word의 설정별 동작이나 전역 최소 편집을 보증하는 oracle가 아니다.
- 사본의 유일한 제품 TS 변경은 비공개 함수 3개의 실험용 `export` 추가다. 알고리즘·CSS 후보는 `probes/`에 있다. UI 후보는 실제 QA 빌드에서 파일 업로드·비교·결과 진입 후 적용한 CSS와 DOM 구조 프로토타입이다. 최종 구현의 React 상태 전환까지 검증한 것으로 간주하지 않는다.

## (a) 세 경로와 호출처 — [반박] F1~F3·§2 사실 전제, [동의] 웹이 단어 토큰을 사용한다는 사실

재현:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 /tmp/worklazy-dc-r1/probes/extract.py
PYTHONDONTWRITEBYTECODE=1 python3 /tmp/worklazy-dc-r1/probes/facts.py
NODE_OPTIONS=--max-old-space-size=4096 node /tmp/worklazy-dc-r1/probes/algorithms.mjs
```

원출력: [extract.log](logs/extract.log), [facts.log](logs/facts.log), [user-target.json](fixtures/user-target.json), 전체 입력 모델을 실제 `compareDocumentModels`에 전달하고 대상 문단만 출력한 [user-web-target.json](fixtures/user-web-target.json), [algorithm-results.json](algorithm-results.json)의 `user:article14p4`.

|경로|제14조 ④ 실제 삽입·삭제|사용자 Word XML과 비교|
|---|---|---|
|현행 웹 `compareDocumentModels`/`diffText`|deleted `을`, added `자금을`|같음|
|Python `compare_documents`|deleted `을`, added `자금을`|같음|
|우리 `generate_tracked_document(..., False, True, False)`|ins `자금`; 해당 문단 del 없음. 문서 전체 생성 revision 수 29|다름|
|사용자 `비교.docx`|`w:del#142`=`을`; `w:ins#143` 안에 run `자금` + run `을`|직접 판독한 기준|

Word의 두 revision author는 `Pioneer Investment 파이오니어`다. `ins#143`의 첫 run만 읽으면 초안처럼 `자금`만 삽입한 것으로 오인한다. **w:ins 단위로 자손 run 전체를 연결해야 `자금을`이 된다.** Word 파일의 해당 `w:p` 순회 ordinal은 196, 입력 두 파일은 195다. 이 차이도 문단 ordinal을 무조건 같은 키로 쓰면 안 되는 증거다.

호출처 명령:

```bash
cd /tmp/worklazy-dc-r1/main
rg -n 'compare_documents|diffCharacters' src tests --glob '*.ts' --glob '*.tsx' --glob '*.py' --glob '*.mjs'
rg -n 'globals.get|compareDocumentModels' src/features/word-compare/word.worker.ts src/features/hwp-compare/hwp-compare.worker.ts
```

`compare_documents`는 `compare.py:1171`의 정의만 나온다. Word worker는 Python의 `extract_document_model`, `generate_tracked_document`, 수락·작성자 처리 함수를 가져오고 결과는 TS `compareDocumentModels`로 만든다. 따라서 **compare_documents는 제품 호출이 없는 함수**다. 다만 `compare.py?raw` 자체는 worker에 실리며 추출기가 살아 있으므로 파일 전체를 죽은 코드로 분류하면 안 된다.

`diffCharacters`는 `documentComparison.ts:243`에서 `inlineFormattingChanges`가 호출하고 `:383`에 정의되어 있다. **현역 서식 비교 경로**다. 구현은 글자 최장 *연속* 공통 문자열을 찾고 양쪽 나머지 구간을 처리하는 방식이며 `diffUnits`의 LCS와 다르다.

정본 반영 문안:

> 현재 제공된 비교.docx의 제14조 ④ revision은 `을` 삭제와 `자금을` 삽입이며 현행 웹 결과와 일치한다. 우리 추적 DOCX는 `자금` 단독 삽입이다. 본 작업의 입도 개선을 진행한다면 목표를 “Word와 일치시키는 결함 수리”가 아니라 “웹에서 공통 조사 등의 강조를 줄이는 표시 개선”으로 명시한다. v1.4의 원문 문장을 보존하며 문구 중복을 자동 삭제하지 않는다. 실제 Word 화면에서 관찰한 차이의 원인을 XML만으로 표시 모드 탓이라고 단정하지 않는다. compare_documents는 비호출 사실만 기록하고 제거는 별도 후속으로 둔다. diffCharacters는 서식 비교의 현역 함수로 보존한다.

이 문안과 사용자의 의도를 Claude가 다시 대조해야 한다. 단순히 F3의 일치 열만 바꾸고 기존 “Word 동일 알고리즘” 목표를 유지할 수 없다. **R1.**

## (b) A/B·잡음·성능 — [반박] A의 두 선택지는 동치가 아니며 B도 추적 DOCX와 같은 알고리즘이 아니다

재현:

```bash
NODE_OPTIONS=--max-old-space-size=4096 node /tmp/worklazy-dc-r1/probes/fixtures.mjs
PYTHONDONTWRITEBYTECODE=1 python3 /tmp/worklazy-dc-r1/probes/extract.py
NODE_OPTIONS=--max-old-space-size=4096 node /tmp/worklazy-dc-r1/probes/hwp.mjs
NODE_OPTIONS=--max-old-space-size=4096 node /tmp/worklazy-dc-r1/probes/algorithms.mjs
NODE_OPTIONS=--max-old-space-size=4096 node /tmp/worklazy-dc-r1/probes/edge-cases.mjs
PYTHONDONTWRITEBYTECODE=1 python3 /tmp/worklazy-dc-r1/probes/oracle.py
```

`algorithms.mjs`를 다시 실행하면 집계 JSON을 새로 쓰므로 마지막에 `oracle.py`를 실행한다. [SEGMENTS.md](SEGMENTS.md)는 반례 전체의 읽기용 표, [algorithm-results.json](algorithm-results.json)은 모든 입력·세그먼트·시간·가드 셀 수다. [edge-cases.json](edge-cases.json)은 반복 측정과 Unicode 경계, 재진입 증거다.

실험 정의를 고정했다:

- **A1:** 현행 단어 LCS → 인접 deleted/added 쌍의 code point 공통 접두·접미만 정제 → 같은 타입 인접 세그먼트 병합.
- **A2:** 같은 교체 쌍에 현재 `diffCharacters` 적용. 원래 `diffText`를 별도 함수로 유지해 성능 가드의 되돌아가기 경로를 보존한 실험이다.
- **B:** `Array.from` 전체 글자 토큰을 기존 `diffUnits`에 전달. 기존 1.5M 가드 포함.
- **C:** 기존 `diffCharacters`를 전체 문단에 적용한 추가 대조군. 초안 §3의 “C 동치 계약”과 이름을 혼동하지 말 것.

범위: `browser-smoke.mjs`의 실제 생성 함수를 사용한 Word **5쌍**(기본·문단 분할·run 경계·서식·원본 revision). 이들 웹 정렬 결과의 본문/머리말·꼬리말/각주·미주/표 셀/메모 **68 텍스트 쌍 전부**, 합성 **27개**, 사용자 해당 문단 1개, HWP 합성 2개 = **98개**. 기존 HWP fixture도 열었으나 본문 0이므로 텍스트 쌍 수에는 더해지지 않는다. 단순 빈 줄 및 없는 쪽도 해당 모델이 포함한 범위에서 보존했다. 모든 알고리즘의 before/after 재구성 실패 **0**.

|98쌍에서 SequenceMatcher의 added/deleted 문자열과 다른 수|현행|A1|A2|B|C|
|---|---:|---:|---:|---:|---:|
|전체|39|20|8|20|3|

이 숫자는 품질 점수나 MS Word 적합률이 아니다. 같은 골든을 채택할 수 없는 범위를 보여준다.

|반례|실측·판정|
|---|---|
|`을→자금을`, `cat→cats`, `walk→walked`, `7일→30일`|A1/A2/B 모두 공통 조사·접미를 줄인다. 사용자 문단도 세 안 모두 `자금`만 추가한다.|
|`문서를→자료를`, `내용이→규정이`, `회사가→투자자가`, `서울에서→부산에서`|공통 `를/이/가/에서` 유지. 조사가 있는 어절 교체 자체는 재현 가능하다.|
|`회사→투자자`|공통 글자가 없어 모두 정확히 2세그먼트다. 초안의 이 예시는 글자 부분 일치 잡음의 증거가 아니다.|
|`회사는 납입한다→투자자는 확인한다`|공통 조사/종결 표현을 남겨 6세그먼트. 이를 잡음으로 볼지 세밀한 비교로 볼지는 제품 정책이다.|
|`가나다라→마나바라`|A1은 `가나다→마나바` 교체+`라` 유지(3세그먼트); A2/B/C는 내부 `나`도 유지(6). 초안의 “접두·접미 또는 diffCharacters”는 다른 구현이다.|
|`ababa→babab`|A1은 전체 교체(10자 강조), A2/B/C는 `b` 삽입+`a` 삭제(2자 강조). A1은 전역 최소 차이 계약을 충족하지 않는다.|
|`ab cd→ac bd`|A1/A2 `−bc/+cb`; B `−b␠/+␠b`; C/SequenceMatcher `−␠c/+c␠`. 글자 토큰만 같아도 정렬 tie가 다르다.|
|두 문장 순서 교환|A1/A2/B 18세그먼트, C/SequenceMatcher 3세그먼트. 단어 단계가 언제나 잡음을 억제한다는 가정도 틀리다.|
|기호·공백만 변경|표에 원문/세그먼트 보존. 공백·탭·줄바꿈을 trim/normalize하면 재구성 계약과 DOCX oracle가 깨진다.|
|`👍🏽→👍🏻`, `é→è`|현행 및 A1/A2/B/C 모두 사용자 인식 글자 내부에 경계를 둔다. surrogate는 `Array.from`으로 보존하지만 grapheme 보존은 아니다.|

성능은 워밍업 후 7회, Node 실측 중앙값(ms)이다. 브라우저의 전역 최악 시간이나 다른 장치의 SLA를 뜻하지 않는다.

|입력|글자 셀 수|A1|A2|B|C|가드 결과|
|---|---:|---:|---:|---:|---:|---|
|5,000자 붙은 어절, 중앙 X→Y|25,010,001|1.527|0.423|0.178|0.349|A1만 2자 강조; A2/B/C 10,000자 강조|
|5,000자 공백 포함 문단, 중앙 X→Y|25,010,001|1.108|1.765|0.095|0.826|단어 LCS도 가드에 걸림. A1 접두·접미는 복구, 나머지는 전체 교체|
|1,223자 X→Y|1,498,176|0.090|16.320|12.286|17.922|정제 가능|
|1,224자 X→Y|1,500,625|0.090|0.094|0.023|0.058|A2/B/C 2,448자 전체 강조로 급변|

B의 행렬 상한은 `Uint32Array` 1.5M셀, 약 6MB이고 배열·세그먼트 등의 비용은 별도다. A1의 정제는 선형이지만 A2의 정제를 “교체 구간 길이에 비례”라고 쓰면 안 된다. `diffCharacters`도 비교 탐색 비용이 있다. 빠른 가드 반환 시간은 좋은 diff를 만들었다는 뜻이 아니다.

**재진입 반례:** A2를 초안대로 기존 `diffText` 안에 직접 넣으면 긴 교체 쌍에서 `diffText → diffCharacters → (1.5M 초과) diffText`가 반복된다. [recursive-prototype.mjs](probes/recursive-prototype.mjs)는 5번째 호출에서 탐침으로 중단했고 원출력은 `REENTRANT_DIFF_GUARD: fifth identical refinement call`이다. 무한 재귀를 끝까지 실행해 메모리를 소모하지 않았다.

정본 반영 문안:

> A의 정제는 단일 알고리즘으로 확정한다. 권고는 A1의 공통 접두·접미 정제이며 목적은 조사·접미 등 불필요한 강조 감소다. 문단 내부 전체의 최소 편집 또는 추적 DOCX와의 보편 동치를 약속하지 않는다. 단어 LCS의 tie, deleted→added 순서, empty 처리와 인접 동일 타입 병합을 고정한다. 내부 부분 일치까지 채택하려면 A2를 별도 안으로 승인하고 위 반례 골든을 다시 확정한다. B를 “추적 DOCX와 동일 알고리즘”이라고 부르지 않는다.
>
> 1.5M 가드에서 정제 함수로 재진입하지 않는 독립 coarse fallback을 둔다. 현재 서식 비교의 diffCharacters fallback이 새 diffText를 호출해 의도하지 않게 바뀌지 않도록 분리하고 서식 골든을 유지한다. 1,223/1,224자·5,000자 붙은 어절/공백 문단을 완료 기준에 넣는다. trim, NFC/NFD 정규화, surrogate 분할은 금지한다. code point 수준 강조를 허용할지 grapheme 전체를 강조할지 정본에 명시하고, 후자를 원하면 변경 쌍 밖의 equal 접경까지 고려하는 별도 설계와 oracle 예외를 확정한다.

알고리즘 선택 **R2**, 긴 입력/서식 fallback/Unicode 표시 계약 **R3**.

## (c) DOCX 동치 oracle — [동의] 제한 fixture에서 실행 가능, [반박] 전 문단 보편 계약·location 단독 키

재현:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 /tmp/worklazy-dc-r1/probes/oracle-package.py
NODE_OPTIONS=--max-old-space-size=4096 node /tmp/worklazy-dc-r1/probes/oracle-package.mjs
PYTHONDONTWRITEBYTECODE=1 python3 /tmp/worklazy-dc-r1/probes/oracle.py
PYTHONDONTWRITEBYTECODE=1 python3 /tmp/worklazy-dc-r1/probes/facts.py
```

[oracle-package-results.json](oracle-package-results.json)에 **실제로 생성한 ZIP DOCX**를 XML로 읽은 4키 대조가 있다. `word/document.xml/body/p[0..2]`와 `body/tbl[0]/tr[0]/tc[0]/p[0]`에 대해 `자금`, `s`, 탭→공백, `7→30`을 비교했다. A1/A2/B/C **4/4**, 현행 **1/4**. 삽입어를 굵은 run으로 나눈 케이스도 포함하며 run 개수를 oracle로 삼지 않았다. 추가 실제 `_paragraph_revision` 23개 대조는 A1 18/23, A2/B 21/23, C 23/23이다. 실제 MS Word의 23개 골든이라는 뜻은 아니다.

예외를 계약에 명시해야 한다:

|표면|동치/키가 깨지는 이유·필요 처리|
|---|---|
|문단 순서·분할·병합·이동|웹은 여러 문단을 `\n`으로 합치고 `본문 n번째 문단~…` 위치를 만든다. DOCX는 문단 끝 revision으로 표현할 수 있다. 삭제/삽입 뒤 ordinal도 달라진다. before/after 인덱스 목록을 모두 가진 fixture sidecar 키가 필요하다.|
|location|ko/en 번역 문자열이며 구조 ID가 아니다. 단일 `afterLocation || beforeLocation`만으로 양쪽 대응을 복원할 수 없다. 원본 Word 예시부터 ordinal 195/196이다.|
|표|표 통째 flatten 문자열의 구분자는 실제 OOXML 삽입 글자가 아니다. 표/행/열 대응과 셀 안 문단 ordinal까지 내려가 비교해야 한다. 신규 행·열의 구조 revision도 별도다.|
|서식 run·탭·줄바꿈|모든 ins/del 자손의 텍스트를 연결하고 `w:tab`, `w:br`, `w:cr`도 변환해야 한다. rPrChange/pPrChange나 문단 끝 표식의 빈 ins/del을 텍스트 변경으로 세지 않는다.|
|자동 번호·필드|웹의 displayText에는 합성 번호가 들어갈 수 있다. DOCX는 numPr/필드 구조를 유지하므로 w:t 연결과 다르다. 텍스트 oracle에서 display-only 접두를 구별한다.|
|메모·각주·미주·머리말·꼬리말|각 part URI, note/comment ID, paragraph ordinal을 키에 포함한다. 메모 author 변경은 본문 ins/del과 같은 비교가 아니다. body만 읽어서 metadata 검증 통과로 보고하면 안 된다.|
|기존 after revision|`tracked_docx.py:680` 이하에서 after 문단의 기존 revision을 보존하는 분기가 실제 실행된다. base fixture의 기존 author 삽입 `메모가 연결된 문단입니다.`가 그대로 남는다. 웹의 새 diff 문자열과 보편 동치가 아니다. author만으로 신·구 revision을 구분하면 같은 author 재사용 시 실패한다.|
|.doc·HWP/HWPX|추적 DOCX 산출물이 없는 경로가 있으므로 DOCX oracle를 직접 적용할 수 없다. 동일 TS 텍스트 fixture를 통한 별도 계약으로 검사한다.|

**연결 문자열만 같은 것은 강조 위치가 같다는 증거도 아니다.** `aba→aaba`에서 offset 0에 `a` 삽입한 세그먼트와 offset 1에 삽입한 세그먼트는 before/after 재구성과 added/deleted 연결 문자열이 모두 같지만 위치가 다르다. [oracle-position-counterexample.json](oracle-position-counterexample.json), `facts.py`의 계산·assert로 재현했다.

정본 반영 문안:

> 동치 검사는 revision 없는 동일 구조의 명시 합성 fixture에 우선 한정한다. fixture sidecar의 `(pairId, storyPart, beforeIndexes, afterIndexes, table/row/cell/paragraph path)`로 묶고 ko/en location을 키로 쓰지 않는다. ins/del의 모든 자손 run과 탭·줄바꿈을 복원한다. before/after 재구성, 삽입·삭제 문자열, 편집 offset/순서를 함께 검사한다. 번호·표 구조·문단 경계·기존 revision·메모 author·서식은 별도 기대값을 가진다. 예외는 fixture ID와 이유를 열거하고 광역 제외하지 않는다. 사용자 파일 전체를 fixture로 커밋하지 않는다.

보편 동치 대신 어느 범위의 동치를 필수로 삼을지 Claude 반영 필요. **R4.**

## (d) HWP — [동의] 텍스트 diff 공유, [보완] 원본 revision 처리까지 동일하다는 주장은 불가

재현: `NODE_OPTIONS=--max-old-space-size=4096 node /tmp/worklazy-dc-r1/probes/hwp.mjs`, `facts.py`. [hwp.log](logs/hwp.log), [hwp-models.json](fixtures/hwp-models.json), [SEGMENTS.md](SEGMENTS.md)의 hwp 행.

worker `:75`는 동일 `compareDocumentModels`를 호출한다. 실제 `parseDocument` 함수를 실험 번들에서 export해 @rhwp/core WASM을 초기화하고 바이너리를 읽었다. 기존 `rhwp-roundtrip-empty.hwp.b64`는 **blocks=[]**다. 이 파일 두 개를 그대로 비교하는 현행 HWP/시각 스모크로 변경 입도는 검증되지 않는다.

동일 빈 HWP로부터 rhwp `insertText`→`exportHwp`로 만든 두 합성 쌍을 다시 **제품 parseDocument**에 통과시켰다. `등)을 대여→등)자금을 대여`에서 현행은 `−을/+자금을`, A1/A2/B는 `+자금`. `walk to 회사→walked to 투자자`도 두 모델의 텍스트와 A/B 세그먼트를 기록했다. HWP fixture 원본은 수정하지 않았다.

원본 revision에 대해서는 다음까지만 실증됐다. 제품 모델은 `getTextRange`를 통해 평문을 읽고 revision 상태를 저장하는 필드가 없다. 고정 버전 API의 HwpDocument 메서드는 440개이며 accept/reject/revision 읽기 API가 확인되지 않는다(`Preview`라는 이름을 review API로 오인하지 않았다). worker는 HWP/HWPX 메모·변경 추적 기록을 제외한다는 경고를 **이미** 넣는다. **하지만 실제 revision이 든 HWP/HWPX fixture가 없어 삭제/삽입 텍스트가 getTextRange에 수락 상태로 들어오는지까지 증명하지 못했다.** 경고 문구나 API 이름 부재를 수락 상태의 증거로 쓰지 않는다.

정본 반영 문안:

> “HWP도 동일하게”의 이번 범위는 rhwp가 추출한 텍스트에 같은 강조 입도를 적용하는 것이다. HWP/HWPX 원본 변경 추적의 수락/거부 의미론 지원은 이번 범위에 포함하지 않는다. 이를 포함하려면 검토 기록이 실제 존재하는 별도 합성 또는 공개 fixture와 기대 수락/거부 텍스트를 확보하고 다음 반박에서 검증한다. 현행 빈 HWP 외에 실제 변경 텍스트를 가진 HWP fixture를 스모크에 추가한다. 사용자 안내는 KO “HWP/HWPX의 검토 메모와 변경 추적 기록은 비교하지 않습니다. 해당 기록이 있는 문서는 변경 내용을 모두 적용한 사본으로 비교해 주세요.” / EN “Review comments and tracked changes in HWP/HWPX files are not compared. For files with these records, compare copies with the changes accepted.”처럼 행동 중심으로 정리한다. 제품 화면에 API나 parser 명칭을 추가하지 않는다.

범위의 명시 수용 또는 실제 revision fixture 보충 필요. **R5.**

## (e) U1 폭 — [동의] 결과만 확대, [보완] max 1480·가용 폭·기존 className 활용

재현:

```bash
cd /tmp/worklazy-dc-r1/main
NODE_OPTIONS=--max-old-space-size=4096 VITE_LOCAL_QA=1 npm run build
NODE_OPTIONS=--max-old-space-size=4096 npm run preview -- --host 127.0.0.1 --port 4197 --strictPort
# 다른 셸에서, 아래 브라우저 명령은 서로 직렬
NODE_OPTIONS=--max-old-space-size=4096 node /tmp/worklazy-dc-r1/probes/ui.mjs
NODE_OPTIONS=--max-old-space-size=4096 node /tmp/worklazy-dc-r1/probes/ui-supplement.mjs
```

[ui-results.json](ui-results.json), [ui-supplement-results.json](ui-supplement-results.json). **1280/1440/1920 × ko/en × 5 후보**를 캡처했다. `fluid`는 상한 없는 `calc(100% - 48px)` 탐침, `min1480`은 정확히 `min(calc(100% - 48px),1480px)`다. 아래 기하 값은 ko/en 동일하다. 사이드바는 대략 256이 아닌 **248px**, 셸 본문은 `margin-left:280px; padding:0 32px`라 가용 폭은 화면−344px다.

|화면|현행 1030|상한 1280|상한 1480|min(100%−48px,1480px)|상한 없는 fluid|
|---|---:|---:|---:|---:|---:|
|1280|936|936|936|888|888|
|1440|1030|1096|1096|1048|1048|
|1920|1030|1280|1480|1480|1528|

|1920에서 폭 후보|한 열의 실제 본문 폭|동일 서체의 한글 / 영어 환산 글자 수|
|---|---:|---:|
|현행|388px|28 / 57|
|1280|513px|37 / 76|
|1480|613px|44 / 91|
|fluid 무상한|637px|46 / 95|

환산은 실제 computed font와 canvas 글자 폭으로 측정한 근사치이며 문장마다 실제 줄바꿈 수는 다르다. 1480의 “한 열 약700px”은 paper box의 폭이지 안쪽 본문 폭이 아니다. 우측 이동 열까지 넣으면 더 줄어든다. 1280에서는 max를 늘려도 공간이 늘지 않으며, 추가 48px 차감은 셸의 기존 padding과 중복되어 가로 스크롤을 현행 48→96px로 악화시킨다.

대표 캡처: [1920 KO 현행](captures/width-1920-ko-current.png), [1920 KO 1480](captures/width-1920-ko-1480.png), [1920 EN 1280](captures/width-1920-en-1280.png), [1440 EN 1480](captures/width-1440-en-1480.png), [1280 KO min1480](captures/width-1280-ko-min1480.png). 1480은 넓은 모니터의 여백을 줄이고 충분한 본문 폭을 제공하므로 권고한다. 무상한은 더 큰 모니터의 행 길이에 상한이 없어 선택 근거가 약하다.

`UtilityPage`는 이미 `className`을 받고 `cn`으로 기본값 뒤에 합친다. 새로운 공용 `wide` API는 필요하지 않다. 결과 호출에만 반응형 max-width를 전달하면 된다. 적용 CSS를 비교 입력 화면·Excel 정리·PDF에 주입한 전후 기하 **3/3 동일**이다(폭 1030/1030/1576px 각각 유지).

정본 반영 문안:

> 정상 결과의 UtilityPage 호출에만 `min-[821px]:max-w-[1480px]`를 지정한다. 기존 className 확장을 사용하고 공용 기본폭을 바꾸지 않는다. 셸 padding을 유지하고 추가 calc(100%−48px)는 사용하지 않는다. 1280에서 상한 확대 효과가 없는 것은 정상이다. 우측 이동 영역을 포함한 폭을 U2와 함께 검증한다. 820px 이하는 폭 정책을 유지하되 확인된 툴바/버튼 잘림은 U2의 제한된 수리 범위로 포함한다.

U1/U2 결합 계약에 포함되는 이견 **R6**.

## (f) U2 이동 바 — [반박] 기존 sticky·상단 우측 띠·fixed 단순 치환, [보완] 독립 우측 열 + 작은 화면 계약

재현: `ui.mjs` → `ui-rail.mjs` → `ui-supplement.mjs` → `ui-compact.mjs`를 **직렬** 실행한다. 각각의 JSON과 동명 logs에 결과를 보존했다. 캡처는 `nav-*`(첫 비교), `rail-*`(156px 열), `compact-*`(좁은 데스크톱 52px 열), `audit-*`(실제 axe·버튼 hit 확인)다.

**현행의 실제 동작:** 1920 KO에서 nav y는 처음519 → 문서 스크롤1100 뒤 **−581** → 하단−2177px이다. `overflow-x:auto`인 조상이 y도 스크롤 컨테이너로 만들지만 고정 높이의 내부 세로 스크롤이 없어서 페이지 스크롤에 붙지 않는다. 단순 `ml-auto` 변경으로 해결되지 않는다.

**탈락한 첫 후보:** 바를 x-scroll 밖 위쪽에 옮겨 `sticky top:12px`로 하면 1280/1440에서 따라오지만 스크롤 중 실제 본문과 겹친다. 1920의 별도 열을 top16에 두면 본문은 가리지 않아도 고정 언어 선택기와 겹친다. [탈락 후보 dark 캡처](captures/nav-sticky-1920-en-dark-middle.png). “CLS 0이면 채택”은 충분한 기준이 아니다.

**우측 열 후보:** x-scroll과 nav rail을 형제로, rail은 전체 문서 높이로 stretch하고 nav는 `sticky top:80px`로 둔다. 넓은 화면 156px rail +12px gap. 최종 기하 계측은 스크롤 영역에 가려진 글자 rect를 제외하고 **실제로 보이는 본문**과 교차하는지 검사했다. raw rect만 비교해 clipped after 열을 겹침으로 세었던 예비 로그는 `ui-rail-preliminary.*`에 분리했고 최종 판정에는 사용하지 않는다.

|후보|1920 초기/스크롤1100 뒤 nav y|결과 진입 후 CLS|본문·언어 선택기 겹침|판정|
|현행|519 / −581|진입 이후 0, 최초 전체 흐름 누적 0.00287|본문 0, 스크롤 추종 실패|탈락|
|우측 sticky top80|510 / 80|0|0 / 0|권고|
|우측 fixed top80|80 / 80|0|0 / 0|초기 결과 영역 y510보다 위에 떠 있음; 컨테이너 제약을 별도로 구현해야 함|

첫 `ui.mjs`는 업로드·목록 갱신까지 포함한 누적 CLS를 수집해 0.00287~0.04471이었다. `ui-rail.mjs`는 동일 `installRenderingObservers`를 쓰고 **결과 링크 클릭 직전** 기록을 초기화했다. 두 수치를 혼합하지 않았다. 1920 ko/light·en/dark, 1440 en, 1280 ko, 1024 en, 821 ko, 390 ko/light·en/dark, 320 ko/dark·en/light의 결과 진입·스크롤 표본은 모두 CLS **0**이었다. 파일 선택 화면 전체의 기본 렌더링 게이트를 대체한 것은 아니다.

156px rail을 모든 desktop에 쓰면 1440에서도 가로 스크롤 56px가 새로 생긴다. 이 때문에 **821~1599px는 52px rail +8px gap, 1600px 이상은 156px +12px**로 나눈 추가 후보를 실행했다. compact에서는 화살표 표시, 원래 버튼 이름은 접근성 이름으로 남고 count는 작은 글자로 보인다. 실제 구현은 font-size:0 탐침 대신 아이콘+sr-only 이름+tooltip을 사용한다.

|화면|156px 열의 문서 내부 가로 초과|compact 열의 초과|페이지 전체 가로 초과|compact CLS / 본문 겹침|
|---|---:|---:|---:|---|
|1440|56px|0px|0|0 / 0|
|1280|216px|108px|0|0 / 0|
|1024|472px|364px|0|0 / 0|
|821|629px|521px|0|0 / 0|

원래 940px 문서 두 열을 보존하므로 작은 데스크톱에서는 내부 가로 스크롤이 남는다. 1280의 현행 48px보다 compact에서도 60px 늘어난다. 완전히 없애려면 종이 두 열 최소폭이나 좁은 화면 보기 방식을 바꾸는 별도 제품 결정이 필요하다. 이 비용을 숨겨 “본문 폭 확대와 겹침0을 전 폭에서 무비용 달성”했다고 쓰지 않는다.

대표 캡처: [1920 dark 최종 rail](captures/rail-sticky-1920-en-dark-middle.png), [1280 expanded rail](captures/rail-sticky-1280-ko-light-middle.png), [1280 compact](captures/compact-1280-ko-light-middle.png), [1440 EN compact](captures/compact-1440-en-dark-middle.png), [821 compact](captures/compact-821-ko-light-middle.png).

**포커스·모바일:** DOM 순서는 nav → 문서로 유지하면서 CSS grid로 우측 배치했다. Previous에 focus → Tab으로 Next → Enter를 실제 실행했고 모든 compact 표본에서 `1 / 12`로 이동했다. 1920 rail은 두 버튼 중앙 hit가 true이고 본문 스크롤에도 이름·포커스가 유지된다. 모바일은 현재처럼 페이지 상단 부분에 있는 바를 유지하는 후보를 검증했다(페이지 스크롤 추종을 새로 약속하지 않는다). 다만 320 EN 현행은 toolbar 때문에 **page overflow13px**, Next 버튼이 뷰포트 밖에 있고 hit=false였다. 현행 유지라는 이유로 이 잘림을 승인할 수 없다.

모바일 보완 후보는 nav를 `minmax(0,1fr) 44px minmax(0,1fr)`로 배치하고 버튼 텍스트를 줄바꿈, toolbar 마지막 줄을 wrap한다. 좁은 desktop의 기존 720/820 기준 불일치도 확인돼 결과 toolbar만 ≤1200에서 세로 배치했다. 보완 후 320 EN page overflow **0**, 양쪽 버튼 visible/hit **true**, Tab/Enter 작동. [320 EN 현행](captures/audit-320-en-current-controls.png), [320 EN 보완](captures/audit-320-en-sticky-controls.png). 390 및 320 ko/en·light/dark 조합도 캡처했다.

**추가 차단 사실 — a11y0은 현재도 달성하지 못한다.** 실제 결과 상태에 axe를 실행한 결과:

|화면|현행/프로토타입 공통 위반|노드 발생 수 합계|
|---|---|---:|
|1920 KO|aria-allowed-role 68, aria-required-children 1, aria-required-parent 2|71|
|320 EN|위 항목 + scrollable-region-focusable 1|72|

이는 34문단 합성 문서 기준 발생 수이며 고유 DOM 노드 수가 아니라 규칙별 노드 발생 합계다. 원문 selector·failureSummary는 [ui-supplement-results.json](ui-supplement-results.json)에 있다. `article role=cell` 사용과 columnheader가 row 없이 table 직하에 있는 구조, 초과 스크롤 영역의 키보드 진입 문제다. 레이아웃 CSS만으로 고쳐지지 않는다. 원래 `test:a11y`의 8개 진입 URL은 이 세션 결과 상태를 열지 않는다.

정본 반영 문안:

> 결과 문서 x-scroll과 이동 rail을 형제로 배치한다. nav는 DOM상 문서보다 먼저 두고 rail 안 `sticky top:80px`; 1600px 이상 rail156/gap12, 821~1599px rail52/gap8의 아이콘 표시로 한다. 버튼의 ko/en 접근성 이름·tooltip과 count를 유지한다. 문서 최소폭940은 보존하며 표의 가로 스크롤 비용을 승인 범위에 명시한다. 모바일은 종전 스크롤 동작을 유지하되 320/390px 양쪽 버튼 표시·hit·키보드 조작을 보장하고 toolbar wrap을 수리한다. 결과 toolbar의 좁은 desktop 배치도 함께 고정한다.
>
> 결과 문서의 ARIA table을 유지한다면 헤더를 row로 묶고 유효한 role=cell 요소를 사용하며 초과 스크롤 영역에 이름과 키보드 진입점을 둔다. DocumentTable 등 중첩 실제 표 의미론을 훼손하지 않는다. 이 구조를 수정한 실제 결과 상태에서 axe 0을 확인한다. 이전/다음 비활성 경계, 첫 이동 방향, 마지막 변경, tab/전체내용 토글/문서 쌍 전환 때 선택 index 초기화, 변경0/내용0의 nav 미렌더, 모바일↔desktop resize를 테스트한다. MutationObserver로 옮기는 실험 방식을 제품 구현으로 복사하지 않는다.

폭·이동 동작 결정 **R6**, 모바일/ARIA 수리 범위 **R7**, 상태·검증 계약 **R8**.

## (g) 배포 단위·S3 충돌 — [동의] 별도 단위, [보완] 공통 하네스·기록의 실제 중복

재현:

```bash
cd /home/better0101/projects/worklazytools
git diff main..s3-pdf-finish --stat
git diff main..s3-pdf-finish --name-only
git diff --name-only
```

최초 [s3-stat.txt](logs/s3-stat.txt)는 183파일, 11,937삽입/104삭제였다. 실험 중 S3가 계속 진행되어 종료 시 해시와 변경 집합은 달라졌다. 후속 스냅샷은 [facts.log](logs/facts.log), [s3-paths-current.txt](logs/s3-paths-current.txt)다. 이 차이를 실험 잡의 변경으로 되돌리지 않았다.

문서 알고리즘/결과 JSX는 S3 제품 코드와 직접 겹치지 않는다. 이 초안의 권고 변경 목록과 S3 **커밋된 변경**의 당시 교집합은 CHANGELOG.md, docs/review-notes.md 두 개였다. 하지만 이미 병행 워킹트리에서 `tests/browser-smoke.mjs`, `tests/accessibility-audit.mjs`, `tests/rendering-baseline.mjs`, `tests/visual-regression.config.mjs`, `tests/visual-regression.scenarios.mjs`와 관련 하네스 unit, package.json을 수정하고 있었다. **커밋 diff만 보고 충돌0이라고 보고하면 틀린다.**

기준 PNG 이름은 document-compare와 pdf-editor가 달라 직접 파일 중복은 피할 수 있다. 공통 scenario/config와 기대 캡처 수 검사는 겹친다. visual runner는 통합 config의 baselineNames를 기준으로 `removeUnexpectedBaselines`를 실행하므로 한 브랜치의 옛 config에서 전체 기준선을 다시 만들면 다른 브랜치의 새 PNG를 지울 수 있다. 실제 후보 커밋이 없으므로 “자동 merge 성공”은 실험하지 않았고 보장하지 않는다.

정본 반영 문안:

> 문서 비교는 정본화 후 최신 main 해시를 다시 고정해 독립 브랜치/분리 체크아웃에서 구현한다. 현재 s3-pdf-finish 워킹트리를 전환하지 않는다. 문서 비교와 S3의 제품 코드·검증 등록·기준선·기록을 파일별로 합친다. 충돌에서 한쪽 파일 전체를 선택하지 않으며 두 도구의 검사 등록을 모두 보존한다. 문서 비교 기준선 갱신은 `VISUAL_ONLY=document-compare VISUAL_CONCURRENCY=1 UPDATE_VISUAL_BASELINES=1 npm run test:visual`로 범위를 정하고, 통합 뒤 전체 회귀를 실행한다. 공통 config가 합쳐지기 전의 전체 baseline 정리는 금지한다. 문서 비교 독립 main 배포 뒤 S3가 최신 main을 병합한 상태에서 자체 정본의 게이트를 다시 통과한다. 각 배포는 규칙19의 로컬 시각 검수·규칙18의 Codex push를 따른다.

배포 분리 자체의 이견은 없으며, 하네스 통합 절차의 문안 반영은 **R8**에 포함한다.

## (h) sol이 재해석할 지점·완료 기준 — [보완]

위 절의 반례를 근거로 다음을 정본에 넣기 전에는 구현자가 판단을 떠안는다.

|정의해야 할 것|현행 초안의 빈칸|반영 위치|
|---|---|---|
|무엇과 같아져야 하는가|제공 Word와 추적 생성기의 실제 출력이 반대인데 하나의 기준으로 부름|(a) R1|
|정제 연산 하나|접두·접미 “또는” diffCharacters, pair/hunk 범위·동일 타입 병합 미정|(b) R2|
|가드·Unicode·서식 경로|1.5M 초과 재진입, 글자/문자열/grapheme 혼용, 살아 있는 서식 fallback 영향|(b) R3|
|oracle 허용범위·키·위치|location/ordinal 동치, 기존 revision과 구조 revision, 문자열 연결만 비교|(c) R4|
|HWP 지원 범위|텍스트 입도 공유와 추적 기록 의미론을 혼동; 기존 fixture가 빈 문서|(d) R5|
|결과 폭·rail·스크롤 손익|1480의 실제 본문 폭,821~1599 icon 정책,top80,기존 가로 스크롤 증가|(e)(f) R6|
|모바일·접근성 수리|모바일 제외와 실제320px잘림이 충돌, 결과 ARIA 위반은 기존 하네스가 못 봄|(f) R7|
|검증·상태·통합|짧은 시각 fixture, 결과 미진입 a11y/CLS, QA/static 빌드 차이, S3 공통 파일|(f)(g)(h) R8|

완료 기준 반영 문안:

> production의 `npm run build → npx tsc -b → npm run test:unit → npm run test:static` 결과를 보존한다. 이후 `VITE_LOCAL_QA=1 npm run build`를 별도로 수행해 추적 요청 없는 preview로 브라우저·시각·a11y·CLS를 검증한다. QA 산출물에 production 분석 코드 존재 검사를 적용하지 않는다. 빌드·브라우저 직렬 및 NODE_OPTIONS=4096을 유지한다.
>
> `TEST_SCOPE=word npm run test:browser`에 수정된 입도와 정상 결과 이동·단축키/Tab·변경0·영역0·전체내용 토글·여러 문서 쌍 전환을 포함한다. `TEST_ONLY_HWP=1 npm run test:new-tools`에는 빈 HWP 외 실제 텍스트 변경을 추가한다. diff 공유 영향이 있는 DOC/HWPX도 결과 모델의 같은 골든 범위를 명시한다. diff 본문·표 셀·메모·metadata와 formatting on/off를 구별해 검사한다.
>
> 시각 fixture의 현행 Word 한 문단과 HWP 빈 문서만으로 sticky를 검증하지 않는다. 장문/다중 변경 fixture의 initial·중간·끝 스크롤과 버튼 활성화 이후를 ko/en,1280/1440/1920 및320/390,light/dark로 명시 등록한다. compact/expanded 경계1599/1600 및 mobile 경계820/821의 resize도 검증한다. 사용자 문서는 테스트 자산에 포함하지 않는다.
>
> 접근성/렌더링 하네스는 파일 업로드·비교·result 진입 동작을 통해 실제 결과 상태를 검사한다. 결과 URL에 바로 goto하면 session이 없어 만료 화면이므로 그 경로만 등록해서는 안 된다. 결과 mount 전후 CLS와 후속 scroll/resize의 CLS를 분리 수집하고, axe는 실제 결과에서0을 요구한다. nav/body/언어 선택기/mobile header/footer의 표시 영역 겹침을 별도로 검사한다. 추가 등록의 unit 기대 목록과 S3 등록을 함께 합친다. bundle:measure·css:orphans·git diff --check 및 최종 통합 회귀도 실행한다.

규칙4·5 영향:

- **ko/en:** navigation 전체 label, compact tooltip, count, 변경0/내용0 및 HWP 범위 안내를 두 언어에 동시 반영한다. 내부 알고리즘 이름이나 성능 가드 메시지를 사용자 화면에 추가할 이유가 없다.
- **SEO/정적:** 경로·도구 수·파일 형식 약속은 추가하지 않는다. 따라서 폭/입도만 바꾸는 경우 새 sitemap/정적 결과 페이지는 필요 없다. “Word 동일” 같은 검증되지 않은 마케팅 문구는 추가하지 않는다. HWP 지원 범위 안내를 FAQ에 넣는다면 `seo.ts`의 ko/en 입력을 함께 수정하고 생성 스크립트로 정적 산출물을 갱신한다. 결과 페이지는 세션 상태이므로 실제 파일 내용을 정적 페이지에 넣지 않는다.
- **광고/격리:** 일반 document-compare 경로는 기존 셸을 유지하며 PDF·Office·video의 격리 경로를 바꾸지 않는다. 프로토타입 UI 실행의 외부 HTTP(S) 요청과 pageerror는 **0**이었다. 이것은 로컬 QA에서 관찰한 값이며 production AdSense 확인을 대신하지 않는다. rail은 새 광고 지면이 아니며 광고 공간을 구현하지 않는다.
- **내부 구현 비노출:** 진단 JSON·API 이름·raw exception은 보고서/테스트에만 둔다. HWP warning의 `browser parser` 표현은 위의 행동 중심 문구로 바꾸는 보완안을 제시했다. 서버 전제 코드를 추가하지 않는다.

## 실제 실행한 검증과 한계

|명령/검사|결과|증거|
|---|---|---|
|`VITE_LOCAL_QA=1 npm run build`|exit0, Vite 1m11s, 정적61페이지 생성|[build.log](logs/build.log)|
|5 Word fixture 생성·추출·추적 DOCX 생성|성공. 생성 revision11/8/0/0/32; 사용자 문서29|[extract.log](logs/extract.log)|
|98쌍 diff 프로토타입|모든 before/after 재구성 성공. 알고리즘 차이는 실패로 숨기지 않고 표기|[algorithms.log](logs/algorithms.log), [oracle.log](logs/oracle.log)|
|실제 DOCX 패키지 oracle|4키 실행; 현행1/4,A1/A2/B/C4/4|[oracle-package.log](logs/oracle-package.log)|
|rhwp 실제 parse·합성 HWP|성공; 기존 fixture 본문0; 합성2쌍|[hwp.log](logs/hwp.log)|
|폭/이동/모바일/다크/포커스/CLS|실행 완료. 합격 후보·탈락 후보 구분|`ui*.json`, `logs/ui*.log`, `captures/`|
|실제 결과 axe|실행했으나 **실패**:desktop71/mobile72 노드 발생|[ui-supplement-results.json](ui-supplement-results.json)|
|`npm run test:unit`|**246/247**,1실패:archive 사본에 `.git`가 없어 repo-wide ad allowlist의 `git ls-files` 실패|[unit.log](logs/unit.log)|
|`npm run test:static`|**실패**:QA 빌드에서 GA/Naver 문자열이 빠져 production 전용 검사와 충돌|[static.log](logs/static.log)|

unit 실패 원문은 `fatal: not a git repository (or any of the parent directories): .git`, static 실패 원문은 `Google or Naver Analytics configuration is missing from the application bundle.`이다. 사본에서 원본 .git를 연결하거나 테스트를 통과로 바꾸지 않았다. 실제 구현 잡은 정상 분리 checkout에서 unit, production 산출물에서 static을 실행해야 한다.

실험 중 HWP를 HML/HWPX로 추가 export하는 불필요한 탐침은 각각 `HML_SOURCE_REQUIRED`, `charPrIDRef:[0]` 오류가 났다. 그 경로를 증거로 사용하지 않고 제품의 실제 HWP 파싱·HWP 저장 경로로 완료했다. fixture helper 상수 누락·빈 CSS addStyleTag 등의 초기 하네스 오류는 프로토타입에서 수정하고 재실행했다. HWP 원본 revision 지원 미검증은 그대로 남긴다.

이 라운드는 계획 반박 실험이므로 production 재빌드·배포, 전체 기본 smoke/visual 기준선 갱신, 수정된 제품의 전체 a11y0/게이트 통과를 주장하지 않는다. `npm run test:rendering`의 observer 코드는 실제 사용했지만 기본 3페이지 실행 결과로 result CLS를 대신 보고하지 않았다. 최종 제품의 Gemini 시각 검수도 이 실험으로 대체하지 않는다.

## 시작·종료 상태와 불변성 증거

재현: `PYTHONDONTWRITEBYTECODE=1 python3 /tmp/worklazy-dc-r1/probes/final-state.py`.

[start-state.json](start-state.json)과 [end-state.json](end-state.json)에 `git status --porcelain=v1`, HEAD, branch, 추적 파일별 SHA-256, 사용자 DOCX별 SHA-256을 저장했다. [state-comparison.json](state-comparison.json)과 [final-state.log](logs/final-state.log)가 차이 목록이다.

|항목|시작|종료|판정|
|---|---|---|---|
|브랜치|s3-pdf-finish|s3-pdf-finish|동일; 본 잡에서 전환하지 않음|
|HEAD|446a1e35ba60ebc308a32a13f8b675a02b095365|532df465944952d47b64120b5fa3ca55b181537c|병행 S3 잡 진행으로 달라짐|
|추적 워킹트리|App.tsx/PdfEditorPage.tsx/types.ts 수정 상태|추적 변경 없음|본 잡에서 수정·커밋하지 않음|
|문서 비교/Word/HWP 코드와 UtilitySurface|24파일 SHA 저장|24/24 같은 SHA|해당 원본 표면 불변|
|사용자 dummyfortest DOCX|3파일 SHA 저장|3/3 같은 SHA|읽기만 수행|

최초 간단 status 조회 시에는 사용자 미추적 3파일만 있었고, 이어서 시작 SHA 스냅샷을 저장할 때는 S3의 위 3추적 수정과 신규 PdfFinishPanel이 이미 보였다. 이 두 관측을 혼동하지 않는다. 종료 미추적은 원래 `after.docx`, `before.docx`, 네이버 확인 HTML 3개다.

**전체 저장소 불변을 증명했다고 주장할 수 없다.** 병행 잡이 HEAD와 파일을 바꿨고 전체 추적 집합 비교는 false다. 이는 사용자에게 사전에 고지된 병행 작업이다. 본 잡의 모든 쓰기 명령은 `/tmp/worklazy-dc-r1/`를 대상으로 했으며, 원본 변경을 되돌리거나 커밋하지 않았다. 동시 작업 아래에서 주장할 수 있는 증거는 위 상태 차이의 공개, 원본 문서 비교 24파일·사용자 문서3개 SHA 일치, 그리고 도구 호출의 쓰기 대상이다.

종료 시 S3 커밋까지 반영한 [merge-surfaces.json](merge-surfaces.json), [s3-stat-end.txt](logs/s3-stat-end.txt)도 보존했다. (g)에서 워킹트리 중복으로 관찰한 검증 파일들이 종료 시에는 커밋되어 있다. 최종 교집합은 아래 파일들이다: CHANGELOG.md, docs/review-notes.md, tests/browser-smoke.mjs, tests/accessibility-audit.mjs, tests/rendering-baseline.mjs, tests/visual-regression.config.mjs, tests/visual-regression.scenarios.mjs. 별도 구현 시 이 최종 상태를 다시 갱신해 실행 게이트를 적용한다.

브라우저 프로세스들은 각 실험 종료 때 닫았고, 본 잡의 4197 preview도 종료했다. 캡처는 **130장**, 전체 목록은 [CAPTURES.md](CAPTURES.md)다. 산출물과 보고서는 `/tmp`에만 남겼다. 요청대로 jobs 문서에 복사하는 일은 Claude에게 맡긴다.

## 정본화 전 잔여 이견 — 8건

1. **R1 사실·목표:** Word 실제 XML 정정과 표시 개선 목표 재확인.
2. **R2 알고리즘:** A1/A2/B 중 하나, 최소 차이/잡음 기대값 확정.
3. **R3 경계:** 1.5M 가드·재진입·서식 fallback·Unicode 표시 정책 확정.
4. **R4 oracle:** 구조키·offset·범위·명시 예외 확정.
5. **R5 HWP:** 추적 기록 의미론 제외 수용 또는 실제 fixture 보충.
6. **R6 UI:** 1480·sticky rail·compact breakpoint·가로 스크롤 비용 확정.
7. **R7 모바일/a11y:** 기존 잘림과 결과 ARIA 수리를 이번 범위에 포함.
8. **R8 검증/통합:** 결과 상태 진입·장문 스크롤·상태 전환·QA/production 분리·S3 공통 하네스 합치기 명문화.

위 8건은 같은 원인을 여러 (a)~(h) 절에서 중복 계산하지 않은 수다. 각 문안을 Claude가 수용하고 충돌하는 초안 문장을 제거한 뒤 재왕복해야 한다. **잔여 이견 8, 정본 아님.**

— Codx
