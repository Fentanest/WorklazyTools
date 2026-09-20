**[수정 후 재검수] — R4-numFmt는 해소됐다. 그러나 fix-5의 `includeEmpty` 순회가 지원되는 희소 XLSX의 빈 좌표를 실제 Cell/Row 객체로 채우면서 출력 시간·메모리를 크게 늘리는 새 회귀 R5-sparse-backstop(P2)를 재현했다. 현재 배포 후보 승인은 보류한다.** — Codx, 2026-09-07

대상은 `/tmp/worklazy-xr`, 브랜치 `excel-report-width-20260907`, HEAD `8b5b50557615737dc61b9e0b5c47cb38a536cb87`이다. 필수 공통 규칙·AGENTS·5차/4차 보고·fix-5/6차 지시 전문·sol 보고 및 로그·mutant·기록을 대조했다. 열린 작업 문서는 완료 상태의 X-A 실행 사본 하나이며 상반된 실행 지시는 없다. [시작 상태](start-state.json), [실행 게이트](logs/open-plan-gate.log), [계보](logs/ancestry.log).

검증은 `git archive 8b5b505`를 푼 [source/](source/)에서 수행했다. archive SHA-256은 `dfa0432a4f714e0e76b306221ab0ab357437802164bf4f183bea2af33304b2b0`이다. 대상에서 의존성·vendor를 복사했고 새 설치는 하지 않았다. unit의 `git ls-files`를 위한 별도 index/metadata만 검수 디렉터리에 만들었다. [준비 코드](probes/setup.py), [준비 출력](logs/setup.log).

