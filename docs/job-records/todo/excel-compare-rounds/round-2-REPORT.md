# Excel 비교 중복키·머리글 v2 — 반박 2차

**Codx · 2026-09-07 · 판정: 재왕복 필요, 잔여 이견 3건.**

일반적인 긴 중복 그룹을 Duplicates 연속 행으로 나누는 Claude의 선택과 detectConservative 채택에는 동의한다. 다만 v2 문장 그대로는 **긴 Key 예외, 분할 출력의 세부 계약/재개방 호환성, 감지 코드와 문장 불일치**가 남는다. 이 상태에서 “Claude–Codex 간 이견 0 · [정본화 가능]”을 선언하지 않는다. 사용자 결정 두 건을 되돌리는 제안이나 ★사용자 확인 요청은 없다.

|요청|판정|결과|
|---|---|---|
|(i) O01~O11 반영 대조|[동의/보완]|첨부 채택을 포함해 199문장 대조. 의도하지 않은 절 단위 누락0, O04/O06 명시 대체 인정. 세부 잔여 아래3건|
|(ii) O04 연속 행 분할|[동의] 일반 목록 / [반박: 증거] 무조건 무손실·성공|13열/9시트·surrogate 안전·100k·실다운로드·ZIP 성공. Key40003→32767 잘림, 긴 여러 줄 셀 LibreOffice 왕복 변형 반례. 16k 보완안 검증|
|(iii) O06 보수 감지|[동의] 선택 / [보완/반박: 증거] 단일 해석·안내|22패턴×6형식=132회 실제 재파싱. 오제안5종·CSV4종 차이, 세로병합 skip 불일치. 헤더 없는 표 첫 행 누락 영향 재현|
|(iv) 소비처|[보완]|기존 핵심 파일군은 충분하나 줄번호·분할 내용/무결성/worker/helper 단언 보강. duplicate leftRow 전용 기존 단언0; count4→1 한 곳|
|(v) 단계·게이트|[보완]|스키마/엔진/보고서→화면→감지→전체 통합. S1+S2가 제품 동작의 한 전환 단위, 단계별 테스트를 마지막까지 미루지 않음|
|(vi) sol 재해석·규칙4/5/19|[보완]|복사 가능한 문안 작성. 아래 R2-01~03의 Claude 판정 전 정본화 불가. 제품 시각 검수는 후속 게이트|

## 산출물과 범위

- [정본 반영 문안](CANONICAL-AMENDMENTS.md): R2-01~03와 단계·제품 계약.
- [문장별 대조 199개](SENTENCE-CROSSCHECK.md): 첨부의 문장별 위치와 v2 적용 판정.
- [소비처·단언 보완](CONSUMER-ADDENDUM.md): 실제 main 파일/줄과 기존 단언 변화.
- `probes/`: 재현 스크립트 및 사본 소스에서 파생한 프로토타입. `logs/`: 명령 원출력/JSON.
- `browser-100k-32767.xlsx`, `browser-pair-32767.zip`: 32767 예산 브라우저 실다운로드.
- `browser-100k.xlsx`, `browser-pair.zip`: 16k 보완안 브라우저 실다운로드.
- `lo-roundtrip/`: **합성 입력만** LibreOffice 재개방/저장한 결과.

PROJECT_RULES 전문을 첫 도구로 읽고 AGENTS·dispatch·v2·1차 산출·Excel review-notes 이력을 읽었다. 원 워킹트리 HEAD는 `c8bff1fd1ab64f89afb7240778e0a373c953d1a3`, branch `s3-pdf-finish`. 문서 기준 main은 `5bc6854175331bdd73b267784d9633cdccda8446`, 선행 width ref는 `ac9cc4a2638aeb497a69668079be050786e6edf7`이었다. HEAD 차이는 지시서에 지정된 U4 작업 때문에 생긴 것으로 기록하고 해당 코드를 실험 기준으로 쓰지 않았다. `git archive 5bc6854…`를 `/tmp/worklazy-xc-r2/main`에 전개했다. 선행 writer/validator/helper는 **git 객체**에서 probes에 꺼냈으며 `/tmp/worklazy-xr` 파일시스템에 접근하지 않았다. DC 트리도 접근하지 않았다.

열린 계획서는 최상위 md의 실제 교집합을 `logs/open-plan-intersections.txt`로 기록했다. Excel U1/X-A/B/C는 선행 계약, width는 병합 선행 의존, PDF/DC/UI의 공용 locale/기록/visual 표면은 향후 병합 게이트에서 재대조해야 한다. 이번에는 어느 작업 소스도 수정하지 않았다. 사용자 엑셀은 이번 라운드에서 새로 읽거나 복사하지 않았고 O01은 허용된 1차 실측 증거를 재사용했다. 사용자 자료/경로를 새 CI fixture에 넣지 않았다.

