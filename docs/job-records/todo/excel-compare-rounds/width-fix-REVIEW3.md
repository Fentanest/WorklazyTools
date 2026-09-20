**[수정 후 재검수] — 자체 닫힘 태그 소비 R1은 해소됐지만, 공용 판정기의 문자 내용·엔티티 해석 결함 2건(P2)이 남아 있다.** 원본 probe 무수정 실행과 기존 필수 회귀는 모두 통과했다. 독립 확장 2,880조합은 **2,600 일치 / 280 불일치**이고, 최소 반례 32건은 **16 pass / 16 fail**이다. 사용자 파일의 열 폭과 비교 결과는 정상이다. 제품·테스트 추적 파일을 수정하지 않았다. — Codx, 2026-09-07

**대상·실행 게이트·재현 환경**

- 대상 `/tmp/worklazy-xr`, 브랜치 `excel-report-width-20260907`, HEAD **`cbe491a4dca668b2dd6cb84f817b27866ef271bd`**. 기준 `5bc6854175331bdd73b267784d9633cdccda8446` → `ac9cc4a` → `64af7b3` → `cbe491a` 계보를 확인했다. main은 시작·종료 모두 **`cdb4007faea277ffc3ae9f3f7f4fe6fd8b8ba7be`**다. [계보](logs/ancestry.log), [시작 상태](start-state.json).
- `PROJECT_RULES.md` 전문을 첫 파일 읽기로 실행한 뒤 AGENTS, 1·2차 검수 보고와 원본 probe, fix-2 지시서, sol REPORT·로그, 관련 review-notes와 대상의 열린 X-A 실행 문서를 읽었다. 대상 worktree의 열린 문서는 이번 판정과 상반된 지시가 없다. [열린 문서 원문](logs/open-plan-gate.log).
- **`git archive cbe491a…`**를 [source/](source/)에 풀고 의존성·vendor 내용을 사본으로 복사했다. archive SHA-256 **`2c3433a12db12359edea34b0ffe473e0eac8cecb309cf0efd291a45604d2811c`**. 사본 전용 Git metadata/index는 기존 unit의 `git ls-files`용이며 커밋을 만들지 않았다. [준비 코드](probes/setup.py), [출력](logs/setup.log).
- 아래 명령은 별도 표시가 없으면 `cd /tmp/worklazy-xr-review3/source; source ../env.sh` 환경이다. [env.sh](env.sh)는 **`NODE_OPTIONS=--max-old-space-size=4096`**, 전용 TMPDIR/npm cache/compile cache, offline npm, TEST_SCOPE 미설정을 고정한다. 전체 실행·exit·시간은 [checks.jsonl](checks.jsonl), 순차 실행기는 [common-suite.py](probes/common-suite.py)다.
- 브라우저는 **`npm run preview -- --host 127.0.0.1 --port 4370 --strictPort`**에서 직렬 실행했다. 기존 QR proxy의 port 0 요청만 저장소 밖 [하니스](probes/browser-harness.mjs)로 4371에 고정하며 포트 점유 시 실패한다. 하니스는 다운로드를 보존하고 테스트 단언을 바꾸지 않는다. build 종료 후 브라우저를 시작하고, 모든 브라우저와 preview 종료 뒤 bundle의 내부 build를 실행했다. [preview 명령](logs/preview.log), [종료 증거](logs/preview-lifecycle.json).