아래 명령은 별도 표시가 없으면 `cd /tmp/worklazy-xr-review6/source` 후 `source ../env.sh` 환경이다. `NODE_OPTIONS=--max-old-space-size=4096`, 전용 TMPDIR/cache, TEST_SCOPE 미설정을 고정했다. preview는 `npm run preview -- --host 127.0.0.1 --port 4380 --strictPort`, QR 보조 proxy는 4381이다. build·각 브라우저 묶음·bundle 내부 build·추가 희소 비용/브라우저 실험은 서로 겹치지 않게 실행했다. [명령·exit·시간](checks.jsonl), [환경](env.sh), [최종 포트 닫힘](logs/ports-final.json).

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| R4 원본 안전 probe | **해소** | `python3 ../probes/run-original.py 5 style-safety-counterexamples.mts --test`: 원본 무수정 **2/2 pass**. [TAP](logs/original-style.log) | 없음. |
| R4 parser→정리→출력 | **통과** | `run-original.py 5 style-boundary.mts`: BIFF8 **3,584B** 2건, 원문 서식 보존 확인 후 출력 **10,306B**, **unsafeStylesXml=false**, ExcelJS error null. 별도 ElementTree가 숫자 **123**과 `0"A�B"`를 단언. [원본 실행](logs/original-style-boundary.log), [XML 검사](logs/xml-style-check.json) | 없음. |
| R4 실제 브라우저 | **통과** | `style-browser.mjs` 2건, 독립 `style-playwright.mjs` **ko/en×FFFE/FFFF 4건**, 실제 다운로드 모두 **10,379B·123·`0"A�B"`**. 각 파일의 모든 XML/rels를 ElementTree로 재개방. [Playwright](logs/style-playwright.json), [브라우저](logs/style-browser.json), [독립 XML](logs/xml-style-check.log) | 없음. LO exit 0을 well-formed 판정의 단독 근거로 쓰지 않았다. |
| 동일 필드 우회 전수 | **numFmt 출력 대입 누락 없음 / sol의 조사 설명은 보충 필요** | 저장소 전체 실행 확장자 검색으로 세 소비처의 출력 진입점과 대입을 역추적. 정리 두 대입·공용 `@`·비교용 읽기 외 추가 numFmt 출력 대입 없음. 입력 글꼴·색·테두리는 실제 복사되지만, 해당 XML 금지 문자 10건은 입력 파서에서 거부. [전체 검색](logs/repo-string-boundary-inventory.log), [독립 도달성 실험](logs/reachable-style-fields.json) | “모든 스타일 문자열에 입력 유래 경로가 없다”로 확대하지 말 것. 아래 필드별 결론을 기록에 보충. 새 sanitizer 확대는 요구하지 않음. |
| backstop 기능 범위 | **통과** | `backstop-cost.mts`: 값 없는 cell.numFmt/style.numFmt, 비어 있는 행, 희소 마지막 열, 행/열 상속을 가진 실제 셀 **6/6**, 기존 코드 하나·serializer 호출 **0**. fix-4 검사는 모두 놓침. 기존 이름/value 6건도 통과. [새 주입](logs/backstop-cost.json), [기존 주입](logs/backstop-injections.json) | 서식 전용 셀 검출은 유지하면서 아래 순회 부작용을 수리. |
| 안전 오류 사용자 노출 | **통과** | production worker 응답을 가로채 직렬화 직전 **M50.numFmt**에 금지 문자 주입. ko/en 모두 `REPORT_INTEGRITY_FAILED` 한 건·현지화 안전 안내·다운로드 **0**. 기존 폭/value 주입도 통과. [numFmt](logs/worker-numfmt-error.log), [value](logs/worker-backstop-error.log), [폭](logs/worker-safe-error.log) | 원시 예외나 내부 명칭을 사용자에게 추가하지 말 것. |
| **backstop 희소 입력 비용** | **P2 / R5-sparse-backstop / 차단** | 실제 parser→preflight→engine→writer, **43,165B** 파일, 경고 없음: fix-4 출력 **209ms**, fix-5 **6,485/9,218/6,568ms**. **166,209B** 파일은 fix-4 **675ms**·재개방 완료, fix-5는 출력 단계 **60초 제한 초과**. [실험](logs/sparse-suite.json), [반복](logs/sparse-repeat.json), [실측 상세](logs/sparse-measurements.json) | `includeEmpty`의 `getRow/getCell` 기반 생성 순회를 부작용 없는 조회로 교체. 아래 구체 수리 문안 참조. |
| 문자 보존 | **통과** | 원본 문자 probe **1,114,112/1,114,112**. 별도 BIFF8 서식 6종과 sanitizer 표본에서 FDD0~FDEF 32개·유효 쌍·CR·정상 한글/통화/서식 문자 유지, 짝 없는 서로게이트만 U+FFFD. [원본](logs/characters.log), [별도 서식](logs/format-preservation.json), [XML](logs/xml-style-check.json) | 불필요한 문자 치환 금지. CR/backslash 정규화는 아래처럼 구분. |
| 세 reader | **통과** | CSV 32개·시트명/정리 표본 포함 **34 workbook**, ExcelJS 및 ElementTree 모든 XML·70개 지정 셀 검사, LO XLSX 재저장 후 전체 시트명/지정 셀 유지. QR 1개도 별도 3중 재개방·2셀 단언. [34개](logs/three-readers.json), [QR](logs/qr-three-readers.json) | 없음. |
| fix-4 mutant | **검출력 통과** | fix-4 `xlsxReport.ts`와 cleaner `output.ts` 두 파일만 read-only bind한 원본 R4 probe **0/2**, 모두 `disallowed character`. [원출력](logs/style-mutant.log) | R4 회귀 검출력 유지. |
| 원본 R1/조합/요소/문자/R3 | **통과** | 무수정 원본 **2/2·2/2·5/5·32/32·2/2**, 2차 R1 동일 사본도 **2/2**. [실행 목록](logs/regression-suite.log), [원본 SHA](logs/original-probe-sha256.json) | 없음. |
| 독립 확장·추가 경계 | **통과** | 독립 **2,880/2,880**. 추가 126건 중 기대값 단언 72·범위 밖 관찰 54, 잘못된 참조 거부 **40/40**, 실제 writer **29/29** 재개방 및 XML 정상. [확장](logs/independent-expanded.log), [경계](logs/new-boundaries.log), [ElementTree](logs/boundaries-elementtree.log) | 없음. |
| 기존 CDATA oracle 한계 | **동일 / 비차단** | 원본 3차 행렬은 실제 **2,764/2,880, exit 1**. 116건은 ExcelJS의 CDATA 문자 누락. 독립 ElementTree 의미 검사 **192/192**, scanner 불일치 0. [원본](logs/legacy-matrix.log), [교차](logs/legacy-cdata-semantic.log) | 원본 행렬까지 100% 통과했다고 기록하지 말 것. |
| 지정 음성/양성·폭·대량 | **통과** | 음성 **6/6**, 양성 **4/4**, 폭 **[12,13,47,48,48]**. 50,000/150,000행 생성 **948/2,520ms**, 검사 **64/112ms**, RangeError 0. [음양성](logs/data-row-required.log), [core](logs/core.log) | 없음. |
| 9시트·13열·토폴로지·소비처 | **통과** | 조기 데이터 탐지·뒤 시트 잘못된 폭·`REPORT_TOPOLOGY_INVALID` 유지. 다운로드 고유 XLSX **11개(비교 4·정리 6·QR 1)**의 전 열 폭·헤더·순서 단언. [토폴로지](logs/early-exit-topology.log), [소비처](logs/consumer-xml.json) | 없음. QR 실행 횟수 차이로 5차의 13개와 수량이 다름. |
| scanner/reference 종료성 | **기존 표본 통과** | **60/60·32/32**, 각 10초 제한, timeout/RangeError 없음. [scanner](logs/scanner-cost.log), [reference](logs/reference-cost.log) | 이 결과를 새 희소 writer 출력 60초 초과까지 통과한 것으로 확대하지 말 것. |
| 사용자 파일 재실측 | **통과** | 기존 안전 사본 SHA 일치, **713/37/48/4**, **9시트·856행·95열·68 col 태그·폭 12~48**, 잘못된 폭 0. 출력 **54,122B**; LO Summary **99B·9행**, 수치 일치. [재생성](logs/user-files.log), [XML](logs/user-xml-independent.json), [LO](logs/user-lo.log) | 없음. 사용자 신고 파일에 R5 조건이 있다는 뜻은 아님. |
| sol의 두 하네스 사고 | **제품 결함 아님** | 선행 fixture 없음 **3/3 ENOENT**, 준비 후 같은 원본 **3/3 통과**. `/tmp` read-only **3/3 no valid pipe path**, 쓰기 가능한 전용 `/tmp`에서 **3/3 통과·123 유지**. [재현율·상세](logs/harness-incidents.json) | 실행 의존순서와 LO 파이프 경로 문제로 기록. 제품 수정 불필요. |
| 범위·기록 | **코드 범위와 R4 기록 통과 / 비용 기록 보완 필요** | **7파일 +129/−9**, 서식·backstop·회귀·기록만. parser/엔진/9시트/QR UI·스모크/의존성 등 **12개 blob 동일**, 폭 함수 바이트 동일. [범위](logs/scope.json), [diff](logs/diff-full.log) | R4는 기존 결함, R5는 fix-5 회귀로 구분. 밀집 비용만으로 희소 비용까지 동급이라고 결론내리지 말 것. |

