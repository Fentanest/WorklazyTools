# Excel 중복키 S1 검수 재개 보고

**[수정 후 재검수] — 제품 입력에서 재현되는 정본 누락 1건(P2: 긴 키 오류의 ko/en 복구 안내). 구현 기록의 현재 UI 비노출 주장도 정정 필요.**

Codx · 2026-09-08 · 대상 `2c338cffea71c91531107dd5fce4273f04386c45`, 부모 `597a92ff56ed9c3eb23755a58df2580b0269b8bd`.

그룹 스키마·identity·요약·분할·Key 길이 거부·쌍 격리·취소·선행 안전화의 새 기능 결함은 아래 재현에서 발견하지 못했다. 사용자 Excel은 목표 **1·6·0그룹**을 재현했다. 필수 빌드·단위시험·스모크·번들 검사는 통과했다. 그러나 정본 R2-01에 명시된 신설 오류의 행동 안내가 구현되지 않아 무조건적인 검수 통과를 선언하지 않는다. **S1 단독은 병합·배포 후보가 아니다.**

## 1. 실행 게이트와 불변 증명

- 첫 행동으로 `PROJECT_RULES.md` 전문을 읽었다. 이어 대상 `AGENTS.md`, [검수 지시](input/excel-s1-review-dispatch.md), [정본 v3](input/excel-compare-dupkey-header-20260907.md), 채택 [R2 문안](input/round-2-AMENDMENTS.md), S0 보고, [S1 착수 지시](input/excel-s1-dispatch.md), sol 보고와 관련 review-notes를 읽었다. `v3 > v2 > v1` 우선순위를 적용했다.
- `/tmp/worklazy-xd`의 branch=`excel-dupkey-20260907`, HEAD·부모가 지정값과 일치했다. 시작·종료 status는 모두 빈 문자열이고 **추적 2,400파일의 SHA-256이 전부 동일**하다. [재개 상태](evidence/state-resume.json), [종료 상태](evidence/state-finish.json), [source 시작](evidence/source-resume.json), [source 종료](evidence/source-finish.json).
- 대상에는 `docs/jobs/todo`가 없다. 접근 금지 원 트리에서 찾아 읽지 않고 S0가 보존한 **열린 계획서 19개**를 재스캔했다. [목록·SHA](evidence/open-plans-inventory.json), [검색 원출력](evidence/open-plans-scan.txt). S0의 Excel 본체·후속·폭/문자 안전화 계승 및 U4 공용 파일 통합 경계와 이번 고정 SHA 검수 사이에 상반 지시는 발견되지 않았다. **실시간 원 트리의 미공개 계획 변경까지 확인했다는 주장은 아니다.** 최신 사용자 지시와 S1 디스패치를 이번 실행의 정본으로 적용했다.
- 기존 `/tmp/worklazy-xd-s1-review/main`과 설치를 재사용했다. 준비물의 추적 2,400파일은 이전 잡의 시작 SHA 및 `source.tar`와 모두 일치했다. 종료 때 **새 `git archive 2c338cf` 스트림**도 저장 tar와 동일한 SHA `1031678f8091e1131cb22eeb2742ffaa324515795f47fe2eff86d47ec45dde42`였다. [archive 출처](evidence/archive-provenance.json). 사본의 독립 `.git`은 detached HEAD이며 검증 후에도 status 빈 문자열·2,400파일 불변이다.
- 부모 엔진 대조에는 `git show 597a92f:src/features/excel-compare/compareEngine.ts`를 읽어 [비교용 사본](probes/parent-engine.ts)을 만들었다. import 경로만 현재 archive의 **바이트가 같은** normalization·alignment 등으로 연결했다. 대상 worktree나 부모 checkout을 실행·수정하지 않았다.
- 사용자 파일은 `/tmp/worklazy-userfiles/`에서 읽기만 했다. 두 원본과 참고 비교본의 크기/SHA는 모두 지시서와 일치하며 종료에도 같다. 입력 SHA: `3152fb51…6a4a9` / `faab6f10…319cf` / 참고 `6a2ab5f7…e7cce0`. 전체 값은 [상태 증거](evidence/state-finish.json)에 있다. 사용자 값이 담긴 결과는 `evidence/private/`에만 저장했다.
- Node `v22.17.1`, heap 상한 4GiB, [env.sh](env.sh). 빌드·브라우저·번들 및 큰 성능 probe는 직렬 실행했다. preview는 **4350 `--strictPort`**, QR 보조 proxy는 무수정 S0 preload로 **4351**에 고정했다. 종료 시 **4350~4359 리스너 0**: [포트](evidence/ports-final.txt).
- 공통 규칙 첫 선독 외 원 워킹트리의 작업 소스, `/tmp/worklazy-xr*`, `/tmp/worklazy-dc-impl`은 열거나 실행하지 않았다. 선행 probe는 허용된 S0 첨부 사본에서 읽었다. 이 잡의 새 파일·빌드·브라우저 다운로드는 모두 `/tmp/worklazy-xd-s1-review/` 안에 있다. 저장소 추적 수정·커밋·push·브랜치 전환·병합·배포 없음.

