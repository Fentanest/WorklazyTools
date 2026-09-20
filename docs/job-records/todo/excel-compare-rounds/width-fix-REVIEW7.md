**[수정 후 재검수] — R5-sparse-backstop의 시간·메모리 회귀는 해소됐다. 그러나 fix-5가 검출하던 행·열 수준 `numFmt` 두 경로를 fix-6이 놓치는 R6-numFmt-style-gap을 재현했다. 사용자 파일의 1바이트 차이는 시각 문자열의 ZIP 압축 크기 차이이며 데이터 누락도, 유령 셀 제거도 아니다.** — Codx, 2026-09-07

대상 `/tmp/worklazy-xr`, 브랜치 `excel-report-width-20260907`, HEAD `de6663797a3b1ceb45ceba87041fcbfda8a7746a`를 확인했다. 첫 행동으로 대상의 `PROJECT_RULES.md` 전문을 읽고 AGENTS·6차/5차 보고·fix-6 수정 지시·7차 지시·sol 보고와 관련 probe/log/artifact·`docs/review-notes.md`를 읽었다. 열린 문서는 완료 상태의 X-A 실행 사본 한 개이며 상반 지시는 없다. [시작 상태](start-state.json), [열린 문서](logs/open-plan-gate.log), [계보](logs/ancestry.log).

