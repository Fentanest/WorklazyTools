**[수정 후 재검수] — R1-text·R2-entities는 해소됐다. 다만 실제 writer가 만드는 XLSX의 새 경계 결함 R3-writer(P2)를 확인했으므로 배포 후보 승인은 보류한다.** 원본 최소 반례 **32/32**, 새 독립 확장 **2,880/2,880**, 기존 회귀·공통 검증은 통과했다. R3는 fix-3가 도입한 회귀가 아니라 이번에 발견한 기존 결함이다. U+FFFE·U+FFFF가 든 정상 UTF-8 CSV를 읽어 보고서를 만들면, 생성 검사는 통과하지만 ExcelJS와 독립 XML 파서가 결과를 거부한다. XML 변조 없이 재현했다. — Codx, 2026-09-07

**대상·실행 게이트·환경**

- 대상 `/tmp/worklazy-xr`, 브랜치 `excel-report-width-20260907`, HEAD **`3270512f300ddbbf592da293fcef908bba55bec2`**. 계보 `5bc6854 → ac9cc4a → 64af7b3 → cbe491a → 3270512`, main **`cdb4007faea277ffc3ae9f3f7f4fe6fd8b8ba7be`**를 확인했다. [계보](logs/ancestry.log), [시작](start-state.json), [종료](end-state.json).
- `PROJECT_RULES.md` 전문을 첫 파일 읽기로 실행하고 AGENTS, 3차 보고·원본 최소 반례·독립 검증 코드·oracle 한계, 1·2차 보고, fix-3 정본과 sol 보고·관련 로그, 대상의 열린 작업 문서를 읽었다. 대상의 열린 문서는 X-A 실행 사본 하나이며 상반된 지시가 없다. [열린 문서](logs/open-plan-gate.log).
- **`git archive 3270512`**를 [source/](source/)에 풀어 검증했다. archive SHA-256 **`2d5bfd64d0d440fb3a8990a54ab2dd867a0966942cd1f6d176dc1dd21fe8b1fb`**. 의존성·vendor는 대상에서 사본으로 복사했고 설치하지 않았다. unit의 `git ls-files`용 metadata/index는 검수 디렉터리 전용이다. 커밋을 만들지 않았다. [준비 코드](probes/setup.py), [출력](logs/setup.log).
- 아래 명령은 별도 표시가 없으면 `cd /tmp/worklazy-xr-review4/source` 후 `source ../env.sh` 환경이다. [env.sh](env.sh)는 **`NODE_OPTIONS=--max-old-space-size=4096`**, 전용 TMPDIR/npm cache/compile cache, offline npm, TEST_SCOPE 미설정을 고정한다. [전체 실행 명령·exit·시간](checks.jsonl).
- preview는 **`npm run preview -- --host 127.0.0.1 --port 4370 --strictPort`**. 외부 [브라우저 하니스](probes/browser-harness.mjs)는 기존 QR proxy의 port 0 요청만 4371에 고정하고 다운로드를 보존한다. 단언·제품 소스는 바꾸지 않는다. build 종료 후 브라우저를 직렬 실행했고, 브라우저·preview 종료 뒤 bundle 내부 build를 실행했다. [preview](logs/preview.log), [종료 증거](logs/preview-lifecycle.json).