**R5-sparse-backstop의 재현과 심각도.** [xlsxReport.ts 90행](source/src/utils/xlsxReport.ts:90)의 `worksheet.eachRow({includeEmpty:true})`는 ExcelJS 내부에서 매 좌표에 `getRow`를 호출하고, [92행](source/src/utils/xlsxReport.ts:92)의 `row.eachCell({includeEmpty:true})`는 `getCell`을 호출한다. 두 메서드는 없는 객체를 만든다. 검사 종료 후에도 그 객체가 workbook에 남아 직렬화 순회 비용까지 커진다. [설치본 동작 근거](logs/exceljs-iteration-source.log).

새 fixture는 ExcelJS 정식 writer로 만든 유효 XLSX다. 512개 고유 헤더를 두고 데이터 각 행의 **SR열 한 셀만** 채웠다. ZIP/XML 수작업 변조, 파싱 후 모델 주입, 원 워킹트리 파일 접근은 없다. 실제 제품 parser→preflight→`createCleanerSheetModels(...,{consumeSource:true})`→빈 규칙 engine→`buildExcelCleanerOutputs`를 실행했다. 성공 산출물은 ExcelJS로 5시트·마지막 값 단언, ElementTree로 모든 XML과 실제 셀 수를 확인했다. [재현 코드](probes/sparse-cleaner.mts), [독립 XML](logs/sparse-xml.json).