**항목별 판정**

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| 잔존 R1 원본 조합 | **통과 / 해당 원인 해소** | `node --experimental-strip-types --test /tmp/worklazy-xr-review2/probes/empty-style-plus-empty-string.mts`를 아래 read-only bind로 **원본 무수정 실행**, **2/2 pass**. 실제 데이터 0·공용 보조 0·생산 `REPORT_INTEGRITY_FAILED`. [명령·TAP](logs/original-combination.log) | 없음. 자체 닫힘 태그가 다음 형제를 삼키던 문제를 다시 같은 결함으로 보고하지 않는다. |
| 1·2차 원본 음성 | 통과 | 각 원 경로의 `empty-data-negative.mts` **2/2 + 2/2 pass**. [1차 원본](logs/original-r1.log), [2차 사본](logs/original-r2-r1.log) | 없음. 보조 함수는 **0을 반환**, 거부는 생산 검사다. |
| 자체 닫힘 row/c/si/t·따옴표·공백 | 통과 | 원본 `element-boundaries.mts` **5/5**; 독립 행·셀·문자열 경계와 큰따옴표 안 작은따옴표, 작은따옴표 안 큰따옴표, 실제 `>`·`/`, multiline 속성도 일치. [원본 경계](logs/original-boundaries.log), [독립 행렬](logs/independent-matrix.log) | 없음. 이 범위의 스캐너 전환은 실제 개선이다. |
| **문자 내용 경계** | **P2 / R1-text** | `node --experimental-strip-types --test ../probes/lexical-counterexamples.mts`: `<v><!-- nothing --></v>`·빈 PI·빈 CDATA, inline/shared `<t>`, 빈 주석만 있는 `<f>`를 데이터로 오인. 실제 0, scanner/helper 1, 생산 accepted. [최소 반례 TAP](logs/lexical-counterexamples.log), [상세 JSON](logs/lexical-counterexamples.json) | 아래 R1-text 지시대로 raw XML 길이를 실제 문자·수식 존재와 구분할 것. |
| **엔티티 해석** | **P2 / R2-entities** | 같은 probe: `r="&#50;"`·`r="&#x32;"`는 실제 1행인데 0/거부; `t="&#115;"`로 빈 shared string을 참조하면 실제 0인데 1/수락; `<v>&#49;</v>`의 유효 인덱스도 0/거부. | 아래 R2-entities 지시대로 관련 속성과 값의 문자 참조를 해석할 것. |
| 주석·PI·CDATA가 요소 사이에 있는 경우 | 통과 | 독립 행렬 각 **192/192**. 주석·CDATA 안의 가짜 row/c/v를 집계하지 않는다. 최소 반례도 통과. | 값 요소 **안쪽** 실패와 구분할 것. “주석을 건너뛰므로 값도 정확하다”는 추론은 성립하지 않는다. |
| 엔티티 일반 문자·namespace 접두 | 제한 확인 | `&gt; &quot; &apos; &amp; &lt;` 텍스트와 `x:r`/`x:t` decoy 속성은 통과. `x:row`/`x:c`/`x:t`는 **ExcelJS와 scanner가 모두 무시**한다. [ElementTree 교차](logs/lexical-elementtree.json), [LibreOffice](logs/libreoffice-summary.json) | 아래 “oracle 한계”를 계약과 기록에 반영. 양쪽의 0 일치를 일반 namespace 지원 통과로 쓰지 말 것. |
| 잘린 XML·긴 속성·무한 루프 | 표본 통과 | `python3 ../probes/scanner-cost.py`: **15종 × 4크기 = 60/60**, 각 독립 프로세스 10초 상한. 미완성 태그·따옴표·row/v·주석·CDATA·PI, `<` 반복, 200만 자체 닫힘 셀, 깊은 동명 태그, 속성 없는 태그, 빈 sheetData. 최대 8MB, 검사 최대 **891.359ms**, timeout/RangeError 0. [전체 비용](logs/scanner-cost.log) | XML 전체 유효성 검사 통과를 뜻하지 않는다. 이번 요구의 종료성과 비용을 직접 확인했다. |
| 독립 전수 조합 | **미통과** | `node --experimental-strip-types ../probes/independent-matrix.mts`: **2,880 = 2,600 일치 + 280 불일치**, exit 1. 각 시트의 재개방 행 수·공용 전체 계수·maximum=1·보조 계수·개별 ZIP 생산 수락을 모두 대조. [원출력](logs/independent-matrix.log), [전건 결과](logs/independent-matrix-results.json) | 기본 192 통과만으로 확장 문법 정확성을 승인하지 말 것. CDATA oracle 한계군을 분리해도 **152건 불일치**가 남는다. |
| mutant | 기대 실패 재현 | 수정 전 공용 함수만 read-only bind: 커밋 대상 unit **24 pass / 4 fail**, Matrix65 포함, exit 1. 독립 행렬도 **2,042 일치 / 838 불일치**, 기본 192부터 **11건 실패**. [unit mutant](logs/mutant-unit.log), [독립 mutant](logs/mutant-independent.log), [mutant 전건](mutant/logs/independent-matrix-results.json) | mutant 검출력은 확인됐지만 현행의 남은 불일치를 상쇄하지 않는다. |
| 지정 음성 6·양성 4 | 통과 | `node --experimental-strip-types ../probes/data-row-required.mts`: **6/6 거부, 4/4 수락**, 실제 데이터 행 수와 보조 계수 일치. [원출력](logs/data-row-required.log) | 없음. |
| custom-width·폭 경계·대량 | 통과 | `node --experimental-strip-types ../probes/core.mts`: 누락·NaN·±Infinity·0·음수·빈 문자열·공백 폭, 헤더 전용·시트 없음·0B·PK만·뒤 시트 잘못된 폭 모두 거부. 폭 경계 **[12,13,47,48,48]**. **50,000/150,000행** 생성·검사 완료, RangeError 0. [core](logs/core.log) | 없음. 폭 계산 수정은 유효하다. |
| 토폴로지·조기 종료·안전 오류 | 통과 | `early-exit-topology.mts`: 150001행의 첫 값 탐지, 앞 시트 데이터 존재 뒤 셋째 시트 잘못된 폭 거부, 메모리 주입 `REPORT_TOPOLOGY_INVALID`. `worker-safe-error.mjs`: ko/en 안전 안내, 오류 코드 하나, 다운로드 0. [토폴로지](logs/early-exit-topology.log), [worker](logs/worker-safe-error.log) | 없음. |
| 소비처 3종 다운로드 | 통과 | `python3 ../probes/collect-results.py`: 비교 4개·정리 4개·QR 1개, **고유 XLSX 9개 전 열 폭 유한 양수**. 비교 9시트/95논리 열, 기록 시트 13개 헤더 전건 단언; 정리 5시트/31~33열; QR 2시트/10열. [전수 XML](logs/consumer-xml.json), [수집 결과](logs/consumers.log) | 없음. 원 다운로드 경로와 저장 파일 대응은 [artifact-origins.jsonl](artifact-origins.jsonl). |
| 비용 | 표본 통과 | 50,000×13·9시트·2,525,550B: 생성 **5,892ms**, 검사 **279/192/192ms**. sol 256/190/178 대비 +8.98/+1.05/+7.87%, 2차 279/186/186 대비 0/+3.23/+3.23%. [실측](logs/performance.log), [비교](logs/performance-comparison.json) | 이 표본에서 차수 증가나 큰 비용 회귀는 없다. 검사 시간은 생성의 4.74/3.26/3.26%; 전체 프로세스 max RSS 1,369,760KiB는 생성 포함이며 검사 단독 메모리가 아니다. |
| 사용자 파일 | 통과 | `user-files.mts` 재파싱·비교·생성: **713 matched / 37 changed / 48 added / 4 duplicate**, 나머지 0. **9시트·856행·95논리 열·68 col 태그·폭 12~48·잘못된 폭 0**. 54,122B. LibreOffice exit 0, Summary CSV **99B/9행**, 전 수치 일치. [실측](logs/user-files.log), [독립 XML](logs/user-xml-independent.json), [LibreOffice](logs/libreoffice.log), [CSV 단언](logs/independent-xml-csv.log) | 없음. Excel GUI 시각 검사로 확대 해석하지 않는다. |
| 검토 범위 | 통과 | `git diff --stat 64af7b3..cbe491a`: **4파일 +350/−31**, 공용 함수·unit·CHANGELOG·review-notes뿐. 폭 계산·소비처 3종·엔진·worker·UI·의존성 변경 0. [diff](logs/diff-stat.log), [전체 diff](logs/diff-full.log), [동일 blob](logs/unchanged-surfaces.json) | 후속 수리도 이 공용 해석·unit·기록 범위로 제한할 것. |
| 기록 상태 | 기존 지시 반영 / 추가 정정 필요 | review-notes 17~21행에 자체 닫힘 소비 원인·스캐너 선택/정규식 기각·192조합·mutant·실측·보조 반환 계약 기록. CHANGELOG 간결한 Codx 서명. | 현행 미해결 문자/엔티티·oracle 한계를 추가. 앞선 11행의 “비어 있지 않은 v·is만”은 fix-2의 f 수식 포함 설명과 통일할 것(비차단 표현 정리). |
| 최종 | **수정 후 재검수** | 자체 닫힘 R1 수리는 재현됐지만 확장 정확성 계약은 충족하지 못했다. 일반 회귀 전부 통과와 구분해 판정한다. | **현재 cbe491a를 배포 후보로 승인하지 않는다.** |

