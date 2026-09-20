# Excel S1 fix-1 재검수(2차)

**[검수 통과] — S1-R01·S1-R02 해소. ko/en 문구 mutant 2/2를 무수정 스모크가 검출했고, 1차 통과 범위의 되돌림은 재현되지 않았다.**

Codx · 2026-09-08 · 대상 `/tmp/worklazy-xd`, `excel-dupkey-20260907`, `c1e44f60096dfad33e6c225fdb96f5323516edf6` (부모 `2c338cffea71c91531107dd5fce4273f04386c45`, 조부모 `597a92ff56ed9c3eb23755a58df2580b0269b8bd`). **S1 단독은 병합·배포 후보가 아니다.**

## 실행 게이트·검증 출처

- 첫 행동으로 `PROJECT_RULES.md` 전문을 읽고 대상 AGENTS, 재검수 디스패치, 자신의 1차 REPORT, fix-1 디스패치·sol REPORT/evidence, 보존 정본 v3·R2-01 첨부와 관련 기각 이력을 읽었다. `v3 > v2 > v1`을 적용했다.
- 시작 HEAD/브랜치 일치·status 빈 문자열. 대상에는 `docs/jobs/todo`가 없어 허용된 S0의 열린 계획 19개를 다시 스캔했다. Excel 본체·후속·안전화 계승 및 공용 표면 통합 경계와 이번 고정 SHA 검수 사이의 상반 지시는 발견하지 못했다. **금지된 원 트리의 실시간 계획 변경까지 확인했다는 뜻은 아니다.** [목록 SHA](evidence/open-plans-inventory.json), [검색 원문](evidence/open-plans-scan.txt).
- `git -C /tmp/worklazy-xd archive c1e44f60096dfad33e6c225fdb96f5323516edf6`에서 **새 사본 `main/`**을 만들었다. 추적 2,400파일 SHA가 커밋·대상과 일치했다. 설치는 대상 node_modules를 이 사본으로 복사했고 새 의존성을 추가하지 않았다. [archive 출처](evidence/archive-provenance.json).
- 원본 probe를 고치지 않았다. [original.py](probes/original.py)는 읽기 전용 원 검수 경로의 `main`을 **이번 archive**로, evidence/preservation 출력을 이번 디렉터리로 연결한다. 원본 env 경로에는 이번 `/tmp`·캐시·포트 환경을 bind했다. 모든 새 산출물은 `/tmp/worklazy-xd-s1-review2/`에 있다. sol의 이전 통과 표를 이번 통과 출력으로 전용하지 않았다.
- Node v22.17.1, `NODE_OPTIONS=--max-old-space-size=4096`; 빌드·브라우저·번들은 직렬. baseline preview **4350 `--strictPort`**, QR 보조 proxy **4351**(무수정 S0 strict-port preload), mutant preview **4352/4353 `--strictPort`**. 기본 명령 위치 `main/`, 환경 [env.sh](env.sh), 기록 [check.py](probes/check.py)/[checks.jsonl](evidence/checks.jsonl).
- 원본 워킹트리는 공통 규칙 첫 선독 외 접근하지 않았으며 `/tmp/worklazy-xr*`·`/tmp/worklazy-dc-impl`을 열거나 실행하지 않았다. 과거 안전화 probe는 허용된 S0/1차 첨부에서만 사용했고 실행 시 옛 경로 문자열을 이번 preservation으로 매핑했다.