## 2. 수정 지시

### S1-R01 — P2, 신설 오류의 정본 복구 안내 누락

**도달성:** 지원되는 정상 CSV의 선택 키 값이 32,768자이고 두 행에 반복되면 발생한다. 잘못된 JavaScript 객체를 주입하거나 XLSX ZIP을 변조할 필요가 없다. 각 파일이 손상된 사례가 아니다. [Playwright 원본](probes/browser-extra.mjs)은 정상 쌍 → 긴 키 쌍 → 정상 쌍의 순서로 ko/en을 각각 실행했다.

**기대:** 정본의 일부로 채택된 [R2-01](input/round-2-AMENDMENTS.md)은 `DUPLICATE_KEY_TOO_LONG`의 ko/en 문구를 구체적으로 지정한다. S1이 이 오류와 쌍 실패 경로를 신설했고, 이 안내를 S2로 유예한다는 예외는 지시서에 없다. S2의 그룹 목록·검색 전환을 착수하라는 지적이 아니라 **S1에서 추가한 실패 원인에 맞는 오류 메시지 연결 누락**이다.

| 언어 | 실제 UI | 정본 기대 |
|---|---|---|
| ko | 파일을 비교하지 못했습니다. 손상 여부와 지원 형식을 확인해 주세요. | 선택한 키 열의 내용이 너무 길어 보고서를 만들지 못했습니다. 더 짧은 값이 있는 열을 키로 선택해 다시 비교해 주세요. |
| en | The files could not be compared. Check that they are supported and not damaged. | The selected key columns contain too much text for the report. Choose key columns with shorter values and compare again. |

재현: `python3 ../probes/check.py browser-extra 'node ../probes/browser-extra.mjs'` → guard·격리·다운로드·ZIP/내용 단언 통과. 이어 `python3 ../probes/check.py error-contract 'python3 ../probes/error-contract.py'` → **exit 1, ko/en 0/2**, 양쪽 locale의 해당 키 `null`. [실패 원출력](evidence/error-contract.log), [구조화 증거](evidence/error-contract.json), [ko 실제 화면](evidence/private/browser-extra/ko-key-error.png), [en 실제 화면](evidence/private/browser-extra/en-key-error.png).

소스 근거: `duplicateReport.ts:181` 이후 guard는 해당 code를 설정하고 worker가 이를 post한다. `ExcelComparePage.tsx:409`의 `safeError`는 code별 locale 조회 후 `PROCESSING_FAILED`로 fallback한다. `src/locales/{ko,en}/features.json`의 `excelCompare.error`에 신설 키가 없어 정상 입력을 손상/미지원 확인으로 잘못 안내한다. **데이터 유실·안전 거부 실패는 아니다.** 두 정상 쌍은 계속 성공하고 실패 쌍만 제외되는 것은 통과했다.