**항목별 판정**

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| R1-text·R2-entities 원본 32건 | **통과 / 두 원인 해소** | 원래 `/tmp/worklazy-xr-review3/probes/lexical-counterexamples.mts`를 read-only source bind로 **무수정 실행**, **32 pass / 0 fail**. 주석·PI·빈 CDATA가 값인 경우 0행, r/t 속성·shared index 참조도 올바르게 판정. [원 명령·TAP](logs/original-lexical.log), [전건 JSON](logs/lexical-counterexamples.json) | 없음. 보조 함수는 0을 **반환**하고 생산 검사가 `REPORT_INTEGRITY_FAILED`로 거부한다. |
| 1·2차 원본 probe 3종 | 통과 | 원본 경로의 `empty-data-negative.mts` **2/2**, 2차 동일 사본 **2/2**, `empty-style-plus-empty-string.mts` **2/2**, `element-boundaries.mts` **5/5**. [1차](logs/original-r1.log), [2차 사본](logs/original-r2-r1.log), [조합](logs/original-combination.log), [경계](logs/original-boundaries.log) | 없음. 원본 코드·단언·SHA 유지. |
| 독립 확장 재생성 | **통과 / 2,880/2,880** | `node --experimental-strip-types ../probes/independent-expanded.mts`. 자체 생성한 새 값과 15문법 × 6셀 × 8값 × 4배치. 시트별 ExcelJS, 공용 전체/maximum=1, 보조 계수, 각 사례 단독 ZIP 생산 수락 **전부 일치**. 십진·16진 엔티티 **384건** 포함. [출력](logs/independent-expanded.log), [전건 결과](logs/independent-matrix-results.json) | 없음. sol의 생성기·결과를 재사용하지 않았다. |
| 3차 원본 2,880조합 그대로 | **확정 결함 해소 / oracle 차이 잔존** | 원본 `independent-matrix.mts` 무수정 실행: **2,764 일치 / 116 불일치**, exit 1. 불일치는 `cdata-text`에만 존재. 별도 ElementTree 교차는 해당 profile **192/192 의미 일치**, scanner 불일치 0. [원본 실행](logs/legacy-matrix.log), [원본 전건](legacy-matrix/logs/independent-matrix-results.json), [XML 교차](logs/legacy-cdata-semantic.log) | 이것을 “원본 행렬도 ExcelJS 100% 일치”라고 기록하지 말 것. 실제 CDATA 문자를 삭제하는 수리는 금지. |
| CDATA·반대 방향 참조·새 경계 | 통과, 적용 범위 구분 | `new-boundaries.mts`: **126건**, 기대값 단언 **72건**, 계약 밖 관찰 **54건**. 일반 `<v>&#49;</v>` 인덱스는 해석, `<![CDATA[&#49;]]>`는 리터럴이라 인덱스로 수락하지 않음. 중첩처럼 보이는 CDATA·인접 CDATA·분할 `]]>`·속성의 CDATA 유사 문자열까지 검사. [출력](logs/new-boundaries.log), [전건](logs/new-boundaries.json), [ElementTree](logs/boundaries-elementtree.json) | 아래 경계 설명대로 제한을 유지. |
| 잘못된 참조의 거부 | **지정 해석 경로 통과** | `&#;`, `&#x;`, `&amp`, `&#x110000;`, 십진 초과, D800/DFFF·십진 서로게이트, `&#0;`, 잘못된 이름/문법을 r/t/shared index에 배치. 해당 39건과 raw CDATA 유사 r 속성 1건 **40/40 생산 거부**. [전건](logs/new-boundaries.json) | 범용 XML validator 통과로 확대하지 말 것. |
| 계약 밖 malformed 일반 문자 | 제한 확인 / 비차단 | 일반 scalar/inline/shared text/formula의 잘못된 참조와 raw `]]>`·raw `<` 속성은 **54/54 수락**, ExcelJS·ElementTree 거부. 이 XML은 ZIP을 변조한 fixture이며, 실제 writer는 입력 문자열의 `&`, `<`, `>`를 escape한다. [경계 결과](logs/boundaries-elementtree.json), [실제 writer 출력](logs/writer-boundaries.json) | r/t/index의 해석 보장을 전체 XML 적합성으로 기술하지 말 것. 이 54건만으로 별도 P2를 매기지 않는다. |
| **실제 writer 입력의 금지 문자** | **P2 / R3-writer / 재검수 필요** | `writer-safety-counterexamples.mts` **0 pass / 2 fail**, `disallowed character`. 16B UTF-8 CSV → 실제 parser → compare → 보고서 writer → 생산 검사 수락 → ExcelJS 재개방 실패도 2/2 재현. XML 변조 0. [실패 TAP](logs/writer-safety-counterexamples.log), [전체 경로](logs/writer-noncharacters.log), [독립 XML](logs/boundaries-elementtree.json) | 아래 R3 지시대로 우리 writer에서 U+FFFE/U+FFFF가 malformed 보고서로 성공 반환되지 않게 좁게 방어할 것. |
| 입력 계약·명시 제외·기록 | 기재 통과, R3 인계 필요 | review-notes 23~29행에 writer 입력, DTD·외부 엔티티·접두 요소·임의 XLSX 의미 검증 제외, CDATA/접두 oracle 한계가 있음. 11행도 f 수식 포함으로 통일. [기록 diff](logs/diff-full.log) | R3는 **우리 writer 산출**이므로 “사용자 제공 임의 XLSX 제외”로 닫지 말 것. 범용 XML 지원 요구와 구별해 기록. |
| mutant | 검출력 통과 | cbe491a의 공용 함수만 bind: 원본 32건 **16 pass / 16 fail**; 대상 Excel unit **28 pass / 1 fail**. [원본 mutant](logs/mutant-lexical.log), [unit mutant](logs/mutant-unit.log) | 없음. 기대 실패를 현행 실패와 구분. |
| 폭·customWidth·대량 회귀 | 통과 | `core.mts`: sparse NaN 원인 재현, 누락/NaN/±Infinity/0/음수/빈값/공백 폭, 시트 없음·헤더 전용·0B·PK만·후속 시트 폭 음성 모두 거부. 경계 **[12,13,47,48,48]**. 50,000·150,000행 생성 **878/2,359ms**, 검사 **61/108ms**, RangeError 0. [core](logs/core.log) | 없음. |
| 지정 음성 6·양성 4 | 통과 | `data-row-required.mts`: 음성 **6/6 거부**, 양성 **4/4 수락**, 0/false 유지·독립 재개방 계수 일치. [출력](logs/data-row-required.log) | 없음. |
| 조기 종료·9시트·13열·토폴로지 | 통과 | `early-exit-topology.mts`: 150001행의 첫 값 탐지, 앞 시트 데이터가 있어도 셋째 시트의 잘못된 폭 거부, 메모리 주입 `REPORT_TOPOLOGY_INVALID`. 소비처 수집은 비교 9시트 순서와 기록 시트의 13개 헤더 전건 단언. [토폴로지](logs/early-exit-topology.log), [소비처](logs/consumer-xml.json) | 없음. |
| 안전 오류 귀결 | 기존 폭 오류 경로 통과 | `worker-safe-error.mjs`: ko/en 안전 재시도 안내·오류 코드 하나·다운로드 0. [출력](logs/worker-safe-error.log) | R3는 현행에서 성공 반환되므로, 이 기존 안전 경로가 R3도 막는다고 주장하지 않는다. |
| 소비처 3종 전수 | 통과 | `collect-results.py`: 비교 4개·정리 4개·QR 1개, 고유 다운로드 **9개** 전 열 폭 유한·양수. 비교 9시트/95열, 정리 5시트/31~33열, QR 2시트/10열. [수집](logs/consumers.log), [전수 XML](logs/consumer-xml.json), [다운로드 대응](artifact-origins.jsonl) | 없음. |
| 검사 비용 | 통과 | `performance.mts`: 50,000×13·9시트·2,525,550B, 생성 **5,717ms**, 검사 **262/187/175ms**. sol 279/201/181 대비 각각 **−6.09/−6.97/−3.31%**. [실측](logs/performance.log) | 이 표본에서 비용 회귀 없음. |
| 종료성·문자 참조 비용 | 통과 | 기존 `scanner-cost.py` **60/60**, 새 `reference-cost.py` **32/32**. 각 프로세스 10초 상한, 250KB~8MB, 3회씩 검사. 기존 최대 **818.703ms**, 새 참조 최대 **521.420ms**, timeout/RangeError 0. [기존](logs/scanner-cost.log), [참조](logs/reference-cost.log) | 완전한 XML 유효성·모든 입력 종료성의 증명으로 확대하지 않는다. |
| 사용자 파일 재실측 | 통과 | 재파싱·비교·보고서 생성: **713 matched / 37 changed / 48 added / 4 duplicate**, 나머지 0. **9시트·856행·95열·68 col 태그·폭 12~48·잘못된 폭 0**, 54,122B. LibreOffice Summary **99B/9행**, 수치 전부 일치. [재생성](logs/user-files.log), [독립 XML](logs/user-xml-independent.json), [LO](logs/libreoffice.log), [CSV 단언](logs/independent-xml-csv.log) | 없음. 신고 사용자 파일에 R3가 있다는 뜻이 아니다. |
| 수정 범위 | 통과 | `git diff --stat cbe491a..3270512`: **4파일 +151/−8**, 공용 함수·unit·기록뿐. 기존 요소 스캐너의 `xmlElements` 이후는 바이트 동일. 폭·소비처·엔진·worker·입력 파서·의존성 동일 blob. [diff](logs/diff-stat.log), [동일 표면](logs/unchanged-surfaces.json), [재현](probes/scope.py) | R3 수리는 기존 4파일 경계를 넓힐 수 있으므로 Claude 후속 정본에서 좁은 writer 방어를 명시할 것. 검수 잡에서 수정하지 않았다. |
| 최종 | **수정 후 재검수** | R1-text·R2-entities와 공통 회귀는 통과. 실제 writer 경계의 R3가 별도로 남음. | **현재 3270512의 배포 후보 승인은 보류.** |