| 동일 입력 / 동일 4GiB Node heap 설정 | 출력 단계 시간 | 출력 직후 max RSS (KiB) | 결과 |
|---|---:|---:|---|
| 3,900 데이터행×512열, **43,165B**, 실제 입력 **4,412셀**, 논리 **1,997,312셀**, fix-4 두 파일 | 208.6ms | 217,736 | 5시트·마지막 값 3,901 재개방 |
| 같은 입력, fix-5 첫 실행 | 6,485.2ms | 871,540 | 정상 출력되지만 약 **31.1배** 느림 |
| 같은 입력, fix-5 반복 1 | 9,217.9ms | 2,560,976 | 정상 출력, 같은 지연 재현 |
| 같은 입력, fix-5 반복 2 | 6,567.6ms | 889,432 | 정상 출력, 같은 지연 재현 |
| fix-5 cleaner 유지, **backstop 파일만** fix-4로 복원, 반복 1/2 | 267.3 / 242.5ms | 184,564 / 186,760 | 지연 해소; R4 수리의 style 복사 변경은 원인 아님 |
| 19,000 데이터행×512열, **166,209B**, 실제 입력 **19,512셀**, 논리 **9,728,512셀**, fix-4 두 파일 | 675.5ms | 529,632 | 5시트·마지막 값 19,001 재개방 |
| 같은 큰 입력, fix-5 | **출력 단계 60초 안에 미완료** | 완료 지점 실측 없음 | 실행 하네스가 제한 초과로 종료 |

첫 입력은 **soft limit 2,000,000 아래이며 preflight warnings=[]**다. 큰 입력도 hard limit 10,000,000 아래로, `LARGE_FILE` 경고만 있고 거부되지 않는다. fix-5 작은 표본은 **3/3 출력 지연**, 이전 두 파일 대조 **1/1** 및 backstop 단독 복원 **2/2**에서 빠르게 완료했다. 큰 표본의 제한 초과는 **1/1**이며 무한 루프나 OOM을 확정한 것은 아니다. RSS는 각 프로세스의 파싱 등을 포함한 최대값으로, backstop만의 할당량이 아니다. 반복 1의 높은 RSS도 버리지 않고 기록했다. [초기 대조](logs/sparse-suite.json), [단일 파일 복원 대조](logs/sparse-repeat.json), [단계별 원출력 집계](logs/sparse-measurements.json).

Playwright로 동일 **43KB 입력**을 실제 한국어 정리 화면에 넣었을 때도 검사 경고 없이 실행되어 클릭→완료 **5,370ms**, 처리 로그 약 **5.0초**, 다운로드 **47,342B**, 5시트·SR3901=3,901을 재현했다. [브라우저 로그](logs/sparse-browser.json), [실제 다운로드](artifacts/sparse-browser.xlsx), [화면](artifacts/sparse-browser.png). 브라우저에서 fix-4를 별도 빌드해 시간 비교하거나 큰 표본을 실행한 것은 아니다.