**sol 수정 지시 문안:**

> `src/locales/ko/features.json`과 `src/locales/en/features.json`의 `excelCompare.error.DUPLICATE_KEY_TOO_LONG`을 정본 R2-01 문구로 연결하라. 기존 code 전달·쌍 격리·guard를 유지하고 S2 목록 UI에는 착수하지 않는다. `tests/excel-compare-smoke.mjs`의 긴 키 실패 검사를 일반 오류 허용에서 ko/en의 원인·복구 안내 단언으로 강화하고, 정상 두 쌍+실패 한 쌍에서 개별 보고서 2개와 ZIP 내부 2개만 남는 것을 검증하라. `CHANGELOG.md`에는 변경만, `docs/review-notes.md`에는 이번 누락과 재현·수리 결과를 Codx 서명으로 기록하라. 아래 필수 S1 명령을 새 커밋에서 실행하고 같은 S0 번들 기준선을 유지한 뒤 astra 재검수를 요청하라.

### S1-R02 — 기록 정정, S2 상태를 S1 완료로 서술한 표현

`docs/review-notes.md:40`의 “내부 key identity/reason/error code는 UI에 노출하지 않으므로 … 불필요”는 현재 UI 전체에 대한 사실로는 틀리다. 실제 1행/B 및 4행/A 결과 테이블은 `string:`/`number:` 내부 key를 표시하고, scalar가 빈 문자열인 중복 값 두 칸도 비어 있다. `ExcelComparePage.tsx:211,261`은 부모와 바이트가 같으며 여전히 scalar/key 소비처다. [직접 화면](evidence/private/duplicates-s1.png), [DOM 요약](evidence/ui-stage-boundary.json), [사용자 브라우저 원출력](evidence/browser-user.log).

이 모습은 **정본이 S1+S2 단일 전환을 요구한 이유**이며, 새 그룹 표시를 S1에서 구현해야 한다는 별도 제품 결함으로 세지 않는다. 페이지 crash·기존 일반 비교·다운로드 파손은 재현되지 않았다. 다만 기록은 “신설 원시 오류 코드는 숨겨지지만, 기존 내부 key 표시/그룹 값 소비는 S2에 남아 있다”로 한정해 정정해야 한다. **R01의 안내 누락까지 포함해 신규 ko/en 작업이 없다고 판정한 부분도 고쳐라.**

## 3. 검수 항목별 판정

