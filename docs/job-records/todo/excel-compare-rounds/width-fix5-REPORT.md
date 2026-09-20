# R4-numFmt fix-5 구현 보고

- 대상: `/tmp/worklazy-xr`, `excel-report-width-20260907`
- 기준: `88fa10e808592b19d580aefeaf64cc565aa7fccd`
- 구현 커밋: `8b5b50557615737dc61b9e0b5c47cb38a536cb87` (`Fix XLSX number format XML sanitization`)
- 종료 상태: worktree clean, main 병합·push 없음

## 원인·수리

지원되는 BIFF8 `.xls`의 `numberFormat`이 Excel 정리 `writeCleanedCell`의 보존 대입을 통해 sanitizer 없이 `target.numFmt`에 들어갔다. ExcelJS가 U+FFFE/U+FFFF를 `xl/styles.xml` 속 `formatCode`에 그대로 쓰면 ExcelJS와 ElementTree가 출력을 재개방하지 못했다. 변경 전 기준에서도 2/2 재현된 기존 결함이며 fix-4 회귀가 아니다.

- `source.numberFormat -> target.numFmt`에 공용 `sanitizeXlsxText`를 적용했다.
- `source.style -> target.style`의 별도 직렬화 경계에서 `style.numFmt`를 같은 sanitizer로 처리했다.
- 공용 직렬화 전 backstop에 `cell.numFmt`를 추가하고 `includeEmpty` 순회로 값 없는 서식 셀도 포함했다. 남은 금지 문자는 기존 `REPORT_INTEGRITY_FAILED`로 종료된다.
- 안전 거부 대신 위치별 U+FFFD 치환을 선택했다. 드문 문자 하나로 정리 전체를 실패시키는 손실이 더 크고, 셀 값·시트명의 기존 정책과 일치시키기 위해서다.

## 동일 필드 우회 전수

`src/features/excel-compare`, `src/features/excel-cleaner`, `src/features/qr-studio`, `src/utils/xlsxReport.ts`의 실행 확장자를 재귀 검색했다.

1. Excel 정리 `target.style = source.style` 안 `style.numFmt`: 입력 유래 우회, 수리.
2. Excel 정리 `target.numFmt = source.numberFormat`: 입력 유래 직접 대입, 수리.
3. 공용 writer `cell.numFmt = "@"`: 제품 상수로 안전. Excel 비교·QR 일괄은 이 경로만 사용.
4. Excel 비교 정규화 `style.numFmt`: 비교용 읽기만 하며 산출 workbook으로 복사하지 않음.

docProps creator는 제품 상수이고, 정리 writer는 정의된 이름을 복사하지 않으며 scalar/formula만 쓴다. 따라서 docProps·정의된 이름·하이퍼링크에 실제 입력 유래 R4 경로는 없었고 코드를 넓히지 않았다. 검색 원출력은 `logs/string-boundary-inventory.log`에 있다.

## R4 직접 검증

| 항목 | 결과 | 원출력 |
|---|---:|---|
| astra 원본 `style-safety-counterexamples.mts` | 2/2 pass | `logs/style-safety-final.log` |
| astra 원본 `style-boundary.mts` | 2건 `unsafeStylesXml=false`, ExcelJS error `null` | `logs/style-boundary-final.log` |
| 실제 parser→정리→출력 | BIFF8 3,584B 2건, 숫자 123과 `0"A�B"` 보존 | 위 두 로그, `artifacts/style-output-*.xlsx` |
| 브라우저 경로 | U+FFFE/U+FFFF 2건 모두 성공·123·`0"A�B"` | `logs/excel-cleaner-browser-artifacts.log`, `artifacts/style-browser-*.xlsx` |
| ElementTree | 직접·브라우저 출력 각 14 XML part 전부 parse | `logs/style-elementtree-final.log`, `logs/style-browser-elementtree.log` |
| mutant | fix-4 두 파일 복원 시 0/2, 둘 다 `disallowed character` | `mutant/logs/style-safety-mutant.log` |

원본 probe SHA-256은 `style-safety-counterexamples.mts=0f93f23c...d984be`, `style-boundary.mts=3db1c5d6...ed1e96`이며 두 파일은 수정하지 않았다.

## 문자 보존·비용

- 1,114,112 code point 전수에서 U+FFFD 치환 위치·길이, 유효한 보조 평면 쌍, CR, U+FDD0~U+FDEF 32개 보존을 확인했다 (`logs/characters.log`).
- 한글·이모지·통화 기호·`# 0 , . ; " \ yyyy-mm-dd`·U+FDD0~U+FDEF과 숫자 123 회귀를 추가했다. sanitizer는 CR을 유지하며, 이후 셀 CR→LF·속성 CR→공백·서식 escape 재파싱은 ExcelJS/XML의 기존 정규화로 분리했다.
- 34 workbook의 ExcelJS·ElementTree·LibreOffice 재개방이 통과했다 (`logs/three-readers-corrected.log`).
- 650,021셀 backstop 표본은 131/125/116ms였다. 직전 122/117/115ms와 동급이다 (`logs/value-scan-cost-final.log`). 50,000×13·9시트 보고서 생성은 6,129ms, 기존 ZIP 무결성 검사는 258/186/198ms였다 (`logs/performance.log`).

## 회귀 표

| 검증 | 결과 |
|---|---:|
| `./node_modules/.bin/tsc -b` | exit 0 |
| `npm run test:unit` | 267/267 |
| `npm run build` | 2,835 modules, 61 정적 페이지 |
| `npm run test:static` | exit 0, startup recovery 104 |
| `npm run test:excel-compare` | exit 0 |
| `npm run test:excel-cleaner` | exit 0, R4 브라우저 2건 포함 |
| `npm run test:qr-bulk` | exit 0; 알려진 경합 미재발 |
| `npm run test:browser` | exit 0, Excel·Word·PDF 전체 |
| `npm run bundle:measure` | exit 0, 80 JS / 1 CSS |
| `npm run css:orphans` | exit 0, orphan 0 |
| `node tests/tool-registry-routes.mjs` | exit 0, 20 route |
| `git diff --check` | exit 0 |
| 원본 R1/조합/요소/문자/R3 probes | 2/2·2/2·5/5·32/32·2/2 |
| 독립 확장 | 2,880/2,880 |
| 지정 음성/양성 | 6/6·4/4 |
| 폭·대량·토폴로지 | `[12,13,47,48,48]`, 50,000/150,000행, 9시트·13열 통과 |
| 스캐너/문자 참조 종료성 | 60/60·32/32 |
| 사용자 파일 | 713/37/48/4, 9시트·856행·95열·폭 12~48, 54,122B; LO CSV 99B/9행 |

최초 `early-exit-topology` 병렬 실행은 선행 fixture 생성과 경합해 ENOENT였고, 직렬 재실행은 통과했다. 최초 3-reader 격리는 LibreOffice의 `/tmp` 파이프 경로를 쓰기 가능하게 주지 않아 실패했고, 별도 `/tmp` sandbox로 같은 원본 probe를 재실행해 통과했다. 최초·정정 로그를 모두 남겼다.

UI·ko/en 문구·URL·SEO/정적 페이지·광고 배치/격리·서버 전제·의존성 변경은 없다. 검수 산출물·astra probe를 수정하지 않았고, 새 산출물은 이 디렉터리에만 저장했다.