따라서 R5는 잘못된 임의 XML의 비차단 한계가 아니며 **지원 입력→우리 writer에서 fix-5가 새로 만든 비용 회귀(P2)**다. 작은 결과 파일에서 상당한 처리 지연·메모리 증가가 생기고, 지원 상한 안의 큰 표본은 이전 버전이 즉시 완료하는 동안 60초를 넘었다. R4의 malformed 산출은 고쳐졌고, 이번 작은 희소 출력도 XML·값이 정상이다. 파일 손상이나 모든 입력 실패로 심각도를 과장하지 않는다.

**R5 수정 지시 문안.** 후속 정본에서 `src/utils/xlsxReport.ts`의 backstop 순회와 해당 회귀·기록만 좁게 허용한다. **값 없는 서식 셀은 검사하면서 존재하지 않는 행·셀을 만들지 않는 조회 순회로 바꿀 것.** 설치된 ExcelJS 공개 API의 `worksheet.rowCount`/`worksheet.findRow(n)`, `row.cellCount`/`row.findCell(n)`은 빈 좌표를 생성하지 않고 조회할 수 있다. 이 방식 또는 동등한 부작용 없는 순회를 사용하고, 단순히 `includeEmpty:false`로 되돌려 서식 전용 행·셀을 다시 놓치지 말 것. 셀 값/시트명/numFmt 검사 범위를 유지하고 full metadata validator로 넓히지 않는다.

회귀에는 (1) 이번 값 없는 numFmt 6건 및 기존 value 6건의 안전 오류·serializer 0, (2) 순회 전후 실제 Row/Cell 객체 수가 증가하지 않는 단언, (3) **동일 43,165B·166,209B fixture**의 실제 parser→writer 재측정과 재개방, (4) 동일 밀집 650,021셀 비용, (5) R4 원본 2건·문자 보존·1~5차 및 공통 회귀를 넣을 것. 정확한 ms 하나를 불안정한 unit 임계값으로 고정하지 말고 객체 수 불변을 결정적 단언으로 고정하며 실측 출력은 별도 보존한다. 큰 표본이 제한 안에 끝나고 이전 대조 대비 과도한 시간·메모리 증가가 해소됐음을 확인한다. 입력 파서·엔진·행/열 한도를 낮춰 회피하거나 QR 스모크·UI를 바꾸지 않는다.

**650,021셀 비용 주장의 정확한 범위.** sol의 원본 표본은 50,000×13 셀이 모두 존재하고, 8개 추가 시트도 한 셀짜리 헤더만 있다. 따라서 fix-4/fix-5 모두 **650,021셀·50,009행**을 방문하며 빈 객체가 새로 생기지 않는다. “includeEmpty를 추가했는데 방문 수가 늘지 않는” 것은 이 표본에서는 **측정 오류가 아니다**. 원본 무수정 재측정 **122/141/124ms**; 독립 동일 프로세스 비교는 fix-4 **123.4/117.5/115.9ms**, fix-5 **129.8/138.5/139.9ms**다. 세 번의 잡음 포함 표본이므로 일반 성능 비율로 확대하지 않는다. 50,000×13·9시트 생성 **6,060ms**, 별도 ZIP 검사 **278/197/179ms**도 재현했다. [밀집 비용](logs/value-scan-cost.log), [구성/대조](logs/backstop-cost.json), [ZIP 비용](logs/performance.log).

반대로 희소 보조 표본에서는 50,000행의 M열만 존재할 때 **50,001→650,001 Cell**, 행 공백 표본은 **2→150,001 Row**, 40행×16,384열 마지막 셀 표본은 **41→655,361 Cell**이 된다. 첫 검사 **324/43/377ms** 뒤 다시 검사하면 이미 채워진 객체를 사용하므로 더 빠른 수치가 나온다. 첫 실행과 후속 실행을 합쳐 “희소 비용 동급”으로 판정할 수 없다. 실제 제품 파이프라인의 R5 대조가 이 표본 부족을 확인했다. 직렬화 XML의 데이터행 `spans`도 `512:512→1:512`로 바뀌어 순회가 관찰에 그치지 않았음을 독립 확인했다. 실제 값 셀 수와 값은 유지됐다. [단계별 객체 수](logs/backstop-cost.json), [XML](logs/sparse-xml.json).