## 핵심 판정

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| 1. S1-R01 복구 안내 | 해소 | `python3 ../probes/original.py node /tmp/worklazy-xd-s1-review/probes/browser-extra.mjs` exit0, 이어 원본 `error-contract.py` exit0 **ko/en 2/2**. 정상→실패→정상에서 양어 정상 결과 2개·실패 result/COMPLETE 0. [browser](evidence/browser-extra-original.log), [contract](evidence/error-contract-original.log). | 없음 |
| 2. 정본 문구·locale 범위 | 통과 | `python3 ../probes/scope.py`: 두 값은 채택 R2-01과 문자 단위 일치. 구조 diff는 `excelCompare.error.DUPLICATE_KEY_TOO_LONG` 한 키씩. **추가 항목만 제거하면 부모 파일의 원문 바이트가 완전히 복구**되어 다른 값·순서·공백/형식 변경 0. [scope](evidence/scope.json). | 없음 |
| 3. fallback 경계 | 통과 | `node ../probes/fallback-browser.mjs`: 실제 페이지에서 Worker의 compare 오류 응답만 주입하여 **8개 알려진 code + 2개 알 수 없는 code × ko/en = 20/20**. 각 고유 문구·알 수 없는 code의 PROCESSING_FAILED 유지, code/원시 예외 비노출·다운로드0. [결과](evidence/fallback-browser.json). | 없음 |
| 4. 강화 스모크·mutant | 통과 | 무수정 `npm run test:excel-compare` exit0. 양어 **개별 XLSX 정확히2·ZIP 정확히1·ZIP 내부2**, 정상 A/B 보고서 내용 일치. **ko/en locale 하나씩 일반 오류로 바꿔 독립 빌드한 mutant 모두 같은 스모크 exit1**, 해당 언어의 원인·복구 안내 단언에서 실패. [정상](evidence/smoke-excel-compare.log), [mutant](evidence/mutants.json). | 없음 |
| 5. S1-R02 기록 | 해소 | `git diff 2c338cf..c1e44f6 -- docs/review-notes.md CHANGELOG.md`: 기존 잘못된 문단 자체를 정정하고 fix-1 경위 추가. 신설 원시 code는 숨기지만 기존 내부 key 표시·그룹 값 소비는 S2에 남으며, 이것이 S1+S2 단일 전환의 이유임을 명시. ko/en 불필요 판정 철회. CHANGELOG 한 줄·Codx 서명. [diff](evidence/diff-full.txt). | 없음 |
| 6. 1차 되돌림 | 통과 | 독립 I/S·브라우저 B·선행 P를 전부 재실행. 아래 항목 대응표. | 없음 |
| 7. 사용자 파일 | 통과 | 원본 I 및 `user-browser.mjs`에서 **1·6·0그룹**, matched/changed/added 기대 동일. 실제 다운로드 포함 **32 XLSX·576 XML/rels**를 ElementTree로 전부 파싱, 9시트·13열·폭12~48. [사용자](evidence/user-results.json), [XML](evidence/independent-xml.json). | 없음 |
| 8. sol bubblewrap 출처 | 타당, HTTP 경계 구분 | sol과 같은 main bind로 읽은 7개 파일 SHA가 c1e44f6 및 이번 archive와 일치. 원본 probe SHA 2개 일치. **browser probe는 main bind가 아니라 고정 4350 HTTP 서버의 앱을 검사**한다. sol build cwd/strict preview 기록·보존 dist 75 JS/CSS의 독립 재빌드 바이트 일치·당시 fix 문구 캡처를 교차했고, 이번 4350 응답 자산도 새 archive dist와 일치. [출처 증거](evidence/bubblewrap-provenance.json). | 없음; 향후 브라우저 출처 설명에도 서버 cwd/응답 자산 증거를 유지 |
| 9. 범위·공통 | 통과 | locale2·스모크1·기록2 **총5파일**만 변경. 나머지 **2,395 추적파일이 부모와 바이트 동일**(엔진·worker·client·guard·formatter·선행 writer/helper 포함). 필수 명령 전부 최종 exit0, 5개 S0 번들 예산 통과, URL 집합 동일·새 광고 예외/서버 전제0. [불변 파일](evidence/unchanged-files.json), [범위](evidence/diff-stat.txt). | 없음 |
| 10. 종결 | 검수 통과 | 시작·종료 status 빈 문자열, 대상/사본 각각 추적2,400파일 SHA 동일·사용자3파일/원본probe/기준선 동일. REPORT 저장·존재 확인. | S2 지시서 발행 조건은 문서 끝 참조 |

## 화면·fallback·mutant 상세

직접 연 [ko 실제 화면](evidence/private/browser-extra/ko-key-error.png)·[en 실제 화면](evidence/private/browser-extra/en-key-error.png)에서 `bad-key-left.csv ↔ bad-key-right.csv`와 아래 문구 전체가 표시되며 잘림·원시 code 노출이 없다.

