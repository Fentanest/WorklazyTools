# Excel 비교 중복키·머리글 정본 v3 — 확인 라운드 3차

**Codx · 2026-09-07 · 잔여 이견 0건. Claude–Codex 간 이견 0 · [정본화 가능]**

판정 대상은 `docs/jobs/todo/excel-compare-dupkey-header-20260907.md`의 **「정본화 (2026-09-07 15:25, v3)」** 및 그 절이 채택한 첨부다. R2-01~03 전건 수용은 정확하고, S0~S4 및 S1+S2 전환 단위가 반영됐다. **이 선언은 현재 v3 문안에 대한 합의 확인이다. 구현 착수는 선행 `excel-report-width-20260907` main 병합 후 S0의 최종 SHA·실행 게이트·production bundle baseline을 확정한 정본으로 디스패치할 때 가능하다.** 이번에는 구현하지 않았다.

|확인 항목|판정|결과|
|---|---|---|
|1. R2-01~03 반영 정확성|[반영 확인]|R2 원문 41개 문단/항목, 146개 문장·문장 조각 대조. 누락·정책 왜곡 0. 첨부에 남은 세부 계약도 포함|
|2. 단계 S0~S4|[반영 확인]|기준 갱신→스키마/엔진/보고서→화면→감지→최종 통합. 단계별 회귀·S1+S2 단일 전환·S1 단독 병합/배포 금지|
|3. 첨부 채택·실존·SHA|[반영 확인]|v3 119행에 요구된 5개 첨부군 채택. 관련 문서·증거 사본 **48/48 SHA-256 일치**|
|4. sol 잔여 재해석|[반영 확인]|새 정책 판정이 필요한 지점 **0**. 요약과 원문·과거 이력을 함께 읽을 때 적용 계약이 하나로 정해짐|
|5. 착수 조건·main 이동|[반영 확인] / [보완: 기준 현행화]|절차 실행 가능. `main=cdb4007`, width=`64af7b3`, width ancestry **exit 1**로 아직 착수 조건 미충족|
|6. 최종 선언|[반영 확인]|**Claude–Codex 간 이견 0 · [정본화 가능]**, 위 선행 병합·S0 조건부|

## 1. R2 문장별 반영

대조 원문·각 문장의 위치·판정 근거는 [SENTENCE-CROSSCHECK.md](SENTENCE-CROSSCHECK.md)에 있다. 문장 분할 자동화는 누락 없는 열거와 명시 토큰 검사를 맡으며, 의미 판정은 v3 본문 및 첨부를 직접 읽고 수행했다. `정본화 v3 > v2 반영 > v1 본문`, **“요약은 원문을 대체하지 않는다”**는 v3 119행을 적용했다. 따라서 요약에 반복되지 않은 첨부 문장을 미반영으로 세지 않았다.

### R2-01 — [반영 확인]

- v3 122행: 전 문자열 셀의 **32,767 UTF-16 code unit** 절대 상한, 일반 목록의 그룹별 분할, **반복 displayKey 자체 초과일 때만 이 계약의 예외 쌍 실패**를 유지했다. 기존 파싱·무결성 등 다른 실패 사유를 없앤다는 뜻이 아니다.
- Key 한도는 **단일 줄 32,767 / CR 또는 LF 포함 16,000**. 잘림·대체 키 금지, 실패 쌍의 화면 성공 목록·개별 다운로드·ZIP 제외, 다른 쌍 진행, 보고서 검증 후 결과 공개가 모두 일치한다.
- 요약에 없는 `DUPLICATE_KEY_TOO_LONG`과 정확한 ko/en 사용자 문구는 채택된 `round-2-AMENDMENTS.md:9`에 있다. 구 O04의 `DUPLICATE_GROUP_TOO_LARGE` 및 모든 긴 그룹 쌍 실패 문구는 v3 대체 계약에 의해 적용되지 않는다.

### R2-02 — [반영 확인]