**동일 필드·metadata 조사 결론.** sol의 검색은 지정된 일부 디렉터리에 한정됐으므로 그 표만으로 전수 판정을 내리지 않았다. 이번 전체 검색에서 공용 writer의 실제 제품 소비처는 비교·정리·QR 세 곳임을 다시 확인했다. 테스트/fixture·생성물/vendor/의존성은 제품 입력 흐름과 분리했다. Excel 병합 `src/features/excel-merger/excel.worker.ts`, Word 보고서 `src/features/excel-merger/wordReport.ts`, PDF Office `src/features/pdf-editor/pdfOffice.worker.ts`도 검색에 잡히지만 각각 별도 writer이며 이번 세 소비처로 연결되지 않는다. 이 소유자와 호출 경계를 제외 근거로 삼았고 새 디렉터리를 조용히 제외하지 않았다. [전체 결과](logs/repo-string-boundary-inventory.log), [제품 경로](logs/product-boundary-paths.log), [호출·직렬화 진입점](logs/caller-endpoints.log).

| 문자열/속성 | 실제 흐름과 독립 확인 |
|---|---|
| 정리 numberFormat/style.numFmt | 출력 두 대입 모두 공용 sanitizer 적용. parser의 numberFormat 및 engine의 날짜 변환 `outputFormat`도 이 대입으로 합류한다. 별도 안전하지 않은 출력 대입 없음. |
| 비교의 정규화 style.numFmt | `stableStringify` 비교 후 `FORMATTING` 판정에만 사용한다. 원본 스타일 객체가 보고서 스타일로 복사되지 않는다. 입력 숫자 서식이 **displayValue 문자열**에 반영되어 보고서 셀 텍스트로 갈 수는 있으나 그 경로도 공용 sanitizer와 `@`를 지난다. 실제 서식 입력을 비교한 산출 workbook의 numFmt 집합은 **[`@`]**. |
| QR | 입력은 `createSpreadsheetDisplayLookup`으로 표시 문자열을 선택하고 manifest는 문자열 배열→공용 writer로 쓴다. 입력 style 객체를 복사하는 대입 없음; `@`는 제품 상수. 실제 스모크 manifest·금지 문자 값 재개방 유지. |
| docProps | 비교/정리는 creator=`Worklazy Tools`, QR=`Worklazy QR Bulk`. 입력 제목·작성자·subject·lastModifiedBy sentinel은 산출 XML에 없음. 공용 API의 선택 creator 인자를 임의 외부 입력으로 간주하지 않았다. 모든 실제 호출은 상수다. |
| 정의된 이름 | 입력 모델에는 존재하고 수식 강등 판정에 사용하지만 신규 정리 workbook으로 복사하지 않는다. 실제 입력 이름 1개→출력 0개. |
| 하이퍼링크·주석·조건부 서식 | hyperlink는 parser에서 표시 text scalar로 정규화; 대상 URL 관계는 출력되지 않는다. 주석과 조건부 서식은 cleaner 모델로 옮기지 않는다. 실제 입력의 링크 URL/주석/조건부 글꼴 sentinel 모두 출력 XML에 없음. |
| 글꼴·색·테두리·정렬·보호 | **입력 유래 경로가 있다.** OOXML `comparableStyle`→모델 clone→`target.style`로 보존된다. 정상 이름(한글·이모지·FDD0·리터럴 `_xFFFE_`)과 색/테두리 값이 실제 출력에 남는다. font.name/font.scheme/font.color.argb/fill.fgColor.argb/border.left.color.argb의 FFFE·FFFF **10건**은 실제 inputAdapter가 먼저 거부. BIFF8 경로는 style 객체를 전달하지 않아 R4처럼 우회하지 못한다. 해당 경로가 없다는 주장은 틀리지만, 실제 지원 입력을 받아 malformed 출력까지 성공하는 추가 결함은 재현되지 않았다. |
| worksheet 속성 | `writeCleanedSheet`가 신규 시트를 만들고 이름·선택 헤더·셀·병합·제품 고정 frozen view/폭만 쓴다. 입력 tabColor·headerFooter·pageSetup을 복사하는 다른 자리는 없음. 입력 머리글/바닥글 sentinel도 출력에서 사라짐. |