**원본 무수정 실행 증거**

원본 probe가 import하는 source 경로만 이번 archive로 read-only bind하고, 하드코딩된 artifacts/logs 출력만 이번 검수 디렉터리로 bind했다. 원래 파일을 복사해 기대값을 바꾸거나 제품 함수를 감싸지 않았다. 예:

```sh
bwrap --ro-bind / / \
  --bind /tmp/worklazy-xr-review4 /tmp/worklazy-xr-review4 \
  --ro-bind /tmp/worklazy-xr-review4/source /tmp/worklazy-xr-review3/source \
  --bind /tmp/worklazy-xr-review4/artifacts /tmp/worklazy-xr-review3/artifacts \
  --bind /tmp/worklazy-xr-review4/logs /tmp/worklazy-xr-review3/logs \
  --dev-bind /dev /dev --proc /proc \
  --chdir /tmp/worklazy-xr-review4/source \
  node --experimental-strip-types --test /tmp/worklazy-xr-review3/probes/lexical-counterexamples.mts
```

| 원본 | 실행 전후 동일 SHA-256 |
|---|---|
| 3차 최소 반례 32건 | `6fcc0a3409afb05abfe0b1f33fab21b3464567f5b188c4925ed385c8115a5ba3` |
| 1차 음성 / 2차 동일 사본 | `2b6646058365953cdb7efb362c416bb19d2a121a12d267c58399dd4dff7c2ccc` |
| 2차 빈 서식+빈 문자열 조합 | `282bdc28708c2224ad7019f70cbc39bb284cb226019d1e4d7a304bda23c57692` |
| 2차 요소 경계 | `692c967543d38a6378cd37556abd4042282bfc819f54ac90c968f7daa4637f5b` |
| 3차 원본 2,880조합 생성기 | `16dad6186797e6163cf2ff7c10bce3aad78e8782493bed221868ed9eb9c44c7b` |

