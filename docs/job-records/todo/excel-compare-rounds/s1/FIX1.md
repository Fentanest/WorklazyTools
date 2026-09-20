# Excel S1 fix-1 구현 보고

Codx · 2026-09-08

## 판정

S1-R01과 S1-R02를 수리해 브랜치 `excel-dupkey-20260907`에 커밋했다.

- 기준: `2c338cffea71c91531107dd5fce4273f04386c45`
- 수정 커밋: `c1e44f60096dfad33e6c225fdb96f5323516edf6` (`Restore duplicate key length recovery guidance`)
- 종료 상태: 추적 변경 없음, 브랜치 유지
- main 병합·push·배포 없음. S1 단독을 배포 후보로 취급하지 않음.
- S2 화면 전환·S3 머리글 감지 변경 없음.

## 실행 게이트

- 첫 행동으로 `PROJECT_RULES.md` 전문을 읽고 대상 `AGENTS.md`, fix-1 디스패치, astra S1 검수 보고·원본 probe·실패 증거, 정본 v3, 채택 R2-01 문안, S1 착수 지시서를 읽었다.
- 시작 `HEAD`와 브랜치는 지정한 `2c338cff…` / `excel-dupkey-20260907`와 정확히 일치했고 워킹트리는 깨끗했다.
- 대상 worktree에는 비추적 `docs/jobs/todo`가 없었다. astra 검수 잡이 같은 HEAD에서 보존한 열린 계획서 19개 목록·SHA와 재귀 스캔을 확인했으며 Excel S1 fix-1과 상반된 지시는 없었다. 최신 사용자 지시와 fix-1 디스패치를 적용했다.
- `/tmp/worklazy-xd`와 읽기 전용 `/tmp/worklazy-xd-s1-review`, 사용자 파일 사본, S0 번들/보존 준비물만 사용했다. 금지된 원 워킹트리, `/tmp/worklazy-xr*`, `/tmp/worklazy-dc-impl`에는 접근하지 않았다.

## S1-R01 수리

`src/locales/{ko,en}/features.json`의 `excelCompare.error.DUPLICATE_KEY_TOO_LONG`에 R2-01 문구를 그대로 연결했다.

- ko: `선택한 키 열의 내용이 너무 길어 보고서를 만들지 못했습니다. 더 짧은 값이 있는 열을 키로 선택해 다시 비교해 주세요.`
- en: `The selected key columns contain too much text for the report. Choose key columns with shorter values and compare again.`

구조 diff 결과 양쪽 locale에서 바뀐 값은 위 키 하나씩뿐이다. `ExcelComparePage.tsx`, worker, client, guard, 엔진, 보고서 formatter는 기준 커밋과 바이트 동일하다. 내부 code·원시 예외는 사용자 문구에 넣지 않았다.

## 강화한 스모크

단언 함수 `assertDuplicateKeyTooLongIsolation`을 ko/en 각각 실행한다.

1. 정상 CSV A 쌍
2. 32,768자 키가 두 행에 반복되는 정상 CSV 실패 쌍
3. 정상 CSV B 쌍

각 언어에서 다음을 단언한다.

- 실패 파일명과 정확한 원인·더 짧은 키 열 선택 복구 안내
- `DUPLICATE_KEY_TOO_LONG` 원시 code 비노출
- 개별 XLSX 정확히 2개와 ZIP 정확히 1개
- ZIP 내부 정상 XLSX 정확히 2개
- 개별/ZIP 보고서 각각 9시트·Duplicates 13열·분할 복원 검증 및 결과 일치

`npm run test:excel-compare` 결과:

| 언어 | 개별 보고서 | ZIP 내부 | 안내 | 원시 code |
|---|---:|---:|---|---|
| ko | 2 | 2 | 정본 문구 일치 | 숨김 |
| en | 2 | 2 | 정본 문구 일치 | 숨김 |

원출력: `evidence/smoke-excel-compare.log`.

## astra 원본 probe

검수 파일은 수정하지 않았다. `browser-extra.mjs`(SHA-256 `026e60ab9890a3346d957181f542efe0248cb22bf73b1ff485b1458d21cc760c`)와 `error-contract.py`(`159f38a5d0ac5d230fce2b9a7a25d56b65317727e297ee3388651bf48b6e8e9e`)를 원본 그대로 실행하되, bubblewrap로 검수 디렉터리를 읽기 전용, 대상 worktree를 검수 경로의 `main`, 이번 `evidence/`만 쓰기로 격리했다.

- `error-contract.py`: ko/en **2/2 통과**(직전 0/2)
- `browser-extra.mjs`: ko/en 모두 direct A/B와 ZIP A/B 일치, page error 0
- COMPARING 취소: terminate 1.330ms, 부분 성공 1, 취소 쌍 결과 0, 이전 URL revoke 1
- WRITING_REPORT 취소: terminate 1.170ms, 부분 성공 1, 취소 쌍 결과 0, 이전 URL revoke 1

원출력: `evidence/error-contract-original.log`, `evidence/browser-extra-original.log`.

실제 화면:

- ko: `evidence/private/browser-extra/ko-key-error.png`
- en: `evidence/private/browser-extra/en-key-error.png`

두 캡처 모두 파일명과 정본 복구 문구가 잘림 없이 표시된다.