위 도달성 실험의 최초 실행은 ExcelJS가 빈 `title`을 `undefined`가 아닌 `""`로 반환해 **검수 스크립트의 기대값이 틀려 exit 1**이었다. 새 검수 스크립트의 그 기대값만 고친 동일 실험이 통과했다. 제품이나 기존 감사 probe는 바꾸지 않았으며 [최초](logs/reachable-style-fields.log)와 [정정](logs/reachable-style-fields-corrected.log)을 모두 보존했다.

**문자 보존과 기록 판정.** R4를 지원 BIFF8→우리 writer 산출의 **기존 결함**으로 기술한 것은 정확하다. 안전 거부 대신 자리별 U+FFFD를 택한 이유, FDD0~FDEF 32개·유효 서로게이트 쌍 보존, CR와 서식 escape의 단계 차이도 [review-notes 37~43행](source/docs/review-notes.md:37) 및 간결한 [CHANGELOG](source/CHANGELOG.md:7)에 정확히 남았다. 독립 BIFF8 서식 표본은 parser가 원문을 보존하는 것부터 검사했다. FDD0 32개·한글·😀/𝄞/U+10FFFF·통화 기호·`# 0 , . ; " \ yyyy-mm-dd`는 sanitizer가 그대로 반환했다. 짝 없는 상/하 서로게이트만 U+FFFD다. CR은 sanitizer 및 **원시 styles.xml**에 남으며, XML 속성 재개방에서 공백이 된다. ExcelJS가 `\문자`의 backslash를 제거하는 표현 정규화도 sanitizer 변형과 구분해 ElementTree의 formatCode와 각각 대조했다. [6개 별도 출력](logs/format-preservation.json), [17개 workbook·240 XML part 검사](logs/xml-style-check.json).

R5는 이번 검수에서 발견한 **fix-5 회귀**이므로 후속 기록에 별도로 추가해야 한다. sol의 밀집 표본 수치를 거짓 측정으로 정정할 필요는 없지만 그 수치만으로 비용 검토를 닫은 것은 불충분하다. 추적 기록 파일은 수정 금지에 따라 그대로 두고 이 보고서를 Claude 취합 입력으로 전달한다.

| 공통 검증 명령 | 실제 결과 | 원출력 |
|---|---|---|
| `./node_modules/.bin/tsc -b` | exit 0 | [tsc](logs/tsc.log) |
| `npm run test:unit` | **267/267**, exit 0 | [unit](logs/unit.log) |
| `npm run build` | **2,835 modules·61 정적 페이지**, exit 0 | [build](logs/build.log) |
| `npm run test:static` | startup recovery **104문서**, exit 0 | [static](logs/static.log) |
| `npm run test:excel-compare` | exit 0 | [비교](logs/excel-compare.log) |
| `npm run test:excel-cleaner` | exit 0, 기존 R4 브라우저 회귀 포함 | [정리](logs/excel-cleaner.log) |
| `npm run test:qr-bulk` | 첫 실행 exit 0, 알려진 경합 **0/1** | [QR](logs/qr-bulk.log) |
| `npm run test:browser` | TEST_SCOPE 미설정 전체 Excel·Word·PDF, exit 0 | [browser](logs/browser.log) |
| `npm run bundle:measure` | exit 0, **80 JS/1 CSS**, 브라우저 종료 후 내부 build | [bundle](logs/bundle.log) |
| `npm run css:orphans` | orphan **0**, exit 0 | [CSS](logs/css-orphans.log) |
| `node tests/tool-registry-routes.mjs` | **20 route**, exit 0 | [registry](logs/registry.log) |
| `git diff --check 88fa10e..8b5b505`, `5bc6854..8b5b505`, 대상 worktree | 모두 exit 0 | [범위 실행 코드](probes/scope6.py), [출력](logs/scope.log) |