설치0·커밋0·push0·브랜치 전환0. r1에 연결된 기존 dependency를 재사용하되 `.tmp`와 build cache는 r2 전용이었다. Node v22.17.1 / Chrome152.0.7977.64 / LibreOffice24.2.7.2. 포트4390 `--strictPort`, NODE_OPTIONS4GiB, 전용 TMPDIR/cache. 빌드·브라우저는 직렬 실행했고 모든 실험 서버를 종료했다. prototype은 제품 전체에 통합한 변경이 아니다.

## 재현 환경·핵심 명령

```bash
cd /tmp/worklazy-xc-r2/main
source /tmp/worklazy-xc-r2/env.sh
# env: NODE_OPTIONS=--max-old-space-size=4096,
# TMPDIR=/tmp/worklazy-xc-r2/tmp, npm_config_cache=/tmp/worklazy-xc-r2/npm-cache,
# TEST_BASE_URL=http://127.0.0.1:4390, VISUAL_CONCURRENCY=1

node --expose-gc --experimental-strip-types ../probes/report-probe.mjs
node --experimental-strip-types ../probes/header-probe.mjs
node --experimental-strip-types ../probes/header-normative-check.mjs
node ../probes/zip-encoding.mjs
node --experimental-strip-types ../probes/lo-variants.mjs
soffice -env:UserInstallation=file:///tmp/worklazy-xc-r2/tmp/lo-profile \
  --headless --convert-to xlsx --outdir /tmp/worklazy-xc-r2/lo-roundtrip \
  /tmp/worklazy-xc-r2/long-key-literal.xlsx /tmp/worklazy-xc-r2/emojiBoundary.xlsx \
  /tmp/worklazy-xc-r2/hugeSourceRow.xlsx /tmp/worklazy-xc-r2/blank-100000.xlsx \
  /tmp/worklazy-xc-r2/blank-100000-16k.xlsx /tmp/worklazy-xc-r2/lo-lengths.xlsx
node --experimental-strip-types ../probes/supplement-probe.mjs
python3 ../probes/lo-validate.py

./node_modules/.bin/vite build --config ../probes/vite.config.mjs
# 빌드 완료 후 별도 관리 프로세스에서:
./node_modules/.bin/vite preview --config ../probes/vite.config.mjs \
  --host 127.0.0.1 --port 4390 --strictPort
# preview 준비 후 다른 터미널에서, 한 브라우저 하네스씩:
node --experimental-strip-types ../probes/browser-probe.mjs
# 하네스 종료 뒤 preview도 종료. 마지막 보존된 worker는 chunks-16k.mjs를 사용한다.
# 32767안을 재현하려면 사본 probes/proto.worker.mjs의 definition import만
# chunks.mjs로 돌리고 재빌드한다. 원 제품 소스는 수정하지 않는다.
```

원출력은 `logs/report-run.log`, `report.json`, `headers-run.log`, `headers.json`, `supplement.json`, `header-normative.json`, `zip-encoding.json`, `lo-variant-results.json`, `browser-32767.json`, `browser.json`, `prototype-build*.log`에 있다. 이미 변환한 파일을 재실행할 때는 별도 새 LibreOffice 출력 디렉터리를 써서 덮어쓰기 대화가 생기지 않게 한다.

## (i) 반영 대조 — [동의/보완]

v2 57행의 **첨부 채택**으로 AMENDMENTS와 CONSUMER-INVENTORY 전문이 유효하다. 요약에 생략된 문장을 곧바로 미반영으로 판정하지 않았다.

|절|대조 결론|
|---|---|
|O01|좌73/우79·adapter 경로·1/6/0 그룹 기대 반영. 원 파일만으로 과거 UI 옵션까지 입증하지 않는 한계는 첨부 문장으로 유지|
|O02|records 확장·4배열/동측동인덱스·없는측[]·2:1 포함·1:1 유지·scalar null/empty·identity 불변·원본 표시key 반영. displayKey 구체적 조합 규칙은 R2-02 보완|
|O03|검색전체·동일 key 다른쌍 분리·Set/원본순서·500그룹·summary unit·9/13·문자열주입방어·좌우 비매칭 반영. 현재 화면 신규 집계라는 의미도 첨부에 보존|
|O04|구 쌍실패 전문을 의도적으로 대체했으므로 미수용을 누락이라 하지 않음. 대체안의 모든 입력 무손실/성공은 R2-01/02 반례로 성립하지 않음|
|O05|append·동일3정책·4096취소·추가사본 제한·30000행 회귀 반영. 긴 단일 행의 조각마다 검사할 규칙은 분할 문안에 보강|
|O06|선택 대기는 Claude 채택으로 종결. raw/25샘플/첫후보/불확실성/지원외 반영. '비병합1셀'과 채택 prototype의 skip이 불일치: R2-03|
|O07|파일시트별 수동우선·재선택 초기화·swap·정수범위·헤더캐시·mapping유효성 반영. 머리글없는표의 행포함 계약은 안내에 더 정확히 써야 함|
|O08|최초1왕복·헤더동봉·5번째인자·manual=false·캐시병합·소유권token·abort/finally 반영. 검사중 선택 허용 시 token 처리 문장은 첨부에 살아 있음|
|O09|독립 접기·0건텍스트·lazy50·전체검색·dialog·확정형금지·polite/설명 연결 반영. '4종'은 사유/제안/미감지/수동 안내를 가리키며 추가 감지상태를 뜻하지 않음|
|선행/O10|report.ts 실제 비교집합·async가시성·shared writer 회귀·production/QA 분리 반영. r1 예시4350은 이번 사용자4390 지시로 치환|
|O11|ko/en/guide/FAQ·SEO입력·경로/광고불변·5회귀군·결과visual/a11y 반영. 구 O04 초과오류 언급과 구 본문은 최종 정본에서 새 정책으로 통합 필요|