## S1-R02 기록 정정

- `docs/review-notes.md`의 기존 “내부 key identity/reason/error code가 UI에 노출되지 않고 신규 ko/en 작업도 없다”는 판정을 직접 정정했다.
- 정확한 경계는 “신설 원시 오류 코드는 숨겨지지만, 기존 내부 key 표시와 그룹 값 소비는 S2에 남아 있다”이다.
- 내부 key와 빈 scalar 소비는 정본의 S1+S2 단일 전환 경계이며 별도 제품 결함으로 세지 않았다.
- fix-1의 누락·재현·수리·실측과 첫 harness 실패/재실행을 같은 작업 단위에 기록했다.
- `CHANGELOG.md`에는 코드·회귀·기록 변경만 한 줄로 남겼다. 두 기록 모두 Codx 서명이다.

## 사용자 파일 재현

`/tmp/worklazy-userfiles/`의 읽기 전용 사본만 사용했고 fixture로 커밋하지 않았다.

| 머리글/키 | S1 그룹 | Duplicates 데이터행 | matched / changed / added |
|---|---:|---:|---:|
| 1행 / B열 | 1 | 1 | 713 / 37 / 48 |
| 4행 / A열 | 6 | 6 | 486 / 134 / 31 |
| 4행 / B열 | 0 | 0 | 703 / 37 / 48 |

실제 브라우저 세 실행의 page error는 모두 0이다. 독립 probe는 27개 XLSX의 486 XML/rels를 다시 열어 9시트·Duplicates 13열·폭 12~48·문자 길이와 토폴로지를 모두 통과했다. 원출력: `evidence/independent-original.log`, `evidence/user-browser-original.log`, `evidence/xml-check-original.log`.

## 선행 안전화 보존

- writer 문자 안전화·희소 data-row backstop·Row/Column `numFmt` backstop 및 `xlsxReportDataRows` 관련 생산 파일은 기준 커밋과 바이트 동일하다.
- 원본 보존 suite 17명령 전부 exit 0.
- 보존 산출물 204파일·2,267 XML/rels: 예상 밖 malformed 0, 문자 workbook 34/셀 70, sparse 3,900·19,000, numFmt 13조건 통과, 원본 probe 16개 SHA 불변.
- XML 집계 첫 실행은 격리 증거 경로에 `preservation-original-sha.json`을 복사하지 않아 제품 실행 전에 실패했다. `evidence/preservation-xml-original-first.log`를 보존하고 원본 manifest를 제공한 동일 probe 재실행은 통과했다. 채택 출력은 `evidence/preservation-xml-original-final.log`다.

## 필수 회귀

| 명령 | 결과 |
|---|---|
| `./node_modules/.bin/tsc -b` | exit 0, 진단 0 |
| `npm run test:unit` | exit 0, 379/379 |
| `npm run build` | exit 0, 2,835 modules·정적 61페이지 |
| `npm run test:static` | exit 0, startup 104문서 |
| `npm run test:excel-compare` | exit 0, 강화 ko/en 단언 포함 |
| `npm run test:excel-cleaner` | exit 0 |
| `npm run test:qr-bulk` | exit 0, 4351 strict preload |
| `npm run test:browser` 전체 | exit 0 |
| 원본 `browser-extra.mjs` | exit 0 |
| 원본 `error-contract.py` | exit 0, ko/en 2/2 |
| 원본 독립/사용자/XML probe | exit 0 |
| 원본 선행 보존 17명령 + XML | 최종 exit 0 |
| `npm run css:orphans` | exit 0, orphan 0 |
| `node tests/tool-registry-routes.mjs` | exit 0, 20 tools |
| `git diff --check` | exit 0 |

명령·시간·원출력은 `evidence/checks.jsonl`과 각 `evidence/*.log`에 있다.

## 번들·제품 경계

기준선 `/tmp/worklazy-excel-s0/evidence/bundle-baseline.json` SHA-256은 지정값 `726a2d5be21ca250c76a5a9c9220affb8931da9286769f762f3531fd64d002c8`과 일치했고 재설정·예산 증가는 하지 않았다.

| gzip 항목 | 현재 | S0 대비 | 한도 | 판정 |
|---|---:|---:|---:|---|
| Entry JS | 299,402 | +114 | +20,480 | 통과 |
| Affected route JS | 2,451,562 | -19 | +61,440 | 통과 |
| Shared JS | 2,715,801 | +1,293 | +30,720 | 통과 |
| App JS | 5,466,765 | +1,388 | +81,920 | 통과 |
| CSS | 37,693 | 0 | +10,240 | 통과 |

URL 문서 105·canonical 62·hreflang 91·sitemap 61 집합은 S0와 같다. 새 network/API·광고·서버 전제 줄은 0이고 의존성 변경도 없다. 범위 증거: `evidence/fix-scope.json`; 번들: `evidence/bundle-after.json`, `evidence/bundle-measure.log`.

## 종료

- 커밋 `c1e44f60096dfad33e6c225fdb96f5323516edf6`
- `git status --short --branch`: `## excel-dupkey-20260907`
- 4350~4359 listening socket: 0
- push·병합·배포 없음

astra 재검수 대기 상태에서 정지한다.