검증은 **`git archive de66637` 사본** [source/](source/)에서 했다. 의존성과 vendor는 대상의 사본이며 새 설치는 없다. unit의 `git ls-files`용 독립 Git index/metadata만 검수 디렉터리에 만들었다. [준비 코드](probes/setup.py), [archive SHA](logs/setup.log), [환경](env.sh). 모든 명령은 별도 표시가 없으면 `cd /tmp/worklazy-xr-review7/source; source ../env.sh` 환경이다. heap 4GiB, 전용 TMPDIR/cache, TEST_SCOPE 미설정을 고정했고 build·브라우저 묶음·bundle 내부 build는 직렬이다. preview는 `4380 --strictPort`, QR 보조 proxy는 4381이며 산출물은 이 검수 디렉터리에 한정했다. [명령·exit·소요시간 전체](checks.jsonl).

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| R5 동일 희소 fixture | **해소** | `python3 ../probes/sparse-suite.py`: 43,165B **240.317ms / 199,580KiB**, 166,209B **734.601ms / 322,284KiB**. 둘 다 제한 60초 이내 출력·ExcelJS 재개방. [실행](logs/sparse-suite.json), [독립 XML](logs/sparse-xml.json) | 조회 순회와 객체 수 불변 유지. |
| 부작용 없는 순회 | **통과** | 설치본 ExcelJS **4.4.0** 소스 확인. sol 세 표본과 6차 세 표본 모두 Row/Cell 불변. 생성 API를 throw로 바꾼 독립 scan도 호출 **0**, 동일 객체 **3→3**. [소스](logs/exceljs-iteration-source.log), [sol 표본](logs/backstop-contract.json), [독립 표본](logs/backstop-cost.json), [API 계측](logs/no-creation.json) | `eachRow/eachCell(includeEmpty)` 복귀 금지. |
| 거짓 음성 사냥 | **R6 / 수리 필요** | `numfmt-gap-safety.mts --test` **0/2, exit 1**. 같은 원본을 fix-5에 bind하면 **2/2, exit 0**. 실제 writer도 fix-6만 serializer **1**, ExcelJS·ElementTree의 `styles.xml` 거부. [실패](logs/numfmt-gap-safety.log), [fix-5 대조](logs/fix5-gap-control.log), [13조건×2버전](logs/false-negatives-extra.json), [독립 XML](logs/false-negatives-elementtree.json) | 셀 생성 없이 기존 행·열의 numFmt 자체를 검사. 아래 좁은 수리 문안 적용. |
| 기존 numFmt 6 + 값 6 | **통과** | `sol-backstop.mts contract`: **12/12** `REPORT_INTEGRITY_FAILED`, 각각 serializer **0**. 독립 6차 서식 6건도 통과. [계측](logs/backstop-contract.json), [독립](logs/backstop-cost.json) | 기존 셀 상속 표본 통과를 셀 없는 행·열 전체 보장으로 확대하지 말 것. |
| 안전 오류 ko/en | **통과** | production worker의 M50.numFmt·값·폭 각각 주입: locale당 오류 코드 한 건, 안전 안내, 다운로드 **0**, 내부 명칭·원시 예외 미노출. [numFmt](logs/worker-numfmt-error.log), [값](logs/worker-backstop-error.log), [폭](logs/worker-safe-error.log) | 새 오류 코드나 UI 문구 불필요. |
| 사용자 파일 1바이트 | **정상 / 원인 확정** | 기존 54,122B와 sol 54,121B는 **core.xml 시각만 다름**, 해당 part 압축 **362→361B**. 시각 고정 시 `3270512`·`88fa10e`·`8b5b505`·`de66637` **4개 모두 54,120B·동일 SHA**. [원본 ZIP diff](logs/user-original-zip-diff.json), [고정 시각 대조](logs/user-fixed-identical.json) | byteLength 하나를 불변 계약으로 쓰지 말 것. |
| 사용자 파일 내용 | **통과** | 실제 parser→compare→report **713/37/48/4**, **9시트·856행·95열·68 col 태그·폭12~48·오류0**. 현재 비고정 출력 54,122B. LO Summary **99B·9행**, 수치 동일. [재실행](logs/user-files.log), [XML](logs/user-xml-independent.json), [LO](logs/user-lo.log) | 없음. |
| 밀집 비용 | **통과 / 표본 범위만** | 650,021셀·50,009행에서 sol 동일 probe **115.222/117.613/112.977ms**, 독립 같은 프로세스 대조 fix-4 **124.983/117.421/129.271**, fix-6 **136.533/128.065/127.447ms**. 모든 객체 수 불변. [sol](logs/backstop-dense.json), [독립](logs/backstop-cost.json) | 세 번의 표본을 일반 성능 비율로 확대하지 않음. |
| 원본 1~6차 회귀 | **통과** | R1 **2/2**(2차 동일 사본도 2/2), 조합 **2/2**, 요소 **5/5**, 문자 **32/32**, R3 **2/2**, R4 **2/2**. 원본 무수정 read-only bind. [전체 실행](logs/regression-suite.log), [원본 SHA](logs/original-probe-sha256.json) | 아래 새 원본 R6도 포함할 것. |
| 확장·음양성·폭·토폴로지 | **통과** | 독립 **2,880/2,880**, 음성 **6/6**, 양성 **4/4**, 폭 **[12,13,47,48,48]**, 50,000/150,000행, 9시트/13열, 조기 탐지·뒤 시트 폭 거부·토폴로지 오류 유지. [확장](logs/independent-expanded.log), [음양성](logs/data-row-required.log), [core](logs/core.log), [토폴로지](logs/early-exit-topology.log) | 없음. |
| 문자 보존·3-reader | **통과** | 독립 **1,114,112/1,114,112**, **34 workbook·70 지정 셀** 전체 XML·시트명·값을 ExcelJS/ElementTree/LO 재저장으로 검증. [문자](logs/characters.log), [3-reader](logs/three-readers.json) | FDD0~FDEF·유효 쌍·정상 서식 보존. |
| CDATA·scanner 범위 | **기존 한계 동일** | 원본 CDATA **2,764/2,880·exit 1**, 독립 ElementTree **192/192**, scanner 불일치0. scanner/reference **60/60·32/32**, 각 10초 제한. [원본](logs/legacy-matrix.log), [독립](logs/legacy-cdata-semantic.log), [scanner](logs/scanner-cost.log), [reference](logs/reference-cost.log) | 원본 행렬 100% 또는 희소 writer 60초 통과로 확대 금지. |
| mutant 검출력 | **통과** | fix-4 두 파일의 R4 mutant **0/2**; R3 이전 writer **0/2**; lexical 이전 판정기 **16 pass/16 fail**. 새 R6는 fix-5 **2/2**와 fix-6 **0/2**로 방향도 확인. [R4](logs/style-mutant.log), [R3](logs/r3-mutant.log), [lexical](logs/lexical-mutant.log) | mutant 기대 실패를 제품 통과 수에 합산하지 않음. |
| 범위·기록 정정 | **통과 / R6 기록 후속 필요** | **4파일 +109/−6**, backstop·unit·기록만. 입력 parser/engine/9시트/UI/QR/한도 등 전체 diff 밖, 지정 12 blob·폭 함수 동일. 요구한 기록 정정 5건 반영. [범위](logs/scope.json), [diff](logs/diff-full.log) | R6에서 “행·열 상속도 검사”의 한계를 보충. |
| sol 하네스 사고 2건 | **제품 결함 아님** | 출력 객체를 fs.writeFile에 넘기면 같은 `ERR_INVALID_ARG_TYPE`; `.buffer`를 쓰는 동일 파이프라인은 위 R5 재실행 성공. 최초 build 도구 수집 중단은 완료 증거가 아니며 이번 독립 build 결과로 대체 판정. | 제품 수리 불필요. 최초/정정 결과를 구분해 보존. |