재현 기본 위치는 `/tmp/worklazy-xd-s1-review/main`, 환경은 `source ../env.sh`다. 각 명령의 원문·exit·소요시간은 [checks.jsonl](evidence/checks.jsonl)에 기록했다. `I`는 [독립 probe](probes/independent.mjs)/[결과](evidence/independent.json), `S`는 [보충 probe](probes/supplement.mjs)/[결과](evidence/supplement.json), `B`는 [Playwright](probes/browser-extra.mjs)/[결과](evidence/browser-extra.json)다.

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| A1 네 배열·인덱스·없는 측 | 통과 | `node --experimental-strip-types --expose-gc ../probes/independent.mjs`(I): 실제 XLSX **0..8 × 0..8=81구성**, 3정책 **243대조**. 2:0/0:2/2:1/1:2/1:1/3:3 및 대칭·비대칭 전부 포함. | 없음 |
| A2 반대편 singleton 포함·양 map 삭제 | 통과 | I: 각 duplicate 원본 행이 일반 records에 한 번도 재등장하지 않음. `primaryLeft.delete`·`primaryRight.delete` 코드 확인. | 없음 |
| A3 1:1 기존 비교 | 통과 | I 1:1·표준 행 대조: duplicate 0, 부모의 scalar records와 deep equality. | 없음 |
| A4 다른 상태 스키마·값 불변 | 통과 | I+`node --experimental-strip-types ../probes/supplement.mjs`(S): **matched/changed/added/removed/ambiguous/unmatched/error 7상태** 전부 실제 실행. 부모와 records/summary/warnings/parameters deep equality, 새 필드 부착 0. | 없음 |
| A5 scalar null/빈 문자열 | 통과 | I의 모든 duplicate에 행/열 4필드 null, scalar 값 2필드 빈 문자열 단언. | 없음 |
| A6 Set·원본 행 순서·정책 | 통과 | I: 그룹 순서 B→A→C, 측별 원본 행 오름차순. secondary/occurrence는 전체 결과가 부모와 동일. | 없음 |
| B7 displayKey 생성 | 통과 | I: 선택 열 `[1]`, `[1,2]`, `[2,1]`·좌측 우선/우측 fallback. `cellText(...).join(' \| ')`와 실제 셀 값 비교. 내부 key를 파싱하는 코드 없음. | 없음 |
| B8 같은 표시값의 다른 identity | 통과 | I: 숫자1/문자1은 표시 `1 \| x`의 두 그룹, 복합 구성의 표시 `a \| b \| c`도 두 그룹 유지. 표시값으로 합쳐짐 0. | 없음 |
| B9 빈값·숫자/문자·공백·Unicode | 통과 | I: 열순서 3종×정규화 7조합 **21대조**, duplicate 내부 key 집합·순서가 부모와 동일. | 없음 |
| C10 summary 의미·골든 | 통과 | 사용자 및 I: 레코드 수→그룹 수만 변경. 기존 골든 변경은 `tests/unit/excel-compare.test.ts:296`의 **4→1 한 곳**이며 그 입력은 A키 2:2=1그룹. 정본·CHANGELOG·review-notes에 의미 변경 명시. 다른 summary는 부모와 동일. | R02의 별도 기록 표현만 정정 |
| D11 두 목록 16,000 예산 | 통과 | I의 접두사·LF 포함 정확 16,000은 1행, +1은 2행. 빈 값 12,000행 포함 모든 행번호/값 셀 ≤16,000. 쉼표+공백·접두사 계산 코드 확인. | 없음 |
| D12 탐욕·독립·긴 행·문자 경계 | 통과 | I **19반례**, 15,996~16,001·32,767/32,768 값, emoji/CRLF/결합 문자를 경계 ±1에 배치. surrogate/CRLF 중간 분할 0. 긴 단일 행은 전용 조각. 결합 문자 grapheme 미분할까지 확장한 계약은 없으며 code unit/순서 복원은 동일. | 없음 |
| D13 반복 Key/Change/Reason·조각 범위 | 통과 | I 전체 보고서 재개방: Key·KEY·DUPLICATE_KEY·문맥 반복, 각 조각에 해당 행만, `r [i/n]` 정상. 기존 스모크와 B 실다운로드/ZIP도 동일. | 없음 |
| D14 무손실 | 통과 | I: 분할 전후 원본 행→값 **Map 전체와 순서 deep equality**, 중복 항목 소실 검출. B: emoji·결합 문자·CRLF 포함 긴 값이 개별/ZIP 8개 XLSX에서 재접합 동일. writer의 금지 문자 치환·XML CRLF→LF 계약 범위 적용. | 없음 |
| D15 측별 소진 빈칸 | 통과 | I·스모크·B: 왼쪽 여러 조각 뒤에도 오른쪽 완료 시 행번호/값 모두 빈 문자열. | 없음 |
| D16 엔진 records와 분할 객체 분리 | 통과 | I: formatter/build 전후 result JSON 동일. 30,000행도 records 1, report만 분할. | 없음 |
| E17 길이 경계 양/음성 | 통과 | I 실제 XLSX **20조합** + S 원시 displayKey **20조합**: 15,999/16,000/16,001/32,767/32,768×single/LF/CR/CRLF. 단일 32,767 및 multiline 16,000까지 수락, 초과 전용 code. | 없음 |
| E18 실패 쌍 격리·공개 순서 | 기능 통과 / 안내 실패 | B ko/en: 정상→실패→정상에서 결과 2, 개별 XLSX 2, ZIP entry 2. 실패 worker는 `WRITING_REPORT → error(DUPLICATE_KEY_TOO_LONG)`, COMPLETE/result 0. worker 소스는 build→await 생성검사→result 순서. | **R01** |
| E19 Key 자르기·대체 금지 | 통과 | I/S: 수락 Key 원문 동일, 초과 Key는 성공 결과 없음. 여러 줄 Key를 목록 분할만으로 우회하지 않음. | 없음 |
| E20 일반 긴 목록 성공 | 통과 | I: 30,000행 한 그룹 보고서 233,238B 성공. B의 33k 이상 값 목록도 정상 report/ZIP 복원. | 없음 |
| F21 4,096 취소·긴 값·URL | 통과 | I: 4,095/4,096/8,192/30,000행에서 grouping/value checkpoints **0/1/2/7** 각각. 해당 callback에서 AbortSignal을 중단해 예외 실제 발생. 긴 값 3번째 조각 취소. B terminate 취소는 비교 **1.295ms**, 작성 **1.165ms**; 취소 쌍 부분 결과 0, 기존 성공 1건 유지, 재실행 시 그 URL revoke 확인. | 없음; terminate와 cooperative callback을 혼동하지 말 것 |
| F22 append·30,000행 성능 | 통과 | I: 비교 **102.067ms**, 부모 **4,822.365ms**, 보고서 생성/검사 **181.952ms**. 해당 비교·취소 probe 구간 RSS 증가 **6,012,928B**, 프로세스 peak 측정값은 아님. 1회 합성 측정이며 보편적인 속도 배율로 일반화하지 않음. `group.push(row)` 확인. | 없음 |
| G23 고정 9항목·그룹 구간·UNUSED | 통과 | I: 2그룹/5보고서행의 `Duplicates!2:5`, `Duplicates!6:6`; 그 외 다중 구간도 일치. S의 position/secondary/occurrence/reconcile 등 5경로에서 **고정 9항목 UNUSED**, 그룹 항목 0. 기존 duplicateKeyPolicy는 이 9항목에 포함하지 않음. | 없음 |
| G24 metadata 위치·불변 | 통과 | I build 전후 summary/records 불변. UI 결과 테이블·실패 안내에 Parameters 코드/행 추가 없음. | 없음 |
| G25 무결성·토폴로지 | 통과 | 생산 assertGenerated/가시성 검사 및 ElementTree: **32파일·576 XML/rels** 전부 재개방. 9시트 이름/순서·Duplicates 13열 이름/순서·폭12~48·목록/전체 셀 길이·수식 객체 없음 단언. | 없음 |
| H26 선행 보존 | 통과 | 아래 원본 보존 suite **17명령 전부 exit0**. writer/helper/validator/worker/cleaner 등 14개 명시 파일 부모와 byte 동일. R1~R6·문자·희소2·13조건·16,384열 재현. | 없음 |
| I27 사용자 파일 | 통과 | I+실제 브라우저의 두 원본 3조합: **1·6·0**, 나머지 summary·records 부모와 동일. 모든 실제 다운로드 XML/폭/토폴로지 통과. | 없음 |
| J28 범위·제품 경계 | 통과 | `git diff --stat 597a92f..2c338cf`: **9파일 +1004/−24**, 제품4·시험3·기록2. S2/S3 제품 변경0, 의존 변경0. URL집합 동일, 새 네트워크/광고/서버 코드0. | R01 locale 연결은 신설 오류 계약의 보완 |
| J29 기존 화면 | S1 단계 한정 통과 | 3개 사용자 실행 pageErrors0·다운로드 정상, 전체 브라우저 회귀 통과. **그룹 값 빈칸·내부 identity 표시는 실제로 남아 있음**; 정본에서 S2로 예정된 소비처 전환이다. | S2에서 전환; S1에 이미 비노출이라는 기록은 **R02**로 정정 |
| J30 전체 검증 | 명령 통과 | 아래 회귀/번들 표, tsc·unit379·build·static·3스모크·전체 browser·5번들·CSS·routes·diff 전부 exit0. | 신설 오류 안내 단언은 현재 실패이므로 R01 수리 후 재실행 |
| J31 기록 정확성 | 일부 정정 필요 | 골든·count 의미와 구현/측정 기록은 대체로 일치. `review-notes.md:40`의 UI 비노출/ko-en 불필요 일반화는 실제 화면과 불일치. | **R02**, R01 수리 결과 기록 |
| K32 종결 | **수정 후 재검수** | 필수 산출물과 불변 증거 저장. 엔진·보고서 기능을 통과했다고 전체 정본 충족으로 확대하지 않음. | R01·R02 해소 및 astra 재검수/Claude 게이트 후 S2 |

