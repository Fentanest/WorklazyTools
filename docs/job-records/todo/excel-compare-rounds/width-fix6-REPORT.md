# R5-sparse-backstop fix-6 구현 보고

- 대상: `/tmp/worklazy-xr`, 브랜치 `excel-report-width-20260907`
- 기준: `8b5b50557615737dc61b9e0b5c47cb38a536cb87`
- 구현 커밋: `de6663797a3b1ceb45ceba87041fcbfda8a7746a` (`Fix sparse XLSX backstop iteration`)
- 종료 상태: worktree clean, main `cdb4007faea277ffc3ae9f3f7f4fe6fd8b8ba7be` 불변, merge·push 없음

## 원인과 수리

fix-5의 `worksheet.eachRow({includeEmpty:true})`와 `row.eachCell({includeEmpty:true})`는 ExcelJS 내부에서 빈 좌표에 `getRow`와 `getCell`을 호출해 실제 Row/Cell 객체를 만들었다. 이 객체가 workbook에 남아 희소 입력의 검사뿐 아니라 후속 직렬화 시간과 메모리까지 늘린 것이 R5 회귀 원인이다.

`src/utils/xlsxReport.ts`의 backstop을 `worksheet.rowCount` 범위의 `findRow`, 기존 행의 `row.cellCount` 범위의 `findCell` 조회로 교체했다. 두 API는 없는 좌표를 만들지 않는다. 실제 존재하는 값 없는 style-only 셀과 행·열 상속 `numFmt`는 계속 검사한다. 셀 값·시트명·`numFmt` 범위, 입력 파서·엔진·한도·UI·QR 코드는 바꾸지 않았다.

## 결정적 객체 수·안전 오류 단언

원출력: `logs/backstop-contract.log`, `logs/backstop-contract.json`, unit `logs/unit.log`.

| 희소 표본 | 순회 전 Row/Cell | 순회 후 Row/Cell | fix-6 ms |
|---|---:|---:|---:|
| 50,000행×M열 | 50,001 / 50,001 | 50,001 / 50,001 | 18.607 / 8.068 / 8.165 |
| 마지막 값 C150001 | 2 / 2 | 2 / 2 | 14.620 / 10.183 / 10.386 |
| 40행×XFD열 | 41 / 41 | 41 / 41 | 27.809 / 21.552 / 22.235 |

값 경로 6건(시트명·scalar·formula·cache·rich text·hyperlink)과 값 없는 `numFmt` 6건(직접·style·빈 행·희소 마지막 열·행 상속·열 상속)은 전부 `REPORT_INTEGRITY_FAILED`이며 serializer 호출은 각각 0이다. unit에는 작은 style-only 희소 표본의 **3 Row/3 Cell → 동일** 단언도 고정했다. ms는 관찰 출력에만 남기고 unit 임계값으로 쓰지 않았다.

## 동일 희소 fixture parser→writer 재측정

입력은 astra가 만든 원본을 읽기 전용 복사했으며 SHA-256은 43,165B 표본 `795db960...e16dc39`, 166,209B 표본 `196f7ebb...f165909b`다. 원출력은 `logs/sparse-3900x512-fix6.log`, `logs/sparse-19000x512-fix6.log`, 각 JSON과 `logs/sparse-*-xml.json`이다.

| 입력 | fix-4 출력 | fix-5 출력 | fix-6 출력 / max RSS | 재개방 |
|---|---:|---:|---:|---|
| 3,900×512, 43,165B, 실제 4,412셀 | 208.6ms | 6,485 / 9,218 / 6,568ms | **244.383ms / 193,392KiB** | 5시트·SR3901=3901 |
| 19,000×512, 166,209B, 실제 19,512셀 | 675.5ms | 60초 제한 초과 | **725.462ms / 326,520KiB** | 5시트·SR19001=19001 |

두 결과는 ExcelJS로 재개방했고 ElementTree가 모든 XML/rels 14개를 파싱했다. 데이터 시트 실제 셀 수는 각각 4,412/19,512이고 데이터행 `spans`는 `512:512`다. 출력 파일은 `artifacts/sparse-*-fix6-cleaned.xlsx`에 있다.

## 밀집 비용