정본화 때 v1의 폐기 규칙과 1차 문안의 '판정 필요/쌍실패/분할 불허'를 실행 지침에서 제거하고 왕복 이력에만 남긴다. 첨부 의미를 요약문만으로 축소하지 않는다.

## (ii) O04 프로토타입 — [동의] + [반박: 증거]

### 13열·9시트·경계·긴 한 행

원 엔진 중복 emit·groupRows만 파생 수정한 producer, 선행 width writer·async integrity, 독립 formatter를 연결했다. 값 목록은 양측 별도 chunk이고 화면 records는 하나다. 모든 string을 기존 writeUntrustedText로 쓴다.

|합성 입력/32,767 예산|Duplicates 데이터 행|내용 판정|
|---|---:|---|
|접두사 포함32767|1|셀 최대32767·원문 보존|
|접두사 포함32768|2|`2 [1/2]` / `2 [2/2]`, 재접합 동일|
|경계가 이모지 pair 중간|2|1차 조각32766으로 후퇴, unpaired surrogate0|
|LF·CRLF·원문에 `3: literal`|1|LF/행목록 유지; 기존 XML CRLF→LF 정규화는 별도 한계|
|한 원본행 emoji50000개=100000 code units|4|4부분 순서 접합=원문, 해당 원본행번호 반복을 부분 표기로 구분|
|100000개 긴 행번호 목록/빈 값|25|번호 전부 보존·행번호/값 셀 각각 예산 충족|
|좌0/우2|1|좌 빈칸/우2항목|
|=,+,-,@,선행tab 문자열|1|수식 셀0|

모든 위 보고서에 9시트, 13열 이름/순서, **95개 유한·양수 열 너비**, 수식0, ExcelJS/SheetJS 재개방 검사를 실행했다. 길이·내용 대조는 따로 수행했다. 작은 경계 파일 2종의 LibreOffice 왕복도 차이0이다. `splitSide`의 callback이 두번째 호출에서 취소되면 4096행까지 처리 후 중단함을 단언했다. OS/worker terminate 지연 전체를 이 단위콜백 검사와 동일시하지 않는다.

### 10만 행 극단·실다운로드·ZIP

두 개 CSV를 각각 파싱하여 **왼쪽100000/오른쪽100000행의 키가 모두 빈 그룹**을 실제 Chrome worker에서 만들었다. 브라우저 페이지는 그 새 레코드를 받아 원래 Blob/byteLength 검사·제품의 writeZipArchive를 사용했다. XLSX 링크와 ZIP 링크를 실제 클릭해 저장하고 ZIP의 두 XLSX를 각각 재개방했다. 각 원본행번호/문자열20만 항목을 정확히 검증했다.

|실측|32767목록 예산|16000보완 예산|
|---|---:|---:|
|화면 그룹 수|1|1|
|Duplicates 데이터 행|195|399|
|개별 XLSX|790,690B|837,346B|
|ZIP(성공보고서2개)|1,581,836B|1,675,148B|
|브라우저 전체(생성+결과전달+ZIP)|1901.5ms|1709.4ms|
|파싱(두CSV)|420.3ms|366.9ms|
|엔진|539.9ms|452.4ms|
|직렬화 레이아웃|59.9ms|35.6ms|
|XLSX쓰기|450.8ms|456.9ms|
|생성 무결성|17.7ms|20.0ms|
|개별 및 ZIP 내 source rows|각100000+100000 동일|각100000+100000 동일|
|replacement character|0|0|

단회 표본이므로 속도 우열을 주장하지 않는다. 16k XLSX 증분은 **46,656B(+5.90%)**이다. 양쪽0/1/복수 정책 회귀는 별도18조합(6형태×3정책)에서 error의 다른 상태·occurrence/secondary records/summary 동일을 단언했다.

