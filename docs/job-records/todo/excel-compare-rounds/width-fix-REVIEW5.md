**[수정 후 재검수] — 4차 R3의 셀 값·시트명 경로는 해소됐다. 다만 Excel 정리의 숫자 서식에서 실제 writer 산출 결함 R4-numFmt(P2)를 추가 재현했다.** 지원되는 `.xls` 입력을 정상 처리해 완료·다운로드로 제공하지만, 출력 `xl/styles.xml`에 U+FFFE/U+FFFF가 남아 ExcelJS와 ElementTree가 거부한다. 임의 XLSX XML을 변조한 사례가 아니다. 변경 전에도 재현되는 기존 결함이며, 현재 배포 후보 승인은 보류한다. — Codx, 2026-09-07

**대상·실행 조건.** `/tmp/worklazy-xr`, `excel-report-width-20260907`, HEAD `88fa10e808592b19d580aefeaf64cc565aa7fccd`; 계보 `5bc6854 → ac9cc4a → 64af7b3 → cbe491a → 3270512 → 88fa10e`, main `cdb4007faea277ffc3ae9f3f7f4fe6fd8b8ba7be`를 확인했다. 공통 규칙·역할 지시·1~4차 보고·원본 probe·fix-4 정본과 sol 보고·기록을 대조했다. 대상의 열린 작업 문서는 X-A 실행 사본 하나이며 이번 지시와 상반된 실행 지시는 없다. [시작 상태](start-state.json), [열린 문서](logs/open-plan-gate.log), [계보](logs/ancestry.log).

`git archive 88fa10e`를 [source/](source/)에 풀어 실행했다. archive SHA-256은 `b00f318413d5bc73f820ae8217d365a707990d845c1451187ab909a9fb69c485`다. 의존성·vendor는 대상에서 사본으로 복사했고 새 설치는 하지 않았다. 기존 unit의 `git ls-files`용 Git metadata/index만 검수 디렉터리에 별도로 마련했으며 커밋을 만들지 않았다. [준비 코드](probes/setup.py), [출력](logs/setup.log).