이 공통 검증의 통과는 새 R5 실험의 실패를 덮지 않는다. 비용 측정 runner는 각 child 결과를 모아 기록하므로 자체 exit 0일 수 있다. **큰 fix-5 child의 실제 결과는 `timeout60`**이며 통과로 세지 않았다. 기존 CDATA 행렬 exit 1은 알려진 oracle 한계, R4 mutant exit 1은 기대 실패, 최초 metadata probe exit 1은 위 검수 기대값 오류로 구분했다. LO javaldx/dconf 경고도 보존했으며 출력 존재·값 단언과 함께 판정했다. QR 플래키는 이번에 재발하지 않았고 제품·스모크 수정은 없다.

**불변·통합 인계.** [시작](start-state.json)과 [종료](end-state.json)의 HEAD·branch·main이 같고 `git status --porcelain=v1`는 모두 빈 문자열이다. 대상 **추적 2,376파일 SHA 변경 0**, 기존 감사/sol probe·artifact·로그·mutant·입력·열린 문서를 포함한 **보호 1,354파일 변경 0**, archive의 **2,376파일도 원 archive 대비 변경 0**이다. [불변 대조](state-comparison.json). R4 원본 SHA는 다음과 같으며 실행 전후 같다.

- `style-safety-counterexamples.mts`: `0f93f23c3a0f5a8ce5cfe5d3c2ddf0f77e089d4d450db4a7496d739c81d984be`
- `style-boundary.mts`: `3db1c5d68ac6fc1ae96fa91d6b81c557703f73c8ab3449753a6d5b6b3ced1e96`

원 워킹트리에서는 첫 필수 `PROJECT_RULES.md` 읽기만 했다. 사용자 파일은 과거 검수의 안전 사본 두 개를 SHA 대조 후 복사해 사용했다. 원 워킹트리 제품/U4 작업물, `/tmp/worklazy-dc-impl`, `/tmp/worklazy-u4-3-review4`에는 접근하지 않았다. 대상 worktree의 빌드·fixture 생성·추적 파일 수정·커밋·push·브랜치 전환도 없다. 새 파일과 실험 산출물은 모두 `/tmp/worklazy-xr-review6/` 안에 있다.

main은 종료 시 **`cdb4007faea277ffc3ae9f3f7f4fe6fd8b8ba7be`**로 재확인했다. 기준 `5bc6854` 이후 main과 폭 브랜치의 **실행 코드 교집합 0**, 공통 파일은 **`CHANGELOG.md`·`docs/review-notes.md` 두 개**다. [현행 교집합](logs/merge-intersection-final.json). 현재 **검수 통과/배포 후보 승인은 선언하지 않는다**.

R5 수리·재검수 통과 후에는 최신 main/교집합을 다시 확인하고 `ac9cc4a → 64af7b3 → cbe491a → 3270512 → 88fa10e → 8b5b505 → R5 수리` 계보를 유지해 머지 커밋으로 통합하며 두 기록 파일을 취합할 것. 병합 뒤 tsc/unit/build/static·Excel 비교/정리·QR·전체 browser·원본 R4/R5 희소/서식/문자·사용자 파일·폭/토폴로지·bundle/CSS/routes/diff를 재검사한다. **main에 이미 배포된 문서 비교 엔진**의 `tests/document-diff-equivalence.mjs`와 `tests/unit/document-diff-golden.test.ts`, DOCX/HWP 실제 결과·토글 회귀도 포함한다. 이 재검사는 이번 archive 검수로 대신하지 않는다. 수리된 폭 브랜치의 통합은 **후속 Excel 중복키·머리글 계획보다 먼저** 수행할 것.

**[수정 후 재검수]**