## 4. 사용자 파일 재현

| 머리글/키 | 부모 duplicate 레코드 | S1 summary/그룹 | Duplicates 데이터행 | matched / changed / added |
|---|---:|---:|---:|---|
| 행1 / B | 4 (=1키) | **1 / 1** | **1** | **713 / 37 / 48** |
| 행4 / A | 24 (=6키) | **6 / 6** | **6** | **486 / 134 / 31** |
| 행4 / B | 0 | **0 / 0** | **0** | **703 / 37 / 48** |

길이 경계 보충: 실제 XLSX의 CRLF는 입력 재개방에서 LF로 정규화될 수 있어 원본 16,001 code unit이 displayKey 16,000이 되는 표본이 있었다. 이를 guard 우회로 판정하지 않았고, 별도 원시 displayKey 20조합으로 CRLF를 포함한 정확한 16,000/16,001 경계를 직접 검증했다.

부모 엔진과 S1의 duplicate 외 records·warnings·parameters 및 다른 summary를 전체 대조했다. 1/B 그룹은 양측 `[2,3]`이고 행4/A는 각 측 두 행을 갖는 6그룹이다. Node 생성만이 아니라 브라우저 파일 선택·머리글/키 지정·상태 필터·실다운로드까지 각각 실행했다. [구조화 결과](evidence/user-results.json), [브라우저](evidence/browser-user.log), [전체 XML](evidence/independent-xml.json). 사용자 원문 값은 private 증거로 제한한다. `…-vs-….xlsx` 참고본은 SHA만 확인했으며 S1 결과 oracle로 쓰지 않았다.

