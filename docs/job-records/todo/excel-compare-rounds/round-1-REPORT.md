# Excel 비교 “중복키 한 행 묶기·머리글 자동 감지” 반박 1차

**Codx · 2026-09-07 · 판정: 재왕복 필요, 잔여 이견 11건(O01~O11).** 사용자 결정 두 건은 유지한다. 정본화·실제 구현 착수·커밋·push·브랜치 전환은 하지 않았다.

- (a) **[보완]** 제목 중복 4레코드와 머리글 4행 재현. 번호 재시작은 좌 73행·우 **79행**.
- (b) **[반박]** “첫 행을 남겨 하위 호환”은 전체 값 검색 누락·대표 위치 오해를 만든다. 두 producer를 구현·대조했고 `records` 내 확장안(A)을 권고한다. 큰 그룹의 한 셀 직렬화에는 데이터 손실 경계가 있다.
- (c) **[반박]** 명시적으로 해석한 초안 감지 규칙이 22패턴 중 **12개 오판**. 보수적 대안도 완전하지 않아 지원 범위·후보/미감지 상태·수동 우선권을 확정해야 한다.
- (d) **[보완]** 최초 검사 왕복 1회 유지 가능. 수동 조회의 늦은 응답·검사 중 교환·시트별 수동값·취소 소유권이 누락돼 있다.
- (e) **[보완]** 후보라는 문안·독립 목록·전체 값 접근·검색 범위를 제안. ko/en×390/1365 프로토타입 axe 0건.
- (f) **[동의: 선행 병합 후 착수] / [보완: 실제 교집합]** 선행 커밋에서 `report.ts`는 변경되지 않았다. 직접 교집합은 worker·스모크·unit·기록이다.
- (g) **[보완]** 구현자가 선택해야 할 11건을 정리했다. [정본 반영 문안](CANONICAL-AMENDMENTS.md)과 [소비처·단언 목록](CONSUMER-INVENTORY.md)을 함께 전달한다.

## 범위·실행 게이트·보존 증거

첫 도구 호출에서 PROJECT_RULES.md 전문을 읽고 AGENTS.md, 디스패치, 초안, U1·X-A/B/C 선행 정본 및 review-notes의 Excel 판정 이력을 확인했다. 원 HEAD는 `c8bff1fd1ab64f89afb7240778e0a373c953d1a3`, branch `s3-pdf-finish`; main은 요청 기준 `5bc6854175331bdd73b267784d9633cdccda8446`였다. HEAD 차이는 지시서에서 이미 격리 조건으로 지정한 U4 트리이며 그 코드를 기준으로 실험하지 않았다.

```bash
# 원 저장소에서 읽기
cat PROJECT_RULES.md
cat AGENTS.md
cat /tmp/claude-1000/-home-better0101-projects-worklazytools/f5cf1bca-6bf0-442b-b9d4-e7cb45f9c96d/scratchpad/xc-round1-dispatch.md
git status --porcelain=v1
git rev-parse HEAD main
git archive 5bc6854175331bdd73b267784d9633cdccda8446 | tar -x -C /tmp/worklazy-xc-r1/main
```

기존 node_modules의 671개 패키지 항목을 링크했고 `.bin`은 개별 실행 파일 링크, `.tmp/.vite/cache`는 사본에서 생성했다. 설치는 하지 않았다. `env.sh`의 `NODE_OPTIONS=--max-old-space-size=4096`, 전용 TMPDIR/npm cache, strict port **4350**을 사용했다. 빌드와 브라우저는 직렬 실행했다. 프로토타입과 합성 출력은 `/tmp/worklazy-xc-r1/`에만 있다. 사용자 파일 2개는 원 위치에서 읽고 메모리 처리했으며 사본/fixture/사용자 보고서는 저장하지 않았다. actual.json에는 필요한 머리글·행 번호·집계만 남겼다.

열린 계획서를 스캔했다(`evidence/open-plans-paths.txt`, `open-plan-intersections.txt`). U1/X-A/B/C는 선행 계약이고 열 너비 작업은 명시 선행 의존이다. PDF·문서 비교 잡은 이번 엔진 표면과 직접 겹치지 않지만 ko/en features.json·review-notes·시각 시나리오 등 공용 파일을 사용할 수 있다. UI 테마 초안도 전역 스타일/검증 표면을 가진다. 이번 실험은 source 변경 없이 사본을 사용하므로 상반 지시를 실행하지 않았다. 구현 때에는 새 main 해시·열린 작업의 공용 파일 변경을 다시 대조해야 한다.