**R5 재실측의 정확한 범위.** 원본 입력 SHA는 43,165B가 `795db96046c1ea88e412447dbd0e222aa02baec2198107c950bf449a5e16dc39`, 166,209B가 `196f7ebb553b5bf0e2269360023ab6caeb4686b31a46a11020dbf293f165909b`로 6차 원본과 같다. fixture를 새로 만들거나 한도를 낮추지 않았다. 실제 `parseSpreadsheetInput`→preflight→consumeSource 모델→빈 규칙 engine→cleaner output을 다시 실행했고, ExcelJS 재개방 뒤 5시트와 SR3901=3901/SR19001=19001을 단언했다.

| 입력 | 6차 fix-4 / fix-5 | sol fix-6 | 이번 fix-4 대조 | 이번 fix-6 |
|---|---|---|---|---|
| 3,900×512 · 43,165B | 208.6ms / 6,485·9,218·6,568ms | 244.383ms, 193,392KiB | **234.711ms, 190,988KiB** | **240.317ms, 199,580KiB** |
| 19,000×512 · 166,209B | 675.5ms / 60초 초과 | 725.462ms, 326,520KiB | **702.990ms, 321,480KiB** | **734.601ms, 322,284KiB** |

KiB는 **출력 직후 프로세스 max RSS**이며 입력 파싱 등을 포함한다. 재개방까지 포함한 마지막 max RSS나 backstop만의 할당량과 혼동하지 않았다. 이번 fix-4 대조는 archive 소스 위에 `88fa10e`의 writer/cleaner 두 파일을 read-only bind한 것이다. 같은 입력·heap·실행 조건에서 과도한 지연·메모리 증가는 해소됐고 6차의 큰 입력 60초 초과도 사라졌다. 무한 루프/OOM을 원래 확정했던 것으로 기술하지 않는다.

ElementTree는 성공 출력의 모든 XML/rels 14개를 파싱해 데이터 시트 실제 셀 **4,412/19,512**, 데이터행 `spans="512:512"`, 마지막 값 **3901/19001**을 확인했다. 작은 입력은 논리 **1,997,312셀·warnings=[]**, 큰 입력은 **9,728,512셀·LARGE_FILE 경고만**이다. fix-6 수정 지시의 “두 입력 모두 soft limit 아래” 문장은 잘못됐고, 뒤 문장의 큰 입력 hard limit 아래 설명과 이번 실제 preflight가 정확하다.

**조회 순회·경계 판정.** ExcelJS 4.4.0의 `rowCount`는 `_rows`의 마지막 존재 인덱스, `findRow`는 `_rows[r-1]`, `cellCount`는 `_cells.length`, `findCell`은 `_cells[col-1]`를 읽는다. 이 네 API는 생성하지 않는다. 실제 셀 `M2`에 서식만 지정해도 cellCount는 **13**, 실제 `M500`에 서식만 지정해도 rowCount는 **500**이므로, 공개 API로 존재하는 셀이 cellCount “밖”에 숨거나 존재하는 행이 rowCount “밖”에 숨는 가정은 성립하지 않는다. dimension 축소/과대 표본에서도 실제 읽힌 셀 범위를 따라 검사했다. 앞이 비고 뒤에만 존재하는 행, 병합 비앵커도 계속 검출된다.

다만 **Row/Column에 저장된 numFmt는 Cell 객체와 별개로 serializer가 styles.xml에 쓴다.** `cell.numFmt`는 매 조회 때 부모를 동적으로 읽는 getter가 아니다. Cell 생성자가 부모 스타일을 복사하며, fix-5는 빈 좌표를 생성하는 과정에서 우연히 그 스타일을 Cell로 끌어와 검출했다. fix-6은 빈 Cell을 건너뛰므로 그 부수적 방어도 사라졌다. `column.numFmt=` setter는 내부 eachCell이 값 있는 행에 Cell을 생성·전파한다. 따라서 그것만 시험하면 거짓 음성을 놓친다. **`column.style={numFmt:...}`**와 **`row.style={numFmt:...}`**를 따로 실행한 이유다.