## 5. 선행 원본 probe와 독립 재개방

명령: `python3 ../probes/preservation-suite.py`. [runner](evidence/preservation-runner-final.log), [각 명령](evidence/preservation-suite.json), [원본 16파일 SHA](evidence/preservation-original-sha.json).

원본 probe를 S0 첨부에서 **바이트 그대로** 복사했다. [loader](probes/preservation-loader.mjs)/[hooks](probes/preservation-hooks.mjs)는 실행 시 `../source/`를 2c338cf archive로, 옛 절대 출력 경로 문자열을 이 잡의 `preservation/`으로만 치환한다. 원본 파일·단언·fixture 구성은 수정하지 않았다. 이 치환은 메모리에서만 하며 금지 경로를 읽지 않는다. 구 `fix5`/`fix6` 비교 writer는 허용된 Git 객체 `8b5b505`/`de66637`에서 별도 추출했다. 일부 원본의 변수 라벨 `fix6`은 `../source`를 가리켜 **이번 실행에서는 2c338cf**다. 라벨을 실제 버전으로 오인하지 않았다.

| 원본/보존 검사 | 실제 결과 |
|---|---|
| R1 empty / R2 empty / 조합 / 요소 경계 | **2/2 · 2/2 · 2/2 · 5/5** |
| lexical / writer 문자 / XLS number format / R6 Row·Column | **32/32 · 2/2 · 2/2 · 2/2** |
| 문자 전수 및 CSV/공용 writer/cleaner | **1,114,112/1,114,112**, 32 CSV 사례, 34 workbook/70셀 독립 ElementTree 내용 대조 |
| data-row 음성/양성 | **6/6 안전 거부 · 4/4 성공**, helper가 데이터0을 보고하고 생산 검사에서 거부하는 분리 유지 |
| numFmt 13조건 | **13/13 안전 오류, serializer0, 객체 수 불변**. 추가 목표 12개·원본 목표 독립 인과 13개·정상 서식11개 보존 |
| 희소 3,900×512 | 논리1,997,312셀, 실제4,412셀, 출력 **218.581ms / 47,293B**, 5시트, `SR3901=3901` |
| 희소 19,000×512 | 논리9,728,512셀, 실제19,512셀, 출력 **641.617ms / 170,341B**, 5시트, `SR19001=19001`, 경고 LARGE_FILE만 |
| 16,384열 | 한 시트/16자 서식 검사 중앙값 **1.789ms**, 9시트 **16.191ms**, 한 시트/1,024자 서식 **88.273ms**. 저장 열·행·셀 객체 불변, 생성 API 호출0 |
| 희소 객체 생성 차단 | `getRow/getCell/getCellEx/getColumn`을 throw로 바꿔도 검사 통과. 객체3→3, 참조 동일, 생성 호출0 |