**원 워킹트리 전체 불변을 과장하지 않는다.** 시작·종료 tracked SHA 각 2,587개를 저장했다. HEAD/main/branch는 동일하고 이번 Excel·공통 코드 파일은 동일하다. 중간 검사에서는 PDF PNG 기준선 4개가 달랐다. **최종 검사에서는 PDF PNG 기준선 2개와 CHANGELOG.md·docs/review-notes.md가 시작 시점과 달랐고 git status도 달라졌다.** 이 세션은 그 파일에 쓰지 않았으며 동시 작업의 변경 가능성이 있다. 인과를 임의 확정하거나 복구하지 않았다. 경로와 양쪽 SHA는 `evidence/invariance.json`, `sha-start.json`, `sha-end.json`; 상태 원문은 `status-start.txt`/`status-end.txt`다. 따라서 “내 작업은 원 트리를 수정하지 않음”과 “원 트리 전체 SHA 동일”을 구분한다. `/tmp/worklazy-dc-impl`, `/tmp/worklazy-xr`의 파일 시스템은 접근·수정하지 않았다. 선행 변경 확인은 원 저장소 git 객체만 읽었다.

## 공통 재현 환경

```bash
cd /tmp/worklazy-xc-r1/main
source /tmp/worklazy-xc-r1/env.sh
```

Node v22.17.1, 설치된 ExcelJS/SheetJS/Vite/Chrome을 사용했다. 검증 입력은 사용자 실측 (a)을 제외하고 합성이다. 이후 표의 `node` 명령은 이 cwd/env를 전제로 한다. 브라우저용 서버는 다음 명령으로 기동했다.

```bash
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4350 --strictPort
```

`main/xc-probes`는 제품에 통합한 코드가 아니라 실험 코드다. 신규 규칙을 기존 UI 전체에 구현했다거나 전체 제품 smoke가 통과했다고 주장하지 않는다.

## (a) 실측표 — [보완]

```bash
node --experimental-strip-types xc-probes/actual.mjs
# 원출력: evidence/actual.json
```

|관측|왼쪽|오른쪽|
|---|---|---|
|시트/범위|최종 / A1:J78|최종 / A1:J84|
|머리글|4행, A4:D4 = No·이름·소속·주소|동일|
|병합|A2:I3|A2:I3|
|XML B2/B3 own value|둘 다 없음(self-closing)|둘 다 없음|
|adapter의 B2/B3 값|A2의 제목과 동일|동일|
|5행 이후 이름 있는 행|74|80|
|B열 중복키|0종|0종|
|No 재시작|73행=1 (72행=68)|79행=1 (78행=74)|
|No 1~6의 중복 위치|[5,73]…[10,78]|[5,79]…[10,84]|

|머리글/키|현행 duplicate 레코드 수|고유 중복키 수|그룹안 기대|
|---|---:|---:|---:|
|1행 / B열|4|1|1|
|4행 / B열|0|0|0|
|1행 / A열|28|7|7|
|4행 / A열|24|6|6|

실제 엔진 호출은 `options.mode=key`, `key.leftColumns/rightColumns=[2]`, `key.duplicatePolicy=error`이다. 보고서 Parameter 명은 `keyLeftColumns=2`·`keyRightColumns=2`·`duplicateKeyPolicy=error`이다. `keyColumns`라는 단일 옵션은 없다. actual 실험은 UI 기본 normalization 전부를 사용했다. 예를 들어 1/B 결과는 matched713·changed37·added48·duplicate4이고, 4/B는 matched703·changed37·added48·duplicate0이다. 실험 결과 숫자와 과거 내려받은 보고서의 행 수(헤더 포함)·다른 normalization 설정을 섞지 않는다. 파일 자체가 과거 UI 옵션을 보관하지 않으므로 “과거 사용자 실행 상태 입증” 대신 **이 파라미터로 동일 증상 재현**이라고 적는다.

정본 문안: CANONICAL-AMENDMENTS O01. **추가 이견 O01=1건.**

## (b) 레코드 확장 — [반박], A안 권고

```bash
node xc-probes/generate-engines.mjs
node --experimental-strip-types xc-probes/records.mjs
# evidence/records.json
```