메모리/비용 측정은 별도 Node 합성 전체 엔진 시험(`--expose-gc`, browser writer 경로)에서 수행했다. 100000행×2논리측: input구성156.9ms, engine614.7ms, layout91.6ms, write497.2ms, 검증1029.1ms. 관측 peak JS heap **300,142,992B**, 시작heap43,658,344B, 해당 프로세스 high-water RSS **521,080KiB**. 10000행 대응 peak58,704,864B, write163.0ms. heap는10ms interval/단계끝 관측값이고 RSS는 프로세스 전체 high-water이며, 숨은 순간정점/브라우저 총heap/모바일 상한을 보장하지 않는다. Node 입력 book 하나를 두 논리측에 재사용하여 입력 parser2개 메모리를 포함하지 않는다. 브라우저 시간시험은 실제 두 parser를 사용했다. 행수만으로 임의 길이·폭을 갖는 100k 입력 모두가 이 비용이라고 일반화하지 않는다.

### 쌍 실패보다 나쁜 반례와 보완안

**R2-01: Key가 너무 길 때 무손실·반복·상한 동시 불가능.**

```text
원본 선택키2열 각각20000자 (각 셀은32767이하)
displayKey = 첫열 + " | " + 둘째열 = 40003자
같은 Key 반복 보고서: 선행 assertGeneratedXlsxReport 통과
SheetJS XLSX writer: Text length must not exceed 32767 characters
LibreOffice 재저장: Key40003 →32767
```

이때 '성공'은 잘린 키를 제공하므로 명시 실패보다 나쁘다. 목록 분할을 더 해도 반복 Key 길이는 줄지 않는다. 권고는 **이 Key 예외만 쌍 실패**, 일반 긴 그룹은 계속 분할 성공이다. 다른 선택을 원한다면 키 continuation/별도 결과스키마를 Claude가 정해야 한다. prototype은 이 예외 guard를 증명했고 원 정책으로 확정하지 않았다.

**R2-02: 셀길이만 지키면 모든 재개방에서 무손실이라는 주장은 반박.**

32767예산 100k 보고서를 LibreOffice24.2.7.2로 열고 XLSX로 저장하면 값 셀 **390개**가 달랐다. 단순 reader 오판을 배제하려고 ZIP/XML 텍스트도 직접 대조했다(`lo-xml.json`). J2는549줄→550줄, 앞부분에서 3행 대신279행이 먼저 나오는 순서 변형이 관측됐다(`lo-diff.json`). ASCII 대조군에서도 newline있는16383/16384/16385/20000/32767문자 중5종이 변형됐고 동일길이 단일줄은 전부 동일했다. 이 설치본에서 재현한 호환성 문제이며 모든 Excel프로그램의 공통한계라고 일반화하지 않는다.

16,000 예산은 같은100k 입력을399행으로 만들고 LibreOffice ZIP/XML 내용차이 **0**이었다(`lo-variant-results.json`). 별도 Node 산출836,331B, layout82.2ms/write636.4ms. 더 작은 그룹 조각이라는 동일 설계 안에서 반례를 피했으므로 일반 쌍실패로 돌아갈 필요는 없다. 정확한 예산/부분행표기/좌우소진/Parameters를 정본에 채택해야 한다.

**Node encoding 음성 대조는 제품 브라우저 결함과 구분했다.** Node ExcelJS→JSZip 문자열경로에서는16KiB 문자열 chunk가 emoji를 쪼개 원시XML에22개 replacement char를 만들었다. 최소 재현은 `'a'.repeat(16383)+'😀tail'`: JSZip string입력=false, TextEncoder bytes입력=true. 제품용 ExcelJS browser 분기는 전체 문자열을 bytes로 바꾸므로 두 브라우저 실제 출력에서는 손상0이었다. 이 원인을 확인한 뒤 Node 시험의 writer만 browser경로로 맞췄고 independent SheetJS/XML을 대조했다. 벤더는 수정하지 않았다. 초기 실패 원출력은 삭제하지 않고 보존했다.

### Parameters·Left/Right row의 해석

prototype은 split true/그룹수/물리행수/절대한도/layout/부분행표기설명/그룹출력구간을 기록한다. **16k 예산을 나타내는 별도 Parameter 및 비적용 UNUSED의 완전한 제품배선은 정본 문안에 지정한 후속 구현 사항**이다. 이 실험이 그 제품배선까지 구현했다고 주장하지 않는다.

`Left row=2,3`는 원본2/3행 두건, `2 [1/3]`는 원본2행 값의 첫 조각이다. 단순히 `2`만 여러행 반복하면 원본2행이 여러건인지 continuation인지 구별이 어렵다. 좌우 조각 경계는 서로 달라 같은 보고서행은 매칭이 아니다. 또 displayKey가 같은 별개 정규화그룹의 경계를 Parameters의 그룹순번/보고서행구간으로 구별하도록 제안했다. 화면 집계1을 보고서행195로 바꾸거나 분할된 객체를 다시 UI records에 넣는 것은 금지한다.