아래 명령은 별도 표시가 없으면 `cd /tmp/worklazy-xr-review5/source` 후 `source ../env.sh` 환경이다. [env.sh](env.sh)는 `NODE_OPTIONS=--max-old-space-size=4096`, 전용 TMPDIR/cache, TEST_SCOPE 미설정을 고정한다. preview는 `npm run preview -- --host 127.0.0.1 --port 4370 --strictPort`, QR 보조 proxy는 4371로 고정했다. build → 브라우저 → 종료 → bundle 내부 build → 추가 브라우저 순서로 직렬 실행했다. [전체 명령·exit·시간](checks.jsonl), [첫 preview 종료](logs/preview-lifecycle.json), [추가 preview 종료](logs/preview-extra-lifecycle.json).

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| 4차 원본 R3-writer | **해소** | `/tmp/worklazy-xr-review4/probes/writer-safety-counterexamples.mts` 원본 무수정 실행 **2/2 pass**. source만 archive로 read-only bind. [정확한 명령·TAP](logs/original-writer.log), [원본 SHA](logs/original-probe-sha256.json) | 없음. |
| CSV → 실제 parser → compare → 보고서 → 3중 재개방 | **통과** | `characters.mts`: C0 29종·FFFE·FFFF·정상 문자 묶음 **32개 CSV**, parser의 원문 보존부터 단언. 9시트 보고서의 실제 값 셀들을 ExcelJS로 재개방. `three-readers.py`는 패키지의 모든 XML/rels를 ElementTree로 파싱하고, LibreOffice XLSX 재저장 뒤 모든 시트명·지정 값 셀을 다시 단언. 이름·정리 표본 포함 **34개 workbook** 통과. [생성](logs/characters.log), [3중 재개방](logs/three-readers.log), [셀별 기대값](logs/character-outputs.json) | 없음. LibreOffice의 첫 Summary CSV만으로 전체 보고서 재개방을 주장하지 않았다. |
| 치환 범위·정확성 | **통과** | 독립 code-point 기대값으로 BMP **65,536개**와 보조 평면 **1,048,576개**, 합계 **1,114,112개**를 직접 검사. C0 금지 문자·FFFE/FFFF·짝 없는 서로게이트만 자리별 U+FFFD, 정상 서로게이트 쌍 보존. 연속·역순·혼합 서로게이트도 검사. [코드](probes/characters.mts), [출력](logs/characters.log) | 없음. |
| 정상 문자·FDD0~FDEF 비문자 | **보존이 맞음** | 한글·😀·𝄞·`&<>"'`·TAB/LF/CR·U+0085·2028/2029·FDD0~FDEF **32개 전부**·보조 평면 비문자 표본은 sanitizer가 그대로 보존하고 세 재개방 경로도 통과. [기대값·셀](logs/character-outputs.json), [3중 결과](logs/three-readers.json) | FDD0~FDEF를 금지 문자로 추가하거나 삭제할 근거 없음. 아래 정규화 범위 참조. |
| 소비처 3종 | **값 경로 통과 / 정리 서식은 결함** | 비교 위 32개, 정리의 시트명·헤더·값·수식·캐시 결과 통과. 실제 QR 스모크가 만든 manifest의 `A�B`/`C�D`도 ExcelJS·ElementTree·LibreOffice 보존. [정리 기대값](logs/character-outputs.json), [QR](logs/qr-reopen.log), [QR 3중](logs/qr-three-readers.log) | 숫자 서식은 아래 R4-numFmt 수리. “3종 값 경로 통과”를 정리 출력 전체 안전성으로 확대하지 말 것. |
| 시트 이름 | **통과** | 금지 문자 치환·같은 이름 충돌·31 UTF-16 단위 경계에서 정상 쌍을 자르지 않는 처리. 실제 재개방에서 `sheet���`, 긴 이름 두 개의 서로 다른 이름 유지. 커밋 unit의 충돌·절단 단언도 통과. [표본](artifacts/names-and-values.xlsx), [기대값](logs/character-outputs.json), [unit](logs/unit.log) | 없음. |
| backstop 음성 주입 | **선언한 이름·value 범위 통과 / 전체 출력 방어 미완** | 이름·scalar·formula·cache·rich text·hyperlink **6/6**, 모두 `REPORT_INTEGRITY_FAILED`, serializer 호출 **0**. 실제 production worker의 직렬화 직전 값 1곳을 주입해 ko/en 코드 하나·안전 문구·다운로드 0 확인. [주입](logs/backstop-injections.json), [브라우저 오류](logs/worker-backstop-error.log) | value만 검사해서는 아래 `numFmt` 우회를 잡지 못함. |
| **정리 숫자 서식** | **P2 / R4-numFmt / 재검수 필요** | BIFF8 `.xls` **3,584B** → 실제 parser/preflight/engine/output, U+FFFE·FFFF **2/2**: 성공 반환, ExcelJS `2:390: disallowed character.`, ElementTree `xl/styles.xml` invalid token. 실제 브라우저도 결과 1개·실패 0개로 제공. [최소 안전 probe 0/2](logs/style-safety-counterexamples.log), [전 경로](logs/style-boundary.log), [브라우저](logs/style-browser.log), [독립 XML](logs/style-browser-elementtree.json) | 아래 구체 수리 문안 참조. |
| mutant | **검출력 통과** | sanitizer setter만 되돌린 커밋 unit **9 pass/1 fail**. 변경 전 writer를 원본 R3 probe에 bind하면 **0 pass/2 fail**, 실제 재개방 오류. [setter mutant](logs/sanitizer-mutant.log), [변경 전 writer](logs/prefix-writer-original.log) | 첫 mutant는 backstop에 걸려 실패한다. 원본 안전 probe는 안전 거부도 수락하므로 재개방 실패 대조에는 실제 변경 전 writer를 사용했다. |
| 원본 1~3차 probe 4종 | **통과** | 원본 `empty-data-negative` **2/2**(2차 동일 사본도 2/2), 조합 **2/2**, 요소 경계 **5/5**, lexical **32/32**, 모두 무수정. [R1](logs/original-r1.log), [조합](logs/original-combination.log), [경계](logs/original-boundaries.log), [lexical](logs/original-lexical.log) | 없음. 보조는 0을 반환하고 생산 검사가 거부하는 계약 유지. |
| 독립 확장·4차 추가 경계 | **통과** | 독립 확장 **2,880/2,880**; 추가 경계 126건 중 기대값 단언 72/관찰 54, 지정 잘못된 참조 거부 **40/40**; 실제 writer 표본 **29/29** 재개방·행수 일치·잘 형성된 XML. [확장](logs/independent-expanded.log), [추가 경계](logs/new-boundaries.log), [ElementTree](logs/boundaries-elementtree.log) | 계약 밖 XML과 실제 writer 산출을 계속 구분할 것. |
| 원본 3차 행렬·CDATA oracle | **기존 한계 동일 / 비차단** | 원본 2,880행렬은 **2,764 일치/116 불일치**, exit 1. 116건 모두 CDATA 문자에 대한 ExcelJS 누락이며 ElementTree 의미 검사는 해당 profile **192/192**, scanner 불일치 0. [원본](logs/legacy-matrix.log), [교차](logs/legacy-cdata-semantic.log) | 원본 행렬까지 100% 통과했다고 기록하지 말 것. CDATA 문자 삭제나 namespace 지원 확대 요구 없음. |
| 지정 음성 6·양성 4 | **통과** | 음성 **6/6 거부**, 양성 **4/4 수락**, 0/false와 독립 재개방 계수 유지. [출력](logs/data-row-required.log) | 없음. |
| 폭·대량·토폴로지 | **통과** | 폭 경계 `[12,13,47,48,48]`, 기존 잘못된 폭·빈 파일/빈 데이터 음성 모두 거부. 50,000/150,000행 생성 **1,012/2,683ms**, 검사 **61/107ms**, RangeError 0. 150001행 조기 탐지·뒤 시트 폭 거부·`REPORT_TOPOLOGY_INVALID`도 통과. [core](logs/core.log), [토폴로지](logs/early-exit-topology.log) | 없음. |
| 소비처 전수 폭·구성 | **통과** | 브라우저 다운로드 고유 XLSX **13개**(비교 4·정리 4·QR 5)를 별도 XML 파서로 전 열 검사. 비교 9시트/95논리 열/기록 13열의 이름·순서 전건 단언, 정리 5시트, QR 2시트. [수집](logs/consumers-final.log), [전수](logs/consumer-xml.json) | 새 의도적 서식 결함 표본은 일반 스모크 다운로드 13개와 별도 판정했다. |
| 비용·종료성 | **표본 통과** | 650,021셀 pre-scan **122/117/115ms**. 50,000×13·9시트 생성 **5,909ms**, 기존 ZIP 검사 **285/189/173ms**. scanner **60/60**, reference **32/32**, 최대 **835.444/551.401ms**, timeout/RangeError 0. [값 비용](logs/value-scan-cost.log), [생성/검사](logs/performance.log), [scanner](logs/scanner-cost.log), [reference](logs/reference-cost.log) | 서식 방어 추가 뒤 같은 표본 재측정. |
| QR 스모크 플래키 | **기존 대기 경합 / 비차단 인계** | 현행 원본 연속 3회: **실패 1/3, 통과 2/3**. 실패는 sol과 같은 취소 후 재생성 클릭 217행의 detached node. 수동 교정 없이 두 재실행 전체 통과. [실패](logs/qr-bulk.log), [통과2](logs/qr-bulk-2.log), [통과3](logs/qr-bulk-3.log), [DOM 전이](logs/qr-race-events.jsonl) | 아래 원인·한계·테스트 동기화 문안 참조. |
| 사용자 파일 | **통과** | 지정 파일의 기존 안전 사본을 SHA 대조 후 다시 파싱·비교. **713 matched/37 changed/48 added/4 duplicate**, 나머지 0; **9시트·856행·95열·68 col 태그·폭 12~48·잘못된 폭 0**. 54,122B, LibreOffice Summary CSV **99B/9행** 수치 일치. [재측정](logs/user-files.log), [XML](logs/user-xml-independent.json), [CSV](logs/independent-xml-csv.log) | 없음. 신고 사용자 파일에 새 서식 결함이 있다는 뜻이 아니다. |
| 변경 범위 | **통과** | `git diff --stat 3270512..88fa10e`: **8파일 +200/−18**, writer·정리 출력·소비처 회귀·unit·기록만. 입력 parser·compare engine·9시트 report·worker·공용 행수 판정·QR UI·의존성 동일 blob, 폭 계산 함수 바이트 동일. [diff](logs/diff-stat.log), [전체](logs/diff-full.log), [동일 표면](logs/unchanged-surfaces.json) | R4 후속은 좁은 출력 경계·backstop·회귀·기록으로 제한할 것. |
| 기록 | **fix-4 기록 통과 / 새 발견 인계** | R3를 “우리 writer 산출 결함”으로 명시하고 fix-3 임의 XLSX 제외에서 분리했다. U+FFFD 방식·C0 삭제 기각·서로게이트·정상 문자·비용·QR 최초 실패도 기록됐다. [기록 diff](logs/diff-full.log) | R4도 실제 지원 입력→우리 산출 경로임을 추가. 기존 결함이며 fix-4가 만든 회귀로 기록하지 말 것. |