**독립 확장과 oracle 판정**

[새 확장 생성기](probes/independent-expanded.mts)는 3차에 직접 작성한 독립 생성기를 바탕으로 **값을 새로 지정**했다. 공백은 탭+공백으로, 긴 한글·따옴표/이중 escape 리터럴·`a]]>b`·한글/슬래시를 넣었고, 별도 십진/16진 profile을 생성했다. 커밋 unit이나 sol의 matrix 코드·판정기는 import하지 않는다. 각 조합의 전체 계수·maximum=1·보조·단독 ZIP 생산 수락을 각각 대조하므로 합계 상쇄나 다른 정상 시트에 의한 거짓 통과를 허용하지 않는다.

원본 3차 15-profile 행렬도 그대로 실행했다. 3차의 **2,600/2,880 → 이번 2,764/2,880**이다. 일반 문자 안 주석·PI·빈 CDATA 및 numeric-entities는 모두 192/192로 고쳐졌다. 남은 116건은 실제 CDATA 문자가 있는데 ExcelJS가 버려 0으로 읽는 사례다. 이전 CDATA profile의 128 불일치 중 12건은 빈 shared text 참조의 오판이 함께 있던 것으로 이번에 해소됐다.

이 192건의 XML을 별도 [추출 사본](probes/legacy-cdata.mts)으로 다시 생성하여 [ElementTree 의미 검사](probes/legacy-cdata-semantic.py)를 실행했다. 전체/maximum/보조/생산 판정이 **192/192** 일치했다. 이 추가 사본은 이미 무수정 실행한 원본의 결과를 대체하지 않는다. LibreOffice도 비어 있지 않은 CDATA `visible`을 보존했다. 따라서 ExcelJS와 100% 일치시키기 위해 실제 CDATA를 버리는 변경은 불필요하며 잘못된 수리다.