기준 엔진 소스의 duplicate emit 부분만 바꾼 두 실제 producer를 만들었다. A는 기존 records에 4개 배열을 갖는 중복 레코드 하나, B는 별도 배열에 그룹 하나를 내고 records에서는 제외한다. adapter로 B를 A형 표시 레코드로 투영하면 **8개의 합성 쌍에서 A.records와 deepEqual**이다. 2:3·2:1·2:0·0:2·1:1·공백 정규화·빈 키·2개 key를 검사했다. 각 입력에서 secondary/occurrence의 records와 summary가 기준 엔진과 같고, A는 해당 정책의 반환 객체 전체도 deepEqual이다. 비중복 records는 A/B 모두 기준과 동일하다.

소비처를 수정하지 않았을 때의 출력:

```text
실제 목록: leftRows=[2,3], rightRows=[2,3,4]
첫행 하위호환 위치: L 2:– · R 2:–
첫행 값만 남긴 기존 검색에서 needle-left-tail: 0행
빈 scalar + 배열만 추가한 기존 검색: 0행
전체 배열을 읽는 adapter 검색: 1행
B의 미배선 화면 records: 0행
B의 미배선 Duplicates 보고서: 데이터 0행
A의 미배선 보고서: 중복 1행은 있으나 row/value 셀은 빈 값
양쪽 adapter 적용: 9시트·13열·Duplicates 1행, 번호 목록/전체 값 동일
ZIP 합성 왕복: XLSX 2개 각각 Duplicates 1행
```

A는 타입에 optional 필드만 붙이고 끝낼 수 없다. 화면·검색·보고서 formatter를 모두 바꿔야 한다. B는 그것에 더해 engine 반환·PairResult·worker의 명시 result 객체·summary·상태 통합·페이지 제한까지 바뀐다. wire 크기 이점도 작다.

|합성 입력(양측 각각)|안|emit record 수|serialized engine result|중앙 소요(3회)|
|---|---|---:|---:|---:|
|동일 키 1,000행|기존|2,000|393,108 B|12.36 ms|
|동일 키 1,000행|A|1|45,345 B|9.10 ms|
|동일 키 1,000행|B|0(+그룹1)|45,206 B|10.54 ms|
|동일 키 10,000행|기존|20,000|3,957,113 B|318.69 ms|
|동일 키 10,000행|A|1|477,349 B|320.07 ms|
|동일 키 10,000행|B|0(+그룹1)|477,210 B|303.60 ms|

JSON byte 수는 ArrayBuffer를 포함한 브라우저 총 메모리 지표가 아니다. 그룹 묶기만으로 엔진 시간이 크게 줄었다고 주장할 수 없다. `groupRows`의 매 행 배열 복사 비용이 남기 때문이다.

```bash
node --experimental-strip-types xc-probes/group-cost.mjs
# evidence/group-cost.json, groupRows의 핵심 loop만 분리한 비교
```

동일 키 30,000행 map 구축에서 기준 복사 loop 중앙 **4,683.83ms**, append loop **0.62ms**, 둘 다 같은 행 번호 순서다. 이는 전체 앱 속도 배수가 아니라 반복 복사 제거의 필요성을 보이는 분리 실험이다. 의미는 그대로 두고 이 표면을 성능 수정 범위에 넣거나, 넣지 않을 경우 큰 중복키 비용을 명시해야 한다.

**보고서 한 셀 한도 반례:**

```bash
node --experimental-strip-types xc-probes/overflow.mjs
soffice -env:UserInstallation=file:///tmp/worklazy-xc-r1/tmp/lo-profile \
  --headless --convert-to xlsx --outdir /tmp/worklazy-xc-r1/evidence/lo-roundtrip \
  /tmp/worklazy-xc-r1/evidence/large-synthetic.xlsx
node xc-probes/lo-read.mjs
```

```text
group members=1000; joined length=54785
ExcelJS write/reopen=54785
설치된 SheetJS writer: Text length must not exceed 32767 characters
LibreOffice XLSX 왕복=32767 (원본 54785)
formula cells=0
```

원출력은 overflow.json·lo-roundtrip.log·lo-read.json. 설치된 `node_modules/xlsx/xlsx.mjs:16151`의 검사도 위 거부를 재현한다. 따라서 기존 byte/PK·ExcelJS 재개방·수식0만으로 값 목록 무손실을 보장하지 못한다. **초과 시 쌍 실패를 명시하는 보수적인 계약**을 제안했다. 이 계약을 채택하면 해당 쌍 UI 성공 결과도 제공되지 않는다는 현행 구조의 영향을 문안에 명시했다. 조용한 잘림·시트/열 추가·continuation 행을 sol이 임의 선택하면 안 된다.