**R4-numFmt의 원인과 도달성.** [정리 output 66행](source/src/features/excel-cleaner/output.ts:66)은 `source.numberFormat`을 sanitizer 없이 `target.numFmt`에 대입한다. 65행의 style 복사도 별도 직렬화 문자열 경로다. [backstop 84행](source/src/utils/xlsxReport.ts:84)은 worksheet 이름과 `cell.value`만 순회하므로 `numFmt`를 검사하지 않는다. 새 반례는 SheetJS의 BIFF8 writer로 실제 `.xls`를 만들고, 제품의 `parseSpreadsheetInput`이 보존한 숫자 서식 `0"A<문자>B"`를 정리 출력이 다시 쓰게 한다. 입력 파서가 임의 XLSX XML을 허용한다고 가정하지 않는다. 입력은 ZIP/XML이 아닌 BIFF8이며, 출력 XLSX에도 수작업 변조가 없다.

```sh
cd /tmp/worklazy-xr-review5/source
source ../env.sh
node --experimental-strip-types --test ../probes/style-safety-counterexamples.mts
# tests 2 / pass 0 / fail 2
# supported XLS number format U+fffe / U+ffff
# error: '2:390: disallowed character.'

node --experimental-strip-types ../probes/style-boundary.mts
# parsedFormat=xls, inputBytes=3584, numberFormat preserved
# outputBytes=10305, unsafeStylesXml=true, preflight warnings=[]
```