접두 요소 192/192는 여전히 두 구현이 함께 무시한 결과다. 원본 접두 최소 fixture 3개는 ElementTree가 데이터 1행으로 읽고 두 구현은 0행이다. LibreOffice도 접두 row의 `visible`을 보존한다. 명시 제외 기록이 정확하므로 namespace 지원을 요구하지 않는다. 현재 writer는 고정된 접두 없는 row/c/t 이름과 숫자 행/인덱스를 직렬화하고, 사용자 문자열의 XML 구분자는 escape한다. 주석·PI·CDATA·접두 요소·숫자 참조 r/t/index fixture는 확장 진단이며 실제 writer가 그대로 출력한다고 주장하지 않는다.

새 경계 126건 중 32건은 잘 형성된 XML로서 ElementTree 결과와 일치했다. 여기에는 의미상 숫자 인덱스가 아닌 문자열을 넣은 사례도 있으므로 SpreadsheetML 적합성까지 통과했다는 뜻은 아니다. `&amp;#49;`와 CDATA의 `&`에 일반 `#49;`를 이은 인덱스는 공용 판정이 0이고, ExcelJS는 유효하지 않은 shared index 처리 중 오류를 낸다. 그 밖의 malformed 일반 문자 54건은 문서화된 범용 XML 검사 제외 범위다. 실제 writer로 같은 리터럴을 출력하면 escape되어 정상 재개방된다.

**R3-writer — 우리 writer가 금지 문자를 그대로 XML에 써서 재개방 불가능한 보고서를 성공 반환한다 (P2)**

최소 입력은 JavaScript 문자열 **`"\uFFFE"` 또는 `"\uFFFF"`**다. XML 숫자 참조 문자열 `"&#xFFFE;"`를 뜻하지 않는다. 실제 [writeUntrustedText](source/src/utils/xlsxReport.ts:14)는 문자열을 그대로 ExcelJS에 넘기며, 설치된 ExcelJS의 `xmlEncode`는 이 두 원시 문자를 제거하거나 안전하게 표현하지 않는다. 생성된 `xl/sharedStrings.xml`에는 해당 UTF-8 코드 포인트가 그대로 있다. [공용 텍스트 존재 검사](source/src/utils/xlsxReportDataRows.mjs:64)는 비어 있지 않은 텍스트로 인정하고, [생산 검사](source/src/features/excel-compare/reportIntegrity.ts:30)도 통과한다.

```sh
cd /tmp/worklazy-xr-review4/source
source ../env.sh
node --experimental-strip-types --test ../probes/writer-safety-counterexamples.mts
# tests 2 / pass 0 / fail 2
# U+FFFE 및 U+FFFF: 2:126: disallowed character.

node --experimental-strip-types ../probes/writer-noncharacters.mts
# 각각 16-byte CSV, inputPreserved=true, serializedLiteral=true
# accepted=true, excelError="2:2796: disallowed character."
```

두 번째 명령은 `Key,Value\n1,<해당 문자>\n`인 UTF-8 CSV를 [실제 입력 파서](source/src/features/spreadsheet-core/inputAdapter.ts:305)로 읽고, 비교 엔진과 `buildExcelCompareReport`를 호출한다. CSV의 값이 그대로 입력 모델에 보존됨을 먼저 단언한다. 생성 보고서에는 9시트가 있고 생산 검사까지 성공하지만 재개방이 실패한다. fixture XLSX의 ZIP/XML을 고치지 않았고, XML 특수문자를 주입한 synthetic XLSX를 제품 입력으로 넣은 것도 아니다.

- 직접 writer 표본 [U+FFFE](artifacts/writer-boundary-27.xlsx), [U+FFFF](artifacts/writer-boundary-28.xlsx): ExcelJS 오류, ElementTree `not well-formed (invalid token)` 확인. LibreOffice는 변환 exit 0이지만 결과가 `Header` 한 줄 **7B**다. 정상 값 1행 보존의 교차 통과로 볼 수 없다.
- 전체 CSV 경로 표본 [U+FFFE 보고서](artifacts/noncharacter-report-fffe.xlsx), [U+FFFF 보고서](artifacts/noncharacter-report-ffff.xlsx): 생산 수락·ExcelJS 거부. LibreOffice는 Summary를 CSV로 내보냈지만 이는 첫 시트 요약만 읽은 결과이므로 전체 레코드 보존이나 정상 XLSX의 증거로 사용하지 않는다. [LO 전체 결과](logs/libreoffice-results.json).
- [수정 전 대조](logs/pre-fix-writer-noncharacters.log): cbe491a의 공용 모듈을 되돌려 같은 probe를 실행해 **동일하게 재현**했다. 관련 writer·입력·보고서·검사·의존성 blob은 cbe491a와 3270512가 동일하다. 따라서 **fix-3가 만든 회귀라는 주장은 하지 않는다**.