기존 소비처·단언은 [전수 목록](CONSUMER-INVENTORY.md)에 파일·줄·필요 변경으로 기재했다. **0 아닌 duplicate 골든 변경은 현행 unit :84의 4→1 하나**, 기존 duplicate0·reconcile 수치는 유지한다. 현재 UI에는 정렬 컨트롤이나 summary 숫자 표시가 없다. `summarize(records)` 자체는 여전히 레코드를 세며 “중복 레코드가 키당 하나”가 되는 단위 변경이다. 화면 신규 숫자는 “중복 키 n개”라고 표기한다.

정본 문안 O02(스키마), O03(소비처/단위), O04(한도), O05(비용). **추가 이견 4건, 누계 5건.**

## (c) 감지 규칙 — [반박]

```bash
node --experimental-strip-types xc-probes/header-cases.mjs
# evidence/header-cases.json
```

초안에서 정의되지 않은 부분은 실험에 다음처럼 고정했다: N=20, 비빈 **원시** 셀 최소 1개, 모든 비빈 셀이 string, 아래 **물리 5행**과 어느 열이든 trim한 값이 같으면 제외, 병합에 조금이라도 포함된 행은 제외, 후보 셀 수 내림차순→행 번호 오름차순, 없음=1. 이 해석을 초안의 유일한 뜻이라고 주장하지 않는다. 바로 그 모호함도 정본화 전에 없애야 할 이견이다. `.displayValue`나 `spreadsheetHeaders().name`는 이미 문자열이어서 그 위에서 “전부 문자열”을 검사하면 타입 조건이 사라진다.

|합성 패턴|의도한 행|초안 결과(이유)|오판|보수안 결과(이유)|
|---|---:|---|---|---|
|merged-title|3|3 (candidate)|아니오|3 (suggested)|
|two-level-vertical|2|1 (fallback)|예|1 (uncertain)|
|three-level-vertical|3|1 (fallback)|예|1 (uncertain)|
|left-empty-column|1|1 (candidate)|아니오|1 (suggested)|
|numeric-header-after-title|2|1 (candidate)|예|1 (uncertain)|
|header-reappears|1|2 (candidate)|예|1 (suggested)|
|filter-row|2|2 (candidate)|아니오|1 (suggested)|
|description-row|2|1 (candidate)|예|1 (suggested)|
|summary-block|5|1 (candidate)|예|1 (suggested)|
|empty|없음|1 (fallback)|아니오|1 (none)|
|real-row1|1|1 (candidate)|아니오|1 (suggested)|
|single-column-title|2|1 (candidate)|예|1 (uncertain)|
|single-column-row1|1|1 (candidate)|아니오|1 (uncertain)|
|sparse-header-dense-text-body|1|2 (candidate)|예|1 (suggested)|
|unmerged-title-one-column|2|2 (candidate)|아니오|2 (suggested)|
|note-merge-outside-table|1|1 (fallback)|아니오|1 (uncertain)|
|header-at-row21|21|1 (fallback)|예|1 (none)|
|same-word-in-other-column|1|2 (candidate)|예|1 (suggested)|
|no-header-all-text|없음|1 (candidate)|예|1 (suggested)|
|header-only|1|1 (candidate)|아니오|1 (uncertain)|
|dense-numeric-header|1|1 (fallback)|아니오|1 (uncertain)|
|three-level-no-vertical|3|2 (candidate)|예|2 (suggested)|

“fallback 1”이 우연히 정답 1과 같아도 감지 성공이 아니다. 표의 conservative 역시 prototype 내부 fallback row=1을 반환하지만, 제안 스키마에서는 uncertain/none의 `row=null`로 변환하고 UI 초기값만 1로 둔다. 보수안이 모든 문제를 해결했다는 결론은 아니다. 실제 사용자 파일 두 개는 4행을 제안했고, sparse-header-dense-text-body·header-reappears·same-word-in-other-column의 본문 건너뛰기 문제를 줄였지만 필터/설명/요약 블록·머리글 없는 표는 여전히 오인할 수 있다. 입력 값만으로 의도를 구분할 수 없는 동형 패턴을 정확도 보장으로 덮지 않는다.

- 숫자 헤더가 섞이면 raw string hard gate 때문에 탈락한다. CSV에서는 숫자 같은 값도 parser가 string으로 내므로 같은 규칙이 다르게 적용된다.
- 2·3단 머리글의 세로 병합은 마지막 머리글 행도 제외한다. 머리글 합성을 하지 않을 거라면 지원 제외/수동 선택 경계를 써야 한다.
- 본문 재등장 헤더나 다른 열의 동일 단어 때문에 진짜 머리글이 탈락하고 첫 본문이 선택된다. 반복값 금지를 hard gate로 두는 안을 기각한다.
- N=50으로 바꾸면 row21 예시는 잡지만 설명/요약/타입 문제는 그대로다. “20행이면 충분”이라는 정확도 주장은 기각한다.