**원본 무수정 실행의 증거**

원본 파일을 복사·편집하거나 단언을 교체하지 않았다. 원본이 import하는 source만 cbe491a archive로 read-only bind하고, 하드코딩된 출력 artifacts 경로만 이번 검수 artifacts로 bind했다. 예:

```sh
bwrap --ro-bind / / \
  --bind /tmp/worklazy-xr-review3 /tmp/worklazy-xr-review3 \
  --ro-bind /tmp/worklazy-xr-review3/source /tmp/worklazy-xr-review2/source \
  --bind /tmp/worklazy-xr-review3/artifacts /tmp/worklazy-xr-review2/artifacts \
  --dev-bind /dev /dev --proc /proc \
  --chdir /tmp/worklazy-xr-review3/source \
  node --experimental-strip-types --test /tmp/worklazy-xr-review2/probes/empty-style-plus-empty-string.mts
```

| 원본 | 실행 전후 동일 SHA-256 | 결과 |
|---|---|---|
| 1차 `empty-data-negative.mts` 및 2차 동일 사본 | `2b6646058365953cdb7efb362c416bb19d2a121a12d267c58399dd4dff7c2ccc` | 각각 2/2 |
| 2차 `empty-style-plus-empty-string.mts` | `282bdc28708c2224ad7019f70cbc39bb284cb226019d1e4d7a304bda23c57692` | 2/2 |
| 2차 `element-boundaries.mts` | `692c967543d38a6378cd37556abd4042282bfc819f54ac90c968f7daa4637f5b` | 5/5 |