독립 Python 검사: `python3 ../probes/preservation-xml.py` → **204 XLSX / 2,267 XML·rels part 검사**, 예상 밖 malformed0. [결과](evidence/preservation-xml.json). 이 중 23개는 의도된 비교용 malformed 산출물이다: 과거 fix5의 Row/Column 누락 3개, 기존 계약 밖 boxed/array/toString numFmt·getter 가림 20개. 현재/과거가 같은 비문자열 JavaScript 객체 한계를 재현한 것이며 **새 제품 입력 결함으로 세지 않았다**. 정상 원본 문자열 numFmt의 새 오탐·거짓 음성은 없다. 현재 사용자/분할 보고서 32개는 별도 검사에서 모두 정상이다.

## 6. 필수 명령과 번들

| 명령 | 결과·시간 | 원출력 |
|---|---|---|
| `./node_modules/.bin/tsc -b` | exit0, 17.060s | [tsc](evidence/tsc.log) |
| `npm run test:unit` | **379/379**, exit0, 4.015s | [unit](evidence/unit.log) |
| `npm run build` | exit0, 90.797s, 2,835 modules·61 정적 페이지 | [build](evidence/build-resume.log) |
| `npm run test:static` | exit0, 0.776s, startup104 | [static](evidence/static-resume.log) |
| `npm run test:excel-compare` | exit0, 25.731s | [compare](evidence/smoke-excel-compare.log) |
| `npm run test:excel-cleaner` | exit0, 54.119s | [cleaner](evidence/smoke-excel-cleaner.log) |
| `npm run test:qr-bulk` + strict4351 preload | exit0, 49.080s | [QR](evidence/smoke-qr-bulk.log) |
| `npm run test:browser` (`TEST_SCOPE` unset) | exit0, 50.936s, Excel·Word·PDF 전 범위 | [browser](evidence/smoke-browser-full.log) |
| `BUNDLE_BASELINE=…/worklazy-excel-s0/evidence/bundle-baseline.json BUNDLE_MEASURE_OUTPUT=…/evidence/bundle-after.json npm run bundle:measure` | exit0, 72.805s | [bundle](evidence/bundle-measure.log) |
| `npm run css:orphans` | exit0, orphan0 | [CSS](evidence/css-orphans.log) |
| `node tests/tool-registry-routes.mjs` | exit0, 20 tools·누락/추가/중복0 | [routes](evidence/registry.log) |
| `git diff --check 597a92f..2c338cf` | exit0 | [diff](evidence/diff-check.log) |

tsc/unit 두 명령은 **이전 astra 검수 잡이 이 동일 archive에서 직접 실행한 유효한 준비물**을 재사용했다. sol의 통과 표를 검증 출력으로 전용한 것이 아니다. 원출력/exit와 이전·재개·종료 2,400파일 SHA를 대조했으며 이번 새 build에서도 tsc를 실행했다. 그 외 위 표의 명령은 이번 재개 실행이다. 초기에 중단된 이전 build 로그와 이번 완주 build 로그는 별도 보존했다.