flat cells 500,005개(100,000 data rows×5열)에서 상위 N=20/50/100 후보 검사 중앙은 각각 **5.685/5.674/5.587ms**였다(1회 warm-up+5회). N보다 전체 cells를 한 번 훑는 비용이 지배적이다. 현행 header helper 역시 `.filter()`로 전체 cells를 훑으므로 후보 20개마다 `spreadsheetHeaders()`를 호출하는 구현은 피해야 한다. 원시 샘플 한 번 구성·그 안에서 순위 산출·선택 헤더만 응답하는 계약을 제안한다.

정본 문안 O06. **추가 이견 1건, 누계 6건.**

## (d) 왕복·성능·취소 — [보완]

```bash
node xc-probes/generate-inspect.mjs
node xc-probes/browser.mjs
node xc-probes/browser-xlsx.mjs
node --experimental-strip-types xc-probes/races.mjs
```

기준 inspect worker와 자동 감지 worker를 분리해 같은 parseSpreadsheetInput·spreadsheetHeaders·runModuleWorker를 사용했다. **Chrome/152.0.7977.64**, Vite dev server. 첫 warm-up은 표에서 제외하고 이후 3회 중앙값이다. worker 모듈 로딩/Vite 비용이 포함되어 production의 절대 지연 예측값은 아니다.

|입력|방식|검사 왕복|전체 중앙|parse 중앙|detect 중앙|header 반환 구성 중앙|
|---|---|---:|---:|---:|---:|---:|
|CSV 1,000행|기준|1|598.34 ms|5.09 ms|0.02 ms|0.29 ms|
|동일|자동|1|593.88 ms|5.50 ms|0.63 ms|0.31 ms|
|CSV 10,000행|기준|1|645.77 ms|26.25 ms|0.01 ms|1.25 ms|
|동일|자동|1|685.00 ms|29.73 ms|2.08 ms|1.11 ms|
|CSV 100,000행, 4,244,473 B|기준|1|1021.88 ms|360.51 ms|0.03 ms|6.86 ms|
|동일|자동|1|859.61 ms|216.57 ms|42.46 ms|6.57 ms|
|XLSX 20,000행+2시트, 518,488 B|기준|1|1258.75 ms|669.07 ms|0.02 ms|1.72 ms|
|동일|자동|1|1251.01 ms|672.98 ms|3.07 ms|2.61 ms|

CSV 자동 100k의 detect 원시 3회는 **42.46/27.14/91.75ms**로 편차가 크다. 방식별 묶음 실행이므로 parse/JIT/GC 차이가 섞였고, 전체 시간이 낮았다는 이유로 자동 감지가 파서를 가속했다고 해석하지 않는다. XLSX 자동 응답에는 Sheet1 후보4·headerRows `[1,4]`, Sheet2 후보1·headerRows `[1]`이 들어갔다. 파일당 1요청/1종료였고 후보 헤더를 얻기 위한 두 번째 검사는 필요 없었다.

취소·기존 수동 조회 출력:

```text
실행중 auto inspect: 25ms 후 abort → AbortError, 25.53ms 전체, worker terminate 1회
이미 abort한 production inspect: arrayBuffer 읽기 1회(40ms 지연), worker create→terminate
현재 production 첫 조회: headerRows [1]
현재 production 수동3 조회: headerRows [1,3], 새 inspect/post/terminate 1세트 추가
```

첫 취소는 worker loading/초기 검사 동안의 종료 실험이다. 파서 CPU 작업 시작 후 특정 명령어에서 멈추는 지연이나 OS 메모리 회수 시간은 측정하지 않았다. `runModuleWorker`가 worker를 종료하는 계약과 already-aborted 요청의 불필요한 read는 실재한다.

`races.mjs`는 현재 `refreshHeader`의 완료 조건을 그대로 옮긴 상태 전이 반례다(제품 UI e2e 재현과 구분): row7 응답 뒤 늦은 row4 응답이 덮으면 **선택은7, 캐시는[1,4], 선택 헤더 값 없음**, 그런데 `inspectionBusy=false`여서 교환을 막지 못한다. 새 metadata를 spread로 PairState에 추가만 하면 현재 swap 함수는 file만 교환하고 그 metadata는 원 측에 남는다. 현 입력 로직은 1.5와999도 상태에 허용하며 pairReady는 헤더 범위를 검증하지 않는다. per-sheet 상태·token·signal·검사중 제어·정수/상한 검증을 명시해야 한다.