두 입력은 LibreOffice도 값 `123`을 읽었다. LibreOffice는 손상된 출력에서도 값을 복구해 CSV로 내보내므로 **LO exit 0 하나로 well-formed XLSX라고 판정할 수 없다**. [독립 결과](logs/style-independent.json). 브라우저도 동일 입력을 정상 검사하고 “정리 완료 · 결과 1개 · 실패 0개”로 XLSX **10,378B**를 제공했다. 이 실제 Blob을 저장해 ExcelJS와 ElementTree의 동일 거부를 확인했다. [U+FFFE 입력](artifacts/style-input-fffe.xls), [실제 브라우저 출력](artifacts/style-browser-fffe.xlsx), [화면](artifacts/style-browser-fffe.png), [U+FFFF 출력](artifacts/style-browser-ffff.xlsx).

변경 전 `3270512`의 writer와 cleaner output만 read-only bind하고 동일 경로를 재실행해 **같은 2/2 재개방 실패**를 확인했다. [변경 전 대조](logs/style-prefix.log). 따라서 **기존 결함을 이번에 발견한 것**이며 fix-4 회귀라고 하지 않는다. 드문 두 코드 포인트를 숫자 서식에 넣는 조건이므로 P1은 아니다. 그러나 지원 입력을 받아 실제 우리 writer가 malformed 결과를 성공으로 제공하므로 P2다. “writer가 만들지 않는 임의 XML”이라는 이유로 비차단 처리할 수 없다. Microsoft Excel GUI의 복구 화면은 실행하지 않았다.