- ko: 선택한 키 열의 내용이 너무 길어 보고서를 만들지 못했습니다. 더 짧은 값이 있는 열을 키로 선택해 다시 비교해 주세요.
- en: The selected key columns contain too much text for the report. Choose key columns with shorter values and compare again.

fallback은 `UNSUPPORTED_FORMAT`, `ENCRYPTED_FILE`, `DAMAGED_FILE`, `CSV_PARSE_ERROR`, `SHEET_NOT_FOUND`, `REPORT_INTEGRITY_FAILED`, `DUPLICATE_KEY_TOO_LONG`, `PROCESSING_FAILED` 전부를 검사했다. `UNKNOWN_REVIEW_CODE`/`RAW_EXCEPTION_<>`는 일반 안내로 내려가고 주입한 `RAW_REVIEW_SECRET_EXCEPTION`은 화면에 없다. 이 주입은 오류 전달/표시 경계 시험이며 제품 입력 결함의 도달성 주장으로 사용하지 않았다. R01 원본 재현은 **지원 CSV의 정상 문자열 32,768자 반복**이라는 실제 입력 경로다.

[mutant-suite.py](probes/mutant-suite.py)는 archive의 ko/en `features.json`에서 **신설 키의 값만 해당 언어의 PROCESSING_FAILED 값으로 바꾼 파일**을 별도로 만든다. locale 경로에 읽기 전용 bind하고 원본 Vite로 `mutants/<lang>/dist`를 빌드한다. 원 archive 파일·생성물·스모크는 편집하지 않으며, `TEST_BASE_URL`만 각 mutant preview에 연결한다. 실패 oracle은 locale에서 기대값을 다시 읽지 않고 정본 문자열을 별도로 가진 무수정 `assertDuplicateKeyTooLongIsolation`이다.

| mutant | 정상 스모크 | mutant 스모크 | 실제 실패 위치 |
|---|---|---|---|
| ko 안내→일반 오류 | exit0 | **exit1** | `The overlong-key cause and recovery guidance were not safely isolated (ko)` |
| en 안내→일반 오류 | exit0 | **exit1** | `The overlong-key cause and recovery guidance were not safely isolated (en)` |

원출력 [ko](evidence/mutant-ko-smoke.log)·[en](evidence/mutant-en-smoke.log), 별도 [빌드 ko](evidence/mutant-ko-build.log)·[빌드 en](evidence/mutant-en-build.log). en mutant는 앞선 ko 검사를 통과한 뒤 en 안내에서만 실패했다. 실패 시점은 다운로드·ZIP2개·내용 대조를 지난 다음이므로 단순 서버/fixture 실패를 mutant 검출로 세지 않았다. 스모크 SHA는 두 실행 모두 커밋과 동일하며 [manifest](evidence/mutants.json)에 남겼다.

## 1차 통과 항목 대응·되돌림 사냥

I = 원본 `independent.mjs` (**8군 전부 통과**), S = 원본 `supplement.mjs`, B = 원본 `browser-extra.mjs`, P = 원본 `preservation-suite.py` (**17명령 전부 exit0**). 재현은 `python3 ../probes/original.py <node/python3> /tmp/worklazy-xd-s1-review/probes/<파일>`이며, I/S는 `--experimental-strip-types`, I는 `--expose-gc`를 추가한다. [I 원출력](evidence/independent-original.log)·[I JSON](evidence/independent.json), [S](evidence/supplement-original.log), [P](evidence/preservation-original.log).