정본 문안 O07(선택 수명), O08(비동기 수명). **추가 이견 2건, 누계 8건.**

## (e) 안내·접근성 — [보완]

```bash
node xc-probes/ui.mjs
# evidence/ui.json, ui-{ko,en}-{390,1365}.png/.aria.txt
```

한 결과 tr, 좌6건/우2건, 각 목록의 summary·ul/li·행번호, 300자 이상 미리보기·전체 값 dialog, 머리글 후보 입력/안내의 **독립 HTML 프로토타입**이다. ko/en×390/1365 네 조합에서 axe 위반0·문서 overflow0(모바일 table container 자체 scroll562px), Enter로 좌측만 펼침·우측 접힘 유지·dialog Escape 닫기·내부 코드 표시0을 통과했다. desktop screenshot을 직접 열어 확인했다. ARIA snapshot은 목록/행 번호가 접근성 트리에 존재함을 보여 준다. 실제 NVDA/VoiceOver 음성 청취와 제품 테마의 결과 페이지 검수는 하지 않았고 후속 완료 기준이다.

초안의 “n행을 머리글로 인식했습니다”는 후보 선택보다 강한 표현이다. 제안 문안은 **“n행을 머리글 후보로 선택했습니다. 열 이름을 확인하고 필요하면 바꿔 주세요.”** / **“Row n is selected as a suggested header. Check the column names and change the row if needed.”**이다. 미감지/default1과 사용자 수동 선택은 다른 문구를 쓴다. 내부 reason 코드나 Worker 명칭은 사용하지 않는다.

“왼쪽 n건/오른쪽 m건” 자체는 제품 언어에 적합하다. 다만 펼침 상태를 맞추거나 항목끼리 행을 정렬해 놓고 연결선/같은 인덱스 매칭을 암시하지 않아야 한다. 닫힌 목록과 아직 더보기로 올리지 않은 값을 **검색에서 제외하지 않는다**. 단순 title 속성은 키보드 전체값 접근 수단이 아니다. production에서는 닫힌 목록 DOM 생성을 피하고 펼침50개씩을 제안했다; 위 작은 UI prototype은 6/2건의 구조 검증이며 10만 행 DOM 성능 테스트는 아니다.

정본 문안 O09. **추가 이견 1건, 누계 9건.**

## (f) 선행 브랜치 — [동의: 순서] / [보완: 교집합]

```bash
# 원 저장소에서 git 객체만 읽기
git rev-parse refs/heads/excel-report-width-20260907
git diff --name-only 5bc6854175331bdd73b267784d9633cdccda8446 ac9cc4a2638aeb497a69668079be050786e6edf7
git diff 5bc6854175331bdd73b267784d9633cdccda8446 ac9cc4a2638aeb497a69668079be050786e6edf7 -- \
  src/features/excel-compare/excelCompare.worker.ts src/features/excel-compare/reportIntegrity.ts \
  tests/excel-compare-smoke.mjs tests/unit/excel-compare.test.ts
```

착수 때 branch ref는 아직 base였으나 조사 중 **ac9cc4a2638aeb497a69668079be050786e6edf7**로 이동했다. 총11파일 변경. 직접 수정 교집합은 **excelCompare.worker.ts**(await 생성검사), **tests/excel-compare-smoke.mjs**(assertNineSheetReport의 가시성 검사), **tests/unit/excel-compare.test.ts**(async 무결성 테스트+중복 골든)이고 후속 기록2파일도 겹친다. 공유 writer·reportIntegrity·spreadsheet-core 단위·excel-cleaner/qr 스모크·공용 XLSX assertion helper는 의미/회귀 의존이다. 전체 목록은 CONSUMER-INVENTORY 마지막 표와 width-branch.diff 참조.

**report.ts는 선행에서 수정되지 않았으므로 초안의 파일 충돌 근거는 틀렸다.** 병합 후 착수 순서는 여전히 맞다. 과거 동기 `assertGeneratedXlsxReport` 호출로 회귀시키면 새 검사 실패가 올바르게 전달되지 않는다.

선행 writer/validator는 git show로 **실험 디렉터리에만** 꺼내 그룹 formatter와 연결했다:

```bash
node --experimental-strip-types xc-probes/width-integration.mjs
# evidence/width-integration.json
```