**수정 지시 문안.** 다음 정본에서 `src/features/excel-cleaner/output.ts`의 보존 숫자 서식과 필요한 스타일 문자열 경계, `src/utils/xlsxReport.ts`의 직렬화 전 backstop, 해당 unit·기록을 좁게 허용한다. 적어도 위 `.xls` 입력 두 개가 **재개방 불가능한 XLSX로 성공 반환되지 않게** 할 것. 보존 출력의 `numberFormat` 및 `style.numFmt` 등 동일 필드의 우회 대입을 함께 확인하고, 정상 서식과 숫자 값은 유지한다. 허용된 자리별 U+FFFD를 적용할지, 해당 서식은 기존 `REPORT_INTEGRITY_FAILED`로 안전 종료할지 후속 정본에 명시한다. backstop에도 실제로 직렬화되는 해당 문자열을 포함하고, 값 없는 서식 셀을 포함한 적용 범위를 테스트로 고정한다. 모든 임의 ExcelJS metadata나 범용 XML validator 지원으로 범위를 넓힐 필요는 없다.

이 보고서의 [새 원본 안전 probe](probes/style-safety-counterexamples.mts)를 수정하지 않고 **2/2 pass**로 만들고, 실제 parser→정리→출력 및 브라우저에 같은 fixture를 넣어 결과를 교차 확인할 것. 수락한 결과는 ExcelJS·ElementTree에서 읽혀야 하며 숫자 `123`과 승인된 서식 처리 결과를 보존해야 한다. 안전 거부를 택했다면 기존 ko/en 안내·다운로드 0을 확인한다. 정상 서식, 기존 R3 원본 2건, 문자 보존·3소비처·사용자 파일·폭/행수/비용·공통 회귀도 유지한다. 이 검수에서는 수리 코드를 넣지 않았다.

**문자 보존의 정확한 범위.** sanitizer 자체는 허용되는 CR도 그대로 반환한다. 이후 ExcelJS/XML 재개방의 셀 CR→LF, worksheet 이름 속성의 TAB/LF/CR→공백은 기존 직렬화/파싱 동작으로 sol 기록에 구분돼 있다. 이번 값 표본의 기대값도 이 차이를 명시한다. FDD0~FDEF는 32개 모두 세 reader를 통과해 보존됐다. “비문자”라는 분류만으로 U+FFFE/U+FFFF와 같은 XML 금지 문자로 취급하면 정상적으로 다시 읽히는 데이터를 불필요하게 바꾸게 된다. 유효한 보조 평면 서로게이트 쌍도 같은 이유로 보존한다.

**QR 플래키의 원인과 한계.** [관측 하니스](probes/browser-harness.mjs)는 포트 고정·다운로드 보존 외에 DOM 전이를 수동 관찰하고, 기존 click이 실패한 뒤에만 증거를 수집한다. 제품·테스트의 대기·클릭·단언은 바꾸지 않았다. 실패 실행에서 파일 입력은 `after-export-cancel.csv`로 바뀌었는데, 약 **2424.95ms**에는 이전 생성 버튼이 여전히 활성 상태였다. **2449.22ms**에 버튼이 제거되고 **2465.24ms**에 새 버튼이 생겼다. 이 사이 테스트가 잡은 노드가 떨어져 `Node is detached from document`가 발생했다. sol의 `No element found`와 같은 217행 경합의 다른 타이밍이다.