심각도는 **P2**다. 흔한 사용자 값 전체나 기존 신고 파일의 손상은 아니며 두 드문 코드 포인트가 조건이다. 다만 지원되는 CSV 입력에서 실제 산출물을 정상 성공으로 반환하고 재개방을 실패시키므로, writer가 만들 수 없는 XML 변형에 대한 비차단 제한과는 다르다. 실제 Microsoft Excel GUI의 복구/오류 화면은 실행하지 않았으므로 주장하지 않는다.

입력 계약의 “우리 writer 산출” 경계 안에서 재현되며, “사용자 제공 임의 XLSX 검증 제외”에 해당하지 않는다. 범용 DTD·namespace·XML validator를 추가할 필요 없이, **우리 writer의 이 좁은 출력 결함을 막는 것**으로 해결할 수 있다.

**수정 지시 문안:** 후속 정본에서 `src/utils/xlsxReport.ts`의 텍스트 직렬화 경계와 필요한 테스트·기록을 좁게 허용한다. U+FFFE/U+FFFF가 포함된 우리 보고서가 malformed XLSX로 성공 반환되지 않게 할 것. 원 값을 임의로 소실시키는 수정은 계약으로 승인된 적이 없으므로, 보존 가능한 표현이 검증되지 않았다면 기존 `REPORT_INTEGRITY_FAILED` 안전 오류로 종료하는 경로를 선택할 수 있다. 위 최소 2건과 CSV→비교→보고서 2건을 회귀로 넣어 **수락한 결과는 독립 재개방 가능하거나, 생성 단계가 기존 안전 오류로 끝남**을 단언한다. 정상 보조 평면 문자·CDATA/엔티티 모양의 리터럴·0/false·기존 사용자 파일·폭/성능·32건/확장/공통 회귀를 유지한다. `countWorksheetDataRows`를 범용 XML validator로 확대하거나 이번 검수에서 수리 코드를 임의로 넣지 않는다. R3가 기존 결함이라는 사실과 실제 writer 도달 경로를 review-notes에 명시할 것.

**비용·공통 검증 원출력**

50,000×13 비용은 생성 5,717ms 중 검사 262/187/175ms, 약 **4.58/3.27/3.06%**다. max RSS **1,307,072KiB**는 생성 포함 전체 프로세스이며 검사 단독 메모리가 아니다. 참조 비용 추가 표본은 8MB 반복 참조 행 번호/인덱스, 끝의 잘못된 참조, 거대 단일 코드 포인트, 주석/빈 CDATA 조각, CDATA의 참조 리터럴을 포함한다. 8MB 반복 행 번호 참조는 **521.420/475.466/472.250ms**로 종료했다. [기존 60건 수치](logs/scanner-cost.json), [새 32건 수치](logs/reference-cost.json).

| 명령 | 결과 | 원출력 |
|---|---|---|
| `./node_modules/.bin/tsc -b` | exit 0 | [tsc](logs/tsc.log) |
| `npm run test:unit` | 최종 exit 0, **263/263** | [최종](logs/unit-corrected.log), [최초 환경 오류](logs/unit.log) |
| `npm run build` | exit 0, **2,835 modules**, 정적 **61페이지** | [build](logs/build.log) |
| `npm run test:static` | exit 0, startup recovery **104문서** | [static](logs/static.log) |
| `npm run test:excel-compare` | exit 0 | [compare](logs/excel-compare.log) |
| `npm run test:excel-cleaner` | exit 0 | [cleaner](logs/excel-cleaner.log) |
| `npm run test:qr-bulk` | exit 0, 첫 실행 통과 | [QR](logs/qr-bulk.log) |
| `npm run test:browser` | exit 0, TEST_SCOPE 미설정 전체 Excel·Word·PDF | [browser](logs/browser.log) |
| `npm run bundle:measure` | exit 0, **80 JS / 1 CSS**, 브라우저 종료 뒤 | [bundle](logs/bundle.log) |
| `npm run css:orphans` | exit 0, orphan **0** | [CSS](logs/css-orphans.log) |
| `node tests/tool-registry-routes.mjs` | exit 0, **20개**, 누락/초과/중복 0 | [registry](logs/registry.log) |
| `git diff --check cbe491a..3270512`, `5bc6854..3270512`, 대상 worktree diff | 모두 exit 0 | [diff-check](logs/diff-check.log) |