- v3 125~132행: 화면 키당 한 record와 scalar null/empty, 전체 배열, summary 그룹 수를 보존한다. 보고서 분할 객체를 UI records에 넣지 않는다. `displayKey`는 기존 `cellText`를 선택 키 열 순서대로 ` | `로 연결하며 첫 좌측 행/없으면 첫 우측 행을 사용한다. 같은 표시 문자열도 별개 내부 identity일 수 있다.
- **좌우 각각 행번호 셀과 값 셀 16,000 이하**, 접두사·`, `·LF 포함 탐욕 채움, 좌우 독립 분할·최대 조각 수만큼 출력·소진 측 빈칸, 긴 한 원본 행은 전용 조각으로 다른 원본 행과 혼합 금지가 일치한다.
- `r [i/n]`은 원본 r행 한 건의 부분 i/n이다. 값 셀은 매번 `r: `를 붙이며 반복 r을 추가 건수로 세지 않는다. surrogate pair 및 CRLF 사이에서 나누지 않고 한 code unit 앞에서 분할한다. 순차 처리·4,096행 이내/긴 한 행 조각별 취소·추가 입력 전체 사본 금지도 유지된다.
- 모든 조각의 Key/Change/Reason/문맥 4열 반복, `writeUntrustedText`, 9시트·13열 이름/순서 불변, 무손실의 범위를 행/값 누락·순서 변형·잘림 없음으로 한정한 계약이 동일하다. CR/LF 바이트 동일성까지 보장하지 않는다.
- **Parameters 열거 10항목은 고정 9항목 + 가변 그룹 구간 항목군**이다. 총 물리행이 언제나 10개라는 뜻이 아니다. `round-2-AMENDMENTS.md:32~43`에서 split=true/false, splitGroupCount=보고서 2행 이상 그룹 수, dataRows=헤더 제외 데이터 행 수, rowNotation 영문 전문까지 확정되어 있다. 비적용 모드/정책은 고정 9값 `UNUSED`·그룹 구간 행 없음, 적용 중 중복 0건은 split=false·그룹/행수=0이다. report builder의 메타데이터이며 엔진 summary/records를 바꾸지 않는다.
- `duplicateReportGroup.<순번>=Duplicates!<시작행>:<끝행>`은 원래 보고서 출력 순서의 그룹 구간이며 재정렬 후 자동 재계산하지 않는다. 그룹 수/분할 행 수·전체 내용/그룹 경계·양측 소진·주입 문자열·한도 경계·실다운로드/ZIP 각각 재개방이 별도 완료 게이트다. 선행 가시성·너비·byteLength·Blob 검사로 내용 검사를 대체하지 않는다.

**16k 근거 재확인:** 보존된 R2 원본/LibreOffice 재저장 XLSX를 이번에 Python ZIP/XML로 다시 읽어 **195행 안의 값 셀 차이 390 → 399행 안의 차이 0**을 확인했다. 16k Node 파일은 **836,331B**이다. v3의 **790,690B**는 브라우저 32,767 예산 다운로드의 정확한 크기다. LibreOffice 입력으로 사용한 Node 동등 목록 파일은 **790,693B**이며 파일명·시트명 문맥 4열이 다르다. E~M의 행번호/값/Key/상태 내용은 완전히 같다. 따라서 측정 경로별 파일 크기를 구분하며 이를 모든 프로그램의 보편적 무손실 보증으로 확대하지 않는다. 원 R2 첨부도 같은 제한을 명시한다.

### R2-03 — [반영 확인]

- v3 135행은 `!verticalMergedRows.has(row)`를 비병합 1셀 제목 skip에 명시했다. 가로 병합 선행 skip, 세로 병합 1셀의 첫 판정 `uncertain`, 원시 value/formula/error 타입, suggested만 정수 row·나머지 null이 단일 해석으로 정해졌다.
- 기존 22개 출력 유지, 의미 오판도 기대표에 표시, **6형식별 실제 adapter 기대표**, **23번째 세로 병합 1셀 접두 회귀**가 136행에 있다. 22개 전부 의미 정답이라는 기준이 아니다. 보존된 132개 형식별 결과는 suggested 12/그중 의미 오판 5·uncertain 8·none 2, CSV만 4패턴 차이로 원문과 일치한다.
- 이번 순수 함수 재실행도 기존 22개 출력 불변 및 추가 사례의 `{row:null,reason:'uncertain'}`을 확인했다. 1차 코드의 해당 사례는 `{row:3,reason:'suggested'}`로 음성 대조가 유지된다.
- uncertain/none 동일 미감지 안내·초기값 1, describedby·polite 1회, manual 후 자동 안내 재적용 금지, 수동 캐시 응답의 suggestion/선택/알림 덮어쓰기 금지가 137행에 있다.
- 138행 **ko/en 지속 안내 전문은 따옴표 모양 외 내용이 정확히 일치**한다. guide/FAQ 반영도 유지된다. 139행 지원 제외 **5항**, 머리글 없는 표의 첫 행 포함 비교 미지원·수동 1로 전 행 보존 약속 금지·headerRow=0/no-header 모드 도입 금지가 정확하다.