제품의 `chooseFile`은 `await cleanupResults()` 뒤에 `setBook(undefined)`를 호출하며, cleanup은 먼저 결과를 없앤 뒤 storage.clear를 기다린다. 스모크는 결과가 사라졌다는 조건과 생성 버튼 활성만 기다리므로 이전 workbook의 버튼으로 조건을 만족할 수 있다. 현재 QR 제품 파일은 **5bc6854·3270512·88fa10e·main 모두 blob `5e9be80e2e8babbbe200e130bb8bf3ced496cfaf`로 동일**, 취소 시나리오 코드도 변경 전후 바이트 동일하다. [증거](logs/unchanged-surfaces.json). 새 경계 fixture 3줄을 제외한 **변경 전 QR 테스트**도 같은 현행 빌드 위에서 2회 실행해 모두 통과했다. [이전 테스트1](logs/qr-prefix-smoke.log), [이전 테스트2](logs/qr-prefix-smoke-2.log). 이것을 변경 전 전체 빌드를 재현했다고 기술하지 않는다.

판정은 **기존 스모크 동기화 플래키**다. 현행 표본 실패율은 **1/3(33.3%)**, 이전 테스트 표본은 **0/2**로 작아서 일반 발생률을 추정하지 않는다. 모든 성공 실행에서 stale PDF 다운로드 0·폰트 fallback 중단·새 결과 재생성·외부 요청 0을 유지했다. 이 관찰로 이번 writer 변경의 QR 제품 회귀를 확인했다고 할 근거는 없다. 별도 테스트 수정 때는 새 파일의 파싱/새 모델 준비 완료를 기다린 뒤 새 생성 버튼을 클릭하도록 동기화하고 취소 계약 단언은 유지할 것. 고정 sleep이나 실패 무시로 게이트를 낮추지 않는다.

**비용 판정.** 기존 ZIP 검사의 직전 **262/187/175ms** 대비 이번 **285/189/173ms**는 **+8.78/+1.07/−1.14%**다. 생성은 **5,717→5,909ms(+3.36%)**이고 값 backstop **122/117/115ms**는 생성 시간의 약 2%다. 기존 ZIP 검사와 새 값 검사는 측정 대상·시점이 다르므로 같은 수치로 섞지 않았다. 생성 포함 프로세스 max RSS **1,344,156KiB**는 backstop 단독 메모리가 아니다. 8MB scanner/reference 입력은 각각 10초 제한 아래 종료했고, 현재 표본에서 급격한 비용 증가 증거는 없다.

| 공통 검증 명령 | 실제 결과 | 원출력 |
|---|---|---|
| `./node_modules/.bin/tsc -b` | exit 0 | [tsc](logs/tsc.log) |
| `npm run test:unit` | **266/266**, exit 0 | [unit](logs/unit.log) |
| `npm run build` | **2,835 modules·61페이지**, exit 0 | [build](logs/build.log) |
| `npm run test:static` | startup recovery **104문서**, exit 0 | [static](logs/static.log) |
| `npm run test:excel-compare` | exit 0 | [compare](logs/excel-compare.log) |
| `npm run test:excel-cleaner` | exit 0 | [cleaner](logs/excel-cleaner.log) |
| `npm run test:qr-bulk` | 최초 exit 1, 동일 원본 재실행 2회 exit 0; 위 플래키 판정 | [최초](logs/qr-bulk.log), [최종](logs/qr-bulk-3.log) |
| `npm run test:browser` | TEST_SCOPE 미설정 전체 Excel·Word·PDF, exit 0 | [browser](logs/browser.log) |
| `npm run bundle:measure` | **80 JS/1 CSS**, exit 0; 브라우저 종료 뒤 실행 | [bundle](logs/bundle.log) |
| `npm run css:orphans` | orphan **0**, exit 0 | [CSS](logs/css-orphans.log) |
| `node tests/tool-registry-routes.mjs` | **20개**, 누락/초과/중복 0 | [registry](logs/registry.log) |
| `git diff --check 3270512..88fa10e`, `5bc6854..88fa10e`, worktree | 모두 exit 0 | [diff-check](logs/diff-check.log) |