## (iii) 감지 잔여 — [동의/보완/반박: 증거]

`header-probe.mjs`는22패턴을 실제6형식으로 직렬화하고 기존 adapter로132회 재파싱했다(합성 XLSM은 bookType=xlsm 컨테이너/타입 경로 확인이며 새 VBA 실행 시험은 아님). 원시 22패턴은 suggested12/uncertain8/none2, suggested 중 의미오판5이다. 보수안의 선택은 유지하지만 '불확실하면 항상 물러난다'를 의미 이해의 보장으로 쓰지 않는다.

|남은 오제안|의도|출력|사용자 영향|
|---|---:|---|---|
|필터행|2|suggested1|필터값을 열이름으로, 실제헤더를 데이터로 취급|
|설명행|2|suggested1|설명을 키/매핑 열이름으로 보게 됨|
|상단요약|5|suggested1|요약/빈행/실제헤더가 데이터에 포함될 수 있음|
|머리글없는 텍스트표|없음|suggested1|**첫 데이터행 제외**. 첫행만 바꾼 합성쌍은 changed/added/removed0|
|세단·세로병합없는 헤더|3|suggested2|중간헤더가 선택되어 마지막헤더가 데이터에 포함|

O09의 '후보/확인/수정' 문구는 확신을 낮추는 데 맞다. 그러나 헤더없는표에는 기존 유효범위1..rowCount 안에서 모든 데이터를 보존할 수 있는 수동 선택이 없다(dataRows는headerRow+1부터). 따라서 O07의 범위 안내를 실제 문안으로 구체화하고 '열이름행을 맨 위에 추가'하는 지원경계를 알려야 한다. no-header 모드/row0 추가는 제안하지 않았다.

|CSV 차이(동일 원시 패턴 대비)|원시/비CSV|CSV 실제|
|---|---|---|
|merged-title|suggested3|uncertain,null: merge정보 없음·반복제목 문자열|
|numeric-header-after-title|uncertain,null|suggested2: 숫자형 값이 문자열|
|dense-numeric-header|uncertain,null|suggested1: 문자열 비율 달라짐|
|three-level-no-vertical|suggested2|uncertain,null: merge정보 소실|

나머지5형식은 이132회 표본에서 원시 기대와 같았다. 이를 모든 수식·다단병합·오류·날짜 파싱의 전수 보증으로 확대하지 않는다. 별도 formula/error fixture에서 문자열비율 제외→uncertain을 단언했다. CI의 기대는 형식별 row+reason이며, 원시 정답행만 무조건6번 복제하지 않는다.

**R2-03 문장/프로토타입 불일치**: A1:A2 세로병합 title 두줄+3행ID/Name+2본문행의 경우 채택된 r1 코드의 `cells.length===1 && below…` skip은 **suggested3**. v2의 '비병합1셀' 문장을 그대로 적용하면 세로병합행은 skip할 수 없어 첫 판정 **uncertain,null**이다. `!vertical.has(row)`를 skip에 추가한 normative prototype은 기존22개 출력 전부를 유지하고 추가사례만uncertain으로 바꿨다(`header-normative.json`). 이 precedence를 정본에 확정해야 한다.

UI 독립 prototype에서 suggested4/uncertain/none를 순차 반영하면 input4/1/1, manual4는별도선택문구였다. ko/en×390/1365×light/dark8조합에서 polite컨테이너4회변경에알림4회, fallback에'detected'출력0을 확인했다. source/manual캐시/네트워크응답역전 전체 제품통합은 S3 gate이며 이 단순 UI시험을 그 대리로 쓰지 않는다. 초기에 프로토타입 다크 링크 대비 axe1건이 있어 시안CSS만 수정하고8조합을 재실행해0을 확인했다.

## (iv) 소비처·기존 단언 — [보완]

CONSUMER-ADDENDUM을 정본에 채택하도록 권고한다. 중요한 사실은 **기존 duplicate leftRow/rightRow 고정 위치 단언이 없다는 것**이다. 바뀌는 nonzero golden은 unit:84의 duplicate4→1 한 곳이다. occurrence:89, position:63–64, reconcile:189/236–237의 행위치 단언은 변경하면 안 된다.

기준 unit15개에서 engine import만 prototype으로 바꾸고 count4→1만 고쳐 **15/15 통과**했다. 따라서 green unit만으로 새 검색/화면/보고서가 맞다고 판단할 수 없다. 기존scalar 소비처에 새record를 주면 위치`L –:– · R –:–`, 마지막값/원본행검색false가 실행 재현됐다. 기존report test는 position fixture로 grouped formatter를 검사하지 않는다. 화면filter/검색/더보기·wire·report/ZIP·타입·smoke·visual/a11y에서 내용단언을 추가해야 한다.