번들 기준은 지정 S0 파일 하나이며 SHA-256 **`726a2d5be21ca250c76a5a9c9220affb8931da9286769f762f3531fd64d002c8`**를 시작·종료 확인했다. 동일 schemaVersion1·lazy19 routes·JS80/CSS1·multiplier1·override{}이며 U4 측정기/기준선은 사용하지 않았다.

| gzip 항목 | S0 | S1 재측정 | 증가 | 증가 상한 | 잔여 |
|---|---:|---:|---:|---:|---:|
| Entry JS | 299,288 | 299,294 | **6** | 20,480 | 20,474 |
| Affected route JS | 2,451,581 | 2,451,591 | **10** | 61,440 | 61,430 |
| Shared JS | 2,714,508 | 2,715,815 | **1,307** | 30,720 | 29,413 |
| App JS | 5,465,377 | 5,466,700 | **1,323** | 81,920 | 80,597 |
| CSS | 37,693 | 37,693 | **0** | 10,240 | 10,240 |

[bundle JSON](evidence/bundle-after.json): 귀속 이동0, route→shared 이동0, shared 순증1,307B. Excel compare/cleaner worker의 기존 shared 분류를 유지했다. source/UI 정적 입력과 **실제 dist 집합**도 비교해 HTML 문서105·canonical62·hreflang쌍91·sitemap61이 부모와 같았다. 이 문서105와 startup 검사104는 서로 다른 집계다. [집합](evidence/url-sets.json), [범위·14개 불변 파일](evidence/scope.json), [실행 확장자 재귀 검색·명시 제외 소유 경계](evidence/repo-recursive-contract-inventory.json). 새 광고 예외·서버 전제·의존성·URL 경로 추가0.

## 7. 실패 출력의 분리와 종료 조건

- **제품 정본 실패:** [error-contract.log](evidence/error-contract.log)의 ko/en 복구 안내 0/2. R01로 남는다. 일반 오류를 허용하는 기존 스모크가 녹색인 것과 별개다.
- **보존 harness 첫 실행 실패:** Node 22의 synchronous `registerHooks`가 ExcelJS/JSZip CJS 의존 경로에서 `ERR_INTERNAL_ASSERTION: Unexpected module status 3`로 중단했다. [최초 runner](evidence/preservation-runner.log), `evidence/preserve-*.log` 보존. async loader로 바꾼 뒤 원본 16파일 SHA를 유지한 17명령을 전부 재실행해 통과했다. 제품 코드·원본 probe를 고치지 않았다.
- **보충 harness 최초 실패:** 새 Parameters 9개를 셀 때 기존 `duplicateKeyPolicy`도 `startsWith('duplicate')`에 포함해 10개로 오인했다. [최초](evidence/supplement.log)를 보존하고 새 계약의 명시 집합(`duplicateCountUnit`/`duplicateReport*`)으로 고친 [재실행](evidence/supplement-final.log)은 5모드와 원시 Key20경계를 모두 통과했다. 제품 결함이 아니다.
- R6 객체 모델 음성 대조의 예상된 23 malformed와 초기 harness 실패를 “모두 정상 XLSX”로 바꾸어 보고하지 않았다. 현재 제품 문자열 입력의 정상 출력과 구분했다.
- 사용자/그룹 화면은 직접 열어 확인했지만 **S4 Gemini 시각·접근성 승인이나 배포 승인으로 대체하지 않았다**. 이 잡은 S1 검수다.

**S2 착수 조건 한 줄:** R01의 정본 ko/en 안내와 R02 기록을 수리한 커밋에 대해 S1 재검수를 통과하고, Claude가 그 SHA·불변 S0 번들 기준선·S1+S2 전환 경계를 연결한 단일 S2 지시서를 발행할 것.

**[수정 후 재검수]. S1 단독은 병합·배포 후보가 아니다.**