| 1차 항목 | 판정 | 이번 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| A1 네 배열·없는 측·인덱스 | 유지 | I: 실제 XLSX 0..8×0..8 **81구성·3정책243대조**, 2:0/0:2/2:1/1:2 포함. | 없음 |
| A2 singleton·양 map 제거 | 유지 | I: duplicate 행은 matched/changed 등 일반 records에 재등장0. primaryLeft/Right 삭제 코드 유지. | 없음 |
| A3 1:1 기존 동작 | 유지 | I: 1:1은 부모 scalar records와 deep equality·duplicate0. | 없음 |
| A4 다른 상태·스키마 | 유지 | I/S: matched/changed/added/removed/ambiguous/unmatched/error **7상태**, records/summary/warnings/parameters 부모와 동일·그룹 필드 부착0. | 없음 |
| A5 scalar null/빈값 | 유지 | I의 모든 duplicate: 위치4필드 null·값2필드 빈 문자열. | 없음 |
| A6 순서·정책 | 유지 | I: Set B→A→C, 원본행 오름차순, secondary/occurrence 결과 부모와 전체 동일. | 없음 |
| B7 displayKey | 유지 | I: [1]/[1,2]/[2,1], 첫 좌측/우측 fallback, 선택 셀의 cellText 연결과 일치. | 없음 |
| B8 표시 충돌 | 유지 | I: `1 \| x` 두 내부키와 `a \| b \| c` 두 내부키가 각각2그룹 유지. | 없음 |
| B9 빈값·정규화 | 유지 | I: 열순서3×정규화7=21대조, 부모 key 집합/순서 동일. | 없음 |
| C10 summary·골든 | 유지 | I/사용자: duplicate는 그룹 수. 부모 S0→S1 기존 골든4→1 변경과 신규 기대 유지; fix에서는 unit/엔진 변화0. | 없음 |
| D11 16,000 예산 | 유지 | I: 접두·LF 포함 정확16,000 1행, +1 2행; 빈값12,000행의 행번호/값 예산 준수. | 없음 |
| D12 탐욕·긴행·경계 | 유지 | I **19반례**, emoji/CRLF/결합문자 경계±1. surrogate·CRLF 중간분할0, 긴행은 전용 r [i/n] 조각. | 없음 |
| D13 반복·조각범위 | 유지 | I/B: Key/KEY/DUPLICATE_KEY·문맥 반복, 해당 원본행 표기·범위 일치. | 없음 |
| D14 무손실 | 유지 | I 전체 행→값 Map·순서 deep equality, B 실다운로드/ZIP의 긴값 **32,999 UTF-16** 재접합 동일. writer 금지문자 치환·XML CRLF→LF 계약 범위 적용. | 없음 |
| D15 측별 소진 | 유지 | I/B: 먼저 끝난 측은 행번호/값 둘 다 빈 문자열. | 없음 |
| D16 엔진/보고서 분리 | 유지 | I: formatter/build 전후 records JSON 불변, 30,000행도 엔진1그룹·보고서만 분할. | 없음 |
| E17 Key 양/음성 경계 | 유지 | I 실제 XLSX20 + S 원시 displayKey20: 15,999/16,000/16,001/32,767/32,768×single/LF/CR/CRLF. | 없음 |
| E18 실패 격리·공개 | 안내까지 해소 | B 양어 정상2·실패1, WRITING_REPORT→전용 code error, 실패 COMPLETE/result0·정상 성공2. | 없음 |
| E19 자르기·대체 금지 | 유지 | I/S: 수락 Key 원문 동일·초과 Key 성공 결과0. | 없음 |
| E20 일반 긴 목록 성공 | 유지 | I: 30,000행 그룹 **233,238B** 보고서 성공; B 33k급 목록 정상 분할·ZIP 복원. | 없음 |
| F21 4,096 취소·URL | 유지 | I 4,095/4,096/8,192/30,000행 checkpoint **0/1/2/7**, 실제 callback abort·긴행3조각 취소. B terminate 지연 비교 **1.110ms**/작성 **1.530ms**, 기존 성공1·취소쌍결과0·이전 URL revoke1. | 없음 |
| F22 append·성능 | 유지 | I 30,000행 비교 **98.449ms**, S0 부모 **4,756.275ms**, report **164.819ms**, 측정구간 RSS +6,438,912B. 1회 합성 측정이며 peak/보편 배율 주장 아님. | 없음 |
| G23 Parameters | 유지 | I: 고정9항목·그룹구간 Duplicates!2:5/6:6; S의5모드/정책 고정9항목 UNUSED·그룹항목0. | 없음 |
| G24 metadata·불변 | 유지 | I: report builder 메타데이터만 추가, 엔진 summary/records 불변. | 없음 |
| G25 무결성·토폴로지 | 유지 | ElementTree **32파일576 XML/rels**; 9시트 이름/순서·13열 이름/순서·폭12~48·전체32767/목록16000·수식객체0. | 없음 |
| H26 선행 안전화 | 유지 | P17명령+ElementTree204파일/2,267parts. 아래 보존표. | 없음 |
| I27 사용자 | 유지 | I+실브라우저1/6/0, 나머지 상태 records/summary 부모와 동일·다운로드 정상. | 없음 |
| J28 범위 | 유지 | fix5파일만, engine/worker/client/guard/formatter 포함 나머지2,395파일 byte 동일. | 없음 |
| J29 기존 화면 | S1 경계 유지 | 사용자3실행 pageErrors0. **기존 내부 identity와 빈 그룹 scalar는 여전히 보임**을 직접 화면/DOM 확인. S2 미전환을 S1 완료로 확대하지 않음. [DOM](evidence/ui-stage-boundary.json). | S2 정본 소비처 전환에서 해결 |
| J30 필수검증 | 유지 | 아래 명령 전부 최종 exit0. | 없음 |
| J31 기록 | 정정 완료 | R02 해소·Codx 서명 확인. | 없음 |
| K32 종결 | 검수 통과 | 신규 제품 결함/미해결 S1 수정 지시0. | S2 지시서 조건 준수 |