```text
9 sheets; Duplicates data rows=1; Duplicates columns=13
finite positive column widths=95
ZIP reports=2, 각각 생성 무결성 통과
중복 데이터만 고의 누락해도 visibility는 통과(true)
```

마지막 음성 대조는 visibility 검사를 기각하는 것이 아니라 그 검사 범위가 **목록 내용 수치 검증을 대신하지 않음**을 보여 준다. Summary/Parameters 데이터가 있어 전체 “데이터 존재” 조건은 충족한다. 따라서 새로운 Duplicates 행 수·좌우 모든 번호/값을 별도 단언한다. 현 main은 여전히 base이며 선행 main 병합은 이번 실험에서 수행하지 않았다. 추가 독립 이견은 없고 이 사실 정정은 O10의 검증/기준 갱신 문안에 포함한다. **누계9건 유지.**

## (g) sol 재해석 지점·제품 영향·완료 기준 — [보완]

|번호|정본이 아직 결정하지 않은 사항|권고|근거|
|---|---|---|---|
|O01|좌우 실제 시작행·수치·재현 옵션 이름|좌73/우79, 4/1 및24/6 단위 구분|actual.json|
|O02|스키마 선택·첫 행 의미·배열 불변식·표시키|A, duplicate scalar 위치는 null, 전체 배열만 진실|records.json|
|O03|검색/보고서/worker/집계/순서/더보기 소비처|전수 목록대로 함께 전환; 단위 key-group|소비처 검색·동형 A/B·ZIP|
|O04|긴 목록이 1셀 한도를 넘으면 어떻게 할지|조용한 잘림 없이 해당 쌍 안전 실패|54785→32767 실측|
|O05|큰 중복키 구성 시간·취소 간격|배열 append·4096 callback·정책 의미 보존|group-cost.json|
|O06|감지 조건의 정확한 뜻·상한·불확실성·대안 선택|hard exclusion 기각, 보수안/수동 경계 판정 요청|22패턴 중 초안12오판|
|O07|파일·시트별 수동 우선·새 파일/교환·유효 범위|per-file/per-sheet 상태·정수 범위 검사|races.json·현 코드|
|O08|최초/수동 inspect·캐시·취소·늦은 응답|최초1RPC·token/signal·전체 검사 busy|브라우저·races.json|
|O09|접힘·큰 값·검색·언어·스크린리더 정보|독립 목록·전체값·제안 표현·ko/en plural|ui.json·ARIA·PNG|
|O10|실행 가능한 gate/환경·선행 변화 반영|production static과 QA visual 분리·새 main 기준|static 실패/성공·선행 diff|
|O11|ko/en·SEO/guide/FAQ·광고·시각 표본|입력 문서 갱신·경로 유지·결과상태 표본 추가|현 registry·locale·테스트 표면|

**잔여11건**은 Claude가 아직 수용/대체/기각을 회신하지 않은 변경 제안 단위다. “프로토타입으로 기술적 가능”을 “Claude와 합의 완료”로 세지 않았다. 서로 다른 세부 edge case를 임의로 별도 번호에 늘리지 않았다. 사용자 결정 자체를 되돌리는 제안이나 ★사용자 확인 요청은 없다.

규칙4: 한국어/영어 신규 안내·숫자 복수형·guide/FAQ/SEO 설명 입력을 동반 검토한다. URL/canonical/hreflang/sitemap 경로 집합을 바꿀 필요는 없고 registry는20개 유지다. 이 도구는 일반 AppShell 광고 경로이며 새로운 광고 제외나 서버 코드를 반입하지 않는다. 규칙5: 원시 key identity/예외/감지 reason은 사용자 메시지에 직접 출력하지 않는다. 규칙19: 제품 구현 후 광고·GA·Naver가 제외된 QA 빌드에서 **결과 상태**를 Gemini 직접 시각 검수 + Codex 실측 교차한다. 이번 독립 prototype axe 0을 제품 검수 통과로 대체하지 않는다.

초안 §3의 `css:orphans`는 **npm run css:orphans**, `registry`는 **node tests/tool-registry-routes.mjs**, 설치 금지 조건의 `npx tsc -b`는 **./node_modules/.bin/tsc -b**로 적는다. `test:visual`/a11y의 현재 기본 표본은 신규 duplicate 결과를 덮지 않으므로 결과 상태 시나리오를 추가한다. `bundle:measure`는 자체 build를 실행하며 baseline 없이 실행하면 비교 예산 판정이 아닌 측정에 그친다. 전용 캐시·포트·서버 소유권·직렬 실행을 명령에 포함한다.