| 실제 XLSX/메모리 조건 | fix-5 | fix-6 | 결론 |
|---|---|---|---|
| 뒤쪽 값 없는 M2/M500·중간 행 공백·뒤 행만 존재 | 안전 오류, serializer0 | 안전 오류, serializer0 | 기존 Cell 검출 유지 |
| column.numFmt setter가 셀에 전파된 표본 | 안전 오류, serializer0 | 안전 오류, serializer0 | sol 기존 상속 표본 통과는 참 |
| **C2만 존재, B열 `column.style.numFmt`** | **안전 오류, serializer0** | **성공 반환, serializer1, malformed styles.xml** | **R6 신규 회귀** |
| **C2만 존재, 2행 `row.style.numFmt`** | **안전 오류, serializer0** | **성공 반환, serializer1, malformed styles.xml** | **R6 신규 회귀** |
| 마지막 Cell 밖 M열 style만 존재 / Cell 없는 시트에 열 style | 성공 반환, malformed | 성공 반환, malformed | 기존 numFmt 사각지대, fix-6 신규 회귀 아님 |
| 높이20인 50행의 style만 있고 Cell 없음 | 성공 반환, malformed | 성공 반환, malformed | 기존 numFmt 사각지대 |
| 높이도 Cell도 없는 행 style | 성공 반환, 정상 XML | 성공 반환, 정상 XML | ExcelJS row.model이 null이라 해당 style을 직렬화하지 않음 |
| 병합 비앵커 C3 / dimension=A1:A1 또는 A1:XFD1048576과 실제 범위 불일치 | 안전 오류, serializer0 | 안전 오류, serializer0 | 회귀 없음 |

안전 XLSX 13개를 실제 ExcelJS serializer로 만들고 재개방한 뒤 해당 `numFmt`에 U+FFFE를 넣어 양 버전으로 출력했다. dimension 2건만 명시적으로 ZIP XML을 변형한 계약 경계 표본이며, **R6 두 건은 ZIP/XML 변조 없이 공용 `writeXlsxWorkbook`이 실제 생성한 형식**이다. [실험 코드](probes/false-negatives-extra.mts), [26회 결과](logs/false-negatives-extra.json). fix-6 malformed 5개·fix-5 malformed 3개의 유일한 파싱 실패 part는 모두 `xl/styles.xml`이고, ExcelJS도 `2:390: disallowed character.`로 거부한다. 새 최소 안전 probe는 실제 serializer 호출 전 안전 거부를 요구하며 **현재 0/2**, fix-5 대조 **2/2**다.

**R6 심각도와 도달성.** 이 결함은 **P3의 공용 writer 방어 회귀**로 판정한다. 현재 지원 사용자 입력→제품 UI→malformed 출력의 P2 재현으로 확대하지 않는다. 실제 세 소비처에서 비교/QR은 셀의 안전한 `@`만 쓰고, 정리는 input cell.style/numberFormat을 안전화해 target **Cell**에 쓴다. 입력의 Row/Column 스타일 객체 자체를 출력의 Row/Column에 복사하는 대입은 없다. 전체 실행 확장자 재귀 검색과 정상 Row/Column 서식 XLSX의 실제 cleaner 파이프라인에서 출력 행·열 numFmt가 모두 없고 값123이 유지됨을 확인했다. 새 malformed 5개를 제품 입력 parser에 다시 넣으면 모두 입력 단계에서 거부된다. [전수 검색](logs/repo-string-boundary-inventory.log), [실제 도달성](logs/style-gap-reachability.json).

검색에서 tests/fixture는 검증 입력, public/vendor·dist·node_modules는 생성물/의존성으로 구분했다. Excel 병합·Word 보고서·PDF Office의 별도 writer는 공용 writer의 세 소비처와 연결되지 않는 별도 소유 경로다. row/column의 정상 XML이 parser에서 모델 Cell에 반영되는 것과, 출력 workbook의 Row/Column 스타일 자체를 복사하는 것은 구별했다. 그러므로 R4의 지원 BIFF8 손상이나 R5의 지원 희소 입력 비용과 심각도가 같다는 근거는 없다. 하지만 이번 지시의 핵심은 **fix-5 검출력 보존**이고 실제 두 건이 퇴행했으므로 배포 후보 승인은 보류한다.