분할의 “무손실”은 행/값 누락·순서 변형·잘림이 없다는 계약이다. grapheme 단위 미분할이나 CR/LF 바이트 동일성까지 확대하지 않았다. 실제 XLSX parser가 CRLF를 LF로 읽는 사례는 S의 원시 displayKey 경계20개로 별도 검증했다.

## 선행 안전화·사용자 파일

| 보존 검사 | 이번 결과 |
|---|---|
| R1/R2 empty·조합·요소 | 2/2·2/2·2/2·5/5 |
| lexical·문자 writer·XLS numFmt·Row/Column | 32/32·2/2·2/2·2/2 |
| Unicode/CSV·writer·cleaner | 1,114,112 code points·32 CSV 사례·34 workbook/70셀 독립 XML 내용 대조 |
| data-row backstop | 음성6/6 안전거부·양성4/4, helper0과 생산거부의 구분 유지 |
| numFmt13·정상 대조 | 13/13 안전오류·serializer0·객체수 불변, 독립 인과13·정상서식11 보존 |
| 희소3,900×512 / 19,000×512 | 객체4,412 / 19,512개 유지, 5시트·SR3901=3901 / SR19001=19001 |
| 16,384열·생성 API 금지 | 비용 probe 완료, getRow/getCell/getCellEx/getColumn throw 대조 통과·객체3→3·생성0 |

[보존 suite](evidence/preservation-suite.json), [독립 XML](evidence/preservation-xml.json). 204파일·2,267 XML/rels에서 **예상 밖 malformed0**. 23개는 의도된 과거 fix5/계약 밖 비문자열 객체 numFmt 음성 대조이므로 “모든204개가 정상 XLSX”라고 쓰지 않았다. `fix6`이라는 옛 변수 라벨 중 `../source`를 가리키는 것은 이번 실행에서 **c1e44f6 archive**다. 비교용 옛 writer는 보존된 Git 객체 버전이며 현재 코드로 오인하지 않았다. 원본 보존 probe16개 SHA도 대조했다.

| 머리글/키 | 그룹수 / Duplicates 행수 | matched / changed / added |
|---|---:|---:|
| 1행/B | 1 / 1 | 713 / 37 / 48 |
| 4행/A | 6 / 6 | 486 / 134 / 31 |
| 4행/B | 0 / 0 | 703 / 37 / 48 |

사용자 원본은 `/tmp/worklazy-userfiles/`의 읽기 전용 사본만 사용했다. 입력2개와 참고 비교본1개는 시작/종료 크기·SHA 동일, 참고본은 결과 oracle로 쓰지 않았다. 사용자 값이 든 결과는 `evidence/private/`에만 보관한다. [브라우저 원출력](evidence/user-browser-original.log).