## 2. 단계·첨부·잔여 해석

### S0~S4 — [반영 확인]

|단계|v3 위치|반영된 완료 경계|
|---|---|---|
|S0|142행|선행 main 병합 확인→최종 main SHA 기입→열린 계획서 충돌 검사→**그 main**의 production bundle baseline|
|S1|143행|discriminated union/생성기·배열 불변식·append/취소·표시키/집계·분할/Parameters/무결성·같은 단계 unit. engine-only는 제품 공개 완료 아님|
|S2|144행|전체 records 소비처·검색/안정 key/500그룹·0/50/50 추가 목록·dialog·다운로드/ZIP. **S1+S2 한 전환 단위**, S1 단독 병합/배포 금지|
|S3|145행|detector/sample→inspect→client pre-abort/token/cache→파일/시트/swap→ko/en 및 수동/경쟁/취소 시험|
|S4|146행|전 스모크·production static·bundle·QA 결과 visual/a11y·Gemini 직접 시각 검수. S1~S3 회귀를 이 단계까지 미루지 않음|

단계별 실제 명령과 성공 기준은 채택된 R2 AMENDMENTS 73행이 지목하는 **R2 REPORT §(v)**에 있다. 저장소 사본 이름은 `docs/jobs/todo/excel-compare-rounds/round-2-REPORT.md`이다. production과 QA 산출물 분리, 로컬 tsc 실행, bundle 자체 빌드 때 브라우저 종료, 신규 결과 scenario 등록·0개 실행을 통과로 보지 않기, S0에서 placeholder 절대 경로 고정까지 보존된다. 이번 라운드의 순수 함수 검증으로 이 구현 게이트를 통과했다고 보지 않는다.

### 첨부 채택 — [반영 확인]

v3 119행에서 요구된 `round-1-AMENDMENTS`, `round-1-CONSUMER-INVENTORY`, `round-2-AMENDMENTS`, `probes-r1/`, `probes-r2/`를 정본의 일부로 명시 채택했다. 다음 경로를 **실제 원본과 SHA-256 대조**했다.

|저장소 사본군|원본 경로 대응|파일 수 / SHA 일치|
|---|---|---:|
|round-1 REPORT/AMENDMENTS/CONSUMER-INVENTORY|`/tmp/worklazy-xc-r1/{REPORT,CANONICAL-AMENDMENTS,CONSUMER-INVENTORY}.md`|3/3|
|round-2 REPORT/AMENDMENTS/CONSUMER-ADDENDUM/SENTENCE-CROSSCHECK|`/tmp/worklazy-xc-r2/`의 같은 역할 문서|4/4|
|probes-r1/ 증거 사본|`/tmp/worklazy-xc-r1/evidence/`|14/14|
|probes-r2/ 증거·manifest·설정 사본|`/tmp/worklazy-xc-r2/logs/`, 루트 manifest, main의 package/tsconfig 사본|27/27|

합계 **48/48**, 누락·불일치 0. 원본 R2 `MANIFEST.sha256`의 문서/실험 코드 **39개도 모두 실존·SHA 일치**했다. 저장소의 probes 디렉터리는 증거 사본 집합이며 원본 실행 코드 디렉터리 전체의 복제본이라고 주장하지 않는다. 이번에 사용한 원 실행 코드는 허용된 `/tmp/worklazy-xc-r2/probes/`에서 읽어 R3 사본으로 옮겼고 변경은 R3 안의 xlsx import 경로뿐이다.

### 잔여 재해석 — [반영 확인], 0건

이전 제안 문서의 “판정 필요”, “잔여 3건”, 구 O04 쌍 실패, 원래 detector는 **왕복 이력**이다. v3의 명시적 수용/대체와 양립하지 않는 구 지시를 실행 기준으로 다시 선택할 여지는 없다. 본문 요약의 `<r [i/n] 설명>`·`UNUSED`는 채택된 첨부 전문으로 세부 내용이 확정된다. `REPORT.md (v)`는 R2 문서의 원래 이름이며 v3 머리말의 저장소 사본 대응도 명확하다.