**수정 지시 문안.** `src/utils/xlsxReport.ts`의 numFmt backstop과 해당 unit/기록만 좁게 허용한다. **기존 `worksheet.columns`에 저장된 column.numFmt와 `findRow`로 찾은 row.numFmt를 Cell 존재 여부와 독립적으로 검사**하고, 기존 Cell 값·numFmt 검사도 유지하라. 열 순회는 columnCount로 자르지 말고 실제 저장된 열 컬렉션을 조회해야 마지막 Cell 밖 style-only 열도 포함된다. 행·열 스타일의 다른 metadata 전체로 확장할 필요는 없다. `getCell/getRow` 생성, `includeEmpty` 복귀, 입력 한도 축소, parser/engine/UI/QR 변경은 금지한다.

[새 최소 원본](probes/numfmt-gap-safety.mts)을 수정하지 않고 **2/2 pass**로 만들고, 위 13조건 중 실제 직렬화되는 금지 numFmt를 모두 `REPORT_INTEGRITY_FAILED`·serializer0으로 고정하라. 높이 없는 빈 행 style도 같은 numFmt 검사 범위로 안전 거부할 수 있으나 이를 현행 malformed 출력 사례라고 기록하지 않는다. 정상 Row/Column numFmt·Cell 값/기존 안전 서식은 유지하고 순회 전후 Row/Cell 수 불변을 단언하라. 기존 numFmt6+값6, 동일 희소 2개 parser→writer·XML 재개방, 밀집 표본, 문자/기존 회귀, ko/en 안전 오류, 공통 검증을 함께 유지한다. 정확한 ms를 unit 임계값으로 박지 않는다. 기록은 R6의 **새 회귀 2건**과 **기존 Row/Column 사각지대**를 분리하고 현재 제품 입력 도달성의 한계를 명시한다.

**1바이트 원인 확정.** 기존 6차 파일의 core.xml 시각은 `2026-09-07T10:39:03Z`, sol fix-6은 `2026-09-07T11:22:57Z`다. created/modified 이외 모든 ZIP part의 **압축 해제 바이트가 동일**하다. core.xml 원문은 양쪽 746B이나 deflate 크기는 362B와 361B여서 전체 54,122/54,121B 차이가 난다. ZIP 엔트리의 생성 시각 필드도 실행 시각을 반영한다. 사용자 보고서에는 이 순회 변경에 따른 XML의 `spans`나 셀 누락 차이가 없다.

`node --import=../probes/frozen-time.mjs ... user-fixed.mts <version>`으로 생성 시각과 ZIP 시각을 고정한 네 대조는 모두 **54,120B**, SHA-256 **`570145eea9ff218a7ac2fb32d3e4fdceac89f52e4b4dee6093110bc654d8b2e5`**다. `3270512`/`88fa10e`/fix-5/fix-6 writer 파일만 read-only bind해 같은 parser·engine·report를 실행했으며 보고서 구성 코드는 버전 간 동일 blob이다. [실행 코드](probes/user-fixed.mts), [시각 고정](probes/frozen-time.mjs), [동일성 단언](logs/independent-review7.log). 따라서 byteLength 54,122 자체를 완료 불변값으로 고정할 이유가 없고, 값·토폴로지·폭·XML 또는 시각을 통제한 바이트 비교가 맞다.

**기록 정정 5건.** `docs/review-notes.md`의 fix-6 절은 ① R4 기존 결함/R5 fix-5 회귀 및 밀집만으로 닫은 판정의 불충분함 ② 실제 OOXML style 보존 경로와 inputAdapter의 지정 10건 차단 ③ 필드별 결론표 ④ CDATA 원본 2,764/2,880·exit1과 ElementTree 192/192 분리 ⑤ scanner/reference 60/60·32/32 범위 제한을 모두 명시한다. 이번에도 metadata 지정10건 입력 거부와 정상 스타일 보존을 직접 재현했다. [도달성](logs/reachable-style-fields.json), [기록 diff](logs/diff-full.log). `CHANGELOG.md`는 코드 변경 한 줄·Codx 서명이다. 현행 기록의 “행·열 상속도 계속 검사”는 실제 Cell이 존재하는 기존 여섯 표본에서는 참이지만, 새 R6 조건까지 포함하는 전체 보장으로 읽히지 않도록 후속 보충해야 한다.