최초 unit의 262/263은 archive 전용 bare metadata의 HEAD에 짧은 해시 `3270512`를 기록해 `git ls-files`가 저장소를 인식하지 못한 **검수 준비 오류**다. 검수 metadata HEAD만 전체 40자리 해시로 바로잡고 동일한 원본 unit을 재실행해 263/263을 확인했다. [정정 기록](logs/setup-head-correction.log). 최초 실패는 삭제하지 않았다. scope 확인의 첫 명령에는 존재하지 않는 `compare.worker.ts` 파일명을 사용해 조회가 중단됐으며 실제 `excelCompare.worker.ts`를 확인한 뒤 [저장된 scope 재현 코드](probes/scope.py)로 완료했다. 제품·테스트 코드 변경은 없다.

원본 CDATA 행렬 exit 1은 위 oracle 차이, mutant 두 실행 exit 1은 기대 실패, **새 writer 안전 반례 exit 1은 미해결 결함**이다. LibreOffice의 javaldx/dconf 경고도 로그에 남겼다. 사용자 보고서와 CDATA/접두 교차는 변환 exit 0 및 CSV 내용 단언으로 판정했다.

신규 UI·ko/en 문구·URL·SEO·정적 입력·광고 배치/격리 경로·서버 전제·의존성 변경은 없다. 관련 공통 계약은 unit/static/registry·전체 스모크와 ko/en 안전 오류 경로로 검증했다. 이번 검수에서 배포나 별도 Gemini 시각 검수는 하지 않았다.

**불변·인계**

[시작](start-state.json)과 [종료](end-state.json)의 HEAD·브랜치·main이 같고, `git status --porcelain=v1`는 모두 빈 문자열이다. **대상 추적 파일 2,376개 SHA 변경 0**, 기존 원본 probe·검수/sol artifacts·열린 문서·지정 사용자 입력을 포함한 **보호 파일 245개 변경 0**이다. archive 사본의 추적 파일 **2,376개도 원 archive와 바이트 차이 0**. [대조 JSON](state-comparison.json), [출력](logs/immutability.log).

원 워킹트리에서는 공통 규칙 선독과 이번 사용자 파일 재실측에 필요한 **지정 XLSX 2개 읽기만** 수행했다. 두 입력은 시작 SHA 기록 뒤 검수 [inputs/](inputs/)에 안전 사본을 만들고 이후 재실측은 그 사본을 사용했다. 원 워킹트리 제품 소스·U4 작업물에는 접근하거나 실행하지 않았고 `/tmp/worklazy-dc-impl`에도 접근하지 않았다. sol worktree 수정·빌드·fixture 생성, 커밋·push·브랜치 전환은 없다. 새 산출물은 `/tmp/worklazy-xr-review4/` 안에만 남겼다.

현재 main과 기준→폭 브랜치 변경의 교집합은 **CHANGELOG.md·docs/review-notes.md 두 파일뿐**, 실행 코드 교집합은 없다. [최종 교집합](logs/merge-intersection-final.json). 두 추적 기록 파일은 수정 금지에 따라 그대로 두고 이 보고서를 Claude 취합 입력으로 전달한다.

**수리·재검수 통과 후 배포 후보 조건:** 최신 main `cdb4007`을 다시 확인하고 `ac9cc4a → 64af7b3 → cbe491a → 3270512 → 후속 수리` 순서로 반영하며 공통 기록을 취합하고, main 변경 교집합·공통/Excel 회귀·main의 문서 비교 검증을 재실행한 뒤 후속 Excel 계획보다 먼저 통합할 것 — **현재 후보 미승인**.

재생성 사용자 보고서: [user-file-report.xlsx](artifacts/user-file-report.xlsx), SHA-256 **`3f9c966af2dcf7cfc0d0431a9fbf5ce92e6788df7b8a8828112a9fb96b80ac0a`**.

**[수정 후 재검수]**