동일 650,021셀·50,009행 표본의 fix-6 backstop은 **117.310/117.684/113.878ms**였다. fix-4 **123.4/117.5/115.9ms**, fix-5 **129.8/138.5/139.9ms**와 대조했고 순회 전후 Row/Cell은 **50,009/650,021 → 동일**이다. 원출력은 `logs/backstop-dense.log`와 `logs/backstop-dense.json`이다.

## 회귀 결과

| 검증 | 결과 |
|---|---:|
| `./node_modules/.bin/tsc -b` | exit 0 |
| `npm run test:unit` | 269/269 |
| `npm run build` | 2,835 modules·61 정적 페이지 |
| `npm run test:static` | exit 0·startup recovery 104 |
| `npm run test:excel-compare` | exit 0 |
| `npm run test:excel-cleaner` | exit 0·R4 브라우저 2건 포함 |
| `npm run test:qr-bulk` | exit 0 |
| `npm run test:browser` (TEST_SCOPE 미설정) | Excel·Word·PDF 전체 exit 0 |
| `npm run bundle:measure` | exit 0·80 JS / 1 CSS |
| `npm run css:orphans` | exit 0·orphan 0 |
| `node tests/tool-registry-routes.mjs` | exit 0·20 route |
| 원본 R1/조합/요소/lexical/R3/R4 | 2/2·2/2·5/5·32/32·2/2·2/2 |
| 독립 확장 | 2,880/2,880 |
| 지정 데이터행 음성/양성 | 6/6·4/4 |
| 문자 보존 | 1,114,112/1,114,112·34 workbook 3-reader |
| scanner/reference 종료성 | 60/60·32/32 |
| 폭·대량·토폴로지 | `[12,13,47,48,48]`·50,000/150,000행·9시트·13열 통과 |
| 사용자 파일 | 713/37/48/4·9시트·856행·95열·폭 12~48·54,121B |
| `git diff --check` | exit 0 |

원본 3차 CDATA 행렬은 기대대로 **2,764/2,880·exit 1**이며 ExcelJS CDATA 누락 116건이다. 별도 ElementTree 의미 검사는 **192/192**, scanner 불일치 0이다. 이를 통과로 세거나 새 희소 writer의 60초 제한 초과와 scanner/reference 종료성 결과를 섞지 않았다.

## 기록 정정 위치

`docs/review-notes.md`의 fix-6 절에 다음을 반영했다.

1. R4 기존 결함과 fix-5가 만든 R5 회귀를 분리하고, 밀집 표본만으로 희소 비용을 닫은 판정이 불충분했음을 기록했다.
2. 글꼴·색·테두리 style은 OOXML `comparableStyle`→모델 clone→`target.style` 입력 유래 경로가 있으나 지정 10건은 inputAdapter에서 차단된다고 정정했다.
3. 정리 numFmt·비교 정규화·QR·docProps·정의된 이름·하이퍼링크/주석/조건부 서식·style·worksheet 속성의 필드별 결론표를 추가했다.
4. 원본 CDATA 2,764/2,880·exit 1과 독립 ElementTree 192/192를 분리했다.
5. scanner/reference 60/60·32/32의 범위를 새 희소 writer 출력까지 확대하지 않았다.

`CHANGELOG.md`에는 코드 변경만 Codx 서명 한 줄로 남겼다.

## 하네스 기록

첫 3,900×512 측정 probe는 `ExcelCleanerOutput` 객체 자체를 `writeFile`에 전달해 `ERR_INVALID_ARG_TYPE`로 exit 1이었다. `output.buffer`를 쓰도록 검수용 probe만 고친 동일 제품 경로가 통과했으며 최초 로그는 `logs/sparse-3900x512-fix6-initial-failed.log`에 남겼다. 전체 검증을 한 호출로 묶은 최초 build 출력 수집은 도구 경계에서 중단돼 완료 판정하지 않았고, 같은 build를 단독 실행해 exit 0 원출력을 `logs/build.log`에 보존했다.

preview는 `127.0.0.1:4330 --strictPort`, QR 보조 proxy는 저장소 밖 preload로 4331에 고정했다. 브라우저와 preview 종료 후 bundle을 실행했고, 종료 시 4330~4339 리스너는 없다.