## 필수 명령·번들

아래는 이번 검수에서 **직접 새로 실행한 출력**이다. 전체 원문/exit/시간은 [checks.jsonl](evidence/checks.jsonl)에 있다.

| 명령 | 결과 | 원출력 |
|---|---|---|
| `./node_modules/.bin/tsc -b` | exit 0, 17.596s | [tsc](evidence/tsc.log) |
| `npm run test:unit` | 379/379, 3.770s | [unit-final](evidence/unit-final.log) |
| `npm run build` | exit 0, 100.187s | [build](evidence/build.log) |
| `npm run test:static` | exit 0, 0.780s | [static](evidence/static.log) |
| `npm run test:excel-compare` | exit 0, 31.355s | [smoke-excel-compare](evidence/smoke-excel-compare.log) |
| `npm run test:excel-cleaner` | exit 0, 53.698s | [smoke-excel-cleaner](evidence/smoke-excel-cleaner.log) |
| `NODE_OPTIONS="--max-old-space-size=4096 --import /tmp/worklazy-excel-s0/probes/strict-test-port.mjs" npm run test:qr-bulk` | exit 0, 49.502s | [smoke-qr-bulk](evidence/smoke-qr-bulk.log) |
| `npm run test:browser` | exit 0, 49.911s | [smoke-browser-full](evidence/smoke-browser-full.log) |
| `BUNDLE_BASELINE=/tmp/worklazy-excel-s0/evidence/bundle-baseline.json BUNDLE_MEASURE_OUTPUT=/tmp/worklazy-xd-s1-review2/evidence/bundle-after.json npm run bundle:measure` | exit 0, 71.402s | [bundle-measure](evidence/bundle-measure.log) |
| `npm run css:orphans` | exit 0, 0.637s | [css-orphans](evidence/css-orphans.log) |
| `node tests/tool-registry-routes.mjs` | exit 0, 0.536s | [registry](evidence/registry.log) |
| `git -C /tmp/worklazy-xd diff --check 2c338cf..c1e44f6` | exit 0, 0.017s | [diff-check](evidence/diff-check.log) |

S0 기준선은 **`/tmp/worklazy-excel-s0/evidence/bundle-baseline.json`** 하나이며 SHA-256 **`726a2d5be21ca250c76a5a9c9220affb8931da9286769f762f3531fd64d002c8`**를 시작/종료 확인했다. schema1·lazy19 routes·JS80/CSS1·multiplier1·override{}와 예산을 유지했다. U4 기준선/선택 route/한도 증가는 사용하지 않았다.

| gzip 항목 | S0 | 이번 측정 | 증분 | 증가 한도 | 잔여 |
|---|---:|---:|---:|---:|---:|
| Entry JS | 299,288 | 299,402 | +114 | 20,480 | 20,366 |
| Affected route JS | 2,451,581 | 2,451,562 | -19 | 61,440 | 61,459 |
| Shared JS | 2,714,508 | 2,715,801 | +1,293 | 30,720 | 29,427 |
| App JS | 5,465,377 | 5,466,765 | +1,388 | 81,920 | 80,532 |
| CSS | 37,693 | 37,693 | +0 | 10,240 | 10,240 |

[bundle JSON](evidence/bundle-after.json). 실제 production dist의 HTML문서105·canonical62·hreflang91·sitemap61 **집합 전체**가 S0와 동일하다. 단순 개수만 비교하지 않았다. [URL 집합](evidence/url-sets.json). 광역 실행 확장자 재귀 검색과 파일별 vendor 예외·소유 경계를 [inventory](evidence/repo-recursive-contract-inventory.json)에 기록했다. 새 네트워크/광고/서버 전제·URL 경로·의존 추가0; S2/S3 구현 변경0.

## bubblewrap 판정의 정확한 범위

sol의 `--ro-bind /tmp/worklazy-xd /tmp/worklazy-xd-s1-review/main`은 나중 mount가 하위 main을 덮으므로 **정확히 fix-1 파일을 읽는 매핑**이다. 이번 동일 구조의 읽기 전용 mount 안에서 locale2·엔진·formatter·report·worker·스모크7파일의 SHA를 커밋 blob 및 새 archive에 대조했다.