실행 중 **VITE_LOCAL_QA=1 build → test:static이 실패**했다:

```text
Error: Google or Naver Analytics configuration is missing from the application bundle.
```

production으로 재빌드 후 **test:static 통과**. 이는 기능 결함이 아니라 QA 산출물에 production 정적 계약 검사를 적용한 환경 충돌의 재현이다. 현행 excel-compare-smoke도 loader 존재를 요구하므로 QA 빌드와 일괄 실행하면 동일한 문제를 만들 수 있다. 정본 반영 문안에 production 검사와 QA 시각/접근성 단계를 분리했다.

## 실제 실행한 검증과 한계

|실행|결과|원출력|
|---|---|---|
|actual.mjs|성공, 사용자2파일 메모리 실측|actual.json|
|generate-engines + records.mjs|성공, 8입력×2안×3정책 대조·report/ZIP|records.json|
|header-cases.mjs|실험 완료, 초안12/22 오판|header-cases.json|
|group-cost.mjs|실험 완료, copy/append 분리 비교|group-cost.json|
|overflow + soffice + lo-read|실험 완료, 잘림 재현|overflow.json·lo-read.json·lo-roundtrip.log|
|browser.mjs|성공, CSV24표본·abort·production 수동조회|browser.json·browser.log|
|browser-xlsx.mjs|성공, XLSX8표본·시트별 후보|browser-xlsx.json/.log|
|races.mjs|성공, 기존 완료가드/metadata swap 반례 검출|races.json|
|ui.mjs|성공, ko/en×2 viewport axe0·키보드|ui.json/.log·4 PNG/ARIA|
|width-integration.mjs|성공, 선행 writer+async validator+그룹 보고서/ZIP|width-integration.json|
|VITE_LOCAL_QA=1 npm run build|exit0, 2,834 modules·정적61페이지|build.log|
|표적 unit 6파일|**34/34 통과**|unit-targeted.log|
|QA 산출물 npm run test:static|**실패**, Analytics 부재|static.log|
|env -u VITE_LOCAL_QA npm run build|exit0, 2,834 modules·정적61페이지|build-production.log|
|production npm run test:static|exit0, Startup recovery104 documents|static-production.log|
|node tests/tool-registry-routes.mjs|exit0,20개·누락/추가/중복0|registry.log|
|npm run css:orphans|exit0,zero-reference0|css-orphans.log|
|원 트리 시작/종료 status+SHA|Excel 코드 불변; 최종 PDF PNG2개·기록2파일 차이, 전체 불변 아님|invariance.json 및 start/end manifests|

표적 unit의 실제 명령:

```bash
node --test --experimental-strip-types \
  tests/unit/excel-compare.test.ts tests/unit/excel-compare-fixtures.test.ts \
  tests/unit/excel-compare-pair-files.test.ts tests/unit/spreadsheet-core.test.ts \
  tests/unit/feature-locales.test.ts tests/unit/tool-registry-routes.test.ts
```

전체 `npm run test:unit`, 제품 `test:excel-compare`/cleaner/qr/browser 전체, 기존 `test:visual`/a11y 전체, `bundle:measure`는 이번 **계획 반박 실험에서 실행하지 않았다**. 실행 가능한 명령과 추가할 게이트를 CANONICAL-AMENDMENTS에 정리했으며, 제품 구현 완료의 대리 통과로 기록하지 않는다. 첫 브라우저 측정 시 Vite 신규 의존 최적화가 페이지를 reload하여 재실행했으며 해당 원출력은 browser-initial-reload.log에 보관했다. UI 하네스는 axe가 요구하는 browser.newContext()로 수정 후 네 조합을 재실행했다. 제품 소스 수정은 없다.

최종 전달: **이견11건, 재왕복 필요.** 반영/대체안에 대한 Claude 판정 뒤 정본을 대조할 수 있다. 현재는 실제 구현 착수 조건(선행 main 병합·최종 기준 해시·이견0)을 충족하지 않는다.

최종 SHA 표본의 변경 경로(전체 목록, 샘플링 종료 후 동시 잡의 후속 변경 여부는 범위 밖):

- `CHANGELOG.md`
- `docs/review-notes.md`
- `tests/visual-baselines/pdf-editor-empty__initial__en__light__mobile.png`
- `tests/visual-baselines/pdf-editor-empty__initial__ko__dark__mobile.png`

실험 Vite 서버(4350)는 종료했다(exit130). 브라우저·LibreOffice 프로세스는 각 하네스가 종료했고 추가 서버를 남기지 않았다.