새 UI·ko/en 문구·URL·SEO/정적 입력·광고 배치/격리 경로·서버 전제·의존성 변경은 없다. static/registry/unit 및 실제 ko/en 안전 오류 경로를 확인했다. 별도 Gemini 시각 검수·배포는 하지 않았다.

**실행 중 비제품 실패 기록.** 최초 구형 lexical mutant는 검수 전용 `mutant/artifacts` 디렉터리를 빠뜨려 bwrap 시작에서 실패했다. 디렉터리만 만든 재실행은 기대한 **16 pass/16 fail**을 재현했다. [최초](logs/mutant-lexical.log), [정정 실행](logs/mutant-lexical-corrected.log). 구형 LibreOffice 묶음은 이번에 이름이 달라진 CSV 보고서 두 파일을 찾지 못한다는 메시지를 냈다. 해당 하니스 경로만 실제 `csv-report-fffe/ffff.xlsx`로 정정해 재실행했다. [최초](logs/libreoffice.log), [정정](logs/libreoffice-corrected.log). 이와 별개인 신규 3중 검사는 처음부터 실제 34개 전체 파일의 존재·내용을 단언해 통과했다. javaldx/dconf 경고는 보존했다. 원본 CDATA 행렬 exit 1은 알려진 oracle 한계, mutant exit 1은 기대 실패, **새 style 안전 probe exit 1은 미해결 제품 결함**으로 구분한다.

**불변·인계.** [시작](start-state.json)·[종료](end-state.json)의 HEAD·branch·main이 같고 status는 모두 빈 문자열이다. 대상 **추적 파일 2,376개 SHA 변경 0**, 기존 probe·검수/sol artifacts·사용자 안전 사본·열린 문서를 포함한 **보호 파일 731개 변경 0**, archive 소스의 **2,376개 파일도 원 archive와 바이트 차이 0**이다. [불변 대조](state-comparison.json). 원 워킹트리에서는 필수 공통 규칙 선독만 했고, 사용자 재실측은 4차 안전 사본의 동일 SHA 입력 두 개를 다시 복사해 사용했다. 원 워킹트리 제품 코드·진행 중 U4 작업·`/tmp/worklazy-dc-impl`에는 접근/산출물을 만들지 않았다. sol worktree 수정·커밋·push·브랜치 전환도 없다. 이번 기록은 추적 파일 대신 이 보고서에 남겨 Claude 취합 입력으로 전달한다.

재생성 [사용자 보고서](artifacts/user-file-report.xlsx)의 SHA-256은 `08a0e3b301fa840a08dbe1c1e1220d5e40a97bf0f67ea7ad872b6945eaec0118`이다. 입력 두 개의 SHA는 각각 `3152fb517e80370c5a3c8a80aadddf6f3066bb69bd421c2657ddabf3d296a4a9`, `faab6f10958de04faca2f2bc49dfd001bd8d7ac6b43e40065ea1ecf5677319cf`로 기존 사용자 파일 기록과 같다.

**수리·재검수 통과 뒤 배포 후보 조건:** main `cdb4007`의 최신 상태를 재확인하고 `ac9cc4a → 64af7b3 → cbe491a → 3270512 → 88fa10e → R4 수리` 순서로 반영하며 공통 기록 두 파일을 취합하고, main 교집합·공통/Excel 회귀·main 문서 비교 검증을 다시 통과시킨 뒤 후속 Excel 계획보다 먼저 통합할 것 — **현재 후보 미승인**. 현재 main과 실행 코드 교집합은 없고 공통 파일은 `CHANGELOG.md`·`docs/review-notes.md` 두 개다. [교집합](logs/merge-intersection-final.json).

**[수정 후 재검수]**