원본 SHA:
- `browser-extra.mjs`: `026e60ab9890a3346d957181f542efe0248cb22bf73b1ff485b1458d21cc760c`
- `error-contract.py`: `159f38a5d0ac5d230fce2b9a7a25d56b65317727e297ee3388651bf48b6e8e9e`

**단, main bind 자체는 브라우저의 앱 출처를 보장하지 않는다.** browser-extra는 Playwright/ExcelJS/JSZip 의존성을 main에서 읽고, 제품 JS는 `http://127.0.0.1:4350`에서 받는다. error-contract 역시 실제UI는 evidence JSON에서 읽으며 locale를 읽는 것만으로 UI pass를 만들지 않는다. 따라서 sol의 check.py가 `/tmp/worklazy-xd`를 cwd로 build를 실행한 기록, strict4350 preview 로그, 보존 dist75자산과 독립 재빌드의 일치, 당시 캡처의 fix 전에는 없던 양어 안내를 함께 확인했다. **엉뚱한 S1 트리를 검사했다는 증거는 없고 fix-1 실행을 뒷받침한다.** 과거 서버의 /proc 스냅샷까지 남아 있지는 않아 그 사실을 사후 직접 계측했다고 주장하지 않는다.

이번 재검수는 빈4350에서 새 archive production preview를 직접 실행하고 HTTP 응답 자산 SHA와 디스크 dist를 대조한 상태에서 무수정 원본 probe를 재실행했다. 따라서 이번 통과 판정은 sol의 과거 서버 추정에 의존하지 않는다. [구체 명령·SHA·한계](evidence/bubblewrap-provenance.json).

## 초기 harness 실패·불변·정지점

- 첫 `npm run test:unit`은 **378 pass/1 fail**. archive에 `.git`이 없어 `git ls-files`를 쓰는 광고 광역 검사 한 건이 `fatal: not a git repository`로 실패했다. [첫 출력](evidence/unit.log). archive에 c1e44f6의 commit/tree/blob만 복사해 독립 snapshot Git 메타데이터/인덱스를 구성하고, **코드/시험 변경 없이** 같은 명령 재실행은 **379/379**. 새 커밋·checkout·대상 브랜치 전환 없음. [사본 metadata](evidence/archive-git-setup.json).
- provenance 첫 실행은 이미 파일/HTTP SHA 대조를 통과한 뒤 `lsof`가 다른 도구 프로세스 namespace의 preview PID를 반환하지 않아 중단했다. [최초 기록](evidence/provenance-first-error.txt). 검증 경로를 실제 실행 command/workdir·strict preview 로그·응답 자산 SHA로 명시해 재실행했다. 제품 실패를 숨기거나 assertion을 일반 오류 허용으로 낮춘 경우가 아니다.
- mutant 두 exit1은 **의도된 음성 대조의 성공**이며 필수 원본 regression 실패와 구분했다. build 경고의 큰 chunk/정적 출력을 검사 실패로 숨기지 않고 원로그에 보존했다.
- 시작/종료 대상 status는 빈 문자열·HEAD/branch 그대로. 대상과 archive 각각 **추적2,400파일 SHA 동일**, 원본 probe·사용자3파일·S0 기준선 동일, 종료 새 git archive 스트림도 시작 tar와 동일. [시작](evidence/state-start.json), [종료](evidence/state-finish.json), [불변 요약](evidence/invariance.json). archive 자체 status도 빈 문자열이다.
- 검수 중 저장소 추적 파일 수정·커밋·push·브랜치 전환·병합·배포 없음. 종료4350~4359 listener0은 [ports-final.txt](evidence/ports-final.txt). 이 화면 확인은 S4 Gemini 시각·접근성 승인이나 배포 승인으로 대체하지 않는다.

**S2 착수 조건:** Claude가 통과 SHA `c1e44f6`·불변 S0 번들 기준선·S1+S2 단일 전환 경계를 연결한 정본 S2 지시서를 발행할 것.

**[검수 통과]. S1 단독은 병합·배포 후보가 아니다.**