소비처 addendum의 줄번호 정정·새 helper 및 회귀 보강은 확인 자료다. v3 S1~S4/첨부에 해당 동작 게이트가 유지되며, 최신 width의 `xlsxReportDataRows.mjs/.d.mts`는 S0에서 보존할 **현행 선행 코드**다. 이 보존을 위해 새로운 제품 정책을 선택할 필요는 없다. 정본 문안 추가를 요구할 잔여 이견은 없다. 이후 구현 중 계획 밖 예외가 발견되면 이미 채택된 규칙대로 “범위 밖 발견”으로 보고한다.

## 3. main 이동 영향·착수 조건

### 기준 해시 — [보완: 현행화 사실 기록]

|역할|실측 SHA|
|---|---|
|v1/R1/R2 본체 조사 기준|`5bc6854175331bdd73b267784d9633cdccda8446`|
|현 main = 로컬 origin/main|`cdb4007faea277ffc3ae9f3f7f4fe6fd8b8ba7be`|
|현 열 너비 branch|`64af7b3697ee77c0059ff64d300526a01b4f86c5`|
|원 HEAD / branch|`ff0452b3ad171bfba920f41ec0789612e5ec2001` / `s3-pdf-finish`|

원 HEAD는 다른 U4 잡의 상태다. 이를 Excel 비교 기준으로 사용하지 않았다. git 객체만 읽어 main/width를 대조했고 fetch·원격 조회는 하지 않았다.

```text
git merge-base --is-ancestor 64af7b3697ee77c0059ff64d300526a01b4f86c5 cdb4007faea277ffc3ae9f3f7f4fe6fd8b8ba7be
exit 1                  # width가 아직 main의 조상이 아님
git merge-base cdb4007faea277ffc3ae9f3f7f4fe6fd8b8ba7be 64af7b3697ee77c0059ff64d300526a01b4f86c5
5bc6854175331bdd73b267784d9633cdccda8446
```

`5bc6854→cdb4007`은 31파일, `5bc6854→64af7b3`은 13파일 변경이며 실제 교집합은 **CHANGELOG.md·docs/review-notes.md 2파일**이다. 자동 병합 충돌 발생 여부까지 이 교집합만으로 단정하지 않는다. 두 작업의 기록을 모두 보존해야 한다. main의 package.json 변경은 `test:document-diff` 추가이며 기존 XC 검증 script를 바꾸지 않았다. XC 핵심·공유 writer/adapter/lifecycle·ko/en features·visual/a11y 등 선정한 Git blob **18/18 SHA 동일**이고 main의 diff에서도 Excel 구현 변경이 없다.

**main 이동 영향 한 줄:** 문서 비교를 배포한 `cdb4007` 위로 최신 width를 병합할 때 현재 직접 겹치는 것은 기록 2파일이고, XC는 width의 worker/validator/shared writer/helper/unit/smoke 변경을 계승하며 **병합 후 최종 main SHA와 production bundle 기준선을 새로 잡아야 한다**.

v2의 ac9cc4a는 이전 선행 실측이다. 최신64af7b3은 값이 있는 데이터 행을 판정하는 `src/utils/xlsxReportDataRows.mjs/.d.mts`와 reportIntegrity/assertion/unit 강화를 포함한다. S0에서 예전 ac9만 확인하거나 worker의 `await assertGeneratedXlsxReport`를 되돌리면 안 된다. width 최종 커밋이 다시 움직이면 최종 커밋을 기준으로 ancestry를 확인한다. `report.ts`는 현재 width 변경 파일이 아니라는 기존 정정도 계속 유효하다.

열린 최상위 작업 문서 **19개**를 다시 스캔했다. U1/X-A/B/C는 선행 계약, width는 선행 병합 의존, PDF/DC/UI의 locale·검증 하네스·기록 공통 표면은 S0에서 최신 작업 상태와 대조할 대상이다. 현재 v3의 중복/감지 정책과 상반되는 새 지시는 발견하지 못했다. UI 정본의 U4 병합 후 기준 갱신 조건도 유지하며, 미병합 UI/PDF 트리의 파일을 이 작업에 가져오지 않는다.

### 착수 절차 — [반영 확인]

1. 최종 `excel-report-width-20260907`가 main에 병합됐는지 실제 commit ancestry로 확인한다.
2. **분리된 XC 작업 위치에서** S0를 수행한다: 최종 main SHA 기입, 기준 해시/열린 계획 충돌 검사, 동일 main의 production bundle baseline와 산출물 절대 경로 확정. U4/DC/XR 트리 사용 금지.
3. S0 후 최종 정본에도 이번 **이견 0** 판정이 유효한지 확인한다. S0에서 계약 변경이나 충돌을 발견하면 그 차이를 astra 확인에 반영한다. 이번 선언이 미래 기준 변경을 자동 승인하지는 않는다.
4. 그 정본으로 sol을 S1부터 디스패치하고 단계마다 astra 검수, **S1+S2는 한 제품 전환 단위**로 다룬다. 최종 배포 입력은 S4 전체 검증과 Gemini 직접 시각 검수다.