**R1-text — 실제 문자 대신 raw markup 길이를 센다 (P2)**

위치는 [xlsxReportDataRows.mjs:41](source/src/utils/xlsxReportDataRows.mjs:41), [46](source/src/utils/xlsxReportDataRows.mjs:46), [52](source/src/utils/xlsxReportDataRows.mjs:52), [60](source/src/utils/xlsxReportDataRows.mjs:60), [91](source/src/utils/xlsxReportDataRows.mjs:91)이다. 태그 검색은 주석·CDATA·PI를 건너뛰지만, 반환하는 `content`는 여전히 원본 substring이다. 이어지는 `.length > 0`이 문자 데이터가 없는 마크업의 길이를 값으로 인정한다.

```xml
<row r="2"><c r="A2" t="str"><v><!-- nothing --></v></c></row>
```

이 표본은 **ExcelJS 재개방 0행 → 공용 판정 1행 → 생산 accepted**다. [XLSX](artifacts/lexical-empty-comment-v.xlsx), [LibreOffice CSV](libreoffice-csv/lexical-empty-comment-v.csv)는 `Header` 한 줄/7B다. 빈 PI·빈 CDATA, inline/shared `<t>`도 같은 결과다. `<f><!-- nothing --></f><v/>` 역시 실제 수식이 없는데 수식 존재로 통과한다. 반대로 `<v>1<!-- no text --></v>`로 실제 문자열 인덱스 1을 담으면 raw markup이 숫자 정규식에 걸려 **실제 1행을 0행**으로 센다.

**수정 지시:** 공용 함수에서 f/v/t의 의미 있는 문자 내용을 요소 경계와 분리해 읽는다. 주석·PI는 문자가 아니며 빈 CDATA도 빈 값이다. 값의 공백은 유지하고 숫자 0·boolean false·실제 수식은 보존한다. shared string 인덱스는 문자 조각을 합친 값으로 판정한다. 생산과 보조에 별도 판단 분기를 만들지 않는다. 위 최소 반례 중 이 원인의 12건 및 기존 원본 probe가 통과해야 한다. 비어 있지 않은 CDATA의 수리 기준은 아래 oracle 한계를 먼저 반영해야 하며, 단순히 ExcelJS와 맞추려고 실제 문자를 삭제하면 안 된다.

**R2-entities — r/t 속성과 shared-string 인덱스가 미해석 문자열이다 (P2)**

위치는 [xlsxReportDataRows.mjs:27](source/src/utils/xlsxReportDataRows.mjs:27), [47](source/src/utils/xlsxReportDataRows.mjs:47), [49](source/src/utils/xlsxReportDataRows.mjs:49), [178](source/src/utils/xlsxReportDataRows.mjs:178)이다. `xmlAttribute`가 문자 참조를 그대로 반환하고 `Number`/`=== "s"`/숫자 정규식이 이 raw 문자열에 적용된다.