새 duplicate 타입은4배열필수/동측길이일치/없는측[]·scalar null/empty를 생성시 검증한다. status narrowing이 실제 소비처에 적용되게 하고 optional필드만 추가하는 방식으로 누락을숨기지 않는다. 새 helper는 corpus/suggestion 타입/취소 의미와 함께 검사한다. inventory의 file군은 충분하나 `workerLifecycle.ts`, `cellText/rowText` 표시규칙, 새분할/감지helper, metadata/전체문자열/경계내용·그룹수와물리행수 분리단언을 보강한다.

## (v) 단계별 완료 게이트 — [보완]

이 절의 명령은 **향후 구현 gate**다. 아래에서 별도 실행표에 없는 명령을 이번 라운드에서 통과했다고 쓰지 않았다. cwd는 해당 구현 사본, NODE_OPTIONS/TMPDIR/cache/strict4390 서버는 공통환경을 따른다. 새단위/스모크 fixture는 기존 test:unit/test:excel-compare에 등록한다.

|단계|실행 명령|끝났다고 판정할 기준/회귀 위험|
|---|---|---|
|S0 선행기준|`git rev-parse HEAD main`; 선행 커밋 `git merge-base --is-ancestor <width-final> main`; 열린계획 scan; main production `BUNDLE_MEASURE_OUTPUT=<baseline> npm run bundle:measure`|선행병합·새SHA·충돌0·비교가능한baseline. branch포인터가 main에이미있는지 actual object ancestry로판정|
|S1 schema/engine/**report**|`./node_modules/.bin/tsc -b`; `npm run test:unit`; `npm run build`; `npm run test:static`|배열/identity/순서/3정책/append취소·분할9/13·Summary/Parameters·한도·source내용·선행writer검증. 공개페이지완료가아니며 S2전까지 배포/병합후보 금지|
|S2 화면|같은type/build/unit/static; production preview후 `npm run test:excel-compare`; `npm run test:excel-cleaner`; `npm run test:qr-bulk`|tail/원본행번호검색·filter·**501그룹의500→501**·같은key다른pair·접기0/50/100·dialog·화면group수·실다운로드·ZIP내용·실패격리·URL수명. 기존 scalar 의존성이 모두 전환돼 S1+2 원자적동작 완성|
|S3 감지|같은type/build/unit/static; production preview후 `npm run test:excel-compare`; `npm run test:excel-cleaner`|22×형식+추가세로병합·userfile4행비게이팅·최초1RPC+header동봉·manualfalse·캐시merge·시트/파일/swap·정수범위/mapping·역전/finally·preabort읽기0/worker0·terminate. O07/O08와 중복3정책 회귀동시통과|
|S4 통합|아래전체명령|production/QA구분·모든scope·bundle예산·결과visual/a11y·Gemini직접시각검수. 이게 main push의입력|

```bash
# S4 production, 브라우저 시작 전
unset VITE_LOCAL_QA
./node_modules/.bin/tsc -b
npm run build
npm run test:unit
npm run test:static
npm run css:orphans
node tests/tool-registry-routes.mjs
# bundle:measure가 자체빌드하므로 browser 종료 상태에서만
BUNDLE_BASELINE=<S0-baseline.json> BUNDLE_MEASURE_OUTPUT=<after.json> npm run bundle:measure
# 위 산출물로 strict4390 preview 기동 → 각각 직렬
npm run test:excel-compare
npm run test:excel-cleaner
npm run test:qr-bulk
npm run test:browser
# preview와 browser 모두 종료
VITE_LOCAL_QA=1 npm run build
# QA strict4390 preview 기동. 아래두신규scenario ID를 구현단계에서등록
VISUAL_ONLY=excel-compare-empty,excel-compare-duplicates,excel-compare-header-suggestion \
  VISUAL_CONCURRENCY=1 npm run test:visual
A11Y_REPORT_PATH=<a11y.json> A11Y_MAX_TOTAL=0 npm run test:a11y
# 기존영향범위/정본이전체visual을요구하면 전체명령도 실행
npm run test:visual
# Gemini: QA결과 상태8조합을 직접 육안판정; Codex실측교차
# 서버종료후 구현checkout에서
 git diff --check
```

placeholder 경로는 S0에서 구체적인 절대 경로로 고정한다. 신규 scenario ID는 정본 지시대로 등록한 뒤 실행하고 알 수 없는 필터의 0건을 통과로 취급하지 않는다. 화면 필터 500개 시험은 이번 100k 단일 그룹 브라우저 시험과 다르다. 이번에는 501개 배열의 기존 slice 동작을 분리 확인했으나 실제 제품 501그룹 e2e는 구현 gate다. 같은 이유로 표적 unit 49개 통과를 S2/S3 전체 완료로 세지 않는다.

## (vi) 잔여·규칙·종결

|잔여|필요한 Claude 판정|해소 문안|
|---|---|---|
|R2-01 (O04)|반복 Key의 허용 길이를 넘을 때 예외 쌍 실패를 허용할지, 별도 키 분할 계약을 설계할지|AMENDMENTS R2-01: Key초과만쌍실패 권고|
|R2-02 (O04/O02/O03)|목록 16,000 예산·원본 행 조각 표기·CRLF 경계·그룹 경계/Parameters·출력 보존 범위 확정|AMENDMENTS R2-02: 독립목록, r[i/n],32767절대상한+16000목록예산|
|R2-03 (O06/O09)|비병합 1셀 skip을 문장대로 제한하고 머리글 없는 표의 사용자 영향을 명시할지|AMENDMENTS R2-03: !vertical조건·추가fixture·범위/지원안내|

세부사항을 여러 번호로 늘리지 않고 **정본에 대해 추가 판정이 필요한 3계약**으로 셌다. 소비처 줄 정정·스모크 보강·단계 명령은 기존 수용의 구체화이고 별도 이견 숫자로 추가하지 않았다. 프로토타입이 성공했다는 사실을 Claude가 새 정책을 수용했다는 뜻으로 바꾸지 않는다.

규칙 4: ko/en/features와 guide/FAQ, 관련 SEO/tools/정적 생성 입력을 함께 갱신한다. URL/canonical/hreflang/sitemap 집합은 그대로이고 새 광고 예외/서버 전제 경로는 없다. 규칙 5: displayKey는 원본 표시용이고 내부 identity/reason/error/광고 격리 상태는 사용자에게 출력하지 않는다. 실행 확장자 전체 재귀 검색과 명시적 최소 예외로 최종 검사한다. Parameters의 계약명은 기존 보고서 metadata 계약이며 이를 UI 오류로 노출하지 않는다. 규칙 19: 추적을 제외한 로컬 QA **결과 상태**를 Gemini가 직접 검수하고 Codex가 실측 교차해야 한다. 이번 독립 프로토타입을 제품 디자인 완성·NVDA/VoiceOver 음성 청취·Gemini 검수로 대체하지 않는다.

**정본화 가능 선언 보류.** 세 잔여의 Claude 판정·단일 정본 통합 후 이견 0을 재확인해야 한다. 이견 0이 되어도 **excel-report-width-20260907 main 병합 후 새 최종 기준 SHA 기입 및 실행 게이트 재검사**가 착수 조건이다.

## 실제 실행한 검증과 한계

|실행|결과|증거|
|---|---|---|
|표적6파일+엔진전환unit|49/49, fail0|logs/unit-targeted.log|
|사본 `./node_modules/.bin/tsc -b`|exit0, 출력0B|logs/tsc.log|
|report-probe|8경계/목록군,18정책조합,10k/100k측정,취소 및키한도 음성|logs/report.json|
|header-probe|22×6=132파싱, 의미오판/CSV차이 명시|logs/headers.json|
|normative detector|기존22동일,추가세로병합uncertain|logs/header-normative.json|
|prototype Vite build|59모듈,exit0 (최종16k7~9초)|logs/prototype-build*.log|
|브라우저32767/16000|각100k·실다운로드/ZIP재개방·8UI조합axe0·overflow0·외부요청0|logs/browser-32767.json, browser.json|
|LibreOffice|명시반례재현,16k동일입력차이0|logs/lo-variant-results.json, lo-xml.json|
|199문장대조·재귀소비처검색|완료|SENTENCE-CROSSCHECK.md, logs/consumers.txt|

이번 **계획 반박**에서는 제품 `npm run build`, 전체 `test:unit`, 제품 `test:excel-compare`/cleaner/QR/browser 전체, production `test:static`, 전체 visual/a11y, bundle:measure를 실행하지 않았다. 위 Vite build는 독립 프로토타입이고 제품 build 통과를 대신하지 않는다. tsc와 표적 unit은 원 main 사본/파생 engine에 대한 검증이다. 구현 완료 명령은 (v)에 명시했으며 실행 전 통과로 기록하지 않았다.

초기 하네스 실패도 보존했다: SheetJS 빈 셀 표현(배열 holes/빈 문자열)의 차이, CRLF 정규화 차이, Node ZIP encoding 손상, 독립 시안 다크 링크 대비 1건이다. 표현 차이는 독립 값/원시 XML 대조로 확인했고 실손상/호환 반례는 통과로 덮지 않았다. LibreOffice의 javaldx/dconf 경고(쓰기 금지된 시스템 설정 경로)는 원로그에 보존했다. 변환 프로세스는 exit 0이고 검사 산출은 전부 r2에 있다.


## 종료 직전 추가 교차 확인

**CRLF 조각 경계**도 별도 확인했다. 16,000 목록 예산에서 CR/LF 사이를 나누면 각 셀의 XML 정규화 뒤 합친 값이 `…\n\nend`가 되어 원래 `…\nend`와 달라졌다. `final-boundaries.mjs`가 이를 음성 대조로 재현한다. CR/LF 사이도 surrogate pair처럼 한 code unit 앞에서 끊는 `chunks-crlf-safe.mjs`는 원문 재접합·정규화 후 재접합 모두 통과했다(`logs/crlf-safe.json`). 원래 브라우저 100k 표본에는 CRLF가 없어 그 실행 결과를 CRLF까지 검증한 것으로 확대하지 않는다. 이 마지막 경계 수정은 순수 함수 시험이며 브라우저 앱에 다시 통합 빌드한 결과라고 주장하지 않는다. 정본 문안 R2-02에 포함했다.

같은 시험에서 숫자 1과 문자열 "1"의 중복 그룹은 내부 key가 다르지만 displayKey가 모두 "1"임을 실제 엔진으로 확인했다. 그룹 순번/보고서 행 구간이 필요한 근거다. 목록 예산 16,000/16,001, 절대 경계 32,767/32,768, 100,003 입력도 무잘림 재접합을 통과했다. 여러 줄 Key도 LibreOffice 반례의 영향을 받으므로 R2-01의 허용 길이는 **단일 줄 32,767 / CR·LF가 있는 Key 16,000**으로 구체화했다. 긴 값을 가진 모든 그룹을 실패시키는 정책으로 확대하지 않는다.

**선행 width가 조사 도중 갱신됐다.** 종료 시 ref는 `64af7b3697ee77c0059ff64d300526a01b4f86c5`. ac9 대비 writer 자체는 같지만 reportIntegrity와 공용 assertion이 `xlsxReportDataRows.mjs/.d.mts`를 추가해 실제 값이 있는 데이터 행을 세도록 강화됐다. git 객체에서 최신 파일을 별도 probes로 꺼내 **이미 실제 다운로드한 두 안의 XLSX와 ZIP 내부 4개 XLSX, 긴 Key 음성 파일 총 7개**를 다시 검증했다.

```bash
node --experimental-strip-types /tmp/worklazy-xc-r2/probes/final-width-check.mjs
```

출력: 모두9시트·유효열95개, 가시성 helper의 전체 데이터행은32767안255/16k안459(이는 Summary/Parameters까지 포함한 수이고 Duplicates195/399와 다름). NaN 너비 음성은 `REPORT_INTEGRITY_FAILED`로 거부했다. Duplicates 내용만 제거한 파일은 Summary/Parameters 때문에 여전히 생성검사를 통과했고, Key40003도 통과했다. **최신 선행 검사 역시 내용 전체 동일성 단언을 대신하지 않는다.** 결과는 `logs/final-width.json`; 다음 정본의 소비처 목록에 새 `.mjs/.d.mts`도 포함해야 한다. 이 최신 gate 재검사는 Node에서 실제 브라우저 산출물을 검증한 것이며 worker bundle을 최신 validator로 재빌드했다는 뜻은 아니다.

## 원 저장소 보존·기준 해시 최종 기록

`probes/snapshot.py`의 시작/종료 status와 추적 파일 SHA를 `logs/source-start.json`, `source-end.json`, `invariance.json`에 보관했다. **시작부터 추적되던 2,587개 파일의 내용 SHA는 전부 동일**했다. 원 branch는 s3-pdf-finish로 그대로였지만 HEAD는 `c8bff1f…`에서 `ff0452b3ad171bfba920f41ec0789612e5ec2001`로 바뀌었고, 기존에 미추적이던 PDF의 `src/features/pdf-editor/outputName.ts`가 추적되어 2,588개가 됐다. git status도 기존 변경 파일들이 사라진 상태로 바뀌었다. 이 세션은 원 파일 수정·add·commit·push·checkout을 하지 않았으며 상태 변화를 되돌리지 않았다. 따라서 **저장소 전체 git 상태 불변이라고 주장하지 않는다**.

main도 조사 중 문서 비교 병합으로 `cdb4007faea277ffc3ae9f3f7f4fe6fd8b8ba7be`로 이동했다. 최신 width64af 및 이전ac9에 대한 `git merge-base --is-ancestor <width> main`은 각각 exit1: **선행 열 너비의 main 병합은 아직 확인되지 않았다.** `logs/final-gate.json`에 출력/변경 파일군을 기록했다. 이번 본체 prototype의 기준은 끝까지 지정된5bc6854이고, 새main 전체를 다시 감사한 것으로 포장하지 않는다. 구현 착수 때 최종main·width병합·공유파일 충돌을 새 기준으로 재검사해야 한다.

**잔여 이견 3건. 정본화·착수 보류.** 세 판정이 해결된 뒤 정본화 가능 여부를 다시 선언할 수 있다.