**공통 검증·소비처 회귀 완료.** 아래 항목은 모두 실제 명령의 exit 0을 확인했다. 새 R6 최소 probe의 실패를 이 표로 덮지 않는다.

| 공통 검증 명령 | 실제 결과 | 원출력 |
|---|---|---|
| `./node_modules/.bin/tsc -b` | exit0 | [tsc](logs/tsc.log) |
| `npm run test:unit` | **269/269**, fail0 | [unit](logs/unit.log) |
| `npm run build` | **2,835 modules·61 정적 페이지**, exit0 | [build](logs/build.log) |
| `npm run test:static` | startup recovery **104문서**, exit0 | [static](logs/static.log) |
| `npm run test:excel-compare` | exit0 | [비교](logs/excel-compare.log) |
| `npm run test:excel-cleaner` | exit0, R4 브라우저 포함 | [정리](logs/excel-cleaner.log) |
| `npm run test:qr-bulk` | 첫 실행 exit0, 기존 경합 재발0/1 | [QR](logs/qr-bulk.log) |
| `npm run test:browser` | TEST_SCOPE 미설정 Excel·Word·PDF 전체 exit0 | [browser](logs/browser.log) |
| `npm run bundle:measure` | **80 JS/1 CSS**, exit0 | [bundle](logs/bundle.log) |
| `npm run css:orphans` | orphan **0**, exit0 | [CSS](logs/css-orphans.log) |
| `node tests/tool-registry-routes.mjs` | route **20**, 누락/초과/중복0 | [routes](logs/registry.log) |
| `git diff --check 8b5b505..de66637`, `5bc6854..de66637`, 대상 worktree | 모두 exit0 | [실행 코드](probes/scope7.py), [결과](logs/scope-corrected.log) |

브라우저 실제 다운로드 고유 XLSX **11개**의 전 열 폭·비교 9시트/기록13열 헤더·정리/QR 시트 순서를 별도 XML 파서로 전수 단언했다. [소비처](logs/consumer-xml.json), [전수 실행](logs/consumers.log). QR 경계 값2개는 별도 ExcelJS·ElementTree·LO 재저장 검증도 통과했다. [QR](logs/qr-reopen.log), [QR 3-reader](logs/qr-three-readers.json). R4 원본 parser 출력·브라우저 ko/en×2·정상 서식·metadata를 포함한 **17 workbook·240 XML part**도 정상이며 값123과 승인된 숫자 서식이 유지된다. [Playwright](logs/style-playwright.json), [독립 XML](logs/xml-style-check.json).

50,000/150,000행은 생성 **909/2,409ms**, 검사 **64/102ms**, RangeError0이었다. 별도 50,000×13·9시트 생성 **5,961ms**, ZIP 무결성 검사 **261/207/184ms**도 통과했다. [대량](logs/core.log), [생성/검사](logs/performance.log). 실제 한국어 정리 화면에서 원본 43,165B 입력은 클릭→완료 **852.462ms**, UI 처리로그 **706ms**, 다운로드 **47,378B**, 5시트·SR3901=3901·4,412셀·spans512:512를 확인했다. [실제 브라우저](logs/sparse-browser.json), [다운로드](artifacts/sparse-browser.xlsx), [독립 XML](logs/sparse-xml.json). 6차의 5,370ms 표본과 같은 원본 입력에서 지연이 사라졌지만 두 번의 관찰값을 일반적인 브라우저 성능 비율로 주장하지 않는다.

**하네스 실패의 분리.** sol 첫 `writeFile` 사고는 출력 객체가 만들어진 뒤 파일 저장 코드가 객체 대신 `.buffer`를 넘겨야 하는 문제다. 이번 [동일 오류 재현](logs/sol-harness-object.log)은 parser→output 성공 **47,292B**까지 출력한 뒤 `ERR_INVALID_ARG_TYPE`로 끝났다. 제품 writer나 parser 오류가 아니며, 올바른 buffer 저장의 같은 경로는 R5 본 검증에서 재개방까지 통과했다. sol의 최초 build 수집 중단은 도구의 출력/실행 수명 경계에 관한 보고이며, 남은 로그만으로 그 최초 프로세스의 성공·실패를 단정할 수 없다. 그 최초 실행을 완료 증거로 세지 않았고 sol 단독 재실행 원출력과 이번 독립 build exit0을 확인했다. **제품 결함으로 볼 재현 근거 없음, 하네스/수집 사고로 분류**한다.