```xml
<!-- 실제 행 번호 2: 정상 값이 있는데 거부 -->
<row r="&#50;"><c r="A2" t="str"><v>visible</v></c></row>

<!-- 실제 셀 형식 s: index 0의 실제 shared string은 빈 문자열인데 수락 -->
<row r="2"><c r="A2" t="&#115;"><v>0</v></c></row>
```

첫 표본은 ExcelJS·ElementTree·LibreOffice 모두 데이터가 있는 것으로 확인했고 CSV는 `Header`, `visible`의 15B/2행이다. 둘째 표본은 세 독립 경로 모두 빈 값이고 CSV는 7B/1행이다. [행 번호 XLSX](artifacts/lexical-decimal-row-number.xlsx), [셀 형식 XLSX](artifacts/lexical-entity-cell-type-empty-shared.xlsx), [shared index XLSX](artifacts/lexical-entity-shared-index.xlsx).

**수정 지시:** 해당 공용 해석 경로에서 XML의 기본 명명 문자 참조와 십진/16진 숫자 참조를 단일 단계로 해석한 다음 행 번호·셀 형식·shared index를 판정한다. 잘못된 참조는 정상 값으로 우회시키지 않고 종료성과 비용을 유지한다. 범용 DTD/외부 엔티티 지원을 추가할 필요는 없다. 원본 `r="&#50;"`, `r="&#x32;"`, `t="&#115;"`, `<v>&#49;</v>` 네 최소 반례 및 확장 엔티티 192조합이 원본 단언 그대로 일치해야 한다.

이 두 결함은 ExcelJS로 뼈대를 생성하고 ZIP 안 XML에 지시된 문법 변형을 넣은 **독립 검사 fixture**에서 발견했다. 현재 보고서 writer가 이러한 주석·PI·문자 참조 형식을 출력한다거나 사용자 신고 파일에 이 결함이 있다고 주장하지 않는다. 이번 검수 지시의 스캐너/확장 조합 정확성 범위에서 판정한다. 최소 fixture 32개의 모든 `.xml`은 별도 Python ElementTree로 잘 형성됨을 확인했다. [독립 검증 코드](probes/validate-artifacts.py), [실행 결과](logs/independent-xml-csv.log).

**독립 전수 조합과 oracle 한계**

[independent-matrix.mts](probes/independent-matrix.mts)는 커밋 unit의 matrix 생성 함수나 값 판정기를 재사용하지 않는다. 셀 6종(자체 닫힘 c/빈 c/v/shared/inline/f) × 값 8종(빈 문자열/공백/0/false/긴 문자열/양쪽 따옴표/>/슬래시) × 배치 4종(서식 셀 앞/뒤, 행 간격, 높이만 있는 선행 행)의 **192조합**을 별도로 구현하고 15개 문법 profile로 확장했다. shared-string 앞에는 별도의 자체 닫힘 si/t도 넣어 인덱스 이동을 검사한다. 생성 fixture는 ExcelJS로 다시 열고, 재개방 셀의 `null/undefined/""` 제외 여부로 행을 독립 집계한다. 기본·확장 모두 시트별로 비교하고, 각 사례를 단독 1시트 ZIP으로도 만들어 생산 검사 결과를 대조해 합계 상쇄·다른 시트의 정상 데이터에 의한 거짓 통과를 막았다.

| 문법 profile | 건수 | 일치 | 불일치 |
|---|---:|---:|---:|
| 기본 / 큰따옴표 / 작은따옴표 / 공백·개행 | 768 | 768 | 0 |
| 요소 사이 주석 / PI / CDATA | 576 | 576 | 0 |
| 문자 안 주석 / PI / 빈 CDATA | 576 | 540 | 36 |
| 문자를 CDATA로 표현 | 192 | 64 | 128 |
| 숫자 문자 참조로 속성·값 표현 | 192 | 76 | 116 |
| 빈 t/v 자체 닫힘 | 192 | 192 | 0 |
| 접두 row/c/v/is/t/f | 192 | 192 | 0 |
| 이름공간 접두 decoy 속성 | 192 | 192 | 0 |
| **합계** | **2,880** | **2,600** | **280** |