현재는 1번이 미완료다. 이번 확인은 문서 합의를 확정하며 S0 실행·구현 착수·병합·배포를 수행하거나 면제하지 않는다.

## 4. 실제 실행·저장소 보존

|실행 명령|실제 결과|증거|
|---|---|---|
|`python3 /tmp/worklazy-xc-r3/audit.py start`|tracked 2,588개 시작 SHA·status/refs 기록|logs/source-start.json|
|`python3 /tmp/worklazy-xc-r3/audit.py attachments`|48/48 원본 SHA 일치|logs/attachment-sha256.json|
|`python3 /tmp/worklazy-xc-r3/audit.py gates`|main/width diff·ancestry 및 열린 19문서 확인|logs/gates.json, main.diff, open-plans.txt|
|`python3 /tmp/worklazy-xc-r3/crosscheck.py`|41문단/항목·146문장 조각, 미대응 0, 명시 계약 검사 전부 true|SENTENCE-CROSSCHECK.md, logs/sentence-crosscheck.json|
|`NODE_COMPILE_CACHE=/tmp/worklazy-xc-r3/node-cache NODE_OPTIONS=--max-old-space-size=4096 node /tmp/worklazy-xc-r3/light-probes.mjs`|기존22+추가1, 목록 5경계, surrogate/CRLF 3표본, 긴 한 행 독립 조각·취소 전부 통과|logs/light-probes.json|
|`python3 /tmp/worklazy-xc-r3/xml-evidence.py`|보존 XLSX 독립 ZIP/XML 재개방: 390→0·195/399행·790690/836331B 출처 확인|logs/evidence-recheck.json|
|Git blob 18개 SHA 대조 / R2 원 manifest 확인|18/18 불변·39/39 일치|logs/main-excel-surface-sha256.json, r2-original-manifest-check.json|
|`python3 /tmp/worklazy-xc-r3/audit.py end`|종료 status·refs·tracked SHA·검토 문서 SHA 비교|logs/source-end.json, invariance.json|

XML 대조의 초기 과도한 단언은 실패했다: 브라우저/Node의 **전체** Duplicates 셀을 동일하다고 검사했으나 A~D 문맥 780셀이 달랐다(`L.csv`/`L.xlsx` 등). `logs/xml-initial-assertion.json`에 실패와 차이를 보존했다. 파일명/시트명을 동일 입력이라고 보지 않고 E~M payload의 정확 일치와 각 파일 자신의 LibreOffice 왕복을 각각 검사한 뒤 통과했다. 내용을 잘라 비교하거나 390개 실손상을 무시한 것이 아니다.

제품 build·전체 unit/smoke/static·bundle·브라우저·LibreOffice 새 변환은 실행하지 않았다. R3 함수 검증은 허용된 R2 실험 코드 사본의 경계·감지 규칙 확인이며, 아직 완성되지 않은 v3의 guard/Parameters/UI 통합 구현 통과로 기록하지 않는다. 132개 형식 재파싱과 LibreOffice 실행 자체는 R2 보존 증거를 재사용했다. 새 산출물은 `/tmp/worklazy-xc-r3/`에만 있다. 저장소 추적 파일 수정·commit·push·branch 전환·다른 잡 트리 사용은 하지 않았다. 읽은 원 추적 파일은 SHA/상태 보존 측정 및 지정 문서 확인 용도이며, 소스 대조는 Git 객체로 수행했다.

**종료 불변 확인:** 시작/종료 `git status`, branch, HEAD/main/origin/main/width refs가 모두 동일하다. 시작부터 추적된 **2,588개 파일 SHA 전부 동일**, 추적 추가 0, 검토한 정본·첨부 SHA 변경 0이다(`logs/invariance.json`).

**잔여 이견 0건. Claude–Codex 간 이견 0 · [정본화 가능]**

**착수는 선행 `excel-report-width-20260907` main 병합 후, S0로 최종 기준 SHA·실행 게이트·production bundle baseline을 확정하고 이견 0을 유지한 정본으로 sol S1 디스패치할 때 가능하다.**