이번 검수의 최초 준비 보조 코드에는 존재하지 않는 `src/utils/xlsxReportIntegrity.ts`를 복사하려는 잘못된 경로가 있어 `FileNotFoundError`가 났다. 공용 writer는 그 파일을 의존하지 않으므로 해당 불필요 복사만 제거하고 필수 준비를 마쳤다. archive 안에서 env 없이 실행한 ad hoc git diff는 `Not a git repository`였고, 초기 scope 실행은 검사용 GIT_DIR을 대상 git 호출에 상속해 `main` ref를 못 찾았다. [초기 scope](logs/scope.log), [대상 호출 env를 분리한 정정](logs/scope-corrected.log). 제품/추적 파일 수정 없이 검수 하네스만 바로잡았다. 원본 CDATA exit1은 알려진 oracle 한계, R3/R4/lexical mutant exit1은 기대 실패, R6 최소 probe exit1은 실제 미해결 검출력 회귀로 각각 구분한다. LibreOffice javaldx/dconf 경고도 원출력에 남겼고 파일 존재·모든 XML·값 단언으로 판정했다.

**불변 증명.** [시작](start-state.json)과 [종료](end-state.json)의 HEAD·branch·main은 동일하고 `git status --porcelain=v1`는 모두 빈 문자열이다. 대상 **추적2,376파일 변경0**, 기존 검수/sol probe·artifact·log·안전 입력·열린 문서 등 **보호2,612파일 변경0**, archive의 **2,376파일도 원 archive와 바이트 차이0**이다. [SHA 대조](state-comparison.json). archive SHA-256은 `0f48a4b83b51f318daa3851bedb918f5056716752971f644dfc7b1bad22f5a7f`이며 [4380~4389 리스너0](logs/ports-final.json)도 확인했다. build가 필요한 생성 작업은 archive에서 생성 스크립트로만 수행했고 대상에는 쓰지 않았다.

원 워킹트리 `s3-pdf-finish` 및 `/tmp/worklazy-dc-impl`에 접근하지 않았다. 사용자 입력은 6차 안전 사본을 SHA가 동일한 사본으로 사용했다. 원/대상 worktree의 추적 파일 수정·커밋·push·브랜치 전환은 없고, 이번 산출물은 모두 `/tmp/worklazy-xr-review7/`에 있다. 추적 `docs/review-notes.md`는 수정 금지라 이 보고서를 Claude 취합 입력으로 전달한다.

**통합 인계 — 현재 배포 후보 미승인.** 종료 시 main은 **`cdb4007faea277ffc3ae9f3f7f4fe6fd8b8ba7be`**다. 공통 기준 `5bc6854` 이후 main과 대상 브랜치의 **실행 코드 교집합0**, 공통 파일은 **`CHANGELOG.md`·`docs/review-notes.md` 두 개**로 재확인했다. [현행 교집합](logs/merge-intersection-final.json).

R6 수리·재검수 통과 뒤 main과 교집합을 다시 확인하고 **`ac9cc4a → 64af7b3 → cbe491a → 3270512 → 88fa10e → 8b5b505 → de66637 → R6 수리`** 계보를 보존해 **머지 커밋**으로 통합하라. 두 기록 파일의 판정·기각 이력을 취합하고 **후속 Excel 중복키·머리글 계획보다 먼저 통합**한다. 이번 작업에서는 병합·배포를 하지 않았다.

병합 뒤에는 tsc/unit/build/static·Excel 비교/정리·QR·전체 browser·원본 R1~R6·희소2개/행열서식/문자보존·사용자 파일·폭/토폴로지/소비처·bundle/CSS/routes/diff를 재검사해야 한다. 특히 **main에 이미 배포된 문서 비교 엔진**의 `tests/document-diff-equivalence.mjs`, `tests/unit/document-diff-golden.test.ts`, 실제 DOCX/HWP 비교 결과·토글 회귀를 포함하라. 이번 폭 브랜치 archive 검증은 병합 이후 검증을 대체하지 않는다.

`s3-pdf-finish`의 배포 후 main 1회 동기화에서 예상되는 공통 충돌 표면은 **두 기록 파일의 취합**이며, 접근 금지된 진행 중 U4-4 코드와의 실제 충돌은 이번에 측정하지 않았으므로 동기화 시 확인해야 한다.

**[수정 후 재검수]**