**ExcelJS 일치만으로 XML 의미 정확성을 증명할 수 없는 두 경우도 실측했다.**

- **비어 있지 않은 CDATA:** `<t><![CDATA[visible]]></t>`는 실제 문자 `visible`이 있다. scanner=1, ExcelJS=0, LibreOffice=1이다. 설치된 ExcelJS `parse-sax.js`가 cdata 이벤트를 구독하지 않는 구현과 일치한다. [재현 코드](probes/oracle-limits.mts), [출력](logs/oracle-limits.log), [XLSX](artifacts/oracle-visible-cdata.xlsx), [LibreOffice CSV](libreoffice-csv/oracle-visible-cdata.csv). 따라서 해당 profile의 128건 전체를 “scanner가 틀렸다”로 합산해 수정 지시하지 않는다. **이 profile 전부를 제외해도 152건의 확정 불일치가 남는다.**
- **같은 SpreadsheetML namespace에 연결한 x 접두:** ExcelJS와 scanner는 x:row/c/t를 모두 무시해 0으로 일치한다. ElementTree는 세 최소 표본을 모두 실제 1행으로 읽고, LibreOffice도 x:row 표본에서 `visible`을 보존한다. [접두 XLSX](artifacts/lexical-prefixed-row.xlsx), [CSV](libreoffice-csv/lexical-prefixed-row.csv), [namespace 교차 JSON](logs/lexical-elementtree.json). **192/192 일치는 일반 namespace 지원을 뜻하지 않는다.**

**검증 계약 보완 인계:** 현재 생성되는 접두 없는 ExcelJS 직렬화와 유효 XML 전체의 의미 검증을 구분해야 한다. 후속 정본에서 CDATA·접두 XML은 ExcelJS 일치와 XML 의미 보존 중 무엇을 단언하는지 먼저 명시하고, 일반 XML 의미 판정에는 ElementTree/LibreOffice 교차 증거를 사용해야 한다. 이번 확정 P2 두 건은 이 선택과 무관하게 ExcelJS·ElementTree·LibreOffice가 같은 기대 결과를 보인다. 현행을 승인하기 위해 namespace/CDATA 사례를 조용히 제외하거나 ExcelJS의 누락에 맞춰 실제 데이터를 버리는 수리는 허용할 수 없다.

**비용·종료성의 실측 범위**

[scanner-cost.py](probes/scanner-cost.py)는 각 입력을 별도 프로세스로 실행하고 한 호출 묶음에 10초 timeout을 강제했다. 250KB/1MB/4MB/8MB, 각 3회 측정이다. 큰따옴표 속성 8MB **71.923/52.593/49.391ms**, 닫히지 않은 따옴표 8MB **59.722/55.503/53.104ms**. 자체 닫힘 c 200만 개와 뒤 정상 값은 **757.163/891.359/889.865ms**, 깊은 동명 row 약 47만 겹도 **247.157/245.664/225.751ms**로 종료했다. 큰 입력에서 선형에 가까운 증가를 보이고 이 표본의 무한 루프·재귀 stack overflow는 없다. 속성 없는 태그는 ordinal 대체 경로로 기대값을 반환했다. 잘린 입력 표본은 데이터 0을 반환했다. **이는 완전한 XML validator나 모든 손상 문서의 거부 보장이 아니다.** [60건 수치](logs/scanner-cost.json).

**공통 검증 원출력**

| 명령 | 결과 | 원출력 |
|---|---|---|
| `./node_modules/.bin/tsc -b` | exit 0 | [tsc](logs/tsc.log) |
| `npm run test:unit` | exit 0, **262/262** | [unit](logs/unit.log) |
| `npm run build` | exit 0, 2,835 modules, 정적 61페이지 | [build](logs/build.log) |
| `npm run test:static` | exit 0, startup recovery 104문서 | [static](logs/static.log) |
| `npm run test:excel-compare` | exit 0, 9시트·안전 오류·다중쌍 | [compare](logs/excel-compare.log) |
| `npm run test:excel-cleaner` | exit 0, 다운로드·수식·입력 불변·mobile | [cleaner](logs/excel-cleaner.log) |
| `npm run test:qr-bulk` | exit 0, 재실행 없이 첫 실행 통과 | [QR](logs/qr-bulk.log) |
| `npm run test:browser` | exit 0, TEST_SCOPE 미설정 전체 Excel·Word·PDF | [browser](logs/browser.log) |
| `npm run bundle:measure` | exit 0, 80 JS/1 CSS, 브라우저 종료 후 실행 | [bundle](logs/bundle.log) |
| `npm run css:orphans` | exit 0, orphan 0 | [CSS](logs/css-orphans.log) |
| `node tests/tool-registry-routes.mjs` | exit 0, 20개, 누락·초과·중복 0 | [registry](logs/registry.log) |
| `git diff --check 64af7b3..cbe491a`, `5bc6854..cbe491a`, 대상 worktree diff | 모두 exit 0 | [diff-check](logs/diff-check.log) |

기존 1·2차에서 통과한 기능·폭·토폴로지·안전 오류 회귀는 이번에도 통과했다. 신규 UI·ko/en 문구·URL·SEO·정적 입력·광고 경로·서버 전제·의존성 변경이 없음을 diff로 확인했다. 해당 공통 계약은 unit/static/registry 및 ko/en 안전 오류 실행으로 확인했다. 새 제품 UI가 없으므로 이번 검수는 별도 Gemini 시각 검수·배포를 수행하지 않았다.

**기록·불변·인계 상태**

- [시작](start-state.json)과 [종료](end-state.json)의 HEAD·브랜치·main 동일, `git status --porcelain=v1` 모두 빈 문자열. **대상 추적 파일 2,376개 SHA 변경 0**, 기존 검수 probe/artifacts·sol artifacts·열린 실행 문서·지정 사용자 입력을 포함한 **보호 파일 102개 변경 0**. archive 사본 추적 파일 2,376개도 원 archive와 바이트 차이 0. [대조 JSON](state-comparison.json), [대조 출력](logs/immutability.log).
- sol worktree에 쓰기·빌드·fixture 생성을 하지 않았고 커밋·push·브랜치 전환은 없다. 원 worktree에서는 공통 규칙 선독, 최초 열린 계획서 **파일명 목록 조회**, 지정 사용자 XLSX 2개 읽기만 수행했으며 제품 코드를 읽거나 변경·실행하지 않았다. `/tmp/worklazy-dc-impl`에는 접근하지 않았다. 이후 문서 내용 검사와 모든 실험은 대상 또는 archive에서 수행했고 **새 산출물은 `/tmp/worklazy-xr-review3/` 안에만** 남겼다.
- 실패 원출력을 보존했다. 현행 독립 행렬 exit 1·최소 반례 exit 1은 제품 판정 불일치이며, mutant 두 실행 exit 1은 기대 실패다. 기본 회귀는 모두 첫 실행 exit 0. LibreOffice의 javaldx/dconf 경고는 보존했으나 변환 exit 0·8개 CSV 내용 단언은 통과했다.
- 기존 review-notes/CHANGELOG는 수정 금지에 따라 그대로다. 이번 판단·수치·수정 지시는 이 REPORT를 Claude 취합 입력으로 전달한다. sol이 “범위 밖 발견 없음”이라고 보고한 것과 달리 이번 검수에서는 위 oracle 한계를 추가로 확인했다. 코드 후속 지시 정본에 이 경계를 포함해야 한다.

현재 main과 기준→폭 브랜치 변경의 교집합은 **CHANGELOG.md·docs/review-notes.md 두 파일뿐**이고 실행 코드 교집합은 없다. [최종 교집합](logs/merge-intersection-final.json). 실제 병합은 하지 않았다.

**수리·재검수 통과 후의 배포 후보 조건:** 최신 main `cdb4007`(또는 그 후속)을 다시 확인하고 그 위에 `ac9cc4a → 64af7b3 → cbe491a → 후속 수리`의 의존 순서를 보존해 반영하며 공통 기록 두 파일을 취합하고, 갱신된 main과 교집합·공통/Excel 회귀 및 main의 문서 비교 검증을 다시 통과시킨 다음 후속 Excel 계획보다 먼저 통합할 것 — **현재 커밋은 미승인**.

재생성 사용자 보고서: [user-file-report.xlsx](artifacts/user-file-report.xlsx), SHA-256 **`40df653bab44e143a079d7663ffe6db9df09c78a3b3ebad19c0c2a9bf9c6ef1e`**.

**[수정 후 재검수]**
